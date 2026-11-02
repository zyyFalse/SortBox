/**
 * user.md 的读写。
 *
 * 程序只认两对标记之间的内容：
 * - sortbox:habits 里的每一行是一条习惯
 * - sortbox:learned 只是给人看的学习记录
 *
 * 写回时先读当前文件，只替换习惯块中带 # auto 的行，以及学习块。
 * 标记外面的字、不带 # auto 的手写行，一个字节都不改。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { HabitDocument, HabitParseError, HabitRule } from '@shared/types/domain';
import { norm } from '../preset/PresetMatcher';

const HABIT_BEGIN = '<!-- sortbox:habits:begin -->';
const HABIT_END = '<!-- sortbox:habits:end -->';
const LEARNED_BEGIN = '<!-- sortbox:learned:begin -->';
const LEARNED_END = '<!-- sortbox:learned:end -->';

/** 第一次启动、文件还不存在时写入的模板。内容按契约原样保留。 */
export const USER_MD_TEMPLATE = [
  '# 整理习惯',
  '',
  '> 程序只读 sortbox:habits 两个标记之间的行。标记外可以随便写。',
  '> 习惯在没有具体名字预设时生效，用来选一个已经存在的预设。',
  '> 带 # auto 的行是整理过程中学到的，写在手写行下面。程序不会改你写的行。',
  '',
  HABIT_BEGIN,
  HABIT_END,
  '',
  LEARNED_BEGIN,
  LEARNED_END,
  ''
].join('\n');

export interface AutoUpdate {
  add: Array<{ token: string; presetName: string }>;
  remove: Array<{ token: string; presetName: string }>;
  learnedLines: string[];
}

/** 文件不存在时写出模板。已存在则什么都不做。 */
export function ensureHabitFile(filePath: string): void {
  if (existsSync(filePath)) {
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, USER_MD_TEMPLATE, 'utf8');
}

/** 读习惯文件。只有这个模块可以读这段文本。 */
export function readHabitText(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

/** 先写临时文件再改名，避免写到一半把 user.md 弄坏。 */
export function writeHabitTextAtomic(filePath: string, text: string): void {
  const temporary = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporary, text, 'utf8');
  renameSync(temporary, filePath);
}

function peelComment(line: string): { body: string; auto: boolean } {
  let inQuote = false;
  for (let index = 0; index < line.length - 1; index += 1) {
    if (line[index] === '"') {
      inQuote = !inQuote;
    }
    if (!inQuote && line[index] === ' ' && line[index + 1] === '#') {
      const comment = line.slice(index + 2).trim();
      const auto = comment === 'auto' || comment.startsWith('auto ');
      return { body: line.slice(0, index), auto };
    }
  }
  return { body: line, auto: false };
}

function parseExtensions(raw: string): string[] {
  const extensions: string[] = [];
  for (const piece of raw.split(/[,，]/)) {
    const term = norm(piece).replace(/^\./, '');
    if (term !== '') {
      extensions.push(term);
    }
  }
  return extensions;
}

function parseBody(
  body: string,
  lineNumber: number,
  auto: boolean,
  raw: string
): { rule: HabitRule | null; error: HabitParseError | null } {
  const trimmed = body.trim();
  const headed = trimmed.match(/^习惯\s+([\s\S]+)$/);
  if (!headed) {
    return { rule: null, error: { line: lineNumber, message: '动作词必须是习惯' } };
  }
  const rest = headed[1] ?? '';
  const arrow = rest.indexOf('->');
  if (arrow < 0) {
    return { rule: null, error: { line: lineNumber, message: '缺少 ->' } };
  }
  const left = rest.slice(0, arrow).trim();
  const presetName = rest.slice(arrow + 2).trim();
  if (presetName === '') {
    return { rule: null, error: { line: lineNumber, message: '预设名为空' } };
  }
  if (left.startsWith('文件名含')) {
    const quoted = left.match(/^文件名含\s+"([^"]*)"\s*$/);
    if (!quoted) {
      return { rule: null, error: { line: lineNumber, message: '文件名片段缺少引号' } };
    }
    const token = norm(quoted[1] ?? '');
    if (Array.from(token).length < 2) {
      return { rule: null, error: { line: lineNumber, message: '文件名片段过短' } };
    }
    return {
      rule: { lineNumber, kind: 'token', token, extensions: [], presetName, auto, raw },
      error: null
    };
  }
  if (left.startsWith('扩展名')) {
    const list = left.replace(/^扩展名\s*/, '').trim();
    const extensions = parseExtensions(list);
    if (extensions.length === 0) {
      return { rule: null, error: { line: lineNumber, message: '扩展名为空' } };
    }
    return {
      rule: { lineNumber, kind: 'extension', token: null, extensions, presetName, auto, raw },
      error: null
    };
  }
  return { rule: null, error: { line: lineNumber, message: '无法识别的习惯' } };
}

