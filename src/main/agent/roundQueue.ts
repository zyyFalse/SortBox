/**
 * 轮次排队。一轮还没结束时，新的请求只记住「还要再跑一次」，不会并行改同一个文件。
 * 队列是一条接一条的 Promise：上一轮的 then 里才开始下一轮。
 */
import type { AgentRound, AgentState, TriggerReason } from '@shared/types/domain';
import { logger } from '../core/logger';

/** 真正执行一轮时需要的状态。 */
export interface RoundQueueHost {
  state(): AgentState;
  run(reason: TriggerReason, includeParked: boolean): Promise<AgentRound>;
  requestRound(reason: TriggerReason): void;
}

/** 串行执行整理轮次。 */
export class RoundQueue {
  private queue: Promise<void> = Promise.resolve();
  private busy = false;
  private pending: TriggerReason | null = null;

  constructor(private readonly host: RoundQueueHost) {}

  /** 正在忙就只记下原因，空闲后再补一轮。 */
  request(reason: TriggerReason): void {
    const state = this.host.state();
    if (this.busy || state === 'processing' || state === 'scanning') {
      this.pending = reason;
      return;
    }
    void this.enqueue(reason, false).catch((error: unknown) => {
      logger.error('整理轮次失败', { message: error instanceof Error ? error.message : String(error) });
    });
  }

  /** 人点的立即整理，必须看未分类目录里已经收走的文件。 */
  runNow(): Promise<AgentRound> {
    return this.enqueue('manual', true);
  }

  /** 等已经排上的轮次结束。退出时用来限时等待。 */
  drain(): Promise<void> {
    return this.queue;
  }

  private enqueue(reason: TriggerReason, includeParked: boolean): Promise<AgentRound> {
    this.busy = true;
    return new Promise<AgentRound>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const state = this.host.state();
          if (state === 'stopped' || state === 'paused') {
            reject(new Error('整理尚未运行'));
            return;
          }
          resolve(await this.host.run(reason, includeParked));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        } finally {
          this.busy = false;
          const next = this.pending;
          this.pending = null;
          if (next && this.host.state() === 'idle') {
            this.host.requestRound(next);
          }
        }
      });
    });
  }
}
