import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensions, scoringPrompt, validateScoredReview } from '../scripts/review-contract.mjs';
import { parseReview } from '../scripts/gemini.mjs';

const perfect = () => ({ schema_version: 2, status: 'pass', summary: '满足冻结标准', reviewed_images: ['screen-01.png'], overall_score: 10, dimension_scores: dimensions.map(d => ({ id: d.id, score: 10, evidence: 'screen-01.png的具体证据', issue_ids: [] })), issues: [], executor_prompt: '无需返工，继续程序验收。', technical_checks: ['实际字体加载'], recheck: [] });
const deducted = () => {
  const result = perfect();
  result.status = 'changes_requested'; result.overall_score = 9.7;
  result.dimension_scores[0].score = 8; result.dimension_scores[0].issue_ids = ['V001'];
  result.issues.push({ id: 'V001', severity: 'P3', image: 'screen-01.png', location: '介绍标题', dimensions: ['aesthetics'], problem: '标题偏移', evidence: '标题与说明左边缘不齐', target_state: '左边缘对齐', suggestion: '统一标题与说明的左对齐基线，保留文本。', verification: '新截图核对基线一致。', expected_score: 10 });
  return result;
};

test('新版七维满分报告与可执行扣分报告通过', () => {
  validateScoredReview(parseReview(JSON.stringify(perfect()), ['screen-01.png']), null);
  validateScoredReview(parseReview(JSON.stringify(deducted()), ['screen-01.png']), null);
});
test('拒绝无依据扣分、只给总分和未对应的修改意见', () => {
  const missingIssue = deducted(); missingIssue.issues = [];
  assert.throws(() => validateScoredReview(missingIssue, null));
  const onlyTotal = perfect(); onlyTotal.dimension_scores = [];
  assert.throws(() => validateScoredReview(onlyTotal, null));
  const mismatched = deducted(); mismatched.issues[0].dimensions = ['hierarchy'];
  assert.throws(() => validateScoredReview(mismatched, null));
});
test('资料不足必须inconclusive且不能伪装满分', () => {
  const result = perfect(); result.dimension_scores[0].score = null; result.overall_score = null;
  assert.throws(() => validateScoredReview(result, null));
  result.status = 'inconclusive'; validateScoredReview(result, null);
  result.overall_score = 10; assert.throws(() => validateScoredReview(result, null));
});
test('旧问题必须逐项复验并保留未解决ID', () => {
  const previous = deducted(); const next = deducted();
  assert.throws(() => validateScoredReview(next, previous));
  next.recheck = [{ id: 'V001', status: 'open', evidence: '新截图仍不齐。' }];
  validateScoredReview(next, previous);
  next.issues[0].id = 'V002'; next.dimension_scores[0].issue_ids = ['V002'];
  assert.throws(() => validateScoredReview(next, previous));
  const resolved = perfect(); resolved.recheck = [{ id: 'V001', status: 'resolved', evidence: '新截图左边缘一致。' }];
  validateScoredReview(resolved, previous);
});
test('固定标准要求每项扣分给Agent修改动作和复验条件', () => {
  const prompt = scoringPrompt(['screen-01.png'], deducted());
  for (const value of ['满分10分', 'target_state', 'executor_prompt', 'recheck', '不移动验收目标', 'V001']) assert.ok(prompt.includes(value));
});
