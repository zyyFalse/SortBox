/**
 * 保存预设、保存目录之前的校验。
 * 这里只看路径关系和字段是否填全，不访问数据库。调用方把「别的预设的目标目录」传进来。
 */
import type { PresetDraft } from '@shared/types/domain';
import { pathsOverlap } from '../core/paths';
import { codePointLength } from '../model/naming';
import { norm } from './PresetMatcher';

export interface PresetSaveContext {
  watchFolders: readonly string[];
  unclassifiedDir: string;
  otherTargetDirs: readonly string[];
}

/** 仍有已归档资料时不能删预设。返回中文错误，能删则返回 null。 */
export function deletionError(archivedCount: number): string | null {
  if (archivedCount > 0) {
    return '不能删除仍有资料的预设';
  }
  return null;
}

function positivePieces(raw: string | null): string[] {
  if (raw === null || raw.trim() === '') {
    return [];
  }
  return raw
    .split(/[,，]/)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
}

function assertTermsLongEnough(draft: PresetDraft): void {
  const pieces = [
    ...positivePieces(draft.nameIncludes),
    ...positivePieces(draft.nameStarts),
    ...positivePieces(draft.nameEnds)
  ];
  for (const piece of pieces) {
    if (codePointLength(norm(piece)) < 2) {
      throw new Error(`文件名条件过短：${piece.trim()}`);
    }
  }
}

function hasAnyCondition(draft: PresetDraft): boolean {
  const extensions = positivePieces(draft.extensions);
  const names = [
    ...positivePieces(draft.nameIncludes),
    ...positivePieces(draft.nameStarts),
    ...positivePieces(draft.nameEnds)
  ];
  return extensions.length > 0 || names.length > 0;
}

/** 目录模板不能跳出目标目录，也不能写成绝对路径。 */
export function isIllegalLayout(layout: string): boolean {
  if (layout.includes('..')) {
    return true;
  }
  if (layout.startsWith('/') || layout.startsWith('\\')) {
    return true;
  }
  return /[A-Za-z]:/.test(layout);
}

/** 保存一条预设之前调用。不通过就抛中文错误。 */
export function assertPresetSavable(draft: PresetDraft, context: PresetSaveContext): void {
  if (draft.name.trim() === '' || draft.targetDir.trim() === '' || draft.pathLayout.trim() === '') {
    throw new Error('预设名称、目标目录和目录模板都不能为空');
  }
  if (!hasAnyCondition(draft)) {
    throw new Error('预设至少要有文件名条件或文件类型');
  }
  assertTermsLongEnough(draft);
  if (isIllegalLayout(draft.pathLayout)) {
    throw new Error('目录模板非法');
  }
  for (const folder of context.watchFolders) {
    if (folder.trim() !== '' && pathsOverlap(draft.targetDir, folder)) {
      throw new Error('预设目标目录不能与监视目录重叠');
    }
  }
  if (context.unclassifiedDir.trim() !== '' && pathsOverlap(draft.targetDir, context.unclassifiedDir)) {
    throw new Error('预设目标目录不能与未分类目录重叠');
  }
  for (const other of context.otherTargetDirs) {
    if (other.trim() !== '' && pathsOverlap(draft.targetDir, other)) {
      throw new Error('已存在使用同一目标目录的预设');
    }
  }
}

/** 监视目录、未分类目录和全部预设目标之间都不能互相包含。 */
export function assertLocations(input: {
  watchFolders: readonly string[];
  unclassifiedDir: string;
  targetDirs: readonly string[];
}): void {
  if (input.watchFolders.length === 0 || input.unclassifiedDir.trim() === '') {
    throw new Error('请先选择监视目录、归档位置，并至少启用一个预设');
  }
  for (const folder of input.watchFolders) {
    if (input.unclassifiedDir.trim() !== '' && pathsOverlap(folder, input.unclassifiedDir)) {
      throw new Error('监视目录不能位于预设目标目录或未分类目录之内');
    }
    for (const target of input.targetDirs) {
      if (target.trim() !== '' && pathsOverlap(folder, target)) {
        throw new Error('监视目录不能位于预设目标目录或未分类目录之内');
      }
    }
  }
  for (const target of input.targetDirs) {
    if (target.trim() !== '' && pathsOverlap(input.unclassifiedDir, target)) {
      throw new Error('未分类目录不能与监视目录或预设目标目录重叠');
    }
  }
  for (const folder of input.watchFolders) {
    if (pathsOverlap(input.unclassifiedDir, folder)) {
      throw new Error('未分类目录不能与监视目录或预设目标目录重叠');
    }
  }
}
