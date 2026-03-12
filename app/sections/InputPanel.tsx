'use client'

import React, { useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { VscCloudUpload, VscFile, VscTrash, VscCode, VscBeaker, VscShield, VscDebugAlt, VscGear, VscInfo, VscChevronDown, VscClose } from 'react-icons/vsc'

export interface TestDimension {
  key: string
  label: string
  enabled: boolean
  description: string
}

export interface UploadedFileInfo {
  file: File
  id: string
}

interface InputPanelProps {
  files: UploadedFileInfo[]
  onFilesChange: (files: UploadedFileInfo[]) => void
  pastedCode: string
  onPastedCodeChange: (code: string) => void
  dimensions: TestDimension[]
  onDimensionToggle: (key: string) => void
  onGenerate: () => void
  loading: boolean
  loadingStage: number
  inputMode: string
  onInputModeChange: (mode: string) => void
}

const LOADING_STAGES = [
  'Discovering APIs...',
  'Detecting Language...',
  'Writing Tests...',
]

function getDimensionIcon(key: string) {
  switch (key) {
    case 'unit': return <VscBeaker className="w-3.5 h-3.5" />
    case 'integration': return <VscGear className="w-3.5 h-3.5" />
    case 'contract': return <VscFile className="w-3.5 h-3.5" />
    case 'edgeCases': return <VscDebugAlt className="w-3.5 h-3.5" />
    case 'performance': return <VscCode className="w-3.5 h-3.5" />
    case 'security': return <VscShield className="w-3.5 h-3.5" />
    default: return <VscBeaker className="w-3.5 h-3.5" />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function InputPanel({
  files,
  onFilesChange,
  pastedCode,
  onPastedCodeChange,
  dimensions,
  onDimensionToggle,
  onGenerate,
  loading,
  loadingStage,
  inputMode,
  onInputModeChange,
}: InputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(true)
  const [dragActive, setDragActive] = React.useState(false)

  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    const newFiles: UploadedFileInfo[] = Array.from(selectedFiles).map((f) => ({
      file: f,
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }))
    onFilesChange([...files, ...newFiles])
  }, [files, onFilesChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }, [])

  const removeFile = useCallback((id: string) => {
    onFilesChange(files.filter((f) => f.id !== id))
  }, [files, onFilesChange])

  const canGenerate = inputMode === 'upload' ? files.length > 0 : pastedCode.trim().length > 0
  const enabledCount = dimensions.filter((d) => d.enabled).length

  return (
    <div className="flex flex-col gap-4 font-mono">
      <Card className="border border-border bg-card">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs tracking-widest uppercase text-foreground">
            Source Input
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Tabs value={inputMode} onValueChange={onInputModeChange}>
            <TabsList className="w-full bg-secondary border border-border mb-3">
              <TabsTrigger value="upload" className="flex-1 text-xs tracking-wider font-mono">
                <VscCloudUpload className="w-3.5 h-3.5 mr-1.5" />
                Upload Files
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex-1 text-xs tracking-wider font-mono">
                <VscCode className="w-3.5 h-3.5 mr-1.5" />
                Paste Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-0">
              <div
                className={`border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <VscCloudUpload className="w-8 h-8 text-muted-foreground" />
                <p className="text-xs tracking-wider text-muted-foreground text-center">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground/60 tracking-wider">
                  .zip, .py, .js, .ts, .java, .go, .rb, .rs
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".zip,.py,.js,.ts,.tsx,.jsx,.java,.go,.rb,.rs,.php,.cs,.cpp,.c,.h"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs tracking-wider text-muted-foreground mb-1">
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </p>
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-2 py-1.5 border border-border bg-secondary/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <VscFile className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                        <span className="text-xs tracking-wider text-foreground truncate">
                          {f.file.name}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatFileSize(f.file.size)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <VscClose className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="paste" className="mt-0">
              <Textarea
                placeholder="// Paste your API source code here..."
                className="min-h-[200px] font-mono text-xs tracking-wider bg-secondary border-border text-foreground placeholder:text-muted-foreground/50 resize-none"
                value={pastedCode}
                onChange={(e) => onPastedCodeChange(e.target.value)}
              />
              {pastedCode.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 tracking-wider">
                  {pastedCode.split('\n').length} lines
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card className="border border-border bg-card">
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 pt-3 px-4 cursor-pointer hover:bg-secondary/30 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs tracking-widest uppercase text-foreground">
                  Test Dimensions [{enabledCount}/6]
                </CardTitle>
                <VscChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="space-y-2">
                <TooltipProvider delayDuration={200}>
                  {dimensions.map((dim) => (
                    <div key={dim.key} className="flex items-center justify-between py-1.5 px-2 border border-border bg-secondary/30">
                      <div className="flex items-center gap-2">
                        {getDimensionIcon(dim.key)}
                        <span className="text-xs tracking-wider">{dim.label}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                              <VscInfo className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="font-mono text-xs tracking-wider max-w-[200px]">
                            {dim.description}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Switch
                        checked={dim.enabled}
                        onCheckedChange={() => onDimensionToggle(dim.key)}
                      />
                    </div>
                  ))}
                </TooltipProvider>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Button
        onClick={onGenerate}
        disabled={!canGenerate || loading}
        className="w-full font-mono text-xs tracking-widest uppercase h-10"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" style={{ borderRadius: '50%' }} />
            {LOADING_STAGES[loadingStage] ?? 'Processing...'}
          </div>
        ) : (
          'Generate Test Suite'
        )}
      </Button>

      {loading && (
        <div className="space-y-2">
          {LOADING_STAGES.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2 px-2">
              <div className={`w-2 h-2 ${i < loadingStage ? 'bg-primary' : i === loadingStage ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
              <span className={`text-xs tracking-wider ${i <= loadingStage ? 'text-foreground' : 'text-muted-foreground'}`}>
                {stage}
              </span>
              {i < loadingStage && (
                <span className="text-xs text-primary ml-auto tracking-wider">DONE</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
