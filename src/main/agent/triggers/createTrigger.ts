import type { TriggerPolicy } from '@shared/types/domain';
import { IdleTrigger } from './IdleTrigger';
import { ImmediateTrigger } from './ImmediateTrigger';
import { IntervalTrigger } from './IntervalTrigger';
import { ManualTrigger } from './ManualTrigger';
import type { TriggerHook } from './TriggerHook';

/** 按策略名字创建对应的钩子。新增第五种策略时只改这里。 */
export function createTrigger(
  policy: TriggerPolicy,
  timing: {
    idleSettleMs: number;
    maxDeferMs: number;
    intervalMs: number;
    intervalFallbackMs: number;
    stabilityWindowMs: number;
  }
): TriggerHook {
  if (policy === 'immediate') {
    return new ImmediateTrigger(timing.stabilityWindowMs);
  }
  if (policy === 'interval') {
    return new IntervalTrigger(timing.intervalMs);
  }
  if (policy === 'manual') {
    return new ManualTrigger();
  }
  return new IdleTrigger(timing.idleSettleMs, timing.maxDeferMs);
}
