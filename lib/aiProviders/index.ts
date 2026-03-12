/**
 * AI Provider factory — select provider via AI_PROVIDER env.
 * Supported: lyzr | openai | anthropic | google
 */

import type { AIProvider, AIProviderId, AIProviderOptions, NormalizedAgentResponse } from './types'
import { lyzrProvider } from './lyzr'
import { openaiProvider } from './openai'
import { anthropicProvider } from './anthropic'
import { googleProvider } from './google'

const PROVIDERS: Record<AIProviderId, AIProvider> = {
  lyzr: lyzrProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
}

export function getAIProviderId(): AIProviderId {
  const id = (process.env.AI_PROVIDER || 'lyzr').toLowerCase() as AIProviderId
  return PROVIDERS[id] ? id : 'lyzr'
}

export function getAIProvider(): AIProvider {
  const id = getAIProviderId()
  const provider = PROVIDERS[id]
  if (!provider) {
    throw new Error(
      `Unknown AI_PROVIDER="${id}". Supported: lyzr, openai, anthropic, google`
    )
  }
  if (!provider.isConfigured()) {
    throw new Error(
      `AI_PROVIDER="${id}" is not configured. Set the required env vars (e.g. ${
        id === 'lyzr' ? 'LYZR_API_KEY' : id === 'openai' ? 'OPENAI_API_KEY' : id === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_AI_API_KEY or GEMINI_API_KEY'
      }).`
    )
  }
  return provider
}

export { lyzrProvider, openaiProvider, anthropicProvider, googleProvider }
export type { AIProvider, AIProviderId, AIProviderOptions, NormalizedAgentResponse }
