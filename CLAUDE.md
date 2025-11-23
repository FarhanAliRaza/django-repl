# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Django Playground is an experimental browser-based IDE that runs Django entirely in the browser using Pyodide (Python via WebAssembly). No backend server required - everything executes client-side in Web Workers.

**Tech Stack:**

- SvelteKit 2 (meta-framework with file-based routing)
- Svelte 5 (reactive UI with runes - `$state`, `$derived`, `$effect`)
- Pyodide 0.29.0 (Python 3.13 in WebAssembly)
- Django 5.2 (running in browser via WSGI)
- CodeMirror 6 (code editor)
- Tailwind CSS v4 (styling)
- Web Workers (isolated Python execution)

## Architecture

### Core Execution Flow

1. **Main Thread (SvelteKit):** UI components, state management via Svelte 5 runes
2. **Web Worker Pool:** Each worker runs independent Pyodide instance executing Django
3. **Virtual Filesystem:** Files stored in Pyodide's in-memory FS, synced from workspace state
4. **WSGI Handler:** Python code executes Django views via WSGI protocol
5. **Output Rendering:** HTML/JSON returned to main thread, rendered in sandboxed iframe

### Key State Management Pattern (Svelte 5 Runes)

All stores use Svelte 5's new runes system (`$state`, `$derived`), NOT the old `writable()` pattern:

- **`workspaceState`** (`src/lib/stores/workspace.svelte.ts`): File tree, current file, Django project files
- **`executionState`** (`src/lib/stores/execution.svelte.ts`): REPL state, execution results, logs, cookies
- **`pathState`** (`src/lib/stores/path-state.svelte.ts`): Browser path for Django URL routing

**CRITICAL:** When extracting data for Web Workers, use `$state.snapshot()` to remove Svelte proxies (see `workspaceState.getFiles()`). Workers cannot receive proxy objects.

### Worker Communication Architecture

**Main Thread � Worker Messages:**

```typescript
// Request types: 'init', 'execute', 'writeFiles', 'runMigrations', 'makeMigrations', 'createSuperuser'
// Response types: 'ready', 'result', 'error', 'log', 'database'

// Files are sent with every 'execute' request
// Workers maintain Django state in-memory between executions
```

**Worker Pool Pattern:**

- Workers are created lazily and reused
- Each worker maintains its own Django instance
- Snapshot/restore mechanism caches Pyodide+Django for faster worker initialization

### File Structure

```
src/
 routes/                      # SvelteKit pages (+page.svelte, +layout.svelte)
 lib/
    components/             # Svelte 5 components
       Editor.svelte      # CodeMirror editor
       Output.svelte      # Django output iframe
       FileTree.svelte    # File explorer
       Console.svelte     # Logs display
       ui/                # shadcn-svelte UI components
    stores/                # Svelte 5 rune-based stores
       workspace.svelte.ts
       execution.svelte.ts
       path-state.svelte.ts
    workers/               # Web Worker code (Python executor)
       python-executor.ts       # Entry point
       pyodide-manager.ts      # Pyodide initialization
       snapshot-manager.ts     # IndexedDB snapshot caching
       filesystem.ts           # Virtual FS operations
       handlers/
          message-handlers.ts # Worker message routing
       django/
           executor.ts         # Django WSGI execution
           management.ts       # Django management commands
    types/                 # TypeScript types
    utils/                 # Utility functions
```

## Development Commands

```bash
# Development
pnpm run dev          # Start dev server (Vite)
pnpm run build        # Production build
pnpm run preview      # Preview production build

# Testing
pnpm run test         # Run all tests (E2E + unit)
pnpm run test:unit    # Unit tests (Vitest browser mode)
pnpm run test:e2e     # E2E tests (Playwright)

# Code Quality
pnpm run lint         # Check formatting (Prettier + ESLint)
pnpm run format       # Auto-format code
pnpm run check        # Type-check with svelte-check
pnpm run check:watch  # Type-check in watch mode
```

## Important Patterns & Gotchas

### Svelte 5 Runes

This codebase uses Svelte 5 (NOT Svelte 4). Key differences:

- Use `$state()` instead of `let` for reactive variables
- Use `$derived()` for computed values (NOT `$:`)
- Use `$effect()` for side effects (NOT `$:` or `onMount` patterns)
- Components use snippets (`{#snippet}`) for render props
- Always check the Svelte 5 docs or existing components before adding Svelte code

### Pyodide 0.29.0 API Changes

**IMPORTANT**: Pyodide 0.29.0 changed the `toJs()` API behavior:

- `toJs()` now returns JavaScript objects directly (NOT Maps)
- Old: `result.toJs().get('key')` ❌
- New: `result.get('key')?.toJs()` ✅ or access object properties directly
- Python dicts automatically convert to JS objects (no `dict_converter` needed)

### Worker Communication

- **Never bypass file syncing:** Always send full file tree with 'execute' requests
- **Use skipFileWrite flag:** When navigating between pages, set `skipFileWrite: true` to avoid re-writing unchanged files
- **Cookie persistence:** Execution state manages session cookies via `CookieStorage` (localStorage-backed)

### Django-Specific

- **Virtual FS paths:** Database at `/db.sqlite3`, project files at `/home/pyodide/`
- **Management commands:** migrations, superuser creation all go through workers
- **Static files:** Special handling via `static-file-processor.ts` (not fully tested)
- **Admin panel:** Works with proper migrations and superuser setup

### Testing Strategy

- **Unit tests:** Browser-based Vitest with Playwright (for Svelte components)
- **E2E tests:** Playwright (for full workflows)
- Test config splits client/server tests via Vitest projects (see vite.config.ts)

## Critical Development Rules

1. **Never commit code** - Auto-commits disabled per user preferences
2. **Import style:** Always use full imports at top level (`from x import y`, NOT `import x; x.y`)
3. **Exceptions:** Always descriptive, never silent `pass` without logging
4. **API efficiency:** Use single endpoints, don't load full data to filter client-side
5. **Fix at source:** Never add workarounds, fix the root cause
6. **shadcn-ui:** Read original component in `src/lib/components/ui/` for correct usage
7. **Svelte** Use `$effect` as last resort not default choice. Use `onMount` for loading on mount not `$effect` if we only want to load data.

## Performance Optimizations

- **Snapshot system:** First worker creates IndexedDB snapshot of Pyodide+Django
- **Subsequent workers:** Restore from snapshot (~2s vs ~10s cold start)
- **Pre-import Django modules:** Warm up `sys.modules` cache after install
- **Worker pool:** Reuse workers instead of recreating

## Known Limitations (Experimental)

- Database migrations: Basic support, advanced migrations untested
- ORM complex queries: May have edge cases
- Static files: Not fully implemented
- Admin interface: Requires migrations + superuser (tested and works)
- Forms/validation: Untested
- Authentication: Cookie-based sessions work, full auth system untested
