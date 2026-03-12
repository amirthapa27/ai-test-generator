/**
 * Unit tests for file scanner logic.
 * Uses mocked vscode.workspace.
 */
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// Mock vscode before importing fileScanner
const mockFindFiles = jest.fn().mockResolvedValue([])
jest.mock('vscode', () => ({
  workspace: {
    findFiles: (...args: unknown[]) => mockFindFiles(...args),
    workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
  },
}), { virtual: true })

describe('fileScanner', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'api-test-'))
  })

  afterAll(async () => {
    await fs.promises.rm(tmpDir, { recursive: true }).catch(() => {})
  })

  beforeEach(() => {
    mockFindFiles.mockReset()
  })

  it('returns single file when userPath points to a file', async () => {
    const filePath = path.join(tmpDir, 'route.ts')
    await fs.promises.writeFile(filePath, 'export default function handler() {}')

    const { scanForApiFiles } = await import('../fileScanner')
    const result = await scanForApiFiles(tmpDir, filePath, 100)

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(filePath)
    expect(result[0].content).toContain('handler')
  })

  it('returns empty when userPath does not exist', async () => {
    const { scanForApiFiles } = await import('../fileScanner')
    const result = await scanForApiFiles(tmpDir, path.join(tmpDir, 'nonexistent'), 100)
    expect(result).toHaveLength(0)
  })

  it('truncates large files', async () => {
    const filePath = path.join(tmpDir, 'large.ts')
    const bigContent = 'x'.repeat(300 * 1024)
    await fs.promises.writeFile(filePath, bigContent)

    const { scanForApiFiles } = await import('../fileScanner')
    const result = await scanForApiFiles(tmpDir, filePath, 50)

    expect(result).toHaveLength(1)
    expect(result[0].content.length).toBeLessThanOrEqual(50 * 1024 + 100)
    expect(result[0].content).toContain('truncated')
  })
})
