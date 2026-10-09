import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootFiles = new Set(['AGENTS.md', 'README.md', 'package.json', 'package-lock.json', '.gitignore', '.gitattributes']);
const directories = new Set(['.agents', '.codex', '.github', 'bin', 'src', 'scripts', 'tests', 'docs', 'examples', 'prompts', 'adapters']);
const extensions = new Set(['.md', '.mjs', '.py', '.json', '.toml', '.yml', '.yaml', '.txt', '.ps1']);
const ignored = new Set(['.git', 'runtime', 'node_modules', '__pycache__', '.DS_Store', 'config.local.toml']);

export function distributionPaths(root = repositoryRoot) {
  const result = [];
  const walk = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (relative === 'MANIFEST.json') continue;
      if (entry.isSymbolicLink()) throw Error(`发布范围不允许软链: ${relative}`);
      if (!prefix && !(entry.isDirectory() ? directories.has(entry.name) : rootFiles.has(entry.name))) throw Error(`发现工作流发布范围外文件: ${relative}`);
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative);
      else if (entry.isFile()) {
        if (prefix && !extensions.has(path.extname(entry.name))) throw Error(`发布范围不允许此文件类型: ${relative}`);
        result.push(relative);
      } else throw Error(`不是普通发布文件: ${relative}`);
    }
  };
  walk(root);
  return result.sort();
}

export function buildManifest(root = repositoryRoot) {
  return { format: 1, files: distributionPaths(root).map(relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    if (!bytes.length) throw Error(`发布文件为空: ${relative}`);
    return { path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }) };
}

export function verifyManifest(root = repositoryRoot) {
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'MANIFEST.json'), 'utf8'));
  const actual = buildManifest(root);
  if (JSON.stringify(stored) !== JSON.stringify(actual)) throw Error('MANIFEST与实际文件范围/内容不一致，请重新生成并审查差异');
  return { valid: true, files: actual.files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [mode, root = repositoryRoot] = process.argv.slice(2);
    if (!['build', 'check'].includes(mode)) throw Error('用法: node scripts/manifest.mjs build|check [root]');
    console.log(JSON.stringify(mode === 'build' ? buildManifest(root) : verifyManifest(root), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
