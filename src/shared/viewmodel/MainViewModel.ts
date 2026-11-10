/**
 * 整个窗口的导航。
 * 根层决定初始化还是主窗。菜单层是左侧六页。内容层是从菜单再点进去的详情。
 * 换菜单会清空详情栈。栈空时返回不做任何事。
 */
import type { SortboxApi } from '@shared/types/api';
import type { QuerySpec } from '@shared/types/domain';
import {
  ContentNavigationConstant,
  MenuNavigationConstant,
  RootNavigationConstant
} from '@shared/navigation/constants';
import type {
  ContentNavigationService,
  MenuNavigationService,
  RootNavigationService
} from '@shared/navigation/services';
import { ViewModelBase, type ViewModelBaseState } from './ViewModelBase';
import { DashboardViewModel } from './DashboardViewModel';
import { FileDetailViewModel } from './FileDetailViewModel';
import { InitializationViewModel } from './InitializationViewModel';
import { LogViewModel } from './LogViewModel';
import { PresetDetailViewModel, type PresetDetailParam } from './PresetDetailViewModel';
import { PresetListViewModel } from './PresetListViewModel';
import { QueryViewModel } from './QueryViewModel';
import { RoundDetailViewModel } from './RoundDetailViewModel';
import { ResultViewModel } from './ResultViewModel';
import { SettingsViewModel } from './SettingsViewModel';
import { UnclassifiedViewModel } from './UnclassifiedViewModel';

interface DisposablePage {
  dispose(): void;
}

export interface MainState extends ViewModelBaseState {
  rootKey: string;
  menuKey: string;
  contentKey: string | null;
  contentVm: DisposablePage | null;
}

interface StackFrame {
  key: string;
  vm: DisposablePage;
}

/** 主窗导航，同时实现三个导航接口。 */
export class MainViewModel
  extends ViewModelBase<void, MainState>
  implements RootNavigationService, MenuNavigationService, ContentNavigationService
{
  readonly initialization: InitializationViewModel;
  readonly dashboard: DashboardViewModel;
  readonly unclassified: UnclassifiedViewModel;
  readonly logs: LogViewModel;
  readonly query: QueryViewModel;
  readonly presets: PresetListViewModel;
  readonly settings: SettingsViewModel;
  private readonly stack: StackFrame[] = [];

  constructor(private readonly api: SortboxApi) {
    super({
      loading: true,
      error: null,
      rootKey: RootNavigationConstant.INITIALIZATION,
      menuKey: MenuNavigationConstant.DASHBOARD,
      contentKey: null,
      contentVm: null
    });
    this.initialization = new InitializationViewModel(api, this);
    this.dashboard = new DashboardViewModel(api, this);
    this.unclassified = new UnclassifiedViewModel(api, this);
    this.logs = new LogViewModel(api, this);
    this.query = new QueryViewModel(api, this);
    this.presets = new PresetListViewModel(api, this);
    this.settings = new SettingsViewModel(api, this);
    void this.boot();
  }

  /** 释放子页面。 */
  override dispose(): void {
    this.clearStack();
    this.dashboard.dispose();
    this.unclassified.dispose();
    this.logs.dispose();
    this.presets.dispose();
  }

  /** 在初始化和主窗之间切换。 */
  navigateRoot(key: string): void {
    this.clearStack();
    this.setState({ rootKey: key, contentKey: null, contentVm: null });
  }

  /** 切换左侧菜单，并丢掉详情栈。 */
  navigateMenu(key: string): void {
    this.clearStack();
    this.setState({ menuKey: key, contentKey: null, contentVm: null });
  }

  /** 打开详情。参数类型由具体页面自己解释。 */
  navigateContent(key: string, parameter: unknown): void {
    const vm = this.createContent(key, parameter);
    this.stack.push({ key, vm });
    this.setState({ contentKey: key, contentVm: vm });
  }

  /** 回到上一层。没有上一层就停住。 */
  goBack(): void {
    const current = this.stack.pop();
    if (!current) {
      return;
    }
    current.vm.dispose();
    const previous = this.stack[this.stack.length - 1];
    if (!previous) {
      this.setState({ contentKey: null, contentVm: null });
      return;
    }
    this.setState({ contentKey: previous.key, contentVm: previous.vm });
  }

  private async boot(): Promise<void> {
    try {
      const prefs = await this.api.getPreferences();
      const rootKey = prefs.initialized ? RootNavigationConstant.MAIN : RootNavigationConstant.INITIALIZATION;
      this.setState({ loading: false, rootKey, error: null });
    } catch (error) {
      this.captureError(error, '读取设置失败');
    }
  }

  private clearStack(): void {
    for (const frame of this.stack) {
      frame.vm.dispose();
    }
    this.stack.length = 0;
  }

  private createContent(key: string, parameter: unknown): DisposablePage {
    if (key === ContentNavigationConstant.RESULT) {
      const vm = new ResultViewModel(this.api, this);
      vm.setParameter(parameter as QuerySpec);
      return vm;
    }
    if (key === ContentNavigationConstant.FILE_DETAIL) {
      const vm = new FileDetailViewModel(this.api);
      vm.setParameter(parameter as number);
      return vm;
    }
    if (key === ContentNavigationConstant.ROUND_DETAIL) {
      const vm = new RoundDetailViewModel(this.api);
      vm.setParameter(parameter as number);
      return vm;
    }
    const vm = new PresetDetailViewModel(this.api, this);
    vm.setParameter(parameter as PresetDetailParam);
    return vm;
  }
}
