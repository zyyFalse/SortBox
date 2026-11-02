import type { TriggerPolicy } from '@shared/types/domain';
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/types/preferences';
import { logger } from '../../core/logger';
import type { PreferenceRepository } from '../repositories';
import type { Database } from './Database';

const POLICIES: readonly TriggerPolicy[] = ['idle', 'immediate', 'interval', 'manual'];
const KEYS = Object.keys(DEFAULT_PREFERENCES) as Array<keyof Preferences>;

function cloneDefaults(): Preferences {
  return {
    ...DEFAULT_PREFERENCES,
    watchFolders: [...DEFAULT_PREFERENCES.watchFolders],
    ignoreExtensions: [...DEFAULT_PREFERENCES.ignoreExtensions]
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function accept(key: keyof Preferences, value: unknown): boolean {
  if (key === 'initialized' || key === 'agentEnabled' || key === 'agentDryRun') {
    return typeof value === 'boolean';
  }
  if (key === 'watchFolders' || key === 'ignoreExtensions') {
    return isStringArray(value);
  }
  if (key === 'unclassifiedDir' || key === 'archiveRoot') {
    return typeof value === 'string';
  }
  if (key === 'triggerPolicy') {
    return typeof value === 'string' && POLICIES.includes(value as TriggerPolicy);
  }
  return typeof value === 'number' && Number.isFinite(value);
}

/** 设置存在 preference 表里，一行一个字段，值是 JSON。 */
export class SqlitePreferenceRepository implements PreferenceRepository {
  constructor(private readonly database: Database) {}

  /** 读出全部设置。空库直接给默认值；缺字段或类型不对时退回默认值并警告。 */
  load(): Promise<Preferences> {
    const rows = this.database.raw.prepare(`SELECT key, value FROM preference`).all() as Array<{
      key: string;
      value: string;
    }>;
    if (rows.length === 0) {
      return Promise.resolve(cloneDefaults());
    }
    const result = cloneDefaults();
    const present = new Map(rows.map((row) => [row.key, row.value]));
    for (const key of KEYS) {
      const raw = present.get(key);
      if (raw === undefined) {
        logger.warn('偏好缺少字段，已使用默认值', { key });
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!accept(key, parsed)) {
          logger.warn('偏好字段类型不符，已使用默认值', { key });
          continue;
        }
        this.assign(result, key, parsed);
      } catch {
        logger.warn('偏好字段无法解析，已使用默认值', { key });
      }
    }
    return Promise.resolve(result);
  }

  /** 合并修改并整表写回。调用方要先做过范围校验。 */
  save(patch: Partial<Preferences>): Promise<Preferences> {
    return this.load().then((current) => {
      const next: Preferences = {
        ...current,
        ...patch,
        watchFolders: patch.watchFolders ? [...patch.watchFolders] : current.watchFolders,
        ignoreExtensions: patch.ignoreExtensions ? [...patch.ignoreExtensions] : current.ignoreExtensions
      };
      this.database.transaction(() => {
        this.writeNow(next);
      });
      return next;
    });
  }

  /** 只写行，不自己开事务。初始化要和插入预设放在同一个事务里。 */
  writeNow(next: Preferences): void {
    const statement = this.database.raw.prepare(
      `INSERT INTO preference (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    );
    for (const key of KEYS) {
      statement.run(key, JSON.stringify(next[key]));
    }
  }

  private assign(target: Preferences, key: keyof Preferences, value: unknown): void {
    if (key === 'watchFolders' && isStringArray(value)) {
      target.watchFolders = value;
      return;
    }
    if (key === 'ignoreExtensions' && isStringArray(value)) {
      target.ignoreExtensions = value;
      return;
    }
    Object.assign(target, { [key]: value });
  }
}
