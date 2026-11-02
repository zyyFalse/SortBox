import type { AgentAction, AgentLogView, LogQuery } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface LogState extends ViewModelBaseState {
  items: AgentLogView[];
  query: LogQuery;
  expandedId: number | null;
}

const EMPTY_QUERY: LogQuery = { action: null, from: null, to: null, keyword: null };

/** 处理记录。撤销只针对正式归档成功的那一条。 */
export class LogViewModel extends ViewModelBase<void, LogState> {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({ loading: true, error: null, items: [], query: EMPTY_QUERY, expandedId: null });
    this.unsubscribe = api.subscribe((event) => {
      if (event.type === 'agent.log' || (event.type === 'data.changed' && event.scope === 'logs')) {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  /** 取消订阅。 */
  override dispose(): void {
    this.unsubscribe();
  }

  /** 改筛选条件并重新查询。 */
  async setQuery(patch: Partial<LogQuery>): Promise<void> {
    this.setState({ query: { ...this.getState().query, ...patch } });
    await this.refresh();
  }

  /** 展开或收起一条记录的原因。 */
  toggle(id: number): void {
    this.setState({ expandedId: this.getState().expandedId === id ? null : id });
  }

  /** 撤销指定记录。 */
  async undo(id: number): Promise<void> {
    try {
      await this.api.undoLog(id);
      await this.refresh();
    } catch (error) {
      this.captureError(error, '撤销失败');
    }
  }

  /** 撤销最近一次还能撤的归档。 */
  async undoLatest(): Promise<void> {
    try {
      await this.api.undoLatest();
      await this.refresh();
    } catch (error) {
      this.captureError(error, '撤销失败');
    }
  }

  /** 打开对应资料。 */
  openMaterial(materialId: number | null): void {
    if (materialId === null) {
      return;
    }
    this.navigation.navigateContent(ContentNavigationConstant.FILE_DETAIL, materialId);
  }

  /** 动作筛选。空字符串表示不限制。 */
  async setAction(action: AgentAction | ''): Promise<void> {
    await this.setQuery({ action: action === '' ? null : action });
  }

  private async refresh(): Promise<void> {
    try {
      const items = await this.api.queryLogs(this.getState().query);
      this.setState({ loading: false, error: null, items });
    } catch (error) {
      this.captureError(error, '读取处理记录失败');
    }
  }
}
