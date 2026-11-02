/**
 * 按名字取出服务。
 * 页面和 ViewModel 不自己 new 数据库或 IPC，只向这里要已经登记过的对象。
 */
export class ServiceLocator {
  private readonly items = new Map<string, unknown>();

  /** 登记一个服务。 */
  register(token: string, service: unknown): void {
    this.items.set(token, service);
  }

  /** 取出服务。没登记就抛中文错误，避免静默拿到 undefined。 */
  resolve<T>(token: string): T {
    const service = this.items.get(token);
    if (service === undefined) {
      throw new Error(`未注册的服务：${token}`);
    }
    return service as T;
  }
}
