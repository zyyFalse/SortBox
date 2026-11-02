/**
 * 设置保存前的范围和目录关系。
 * 数值超出范围就拒绝，避免定时器被设成 0 或一个大到失真的数。
 */
import type { Preferences } from '@shared/types/preferences';
import { assertLocations } from '../preset/presetRules';

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** 五个时间字段的允许范围。保底间隔可以是 0，表示关闭。 */
export function assertPreferenceRanges(prefs: Preferences): void {
  if (!inRange(prefs.idleSettleMs, 500, 60000)) {
    throw new Error('静默时间超出允许范围');
  }
  if (!inRange(prefs.maxDeferMs, 1000, 600000)) {
    throw new Error('最长等待超出允许范围');
  }
  if (!inRange(prefs.intervalMs, 5000, 3600000)) {
    throw new Error('定时间隔超出允许范围');
  }
  const fallback = prefs.intervalFallbackMs;
  const fallbackOk = fallback === 0 || inRange(fallback, 5000, 86400000);
  if (!fallbackOk) {
    throw new Error('保底间隔超出允许范围');
  }
  if (!inRange(prefs.stabilityWindowMs, 200, 5000)) {
    throw new Error('稳定窗口超出允许范围');
  }
}

/** 已经完成初始化之后，监视目录、未分类目录和预设目标不能互相包含。 */
export function assertSavedLocations(prefs: Preferences, targetDirs: readonly string[]): void {
  if (!prefs.initialized) {
    return;
  }
  assertLocations({
    watchFolders: prefs.watchFolders,
    unclassifiedDir: prefs.unclassifiedDir,
    targetDirs
  });
}
