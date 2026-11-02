/**
 * 业务日志走这里，不写文件。
 * 规范禁止 console.log，所以 info 直接写到标准输出，warn / error 用对应的控制台方法。
 */

function format(level: string, message: string, context?: unknown): string {
  if (context === undefined) {
    return `[sortbox][${level}] ${message}`;
  }
  return `[sortbox][${level}] ${message} ${JSON.stringify(context)}`;
}

/** 主进程统一日志。 */
export const logger = {
  info(message: string, context?: unknown): void {
    process.stdout.write(`${format('info', message, context)}\n`);
  },
  warn(message: string, context?: unknown): void {
    console.warn(format('warn', message, context));
  },
  error(message: string, context?: unknown): void {
    console.error(format('error', message, context));
  }
};
