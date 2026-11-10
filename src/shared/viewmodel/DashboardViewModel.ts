/**
 * 控制台。
 * 它订阅主进程推来的状态和日志，所以整理进行时数字会自己变，不用轮询。
 */
import type { AgentRound, AgentSnapshot, AgentStats, HabitDiagnostics, TriggerPolicy } from '@shared/types/domain';
import type { MainEvent, SortboxApi } from '@shared/types/api';
import type { ContentNavigationService } from '@shared/navigation/services';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface DashboardState extends ViewModelBaseState {
  snapshot: AgentSnapshot | null;
  stats: AgentStats | null;
  round: AgentRound | null;
  rounds: AgentRound[];
  habits: HabitDiagnostics | null;
  watchFolders: string[];
  version: string;
  /** 刚点过的按钮。界面用它把按钮改成「请稍候」。 */
  pending: string | null;
  /** 上一笔操作的结果，例如本轮归档了几个。 */
  notice: string | null;
}

/** 把一轮合计写成主页上的一句话。试运行且没有正式归档时，先说明文件没被移动。 */
export function describeRound(round: AgentRound): string {
  const head =
    round.simulated > 0 && round.archived === 0
      ? '本轮是试运行，文件没有被移动。'
      : '本轮整理完成。';
  return `${head}扫描 ${round.scanned} 个，归档 ${round.archived} 个，未分类 ${round.unclassified} 个，失败 ${round.failed} 个，跳过 ${round.skipped} 个。`;
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
      rounds: [],
      habits: null,
      watchFolders: [],
      version: '',
      pending: null,
      notice: null
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
    await this.run('start', () => this.api.startAgent(), '已启动。目录安静后会自动整理，也可以点「立即整理」。');
  }

  /** 停止整理。 */
  async stop(): Promise<void> {
    await this.run('stop', () => this.api.stopAgent(), '已停止。现在不会监视目录，点「启动」再打开。');
  }

  /** 暂停整理。 */
  async pause(): Promise<void> {
    await this.run('pause', () => this.api.pauseAgent(), '已暂停。点「恢复」继续，或点「停止」关掉。');
  }

  /** 恢复整理。 */
  async resume(): Promise<void> {
    await this.run('resume', () => this.api.resumeAgent(), '已恢复，回到空闲等待。');
  }

  /** 切换试运行。这是持久开关，不是只跑一轮。 */
  async toggleDryRun(): Promise<void> {
    const next = !(this.getState().snapshot?.dryRun ?? false);
    const done = next
      ? '试运行已打开，之后的整理只写记录，不移动文件。'
      : '试运行已关闭，之后的整理会真正移动文件。';
    await this.run('dry', () => this.api.setDryRun(next), done);
  }

  /** 立即整理一轮，包含未分类目录里的文件。 */
  async runNow(): Promise<void> {
    this.setState({ pending: 'run', error: null });
    try {
      const round = await this.api.runNow();
      await this.refresh();
      this.setState({ pending: null, notice: describeRound(round), round });
    } catch (error) {
      this.setState({ pending: null });
      this.captureError(error, '操作失败');
    }
  }

  /** 改触发策略并保存。主进程会在保存后换钩子。 */
  async changePolicy(policy: TriggerPolicy): Promise<void> {
    await this.run('policy', () => this.api.savePreferences({ triggerPolicy: policy }), '触发策略已保存。');
  }

  /** 打开某一轮的逐文件记录。 */
  openRound(roundId: number): void {
    this.navigation.navigateContent(ContentNavigationConstant.ROUND_DETAIL, roundId);
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
      const [snapshot, stats, round, rounds, habits, info] = await Promise.all([
        this.api.getAgentSnapshot(),
        this.api.getAgentStats(),
        this.api.getLatestRound(),
        this.api.listRecentRounds(8),
        this.api.getHabitDiagnostics(),
        this.api.getAppInfo()
      ]);
      this.setState({
        loading: false,
        error: null,
        snapshot,
        stats,
        round,
        rounds,
        habits,
        watchFolders: info.watchFolders,
        version: info.version
      });
    } catch (error) {
      this.captureError(error, '读取控制台失败');
    }
  }

  private async run(pending: string, work: () => Promise<unknown>, done: string): Promise<void> {
    this.setState({ pending, error: null });
    try {
      await work();
      await this.refresh();
      this.setState({ pending: null, notice: done });
    } catch (error) {
      this.setState({ pending: null });
      this.captureError(error, '操作失败');
    }
  }
}
