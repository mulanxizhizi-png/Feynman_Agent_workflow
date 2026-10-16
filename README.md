# 费曼 Agent · Feynman Agent

**独立实现，循证审核。**

让执行者连续实现、自检和修复，在适当的验收点由独立上下文的审核者检查结果。审核启动有明确条件，结论依赖原始证据和固定标准；不以模型一致、主观分数或“全 10 分”代表客观正确。

这个仓库只包含工作流、离线工具、模板和可选 Gemini 适配器。没有业务页面、素材或本机审核记录。当前版本为 **0.3.1**，发布仓库为 [sol-gemini-workflow](https://github.com/mulanxizhizi-png/sol-gemini-workflow)。

## 给 Agent 的最短入口

在此仓库中调用，或按 [跨项目安装说明](docs/install.md)安装用户级入口后调用：

```text
$feynman-agent
目标项目：<项目绝对路径>
任务：<实际要求>
请按工作流判断审核时机，保存启动理由，完成实现、自检与必要独立审核。
```

自然语言调用：“启动／开启／执行费曼 Agent，帮我……”。新会话选择 **GPT-6.1 Sol / high** 作为统筹主 Agent；执行与独立盲审分别委派到不同子 Agent 上下文。单纯讨论名称或机制不启动执行。

`$independent-review-workflow` 与历史调用名 `$sol-terra-gemini` 继续可用。费曼入口位于 [.agents/skills/feynman-agent/SKILL.md](.agents/skills/feynman-agent/SKILL.md)，复用 [完整工作流](.agents/skills/independent-review-workflow/SKILL.md)。不要只复制技能文件：它依赖仓库内的协议和工具。

默认执行者为 **GPT-6 Sol / low**，统筹审核者为 **GPT-6.1 Sol / high**。统筹调度与首次盲审使用分开的上下文；执行者负责生产写入，审核者不参与实施。配置不会切换已经运行的对话，也不证明实际模型或权限。Gemini 默认关闭，只有明确启用时才使用。

## 安装与本地检查

需要 Node.js 22+、Python 3.11+。无第三方 npm 依赖，无需 npm install。

```sh
git clone https://github.com/mulanxizhizi-png/sol-gemini-workflow.git
cd sol-gemini-workflow
node bin/workflow.mjs help
npm run validate
```

`npm run validate` 检查源码范围、语法、JSON/TOML、模块引用、文档链接、凭据模式、离线测试和发布清单哈希。它不请求外部模型，不证明真实页面效果或审核身份。Windows 默认调用 python；可通过 WORKFLOW_PYTHON 指定解释器。

## 什么时候审核

先按 [启动策略](docs/review-policy.md)填写评估和原始证据，再运行：

```sh
node bin/workflow.mjs decide /absolute/target /absolute/assessment.json
```

| 动作 | 触发条件 | 下一步 |
| --- | --- | --- |
| prepare | 版本不稳定、自检失败或必要证据不足 | 先实现、修复或补证据；不签发通过 |
| self_check_only | 预先允许免审、无明确独立审核要求、全部影响项均否且无其他强制触发 | 保留自检记录，明确本次未独立审核 |
| initial_review | 存在实质影响、明确审核要求，或没有预授权免审策略 | 完整版本冻结后，新上下文首次审核 |
| recheck | 原审核有效、上下文可用、普通返工 | 同一审核者检查改动区、依赖和旧问题 |
| fresh_review | 污染、共同设计、严重漏检、实质争议、重要交付或原审核/上下文不可用 | 全新审核者终审；不继承旧结论 |
| reuse_approval | 相同合同和冻结版本已有适用且有效的审核结论，未发现独立性失效 | 引用原报告，不重复启动 |
| stop | 已完成三轮，仍需启动新的审核轮次 | 报告剩余问题与未通过状态 |

不按代码行数决定风险。免审必须有事先确定的任务或项目策略，不能在验收失败后临时启用。启动工具只执行固定规则并核对所引证据的字节，不能确认统筹申报是否真实，也不会启动 Agent。

## 一次完整闭环

1. 读取用户要求与目标项目规则，建立原子验收合同；执行者连续完成工作和自检。
2. 保存原始检查/截图/差异证据，记录影响评估与审核启动理由。
3. 冻结合同、相关源码、原始证据和中性阅读索引；首次可读资料与旧结论分阶段隔离。
4. 审核者先保存自己的首次发现，再接触历史结论；自行复现关键检查，不写生产文件或实施补丁。
5. 实现者修复必要问题；普通返工由原审核者增量复验，触发失效条件才换人。
6. 分别报告本轮、技术、全局状态和独立性证据。测试退出 0 或报告格式正确不等于交付通过。

命令示例：

```sh
node bin/workflow.mjs freeze /absolute/target /absolute/contract.json /absolute/files.json > /absolute/freeze.json
node bin/workflow.mjs verify /absolute/target /absolute/contract.json /absolute/freeze.json
node bin/workflow.mjs check /absolute/target /absolute/contract.json /absolute/freeze.json /absolute/review.json
```

复验时在 check 末尾追加上一轮报告路径。完整参数、退出码、取证登记用法见 [CLI 文档](docs/cli.md)。

## 独立性与客观性的边界

审核者自有登记只记录取得了哪些字节，不证明读懂或看图。哈希链、owner 字段和只读模板不是身份认证或强制权限隔离。上下文丢失或更换审核者后，旧登记只能作索引，不能继承“已读”。

两个角色使用不同版本和思考程度，但仍同属一个模型系列，可能具有共同偏差。新上下文可以减少实现者解释和历史结论的直接影响。不同模型也不能替代目标用户验证。明确需求、可复现技术事实、任务相关可用性证据与审美偏好须分开；偏好默认不阻断，普遍性结论须说明用户、场景和验证来源。详见 [证据协议](docs/review-protocol.md)与 [上下文隔离协议](docs/reviewer-context.md)。

## 如何尽可能实现隔离、独立与防污染

### 1. 二者隔离：职责、写入范围与产物分开

| 角色 | 默认配置 | 可以做 | 不可以做 |
| --- | --- | --- | --- |
| 执行者 | GPT-6 Sol / low | 按合同实现、自检、修复，写目标生产文件 | 写审核登记/报告，代签或自定通过 |
| 统筹审核者 | GPT-6.1 Sol / high | 中性合同、启动判断、证据要求、独立审查与争议处理 | 共同设计实施方案、生成实施补丁或写被审生产文件 |

执行者和审核者有各自上下文及产物目录。审核目录仅由审核者维护；只读环境需要代存时，统筹逐字保存原始输出并由审核者核对，不能改写。审核前后核对冻结哈希，测试在审核者自己的临时副本中运行。只读配置可能被宿主覆盖，因此这是职责约束加证据核对，不冒充操作系统强隔离。

### 2. 二者独立性：首次判断不继承实施立场

统筹调度与独立盲审为不同上下文。首次审核/全新终审使用fork_turns=none，只收到原始要求、预先合同、原始资料与冻结路径。即使统筹没有直接写代码，只要看过实施解释，也不能用原上下文自称首次盲审。

审核者自行检查材料完整性、实际渲染/代码/检查结果，先保存首次发现及哈希，再读历史结论。验收依据优先用户要求和项目规则，其次可复现缺陷、场景相关可用性证据，个人偏好只作建议。执行者低思考不降低标准，审核者高思考不自动代表客观；同系列模型仍可能共同漏检。对普遍用户认同须有目标人群、场景及真实验证，不能用双方一致替代。

### 3. 互相上下文不污染：限制传什么，而非完全不通信

| 方向 | 允许传递 | 不传递 |
| --- | --- | --- |
| 统筹 → 执行者 | 原始要求/规则、中性合同、允许修改范围；返工的问题事实、目标、证据和保留条件 | 统筹私有评估、审核私有推理、预期评分或推荐通过结论 |
| 执行者 → 首次盲审 | 冻结源码、原始差异/截图/程序结果及元数据、证据路径 | 自评分、设计辩护、引导性摘要、推荐结论、替审核者写的已读声明 |
| 历史资料 → 审核者 | 首次发现固定后读取旧问题账本做ID复验 | 首次判断前读取旧评分、旧通过结论、验证总结 |

审核者的取证登记按任务、审核者、合同、上下文和实际文件哈希绑定；实现者不能代登记。上下文丢失/换人须重新取证，不继承对方摘要。必要的事实传递和返工意见属于任务协作，不承诺二者完全不受任何信息影响。发现越界评价输入、串用上下文或共同设计，记录来源、停止复用旧通过，按轮次限制更换全新审核者。

当前共享文件系统没有强制身份认证和不可改写日志。工具不会自动隔离消息或识别所有评价性文字，须由宿主按技能/提示词执行并保留委派记录。运行模型/权限不可见时明确未验证，不用配置、哈希或owner字段补签。

## 目录与按需阅读

```text
.agents/skills/       主技能与历史别名
.codex/              审核者/可选实现者配置模板
bin/workflow.mjs     统一离线 CLI
src/review/          合同、冻结、取证上下文、审核启动规则
scripts/             发布清单和仓库验证
tests/               原生流程回归测试
prompts/             中性审核委派提示词
examples/            合同、启动评估、证据清单、阅读索引模板
docs/                策略、协议、命令、架构与验证方法
adapters/gemini/     显式启用的旧外部诊断，默认不调用
runtime/             本机运行产物，被 Git 忽略，不发布
```

其他 Agent 按目的读取，不必加载整仓库：

- 安装调用：[安装说明](docs/install.md) → [费曼入口](.agents/skills/feynman-agent/SKILL.md)。
- 执行任务：[完整工作流](.agents/skills/independent-review-workflow/SKILL.md) → [启动策略](docs/review-policy.md)。
- 独立审核：[审核协议](docs/review-protocol.md) → [上下文协议](docs/reviewer-context.md) → [审核提示词](prompts/independent-review.txt)。
- 调用工具：[CLI](docs/cli.md)；代码可直接导入 src/review 的导出函数，无模型依赖。
- 修改仓库：[架构](docs/architecture.md) → [验证方法](docs/validation.md)。
- 启用 Gemini：[可选适配器](adapters/gemini/README.md)，不加载其旧评分规则到默认流程。

## 从旧目录迁移

日期目录 2026-10-08-agent-workflow 已退出发布结构。原生 scripts/workflow-review.mjs 改为 bin/workflow.mjs；review-context 命令改为统一入口下的 context 子命令。旧 Gemini 命令统一添加 gemini: 前缀，代码位于 adapters/gemini/。

本机旧报告、备份和验证历史只在被忽略的 runtime/ 中保留，不作为首次审核输入。克隆仓库不会获得运行记录、凭据或 GitHub Secrets。本仓库没有常驻调度器，所有模型委派和发布均由宿主 Agent 在获得授权后执行。
