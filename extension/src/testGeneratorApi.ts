/**
 * API client for test generation.
 * Generates full coverage across all selected test dimensions.
 */
import * as vscode from 'vscode'
import type { ScannedFile } from './fileScanner'

export interface TestGeneratorConfig {
  apiUrl: string
  agentId: string
}

export interface TestResult {
  summary?: string
  language?: string
  framework?: string
  testingFramework?: string
  totalEndpoints?: number
  totalTestCases?: number
  endpoints?: Array<{
    path?: string
    method?: string
    description?: string
    testDimensions?: {
      unitTests?: string
      integrationTests?: string
      contractTests?: string
      edgeCaseTests?: string
      performanceTests?: string
      securityTests?: string
    }
  }>
  coverageBreakdown?: Record<string, number>
  warnings?: string[]
}

export interface GenerateResult {
  success: boolean
  data?: TestResult
  artifactFiles?: Array<{ file_url: string; name: string; format_type: string }>
  error?: string
}

export function getConfig(): TestGeneratorConfig {
  const config = vscode.workspace.getConfiguration('apiTestCoverage')
  const apiUrl = (config.get<string>('apiUrl') || 'http://localhost:3333').replace(/\/$/, '')
  const agentId = config.get<string>('agentId') || '69b1c1bdc6b88ef89da98ec4'
  return { apiUrl, agentId }
}

/** Check if backend is reachable */
export async function checkHealth(apiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/api/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Build prompt for test generation. Ensures full coverage of all selected dimensions.
 * @param dimensions - test dimension keys to generate (unitTests, integrationTests, etc.)
 */
function buildOptimizedPrompt(dimensions: string[]): string {
  const dimList = dimensions.length > 0 ? dimensions.join(', ') : 'unitTests, integrationTests, contractTests, edgeCaseTests, performanceTests, securityTests'
  return `You are a test generator. Analyze the uploaded codebase.

TASKS:
1. Detect language and framework (Node/Express/FastAPI/Nest/Spring/etc).
2. Find all API endpoints (routes, handlers, controllers).
3. Generate test cases that STRICTLY follow the testing conventions for that language:
   - JavaScript/TypeScript: Jest or Mocha syntax, describe/it, supertest for HTTP
   - Python: pytest, test_ prefix, client fixtures
   - Go: testing package, table-driven tests
   - Java: JUnit, @Test, MockMvc
   - Ruby: RSpec, Minitest conventions
   - Etc. for each language's standard testing style
4. Generate ONLY these test dimensions: ${dimList}. For each dimension listed, generate test code for EVERY endpoint. Do NOT generate unitTests, integrationTests, contractTests, edgeCaseTests, performanceTests, or securityTests unless they are in the list above. Use empty string for dimensions not in the list.
5. Output structured JSON per the schema.`
}

export async function generateTests(
  files: ScannedFile[],
  config: TestGeneratorConfig,
  dimensions: string[],
  onProgress?: (message: string) => void
): Promise<GenerateResult> {
  const basePrompt = buildOptimizedPrompt(dimensions)
  const filePayload = files.map((f) => ({ path: f.relativePath, content: f.content }))

  // 1. Check provider to decide flow
  let configRes: Response
  try {
    configRes = await fetch(`${config.apiUrl}/api/config`)
  } catch {
    return { success: false, error: 'Failed to reach config endpoint' }
  }
  const apiConfig = (await configRes.json()) as { provider?: string; isAsync?: boolean }
  const isLyzr = apiConfig.provider === 'lyzr' && apiConfig.isAsync

  let agentBody: Record<string, unknown>

  if (isLyzr) {
    const uploadRes = await fetch(`${config.apiUrl}/api/upload-workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filePayload }),
    })
    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      return { success: false, error: `Upload failed: ${uploadRes.status} - ${errText.slice(0, 150)}` }
    }
    const uploadData = (await uploadRes.json()) as { success?: boolean; asset_ids?: string[]; useInlineFiles?: boolean; error?: string }
    if (!uploadData.success) {
      return { success: false, error: uploadData.error || 'Upload failed' }
    }
    if (uploadData.useInlineFiles) {
      agentBody = {
        message: `${basePrompt}\n\nCodebase:\n${filePayload.map((f) => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`,
        agent_id: config.agentId,
        files: filePayload,
      }
    } else {
      agentBody = {
        message: `${basePrompt}\n\nCodebase is in uploaded assets. Analyze and generate tests.`,
        agent_id: config.agentId,
        assets: uploadData.asset_ids || [],
      }
    }
  } else {
    agentBody = {
      message: `${basePrompt}\n\nAnalyze the codebase below and generate tests.`,
      agent_id: config.agentId,
      files: filePayload,
    }
  }

  const submitRes = await fetch(`${config.apiUrl}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentBody),
  })

  if (!submitRes.ok) {
    return {
      success: false,
      error: `Agent submit failed: ${submitRes.status}`,
    }
  }

  const submitData = (await submitRes.json()) as Record<string, unknown>

  if (submitData.status === 'completed' && submitData.response) {
    const response = submitData.response as Record<string, unknown>
    const norm = response as { result?: Record<string, unknown> }
    const result = norm.result || {}
    const moduleOutputs = submitData.module_outputs as { artifact_files?: Array<{ file_url: string; name: string; format_type: string }> } | undefined
    return {
      success: true,
      data: extractTestData(result as Record<string, unknown>),
      artifactFiles: moduleOutputs?.artifact_files,
    }
  }

  const taskId = submitData.task_id as string | undefined
  if (!taskId) {
    return {
      success: false,
      error: 'No task_id from agent',
    }
  }

  const result = await pollForResult(config.apiUrl, taskId, onProgress)
  return result
}

async function pollForResult(
  apiUrl: string,
  taskId: string,
  onProgress?: (message: string) => void
): Promise<GenerateResult> {
  const maxAttempts = 40
  let delayMs = 800

  for (let i = 0; i < maxAttempts; i++) {
    onProgress?.(`Generating tests... (${i + 1}/${maxAttempts})`)
    await new Promise((r) => setTimeout(r, delayMs))
    delayMs = Math.min(delayMs * 1.2, 2500)

    const pollRes = await fetch(`${apiUrl}/api/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    })

    if (!pollRes.ok) continue

    const pollData = (await pollRes.json()) as Record<string, unknown>
    if (pollData.status === 'processing') continue

    if (pollData.status === 'completed' && pollData.response) {
      const response = pollData.response as Record<string, unknown>
      const norm = response as { result?: Record<string, unknown>; status?: string }
      const result = norm.result || {}
      const moduleOutputs = pollData.module_outputs as { artifact_files?: Array<{ file_url: string; name: string; format_type: string }> } | undefined

      return {
        success: true,
        data: extractTestData(result),
        artifactFiles: moduleOutputs?.artifact_files,
      }
    }

    if (pollData.status === 'failed') {
      return {
        success: false,
        error: (pollData as { error?: string }).error || 'Agent failed',
      }
    }
  }

  return {
    success: false,
    error: 'Timed out waiting for test generation',
  }
}

function extractTestData(result: Record<string, unknown>): TestResult | undefined {
  if (!result || typeof result !== 'object') return undefined

  if (
    'summary' in result ||
    'endpoints' in result ||
    'totalEndpoints' in result
  ) {
    return result as unknown as TestResult
  }

  if (typeof result.text === 'string') {
    try {
      const parsed = JSON.parse(result.text) as TestResult
      if (parsed.summary || parsed.endpoints) return parsed
    } catch {
      // ignore
    }
  }

  return undefined
}
