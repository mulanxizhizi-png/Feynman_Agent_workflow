# 独立审核与证据协议（schema 3）

目标是让结论有依据、可复查、可争议，而不是把模型意见包装成普世真理。
使用默认模式：执行者 GPT-6 Sol / low 实现、自检和返工；统筹审核者 GPT-6.1 Sol / high 在新上下文只读检查冻结版本。统筹调度历史不能继承进首次盲审。
审核者不共同设计、不代写补丁。多模型一致仅是信号，不是用户研究、客观正确或审美共识的证明。

## 任务合同

开始实现前保存 task-contract.json，示例见 ../examples/task-contract.example.json。
字段：schema_version=3、task_id、implementation_agent_id、brief、criteria。
每条条件包含 id、scope（round/technical/global）、required、verification_type（visual/programmatic/document）、description、basis、verification。

条件要原子化：一个对象、一项目标、一个可观察验收结果。例如按钮排布、Input排布、Select排布、宽版通知、图表细字分别建ID。
源问题可以有共同父ID，但不要把不同完成状态塞进一个不可拆的问题。已授权工作必须列入round必需条件，不能通过移到global或required=false规避。
未知验收阈值可用明确可观察结果；从截图估算的数值须标估计。不要凭空编出统一字号或留白比例。
必要条件先确定，不能实现后以结果反推门槛。用户改变范围时建新合同并记录差异，保留未完成项。

## 冻结与独立上下文

执行者完成可验收版本后由统筹冻结合同、全部相关生产文件、截图及程序证据。截图元数据记录视口、缩放、页面状态、生成方式和时间。
freeze清单包含源码文件与证据的ID、相对路径、role、sha256；revision_id绑定合同和文件哈希。
role为source/screenshot/programmatic/reference。实际页面截图和参考图分开，参考图不能替代实际页面。
审查前后运行workflow-check核对；任何源码或证据变化均需重新冻结。证据应含影响区及直接依赖，避免只截最有利局部。
首轮与最终必要时检查全页；返工仅重验受影响区及保留条件。资源审计、字体/计算样式和交互需程序证据。

独立审核者从新上下文开始，仅收到中性合同、必要原始规则与证据路径，不收到实现者的自评分、目标分数、解释辩护或推荐结论。
先固定首次发现，再读取旧问题账本做ID匹配和复验；同一个独立审核者可复验自己提出的问题，但不能参与修复实现。
审核配置默认GPT-6.1 Sol/high、只读sandbox；父会话权限可能覆盖配置，仍明确禁止生产写入并核对哈希。
主 Agent 不能冒充审核者签字。身份/盲审字段是可追溯声明，JSON校验无法证明模型真的独立或真的看图；还须核对实际工具/委派记录。
进一步执行[审核者上下文与取证登记](reviewer-context.md)：审核者自有登记、哈希复核、上下文失效与污染处理。
schema 3结构通过不等于独立性通过；交付必须另附原始审核记录与独立性证据，缺失时标记独立性未验证。

## 问题与依据

每条issue必须有：id、criterion_ids、classification、severity、confidence、disposition、location、evidence_ids、observation、impact、basis、requested_change、verification。

| 分类 | 依据与处理 |
| --- | --- |
| requirement | 用户要求、项目规则或指定参考的明确不符合；可作为必须修复项 |
| technical | 可复现的功能、资源、内容完整性等缺陷；可作为必须修复项 |
| usability | 说明具体场景、观察及任务影响；关键风险证据充分才可阻断，未经验证记假设 |
| preference | 个人风格选择、替代方案；默认advisory，不阻断。若用户已经明确指定，应按requirement判断 |

