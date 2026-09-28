/**
 * Cloudflare Worker：GitHub API 与 AI 代理
 * 仅允许来自官方域名、桌面客户端和本地开发的请求。
 */

// secrets injected via wrangler secret put, accessed from env

const REPO = 'RobocopMao/r-markdown-materials'

const ALLOWED_ORIGINS = ['https://robocopmao.github.io', 'https://r-markdown.pages.dev']

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, r-markdown-secret',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    const GITHUB_TOKEN = env.GITHUB_TOKEN as string
    const DESKTOP_SECRET = env.DESKTOP_SECRET as string

    try {
      // CORS 预检
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders(origin) })
      }

      const desktopSecret = request.headers.get('r-markdown-secret') || ''

      const isAllowedWebOrigin =
        ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.r-markdown.pages.dev')

      if (new URL(request.url).pathname.startsWith('/ai/')) {
        if (!isAllowedWebOrigin) {
          return new Response('Forbidden', { status: 403, headers: corsHeaders(origin) })
        }
        return forwardToAI(request, origin, env)
      }

      // 桌面客户端鉴权（Tauri 不发送标准 Origin）
      if (desktopSecret && desktopSecret === DESKTOP_SECRET) {
        return forwardToGitHub(request, origin, GITHUB_TOKEN)
      }

      // Web 端 Origin 白名单（含 pages.dev 分支预览）
      if (isAllowedWebOrigin) {
        return forwardToGitHub(request, origin, GITHUB_TOKEN)
      }

      return new Response('Forbidden', {
        status: 403,
        headers: corsHeaders(origin),
      })
    } catch (e) {
      return new Response(`Worker Error: ${(e as Error).message || String(e)}`, {
        status: 500,
        headers: corsHeaders(origin),
      })
    }
  },
}

async function forwardToAI(request: Request, origin: string, env: any): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(origin) })
  }
  const contentLength = Number(request.headers.get('content-length') || '0')
  if (contentLength > 1_000_000) {
    return new Response('Payload Too Large', { status: 413, headers: corsHeaders(origin) })
  }

  if (!env.AI_RATE_LIMITER || !env.AI_API_KEY || !env.AI_MODEL) {
    return new Response('AI service is not configured', {
      status: 503,
      headers: corsHeaders(origin),
    })
  }
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
  const rateLimit = await env.AI_RATE_LIMITER.limit({ key: clientIP })
  if (!rateLimit.success) {
    return new Response('Too Many Requests', { status: 429, headers: corsHeaders(origin) })
  }

  const payload: unknown = await request.json()
  if (!payload || typeof payload !== 'object') {
    return new Response('Invalid AI request', { status: 400, headers: corsHeaders(origin) })
  }
  const payloadRecord = payload as Record<string, unknown>
  if (!Array.isArray(payloadRecord.messages)) {
    return new Response('Invalid AI request', { status: 400, headers: corsHeaders(origin) })
  }
  const safePayload = {
    ...payloadRecord,
    model: String(env.AI_MODEL),
    stream: false,
  }

  const incoming = new URL(request.url)
  const baseUrl = String(env.AI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
  const path = incoming.pathname.replace(/^\/ai/, '')
  const headers = new Headers({
    Authorization: `Bearer ${env.AI_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  })
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(safePayload),
  })
  const responseHeaders = new Headers(response.headers)
  Object.entries(corsHeaders(origin)).forEach(([key, value]) => responseHeaders.set(key, value))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

async function forwardToGitHub(request: Request, origin: string, token: string): Promise<Response> {
  const url = new URL(request.url)
  // /github/{path} → https://api.github.com/repos/{REPO}/contents/{path}
  const path = url.pathname.replace(/^\/github\//, '')
  const githubUrl = `https://api.github.com/repos/${REPO}/contents/${path}`

  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/vnd.github.v3+json')
  // 清理内部头，不泄露给 GitHub
  headers.delete('Origin')
  headers.delete('r-markdown-secret')

  const resp = await fetch(githubUrl, {
    method: request.method,
    headers,
    body: request.body,
  })

  // 把 GitHub 响应打上 CORS 头
  const newHeaders = new Headers(resp.headers)
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => {
    newHeaders.set(k, v)
  })
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: newHeaders,
  })
}
