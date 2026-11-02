import type { MainEvent } from '@shared/types/api';

/** preload 通过 contextBridge 放在 window 上的窄桥。 */
interface SortboxBridge {
  invoke(method: string, args: unknown[]): Promise<unknown>;
  subscribe(listener: (event: MainEvent) => void): () => void;
}

declare global {
  interface Window {
    sortbox: SortboxBridge;
  }
}

export {};
