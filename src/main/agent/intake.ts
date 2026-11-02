/**
 * 接收过滤：决定监视目录里的一个条目要不要进入裁决。
 * 纯函数，不睡眠、不读正文、不算哈希。
 * reject 和 defer 都不写处理记录；fail 由调用方记一条失败。
 */
import path from 'node:path';
import type { AgentAction } from '@shared/types/domain';
import { fileExtension } from '../model/naming';
import { norm } from '../preset/PresetMatcher';

/** 这一条文件现在该怎么处理。 */
export type IntakeVerdict = 'accept' | 'reject' | 'defer' | 'fail';

const ALWAYS_IGNORED = new Set(['crdownload', 'part', 'tmp', 'download']);

export interface IntakeStat {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  size: number;
  mtimeMs: number;
}

/** 按固定顺序检查。先命中的规则生效，后面的不再看。 */
export function evaluateIntake(input: {
  filePath: string;
  stat: IntakeStat | null;
  errorCode?: string | null;
  ignoreExtensions: readonly string[];
  stabilityWindowMs: number;
  now: number;
  isInsideManagedDir(filePath: string): boolean;
}): { verdict: IntakeVerdict } {
  const errorCode = input.errorCode ?? null;
  if (errorCode === 'EACCES' || errorCode === 'EPERM' || errorCode === 'EBUSY') {
    return { verdict: 'fail' };
  }
  if (input.stat === null) {
    return { verdict: 'reject' };
  }
  if (input.stat.isDirectory()) {
    return { verdict: 'reject' };
  }
  if (input.stat.isSymbolicLink()) {
    return { verdict: 'reject' };
  }
  if (input.isInsideManagedDir(input.filePath)) {
    return { verdict: 'reject' };
  }
  const baseName = path.basename(input.filePath);
  if (baseName.startsWith('.')) {
    return { verdict: 'reject' };
  }
  if (baseName.startsWith('~$')) {
    return { verdict: 'reject' };
  }
  const extension = fileExtension(baseName);
  const ignored = input.ignoreExtensions.map((item) => norm(item));
  if (ignored.includes(extension)) {
    return { verdict: 'reject' };
  }
  if (ALWAYS_IGNORED.has(extension)) {
    return { verdict: 'reject' };
  }
  if (input.stat.size === 0 || input.now - input.stat.mtimeMs < input.stabilityWindowMs) {
    return { verdict: 'defer' };
  }
  return { verdict: 'accept' };
}

/**
 * 自动轮次用它跳过「上次就失败了，文件却一点没变」的情况，避免日志刷屏。
 * 人保存预设后的重评不能调用它，因为规则已经变了，必须再试一次。
 */
export function shouldSkipUnchangedFailure(input: {
  latestAction: AgentAction | null;
  latestReason: string | null;
  sizeUnchanged: boolean;
  mtimeUnchanged: boolean;
}): boolean {
  if (!input.sizeUnchanged || !input.mtimeUnchanged) {
    return false;
  }
  if (input.latestAction === 'failed') {
    return true;
  }
  return input.latestReason !== null && input.latestReason.includes('放入未分类失败');
}
