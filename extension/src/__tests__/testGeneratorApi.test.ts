jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string) => (key === 'apiUrl' ? 'http://localhost:3333' : key === 'agentId' ? 'test-agent' : undefined),
    }),
  },
}), { virtual: true })

/**
 * Unit tests for test generator API.
 */
describe('testGeneratorApi', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('checkHealth returns true when backend responds ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
    const { checkHealth } = await import('../testGeneratorApi')
    const result = await checkHealth('http://localhost:3333')
    expect(result).toBe(true)
  })

  it('checkHealth returns false when backend fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false })
    const { checkHealth } = await import('../testGeneratorApi')
    const result = await checkHealth('http://localhost:3333')
    expect(result).toBe(false)
  })

  it('checkHealth returns false on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const { checkHealth } = await import('../testGeneratorApi')
    const result = await checkHealth('http://localhost:3333')
    expect(result).toBe(false)
  })

  it('getConfig returns defaults', async () => {
    const { getConfig } = await import('../testGeneratorApi')
    const config = getConfig()
    expect(config.apiUrl).toBeDefined()
    expect(config.agentId).toBeDefined()
  })
})
