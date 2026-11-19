import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkWorkspace } from '../check.mjs';

const rootFiles = [
  'AGENTS.md',
  '00、工作台/治理协议.md',
  '.agents/skills/product-change-workflow/SKILL.md',
  '.agents/skills/business-spec-manager/SKILL.md',
  '00、工作台/来源登记.md',
  '00、工作台/当前状态.md',
  '00、工作台/当前资产.md',
  '00、工作台/待确认.md',
];

const registries = {
  '00、工作台/来源登记.md': ['来源 ID', '主题', '来源文件', '证据状态'],
  '00、工作台/当前状态.md': ['主题', '当前规范', '最新决策', '说明'],
  '00、工作台/当前资产.md': ['资产 ID', '主题', '资产', '同步状态', '交付状态', '最近同步决策'],
  '00、工作台/待确认.md': ['事项 ID', '主题', '待确认事项', '依据', '状态'],
};

function writeFile(root, relativePath, content = '') {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

function writeEmptyRegistry(root, relativePath, headers) {
  writeFile(root, relativePath, [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    '',
  ].join('\n'));
}

function createWorkspace(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'product-governance-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  for (const directory of ['00、工作台', '01、来源', '02、决策', '03、当前规范', '04、资产', '05、Wiki', '99、历史']) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  for (const filePath of rootFiles.slice(0, 4)) writeFile(root, filePath, '# 文档\n');
  for (const [filePath, headers] of Object.entries(registries)) writeEmptyRegistry(root, filePath, headers);

  return root;
}

test('空白工作区具备目录和登记表时通过', (t) => {
  const root = createWorkspace(t);
  const result = checkWorkspace(root);

  assert.deepEqual(result.failures, []);
  assert.match(result.notes[0], /尚无当前规范/);
});

test('重复主题会被报告', (t) => {
  const root = createWorkspace(t);
  writeFile(root, '03、当前规范/活动报名取消.md', '# 活动报名取消\n');
  const spec = '[活动报名取消](../03、当前规范/活动报名取消.md)';
  const rows = [
    `| 活动报名取消 | ${spec} | — | — |`,
    `| 活动报名取消 | ${spec} | — | — |`,
  ].join('\n');
  writeFile(root, '00、工作台/当前状态.md', `| 主题 | 当前规范 | 最新决策 | 说明 |\n| --- | --- | --- | --- |\n${rows}\n`);

  const result = checkWorkspace(root);
  assert.ok(result.failures.some((failure) => failure.includes('主题重复登记')));
});

test('缺少必需入口文件会失败', (t) => {
  const root = createWorkspace(t);
  rmSync(path.join(root, 'AGENTS.md'));

  const result = checkWorkspace(root);
  assert.ok(result.failures.some((failure) => failure.includes('必需文件不存在 AGENTS.md')));
});

test('中文和带空格的链接路径可正常解析', (t) => {
  const root = createWorkspace(t);
  const sourceFile = '01、来源/访谈 纪要.md';
  const decisionFile = '02、决策/活动报名确认.md';
  const specFile = '03、当前规范/活动报名取消.md';
  const artifactFile = '04、资产/活动报名流程.md';
  for (const filePath of [sourceFile, decisionFile, specFile, artifactFile]) writeFile(root, filePath, '# 示例\n');

  writeFile(root, 'AGENTS.md', [
    '[治理协议](00、工作台/治理协议.md)',
    '[产品流程技能](.agents/skills/product-change-workflow/SKILL.md)',
    '[事实治理技能](.agents/skills/business-spec-manager/SKILL.md)',
    '[含空格的来源](<01、来源/访谈%20纪要.md>)',
  ].join('\n'));
  writeFile(root, '00、工作台/来源登记.md', [
    '| 来源 ID | 主题 | 来源文件 | 证据状态 |',
    '| --- | --- | --- | --- |',
    '| SRC-活动-001 | 活动报名取消 | [访谈](<../01、来源/访谈%20纪要.md>) | 已收录 |',
    '',
  ].join('\n'));
  writeFile(root, '00、工作台/当前状态.md', [
    '| 主题 | 当前规范 | 最新决策 | 说明 |',
    '| --- | --- | --- | --- |',
    '| 活动报名取消 | [当前规范](../03、当前规范/活动报名取消.md) | [决策](../02、决策/活动报名确认.md) | 示例 |',
    '',
  ].join('\n'));
  writeFile(root, '00、工作台/当前资产.md', [
    '| 资产 ID | 主题 | 资产 | 同步状态 | 交付状态 | 最近同步决策 |',
    '| --- | --- | --- | --- | --- | --- |',
    '| ART-活动-001 | 活动报名取消 | [流程](../04、资产/活动报名流程.md) | Updated | 草稿 | [决策](../02、决策/活动报名确认.md) |',
    '',
  ].join('\n'));
  writeFile(root, '00、工作台/待确认.md', [
    '| 事项 ID | 主题 | 待确认事项 | 依据 | 状态 |',
    '| --- | --- | --- | --- | --- |',
    '| OPEN-活动-001 | 活动报名取消 | 示例边界 | [来源](../01、来源/访谈%20纪要.md) | 待确认 |',
    '',
  ].join('\n'));

  const result = checkWorkspace(root);
  assert.deepEqual(result.failures, []);
});


test('目录说明和文件夹不能登记为当前规范', (t) => {
  const root = createWorkspace(t);
  writeFile(root, '03、当前规范/README.md', '# 目录说明\n');
  mkdirSync(path.join(root, '03、当前规范/占位目录.md'));
  writeFile(root, '00、工作台/当前状态.md', [
    '| 主题 | 当前规范 | 最新决策 | 说明 |',
    '| --- | --- | --- | --- |',
    '| 主题一 | [目录说明](../03、当前规范/README.md) | — | — |',
    '| 主题二 | [占位目录](../03、当前规范/占位目录.md) | — | — |',
    '',
  ].join('\n'));

  const result = checkWorkspace(root);
  assert.ok(result.failures.some((failure) => failure.includes('主题一') && failure.includes('规范 Markdown 文件')));
  assert.ok(result.failures.some((failure) => failure.includes('主题二') && failure.includes('规范文件不存在')));
});

test('同表头的多个资产分区都会校验链接', (t) => {
  const root = createWorkspace(t);
  const retainedAsset = '04、资产/当前主交付物.md';
  const transitionAsset = '04、资产/阶段过渡资产.md';
  writeFile(root, retainedAsset, '# 当前主交付物\n');
  writeFile(root, transitionAsset, '# 阶段过渡资产\n');

  const headers = '| 资产 ID | 主题 | 资产 | 同步状态 | 交付状态 | 最近同步决策 |';
  const separator = '| --- | --- | --- | --- | --- | --- |';
  writeFile(root, '00、工作台/当前资产.md', [
    headers,
    separator,
    '| ART-001 | 社区活动 | [主交付物](../04、资产/当前主交付物.md) | Updated | 草稿 | — |',
    '',
    headers,
    separator,
    '| ART-002 | 社区活动 | [阶段过渡资产](../04、资产/阶段过渡资产.md) | Dirty | 草稿 | — |',
    '',
  ].join('\n'));

  assert.deepEqual(checkWorkspace(root).failures, []);
  rmSync(path.join(root, transitionAsset));

  const result = checkWorkspace(root);
  assert.ok(result.failures.some((failure) => failure.includes('阶段过渡资产.md') && failure.includes('链接目标不存在')));
});
