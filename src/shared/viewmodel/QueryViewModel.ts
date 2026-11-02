import type { Preset, QuerySpec } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface QueryState extends ViewModelBaseState {
  spec: QuerySpec;
  presets: Preset[];
}

const EMPTY_SPEC: QuerySpec = {
  keyword: null,
  presetId: null,
  category: null,
  status: null,
  favoriteOnly: false
};

/** 资料库的搜索条件。真正的结果在结果页。 */
export class QueryViewModel extends ViewModelBase<void, QueryState> {
  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({ loading: true, error: null, spec: EMPTY_SPEC, presets: [] });
    void this.loadPresets();
  }

  /** 改一个搜索字段。 */
  setSpec(patch: Partial<QuerySpec>): void {
    this.setState({ spec: { ...this.getState().spec, ...patch } });
  }

  /** 按当前条件打开结果页。 */
  search(): void {
    this.navigation.navigateContent(ContentNavigationConstant.RESULT, this.getState().spec);
  }

  private async loadPresets(): Promise<void> {
    try {
      const presets = await this.api.listPresets();
      this.setState({ loading: false, presets, error: null });
    } catch (error) {
      this.captureError(error, '读取预设失败');
    }
  }
}
