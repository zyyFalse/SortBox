import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../../src/main/storage/sqlite/Database';
import { SqliteHabitRepository } from '../../src/main/storage/sqlite/SqliteHabitRepository';
import { SqlitePresetRepository } from '../../src/main/storage/sqlite/SqlitePresetRepository';
import { HabitLearner, shouldObserveArchive } from '../../src/main/userpref/HabitLearner';
import { UserHabitSet } from '../../src/main/userpref/UserHabitSet';
import {
  ensureHabitFile,
  parseHabitDocument,
  readHabitText,
  USER_MD_TEMPLATE,
  writeHabitTextAtomic
} from '../../src/main/userpref/userMarkdown';
import { sampleDraft } from '../helpers/presetFixture';

function workspace(): { file: string; db: Database } {
  const dir = mkdtempSync(path.join(tmpdir(), 'sortbox-habit-'));
  const file = path.join(dir, 'user.md');
  ensureHabitFile(file);
  return { file, db: new Database(':memory:') };
}

describe('HabitLearner', (): void => {
  it('一次名字归档后还不写自动习惯', async (): Promise<void> => {
    const { file, db } = workspace();
    const presets = new SqlitePresetRepository(db);
    const saved = await presets.save(sampleDraft('发票'));
    const learner = new HabitLearner(new SqliteHabitRepository(db), presets, file, new UserHabitSet(file));
    await learner.observeArchive('发票', saved.id, 1);
    await learner.reconcile(1_700_000_000_000);
    expect(parseHabitDocument(readHabitText(file)).rules.some((rule) => rule.auto)).toBe(false);
  });

  it('第二次肯定后写出自动习惯并保留手写行', async (): Promise<void> => {
    const { file, db } = workspace();
    writeHabitTextAtomic(
      file,
      USER_MD_TEMPLATE.replace(
        '<!-- sortbox:habits:end -->',
        '习惯  文件名含 "手写"  -> 发票\n<!-- sortbox:habits:end -->'
      )
    );
    const presets = new SqlitePresetRepository(db);
    const saved = await presets.save(sampleDraft('发票'));
    const learner = new HabitLearner(new SqliteHabitRepository(db), presets, file, new UserHabitSet(file));
    await learner.observeArchive('发票', saved.id, 1);
    await learner.observeArchive('发票', saved.id, 2);
    await learner.reconcile(1_700_000_000_000);
    const text = readHabitText(file);
    expect(text).toContain('# auto');
    expect(text).toContain('手写');
  });

  it('类型预设归档不增加观测', (): void => {
    expect(
      shouldObserveArchive({ dryRun: false, source: 'preset', tier: 'type', hitToken: 'pdf' })
    ).toBe(false);
  });

  it('试运行不增加观测', (): void => {
    expect(
      shouldObserveArchive({ dryRun: true, source: 'preset', tier: 'name', hitToken: '发票' })
    ).toBe(false);
  });

  it('两次否定后删除自动行并留下已移除', async (): Promise<void> => {
    const { file, db } = workspace();
    writeHabitTextAtomic(
      file,
      USER_MD_TEMPLATE.replace(
        '<!-- sortbox:habits:end -->',
        '习惯  文件名含 "发票"  -> 发票          # auto\n<!-- sortbox:habits:end -->'
      )
    );
    const presets = new SqlitePresetRepository(db);
    const saved = await presets.save(sampleDraft('发票'));
    const learner = new HabitLearner(new SqliteHabitRepository(db), presets, file, new UserHabitSet(file));
    await learner.observeUndo('发票', saved.id, 1);
    await learner.observeUndo('发票', saved.id, 2);
    await learner.reconcile(1_700_000_000_000);
    const text = readHabitText(file);
    expect(parseHabitDocument(text).rules.some((rule) => rule.auto)).toBe(false);
    expect(text).toContain('已移除');
  });

  it('解析失败时不覆盖文件', async (): Promise<void> => {
    const { file, db } = workspace();
    const broken = USER_MD_TEMPLATE.replace(
      '<!-- sortbox:habits:end -->',
      '习惯  文件名含 发票  -> 发票\n<!-- sortbox:habits:end -->'
    );
    writeHabitTextAtomic(file, broken);
    const presets = new SqlitePresetRepository(db);
    const saved = await presets.save(sampleDraft('发票'));
    const learner = new HabitLearner(new SqliteHabitRepository(db), presets, file, new UserHabitSet(file));
    await learner.observeArchive('发票', saved.id, 1);
    await learner.observeArchive('发票', saved.id, 2);
    await learner.reconcile(1_700_000_000_000);
    expect(readHabitText(file)).toBe(broken);
    expect(parseHabitDocument(readHabitText(file)).rules).toEqual([]);
  });
});
