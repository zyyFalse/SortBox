import type {
  AgentAction,
  AgentLog,
  AgentLogView,
  AgentRound,
  HabitKind,
  HabitObservation,
  LogQuery,
  Material,
  MaterialStatus,
  Preset,
  PresetDraft,
  QuerySpec
} from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';

/** 全局设置。缺字段时实现应退回默认值并记一条警告。 */
export interface PreferenceRepository {
  load(): Promise<Preferences>;
  save(patch: Partial<Preferences>): Promise<Preferences>;
}

/** 预设的增删改查。删除前要先由上层确认没有已归档资料。 */
export interface PresetRepository {
  list(): Promise<Preset[]>;
  listEnabled(): Promise<Preset[]>;
  getById(id: number): Promise<Preset | null>;
  save(draft: PresetDraft): Promise<Preset>;
  delete(id: number): Promise<void>;
  setEnabled(id: number, enabled: boolean): Promise<void>;
  countArchived(id: number): Promise<number>;
}

/** 见过的文件。路径查重用 pathKey，不看大小写。 */
export interface MaterialRepository {
  getById(id: number): Promise<Material | null>;
  getByPathKey(pathKey: string): Promise<Material | null>;
  listByStatus(status: MaterialStatus): Promise<Material[]>;
  listUnclassifiedAndHeld(): Promise<Material[]>;
  query(spec: QuerySpec): Promise<Material[]>;
  upsertSeen(input: {
    fileName: string;
    currentPath: string;
    pathKey: string;
    originPath: string;
    extension: string;
    sizeBytes: number;
    modifiedAt: number;
  }): Promise<Material>;
  markArchived(id: number, patch: {
    presetId: number;
    currentPath: string;
    pathKey: string;
    category: string;
    archivedAt: number;
    fileName: string;
  }): Promise<void>;
  markUnclassified(id: number, patch: {
    currentPath: string;
    pathKey: string;
    category: string;
    fileName: string;
  }): Promise<void>;
  markHeld(id: number, patch: { currentPath: string; pathKey: string; fileName: string }): Promise<void>;
  touchSeen(id: number, patch: { sizeBytes: number; modifiedAt: number }): Promise<void>;
  touchUpdated(id: number): Promise<void>;
  setFavorite(id: number, favorite: boolean): Promise<void>;
  setSha256(id: number, sha256: string): Promise<void>;
  findDuplicates(sha256: string, excludeId: number): Promise<Material[]>;
  countByStatus(status: MaterialStatus): Promise<number>;
}

/** 处理记录只追加。撤销只把原记录标成已撤销。 */
export interface AgentLogRepository {
  append(log: Omit<AgentLog, 'id'>): Promise<AgentLog>;
  getById(id: number): Promise<AgentLog | null>;
  listRecent(limit: number): Promise<AgentLogView[]>;
  listByMaterial(materialId: number): Promise<AgentLogView[]>;
  listByRound(roundId: number): Promise<AgentLogView[]>;
  query(query: LogQuery): Promise<AgentLogView[]>;
  findLatestUndoableArchive(): Promise<AgentLog | null>;
  latestByMaterial(materialId: number): Promise<AgentLog | null>;
  markUndone(id: number, undoneAt: number): Promise<void>;
  countByActionSince(action: AgentAction, sinceMs: number): Promise<number>;
  countAction(action: AgentAction): Promise<number>;
}

/** 每一轮一行摘要。轮次号由调用方用开始时间的毫秒指定。 */
export interface AgentRoundRepository {
  append(round: AgentRound): Promise<void>;
  latest(): Promise<AgentRound | null>;
  listRecent(limit: number): Promise<AgentRound[]>;
}

/** 学习次数。习惯正文不在这张表里。 */
export interface HabitRepository {
  record(input: {
    featureKind: HabitKind;
    featureValue: string;
    presetId: number;
    polarity: 'positive' | 'negative';
    at: number;
  }): Promise<void>;
  listAll(): Promise<HabitObservation[]>;
  listPromotable(threshold: number): Promise<HabitObservation[]>;
  listDemotable(threshold: number): Promise<HabitObservation[]>;
}

/**
 * 移动成功之后，资料状态和日志必须在同一个事务里写完。
 * 如果这两笔分开写，中途崩溃就会出现「文件搬走了，但记录里没有」的裂缝。
 */
export interface OutcomeWriter {
  commit(input: OutcomeCommit): Promise<AgentLog>;
  undoHeld(input: {
    materialId: number;
    currentPath: string;
    pathKey: string;
    fileName: string;
    logId: number;
    undoneAt: number;
  }): Promise<void>;
}

/** 一次落库：可以只写日志，也可以连资料状态一起改。 */
export interface OutcomeCommit {
  material:
    | { kind: 'none' }
    | {
        kind: 'archived';
        id: number;
        presetId: number;
        currentPath: string;
        pathKey: string;
        category: string;
        archivedAt: number;
        fileName: string;
      }
    | {
        kind: 'unclassified';
        id: number;
        currentPath: string;
        pathKey: string;
        category: string;
        fileName: string;
      }
    | { kind: 'held'; id: number; currentPath: string; pathKey: string; fileName: string };
  log: Omit<AgentLog, 'id'>;
}
