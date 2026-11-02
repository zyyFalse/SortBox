import { describe, expect, it } from 'vitest';
import { categoryOf } from '../../src/main/model/category';

describe('categoryOf', (): void => {
  it('pdf 归入文档', (): void => {
    expect(categoryOf('pdf')).toBe('文档');
  });

  it('png 归入图片', (): void => {
    expect(categoryOf('PNG')).toBe('图片');
  });

  it('未知扩展名归入其他', (): void => {
    expect(categoryOf('bin')).toBe('其他');
  });

  it('空扩展名归入其他', (): void => {
    expect(categoryOf('')).toBe('其他');
  });

  it('音频视频压缩包和代码各归其类', (): void => {
    expect(categoryOf('mp3')).toBe('音频');
    expect(categoryOf('mp4')).toBe('视频');
    expect(categoryOf('zip')).toBe('压缩包');
    expect(categoryOf('java')).toBe('代码');
  });
});
