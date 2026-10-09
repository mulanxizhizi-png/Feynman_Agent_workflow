import { createHash } from 'node:crypto';

export const policyVersion = '1.0';
const requiredText = (v, name) => { if (typeof v !== 'string' || !v.trim()) throw Error(`${name} 必须非空`); };
const booleans = (object, keys, name) => {
  if (!object || typeof object !== 'object') throw Error(`${name} 必须为对象`);
  for (const key of keys) if (typeof object[key] !== 'boolean') throw Error(`${name}.${key} 必须明确为布尔值，未知不能当false`);
};
export const impactKeys = ['behavior', 'meaning', 'layout', 'permissions_or_data', 'shared_rules_or_dependencies'];
export const reviewKeys = ['explicitly_required', 'allow_low_risk_exemption', 'prior_review_valid', 'prior_review_passed', 'revision_changed', 'reviewer_context_available', 'contamination', 'co_design', 'severe_miss', 'material_dispute', 'important_delivery'];

export function decideReview(input) {
  if (input.schema_version !== 1) throw Error('启动评估须为schema 1');
  for (const key of ['task_id', 'implementation_agent_id', 'change_summary', 'assessment_basis']) requiredText(input[key], key);
  booleans(input.readiness, ['stable', 'checks_passed', 'evidence_complete'], 'readiness');
  booleans(input.impact, impactKeys, 'impact');
  booleans(input.review, reviewKeys, 'review');
  const r = input.review;
  if (!Number.isInteger(r.completed_rounds) || r.completed_rounds < 0) throw Error('completed_rounds 必须为非负整数');
  if (r.prior_reviewer_id !== null) requiredText(r.prior_reviewer_id, 'prior_reviewer_id');
  if (r.prior_reviewer_id === input.implementation_agent_id) throw Error('实现者不能充当独立审核者');
  if (r.prior_review_valid && !r.prior_reviewer_id) throw Error('有效旧审核必须有实际审核者ID');
  if (r.prior_review_passed && !r.prior_review_valid) throw Error('不能把无效旧审核标为已通过');
  if (!r.revision_changed && !r.prior_review_valid) throw Error('没有有效旧审核时，不能声称版本无需新审核');
  if (r.allow_low_risk_exemption) requiredText(input.exemption_authorization, 'exemption_authorization');
  if (!Array.isArray(input.evidence) || !input.evidence.length) throw Error('启动评估必须引用原始证据');
  for (const e of input.evidence) {
    for (const key of ['id', 'path', 'description']) requiredText(e[key], `evidence.${key}`);
    if (!/^[a-f0-9]{64}$/.test(e.sha256)) throw Error('启动证据须有SHA256');
  }
  if (new Set(input.evidence.map(e => e.id)).size !== input.evidence.length || new Set(input.evidence.map(e => e.path)).size !== input.evidence.length) throw Error('启动证据ID或路径重复');
  const result = (action, reasons) => ({ schema_version: 1, task_id: input.task_id, policy_version: policyVersion, assessment_sha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'), action, reasons, evidence_ids: input.evidence.map(e => e.id), boundary: '确定性规则仅处理输入事实；不认证评估者身份、不判断风险申报真实性，也不启动Agent。' });
  const notReady = Object.entries(input.readiness).filter(([key, value]) => ['stable', 'checks_passed', 'evidence_complete'].includes(key) && !value).map(([key]) => key);
  if (notReady.length) return result('prepare', notReady.map(key => `not_ready:${key}`));
  const replace = ['contamination', 'co_design', 'severe_miss', 'material_dispute'].filter(key => r[key]);
  if (r.prior_review_valid && r.prior_review_passed && !r.revision_changed && !replace.length) return result('reuse_approval', ['same_frozen_revision_and_contract:prior_approval_valid']);
  if (r.prior_review_valid && !r.prior_review_passed && !r.revision_changed && !replace.length) return result('prepare', ['prior_revision_not_approved:fix_or_supply_evidence']);
  if (r.completed_rounds >= 3) return result('stop', ['round_limit:report_remaining_items_without_claiming_pass']);
  if (replace.length) return result('fresh_review', replace.map(key => `replace_reviewer:${key}`));
  if (r.important_delivery) return result('fresh_review', ['important_delivery:independent_final_review']);
  if (r.prior_reviewer_id) {
    if (!r.prior_review_valid || !r.reviewer_context_available) return result('fresh_review', ['prior_review_or_context_unavailable']);
    return result('recheck', ['same_independent_reviewer:changed_revision_and_affected_dependencies']);
  }
  if (r.explicitly_required) return result('initial_review', ['user_or_contract_requires_independent_review']);
  const impacts = impactKeys.filter(key => input.impact[key]);
  if (!impacts.length && r.allow_low_risk_exemption) return result('self_check_only', ['preauthorized_low_risk:all_impact_flags_false']);
  return result('initial_review', impacts.length ? impacts.map(key => `impact:${key}`) : ['no_preauthorized_exemption']);
}
