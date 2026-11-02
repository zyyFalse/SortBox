/**
 * 第一次打开时的向导。
 * 勾选模板会变成预设草稿，目标目录是「归档根/模板名」。
 * 点完成之后，导航切到主窗，整理是否启动由主进程根据开机开关决定。
 */
import type { PresetDraft, PresetTemplate } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { RootNavigationService } from '@shared/navigation/services';
import { RootNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';
import { blankDraft, draftFromTemplate, joinDir } from './drafts';

export interface InitializationState extends ViewModelBaseState {
  watchFolders: string[];
  archiveRoot: string;
  unclassifiedDir: string;
  unclassifiedTouched: boolean;
  templates: PresetTemplate[];
  selected: string[];
  extras: PresetDraft[];
}

/** 初始化向导。 */
export class InitializationViewModel extends ViewModelBase<void, InitializationState> {
  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: RootNavigationService
  ) {
    super({
      loading: false,
      error: null,
      watchFolders: [],
      archiveRoot: '',
      unclassifiedDir: '',
      unclassifiedTouched: false,
      templates: [],
      selected: [],
      extras: []
    });
    void this.loadTemplates();
  }

  /** 增加一个监视目录。 */
  async addWatchFolder(): Promise<void> {
    const picked = await this.api.pickDirectory('添加目录');
    if (!picked || this.getState().watchFolders.includes(picked)) {
      return;
    }
    this.setState({ watchFolders: [...this.getState().watchFolders, picked], error: null });
  }

  /** 去掉一个监视目录。 */
  removeWatchFolder(folder: string): void {
    this.setState({ watchFolders: this.getState().watchFolders.filter((item) => item !== folder) });
  }

  /** 选择归档根。未分类目录还没手改过时，跟着变成「根/_未分类」。 */
  async setArchiveRoot(): Promise<void> {
    const picked = await this.api.pickDirectory('选择归档根目录');
    if (!picked) {
      return;
    }
    const state = this.getState();
    const unclassifiedDir = state.unclassifiedTouched ? state.unclassifiedDir : joinDir(picked, '_未分类');
    this.setState({ archiveRoot: picked, unclassifiedDir, error: null });
  }

  /** 手改未分类目录。 */
  async pickUnclassified(): Promise<void> {
    const picked = await this.api.pickDirectory('选择未分类目录');
    if (!picked) {
      return;
    }
    this.setState({ unclassifiedDir: picked, unclassifiedTouched: true });
  }

  /** 直接改未分类目录文本。 */
  setUnclassifiedDir(value: string): void {
    this.setState({ unclassifiedDir: value, unclassifiedTouched: true });
  }

  /** 勾选或取消一个内置模板。默认全选。 */
  toggleTemplate(key: string): void {
    const selected = this.getState().selected;
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key];
    this.setState({ selected: next });
  }

  /** 再加一条空白预设，等人填名字。 */
  addBlank(): void {
    const root = this.getState().archiveRoot;
    this.setState({ extras: [...this.getState().extras, blankDraft(root)] });
  }

  /** 修改某条空白预设的名字。 */
  setExtraName(index: number, name: string): void {
    const extras = this.getState().extras.map((draft, current) =>
      current === index ? { ...draft, name, targetDir: joinDir(this.getState().archiveRoot, name || '未命名') } : draft
    );
    this.setState({ extras });
  }

  /** 提交初始化并进入主窗。 */
  async complete(): Promise<void> {
    const state = this.getState();
    this.setState({ loading: true, error: null });
    try {
      const chosen = state.templates
        .filter((template) => state.selected.includes(template.key))
        .map((template) => draftFromTemplate(template, state.archiveRoot));
      await this.api.completeInitialization({
        watchFolders: state.watchFolders,
        archiveRoot: state.archiveRoot,
        unclassifiedDir: state.unclassifiedDir,
        presets: [...chosen, ...state.extras]
      });
      this.setState({ loading: false });
      this.navigation.navigateRoot(RootNavigationConstant.MAIN);
    } catch (error) {
      this.captureError(error, '初始化失败');
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templates = await this.api.listPresetTemplates();
      this.setState({ templates, selected: templates.map((template) => template.key) });
    } catch (error) {
      this.captureError(error, '读取预设模板失败');
    }
  }
}
