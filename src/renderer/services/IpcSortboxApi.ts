/**
 * 页面侧的 SortboxApi。
 * 每个方法只是把名字和参数交给 preload，真正的工作在主进程。
 */
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
import type { MainEvent, SortboxApi } from '@shared/types/api';
import type { Preferences } from '@shared/types/preferences';

/** 通过唯一通道调用主进程。 */
export class IpcSortboxApi implements SortboxApi {
  private call<T>(method: string, args: unknown[]): Promise<T> {
    return window.sortbox.invoke(method, args) as Promise<T>;
  }

  getAppInfo(): Promise<{ version: string; userDataDir: string; watchFolders: string[] }> {
    return this.call('getAppInfo', []);
  }
  pickDirectory(title: string): Promise<string | null> {
    return this.call('pickDirectory', [title]);
  }
  openPath(target: string): Promise<void> {
    return this.call('openPath', [target]);
  }
  revealPath(target: string): Promise<void> {
    return this.call('revealPath', [target]);
  }
  getPreferences(): Promise<Preferences> {
    return this.call('getPreferences', []);
  }
  savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    return this.call('savePreferences', [patch]);
  }
  completeInitialization(request: InitRequest): Promise<Preferences> {
    return this.call('completeInitialization', [request]);
  }
  resetInitialization(): Promise<void> {
    return this.call('resetInitialization', []);
  }
  listPresets(): Promise<Preset[]> {
    return this.call('listPresets', []);
  }
  getPreset(id: number): Promise<Preset | null> {
    return this.call('getPreset', [id]);
  }
  savePreset(draft: PresetDraft): Promise<Preset> {
    return this.call('savePreset', [draft]);
  }
  deletePreset(id: number): Promise<void> {
    return this.call('deletePreset', [id]);
  }
  setPresetEnabled(id: number, enabled: boolean): Promise<void> {
    return this.call('setPresetEnabled', [id, enabled]);
  }
  listPresetTemplates(): Promise<PresetTemplate[]> {
    return this.call('listPresetTemplates', []);
  }
  exportPreset(id: number): Promise<string | null> {
    return this.call('exportPreset', [id]);
  }
  importPreset(): Promise<PresetDraft | null> {
    return this.call('importPreset', []);
  }
  previewMatch(fileName: string, draft: PresetDraft | null): Promise<MatchResult> {
    return this.call('previewMatch', [fileName, draft]);
  }
  suggestPresetFromMaterial(materialId: number): Promise<PresetDraft> {
    return this.call('suggestPresetFromMaterial', [materialId]);
  }
  listUnclassified(): Promise<MaterialView[]> {
    return this.call('listUnclassified', []);
  }
  unclassifiedSummary(): Promise<Array<{ extension: string; count: number }>> {
    return this.call('unclassifiedSummary', []);
  }
  releaseHeld(materialId: number): Promise<void> {
    return this.call('releaseHeld', [materialId]);
  }
  queryMaterials(spec: QuerySpec): Promise<MaterialView[]> {
    return this.call('queryMaterials', [spec]);
  }
  getMaterialDetail(id: number): Promise<MaterialDetail | null> {
    return this.call('getMaterialDetail', [id]);
  }
  listMaterialLogs(id: number): Promise<AgentLogView[]> {
    return this.call('listMaterialLogs', [id]);
  }
  setFavorite(id: number, favorite: boolean): Promise<void> {
    return this.call('setFavorite', [id, favorite]);
  }
  computeSha256(id: number): Promise<string> {
    return this.call('computeSha256', [id]);
  }
  getAgentSnapshot(): Promise<AgentSnapshot> {
    return this.call('getAgentSnapshot', []);
  }
  getAgentStats(): Promise<AgentStats> {
    return this.call('getAgentStats', []);
  }
  getLatestRound(): Promise<AgentRound | null> {
    return this.call('getLatestRound', []);
  }
  listRecentRounds(limit: number): Promise<AgentRound[]> {
    return this.call('listRecentRounds', [limit]);
  }
  listRoundLogs(roundId: number): Promise<AgentLogView[]> {
    return this.call('listRoundLogs', [roundId]);
  }
  startAgent(): Promise<void> {
    return this.call('startAgent', []);
  }
  stopAgent(): Promise<void> {
    return this.call('stopAgent', []);
  }
  pauseAgent(): Promise<void> {
    return this.call('pauseAgent', []);
  }
  resumeAgent(): Promise<void> {
    return this.call('resumeAgent', []);
  }
  setDryRun(value: boolean): Promise<void> {
    return this.call('setDryRun', [value]);
  }
  runNow(): Promise<AgentRound> {
    return this.call('runNow', []);
  }
  queryLogs(query: LogQuery): Promise<AgentLogView[]> {
    return this.call('queryLogs', [query]);
  }
  listRecentLogs(limit: number): Promise<AgentLogView[]> {
    return this.call('listRecentLogs', [limit]);
  }
  undoLog(id: number): Promise<void> {
    return this.call('undoLog', [id]);
  }
  undoLatest(): Promise<void> {
    return this.call('undoLatest', []);
  }
  getHabitDiagnostics(): Promise<HabitDiagnostics> {
    return this.call('getHabitDiagnostics', []);
  }
  reloadHabits(): Promise<HabitDiagnostics> {
    return this.call('reloadHabits', []);
  }
  openUserMd(): Promise<void> {
    return this.call('openUserMd', []);
  }
  revealUserMd(): Promise<void> {
    return this.call('revealUserMd', []);
  }
  listHabitObservations(): Promise<HabitObservation[]> {
    return this.call('listHabitObservations', []);
  }
  subscribe(listener: (event: MainEvent) => void): () => void {
    return window.sortbox.subscribe(listener);
  }
}
