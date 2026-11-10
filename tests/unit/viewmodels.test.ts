import { describe, expect, it, vi } from 'vitest';
import { ContentNavigationConstant } from '@shared/navigation/constants';
import type { ContentNavigationService, RootNavigationService } from '@shared/navigation/services';
import { DashboardViewModel } from '@shared/viewmodel/DashboardViewModel';
import { LogViewModel } from '@shared/viewmodel/LogViewModel';
import { SettingsViewModel } from '@shared/viewmodel/SettingsViewModel';
import { UnclassifiedViewModel } from '@shared/viewmodel/UnclassifiedViewModel';
import { endOfLocalDay, formatDateInput, startOfLocalDay } from '../../src/renderer/format';
import { FakeSortboxApi, FailingRunApi } from '../helpers/FakeSortboxApi';

function contentNav(): ContentNavigationService & { key: string | null; parameter: unknown } {
  return {
    key: null,
    parameter: null,
    navigateContent(key: string, parameter: unknown): void {
      this.key = key;
      this.parameter = parameter;
    },
    goBack(): void {}
  };
}

const rootNav: RootNavigationService = {
  navigateRoot(_key: string): void {}
};

describe('ViewModel', (): void => {
  it('立即整理失败时把错误写进状态', async (): Promise<void> => {
    const vm = new DashboardViewModel(new FailingRunApi(), contentNav());
    await vi.waitFor((): void => {
      expect(vm.getState().loading).toBe(false);
    });
    await vm.runNow();
    expect(vm.getState().error).toBe('整理失败');
    expect(vm.getState().pending).toBeNull();
    vm.dispose();
  });

  it('立即整理成功后给出本轮合计，并能打开这一轮', async (): Promise<void> => {
    const api = new FakeSortboxApi();
    const navigation = contentNav();
    const vm = new DashboardViewModel(api, navigation);
    await vi.waitFor((): void => {
      expect(vm.getState().loading).toBe(false);
    });
    await vm.runNow();
    expect(vm.getState().notice).toContain('归档 0');
    expect(vm.getState().pending).toBeNull();
    vm.openRound(1);
    expect(navigation.key).toBe(ContentNavigationConstant.ROUND_DETAIL);
    expect(navigation.parameter).toBe(1);
    vm.dispose();
  });

  it('按文件名生成预设只导航，不保存', async (): Promise<void> => {
    const api = new FakeSortboxApi();
    const navigation = contentNav();
    const vm = new UnclassifiedViewModel(api, navigation);
    await vi.waitFor((): void => {
      expect(vm.getState().loading).toBe(false);
    });
    await vm.createPresetFrom(7);
    expect(api.suggested).toBe(1);
    expect(api.savePresetCalls).toBe(0);
    expect(navigation.key).toBe(ContentNavigationConstant.PRESET_DETAIL);
    const parameter = navigation.parameter as { id: number | null; draft: { name: string } };
    expect(parameter.id).toBeNull();
    expect(parameter.draft.name).toBe('发票');
    vm.dispose();
  });

  it('结束日期早于开始日期时不再查询', async (): Promise<void> => {
    const api = new FakeSortboxApi();
    const queryLogs = vi.spyOn(api, 'queryLogs');
    const vm = new LogViewModel(api, contentNav());
    await vi.waitFor((): void => {
      expect(vm.getState().loading).toBe(false);
    });
    const calls = queryLogs.mock.calls.length;
    await vm.setQuery({ from: 2_000, to: 1_000 });
    expect(vm.getState().error).toBe('结束日期不能早于开始日期');
    expect(vm.getState().items).toEqual([]);
    expect(queryLogs.mock.calls.length).toBe(calls);
    vm.dispose();
  });

  it('日期框按当地的一天起止换算', (): void => {
    expect(startOfLocalDay('2026-11-04')).toBe(new Date(2026, 10, 4, 0, 0, 0, 0).getTime());
    expect(endOfLocalDay('2026-11-04')).toBe(new Date(2026, 10, 4, 23, 59, 59, 999).getTime());
    expect(formatDateInput(endOfLocalDay('2026-11-04'))).toBe('2026-11-04');
    expect(startOfLocalDay('')).toBeNull();
    expect(endOfLocalDay('2026-13-40')).toBeNull();
  });

  it('保存设置把草稿交给接口，打开习惯文件不读盘', async (): Promise<void> => {
    const api = new FakeSortboxApi();
    const vm = new SettingsViewModel(api, rootNav);
    await vi.waitFor((): void => {
      expect(vm.getState().loading).toBe(false);
    });
    vm.setDraft('idleSettleMs', 4000);
    await vm.save();
    expect(api.savedPatch?.idleSettleMs).toBe(4000);
    await vm.openUserMd();
    expect(api.openedUserMd).toBe(true);
  });
});
