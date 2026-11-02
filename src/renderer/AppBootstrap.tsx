import type { FunctionComponent, ReactElement } from 'react';
import {
  ContentNavigationConstant,
  MenuNavigationConstant,
  RootNavigationConstant
} from '@shared/navigation/constants';
import { MainViewModel } from '@shared/viewmodel/MainViewModel';
import { DashboardView } from './views/DashboardView';
import { FileDetailView } from './views/FileDetailView';
import { InitializationView } from './views/InitializationView';
import { LogView } from './views/LogView';
import { MainView } from './views/MainView';
import { PresetDetailView } from './views/PresetDetailView';
import { PresetListView } from './views/PresetListView';
import { QueryView } from './views/QueryView';
import { ResultView } from './views/ResultView';
import { SettingsView } from './views/SettingsView';
import { UnclassifiedView } from './views/UnclassifiedView';
import { IpcSortboxApi } from './services/IpcSortboxApi';
import { ServiceLocator } from './services/ServiceLocator';
import { ViewLocator } from './services/ViewLocator';

function wrap<T extends object>(view: FunctionComponent<{ vm: T }>): FunctionComponent<{ vm: object }> {
  const Wrapped = (props: { vm: object }): ReactElement => <>{view({ vm: props.vm as T })}</>;
  return Wrapped;
}

/** 创建 API、十一个 ViewModel，并把视图登记进 ViewLocator。 */
export function bootstrap(): { services: ServiceLocator; view: ReactElement } {
  const api = new IpcSortboxApi();
  const services = new ServiceLocator();
  services.register('api', api);
  const main = new MainViewModel(api);
  services.register('main', main);
  services.register('initialization', main.initialization);
  services.register('dashboard', main.dashboard);
  services.register('unclassified', main.unclassified);
  services.register('logs', main.logs);
  services.register('query', main.query);
  services.register('presets', main.presets);
  services.register('settings', main.settings);
  const views = new ViewLocator();
  views.register(RootNavigationConstant.INITIALIZATION, wrap(InitializationView));
  views.register(MenuNavigationConstant.DASHBOARD, wrap(DashboardView));
  views.register(MenuNavigationConstant.UNCLASSIFIED, wrap(UnclassifiedView));
  views.register(MenuNavigationConstant.LOGS, wrap(LogView));
  views.register(MenuNavigationConstant.QUERY, wrap(QueryView));
  views.register(MenuNavigationConstant.PRESETS, wrap(PresetListView));
  views.register(MenuNavigationConstant.SETTINGS, wrap(SettingsView));
  views.register(ContentNavigationConstant.RESULT, wrap(ResultView));
  views.register(ContentNavigationConstant.FILE_DETAIL, wrap(FileDetailView));
  views.register(ContentNavigationConstant.PRESET_DETAIL, wrap(PresetDetailView));
  services.register('views', views);
  return { services, view: <MainView vm={main} views={views} /> };
}
