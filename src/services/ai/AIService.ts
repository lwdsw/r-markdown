import { buildAIMessages } from './promptBuilder'
import { validateAIFormat } from './formatValidator'
import type { AIChange, AIProvider, AIRequest, AIResult, AIReviewIssue } from './types'
import { chunkMarkdown } from './chunkMarkdown'

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  async run(request: AIRequest, signal?: AbortSignal): Promise<AIResult> {
    const chunks = chunkMarkdown(request.content)
    if (
      chunks.length > 1 &&
      ['rewrite', 'continue', 'format', 'review', 'proofread', 'social'].includes(request.task)
    ) {
      const results: AIResult[] = []
      for (let index = 0; index < chunks.length; index++) {
        results.push(
          await this.runSingle(
            {
              ...request,
              content: chunks[index],
              instruction: [
                request.instruction,
                `这是长文的第 ${index + 1}/${chunks.length} 段，请保持与相邻段落衔接，不要补写其他段落。`,
              ]
                .filter(Boolean)
                .join('\n'),
            },
            signal,
          ),
        )
      }
      return mergeResults(results)
    }
    return this.runSingle(request, signal)
  }

  private async runSingle(request: AIRequest, signal?: AbortSignal): Promise<AIResult> {
    const response = await this.provider.complete(buildAIMessages(request), signal)
    const result = parseAIResult(response, request.task)

    if (result.content) {
      const validation = validateAIFormat(result.content)
      result.issues = [...(result.issues ?? []), ...validation.issues]
      if (!validation.valid) {
        result.warnings = [...(result.warnings ?? []), '生成内容包含排版规则问题，请检查后再应用。']
      }
    }

    return result
  }
}

function mergeResults(results: AIResult[]): AIResult {
  return {
    content: results.map((item) => item.content).filter(Boolean).join('\n\n') || undefined,
    summary: results.map((item) => item.summary).filter(Boolean).join('\n') || undefined,
    titles: results.flatMap((item) => item.titles ?? []),
    changes: results.flatMap((item) => item.changes ?? []),
    issues: results.flatMap((item) => item.issues ?? []),
    warnings: results.flatMap((item) => item.warnings ?? []),
  }
}

function parseAIResult(raw: string, task: AIRequest['task']): AIResult {
  const cleaned = stripCodeFence(raw.trim())
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (isRecord(parsed)) return normalizeResult(parsed)
  } catch {
    // 模型未按 JSON 返回时，保留文本结果，交给调用方显示差异。
  }

  if (task === 'title') {
    return {
      titles: cleaned
        .split('\n')
        .map((line) => line.replace(/^[-*\d.、)]+\s*/, '').trim())
        .filter(Boolean),
    }
  }
  return { content: cleaned }
}

function normalizeResult(value: Record<string, unknown>): AIResult {
  return {
    content: typeof value.content === 'string' ? value.content : undefined,
    summary: typeof value.summary === 'string' ? value.summary : undefined,
    titles: Array.isArray(value.titles)
      ? value.titles.filter((item): item is string => typeof item === 'string')
      : undefined,
    changes: Array.isArray(value.changes) ? value.changes.filter(isChange) : undefined,
    issues: Array.isArray(value.issues) ? value.issues.filter(isIssue) : undefined,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.filter((item): item is string => typeof item === 'string')
      : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChange(value: unknown): value is AIChange {
  if (!isRecord(value)) return false
  return value.type === 'replace' || value.type === 'insert' || value.type === 'delete'
}

function isIssue(value: unknown): value is AIReviewIssue {
  if (!isRecord(value)) return false
  return value.severity === 'info' || value.severity === 'warning' || value.severity === 'error'
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json|markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim()
}
