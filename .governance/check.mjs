import path from 'node:path';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REQUIRED_DIRECTORIES = [
  '00、工作台',
  '01、来源',
  '02、决策',
  '03、当前规范',
  '04、资产',
  '05、Wiki',
  '99、历史',
];

const REQUIRED_FILES = [
  'AGENTS.md',
  '00、工作台/治理协议.md',
  '.agents/skills/product-change-workflow/SKILL.md',
  '.agents/skills/business-spec-manager/SKILL.md',
  '00、工作台/来源登记.md',
  '00、工作台/当前状态.md',
  '00、工作台/当前资产.md',
  '00、工作台/待确认.md',
];

const REGISTRIES = [
  {
    file: '00、工作台/来源登记.md',
    headers: ['来源 ID', '主题', '来源文件', '证据状态'],
    linkedColumns: ['来源文件'],
    optionalLinkedColumns: [],
  },
  {
    file: '00、工作台/当前状态.md',
    headers: ['主题', '当前规范', '最新决策', '说明'],
    linkedColumns: ['当前规范'],
    optionalLinkedColumns: ['最新决策'],
  },
  {
    file: '00、工作台/当前资产.md',
    headers: ['资产 ID', '主题', '资产', '同步状态', '交付状态', '最近同步决策'],
    linkedColumns: ['资产'],
    optionalLinkedColumns: ['最近同步决策'],
  },
  {
    file: '00、工作台/待确认.md',
    headers: ['事项 ID', '主题', '待确认事项', '依据', '状态'],
    linkedColumns: [],
    optionalLinkedColumns: ['依据'],
  },
];

const CORE_DOCUMENTS = [
  'AGENTS.md',
  '00、工作台/治理协议.md',
  '.agents/skills/product-change-workflow/SKILL.md',
  '.agents/skills/business-spec-manager/SKILL.md',
];

function displayPath(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function splitTableRow(line) {
  const source = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  let escaped = false;

  for (const character of source) {
    if (character === '|' && !escaped) {
      cells.push(current.trim());
      current = '';
    } else {
      current += character;
    }
    escaped = character === '\\' && !escaped;
    if (character !== '\\') escaped = false;
  }

  cells.push(current.trim());
  return cells;
}

function isTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function findRegistryRows(content, headers) {
  const lines = content.split(/\r?\n/);
  const rows = [];
  let foundTable = false;

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!isTableLine(lines[index])) continue;

    const parsedHeaders = splitTableRow(lines[index]).map((cell) => cell.replaceAll('`', '').trim());
    if (parsedHeaders.length !== headers.length || parsedHeaders.some((header, cellIndex) => header !== headers[cellIndex])) {
      continue;
    }

    foundTable = true;
    const separator = splitTableRow(lines[index + 1]);
    if (!isSeparatorRow(separator) || separator.length !== headers.length) return null;

    for (let rowIndex = index + 2; rowIndex < lines.length && isTableLine(lines[rowIndex]); rowIndex += 1) {
      const cells = splitTableRow(lines[rowIndex]);
      if (cells.length !== headers.length) return null;
      rows.push(cells);
    }
  }

  return foundTable ? rows : null;
}

function extractMarkdownLinks(text) {
  const links = [];
  const markdownLink = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\s*\)/g;

  for (const match of text.matchAll(markdownLink)) {
    let href = match[1].trim();
    if (href.startsWith('<') && href.endsWith('>')) href = href.slice(1, -1);
    href = href.replaceAll('\\ ', ' ');

    if (!href || href.startsWith('#') || href.startsWith('//') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) continue;

    const fragmentIndex = href.indexOf('#');
    const queryIndex = href.indexOf('?');
    const cutIndex = [fragmentIndex, queryIndex].filter((index) => index >= 0).reduce((first, next) => Math.min(first, next), href.length);
    const encodedPath = href.slice(0, cutIndex);
    if (!encodedPath) continue;

    try {
      links.push({ href, path: decodeURIComponent(encodedPath) });
    } catch {
      links.push({ href, error: '路径包含无效的百分号编码' });
    }
  }

  return links;
}

function resolveMarkdownTarget(root, sourceFile, link) {
  if (link.error) return { error: link.error };
  const target = path.resolve(path.dirname(sourceFile), link.path);
  if (!isInside(root, target)) return { target, error: '引用路径超出工作区目录' };
  return { target };
}

function checkMarkdownReferences(root, relativeFile, content, fail) {
  const sourceFile = path.join(root, relativeFile);

  for (const link of extractMarkdownLinks(content)) {
    const resolved = resolveMarkdownTarget(root, sourceFile, link);
    if (resolved.error) {
      fail(`${relativeFile} 含有无效的本地引用 ${link.href}（${resolved.error}）`);
    } else if (!existsSync(resolved.target)) {
      fail(`${relativeFile} 引用的文件或目录不存在 ${link.href}`);
    }
  }
}

function scanMarkdownFiles(directory) {
  if (!existsSync(directory)) return [];
  const markdownFiles = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) markdownFiles.push(...scanMarkdownFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') {
      markdownFiles.push(fullPath);
    }
  }

  return markdownFiles;
}

