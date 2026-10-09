#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createFreeze, verifyFreeze, validateIndependentReview, diagnosticScores } from '../src/review/contract.mjs';
import { newRegistry, planReads, acquireFile } from '../src/review/context.mjs';
import { decideReview } from '../src/review/gate.mjs';

const usage = `Offline workflow tools (JSON on stdout, errors on stderr)
  decide <root> <assessment.json>
  freeze <root> <contract.json> <files.json>
  verify <root> <contract.json> <freeze.json>
  check <root> <contract.json> <freeze.json> <review.json> [previous.json]
  context init|plan|read <root> <contract.json> <freeze.json> <reviewer-id> <context-id> [registry.json] [file-id]
  help
No command starts agents, browsers or paid APIs. check exit 0 means structurally valid, not delivery approved.`;
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const output = value => console.log(JSON.stringify(value, null, 2));

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'help' || command === '--help') { console.log(usage); }
  else if (command === 'decide') {
    if (args.length !== 2) throw Error(usage);
    const [root, assessmentPath] = args;
    const assessment = json(assessmentPath);
    const decision = decideReview(assessment);
    const base = fs.realpathSync(root);
    for (const e of assessment.evidence) {
      if (path.isAbsolute(e.path) || e.path.split(/[\\/]/).includes('..')) throw Error('启动证据必须为根目录内相对路径');
      const target = fs.realpathSync(path.resolve(base, e.path));
      if (!target.startsWith(base + path.sep) || !fs.statSync(target).isFile()) throw Error('启动证据越界或不是普通文件');
      const bytes = fs.readFileSync(target);
      if (!bytes.length || hash(bytes) !== e.sha256) throw Error('启动证据为空或已变化');
    }
    output(decision);
  } else if (['freeze', 'verify', 'check'].includes(command)) {
    if (args.length < 3 || args.length > (command === 'check' ? 5 : 3) || (command === 'check' && args.length < 4)) throw Error(usage);
    const [root, contractPath, filePath, reportPath, previousPath] = args;
    const bytes = fs.readFileSync(contractPath);
    if (command === 'freeze') output(createFreeze(path.resolve(root), bytes, json(filePath)));
    else {
      const freeze = verifyFreeze(path.resolve(root), bytes, json(filePath));
      if (command === 'verify') output({ valid: true, revision_id: freeze.revision_id });
      else {
        const report = validateIndependentReview(json(reportPath), JSON.parse(bytes), freeze, previousPath ? json(previousPath) : null);
        output({ valid: true, revision_id: freeze.revision_id, round_status: report.round_status, technical_status: report.technical_status, global_status: report.global_status, independence_status: report.independence_evidence?.status ?? 'unverified', scores: diagnosticScores(report), boundary: '结构与哈希一致不等于交付或独立性已验证；须核对实际原始记录与各状态。' });
      }
    }
  } else if (command === 'context') {
    const [mode, root, contractPath, freezePath, owner, contextId, registryPath, fileId] = args;
    const expected = { init: 6, plan: 7, read: 8 }[mode];
    if (!expected || args.length !== expected) throw Error(usage);
    const bytes = fs.readFileSync(contractPath); const freeze = json(freezePath);
    const registry = mode === 'init' ? newRegistry(JSON.parse(bytes), owner) : json(registryPath);
    if (mode === 'init') { planReads(path.resolve(root), bytes, freeze, registry, owner, contextId); output(registry); }
    else if (mode === 'plan') output(planReads(path.resolve(root), bytes, freeze, registry, owner, contextId));
    else output(acquireFile(path.resolve(root), bytes, freeze, registry, owner, contextId, fileId));
  } else throw Error(usage);
} catch (error) { console.error(error.message); process.exitCode = 1; }