severity为P0/P1/P2/P3，confidence为high/medium/low，disposition为required/advisory。
低置信度推测和纯偏好不得成为required。必需条件失败须有required问题，不能降为建议绕过。
依据优先级：最新用户要求 → 项目规则/指定参考 → 可复现缺陷 → 场景相关可用性证据 → 偏好。
引用通用原则时写清来源与适用范围；启发式不等于已验证的用户行为。涉及“普遍认可”须定义目标人群与场景，必要时列用户验证方案，不凭模型投票下结论。

## 报告与状态

报告包含 schema_version=3、task_id、revision_id、contract_sha256、summary、reviewer、criteria、issues、recheck、round_status、technical_status、global_status。
reviewer={agent_id, independent:true, initial_review_blind:true}，agent_id必须与合同实现者不同。
criteria逐条={id,status:pass/fail/unverified,reason,evidence_ids}；未验证可以缺证据，但必须说明缺什么。
visual通过或失败须引用screenshot，programmatic须引用programmatic，document须引用冻结证据（如规则快照/文档检查），不以source角色冒充检查。

三个scope分别推导状态：

- 存在必需条件fail：changes_requested。
- 无必需fail，但必需条件unverified：inconclusive。
- 必需条件通过，有建议/非必需失败或未验证：pass_with_notes。
- 已评估条件均满足且无建议：pass。
- 没有该scope条件：not_assessed，不能称整页通过。

本轮完成可以通过而全局仍需改进；这不会把原先授权内容自动变成遗留项。
交付至少要求本轮和技术均为pass/pass_with_notes，且明确展示整页状态；缺必要证据不能交付为“全部通过”。
建议不要求消失，分数不要求全10。技术工具降级须记录实际检查范围及未覆盖项，不把空报告当全面通过。

可选dimension_scores包含固定七维：aesthetics/whitespace/structure/readability/hierarchy/consistency/task_clarity。
每项{id,score,reason,evidence_ids}，score为0到10、0.5步长或null。分数是诊断意见，状态完全由条件与证据决定。
工具给未过度舍入的均分（3位小数）；不能把跨四舍五入边界宣传为显著改善。比较需同合同、同视口/缩放/状态和可观察差异；分数的0.5步长也不是统计测量精度。

## 返工、争议和停止

每个旧issue都必须recheck={id,status:resolved/open/unverified,reason,evidence_ids}。
open沿用ID和criterion_ids；resolved不再列为开放问题。
unverified必须继续保留在issues中，沿用ID、criterion_ids、classification与disposition；不能把对应条件标pass。
这类明确继承的未验证问题可以没有本轮证据ID，但必须说明缺什么并保持原处置；必需条件保持inconclusive。
不得以issues=[]丢弃待复验问题，否则下一轮会失去账本。只有明确resolved及本轮证据才可移出issues。
执行者按必要问题直接返工，自主决定实现方式；审核者只提供问题、目标与复验方法。
分歧另存decision-log，逐条记录issue ID、采纳/拒绝/待验证、理由与证据。拒绝必须修复项需审核者复核，不能自行删除并宣布独立通过。
纯偏好保留为建议。实质冲突先补证据；仍不明确才向用户说明具体取舍，不能用多数票覆盖用户要求。
不为10分循环。默认最多三次实现/独立审核，耗尽则交付剩余清单和未通过状态；实现工具失败不算一次成功审核。
范围不因失败自动缩减；流程试跑成功不代表原任务完成。

## 效率与验证边界

执行者连续完成一组任务后按启动策略审核，不按每个文件或步骤调度；只在模块可独立推进时增加实现worker。
同类工具错误两次换方法；立即报告文件状态，不反复格式化、覆盖或等待。保留有效改动，只恢复自身引入的破坏。
记录准备、实现、自检、独立审核、返工与工具恢复耗时；不把等待全算通信开销。无同基线对照实验，不宣称快几倍。
离线工具校验结构一致性、证据引用与文件哈希，不验证截图真实性、审美真理或实际模型权限，也不启动模型/浏览器。
旧Gemini schema 2适配器保留兼容，只作可选外部诊断，不能覆盖schema 3状态。
