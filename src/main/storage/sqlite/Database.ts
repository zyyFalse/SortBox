/**
 * 整个主进程只创建一次 Database。
 * better-sqlite3 的操作是同步的：调用会立刻得到结果，不需要把 SQL 包进 setTimeout。
 * WAL 让读写可以交错；foreign_keys 必须打开，否则「删预设时把资料上的预设清空」不会生效。
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../../core/logger';
import { applyMigrations, assertSchema, isCorruptError, schemaMismatchError } from './migrations';
import { openNodeSqlite } from './nodeFallback';
import type { SqlDatabase } from './sql';

const nodeRequire = createRequire(import.meta.url);

function openConnection(filePath: string): SqlDatabase {
  try {
    const BetterSqlite = nodeRequire('better-sqlite3') as new (location: string) => SqlDatabase;
    return new BetterSqlite(filePath);
  } catch (error) {
    if (isCorruptError(error)) {
      throw schemaMismatchError();
    }
    logger.warn('原生模块编译失败，请确认已安装构建工具链');
    return openNodeSqlite(filePath);
  }
}

/** 应用唯一的数据库连接。 */
export class Database {
  readonly raw: SqlDatabase;

  constructor(filePath: string) {
    if (filePath !== ':memory:') {
      mkdirSync(path.dirname(filePath), { recursive: true });
    }
    this.raw = openConnection(filePath);
    this.raw.pragma('journal_mode = WAL');
    this.raw.pragma('synchronous = NORMAL');
    this.raw.pragma('foreign_keys = ON');
    this.raw.pragma('busy_timeout = 5000');
    try {
      applyMigrations(this.raw);
      assertSchema(this.raw);
    } catch (error) {
      this.raw.close();
      if (error instanceof Error && error.message.includes('数据库结构不匹配')) {
        throw error;
      }
      if (isCorruptError(error)) {
        throw schemaMismatchError();
      }
      throw error;
    }
  }

  /** 在一个事务里做完几件写操作。中途抛错会全部回滚。 */
  transaction<T>(work: () => T): T {
    return this.raw.transaction(work)();
  }

  /** 进程退出前调用。先停 Agent，再关库。 */
  close(): void {
    this.raw.close();
  }
}
