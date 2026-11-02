import path from 'node:path';
import type { AgentRound, Disposition, Material, Preset, TriggerReason } from '@shared/types/domain';
import { logger } from '../core/logger';
import { isPathInside, pathKey } from '../core/paths';
import { fileExtension } from '../model/naming';
import { decideDisposition } from '../userpref/evaluateHabits';
import { matchPreset } from '../preset/PresetMatcher';
import type { AgentLogRepository, AgentRoundRepository, MaterialRepository, OutcomeWriter, PresetRepository } from '../storage/repositories';
import { evaluateIntake, shouldSkipUnchangedFailure } from './intake';
import { archivePlacement, logBare, simulatePlacement, unclassifiedPlacement, type PlacementContext } from './placement';
import type { HabitLearner } from '../userpref/HabitLearner';
import type { UserHabitSet } from '../userpref/UserHabitSet';
import { inspect, listChildren } from './scan';
import { emptyTally, type RoundHooks, type Tally } from './roundTypes';

export type { RoundHooks };

/** 串行执行一轮整理，或对未分类和已撤销的文件重评。 */
export class RoundRunner {
  private managed: string[] = [];
  constructor(
    private readonly materials: MaterialRepository,
    private readonly presets: PresetRepository,
    private readonly logs: AgentLogRepository,
    private readonly rounds: AgentRoundRepository,
    private readonly outcomes: OutcomeWriter,
    private readonly habitSet: UserHabitSet,
    private readonly learner: HabitLearner,
    private readonly hooks: RoundHooks
  ) {}

  /** 扫描监视目录。includeParked 为真时，再看已经放进未分类目录的文件。 */
  async runRound(reason: TriggerReason, includeParked: boolean, roundId: number): Promise<AgentRound> {
    await this.rememberTargets();
    const tally = emptyTally();
    const visited = new Set<string>();
    const preferences = this.hooks.preferences();
    const automatic = reason !== 'manual';
    for (const folder of preferences.watchFolders) {
      const files = await listChildren(folder);
      for (const filePath of files) {
        await this.processWatchedFile(filePath, roundId, tally, visited, automatic);
      }
    }
    if (includeParked) {
      const parked = await this.materials.listUnclassifiedAndHeld();
      for (const material of parked) {
        if (material.status === 'held' || visited.has(pathKey(material.currentPath))) {
          continue;
        }
        await this.reclassify(material, roundId, tally, false);
      }
    }
    return this.finish(reason, roundId, tally, !this.hooks.dryRun());
  }

  /** 保存预设之后重评。已经在未分类且仍未命中的，不写新日志。 */
  async reevaluateParked(roundId: number): Promise<AgentRound> {
    await this.rememberTargets();
    const tally = emptyTally();
    const rows = await this.materials.listUnclassifiedAndHeld();
    for (const material of rows) {
      await this.reclassify(material, roundId, tally, true);
    }
    return this.finish('manual', roundId, tally, true);
  }

  /** 只重新分拣一个已撤销文件。不另开一轮。 */
  async releaseHeld(materialId: number): Promise<void> {
    const material = await this.materials.getById(materialId);
    if (!material || material.status !== 'held') {
      throw new Error('该文件不在已撤销状态');
    }
    await this.rememberTargets();
    await this.reclassify(material, 0, null, true);
    if (!this.hooks.dryRun()) {
      await this.learner.reconcile(Date.now());
    }
  }

