import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyFreeze } from './contract.mjs';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw Error(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// A receipt records bytes acquired by this tool, not comprehension, image viewing or identity proof.
export function validateRegistry(registry, contract, owner) {
  if (!nonempty(owner) || owner === contract.implementation_agent_id) fail('审核者必须不同于实现者');
  if (registry.schema_version !== 1 || registry.task_id !== contract.task_id || registry.owner !== owner || !Array.isArray(registry.records)) fail('登记任务或审核者不匹配');
  let previous = null;
  for (const record of registry.records) {
    const { digest, ...payload } = record;
    if (payload.previous !== previous || digest !== hash(JSON.stringify(payload))) fail('登记链发生变化');
    if (payload.type !== 'acquired' || !nonempty(payload.context_id) || !nonempty(payload.path) || !nonempty(payload.file_id) || !/^[a-f0-9]{64}$/.test(payload.sha256) || !/^[a-f0-9]{64}$/.test(payload.contract_sha256) || !/^[a-f0-9]{64}$/.test(payload.revision_id)) fail('登记记录不完整');
    previous = digest;
  }
  return registry;
}

export function newRegistry(contract, owner) {
  return validateRegistry({ schema_version: 1, task_id: contract.task_id, owner, records: [] }, contract, owner);
}

function verified(root, bytes, freeze, registry, owner, contextId) {
  const contract = JSON.parse(bytes);
  validateRegistry(registry, contract, owner);
  if (!nonempty(contextId)) fail('必须提供实际审核上下文 ID');
  verifyFreeze(root, bytes, freeze);
  return contract;
}

export function planReads(root, bytes, freeze, registry, owner, contextId) {
  verified(root, bytes, freeze, registry, owner, contextId);
  const files = freeze.files.map(file => {
    const seen = registry.records.some(record => record.context_id === contextId && record.contract_sha256 === freeze.contract_sha256 && record.file_id === file.id && record.path === file.path && record.sha256 === file.sha256);
    return { ...file, action: seen ? 'eligible_for_reuse' : 'acquire', reason: seen ? '同一审核者与上下文已取得相同字节；语义依赖仍需审核者判断' : '当前上下文未取得此合同下的当前字节' };
  });
  return { revision_id: freeze.revision_id, files, removed_paths: [...new Set(registry.records.map(record => record.path))].filter(p => !freeze.files.some(file => file.path === p)), warning: '此计划不是验收结论；须独立检查清单完整性、改动影响、图像实际查看及未解决问题。' };
}

export function acquireFile(root, bytes, freeze, registry, owner, contextId, fileId) {
  verified(root, bytes, freeze, registry, owner, contextId);
  const file = freeze.files.find(entry => entry.id === fileId);
  if (!file) fail('文件不在冻结清单内');
  // Recheck both path containment and bytes at the actual read; no implementer-supplied read flags.
  const base = fs.realpathSync(root);
  const target = fs.realpathSync(path.resolve(base, file.path));
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('读取路径越界');
  const content = fs.readFileSync(target);
  if (hash(content) !== file.sha256) fail('读取期间冻结内容变化');
  const payload = { type: 'acquired', context_id: contextId, contract_sha256: freeze.contract_sha256, revision_id: freeze.revision_id, file_id: file.id, path: file.path, sha256: hash(content), previous: registry.records.at(-1)?.digest ?? null };
  const record = { ...payload, digest: hash(JSON.stringify(payload)) };
  const next = { ...registry, records: [...registry.records, record] };
  let text = null;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); if (text.includes('\0')) text = null; } catch { /* Binary must be viewed with the appropriate tool. */ }
  return { registry: next, receipt: record, content: text, binary_path: text === null ? target : null, warning: '取得字节不等于实际阅读或看图；仅审核者可确认完成审查。' };
}
