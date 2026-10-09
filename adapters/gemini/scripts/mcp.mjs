import { createInterface } from 'node:readline';
import { apiConnectionCheck, apiVisualReview } from './gemini-api.mjs';

const tools = [
  { name: 'gemini_connection_check', description: '用GEMINI_API_KEY向官方Gemini 3.8 Flash API进行一次文字连通测试；消耗一次请求。', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'gemini_visual_review', description: '可选旧schema 2外部诊断：截图七维评分与建议，不决定schema 3交付状态。默认关闭，需要显式启用及进程GEMINI_API_KEY，仅审核不修改页面。', inputSchema: { type: 'object', properties: {
    brief: { type: 'string', description: '最新用户要求、审核目标以及本轮已修改的内容。' },
    screenshots: { type: 'array', minItems: 1, items: { type: 'string' }, description: '实际渲染截图的绝对路径。' },
    references: { type: 'array', items: { type: 'string' }, description: '参考图绝对路径。' },
    rulesPath: { type: 'string', description: '本次项目 AGENTS.md 或视觉要求的绝对路径。' },
    previousReviewPath: { type: 'string', description: '上一轮review.json绝对路径；复验使用同一评分标准和问题ID。' },
    model: { type: 'string', description: '默认gemini-3.8-flash。Pro当前免费额度为0，不自动升级付费。' },
  }, required: ['brief', 'screenshots'], additionalProperties: false } },
];

function send(message) { process.stdout.write(JSON.stringify(message) + '\n'); }
let busy = false;
async function handle(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.method !== 'string') {
    send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });
    return;
  }
  const { id, method, params = {} } = request;
  if (id === undefined) return;
  try {
    let result;
    if (method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'gemini-visual-review', version: '0.2.0' } };
    else if (method === 'ping') result = {};
    else if (method === 'tools/list') result = { tools };
    else if (method === 'tools/call') {
      if (busy) throw new Error('Gemini 正在审核另一轮，请等待结束后再调用。');
      if (!tools.some(tool => tool.name === params.name)) throw new Error('未知工具。');
      busy = true;
      try {
        const data = params.name === 'gemini_connection_check' ? await apiConnectionCheck() : await apiVisualReview(params.arguments);
        result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], isError: false };
      } finally { busy = false; }
    } else { send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }); return; }
    send({ jsonrpc: '2.0', id, result });
  } catch (error) {
    if (method === 'tools/call') send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message }], isError: true } });
    else send({ jsonrpc: '2.0', id, error: { code: -32603, message: error.message } });
  }
}
createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', line => {
  try { void handle(JSON.parse(line)); }
  catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
});
