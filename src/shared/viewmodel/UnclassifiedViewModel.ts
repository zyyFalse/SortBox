import type { MaterialView } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface UnclassifiedState extends ViewModelBaseState {
  items: MaterialView[];
  summary: Array<{ extension: string; count: number }>;
}

/** 未分类和已撤销文件。这里不能手动指派预设。 */
export class UnclassifiedViewModel extends ViewModelBase<void, UnclassifiedState> {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({ loading: true, error: null, items: [], summary: [] });
    this.unsubscribe = api.subscribe((event) => {
      if (event.type === 'data.changed' && (event.scope === 'materials' || event.scope === 'logs')) {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  /** 取消订阅。 */
  override dispose(): void {
    this.unsubscribe();
  }

  /** 重新读取列表。 */
  async refresh(): Promise<void> {
    try {
      const [items, summary] = await Promise.all([
        this.api.listUnclassified(),
        this.api.unclassifiedSummary()
      ]);
      this.setState({ loading: false, error: null, items, summary });
    } catch (error) {
      this.captureError(error, '读取未分类失败');
    }
  }

  /** 在文件夹中显示。 */
  async reveal(target: string): Promise<void> {
    try {
      await this.api.revealPath(target);
    } catch (error) {
      this.captureError(error, '无法打开位置');
    }
  }

  /** 打开详情。 */
  openDetail(id: number): void {
    this.navigation.navigateContent(ContentNavigationConstant.FILE_DETAIL, id);
  }

  /** 按文件名建议一条预设，并打开详情页让人保存。 */
  async createPresetFrom(materialId: number): Promise<void> {
    try {
      const draft = await this.api.suggestPresetFromMaterial(materialId);
      this.navigation.navigateContent(ContentNavigationConstant.PRESET_DETAIL, { id: null, draft });
    } catch (error) {
      this.captureError(error, '无法生成预设');
    }
  }

  /** 对已撤销的文件重新分拣。 */
  async releaseHeld(materialId: number): Promise<void> {
    try {
      await this.api.releaseHeld(materialId);
      await this.refresh();
    } catch (error) {
      this.captureError(error, '重新分拣失败');
    }
  }
}
