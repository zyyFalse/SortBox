/**
 * 预加载脚本是主进程和页面之间的窄桥。
 * contextBridge 只露出 invoke 和 subscribe。页面拿不到 Node，也拿不到数据库。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { MainEvent } from '@shared/types/api';

contextBridge.exposeInMainWorld('sortbox', {
  invoke(method: string, args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke('sortbox:invoke', { method, args });
  },
  subscribe(listener: (event: MainEvent) => void): () => void {
    const wrapped = (_event: unknown, payload: MainEvent): void => {
      listener(payload);
    };
    ipcRenderer.on('sortbox:event', wrapped);
    return () => {
      ipcRenderer.removeListener('sortbox:event', wrapped);
    };
  }
});
