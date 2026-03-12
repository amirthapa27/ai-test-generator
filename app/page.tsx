'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import type { AIAgentResponse, ArtifactFile } from '@/lib/aiAgent'
import Header from './sections/Header'
import InputPanel from './sections/InputPanel'
import type { TestDimension, UploadedFileInfo } from './sections/InputPanel'
import ResultsPanel from './sections/ResultsPanel'

const AGENT_ID = '69b1c1bdc6b88ef89da98ec4'

const DEFAULT_DIMENSIONS: TestDimension[] = [
  { key: 'unit', label: 'Unit Tests', enabled: true, description: 'Isolated function-level tests for individual handlers and utilities.' },
  { key: 'integration', label: 'Integration Tests', enabled: true, description: 'Tests verifying interaction between modules and external services.' },
  { key: 'contract', label: 'Contract / Schema', enabled: true, description: 'Validates request/response schemas and API contracts.' },
  { key: 'edgeCases', label: 'Edge Cases', enabled: true, description: 'Boundary conditions, empty inputs, and unusual data patterns.' },
  { key: 'performance', label: 'Performance', enabled: true, description: 'Load, response time, and throughput test cases.' },
  { key: 'security', label: 'Security', enabled: true, description: 'Auth bypass, injection, CORS, and vulnerability tests.' },
]

interface ResultsData {
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
  coverageBreakdown?: {
    unit?: number
    integration?: number
    contract?: number
    edgeCases?: number
    performance?: number
    security?: number
  }
  warnings?: string[]
}

