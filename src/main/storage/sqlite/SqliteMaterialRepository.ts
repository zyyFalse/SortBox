import type { Material, MaterialStatus, QuerySpec } from '@shared/types/domain';
import type { MaterialRepository } from '../repositories';
import type { Database } from './Database';
import { mapMaterial, type MaterialRow } from './rows';

function likeContains(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** 资料表。每个见过的文件一行，不存正文。 */
export class SqliteMaterialRepository implements MaterialRepository {
  constructor(private readonly database: Database) {}

  /** 按主键读取。 */
  getById(id: number): Promise<Material | null> {
    return Promise.resolve(this.one(`SELECT * FROM material WHERE id = ?`, [id]));
  }

  /** 按规范化路径读取，用来判断这个位置是不是已经见过。 */
  getByPathKey(pathKey: string): Promise<Material | null> {
    return Promise.resolve(this.one(`SELECT * FROM material WHERE path_key = ?`, [pathKey]));
  }

  /** 按状态列出，最多 1000 条。 */
  listByStatus(status: MaterialStatus): Promise<Material[]> {
    return Promise.resolve(this.many(`SELECT * FROM material WHERE status = ? ORDER BY updated_at DESC LIMIT 1000`, [status]));
  }

  /** 未分类页：未分类和已撤销都算，按更新时间倒序。 */
  listUnclassifiedAndHeld(): Promise<Material[]> {
    return Promise.resolve(
      this.many(
        `SELECT * FROM material WHERE status IN ('unclassified', 'held') ORDER BY updated_at DESC LIMIT 1000`,
        []
      )
    );
  }

  /** 资料库搜索。关键字里的 % 和 _ 会转义，避免用户输入变成通配符。 */
  query(spec: QuerySpec): Promise<Material[]> {
    const keyword = spec.keyword && spec.keyword.trim() !== '' ? likeContains(spec.keyword.trim()) : null;
    return Promise.resolve(
      this.many(
        `SELECT * FROM material
          WHERE (? IS NULL OR file_name LIKE ? ESCAPE '\\')
            AND (? IS NULL OR preset_id = ?)
            AND (? IS NULL OR category = ?)
            AND (? IS NULL OR status = ?)
            AND (? = 0 OR favorite = 1)
          ORDER BY COALESCE(archived_at, updated_at) DESC
          LIMIT 2000`,
        [
          keyword,
          keyword,
          spec.presetId,
          spec.presetId,
          spec.category,
          spec.category,
          spec.status,
          spec.status,
          spec.favoriteOnly ? 1 : 0
        ]
      )
    );
  }

  /**
   * 第一次见到文件时插入，状态是未分类。
   * 已经有这一行时，只更新大小、修改时间和文件名，不改状态，避免把已归档改回去。
   */
  upsertSeen(input: {
    fileName: string;
    currentPath: string;
    pathKey: string;
    originPath: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
  }): Promise<Material> {
    const now = Date.now();
    const row = this.database.raw
      .prepare(
        `INSERT INTO material (
           file_name, current_path, path_key, origin_path, preset_id, category, extension,
           size_bytes, modified_at, sha256, status, favorite, created_at, updated_at, archived_at
         ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, 'unclassified', 0, ?, ?, NULL)
         ON CONFLICT(path_key) DO UPDATE SET
           file_name = excluded.file_name,
           size_bytes = excluded.size_bytes,
           modified_at = excluded.modified_at,
           updated_at = excluded.updated_at
         RETURNING *`
      )
      .get(
        input.fileName,
        input.currentPath,
        input.pathKey,
        input.originPath,
        input.extension,
        input.sizeBytes,
        input.modifiedAt,
        now,
        now
      ) as MaterialRow;
    return Promise.resolve(mapMaterial(row));
  }

  /** 归档成功：记下预设、新路径和新的 path_key。 */
  markArchived(id: number, patch: {
    presetId: number;
    currentPath: string;
    pathKey: string;
    category: string;
    archivedAt: number;
    fileName: string;
  }): Promise<void> {
    this.database.raw
      .prepare(
        `UPDATE material SET
           preset_id = ?, current_path = ?, path_key = ?, category = ?, archived_at = ?,
           file_name = ?, status = 'archived', updated_at = ?
         WHERE id = ?`
      )
      .run(patch.presetId, patch.currentPath, patch.pathKey, patch.category, patch.archivedAt, patch.fileName, Date.now(), id);
    return Promise.resolve();
  }

  /** 放进未分类目录。预设和归档时间都清空。 */
  markUnclassified(id: number, patch: {
    currentPath: string;
    pathKey: string;
    category: string;
    fileName: string;
  }): Promise<void> {
    this.database.raw
      .prepare(
        `UPDATE material SET
           current_path = ?, path_key = ?, category = ?, file_name = ?, status = 'unclassified',
           preset_id = NULL, archived_at = NULL, updated_at = ?
         WHERE id = ?`
      )
      .run(patch.currentPath, patch.pathKey, patch.category, patch.fileName, Date.now(), id);
    return Promise.resolve();
  }

  /** 撤销后留在原地。状态变成 held，预设清空，自动轮次会跳过它。 */
  markHeld(id: number, patch: { currentPath: string; pathKey: string; fileName: string }): Promise<void> {
    this.database.raw
      .prepare(
        `UPDATE material SET
           current_path = ?, path_key = ?, file_name = ?, status = 'held',
           preset_id = NULL, archived_at = NULL, updated_at = ?
         WHERE id = ?`
      )
      .run(patch.currentPath, patch.pathKey, patch.fileName, Date.now(), id);
    return Promise.resolve();
  }

  /** 文件还在，只刷新大小和修改时间。 */
  touchSeen(id: number, patch: { sizeBytes: number; modifiedAt: number }): Promise<void> {
    this.database.raw
      .prepare(`UPDATE material SET size_bytes = ?, modified_at = ?, updated_at = ? WHERE id = ?`)
      .run(patch.sizeBytes, patch.modifiedAt, Date.now(), id);
    return Promise.resolve();
  }

  /** 重评后仍然待在未分类目录时，只刷新时间，不新写日志。 */
  touchUpdated(id: number): Promise<void> {
    this.database.raw.prepare(`UPDATE material SET updated_at = ? WHERE id = ?`).run(Date.now(), id);
    return Promise.resolve();
  }

  /** 置顶或取消置顶。 */
  setFavorite(id: number, favorite: boolean): Promise<void> {
    this.database.raw
      .prepare(`UPDATE material SET favorite = ?, updated_at = ? WHERE id = ?`)
      .run(favorite ? 1 : 0, Date.now(), id);
    return Promise.resolve();
  }

  /** 用户点了「计算 SHA-256」之后才写入哈希。 */
  setSha256(id: number, sha256: string): Promise<void> {
    this.database.raw.prepare(`UPDATE material SET sha256 = ?, updated_at = ? WHERE id = ?`).run(sha256, Date.now(), id);
    return Promise.resolve();
  }

  /** 找出哈希相同的其它文件。 */
  findDuplicates(sha256: string, excludeId: number): Promise<Material[]> {
    return Promise.resolve(
      this.many(`SELECT * FROM material WHERE sha256 = ? AND id <> ? LIMIT 50`, [sha256, excludeId])
    );
  }

  /** 按状态计数，给控制台用。 */
  countByStatus(status: MaterialStatus): Promise<number> {
    const row = this.database.raw.prepare(`SELECT COUNT(*) AS n FROM material WHERE status = ?`).get(status) as {
      n: number;
    };
    return Promise.resolve(row.n);
  }

  private one(sql: string, params: unknown[]): Material | null {
    const row = this.database.raw.prepare(sql).get(...params) as MaterialRow | undefined;
    return row ? mapMaterial(row) : null;
  }

  private many(sql: string, params: unknown[]): Material[] {
    const rows = this.database.raw.prepare(sql).all(...params) as MaterialRow[];
    return rows.map(mapMaterial);
  }
}
