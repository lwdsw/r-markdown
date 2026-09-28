import { ref } from 'vue'
import { AIService } from '@/services/ai/AIService'
import type { AIProvider, AIRequest, AIResult } from '@/services/ai/types'

export function useAI(provider: AIProvider) {
  const service = new AIService(provider)
  const isRunning = ref(false)
  const error = ref<string | null>(null)
  const result = ref<AIResult | null>(null)
  let controller: AbortController | null = null

  async function run(request: AIRequest): Promise<AIResult | null> {
    controller?.abort()
    controller = new AbortController()
    isRunning.value = true
    error.value = null
    result.value = null
    try {
      result.value = await service.run(request, controller.signal)
      return result.value
    } catch (cause) {
      if ((cause as DOMException).name !== 'AbortError') {
        error.value = cause instanceof Error ? cause.message : 'AI 请求失败'
      }
      return null
    } finally {
      isRunning.value = false
    }
  }

  function cancel(): void {
    controller?.abort()
    controller = null
    isRunning.value = false
  }

  return { isRunning, error, result, run, cancel }
}
