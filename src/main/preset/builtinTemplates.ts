import type { PresetTemplate } from '@shared/types/domain';

const LAYOUT = '{yyyy-MM}/{origFileName}';

/**
 * 初始化时可选的 8 条内置模板。
 * 6 条只看扩展名（优先级 100），2 条还要看文件名（优先级 50，因此压过同层的其它名字预设）。
 * 运行过程中不会再发明新的模板。
 */
export function listBuiltinTemplates(): PresetTemplate[] {
  return [
    template('doc', '文档', 'pdf,doc,docx,ppt,pptx,xls,xlsx,txt,md', null, 100, '按扩展名收入文档'),
    template('image', '图片', 'png,jpg,jpeg,gif,webp,bmp,svg', null, 100, '按扩展名收入图片'),
    template('audio', '音频', 'mp3,wav,flac,aac,m4a,ogg', null, 100, '按扩展名收入音频'),
    template('video', '视频', 'mp4,mkv,avi,mov,wmv', null, 100, '按扩展名收入视频'),
    template('archive', '压缩包', 'zip,rar,7z,tar,gz', null, 100, '按扩展名收入压缩包'),
    template('code', '代码', 'java,py,c,cpp,h,js,ts,ipynb,html,css,json', null, 100, '按扩展名收入代码'),
    template('invoice', '发票', 'pdf,png,jpg,jpeg', '发票,invoice', 50, '文件名含发票且是 pdf 或图片'),
    template('resume', '简历', 'pdf,doc,docx', '简历,resume,cv', 50, '文件名含简历且是文档')
  ];
}

function template(
  key: string,
  name: string,
  extensions: string,
  nameIncludes: string | null,
  priority: number,
  description: string
): PresetTemplate {
  return {
    key,
    name,
    extensions,
    nameIncludes,
    nameStarts: null,
    nameEnds: null,
    nameExcludes: null,
    pathLayout: LAYOUT,
    priority,
    description
  };
}
