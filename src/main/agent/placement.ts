/**
 * 一个文件已经决定去向之后，真正移动并写库。
 * 顺序不能反：先移动成功，再开事务写资料和日志。
 * 写库失败只记错误，不把文件搬回去碰运气。下次扫描会按路径把记录补上。
 */
import path from 'node:path';
import type { AgentLogView, Disposition, Material, Preset } from '@shared/types/domain';
import { categoryOf } from '../model/category';
import { fileExtension, unclassifiedRelativeName } from '../model/naming';
import { resolveArchivePath } from '../preset/TemplatePathResolver';
import { pathKey } from '../core/paths';
import { logger } from '../core/logger';
import type { OutcomeCommit, OutcomeWriter } from '../storage/repositories';
import { FileActionError, moveFile } from './move';
import { shouldObserveArchive } from '../userpref/HabitLearner';
import type { HabitLearner } from '../userpref/HabitLearner';

export interface PlacementContext {
  outcomes: OutcomeWriter;
  learner: HabitLearner;
  now: number;
  roundId: number;
  dryRun: boolean;
  unclassifiedDir: string;
  onLog(log: AgentLogView, presetName: string | null): void;
}

async function commit(ctx: PlacementContext, input: OutcomeCommit, fileName: string, presetName: string | null): Promise<void> {
  try {
    const log = await ctx.outcomes.commit(input);
    const view: AgentLogView = { ...log, fileName, presetName };
    ctx.onLog(view, presetName);
  } catch (error) {
    logger.error('文件已经移动，但写入数据库失败', {
      message: error instanceof Error ? error.message : String(error),
      from: input.log.fromPath,
      to: input.log.toPath
    });
  }
}

/** 试运行只写一条 simulated 日志，不移动、不改资料、不记习惯。 */
export async function simulatePlacement(
  ctx: PlacementContext,
  sourcePath: string,
  fileName: string,
  decision: Disposition,
  preset: Preset | null,
  startedAt: number
): Promise<'simulated'> {
  const toPath = preset
    ? resolveArchivePath({ preset, sourceFileName: fileName, archiveDate: new Date(ctx.now) })
    : unclassifiedTarget(ctx.unclassifiedDir, fileName);
  await commit(
    ctx,
    {
      material: { kind: 'none' },
      log: baseLog(ctx, null, preset?.id ?? null, 'simulated', sourcePath, toPath, decision.reason, decision.trace, startedAt)
    },
    fileName,
    preset?.name ?? null
  );
  return 'simulated';
}

