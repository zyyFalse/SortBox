import type { Preset, PresetDraft } from '@shared/types/domain';
import type { PresetRepository } from '../repositories';
import type { Database } from './Database';
import { mapPreset, type PresetRow } from './rows';

/** 预设表。运行中不会自己插入，只接受初始化、保存和导入之后的写入。 */
export class SqlitePresetRepository implements PresetRepository {
  constructor(private readonly database: Database) {}

  /** 同步列出全部预设，供习惯诊断这种不能等待的地方使用。 */
  listSync(): Preset[] {
    const rows = this.database.raw
      .prepare(`SELECT * FROM preset ORDER BY priority ASC, id ASC`)
      .all() as PresetRow[];
    return rows.map(mapPreset);
  }

  /** 全部预设，优先级小的在前。 */
  list(): Promise<Preset[]> {
    return Promise.resolve(this.listSync());
  }

  /** 只返回启用中的预设。匹配和整理都用这份。 */
  listEnabled(): Promise<Preset[]> {
    const rows = this.database.raw
      .prepare(`SELECT * FROM preset WHERE enabled = 1 ORDER BY priority ASC, id ASC`)
      .all() as PresetRow[];
    return Promise.resolve(rows.map(mapPreset));
  }

  /** 按 id 取一条。没有则返回 null。 */
  getById(id: number): Promise<Preset | null> {
    const row = this.database.raw.prepare(`SELECT * FROM preset WHERE id = ?`).get(id) as
      | PresetRow
      | undefined;
    return Promise.resolve(row ? mapPreset(row) : null);
  }

  /** 新建或更新。id 为空就插入，否则更新原行。 */
  save(draft: PresetDraft): Promise<Preset> {
    const now = Date.now();
    if (draft.id === null) {
      const result = this.database.raw
        .prepare(
          `INSERT INTO preset (
             name, extensions, name_includes, name_starts, name_ends, name_excludes,
             target_dir, path_layout, priority, enabled, max_size_mb, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          draft.name,
          draft.extensions,
          draft.nameIncludes,
          draft.nameStarts,
          draft.nameEnds,
          draft.nameExcludes,
          draft.targetDir,
          draft.pathLayout,
          draft.priority,
          draft.enabled ? 1 : 0,
          draft.maxSizeMb,
          now,
          now
        );
      return this.getById(Number(result.lastInsertRowid)).then((preset) => {
        if (!preset) {
          throw new Error('保存预设失败');
        }
        return preset;
      });
    }
    this.database.raw
      .prepare(
        `UPDATE preset SET
           name = ?, extensions = ?, name_includes = ?, name_starts = ?, name_ends = ?,
           name_excludes = ?, target_dir = ?, path_layout = ?, priority = ?, enabled = ?,
           max_size_mb = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        draft.name,
        draft.extensions,
        draft.nameIncludes,
        draft.nameStarts,
        draft.nameEnds,
        draft.nameExcludes,
        draft.targetDir,
        draft.pathLayout,
        draft.priority,
        draft.enabled ? 1 : 0,
        draft.maxSizeMb,
        now,
        draft.id
      );
    return this.getById(draft.id).then((preset) => {
      if (!preset) {
        throw new Error('预设不存在');
      }
      return preset;
    });
  }

  /** 只插入，不查询。给初始化的外层事务用，避免中途再开事务。 */
  insertNow(draft: PresetDraft): void {
    const now = Date.now();
    this.database.raw
      .prepare(
        `INSERT INTO preset (
           name, extensions, name_includes, name_starts, name_ends, name_excludes,
           target_dir, path_layout, priority, enabled, max_size_mb, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        draft.name,
        draft.extensions,
        draft.nameIncludes,
        draft.nameStarts,
        draft.nameEnds,
        draft.nameExcludes,
        draft.targetDir,
        draft.pathLayout,
        draft.priority,
        draft.enabled ? 1 : 0,
        draft.maxSizeMb,
        now,
        now
      );
  }

  /** 删除预设。仍有归档资料时要由上层拒绝，外键只是兜底。 */
  delete(id: number): Promise<void> {
    this.database.raw.prepare(`DELETE FROM preset WHERE id = ?`).run(id);
    return Promise.resolve();
  }

  /** 启用或停用，不改其它字段。 */
  setEnabled(id: number, enabled: boolean): Promise<void> {
    this.database.raw
      .prepare(`UPDATE preset SET enabled = ?, updated_at = ? WHERE id = ?`)
      .run(enabled ? 1 : 0, Date.now(), id);
    return Promise.resolve();
  }

  /** 这个预设下还有多少条已归档资料。 */
  countArchived(id: number): Promise<number> {
    const row = this.database.raw
      .prepare(`SELECT COUNT(*) AS n FROM material WHERE preset_id = ? AND status = 'archived'`)
      .get(id) as { n: number };
    return Promise.resolve(row.n);
  }
}
