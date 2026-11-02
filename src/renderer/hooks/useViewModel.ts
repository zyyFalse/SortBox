import { useCallback, useSyncExternalStore } from 'react';
import type { ViewModelBaseState } from '@shared/viewmodel/ViewModelBase';

interface ReadableModel<State extends ViewModelBaseState> {
  subscribe(listener: (state: State) => void): () => void;
  getState(): State;
}

/**
 * 把 ViewModel 的订阅接到 React。
 * useSyncExternalStore 要求 getState 在没变化时返回同一个对象，ViewModelBase 就是这样做的。
 * 页面因此不用自己写 useState + useEffect。
 */
export function useViewModel<State extends ViewModelBaseState>(vm: ReadableModel<State>): State {
  const subscribe = useCallback(
    (listener: () => void): (() => void) => vm.subscribe(listener),
    [vm]
  );
  return useSyncExternalStore(subscribe, () => vm.getState());
}
