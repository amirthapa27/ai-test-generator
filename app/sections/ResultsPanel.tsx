'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { copyToClipboard } from '@/lib/clipboard'
import { VscTerminal, VscCloudDownload, VscCopy, VscCheck, VscWarning, VscChevronDown, VscChevronRight, VscRefresh, VscCode, VscBeaker, VscShield, VscDebugAlt, VscGear, VscFile } from 'react-icons/vsc'

interface Endpoint {
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
}

interface CoverageBreakdown {
  unit?: number
  integration?: number
  contract?: number
  edgeCases?: number
  performance?: number
  security?: number
}

interface ArtifactFile {
  file_url?: string
  name?: string
  format_type?: string
}

interface ResultsData {
  summary?: string
  language?: string
  framework?: string
  testingFramework?: string
  totalEndpoints?: number
  totalTestCases?: number
  endpoints?: Endpoint[]
  coverageBreakdown?: CoverageBreakdown
  warnings?: string[]
}

interface ResultsPanelProps {
  data: ResultsData | null
  artifactFiles: ArtifactFile[]
  hasResults: boolean
  error: string | null
  onRetry: () => void
  loading: boolean
  activeAgentId: string | null
}

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: '#065f46', text: '#34d399' },
  POST: { bg: '#78350f', text: '#fbbf24' },
  PUT: { bg: '#1e3a5f', text: '#60a5fa' },
  DELETE: { bg: '#7f1d1d', text: '#f87171' },
  PATCH: { bg: '#4c1d95', text: '#a78bfa' },
}

