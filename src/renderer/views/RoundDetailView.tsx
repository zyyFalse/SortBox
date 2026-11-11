import type { ReactElement } from 'react';
import { agentActionLabel, triggerReasonLabel } from '@shared/types/domain';
import { describeRound } from '@shared/viewmodel/DashboardViewModel';
import type { RoundDetailViewModel } from '@shared/viewmodel/RoundDetailViewModel';
import { Empty } from '../components/Empty';
import { formatTime } from '../format';
import { useViewModel } from '../hooks/useViewModel';

/** 一轮整理的合计和每个文件的处理结果。 */
export function RoundDetailView(props: { vm: RoundDetailViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const round = state.round;
  return (
    <section className="page" data-view="RoundDetail">
      <h1>这次整理</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.loading ? <p>正在读取这一轮…</p> : null}
      {round ? (
        <div className="summary">
          <p>{formatTime(round.finishedAt)} · {triggerReasonLabel(round.reason)}</p>
          <p>{describeRound(round)}</p>
        </div>
      ) : null}
      {state.logs.length === 0 && !state.loading ? <Empty text="这一轮没有处理记录" /> : null}
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>结果</th>
            <th>文件</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          {state.logs.map((log) => (
            <tr key={log.id} className={log.action === 'simulated' ? 'is-off' : ''}>
              <td>{formatTime(log.createdAt)}</td>
              <td>{agentActionLabel(log.action)}</td>
              <td>{log.fileName ?? log.fromPath}</td>
              <td>{log.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
