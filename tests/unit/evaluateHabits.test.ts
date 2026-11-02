import { describe, expect, it } from 'vitest';
import type { HabitRule, MatchResult } from '@shared/types/domain';
import { decideDisposition, stalePresetNames } from '../../src/main/userpref/evaluateHabits';
import { matchPreset } from '../../src/main/preset/PresetMatcher';
import { samplePreset } from '../helpers/presetFixture';

const invoice = samplePreset({
  id: 1,
  name: '发票',
  extensions: 'pdf',
  nameIncludes: '发票',
  priority: 50
});
const document = samplePreset({
  id: 2,
  name: '文档',
  extensions: 'pdf,txt',
  priority: 100
});

function habit(patch: Partial<HabitRule> & Pick<HabitRule, 'presetName' | 'kind'>): HabitRule {
  return {
    lineNumber: 1,
    token: null,
    extensions: [],
    auto: false,
    raw: '',
    ...patch
  };
}

function matched(fileName: string, extension: string): MatchResult {
  return matchPreset({ fileName, sizeBytes: 10, extension }, [invoice, document]);
}

describe('decideDisposition', (): void => {
  it('名字层命中时忽略习惯', (): void => {
    const result = decideDisposition({
      fileName: '发票.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matched('发票.pdf', 'pdf'),
      habits: [habit({ kind: 'token', token: '别的', presetName: '文档' })],
      presets: [invoice, document]
    });
    expect(result.source).toBe('preset');
    expect(result.tier).toBe('name-and-type');
  });

  it('仅类型时改用文件名习惯', (): void => {
    const result = decideDisposition({
      fileName: '备注发票.txt',
      extension: 'txt',
      sizeBytes: 10,
      match: matchPreset({ fileName: '备注发票.txt', sizeBytes: 10, extension: 'txt' }, [document]),
      habits: [habit({ kind: 'token', token: '发票', presetName: '发票', lineNumber: 3 })],
      presets: [invoice, document]
    });
    expect(result.source).toBe('habit');
    expect(result.reason).toBe('无具体名字预设，按整理习惯归入预设「发票」：文件名含「发票」');
  });

  it('没有习惯时仍用类型预设', (): void => {
    const result = decideDisposition({
      fileName: 'readme.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matched('readme.pdf', 'pdf'),
      habits: [],
      presets: [invoice, document]
    });
    expect(result.presetId).toBe(2);
    expect(result.source).toBe('preset');
  });

  it('扩展名习惯可以命中', (): void => {
    const result = decideDisposition({
      fileName: 'a.txt',
      extension: 'txt',
      sizeBytes: 10,
      match: matchPreset({ fileName: 'a.txt', sizeBytes: 10, extension: 'txt' }, [document]),
      habits: [habit({ kind: 'extension', extensions: ['txt'], presetName: '发票' })],
      presets: [invoice, document]
    });
    expect(result.source).toBe('habit');
    expect(result.reason).toContain('扩展名 .txt');
  });

  it('习惯指向未启用预设时落到类型预设', (): void => {
    const disabled = { ...invoice, enabled: false };
    const result = decideDisposition({
      fileName: 'readme.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matchPreset({ fileName: 'readme.pdf', sizeBytes: 10, extension: 'pdf' }, [document]),
      habits: [habit({ kind: 'token', token: 'readme', presetName: '发票' })],
      presets: [disabled, document]
    });
    expect(result.presetId).toBe(2);
    expect(result.source).toBe('preset');
  });

  it('排除词挡住习惯指向的预设后试下一条', (): void => {
    const blocked = { ...invoice, nameExcludes: '作废' };
    const result = decideDisposition({
      fileName: '作废说明.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matched('作废说明.pdf', 'pdf'),
      habits: [
        habit({ kind: 'token', token: '作废', presetName: '发票', lineNumber: 1 }),
        habit({ kind: 'token', token: '说明', presetName: '文档', lineNumber: 2 })
      ],
      presets: [blocked, document]
    });
    expect(result.presetId).toBe(2);
    expect(result.source).toBe('habit');
  });

  it('靠前的手写习惯赢过后面的自动习惯', (): void => {
    const result = decideDisposition({
      fileName: '发票备注.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matchPreset({ fileName: '发票备注.pdf', sizeBytes: 10, extension: 'pdf' }, [document]),
      habits: [
        habit({ kind: 'token', token: '备注', presetName: '文档', auto: false, lineNumber: 1 }),
        habit({ kind: 'token', token: '发票', presetName: '发票', auto: true, lineNumber: 2 })
      ],
      presets: [invoice, document]
    });
    expect(result.presetId).toBe(2);
    expect(result.trace).toContain('hand');
  });

  it('都没有时来源为 none', (): void => {
    const result = decideDisposition({
      fileName: 'a.bin',
      extension: 'bin',
      sizeBytes: 10,
      match: matchPreset({ fileName: 'a.bin', sizeBytes: 10, extension: 'bin' }, []),
      habits: [],
      presets: []
    });
    expect(result.source).toBe('none');
    expect(result.reason).toBe('无预设命中');
  });

  it('指出指向了不存在预设的习惯，并跳过它', (): void => {
    expect(
      stalePresetNames([habit({ kind: 'token', token: '发票', presetName: '不存在' })], [document])
    ).toEqual(['不存在']);
    const result = decideDisposition({
      fileName: 'readme.pdf',
      extension: 'pdf',
      sizeBytes: 10,
      match: matched('readme.pdf', 'pdf'),
      habits: [habit({ kind: 'token', token: 'readme', presetName: '不存在' })],
      presets: [invoice, document]
    });
    expect(result.presetId).toBe(2);
    expect(result.source).toBe('preset');
  });
});
