/**
 * 只看监视目录的直接子项，不进入子文件夹。
 * 钩子问「有没有候选」时也用同一套接收过滤，但必须是同步的，因为钩子不能等待。
 */
import { lstatSync, readdirSync } from 'node:fs';
import { lstat as lstatAsync, readdir as readdirAsync } from 'node:fs/promises';
import path from 'node:path';
import type { Preferences } from '@shared/types/preferences';
import { logger } from '../core/logger';
import { evaluateIntake, type IntakeStat } from './intake';

const SCAN_LIMIT = 1000;

/** 异步列出目录第一层，超过 1000 个就截断并警告。 */
export async function listChildren(folder: string): Promise<string[]> {
  try {
    const names = await readdirAsync(folder);
    names.sort((left, right) => left.localeCompare(right, 'en'));
    if (names.length > SCAN_LIMIT) {
      logger.warn('监视目录条目超过 1000，只处理前 1000 个', { folder, count: names.length });
    }
    return names.slice(0, SCAN_LIMIT).map((name) => path.join(folder, name));
  } catch (error) {
    logger.warn('无法读取监视目录', {
      folder,
      message: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/** 读取条目类型。文件消失不算失败；没有权限才算失败。 */
export async function inspect(filePath: string): Promise<{ stat: IntakeStat | null; errorCode: string | null }> {
  try {
    const stat = await lstatAsync(filePath);
    return { errorCode: null, stat: toIntakeStat(stat) };
  } catch (error) {
    return { stat: null, errorCode: codeOf(error) };
  }
}

function toIntakeStat(stat: { isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean; size: number; mtimeMs: number }): IntakeStat {
  return {
    isDirectory: () => stat.isDirectory(),
    isFile: () => stat.isFile(),
    isSymbolicLink: () => stat.isSymbolicLink(),
    size: stat.size,
    mtimeMs: stat.mtimeMs
  };
}

function codeOf(error: unknown): string | null {
  const code = error instanceof Error && 'code' in error ? String(error.code) : '';
  if (code === 'ENOENT') {
    return null;
  }
  return code;
}

/**
 * 钩子用的同步版本：只要有一个不是「直接丢掉」的条目，就认为有候选。
 * 暂缓也算候选，否则「一直在写入」时强制放行永远等不到。
 */
export function hasCandidateSync(
  folders: readonly string[],
  preferences: Preferences,
  isInsideManagedDir: (filePath: string) => boolean
): boolean {
  for (const folder of folders) {
    let names: string[] = [];
    try {
      names = readdirSync(folder);
    } catch {
      continue;
    }
    names.sort((left, right) => left.localeCompare(right, 'en'));
    const limited = names.slice(0, SCAN_LIMIT);
    for (const name of limited) {
      const filePath = path.join(folder, name);
      const inspected = inspectSync(filePath);
      const verdict = evaluateIntake({
        filePath,
        stat: inspected.stat,
        errorCode: inspected.errorCode,
        ignoreExtensions: preferences.ignoreExtensions,
        stabilityWindowMs: preferences.stabilityWindowMs,
        now: Date.now(),
        isInsideManagedDir
      }).verdict;
      if (verdict !== 'reject') {
        return true;
      }
    }
  }
  return false;
}

function inspectSync(filePath: string): { stat: IntakeStat | null; errorCode: string | null } {
  try {
    const stat = lstatSync(filePath);
    return { errorCode: null, stat: toIntakeStat(stat) };
  } catch (error) {
    return { stat: null, errorCode: codeOf(error) };
  }
}
