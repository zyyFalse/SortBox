import { describe, expect, it } from 'vitest';
import { matchPreset } from '../../src/main/preset/PresetMatcher';
import { samplePreset } from '../helpers/presetFixture';

const invoice = samplePreset({
  id: 1,
  name: '发票',
  extensions: 'pdf,png,jpg',
  nameIncludes: '发票,invoice',
  priority: 50
});
const document = samplePreset({
  id: 2,
  name: '文档',
  extensions: 'pdf,doc,docx,txt,md',
  priority: 100
});
const image = samplePreset({
  id: 3,
  name: '图片',
  extensions: 'png,jpg,jpeg',
  priority: 100
});

describe('PresetMatcher', (): void => {
  it('发票文件名优先于仅类型的文档', (): void => {
    const result = matchPreset({ fileName: '发票-3月.pdf', sizeBytes: 10, extension: 'pdf' }, [invoice, document]);
    expect(result.presetId).toBe(1);
    expect(result.tier).toBe('name-and-type');
  });

  it('没有名字命中时按类型交给文档', (): void => {
    const result = matchPreset({ fileName: 'readme.pdf', sizeBytes: 10, extension: 'pdf' }, [invoice, document]);
    expect(result.tier).toBe('type');
    expect(result.reason).toBe('类型 .pdf 由预设「文档」接收');
  });

  it('图片扩展名命中图片预设', (): void => {
    const result = matchPreset({ fileName: 'a.png', sizeBytes: 10, extension: 'png' }, [image, document]);
    expect(result.presetId).toBe(3);
  });

  it('只限制名字时任意扩展名都能命中', (): void => {
    const named = samplePreset({ id: 4, name: '笔记', nameIncludes: '笔记', extensions: null });
    const result = matchPreset({ fileName: '笔记.zip', sizeBytes: 10, extension: 'zip' }, [named]);
    expect(result.tier).toBe('name');
    expect(result.presetId).toBe(4);
  });

  it('发票预设不接收普通 pdf', (): void => {
    const result = matchPreset({ fileName: 'notes.pdf', sizeBytes: 10, extension: 'pdf' }, [invoice]);
    expect(result.tier).toBe('none');
  });

  it('同为仅类型时优先级数字更小的胜出', (): void => {
    const tight = samplePreset({ id: 8, name: '紧', extensions: 'pdf', priority: 10 });
    const loose = samplePreset({ id: 9, name: '松', extensions: 'pdf', priority: 100 });
    const result = matchPreset({ fileName: 'a.pdf', sizeBytes: 10, extension: 'pdf' }, [loose, tight]);
    expect(result.presetId).toBe(8);
  });

  it('同层同优先级时更长的文件名片段胜出', (): void => {
    const short = samplePreset({ id: 1, name: '短', nameIncludes: '发票', extensions: 'pdf', priority: 40 });
    const long = samplePreset({ id: 2, name: '长', nameIncludes: '发票申请', extensions: 'pdf', priority: 40 });
    const result = matchPreset({ fileName: '发票申请.pdf', sizeBytes: 10, extension: 'pdf' }, [short, long]);
    expect(result.presetId).toBe(2);
  });

  it('同层同优先级同长度时 id 更小者胜出', (): void => {
    const later = samplePreset({ id: 5, name: '后', nameIncludes: '发票', extensions: 'pdf', priority: 40 });
    const earlier = samplePreset({ id: 2, name: '先', nameIncludes: '发票', extensions: 'pdf', priority: 40 });
    const result = matchPreset({ fileName: '发票.pdf', sizeBytes: 10, extension: 'pdf' }, [later, earlier]);
    expect(result.presetId).toBe(2);
  });

  it('排除词命中则该预设淘汰', (): void => {
    const blocked = samplePreset({
      id: 1,
      name: '发票',
      nameIncludes: '发票',
      nameExcludes: '作废',
      extensions: 'pdf'
    });
    const result = matchPreset({ fileName: '发票作废.pdf', sizeBytes: 10, extension: 'pdf' }, [blocked, document]);
    expect(result.presetId).toBe(2);
  });

  it('超过大小上限则淘汰', (): void => {
    const limited = samplePreset({ id: 1, name: '小图', extensions: 'png', maxSizeMb: 1 });
    const result = matchPreset({ fileName: 'a.png', sizeBytes: 2 * 1024 * 1024, extension: 'png' }, [limited]);
    expect(result.tier).toBe('none');
  });

  it('单字片段不参与匹配', (): void => {
    const tiny = samplePreset({ id: 1, name: '单', nameIncludes: '发', extensions: null });
    const result = matchPreset({ fileName: '发票.pdf', sizeBytes: 10, extension: 'pdf' }, [tiny]);
    expect(result.tier).toBe('none');
  });

  it('停用的预设不参与', (): void => {
    const disabled = samplePreset({ id: 1, name: '发票', nameIncludes: '发票', extensions: 'pdf', enabled: false });
    const result = matchPreset({ fileName: '发票.pdf', sizeBytes: 10, extension: 'pdf' }, [disabled]);
    expect(result.tier).toBe('none');
  });

  it('没有命中时说明无预设命中', (): void => {
    const result = matchPreset({ fileName: 'a.bin', sizeBytes: 10, extension: 'bin' }, [document]);
    expect(result.tier).toBe('none');
    expect(result.reason).toBe('无预设命中');
  });

  it('同层多个候选时原因里写明候选数', (): void => {
    const left = samplePreset({ id: 1, name: '甲', extensions: 'pdf', priority: 20 });
    const right = samplePreset({ id: 2, name: '乙', extensions: 'pdf', priority: 30 });
    const result = matchPreset({ fileName: 'a.pdf', sizeBytes: 10, extension: 'pdf' }, [left, right]);
    expect(result.reason).toContain('同层 2 个候选');
  });

  it('文件名开头和结尾也能命中', (): void => {
    const starts = samplePreset({ id: 1, name: '报告', nameStarts: '周报', extensions: 'pdf' });
    const ends = samplePreset({ id: 2, name: '扫描', nameEnds: '扫描件', extensions: null });
    expect(matchPreset({ fileName: '周报-1.pdf', sizeBytes: 1, extension: 'pdf' }, [starts]).hitKind).toBe('starts');
    expect(matchPreset({ fileName: '合同扫描件.txt', sizeBytes: 1, extension: 'txt' }, [ends]).hitKind).toBe('ends');
  });
});
