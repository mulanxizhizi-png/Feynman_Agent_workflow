import test from 'node:test';
import assert from 'node:assert/strict';
import { decideReview, impactKeys, reviewKeys } from '../src/review/gate.mjs';

const input = () => ({ schema_version: 1, task_id: 'gate-test', implementation_agent_id: 'main', change_summary: 'bounded change', assessment_basis: 'original diff and check output', readiness: { stable: true, checks_passed: true, evidence_complete: true }, impact: Object.fromEntries(impactKeys.map(k => [k, false])), review: { ...Object.fromEntries(reviewKeys.map(k => [k, false])), revision_changed: true, prior_reviewer_id: null, completed_rounds: 0 }, evidence: [{ id: 'diff', path: 'raw-diff.txt', sha256: 'a'.repeat(64), description: 'original diff' }] });

test('无预授权免审时，即使所有风险申报为false仍启动首次审核', () => {
  assert.equal(decideReview(input()).action, 'initial_review');
});
test('预授权低风险免审不能覆盖明确审核要求、实质影响或重要交付', () => {
  const x = input(); x.review.allow_low_risk_exemption = true; x.exemption_authorization = 'pre-agreed project policy';
  assert.equal(decideReview(x).action, 'self_check_only');
  x.review.explicitly_required = true; assert.equal(decideReview(x).action, 'initial_review');
  x.review.explicitly_required = false;
  for (const key of impactKeys) {
    x.impact[key] = true; assert.equal(decideReview(x).action, 'initial_review'); x.impact[key] = false;
  }
  x.review.important_delivery = true; assert.equal(decideReview(x).action, 'fresh_review');
});
test('未稳定、自检失败或证据不足先准备，不能启动正式验收或免审通过', () => {
  for (const key of ['stable', 'checks_passed', 'evidence_complete']) {
    const x = input(); x.readiness[key] = false; x.review.contamination = true;
    assert.equal(decideReview(x).action, 'prepare');
  }
});
test('普通返工复用原审核者；污染、共同设计、严重漏检、争议更换', () => {
  const x = input(); Object.assign(x.review, { prior_reviewer_id: 'reviewer', prior_review_valid: true, reviewer_context_available: true });
  assert.equal(decideReview(x).action, 'recheck');
  for (const key of ['contamination', 'co_design', 'severe_miss', 'material_dispute']) {
    x.review[key] = true; assert.equal(decideReview(x).action, 'fresh_review'); x.review[key] = false;
  }
  x.review.reviewer_context_available = false; assert.equal(decideReview(x).action, 'fresh_review');
});
test('旧审核合同或独立性失效不能复用；同冻结同合同有效结论不重复启动', () => {
  const x = input(); x.review.prior_reviewer_id = 'reviewer';
  assert.equal(decideReview(x).action, 'fresh_review');
  x.review.prior_review_valid = true; x.review.prior_review_passed = true; x.review.revision_changed = false;
  assert.equal(decideReview(x).action, 'reuse_approval');
  x.review.contamination = true; assert.equal(decideReview(x).action, 'fresh_review');
});
test('三轮到达上限停止新轮次；有效同版本结论仍能引用', () => {
  const x = input(); x.review.completed_rounds = 3; assert.equal(decideReview(x).action, 'stop');
  Object.assign(x.review, { prior_reviewer_id: 'reviewer', prior_review_valid: true, prior_review_passed: true, revision_changed: false });
  assert.equal(decideReview(x).action, 'reuse_approval');
});
test('拒绝未知事实、无授权、实现者代审、无证据和无效历史', () => {
  const x = input(); delete x.impact.meaning; assert.throws(() => decideReview(x), /未知/);
  const y = input(); y.review.allow_low_risk_exemption = true; assert.throws(() => decideReview(y), /authorization/);
  const z = input(); z.review.prior_reviewer_id = 'main'; assert.throws(() => decideReview(z), /实现者/);
  const w = input(); w.evidence = []; assert.throws(() => decideReview(w), /证据/);
  const a = input(); a.review.revision_changed = false; assert.throws(() => decideReview(a), /有效旧审核/);
});
test('决策绑定完整评估输入，修改事实或证据会改变绑定哈希', () => {
  const x = input(); const before = decideReview(x);
  x.impact.layout = true; const after = decideReview(x);
  assert.notEqual(before.assessment_sha256, after.assessment_sha256);
  assert.ok(after.reasons.includes('impact:layout'));
});
test('有效但未通过的旧报告不可复用批准，未知通过状态不能默认为通过', () => {
  const x = input(); Object.assign(x.review, { prior_reviewer_id: 'reviewer', prior_review_valid: true, prior_review_passed: false, revision_changed: false });
  assert.equal(decideReview(x).action, 'prepare');
  delete x.review.prior_review_passed; assert.throws(() => decideReview(x), /未知/);
  const y = input(); y.review.prior_review_passed = true; assert.throws(() => decideReview(y), /无效旧审核/);
});