const DIMENSION_TABS = [
  { key: 'unitTests', label: 'Unit', icon: VscBeaker },
  { key: 'integrationTests', label: 'Integration', icon: VscGear },
  { key: 'contractTests', label: 'Contract', icon: VscFile },
  { key: 'edgeCaseTests', label: 'Edge Cases', icon: VscDebugAlt },
  { key: 'performanceTests', label: 'Performance', icon: VscCode },
  { key: 'securityTests', label: 'Security', icon: VscShield },
]

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-xs mt-2 mb-0.5 text-foreground">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="font-semibold text-sm mt-2 mb-0.5 text-foreground">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-xs text-foreground">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-xs text-foreground">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-0.5" />
        return <p key={i} className="text-xs text-foreground">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function EndpointCard({ endpoint, index }: { endpoint: Endpoint; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedTab, setCopiedTab] = useState<string | null>(null)

  const method = (endpoint?.method ?? 'GET').toUpperCase()
  const colors = METHOD_COLORS[method] || METHOD_COLORS.GET

  const dims = endpoint?.testDimensions ?? {}
  const availableTabs = DIMENSION_TABS.filter(
    (t) => dims[t.key as keyof typeof dims] && (dims[t.key as keyof typeof dims] ?? '').trim().length > 0
  )

  const handleCopy = async (key: string, content: string) => {
    const success = await copyToClipboard(content)
    if (success) {
      setCopiedTab(key)
      setTimeout(() => setCopiedTab(null), 2000)
    }
  }

  return (
    <Card className="border border-border bg-card">
      <button
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-secondary/30 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            className="font-mono text-xs tracking-wider px-2 py-0 border-0 font-bold"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {method}
          </Badge>
          <span className="text-xs tracking-wider text-foreground truncate font-mono">
            {endpoint?.path ?? '/unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {endpoint?.description && (
            <span className="text-xs text-muted-foreground tracking-wider hidden lg:inline truncate max-w-[200px]">
              {endpoint.description}
            </span>
          )}
          {expanded ? <VscChevronDown className="w-4 h-4 text-muted-foreground" /> : <VscChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && availableTabs.length > 0 && (
        <CardContent className="px-3 pb-3 pt-0">
          <Separator className="mb-2" />
          {endpoint?.description && (
            <p className="text-xs text-muted-foreground tracking-wider mb-2 lg:hidden">{endpoint.description}</p>
          )}
          <Tabs defaultValue={availableTabs[0]?.key ?? 'unitTests'}>
            <TabsList className="w-full bg-secondary border border-border flex-wrap h-auto gap-0">
              {availableTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="text-xs tracking-wider font-mono flex-1 min-w-0 px-1.5">
                    <Icon className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {availableTabs.map((tab) => {
              const content = dims[tab.key as keyof typeof dims] ?? ''
              return (
                <TabsContent key={tab.key} value={tab.key} className="mt-2">
                  <div className="relative">
                    <button
                      className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-foreground transition-colors z-10"
                      onClick={() => handleCopy(tab.key, content)}
                      title="Copy to clipboard"
                    >
                      {copiedTab === tab.key ? (
                        <VscCheck className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <VscCopy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <ScrollArea className="max-h-[300px]">
                      <pre className="p-3 pr-8 bg-secondary/50 border border-border text-xs text-foreground font-mono whitespace-pre-wrap break-words tracking-wider leading-relaxed">
                        {content}
                      </pre>
                    </ScrollArea>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      )}
    </Card>
  )
}

function CoverageMatrix({ coverage, endpoints }: { coverage: CoverageBreakdown; endpoints: Endpoint[] }) {
  const dimensionKeys = ['unit', 'integration', 'contract', 'edgeCases', 'performance', 'security']
  const dimensionLabels = ['UNT', 'INT', 'CON', 'EDG', 'PRF', 'SEC']
  const testDimKeys = ['unitTests', 'integrationTests', 'contractTests', 'edgeCaseTests', 'performanceTests', 'securityTests']

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-xs tracking-widest uppercase text-foreground">
          Coverage Matrix
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr>
                <th className="text-left py-1 px-1 text-muted-foreground tracking-wider">Endpoint</th>
                {dimensionLabels.map((label, i) => (
                  <th key={label} className="text-center py-1 px-1 text-muted-foreground tracking-wider">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(endpoints) && endpoints.map((ep, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 px-1 text-foreground tracking-wider truncate max-w-[120px]">
                    <span className="font-bold" style={{ color: METHOD_COLORS[(ep?.method ?? 'GET').toUpperCase()]?.text ?? '#fbbf24' }}>
                      {(ep?.method ?? 'GET').toUpperCase().slice(0, 3)}
                    </span>
                    {' '}{ep?.path ?? ''}
                  </td>
                  {testDimKeys.map((dk) => {
                    const val = ep?.testDimensions?.[dk as keyof typeof ep.testDimensions]
                    const has = val && val.trim().length > 0
                    return (
                      <td key={dk} className="text-center py-1 px-1">
                        {has ? (
                          <VscCheck className="w-3 h-3 text-primary inline-block" />
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Separator className="my-2" />
        <div className="flex flex-wrap gap-3">
          {dimensionKeys.map((key, i) => {
            const val = coverage?.[key as keyof CoverageBreakdown] ?? 0
            return (
              <div key={key} className="text-xs tracking-wider">
                <span className="text-muted-foreground">{dimensionLabels[i]}:</span>
                <span className="text-foreground ml-1 font-bold">{val}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ResultsPanel({
  data,
  artifactFiles,
  hasResults,
  error,
  onRetry,
  loading,
  activeAgentId,
}: ResultsPanelProps) {
  if (error) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <VscWarning className="w-8 h-8 text-destructive" />
          <p className="text-xs tracking-wider text-destructive text-center font-mono">{error}</p>
          <Button onClick={onRetry} variant="outline" size="sm" className="font-mono text-xs tracking-wider">
            <VscRefresh className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!hasResults) {
    return (
      <Card className="border border-border bg-card h-full">
        <CardContent className="p-8 flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
          <div className="border-2 border-dashed border-border p-6 flex flex-col items-center gap-3">
            <VscTerminal className="w-12 h-12 text-muted-foreground" />
            <div className="text-center space-y-1">
              <p className="text-sm tracking-widest text-foreground font-mono">
                {'>'} AWAITING INPUT_
              </p>
              <p className="text-xs tracking-wider text-muted-foreground font-mono">
                Drop your codebase to get started
              </p>
              <p className="text-xs text-muted-foreground/60 font-mono tracking-wider">
                Upload source files or paste code to auto-generate test suites
              </p>
            </div>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-xs text-muted-foreground tracking-wider font-mono">
              [1] Upload API source code
            </p>
            <p className="text-xs text-muted-foreground tracking-wider font-mono">
              [2] Select test dimensions
            </p>
            <p className="text-xs text-muted-foreground tracking-wider font-mono">
              [3] Generate comprehensive test suite
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const endpoints = Array.isArray(data?.endpoints) ? data.endpoints : []
  const warnings = Array.isArray(data?.warnings) ? data.warnings : []
  const coverage = data?.coverageBreakdown ?? {}
  const files = Array.isArray(artifactFiles) ? artifactFiles : []

  const handleDownloadAll = () => {
    files.forEach((f) => {
      if (f?.file_url) {
        window.open(f.file_url, '_blank')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 font-mono">
      <Card className="border border-border bg-card">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground tracking-wider">LANGUAGE</p>
                <Badge variant="outline" className="text-xs tracking-wider font-mono border-primary text-primary">
                  {data?.language ?? 'Unknown'}
                </Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground tracking-wider">FRAMEWORK</p>
                <Badge variant="outline" className="text-xs tracking-wider font-mono border-primary text-primary">
                  {data?.framework ?? 'Unknown'}
                </Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground tracking-wider">TEST FW</p>
                <Badge variant="outline" className="text-xs tracking-wider font-mono border-primary text-primary">
                  {data?.testingFramework ?? 'Unknown'}
                </Badge>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground tracking-wider">ENDPOINTS</p>
                <p className="text-sm font-bold text-foreground">{data?.totalEndpoints ?? 0}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground tracking-wider">TEST CASES</p>
                <p className="text-sm font-bold text-foreground">{data?.totalTestCases ?? 0}</p>
              </div>
            </div>
            {files.length > 0 && (
              <Button onClick={handleDownloadAll} variant="outline" size="sm" className="font-mono text-xs tracking-wider flex-shrink-0">
                <VscCloudDownload className="w-3.5 h-3.5 mr-1.5" />
                Download All ({files.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {data?.summary && (
        <Card className="border border-border bg-card">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs tracking-widest uppercase text-foreground">Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {renderMarkdown(data.summary)}
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="border border-destructive/50 bg-card">
          <CardContent className="p-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2">
                <VscWarning className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-xs tracking-wider text-destructive/80">{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {endpoints.length > 0 && (
        <CoverageMatrix coverage={coverage} endpoints={endpoints} />
      )}

      <div className="space-y-2">
        <p className="text-xs tracking-widest uppercase text-muted-foreground px-1">
          Endpoints [{endpoints.length}]
        </p>
        {endpoints.map((ep, i) => (
          <EndpointCard key={i} endpoint={ep} index={i} />
        ))}
      </div>

      <Card className="border border-border bg-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${activeAgentId ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
            <span className="text-xs tracking-wider text-muted-foreground">
              Test Suite Orchestrator
            </span>
            <span className="text-xs tracking-wider text-muted-foreground/50 ml-auto">
              {activeAgentId ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
