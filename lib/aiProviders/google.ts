import { GoogleGenerativeAI } from '@google/generative-ai'
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

export const googleProvider: AIProvider = {
  id: 'google',
  isAsync: false,

  isConfigured() {
    return !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '')
  },

  async invoke(message: string, options?: AIProviderOptions): Promise<
    | { mode: 'sync'; response: NormalizedAgentResponse }
    | { mode: 'async'; task_id: string }
  > {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY is required for Google provider')

    const modelId = options?.model || process.env.GOOGLE_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelId,
      systemInstruction: TEST_GENERATION_SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: 16384 },
    })

    let fullMessage = message
    if (options?.files?.length) {
      const fileBlock = options.files
        .map((f) => `=== ${f.path} ===\n${f.content}`)
        .join('\n\n')
      fullMessage = `${message}\n\nCODEBASE:\n${fileBlock}`
    }

    const result = await model.generateContent(fullMessage)
    const response = result.response
    const text = (typeof response.text === 'function' ? response.text() : response.text)?.trim() || ''
    if (!text) {
      return {
        mode: 'sync',
        response: { status: 'error', result: {}, message: 'Empty response from Google Gemini' },
      }
    }

    const normResponse = extractResult(text)
    return { mode: 'sync', response: normResponse }
  },
}
