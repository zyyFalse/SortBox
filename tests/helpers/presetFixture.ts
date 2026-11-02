import type { Preset, PresetDraft } from '@shared/types/domain';

/** 测试里的一条预设。缺的字段用不会误伤匹配的默认值。 */
export function samplePreset(patch: Partial<Preset> & Pick<Preset, 'id' | 'name'>): Preset {
  return {
    extensions: null,
    nameIncludes: null,
    nameStarts: null,
    nameEnds: null,
    nameExcludes: null,
    targetDir: `C:/archive/${patch.name}`,
    pathLayout: '{yyyy-MM}/{origFileName}',
    priority: 100,
    enabled: true,
    maxSizeMb: 0,
    createdAt: 1,
    updatedAt: 1,
    ...patch
  };
}

/** 还没入库的草稿。 */
export function sampleDraft(name: string): PresetDraft {
  return {
    id: null,
    name,
    extensions: 'pdf',
    nameIncludes: name,
    nameStarts: null,
    nameEnds: null,
    nameExcludes: null,
    targetDir: `C:/archive/${name}`,
    pathLayout: '{yyyy-MM}/{origFileName}',
    priority: 40,
    enabled: true,
    maxSizeMb: 0
  };
}
