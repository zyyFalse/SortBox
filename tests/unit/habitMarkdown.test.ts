import { describe, expect, it } from 'vitest';
import { parseHabitDocument, renderAutoUpdate, USER_MD_TEMPLATE } from '../../src/main/userpref/userMarkdown';

function document(habits: string[]): string {
  return USER_MD_TEMPLATE.replace(
    '<!-- sortbox:habits:end -->',
    `${habits.join('\n')}\n<!-- sortbox:habits:end -->`
  );
}

describe('user.md', (): void => {
  it('解析文件名习惯和扩展名习惯', (): void => {
    const parsed = parseHabitDocument(
      document(['习惯  文件名含 "发票"  -> 发票', '习惯  扩展名 pdf,png  -> 图片'])
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules.map((rule) => rule.kind)).toEqual(['token', 'extension']);
    expect(parsed.rules[1]?.extensions).toEqual(['pdf', 'png']);
  });

  it('auto 注释被标成自动习惯', (): void => {
    const parsed = parseHabitDocument(document(['习惯  文件名含 "发票"  -> 发票          # auto']));
    expect(parsed.rules[0]?.auto).toBe(true);
  });

  it('少引号时带行号且规则为空', (): void => {
    const parsed = parseHabitDocument(document(['习惯  文件名含 发票  -> 发票']));
    expect(parsed.rules).toEqual([]);
    expect(parsed.errors[0]?.message).toBe('文件名片段缺少引号');
    expect(parsed.errors[0]?.line).toBeGreaterThan(0);
  });

  it('标记外的文字原样保留', (): void => {
    const source = `手写说明\n${document(['习惯  文件名含 "发票"  -> 发票'])}`;
    const next = renderAutoUpdate(source, {
      add: [{ token: '合同', presetName: '合同' }],
      remove: [],
      learnedLines: ['学会了']
    });
    expect(next.startsWith('手写说明')).toBe(true);
    expect(next).toContain('习惯  文件名含 "发票"  -> 发票');
  });

  it('自动行追加在习惯块末尾且不重复', (): void => {
    const source = document(['习惯  文件名含 "发票"  -> 发票']);
    const once = renderAutoUpdate(source, {
      add: [{ token: '合同', presetName: '合同' }],
      remove: [],
      learnedLines: []
    });
    const twice = renderAutoUpdate(once, {
      add: [{ token: '合同', presetName: '合同' }],
      remove: [],
      learnedLines: []
    });
    expect(parseHabitDocument(twice).rules.filter((rule) => rule.auto)).toHaveLength(1);
    expect(twice.indexOf('合同')).toBeGreaterThan(twice.indexOf('发票'));
  });

  it('删除自动行时保留手写的同文行', (): void => {
    const source = document([
      '习惯  文件名含 "发票"  -> 发票',
      '习惯  文件名含 "发票"  -> 发票          # auto'
    ]);
    const next = renderAutoUpdate(source, {
      add: [],
      remove: [{ token: '发票', presetName: '发票' }],
      learnedLines: []
    });
    const rules = parseHabitDocument(next).rules;
    expect(rules.some((rule) => !rule.auto)).toBe(true);
    expect(rules.some((rule) => rule.auto)).toBe(false);
  });

  it('学习记录只留最近 50 条', (): void => {
    const learned = Array.from({ length: 50 }, (_item, index): string => `旧${index}`);
    const source = USER_MD_TEMPLATE.replace(
      '<!-- sortbox:learned:end -->',
      `${learned.join('\n')}\n<!-- sortbox:learned:end -->`
    );
    const next = renderAutoUpdate(source, { add: [], remove: [], learnedLines: ['新的一条'] });
    expect(next).not.toContain('旧0');
    expect(next).toContain('新的一条');
    expect(next).toContain('旧1');
  });

  it('CRLF 写回后仍是 CRLF', (): void => {
    const source = document(['习惯  文件名含 "发票"  -> 发票']).replace(/\n/g, '\r\n');
    const next = renderAutoUpdate(source, {
      add: [{ token: '合同', presetName: '合同' }],
      remove: [],
      learnedLines: ['记录']
    });
    expect(next).toContain('\r\n');
    expect(next.includes('\n') && !next.includes('\r\n')).toBe(false);
  });
});
