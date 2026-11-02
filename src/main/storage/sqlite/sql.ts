/**
 * 仓储只依赖这几个同步方法。
 * 优先使用 better-sqlite3；当前机器如果没有 C++ 编译器，就退回 Node 自带的 SQLite。
 * 两条路径的调用方式保持一样：prepare / get / all / run / transaction。
 */
export interface SqlStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
}

export interface SqlDatabase {
  pragma(source: string): unknown;
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
  transaction<T>(work: () => T): () => T;
  close(): void;
}
