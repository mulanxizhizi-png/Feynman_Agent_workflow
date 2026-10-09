import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFreeze } from '../src/review/contract.mjs';
import { newRegistry, validateRegistry, planReads, acquireFile } from '../src/review/context.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.txt'), 'original source');
  fs.writeFileSync(path.join(root, 'audit.txt'), 'raw evidence');
  const contract = { schema_version: 3, task_id: 'context-test', implementation_agent_id: 'main', brief: 'test', criteria: ['round', 'technical'].map(scope => ({ id: scope, scope, required: true, verification_type: 'document', description: 'test', basis: 'test', verification: 'test' })) };
  const bytes = Buffer.from(JSON.stringify(contract));
  const entries = [{ id: 'source', path: 'source.txt', role: 'source' }, { id: 'audit', path: 'audit.txt', role: 'programmatic' }];
  const freeze = createFreeze(root, bytes, entries);
  const registry = newRegistry(contract, 'reviewer');
  return { root, contract, bytes, entries, freeze, registry };
}

const plan = (f, registry = f.registry, context = 'session-1', freeze = f.freeze, bytes = f.bytes) => planReads(f.root, bytes, freeze, registry, 'reviewer', context);
const read = (f, registry = f.registry, id = 'source') => acquireFile(f.root, f.bytes, f.freeze, registry, 'reviewer', 'session-1', id);

test('计划不登记已读，取得真实内容后只允许同上下文复用', t => {
  const f = fixture(t);
  assert.deepEqual(plan(f).files.map(x => x.action), ['acquire', 'acquire']);
  assert.equal(f.registry.records.length, 0);
  const result = read(f);
  assert.equal(result.content, 'original source');
  assert.equal(f.registry.records.length, 0);
  assert.deepEqual(plan(f, result.registry).files.map(x => x.action), ['eligible_for_reuse', 'acquire']);
  assert.ok(plan(f, result.registry, 'restored-context').files.every(x => x.action === 'acquire'));
});

test('实现者、其他审核者、其他任务不能继承登记', t => {
  const f = fixture(t);
  assert.throws(() => newRegistry(f.contract, 'main'), /不同/);
  assert.throws(() => validateRegistry(f.registry, f.contract, 'other-reviewer'), /不匹配/);
  assert.throws(() => validateRegistry(f.registry, { ...f.contract, task_id: 'other-task' }, 'reviewer'), /不匹配/);
});

test('冻结漂移或读取失败不会产生已读记录', t => {
  const f = fixture(t);
  assert.throws(() => read(f, f.registry, 'unknown'), /清单/);
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'changed');
  assert.throws(() => read(f), /变化/);
  assert.equal(f.registry.records.length, 0);
});

test('重新冻结后独立发现变化，合同变化使所有旧读取失效', t => {
  const f = fixture(t);
  const registry = read(f, read(f).registry, 'audit').registry;
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'changed');
  const next = createFreeze(f.root, f.bytes, f.entries);
  assert.deepEqual(plan(f, registry, 'session-1', next).files.map(x => x.action), ['acquire', 'eligible_for_reuse']);
  const bytes = Buffer.from(JSON.stringify({ ...f.contract, brief: 'new acceptance interpretation' }));
  const changedContract = createFreeze(f.root, bytes, f.entries);
  assert.ok(plan(f, registry, 'session-1', changedContract, bytes).files.every(x => x.action === 'acquire'));
});

test('新增、移除、改路径与改ID均不隐式继承读取', t => {
  const f = fixture(t); const registry = read(f).registry;
  fs.writeFileSync(path.join(f.root, 'copy.txt'), 'original source');
  const entries = [{ id: 'new-source', path: 'copy.txt', role: 'source' }, f.entries[1]];
  const next = createFreeze(f.root, f.bytes, entries);
  const result = plan(f, registry, 'session-1', next);
  assert.ok(result.files.every(x => x.action === 'acquire'));
  assert.deepEqual(result.removed_paths, ['source.txt']);
});

test('检测普通链篡改，不把哈希链当身份认证', t => {
  const f = fixture(t); const registry = read(f, read(f).registry, 'audit').registry;
  const altered = structuredClone(registry); altered.records[0].path = 'forged.txt';
  assert.throws(() => validateRegistry(altered, f.contract, 'reviewer'), /链/);
  const broken = structuredClone(registry); broken.records.reverse();
  assert.throws(() => validateRegistry(broken, f.contract, 'reviewer'), /链/);
  validateRegistry(registry, f.contract, 'reviewer');
});

test('二进制取得不伪装成实际看图', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, 'audit.txt'), Buffer.from([0, 255, 128]));
  f.freeze = createFreeze(f.root, f.bytes, f.entries);
  const result = read(f, f.registry, 'audit');
  assert.equal(result.content, null);
  assert.equal(result.binary_path, fs.realpathSync(path.join(f.root, 'audit.txt')));
  assert.match(result.warning, /不等于/);
});
