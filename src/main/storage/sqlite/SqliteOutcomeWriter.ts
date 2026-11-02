/**
 * 文件先移动，成功之后才开事务写库。
 * 移动和写库不能放进同一个事务：事务回滚不会把文件搬回去。
 * 反过来，写库的两笔（改资料、加日志）必须一起成功，所以放在同一个 transaction 里。
 */
import type { AgentLog } from '@shared/types/domain';
import type { OutcomeCommit, OutcomeWriter } from '../repositories';
import type { Database } from './Database';
import { mapLog, type LogRow } from './rows';

function insertLog(database: Database, log: Omit<AgentLog, 'id'>): AgentLog {
  const result = database.raw
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
  const row = database.raw.prepare(`SELECT * FROM agent_log WHERE id = ?`).get(Number(result.lastInsertRowid)) as LogRow;
  return mapLog(row);
}

/** 把资料变更和日志放进同一个事务。 */
export class SqliteOutcomeWriter implements OutcomeWriter {
  constructor(private readonly database: Database) {}

  /** 按结果种类更新资料，并追加日志。 */
  commit(input: OutcomeCommit): Promise<AgentLog> {
    const log = this.database.transaction(() => {
      const now = Date.now();
      const material = input.material;
      if (material.kind === 'archived') {
        this.database.raw
          .prepare(
            `UPDATE material SET preset_id = ?, current_path = ?, path_key = ?, category = ?,
                    archived_at = ?, file_name = ?, status = 'archived', updated_at = ?
              WHERE id = ?`
          )
          .run(
            material.presetId,
            material.currentPath,
            material.pathKey,
            material.category,
            material.archivedAt,
            material.fileName,
            now,
            material.id
          );
      } else if (material.kind === 'unclassified') {
        this.database.raw
          .prepare(
            `UPDATE material SET current_path = ?, path_key = ?, category = ?, file_name = ?,
                    status = 'unclassified', preset_id = NULL, archived_at = NULL, updated_at = ?
              WHERE id = ?`
          )
          .run(material.currentPath, material.pathKey, material.category, material.fileName, now, material.id);
      } else if (material.kind === 'held') {
        this.database.raw
          .prepare(
            `UPDATE material SET current_path = ?, path_key = ?, file_name = ?, status = 'held',
                    preset_id = NULL, archived_at = NULL, updated_at = ?
              WHERE id = ?`
          )
          .run(material.currentPath, material.pathKey, material.fileName, now, material.id);
      }
      return insertLog(this.database, input.log);
    });
    return Promise.resolve(log);
  }

  /** 撤销：文件已经移回之后，把资料标成 held，并把原日志标成已撤销。 */
  undoHeld(input: {
    materialId: number;
    currentPath: string;
    pathKey: string;
    fileName: string;
    logId: number;
    undoneAt: number;
  }): Promise<void> {
    this.database.transaction(() => {
      this.database.raw
        .prepare(
          `UPDATE material SET current_path = ?, path_key = ?, file_name = ?, status = 'held',
                  preset_id = NULL, archived_at = NULL, updated_at = ?
            WHERE id = ?`
        )
        .run(input.currentPath, input.pathKey, input.fileName, input.undoneAt, input.materialId);
      this.database.raw
        .prepare(`UPDATE agent_log SET undone = 1, undone_at = ? WHERE id = ?`)
        .run(input.undoneAt, input.logId);
    });
    return Promise.resolve();
  }
}
