import type { MaterialDetail } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface FileDetailState extends ViewModelBaseState {
  materialId: number | null;
  detail: MaterialDetail | null;
}

/** 单个文件的详情、历史和哈希。 */
export class FileDetailViewModel extends ViewModelBase<number, FileDetailState> {
  constructor(private readonly api: SortboxApi) {
    super({ loading: false, error: null, materialId: null, detail: null });
  }

  /** 打开指定资料。 */
  override setParameter(materialId: number): void {
    this.setState({ materialId, loading: true, error: null });
    void this.load(materialId);
  }

  /** 用系统程序打开。 */
  async open(): Promise<void> {
    const path = this.getState().detail?.currentPath;
    if (!path) {
      return;
    }
    try {
      await this.api.openPath(path);
    } catch (error) {
      this.captureError(error, '无法打开文件');
    }
  }

  /** 在文件夹中显示。 */
  async reveal(): Promise<void> {
    const path = this.getState().detail?.currentPath;
    if (!path) {
      return;
    }
    try {
      await this.api.revealPath(path);
    } catch (error) {
      this.captureError(error, '无法打开位置');
    }
  }

  /** 置顶或取消置顶。 */
  async toggleFavorite(): Promise<void> {
    const detail = this.getState().detail;
    if (!detail) {
      return;
    }
    try {
      await this.api.setFavorite(detail.id, !detail.favorite);
      await this.load(detail.id);
    } catch (error) {
      this.captureError(error, '置顶失败');
    }
  }

  /** 用户点击后才计算 SHA-256。 */
  async computeSha256(): Promise<void> {
    const detail = this.getState().detail;
    if (!detail) {
      return;
    }
    this.setState({ loading: true, error: null });
    try {
      await this.api.computeSha256(detail.id);
      await this.load(detail.id);
    } catch (error) {
      this.captureError(error, '计算哈希失败');
    }
  }

  private async load(id: number): Promise<void> {
    try {
      const detail = await this.api.getMaterialDetail(id);
      this.setState({ loading: false, detail, error: null });
    } catch (error) {
      this.captureError(error, '读取资料失败');
    }
  }
}
