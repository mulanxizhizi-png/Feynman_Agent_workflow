import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildManifest, verifyManifest } from '../scripts/manifest.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-integrity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'README.md'), 'fixture workflow');
  fs.mkdirSync(path.join(root, 'runtime')); fs.writeFileSync(path.join(root, 'runtime/private.txt'), 'must not distribute');
  fs.writeFileSync(path.join(root, '.DS_Store'), 'ignored');
  return root;
}
test('发布清单排除运行产物，拒绝遗漏/漂移/新未登记文件', t => {
  const root = fixture(t); const manifest = buildManifest(root);
  assert.deepEqual(manifest.files.map(f => f.path), ['README.md']);
  fs.writeFileSync(path.join(root, 'MANIFEST.json'), JSON.stringify(manifest));
  verifyManifest(root);
  fs.writeFileSync(path.join(root, 'README.md'), 'changed'); assert.throws(() => verifyManifest(root), /不一致/);
  fs.writeFileSync(path.join(root, 'README.md'), 'fixture workflow');
  fs.mkdirSync(path.join(root, 'docs')); fs.writeFileSync(path.join(root, 'docs/new.md'), 'new');
  assert.throws(() => verifyManifest(root), /不一致/);
});
test('发布范围拒绝业务文件、私密文件和二进制类型', t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'business.html'), 'not workflow');
  assert.throws(() => buildManifest(root), /范围外/); fs.unlinkSync(path.join(root, 'business.html'));
  fs.mkdirSync(path.join(root, 'docs')); fs.writeFileSync(path.join(root, 'docs/private.env'), 'secret fixture');
  assert.throws(() => buildManifest(root), /文件类型/); fs.unlinkSync(path.join(root, 'docs/private.env'));
  fs.writeFileSync(path.join(root, 'docs/product.png'), 'binary fixture'); assert.throws(() => buildManifest(root), /文件类型/);
});
