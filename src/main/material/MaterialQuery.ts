/**
 * 把资料行补上预设名、最近原因，以及它是不是还在未分类目录里。
 * 界面只看这种视图，不自己拼路径。
 */
import type {
  AgentStats,
  Material,
  MaterialDetail,
  MaterialView,
  QuerySpec
} from '@shared/types/domain';
import { isPathInside } from '../core/paths';
import { hashFile } from '../system/sha256';
import type {
  AgentLogRepository,
  AgentRoundRepository,
  MaterialRepository,
  PreferenceRepository,
  PresetRepository
} from '../storage/repositories';
import type { AppEvents } from '../core/events';

/** 资料查询、置顶和按需哈希。 */
export class MaterialQuery {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly presets: PresetRepository,
    private readonly logs: AgentLogRepository,
    private readonly rounds: AgentRoundRepository,
    private readonly preferences: PreferenceRepository,
    private readonly events: AppEvents
  ) {}

  /** 未分类和已撤销都出现在未分类页。 */
  async listUnclassified(): Promise<MaterialView[]> {
    return this.toViews(await this.materials.listUnclassifiedAndHeld());
  }

  /** 按扩展名计数，给未分类页上面的汇总。 */
  async unclassifiedSummary(): Promise<Array<{ extension: string; count: number }>> {
    const rows = await this.materials.listByStatus('unclassified');
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.extension === '' ? '(无扩展名)' : row.extension;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([extension, count]) => ({ extension, count }))
      .sort((left, right) => right.count - left.count);
  }

  /** 资料库搜索。 */
  async query(spec: QuerySpec): Promise<MaterialView[]> {
    return this.toViews(await this.materials.query(spec));
  }

  /** 详情：历史记录，以及相同哈希的其它文件。 */
  async detail(id: number): Promise<MaterialDetail | null> {
    const material = await this.materials.getById(id);
    if (!material) {
      return null;
    }
    const [view] = await this.toViews([material]);
    if (!view) {
      return null;
    }
    const logs = await this.logs.listByMaterial(id);
    const duplicates = material.sha256
      ? await this.toViews(await this.materials.findDuplicates(material.sha256, id))
      : [];
    return { ...view, logs, duplicates };
  }

  /** 置顶或取消置顶。 */
  async setFavorite(id: number, favorite: boolean): Promise<void> {
    await this.materials.setFavorite(id, favorite);
    this.events.emit({ type: 'data.changed', scope: 'materials' });
  }

  /** 用户点击后才计算哈希，并写回这一行。 */
  async computeSha256(id: number): Promise<string> {
    const material = await this.materials.getById(id);
    if (!material) {
      throw new Error('资料不存在');
    }
    const digest = await hashFile(material.currentPath);
    await this.materials.setSha256(id, digest);
    this.events.emit({ type: 'data.changed', scope: 'materials' });
    return digest;
  }

  /** 控制台上的计数。今天从本地 0 点算起。 */
  async stats(): Promise<AgentStats> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const since = start.getTime();
    const archived = await this.logs.query({ action: 'archived', from: null, to: null, keyword: null });
    const latest = await this.rounds.latest();
    return {
      archivedToday: await this.logs.countByActionSince('archived', since),
      archivedTotal: await this.logs.countAction('archived'),
      unclassifiedCount: await this.materials.countByStatus('unclassified'),
      heldCount: await this.materials.countByStatus('held'),
      failedToday: await this.logs.countByActionSince('failed', since),
      lastArchivedAt: archived[0]?.createdAt ?? null,
      lastRoundAt: latest?.finishedAt ?? null
    };
  }

  private async toViews(materials: Material[]): Promise<MaterialView[]> {
    const presets = await this.presets.list();
    const prefs = await this.preferences.load();
    const views: MaterialView[] = [];
    for (const material of materials) {
      const preset = presets.find((item) => item.id === material.presetId) ?? null;
      const log = await this.logs.latestByMaterial(material.id);
      const inUnclassifiedDir =
        prefs.unclassifiedDir.trim() !== '' && isPathInside(material.currentPath, prefs.unclassifiedDir);
      views.push({
        ...material,
        presetName: preset?.name ?? null,
        reason: log?.reason ?? null,
        inUnclassifiedDir
      });
    }
    return views;
  }
}
