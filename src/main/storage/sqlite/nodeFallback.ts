/**
 * Node 22 起自带 SQLite，不需要编译。
 * better-sqlite3 装不上时用它把单测和开发跑起来。
 * 事务写成 BEGIN / COMMIT，和 better-sqlite3 的 transaction() 一样：要么全成功，要么全撤销。
 */
import { createRequire } from 'node:module';
import type { SqlDatabase, SqlStatement } from './sql';

interface SyncStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
}

interface SyncDatabase {
  exec(sql: string): void;
  prepare(sql: string): SyncStatement;
  close(): void;
}

const nodeRequire = createRequire(import.meta.url);

/** 打开 Node 内置数据库，并包成仓储期待的形状。 */
export function openNodeSqlite(filePath: string): SqlDatabase {
  const sqlite = nodeRequire('node:sqlite') as {
    DatabaseSync: new (location: string) => SyncDatabase;
  };
  const db = new sqlite.DatabaseSync(filePath);
  let depth = 0;
  return {
    pragma(source: string): unknown {
      try {
        db.exec(`PRAGMA ${source}`);
      } catch {
        // 内存库不一定接受 WAL。设置失败时继续，表结构仍然可用。
      }
      return null;
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string): SqlStatement {
      const statement = db.prepare(sql);
      return {
        get: (...params: unknown[]) => statement.get(...params),
        all: (...params: unknown[]) => statement.all(...params),
        run: (...params: unknown[]) => statement.run(...params)
      };
    },
    transaction<T>(work: () => T): () => T {
      return () => {
        const point = depth;
        if (point === 0) {
          db.exec('BEGIN');
        } else {
          db.exec(`SAVEPOINT nest${point}`);
        }
        depth += 1;
        try {
          const result = work();
          if (point === 0) {
            db.exec('COMMIT');
          } else {
            db.exec(`RELEASE nest${point}`);
          }
          depth -= 1;
          return result;
        } catch (error) {
          if (point === 0) {
            db.exec('ROLLBACK');
          } else {
            db.exec(`ROLLBACK TO nest${point}`);
            db.exec(`RELEASE nest${point}`);
          }
          depth -= 1;
          throw error;
        }
      };
    },
    close(): void {
      db.close();
    }
  };
}