export function checkWorkspace(rootDirectory = process.cwd()) {
  const root = path.resolve(rootDirectory);
  const failures = [];
  const notes = [];
  const fail = (message) => failures.push(message);

  for (const directory of REQUIRED_DIRECTORIES) {
    const directoryPath = path.join(root, directory);
    if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) fail(`必需目录不存在 ${directory}`);
  }

  for (const relativeFile of REQUIRED_FILES) {
    const filePath = path.join(root, relativeFile);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) fail(`必需文件不存在 ${relativeFile}`);
  }

  for (const relativeFile of CORE_DOCUMENTS) {
    const fullPath = path.join(root, relativeFile);
    if (!existsSync(fullPath)) continue;
    checkMarkdownReferences(root, relativeFile, readFileSync(fullPath, 'utf8'), fail);
  }

  const registryRows = new Map();
  for (const registry of REGISTRIES) {
    const fullPath = path.join(root, registry.file);
    if (!existsSync(fullPath)) continue;
    const rows = findRegistryRows(readFileSync(fullPath, 'utf8'), registry.headers);
    if (rows === null) {
      fail(`${registry.file} 缺少约定表头或表格格式不正确`);
      continue;
    }

    registryRows.set(registry.file, rows);
    const columnIndexes = new Map(registry.headers.map((header, index) => [header, index]));
    for (const [rowNumber, row] of rows.entries()) {
      for (const column of registry.linkedColumns) {
        const value = row[columnIndexes.get(column)] ?? '';
        const links = extractMarkdownLinks(value);
        if (links.length === 0) {
          fail(`${registry.file} 第 ${rowNumber + 1} 条记录的“${column}”必须包含仓库内链接`);
          continue;
        }
        for (const link of links) {
          const resolved = resolveMarkdownTarget(root, fullPath, link);
          if (resolved.error) fail(`${registry.file} 的“${column}”链接无效 ${link.href}（${resolved.error}）`);
          else if (!existsSync(resolved.target)) fail(`${registry.file} 的“${column}”链接目标不存在 ${link.href}`);
        }
      }

      for (const column of registry.optionalLinkedColumns) {
        const value = row[columnIndexes.get(column)] ?? '';
        for (const link of extractMarkdownLinks(value)) {
          const resolved = resolveMarkdownTarget(root, fullPath, link);
          if (resolved.error) fail(`${registry.file} 的“${column}”链接无效 ${link.href}（${resolved.error}）`);
          else if (!existsSync(resolved.target)) fail(`${registry.file} 的“${column}”链接目标不存在 ${link.href}`);
        }
      }
    }
  }

  const statusPath = '00、工作台/当前状态.md';
  const statusRows = registryRows.get(statusPath) ?? [];
  const themeIndex = 0;
  const specIndex = 1;
  const themes = new Map();
  const registeredSpecs = new Map();
  const statusFile = path.join(root, statusPath);

  for (const [rowIndex, row] of statusRows.entries()) {
    const theme = row[themeIndex]?.trim();
    const specLinks = extractMarkdownLinks(row[specIndex] ?? '');
    if (!theme || theme === '—') {
      fail(`${statusPath} 第 ${rowIndex + 1} 条记录缺少主题`);
      continue;
    }
    if (themes.has(theme)) fail(`${statusPath} 中主题重复登记 ${theme}`);
    themes.set(theme, rowIndex);

    if (specLinks.length !== 1) {
      fail(`${statusPath} 中主题“${theme}”必须对应唯一当前规范链接`);
      continue;
    }

    const resolved = resolveMarkdownTarget(root, statusFile, specLinks[0]);
    if (resolved.error) {
      fail(`${statusPath} 中主题“${theme}”的规范路径无效（${resolved.error}）`);
      continue;
    }
    const specDirectory = path.resolve(root, '03、当前规范');
    const normalized = resolved.target;
    const specName = path.basename(normalized).toLowerCase();
    if (!isInside(specDirectory, normalized) || !specName.endsWith('.md') || specName === 'readme.md') {
      fail(`${statusPath} 中主题“${theme}”必须指向 03、当前规范/ 下的规范 Markdown 文件`);
      continue;
    }
    if (registeredSpecs.has(normalized)) fail(`${statusPath} 中规范路径被重复登记 ${displayPath(root, normalized)}`);
    registeredSpecs.set(normalized, theme);
    if (!statSync(normalized, { throwIfNoEntry: false })?.isFile()) {
      fail(`${statusPath} 中主题“${theme}”的规范文件不存在 ${specLinks[0].href}`);
    }
  }

  const specs = scanMarkdownFiles(path.join(root, '03、当前规范'));
  for (const spec of specs) {
    if (!registeredSpecs.has(path.resolve(spec))) {
      fail(`当前规范文件未在 ${statusPath} 中登记 ${displayPath(root, spec)}`);
    }
  }

  if (specs.length === 0) notes.push('尚无当前规范，首次使用时可按主题建立第一份规范。');

  return { root, failures, notes };
}

function parseRootArgument(args) {
  if (args.length === 0) return process.cwd();
  if (args.length !== 2 || args[0] !== '--root' || !args[1]) {
    throw new Error('用法：node .governance/check.mjs [--root <目录>]');
  }
  return args[1];
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const result = checkWorkspace(parseRootArgument(process.argv.slice(2)));
    for (const note of result.notes) console.log(`提示 ${note}`);
    if (result.failures.length > 0) {
      for (const failure of result.failures) console.error(`失败 ${failure}`);
      console.error(`治理结构检查失败，共 ${result.failures.length} 项。`);
      process.exitCode = 1;
    } else {
      console.log('治理结构检查通过。');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
