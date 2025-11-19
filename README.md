# Django Playground

**Experimental** - Run Django in your browser using WebAssembly!

## What is this?

Django Playground is an experimental browser-based IDE that runs Django using Pyodide (Python in WebAssembly). This is a first version exploring what's possible with Django in the browser - no server required.

⚠️ **Experimental Status**: This is an early prototype. Core Django features like views, templates, and URL routing work, but advanced features like migrations, ORM models, and database operations have not been tested yet.

## Features

- **Django Views & Templates** - Create views, templates, and URL patterns
- **Live Code Editor** - CodeMirror-based Python editor with syntax highlighting
- **File Tree Explorer** - Manage your Django project files visually
- **Instant Preview** - See your Django app rendered in real-time
- **SPA Navigation** - Seamless page transitions without full reloads
- **No Backend Needed** - Everything runs client-side in WebAssembly

## What's Tested

✅ Django views and URL routing
✅ Template rendering
✅ Basic Django settings
✅ File-based project structure

## What's Not Tested Yet

❌ Database migrations
❌ ORM models and queries
❌ Forms and validation
❌ Admin interface
❌ Authentication system
❌ Static files handling

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
2. **Web Worker** - Code runs in a dedicated Web Worker thread
3. **Pyodide** - Python interpreter executes Django WSGI handler
4. **Virtual FS** - Files stored in Pyodide's virtual filesystem
5. **Preview** - HTML output rendered in sandboxed iframe

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
