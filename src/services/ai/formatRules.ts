export interface FormatRule {
  name: string
  tag?: string
  syntax: string
  purpose: string
  constraints: string[]
  example: string
  allowedParents?: string[]
}

/**
 * AI 使用的排版规则单一来源。新增组件时，应先在这里补充规则，
 * 再让 Prompt 和后续的输出校验共同使用。
 */
export const R_MARKDOWN_FORMAT_RULES: FormatRule[] = [
  {
    name: '渐变背景文字',
    syntax: '==文字==',
    purpose: '强调短语或关键词',
    constraints: ['只包裹短语，不包裹整段或标题', '不要连续堆叠使用'],
    example: '这是 ==重要结论==。',
  },
  {
    name: '柔光重点文字',
    syntax: '::文字::',
    purpose: '突出需要读者注意的观点',
    constraints: ['只包裹短语', '不要与其他内联强调语法嵌套'],
    example: '请记住 ::先验证，再扩展::。',
  },
  {
    name: '胶囊文字',
    syntax: '!!文字!!',
    purpose: '标记状态、标签或简短分类',
    constraints: ['内容保持简短', '不要用于完整句子'],
    example: '状态：!!已完成!!',
  },
  {
    name: '强调文字',
    syntax: '^^文字^^',
    purpose: '加强一句话中的核心信息',
    constraints: ['只包裹核心短语', '避免每段使用'],
    example: '^^先解决问题，再优化体验。^^',
  },
  {
    name: '导语',
    tag: 'lead',
    syntax: '<lead>内容</lead>',
    purpose: '概括文章背景或阅读价值',
    constraints: ['通常放在正文开头', '保持为一段简洁文字'],
    example: '<lead>这篇文章将解释如何...</lead>',
  },
  {
    name: '步骤',
    tag: 'steps',
    syntax: '<steps>内容</steps>',
    purpose: '表达有先后顺序的操作流程',
    constraints: ['仅用于确实存在顺序的内容', '步骤数量保持合理'],
    example: '<steps>1. 第一步\n2. 第二步</steps>',
  },
  {
    name: '对比',
    tag: 'compare',
    syntax: '<compare>内容</compare>',
    purpose: '展示方案、状态或观点的差异',
    constraints: ['必须存在明确的对比关系', '两侧内容应保持同等粒度'],
    example: '<compare>改造前：...\n改造后：...</compare>',
  },
  {
    name: '行动召唤',
    tag: 'cta',
    syntax: '<cta>内容</cta>',
    purpose: '引导读者采取明确行动',
    constraints: ['只在文章确实需要行动时使用', '行动应具体可执行'],
    example: '<cta>现在就检查你的配置。</cta>',
  },
  {
    name: '时间线',
    tag: 'timeline',
    syntax: '<timeline>内容</timeline>',
    purpose: '表达时间顺序或发展历程',
    constraints: ['事件必须包含时间或顺序信息', '不要把普通列表强行改成时间线'],
    example: '<timeline>2024：发布第一版\n2025：...</timeline>',
  },
  {
    name: '图表',
    tag: 'chart',
    syntax: '<chart>内容</chart>',
    purpose: '表达数据关系或趋势',
    constraints: ['不得编造原文没有的数据', '数据不足时应返回警告'],
    example: '<chart>类别,数值\nA,10\nB,20</chart>',
  },
  ...[
    ['主标题', 'title', '<title type="DA01">标题</title>', '文章主标题卡片'],
    ['段落标题', 'p-title', '<p-title level="2">标题</p-title>', '带层级的段落标题'],
    ['阅读路线', 'reading-path', '<reading-path />', '根据一级段落标题生成阅读路线'],
    ['突发卡片', 'breaking', '<breaking title="标题">内容</breaking>', '突出重大更新'],
    ['案例流程', 'case-flow', '<case-flow>内容</case-flow>', '表达连续案例或实践流程'],
    ['徽章', 'badges', '<badges>标签一, 标签二</badges>', '展示短标签集合'],
    ['强调语', 'statement', '<statement>核心观点</statement>', '展示独立核心观点'],
    ['互动引导', 'engage', '<engage>互动内容</engage>', '文章末尾互动引导'],
    ['轮播图', 'slider', '<slider>图片内容</slider>', '展示多张相关图片'],
    ['图片组件', 'img', '<img src="URL" alt="说明" />', '展示可配置图片'],
    ['Mermaid', 'mermaid', '<mermaid>graph TD; A-->B</mermaid>', '展示流程或关系图'],
    ['扩展表格', 'table', '<table>Markdown 表格</table>', '展示复杂表格'],
    ['横向布局', 'row', '<row><column>内容</column></row>', '并列展示内容'],
    ['纵向布局', 'column', '<column>内容</column>', '作为横向布局中的列'],
    ['通用容器', 'container', '<container>内容</container>', '组合相关内容'],
    ['文本样式', 'text', '<text>文字</text>', '设置局部文本样式'],
    ['原生 HTML', 'html', '<html>HTML 内容</html>', '透传必要的原生 HTML'],
    ['层叠容器', 'stack', '<stack>内容</stack>', '建立定位舞台'],
    ['定位层', 'positioned', '<positioned>内容</positioned>', '在层叠容器内定位内容'],
  ].map(([name, tag, syntax, purpose]): FormatRule => ({
    name,
    tag,
    syntax,
    purpose,
    constraints: [
      '仅在内容结构确实需要时使用',
      ...(tag === 'positioned' ? ['只能放在 <stack> 内'] : []),
      ...(tag === 'column' ? ['优先放在 <row> 内'] : []),
      ...(tag === 'html' ? ['除非其他语法无法表达，否则不要生成原生 HTML'] : []),
    ],
    example: syntax,
    allowedParents: tag === 'positioned' ? ['stack'] : tag === 'column' ? ['row'] : undefined,
  })),
]

export function formatRulesAsPrompt(rules = R_MARKDOWN_FORMAT_RULES): string {
  return rules
    .map(
      (rule) =>
        `- ${rule.name}: ${rule.syntax}\n  用途：${rule.purpose}\n  约束：${rule.constraints.join('；')}\n  示例：${rule.example}`,
    )
    .join('\n')
}
