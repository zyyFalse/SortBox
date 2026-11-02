/** 根层：还在初始化，还是已经进入主窗。 */
export const RootNavigationConstant = {
  INITIALIZATION: 'Initialization',
  MAIN: 'Main'
} as const;

/** 左侧六个菜单，顺序不可变。 */
export const MenuNavigationConstant = {
  DASHBOARD: 'Dashboard',
  UNCLASSIFIED: 'Unclassified',
  LOGS: 'Logs',
  QUERY: 'Query',
  PRESETS: 'Presets',
  SETTINGS: 'Settings'
} as const;

/** 从菜单页再点进去的详情层。 */
export const ContentNavigationConstant = {
  RESULT: 'Result',
  FILE_DETAIL: 'FileDetail',
  PRESET_DETAIL: 'PresetDetail'
} as const;

/** 菜单渲染顺序。 */
export const MENU_ORDER = [
  'Dashboard',
  'Unclassified',
  'Logs',
  'Query',
  'Presets',
  'Settings'
] as const;

/** 菜单键对应的中文。 */
export const MENU_LABEL: Record<(typeof MENU_ORDER)[number], string> = {
  Dashboard: '控制台',
  Unclassified: '未分类',
  Logs: '处理记录',
  Query: '资料库',
  Presets: '预设',
  Settings: '设置'
};
