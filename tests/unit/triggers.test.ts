import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrigger } from '../../src/main/agent/triggers/createTrigger';
import { IdleTrigger } from '../../src/main/agent/triggers/IdleTrigger';
import { ImmediateTrigger } from '../../src/main/agent/triggers/ImmediateTrigger';
import { IntervalTrigger } from '../../src/main/agent/triggers/IntervalTrigger';
import { ManualTrigger } from '../../src/main/agent/triggers/ManualTrigger';
import type { TriggerContext, TriggerHook } from '../../src/main/agent/triggers/TriggerHook';
import type { TriggerReason } from '@shared/types/domain';

function harness(options: { idle?: boolean; candidates?: boolean } = {}): {
  reasons: TriggerReason[];
  now: { value: number };
  context: TriggerContext;
} {
  const reasons: TriggerReason[] = [];
  const now = { value: 10_000 };
  const context: TriggerContext = {
    requestRound(reason: TriggerReason): void {
      reasons.push(reason);
    },
    hasCandidates(): boolean {
      return options.candidates ?? true;
    },
    isAgentIdle(): boolean {
      return options.idle ?? true;
    },
    now(): number {
      return now.value;
    }
  };
  return { reasons, now, context };
}

describe('整理钩子', (): void => {
  afterEach((): void => {
    vi.useRealTimers();
  });

  it('静默期间持续活动不会触发', (): void => {
    vi.useFakeTimers();
    const { reasons, now, context } = harness();
    const trigger = new IdleTrigger(3000, 30_000);
    trigger.start(context);
    now.value += 1000;
    trigger.notifyActivity('C:/down', now.value);
    vi.advanceTimersByTime(250);
    expect(reasons).toEqual([]);
    trigger.stop();
  });

  it('静默满窗口后触发 idle-settled', (): void => {
    vi.useFakeTimers();
    const { reasons, now, context } = harness();
    const trigger = new IdleTrigger(3000, 30_000);
    trigger.start(context);
    now.value += 3000;
    vi.advanceTimersByTime(250);
    expect(reasons).toEqual(['idle-settled']);
    trigger.stop();
  });

  it('候选一直在且超过最长等待时强制放行', (): void => {
    vi.useFakeTimers();
    const { reasons, now, context } = harness();
    const trigger = new IdleTrigger(3000, 5000);
    trigger.start(context);
    vi.advanceTimersByTime(250);
    now.value += 2000;
    trigger.notifyActivity('C:/down', now.value);
    now.value += 4000;
    trigger.notifyActivity('C:/down', now.value);
    vi.advanceTimersByTime(250);
    expect(reasons).toEqual(['max-defer']);
    trigger.stop();
  });

  it('立即策略在稳定窗口之后触发', (): void => {
    vi.useFakeTimers();
    const { reasons, context } = harness();
    const trigger = new ImmediateTrigger(800);
    trigger.start(context);
    trigger.notifyActivity('C:/down', 1);
    vi.advanceTimersByTime(900);
    expect(reasons).toEqual(['immediate']);
    trigger.stop();
  });

  it('立即策略没有候选时不触发', (): void => {
    vi.useFakeTimers();
    const { reasons, context } = harness({ candidates: false });
    const trigger = new ImmediateTrigger(800);
    trigger.start(context);
    trigger.notifyActivity('C:/down', 1);
    vi.advanceTimersByTime(900);
    expect(reasons).toEqual([]);
    trigger.stop();
  });

  it('立即策略在忙碌时推迟到空闲', (): void => {
    vi.useFakeTimers();
    let idle = false;
    const reasons: TriggerReason[] = [];
    const trigger = new ImmediateTrigger(800);
    trigger.start({
      requestRound(reason: TriggerReason): void {
        reasons.push(reason);
      },
      hasCandidates(): boolean {
        return true;
      },
      isAgentIdle(): boolean {
        return idle;
      },
      now(): number {
        return 1;
      }
    });
    trigger.notifyActivity('C:/down', 1);
    vi.advanceTimersByTime(900);
    expect(reasons).toEqual([]);
    idle = true;
    vi.advanceTimersByTime(250);
    expect(reasons).toEqual(['immediate']);
    trigger.stop();
  });

  it('定时策略到点且有候选才触发，文件变化本身不触发', (): void => {
    vi.useFakeTimers();
    const quiet = harness({ candidates: false });
    const waiting = new IntervalTrigger(1000);
    waiting.start(quiet.context);
    waiting.notifyActivity('C:/down', 1);
    vi.advanceTimersByTime(1000);
    expect(quiet.reasons).toEqual([]);
    waiting.stop();
    const ready = harness();
    const trigger = new IntervalTrigger(1000);
    trigger.start(ready.context);
    trigger.notifyActivity('C:/down', 1);
    expect(ready.reasons).toEqual([]);
    vi.advanceTimersByTime(1000);
    expect(ready.reasons).toEqual(['interval']);
    trigger.stop();
  });

  it('手动策略不被时间和文件变化触发', (): void => {
    vi.useFakeTimers();
    const { reasons, context } = harness();
    const trigger = new ManualTrigger();
    trigger.start(context);
    trigger.notifyActivity('C:/down', 1);
    vi.advanceTimersByTime(10_000);
    expect(reasons).toEqual([]);
    trigger.runNow();
    expect(reasons).toEqual(['manual']);
    trigger.stop();
    trigger.runNow();
    expect(reasons).toEqual(['manual']);
  });

  it('工厂按策略名字创建钩子', (): void => {
    const timing = {
      idleSettleMs: 3000,
      maxDeferMs: 30000,
      intervalMs: 60000,
      intervalFallbackMs: 0,
      stabilityWindowMs: 800
    };
    const hooks: TriggerHook[] = [
      createTrigger('idle', timing),
      createTrigger('immediate', timing),
      createTrigger('interval', timing),
      createTrigger('manual', timing)
    ];
    expect(hooks.map((hook) => hook.policy)).toEqual(['idle', 'immediate', 'interval', 'manual']);
  });
});
