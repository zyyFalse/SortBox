import type {
  AgentLog,
  AgentLogView,
  AgentRound,
  HabitObservation,
  Material,
  Preset
} from '@shared/types/domain';

export interface PresetRow {
  id: number;
  name: string;
  extensions: string | null;
  name_includes: string | null;
  name_starts: string | null;
  name_ends: string | null;
  name_excludes: string | null;
  target_dir: string;
  path_layout: string;
  priority: number;
  enabled: number;
  max_size_mb: number;
  created_at: number;
  updated_at: number;
}

export interface MaterialRow {
  id: number;
  file_name: string;
  current_path: string;
  path_key: string;
  origin_path: string | null;
  preset_id: number | null;
  category: string | null;
  extension: string;
  size_bytes: number;
  modified_at: number;
  sha256: string | null;
  status: Material['status'];
  favorite: number;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
}

export interface LogRow {
  id: number;
  round_id: number;
  material_id: number | null;
  preset_id: number | null;
  action: AgentLog['action'];
  from_path: string;
  to_path: string | null;
  reason: string;
  trace: string;
  duration_ms: number;
  dry_run: number;
  created_at: number;
  undone: number;
  undone_at: number | null;
  file_name?: string | null;
  preset_name?: string | null;
}

/** 把预设表的一行变成界面用的对象。SQLite 里的 0/1 在这里变回布尔值。 */
export function mapPreset(row: PresetRow): Preset {
  return {
    id: row.id,
    name: row.name,
    extensions: row.extensions,
    nameIncludes: row.name_includes,
    nameStarts: row.name_starts,
    nameEnds: row.name_ends,
    nameExcludes: row.name_excludes,
    targetDir: row.target_dir,
    pathLayout: row.path_layout,
    priority: row.priority,
    enabled: row.enabled === 1,
    maxSizeMb: row.max_size_mb,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** 把资料表的一行变成对象。path_key 只用于查重，不出现在领域对象里。 */
export function mapMaterial(row: MaterialRow): Material {
  return {
    id: row.id,
    fileName: row.file_name,
    currentPath: row.current_path,
    originPath: row.origin_path,
    presetId: row.preset_id,
    category: row.category,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    modifiedAt: row.modified_at,
    sha256: row.sha256,
    status: row.status,
    favorite: row.favorite === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at
  };
}

/** 把处理记录的一行变成对象。 */
export function mapLog(row: LogRow): AgentLog {
  return {
    id: row.id,
    roundId: row.round_id,
    materialId: row.material_id,
    presetId: row.preset_id,
    action: row.action,
    fromPath: row.from_path,
    toPath: row.to_path,
    reason: row.reason,
    trace: row.trace,
    durationMs: row.duration_ms,
    dryRun: row.dry_run === 1,
    createdAt: row.created_at,
    undone: row.undone === 1,
    undoneAt: row.undone_at
  };
}

/** 列表里额外带上文件名和预设名。 */
export function mapLogView(row: LogRow): AgentLogView {
  return {
    ...mapLog(row),
    fileName: row.file_name ?? null,
    presetName: row.preset_name ?? null
  };
}

/** 把轮次行变成对象。 */
export function mapRound(row: {
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
}): AgentRound {
  return {
    id: row.id,
    reason: row.reason,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    scanned: row.scanned,
    archived: row.archived,
    unclassified: row.unclassified,
    failed: row.failed,
    simulated: row.simulated,
    skipped: row.skipped,
    deferred: row.deferred
  };
}

/** 把学习次数行变成对象。预设名来自连接查询。 */
export function mapHabit(row: {
  feature_kind: HabitObservation['featureKind'];
  feature_value: string;
  preset_id: number;
  preset_name: string;
  polarity: HabitObservation['polarity'];
  hits: number;
  last_seen_at: number;
}): HabitObservation {
  return {
    featureKind: row.feature_kind,
    featureValue: row.feature_value,
    presetId: row.preset_id,
    presetName: row.preset_name,
    polarity: row.polarity,
    hits: row.hits,
    lastSeenAt: row.last_seen_at
  };
}
