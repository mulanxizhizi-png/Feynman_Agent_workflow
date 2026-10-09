// Optional diagnostics shared by native review and the legacy Gemini adapter.
export const dimensions = [
  ['aesthetics', '视觉美观', '构图、色彩、字体与装饰服务桌面产品阅读任务，符合指定参考；不按营销页偏好扣分。'],
  ['whitespace', '留白', '模块分组、内边距、间距与密度合理，遵守项目令牌，没有重复留白、拥挤或割裂。'],
  ['structure', '结构', '内容顺序与业务主线清楚，截图、说明、分支和状态配对正确。'],
  ['readability', '可阅读性', '文字大小、行长、对比、行距和截图清晰度支持阅读，关键内容完整可见。'],
  ['hierarchy', '层级清晰性', '页面、区块、方式与旁注层级明确，重点突出且不互相竞争。'],
  ['consistency', '视觉一致性', '同类组件的字体、色彩、圆角、对齐、间距与标注方式统一。'],
  ['task_clarity', '图文与任务清晰性', '图文对应准确，操作时机、状态变化和下一步清楚，不编造业务。'],
].map(([id, name, full_score_standard]) => ({ id, name, full_score_standard }));