const SAMPLE_DATA: ResultsData = {
  summary: 'Analyzed **Express.js** application with **5 API endpoints**. Generated **42 test cases** across 6 testing dimensions using **Jest** with **supertest**. All endpoints fully covered including authentication middleware, input validation, and error handling paths.',
  language: 'TypeScript',
  framework: 'Express.js',
  testingFramework: 'Jest + Supertest',
  totalEndpoints: 5,
  totalTestCases: 42,
  endpoints: [
    {
      path: '/api/users',
      method: 'GET',
      description: 'List all users with pagination',
      testDimensions: {
        unitTests: 'describe("GET /api/users", () => {\n  it("should return paginated users list", async () => {\n    const res = await request(app).get("/api/users?page=1&limit=10");\n    expect(res.status).toBe(200);\n    expect(res.body.data).toBeInstanceOf(Array);\n    expect(res.body.pagination.page).toBe(1);\n  });\n\n  it("should return empty array for no users", async () => {\n    jest.spyOn(UserModel, "find").mockResolvedValue([]);\n    const res = await request(app).get("/api/users");\n    expect(res.body.data).toHaveLength(0);\n  });\n});',
        integrationTests: 'describe("GET /api/users - Integration", () => {\n  beforeAll(async () => {\n    await db.connect();\n    await UserModel.insertMany(testUsers);\n  });\n\n  it("should fetch users from database", async () => {\n    const res = await request(app).get("/api/users");\n    expect(res.status).toBe(200);\n    expect(res.body.data.length).toBeGreaterThan(0);\n  });\n});',
        contractTests: 'describe("GET /api/users - Contract", () => {\n  it("should match response schema", async () => {\n    const res = await request(app).get("/api/users");\n    expect(res.body).toHaveProperty("data");\n    expect(res.body).toHaveProperty("pagination");\n    expect(res.body.pagination).toHaveProperty("page");\n    expect(res.body.pagination).toHaveProperty("total");\n  });\n});',
        edgeCaseTests: 'describe("GET /api/users - Edge Cases", () => {\n  it("should handle negative page number", async () => {\n    const res = await request(app).get("/api/users?page=-1");\n    expect(res.status).toBe(400);\n  });\n\n  it("should handle limit exceeding max", async () => {\n    const res = await request(app).get("/api/users?limit=10000");\n    expect(res.body.pagination.limit).toBeLessThanOrEqual(100);\n  });\n});',
        performanceTests: 'describe("GET /api/users - Performance", () => {\n  it("should respond within 200ms", async () => {\n    const start = Date.now();\n    await request(app).get("/api/users");\n    expect(Date.now() - start).toBeLessThan(200);\n  });\n});',
        securityTests: 'describe("GET /api/users - Security", () => {\n  it("should require authentication", async () => {\n    const res = await request(app).get("/api/users");\n    expect(res.status).toBe(401);\n  });\n\n  it("should not expose sensitive fields", async () => {\n    const res = await authedRequest(app).get("/api/users");\n    res.body.data.forEach((user: any) => {\n      expect(user).not.toHaveProperty("password");\n      expect(user).not.toHaveProperty("ssn");\n    });\n  });\n});',
      },
    },
    {
      path: '/api/users',
      method: 'POST',
      description: 'Create a new user',
      testDimensions: {
        unitTests: 'describe("POST /api/users", () => {\n  it("should create a user with valid data", async () => {\n    const res = await request(app)\n      .post("/api/users")\n      .send({ name: "John", email: "john@test.com" });\n    expect(res.status).toBe(201);\n    expect(res.body.data.name).toBe("John");\n  });\n});',
        integrationTests: 'describe("POST /api/users - Integration", () => {\n  it("should persist user to database", async () => {\n    const userData = { name: "Jane", email: "jane@test.com" };\n    const res = await request(app).post("/api/users").send(userData);\n    const dbUser = await UserModel.findById(res.body.data.id);\n    expect(dbUser).toBeTruthy();\n    expect(dbUser.email).toBe(userData.email);\n  });\n});',
        contractTests: 'describe("POST /api/users - Contract", () => {\n  it("should require name and email fields", async () => {\n    const res = await request(app).post("/api/users").send({});\n    expect(res.status).toBe(422);\n    expect(res.body.errors).toContainEqual(\n      expect.objectContaining({ field: "name" })\n    );\n  });\n});',
        edgeCaseTests: 'describe("POST /api/users - Edge Cases", () => {\n  it("should reject duplicate email", async () => {\n    await request(app).post("/api/users").send({ name: "A", email: "dup@test.com" });\n    const res = await request(app).post("/api/users").send({ name: "B", email: "dup@test.com" });\n    expect(res.status).toBe(409);\n  });\n\n  it("should handle extremely long name", async () => {\n    const res = await request(app).post("/api/users").send({ name: "A".repeat(5000), email: "t@t.com" });\n    expect(res.status).toBe(400);\n  });\n});',
        performanceTests: '',
        securityTests: 'describe("POST /api/users - Security", () => {\n  it("should sanitize XSS in name field", async () => {\n    const res = await request(app)\n      .post("/api/users")\n      .send({ name: "<script>alert(1)</script>", email: "x@t.com" });\n    expect(res.body.data.name).not.toContain("<script>");\n  });\n});',
      },
    },
    {
      path: '/api/users/:id',
      method: 'PUT',
      description: 'Update user by ID',
      testDimensions: {
        unitTests: 'describe("PUT /api/users/:id", () => {\n  it("should update user fields", async () => {\n    const res = await request(app)\n      .put("/api/users/123")\n      .send({ name: "Updated" });\n    expect(res.status).toBe(200);\n    expect(res.body.data.name).toBe("Updated");\n  });\n});',
        integrationTests: 'describe("PUT /api/users/:id - Integration", () => {\n  it("should update user in database", async () => {\n    const user = await UserModel.create({ name: "Old", email: "old@t.com" });\n    await request(app).put(`/api/users/${user._id}`).send({ name: "New" });\n    const updated = await UserModel.findById(user._id);\n    expect(updated.name).toBe("New");\n  });\n});',
        contractTests: '',
        edgeCaseTests: 'describe("PUT /api/users/:id - Edge Cases", () => {\n  it("should return 404 for non-existent user", async () => {\n    const res = await request(app).put("/api/users/nonexistent").send({ name: "X" });\n    expect(res.status).toBe(404);\n  });\n});',
        performanceTests: '',
        securityTests: '',
      },
    },
    {
      path: '/api/users/:id',
      method: 'DELETE',
      description: 'Delete user by ID',
      testDimensions: {
        unitTests: 'describe("DELETE /api/users/:id", () => {\n  it("should delete user and return 204", async () => {\n    const res = await request(app).delete("/api/users/123");\n    expect(res.status).toBe(204);\n  });\n});',
        integrationTests: '',
        contractTests: '',
        edgeCaseTests: 'describe("DELETE /api/users/:id - Edge Cases", () => {\n  it("should return 404 for already-deleted user", async () => {\n    await request(app).delete("/api/users/123");\n    const res = await request(app).delete("/api/users/123");\n    expect(res.status).toBe(404);\n  });\n});',
        performanceTests: '',
        securityTests: 'describe("DELETE /api/users/:id - Security", () => {\n  it("should require admin role", async () => {\n    const res = await userRequest(app).delete("/api/users/123");\n    expect(res.status).toBe(403);\n  });\n});',
      },
    },
    {
      path: '/api/auth/login',
      method: 'POST',
      description: 'Authenticate user and return JWT',
      testDimensions: {
        unitTests: 'describe("POST /api/auth/login", () => {\n  it("should return JWT for valid credentials", async () => {\n    const res = await request(app)\n      .post("/api/auth/login")\n      .send({ email: "user@test.com", password: "pass123" });\n    expect(res.status).toBe(200);\n    expect(res.body).toHaveProperty("token");\n  });\n});',
        integrationTests: '',
        contractTests: 'describe("POST /api/auth/login - Contract", () => {\n  it("should return token and user object", async () => {\n    const res = await request(app)\n      .post("/api/auth/login")\n      .send({ email: "user@test.com", password: "pass123" });\n    expect(res.body).toHaveProperty("token");\n    expect(res.body).toHaveProperty("user");\n    expect(res.body.user).toHaveProperty("id");\n    expect(res.body.user).not.toHaveProperty("password");\n  });\n});',
        edgeCaseTests: 'describe("POST /api/auth/login - Edge Cases", () => {\n  it("should handle empty credentials", async () => {\n    const res = await request(app).post("/api/auth/login").send({});\n    expect(res.status).toBe(400);\n  });\n});',
        performanceTests: '',
        securityTests: 'describe("POST /api/auth/login - Security", () => {\n  it("should rate-limit after 5 failed attempts", async () => {\n    for (let i = 0; i < 5; i++) {\n      await request(app).post("/api/auth/login").send({ email: "x@t.com", password: "wrong" });\n    }\n    const res = await request(app).post("/api/auth/login").send({ email: "x@t.com", password: "wrong" });\n    expect(res.status).toBe(429);\n  });\n\n  it("should not reveal if email exists", async () => {\n    const res = await request(app).post("/api/auth/login").send({ email: "nobody@t.com", password: "x" });\n    expect(res.body.message).toBe("Invalid credentials");\n  });\n});',
      },
    },
  ],
  coverageBreakdown: {
    unit: 8,
    integration: 4,
    contract: 5,
    edgeCases: 9,
    performance: 2,
    security: 7,
  },
  warnings: [
    'No rate-limiting middleware detected on POST endpoints.',
    'Consider adding input sanitization tests for user-generated content fields.',
  ],
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground font-mono">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2 tracking-wider">SYSTEM ERROR</h2>
            <p className="text-muted-foreground mb-4 text-sm tracking-wider">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm tracking-wider"
            >
              RETRY
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function Page() {
  const [sampleMode, setSampleMode] = useState(false)
  const [files, setFiles] = useState<UploadedFileInfo[]>([])
  const [pastedCode, setPastedCode] = useState('')
  const [dimensions, setDimensions] = useState<TestDimension[]>(DEFAULT_DIMENSIONS)
  const [inputMode, setInputMode] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [resultsData, setResultsData] = useState<ResultsData | null>(null)
  const [artifactFiles, setArtifactFiles] = useState<ArtifactFile[]>([])
  const [hasResults, setHasResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleDimensionToggle = useCallback((key: string) => {
    setDimensions((prev) =>
      prev.map((d) => (d.key === key ? { ...d, enabled: !d.enabled } : d))
    )
  }, [])

  const handleSampleModeChange = useCallback((val: boolean) => {
    setSampleMode(val)
    if (val) {
      setResultsData(SAMPLE_DATA)
      setArtifactFiles([{ file_url: 'https://example.com/test-suite.zip', name: 'test-suite.zip', format_type: 'zip' }])
      setHasResults(true)
      setError(null)
    } else {
      setResultsData(null)
      setArtifactFiles([])
      setHasResults(false)
      setError(null)
    }
  }, [])

  const startLoadingStages = useCallback(() => {
    setLoadingStage(0)
    let stage = 0
    stageIntervalRef.current = setInterval(() => {
      stage += 1
      if (stage < 3) {
        setLoadingStage(stage)
      }
    }, 4000)
  }, [])

  const stopLoadingStages = useCallback(() => {
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current)
      stageIntervalRef.current = null
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setError(null)
    setHasResults(false)
    setResultsData(null)
    setArtifactFiles([])
    setActiveAgentId(AGENT_ID)
    startLoadingStages()

    const enabledDims = dimensions.filter((d) => d.enabled).map((d) => d.label)

    try {
      let result: AIAgentResponse

      if (inputMode === 'upload' && files.length > 0) {
        const rawFiles = files.map((f) => f.file)
        const configRes = await fetch('/api/config')
        const apiConfig = configRes.ok ? (await configRes.json()) : { provider: 'lyzr', isAsync: true }
        const useLyzrAssets = apiConfig.provider === 'lyzr' && apiConfig.isAsync

        if (useLyzrAssets) {
          const uploadResult = await uploadFiles(rawFiles)
          if (!uploadResult.success) throw new Error(uploadResult.error || 'File upload failed')
          const message = `Analyze the uploaded codebase and generate comprehensive test suites for the following testing dimensions: ${enabledDims.join(', ')}. Discover all API endpoints, detect the programming language and framework, and generate production-ready test files.`
          result = await callAIAgent(message, AGENT_ID, { assets: uploadResult.asset_ids })
        } else {
          const filePayload = await Promise.all(
            rawFiles.map(async (f) => ({
              path: f.name,
              content: await f.text(),
            }))
          )
          const message = `Analyze the codebase and generate comprehensive test suites for: ${enabledDims.join(', ')}. Discover all API endpoints, detect the programming language and framework, and generate production-ready test files.`
          result = await callAIAgent(message, AGENT_ID, { files: filePayload })
        }
      } else if (inputMode === 'paste' && pastedCode.trim()) {
        const message = `Here is my codebase code:\n\n${pastedCode}\n\nAnalyze this code and generate comprehensive test suites for: ${enabledDims.join(', ')}. Discover all API endpoints, detect the programming language and framework, and generate production-ready test files.`
        result = await callAIAgent(message, AGENT_ID)
      } else {
        throw new Error('No input provided. Upload files or paste code.')
      }

      stopLoadingStages()
      setLoadingStage(2)

      if (result.success) {
        const data = result?.response?.result ?? {}
        setResultsData({
          summary: data?.summary ?? '',
          language: data?.language ?? '',
          framework: data?.framework ?? '',
          testingFramework: data?.testingFramework ?? '',
          totalEndpoints: data?.totalEndpoints ?? 0,
          totalTestCases: data?.totalTestCases ?? 0,
          endpoints: Array.isArray(data?.endpoints) ? data.endpoints : [],
          coverageBreakdown: data?.coverageBreakdown ?? {},
          warnings: Array.isArray(data?.warnings) ? data.warnings : [],
        })
        const moduleFiles = Array.isArray(result?.module_outputs?.artifact_files)
          ? result.module_outputs!.artifact_files
          : []
        setArtifactFiles(moduleFiles)
        setHasResults(true)
      } else {
        throw new Error(result?.error || result?.response?.message || 'Agent call failed')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      stopLoadingStages()
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [files, pastedCode, dimensions, inputMode, startLoadingStages, stopLoadingStages])

  useEffect(() => {
    return () => {
      stopLoadingStages()
    }
  }, [stopLoadingStages])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-mono" style={{ letterSpacing: '0.05em' }}>
        <Header sampleMode={sampleMode} onSampleModeChange={handleSampleModeChange} />
        <main className="flex flex-col lg:flex-row gap-4 p-4 max-w-[1600px] mx-auto">
          <div className="w-full lg:w-[40%] flex-shrink-0">
            <InputPanel
              files={files}
              onFilesChange={setFiles}
              pastedCode={pastedCode}
              onPastedCodeChange={setPastedCode}
              dimensions={dimensions}
              onDimensionToggle={handleDimensionToggle}
              onGenerate={handleGenerate}
              loading={loading}
              loadingStage={loadingStage}
              inputMode={inputMode}
              onInputModeChange={setInputMode}
            />
          </div>
          <div className="w-full lg:w-[60%]">
            <ResultsPanel
              data={resultsData}
              artifactFiles={artifactFiles}
              hasResults={hasResults}
              error={error}
              onRetry={handleGenerate}
              loading={loading}
              activeAgentId={activeAgentId}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
