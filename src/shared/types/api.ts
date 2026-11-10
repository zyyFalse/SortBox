import type {
  AgentLogView,
  AgentRound,
  AgentSnapshot,
  AgentStats,
  HabitDiagnostics,
  HabitObservation,
  InitRequest,
  LogQuery,
  MatchResult,
  MaterialDetail,
  MaterialView,
  Preset,
  PresetDraft,
  PresetTemplate,
  QuerySpec
} from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';

/** 数据变了之后，界面知道该刷新哪一块。 */
export type DataScope = 'materials' | 'logs' | 'presets' | 'preferences' | 'habits';

/** 主进程推给界面的事件。载荷必须是可被 JSON 序列化的纯数据。 */
export type MainEvent =
  | { type: 'agent.state'; snapshot: AgentSnapshot }
  | { type: 'agent.log'; log: AgentLogView }
  | { type: 'agent.round'; round: AgentRound }
  | { type: 'data.changed'; scope: DataScope };

/**
 * ViewModel 能调用的全部能力。
 * 真实现走 IPC，单测用内存假实现。两边的方法名必须一致。
 */
export interface SortboxApi {
  getAppInfo(): Promise<{ version: string; userDataDir: string; watchFolders: string[] }>;
  pickDirectory(title: string): Promise<string | null>;
  openPath(path: string): Promise<void>;
  revealPath(path: string): Promise<void>;

  getPreferences(): Promise<Preferences>;
  savePreferences(patch: Partial<Preferences>): Promise<Preferences>;
  completeInitialization(request: InitRequest): Promise<Preferences>;
  resetInitialization(): Promise<void>;

  listPresets(): Promise<Preset[]>;
  getPreset(id: number): Promise<Preset | null>;
  savePreset(draft: PresetDraft): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  setPresetEnabled(id: number, enabled: boolean): Promise<void>;
  listPresetTemplates(): Promise<PresetTemplate[]>;
  exportPreset(id: number): Promise<string | null>;
  importPreset(): Promise<PresetDraft | null>;
  previewMatch(fileName: string, draft: PresetDraft | null): Promise<MatchResult>;
  suggestPresetFromMaterial(materialId: number): Promise<PresetDraft>;

  listUnclassified(): Promise<MaterialView[]>;
  unclassifiedSummary(): Promise<Array<{ extension: string; count: number }>>;
  releaseHeld(materialId: number): Promise<void>;

  queryMaterials(spec: QuerySpec): Promise<MaterialView[]>;
  getMaterialDetail(id: number): Promise<MaterialDetail | null>;
  listMaterialLogs(id: number): Promise<AgentLogView[]>;
  setFavorite(id: number, favorite: boolean): Promise<void>;
  computeSha256(id: number): Promise<string>;

  getAgentSnapshot(): Promise<AgentSnapshot>;
  getAgentStats(): Promise<AgentStats>;
  getLatestRound(): Promise<AgentRound | null>;
  listRecentRounds(limit: number): Promise<AgentRound[]>;
  listRoundLogs(roundId: number): Promise<AgentLogView[]>;
  startAgent(): Promise<void>;
  stopAgent(): Promise<void>;
  pauseAgent(): Promise<void>;
  resumeAgent(): Promise<void>;
  setDryRun(value: boolean): Promise<void>;
  runNow(): Promise<AgentRound>;

  queryLogs(query: LogQuery): Promise<AgentLogView[]>;
  listRecentLogs(limit: number): Promise<AgentLogView[]>;
  undoLog(id: number): Promise<void>;
  undoLatest(): Promise<void>;

  getHabitDiagnostics(): Promise<HabitDiagnostics>;
  reloadHabits(): Promise<HabitDiagnostics>;
  openUserMd(): Promise<void>;
  revealUserMd(): Promise<void>;
  listHabitObservations(): Promise<HabitObservation[]>;

  subscribe(listener: (event: MainEvent) => void): () => void;
}
