import type { AIMessage, AIProvider } from './types'

export interface OpenAICompatibleOptions {
  apiKey?: string
  model: string
  baseUrl?: string
  fetcher?: typeof fetch
}

/** 适用于 OpenAI、兼容 OpenAI Chat Completions 协议的服务。 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible'
  private readonly options: Pick<OpenAICompatibleOptions, 'apiKey' | 'model'> & {
    baseUrl: string
    fetcher: typeof fetch
  }

  constructor(options: OpenAICompatibleOptions) {
    this.options = {
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
      fetcher: options.fetcher ?? fetch,
    }
  }

  async complete(messages: AIMessage[], signal?: AbortSignal): Promise<string> {
    const response = await this.options.fetcher(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: this.options.model, messages, temperature: 0.4 }),
      signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`AI 请求失败（${response.status}）：${detail.slice(0, 300)}`)
    }

    const data: unknown = await response.json()
    const content = extractChatCompletionContent(data)
    if (!content) throw new Error('AI 返回了空内容')
    return content
  }
}

function extractChatCompletionContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return ''
  const message = (choices[0] as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content.trim() : ''
}
