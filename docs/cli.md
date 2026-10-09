# 离线CLI

在仓库根目录运行node bin/workflow.mjs；其他目录使用该文件绝对路径。Node.js 22+。所有输入JSON路径按命令的当前工作目录解析；root必须是实际目标项目根目录，证据清单/评估内部path均相对root。输出JSON到stdout，错误到stderr并退出1。help输出文本。

## 启动决定

```text
node bin/workflow.mjs decide <root> <assessment.json>
```

输入见 [评估示例](../examples/review-assessment.example.json)，定义见 [策略](review-policy.md)。输出action、reasons、policy_version、assessment_sha256和evidence_ids。该哈希绑定JSON解析后再序列化的内容，不是原文件排版的字节哈希。工具核对每项证据实际文件SHA256；不会验证申报真实性或自动派Agent。

## 冻结、校验和报告

```text
node bin/workflow.mjs freeze <root> <contract.json> <files.json>
node bin/workflow.mjs verify <root> <contract.json> <freeze.json>
node bin/workflow.mjs check <root> <contract.json> <freeze.json> <review.json> [previous.json]
```

freeze输出含合同字节哈希和文件哈希的版本；verify核对磁盘；check同时校验schema3条件、证据、状态和旧问题链。成功退出只表示结构有效，changes_requested/inconclusive也可能退出0；必须读取round_status、technical_status、global_status、independence_status。身份/阅读未验证不得因为valid=true宣传独立通过。

输出可重定向到新的runtime文件，不能覆盖输入文件。npm别名workflow-decide/workflow-freeze/workflow-check存在；重定向JSON时用npm run --silent，避免npm日志污染。

## 审核者取证

```text
node bin/workflow.mjs context init <root> <contract.json> <freeze.json> <reviewer-id> <context-id>
node bin/workflow.mjs context plan <root> <contract.json> <freeze.json> <reviewer-id> <context-id> <registry.json>
node bin/workflow.mjs context read <root> <contract.json> <freeze.json> <reviewer-id> <context-id> <registry.json> <file-id>
```

init输出空登记。plan给出acquire或eligible_for_reuse，不登记已读。read从磁盘取得当前冻结字节，输出content/binary_path、receipt与新的registry。审核者确认输出完整后原样保存registry字段，串行更新，禁止覆盖输入登记。二进制另用合适工具实际查看；大文本截断不得认定已读。详细失效与代存规则见 [上下文协议](reviewer-context.md)。

## 仓库维护

```text
npm test
npm run test:core
npm run test:gemini
npm run validate
node scripts/manifest.mjs build
node scripts/manifest.mjs check
```

test:gemini和validate中的适配器测试是离线模拟/本地传输，不调用外部服务。真正外部请求仅在显式启用后运行 [适配器命令](../adapters/gemini/README.md)。所有核心模块可导入复用，无需解析CLI输出；模块本身不验证模型身份或自动取得Agent工具记录。
