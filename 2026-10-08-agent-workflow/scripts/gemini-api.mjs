import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, prepareVisualReview, parseReview } from './gemini.mjs';
import { dimensions, validateScoredReview } from './review-contract.mjs';

export async function callApi(config, options = {}) {
  const key = options.key ?? process.env.GEMINI_API_KEY;
  if (typeof key !== 'string' || !key.trim()) throw new Error('未配置 GEMINI_API_KEY；密钥不得放入审核请求或项目文件。');
  const redact = value => String(value).split(key).join('[REDACTED]');
  const env = { ...process.env };
  delete env.GEMINI_API_KEY;
  delete env.GOOGLE_API_KEY;
  const child = spawn(options.python ?? process.env.GEMINI_PYTHON ?? 'python', ['-X', 'utf8', path.join(root, 'scripts', 'api-probe.py')], { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  return new Promise((resolve, reject) => {
    let out = '', err = '', timeout = false, tooLarge = false;
    const timer = setTimeout(() => { timeout = true; child.kill(); }, options.timeoutMs ?? 90000);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => {
      out += data;
      if (Buffer.byteLength(out) > 4 * 1024 * 1024) { tooLarge = true; child.kill(); }
    });
    child.stderr.on('data', data => { err = (err + data).slice(-4000); });
    child.stdin.on('error', () => {});
    child.once('error', error => { clearTimeout(timer); reject(new Error(redact(error.message))); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timeout || tooLarge) return reject(new Error('Gemini API 超时或输出过大，审核未完成；不自动重试。'));
      let result;
      try { result = JSON.parse(redact(out)); } catch { return reject(new Error(`API 传输未返回有效JSON：${redact(err)}`)); }
      if (code !== 0 || result.http_status || result.error) return reject(new Error(`Gemini API 调用失败：${JSON.stringify(result)}`));
      if (result.status !== 'completed' || typeof result.text !== 'string' || !result.text.trim()) return reject(new Error('Gemini API 未完成模型输出。'));
      resolve(result);
    });
    // Neither the secret nor inline image data enters argv or persisted records.
    child.stdin.end(JSON.stringify({ ...config, proxy: options.proxy ?? process.env.GEMINI_PROXY ?? 'http://127.0.0.1:7897', key }) + '\n');
  });
}

export async function apiConnectionCheck(options = {}) {
  const response = await callApi({ action: 'text', model: 'gemini-3.8-flash', prompt: '请只回复 GEMINI_CONNECTION_OK' }, options);
  if (response.text.trim() !== 'GEMINI_CONNECTION_OK') throw new Error('API连通检查未返回约定文本。');
  return { connected: true, backend: 'Gemini official API', model: response.model, total_tokens: response.total_tokens };
}

export async function apiVisualReview(input, options = {}) {
  // Reject missing credentials before copying private inputs or creating a job.
  if (!(options.key ?? process.env.GEMINI_API_KEY)) throw new Error('未配置 GEMINI_API_KEY。');
  const job = await prepareVisualReview(input);
  const checkHashes = async () => {
    for (let i = 0; i < job.files.length; i++) {
      const hash = createHash('sha256').update(await readFile(job.files[i])).digest('hex');
      if (hash !== job.hashes[job.images[i]]) throw new Error('审核期间图片已改变，不能记录为同一轮结果。');
    }
  };
  try {
    await checkHashes();
    const envelope = await callApi({ action: 'review', model: input.model ?? 'gemini-3.8-flash', prompt: job.prompt, json_output: true, images: job.files.map((file, i) => ({ path: file, name: job.images[i] })) }, options);
    // Save only model output and usage; no request headers, key or thought signatures.
    await writeFile(path.join(job.cwd, 'response.json'), JSON.stringify(envelope, null, 2));
    const review = validateScoredReview(parseReview(envelope.text, job.images), job.previous);
    await checkHashes();
    const report = { ...review, jobId: job.jobId, backend: 'Gemini official API', model: envelope.model, hashes: job.hashes, rubric: dimensions, review_basis: job.reviewBasis, previousReviewPath: input.previousReviewPath ?? null, recordedAt: new Date().toISOString(), total_tokens: envelope.total_tokens, reportPath: path.join(job.cwd, 'review.json') };
    await writeFile(report.reportPath, JSON.stringify(report, null, 2));
    await writeFile(path.join(job.cwd, 'executor-prompt.txt'), report.executor_prompt);
    return report;
  } catch (error) {
    // Failures consume quota too. Never retry merely to obtain a higher score.
    await writeFile(path.join(job.cwd, 'failure.json'), JSON.stringify({ status: 'failed', error: error.message }, null, 2));
    throw new Error(`${error.message}\n本轮记录：${job.cwd}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const command = process.argv[2];
    let report;
    if (command === 'check') report = await apiConnectionCheck();
    else if (command === 'review' && process.argv[3]) report = await apiVisualReview(JSON.parse(await readFile(process.argv[3], 'utf8')));
    else if (command === 'stdin-review') {
      let source = '';
      for await (const chunk of process.stdin) source += chunk;
      const { key, requestPath, request } = JSON.parse(source);
      report = await apiVisualReview(request ?? JSON.parse(await readFile(requestPath, 'utf8')), { key });
    } else throw new Error('用法：check | review <请求JSON> | stdin-review（凭据仅经stdin）');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
