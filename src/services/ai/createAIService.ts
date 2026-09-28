import { getSetting } from '@/config/settings'
import { AIService } from './AIService'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

const isDesktop = import.meta.env.VITE_TAURI === 'true'

export interface AIConfiguration {
  provider: 'openai-compatible'
  model: string
  baseUrl: string
  apiKey: string
}

export function getAIConfiguration(): AIConfiguration {
  return {
    provider: getSetting<AIConfiguration['provider']>('aiProvider'),
    model: getSetting<string>('aiModel').trim(),
    baseUrl: getSetting<string>('aiBaseUrl').trim(),
    apiKey: getSetting<string>('aiApiKey').trim(),
  }
}

export function createConfiguredAIService(): AIService {
  const config = getAIConfiguration()
  if (isDesktop && !config.model) throw new Error('请先在设置中填写 AI 模型名称')
  if (!config.baseUrl) throw new Error('请先在设置中填写 AI 服务地址')
  if (!isDesktop && config.apiKey) {
    throw new Error('Web 端不能保存或发送 API Key，请使用不需要前端密钥的服务端代理')
  }
  if (isDesktop && !config.apiKey) throw new Error('请先在设置中填写 AI API Key')

  return new AIService(
    new OpenAICompatibleProvider({
      model: isDesktop ? config.model : config.model || 'server-default',
      baseUrl: config.baseUrl,
      apiKey: isDesktop ? config.apiKey : undefined,
    }),
  )
}
