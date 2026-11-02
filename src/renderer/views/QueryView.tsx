import type { ReactElement } from 'react';
import type { MaterialStatus } from '@shared/types/domain';
import { materialStatusLabel } from '@shared/types/domain';
import type { QueryViewModel } from '@shared/viewmodel/QueryViewModel';
import { useViewModel } from '../hooks/useViewModel';

const CATEGORIES = ['', '文档', '图片', '音频', '视频', '压缩包', '代码', '其他'];
const STATUSES: Array<MaterialStatus | ''> = ['', 'unclassified', 'archived', 'held'];

/** 资料库搜索条件。 */
export function QueryView(props: { vm: QueryViewModel }): ReactElement {
  const state = useViewModel(props.vm);
  return (
    <section className="page" data-view="Query">
      <h1>资料库</h1>
      {state.error ? <p className="error">{state.error}</p> : null}
      <div className="form">
        <label>关键字</label>
        <input
          value={state.spec.keyword ?? ''}
          onChange={(event): void => props.vm.setSpec({ keyword: event.target.value || null })}
        />
        <label>预设</label>
        <select
          value={state.spec.presetId ?? ''}
          onChange={(event): void => props.vm.setSpec({ presetId: event.target.value ? Number(event.target.value) : null })}
        >
          <option value="">全部</option>
          {state.presets.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.name}</option>
          ))}
        </select>
        <label>分类</label>
        <select
          value={state.spec.category ?? ''}
          onChange={(event): void => props.vm.setSpec({ category: event.target.value || null })}
        >
          {CATEGORIES.map((category) => (
            <option key={category || 'all'} value={category}>{category || '全部'}</option>
          ))}
        </select>
        <label>状态</label>
        <select
          value={state.spec.status ?? ''}
          onChange={(event): void => {
            const value = event.target.value as MaterialStatus | '';
            props.vm.setSpec({ status: value === '' ? null : value });
          }}
        >
          {STATUSES.map((status) => (
            <option key={status || 'all'} value={status}>{status === '' ? '全部' : materialStatusLabel(status)}</option>
          ))}
        </select>
        <label>仅置顶</label>
        <input
          type="checkbox"
          checked={state.spec.favoriteOnly}
          onChange={(event): void => props.vm.setSpec({ favoriteOnly: event.target.checked })}
        />
      </div>
      <button type="button" onClick={(): void => props.vm.search()}>搜索</button>
    </section>
  );
}
