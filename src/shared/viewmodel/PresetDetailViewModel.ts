import type { MatchResult, PresetDraft, PresetTemplate } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';
import { blankDraft, draftFromTemplate, previewLayout } from './drafts';

/** 打开预设详情时带的参数。 */
export interface PresetDetailParam {
  id: number | null;
  draft: PresetDraft | null;
}

export interface PresetDetailState extends ViewModelBaseState {
  draft: PresetDraft;
  preview: string;
  sampleName: string;
  match: MatchResult | null;
  templates: PresetTemplate[];
}

/** 编辑一条预设，并能试命中一个文件名。 */
export class PresetDetailViewModel extends ViewModelBase<PresetDetailParam, PresetDetailState> {
  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    const draft = blankDraft('');
    super({
      loading: false,
      error: null,
      draft,
      preview: previewLayout(draft.pathLayout, draft.name, new Date()),
      sampleName: '发票-3月.pdf',
      match: null,
      templates: []
    });
    void this.loadTemplates();
  }

  /** 新建用草稿，编辑则按 id 读取。 */
  override setParameter(param: PresetDetailParam): void {
    if (param.draft) {
      this.applyDraft(param.draft);
      return;
    }
    if (param.id === null) {
      this.applyDraft(blankDraft(''));
      return;
    }
    void this.load(param.id);
  }

  /** 改草稿里的一个字段，并刷新路径预览。 */
  setField<K extends keyof PresetDraft>(key: K, value: PresetDraft[K]): void {
    const draft = { ...this.getState().draft, [key]: value };
    this.applyDraft(draft);
  }

  /** 用模板覆盖当前草稿的规则，保留人已经选的目标目录。 */
  applyTemplate(template: PresetTemplate): void {
    const current = this.getState().draft.targetDir;
    const draft = draftFromTemplate(template, '');
    draft.targetDir = current;
    this.applyDraft(draft);
  }

  /** 只替换占位符，不读磁盘。 */
  refreshPreview(): void {
    const draft = this.getState().draft;
    this.setState({ preview: previewLayout(draft.pathLayout, draft.name, new Date()) });
  }

  /** 用样例文件名试命中。算法在主进程，这里只展示结果。 */
  async previewSample(): Promise<void> {
    try {
      const match = await this.api.previewMatch(this.getState().sampleName, this.getState().draft);
      this.setState({ match, error: null });
    } catch (error) {
      this.captureError(error, '试命中失败');
    }
  }

  /** 修改样例文件名。 */
  setSampleName(sampleName: string): void {
    this.setState({ sampleName });
  }

  /** 保存成功后回到上一页。重评由主进程做。 */
  async save(): Promise<void> {
    this.setState({ loading: true, error: null });
    try {
      await this.api.savePreset(this.getState().draft);
      this.setState({ loading: false });
      this.navigation.goBack();
    } catch (error) {
      this.captureError(error, '保存预设失败');
    }
  }

  /** 删除当前预设。新建的草稿没有 id，不能删。 */
  async remove(): Promise<void> {
    const id = this.getState().draft.id;
    if (id === null) {
      this.navigation.goBack();
      return;
    }
    try {
      await this.api.deletePreset(id);
      this.navigation.goBack();
    } catch (error) {
      this.captureError(error, '删除预设失败');
    }
  }

  private applyDraft(draft: PresetDraft): void {
    this.setState({
      draft,
      preview: previewLayout(draft.pathLayout, draft.name, new Date()),
      error: null
    });
  }

  private async load(id: number): Promise<void> {
    try {
      const preset = await this.api.getPreset(id);
      if (!preset) {
        this.setState({ error: '预设不存在', loading: false });
        return;
      }
      this.applyDraft({
        id: preset.id,
        name: preset.name,
        extensions: preset.extensions,
        nameIncludes: preset.nameIncludes,
        nameStarts: preset.nameStarts,
        nameEnds: preset.nameEnds,
        nameExcludes: preset.nameExcludes,
        targetDir: preset.targetDir,
        pathLayout: preset.pathLayout,
        priority: preset.priority,
        enabled: preset.enabled,
        maxSizeMb: preset.maxSizeMb
      });
    } catch (error) {
      this.captureError(error, '读取预设失败');
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const templates = await this.api.listPresetTemplates();
      this.setState({ templates });
    } catch (error) {
      this.captureError(error, '读取模板失败');
    }
  }
}
