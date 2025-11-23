# Django Playground

**Experimental** - Run Django in your browser using WebAssembly!

## What is this?

Django Playground is an experimental browser-based IDE that runs Django using Pyodide (Python in WebAssembly). This is a first version exploring what's possible with Django in the browser - no server required.

⚠️ **Experimental Status**: This is an early prototype exploring what's possible with Django in the browser. Core features work well, but some advanced functionality may have edge cases.

## Features

- **Django Views & Templates** - Create views, templates, and URL patterns
- **Live Code Editor** - CodeMirror-based Python editor with syntax highlighting
- **File Tree Explorer** - Manage your Django project files visually
- **Instant Preview** - See your Django app rendered in real-time
- **Database Support** - SQLite3 database running in-browser with migrations
- **Admin Interface** - Full Django admin panel (with migrations + superuser setup)
- **Session Management** - Cookie-based sessions with localStorage persistence
- **SPA Navigation** - Seamless page transitions without full reloads
- **Worker Pool** - Optimized with snapshot caching for fast reloads
- **No Backend Needed** - Everything runs client-side in WebAssembly

## What Works

✅ Django views and URL routing
✅ Template rendering with context
✅ Database migrations (makemigrations, migrate)
✅ ORM models and basic queries
✅ Admin interface (create superuser via UI button)
✅ Cookie-based sessions and authentication
✅ File-based project structure
✅ Worker pool with snapshot optimization

## Known Limitations

⚠️ Complex ORM queries may have edge cases
⚠️ Forms and validation (not extensively tested)
⚠️ Static files handling (partial implementation)
⚠️ Advanced Django features may be untested

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Open browser to localhost:5173
```

## Tech Stack

- **SvelteKit 2** - Meta-framework with file-based routing
- **Svelte 5** - Reactive UI with runes
- **Pyodide** - Python runtime in WebAssembly
- **CodeMirror 6** - Code editor
- **Tailwind CSS v4** - Styling
- **Web Workers** - Isolated Python execution

## Commands

```bash
pnpm run dev          # Development server
pnpm run build        # Production build
pnpm run preview      # Preview production build
pnpm run test         # Run all tests
pnpm run test:unit    # Unit tests only
pnpm run test:e2e     # E2E tests only
pnpm run lint         # Check code formatting
pnpm run format       # Format code
```

## How it Works

1. **Editor** - Write Django code in the CodeMirror editor
2. **Web Worker Pool** - Code runs in dedicated Web Worker threads (pooled and reused)
3. **Pyodide** - Python 3.13 interpreter executes Django via WSGI handler
4. **Virtual FS** - Files stored in Pyodide's in-memory filesystem
5. **Snapshot Caching** - IndexedDB caches Pyodide+Django for fast worker initialization
6. **Preview** - HTML output rendered in sandboxed iframe

**Performance**: First load takes ~10s to install Django. Subsequent workers restore from cache in ~2s thanks to the snapshot system.

## Project Structure

```
src/
├── routes/              # SvelteKit pages
├── lib/
│   ├── components/     # UI components
│   ├── stores/         # State management
│   ├── workers/        # Web Workers (Python executor)
│   └── types/          # TypeScript types
```

## License

MIT

---

Made with ❤️ by [Farhan Ali Raza](https://www.linkedin.com/in/farhanaliraza/)
