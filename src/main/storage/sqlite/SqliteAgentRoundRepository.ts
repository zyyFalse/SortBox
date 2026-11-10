import type { AgentRound } from '@shared/types/domain';
import type { AgentRoundRepository } from '../repositories';
import type { Database } from './Database';
import { mapRound } from './rows';

/** 每一轮整理的合计。id 用开始时的毫秒，不用自增。 */
export class SqliteAgentRoundRepository implements AgentRoundRepository {
  constructor(private readonly database: Database) {}

  /** 写入一轮摘要。 */
  append(round: AgentRound): Promise<void> {
    this.database.raw
      .prepare(
        `INSERT INTO agent_round (
           id, reason, started_at, finished_at, scanned, archived, unclassified,
           failed, simulated, skipped, deferred
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        round.id,
        round.reason,
        round.startedAt,
        round.finishedAt,
        round.scanned,
        round.archived,
        round.unclassified,
        round.failed,
        round.simulated,
        round.skipped,
        round.deferred
      );
    return Promise.resolve();
  }

  /** 最近一轮。还没有任何轮次时返回 null。 */
  latest(): Promise<AgentRound | null> {
    const row = this.database.raw
      .prepare(`SELECT * FROM agent_round ORDER BY id DESC LIMIT 1`)
      .get() as
      | {
          id: number;
          reason: AgentRound['reason'];
          started_at: number;
          finished_at: number;
          scanned: number;
          archived: number;
          unclassified: number;
          failed: number;
          simulated: number;
          skipped: number;
          deferred: number;
        }
      | undefined;
    return Promise.resolve(row ? mapRound(row) : null);
  }

  /** 最近若干轮，新的在前。控制台用它代替逐文件列表。 */
  listRecent(limit: number): Promise<AgentRound[]> {
    const rows = this.database.raw
      .prepare(`SELECT * FROM agent_round ORDER BY id DESC LIMIT ?`)
      .all(limit) as Array<{
      id: number;
      reason: AgentRound['reason'];
      started_at: number;
      finished_at: number;
      scanned: number;
      archived: number;
      unclassified: number;
      failed: number;
      simulated: number;
      skipped: number;
      deferred: number;
    }>;
    return Promise.resolve(rows.map(mapRound));
  }
}
