/**
 * IPC 参数校验。
 * 每个方法一份结构。对不上就抛「参数非法：方法名」，不把半截数据送进业务。
 */
import { z } from 'zod';

const draft = z.object({
  id: z.number().int().positive().nullable(),
  name: z.string(),
  extensions: z.string().nullable(),
  nameIncludes: z.string().nullable(),
  nameStarts: z.string().nullable(),
  nameEnds: z.string().nullable(),
  nameExcludes: z.string().nullable(),
  targetDir: z.string(),
  pathLayout: z.string(),
  priority: z.number(),
  enabled: z.boolean(),
  maxSizeMb: z.number()
});

const fallback = z
  .number()
  .int()
  .refine((value) => value === 0 || (value >= 5000 && value <= 86400000));

const preferencePatch = z
  .object({
    initialized: z.boolean().optional(),
    watchFolders: z.array(z.string()).optional(),
    ignoreExtensions: z.array(z.string()).optional(),
    agentEnabled: z.boolean().optional(),
    agentDryRun: z.boolean().optional(),
    triggerPolicy: z.union([
      z.literal('idle'),
      z.literal('immediate'),
      z.literal('interval'),
      z.literal('manual')
    ]).optional(),
    idleSettleMs: z.number().int().min(500).max(60000).optional(),
    maxDeferMs: z.number().int().min(1000).max(600000).optional(),
    intervalMs: z.number().int().min(5000).max(3600000).optional(),
    intervalFallbackMs: fallback.optional(),
    stabilityWindowMs: z.number().int().min(200).max(5000).optional(),
    unclassifiedDir: z.string().optional(),
    archiveRoot: z.string().optional()
  })
  .strict();

const initRequest = z.object({
  watchFolders: z.array(z.string()),
  archiveRoot: z.string(),
  unclassifiedDir: z.string(),
  presets: z.array(draft)
});

const querySpec = z.object({
  keyword: z.string().nullable(),
  presetId: z.number().int().positive().nullable(),
  category: z.string().nullable(),
  status: z
    .union([z.literal('unclassified'), z.literal('archived'), z.literal('held')])
    .nullable(),
  favoriteOnly: z.boolean()
});

const logQuery = z.object({
  action: z
    .union([
      z.literal('archived'),
      z.literal('unclassified'),
      z.literal('failed'),
      z.literal('simulated'),
      z.literal('skipped')
    ])
    .nullable(),
  from: z.number().nullable(),
  to: z.number().nullable(),
  keyword: z.string().nullable()
});

const SCHEMAS: Record<string, z.ZodType<unknown[]>> = {
  getAppInfo: z.tuple([]),
  pickDirectory: z.tuple([z.string().min(1)]),
  openPath: z.tuple([z.string().min(1)]),
  revealPath: z.tuple([z.string().min(1)]),
  getPreferences: z.tuple([]),
  savePreferences: z.tuple([preferencePatch]),
  completeInitialization: z.tuple([initRequest]),
  resetInitialization: z.tuple([]),
  listPresets: z.tuple([]),
  getPreset: z.tuple([z.number().int().positive()]),
  savePreset: z.tuple([draft]),
  deletePreset: z.tuple([z.number().int().positive()]),
  setPresetEnabled: z.tuple([z.number().int().positive(), z.boolean()]),
  listPresetTemplates: z.tuple([]),
  exportPreset: z.tuple([z.number().int().positive()]),
  importPreset: z.tuple([]),
  previewMatch: z.tuple([z.string(), draft.nullable()]),
  suggestPresetFromMaterial: z.tuple([z.number().int().positive()]),
  listUnclassified: z.tuple([]),
  unclassifiedSummary: z.tuple([]),
  releaseHeld: z.tuple([z.number().int().positive()]),
  queryMaterials: z.tuple([querySpec]),
  getMaterialDetail: z.tuple([z.number().int().positive()]),
  listMaterialLogs: z.tuple([z.number().int().positive()]),
  setFavorite: z.tuple([z.number().int().positive(), z.boolean()]),
  computeSha256: z.tuple([z.number().int().positive()]),
  getAgentSnapshot: z.tuple([]),
  getAgentStats: z.tuple([]),
  getLatestRound: z.tuple([]),
  startAgent: z.tuple([]),
  stopAgent: z.tuple([]),
  pauseAgent: z.tuple([]),
  resumeAgent: z.tuple([]),
  setDryRun: z.tuple([z.boolean()]),
  runNow: z.tuple([]),
  queryLogs: z.tuple([logQuery]),
  listRecentLogs: z.tuple([z.number().int().positive()]),
  undoLog: z.tuple([z.number().int().positive()]),
  undoLatest: z.tuple([]),
  getHabitDiagnostics: z.tuple([]),
  reloadHabits: z.tuple([]),
  openUserMd: z.tuple([]),
  revealUserMd: z.tuple([]),
  listHabitObservations: z.tuple([])
};

/** 校验方法名和参数。通过后返回参数数组。 */
export function parseArgs(method: string, args: unknown): unknown[] {
  const schema = SCHEMAS[method];
  if (!schema) {
    throw new Error(`参数非法：${method}`);
  }
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`参数非法：${method}`);
  }
  return parsed.data;
}
