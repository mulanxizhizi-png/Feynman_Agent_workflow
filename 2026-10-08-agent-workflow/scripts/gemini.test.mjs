import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { parseReview, root, visualReview, validateInit, prepareVisualReview, recordBrowserReview } from './gemini.mjs';
import path from 'node:path';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';

const review = { status: 'pass', summary: '已审核', reviewed_images: ['screen-01.png'], issues: [] };
test('拒绝未加载指定 Agent、写入工具或全自动批准的客户端', () => {
  validateInit({ agent: 'gemini-visual', tools: ['view_file'], permission_mode: 'request-review' });
  assert.throws(() => validateInit({ tools: ['view_file'] }));
  assert.throws(() => validateInit({ agent: 'gemini-visual', tools: ['view_file', 'run_command'] }));
  assert.throws(() => validateInit({ agent: 'gemini-visual', tools: ['view_file'], permission_mode: 'always-proceed' }));
});
test('接受完整 JSON 与 JSON 代码围栏', () => {
  assert.equal(parseReview(JSON.stringify(review), ['screen-01.png']).status, 'pass');
  assert.equal(parseReview('```json\n' + JSON.stringify(review) + '\n```', ['screen-01.png']).status, 'pass');
});
test('缺图不能通过', () => assert.throws(() => parseReview(JSON.stringify(review), ['screen-01.png', 'screen-02.png'])));
test('不能同时报告 P2 问题和审核通过', () => {
  const issue = { severity: 'P2', image: 'screen-01.png', location: '标题', problem: '遮挡', suggestion: '调整间距', verification: '重拍' };
  assert.throws(() => parseReview(JSON.stringify({ ...review, issues: [issue] }), ['screen-01.png']));
});
test('没有截图或使用相对路径时不调用模型', async () => {
  await assert.rejects(() => visualReview({ brief: '检查', screenshots: [] }));
  await assert.rejects(() => visualReview({ brief: '检查', screenshots: ['relative.png'] }));
});
test('网页结果保留图片哈希，拒绝图片改变后的旧审核', async () => {
  const base = path.join(root, 'runtime', 'tests');
  await mkdir(base, { recursive: true });
  const fixture = await mkdtemp(path.join(base, 'review-'));
  let job;
  try {
    const source = path.join(fixture, 'sample.png');
    await writeFile(source, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=', 'base64'));
    job = await prepareVisualReview({ brief: '保留图片，检查 @layout', screenshots: [source] });
    assert.match(job.prompt, /＠layout/);
    const report = await recordBrowserReview(job.cwd, JSON.stringify(review), 'https://gemini.google.com/app/test-conversation', 'Flash');
    assert.equal(report.backend, 'Gemini official web');
    assert.equal(report.hashes['screen-01.png'].length, 64);
    assert.equal(JSON.parse(await readFile(report.reportPath, 'utf8')).status, 'pass');
    await writeFile(job.files[0], 'changed');
    await assert.rejects(() => recordBrowserReview(job.cwd, JSON.stringify(review), 'https://gemini.google.com/app/test-conversation', 'Flash'), /图片已改变/);
  } finally {
    // These are exact directories returned by our fixture/job constructors,
    // each resolved inside this task's runtime before recursive cleanup.
    for (const target of [fixture, job?.cwd].filter(Boolean)) {
      const relative = path.relative(path.join(root, 'runtime'), path.resolve(target));
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
      await rm(target, { recursive: true, force: true });
    }
  }
});
test('MCP 初始化和工具发现不需要登录、不污染 stdout', async () => {
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'mcp.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { errors += chunk; });
  child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n' + JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n');
  const code = await new Promise((resolve, reject) => { child.once('close', resolve); child.once('error', reject); });
  assert.equal(code, 0); assert.equal(errors, '');
  const messages = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(messages[0].result.serverInfo.name, 'gemini-visual-review');
  assert.equal(messages[1].result.tools.length, 2);
});
