# Astra · Sol · Gemini 工作流

一个 Codex 主对话统筹，GPT-6.1 Sol 执行，GPT-6 Astra 独立审核，Gemini 官方 API 对真实页面截图做七维评分并生成可直接执行的修改提示词。

这是可复用的流程、配置和脚本包。它依赖 Codex 原生 Agent 能力与允许访问目标页面的浏览器工具；不是已实现的无人值守后台服务。

## 包含什么

- `.agents/skills/astra-sol-gemini/`：完整协作顺序、角色边界、返工与证据规则。
- `.codex/agents/`：Sol 执行者与 Astra 独立审核者模型配置。
- `.codex/config.toml`：主模型和 MCP 配置模板，MCP 默认关闭。
- `2026-10-08-agent-workflow/scripts/`：官方 Gemini API、只读 MCP、七维报告校验、浏览器记录和旧 CLI 备用适配器。
- `2026-10-08-agent-workflow/prompts/visual-review.txt`：中文视觉评分提示词。
- `examples/`：请求示例；`docs/`：流程、实际验证与原项目规则。
- `.github/workflows/`：代码验证和可手动触发的 Gemini Secret 连通检查。

未打包运行缓存、OAuth凭据、Google账号密码、项目截图、181MB CLI二进制及原业务项目。Gemini密钥存于此仓库的GitHub Actions加密Secret，不进入Git历史或ZIP。

## 本地开始

要求：可用的 Codex Agent 环境、Node.js（本地验证使用22）、Python 3。脚本无npm第三方依赖。

1. 克隆或下载，选择 GPT-6 Astra 主模型。项目配置不会自动切换已有会话。
2. 在根目录调用 `$astra-sol-gemini`，给出目标项目、要求与可用预览地址。
3. 将目标项目的规则作为 rulesPath；原项目示例见 docs/native-html-project-rules.md。
4. 安全地向本地进程提供 GEMINI_API_KEY。GitHub Secret 不能从 clone 中读取；本地仍需自行提供凭据。
5. 运行本地检查：

```sh
cd 2026-10-08-agent-workflow
npm test
npm run api-review -- /absolute/path/request.json
```

不需要npm install。GEMINI_PROXY默认沿用历史本机代理http://127.0.0.1:7897；没有代理时显式设置为空字符串。GEMINI_PYTHON可指定Python执行路径。

## 评分和返工

每项满分10：视觉美观、留白、结构、可阅读性、层级清晰性、视觉一致性、图文与任务清晰性。
每次扣分都必须说明问题ID、图片和区域、可见证据、Agent修改指令、目标状态和复验条件。
报告输出完整 executor_prompt，主Agent裁决后发给Sol。
第二轮传 previousReviewPath，保持标准、复验相同问题ID；不能为满分移动标准。
看不到的维度为null；全部七维10且没有问题才是视觉pass。字体、CSS和交互仍须实际程序验收。

每轮记录在 runtime/reviews/，均被Git忽略。最多10张PNG/JPEG/WebP、单张15MB。没有真实页面截图时不调用模型来冒充整页审核。

## GitHub 密钥

仓库级 Actions Secret 名称：`GEMINI_API_KEY`。使用GitHub公钥在客户端加密后上传；这里只记录名称，不能读回明文。
Actions页手动运行 `Gemini secret connection check` 可测试一次官方API文字请求，会消耗一次请求。
默认代码验证不访问Gemini、不读取这个Secret。手动检查不是完整页面评审，也不启动Codex子Agent。
机制参考：[GitHub Actions Secrets 官方文档](https://docs.github.com/en/rest/actions/secrets)。

## 当前实际状态

已通过：12项本地测试；官方API文字、装饰图与七维JSON协议；Sol指定模型的真实委派及首个页面静态修改。
未完成：Astra最终审核（遇账户额度限制）、真实HTML截图（file://被浏览器策略拒绝）、完整页面Gemini评分与三模型返工闭环。
MCP未启用，密钥未自动同步至本机；常驻调度、截图服务和关闭应用后的自动运行未实现。
具体记录见 docs/validation.md，不能把“打包完成”视为“端到端验收完成”。

## 调研来源

[PAL MCP](https://github.com/BeehiveInnovations/pal-mcp-server)、[Agent Orchestrator](https://github.com/OrchestratorInc/agent-orchestrator)、[LangGraph](https://github.com/langchain-ai/langgraph)。本包采用原生子Agent与外部Gemini API，未将它们的代码复制进来。
