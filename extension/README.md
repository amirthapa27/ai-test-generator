# API Test Coverage – VS Code Extension

AI-powered extension to generate test cases for your APIs. Scans your codebase (or a specified path), detects language and framework, and generates tests that follow the conventions for that language.

## Features

- **Extension-based**: Runs inside VS Code, no separate web UI
- **Language-aware**: Test cases follow Jest, pytest, JUnit, etc. conventions
- **Token-efficient**: Optimized prompts and file truncation to reduce cost and time
- **Dual input modes**:
  - Auto-scan: Discovers API/route files automatically
  - Specify path: Point to a folder or file (e.g. `src/api`)
- **Summary in separate window**: High-level overview (endpoints, test count, framework)
- **Details panel**: Full generated test code per endpoint and dimension

## Setup

1. **Start the backend** (from the project root, one level up from `extension/`):
   ```bash
   cp .env.example .env
   # Set AI_PROVIDER and the corresponding API key in .env
   npm run dev
   ```
   Backend runs at `http://localhost:3333`.

2. **Configure the extension**:
   - Open VS Code Settings
   - Search for `API Test Coverage`
   - Set `apiTestCoverage.apiUrl` to `http://localhost:3333` (or your deployed URL)
   - Optionally set `apiTestCoverage.agentId` and `apiTestCoverage.maxFileSizeKb`

3. **Run the extension**:
   - Open this project in VS Code, then press **F5** to launch Extension Development Host
   - Or install: `cd extension && npm run package`, then install the generated `.vsix` file

## Usage

- **Command Palette**: `Generate API Test Cases`
- **Right-click folder/file** in Explorer → `Generate API Test Cases` (uses that path)
- **Dimension selection**: When you run the command, you'll be asked to select which test types to generate (Unit, Integration, Contract, Edge Cases, Performance, Security). Select one or more; only those will be generated.

## Development

```bash
cd extension
npm install
npm run compile
# F5 to launch Extension Development Host
```
