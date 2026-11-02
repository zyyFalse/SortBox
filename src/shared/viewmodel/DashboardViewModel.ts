/**
 * 控制台。
 * 它订阅主进程推来的状态和日志，所以整理进行时数字会自己变，不用轮询。
 */
import type { AgentRound, AgentSnapshot, AgentStats, AgentLogView, HabitDiagnostics, TriggerPolicy } from '@shared/types/domain';
import type { MainEvent, SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface DashboardState extends ViewModelBaseState {
  snapshot: AgentSnapshot | null;
  stats: AgentStats | null;
  round: AgentRound | null;
  logs: AgentLogView[];
  habits: HabitDiagnostics | null;
  watchFolders: string[];
  version: string;
}

/** 控制台页面状态。 */
export class DashboardViewModel extends ViewModelBase<void, DashboardState> {
  private readonly unsubscribe: () => void;

  constructor(
    private readonly api: SortboxApi,
    private readonly navigation: ContentNavigationService
  ) {
    super({
      loading: true,
      error: null,
      snapshot: null,
      stats: null,
      round: null,
      logs: [],
      habits: null,
      watchFolders: [],
      version: ''
    });
    this.unsubscribe = api.subscribe((event) => {
      this.onEvent(event);
    });
    void this.refresh();
  }

  /** 离开页面时取消订阅，避免窗口关了还在改状态。 */
  override dispose(): void {
    this.unsubscribe();
  }

  /** 启动整理。 */
  async start(): Promise<void> {
    await this.run(() => this.api.startAgent());
  }

  /** 停止整理。 */
  async stop(): Promise<void> {
    await this.run(() => this.api.stopAgent());
  }

  /** 暂停整理。 */
  async pause(): Promise<void> {
    await this.run(() => this.api.pauseAgent());
  }

  /** 恢复整理。 */
  async resume(): Promise<void> {
    await this.run(() => this.api.resumeAgent());
  }

  /** 切换试运行。 */
  async toggleDryRun(): Promise<void> {
    const current = this.getState().snapshot?.dryRun ?? false;
    await this.run(() => this.api.setDryRun(!current));
  }

  /** 立即整理一轮，包含未分类目录里的文件。 */
  async runNow(): Promise<void> {
    await this.run(async () => {
      await this.api.runNow();
    });
  }

  /** 改触发策略并保存。主进程会在保存后换钩子。 */
  async changePolicy(policy: TriggerPolicy): Promise<void> {
    await this.run(() => this.api.savePreferences({ triggerPolicy: policy }));
  }

  /** 打开某条日志对应的文件详情。 */
  openMaterial(materialId: number | null): void {
    if (materialId === null) {
      return;
    }
    this.navigation.navigateContent(ContentNavigationConstant.FILE_DETAIL, materialId);
  }

  /** 打开处理记录页由菜单负责，这里只打开文件。 */
  openLog(materialId: number | null): void {
    this.openMaterial(materialId);
  }

  private onEvent(event: MainEvent): void {
    if (event.type === 'agent.state') {
      this.setState({ snapshot: event.snapshot });
      return;
    }
    if (event.type === 'agent.round' || event.type === 'agent.log' || event.type === 'data.changed') {
      void this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    try {
      const [snapshot, stats, round, logs, habits, info] = await Promise.all([
        this.api.getAgentSnapshot(),
        this.api.getAgentStats(),
        this.api.getLatestRound(),
        this.api.listRecentLogs(10),
        this.api.getHabitDiagnostics(),
        this.api.getAppInfo()
      ]);
      this.setState({
        loading: false,
        error: null,
        snapshot,
        stats,
        round,
        logs,
        habits,
        watchFolders: info.watchFolders,
        version: info.version
      });
    } catch (error) {
      this.captureError(error, '读取控制台失败');
    }
  }

  private async run(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
      await this.refresh();
    } catch (error) {
      this.captureError(error, '操作失败');
    }
  }
}
