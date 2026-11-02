import type { ReactElement } from 'react';
import type { TriggerPolicy } from '@shared/types/domain';
import { triggerPolicyLabel } from '@shared/types/domain';
import type { SettingsViewModel } from '@shared/viewmodel/SettingsViewModel';
import { useViewModel } from '../hooks/useViewModel';

const POLICIES: TriggerPolicy[] = ['idle', 'immediate', 'interval', 'manual'];

/** 设置、整理习惯和学习次数。 */
export function SettingsView(props: { vm: SettingsViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const draft = state.draft;
  const habits = state.habits;
  return (
    <section className="page" data-view="Settings">
      <h1>设置</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="form">
        <label>策略</label>
        <select value={draft.triggerPolicy} onChange={(event): void => props.vm.setPolicy(event.target.value as TriggerPolicy)}>
          {POLICIES.map((policy) => (
            <option key={policy} value={policy}>{triggerPolicyLabel(policy)}</option>
          ))}
        </select>
        <label>静默毫秒</label>
        <input type="number" value={draft.idleSettleMs} onChange={(event): void => props.vm.setDraft('idleSettleMs', Number(event.target.value))} />
        <label>最长等待</label>
        <input type="number" value={draft.maxDeferMs} onChange={(event): void => props.vm.setDraft('maxDeferMs', Number(event.target.value))} />
        <label>定时间隔</label>
        <input type="number" value={draft.intervalMs} onChange={(event): void => props.vm.setDraft('intervalMs', Number(event.target.value))} />
        <label>保底间隔</label>
        <input type="number" value={draft.intervalFallbackMs} onChange={(event): void => props.vm.setDraft('intervalFallbackMs', Number(event.target.value))} />
        <label>稳定窗口</label>
        <input type="number" value={draft.stabilityWindowMs} onChange={(event): void => props.vm.setDraft('stabilityWindowMs', Number(event.target.value))} />
        <label>忽略扩展名</label>
        <input value={draft.ignoreExtensions.join(',')} onChange={(event): void => props.vm.setIgnoreText(event.target.value)} />
        <label>未分类目录</label>
        <input value={draft.unclassifiedDir} onChange={(event): void => props.vm.setDraft('unclassifiedDir', event.target.value)} />
        <label>开机整理</label>
        <input type="checkbox" checked={draft.agentEnabled} onChange={(event): void => props.vm.setDraft('agentEnabled', event.target.checked)} />
      </div>
      <h2>监视目录</h2>
      <ul>
        {draft.watchFolders.map((folder) => (
          <li key={folder}>
            {folder} <button className="ghost" type="button" onClick={(): void => props.vm.removeWatchFolder(folder)}>移除</button>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="ghost" type="button" onClick={(): void => void props.vm.addWatchFolder()}>添加目录</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.pickUnclassified()}>选择未分类目录</button>
        <button type="button" onClick={(): void => void props.vm.save()}>保存</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.resetInitialization()}>重新初始化</button>
      </div>
      <h2>整理习惯</h2>
      {habits ? (
        <div className="stack">
          <p>{habits.ruleCount} 条习惯（其中 {habits.autoRuleCount} 条自动学习）</p>
          {habits.errors.map((error) => (
            <p className="error" key={`${error.line}-${error.message}`}>user.md 第 {error.line} 行：{error.message}</p>
          ))}
          {habits.stalePresetNames.length > 0 ? (
            <p className="error">有 {habits.stalePresetNames.length} 条习惯指向不存在或未启用的预设</p>
          ) : null}
        </div>
      ) : null}
      <div className="row">
        <button className="ghost" type="button" onClick={(): void => void props.vm.openUserMd()}>打开 user.md</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.revealUserMd()}>在文件夹中显示</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.reloadHabits()}>重新加载</button>
      </div>
      <ul>
        {state.observations.map((item) => (
          <li key={`${item.featureValue}-${item.presetId}-${item.polarity}`}>
            {item.featureValue} → {item.presetName} {item.polarity === 'positive' ? '肯定' : '否定'} {item.hits}
          </li>
        ))}
      </ul>
      <p className="about">分拣匣 Sortbox · 按预设自动整理下载文件 · 无账号 · 不联网</p>
      <p className="about">{state.version} · {state.userDataDir}</p>
    </section>
  );
}