/** 只解析习惯标记之间的非空行。任一错误都会让整份 rules 作废。 */
export function parseHabitDocument(text: string): HabitDocument {
  const source = text.replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  const begin = lines.findIndex((line) => line.trim() === HABIT_BEGIN);
  const end = lines.findIndex((line) => line.trim() === HABIT_END);
  if (begin < 0 || end < begin) {
    return { rules: [], errors: [] };
  }
  const rules: HabitRule[] = [];
  const errors: HabitParseError[] = [];
  for (let index = begin + 1; index < end; index += 1) {
    const raw = lines[index] ?? '';
    if (raw.trim() === '') {
      continue;
    }
    const peeled = peelComment(raw);
    if (peeled.body.trim() === '') {
      continue;
    }
    const parsed = parseBody(peeled.body, index + 1, peeled.auto, raw);
    if (parsed.error) {
      errors.push(parsed.error);
    } else if (parsed.rule) {
      rules.push(parsed.rule);
    }
  }
  if (errors.length > 0) {
    return { rules: [], errors };
  }
  return { rules, errors };
}

interface BlockSpan {
  start: number;
  end: number;
  lines: string[];
}

function locate(text: string, begin: string, end: string): BlockSpan | null {
  const beginAt = text.indexOf(begin);
  const endAt = text.indexOf(end, beginAt + begin.length);
  if (beginAt < 0 || endAt < 0) {
    return null;
  }
  let start = beginAt + begin.length;
  if (text.startsWith('\r\n', start)) {
    start += 2;
  } else if (text.startsWith('\n', start)) {
    start += 1;
  }
  const interior = text.slice(start, endAt).replace(/\r?\n$/, '');
  const lines = interior === '' ? [] : interior.split(/\r?\n/);
  return { start, end: endAt, lines };
}

function newlineOf(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function splice(text: string, newline: string, begin: string, end: string, lines: string[]): string {
  const body = lines.length === 0 ? '' : `${lines.join(newline)}${newline}`;
  const found = locate(text, begin, end);
  if (found === null) {
    const suffix = text.endsWith(newline) || text.length === 0 ? '' : newline;
    return `${text}${suffix}${begin}${newline}${body}${end}${newline}`;
  }
  return `${text.slice(0, found.start)}${body}${text.slice(found.end)}`;
}

function samePair(
  left: { token: string; presetName: string },
  right: { token: string; presetName: string }
): boolean {
  return left.token === right.token && left.presetName === right.presetName;
}

/** 只改自动习惯行和学习记录。标记外的原文保持不变，换行风格也保持不变。 */
export function renderAutoUpdate(text: string, change: AutoUpdate): string {
  const source = text.replace(/^\uFEFF/, '');
  const newline = newlineOf(source);
  const habit = locate(source, HABIT_BEGIN, HABIT_END);
  const kept: string[] = [];
  const surviving: Array<{ token: string; presetName: string }> = [];
  for (const line of habit?.lines ?? []) {
    const peeled = peelComment(line);
    if (!peeled.auto) {
      kept.push(line);
      continue;
    }
    const parsed = parseBody(peeled.body, 0, true, line);
    if (!parsed.rule || parsed.rule.kind !== 'token' || !parsed.rule.token) {
      kept.push(line);
      continue;
    }
    const pair = { token: parsed.rule.token, presetName: parsed.rule.presetName };
    if (change.remove.some((item) => samePair(item, pair))) {
      continue;
    }
    kept.push(line);
    surviving.push(pair);
  }
  for (const item of change.add) {
    if (surviving.some((have) => samePair(have, item))) {
      continue;
    }
    kept.push(`习惯  文件名含 "${item.token}"  -> ${item.presetName}          # auto`);
    surviving.push(item);
  }
  const withHabits = splice(source, newline, HABIT_BEGIN, HABIT_END, kept);
  const learned = locate(withHabits, LEARNED_BEGIN, LEARNED_END);
  const history = (learned?.lines ?? []).map((line) => line.trimEnd()).filter((line) => line.trim() !== '');
  const merged = history.concat(change.learnedLines).slice(-50);
  return splice(withHabits, newline, LEARNED_BEGIN, LEARNED_END, merged);
}
