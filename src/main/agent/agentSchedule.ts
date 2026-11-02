/**
 * 钩子和保底定时器的安装器。
 * AgentService 负责状态机；这里只负责「什么时候叫它再跑一轮」。
 * 换策略时先停旧钩子，再按新设置创建，所以界面改完 200 毫秒内就会生效。
 */
import path from 'node:path';
import type { AgentState, TriggerReason } from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';
import { pathKey } from '../core/paths';
import { createTrigger } from './triggers/createTrigger';
import type { TriggerHook } from './triggers/TriggerHook';

/** Agent 暴露给调度器的最小能力。 */
export interface ScheduleHost {
  requestRound(reason: TriggerReason): void;
  hasCandidates(): boolean;
  state(): AgentState;
  preferences(): Preferences;
  noteActivity(at: number): void;
  lastRoundAt(): number;
}

/** 监听回调、策略钩子和保底间隔。 */
export class AgentSchedule {
  private hook: TriggerHook | null = null;
  private fallback: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly host: ScheduleHost) {}

  /** 只接受直接放在监视目录里的文件。子目录里的变化不触发。 */
  onWatch(filePath: string): void {
    const parent = path.dirname(filePath);
    const folders = this.host.preferences().watchFolders;
    const folder = folders.find((item) => pathKey(item) === pathKey(parent));
    if (!folder) {
      return;
    }
    const at = Date.now();
    this.host.noteActivity(at);
    this.hook?.notifyActivity(folder, at);
  }

  /** 按当前策略换钩子。 */
  restartHook(): void {
    this.hook?.stop();
    const preferences = this.host.preferences();
    this.hook = createTrigger(preferences.triggerPolicy, preferences);
    this.hook.start({
      requestRound: (reason) => this.host.requestRound(reason),
      hasCandidates: () => this.host.hasCandidates(),
      isAgentIdle: () => this.host.state() === 'idle',
      now: () => Date.now()
    });
  }

  /** 保底间隔为 0 时不创建定时器。 */
  restartFallback(): void {
    this.clearFallback();
    const interval = this.host.preferences().intervalFallbackMs;
    if (interval <= 0) {
      return;
    }
    this.fallback = setInterval(() => {
      if (this.host.state() !== 'idle' || !this.host.hasCandidates()) {
        return;
      }
      if (Date.now() - this.host.lastRoundAt() < interval) {
        return;
      }
      this.host.requestRound('interval');
    }, interval);
  }

  /** 暂停和停止时拆掉钩子与定时器。 */
  stop(): void {
    this.hook?.stop();
    this.hook = null;
    this.clearFallback();
  }

  private clearFallback(): void {
    if (this.fallback !== null) {
      clearInterval(this.fallback);
      this.fallback = null;
    }
  }
}
