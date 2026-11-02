/**
 * 设置、应用信息和习惯诊断。
 * 这些动作不负责搬文件，只改配置或打开 user.md。
 */
import type { HabitDiagnostics, HabitObservation } from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';
import type { AgentService } from '../agent/AgentService';
import type { AppEvents } from '../core/events';
import { sortboxDir, userMdPath } from '../core/paths';
import type { HabitRepository, PreferenceRepository, PresetRepository } from '../storage/repositories';
import { openPath, revealPath } from '../system/shellActions';
import { assertPreferenceRanges, assertSavedLocations } from '../system/preferenceRules';
import type { UserHabitSet } from '../userpref/UserHabitSet';

/** 设置和关于信息。 */
export class AppActions {
  constructor(
    private readonly version: string,
    private readonly preferences: PreferenceRepository,
    private readonly presets: PresetRepository,
    private readonly habits: HabitRepository,
    private readonly habitSet: UserHabitSet,
    private readonly events: AppEvents,
    private readonly agent: AgentService
  ) {}

  /** 关于页和标题栏需要的版本、数据目录、监视目录。 */
  async getAppInfo(): Promise<{ version: string; userDataDir: string; watchFolders: string[] }> {
    const prefs = await this.preferences.load();
    return {
      version: this.version,
      userDataDir: sortboxDir(),
      watchFolders: [...prefs.watchFolders]
    };
  }

  /** 读取当前设置。 */
  getPreferences(): Promise<Preferences> {
    return this.preferences.load();
  }

  /** 校验范围和目录重叠后保存，并让正在运行的整理立刻换上新设置。 */
  async savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    const current = await this.preferences.load();
    const next: Preferences = {
      ...current,
      ...patch,
      watchFolders: patch.watchFolders ? [...patch.watchFolders] : current.watchFolders,
      ignoreExtensions: patch.ignoreExtensions ? [...patch.ignoreExtensions] : current.ignoreExtensions
    };
    assertPreferenceRanges(next);
    const targets = (await this.presets.list()).map((preset) => preset.targetDir);
    assertSavedLocations(next, targets);
    const saved = await this.preferences.save(next);
    await this.agent.applyPreferences(saved);
    this.events.emit({ type: 'data.changed', scope: 'preferences' });
    return saved;
  }

  /** 试运行开关。不移动文件，只改设置。 */
  setDryRun(value: boolean): Promise<Preferences> {
    return this.savePreferences({ agentDryRun: value });
  }

  /** 当前习惯是否加载成功。 */
  getHabitDiagnostics(): Promise<HabitDiagnostics> {
    return Promise.resolve(this.habitSet.diagnostics());
  }

  /** 重新读 user.md。 */
  reloadHabits(): Promise<HabitDiagnostics> {
    const diagnostics = this.habitSet.reload();
    this.events.emit({ type: 'data.changed', scope: 'habits' });
    return Promise.resolve(diagnostics);
  }

  /** 用系统编辑器打开习惯文件。 */
  async openUserMd(): Promise<void> {
    await openPath(userMdPath());
  }

  /** 在文件管理器中显示习惯文件。 */
  revealUserMd(): Promise<void> {
    revealPath(userMdPath());
    return Promise.resolve();
  }

  /** 学习次数，不含习惯正文。 */
  listHabitObservations(): Promise<HabitObservation[]> {
    return this.habits.listAll();
  }
}
