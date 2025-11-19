# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dj-playground** is a Django Playground application that runs Django entirely in the browser using Pyodide (Python in WebAssembly). Built with SvelteKit 2, it provides an IDE-like interface with a file tree, code editor, and live preview.

## Development Commands

### Running the Application
```bash
pnpm run dev              # Start development server
pnpm run dev -- --open    # Start dev server and open browser
pnpm run build            # Create production build
pnpm run preview          # Preview production build
```

### Testing
```bash
pnpm run test             # Run all tests (E2E + unit)
pnpm run test:unit        # Run unit tests with Vitest
pnpm run test:e2e         # Run E2E tests with Playwright

# Unit test development
pnpm run test:unit -- --watch  # Watch mode for unit tests
```

### Code Quality
```bash
pnpm run check            # Type check with svelte-check
pnpm run check:watch      # Type check in watch mode
pnpm run lint             # Check formatting and lint
pnpm run format           # Format code with Prettier
```

## Architecture

### Core Technologies
- **SvelteKit 2** - Meta-framework with file-based routing
- **Svelte 5** - Reactive UI framework
- **Pyodide** - Python runtime in WebAssembly
- **CodeMirror 6** - Code editor with Python support
- **Tailwind CSS v4** - Utility-first styling
- **Web Workers** - Python execution in dedicated thread

### Directory Structure
```
src/
├── routes/              # SvelteKit routes (file-based routing)
│   ├── +page.svelte    # Main application page
│   └── +layout.svelte  # Root layout wrapper
├── lib/
│   ├── components/     # Reusable Svelte components
│   │   ├── Editor.svelte     # CodeMirror-based code editor
│   │   ├── FileTree.svelte   # File explorer tree
│   │   ├── Output.svelte     # Preview/Console tabs
│   │   └── Console.svelte    # Log display
│   ├── stores/         # State management
│   │   ├── workspace.ts          # File management & persistence (Svelte 4 stores)
│   │   └── execution.svelte.ts   # Execution state & logs (Svelte 5 class-based state)
│   ├── workers/        # Web Workers
│   │   └── python-executor.ts  # Pyodide runner for Django
│   └── types/          # TypeScript type definitions
```

### State Management Pattern

The application uses **Svelte 5 runes** for reactive state:

1. **workspace.ts** - Manages all Django project files (Svelte 4 stores - to be migrated)
   - Persists to localStorage
   - Provides `workspaceFiles`, `fileTree`, and `currentFile` stores
   - Default Django project template included

2. **execution.svelte.ts** - Manages execution state using **Svelte 5 class-based state**
   - Global singleton instance: `executionState`
   - State properties: `isExecuting`, `executionResult`, `logs`, `isWorkerReady`
   - Methods: `addLog()`, `clearLogs()`, `setExecutionResult()`, `startExecution()`
   - Uses `$state()` rune for reactivity
   - Must have `.svelte.ts` extension to use runes

### Python Execution Flow

1. User clicks "Run" → `startExecution()` clears logs and sets `isExecuting = true`
2. Main page sends all files to Web Worker via `postMessage()`
3. Worker (`python-executor.ts`) writes files to Pyodide virtual filesystem
4. Worker executes Django WSGI handler
5. Worker returns HTML output and logs via `postMessage()`
6. UI updates reactively from store changes

### Web Worker Protocol

Messages sent to `python-executor.ts`:
- `init` - Initialize Pyodide environment
- `execute` - Run Django view or Python code
- `installPackage` - Install Python package via micropip
- `writeFiles` - Write files to virtual filesystem

Responses from worker:
- `ready` - Pyodide initialized
- `result` - Execution result with HTML/data
- `error` - Execution error
- `log` - Console log entry

## Testing Strategy

### Dual Testing Setup (Vitest)

The project uses **two test projects** configured in `vite.config.ts`:

1. **Client tests** (browser environment)
   - Pattern: `src/**/*.svelte.{test,spec}.{js,ts}`
   - Uses `@vitest/browser-playwright` with Chromium
   - For testing Svelte components

2. **Server tests** (Node environment)
   - Pattern: `src/**/*.{test,spec}.{js,ts}` (excluding `.svelte.*`)
   - For testing utilities, stores, and logic

### Writing Tests

**Svelte Component Tests:**
```typescript
// Use .svelte.spec.ts extension
import { render } from 'vitest-browser-svelte';
import { expect, it } from 'vitest';
import MyComponent from './MyComponent.svelte';

it('renders component', async () => {
  const { getByText } = render(MyComponent);
  await expect.element(getByText('Hello')).toBeVisible();
});
```

**Store/Utility Tests:**
```typescript
// Use .spec.ts or .test.ts extension (not .svelte.*)
import { describe, it, expect } from 'vitest';
import { myFunction } from './utils';

describe('myFunction', () => {
  it('returns expected value', () => {
    expect(myFunction(1, 2)).toBe(3);
  });
});
```

**E2E Tests:**
```typescript
// In e2e/ directory
import { test, expect } from '@playwright/test';

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## Key Implementation Details

### Data Persistence
- All project files saved to `localStorage['django-playground-files']`
- Files automatically loaded on mount
- Reset functionality restores default Django template

### CodeMirror Setup
- Theme: One Dark
- Language: Python
- Extensions: autocomplete, commands, linting
- Two-way binding with workspace store

### iframe Sandbox
- Output rendered in isolated iframe using `srcdoc`
- Link interception for SPA-like navigation
- Post-message communication for route changes
- Template in `srcdoc-template.ts`

### File Tree Component
- Recursive rendering of file structure
- Emoji icons for file types (🐍 .py, 📄 .html, etc.)
- Expandable/collapsible directories
- Highlights current file

### UI Components
- Uses **shadcn-svelte** components for consistent design
- Button behavior:
  - When NOT executing: Shows "Run" button (primary variant)
  - When executing: Shows "Refresh" button (outline variant)
  - This provides clear visual feedback and prevents accidental reruns

## Configuration Files

- `svelte.config.js` - SvelteKit config, preprocessors (vitePreprocess, mdsvex)
- `vite.config.ts` - Vite plugins, Vitest dual-project setup
- `tsconfig.json` - TypeScript strict mode enabled
- `eslint.config.js` - ESLint with Svelte and TypeScript support
- `playwright.config.ts` - E2E test configuration

## Package Manager

This project uses **pnpm**. Always use `pnpm` commands, not `npm` or `yarn`.
