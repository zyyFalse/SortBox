import type { ReactElement } from 'react';
import { agentActionLabel, materialStatusLabel } from '@shared/types/domain';
import type { FileDetailViewModel } from '@shared/viewmodel/FileDetailViewModel';
import { Empty } from '../components/Empty';
import { formatBytes, formatTime } from '../format';
import { useViewModel } from '../hooks/useViewModel';

/** 文件详情。哈希只在点击按钮后计算。 */
export function FileDetailView(props: { vm: FileDetailViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const detail = state.detail;
  return (
    <section className="page" data-view="FileDetail">
      <h1>{detail?.fileName ?? '资料'}</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      {detail ? (
        <div className="stack">
          <div className="form">
            <label>状态</label><span>{materialStatusLabel(detail.status)}</span>
            <label>大小</label><span>{formatBytes(detail.sizeBytes)}</span>
            <label>分类</label><span>{detail.category ?? '其他'}</span>
            <label>路径</label><span>{detail.currentPath}</span>
            <label>预设</label><span>{detail.presetName ?? '—'}</span>
            <label>原因</label><span>{detail.reason ?? '—'}</span>
            <label>SHA-256</label><span>{detail.sha256 ?? '尚未计算'}</span>
          </div>
          <div className="row">
            <button type="button" onClick={(): void => void props.vm.open()}>打开</button>
            <button className="ghost" type="button" onClick={(): void => void props.vm.reveal()}>在文件夹中显示</button>
            <button className="ghost" type="button" onClick={(): void => void props.vm.toggleFavorite()}>{detail.favorite ? '取消置顶' : '置顶'}</button>
            <button className="ghost" type="button" onClick={(): void => void props.vm.computeSha256()}>计算 SHA-256</button>
          </div>
          <h2>相同哈希</h2>
          {detail.duplicates.length === 0 ? <Empty text="没有相同哈希的文件" /> : null}
          <ul>{detail.duplicates.map((item) => <li key={item.id}>{item.fileName}</li>)}</ul>
          <h2>历史</h2>
          {detail.logs.length === 0 ? <Empty text="暂无处理记录" /> : (
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>结果</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {detail.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatTime(log.createdAt)}</td>
                  <td>{agentActionLabel(log.action)}</td>
                  <td>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      ) : null}
    </section>
  );
}
