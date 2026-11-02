/**
 * 路径同一性。
 * Windows 上 C:\A 和 c:\a 是同一个地方，但展示给用户时仍保留原来的大小写。
 * 所以比较用 pathKey，存盘和显示用原始字符串。
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const nodeRequire = createRequire(import.meta.url);

/** 用来判断「是不是同一路径」。Windows 上会转成小写。 */
export function pathKey(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** 文件是否位于目录里面（含目录自己）。 */
export function isPathInside(filePath: string, directory: string): boolean {
  const fileKey = pathKey(filePath);
  const dirKey = pathKey(directory);
  if (fileKey === dirKey) {
    return true;
  }
  const prefix = dirKey.endsWith(path.sep) ? dirKey : `${dirKey}${path.sep}`;
  return fileKey.startsWith(prefix);
}

/** 两个目录是否相等，或其中一个包含另一个。 */
export function pathsOverlap(left: string, right: string): boolean {
  return isPathInside(left, right) || isPathInside(right, left);
}

function electronApp(): { getPath(name: 'userData'): string; getName(): string } {
  const electron = nodeRequire('electron') as {
    app?: { getPath(name: 'userData'): string; getName(): string };
  };
  if (!electron.app) {
    throw new Error('Electron 应用尚未就绪');
  }
  return electron.app;
}

/** 分拣匣自己的数据目录：系统用户数据目录下的 sortbox。 */
export function sortboxDir(): string {
  return path.join(electronApp().getPath('userData'), 'sortbox');
}

/** SQLite 数据库文件。 */
export function dbFilePath(): string {
  return path.join(sortboxDir(), 'sortbox.db');
}

/** 整理习惯正文。和数据库放在一起，但不在数据库里。 */
export function userMdPath(): string {
  return path.join(sortboxDir(), 'user.md');
}
