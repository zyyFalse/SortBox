import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileActionError } from '../../src/main/agent/move';
import { resolveArchivePath } from '../../src/main/preset/TemplatePathResolver';
import { listBuiltinTemplates } from '../../src/main/preset/builtinTemplates';
import { samplePreset } from '../helpers/presetFixture';

const preset = samplePreset({
  id: 1,
  name: '发票',
  targetDir: path.join('C:', 'archive', '发票'),
  pathLayout: '{yyyy-MM}/{origFileName}'
});

describe('TemplatePathResolver', (): void => {
  it('默认模板按年月和原文件名展开', (): void => {
    const target = resolveArchivePath({
      preset,
      sourceFileName: 'a.pdf',
      archiveDate: new Date(2024, 2, 15)
    });
    expect(target).toBe(path.resolve(preset.targetDir, '2024-03', 'a.pdf'));
  });

  it('文件名里的日期优先于归档日', (): void => {
    const dated = { ...preset, pathLayout: '{fileDate}/{origFileName}' };
    const target = resolveArchivePath({
      preset: dated,
      sourceFileName: '发票2024-03-15.pdf',
      archiveDate: new Date(2026, 0, 2)
    });
    expect(target).toContain(`${path.sep}2024-03-15${path.sep}`);
  });

  it('文件名没有日期时回落归档日', (): void => {
    const dated = { ...preset, pathLayout: '{fileDate}/{origFileName}' };
    const target = resolveArchivePath({
      preset: dated,
      sourceFileName: '发票.pdf',
      archiveDate: new Date(2026, 0, 2)
    });
    expect(target).toContain(`${path.sep}2026-01-02${path.sep}`);
  });

  it('预设名可以放进路径', (): void => {
    const named = { ...preset, pathLayout: '{preset}/{origFileName}' };
    const target = resolveArchivePath({
      preset: named,
      sourceFileName: 'a.pdf',
      archiveDate: new Date(2024, 0, 1)
    });
    expect(target).toContain(`${path.sep}发票${path.sep}`);
  });

  it('目录模板跳出目标目录时抛越界', (): void => {
    const escaped = { ...preset, pathLayout: '../{origFileName}' };
    expect(() =>
      resolveArchivePath({ preset: escaped, sourceFileName: 'a.pdf', archiveDate: new Date(2024, 0, 1) })
    ).toThrow(FileActionError);
    try {
      resolveArchivePath({ preset: escaped, sourceFileName: 'a.pdf', archiveDate: new Date(2024, 0, 1) });
    } catch (error) {
      expect(error).toBeInstanceOf(FileActionError);
      expect((error as FileActionError).message).toBe('归档路径越界');
    }
  });

  it('保留设备名会加上下划线前缀', (): void => {
    const target = resolveArchivePath({
      preset: { ...preset, pathLayout: '{origFileName}' },
      sourceFileName: 'CON.txt',
      archiveDate: new Date(2024, 0, 1)
    });
    expect(path.basename(target)).toBe('_CON.txt');
  });

  it('不认识的占位符原样保留', (): void => {
    const target = resolveArchivePath({
      preset: { ...preset, pathLayout: '{未知}/{origFileName}' },
      sourceFileName: 'a.pdf',
      archiveDate: new Date(2024, 0, 1)
    });
    expect(target).toContain('{未知}');
  });

  it('正反斜杠都会收成当前系统的分隔符', (): void => {
    const target = resolveArchivePath({
      preset: { ...preset, pathLayout: '{yyyy-MM}\\{origFileName}' },
      sourceFileName: 'a.pdf',
      archiveDate: new Date(2024, 2, 1)
    });
    expect(target).toBe(path.resolve(preset.targetDir, '2024-03', 'a.pdf'));
  });

  it('内置模板有 8 条', (): void => {
    const templates = listBuiltinTemplates();
    expect(templates).toHaveLength(8);
    expect(templates.some((item) => item.name === '发票')).toBe(true);
  });
});
