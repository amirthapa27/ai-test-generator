'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { VscTerminal } from 'react-icons/vsc'

interface HeaderProps {
  sampleMode: boolean
  onSampleModeChange: (val: boolean) => void
}

export default function Header({ sampleMode, onSampleModeChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm font-mono">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 border border-border bg-secondary">
            <VscTerminal className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase text-foreground">
              API Test Coverage Agent
            </h1>
            <p className="text-xs tracking-wider text-muted-foreground">
              Automated test suite generation from codebase analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="sample-toggle" className="text-xs tracking-wider text-muted-foreground font-mono cursor-pointer">
            Sample Data
          </Label>
          <Switch
            id="sample-toggle"
            checked={sampleMode}
            onCheckedChange={onSampleModeChange}
          />
        </div>
      </div>
    </header>
  )
}
