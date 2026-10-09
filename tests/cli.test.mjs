import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFreeze } from '../src/review/contract.mjs';
import { impactKeys, reviewKeys } from '../src/review/gate.mjs';

const cli = fileURLToPath(new URL('../bin/workflow.mjs', import.meta.url));
const call = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.txt'), 'original source');
  fs.writeFileSync(path.join(root, 'check.txt'), 'original check');
  const contract = { schema_version: 3, task_id: 'cli', implementation_agent_id: 'executor', brief: 'test fixture only', criteria: ['round', 'technical'].map(scope => ({ id: scope, scope, required: true, verification_type: 'document', description: 'test', basis: 'test', verification: 'test' })) };
  const bytes = Buffer.from(JSON.stringify(contract));
  const entries = [{ id: 'source', path: 'source.txt', role: 'source' }, { id: 'check', path: 'check.txt', role: 'programmatic' }];
  const contractPath = path.join(root, 'contract.json'); fs.writeFileSync(contractPath, bytes);
  const freezePath = path.join(root, 'freeze.json'); fs.writeFileSync(freezePath, JSON.stringify(createFreeze(root, bytes, entries)));
  return { root, contractPath, freezePath };
}

test('真实启动CLI核对证据字节，漂移/越界均拒绝，不把stderr混进JSON', t => {
  const { root } = fixture(t);
  const file = path.join(root, 'assessment.json');
  const a = { schema_version: 1, task_id: 'cli-gate', implementation_agent_id: 'executor', change_summary: 'fixture', assessment_basis: 'raw check fixture', readiness: { stable: true, checks_passed: true, evidence_complete: true }, impact: Object.fromEntries(impactKeys.map(k => [k, false])), review: { ...Object.fromEntries(reviewKeys.map(k => [k, false])), revision_changed: true, prior_reviewer_id: null, completed_rounds: 0 }, evidence: [{ id: 'check', path: 'check.txt', description: 'raw', sha256: createHash('sha256').update('original check').digest('hex') }] };
  fs.writeFileSync(file, JSON.stringify(a));
  const ok = call('decide', root, file); assert.equal(ok.status, 0); assert.equal(ok.stderr, ''); assert.equal(JSON.parse(ok.stdout).action, 'initial_review');
  fs.writeFileSync(path.join(root, 'check.txt'), 'drift');
  const drift = call('decide', root, file); assert.equal(drift.status, 1); assert.equal(drift.stdout, '');
  a.evidence[0].path = '../outside.txt'; fs.writeFileSync(file, JSON.stringify(a));
  assert.match(call('decide', root, file).stderr, /相对路径/);
});
test('统一context入口登记真实内容，不覆盖输入；新上下文不得继承已读', t => {
  const f = fixture(t); const args = [f.root, f.contractPath, f.freezePath, 'reviewer', 'context-1'];
  const init = call('context', 'init', ...args); assert.equal(init.status, 0);
  const registryPath = path.join(f.root, 'registry.json'); fs.writeFileSync(registryPath, init.stdout);
  const read = call('context', 'read', ...args, registryPath, 'source'); assert.equal(read.status, 0);
  const value = JSON.parse(read.stdout); assert.equal(value.content, 'original source');
  assert.deepEqual(JSON.parse(fs.readFileSync(registryPath)), JSON.parse(init.stdout));
  fs.writeFileSync(registryPath, JSON.stringify(value.registry));
  const plan = call('context', 'plan', ...args, registryPath); assert.equal(JSON.parse(plan.stdout).files[0].action, 'eligible_for_reuse');
  const restored = call('context', 'plan', f.root, f.contractPath, f.freezePath, 'reviewer', 'context-2', registryPath);
  assert.ok(JSON.parse(restored.stdout).files.every(f => f.action === 'acquire'));
});
test('未知命令和多余参数失败，帮助不启动任何外部进程', () => {
  assert.equal(call('help').status, 0); assert.equal(call('unknown').status, 1);
  assert.equal(call('freeze', 'a', 'b', 'c', 'd').status, 1);
});