/** 命中预设或习惯：移动到目标目录，再把资料标成已归档。 */
export async function archivePlacement(
  ctx: PlacementContext,
  material: Material,
  preset: Preset,
  decision: Disposition,
  startedAt: number
): Promise<'archived' | 'failed' | 'skipped'> {
  const fileName = material.fileName;
  let target = '';
  try {
    target = resolveArchivePath({
      preset,
      sourceFileName: fileName,
      archiveDate: new Date(ctx.now)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '归档路径越界';
    await commit(
      ctx,
      {
        material: { kind: 'none' },
        log: baseLog(ctx, material.id, preset.id, 'failed', material.currentPath, null, `移动失败：${message}`, decision.trace, startedAt)
      },
      fileName,
      preset.name
    );
    return 'failed';
  }
  if (pathKey(target) === pathKey(material.currentPath)) {
    await commit(
      ctx,
      {
        material: { kind: 'none' },
        log: baseLog(ctx, material.id, preset.id, 'skipped', material.currentPath, target, '目标路径与源路径相同', decision.trace, startedAt)
      },
      fileName,
      preset.name
    );
    return 'skipped';
  }
  try {
    const moved = await moveFile(material.currentPath, target);
    const category = categoryOf(material.extension);
    await commit(
      ctx,
      {
        material: {
          kind: 'archived',
          id: material.id,
          presetId: preset.id,
          currentPath: moved.actualPath,
          pathKey: pathKey(moved.actualPath),
          category,
          archivedAt: ctx.now,
          fileName: path.basename(moved.actualPath)
        },
        log: baseLog(
          ctx,
          material.id,
          preset.id,
          'archived',
          material.currentPath,
          moved.actualPath,
          decision.reason,
          decision.trace,
          startedAt
        )
      },
      path.basename(moved.actualPath),
      preset.name
    );
    if (
      shouldObserveArchive({
        dryRun: false,
        source: decision.source,
        tier: decision.tier,
        hitToken: decision.hitToken
      }) &&
      decision.hitToken
    ) {
      await ctx.learner.observeArchive(decision.hitToken, preset.id, ctx.now);
    }
    return 'archived';
  } catch (error) {
    const message = error instanceof FileActionError ? error.message : error instanceof Error ? error.message : '移动失败';
    await commit(
      ctx,
      {
        material: { kind: 'none' },
        log: baseLog(ctx, material.id, preset.id, 'failed', material.currentPath, target, `移动失败：${message}`, decision.trace, startedAt)
      },
      fileName,
      preset.name
    );
    return 'failed';
  }
}

/** 谁都没接住：放进「扩展名/文件名」。失败也要写日志，并且不能中断后面的文件。 */
export async function unclassifiedPlacement(
  ctx: PlacementContext,
  material: Material,
  decision: Disposition,
  startedAt: number
): Promise<'unclassified'> {
  const target = unclassifiedTarget(ctx.unclassifiedDir, material.fileName);
  const category = categoryOf(material.extension);
  try {
    const moved = await moveFile(material.currentPath, target);
    const fileName = path.basename(moved.actualPath);
    await commit(
      ctx,
      {
        material: {
          kind: 'unclassified',
          id: material.id,
          currentPath: moved.actualPath,
          pathKey: pathKey(moved.actualPath),
          category,
          fileName
        },
        log: baseLog(
          ctx,
          material.id,
          null,
          'unclassified',
          material.currentPath,
          moved.actualPath,
          '无预设命中，已放入未分类',
          decision.trace,
          startedAt
        )
      },
      fileName,
      null
    );
    return 'unclassified';
  } catch (error) {
    const message = error instanceof Error ? error.message : '移动失败';
    await commit(
      ctx,
      {
        material: { kind: 'none' },
        log: baseLog(
          ctx,
          material.id,
          null,
          'unclassified',
          material.currentPath,
          null,
          `无预设命中，放入未分类失败，已留在原处：${message}`,
          decision.trace,
          startedAt
        )
      },
      material.fileName,
      null
    );
    return 'unclassified';
  }
}

/** 没有资料行的失败或跳过，只追加日志。 */
export async function logBare(
  ctx: PlacementContext,
  filePath: string,
  action: 'failed',
  reason: string,
  startedAt: number
): Promise<void> {
  try {
    const log = await ctx.outcomes.commit({
      material: { kind: 'none' },
      log: baseLog(ctx, null, null, action, filePath, null, reason, '', startedAt)
    });
    ctx.onLog({ ...log, fileName: path.basename(filePath), presetName: null }, null);
  } catch (error) {
    logger.error('写入失败记录没有成功', {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/** 未分类目录下的最终位置。真正重名时由 moveFile 再加 _2。 */
export function unclassifiedTarget(unclassifiedDir: string, fileName: string): string {
  const relative = unclassifiedRelativeName(fileExtension(fileName), fileName);
  return path.join(unclassifiedDir, ...relative.split('/'));
}

function baseLog(
  ctx: PlacementContext,
  materialId: number | null,
  presetId: number | null,
  action: OutcomeCommit['log']['action'],
  fromPath: string,
  toPath: string | null,
  reason: string,
  trace: string,
  startedAt: number
): OutcomeCommit['log'] {
  return {
    roundId: ctx.roundId,
    materialId,
    presetId,
    action,
    fromPath,
    toPath,
    reason,
    trace,
    durationMs: Math.max(0, Date.now() - startedAt),
    dryRun: ctx.dryRun,
    createdAt: ctx.now,
    undone: false,
    undoneAt: null
  };
}
