import { R_MARKDOWN_FORMAT_RULES } from './formatRules'
import type { AIReviewIssue } from './types'

const allowedTags = new Set(
  R_MARKDOWN_FORMAT_RULES.map((rule) => rule.tag).filter((tag): tag is string => Boolean(tag)),
)
allowedTags.add('left')
allowedTags.add('right')
allowedTags.add('ptitle')
const htmlTags = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
  'svg',
  'path',
  'section',
  'sup',
  'sub',
  'u',
])

export interface FormatValidationResult {
  valid: boolean
  issues: AIReviewIssue[]
}

/** 对模型输出做轻量校验，避免未知组件被直接写入编辑器。 */
export function validateAIFormat(markdown: string): FormatValidationResult {
  const issues: AIReviewIssue[] = []
  const source = markdown.replace(/^```[\s\S]*?^```/gm, '')
  const tags = source.match(/<\/?([a-z][\w-]*)\b[^>]*>/gi) ?? []
  for (const rawTag of tags) {
    const name = rawTag.match(/<\/?([a-z][\w-]*)/i)?.[1]?.toLowerCase()
    if (!name || htmlTags.has(name) || name === 'https' || name === 'http') continue
    if (!allowedTags.has(name)) {
      issues.push({
        severity: 'error',
        message: `发现未注册的组件：<${name}>`,
        suggestion: '请改用项目支持的组件，或将其转换为普通 Markdown。',
        excerpt: rawTag,
      })
    }
  }

  for (const rule of R_MARKDOWN_FORMAT_RULES.filter((item) => item.syntax.startsWith('<'))) {
    const tag = rule.syntax.match(/<([a-z]+)/)?.[1]
    if (!tag) continue
    if (rule.syntax.includes('/>')) continue
    const open = (source.match(new RegExp(`<${tag}\\b(?![^>]*\\/>)`, 'gi')) ?? []).length
    const close = (source.match(new RegExp(`</${tag}>`, 'gi')) ?? []).length
    if (open !== close) {
      issues.push({
        severity: 'error',
        message: `组件 <${tag}> 标签不完整`,
        suggestion: `补齐成对的 <${tag}>...</${tag}> 标签。`,
      })
    }
  }

  for (const rule of R_MARKDOWN_FORMAT_RULES.filter((item) => item.tag && item.allowedParents)) {
    const tag = rule.tag!
    const parent = rule.allowedParents![0]
    const occurrences = source.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []
    const parentBlocks = source.match(new RegExp(`<${parent}\\b[\\s\\S]*?</${parent}>`, 'gi')) ?? []
    const nestedCount = parentBlocks.reduce(
      (count, block) => count + (block.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length,
      0,
    )
    if (occurrences.length > nestedCount) {
      issues.push({
        severity: 'error',
        message: `组件 <${tag}> 必须位于 <${parent}> 内`,
        suggestion: `将 <${tag}> 移入 <${parent}>，或改用普通 Markdown。`,
      })
    }
  }

  return { valid: issues.every((issue) => issue.severity !== 'error'), issues }
}
