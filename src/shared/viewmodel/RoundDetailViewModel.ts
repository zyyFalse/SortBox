/**
 * 某一轮整理的逐文件记录。
 * 主页只给合计，点进来才看每个文件为什么被归档或留下。
 */
import type { AgentLogView, AgentRound } from '@shared/types/domain';
import type { SortboxApi } from '@shared/types/api';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';

export interface RoundDetailState extends ViewModelBaseState {
  roundId: number;
  round: AgentRound | null;
  logs: AgentLogView[];
}

/** 一轮的详情。 */
export class RoundDetailViewModel extends ViewModelBase<number, RoundDetailState> {
  constructor(private readonly api: SortboxApi) {
    super({ loading: true, error: null, roundId: 0, round: null, logs: [] });
  }

  /** 打开时按轮次号读取合计和明细。 */
  override setParameter(roundId: number): void {
    this.setState({ roundId, loading: true, error: null });
    void this.load(roundId);
  }

  private async load(roundId: number): Promise<void> {
    try {
      const [rounds, logs] = await Promise.all([
        this.api.listRecentRounds(30),
        this.api.listRoundLogs(roundId)
      ]);
      const round = rounds.find((item) => item.id === roundId) ?? null;
      this.setState({ loading: false, error: null, round, logs });
    } catch (error) {
      this.captureError(error, '读取这一轮失败');
    }
  }
}
