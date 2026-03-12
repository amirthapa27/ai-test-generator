/**
 * POST /api/upload-workspace
 *
 * Accepts JSON body with file contents from VS Code extension.
 * - Lyzr: uploads to Lyzr, returns asset_ids
 * - Other providers: returns useInlineFiles (extension sends files in agent request)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAIProviderId } from '@/lib/aiProviders'

const LYZR_UPLOAD_URL = 'https://agent-prod.studio.lyzr.ai/v3/assets/upload'

function getLyzrApiKey() {
  return process.env.LYZR_API_KEY || ''
}

const MAX_FILE_SIZE = 1024 * 1024 // 1MB per file
const MAX_FILES = 50

interface WorkspaceFile {
  path: string
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const providerId = getAIProviderId()

    if (providerId !== 'lyzr') {
      const body = await request.json()
      const files = body.files as WorkspaceFile[] | undefined
      if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json(
          { success: false, asset_ids: [], error: 'No files provided' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        useInlineFiles: true,
        asset_ids: [],
      })
    }

    if (!getLyzrApiKey()) {
      return NextResponse.json(
        {
          success: false,
          asset_ids: [],
          error: 'LYZR_API_KEY not configured',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const files = body.files as WorkspaceFile[] | undefined

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          asset_ids: [],
          error: 'No files provided. Expected { files: [{ path, content }] }',
        },
        { status: 400 }
      )
    }

    const trimmed = files.slice(0, MAX_FILES)
    const uploadFormData = new FormData()

    for (const f of trimmed) {
      const path = f.path || 'unknown'
      let content = typeof f.content === 'string' ? f.content : String(f.content || '')
      const fileName = path.split(/[/\\]/).pop() || 'file.txt'

      if (content.length > MAX_FILE_SIZE) {
        content = content.slice(0, MAX_FILE_SIZE) + '\n// ... truncated\n'
      }

      const blob = new Blob([content], { type: 'text/plain' })
      uploadFormData.append('files', blob, fileName)
    }

    const response = await fetch(LYZR_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'x-api-key': getLyzrApiKey(),
      },
      body: uploadFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        {
          success: false,
          asset_ids: [],
          error: `Upload failed: ${response.status} - ${errorText.slice(0, 200)}`,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const uploadedFiles = (data.results || []).map((r: any) => ({
      asset_id: r.asset_id || '',
      file_name: r.file_name || '',
      success: r.success ?? true,
    }))

    const assetIds = uploadedFiles
      .filter((f: any) => f.success && f.asset_id)
      .map((f: any) => f.asset_id)

    return NextResponse.json({
      success: true,
      asset_ids: assetIds,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        asset_ids: [],
        error: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    )
  }
}
