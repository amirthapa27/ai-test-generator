import parseLLMJson from '@/lib/jsonParser'
import type { AIProvider, AIProviderOptions, NormalizedAgentResponse } from './types'

const LYZR_TASK_URL = 'https://agent-prod.studio.lyzr.ai/v3/inference/chat/task'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function normalizeResponse(parsed: unknown): NormalizedAgentResponse {
  if (!parsed) {
    return { status: 'error', result: {}, message: 'Empty response from agent' }
  }
  if (typeof parsed === 'string') {
    return { status: 'success', result: { text: parsed }, message: parsed }
  }
  if (typeof parsed !== 'object') {
    return { status: 'success', result: { value: parsed }, message: String(parsed) }
  }
  const p = parsed as Record<string, unknown>
  if ('status' in p && 'result' in p) {
    return {
      status: (p.status === 'error' ? 'error' : 'success') as 'success' | 'error',
      result: (p.result as Record<string, unknown>) || {},
      message: p.message as string | undefined,
      metadata: p.metadata as Record<string, unknown> | undefined,
    }
  }
  if ('result' in p) {
    const r = p.result
    const msg = (p.message as string) ?? (typeof r === 'object' && r && (r as Record<string, unknown>).text) ?? null
    return {
      status: 'success',
      result: typeof r === 'string' ? { text: r } : (r as Record<string, unknown>) || {},
      message: typeof msg === 'string' ? msg : undefined,
    }
  }
  if ('message' in p && typeof p.message === 'string') {
    return { status: 'success', result: { text: p.message }, message: p.message }
  }
  return { status: 'success', result: p as Record<string, unknown> }
}

export const lyzrProvider: AIProvider = {
  id: 'lyzr',
  isAsync: true,

  isConfigured() {
    return !!(process.env.LYZR_API_KEY || '')
  },

  async invoke(message: string, options?: AIProviderOptions) {
    const apiKey = process.env.LYZR_API_KEY || ''
    const agent_id = options?.agent_id || process.env.AGENT_ID || process.env.LYZR_AGENT_ID
    if (!apiKey || !agent_id) {
      throw new Error('LYZR_API_KEY and agent_id are required for Lyzr provider')
    }

    const user_id = options?.user_id || process.env.LYZR_USER_ID || `user-${generateUUID()}`
    const session_id = options?.session_id || `${agent_id}-${generateUUID().substring(0, 12)}`

    const payload: Record<string, unknown> = {
      message,
      agent_id,
      user_id,
      session_id,
    }
    if (options?.assets?.length) payload.assets = options.assets

    const res = await fetch(LYZR_TASK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      let err = `Lyzr submit failed: ${res.status}`
      try {
        const d = JSON.parse(text)
        err = (d?.detail || d?.error || d?.message) || err
      } catch {
        try {
          const d = parseLLMJson(text)
          err = (d?.error || d?.message) || err
        } catch {}
      }
      throw new Error(err)
    }

    const { task_id } = (await res.json()) as { task_id: string }
    return {
      mode: 'async',
      task_id,
      agent_id,
      user_id,
      session_id,
    }
  },

  async poll(task_id: string) {
    const apiKey = process.env.LYZR_API_KEY || ''
    if (!apiKey) throw new Error('LYZR_API_KEY not configured')

    const res = await fetch(`${LYZR_TASK_URL}/${task_id}`, {
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    })

    if (!res.ok) {
      const msg = res.status === 404 ? 'Task expired or not found' : `Poll failed: ${res.status}`
      return { status: 'failed' as const, error: msg }
    }

    const task = (await res.json()) as {
      status: string
      response?: unknown
      error?: string
      module_outputs?: unknown
    }
    if (task.status === 'processing') return { status: 'processing' as const }
    if (task.status === 'failed') {
      return { status: 'failed' as const, error: task.error || 'Agent task failed' }
    }

    const rawText = JSON.stringify(task.response)
    let agentResponseRaw: unknown = rawText
    try {
      const envelope = JSON.parse(rawText) as Record<string, unknown>
      if (envelope?.response != null) agentResponseRaw = envelope.response
    } catch {}

    const parsed = parseLLMJson(agentResponseRaw)
    const toNorm =
      parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).success === false && (parsed as Record<string, unknown>).data === null
        ? agentResponseRaw
        : parsed
    const normalized = normalizeResponse(toNorm)
    let module_outputs: unknown
    try {
      const envelope = JSON.parse(rawText) as Record<string, unknown>
      module_outputs = envelope?.module_outputs
    } catch {
      // ignore
    }
    return { status: 'completed' as const, response: normalized, module_outputs }
  },
}
