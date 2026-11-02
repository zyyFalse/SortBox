import type { ReactElement } from 'react';
import { materialStatusLabel } from '@shared/types/domain';
import type { ResultViewModel } from '@shared/viewmodel/ResultViewModel';
import { Empty } from '../components/Empty';
import { useViewModel } from '../hooks/useViewModel';

/** 搜索结果列表。 */
export function ResultView(props: { vm: ResultViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Result">
      <h1>搜索结果</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.items.length === 0 ? <Empty text="没有匹配的文件" /> : null}
      <table>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.id}>
              <td>{item.fileName}</td>
              <td>{item.presetName ?? '—'}</td>
              <td>{materialStatusLabel(item.status)}</td>
              <td>
                <button type="button" onClick={(): void => props.vm.openDetail(item.id)}>打开</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
