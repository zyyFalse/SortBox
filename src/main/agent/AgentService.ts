/**
 * Agent 是常驻整理进程。文件变化只通知钩子；钩子决定何时 requestRound。
 * 一轮里的文件串行移动。状态：stopped → scanning → idle → processing → idle。
 * 暂停停在 paused，恢复后补跑一轮启动扫描。
 */
import type { AgentRound, AgentSnapshot, AgentState, TriggerReason } from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';
import type { AppEvents } from '../core/events';
import { isPathInside } from '../core/paths';
import type {
  AgentLogRepository,
  AgentRoundRepository,
  MaterialRepository,
  OutcomeWriter,
  PresetRepository
} from '../storage/repositories';
import type { HabitLearner } from '../userpref/HabitLearner';
import type { UserHabitSet } from '../userpref/UserHabitSet';
import { AgentSchedule } from './agentSchedule';
import { RoundQueue } from './roundQueue';
import { RoundRunner, type RoundHooks } from './roundRunner';
import { hasCandidateSync } from './scan';
import { UndoService } from './undo';
import { FolderWatcher } from './watcher';

/** 监视、裁决、移动、写日志的总控。 */
export class AgentService {
  private state: AgentState = 'stopped';
  private currentFileName: string | null = null;
  private activeRoundId: number | null = null;
  private lastActivityAt: number | null = null;
  private lastRoundStartedAt = 0;
  private readonly roundsQueue: RoundQueue;
  private readonly watcher = new FolderWatcher();
  private readonly schedule: AgentSchedule;
  private managed: string[] = [];
  private lastEmit = 0;
  private readonly runner: RoundRunner;
  readonly undo: UndoService;

  constructor(
    private readonly events: AppEvents,
    private readonly presets: PresetRepository,
    rounds: AgentRoundRepository,
    logs: AgentLogRepository,
    materials: MaterialRepository,
    outcomes: OutcomeWriter,
    habitSet: UserHabitSet,
    learner: HabitLearner,
    private preferences: Preferences
  ) {
    const hooks: RoundHooks = {
      isProcessing: () => this.state === 'processing',
      onFile: (name) => {
        this.currentFileName = name;
        this.publish(false);
      },
      onLog: (log) => {
        this.events.emit({ type: 'agent.log', log });
        this.events.emit({ type: 'data.changed', scope: 'logs' });
        this.events.emit({ type: 'data.changed', scope: 'materials' });
      },
      preferences: () => this.preferences,
      dryRun: () => this.preferences.agentDryRun
    };
    this.runner = new RoundRunner(
      materials,
      presets,
      logs,
      rounds,
      outcomes,
      habitSet,
      learner,
      hooks
    );
    this.undo = new UndoService(logs, outcomes, learner);
    this.roundsQueue = new RoundQueue({
      state: (): AgentState => this.state,
      run: (reason, includeParked): Promise<AgentRound> => this.execute(reason, includeParked),
      requestRound: (reason): void => this.requestRound(reason)
    });
    this.schedule = new AgentSchedule({
      requestRound: (reason): void => this.requestRound(reason),
      hasCandidates: (): boolean => this.hasCandidates(),
      state: (): AgentState => this.state,
      preferences: (): Preferences => this.preferences,
      noteActivity: (at): void => {
        this.lastActivityAt = at;
      },
      lastRoundAt: (): number => this.lastRoundStartedAt
    });
  }

  snapshot(): AgentSnapshot {
    return {
      state: this.state,
      currentFileName: this.currentFileName,
      policy: this.preferences.triggerPolicy,
      idleSettleMs: this.preferences.idleSettleMs,
      activeRoundId: this.activeRoundId,
      lastActivityAt: this.lastActivityAt,
      watchFolderCount: this.preferences.watchFolders.length,
      dryRun: this.preferences.agentDryRun
    };
  }

