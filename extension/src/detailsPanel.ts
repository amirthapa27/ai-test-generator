/**
 * Details panel - full test case code per endpoint.
 * Copy buttons, Save to workspace.
 */
import * as vscode from 'vscode'
import * as path from 'path'
import type { TestResult } from './testGeneratorApi'

export class DetailsPanel {
  public static readonly viewType = 'apiTestCoverage.details'
  private _panel: vscode.WebviewPanel | undefined
  private _extensionUri: vscode.Uri
  private _data: TestResult | undefined

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri
  }

  public show() {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two)
      return
    }

    this._panel = vscode.window.createWebviewPanel(
      DetailsPanel.viewType,
      'Test Cases (Details)',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    )

    this._panel.webview.onDidReceiveMessage((msg: { command: string; payload?: string }) => {
      if (msg.command === 'copy' && msg.payload) {
        vscode.env.clipboard.writeText(msg.payload)
        vscode.window.showInformationMessage('Copied to clipboard')
      }
      if (msg.command === 'saveAll') {
        this.saveToWorkspace()
      }
    })

    this._panel.onDidDispose(() => {
      this._panel = undefined
    })
  }

  public setDetails(data: TestResult) {
    this._data = data
    if (this._panel) {
      this._panel.webview.html = this.getDetailsHtml(data)
    }
  }

  public setEmpty() {
    this._data = undefined
    if (this._panel) {
      this._panel.webview.html =
        '<body style="font-family: var(--vscode-font-family); padding: 24px;"><p>No details yet. Run Generate API Test Cases first.</p></body>'
    }
  }

  public dispose() {
    this._panel?.dispose()
    this._panel = undefined
  }

  private async saveToWorkspace() {
    const d = this._data
    if (!d?.endpoints?.length) {
      vscode.window.showWarningMessage('No test data to save')
      return
    }

    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage('No workspace folder open')
      return
    }

    const defaultPath = path.join(workspaceFolders[0].uri.fsPath, '__tests__', 'generated')
    const chosen = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      defaultUri: vscode.Uri.file(defaultPath),
      title: 'Choose folder to save generated tests',
    })

    if (!chosen?.length) return

    const dir = chosen[0].fsPath
    const dims = [
      { key: 'unitTests', label: 'unit' },
      { key: 'integrationTests', label: 'integration' },
      { key: 'contractTests', label: 'contract' },
      { key: 'edgeCaseTests', label: 'edge' },
      { key: 'performanceTests', label: 'performance' },
      { key: 'securityTests', label: 'security' },
    ]

    let saved = 0
    for (const ep of d.endpoints) {
      const method = (ep.method || 'GET').toUpperCase()
      const epPath = (ep.path || 'unknown').replace(/\//g, '_').replace(/^_/, '') || 'api'
      const baseName = `${method}_${epPath}`.replace(/[^a-zA-Z0-9_]/g, '_')

      for (const dim of dims) {
        const code = ep.testDimensions?.[dim.key as keyof typeof ep.testDimensions]
        if (code?.trim()) {
          const ext = (d.language || 'ts').toLowerCase().includes('python') ? 'py' : 'ts'
          const fileName = `${baseName}_${dim.label}.test.${ext}`
          const filePath = path.join(dir, fileName)
          const uri = vscode.Uri.file(filePath)
          await vscode.workspace.fs.writeFile(uri, Buffer.from(code, 'utf-8'))
          saved++
        }
      }
    }

    if (saved > 0) {
      vscode.window.showInformationMessage(`Saved ${saved} test file(s) to ${dir}`)
    } else {
      vscode.window.showWarningMessage('No test code to save')
    }
  }

  private getDetailsHtml(d: TestResult): string {
    if (!d.endpoints?.length) {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: var(--vscode-font-family); padding: 24px;"><p>No endpoints found.</p></body></html>`
    }

    const csp = `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'`
    const tabs: string[] = []
    const contents: string[] = []

    const dims = [
      { key: 'unitTests', label: 'Unit' },
      { key: 'integrationTests', label: 'Integration' },
      { key: 'contractTests', label: 'Contract' },
      { key: 'edgeCaseTests', label: 'Edge Cases' },
      { key: 'performanceTests', label: 'Performance' },
      { key: 'securityTests', label: 'Security' },
    ]

    const codeStore: Record<string, string> = {}

    d.endpoints.forEach((ep, idx) => {
      const method = (ep.method || 'GET').toUpperCase()
      const pathStr = ep.path || ''
      const id = `ep-${idx}`
      tabs.push(
        `<button class="tab" data-tab="${id}">${escapeHtml(method)} ${escapeHtml(pathStr)}</button>`
      )

      let codeBlocks = ''
      for (let di = 0; di < dims.length; di++) {
        const dim = dims[di]
        const code = ep.testDimensions?.[dim.key as keyof typeof ep.testDimensions]
        if (code && code.trim()) {
          const key = `${idx}-${di}`
          codeStore[key] = code
          codeBlocks += `
            <div class="dimension">
              <h4>${dim.label} <button class="copy-btn" data-key="${key}">Copy</button></h4>
              <pre><code>${escapeHtml(code)}</code></pre>
            </div>`
        }
      }

      if (!codeBlocks) {
        codeBlocks = '<p>No test code generated for this endpoint.</p>'
      }

      contents.push(
        `<div id="${id}" class="tab-content">
          <h3>${escapeHtml(method)} ${escapeHtml(pathStr)}</h3>
          ${ep.description ? `<p class="desc">${escapeHtml(ep.description)}</p>` : ''}
          ${codeBlocks}
        </div>`
      )
    })

    const codeStoreJson = JSON.stringify(codeStore)

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>
    * { box-sizing: border-box; }
    body { font-family: var(--vscode-font-family); padding: 16px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-size: 12px; }
    .toolbar { margin-bottom: 12px; }
    .save-btn { padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .save-btn:hover { opacity: 0.9; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
    .tab { padding: 6px 12px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border-radius: 4px; cursor: pointer; font-size: 11px; }
    .tab:hover, .tab.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .dimension { margin: 16px 0; }
    .dimension h4 { margin: 8px 0 4px; font-size: 12px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 8px; }
    .copy-btn { padding: 2px 8px; font-size: 10px; cursor: pointer; border-radius: 4px; border: 1px solid var(--vscode-button-border); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .copy-btn:hover { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    pre { background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 11px; line-height: 1.4; }
    code { font-family: var(--vscode-editor-font-family); }
    .desc { color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="save-btn" id="saveAll">Save all tests to workspace</button>
  </div>
  <h2>Generated Test Cases</h2>
  <div class="tabs">${tabs.join('')}</div>
  ${contents.join('')}
  <script type="application/json" id="code-store">${codeStoreJson.replace(/<\//g, '<\\/')}</script>
  <script>
    const vscode = acquireVsCodeApi();
    const codeStore = JSON.parse(document.getElementById('code-store').textContent);
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (key && codeStore[key]) vscode.postMessage({ command: 'copy', payload: codeStore[key] });
      });
    });
    document.getElementById('saveAll').addEventListener('click', () => vscode.postMessage({ command: 'saveAll' }));
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
    document.querySelector('.tab')?.classList.add('active');
    document.querySelector('.tab-content')?.classList.add('active');
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
