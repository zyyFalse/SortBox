/**
 * 扩展名到中文分类。
 * 分类只用于目录模板里的 {category}，以及资料库筛选。
 * 它不参与「这个文件该进哪个预设」的裁决。
 */

const DOCUMENT = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'csv'];
const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const AUDIO = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'];
const VIDEO = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'];
const ARCHIVE = ['zip', 'rar', '7z', 'tar', 'gz'];
const CODE = ['java', 'py', 'c', 'cpp', 'h', 'js', 'ts', 'ipynb', 'html', 'css', 'json', 'xml', 'yaml', 'yml'];

const GROUPS: Array<{ name: string; extensions: string[] }> = [
  { name: '文档', extensions: DOCUMENT },
  { name: '图片', extensions: IMAGE },
  { name: '音频', extensions: AUDIO },
  { name: '视频', extensions: VIDEO },
  { name: '压缩包', extensions: ARCHIVE },
  { name: '代码', extensions: CODE }
];

/** 把不带点的扩展名映射成固定的七个分类名之一。空扩展名归入「其他」。 */
export function categoryOf(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  for (const group of GROUPS) {
    if (group.extensions.includes(normalized)) {
      return group.name;
    }
  }
  return '其他';
}