  /** 打开监听并做一轮启动扫描。已经在跑就什么都不做。 */
  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      return;
    }
    await this.refreshManaged();
    this.watcher.start(this.preferences.watchFolders, (filePath) => this.schedule.onWatch(filePath));
    this.setState('scanning');
    this.setState('idle');
    this.requestRound('startup');
    this.schedule.restartHook();
    this.schedule.restartFallback();
  }

  /** 关掉监听和钩子。正在跑的那一轮会在状态变成 stopped 后停下剩余文件。 */
  stop(): void {
    if (this.state === 'stopped') {
      return;
    }
    this.setState('stopped');
    this.watcher.stop();
    this.schedule.stop();
  }

  /** 退出时最多再等 3 秒，避免文件改到一半。 */
  async stopAndWait(): Promise<void> {
    this.stop();
    await Promise.race([
      this.roundsQueue.drain(),
      new Promise<void>((resolve) => {
        setTimeout(resolve, 3000);
      })
    ]);
  }

  /** 暂停。自动轮次不会再开始。 */
  pause(): void {
    if (this.state === 'stopped' || this.state === 'paused') {
      return;
    }
    this.setState('paused');
    this.schedule.stop();
  }

  /** 恢复后重新扫描，并补跑一轮。 */
  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      return;
    }
    await this.refreshManaged();
    this.watcher.start(this.preferences.watchFolders, (filePath) => this.schedule.onWatch(filePath));
    this.setState('scanning');
    this.setState('idle');
    this.schedule.restartHook();
    this.schedule.restartFallback();
    this.requestRound('startup');
  }

  /** 钩子或「立即整理」请求一轮。暂停和停止时直接丢掉。 */
  requestRound(reason: TriggerReason): void {
    if (this.state === 'paused' || this.state === 'stopped') {
      return;
    }
    this.roundsQueue.request(reason);
  }

  /** 人点了立即整理。这一轮也会看未分类目录里已经收走的文件。 */
  runNow(): Promise<AgentRound> {
    if (this.state === 'stopped' || this.state === 'paused') {
      return Promise.reject(new Error('整理尚未运行'));
    }
    return this.roundsQueue.runNow();
  }

  /** 保存预设、启用或删除之后，把未分类和已撤销再判一次。 */
  async reevaluateParked(): Promise<void> {
    await this.refreshManaged();
    const roundId = this.nextRoundId();
    this.setState('processing');
    this.activeRoundId = roundId;
    try {
      const round = await this.runner.reevaluateParked(roundId);
      this.events.emit({ type: 'agent.round', round });
      this.events.emit({ type: 'data.changed', scope: 'materials' });
    } finally {
      this.activeRoundId = null;
      if (this.state === 'processing') {
        this.setState('idle');
      }
    }
  }

  /** 重新分拣一个已撤销文件。 */
  async releaseHeld(materialId: number): Promise<void> {
    await this.runner.releaseHeld(materialId);
    this.events.emit({ type: 'data.changed', scope: 'materials' });
  }

  /** 切换试运行。只改内存中的开关，持久化由调用方写进设置。 */
  setDryRun(value: boolean): void {
    this.preferences = { ...this.preferences, agentDryRun: value };
    this.publish(true);
  }

  /** 设置保存之后：目录变了就重启监听，时间或策略变了就换钩子。 */
  async applyPreferences(next: Preferences): Promise<void> {
    const previous = this.preferences;
    this.preferences = next;
    await this.refreshManaged();
    if (this.state === 'stopped' || this.state === 'paused') {
      this.publish(true);
      return;
    }
    const foldersChanged = previous.watchFolders.join('\n') !== next.watchFolders.join('\n');
    const timingChanged =
      previous.triggerPolicy !== next.triggerPolicy ||
      previous.idleSettleMs !== next.idleSettleMs ||
      previous.maxDeferMs !== next.maxDeferMs ||
      previous.intervalMs !== next.intervalMs ||
      previous.intervalFallbackMs !== next.intervalFallbackMs ||
      previous.stabilityWindowMs !== next.stabilityWindowMs;
    if (foldersChanged) {
      this.watcher.start(next.watchFolders, (filePath) => this.schedule.onWatch(filePath));
      this.requestRound('startup');
    }
    if (timingChanged) {
      this.schedule.restartHook();
      this.schedule.restartFallback();
    }
    this.publish(true);
  }

  /** 钩子询问时用。不查数据库，只看目录里的名字、扩展名、大小和修改时间。 */
  hasCandidates(): boolean {
    return hasCandidateSync(this.preferences.watchFolders, this.preferences, (filePath) =>
      this.managed.some((dir) => dir.trim() !== '' && isPathInside(filePath, dir))
    );
  }

  private async execute(reason: TriggerReason, includeParked: boolean): Promise<AgentRound> {
    const roundId = this.nextRoundId();
    this.activeRoundId = roundId;
    this.setState('processing');
    try {
      const round = await this.runner.runRound(reason, includeParked, roundId);
      this.events.emit({ type: 'agent.round', round });
      return round;
    } finally {
      this.activeRoundId = null;
      this.currentFileName = null;
      if (this.state === 'processing') {
        this.setState('idle');
      }
    }
  }

  private nextRoundId(): number {
    const now = Date.now();
    const roundId = now <= this.lastRoundStartedAt ? this.lastRoundStartedAt + 1 : now;
    this.lastRoundStartedAt = roundId;
    return roundId;
  }

  private async refreshManaged(): Promise<void> {
    const presets = await this.presets.list();
    this.managed = [this.preferences.unclassifiedDir, ...presets.map((preset) => preset.targetDir)];
  }

  private setState(state: AgentState): void {
    this.state = state;
    this.publish(true);
  }

  private publish(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastEmit < 100) {
      return;
    }
    this.lastEmit = now;
    this.events.emit({ type: 'agent.state', snapshot: this.snapshot() });
  }
}
