/**
 * 预设的导入和导出。
 * 导出写成 JSON 文件。导入只读成草稿，不直接入库，等人在详情页点保存。
 */
import type { PresetDraft } from '@shared/types/domain';
import type { PresetRepository } from '../storage/repositories';
import { readTextFile, writeTextFile } from '../system/textIo';
import { pickJsonFile, pickSaveJson } from '../system/shellActions';

function asDraft(value: unknown): PresetDraft | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.name !== 'string' || typeof row.targetDir !== 'string' || typeof row.pathLayout !== 'string') {
    return null;
  }
  return {
    id: null,
    name: row.name,
    extensions: typeof row.extensions === 'string' ? row.extensions : null,
    nameIncludes: typeof row.nameIncludes === 'string' ? row.nameIncludes : null,
    nameStarts: typeof row.nameStarts === 'string' ? row.nameStarts : null,
    nameEnds: typeof row.nameEnds === 'string' ? row.nameEnds : null,
    nameExcludes: typeof row.nameExcludes === 'string' ? row.nameExcludes : null,
    targetDir: row.targetDir,
    pathLayout: row.pathLayout,
    priority: typeof row.priority === 'number' ? row.priority : 40,
    enabled: row.enabled !== false,
    maxSizeMb: typeof row.maxSizeMb === 'number' ? row.maxSizeMb : 0
  };
}

/** 导入导出预设 JSON。 */
export class PresetTransfer {
  constructor(private readonly presets: PresetRepository) {}

  /** 弹出保存对话框并写入。取消返回 null。 */
  async exportPreset(id: number): Promise<string | null> {
    const preset = await this.presets.getById(id);
    if (!preset) {
      throw new Error('预设不存在');
    }
    const target = await pickSaveJson('导出预设', `${preset.name}.json`);
    if (!target) {
      return null;
    }
    const body = {
      name: preset.name,
      extensions: preset.extensions,
      nameIncludes: preset.nameIncludes,
      nameStarts: preset.nameStarts,
      nameEnds: preset.nameEnds,
      nameExcludes: preset.nameExcludes,
      targetDir: preset.targetDir,
      pathLayout: preset.pathLayout,
      priority: preset.priority,
      enabled: preset.enabled,
      maxSizeMb: preset.maxSizeMb
    };
    writeTextFile(target, JSON.stringify(body, null, 2));
    return target;
  }

  /** 弹出打开对话框，把 JSON 变成还没保存的草稿。 */
  async importPreset(): Promise<PresetDraft | null> {
    const filePath = await pickJsonFile('导入预设');
    if (!filePath) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readTextFile(filePath)) as unknown;
    } catch {
      throw new Error('预设文件无法解析');
    }
    const draft = asDraft(parsed);
    if (!draft) {
      throw new Error('预设文件无法解析');
    }
    return draft;
  }
}
