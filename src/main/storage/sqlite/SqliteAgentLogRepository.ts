import type { AgentAction, AgentLog, AgentLogView, LogQuery } from '@shared/types/domain';
import type { AgentLogRepository } from '../repositories';
import type { Database } from './Database';
import { mapLog, mapLogView, type LogRow } from './rows';

const LOG_VIEW_SQL = `
SELECT l.*, m.file_name AS file_name, p.name AS preset_name
  FROM agent_log l
  LEFT JOIN material m ON m.id = l.material_id
  LEFT JOIN preset p ON p.id = l.preset_id
`;

function likeContains(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** 处理记录。只追加，撤销不删行。 */
export class SqliteAgentLogRepository implements AgentLogRepository {
  constructor(private readonly database: Database) {}

  /** 追加一条记录并返回带 id 的结果。 */
  append(log: Omit<AgentLog, 'id'>): Promise<AgentLog> {
    const result = this.database.raw
      .prepare(
        `INSERT INTO agent_log (
           round_id, material_id, preset_id, action, from_path, to_path, reason, trace,
           duration_ms, dry_run, created_at, undone, undone_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        log.roundId,
        log.materialId,
        log.presetId,
        log.action,
        log.fromPath,
        log.toPath,
        log.reason,
        log.trace,
        log.durationMs,
        log.dryRun ? 1 : 0,
        log.createdAt,
        log.undone ? 1 : 0,
        log.undoneAt
      );
    return this.getById(Number(result.lastInsertRowid)).then((created) => {
      if (!created) {
        throw new Error('写入处理记录失败');
      }
      return created;
    });
  }

  /** 按 id 读取。 */
  getById(id: number): Promise<AgentLog | null> {
    const row = this.database.raw.prepare(`SELECT * FROM agent_log WHERE id = ?`).get(id) as LogRow | undefined;
    return Promise.resolve(row ? mapLog(row) : null);
  }

  /** 最近若干条，给控制台用。 */
  listRecent(limit: number): Promise<AgentLogView[]> {
    const rows = this.database.raw.prepare(`${LOG_VIEW_SQL} ORDER BY l.id DESC LIMIT ?`).all(limit) as LogRow[];
    return Promise.resolve(rows.map(mapLogView));
  }

  /** 某一轮里的每条处理，按发生顺序排列。 */
  listByRound(roundId: number): Promise<AgentLogView[]> {
    const rows = this.database.raw
      .prepare(`${LOG_VIEW_SQL} WHERE l.round_id = ? ORDER BY l.id ASC`)
      .all(roundId) as LogRow[];
    return Promise.resolve(rows.map(mapLogView));
  }

  /** 某个文件的全部历史。 */
  listByMaterial(materialId: number): Promise<AgentLogView[]> {
    const rows = this.database.raw
      .prepare(`${LOG_VIEW_SQL} WHERE l.material_id = ? ORDER BY l.id DESC LIMIT 200`)
      .all(materialId) as LogRow[];
    return Promise.resolve(rows.map(mapLogView));
  }

  /** 按动作、时间和关键字筛选。 */
  query(query: LogQuery): Promise<AgentLogView[]> {
    const keyword = query.keyword && query.keyword.trim() !== '' ? likeContains(query.keyword.trim()) : null;
    const rows = this.database.raw
      .prepare(
        `${LOG_VIEW_SQL}
          WHERE (? IS NULL OR l.action = ?)
            AND (? IS NULL OR l.created_at >= ?)
            AND (? IS NULL OR l.created_at <= ?)
            AND (? IS NULL OR l.from_path LIKE ? ESCAPE '\\' OR IFNULL(m.file_name, '') LIKE ? ESCAPE '\\')
          ORDER BY l.id DESC
          LIMIT 2000`
      )
      .all(query.action, query.action, query.from, query.from, query.to, query.to, keyword, keyword, keyword) as LogRow[];
    return Promise.resolve(rows.map(mapLogView));
  }

  /** 最近一条还能撤销的正式归档。试运行不算。 */
  findLatestUndoableArchive(): Promise<AgentLog | null> {
    const row = this.database.raw
      .prepare(
        `SELECT * FROM agent_log
          WHERE action = 'archived' AND undone = 0 AND dry_run = 0
          ORDER BY id DESC LIMIT 1`
      )
      .get() as LogRow | undefined;
    return Promise.resolve(row ? mapLog(row) : null);
  }

  /** 这个文件最近一条记录，用来判断上次失败后文件有没有变。 */
  latestByMaterial(materialId: number): Promise<AgentLog | null> {
    const row = this.database.raw
      .prepare(`SELECT * FROM agent_log WHERE material_id = ? ORDER BY id DESC LIMIT 1`)
      .get(materialId) as LogRow | undefined;
    return Promise.resolve(row ? mapLog(row) : null);
  }

  /** 把一条归档标成已撤销，不新增记录。 */
  markUndone(id: number, undoneAt: number): Promise<void> {
    this.database.raw.prepare(`UPDATE agent_log SET undone = 1, undone_at = ? WHERE id = ?`).run(undoneAt, id);
    return Promise.resolve();
  }

  /** 从某个时间点起，某种动作有多少条。试运行不计入。 */
  countByActionSince(action: AgentAction, sinceMs: number): Promise<number> {
    const row = this.database.raw
      .prepare(
        `SELECT COUNT(*) AS n FROM agent_log WHERE action = ? AND dry_run = 0 AND created_at >= ?`
      )
      .get(action, sinceMs) as { n: number };
    return Promise.resolve(row.n);
  }

  /** 某种动作的累计条数。 */
  countAction(action: AgentAction): Promise<number> {
    const row = this.database.raw
      .prepare(`SELECT COUNT(*) AS n FROM agent_log WHERE action = ? AND dry_run = 0`)
      .get(action) as { n: number };
    return Promise.resolve(row.n);
  }
}
