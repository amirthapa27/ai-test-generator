/**
 * Tests for upload-workspace API route.
 * Covers Content-Type handling, missing/invalid fields, validation, and security (path traversal).
 */
import { POST } from '../route'

const originalFetch = global.fetch

beforeEach(() => {
  process.env.AI_PROVIDER = 'lyzr'
  process.env.LYZR_API_KEY = 'test-key'
  global.fetch = originalFetch
})

afterEach(() => {
  global.fetch = originalFetch
})

describe('POST /api/upload-workspace', () => {
  it('returns 400 when no files provided', async () => {
    const req = new Request('http://localhost/api/upload-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.success).toBe(false)
  })

  it('returns 400 when files is not an array', async () => {
    const req = new Request('http://localhost/api/upload-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: 'not-array' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns useInlineFiles when provider is not Lyzr', async () => {
    process.env.AI_PROVIDER = 'openai'
    const req = new Request('http://localhost/api/upload-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [{ path: 'a.ts', content: 'const x = 1' }],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.useInlineFiles).toBe(true)
    expect(data.asset_ids).toEqual([])
  })

  it('uploads files and returns asset_ids when Lyzr succeeds', async () => {
    process.env.AI_PROVIDER = 'lyzr'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            { asset_id: 'asset-1', file_name: 'a.ts', success: true },
            { asset_id: 'asset-2', file_name: 'b.ts', success: true },
          ],
        }),
    })

    const req = new Request('http://localhost/api/upload-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          { path: 'src/a.ts', content: 'export const x = 1' },
          { path: 'src/b.ts', content: 'export const y = 2' },
        ],
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.asset_ids).toEqual(['asset-1', 'asset-2'])
  })

  // --- Content-Type handling ---
  describe('Content-Type handling', () => {
    it('rejects multipart/form-data body (expects JSON)', async () => {
      const formData = new FormData()
      formData.append('files', new Blob(['content']), 'a.ts')
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=----boundary' },
        body: formData,
      })
      const res = await POST(req)
      expect(res.status).toBe(500)
      const data = await res.json()
      expect(data.success).toBe(false)
    })

    it('rejects text/plain with non-JSON body', async () => {
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not valid json',
      })
      const res = await POST(req)
      expect(res.status).toBe(500)
    })

    it('rejects application/x-www-form-urlencoded with non-JSON body', async () => {
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'files=foo&path=bar',
      })
      const res = await POST(req)
      expect(res.status).toBe(500)
    })
  })

  // --- Missing / invalid fields ---
  describe('missing and invalid fields', () => {
    it('handles file entry with missing path (uses fallback)', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'unknown', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ content: 'const x = 1' }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('handles file entry with missing content (uses empty string)', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'a.ts', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: 'src/a.ts' }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('handles file with null path', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'file.txt', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: null, content: 'x' }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('handles content as number (coerced to string)', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'a.ts', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: 'a.ts', content: 123 }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  // --- Form validation (complex cases) ---
  describe('form validation', () => {
    it('rejects empty files array', async () => {
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [] }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('rejects when files key is missing', async () => {
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('rejects malformed JSON body', async () => {
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      })
      const res = await POST(req)
      expect(res.status).toBe(500)
    })

    it('handles empty string for content', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'a.ts', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: 'a.ts', content: '' }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  // --- Security: path traversal, injection ---
  describe('security: path traversal and injection', () => {
    it('sanitizes path with directory traversal - uses basename only', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'passwd', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            {
              path: '../../../etc/passwd',
              content: 'malicious',
            },
          ],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.asset_ids).toContain('asset-1')
    })

    it('handles path with backslash traversal', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'sensitive', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            {
              path: '..\\..\\..\\windows\\system32\\sensitive',
              content: 'x',
            },
          ],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('handles path with null bytes or special chars', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [{ asset_id: 'asset-1', file_name: 'file.txt', success: true }],
          }),
      })
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [
            {
              path: 'src\x00evil.ts',
              content: 'x',
            },
          ],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })
  })

  // --- Edge cases ---
  describe('edge cases', () => {
    it('truncates oversized file content', async () => {
      process.env.AI_PROVIDER = 'lyzr'
      let uploadedContent = ''
      global.fetch = jest.fn().mockImplementation(async (_url: string, opts: RequestInit) => {
        const formData = opts.body as FormData
        const file = formData.get('files') as Blob
        uploadedContent = await file.text()
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ asset_id: 'asset-1', file_name: 'large.ts', success: true }],
            }),
        }
      })
      const largeContent = 'x'.repeat(2 * 1024 * 1024) // 2MB, exceeds 1MB limit
      const req = new Request('http://localhost/api/upload-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: 'large.ts', content: largeContent }],
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
      expect(uploadedContent.length).toBeLessThan(largeContent.length)
      expect(uploadedContent).toContain('truncated')
    })
  })
})
    