import type { ReactElement } from 'react';
import type { PresetDetailViewModel } from '@shared/viewmodel/PresetDetailViewModel';
import { useViewModel } from '../hooks/useViewModel';

/** 编辑预设，并试一个文件名会命中谁。 */
export function PresetDetailView(props: { vm: PresetDetailViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  const draft = state.draft;
  return (
    <section className="page" data-view="PresetDetail">
      <h1>{draft.name || '预设'}</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="form">
        <label>名称</label>
        <input value={draft.name} onChange={(event): void => props.vm.setField('name', event.target.value)} />
        <label>文件类型</label>
        <input value={draft.extensions ?? ''} onChange={(event): void => props.vm.setField('extensions', event.target.value || null)} />
        <label>文件名包含</label>
        <input value={draft.nameIncludes ?? ''} onChange={(event): void => props.vm.setField('nameIncludes', event.target.value || null)} />
        <label>文件名开头</label>
        <input value={draft.nameStarts ?? ''} onChange={(event): void => props.vm.setField('nameStarts', event.target.value || null)} />
        <label>文件名结尾</label>
        <input value={draft.nameEnds ?? ''} onChange={(event): void => props.vm.setField('nameEnds', event.target.value || null)} />
        <label>排除词</label>
        <input value={draft.nameExcludes ?? ''} onChange={(event): void => props.vm.setField('nameExcludes', event.target.value || null)} />
        <label>目标目录</label>
        <input value={draft.targetDir} onChange={(event): void => props.vm.setField('targetDir', event.target.value)} />
        <label>目录模板</label>
        <input value={draft.pathLayout} onChange={(event): void => props.vm.setField('pathLayout', event.target.value)} />
        <label>优先级</label>
        <input type="number" value={draft.priority} onChange={(event): void => props.vm.setField('priority', Number(event.target.value))} />
        <label>大小上限</label>
        <input type="number" value={draft.maxSizeMb} onChange={(event): void => props.vm.setField('maxSizeMb', Number(event.target.value))} />
      </div>
      <p>预览路径 {state.preview}</p>
      <p className="about">
        这一行只替换「目录模板」里的占位符。默认模板是 {'{yyyy-MM}/{origFileName}'}，所以改名称、类型或文件名条件时，预览路径不会变。
        把模板改成 {'{preset}/{origFileName}'} 后，名称才会出现在路径里。
        要看某个文件名会归到哪，改下面的样例文件名，再点「试命中」。
      </p>
      <div className="row">
        <button className="ghost" type="button" onClick={(): void => props.vm.refreshPreview()}>刷新预览</button>
        <input value={state.sampleName} onChange={(event): void => props.vm.setSampleName(event.target.value)} />
        <button className="ghost" type="button" onClick={(): void => void props.vm.previewSample()}>试命中</button>
      </div>
      {state.match ? <p>{state.match.reason}</p> : null}
      <div className="row">
        <button type="button" onClick={(): void => void props.vm.save()}>保存</button>
        <button
          className="ghost"
          type="button"
          onClick={(): void => {
            if (draft.id === null || window.confirm(`删除预设「${draft.name}」？`)) {
              void props.vm.remove();
            }
          }}
        >
          删除
        </button>
      </div>
    </section>
  );
}
