import type { ReactElement } from 'react';
import type { AgentAction } from '@shared/types/domain';
import { agentActionLabel, roundLabel } from '@shared/types/domain';
import type { LogViewModel } from '@shared/viewmodel/LogViewModel';
import { Empty } from '../components/Empty';
import { formatTime } from '../format';
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
        <button type="button" onClick={(): void => void props.vm.undoLatest()}>撤销最近一次</button>
      </div>
      {state.items.length === 0 ? <Empty text="暂无处理记录" /> : null}
      <table>
        <tbody>
          {state.items.map((log) => {
            const canUndo = log.action === 'archived' && !log.undone && !log.dryRun;
            return (
              <tr key={log.id} onClick={(): void => props.vm.toggle(log.id)}>
                <td>{formatTime(log.createdAt)}</td>
                <td>{roundLabel(log.roundId)}</td>
                <td>{agentActionLabel(log.action)}</td>
                <td>{log.fileName ?? log.fromPath}</td>
                <td>
                  {canUndo ? (
                    <button type="button" onClick={(event): void => { event.stopPropagation(); void props.vm.undo(log.id); }}>撤销</button>
                  ) : null}
                  {log.materialId !== null ? (
                    <button className="ghost" type="button" onClick={(event): void => { event.stopPropagation(); props.vm.openMaterial(log.materialId); }}>打开</button>
                  ) : null}
                </td>
                {state.expandedId === log.id ? <td>{log.reason}<br />{log.trace}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
