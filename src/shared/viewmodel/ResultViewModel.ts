import type { MaterialView, QuerySpec } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface ResultState extends ViewModelBaseState {
  spec: QuerySpec | null;
  items: MaterialView[];
}

/** 搜索结果。参数就是查询条件。 */
export class ResultViewModel extends ViewModelBase<QuerySpec, ResultState> {
  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({ loading: false, error: null, spec: null, items: [] });
  }

  /** 导航打开本页时带上查询条件并立刻搜索。 */
  override setParameter(spec: QuerySpec): void {
    this.setState({ spec, loading: true, error: null });
    void this.load(spec);
  }

  /** 打开文件详情。 */
  openDetail(id: number): void {
    this.navigation.navigateContent(ContentNavigationConstant.FILE_DETAIL, id);
  }

  private async load(spec: QuerySpec): Promise<void> {
    try {
      const items = await this.api.queryMaterials(spec);
      this.setState({ loading: false, items, error: null });
    } catch (error) {
      this.captureError(error, '搜索失败');
    }
  }
}
