import type { FunctionComponent } from 'react';

/** 视图键到组件的对照表。组件只接收一个 vm。 */
export class ViewLocator {
  private readonly views = new Map<string, FunctionComponent<{ vm: object }>>();

  /** 登记一个视图组件。 */
  register(key: string, view: FunctionComponent<{ vm: object }>): void {
    this.views.set(key, view);
  }

  /** 按键取出视图。没有就抛中文错误。 */
  resolve(key: string): FunctionComponent<{ vm: object }> {
    const view = this.views.get(key);
    if (!view) {
      throw new Error(`未注册的视图：${key}`);
    }
    return view;
  }
}
