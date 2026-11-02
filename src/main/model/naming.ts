/**
 * 只根据文件名字符串做事：取主文件名、找日期、生成不冲突的文件名、建议一条预设草稿。
 * 这里不打开文件。日期也不会去读 PDF 正文。
 */
import path from 'node:path';
import type { PresetDraft } from '@shared/types/domain';
import { isPathInside } from '../core/paths';

const STOP_WORDS = new Set(['final', 'copy', '副本', '新建']);

/** 统计 Unicode 码点，避免把一个汉字算成两个长度。 */
export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** 全角数字和全角的点、横线先换成半角，后面的日期正则才认得出。 */
export function toHalfWidth(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/－/g, '-')
    .replace(/．/g, '.');
}

/** 主文件名：最后一个点后面是扩展名。点在第一位时，整段都算名字（例如 .gitignore）。 */
export function fileStem(fileName: string): string {
  const normalized = fileName.normalize('NFC');
  const dot = normalized.lastIndexOf('.');
  if (dot <= 0) {
    return normalized;
  }
  return normalized.slice(0, dot);
}

/** 小写、不带点的扩展名。没有扩展名时返回空字符串。 */
export function fileExtension(fileName: string): string {
  const normalized = path.basename(fileName).normalize('NFC');
  const dot = normalized.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return normalized.slice(dot + 1).toLowerCase();
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatFull(yearText: string, monthText: string, dayText: string): string | null {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function formatMonth(yearText: string, monthText: string): string | null {
  const year = Number(yearText);
  const month = Number(monthText);
  if (year < 1990 || year > 2100 || month < 1 || month > 12) {
    return null;
  }
  return `${year}-${pad(month)}`;
}

/**
 * 从文件名里找日期。
 * 先找「年-月-日」，再找「年-月」。多个结果取最靠前的；同一位置取更长的那一个。
 */
export function extractFileDateFromName(fileName: string): string | null {
  const text = toHalfWidth(fileName.normalize('NFC'));
  const found: Array<{ index: number; length: number; value: string }> = [];
  for (const match of text.matchAll(/(\d{4})[-_.年](\d{1,2})[-_.月](\d{1,2})日?/g)) {
    const value = formatFull(match[1] ?? '', match[2] ?? '', match[3] ?? '');
    if (value !== null && match.index !== undefined) {
      found.push({ index: match.index, length: match[0].length, value });
    }
  }
  for (const match of text.matchAll(/(\d{4})[-_.年](\d{1,2})月?/g)) {
    const value = formatMonth(match[1] ?? '', match[2] ?? '');
    if (value !== null && match.index !== undefined) {
      found.push({ index: match.index, length: match[0].length, value });
    }
  }
  found.sort((left, right) => left.index - right.index || right.length - left.length);
  return found[0]?.value ?? null;
}

/** 把文件名里的日期换成空格，方便后面只按文字切词。 */
export function maskDates(stem: string): string {
  const text = toHalfWidth(stem.normalize('NFC'));
  return text
    .replace(/(\d{4})[-_.年](\d{1,2})[-_.月](\d{1,2})日?/g, ' ')
    .replace(/(\d{4})[-_.年](\d{1,2})月?/g, ' ');
}

/**
 * 从文件名里挑一个适合当预设名的片段。
 * 丢掉太短、太长、以及 final / copy / 副本 / 新建 这种没有区分度的词。
 */
export function suggestNameToken(fileName: string): string | null {
  const stem = fileStem(fileName);
  const masked = maskDates(stem);
  const matches = Array.from(masked.matchAll(/\p{L}+/gu));
  const candidates: Array<{ token: string; index: number; length: number }> = [];
  for (const match of matches) {
    const token = match[0] ?? '';
    const length = codePointLength(token);
    if (length < 2 || length > 20) {
      continue;
    }
    if (STOP_WORDS.has(token.normalize('NFC').trim().toLowerCase())) {
      continue;
    }
    candidates.push({ token, index: match.index ?? 0, length });
  }
  candidates.sort((left, right) => right.length - left.length || left.index - right.index);
  return candidates[0]?.token ?? null;
}

/** 同名时在最后一个扩展名前插入 _2、_3。archive.tar.gz 会变成 archive.tar_2.gz。 */
export function withSuffix(fileName: string, index: number): string {
  if (index <= 1) {
    return fileName;
  }
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return `${fileName}_${index}`;
  }
  return `${fileName.slice(0, dot)}_${index}${fileName.slice(dot)}`;
}

/** 未分类目录下的相对路径。没有扩展名时放进 noext，避免出现空文件夹名。 */
export function unclassifiedRelativeName(extension: string, fileName: string): string {
  const folder = extension.trim() === '' ? 'noext' : extension.toLowerCase();
  return `${folder}/${fileName}`;
}

function commonParent(dirs: readonly string[]): string | null {
  if (dirs.length === 0) {
    return null;
  }
  const split = dirs.map((dir) => path.dirname(path.resolve(dir)).split(path.sep));
  const first = split[0];
  if (!first) {
    return null;
  }
  const shared: string[] = [];
  for (let index = 0; index < first.length; index += 1) {
    const part = first[index];
    if (part === undefined || part === '') {
      continue;
    }
    const same = split.every((segments) => segments[index] === part);
    if (!same) {
      break;
    }
    shared.push(part);
  }
  if (shared.length === 0) {
    return null;
  }
  if (shared.length === 1 && /^[A-Za-z]:$/.test(shared[0] ?? '')) {
    return `${shared[0]}${path.sep}`;
  }
  return shared.join(path.sep);
}

/**
 * 按文件名建议一条还没保存的预设。
 * 只返回草稿，不写数据库，也不创建目录。目标目录推不出来时留空，等人来填。
 */
export function suggestPresetDraft(
  fileName: string,
  extension: string,
  archiveRoot: string,
  existingTargetDirs: readonly string[],
  unclassifiedDir: string,
  watchFolders: readonly string[] = []
): PresetDraft {
  const token = suggestNameToken(fileName);
  const normalizedExtension = extension.trim().toLowerCase();
  const draft: PresetDraft = {
    id: null,
    name: token ?? '',
    extensions: normalizedExtension === '' ? null : normalizedExtension,
    nameIncludes: token,
    nameStarts: null,
    nameEnds: null,
    nameExcludes: null,
    targetDir: '',
    pathLayout: '{yyyy-MM}/{origFileName}',
    priority: 40,
    enabled: true,
    maxSizeMb: 0
  };
  if (token === null) {
    return draft;
  }
  const parent = commonParent(existingTargetDirs);
  let base = parent;
  if (base === null) {
    if (unclassifiedDir.trim() !== '') {
      base = path.dirname(path.resolve(unclassifiedDir));
    } else if (archiveRoot.trim() !== '') {
      base = path.resolve(archiveRoot);
    }
  }
  if (base === null) {
    return draft;
  }
  const targetDir = path.join(base, token);
  const blocked = [...watchFolders, unclassifiedDir, ...existingTargetDirs].filter(
    (dir) => dir.trim() !== ''
  );
  for (const dir of blocked) {
    if (isPathInside(targetDir, dir) || isPathInside(dir, targetDir)) {
      return draft;
    }
  }
  draft.targetDir = targetDir;
  return draft;
}
