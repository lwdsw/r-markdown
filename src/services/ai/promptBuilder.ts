import type { AIMessage, AIRequest } from './types'
import { formatRulesAsPrompt } from './formatRules'

const BASE_SYSTEM_PROMPT = `你是 R-Markdown 的公众号内容编辑助手。
你的输出必须遵守 R-Markdown 支持的 Markdown 和扩展组件语法。
不要编造事实、数据、引用或图片信息；原文没有的数据只能明确标记为缺失。
除非任务明确要求，否则保留原文的结构、链接、代码、公式和已有组件。
输出应适合移动端阅读：段落简洁、层级清晰、重点适度。
`

const TASK_INSTRUCTIONS: Record<AIRequest['task'], string> = {
  rewrite: '只改写文字表达，保留原有 Markdown 结构和组件；不要擅自增加新事实。',
  continue: '延续原文的语气、结构和排版规则，生成可以直接接在原文后的内容。',
  summarize: '生成简洁摘要，保留核心观点和事实；不要输出与原文无关的排版组件。',
  outline: '分析文章并输出清晰的标题层级和段落规划；不要直接伪造正文。',
  format: '优化文章结构和排版，可使用合适的 R-Markdown 组件，但不能为了视觉效果滥用组件。',
  title: '生成多个标题候选，标题简洁、准确，不使用未经证实的夸张承诺。',
  review: '检查内容质量、排版语法和发布风险，输出具体问题及修改建议，不直接改写全文。',
  compose: '根据用户提供的主题或提纲生成完整文章，事实不明确处必须标记待确认，不得虚构来源。',
  proofread: '只修复错别字、病句、标点和明显语法问题，不改变作者观点和文章结构。',
  social: '将文章改写为用户指定平台的发布文案，保留事实，适配平台阅读节奏。',
  cover: '根据文章生成简洁的封面主标题、副标题和视觉提示词，不直接生成图片。',
  diagram: '从原文已有关系中生成 Mermaid 图示；信息不足时返回警告，禁止补造节点或数据。',
}

const OUTPUT_CONTRACTS: Record<AIRequest['task'], string> = {
  rewrite: '{"content":"改写后的 Markdown","changes":[{"type":"replace","original":"原文片段","replacement":"新片段","reason":"修改原因"}],"warnings":[]}',
  continue: '{"content":"可直接接续的 Markdown","warnings":[]}',
  summarize: '{"summary":"摘要","content":"如任务要求则提供摘要 Markdown","warnings":[]}',
  outline: '{"content":"Markdown 标题层级和提纲","warnings":[]}',
  format: '{"content":"排版后的完整 Markdown","changes":[],"warnings":[]}',
  title: '{"titles":["标题候选 1","标题候选 2"],"warnings":[]}',
  review: '{"issues":[{"severity":"info|warning|error","message":"问题描述","suggestion":"修改建议","excerpt":"原文片段"}],"warnings":[]}',
  compose: '{"content":"符合 R-Markdown 规则的完整文章","warnings":[]}',
  proofread: '{"content":"校对后的完整 Markdown","changes":[],"warnings":[]}',
  social: '{"content":"平台适配文案","summary":"改写策略","warnings":[]}',
  cover: '{"titles":["封面主标题"],"summary":"封面副标题","content":"视觉提示词","warnings":[]}',
  diagram: '{"content":"<mermaid>合法 Mermaid 代码</mermaid>","warnings":[]}',
}

export function buildAIMessages(request: AIRequest): AIMessage[] {
  const context = [
    `任务：${TASK_INSTRUCTIONS[request.task]}`,
    `输出协议：只返回合法 JSON，不要使用 Markdown 代码围栏。JSON 必须符合：${OUTPUT_CONTRACTS[request.task]}`,
    request.title ? `文章标题：${request.title}` : '',
    request.theme ? `当前主题：${request.theme}` : '',
    request.guidelines ? `用户长期写作规范：\n${request.guidelines}` : '',
    `可用排版规则：\n${formatRulesAsPrompt()}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return [
    { role: 'system', content: `${BASE_SYSTEM_PROMPT}\n${context}` },
    ...(request.messages ?? []),
    {
      role: 'user',
      content: request.instruction
        ? `${request.instruction}\n\n待处理内容：\n${request.content}`
        : request.content,
    },
  ]
}
