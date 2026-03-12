/**
 * Scans workspace for API-related files.
 * Supports auto-discovery or user-specified path.
 */
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

// Patterns that commonly indicate API/route files
const API_PATTERNS = [
  '**/app/api/**/route.ts',
  '**/app/api/**/route.js',
  '**/app/api/**/*.ts',
  '**/app/api/**/*.js',
  '**/src/app/api/**/*.ts',
  '**/pages/api/**/*.ts',
  '**/pages/api/**/*.js',
  '**/api/**/*.ts',
  '**/api/**/*.tsx',
  '**/api/**/*.js',
  '**/api/**/*.jsx',
  '**/routes/**/*.ts',
  '**/routes/**/*.js',
  '**/handlers/**/*.ts',
  '**/handlers/**/*.js',
  '**/controllers/**/*.ts',
  '**/controllers/**/*.js',
  '**/route*.ts',
  '**/route*.tsx',
  '**/route*.js',
  '**/route*.jsx',
  '**/*.handler.ts',
  '**/*.handler.js',
  '**/main.go',
  '**/cmd/**/*.go',
]

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.*',
  '**/*.spec.*',
]

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rb', '.php']

export interface ScannedFile {
  path: string
  content: string
  relativePath: string
}

export async function scanForApiFiles(
  workspaceRoot: string,
  userPath?: string,
  maxFileSizeKb: number = 1024
): Promise<ScannedFile[]> {
  const maxBytes = maxFileSizeKb * 1024
  const results: ScannedFile[] = []

  if (userPath) {
    // User specified a path - use it directly
    const fullPath = path.isAbsolute(userPath)
      ? userPath
      : path.join(workspaceRoot, userPath)
    const stat = await fs.promises.stat(fullPath).catch(() => null)
    if (!stat) {
      return []
    }
    if (stat.isFile()) {
      const content = await readFileWithLimit(fullPath, maxBytes)
      results.push({
        path: fullPath,
        content,
        relativePath: path.relative(workspaceRoot, fullPath),
      })
      return results
    }
    if (stat.isDirectory()) {
      return scanDirectory(fullPath, workspaceRoot, maxBytes)
    }
  }

  // Auto-scan: find files matching API patterns
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) return []

  for (const pattern of API_PATTERNS) {
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, pattern),
      `{${IGNORE_PATTERNS.join(',')}}`,
      100
    )
    for (const uri of uris) {
      const ext = path.extname(uri.fsPath)
      if (!CODE_EXTENSIONS.includes(ext)) continue
      const content = await readFileWithLimit(uri.fsPath, maxBytes)
      const relativePath = path.relative(workspaceRoot, uri.fsPath)
      if (!results.some((r) => r.path === uri.fsPath)) {
        results.push({
          path: uri.fsPath,
          content,
          relativePath,
        })
      }
    }
  }

  // If no API-specific files found, try filesystem-based fallback (bypasses VS Code search)
  if (results.length === 0) {
    const apiDirNames = ['app/api', 'src/app/api', 'src/api', 'api', 'routes', 'pages/api', 'app/routes', 'cmd']
    const rootsToTry = [workspaceRoot]
    try {
      const entries = await fs.promises.readdir(workspaceRoot, { withFileTypes: true })
      const subdirs = entries.filter((e) => e.isDirectory() && !['node_modules', '.git', '.next', 'dist', 'build'].includes(e.name))
      rootsToTry.push(...subdirs.slice(0, 5).map((d) => path.join(workspaceRoot, d.name)))
    } catch {
      // ignore
    }
    for (const root of rootsToTry) {
      for (const dirName of apiDirNames) {
        const fullPath = path.join(root, dirName)
        try {
          const stat = await fs.promises.stat(fullPath)
          if (stat.isDirectory()) {
            const scanned = await scanDirectory(fullPath, workspaceRoot, maxBytes)
            for (const f of scanned) {
              if (!results.some((r) => r.path === f.path)) results.push(f)
            }
          }
          if (results.length >= 20) break
        } catch {
          // doesn't exist, skip
        }
      }
      try {
        const mainGo = path.join(root, 'main.go')
        await fs.promises.access(mainGo)
        const content = await readFileWithLimit(mainGo, maxBytes)
        const rel = path.relative(workspaceRoot, mainGo)
        if (!results.some((r) => r.path === mainGo)) {
          results.push({ path: mainGo, content, relativePath: rel })
        }
      } catch {
        // no main.go, skip
      }
      if (results.length >= 20) break
    }
  }

  // Last resort: broad findFiles fallback
  if (results.length === 0) {
    const fallbackPatterns = ['**/app/**/*.ts', '**/src/**/*.ts', '**/*.ts', '**/*.js']
    for (const pattern of fallbackPatterns) {
      const uris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, pattern),
        `{${IGNORE_PATTERNS.join(',')}}`,
        30
      )
      for (const uri of uris) {
        const ext = path.extname(uri.fsPath)
        if (!CODE_EXTENSIONS.includes(ext)) continue
        const content = await readFileWithLimit(uri.fsPath, maxBytes)
        const relativePath = path.relative(workspaceRoot, uri.fsPath)
        if (!results.some((r) => r.path === uri.fsPath)) {
          results.push({
            path: uri.fsPath,
            content,
            relativePath,
          })
        }
      }
      if (results.length >= 20) break
    }
  }

  return results.slice(0, 50)
}

async function scanDirectory(
  dirPath: string,
  workspaceRoot: string,
  maxBytes: number
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) continue
      const sub = await scanDirectory(fullPath, workspaceRoot, maxBytes)
      results.push(...sub)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (CODE_EXTENSIONS.includes(ext)) {
        const content = await readFileWithLimit(fullPath, maxBytes)
        results.push({
          path: fullPath,
          content,
          relativePath: path.relative(workspaceRoot, fullPath),
        })
      }
    }
    if (results.length >= 50) break
  }

  return results
}

async function readFileWithLimit(filePath: string, maxBytes: number): Promise<string> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    if (content.length <= maxBytes) return content
    return (
      content.slice(0, maxBytes) +
      '\n\n// ... [truncated] ...\n'
    )
  } catch {
    return ''
  }
}
