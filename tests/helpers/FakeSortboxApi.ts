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
  PresetTemplate
} from '@shared/types/domain';
import type { MainEvent, SortboxApi } from '@shared/types/api';
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/types/preferences';

const SNAPSHOT: AgentSnapshot = {
  state: 'idle',
  currentFileName: null,
  policy: 'idle',
  idleSettleMs: 3000,
  activeRoundId: null,
  lastActivityAt: null,
  watchFolderCount: 0,
  dryRun: false
};

const STATS: AgentStats = {
  archivedToday: 0,
  archivedTotal: 0,
  unclassifiedCount: 0,
  heldCount: 0,
  failedToday: 0,
  lastArchivedAt: null,
  lastRoundAt: null
};

const HABITS: HabitDiagnostics = {
  loaded: true,
  usedPrevious: false,
  path: 'user.md',
  ruleCount: 0,
  autoRuleCount: 0,
  errors: [],
  stalePresetNames: []
};

const MISS: MatchResult = {
  presetId: null,
  tier: 'none',
  hitToken: null,
  hitKind: 'none',
  reason: '无预设命中',
  trace: '',
  candidateCount: 0
};

/** 内存里的 SortboxApi。单测用它代替 IPC，不碰磁盘和数据库。 */
export class FakeSortboxApi implements SortboxApi {
  preferences: Preferences = {
    ...DEFAULT_PREFERENCES,
    watchFolders: [],
    ignoreExtensions: [...DEFAULT_PREFERENCES.ignoreExtensions]
  };
  savedPatch: Partial<Preferences> | null = null;
  openedUserMd = false;
  savePresetCalls = 0;
  suggested = 0;
  readonly events: MainEvent[] = [];

  getAppInfo(): Promise<{ version: string; userDataDir: string; watchFolders: string[] }> {
    return Promise.resolve({ version: '0.1.0', userDataDir: 'C:/data', watchFolders: [] });
  }
  pickDirectory(): Promise<string | null> {
    return Promise.resolve(null);
  }
  openPath(): Promise<void> {
    return Promise.resolve();
  }
  revealPath(): Promise<void> {
    return Promise.resolve();
  }
  getPreferences(): Promise<Preferences> {
    return Promise.resolve(this.preferences);
  }
  savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    this.savedPatch = patch;
    this.preferences = { ...this.preferences, ...patch };
    return Promise.resolve(this.preferences);
  }
  completeInitialization(request: InitRequest): Promise<Preferences> {
    this.preferences = {
      ...this.preferences,
      initialized: true,
      watchFolders: request.watchFolders,
      archiveRoot: request.archiveRoot,
      unclassifiedDir: request.unclassifiedDir
    };
    return Promise.resolve(this.preferences);
  }
  resetInitialization(): Promise<void> {
    this.preferences = { ...this.preferences, initialized: false };
    return Promise.resolve();
  }
  listPresets(): Promise<Preset[]> {
    return Promise.resolve([]);
  }
  getPreset(): Promise<Preset | null> {
    return Promise.resolve(null);
  }
  savePreset(draft: PresetDraft): Promise<Preset> {
    this.savePresetCalls += 1;
    return Promise.resolve({
      ...draft,
      id: draft.id ?? 1,
      createdAt: 1,
      updatedAt: 1
    });
  }
  deletePreset(): Promise<void> {
    return Promise.resolve();
  }
  setPresetEnabled(): Promise<void> {
    return Promise.resolve();
  }
  listPresetTemplates(): Promise<PresetTemplate[]> {
    return Promise.resolve([]);
  }
  exportPreset(): Promise<string | null> {
    return Promise.resolve(null);
  }
  importPreset(): Promise<PresetDraft | null> {
    return Promise.resolve(null);
  }
  previewMatch(): Promise<MatchResult> {
    return Promise.resolve(MISS);
  }
  suggestPresetFromMaterial(): Promise<PresetDraft> {
    this.suggested += 1;
    return Promise.resolve({
      id: null,
      name: '发票',
      extensions: 'pdf',
      nameIncludes: '发票',
      nameStarts: null,
      nameEnds: null,
      nameExcludes: null,
      targetDir: '',
      pathLayout: '{yyyy-MM}/{origFileName}',
      priority: 40,
      enabled: true,
      maxSizeMb: 0
    });
  }
  listUnclassified(): Promise<MaterialView[]> {
    return Promise.resolve([]);
  }
  unclassifiedSummary(): Promise<Array<{ extension: string; count: number }>> {
    return Promise.resolve([]);
  }
  releaseHeld(): Promise<void> {
    return Promise.resolve();
  }
  queryMaterials(): Promise<MaterialView[]> {
    return Promise.resolve([]);
  }
  getMaterialDetail(): Promise<MaterialDetail | null> {
    return Promise.resolve(null);
  }
  listMaterialLogs(): Promise<AgentLogView[]> {
    return Promise.resolve([]);
  }
  setFavorite(): Promise<void> {
    return Promise.resolve();
  }
  computeSha256(): Promise<string> {
    return Promise.resolve('abc');
  }
  getAgentSnapshot(): Promise<AgentSnapshot> {
    return Promise.resolve({ ...SNAPSHOT, policy: this.preferences.triggerPolicy });
  }
  getAgentStats(): Promise<AgentStats> {
    return Promise.resolve(STATS);
  }
  getLatestRound(): Promise<AgentRound | null> {
    return Promise.resolve(null);
  }
  startAgent(): Promise<void> {
    return Promise.resolve();
  }
  stopAgent(): Promise<void> {
    return Promise.resolve();
  }
  pauseAgent(): Promise<void> {
    return Promise.resolve();
  }
  resumeAgent(): Promise<void> {
    return Promise.resolve();
  }
  setDryRun(): Promise<void> {
    return Promise.resolve();
  }
  runNow(): Promise<AgentRound> {
    return Promise.resolve({
      id: 1,
      reason: 'manual',
      startedAt: 1,
      finishedAt: 2,
      scanned: 0,
      archived: 0,
      unclassified: 0,
      failed: 0,
      simulated: 0,
      skipped: 0,
      deferred: 0
    });
  }
  queryLogs(_query: LogQuery): Promise<AgentLogView[]> {
    return Promise.resolve([]);
  }
  listRecentLogs(): Promise<AgentLogView[]> {
    return Promise.resolve([]);
  }
  undoLog(): Promise<void> {
    return Promise.resolve();
  }
  undoLatest(): Promise<void> {
    return Promise.resolve();
  }
  getHabitDiagnostics(): Promise<HabitDiagnostics> {
    return Promise.resolve(HABITS);
  }
  reloadHabits(): Promise<HabitDiagnostics> {
    return Promise.resolve(HABITS);
  }
  openUserMd(): Promise<void> {
    this.openedUserMd = true;
    return Promise.resolve();
  }
  revealUserMd(): Promise<void> {
    return Promise.resolve();
  }
  listHabitObservations(): Promise<HabitObservation[]> {
    return Promise.resolve([]);
  }
  subscribe(listener: (event: MainEvent) => void): () => void {
    listener({ type: 'data.changed', scope: 'preferences' });
    return (): void => undefined;
  }
}

/** runNow 固定失败，用来看界面会不会把错误收进 state。 */
export class FailingRunApi extends FakeSortboxApi {
  override runNow(): Promise<AgentRound> {
    return Promise.reject(new Error('整理失败'));
  }
}
