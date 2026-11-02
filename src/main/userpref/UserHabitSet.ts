/**
 * 内存里的那一份习惯。
 * user.md 一变，就用 300ms 防抖重新解析。
 * 解析失败时不替换上一份有效规则，整理可以继续，只是退回「只按预设」。
 * 程序自己写回后的 300ms 内，忽略由此引起的变更，避免写完又读、再写。
 */
import chokidar from 'chokidar';
import type { HabitDiagnostics, HabitParseError, HabitRule, Preset } from '@shared/types/domain';
import { logger } from '../core/logger';
import { stalePresetNames } from './evaluateHabits';
import { ensureHabitFile, parseHabitDocument, readHabitText } from './userMarkdown';

/** 持有当前生效的习惯，并监听 user.md。 */
export class UserHabitSet {
  private rules: HabitRule[] = [];
  private errors: HabitParseError[] = [];
  private loaded = true;
  private usedPrevious = false;
  private ignoreUntil = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private listPresets: () => Preset[] = () => [];

  constructor(private readonly filePath: string) {}

  /** 启动时保证文件存在，并读入第一份规则。listPresets 用来计算失效预设名。 */
  start(listPresets: () => Preset[]): void {
    this.listPresets = listPresets;
    ensureHabitFile(this.filePath);
    this.readNow();
    this.watcher = chokidar.watch(this.filePath, { ignoreInitial: true, awaitWriteFinish: false });
    this.watcher.on('all', () => {
      this.onExternalChange();
    });
    this.watcher.on('error', (error: unknown) => {
      logger.warn('监听 user.md 失败', {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }

  /** 停止监听。 */
  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.watcher !== null) {
      void this.watcher.close();
      this.watcher = null;
    }
  }

  /** 当前生效的规则。解析失败时仍是上一份。 */
  current(): HabitRule[] {
    return this.rules;
  }

  /** 设置页和控制台用的诊断。 */
  diagnostics(): HabitDiagnostics {
    return {
      loaded: this.loaded,
      usedPrevious: this.usedPrevious,
      path: this.filePath,
      ruleCount: this.rules.length,
      autoRuleCount: this.rules.filter((rule) => rule.auto).length,
      errors: this.errors,
      stalePresetNames: stalePresetNames(this.rules, this.listPresets())
    };
  }

  /** 自己即将写文件。接下来 300ms 的变更通知忽略。 */
  markSelfWrite(now: number): void {
    this.ignoreUntil = now + 300;
  }

  /** 写回成功后直接采用新文本，不等监听器。 */
  adoptText(text: string): void {
    this.apply(text);
  }

  /** 设置页的「重新加载」。 */
  reload(): HabitDiagnostics {
    this.readNow();
    return this.diagnostics();
  }

  private onExternalChange(): void {
    if (Date.now() < this.ignoreUntil) {
      return;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.readNow();
    }, 300);
  }

  private readNow(): void {
    try {
      this.apply(readHabitText(this.filePath));
    } catch (error) {
      logger.warn('读取整理习惯失败', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private apply(text: string): void {
    const document = parseHabitDocument(text);
    if (document.errors.length > 0) {
      this.errors = document.errors;
      this.loaded = false;
      this.usedPrevious = true;
      logger.warn('user.md 有错误，沿用上一份习惯', { errors: document.errors });
      return;
    }
    this.rules = document.rules;
    this.errors = [];
    this.loaded = true;
    this.usedPrevious = false;
  }
}
