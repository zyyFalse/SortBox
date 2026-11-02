/**
 * 立即策略：每次写入之后，再等一个稳定窗口，确认文件不再变化就开一轮。
 * 如果这时 Agent 还在忙，就过 250ms 再问一次，而不是丢掉这次请求。
 */
import type { TriggerContext, TriggerHook } from './TriggerHook';

/** 文件一稳定就整理。 */
export class ImmediateTrigger implements TriggerHook {
  readonly policy = 'immediate' as const;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private context: TriggerContext | null = null;

  constructor(private readonly stabilityWindowMs: number) {}

  /** 记下上下文。定时器要等真正有文件变化才设置。 */
  start(context: TriggerContext): void {
    this.context = context;
  }

  /** 停掉还没到期的稳定窗口。 */
  stop(): void {
    this.clearTimer();
    this.pending = false;
    this.context = null;
  }

  /**
   * 每次变化都把稳定窗口从「现在」重新算起。
   * 这样连续写入时，不会在第一次写入的窗口结束时就把半截文件搬走。
   */
  notifyActivity(_folder: string, _at: number): void {
    this.pending = true;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.evaluate();
    }, this.stabilityWindowMs + 100);
  }

  private evaluate(): void {
    const context = this.context;
    if (context === null || !this.pending) {
      return;
    }
    if (!context.isAgentIdle()) {
      this.timer = setTimeout(() => {
        this.evaluate();
      }, 250);
      return;
    }
    if (!context.hasCandidates()) {
      this.pending = false;
      return;
    }
    this.pending = false;
    context.requestRound('immediate');
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
