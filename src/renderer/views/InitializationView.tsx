import type { ReactElement } from 'react';
import type { InitializationViewModel } from '@shared/viewmodel/InitializationViewModel';
import { Empty } from '../components/Empty';
import { useViewModel } from '../hooks/useViewModel';

/** 第一次使用时选择目录和预设包。 */
export function InitializationView(props: { vm: InitializationViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Initialization">
      <h1>分拣匣 Sortbox</h1>
      <div className="guide">
        <strong>第一次使用</strong>
        <div className="steps">
          <div className="step"><strong>1 监视目录</strong>选下载文件夹。新文件出现在这里才会被看到。</div>
          <div className="step"><strong>2 归档位置</strong>选一个不在监视目录里面的文件夹。文件会按预设搬进去。</div>
          <div className="step"><strong>3 预设</strong>勾选要启用的规则。名字预设只认文件名里的词，不读正文。</div>
          <div className="step"><strong>4 开始整理</strong>完成后回到控制台。状态应是「空闲」，并且「试运行：关」。</div>
        </div>
      </div>
      <p>选择要监视的下载目录，以及文件整理后的归档位置。</p>
      {state.error ? <p className="error">{state.error}</p> : null}
      <h2>监视目录</h2>
      {state.watchFolders.length === 0 ? <Empty text="还没有监视目录" /> : null}
      <ul>
        {state.watchFolders.map((folder) => (
          <li key={folder}>
            {folder}{' '}
            <button className="ghost" type="button" onClick={(): void => props.vm.removeWatchFolder(folder)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={(): void => void props.vm.addWatchFolder()}>
        添加目录
      </button>
      <h2>归档根目录</h2>
      <p>{state.archiveRoot || '尚未选择'}</p>
      <button type="button" onClick={(): void => void props.vm.setArchiveRoot()}>
        选择归档根目录
      </button>
      <h2>预设包</h2>
      {state.templates.map((template) => (
        <label key={template.key} className="row">
          <input
            type="checkbox"
            checked={state.selected.includes(template.key)}
            onChange={(): void => props.vm.toggleTemplate(template.key)}
          />
          {template.name}：{template.description}
        </label>
      ))}
      <button className="ghost" type="button" onClick={(): void => props.vm.addBlank()}>
        添加空白预设
      </button>
      {state.extras.map((draft, index) => (
        <input
          key={index}
          value={draft.name}
          placeholder="预设名称"
          onChange={(event): void => props.vm.setExtraName(index, event.target.value)}
        />
      ))}
      <h2>未分类目录</h2>
      <input value={state.unclassifiedDir} onChange={(event): void => props.vm.setUnclassifiedDir(event.target.value)} />
      <button className="ghost" type="button" onClick={(): void => void props.vm.pickUnclassified()}>
        选择未分类目录
      </button>
      <button type="button" disabled={state.loading} onClick={(): void => void props.vm.complete()}>
        {state.loading ? '请稍候…' : '完成初始化'}
      </button>
    </section>
  );
}
