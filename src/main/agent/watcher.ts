/**
 * 监视目录只看第一层。
 * chokidar 的 depth: 0 仍会报到目录自己，所以先确认父目录就是某个监视根，才算一次活动。
 * 不要打开 awaitWriteFinish，稳定与否由接收过滤和钩子决定。
 */
import chokidar from 'chokidar';

/** 把文件系统事件收成「某个监视目录有变化」。 */
export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  /** 开始监听。空目录列表就什么都不做。 */
  start(folders: string[], onPath: (filePath: string) => void): void {
    this.stop();
    if (folders.length === 0) {
      return;
    }
    this.watcher = chokidar.watch(folders, {
      depth: 0,
      ignoreInitial: true,
      awaitWriteFinish: false
    });
    this.watcher.on('all', (_eventName: string, filePath: string) => {
      onPath(filePath);
    });
    this.watcher.on('error', () => {
      // 目录暂时不可读时忽略，下一轮扫描会再试。
    });
  }

  /** 关掉监听。 */
  stop(): void {
    if (this.watcher !== null) {
      void this.watcher.close();
      this.watcher = null;
    }
  }
}
