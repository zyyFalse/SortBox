import { describe, expect, it } from 'vitest';
import { deletionError } from '../../src/main/preset/presetRules';
import { Database } from '../../src/main/storage/sqlite/Database';
import { SqliteAgentLogRepository } from '../../src/main/storage/sqlite/SqliteAgentLogRepository';
import { SqliteHabitRepository } from '../../src/main/storage/sqlite/SqliteHabitRepository';
import { SqliteMaterialRepository } from '../../src/main/storage/sqlite/SqliteMaterialRepository';
import { SqlitePreferenceRepository } from '../../src/main/storage/sqlite/SqlitePreferenceRepository';
import { SqlitePresetRepository } from '../../src/main/storage/sqlite/SqlitePresetRepository';
import { sampleDraft } from '../helpers/presetFixture';

function open(): Database {
  return new Database(':memory:');
}

describe('sqlite repositories', (): void => {
  it('迁移后有七张表', (): void => {
    const db = open();
    const rows = db.raw.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{
      name: string;
    }>;
    const names = rows.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining(['meta', 'preference', 'preset', 'material', 'agent_round', 'agent_log', 'habit_observation'])
    );
  });

  it('同一 path_key 只保留一行', async (): Promise<void> => {
    const materials = new SqliteMaterialRepository(open());
    const first = await materials.upsertSeen({
      fileName: 'a.pdf',
      currentPath: 'C:/down/a.pdf',
      pathKey: 'c:/down/a.pdf',
      originPath: 'C:/down/a.pdf',
      extension: 'pdf',
      sizeBytes: 1,
      modifiedAt: 1
    });
    const second = await materials.upsertSeen({
      fileName: 'b.pdf',
      currentPath: 'C:/down/a.pdf',
      pathKey: 'c:/down/a.pdf',
      originPath: 'C:/down/a.pdf',
      extension: 'pdf',
      sizeBytes: 2,
      modifiedAt: 2
    });
    expect(second.id).toBe(first.id);
    expect(second.fileName).toBe('b.pdf');
  });

  it('保存预设后能读回扩展名和文件名条件', async (): Promise<void> => {
    const presets = new SqlitePresetRepository(open());
    const saved = await presets.save(sampleDraft('发票'));
    const loaded = await presets.getById(saved.id);
    expect(loaded?.extensions).toBe('pdf');
    expect(loaded?.nameIncludes).toBe('发票');
  });

  it('归档之后计数为 1，删除仍有资料时给出中文错误', async (): Promise<void> => {
    const db = open();
    const presets = new SqlitePresetRepository(db);
    const materials = new SqliteMaterialRepository(db);
    const saved = await presets.save(sampleDraft('发票'));
    const material = await materials.upsertSeen({
      fileName: 'a.pdf',
      currentPath: 'C:/down/a.pdf',
      pathKey: 'c:/down/a.pdf',
      originPath: 'C:/down/a.pdf',
      extension: 'pdf',
      sizeBytes: 1,
      modifiedAt: 1
    });
    await materials.markArchived(material.id, {
      presetId: saved.id,
      currentPath: 'C:/archive/a.pdf',
      pathKey: 'c:/archive/a.pdf',
      category: '文档',
      archivedAt: 2,
      fileName: 'a.pdf'
    });
    expect(await presets.countArchived(saved.id)).toBe(1);
    expect(deletionError(1)).toBe('不能删除仍有资料的预设');
    await presets.delete(saved.id);
    expect((await materials.getById(material.id))?.presetId).toBeNull();
  });

  it('未分类列表只含未分类和已撤销', async (): Promise<void> => {
    const db = open();
    const preset = await new SqlitePresetRepository(db).save(sampleDraft('文档'));
    const materials = new SqliteMaterialRepository(db);
    const plain = await materials.upsertSeen({
      fileName: 'a.pdf',
      currentPath: 'C:/down/a.pdf',
      pathKey: 'a',
      originPath: 'C:/down/a.pdf',
      extension: 'pdf',
      sizeBytes: 1,
      modifiedAt: 1
    });
    const held = await materials.upsertSeen({
      fileName: 'b.pdf',
      currentPath: 'C:/down/b.pdf',
      pathKey: 'b',
      originPath: 'C:/down/b.pdf',
      extension: 'pdf',
      sizeBytes: 1,
      modifiedAt: 1
    });
    const archived = await materials.upsertSeen({
      fileName: 'c.pdf',
      currentPath: 'C:/down/c.pdf',
      pathKey: 'c',
      originPath: 'C:/down/c.pdf',
      extension: 'pdf',
      sizeBytes: 1,
      modifiedAt: 1
    });
    await materials.markHeld(held.id, { currentPath: 'C:/down/b.pdf', pathKey: 'b', fileName: 'b.pdf' });
    await materials.markArchived(archived.id, {
      presetId: preset.id,
      currentPath: 'C:/archive/c.pdf',
      pathKey: 'c2',
      category: '文档',
      archivedAt: 3,
      fileName: 'c.pdf'
    });
    const listed = await materials.listUnclassifiedAndHeld();
    expect(listed.map((item) => item.id).sort()).toEqual([plain.id, held.id].sort());
  });

  it('日志可以标记为已撤销', async (): Promise<void> => {
    const logs = new SqliteAgentLogRepository(open());
    const created = await logs.append({
      roundId: 1,
      materialId: null,
      presetId: null,
      action: 'archived',
      fromPath: 'C:/down/a.pdf',
      toPath: 'C:/archive/a.pdf',
      reason: '归档',
      trace: 'trace',
      durationMs: 3,
      dryRun: false,
      createdAt: 4,
      undone: false,
      undoneAt: null
    });
    await logs.markUndone(created.id, 9);
    expect((await logs.getById(created.id))?.undone).toBe(true);
  });

  it('偏好缺字段时回到默认值', async (): Promise<void> => {
    const db = open();
    db.raw.prepare(`INSERT INTO preference (key, value) VALUES ('agentDryRun', 'true')`).run();
    const prefs = await new SqlitePreferenceRepository(db).load();
    expect(prefs.agentDryRun).toBe(true);
    expect(prefs.triggerPolicy).toBe('idle');
    expect(prefs.idleSettleMs).toBe(3000);
  });

  it('同一习惯观测第二次后 hits 为 2', async (): Promise<void> => {
    const db = open();
    const preset = await new SqlitePresetRepository(db).save(sampleDraft('发票'));
    const habits = new SqliteHabitRepository(db);
    await habits.record({ featureKind: 'token', featureValue: '发票', presetId: preset.id, polarity: 'positive', at: 1 });
    await habits.record({ featureKind: 'token', featureValue: '发票', presetId: preset.id, polarity: 'positive', at: 2 });
    const rows = await habits.listAll();
    expect(rows[0]?.hits).toBe(2);
  });
});
