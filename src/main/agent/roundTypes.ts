import type { AgentLogView } from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';

/** 一轮里面的计数器。 */
export interface Tally {
  scanned: number;
  archived: number;
  unclassified: number;
  failed: number;
  simulated: number;
  skipped: number;
  deferred: number;
}

/** 轮次执行时向 Agent 询问状态、设置，并把日志交回去。 */
export interface RoundHooks {
  isProcessing(): boolean;
  onFile(name: string | null): void;
  onLog(log: AgentLogView): void;
  preferences(): Preferences;
  dryRun(): boolean;
}

/** 空的计数器。 */
export function emptyTally(): Tally {
  return { scanned: 0, archived: 0, unclassified: 0, failed: 0, simulated: 0, skipped: 0, deferred: 0 };
}
