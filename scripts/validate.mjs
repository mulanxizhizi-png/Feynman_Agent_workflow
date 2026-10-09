import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repositoryRoot as root, distributionPaths, verifyManifest } from './manifest.mjs';

try {
  const files = distributionPaths(root);
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw Error(`${command} 检查失败: ${result.error?.message ?? result.stderr ?? result.stdout}`);
  };
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    if (text.includes('\0')) throw Error(`发布文件含二进制内容: ${file}`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bAIza[A-Za-z0-9_-]{30,}|\bsk-proj-[A-Za-z0-9_-]{30,}/.test(text)) throw Error(`发布文件含疑似凭据: ${file}`);
    if (file.endsWith('.json')) JSON.parse(text);
    if (file.endsWith('.mjs')) {
      run(process.execPath, ['--check', file]);
      for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
        const target = path.resolve(root, path.dirname(file), match[1]);
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) throw Error(`模块引用缺失或越界: ${file} -> ${match[1]}`);
      }
    }
    if (file.endsWith('.md')) {
      if (file.endsWith('/SKILL.md')) {
        const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
        if (!frontmatter || !frontmatter[1].includes(`name: ${path.basename(path.dirname(file))}\n`) || !/^description:\s*\S.+/m.test(frontmatter[1])) throw Error(`技能名称或frontmatter无效: ${file}`);
      }
      for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (!link || /^[a-z]+:/i.test(link)) continue;
        const target = path.resolve(root, path.dirname(file), decodeURIComponent(link));
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) throw Error(`文档链接缺失或越界: ${file} -> ${link}`);
      }
    }
  }
  const python = process.env.WORKFLOW_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  run(python, ['-c', "import sys; assert sys.version_info >= (3, 11), 'Python 3.11+ required; set WORKFLOW_PYTHON to a supported interpreter'"]);
  run(python, ['-c', "import ast,pathlib,tomllib; [ast.parse(pathlib.Path(p).read_text(encoding='utf-8'),filename=p) for p in __import__('sys').argv[1:] if p.endswith('.py')]; [tomllib.loads(pathlib.Path(p).read_text(encoding='utf-8')) for p in __import__('sys').argv[1:] if p.endswith('.toml')]", ...files.filter(p => /\.(py|toml)$/.test(p))]);
  run(process.execPath, ['--test', ...files.filter(p => p.endsWith('.test.mjs'))]);
  run(python, ['adapters/gemini/tests/api-probe.test.py']);
  const manifest = verifyManifest(root);
  console.log(JSON.stringify({ valid: true, distribution_files: manifest.files, checks: ['source_allowlist', 'syntax', 'json', 'toml', 'imports', 'document_links', 'credential_patterns', 'node_tests', 'python_transport_tests', 'manifest'], limits: '离线检查，不验证实际模型身份、外部API或用户效果；凭据模式扫描不是完整泄漏检测。' }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
