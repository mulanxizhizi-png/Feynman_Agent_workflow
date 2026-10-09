import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dimensions } from './dimensions.mjs';

const scopes = ['round', 'technical', 'global'];
const roles = ['source', 'screenshot', 'programmatic', 'reference'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requiredText = (v, label) => { if (typeof v !== 'string' || !v.trim()) throw Error(`${label} 必须非空`); };
const list = (v, label) => { if (!Array.isArray(v)) throw Error(`${label} 必须是数组`); return v; };
const unique = (xs, label) => { if (new Set(xs).size !== xs.length) throw Error(`${label} 重复`); };
const sameIds = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function validateTaskContract(c) {
  if (c.schema_version !== 3) throw Error('任务合同须为 schema 3');
  for (const key of ['task_id', 'implementation_agent_id', 'brief']) requiredText(c[key], key);
  const cs = list(c.criteria, 'criteria');
  if (!cs.length) throw Error('必须有原子验收条件');
  unique(cs.map(x => x.id), 'criterion ID');
  for (const x of cs) {
    for (const key of ['id', 'description', 'basis', 'verification']) requiredText(x[key], `criterion.${key}`);
    if (!scopes.includes(x.scope) || typeof x.required !== 'boolean') throw Error('criterion 范围或必需标记无效');
    if (!['visual', 'programmatic', 'document'].includes(x.verification_type)) throw Error('verification_type 无效');
  }
  for (const scope of ['round', 'technical']) {
    if (!cs.some(x => x.scope === scope && x.required)) throw Error(`缺少 ${scope} 必需验收条件`);
  }
  return c;
}

function localFile(root, relative) {
  requiredText(relative, 'file.path');
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw Error('冻结路径须为根目录内相对路径');
  const base = fs.realpathSync(root);
  const actual = fs.realpathSync(path.resolve(base, relative));
  if (!actual.startsWith(base + path.sep) || !fs.statSync(actual).isFile()) throw Error('文件越界或不是普通文件');
  return actual;
}

function revisionId(contractSha, files) { return hash(JSON.stringify({ contract_sha256: contractSha, files })); }

export function createFreeze(root, contractBytes, entries) {
  validateTaskContract(JSON.parse(contractBytes));
  const files = list(entries, 'files').map(x => {
    requiredText(x.id, 'file.id');
    if (!roles.includes(x.role)) throw Error('file.role 无效');
    const bytes = fs.readFileSync(localFile(root, x.path));
    if (!bytes.length) throw Error('冻结文件或证据为空');
    return { id: x.id, path: x.path, role: x.role, sha256: hash(bytes) };
  });
  unique(files.map(x => x.id), 'file ID');
  unique(files.map(x => x.path), 'file path');
  if (!files.some(x => x.role === 'source') || !files.some(x => x.role === 'programmatic' || x.role === 'screenshot')) throw Error('冻结清单须含源码与实际证据');
  const contractSha = hash(contractBytes);
  return { schema_version: 1, contract_sha256: contractSha, revision_id: revisionId(contractSha, files), files };
}

export function verifyFreeze(root, contractBytes, freeze) {
  if (freeze.schema_version !== 1) throw Error('冻结清单版本无效');
  const actual = createFreeze(root, contractBytes, freeze.files);
  if (actual.contract_sha256 !== freeze.contract_sha256 || actual.revision_id !== freeze.revision_id || JSON.stringify(actual.files) !== JSON.stringify(freeze.files)) throw Error('合同、源码或证据已变化，须重新冻结与审核');
  return freeze;
}

export function scopeStatus(scope, contract, report) {
  const cs = contract.criteria.filter(x => x.scope === scope);
  const required = cs.filter(x => x.required);
  if (!cs.length) return 'not_assessed';
  const checks = report.criteria.filter(x => required.some(c => c.id === x.id));
  if (checks.some(x => x.status === 'fail')) return 'changes_requested';
  if (checks.some(x => x.status === 'unverified')) return 'inconclusive';
  const notes = report.issues.some(x => x.criterion_ids.some(id => cs.some(c => c.id === id)))
    || report.criteria.some(x => cs.some(c => c.id === x.id) && x.status !== 'pass');
  if (!required.length) return notes ? 'pass_with_notes' : 'pass';
  return notes ? 'pass_with_notes' : 'pass';
}

export function diagnosticScores(report) {
  if (!report.dimension_scores) return null;
  const ds = report.dimension_scores;
  list(ds, 'dimension_scores');
  if (!sameIds(ds.map(x => x.id), dimensions.map(x => x.id)) || ds.length !== 7) throw Error('可选评分须包含固定七维');
  for (const d of ds) {
    if (d.score !== null && (typeof d.score !== 'number' || !Number.isFinite(d.score) || d.score < 0 || d.score > 10 || !Number.isInteger(d.score * 2))) throw Error('诊断分使用0.5分步长或null，避免虚假精度');
    requiredText(d.reason, 'score.reason');
  }
  if (ds.some(x => x.score === null)) return { raw_average: null, diagnostic_only: true };
  return { raw_average: Number((ds.reduce((n, x) => n + x.score, 0) / 7).toFixed(3)), diagnostic_only: true };
}

export function validateIndependentReview(r, contract, freeze, previous = null) {
  validateTaskContract(contract);
  if (r.schema_version !== 3 || r.task_id !== contract.task_id) throw Error('审核版本或任务ID不一致');
  if (r.revision_id !== freeze.revision_id || r.contract_sha256 !== freeze.contract_sha256) throw Error('审核不是当前冻结版本');
  requiredText(r.summary, 'summary');
  const reviewer = r.reviewer;
  if (!reviewer || reviewer.agent_id === contract.implementation_agent_id || reviewer.independent !== true || reviewer.initial_review_blind !== true) throw Error('缺少独立审核身份与首轮盲审声明');
  requiredText(reviewer.agent_id, 'reviewer.agent_id');
  const evidence = ids => {
    list(ids, 'evidence_ids'); unique(ids, 'evidence ID');
    if (!ids.length || ids.some(id => !freeze.files.some(x => x.id === id && x.role !== 'source'))) throw Error('必须引用已冻结的实际证据');
  };
  const checks = list(r.criteria, 'review.criteria');
  unique(checks.map(x => x.id), 'review criterion ID');
  if (!sameIds(checks.map(x => x.id), contract.criteria.map(x => x.id))) throw Error('不能遗漏或新增验收条件');
  for (const x of checks) {
    if (!['pass', 'fail', 'unverified'].includes(x.status)) throw Error('criterion.status 无效');
    requiredText(x.reason, 'criterion.reason');
    if (x.status !== 'unverified') {
      evidence(x.evidence_ids);
      const c = contract.criteria.find(c => c.id === x.id);
      const hasRole = role => x.evidence_ids.some(id => freeze.files.some(f => f.id === id && f.role === role));
      if (c.verification_type === 'visual' && !hasRole('screenshot')) throw Error('视觉验收须引用实际截图');
      if (c.verification_type === 'programmatic' && !hasRole('programmatic')) throw Error('程序验收须引用程序证据');
    } else {
      list(x.evidence_ids, 'evidence_ids');
      if (x.evidence_ids.length) evidence(x.evidence_ids);
    }
  }
  const recheck = list(r.recheck, 'recheck');
  const old = previous?.issues ?? [];
  const carriedUnverified = x => {
    const prior = old.find(i => i.id === x.id);
    return prior && recheck.some(i => i.id === x.id && i.status === 'unverified')
      && sameIds(x.criterion_ids, prior.criterion_ids)
      && x.disposition === prior.disposition && x.classification === prior.classification;
  };
  const issues = list(r.issues, 'issues');
  unique(issues.map(x => x.id), 'issue ID');
  for (const x of issues) {
    for (const key of ['id', 'location', 'observation', 'impact', 'basis', 'requested_change', 'verification']) requiredText(x[key], `issue.${key}`);
    const ids = list(x.criterion_ids, 'criterion_ids'); unique(ids, 'issue criterion ID');
    if (!ids.length || ids.some(id => !contract.criteria.some(c => c.id === id))) throw Error('问题须对应冻结条件');
    list(x.evidence_ids, 'issue.evidence_ids');
    if (x.evidence_ids.length || !carriedUnverified(x)) evidence(x.evidence_ids);
    if (!['requirement', 'technical', 'usability', 'preference'].includes(x.classification) || !['P0', 'P1', 'P2', 'P3'].includes(x.severity) || !['high', 'medium', 'low'].includes(x.confidence) || !['required', 'advisory'].includes(x.disposition)) throw Error('问题分类/级别/置信度/处置无效');
    if (x.disposition === 'required') {
      if (x.classification === 'preference' || x.confidence === 'low') throw Error('纯偏好或低置信度推测不能阻断');
      if (!ids.some(id => contract.criteria.some(c => c.id === id && c.required) && checks.some(c => c.id === id && (c.status === 'fail' || (c.status === 'unverified' && carriedUnverified(x)))))) throw Error('必须修复项须关联失败或持续未验证的必需条件');
    }
  }
  for (const x of checks.filter(x => x.status === 'fail')) {
    const c = contract.criteria.find(c => c.id === x.id);
    if (!issues.some(i => i.criterion_ids.includes(x.id) && (!c.required || i.disposition === 'required'))) throw Error('失败条件须有可执行问题，必需条件不能降为建议');
  }
  if (previous && (previous.task_id !== contract.task_id || previous.contract_sha256 !== freeze.contract_sha256)) throw Error('复验合同变化，须建立新任务而非冒充同一轮标准');
  if (recheck.length !== old.length || !sameIds(recheck.map(x => x.id), old.map(x => x.id))) throw Error('旧问题须逐项复验');
  for (const x of recheck) {
    requiredText(x.reason, 'recheck.reason');
    if (!['resolved', 'open', 'unverified'].includes(x.status)) throw Error('recheck.status 无效');
    if (x.status !== 'unverified') evidence(x.evidence_ids);
    else { list(x.evidence_ids, 'recheck.evidence_ids'); if (x.evidence_ids.length) evidence(x.evidence_ids); }
    const now = issues.find(i => i.id === x.id);
    const prior = old.find(i => i.id === x.id);
    if (x.status === 'resolved' && now) throw Error('已解决项不能仍开放');
    if (x.status === 'open' && (!now || !sameIds(now.criterion_ids, prior.criterion_ids))) throw Error('开放问题不得改ID或转移对象');
    if (x.status === 'unverified' && (!now || !carriedUnverified(now))) throw Error('未验证的旧问题必须保留在issues，不能丢失或降级');
    if (x.status === 'unverified' && !prior.criterion_ids.some(id => checks.some(c => c.id === id && c.status === 'unverified'))) throw Error('旧问题未验证时不能把对应条件标通过');
  }
  for (const scope of scopes) if (r[`${scope}_status`] !== scopeStatus(scope, contract, r)) throw Error(`${scope} 状态与实际验收不符`);
  if (r.dimension_scores) {
    diagnosticScores(r);
    for (const d of r.dimension_scores) {
      list(d.evidence_ids, 'score.evidence_ids');
      if (d.score !== null) evidence(d.evidence_ids);
    }
  }
  return r;
}
