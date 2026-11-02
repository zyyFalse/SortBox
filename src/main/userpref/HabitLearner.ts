/**
 * 学习只记「名字预设」归档。
 * 同一片段指向同一预设，被肯定满 2 次且没有被撤销否定，才在 user.md 末尾追加一行 # auto。
 * 否定满 2 次就删掉对应的自动行。手写行永远不动。
 * 试运行、仅类型归档、习惯归档本身，都不记次数，避免规则自己加强自己。
 */
import type { DecisionSource, MatchTier } from '@shared/types/domain';
import type { HabitRepository, PresetRepository } from '../storage/repositories';
import { logger } from '../core/logger';
import {
  parseHabitDocument,
  readHabitText,
  renderAutoUpdate,
  writeHabitTextAtomic
} from './userMarkdown';
import type { UserHabitSet } from './UserHabitSet';

/** 肯定几次后写入自动习惯。 */
export const HABIT_PROMOTE_THRESHOLD = 2;
/** 否定几次后移除自动习惯。 */
export const HABIT_DEMOTE_THRESHOLD = 2;
/** 自动习惯最多留多少条。 */
export const HABIT_AUTO_LIMIT = 50;

/** 这次归档要不要记一笔肯定。类型预设和试运行都返回 false。 */
export function shouldObserveArchive(input: {
  dryRun: boolean;
  source: DecisionSource;
  tier: MatchTier;
  hitToken: string | null;
}): boolean {
  if (input.dryRun || input.source !== 'preset') {
    return false;
  }
  if (input.tier !== 'name-and-type' && input.tier !== 'name') {
    return false;
  }
  return input.hitToken !== null && input.hitToken !== '';
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function stamp(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 从整理痕迹里取出命中层和命中片段，供撤销时记否定。 */
export function tokenFromTrace(trace: string): { tier: string; token: string } | null {
  const tierMatch = trace.match(/命中层\s+(\S+)/);
  const tokenMatch = trace.match(/命中「([^」]*)」/);
  if (!tierMatch || !tokenMatch) {
    return null;
  }
  return { tier: tierMatch[1] ?? '', token: tokenMatch[1] ?? '' };
}

/** 负责累计次数，并在一轮结束时把结论写回 user.md。 */
export class HabitLearner {
  constructor(
    private readonly habits: HabitRepository,
    private readonly presets: PresetRepository,
    private readonly habitFilePath: string,
    private readonly habitSet: UserHabitSet
  ) {}

  /** 名字预设归档成功后记一次肯定。只写次数，不立刻改 user.md。 */
  async observeArchive(token: string, presetId: number, at: number): Promise<void> {
    await this.habits.record({
      featureKind: 'token',
      featureValue: token,
      presetId,
      polarity: 'positive',
      at
    });
  }

  /** 撤销一条名字预设归档时记一次否定。 */
  async observeUndo(token: string, presetId: number, at: number): Promise<void> {
    await this.habits.record({
      featureKind: 'token',
      featureValue: token,
      presetId,
      polarity: 'negative',
      at
    });
  }

  /**
   * 一轮结束或撤销完成后调用一次。
   * 解析失败就放弃本次写回，避免在人编辑到一半时覆盖文件。
   */
  async reconcile(at: number): Promise<void> {
    try {
      const original = readHabitText(this.habitFilePath);
      const parsed = parseHabitDocument(original);
      if (parsed.errors.length > 0) {
        logger.warn('user.md 解析失败，本次不写回', { errors: parsed.errors });
        return;
      }
      const observations = await this.habits.listAll();
      const presetList = await this.presets.list();
      const autoCount = parsed.rules.filter((rule) => rule.auto).length;
      const add: Array<{ token: string; presetName: string }> = [];
      const remove: Array<{ token: string; presetName: string }> = [];
      const learnedLines: string[] = [];
      let room = HABIT_AUTO_LIMIT - autoCount;
      for (const item of observations) {
        if (item.featureKind !== 'token' || item.polarity !== 'positive') {
          continue;
        }
        if (item.hits < HABIT_PROMOTE_THRESHOLD) {
          continue;
        }
        const negative = observations.find(
          (other) =>
            other.polarity === 'negative' &&
            other.featureKind === 'token' &&
            other.featureValue === item.featureValue &&
            other.presetId === item.presetId
        );
        if (negative && negative.hits > 0) {
          continue;
        }
        const preset = presetList.find((candidate) => candidate.id === item.presetId && candidate.enabled);
        if (!preset) {
          continue;
        }
        const already = parsed.rules.some(
          (rule) => rule.auto && rule.token === item.featureValue && rule.presetName === preset.name
        );
        if (already || room <= 0) {
          continue;
        }
        add.push({ token: item.featureValue, presetName: preset.name });
        learnedLines.push(
          `${stamp(at)}  「文件名含 ${item.featureValue}」→「${preset.name}」第 ${item.hits} 次得到证实，已写入习惯`
        );
        room -= 1;
      }
      for (const item of observations) {
        if (item.featureKind !== 'token' || item.polarity !== 'negative') {
          continue;
        }
        if (item.hits < HABIT_DEMOTE_THRESHOLD) {
          continue;
        }
        const preset = presetList.find((candidate) => candidate.id === item.presetId);
        if (!preset) {
          continue;
        }
        remove.push({ token: item.featureValue, presetName: preset.name });
        learnedLines.push(`${stamp(at)}  「文件名含 ${item.featureValue}」→「${preset.name}」已移除`);
      }
      if (add.length === 0 && remove.length === 0) {
        return;
      }
      const next = renderAutoUpdate(original, { add, remove, learnedLines });
      this.habitSet.markSelfWrite(at);
      writeHabitTextAtomic(this.habitFilePath, next);
      this.habitSet.adoptText(next);
    } catch (error) {
      logger.warn('写回整理习惯失败', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
