---
name: astra-sol-gemini
description: Astra 计划与独立审核、Sol 实现、Gemini 官方 API 七维截图评分与返工；用户要求三模型协作或明确调用本技能时使用。
---

# Astra / Sol / Gemini

一个主对话统筹，无需用户手工同步两个主对话。主模型请在应用中选择 GPT-6 Astra；
文件不会自动切换已开始的对话模型，无法确认时不要宣称已切换。
子 Agent 配置在 `.codex/agents/`：sol_worker 使用 gpt-6.1-sol，astra_reviewer 使用 gpt-6-astra。
按当前环境支持的原生委派工具实际指定模型；没有该能力时如实说明。

## 工作闭环

1. 读取最新要求及目标项目 AGENTS.md，冻结本轮范围、资料和验收标准。
2. 委派 Sol 实现；它是该轮唯一的页面写入者。读取目标所需技能和视觉基准，保留原文原图。
3. Sol 完成检查并冻结版本。通过获准的浏览器工具获取真实页面截图、计算样式、字体及交互证据。
   浏览器拒绝导航时停止该操作，不绕过，不用组件素材或代码推断冒充渲染截图。
4. 同一版本交给独立 Astra 审核差异与技术证据，Gemini 审阅实际截图。
5. 主 Agent 裁决；用户要求、事实与项目规则优先。仅将获采纳问题交给 Sol。
6. 修改后重新检查、重新截图，传 previousReviewPath 逐项复验旧问题 ID，最多三轮，用户另定上限优先。
7. 缺少资料、模型额度、截图、真实审核或 API 失败时记录未完成，不伪造通过或刷分。

## Gemini API

在 `2026-10-08-agent-workflow/` 运行 `npm run api-review -- /absolute/request.json`。
凭据读取进程 GEMINI_API_KEY；也可使用 `node scripts/gemini-api.mjs stdin-review`，
stdin 格式 `{key, requestPath}` 或 `{key, request}`。不得把密钥保存到请求、源码或日志。
请求有 brief、实际截图 screenshots 绝对路径数组，可选 references、rulesPath、previousReviewPath、model。
默认 gemini-3.8-flash 是 2026-10-08 实测模型；权限和配额可能变化，失败如实报告，不自动升级付费。
GEMINI_PROXY 可覆盖代理；未设置时历史默认值为 http://127.0.0.1:7897。
没有本地代理时显式设置 GEMINI_PROXY 为空字符串。GEMINI_PYTHON 可指定 Python。

七维：视觉美观、留白、结构、可阅读性、层级清晰性、视觉一致性、图文与任务清晰性。
各维满分10，缺证据为null；低于10必须关联问题ID、具体图片区域、证据、目标状态、
Agent修改指令、复验条件与满分预期。全部七维10且无问题才是视觉pass，不能替代技术验收。
executor_prompt 是给 Sol 的完整返工提示词，须先由主 Agent 裁决。
返工固定同一标准，旧ID全部recheck，不移动目标，不为高分重复请求。

脚本将请求副本、图片哈希、原始输出、review.json 和 executor-prompt.txt 保存到 runtime/reviews/。
失败保存 failure.json，不自动重试。503 可表示暂时容量不足；429 可能表示额度不足，不能混淆。
store:false 不等于关闭免费层级全部数据使用政策；发送资料须属于用户授权范围。

## 已验证与限制

2026-10-08：官方 Flash API 文字、原始装饰图、JSON七维协议通过；装饰图不足以评完整页面，
模型正确返回 inconclusive/null。消费者 Gemini 网页和 Antigravity 当时受地区限制，
它们仅作保留的备用尝试，不自动登录、切代理或视为可用。
首个飞瓜页面试运行：Sol 真实执行并完成静态修改；Astra准备审核后最终轮遇额度限制；
file:// 导航被浏览器策略拒绝，真实页面截图与 Gemini 页面评分没有完成。
不能把此仓库的存在描述为三模型端到端流程已经通过。

MCP 默认禁用。启用前配置绝对脚本路径和安全的进程凭据，启动后验证实际工具可用。
GitHub Actions Secret 仅供 GitHub 运行，不随 clone 下发到本机。
关闭应用后的常驻调度、OAuth续期、自动截图与故障恢复未实现。
