import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldSkipUnchangedFailure } from '../../src/main/agent/intake';
import {
  extractFileDateFromName,
  suggestNameToken,
  suggestPresetDraft,
  unclassifiedRelativeName,
  withSuffix
} from '../../src/main/model/naming';

describe('naming', (): void => {
  it('在最后一个扩展名前插入序号', (): void => {
    expect(withSuffix('a.pdf', 2)).toBe('a_2.pdf');
    expect(withSuffix('archive.tar.gz', 2)).toBe('archive.tar_2.gz');
    expect(withSuffix('readme', 2)).toBe('readme_2');
  });

  it('从文件名提取完整日期，非法月份则放弃这一处', (): void => {
    expect(extractFileDateFromName('发票2024-03-15.pdf')).toBe('2024-03-15');
    expect(extractFileDateFromName('报告2024-13-01.pdf')).toBeNull();
  });

  it('建议用有区分度的片段，纯日期则没有', (): void => {
    expect(suggestNameToken('发票-3月.pdf')).toBe('发票');
    expect(suggestNameToken('2024-03-15.pdf')).toBeNull();
  });

  it('上次失败且大小和时间都没变时跳过', (): void => {
    expect(
      shouldSkipUnchangedFailure({
        latestAction: 'failed',
        latestReason: '失败',
        sizeUnchanged: true,
        mtimeUnchanged: true
      })
    ).toBe(true);
    expect(
      shouldSkipUnchangedFailure({
        latestAction: 'failed',
        latestReason: '失败',
        sizeUnchanged: true,
        mtimeUnchanged: false
      })
    ).toBe(false);
  });

  it('没有扩展名时未分类相对路径使用 noext', (): void => {
    expect(unclassifiedRelativeName('', 'README')).toBe('noext/README');
    expect(unclassifiedRelativeName('PDF', 'a.PDF')).toBe('pdf/a.PDF');
  });

  it('能根据已有归档目录建议目标，重叠时留空', (): void => {
    const root = path.resolve('C:/archive');
    const suggested = suggestPresetDraft('发票.pdf', 'pdf', root, [], path.join(root, '_未分类'), []);
    expect(suggested.name).toBe('发票');
    expect(suggested.targetDir).toContain('发票');
    const blocked = suggestPresetDraft(
      '发票.pdf',
      'pdf',
      root,
      [path.join(root, '发票')],
      path.join(root, '_未分类'),
      []
    );
    expect(blocked.targetDir).toBe('');
    const fromRoot = suggestPresetDraft('合同.pdf', 'pdf', root, [], '', []);
    expect(fromRoot.targetDir).toContain('合同');
    const empty = suggestPresetDraft('合同.pdf', 'pdf', '', [], '   ', []);
    expect(empty.targetDir).toBe('');
    const watched = suggestPresetDraft('合同.pdf', 'pdf', root, [], '', [path.join(root, '合同')]);
    expect(watched.targetDir).toBe('');
  });
});
