import { NextResponse } from 'next/server'
import { getAIProviderId } from '@/lib/aiProviders'

const ASYNC_PROVIDERS = ['lyzr']

/**
 * GET /api/config
 * Returns current AI provider (for extension to decide upload vs inline flow).
 */
export async function GET() {
  const id = getAIProviderId()
  return NextResponse.json({
    provider: id,
    isAsync: ASYNC_PROVIDERS.includes(id),
  })
}
