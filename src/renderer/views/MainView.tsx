import type { ReactElement } from 'react';
import { MENU_LABEL, MENU_ORDER, RootNavigationConstant } from '@shared/navigation/constants';
import type { MainViewModel } from '@shared/viewmodel/MainViewModel';
import { useViewModel } from '../hooks/useViewModel';
import type { ViewLocator } from '../services/ViewLocator';

/** 左侧菜单和详情层。根层是初始化时，整屏换成初始化页。 */
export function MainView(props: { vm: MainViewModel; views: ViewLocator }): ReactElement {
  const state = useViewModel(props.vm);
  if (state.rootKey === RootNavigationConstant.INITIALIZATION) {
    const Initialization = props.views.resolve('Initialization');
    return <Initialization vm={props.vm.initialization} />;
  }
  const menuVm = menuOf(props.vm, state.menuKey);
  const Menu = props.views.resolve(state.menuKey);
  const Content = state.contentKey && state.contentVm ? props.views.resolve(state.contentKey) : null;
  return (
    <div className="app-shell" data-view="Main">
      <aside className="sidebar">
        <h1 className="brand">分拣匣</h1>
        {MENU_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={key === state.menuKey ? 'active' : ''}
            onClick={(): void => props.vm.navigateMenu(key)}
          >
            {MENU_LABEL[key]}
          </button>
        ))}
      </aside>
      <main className="main">
        {Content && state.contentVm ? (
          <div className="page">
            <button className="ghost" type="button" onClick={(): void => props.vm.goBack()}>返回</button>
            <Content vm={state.contentVm} />
          </div>
        ) : (
          <Menu vm={menuVm} />
        )}
      </main>
    </div>
  );
}

function menuOf(vm: MainViewModel, key: string): object {
  if (key === 'Unclassified') {
    return vm.unclassified;
  }
  if (key === 'Logs') {
    return vm.logs;
  }
  if (key === 'Query') {
    return vm.query;
  }
  if (key === 'Presets') {
    return vm.presets;
  }
  if (key === 'Settings') {
    return vm.settings;
  }
  return vm.dashboard;
}
