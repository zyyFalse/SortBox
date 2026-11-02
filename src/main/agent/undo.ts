/**
 * 撤销只针对一条已经成功的正式归档。
 * 文件移回来源路径，资料标成 held。自动轮次看到 held 会跳过，
 * 否则同一条预设会马上再把它搬走，撤销就白做了。
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { AgentLog } from '@shared/types/domain';
import { pathKey } from '../core/paths';
import type { AgentLogRepository, OutcomeWriter } from '../storage/repositories';
import { moveFile } from './move';
import { tokenFromTrace, type HabitLearner } from '../userpref/HabitLearner';

/** 把一条归档撤回去。 */
export class UndoService {
  constructor(
    private readonly logs: AgentLogRepository,
    private readonly outcomes: OutcomeWriter,
    private readonly learner: HabitLearner
  ) {}

  /** 撤销指定记录。 */
  async undoLog(id: number): Promise<void> {
    const log = await this.logs.getById(id);
    await this.undo(log);
  }

  /** 撤销最近一条还能撤的正式归档。 */
  async undoLatest(): Promise<void> {
    const log = await this.logs.findLatestUndoableArchive();
    if (!log) {
      throw new Error('没有可撤销的整理记录');
    }
    await this.undo(log);
  }

  private async undo(log: AgentLog | null): Promise<void> {
    if (!log || log.action !== 'archived' || log.undone || log.dryRun || !log.toPath || log.materialId === null) {
      throw new Error('没有可撤销的整理记录');
    }
    try {
      await stat(log.toPath);
    } catch {
      throw new Error('目标文件已不存在，无法撤销');
    }
    const moved = await moveFile(log.toPath, log.fromPath);
    const undoneAt = Date.now();
    await this.outcomes.undoHeld({
      materialId: log.materialId,
      currentPath: moved.actualPath,
      pathKey: pathKey(moved.actualPath),
      fileName: path.basename(moved.actualPath),
      logId: log.id,
      undoneAt
    });
    const parsed = tokenFromTrace(log.trace);
    if (
      parsed &&
      (parsed.tier === 'name-and-type' || parsed.tier === 'name') &&
      parsed.token !== '' &&
      log.presetId !== null
    ) {
      await this.learner.observeUndo(parsed.token, log.presetId, undoneAt);
      await this.learner.reconcile(undoneAt);
    }
  }
}