  private async processWatchedFile(
    filePath: string,
    roundId: number,
    tally: Tally,
    visited: Set<string>,
    automatic: boolean
  ): Promise<void> {
    const key = pathKey(filePath);
    if (visited.has(key)) {
      return;
    }
    visited.add(key);
    if (!this.hooks.isProcessing()) {
      return;
    }
    tally.scanned += 1;
    const startedAt = Date.now();
    try {
      const inspected = await inspect(filePath);
      if (inspected.errorCode === 'EACCES' || inspected.errorCode === 'EPERM' || inspected.errorCode === 'EBUSY') {
        tally.failed += 1;
        await logBare(this.context(roundId), filePath, 'failed', '文件被占用或不可读', startedAt);
        return;
      }
      const preferences = this.hooks.preferences();
      const verdict = evaluateIntake({
        filePath,
        stat: inspected.stat,
        errorCode: inspected.errorCode,
        ignoreExtensions: preferences.ignoreExtensions,
        stabilityWindowMs: preferences.stabilityWindowMs,
        now: Date.now(),
        isInsideManagedDir: (candidate) => this.isManaged(candidate)
      }).verdict;
      if (verdict === 'reject') {
        tally.skipped += 1;
        logger.info('跳过文件', { filePath });
        return;
      }
      if (verdict === 'defer') {
        tally.deferred += 1;
        return;
      }
      if (verdict === 'fail') {
        tally.failed += 1;
        await logBare(this.context(roundId), filePath, 'failed', '文件被占用或不可读', startedAt);
        return;
      }
      const existing = await this.materials.getByPathKey(key);
      if (existing && (existing.status === 'held' || existing.status === 'archived')) {
        tally.skipped += 1;
        return;
      }
      if (existing && existing.status === 'unclassified' && automatic) {
        const latest = await this.logs.latestByMaterial(existing.id);
        const unchanged =
          existing.sizeBytes === (inspected.stat?.size ?? existing.sizeBytes) &&
          existing.modifiedAt === Math.round(inspected.stat?.mtimeMs ?? existing.modifiedAt);
        if (
          shouldSkipUnchangedFailure({
            latestAction: latest?.action ?? null,
            latestReason: latest?.reason ?? null,
            sizeUnchanged: unchanged,
            mtimeUnchanged: unchanged
          })
        ) {
          tally.skipped += 1;
          return;
        }
      }
      const fileName = path.basename(filePath);
      this.hooks.onFile(fileName);
      const decision = await this.decide(fileName, fileExtension(fileName), inspected.stat?.size ?? 0);
      const preset = decision.presetId === null ? null : await this.presets.getById(decision.presetId);
      if (this.hooks.dryRun()) {
        tally.simulated += 1;
        await simulatePlacement(this.context(roundId), filePath, fileName, decision, preset, startedAt);
        return;
      }
      const material =
        existing ??
        (await this.materials.upsertSeen({
          fileName,
          currentPath: filePath,
          pathKey: key,
          originPath: filePath,
          extension: fileExtension(fileName),
          sizeBytes: inspected.stat?.size ?? 0,
          modifiedAt: Math.round(inspected.stat?.mtimeMs ?? Date.now())
        }));
      await this.applyDecision(material, decision, preset, roundId, tally, startedAt);
    } catch (error) {
      tally.failed += 1;
      const message = error instanceof Error ? error.message : '未知错误';
      await logBare(this.context(roundId), filePath, 'failed', `处理异常：${message}`, startedAt);
    } finally {
      this.hooks.onFile(null);
    }
  }

  private async reclassify(material: Material, roundId: number, tally: Tally | null, allowHeld: boolean): Promise<void> {
    if (material.status === 'held' && !allowHeld) {
      return;
    }
    const inspected = await inspect(material.currentPath);
    if (!inspected.stat || !inspected.stat.isFile()) {
      return;
    }
    const startedAt = Date.now();
    const decision = await this.decide(material.fileName, material.extension, material.sizeBytes);
    const preset = decision.presetId === null ? null : await this.presets.getById(decision.presetId);
    if (!preset) {
      if (isPathInside(material.currentPath, this.hooks.preferences().unclassifiedDir)) {
        await this.materials.touchUpdated(material.id);
        return;
      }
      const outcome = await unclassifiedPlacement(this.context(roundId), material, decision, startedAt);
      if (tally) {
        tally[outcome] += 1;
      }
      return;
    }
    const outcome = await archivePlacement(this.context(roundId), material, preset, decision, startedAt);
    if (tally && outcome !== 'skipped') {
      tally[outcome] += 1;
    } else if (tally) {
      tally.skipped += 1;
    }
  }

  private async applyDecision(
    material: Material,
    decision: Disposition,
    preset: Preset | null,
    roundId: number,
    tally: Tally,
    startedAt: number
  ): Promise<void> {
    if (preset) {
      const outcome = await archivePlacement(this.context(roundId), material, preset, decision, startedAt);
      tally[outcome] += 1;
      return;
    }
    const outcome = await unclassifiedPlacement(this.context(roundId), material, decision, startedAt);
    tally[outcome] += 1;
  }

  private async decide(fileName: string, extension: string, sizeBytes: number): Promise<Disposition> {
    const enabled = await this.presets.listEnabled();
    const match = matchPreset({ fileName, sizeBytes, extension }, enabled);
    const all = await this.presets.list();
    return decideDisposition({
      fileName,
      extension,
      sizeBytes,
      match,
      habits: this.habitSet.current(),
      presets: all
    });
  }

  private context(roundId: number): PlacementContext {
    return {
      outcomes: this.outcomes,
      learner: this.learner,
      now: Date.now(),
      roundId,
      dryRun: this.hooks.dryRun(),
      unclassifiedDir: this.hooks.preferences().unclassifiedDir,
      onLog: (log): void => {
        this.hooks.onLog(log);
      }
    };
  }

  private async rememberTargets(): Promise<void> {
    const presets = await this.presets.list();
    this.managed = [this.hooks.preferences().unclassifiedDir, ...presets.map((item) => item.targetDir)];
  }

  private isManaged(filePath: string): boolean {
    return this.managed.some((dir) => dir.trim() !== '' && isPathInside(filePath, dir));
  }

  private async finish(reason: TriggerReason, roundId: number, tally: Tally, learn: boolean): Promise<AgentRound> {
    const finishedAt = Date.now();
    const round: AgentRound = { id: roundId, reason, startedAt: roundId, finishedAt, ...tally };
    if (roundId !== 0) {
      await this.rounds.append(round);
    }
    if (learn) {
      await this.learner.reconcile(finishedAt);
    }
    return round;
  }
}
