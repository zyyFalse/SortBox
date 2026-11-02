/**
 * 预设的保存、删除、试命中和建议。
 * 匹配算法在 PresetMatcher 里，这里只负责把草稿放进列表再调用它。
 */
import type { MatchResult, Preset, PresetDraft, PresetTemplate } from '@shared/types/domain';
import type { AppEvents } from '../core/events';
import { fileExtension, suggestPresetDraft } from '../model/naming';
import type { MaterialRepository, PreferenceRepository, PresetRepository } from '../storage/repositories';
import { decideDisposition } from '../userpref/evaluateHabits';
import type { UserHabitSet } from '../userpref/UserHabitSet';
import type { AgentService } from '../agent/AgentService';
import { listBuiltinTemplates } from './builtinTemplates';
import { matchPreset } from './PresetMatcher';
import { assertPresetSavable, deletionError, type PresetSaveContext } from './presetRules';

function toPreset(draft: PresetDraft, id: number): Preset {
  return {
    id,
    name: draft.name,
    extensions: draft.extensions,
    nameIncludes: draft.nameIncludes,
    nameStarts: draft.nameStarts,
    nameEnds: draft.nameEnds,
    nameExcludes: draft.nameExcludes,
    targetDir: draft.targetDir,
    pathLayout: draft.pathLayout,
    priority: draft.priority,
    enabled: draft.enabled,
    maxSizeMb: draft.maxSizeMb,
    createdAt: 0,
    updatedAt: 0
  };
}

/** 预设管理。保存和删除之后会把未分类、已撤销再判一次。 */
export class PresetAdmin {
  constructor(
    private readonly presets: PresetRepository,
    private readonly materials: MaterialRepository,
    private readonly preferences: PreferenceRepository,
    private readonly habits: UserHabitSet,
    private readonly events: AppEvents,
    private readonly agent: AgentService
  ) {}

  /** 内置的 8 个模板。 */
  listTemplates(): Promise<PresetTemplate[]> {
    return Promise.resolve(listBuiltinTemplates());
  }

  /** 保存前校验目录和字段，成功后重评已搁置的文件。 */
  async save(draft: PresetDraft): Promise<Preset> {
    const context = await this.contextFor(draft.id);
    assertPresetSavable(draft, context);
    const saved = await this.presets.save(draft);
    this.events.emit({ type: 'data.changed', scope: 'presets' });
    await this.agent.reevaluateParked();
    return saved;
  }

  /** 仍有已归档资料时拒绝删除。 */
  async remove(id: number): Promise<void> {
    const count = await this.presets.countArchived(id);
    const message = deletionError(count);
    if (message) {
      throw new Error(message);
    }
    await this.presets.delete(id);
    this.events.emit({ type: 'data.changed', scope: 'presets' });
    await this.agent.reevaluateParked();
  }

  /** 启用或停用，然后重评。 */
  async setEnabled(id: number, enabled: boolean): Promise<void> {
    await this.presets.setEnabled(id, enabled);
    this.events.emit({ type: 'data.changed', scope: 'presets' });
    await this.agent.reevaluateParked();
  }

  /**
   * 试命中不移动文件。
   * 草稿有 id 就替换同 id 的预设，没有 id 就当成 id = -1 的临时预设。
   * 大小固定按 1 字节，这样大小上限不会在预览里误伤。
   */
  async preview(fileName: string, draft: PresetDraft | null): Promise<MatchResult> {
    const enabled = await this.presets.listEnabled();
    const working = enabled.map((preset) => ({ ...preset }));
    if (draft) {
      const id = draft.id ?? -1;
      const standIn = toPreset(draft, id);
      const index = working.findIndex((preset) => preset.id === id);
      if (index >= 0) {
        working[index] = standIn;
      } else {
        working.push(standIn);
      }
    }
    const extension = fileExtension(fileName);
    const match = matchPreset({ fileName, sizeBytes: 1, extension }, working);
    const disposition = decideDisposition({
      fileName,
      extension,
      sizeBytes: 1,
      match,
      habits: this.habits.current(),
      presets: working
    });
    if (disposition.source !== 'habit') {
      return match;
    }
    return {
      presetId: disposition.presetId,
      tier: 'habit',
      hitToken: disposition.hitToken,
      hitKind: disposition.hitToken ? 'includes' : 'none',
      reason: disposition.reason,
      trace: disposition.trace,
      candidateCount: match.candidateCount
    };
  }

  /** 按某个未分类文件的名字建议草稿，不写入数据库。 */
  async suggestFromMaterial(materialId: number): Promise<PresetDraft> {
    const material = await this.materials.getById(materialId);
    if (!material) {
      throw new Error('资料不存在');
    }
    const prefs = await this.preferences.load();
    const all = await this.presets.list();
    return suggestPresetDraft(
      material.fileName,
      material.extension,
      prefs.archiveRoot,
      all.map((preset) => preset.targetDir),
      prefs.unclassifiedDir,
      prefs.watchFolders
    );
  }

  private async contextFor(selfId: number | null): Promise<PresetSaveContext> {
    const prefs = await this.preferences.load();
    const all = await this.presets.list();
    const otherTargetDirs = all
      .filter((preset) => preset.id !== selfId)
      .map((preset) => preset.targetDir);
    return {
      watchFolders: prefs.watchFolders,
      unclassifiedDir: prefs.unclassifiedDir,
      otherTargetDirs
    };
  }
}
