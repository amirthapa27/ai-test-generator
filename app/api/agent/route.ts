import { NextRequest, NextResponse } from 'next/server'
import { getAIProvider } from '@/lib/aiProviders'

/**
 * POST /api/agent
 *
 * 1. Submit: body has { message, agent_id?, assets?, files? }
 *    - Lyzr: uses assets (or uploads files), returns { task_id } for async poll
 *    - OpenAI/Anthropic/Google: uses files inline, returns { status: 'completed', response } immediately
 *
 * 2. Poll (Lyzr only): body has { task_id }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    // Poll mode (Lyzr async only)
    if (body.task_id && typeof body.task_id === 'string') {
      const provider = getAIProvider()
      if (!provider.poll) {
        return NextResponse.json(
          {
            success: false,
            response: { status: 'error', result: {}, message: 'Provider does not support polling' },
            error: 'Polling not supported',
          },
          { status: 400 }
        )
      }
      const pollResult = await provider.poll(body.task_id)
      if (pollResult.status === 'processing') {
        return NextResponse.json({ status: 'processing' })
      }
      if (pollResult.status === 'failed') {
        return NextResponse.json(
          {
            success: false,
            status: 'failed',
            response: { status: 'error', result: {}, message: pollResult.error },
            error: pollResult.error,
          },
          { status: 500 }
        )
      }
      return NextResponse.json({
        success: true,
        status: 'completed',
        response: pollResult.response,
        module_outputs: pollResult.status === 'completed' ? pollResult.module_outputs : undefined,
        timestamp: new Date().toISOString(),
      })
    }

    // Submit mode
    const message = body.message as string | undefined
    const agent_id = body.agent_id as string | undefined
    const user_id = body.user_id as string | undefined
    const session_id = body.session_id as string | undefined
    const assets = body.assets as string[] | undefined
    const files = body.files as Array<{ path: string; content: string }> | undefined

    if (!message) {
      return NextResponse.json(
        {
          success: false,
          response: { status: 'error', result: {}, message: 'message is required' },
          error: 'message is required',
        },
        { status: 400 }
      )
    }

    const provider = getAIProvider()
    const options: { agent_id?: string; user_id?: string; session_id?: string; assets?: string[]; files?: Array<{ path: string; content: string }> } = {
      agent_id,
      user_id,
      session_id,
    }

    if (provider.id === 'lyzr') {
      if (assets?.length) {
        options.assets = assets
      } else if (files?.length) {
        const assetIds = await uploadFilesToLyzr(files)
        if (assetIds.length) options.assets = assetIds
      }
      if (!agent_id) {
        return NextResponse.json(
          {
            success: false,
            response: { status: 'error', result: {}, message: 'agent_id is required for Lyzr' },
            error: 'agent_id required for Lyzr',
          },
          { status: 400 }
        )
      }
    } else {
      if (files?.length) options.files = files
    }

    const result = await provider.invoke(message, options)

    if (result.mode === 'async') {
      return NextResponse.json({
        task_id: result.task_id,
        agent_id: result.agent_id,
        user_id: result.user_id,
        session_id: result.session_id,
      })
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      response: result.response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Server error'
    return NextResponse.json(
      {
        success: false,
        response: { status: 'error', result: {}, message: errorMsg },
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}

const LYZR_UPLOAD_URL = 'https://agent-prod.studio.lyzr.ai/v3/assets/upload'
const MAX_FILE_SIZE = 1024 * 1024 // 1MB per file
const MAX_FILES = 50

async function uploadFilesToLyzr(files: Array<{ path: string; content: string }>): Promise<string[]> {
  const apiKey = process.env.LYZR_API_KEY || ''
  if (!apiKey) return []

  const trimmed = files.slice(0, MAX_FILES)
  const formData = new FormData()
  for (const f of trimmed) {
    let content = typeof f.content === 'string' ? f.content : String(f.content || '')
    if (content.length > MAX_FILE_SIZE) {
      content = content.slice(0, MAX_FILE_SIZE) + '\n// ... truncated (file too large)\n'
    }
    const fileName = (f.path || 'file.txt').split(/[/\\]/).pop() || 'file.txt'
    const blob = new Blob([content], { type: 'text/plain' })
    formData.append('files', blob, fileName)
  }

  const res = await fetch(LYZR_UPLOAD_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
  })
  if (!res.ok) return []

  const data = (await res.json()) as { results?: Array<{ asset_id?: string; success?: boolean }> }
  const results = data.results || []
  return results
    .filter((r) => r.success && r.asset_id)
    .map((r) => r.asset_id as string)
}
