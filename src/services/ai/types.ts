export type AITask =
  | 'rewrite'
  | 'continue'
  | 'summarize'
  | 'outline'
  | 'format'
  | 'title'
  | 'review'
  | 'compose'
  | 'proofread'
  | 'social'
  | 'cover'
  | 'diagram'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIRequest {
  task: AITask
  content: string
  instruction?: string
  title?: string
  theme?: string
  guidelines?: string
  messages?: AIMessage[]
}

export interface AIChange {
  type: 'replace' | 'insert' | 'delete'
  original?: string
  replacement?: string
  reason?: string
}

export interface AIReviewIssue {
  severity: 'info' | 'warning' | 'error'
  message: string
  suggestion?: string
  excerpt?: string
}

export interface AIResult {
  content?: string
  summary?: string
  titles?: string[]
  changes?: AIChange[]
  issues?: AIReviewIssue[]
  warnings?: string[]
}

export interface AIProvider {
  readonly name: string
  complete(messages: AIMessage[], signal?: AbortSignal): Promise<string>
}
