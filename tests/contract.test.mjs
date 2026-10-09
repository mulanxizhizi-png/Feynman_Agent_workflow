import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dimensions } from '../src/review/dimensions.mjs';
import { createFreeze, verifyFreeze, validateIndependentReview, diagnosticScores } from '../src/review/contract.mjs';

const fixture = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'independent-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'source.txt'), 'source revision A');
  fs.writeFileSync(path.join(root, 'audit.json'), '{"fixture":true,"check":"sample"}');
  const contract = { schema_version: 3, task_id: 'demo', implementation_agent_id: 'main', brief: '离线协议测试，不是真实视觉审核', criteria: [
    { id: 'R1', scope: 'round', required: true, verification_type: 'document', description: '完成指定文档变更', basis: '测试任务要求', verification: '文档审查证据' },
    { id: 'T1', scope: 'technical', required: true, verification_type: 'programmatic', description: '程序检查', basis: '测试技术要求', verification: '审计结果' },
    { id: 'G1', scope: 'global', required: false, verification_type: 'document', description: '全局建议', basis: '范围外观察', verification: '文档审查' },
  ] };
  const bytes = Buffer.from(JSON.stringify(contract));
  const entries = [{ id: 'source', path: 'source.txt', role: 'source' }, { id: 'audit', path: 'audit.json', role: 'programmatic' }];
  const freeze = createFreeze(root, bytes, entries);
  const report = { schema_version: 3, task_id: 'demo', revision_id: freeze.revision_id, contract_sha256: freeze.contract_sha256, summary: '离线fixture', reviewer: { agent_id: 'reviewer', independent: true, initial_review_blind: true }, criteria: contract.criteria.map(c => ({ id: c.id, status: 'pass', reason: 'fixture证据', evidence_ids: ['audit'] })), issues: [], recheck: [], round_status: 'pass', technical_status: 'pass', global_status: 'pass' };
  const issue = (id = 'V1', criterion = 'R1') => ({ id, criterion_ids: [criterion], classification: 'requirement', severity: 'P2', confidence: 'high', disposition: 'required', location: 'source.txt具体段落', evidence_ids: ['audit'], observation: '明确要求未实现', impact: '本轮任务不完整', basis: '冻结任务要求', requested_change: '完成该段要求', verification: '重新检查该段' });
  return { root, contract, bytes, entries, freeze, report, issue };
};

test('分数仅诊断：非全10仍可按完成条件通过', t => {
  const f = fixture(t);
  f.report.dimension_scores = dimensions.map(d => ({ id: d.id, score: 8.5, reason: '诊断评价，非阻断依据', evidence_ids: ['audit'] }));
  validateIndependentReview(f.report, f.contract, f.freeze);
  assert.equal(diagnosticScores(f.report).raw_average, 8.5);
  f.report.dimension_scores[0].score = 9.7;
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /0.5/);
});

test('原任务未完成不能以高分或建议降级标通过', t => {
  const f = fixture(t); f.report.criteria[0].status = 'fail'; f.report.issues = [f.issue()];
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /round/);
  f.report.round_status = 'changes_requested'; validateIndependentReview(f.report, f.contract, f.freeze);
  f.report.issues[0].disposition = 'advisory';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /降为建议/);
});

test('纯偏好不阻断，建议明确保留', t => {
  const f = fixture(t); const i = f.issue(); i.classification = 'preference';
  f.report.criteria[0].status = 'fail'; f.report.issues = [i]; f.report.round_status = 'changes_requested';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /纯偏好/);
  i.disposition = 'advisory'; f.report.criteria[0].status = 'pass'; f.report.round_status = 'pass_with_notes';
  validateIndependentReview(f.report, f.contract, f.freeze);
});

test('低置信度推测不能作必须修复项', t => {
  const f = fixture(t); f.report.criteria[0].status = 'fail'; f.report.issues = [f.issue()];
  f.report.issues[0].classification = 'usability'; f.report.issues[0].confidence = 'low'; f.report.round_status = 'changes_requested';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /低置信度/);
});

test('本轮、技术与全局状态独立，范围外建议不冒充本轮失败', t => {
  const f = fixture(t); f.report.criteria[2].status = 'fail'; const i = f.issue('G-1', 'G1'); i.disposition = 'advisory';
  f.report.issues = [i]; f.report.global_status = 'pass_with_notes';
  validateIndependentReview(f.report, f.contract, f.freeze);
  f.report.criteria[1] = { id: 'T1', status: 'unverified', reason: '缺真实程序证据', evidence_ids: [] };
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /technical/);
  f.report.technical_status = 'inconclusive'; validateIndependentReview(f.report, f.contract, f.freeze);
});

test('拒绝实现者代签、无盲审声明和遗漏验收条件', t => {
  const f = fixture(t); f.report.reviewer.agent_id = 'main';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /独立/);
  f.report.reviewer.agent_id = 'reviewer'; f.report.reviewer.initial_review_blind = false;
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /独立/);
  f.report.reviewer.initial_review_blind = true; f.report.criteria.pop();
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /遗漏/);
});

test('源码、证据、合同与冻结清单篡改都使旧审核失效', t => {
  const f = fixture(t); verifyFreeze(f.root, f.bytes, f.freeze);
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'source revision B');
  assert.throws(() => verifyFreeze(f.root, f.bytes, f.freeze), /变化/);
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'source revision A');
  fs.writeFileSync(path.join(f.root, 'audit.json'), '{"different":true}');
  assert.throws(() => verifyFreeze(f.root, f.bytes, f.freeze), /变化/);
  fs.writeFileSync(path.join(f.root, 'audit.json'), '{"fixture":true,"check":"sample"}');
  assert.throws(() => verifyFreeze(f.root, Buffer.from(JSON.stringify({ ...f.contract, brief: '改动标准' })), f.freeze), /变化/);
  f.freeze.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verifyFreeze(f.root, f.bytes, f.freeze), /变化/);
});

