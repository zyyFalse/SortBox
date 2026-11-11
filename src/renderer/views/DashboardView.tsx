import { useState, type ReactElement } from 'react';
import type { AgentSnapshot, AgentState, TriggerPolicy } from '@shared/types/domain';
import { agentStateLabel, triggerPolicyLabel, triggerReasonLabel } from '@shared/types/domain';
import { describeRound, type DashboardViewModel } from '@shared/viewmodel/DashboardViewModel';
import { Empty } from '../components/Empty';
import { formatTime } from '../format';
import { useViewModel } from '../hooks/useViewModel';

const POLICIES: TriggerPolicy[] = ['idle', 'immediate', 'interval', 'manual'];

/** 控制台：当前该做什么、本轮合计，以及每一轮的入口。 */
export function DashboardView(props: { vm: DashboardViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const snapshot = state.snapshot;
  const stats = state.stats;
  const [guidePref, setGuidePref] = useState<boolean | null>(null);
  const guideOpen = guidePref ?? (state.rounds.length === 0 && !state.loading);
  const habitText = state.habits
    ? state.habits.errors.length > 0
      ? `user.md 第 ${state.habits.errors[0]?.line ?? 0} 行：${state.habits.errors[0]?.message ?? ''}`
      : `整理习惯：${state.habits.ruleCount} 条`
    : '';
  const pending = state.pending;
  const agent = snapshot?.state;
  return (
    <section className="page" data-view="Dashboard">
      {state.error ? <p className="error">{state.error}</p> : null}
      <p className="banner">{statusHint(snapshot)}</p>
      {snapshot?.dryRun ? (
        <p className="banner warn">试运行开着。整理只写记录，不会移动文件。要真正归档，点下面的「试运行：开」把它关掉。</p>
      ) : null}
      {state.notice ? <p className="notice">{state.notice}</p> : null}
      <div className="row">
        <strong>{snapshot ? agentStateLabel(snapshot.state) : '正在读取…'}</strong>
        <span>策略 {snapshot ? triggerPolicyLabel(snapshot.policy) : '…'}</span>
        <span>静默窗口 {snapshot ? snapshot.idleSettleMs : 0} ms</span>
      </div>
      <div className="stats">
        <div className="stat"><span>今日已整理</span><strong>{stats?.archivedToday ?? 0}</strong></div>
        <div className="stat"><span>累计归档</span><strong>{stats?.archivedTotal ?? 0}</strong></div>
        <div className="stat"><span>未分类</span><strong>{stats?.unclassifiedCount ?? 0}</strong></div>
        <div className="stat"><span>已撤销</span><strong>{stats?.heldCount ?? 0}</strong></div>
        <div className="stat"><span>今日失败</span><strong>{stats?.failedToday ?? 0}</strong></div>
      </div>
      {state.round ? (
        <div className="summary">
          <strong>最近一轮 · {formatTime(state.round.finishedAt)} · {triggerReasonLabel(state.round.reason)}</strong>
          <p>{describeRound(state.round)}</p>
        </div>
      ) : (
        <p className="empty">还没有整理过。启动后点「立即整理」，结果会显示在这里。</p>
      )}
      <p>{habitText}</p>
      <div className="row">
        <button className={agent === 'stopped' ? '' : 'ghost'} type="button" disabled={pending !== null || !can(agent, 'start')} onClick={(): void => void props.vm.start()}>
          {pending === 'start' ? '请稍候…' : '启动'}
        </button>
        <button className="ghost" type="button" disabled={pending !== null || !can(agent, 'pause')} onClick={(): void => void props.vm.pause()}>
          {pending === 'pause' ? '请稍候…' : '暂停'}
        </button>
        <button className={agent === 'paused' ? '' : 'ghost'} type="button" disabled={pending !== null || !can(agent, 'resume')} onClick={(): void => void props.vm.resume()}>
          {pending === 'resume' ? '请稍候…' : '恢复'}
        </button>
        <button className="ghost" type="button" disabled={pending !== null || !can(agent, 'stop')} onClick={(): void => void props.vm.stop()}>
          {pending === 'stop' ? '请稍候…' : '停止'}
        </button>
        <button className={agent !== 'stopped' && agent !== 'paused' ? '' : 'ghost'} type="button" disabled={pending !== null || !can(agent, 'run')} onClick={(): void => void props.vm.runNow()}>
          {pending === 'run' ? '请稍候…' : '立即整理'}
        </button>
        <button
          className={snapshot?.dryRun ? 'selected' : 'ghost'}
          type="button"
          disabled={pending !== null || !snapshot}
          onClick={(): void => void props.vm.toggleDryRun()}
        >
          {pending === 'dry' ? '请稍候…' : snapshot?.dryRun ? '试运行：开' : '试运行：关'}
        </button>
        <select
          value={snapshot?.policy ?? 'idle'}
          disabled={pending !== null || !snapshot}
          onChange={(event): void => void props.vm.changePolicy(event.target.value as TriggerPolicy)}
        >
          {POLICIES.map((policy) => (
            <option key={policy} value={policy}>{triggerPolicyLabel(policy)}</option>
          ))}
        </select>
        <button className="ghost" type="button" onClick={(): void => setGuidePref(!guideOpen)}>
          {guideOpen ? '收起说明' : '使用说明'}
        </button>
      </div>
      {guideOpen ? <Guide /> : null}
      <h2>监视目录</h2>
      {state.watchFolders.length === 0 ? <Empty text="还没有监视目录" /> : null}
      <ul>{state.watchFolders.map((folder) => <li key={folder}>{folder}</li>)}</ul>
      <h2>每次整理</h2>
      {state.rounds.length === 0 ? <Empty text="还没有整理轮次" /> : null}
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>怎么开始的</th>
            <th>归档</th>
            <th>未分类</th>
            <th>失败</th>
            <th>是否移动文件</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.rounds.map((round) => (
            <tr key={round.id}>
              <td>{formatTime(round.finishedAt)}</td>
              <td>{triggerReasonLabel(round.reason)}</td>
              <td>{round.archived}</td>
              <td>{round.unclassified}</td>
              <td>{round.failed}</td>
              <td>{round.simulated > 0 ? '试运行，未移动' : '已移动'}</td>
              <td>
                <button className="ghost" type="button" onClick={(): void => props.vm.openRound(round.id)}>查看</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Guide(): ReactElement {
  return (
    <div className="guide">
      <strong>怎么用</strong>
      <ol>
        <li>监视目录放下载文件夹，归档根目录不要放在监视目录里面。</li>
        <li>预设决定文件去哪：文件名里要出现你写的词，例如「课件」。</li>
        <li>控制台状态是「空闲」时才会整理。未运行就先点「启动」。</li>
        <li>「试运行：关」才是正式整理。开着时文件留在原地，只记一条记录。</li>
      </ol>
    </div>
  );
}

function statusHint(snapshot: AgentSnapshot | null): string {
  if (!snapshot) {
    return '正在读取整理状态…';
  }
  const file = snapshot.currentFileName;
  if (snapshot.state === 'stopped') {
    return '整理还没启动。点「启动」，之后才会监视下载目录。';
  }
  if (snapshot.state === 'paused') {
    return '已暂停，不会处理新文件。点「恢复」继续，或点「停止」关掉。';
  }
  if (snapshot.state === 'scanning') {
    return '正在查看监视目录里有没有要处理的文件。';
  }
  if (snapshot.state === 'processing') {
    return file ? `正在整理「${file}」。这一轮结束会在下面给出合计。` : '正在整理。这一轮结束会在下面给出合计。';
  }
  if (snapshot.dryRun) {
    return '空闲，但试运行开着。点「立即整理」也只会记日志。';
  }
  return '空闲。下载目录安静几秒后会自动整理，也可以直接点「立即整理」。';
}

function can(state: AgentState | undefined, action: string): boolean {
  if (!state) {
    return false;
  }
  if (action === 'start') {
    return state === 'stopped';
  }
  if (action === 'pause') {
    return state === 'idle' || state === 'scanning' || state === 'processing';
  }
  if (action === 'resume') {
    return state === 'paused';
  }
  if (action === 'stop') {
    return state !== 'stopped';
  }
  return state === 'idle' || state === 'scanning' || state === 'processing';
}
