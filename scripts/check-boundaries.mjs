/**
 * 架构边界扫描。
 * 遍历 src 和 tests 里的 ts/tsx，命中任一条就打印「文件:行号 → 描述」并退出 1。
 * 这样做是为了把「界面不碰数据库、虚拟机不碰 React、不能联网、不能乱删文件」变成可自动检查的规则。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['src', 'tests'];
const violations = [];

function walk(directory) {
  const entries = readdirSync(directory);
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function lineCount(text) {
  if (text.length === 0) {
    return 0;
  }
  const parts = text.split('\n');
  if (text.endsWith('\n')) {
    return parts.length - 1;
  }
  return parts.length;
}

function stripCommentsAndStrings(text) {
  let result = '';
  let index = 0;
  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];
    if (current === '/' && next === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') {
        result += ' ';
        index += 1;
      }
      continue;
    }
    if (current === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
        result += text[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      index += 2;
      continue;
    }
    if (current === '\'' || current === '"' || current === '`') {
      const quote = current;
      result += ' ';
      index += 1;
      while (index < text.length && text[index] !== quote) {
        if (text[index] === '\\') {
          result += '  ';
          index += 2;
          continue;
        }
        result += text[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      result += ' ';
      index += 1;
      continue;
    }
    result += current;
    index += 1;
  }
  return result;
}

function report(file, line, message) {
  violations.push(`${relative(file)}:${line} → ${message}`);
}

function linesOf(text) {
  return text.split('\n');
}

function findLine(lines, pattern) {
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      hits.push(index + 1);
    }
  }
  return hits;
}

function checkFile(file) {
  const rel = relative(file);
  const text = readFileSync(file, 'utf8');
  const lines = linesOf(text);
  const limit = rel.endsWith('src/main/storage/sqlite/migrations.ts') ? 400 : 300;
  const count = lineCount(text);
  if (count > limit) {
    report(file, limit + 1, `单文件超过 ${limit} 行（当前 ${count} 行）`);
  }

  const stripped = stripCommentsAndStrings(text);
  const strippedLines = linesOf(stripped);
  for (const line of findLine(strippedLines, /:\s*any\b|<any>|as\s+any\b/)) {
    report(file, line, '禁止放弃类型（any）');
  }

  if (rel.startsWith('src/shared/viewmodel/')) {
    const banned = [
      [/from\s+['"]react['"]/, 'ViewModel 禁止依赖 react'],
      [/from\s+['"]electron['"]/, 'ViewModel 禁止依赖 electron'],
      [/from\s+['"]node:/, 'ViewModel 禁止依赖 node:'],
      [/from\s+['"]chokidar['"]/, 'ViewModel 禁止依赖 chokidar'],
      [/from\s+['"]better-sqlite3['"]/, 'ViewModel 禁止依赖 better-sqlite3'],
      [/@main/, 'ViewModel 禁止引用主进程'],
      [/@renderer/, 'ViewModel 禁止引用渲染进程']
    ];
    for (const [pattern, message] of banned) {
      for (const line of findLine(lines, pattern)) {
        report(file, line, message);
      }
    }
  }

  if (rel.startsWith('src/renderer/views/') || rel.startsWith('src/renderer/components/')) {
    const banned = [
      [/ipcRenderer/, 'View 禁止直接使用 ipcRenderer'],
      [/window\.sortbox/, 'View 禁止直接调用 window.sortbox'],
      [/fs\./, 'View 禁止直接使用文件系统'],
      [/AgentService/, 'View 禁止依赖 AgentService'],
      [/PresetMatcher/, 'View 禁止依赖 PresetMatcher']
    ];
    for (const [pattern, message] of banned) {
      for (const line of findLine(lines, pattern)) {
        report(file, line, message);
      }
    }
  }

  if (rel.startsWith('src/main/') && rel.includes('@renderer/')) {
    for (const line of findLine(lines, /@renderer\//)) {
      report(file, line, '主进程禁止引用渲染进程');
    }
  }
  if (rel.startsWith('src/renderer/') && rel.includes('@main/')) {
    for (const line of findLine(lines, /@main\//)) {
      report(file, line, '渲染进程禁止引用主进程');
    }
  }

  const network = [
    [/\bfetch\s*\(/, '禁止联网：fetch'],
    [/from\s+['"]http['"]/, '禁止联网：http'],
    [/from\s+['"]node:http['"]/, '禁止联网：node:http'],
    [/from\s+['"]https['"]/, '禁止联网：https'],
    [/from\s+['"]axios['"]/, '禁止联网：axios'],
    [/from\s+['"]openai['"]/, '禁止接入大模型'],
    [/apiKey/i, '禁止出现 apiKey'],
    [/api_key/i, '禁止出现 api_key'],
    [/net\.connect/, '禁止联网：net.connect']
  ];
  for (const [pattern, message] of network) {
    for (const line of findLine(lines, pattern)) {
      report(file, line, message);
    }
  }

  const allowUnlink = rel === 'src/main/agent/move.ts';
  for (const line of findLine(lines, /unlinkSync|\bunlink\b/)) {
    if (!allowUnlink) {
      report(file, line, '禁止删除文件（unlink 只允许出现在 move.ts）');
    }
  }
  for (const line of findLine(lines, /\brmSync\b|\brm\(|\brmdir\b/)) {
    report(file, line, '禁止 rm / rmdir');
  }
  if (rel !== 'src/main/agent/move.ts') {
    for (const line of findLine(lines, /copyFile/)) {
      report(file, line, 'copyFile 只允许出现在 move.ts');
    }
  }

  if (!rel.startsWith('src/main/storage/sqlite/')) {
    for (const line of findLine(lines, /better-sqlite3/)) {
      report(file, line, 'better-sqlite3 只能在 storage/sqlite 中使用');
    }
  }

  for (const line of findLine(lines, /pdfjs|yauzl|mammoth|unzipper/)) {
    report(file, line, '禁止引入内容解析库');
  }

  const allowChokidar =
    rel === 'src/main/agent/watcher.ts' || rel === 'src/main/userpref/UserHabitSet.ts';
  if (!allowChokidar) {
    for (const line of findLine(lines, /chokidar/)) {
      report(file, line, 'chokidar 只能在 watcher.ts 和 UserHabitSet.ts 中使用');
    }
  }

  if (rel.startsWith('src/main/') && rel !== 'src/main/userpref/userMarkdown.ts') {
    for (const line of findLine(lines, /readFileSync|\breadFile\b/)) {
      report(file, line, '主进程禁止读取下载文件正文；只有 user.md 可以读文本');
    }
  }
  if (rel !== 'src/main/system/sha256.ts') {
    for (const line of findLine(lines, /createReadStream/)) {
      report(file, line, 'createReadStream 只能用于计算 SHA-256');
    }
  }
  if (rel !== 'src/main/userpref/userMarkdown.ts') {
    for (const line of findLine(lines, /writeFileSync|\bwriteFile\b/)) {
      report(file, line, '写文件只允许发生在 userMarkdown.ts（user.md）');
    }
  }
}

const files = SCAN_ROOTS.flatMap((root) => walk(path.join(ROOT, root)));
for (const file of files) {
  checkFile(file);
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exit(1);
}
