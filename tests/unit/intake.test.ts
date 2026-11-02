import { describe, expect, it } from 'vitest';
import { evaluateIntake, type IntakeStat } from '../../src/main/agent/intake';

function fileStat(patch: Partial<IntakeStat> = {}): IntakeStat {
  return {
    isDirectory: (): boolean => false,
    isFile: (): boolean => true,
    isSymbolicLink: (): boolean => false,
    size: 100,
    mtimeMs: 1_000,
    ...patch
  };
}

function judge(
  filePath: string,
  patch: Partial<Parameters<typeof evaluateIntake>[0]> = {}
): string {
  return evaluateIntake({
    filePath,
    stat: fileStat(),
    ignoreExtensions: ['exe', 'tmp'],
    stabilityWindowMs: 800,
    now: 5_000,
    isInsideManagedDir: (): boolean => false,
    ...patch
  }).verdict;
}

describe('evaluateIntake', (): void => {
  it('目录直接拒绝', (): void => {
    expect(judge('C:/down/文件夹', { stat: fileStat({ isDirectory: (): boolean => true }) })).toBe('reject');
  });

  it('点开头的名字拒绝', (): void => {
    expect(judge('C:/down/.hidden')).toBe('reject');
  });

  it('Office 临时文件拒绝', (): void => {
    expect(judge('C:/down/~$报告.docx')).toBe('reject');
  });

  it('忽略扩展名拒绝', (): void => {
    expect(judge('C:/down/setup.exe')).toBe('reject');
  });

  it('未完成下载拒绝', (): void => {
    expect(judge('C:/down/a.crdownload')).toBe('reject');
  });

  it('稳定窗口内推迟', (): void => {
    expect(judge('C:/down/a.pdf', { stat: fileStat({ mtimeMs: 4_500 }), now: 5_000 })).toBe('defer');
  });

  it('已经在归档目录里的文件拒绝', (): void => {
    expect(judge('C:/archive/a.pdf', { isInsideManagedDir: (): boolean => true })).toBe('reject');
  });

  it('普通 pdf 接受', (): void => {
    expect(judge('C:/down/a.pdf')).toBe('accept');
  });

  it('读不到状态时拒绝，权限错误时失败', (): void => {
    expect(judge('C:/down/a.pdf', { stat: null })).toBe('reject');
    expect(judge('C:/down/a.pdf', { errorCode: 'EACCES' })).toBe('fail');
  });
});
