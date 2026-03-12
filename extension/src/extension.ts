import * as vscode from 'vscode'
import * as path from 'path'
import { scanForApiFiles } from './fileScanner'
import { generateTests, getConfig, checkHealth } from './testGeneratorApi'
import { SummaryPanel } from './summaryPanel'
import { DetailsPanel } from './detailsPanel'

let summaryPanel: SummaryPanel | undefined
let detailsPanel: DetailsPanel | undefined

export function activate(context: vscode.ExtensionContext) {
  // Status bar button - one-click to generate tests
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.text = '$(beaker) Generate API Tests'
  statusBarItem.tooltip = 'Generate API Test Cases'
  statusBarItem.command = 'apiTestCoverage.generateTests'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'apiTestCoverage.generateTests',
      async (resource?: vscode.Uri) => {
        const config = getConfig()
        if (!config.apiUrl) {
          vscode.window.showErrorMessage(
            'API Test Coverage: Set apiTestCoverage.apiUrl in settings (e.g. http://localhost:3333)'
          )
          return
        }

        const healthy = await checkHealth(config.apiUrl)
        if (!healthy) {
          vscode.window.showErrorMessage(
            `API Test Coverage: Backend not reachable at ${config.apiUrl}. Start the Next.js app (npm run dev) and ensure LYZR_API_KEY is set.`
          )
          return
        }

        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders?.length) {
          vscode.window.showErrorMessage('API Test Coverage: Open a workspace first')
          return
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath

        let userPath: string | undefined

        const DIMENSION_OPTIONS: { label: string; description: string; value: string }[] = [
          { label: 'Unit Tests', description: 'Isolated function-level tests', value: 'unitTests' },
          { label: 'Integration Tests', description: 'Module interaction tests', value: 'integrationTests' },
          { label: 'Contract / Schema', description: 'Request/response schema validation', value: 'contractTests' },
          { label: 'Edge Cases', description: 'Boundary conditions, empty inputs', value: 'edgeCaseTests' },
          { label: 'Performance', description: 'Load, response time tests', value: 'performanceTests' },
          { label: 'Security', description: 'Auth, injection, CORS tests', value: 'securityTests' },
        ]

        const selectedDimensions = await vscode.window.showQuickPick(DIMENSION_OPTIONS, {
          title: 'Select test dimensions to generate',
          placeHolder: 'Select dimensions (or none = all)',
          canPickMany: true,
          matchOnDescription: true,
        })

        if (selectedDimensions === undefined) return

        const enabledDimensions =
          selectedDimensions.length > 0 ? selectedDimensions.map((d) => d.value) : DIMENSION_OPTIONS.map((d) => d.value)

        if (resource && resource.scheme === 'file') {
          userPath = path.relative(workspaceRoot, resource.fsPath)
          if (userPath.startsWith('..')) userPath = resource.fsPath
        } else {
          const choice = await vscode.window.showQuickPick(
            [
              {
                label: '$(folder) Scan workspace for APIs',
                description: 'Auto-discover API/route files',
                value: 'scan',
              },
              {
                label: '$(file-directory) Specify path to APIs',
                description: 'Enter a folder or file path',
                value: 'path',
              },
            ],
            {
              title: 'API Test Coverage: How to find APIs?',
              placeHolder: 'Select option',
            }
          )
          if (!choice) return
          if (choice.value === 'path') {
            const input = await vscode.window.showInputBox({
              prompt: 'Enter relative path to API folder or file (e.g. src/api or src/routes)',
              placeHolder: 'src/api',
              value: 'src/api',
            })
            if (input === undefined) return
            userPath = input.trim() || undefined
          }
        }

      const cfg = vscode.workspace.getConfiguration('apiTestCoverage')
      const maxFileSizeKb = cfg.get<number>('maxFileSizeKb') ?? 1024

      try {
        // Show both panels early
        if (!summaryPanel) {
          summaryPanel = new SummaryPanel(context.extensionUri)
        }
        if (!detailsPanel) {
          detailsPanel = new DetailsPanel(context.extensionUri)
        }
        summaryPanel.show()
        detailsPanel.show()
        summaryPanel.setLoading('Scanning for API files...')
        detailsPanel.setEmpty()

        const files = await scanForApiFiles(workspaceRoot, userPath, maxFileSizeKb)

        if (files.length === 0) {
          summaryPanel.setError(
            userPath
              ? `No files found at path: ${userPath}`
              : `No API-related files found in ${workspaceRoot}. Ensure the project root (with app/, api/, or routes/) is open, or specify a path like app/api or src/api.`
          )
          return
        }

        summaryPanel.setLoading(
          `Analyzing ${files.length} file(s)... Generating full test coverage...`
        )

        const result = await generateTests(files, config, enabledDimensions, (msg) => {
          summaryPanel?.setLoading(msg)
        })

        if (result.success && result.data) {
          summaryPanel.setSummary(result.data, result.artifactFiles)
          detailsPanel.setDetails(result.data)

          if (result.artifactFiles?.length) {
            vscode.window.showInformationMessage(
              `API Test Coverage: Generated ${result.data.totalTestCases ?? 0} tests. ${result.artifactFiles.length} artifact(s) available from agent.`
            )
          } else {
            vscode.window.showInformationMessage(
              `API Test Coverage: Generated ${result.data.totalTestCases ?? 0} test cases across ${result.data.totalEndpoints ?? 0} endpoints.`
            )
          }
        } else {
          summaryPanel.setError(result.error || 'Test generation failed')
          detailsPanel.setEmpty()
          vscode.window.showErrorMessage(`API Test Coverage: ${result.error}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        vscode.window.showErrorMessage(`API Test Coverage failed: ${msg}`)
        if (summaryPanel) {
          summaryPanel.setError(msg)
        }
        if (detailsPanel) {
          detailsPanel.setEmpty()
        }
      }
    })
  )
}

export function deactivate() {
  summaryPanel?.dispose()
  detailsPanel?.dispose()
}
