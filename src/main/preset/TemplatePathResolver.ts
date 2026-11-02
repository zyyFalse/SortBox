/**
 * 把预设的目录模板换成真正的绝对路径。
 * 只做字符串替换和安全检查，不创建文件夹。文件夹要等移动成功前再创建。
 */
import path from 'node:path';
import type { Preset } from '@shared/types/domain';
import { FileActionError } from '../agent/move';
import { isPathInside } from '../core/paths';
import { categoryOf } from '../model/category';
import { extractFileDateFromName, fileExtension, fileStem } from '../model/naming';

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function illegalCharacters(): RegExp {
  let controls = '';
  for (let code = 0; code < 32; code += 1) {
    controls += String.fromCharCode(code);
  }
  return new RegExp(`[<>:"|?*${controls}]`, 'g');
}

function cleanSegment(segment: string): string {
  const replaced = segment.replace(illegalCharacters(), '_');
  const base = replaced.split('.')[0] ?? replaced;
  if (RESERVED.test(base)) {
    return `_${replaced}`;
  }
  return replaced;
}

function fill(layout: string, values: Record<string, string>): string {
  return layout.replace(/\{[^{}]+\}/g, (token) => {
    const key = token.slice(1, -1);
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key] ?? token;
    }
    return token;
  });
}

/** 计算文件应该落到的绝对路径。越出预设目标目录时抛出「归档路径越界」。 */
export function resolveArchivePath(input: {
  preset: Preset;
  sourceFileName: string;
  archiveDate: Date;
}): string {
  const date = input.archiveDate;
  const yyyy = String(date.getFullYear());
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const today = `${yyyy}-${month}-${day}`;
  const extension = fileExtension(input.sourceFileName);
  const values: Record<string, string> = {
    origFileName: input.sourceFileName,
    stem: fileStem(input.sourceFileName),
    ext: extension,
    category: categoryOf(extension),
    yyyy,
    MM: month,
    dd: day,
    'yyyy-MM': `${yyyy}-${month}`,
    'yyyy-MM-dd': today,
    fileDate: extractFileDateFromName(input.sourceFileName) ?? today,
    preset: input.preset.name
  };
  let rendered = fill(input.preset.pathLayout, values).trim();
  if (rendered === '' || /^[/\\]+$/.test(rendered)) {
    rendered = `其他/${input.sourceFileName}`;
  }
  const segments = rendered
    .split(/[/\\]/)
    .filter((segment) => segment.length > 0)
    .map((segment) => cleanSegment(segment));
  const root = path.resolve(input.preset.targetDir);
  const target = path.resolve(root, ...segments);
  if (!isPathInside(target, root) || pathKeyEqualsRootOnly(target, root)) {
    throw new FileActionError('归档路径越界');
  }
  return target;
}

function pathKeyEqualsRootOnly(target: string, root: string): boolean {
  return path.resolve(target) === path.resolve(root);
}
