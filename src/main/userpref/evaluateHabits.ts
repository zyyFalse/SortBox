/**
 * 习惯什么时候插手：
 * 1. 名字预设（名字+类型，或仅名字）已经命中 → 习惯不参与。
 * 2. 否则按 user.md 从上到下，用第一条能用的习惯。
 * 3. 习惯也没有，才退回「仅类型」预设。
 * 4. 还是没有 → 未分类。
 *
 * 习惯指向的预设，不再检查它的扩展名列表。
 * 这样「发票」只认 pdf 时，后来的 发票-备注.txt 仍能按习惯归进去。
 */
import type { Disposition, HabitRule, MatchResult, Preset } from '@shared/types/domain';
import { norm, splitTerms } from '../preset/PresetMatcher';

function findEnabled(presets: Preset[], presetName: string): Preset | null {
  const name = presetName.trim();
  const found = presets
    .filter((preset) => preset.enabled && preset.name.trim() === name)
    .sort((left, right) => left.id - right.id);
  return found[0] ?? null;
}

function blocked(preset: Preset, fileName: string, sizeBytes: number): boolean {
  const name = norm(fileName);
  for (const term of splitTerms(preset.nameExcludes)) {
    if (name.includes(term)) {
      return true;
    }
  }
  return preset.maxSizeMb > 0 && sizeBytes > preset.maxSizeMb * 1024 * 1024;
}

function habitMatches(rule: HabitRule, fileName: string, extension: string): boolean {
  if (rule.kind === 'token') {
    const token = rule.token ?? '';
    return token !== '' && norm(fileName).includes(norm(token));
  }
  return rule.extensions.includes(norm(extension));
}

/** 哪些习惯指向了不存在或未启用的预设。设置页用它显示黄字。 */
export function stalePresetNames(rules: HabitRule[], presets: Preset[]): string[] {
  const names: string[] = [];
  for (const rule of rules) {
    if (findEnabled(presets, rule.presetName) !== null) {
      continue;
    }
    if (!names.includes(rule.presetName)) {
      names.push(rule.presetName);
    }
  }
  return names;
}

/** 在预设匹配结果之上，决定最终用预设、习惯，还是谁都不用。 */
export function decideDisposition(input: {
  fileName: string;
  extension: string;
  sizeBytes: number;
  match: MatchResult;
  habits: HabitRule[];
  presets: Preset[];
}): Disposition {
  if (input.match.tier === 'name-and-type' || input.match.tier === 'name') {
    return {
      presetId: input.match.presetId,
      source: 'preset',
      tier: input.match.tier,
      hitToken: input.match.hitToken,
      reason: input.match.reason,
      trace: `${input.match.trace} | 习惯 未使用`
    };
  }
  for (const habit of input.habits) {
    if (!habitMatches(habit, input.fileName, input.extension)) {
      continue;
    }
    const preset = findEnabled(input.presets, habit.presetName);
    if (preset === null) {
      continue;
    }
    if (blocked(preset, input.fileName, input.sizeBytes)) {
      continue;
    }
    const token = habit.token ?? '';
    const reason =
      habit.kind === 'token'
        ? `无具体名字预设，按整理习惯归入预设「${preset.name}」：文件名含「${token}」`
        : `无具体名字预设，按整理习惯归入预设「${preset.name}」：扩展名 .${norm(input.extension)}`;
    const who = habit.auto ? 'auto' : 'hand';
    return {
      presetId: preset.id,
      source: 'habit',
      tier: 'habit',
      hitToken: habit.kind === 'token' ? token : null,
      reason,
      trace: `${input.match.trace} | 习惯 ${who} 行${habit.lineNumber} → preset#${preset.id}`
    };
  }
  if (input.match.tier === 'type') {
    return {
      presetId: input.match.presetId,
      source: 'preset',
      tier: 'type',
      hitToken: input.match.hitToken,
      reason: input.match.reason,
      trace: input.match.trace
    };
  }
  return {
    presetId: null,
    source: 'none',
    tier: 'none',
    hitToken: null,
    reason: '无预设命中',
    trace: input.match.trace
  };
}
