import type { ReactElement } from 'react';
import { materialStatusLabel } from '@shared/types/domain';
import type { UnclassifiedViewModel } from '@shared/viewmodel/UnclassifiedViewModel';
import { Empty } from '../components/Empty';
import { formatBytes } from '../format';
import { useViewModel } from '../hooks/useViewModel';

/** 未分类文件。没有把文件指派给预设的下拉框。 */
export function UnclassifiedView(props: { vm: UnclassifiedViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Unclassified">
      <h1>未分类</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="row">
        {state.summary.map((item) => (
          <span className="chip" key={item.extension}>{item.extension} {item.count}</span>
        ))}
      </div>
      {state.items.length === 0 ? <Empty text="没有未分类的文件" /> : null}
      <table>
        <thead>
          <tr><th>文件</th><th>状态</th><th>大小</th><th>操作</th></tr>
        </thead>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.id}>
              <td>{item.fileName}</td>
              <td>{materialStatusLabel(item.status)}</td>
              <td>{formatBytes(item.sizeBytes)}</td>
              <td className="row">
                <button className="ghost" type="button" onClick={(): void => props.vm.openDetail(item.id)}>打开</button>
                <button className="ghost" type="button" onClick={(): void => void props.vm.reveal(item.currentPath)}>在文件夹中显示</button>
                <button className="ghost" type="button" onClick={(): void => void props.vm.createPresetFrom(item.id)}>按此文件名生成预设</button>
                {item.status === 'held' ? (
                  <button className="ghost" type="button" onClick={(): void => void props.vm.releaseHeld(item.id)}>重新分拣</button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
