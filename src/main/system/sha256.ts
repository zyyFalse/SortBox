/**
 * 只有用户在详情页点击「计算 SHA-256」时才读文件字节。
 * 用流一块一块喂给哈希，不把整个文件读进一个字符串。
 * 整理过程不会调用这里，所以不会在搬运时打开下载内容。
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** 计算文件的 SHA-256，结果是 64 位十六进制。 */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    stream.on('error', (error: Error) => {
      reject(error);
    });
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
  });
}
