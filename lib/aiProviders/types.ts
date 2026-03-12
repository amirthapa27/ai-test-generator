/**
 * AI Provider abstraction — supports Lyzr, OpenAI, Anthropic, Google.
 */

export type AIProviderId = 'lyzr' | 'openai' | 'anthropic' | 'google'

export interface AIProviderOptions {
  agent_id?: string
  model?: string
  user_id?: string
  session_id?: string
  assets?: string[]
  /** For sync providers: inline file content to include in message */
  files?: Array<{ path: string; content: string }>
}

/** Normalized response shape all providers must produce */
export interface NormalizedAgentResponse {
  status: 'success' | 'error'
  result: Record<string, unknown>
  message?: string
  metadata?: Record<string, unknown>
}

/** Async providers (Lyzr) return task_id; sync providers return immediately */
export type AIProviderInvokeResult =
  | { mode: 'async'; task_id: string; agent_id?: string; user_id?: string; session_id?: string }
  | { mode: 'sync'; response: NormalizedAgentResponse }

export interface AIProvider {
  id: AIProviderId
  isAsync: boolean
  invoke(message: string, options?: AIProviderOptions): Promise<AIProviderInvokeResult>
  poll?(task_id: string): Promise<
    | { status: 'processing' }
    | { status: 'completed'; response: NormalizedAgentResponse; module_outputs?: unknown }
    | { status: 'failed'; error: string }
  >
  isConfigured(): boolean
}
