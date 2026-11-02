import type { HabitDiagnostics, HabitObservation, TriggerPolicy } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { Preferences } from '@shared/types/preferences';
import type { RootNavigationService } from '@shared/navigation/services';
import { RootNavigationConstant } from '@shared/navigation/constants';
import { DEFAULT_PREFERENCES } from '@shared/types/preferences';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface SettingsState extends ViewModelBaseState {
  draft: Preferences;
  habits: HabitDiagnostics | null;
  observations: HabitObservation[];
  version: string;
  userDataDir: string;
}

/** 设置页。保存前的数值范围由主进程再检查一次。 */
export class SettingsViewModel extends ViewModelBase<void, SettingsState> {
  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: RootNavigationService
  ) {
    super({
      loading: true,
      error: null,
      draft: { ...DEFAULT_PREFERENCES, watchFolders: [], ignoreExtensions: [] },
      habits: null,
      observations: [],
      version: '',
      userDataDir: ''
    });
    void this.refresh();
  }

  /** 改草稿里的一个字段。 */
  setDraft<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.setState({ draft: { ...this.getState().draft, [key]: value } });
  }

  /** 改触发策略。 */
  setPolicy(policy: TriggerPolicy): void {
    this.setDraft('triggerPolicy', policy);
  }

  /** 增加监视目录。 */
  async addWatchFolder(): Promise<void> {
    const picked = await this.api.pickDirectory('添加目录');
    if (!picked) {
      return;
    }
    const folders = this.getState().draft.watchFolders;
    if (folders.includes(picked)) {
      return;
    }
    this.setDraft('watchFolders', [...folders, picked]);
  }

  /** 移除监视目录。 */
  removeWatchFolder(folder: string): void {
    this.setDraft(
      'watchFolders',
      this.getState().draft.watchFolders.filter((item) => item !== folder)
    );
  }

  /** 选择未分类目录。 */
  async pickUnclassified(): Promise<void> {
    const picked = await this.api.pickDirectory('选择未分类目录');
    if (picked) {
      this.setDraft('unclassifiedDir', picked);
    }
  }

  /** 忽略扩展名用逗号分隔。 */
  setIgnoreText(text: string): void {
    const ignoreExtensions = text
      .split(/[,，]/)
      .map((piece) => piece.trim().replace(/^\./, ''))
      .filter((piece) => piece !== '');
    this.setDraft('ignoreExtensions', ignoreExtensions);
  }

  /** 保存设置。主进程会热切换钩子。 */
  async save(): Promise<void> {
    this.setState({ loading: true, error: null });
    try {
      const saved = await this.api.savePreferences(this.getState().draft);
      this.setState({ loading: false, draft: saved });
    } catch (error) {
      this.captureError(error, '保存设置失败');
    }
  }

  /** 重新初始化。预设和资料都还在。 */
  async resetInitialization(): Promise<void> {
    try {
      await this.api.resetInitialization();
      this.navigation.navigateRoot(RootNavigationConstant.INITIALIZATION);
    } catch (error) {
      this.captureError(error, '重新初始化失败');
    }
  }

  /** 打开 user.md。 */
  async openUserMd(): Promise<void> {
    try {
      await this.api.openUserMd();
    } catch (error) {
      this.captureError(error, '无法打开整理习惯');
    }
  }

  /** 在文件夹中显示 user.md。 */
  async revealUserMd(): Promise<void> {
    try {
      await this.api.revealUserMd();
    } catch (error) {
      this.captureError(error, '无法打开位置');
    }
  }

  /** 重新解析 user.md。 */
  async reloadHabits(): Promise<void> {
    try {
      const habits = await this.api.reloadHabits();
      const observations = await this.api.listHabitObservations();
      this.setState({ habits, observations, error: null });
    } catch (error) {
      this.captureError(error, '重新加载失败');
    }
  }

  private async refresh(): Promise<void> {
    try {
      const [draft, habits, observations, info] = await Promise.all([
        this.api.getPreferences(),
        this.api.getHabitDiagnostics(),
        this.api.listHabitObservations(),
        this.api.getAppInfo()
      ]);
      this.setState({
        loading: false,
        error: null,
        draft,
        habits,
        observations,
        version: info.version,
        userDataDir: info.userDataDir
      });
    } catch (error) {
      this.captureError(error, '读取设置失败');
    }
  }
}
