import type { PresetDraft, PresetTemplate } from '@shared/types/domain';

/** 一条还没填名字的预设。目标目录由调用方决定。 */
export function blankDraft(targetDir: string): PresetDraft {
  return {
    id: null,
    name: '',
    extensions: null,
    nameIncludes: null,
    nameStarts: null,
    nameEnds: null,
    nameExcludes: null,
    targetDir,
    pathLayout: '{yyyy-MM}/{origFileName}',
    priority: 40,
    enabled: true,
    maxSizeMb: 0
  };
}

/** 把内置模板变成草稿。目标目录是「归档根 + 模板名」。 */
export function draftFromTemplate(template: PresetTemplate, archiveRoot: string): PresetDraft {
  return {
    id: null,
    name: template.name,
    extensions: template.extensions,
    nameIncludes: template.nameIncludes,
    nameStarts: template.nameStarts,
    nameEnds: template.nameEnds,
    nameExcludes: template.nameExcludes,
    targetDir: joinDir(archiveRoot, template.name),
    pathLayout: template.pathLayout,
    priority: template.priority,
    enabled: true,
    maxSizeMb: 0
  };
}

/** 拼接目录。ViewModel 不能使用 Node 的 path 模块，所以在这里按分隔符自己拼。 */
export function joinDir(root: string, name: string): string {
  const slash = root.includes('\\') ? '\\' : '/';
  const trimmed = root.endsWith('/') || root.endsWith('\\') ? root.slice(0, -1) : root;
  return `${trimmed}${slash}${name}`;
}

/** 把目录模板里的占位符换成示例文字，只用于界面预览。 */
export function previewLayout(layout: string, presetName: string, now: Date): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  return layout
    .replaceAll('{yyyy-MM-dd}', today)
    .replaceAll('{yyyy-MM}', `${year}-${month}`)
    .replaceAll('{fileDate}', today)
    .replaceAll('{category}', '文档')
    .replaceAll('{preset}', presetName)
    .replaceAll('{origFileName}', '示例.pdf');
}
