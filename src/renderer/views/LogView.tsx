import { Fragment, type ReactElement } from 'react';
import type { AgentAction } from '@shared/types/domain';
import { agentActionLabel } from '@shared/types/domain';
import type { LogViewModel } from '@shared/viewmodel/LogViewModel';
import { Empty } from '../components/Empty';
import { endOfLocalDay, formatDateInput, formatTime, startOfLocalDay } from '../format';
import { useViewModel } from '../hooks/useViewModel';

const ACTIONS: Array<AgentAction | ''> = ['', 'archived', 'unclassified', 'failed', 'simulated', 'skipped'];

/** 处理记录。只有正式归档成功且未撤销的行可以撤销。 */
export function LogView(props: { vm: LogViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Logs">
      <h1>处理记录</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="row">
        <select
          value={state.query.action ?? ''}
          onChange={(event): void => void props.vm.setAction(event.target.value as AgentAction | '')}
        >
          <option value="">全部动作</option>
          {ACTIONS.filter((item): item is AgentAction => item !== '').map((action) => (
            <option key={action} value={action}>{agentActionLabel(action)}</option>
          ))}
        </select>
        <input
          placeholder="关键字"
          value={state.query.keyword ?? ''}
          onChange={(event): void => void props.vm.setQuery({ keyword: event.target.value || null })}
        />
        <label>
          从
          <input
            type="date"
            value={formatDateInput(state.query.from)}
            onChange={(event): void => {
              void props.vm.setQuery({ from: startOfLocalDay(event.target.value) });
            }}
          />
        </label>
        <label>
          到
          <input
            type="date"
            value={formatDateInput(state.query.to)}
            onChange={(event): void => {
              void props.vm.setQuery({ to: endOfLocalDay(event.target.value) });
            }}
          />
        </label>
        <button type="button" onClick={(): void => void props.vm.undoLatest()}>撤销最近一次</button>
      </div>
      {state.items.length === 0 ? <Empty text="暂无处理记录" /> : null}
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>结果</th>
            <th>文件</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((log) => {
            const canUndo = log.action === 'archived' && !log.undone && !log.dryRun;
            return (
              <Fragment key={log.id}>
                <tr onClick={(): void => props.vm.toggle(log.id)}>
                  <td>{formatTime(log.createdAt)}</td>
                  <td>{agentActionLabel(log.action)}</td>
                  <td>{log.fileName ?? log.fromPath}</td>
                  <td>
                    {canUndo ? (
                      <button className="ghost" type="button" onClick={(event): void => { event.stopPropagation(); void props.vm.undo(log.id); }}>撤销</button>
                    ) : null}
                    {log.materialId !== null ? (
                      <button className="ghost" type="button" onClick={(event): void => { event.stopPropagation(); props.vm.openMaterial(log.materialId); }}>打开</button>
                    ) : null}
                  </td>
                </tr>
                {state.expandedId === log.id ? (
                  <tr>
                    <td colSpan={4}>原因：{log.reason}<br />依据：{log.trace}</td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
