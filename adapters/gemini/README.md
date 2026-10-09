# 可选Gemini兼容适配器

默认关闭。只在用户明确启用后使用；核心流程不依赖本目录，不自动登录、调用、收费或修改代理。保留schema2外部诊断兼容，其全10状态不是schema3交付标准。接口/模型实际可用性需运行时核实，本仓库离线测试不证明外部API可用。

在仓库根目录运行：

```text
npm run gemini:api-check
npm run gemini:api-review -- <request.json>
npm run gemini:browser-request -- <request.json>
npm run gemini:browser-record -- <record.json>
npm run gemini:mcp
```

API通过GEMINI_API_KEY进程环境和Python子进程stdin传凭据；Python默认命令为python，可用GEMINI_PYTHON指定。本地HTTP代理参数仅作用于子请求，不修改全局代理。GitHub Secrets不随clone提供。MCP配置默认为enabled=false，启用前将command/args确认到本机路径。

CLI兼容模式使用scripts/gemini.mjs，需自行准备runtime/bin/agy.exe；这是Windows路径约定，不在仓库分发二进制。gemini:login为交互登录入口，登录缓存只存运行环境。install-antigravity.ps1是历史安装脚本快照，本次验证不执行，不保证上游当前安装入口不变。来源见 [第三方说明](THIRD_PARTY.md)。

运行资料保存在本目录runtime/，被Git忽略。请求格式见 [首轮示例](examples/request.example.json) 和 [复验示例](examples/recheck.example.json)，输入图片必须来自已授权任务且真实存在。旧提示词可生成修复建议，仅作外部诊断，不能让默认独立审核者参与实现或绕过新版合同。

离线回归：npm run test:gemini；Python本地传输测试：python3 adapters/gemini/tests/api-probe.test.py。Windows使用python。只有手动触发的Gemini连接工作流可能请求外部服务；日常源码CI不调用。
