/**
 * 第一次使用时，把监视目录、归档位置和勾选的预设一次性写进数据库。
 * 这些写入包在同一个事务里：中途失败不会留下「设置写了、预设没写」的半成品。
 */
import type { InitRequest } from '@shared/types/domain';
import type { Preferences } from '@shared/types/preferences';
import type { AppEvents } from '../core/events';
import { assertPresetSavable, assertLocations } from '../preset/presetRules';
import type { Database } from '../storage/sqlite/Database';
import type { SqlitePreferenceRepository } from '../storage/sqlite/SqlitePreferenceRepository';
import type { SqlitePresetRepository } from '../storage/sqlite/SqlitePresetRepository';
import type { AgentService } from '../agent/AgentService';

const INIT_ERROR = '请先选择监视目录、归档位置，并至少启用一个预设';

/** 完成或重置初始化。 */
export class InitializationService {
  constructor(
    private readonly database: Database,
    private readonly preferences: SqlitePreferenceRepository,
    private readonly presets: SqlitePresetRepository,
    private readonly events: AppEvents,
    private readonly agent: AgentService
  ) {}

  /** 校验、写入、必要时启动整理。 */
  async complete(request: InitRequest): Promise<Preferences> {
    this.assertRequest(request);
    const current = await this.preferences.load();
    const existing = await this.presets.list();
    const names = new Set(existing.map((preset) => preset.name));
    const next: Preferences = {
      ...current,
      initialized: true,
      watchFolders: [...request.watchFolders],
      archiveRoot: request.archiveRoot,
      unclassifiedDir: request.unclassifiedDir
    };
    this.database.transaction(() => {
      this.preferences.writeNow(next);
      for (const draft of request.presets) {
        if (names.has(draft.name)) {
          continue;
        }
        this.presets.insertNow(draft);
      }
    });
    this.events.emit({ type: 'data.changed', scope: 'preferences' });
    this.events.emit({ type: 'data.changed', scope: 'presets' });
    await this.agent.applyPreferences(next);
    if (next.agentEnabled) {
      await this.agent.start();
    }
    return next;
  }

  /** 回到初始化页。不删除预设和资料，只停掉整理。 */
  async reset(): Promise<void> {
    this.agent.stop();
    const saved = await this.preferences.save({ initialized: false });
    await this.agent.applyPreferences(saved);
    this.events.emit({ type: 'data.changed', scope: 'preferences' });
  }

  private assertRequest(request: InitRequest): void {
    const enabled = request.presets.some((preset) => preset.enabled);
    if (
      request.watchFolders.length === 0 ||
      request.archiveRoot.trim() === '' ||
      request.unclassifiedDir.trim() === '' ||
      request.presets.length === 0 ||
      !enabled
    ) {
      throw new Error(INIT_ERROR);
    }
    const targets: string[] = [];
    for (const draft of request.presets) {
      assertPresetSavable(draft, {
        watchFolders: request.watchFolders,
        unclassifiedDir: request.unclassifiedDir,
        otherTargetDirs: targets
      });
      targets.push(draft.targetDir);
    }
    assertLocations({
      watchFolders: request.watchFolders,
      unclassifiedDir: request.unclassifiedDir,
      targetDirs: targets
    });
  }
}
