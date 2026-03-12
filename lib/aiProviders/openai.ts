import OpenAI from 'openai'
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

export const openaiProvider: AIProvider = {
  id: 'openai',
  isAsync: false,

  isConfigured() {
    return !!(process.env.OPENAI_API_KEY || '')
  },

  async invoke(message: string, options?: AIProviderOptions): Promise<
    | { mode: 'sync'; response: NormalizedAgentResponse }
    | { mode: 'async'; task_id: string }
  > {
    const apiKey = process.env.OPENAI_API_KEY || ''
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for OpenAI provider')

    const model = options?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const client = new OpenAI({ apiKey })

    let fullMessage = message
    if (options?.files?.length) {
      const fileBlock = options.files
        .map((f) => `=== ${f.path} ===\n${f.content}`)
        .join('\n\n')
      fullMessage = `${message}\n\nCODEBASE:\n${fileBlock}`
    }

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: TEST_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: fullMessage },
      ],
      temperature: 0.3,
      max_tokens: 16384,
    })

    const content = completion.choices?.[0]?.message?.content?.trim() || ''
    if (!content) {
      return {
        mode: 'sync',
        response: { status: 'error', result: {}, message: 'Empty response from OpenAI' },
      }
    }

    const response = extractResult(content)
    return { mode: 'sync', response }
  },
}
