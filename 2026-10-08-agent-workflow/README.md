# 执行脚本

完整使用说明见仓库根 README.md，协作技能见 ../.agents/skills/astra-sol-gemini/SKILL.md。

- npm test：12项离线本地测试，不使用API密钥。
- npm run api-check：一次官方Flash文字连通请求。
- npm run api-review -- /absolute/request.json：真实截图七维评分。
- node scripts/gemini-api.mjs stdin-review：从stdin读取{key,requestPath}，凭据不进argv或记录。
- npm run mcp：只读审核工具服务，需要进程GEMINI_API_KEY，不自动启动Codex。
- npm run browser-request / browser-record：生成输入副本和记录消费者Gemini网页回复；不能伪装AI Studio来源。
- login/check/review：旧Antigravity适配器，需自行获取官方CLI和满足账号资格，目前不是已验证可用路径。

所有审核输出写runtime，默认代理http://127.0.0.1:7897，可用GEMINI_PROXY覆盖（无代理设为空）。
默认模型gemini-3.8-flash为2026-10-08实际测试值，模型权限与额度以当前账号为准。
失败保留failure.json，不自动重试、不自动开通付费、不修改页面。
