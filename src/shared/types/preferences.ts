import type { TriggerPolicy } from '@shared/types/domain';

/**
 * 全局设置。数据库里一行一个字段，值是 JSON 文本。
 * 这里的默认值就是第一次打开、还没完成初始化时的状态。
 */
export interface Preferences {
  initialized: boolean;
  watchFolders: string[];
  ignoreExtensions: string[];
  agentEnabled: boolean;
  agentDryRun: boolean;
  triggerPolicy: TriggerPolicy;
  idleSettleMs: number;
  maxDeferMs: number;
  intervalMs: number;
  intervalFallbackMs: number;
  stabilityWindowMs: number;
  unclassifiedDir: string;
  archiveRoot: string;
}

/** 缺字段或类型不对时退回这里。 */
export const DEFAULT_PREFERENCES: Preferences = {
  initialized: false,
  watchFolders: [],
  ignoreExtensions: ['exe', 'msi', 'dmg', 'iso', 'crdownload', 'part', 'tmp', 'download', 'bak'],
  agentEnabled: true,
  agentDryRun: false,
  triggerPolicy: 'idle',
  idleSettleMs: 3000,
  maxDeferMs: 30000,
  intervalMs: 60000,
  intervalFallbackMs: 0,
  stabilityWindowMs: 800,
  unclassifiedDir: '',
  archiveRoot: ''
};
