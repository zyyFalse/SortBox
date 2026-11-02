/**
 * 读写用户点名的一小段文本，例如导入、导出的预设 JSON。
 * 下载目录里的文件不走这里。哈希另有专门的流式计算。
 */
import { closeSync, fstatSync, openSync, readSync, writeSync } from 'node:fs';

/** 把整个文本文件读成字符串。 */
export function readTextFile(filePath: string): string {
  const handle = openSync(filePath, 'r');
  try {
    const size = fstatSync(handle).size;
    const buffer = Buffer.alloc(size);
    readSync(handle, buffer, 0, size, 0);
    return buffer.toString('utf8');
  } finally {
    closeSync(handle);
  }
}

/** 覆盖写成一段文本。调用方已经通过保存对话框确认了路径。 */
export function writeTextFile(filePath: string, text: string): void {
  const handle = openSync(filePath, 'w');
  try {
    writeSync(handle, text, null, 'utf8');
  } finally {
    closeSync(handle);
  }
}
