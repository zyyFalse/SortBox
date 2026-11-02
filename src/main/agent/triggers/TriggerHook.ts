import type { TriggerPolicy, TriggerReason } from '@shared/types/domain';

/**
 * 钩子只回答「现在能不能开始一轮」。
 * 它不能查数据库、不能移动文件、不能做匹配。
 * 文件变化时只能 notifyActivity，真正开轮由 requestRound 完成。
 */

/** 钩子内部心跳。业务上的等待时间来自设置，不写死在这里。 */
export const TRIGGER_TICK_MS = 250;

/** Agent 提供给钩子的只读窗口。 */
export interface TriggerContext {
  requestRound(reason: TriggerReason): void;
  hasCandidates(): boolean;
  isAgentIdle(): boolean;
  now(): number;
}

/** 四种策略都实现这一个接口，Agent 本身不用知道当前是哪一种。 */
export interface TriggerHook {
  readonly policy: TriggerPolicy;
  start(ctx: TriggerContext): void;
  stop(): void;
  notifyActivity(folder: string, at: number): void;
}
