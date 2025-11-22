# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Django Playground is an experimental browser-based IDE that runs Django using Pyodide (Python in WebAssembly). It allows users to write Django code in the browser and see it execute client-side without any backend server.

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (with runes)
- **Python Runtime**: Pyodide v0.26.4 (WebAssembly)
- **Code Editor**: CodeMirror 6
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest (unit + browser tests) + Playwright (e2e)
- **Build Tool**: Vite 7

## Commands

### Development
```bash
pnpm run dev          # Start dev server on localhost:5173
pnpm run build        # Production build
pnpm run preview      # Preview production build
```

### Testing
```bash
pnpm run test         # Run all tests (e2e + unit)
pnpm run test:unit    # Unit tests only (runs with vitest)
pnpm run test:e2e     # E2E tests only (runs with Playwright)
```

### Code Quality
```bash
pnpm run lint         # Check code formatting with Prettier + ESLint
pnpm run format       # Format code with Prettier
pnpm run check        # TypeScript + Svelte type checking
pnpm run check:watch  # Type checking in watch mode
```

## Architecture

### Core Components

1. **Web Worker Architecture** (`src/lib/workers/`)
   - `python-executor.ts` - Main worker entry point, message handler routing
   - `pyodide-manager.ts` - Manages Pyodide initialization and package installation
   - `django/executor.ts` - Executes Django views via WSGI handler
   - `django/management.ts` - Django management commands (migrate, makemigrations, createsuperuser)
   - `filesystem.ts` - Virtual filesystem operations for Pyodide
   - `static-file-processor.ts` - Inlines static files into HTML responses
   - `handlers/message-handlers.ts` - Worker message type handlers

2. **State Management** (`src/lib/stores/`)
   - `workspace.ts` - File management store with default Django project template
   - `execution.svelte.ts` - Execution state using Svelte 5 runes
   - `path-state.svelte.ts` - Navigation/path state management

3. **UI Components** (`src/lib/components/`)
   - `Editor.svelte` - CodeMirror-based Python editor
   - `Output.svelte` - Preview iframe with sandboxed Django output
   - `FileTree.svelte` - File explorer tree view
   - `Console.svelte` - Log output display
   - `AddressBar.svelte` - URL navigation bar
   - `ui/` - Shared UI components (buttons, resizable panes)

### Communication Flow

```
User Action ’ Svelte Component ’ Worker Message ’ Pyodide Execution ’ Worker Response ’ UI Update
```

1. User edits code in CodeMirror editor
2. Files stored in `workspaceFiles` store
3. On execution, files sent to Web Worker via `WorkerRequest`
4. Worker writes files to Pyodide's virtual FS
5. Django WSGI handler executed with HTTP request simulation
6. HTML response returned via `WorkerResponse`
7. Output rendered in sandboxed iframe

### Key Technical Details

- **Django Execution**: Uses `StaticFilesHandler(WSGIHandler())` to simulate Django dev server
- **Module Cache**: Clears Python module cache on file writes to reload changed modules
- **Cookie/Session Management**: Simulates browser cookies by passing them through WSGI environ
- **Static Files**: Inlined into HTML using base64 encoding for CSS/JS/images
- **Migrations**: Auto-runs migrations and creates superuser (admin/admin) on first init
- **Virtual FS**: All Django project files stored in Pyodide's emscripten filesystem

### Worker Message Types

```typescript
// Request types
'init'              // Initialize Pyodide + install Django
'execute'           // Execute Django view with optional HTTP params
'writeFiles'        // Write files to virtual FS
'runMigrations'     // Run Django migrations
'makeMigrations'    // Create new migrations
'createSuperuser'   // Create Django superuser
'installPackage'    // Install Python package via micropip

// Response types
'ready'             // Pyodide initialized
'result'            // Execution result with HTML/logs
'error'             // Error occurred
'log'               // Log message
```

### Default Django Project Structure

Located in `src/lib/stores/workspace.ts`:
- `myproject/` - Django project config (settings, urls, wsgi)
- `myapp/` - Django app with views, models, urls
- `templates/` - Django templates
- `manage.py` - Django management script

### Testing Setup

Two test configurations in `vite.config.ts`:
1. **Client tests** - Browser-based tests for Svelte components (`.svelte.test.ts`)
2. **Server tests** - Node-based tests for utilities (`.test.ts`)

## Important Patterns

### File Operations
- Always use the `workspaceFiles` store for file state management
- Files are key-value pairs: `Record<string, string>` where key is filepath
- Use `updateFile()`, `addFile()`, `deleteFile()` store methods

### Worker Communication
- All worker interactions are message-based and asynchronous
- Always handle both success and error response types
- Worker maintains its own Pyodide instance - cannot be accessed directly

### Django-Specific
- Database: SQLite3 in-memory via Pyodide's FS
- Settings module: `myproject.settings`
- Password hasher: MD5 (fast for WebAssembly, not for production)
- Async mode: `DJANGO_ALLOW_ASYNC_UNSAFE=true` for synchronous ORM

### SvelteKit Considerations
- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactivity
- No server-side rendering for main IDE page (runs entirely client-side)
- Web Worker cannot import SvelteKit modules (must be vanilla TS)
