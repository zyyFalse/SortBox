/**
 * 定时策略：到点才看一眼。文件变化本身不会提前开轮。
 */
import type { TriggerContext, TriggerHook } from './TriggerHook';

/** 每隔固定时间，如果空闲且有候选文件，就开一轮。 */
export class IntervalTrigger implements TriggerHook {
  readonly policy = 'interval' as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private context: TriggerContext | null = null;

  constructor(private readonly intervalMs: number) {}

  /** 按设置里的间隔启动定时器。 */
  start(context: TriggerContext): void {
    this.context = context;
    this.clearTimer();
    this.timer = setInterval(() => {
      this.evaluate();
    }, this.intervalMs);
  }

  /** 停止定时器。 */
  stop(): void {
    this.clearTimer();
    this.context = null;
  }

  /** 定时策略不关心单次文件变化。 */
  notifyActivity(_folder: string, _at: number): void {}

  private evaluate(): void {
    const context = this.context;
    if (context === null) {
      return;
    }
    if (context.isAgentIdle() && context.hasCandidates()) {
      context.requestRound('interval');
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
