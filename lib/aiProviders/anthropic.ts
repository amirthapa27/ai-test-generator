import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AIProviderOptions, NormalizedAgentResponse } from './types'
import { TEST_GENERATION_SYSTEM_PROMPT } from './prompts'
import parseLLMJson from '@/lib/jsonParser'

function extractResult(content: string): NormalizedAgentResponse {
  const parsed = parseLLMJson(content)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const hasSchema = 'summary' in parsed || 'endpoints' in parsed || 'totalEndpoints' in parsed
    if (hasSchema) {
      return { status: 'success', result: parsed as Record<string, unknown> }
    }
    if ('result' in parsed && parsed.result) {
      return { status: 'success', result: parsed.result as Record<string, unknown> }
    }
  }
  return { status: 'success', result: { text: content } }
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  isAsync: false,

  isConfigured() {
    return !!(process.env.ANTHROPIC_API_KEY || '')
  },

  async invoke(message: string, options?: AIProviderOptions): Promise<
    | { mode: 'sync'; response: NormalizedAgentResponse }
    | { mode: 'async'; task_id: string }
  > {
    const apiKey = process.env.ANTHROPIC_API_KEY || ''
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider')

    const model = options?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
    const client = new Anthropic({ apiKey })

    let fullMessage = message
    if (options?.files?.length) {
      const fileBlock = options.files
        .map((f) => `=== ${f.path} ===\n${f.content}`)
        .join('\n\n')
      fullMessage = `${message}\n\nCODEBASE:\n${fileBlock}`
    }

    const msg = await client.messages.create({
      model,
      max_tokens: 65536,
      system: TEST_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: fullMessage }],
    })

    const block = msg.content?.find((b) => b.type === 'text')
    const content = block && block.type === 'text' ? block.text?.trim() || '' : ''
    if (!content) {
      return {
        mode: 'sync',
        response: { status: 'error', result: {}, message: 'Empty response from Anthropic' },
      }
    }

    const response = extractResult(content)
    return { mode: 'sync', response }
  },
}
