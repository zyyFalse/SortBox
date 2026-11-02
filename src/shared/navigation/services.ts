/** 切换初始化页和主窗。 */
export interface RootNavigationService {
  navigateRoot(key: string): void;
}

/** 切换左侧菜单。切换时要清空详情栈。 */
export interface MenuNavigationService {
  navigateMenu(key: string): void;
}

/** 打开详情，或从详情退回菜单页。 */
export interface ContentNavigationService {
  navigateContent(key: string, parameter: unknown): void;
  goBack(): void;
}
