/**
 * 全项目共用的纯数据结构。时间一律用自 1970 年起的毫秒数，才能安全穿过进程边界。
 */

/** 什么时候开始一轮整理。 */
export type TriggerPolicy = 'idle' | 'immediate' | 'interval' | 'manual';
/** 这一轮是被谁放行的。 */
export type TriggerReason = 'startup' | 'idle-settled' | 'max-defer' | 'immediate' | 'interval' | 'manual';

/** Agent 当前处于哪一步。 */
export type AgentState = 'stopped' | 'scanning' | 'idle' | 'processing' | 'paused';

/** 一个文件在资料库里的状态。held 表示人撤销后暂时不再自动搬走。 */
export type MaterialStatus = 'unclassified' | 'archived' | 'held';

/** 处理记录的动作。 */
export type AgentAction = 'archived' | 'unclassified' | 'failed' | 'simulated' | 'skipped';

/** 预设命中落在哪一层。habit 是习惯接管后的结果。 */
export type MatchTier = 'name-and-type' | 'name' | 'type' | 'habit' | 'none';

/** 名字是怎么对上的。 */
export type HitKind = 'includes' | 'starts' | 'ends' | 'type' | 'none';

/** 一条分拣规则：什么样的文件，搬到哪个目录。 */
export interface Preset {
  id: number;
  name: string;
  extensions: string | null;
  nameIncludes: string | null;
  nameStarts: string | null;
  nameEnds: string | null;
  nameExcludes: string | null;
  targetDir: string;
  pathLayout: string;
  priority: number;
  enabled: boolean;
  maxSizeMb: number;
  createdAt: number;
  updatedAt: number;
}

/** 还没保存的预设。id 为空表示新建。 */
export interface PresetDraft extends Omit<Preset, 'id' | 'createdAt' | 'updatedAt'> {
  id: number | null;
}

/** 初始化时可以勾选的内置模板，本身还不包含目标目录。 */
export interface PresetTemplate {
  key: string;
  name: string;
  extensions: string;
  nameIncludes: string | null;
  nameStarts: string | null;
  nameEnds: string | null;
  nameExcludes: string | null;
  pathLayout: string;
  priority: number;
  description: string;
}

/** 见过的一个文件。不保存文件正文。 */
export interface Material {
  id: number;
  fileName: string;
  currentPath: string;
  originPath: string | null;
  presetId: number | null;
  category: string | null;
  extension: string;
  sizeBytes: number;
  modifiedAt: number;
  sha256: string | null;
  status: MaterialStatus;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}

/** 一条只追加的处理记录。 */
export interface AgentLog {
  id: number;
  roundId: number;
  materialId: number | null;
  presetId: number | null;
  action: AgentAction;
  fromPath: string;
  toPath: string | null;
  reason: string;
  trace: string;
  durationMs: number;
  dryRun: boolean;
  createdAt: number;
  undone: boolean;
  undoneAt: number | null;
}

/** 一轮整理的合计。id 用开始时的毫秒，0 留给单文件重新分拣。 */
export interface AgentRound {
  id: number;
  reason: TriggerReason;
  startedAt: number;
  finishedAt: number;
  scanned: number;
  archived: number;
  unclassified: number;
  failed: number;
  simulated: number;
  skipped: number;
  deferred: number;
}

/** 控制台要看的运行快照。 */
export interface AgentSnapshot {
  state: AgentState;
  currentFileName: string | null;
  policy: TriggerPolicy;
  idleSettleMs: number;
  activeRoundId: number | null;
  lastActivityAt: number | null;
  watchFolderCount: number;
  dryRun: boolean;
}

/** 控制台上的计数。 */
export interface AgentStats {
  archivedToday: number;
  archivedTotal: number;
  unclassifiedCount: number;
  heldCount: number;
  failedToday: number;
  lastArchivedAt: number | null;
  lastRoundAt: number | null;
}

/** 预设匹配器的结论。纯函数的输出，不代表文件已经被移动。 */
export interface MatchResult {
  presetId: number | null;
  tier: MatchTier;
  hitToken: string | null;
  hitKind: HitKind;
  reason: string;
  trace: string;
  candidateCount: number;
}

/** 习惯看的是文件名片段，还是扩展名。 */
export type HabitKind = 'token' | 'extension';

/** 最终是预设定的、习惯定的，还是谁都没定。 */
export type DecisionSource = 'preset' | 'habit' | 'none';

/** user.md 里解析出来的一行习惯。 */
export interface HabitRule {
  lineNumber: number;
  kind: HabitKind;
  token: string | null;
  extensions: string[];
  presetName: string;
  auto: boolean;
  raw: string;
}

