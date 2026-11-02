/**
 * 静默检测：目录安静够久才整理。
 * 如果文件一直在写入，静默条件达不到，就用「强制放行」兜底。
 * 强制放行的起点是「第一次出现候选文件」，持续写入不会把这个起点往后推。
 */
import type { TriggerHook, TriggerContext } from './TriggerHook';
import { TRIGGER_TICK_MS } from './TriggerHook';

/** 默认策略。多个监视目录共用一条活动时间线。 */
export class IdleTrigger implements TriggerHook {
  readonly policy = 'idle' as const;
  private lastActivityAt = 0;
  private firstCandidateAt: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private context: TriggerContext | null = null;

  constructor(
    private readonly idleSettleMs: number,
    private readonly maxDeferMs: number
  ) {}

  /** 开始心跳。此时还没有候选文件。 */
  start(context: TriggerContext): void {
    this.context = context;
    this.lastActivityAt = context.now();
    this.firstCandidateAt = null;
    this.clearTimer();
    this.timer = setInterval(() => {
      this.evaluate();
    }, TRIGGER_TICK_MS);
  }

  /** 停止心跳。 */
  stop(): void {
    this.clearTimer();
    this.context = null;
  }

  /** 只记录最近一次变化的时间，不在这里直接开轮。 */
  notifyActivity(_folder: string, at: number): void {
    this.lastActivityAt = Math.max(this.lastActivityAt, at);
  }

  private evaluate(): void {
    const context = this.context;
    if (context === null || !context.isAgentIdle()) {
      return;
    }
    if (!context.hasCandidates()) {
      this.firstCandidateAt = null;
      return;
    }
    const now = context.now();
    if (this.firstCandidateAt === null) {
      this.firstCandidateAt = now;
    }
    if (now - this.lastActivityAt >= this.idleSettleMs) {
      this.reset(now);
      context.requestRound('idle-settled');
      return;
    }
    if (this.firstCandidateAt !== null && now - this.firstCandidateAt >= this.maxDeferMs) {
      this.reset(now);
      context.requestRound('max-defer');
    }
  }

  private reset(now: number): void {
    this.firstCandidateAt = null;
    this.lastActivityAt = now;
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
