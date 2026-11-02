/**
 * 移动文件是 Agent 唯一被允许改变用户磁盘的地方。
 *
 * 规则：
 * - 目标已存在就改名（name_2.pdf），绝不覆盖。
 * - 同一块磁盘用 rename，这是一次原子改名。
 * - 跨盘时 rename 会失败（错误码 EXDEV）。这时先复制，核对大小一致，才允许去掉源文件。
 * - 复制失败必须留下源文件，只清掉没写完的新文件。
 */
import { copyFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathKey } from '../core/paths';
import { withSuffix } from '../model/naming';

/** 移动或归档路径不合法时抛出的错误。消息直接给界面看。 */
export class FileActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileActionError';
  }
}

async function unusedTarget(desiredTargetAbs: string): Promise<string> {
  const directory = path.dirname(desiredTargetAbs);
  const fileName = path.basename(desiredTargetAbs);
  for (let index = 1; index <= 999; index += 1) {
    const candidate = path.join(directory, withSuffix(fileName, index));
    try {
      await stat(candidate);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : '';
      if (code === 'ENOENT') {
        return candidate;
      }
      throw error;
    }
  }
  throw new FileActionError('无法生成不冲突的文件名');
}

/** 把源文件移动到目标。目标父目录不存在时会创建。返回实际落到的路径。 */
export async function moveFile(
  sourceAbs: string,
  desiredTargetAbs: string
): Promise<{ actualPath: string; renamed: boolean; strategy: 'rename' | 'copy-unlink' }> {
  await mkdir(path.dirname(desiredTargetAbs), { recursive: true });
  if (pathKey(sourceAbs) === pathKey(desiredTargetAbs)) {
    throw new FileActionError('目标与源相同');
  }
  const actualPath = await unusedTarget(desiredTargetAbs);
  const renamed = pathKey(actualPath) !== pathKey(desiredTargetAbs);
  try {
    await rename(sourceAbs, actualPath);
    return { actualPath, renamed, strategy: 'rename' };
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code !== 'EXDEV') {
      throw new FileActionError(error instanceof Error ? error.message : '移动失败');
    }
  }
  try {
    await copyFile(sourceAbs, actualPath);
    const sourceStat = await stat(sourceAbs);
    const targetStat = await stat(actualPath);
    if (sourceStat.size !== targetStat.size) {
      throw new Error('大小不一致');
    }
    await unlink(sourceAbs);
    return { actualPath, renamed, strategy: 'copy-unlink' };
  } catch (error) {
    try {
      await unlink(actualPath);
    } catch {
      // 半截目标可能还没出现，忽略清理失败。源文件仍然留在原地。
    }
    const reason = error instanceof Error ? error.message : '未知原因';
    throw new FileActionError(`跨盘移动失败：${reason}`);
  }
}
