import type { Preset, PresetTemplate } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';
import { blankDraft, draftFromTemplate } from './drafts';

export interface PresetListState extends ViewModelBaseState {
  presets: Preset[];
  templates: PresetTemplate[];
  archiveRoot: string;
  pendingId: number | null;
  notice: string | null;
}

/** 预设列表。删除前由界面弹出一次确认。 */
export class PresetListViewModel extends ViewModelBase<void, PresetListState> {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({
      loading: true,
      error: null,
      presets: [],
      templates: [],
      archiveRoot: '',
      pendingId: null,
      notice: null
    });
    this.unsubscribe = api.subscribe((event) => {
      if (event.type === 'data.changed' && event.scope === 'presets') {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  /** 取消订阅。 */
  override dispose(): void {
    this.unsubscribe();
  }

  /** 新建空白预设。 */
  create(): void {
    this.navigation.navigateContent(ContentNavigationConstant.PRESET_DETAIL, {
      id: null,
      draft: blankDraft(this.getState().archiveRoot)
    });
  }

  /** 编辑已有预设。 */
  edit(id: number): void {
    this.navigation.navigateContent(ContentNavigationConstant.PRESET_DETAIL, { id, draft: null });
  }

  /** 从模板进入详情，目标目录仍要人确认后保存。 */
  createFromTemplate(template: PresetTemplate): void {
    const draft = draftFromTemplate(template, this.getState().archiveRoot);
    this.navigation.navigateContent(ContentNavigationConstant.PRESET_DETAIL, { id: null, draft });
  }

  /** 启用或停用。行颜色和提示语一起变，避免点了像没反应。 */
  async toggleEnabled(id: number, enabled: boolean): Promise<void> {
    const name = this.getState().presets.find((preset) => preset.id === id)?.name ?? '预设';
    this.setState({ pendingId: id, error: null });
    try {
      await this.api.setPresetEnabled(id, enabled);
      await this.refresh();
      const notice = enabled ? `已启用「${name}」。之后命中的文件会归到这里。` : `已停用「${name}」。新文件不会再归到这里。`;
      this.setState({ pendingId: null, notice });
    } catch (error) {
      this.setState({ pendingId: null });
      this.captureError(error, '更新预设失败');
    }
  }

  /** 删除。调用前界面已经确认过。 */
  async remove(id: number): Promise<void> {
    try {
      await this.api.deletePreset(id);
      await this.refresh();
    } catch (error) {
      this.captureError(error, '删除预设失败');
    }
  }

  /** 导入只得到草稿，接着打开详情页保存。 */
  async importOne(): Promise<void> {
    try {
      const draft = await this.api.importPreset();
      if (!draft) {
        return;
      }
      this.navigation.navigateContent(ContentNavigationConstant.PRESET_DETAIL, { id: null, draft });
    } catch (error) {
      this.captureError(error, '导入失败');
    }
  }

  /** 导出一条预设。 */
  async exportOne(id: number): Promise<void> {
    try {
      await this.api.exportPreset(id);
    } catch (error) {
      this.captureError(error, '导出失败');
    }
  }

  private async refresh(): Promise<void> {
    try {
      const [presets, templates, prefs] = await Promise.all([
        this.api.listPresets(),
        this.api.listPresetTemplates(),
        this.api.getPreferences()
      ]);
      this.setState({ loading: false, error: null, presets, templates, archiveRoot: prefs.archiveRoot });
    } catch (error) {
      this.captureError(error, '读取预设失败');
    }
  }
}