test('拒绝不存在证据、源码冒充证据、非截图冒充视觉验证', t => {
  const f = fixture(t); f.report.criteria[0].evidence_ids = ['missing'];
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /证据/);
  f.report.criteria[0].evidence_ids = ['source'];
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /证据/);
  f.report.criteria[0].evidence_ids = ['audit']; f.contract.criteria[0].verification_type = 'visual';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze), /实际截图/);
});

test('路径不能越界、软链越界或使用空文件', t => {
  const f = fixture(t);
  assert.throws(() => createFreeze(f.root, f.bytes, [{ id: 'x', path: '../x', role: 'source' }]), /相对路径/);
  fs.symlinkSync(os.tmpdir(), path.join(f.root, 'outside'), 'junction');
  assert.throws(() => createFreeze(f.root, f.bytes, [{ id: 'x', path: 'outside', role: 'source' }]));
  fs.writeFileSync(path.join(f.root, 'empty'), '');
  assert.throws(() => createFreeze(f.root, f.bytes, [{ id: 'x', path: 'empty', role: 'source' }]), /为空/);
});

test('旧问题必须逐项复验，不能换ID或未验证却通过', t => {
  const f = fixture(t); const previous = structuredClone(f.report); previous.issues = [f.issue()]; previous.criteria[0].status = 'fail'; previous.round_status = 'changes_requested';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze, previous), /逐项/);
  f.report.recheck = [{ id: 'V1', status: 'resolved', reason: '已按证据复验', evidence_ids: ['audit'] }];
  validateIndependentReview(f.report, f.contract, f.freeze, previous);
  f.report.recheck[0].status = 'open'; f.report.issues = [f.issue('V2')]; f.report.criteria[0].status = 'fail'; f.report.round_status = 'changes_requested';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze, previous), /不得改ID/);
  f.report.recheck[0].status = 'unverified'; f.report.recheck[0].evidence_ids = []; f.report.issues = [f.issue()]; f.report.criteria[0].status = 'pass'; f.report.round_status = 'pass';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze, previous), /必须修复项须关联/);
  f.report.criteria[0].status = 'unverified'; f.report.criteria[0].evidence_ids = []; f.report.round_status = 'inconclusive';
  validateIndependentReview(f.report, f.contract, f.freeze, previous);
});

test('独立审核回归：连续三轮未验证不能遗失必需问题，明确解决才通过', t => {
  const f = fixture(t); const first = structuredClone(f.report);
  first.criteria[0].status = 'fail'; first.round_status = 'changes_requested'; first.issues = [f.issue()];
  validateIndependentReview(first, f.contract, f.freeze);
  const second = structuredClone(f.report);
  second.criteria[0] = { id: 'R1', status: 'unverified', reason: '缺复验资料', evidence_ids: [] };
  second.round_status = 'inconclusive';
  second.recheck = [{ id: 'V1', status: 'unverified', reason: '缺复验资料', evidence_ids: [] }];
  assert.throws(() => validateIndependentReview(second, f.contract, f.freeze, first), /必须保留/);
  second.issues = [{ ...f.issue(), evidence_ids: [] }];
  validateIndependentReview(second, f.contract, f.freeze, first);
  const third = structuredClone(f.report);
  assert.throws(() => validateIndependentReview(third, f.contract, f.freeze, second), /逐项复验/);
  const pending = structuredClone(second);
  validateIndependentReview(pending, f.contract, f.freeze, second);
  assert.equal(pending.round_status, 'inconclusive');
  third.recheck = [{ id: 'V1', status: 'resolved', reason: '明确复验解决并有证据', evidence_ids: ['audit'] }];
  validateIndependentReview(third, f.contract, f.freeze, second);
});

test('复验不能悄悄更换合同或转移旧问题对象', t => {
  const f = fixture(t); const previous = structuredClone(f.report); previous.issues = [f.issue()];
  f.report.criteria[1].status = 'fail'; f.report.issues = [f.issue('V1', 'T1')]; f.report.technical_status = 'changes_requested';
  f.report.recheck = [{ id: 'V1', status: 'open', reason: '旧问题', evidence_ids: ['audit'] }];
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze, previous), /转移对象/);
  previous.contract_sha256 = 'different';
  assert.throws(() => validateIndependentReview(f.report, f.contract, f.freeze, previous), /合同变化/);
});

test('真实CLI离线冻结、校验与过期证据失败退出', t => {
  const f = fixture(t); const cli = fileURLToPath(new URL('../bin/workflow.mjs', import.meta.url));
  const write = (name, obj) => { const p = path.join(f.root, name); fs.writeFileSync(p, JSON.stringify(obj)); return p; };
  const c = write('contract.json', f.contract); const files = write('files.json', f.entries);
  const freeze = JSON.parse(execFileSync(process.execPath, [cli, 'freeze', f.root, c, files], { encoding: 'utf8' }));
  const frozen = write('freeze.json', freeze); const r = write('review.json', f.report);
  const result = JSON.parse(execFileSync(process.execPath, [cli, 'check', f.root, c, frozen, r], { encoding: 'utf8' }));
  assert.equal(result.valid, true); assert.equal(result.round_status, 'pass');
  fs.writeFileSync(path.join(f.root, 'source.txt'), 'changed');
  const fail = spawnSync(process.execPath, [cli, 'check', f.root, c, frozen, r], { encoding: 'utf8' });
  assert.equal(fail.status, 1); assert.match(fail.stderr, /重新冻结/);
});
