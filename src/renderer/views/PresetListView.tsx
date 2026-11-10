import type { ReactElement } from 'react';
import type { PresetListViewModel } from '@shared/viewmodel/PresetListViewModel';
import { Empty } from '../components/Empty';
import { useViewModel } from '../hooks/useViewModel';

/** 预设列表。删除前确认一次。 */
export function PresetListView(props: { vm: PresetListViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Presets">
      <h1>预设</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.notice ? <p className="notice">{state.notice}</p> : null}
      <div className="row">
        <button type="button" onClick={(): void => props.vm.create()}>新增预设</button>
        <button className="ghost" type="button" onClick={(): void => void props.vm.importOne()}>导入</button>
      </div>
      <h2>从模板创建</h2>
      <div className="row">
        {state.templates.map((template) => (
          <button key={template.key} className="ghost" type="button" onClick={(): void => props.vm.createFromTemplate(template)}>
            {template.name}
          </button>
        ))}
      </div>
      {state.presets.length === 0 ? <Empty text="还没有预设，先启用预设包" /> : null}
      <table>
        <tbody>
          {state.presets.map((preset) => (
            <tr key={preset.id} className={preset.enabled ? '' : 'is-off'}>
              <td>{preset.name}</td>
              <td>{preset.enabled ? '启用' : '已停用'}</td>
              <td>{preset.targetDir}</td>
              <td className="row">
                <button className="ghost" type="button" onClick={(): void => props.vm.edit(preset.id)}>打开</button>
                <button
                  className={preset.enabled ? 'ghost' : 'selected'}
                  type="button"
                  disabled={state.pendingId === preset.id}
                  onClick={(): void => void props.vm.toggleEnabled(preset.id, !preset.enabled)}
                >
                  {state.pendingId === preset.id ? '请稍候…' : preset.enabled ? '停用' : '启用'}
                </button>
                <button className="ghost" type="button" onClick={(): void => void props.vm.exportOne(preset.id)}>导出</button>
                <button
                  type="button"
                  onClick={(): void => {
                    if (window.confirm(`删除预设「${preset.name}」？`)) {
                      void props.vm.remove(preset.id);
                    }
                  }}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
