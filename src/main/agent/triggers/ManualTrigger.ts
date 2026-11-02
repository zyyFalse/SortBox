/**
 * 手动策略：放文件进去什么都不会发生。
 * 只有人点「立即整理」时，Agent 调用 runNow。
 */
import type { TriggerContext, TriggerHook } from './TriggerHook';

/** 不注册任何定时器。 */
export class ManualTrigger implements TriggerHook {
  readonly policy = 'manual' as const;
  private context: TriggerContext | null = null;

  /** 只记住上下文，好让 runNow 能请求一轮。 */
  start(context: TriggerContext): void {
    this.context = context;
  }

  /** 丢掉上下文。 */
  stop(): void {
    this.context = null;
  }

  /** 文件变化不触发。 */
  notifyActivity(_folder: string, _at: number): void {}

  /** 由「立即整理」调用，直接请求一轮手动整理。 */
  runNow(): void {
    this.context?.requestRound('manual');
  }
}
