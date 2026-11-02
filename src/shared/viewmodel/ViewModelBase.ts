/**
 * ViewModel 的公共底座。
 * 它不认识 React：界面用订阅函数拿状态，状态一变就通知。
 * getState 在下一次 setState 之前必须返回同一个对象，这样界面才能知道「没有变化」。
 */
export interface ViewModelBaseState {
  loading: boolean;
  error: string | null;
}

type Listener<State> = (state: State) => void;

/** 所有页面状态对象的基类。Param 是打开这个页面时带进来的参数。 */
export abstract class ViewModelBase<
  Param = void,
  State extends ViewModelBaseState = ViewModelBaseState
> {
  private state: State;
  private readonly listeners = new Set<Listener<State>>();

  protected constructor(initialState: State) {
    this.state = initialState;
  }

  /** 读取当前状态。在下次 setState 之前引用保持不变。 */
  getState(): State {
    return this.state;
  }

  /** 订阅状态变化，返回取消订阅的函数。 */
  subscribe(listener: Listener<State>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 导航层打开本页时传入参数。不需要参数的页面保持空实现。 */
  setParameter(_param: Param): void {}

  /** 离开页面时释放定时器和订阅。子类覆写时要记得收尾。 */
  dispose(): void {}

  /** 合并一块新状态并通知订阅者。必须换成新对象。 */
  protected setState(patch: Partial<State>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /** 把异常收成界面能显示的一句中文，不再向外抛。 */
  protected captureError(error: unknown, fallback: string): void {
    const message = error instanceof Error && error.message ? error.message : fallback;
    this.setState({ error: message, loading: false } as Partial<State>);
  }
}
