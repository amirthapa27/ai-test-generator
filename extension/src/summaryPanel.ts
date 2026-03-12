/**
 * Summary panel - shown in a SEPARATE window (Beside view).
 * Displays high-level overview: language, framework, endpoint count, test count.
 * Download artifacts button.
 */
import * as vscode from 'vscode'
import type { TestResult } from './testGeneratorApi'

export class SummaryPanel {
  public static readonly viewType = 'apiTestCoverage.summary'
  private _panel: vscode.WebviewPanel | undefined
  private _extensionUri: vscode.Uri
  private _artifactFiles: Array<{ file_url: string; name: string; format_type: string }> = []

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri
  }

  public show() {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    this._panel = vscode.window.createWebviewPanel(
      SummaryPanel.viewType,
      'Test Summary',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    )

    this._panel.webview.onDidReceiveMessage((msg: { command: string; url?: string; name?: string }) => {
      if (msg.command === 'downloadArtifact' && msg.url && msg.name) {
        this.downloadArtifact(msg.url, msg.name)
      }
    })

    this._panel.onDidDispose(() => {
      this._panel = undefined
    })
  }

  private async downloadArtifact(url: string, name: string) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      const buf = await res.arrayBuffer()
      const workspaceFolders = vscode.workspace.workspaceFolders
      if (!workspaceFolders?.length) {
        vscode.window.showErrorMessage('No workspace folder open')
        return
      }
      const chosen = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(workspaceFolders[0].uri, name),
        title: 'Save artifact',
      })
      if (chosen) {
        await vscode.workspace.fs.writeFile(chosen, new Uint8Array(buf))
        vscode.window.showInformationMessage(`Saved ${name}`)
      }
    } catch (e) {
      vscode.window.showErrorMessage(`Download failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  public setLoading(stage: string) {
    if (this._panel) {
      this._panel.webview.html = this.getLoadingHtml(stage)
    }
  }

  public setSummary(data: TestResult, artifactFiles?: Array<{ file_url: string; name: string; format_type: string }>) {
    if (this._panel) {
      this._panel.webview.html = this.getSummaryHtml(data, artifactFiles)
    }
  }

  public setError(message: string) {
    if (this._panel) {
      this._panel.webview.html = this.getErrorHtml(message)
    }
  }

  public dispose() {
    this._panel?.dispose()
    this._panel = undefined
  }

  private getLoadingHtml(stage: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); padding: 24px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .spinner { width: 40px; height: 40px; border: 3px solid var(--vscode-button-background); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 40px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { text-align: center; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>${escapeHtml(stage)}</p>
</body>
</html>`
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 24px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .error { background: rgba(255,100,100,0.1); border: 1px solid rgba(255,100,100,0.3); border-radius: 8px; padding: 16px; color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <div class="error">${escapeHtml(message)}</div>
</body>
</html>`
  }

  private getSummaryHtml(d: TestResult, artifactFiles?: Array<{ file_url: string; name: string; format_type: string }>): string {
    this._artifactFiles = artifactFiles || []
    const summary = d.summary || 'No summary available.'
    const language = d.language || '-'
    const framework = d.framework || '-'
    const testingFramework = d.testingFramework || '-'
    const totalEndpoints = d.totalEndpoints ?? 0
    const totalTestCases = d.totalTestCases ?? 0

    // Code coverage – based on SELECTED dimensions (those that have tests)
    const coverageBreakdown = d.coverageBreakdown ?? {}
    const coverageEntries = Object.entries(coverageBreakdown).filter(([, v]) => typeof v === 'number' && v > 0)
    const totalDimensionTests = coverageEntries.reduce((sum, [, v]) => sum + (v as number), 0)

    // Also compute breakdown from endpoints if AI didn't provide coverageBreakdown
    let effectiveEntries = coverageEntries
    if (effectiveEntries.length === 0 && d.endpoints?.length) {
      const dimKeys = ['unitTests', 'integrationTests', 'contractTests', 'edgeCaseTests', 'performanceTests', 'securityTests']
      const keyToShort: Record<string, string> = {
        unitTests: 'unit',
        integrationTests: 'integration',
        contractTests: 'contract',
        edgeCaseTests: 'edgeCases',
        performanceTests: 'performance',
        securityTests: 'security',
      }
      const counts: Record<string, number> = {}
      for (const ep of d.endpoints) {
        for (const k of dimKeys) {
          const short = keyToShort[k]
          if (ep.testDimensions?.[k as keyof typeof ep.testDimensions]?.trim()) {
            counts[short] = (counts[short] || 0) + 1
          }
        }
      }
      effectiveEntries = Object.entries(counts).filter(([, v]) => v > 0)
    }

    const dimensionsSelected = effectiveEntries.length || 1
    const maxSlots = totalEndpoints > 0 ? totalEndpoints * dimensionsSelected : totalTestCases
    const coveragePercent = totalTestCases > 0 && maxSlots > 0
      ? Math.min(100, Math.round((totalTestCases / maxSlots) * 100))
      : totalTestCases > 0 ? 100 : 0

    const labels: Record<string, string> = {
      unit: 'Unit',
      integration: 'Integration',
      contract: 'Contract',
      edgeCases: 'Edge Cases',
      performance: 'Performance',
      security: 'Security',
    }

    let coverageHtml = ''
    if (totalTestCases > 0) {
      coverageHtml = `
        <h3>Code Coverage</h3>
        <div class="coverage-stats">
          <div class="coverage-pct">
            <span class="pct-value">${coveragePercent}%</span>
            <span class="pct-label">Coverage for selected dimensions (${effectiveEntries.map(([k]) => labels[k] || k).join(', ')})</span>
          </div>
          ${effectiveEntries.length > 0 ? `
          <div class="coverage-bars">
            ${effectiveEntries
              .map(([key, count]) => {
                const label = labels[key] || key
                const epPct = totalEndpoints > 0 ? Math.round((count / totalEndpoints) * 100) : 0
                return `
                  <div class="coverage-row">
                    <span class="coverage-label">${escapeHtml(label)}</span>
                    <span class="coverage-bar-wrap">
                      <span class="coverage-bar" style="width: ${epPct}%"></span>
                    </span>
                    <span class="coverage-count">${count}/${totalEndpoints} endpoints (${epPct}%)</span>
                  </div>`
              })
              .join('')}
          </div>
          ` : ''}
          <p class="coverage-note">${totalTestCases} tests across ${totalEndpoints} endpoint(s). ${coveragePercent === 100 ? 'All selected dimensions fully covered.' : `${totalTestCases} of ${maxSlots} slots filled.`}</p>
        </div>`
    }

    let endpointsHtml = ''
    if (d.endpoints?.length) {
      endpointsHtml = `
        <h3>Endpoints (${d.endpoints.length})</h3>
        <ul class="endpoint-list">
          ${d.endpoints
            .slice(0, 15)
            .map(
              (e) =>
                `<li><code>${escapeHtml((e.method || '').toUpperCase())} ${escapeHtml(e.path || '')}</code></li>`
            )
            .join('')}
          ${d.endpoints.length > 15 ? `<li><em>... and ${d.endpoints.length - 15} more</em></li>` : ''}
        </ul>`
    }

    const warningsHtml =
      d.warnings?.length
        ? `
        <h3>Warnings</h3>
        <ul class="warnings">
          ${d.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}
        </ul>`
        : ''

    const artifactsHtml =
      this._artifactFiles.length > 0
        ? `
        <h3>Artifacts</h3>
        <div class="artifacts">
          ${this._artifactFiles
            .map(
              (a) =>
                `<button class="artifact-btn" data-url="${escapeHtml(a.file_url)}" data-name="${escapeHtml(a.name)}">Download ${escapeHtml(a.name)}</button>`
            )
            .join('')}
        </div>`
        : ''

    const csp = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); padding: 24px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-size: 13px; line-height: 1.5; }
    h1 { font-size: 1.4rem; margin: 0 0 16px; }
    h3 { font-size: 1rem; margin: 16px 0 8px; color: var(--vscode-descriptionForeground); }
    .summary { background: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-button-background); padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
    .stats { display: flex; gap: 24px; flex-wrap: wrap; margin: 16px 0; }
    .stat { background: var(--vscode-input-background); padding: 8px 16px; border-radius: 6px; }
    .stat strong { display: block; font-size: 1.5rem; color: var(--vscode-button-background); }
    .endpoint-list { list-style: none; padding: 0; }
    .endpoint-list li { padding: 4px 0; }
    .endpoint-list code { font-size: 0.9em; }
    .warnings { color: var(--vscode-editorWarning-foreground); }
    .artifacts { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .artifact-btn { padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .artifact-btn:hover { opacity: 0.9; }
    .coverage-stats { background: var(--vscode-input-background); padding: 16px; border-radius: 8px; margin: 16px 0; }
    .coverage-pct { margin-bottom: 12px; }
    .pct-value { font-size: 2rem; font-weight: bold; color: var(--vscode-button-background); }
    .pct-label { display: block; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
    .coverage-bars { margin: 12px 0; }
    .coverage-row { display: flex; align-items: center; gap: 12px; margin: 6px 0; font-size: 12px; }
    .coverage-label { min-width: 90px; }
    .coverage-bar-wrap { flex: 1; height: 8px; background: var(--vscode-scrollbarSlider-background); border-radius: 4px; overflow: hidden; }
    .coverage-bar { display: block; height: 100%; background: var(--vscode-button-background); border-radius: 4px; min-width: 4px; }
    .coverage-count { min-width: 80px; color: var(--vscode-descriptionForeground); }
    .coverage-count small { opacity: 0.85; font-size: 0.9em; }
    .coverage-note { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin: 12px 0 0; }
  </style>
</head>
<body>
  <h1>Test Summary</h1>
  <div class="stats">
    <div class="stat"><strong>${totalEndpoints}</strong> Endpoints</div>
    <div class="stat"><strong>${totalTestCases}</strong> Test Cases</div>
    <div class="stat"><strong>${escapeHtml(language)}</strong> Language</div>
    <div class="stat"><strong>${escapeHtml(framework)}</strong> Framework</div>
    <div class="stat"><strong>${escapeHtml(testingFramework)}</strong> Testing</div>
  </div>
  ${coverageHtml}
  <div class="summary">${escapeHtml(summary)}</div>
  ${endpointsHtml}
  ${artifactsHtml}
  ${warningsHtml}
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.artifact-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: 'downloadArtifact', url: btn.dataset.url, name: btn.dataset.name });
      });
    });
  </script>
</body>
</html>`
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
