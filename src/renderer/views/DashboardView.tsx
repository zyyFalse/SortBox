import type { ReactElement } from 'react';
import type { TriggerPolicy } from '@shared/types/domain';
import { agentActionLabel, agentStateLabel, roundLabel, triggerPolicyLabel, triggerReasonLabel } from '@shared/types/domain';
import type { DashboardViewModel } from '@shared/viewmodel/DashboardViewModel';
import { Empty } from '../components/Empty';
import { formatTime } from '../format';
import { useViewModel } from '../hooks/useViewModel';

const POLICIES: TriggerPolicy[] = ['idle', 'immediate', 'interval', 'manual'];

/** 控制台：状态、计数、最近一轮和最近十次处理。 */
export function DashboardView(props: { vm: DashboardViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const snapshot = state.snapshot;
  const stats = state.stats;
  const habitText = state.habits
    ? state.habits.errors.length > 0
      ? `user.md 第 ${state.habits.errors[0]?.line ?? 0} 行：${state.habits.errors[0]?.message ?? ''}`
      : `整理习惯：${state.habits.ruleCount} 条`
    : '';
  return (
    <section className="page" data-view="Dashboard">
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="row">
        <strong>{snapshot ? agentStateLabel(snapshot.state) : '未运行'}</strong>
        <span>策略 {snapshot ? triggerPolicyLabel(snapshot.policy) : ''}</span>
        <span>静默窗口 {snapshot ? snapshot.idleSettleMs : 0} ms</span>
        {snapshot?.dryRun ? <span>试运行</span> : null}
      </div>
      <div className="cards">
        <div className="card">今日已整理<strong>{stats?.archivedToday ?? 0}</strong></div>
        <div className="card">累计归档<strong>{stats?.archivedTotal ?? 0}</strong></div>
        <div className="card">未分类<strong>{stats?.unclassifiedCount ?? 0}</strong></div>
        <div className="card">已撤销<strong>{stats?.heldCount ?? 0}</strong></div>
        <div className="card">今日失败<strong>{stats?.failedToday ?? 0}</strong></div>
      </div>
      <p>
        最近一轮 {state.round ? `${roundLabel(state.round.id)} · ${triggerReasonLabel(state.round.reason)} · ${formatTime(state.round.finishedAt)}` : '—'}
      </p>
      <p>{habitText}</p>
      <div className="row">
        <button type="button" onClick={(): void => void props.vm.start()}>启动</button>
        <button type="button" onClick={(): void => void props.vm.pause()}>暂停</button>
        <button type="button" onClick={(): void => void props.vm.resume()}>恢复</button>
        <button type="button" onClick={(): void => void props.vm.stop()}>停止</button>
        <button type="button" onClick={(): void => void props.vm.runNow()}>立即整理</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.toggleDryRun()}>试运行</button>
        <select
          value={snapshot?.policy ?? 'idle'}
          onChange={(event): void => void props.vm.changePolicy(event.target.value as TriggerPolicy)}
        >
          {POLICIES.map((policy) => (
            <option key={policy} value={policy}>{triggerPolicyLabel(policy)}</option>
          ))}
        </select>
      </div>
      <h2>监视目录</h2>
      {state.watchFolders.length === 0 ? <Empty text="还没有监视目录" /> : null}
      <ul>{state.watchFolders.map((folder) => <li key={folder}>{folder}</li>)}</ul>
      <h2>最近处理</h2>
      {state.logs.length === 0 ? <Empty text="暂无处理记录" /> : null}
      <table>
        <tbody>
          {state.logs.map((log) => (
            <tr key={log.id}>
              <td>{formatTime(log.createdAt)}</td>
              <td>{agentActionLabel(log.action)}</td>
              <td>{log.fileName ?? log.fromPath}</td>
              <td>
                <button className="ghost" type="button" onClick={(): void => props.vm.openLog(log.materialId)}>打开</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
