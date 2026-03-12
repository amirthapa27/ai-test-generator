# API Test Coverage

AI-powered API test suite generation. Available as a **web app** and **VS Code extension**.

## Features

- **Language-aware**: Generates tests that follow Jest, pytest, JUnit, etc. conventions
- **Dual input**: Auto-scan for API files or specify a path
- **Token-efficient**: Optimized prompts and file truncation
- **Summary + details**: Summary in a separate panel, full test code in another

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Set AI_PROVIDER (lyzr | openai | anthropic | google) and the corresponding API key
```

### 2. Start the backend

```bash
npm run dev
```

Backend runs at `http://localhost:3333`.

### 3. Use the web app

Open `http://localhost:3333` in a browser. Upload files or paste code, select test dimensions, and generate.

### 4. Use the VS Code extension

1. Open this project in VS Code
2. Press **F5** to launch Extension Development Host (or use Run → Run Extension)
3. In the new window: **Command Palette** → `Generate API Test Cases`
4. Or right-click a folder/file in Explorer → `Generate API Test Cases`

**Settings** (optional):

- `apiTestCoverage.apiUrl` – Backend URL (default: `http://localhost:3333`)
- `apiTestCoverage.agentId` – Lyzr agent ID
- `apiTestCoverage.maxFileSizeKb` – Max file size (KB) to include (default: 1024)

## Extension features

- **Copy** – Copy test code blocks to clipboard
- **Save to workspace** – Save all generated tests to a folder
- **Download artifacts** – Download ZIP/test files from the agent
- **Health check** – Verifies backend is reachable before running
- **Progress** – Shows polling progress during generation

## AI Providers

Set `AI_PROVIDER` in `.env` to switch providers:

| Provider | Env vars |
|----------|----------|
| `lyzr` (default) | `LYZR_API_KEY`, `AGENT_ID` |
| `openai` | `OPENAI_API_KEY`, optional `OPENAI_MODEL` |
| `anthropic` | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| `google` | `GOOGLE_AI_API_KEY` or `GEMINI_API_KEY`, optional `GOOGLE_MODEL` |

## Package the extension

```bash
cd extension
npm run package
```

Install the generated `.vsix` file in VS Code.