/** 某一行习惯写错了。 */
export interface HabitParseError {
  line: number;
  message: string;
}

/** 一次解析的全部结果。有错误时 rules 为空，调用方沿用上一份。 */
export interface HabitDocument {
  rules: HabitRule[];
  errors: HabitParseError[];
}

/** 设置页和控制台展示的习惯状态。 */
export interface HabitDiagnostics {
  loaded: boolean;
  usedPrevious: boolean;
  path: string;
  ruleCount: number;
  autoRuleCount: number;
  errors: HabitParseError[];
  stalePresetNames: string[];
}

/** 名字预设、习惯、类型预设走完之后的最终去向。 */
export interface Disposition {
  presetId: number | null;
  source: DecisionSource;
  tier: MatchTier;
  hitToken: string | null;
  reason: string;
  trace: string;
}

/** 某个片段被肯定或否定过几次。正文不在这里，正文在 user.md。 */
export interface HabitObservation {
  featureKind: HabitKind;
  featureValue: string;
  presetId: number;
  presetName: string;
  polarity: 'positive' | 'negative';
  hits: number;
  lastSeenAt: number;
}

/** 列表里多带预设名和最近一次原因。 */
export interface MaterialView extends Material {
  presetName: string | null;
  reason: string | null;
  inUnclassifiedDir: boolean;
}

/** 文件详情：历史和相同哈希的其它文件。 */
export interface MaterialDetail extends MaterialView {
  logs: AgentLogView[];
  duplicates: MaterialView[];
}

/** 处理记录列表用的视图。 */
export interface AgentLogView extends AgentLog {
  fileName: string | null;
  presetName: string | null;
}

/** 资料库搜索条件。空字段表示不限制。 */
export interface QuerySpec {
  keyword: string | null;
  presetId: number | null;
  category: string | null;
  status: MaterialStatus | null;
  favoriteOnly: boolean;
}

/** 处理记录的筛选条件。 */
export interface LogQuery {
  action: AgentAction | null;
  from: number | null;
  to: number | null;
  keyword: string | null;
}

/** 完成初始化时一次性提交的配置。 */
export interface InitRequest {
  watchFolders: string[];
  archiveRoot: string;
  unclassifiedDir: string;
  presets: PresetDraft[];
}

const TRIGGER_POLICY_LABEL: Record<TriggerPolicy, string> = {
  idle: '静默检测', immediate: '立即', interval: '定时', manual: '手动'
};
const TRIGGER_REASON_LABEL: Record<TriggerReason, string> = {
  startup: '启动扫描', 'idle-settled': '静默到点', 'max-defer': '强制放行',
  immediate: '文件就绪', interval: '定时到点', manual: '手动触发'
};
const AGENT_STATE_LABEL: Record<AgentState, string> = {
  stopped: '未运行', scanning: '扫描中', idle: '空闲', processing: '处理中', paused: '已暂停'
};
const AGENT_ACTION_LABEL: Record<AgentAction, string> = {
  archived: '已整理', unclassified: '未分类', failed: '失败', simulated: '试运行', skipped: '跳过'
};
const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  unclassified: '未分类', archived: '已归档', held: '已撤销'
};
const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  'name-and-type': '名字+类型', name: '仅名字', type: '仅类型', habit: '整理习惯', none: '无命中'
};

/** 把钩子策略显示成中文。 */
export function triggerPolicyLabel(value: TriggerPolicy): string {
  return TRIGGER_POLICY_LABEL[value];
}
/** 把一轮的触发原因显示成中文。 */
export function triggerReasonLabel(value: TriggerReason): string {
  return TRIGGER_REASON_LABEL[value];
}
/** 把 Agent 状态显示成中文。 */
export function agentStateLabel(value: AgentState): string {
  return AGENT_STATE_LABEL[value];
}
/** 把处理动作显示成中文。 */
export function agentActionLabel(value: AgentAction): string {
  return AGENT_ACTION_LABEL[value];
}
/** 把资料状态显示成中文。 */
export function materialStatusLabel(value: MaterialStatus): string {
  return MATERIAL_STATUS_LABEL[value];
}
/** 把命中层显示成中文。 */
export function matchTierLabel(value: MatchTier): string {
  return MATCH_TIER_LABEL[value];
}
/** 轮次号 0 不是真实轮次，界面上显示为横线。 */
export function roundLabel(roundId: number): string {
  return roundId === 0 ? '—' : String(roundId);
}
