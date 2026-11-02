import type { MainEvent } from '@shared/types/api';

/** 主进程内部的事件总线。界面要看的状态、日志和数据变更都从这里推出去。 */
export class AppEvents {
  private readonly listeners = new Set<(event: MainEvent) => void>();

  /** 订阅。返回取消订阅的函数。 */
  subscribe(listener: (event: MainEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 发给所有订阅者。渲染进程那边会再转发到窗口。 */
  emit(event: MainEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
