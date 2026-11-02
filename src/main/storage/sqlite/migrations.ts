/**
 * 数据库版本。
 * 每个迁移放在一个事务里，事务内把 schema_version 写成新版本。
 * 结构对不上就报错并停下来，绝不自己删库。
 */
import type { SqlDatabase } from './sql';

type Connection = SqlDatabase;

/** 目前只有第 1 版。以后加表就再追加一项，不要改已经发布的 SQL。 */
export const MIGRATIONS: Array<{ version: number; up(db: Connection): void }> = [
  {
    version: 1,
    up(db: Connection): void {
      db.exec(VERSION_1);
      db.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', '1')`).run();
    }
  }
];

const VERSION_1 = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preference (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preset (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  extensions     TEXT,
  name_includes  TEXT,
  name_starts    TEXT,
  name_ends      TEXT,
  name_excludes  TEXT,
  target_dir     TEXT    NOT NULL,
  path_layout    TEXT    NOT NULL,
  priority       INTEGER NOT NULL DEFAULT 100,
  enabled        INTEGER NOT NULL DEFAULT 1,
  max_size_mb    INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS material (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name    TEXT    NOT NULL,
  current_path TEXT    NOT NULL,
  path_key     TEXT    NOT NULL UNIQUE,
  origin_path  TEXT,
  preset_id    INTEGER REFERENCES preset(id) ON DELETE SET NULL,
  category     TEXT,
  extension    TEXT    NOT NULL DEFAULT '',
  size_bytes   INTEGER NOT NULL,
  modified_at  INTEGER NOT NULL,
  sha256       TEXT,
  status       TEXT    NOT NULL CHECK (status IN ('unclassified', 'archived', 'held')),
  favorite     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  archived_at  INTEGER
);

CREATE TABLE IF NOT EXISTS agent_round (
  id            INTEGER PRIMARY KEY,
  reason        TEXT    NOT NULL,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER NOT NULL,
  scanned       INTEGER NOT NULL DEFAULT 0,
  archived      INTEGER NOT NULL DEFAULT 0,
  unclassified  INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  simulated     INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  deferred      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id    INTEGER NOT NULL,
  material_id INTEGER REFERENCES material(id) ON DELETE CASCADE,
  preset_id   INTEGER REFERENCES preset(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL CHECK (action IN ('archived','unclassified','failed','simulated','skipped')),
  from_path   TEXT    NOT NULL,
  to_path     TEXT,
  reason      TEXT    NOT NULL,
  trace       TEXT    NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  dry_run     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  undone      INTEGER NOT NULL DEFAULT 0,
  undone_at   INTEGER
);

-- 未分类页按状态过滤，并按更新时间倒序
CREATE INDEX IF NOT EXISTS idx_material_status        ON material(status);
CREATE INDEX IF NOT EXISTS idx_material_unclassified  ON material(status, updated_at DESC);
-- 预设列表上的已归档数量
CREATE INDEX IF NOT EXISTS idx_material_preset        ON material(preset_id, status);
CREATE INDEX IF NOT EXISTS idx_material_sha           ON material(sha256);
CREATE INDEX IF NOT EXISTS idx_log_round              ON agent_log(round_id);
CREATE INDEX IF NOT EXISTS idx_log_material           ON agent_log(material_id);
CREATE INDEX IF NOT EXISTS idx_log_created            ON agent_log(created_at);
-- 撤销最近一次：只看已整理且还没撤销的记录
CREATE INDEX IF NOT EXISTS idx_log_undoable           ON agent_log(action, undone);

CREATE TABLE IF NOT EXISTS habit_observation (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  feature_kind  TEXT    NOT NULL CHECK (feature_kind IN ('token', 'extension')),
  feature_value TEXT    NOT NULL,
  preset_id     INTEGER NOT NULL REFERENCES preset(id) ON DELETE CASCADE,
  polarity      TEXT    NOT NULL CHECK (polarity IN ('positive', 'negative')),
  hits          INTEGER NOT NULL DEFAULT 0,
  last_seen_at  INTEGER NOT NULL,
  UNIQUE (feature_kind, feature_value, preset_id, polarity)
);

-- 删除预设时清理学习次数，设置页也靠它列出某个预设的观测
CREATE INDEX IF NOT EXISTS idx_habit_preset ON habit_observation(preset_id);
`;

const SCHEMA_MISMATCH = '数据库结构不匹配，请备份后删除库文件再启动';

function readVersion(db: Connection): number {
  const exists = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'meta'`)
    .get();
  if (!exists) {
    return 0;
  }
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  if (!row) {
    return 0;
  }
  const version = Number(row.value);
  if (!Number.isInteger(version)) {
    throw new Error(SCHEMA_MISMATCH);
  }
  return version;
}

/** 把库升到代码认识的版本。已经升过的迁移不会再执行。 */
export function applyMigrations(db: Connection): void {
  let version = readVersion(db);
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) {
      continue;
    }
    db.transaction(() => {
      migration.up(db);
    })();
    version = migration.version;
  }
}

/** 七张表必须都在。少一张就视为结构被改坏，不自动修复。 */
export function assertSchema(db: Connection): void {
  const expected = ['meta', 'preference', 'preset', 'material', 'agent_round', 'agent_log', 'habit_observation'];
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .all() as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  for (const name of expected) {
    if (!names.has(name)) {
      throw new Error(SCHEMA_MISMATCH);
    }
  }
}

/** 打开库时识别「文件不是一个可读的 SQLite 库」。 */
export function isCorruptError(error: unknown): boolean {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  return code === 'SQLITE_CORRUPT' || code === 'SQLITE_NOTADB';
}

/** 给界面看的结构错误原文。 */
export function schemaMismatchError(): Error {
  return new Error(SCHEMA_MISMATCH);
}
