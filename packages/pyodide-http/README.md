# @pyodide/http-adapter

> WSGI and ASGI HTTP adapter for running Python web frameworks in the browser with Pyodide

Run Django, Flask, FastAPI, and other Python web frameworks **entirely in the browser** using Pyodide (Python compiled to WebAssembly). This package provides a clean JavaScript/TypeScript API to handle HTTP requests, cookies, sessions, and form submissions.

## Features

- ✅ **Full WSGI Support** - Run Django, Flask, Bottle, etc.
- ✅ **ASGI Support** - Run FastAPI, Starlette, Django Channels (async/await)
- ✅ **Cookie & Session Management** - Persistent cookies with localStorage
- ✅ **Form Handling** - Automatic form interception and POST request support
- ✅ **TypeScript** - Full type definitions included
- ✅ **Zero Dependencies** - Only requires Pyodide as peer dependency

## Installation

```bash
npm install @pyodide/http-adapter pyodide
# or
pnpm add @pyodide/http-adapter pyodide
# or
yarn add @pyodide/http-adapter pyodide
```

## Quick Start

### WSGI Example (Django/Flask)

```typescript
import { loadPyodide } from 'pyodide';
import { WSGIAdapter, createIframeInterceptor } from '@pyodide/http-adapter';

// Load Pyodide
const pyodide = await loadPyodide();

// Install Django
await pyodide.loadPackage('micropip');
const micropip = pyodide.pyimport('micropip');
await micropip.install('django');

// Write your Django project files to Pyodide's virtual filesystem
pyodide.FS.writeFile('views.py', `
from django.http import HttpResponse

def hello(request):
    return HttpResponse('<h1>Hello from Django in the browser!</h1>')
`);

// Create WSGI adapter
const adapter = new WSGIAdapter(pyodide, {
  serverName: 'localhost',
  serverPort: '8000'
});

// Handle a request
const result = await adapter.handleRequest({
  method: 'GET',
  path: '/',
  query: '',
  headers: {},
  cookies: {}
});

if (result.success && result.response) {
  const html = new TextDecoder().decode(result.response.body);
  console.log(html); // <h1>Hello from Django in the browser!</h1>
}
```

### ASGI Example (FastAPI)

```typescript
import { loadPyodide } from 'pyodide';
import { ASGIAdapter } from '@pyodide/http-adapter';

const pyodide = await loadPyodide();

// Install FastAPI
const micropip = pyodide.pyimport('micropip');
await micropip.install('fastapi');

// Write your FastAPI app
pyodide.FS.writeFile('main.py', `
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from FastAPI in the browser!"}
`);

// Create ASGI adapter
const adapter = new ASGIAdapter(pyodide);

// Handle request
const result = await adapter.handleRequest(
  {
    method: 'GET',
    path: '/',
    query: '',
    headers: { 'Accept': 'application/json' },
    cookies: {}
  },
  'main.app' // Import path to ASGI application
);

if (result.success && result.response) {
  const json = new TextDecoder().decode(result.response.body);
  console.log(JSON.parse(json)); // { message: "Hello from FastAPI in the browser!" }
}
```

### Form Interception with iframe

```typescript
import { WSGIAdapter, createIframeInterceptor } from '@pyodide/http-adapter';

const iframe = document.getElementById('preview') as HTMLIFrameElement;
const adapter = new WSGIAdapter(pyodide);

// Create interceptor to catch form submissions and link clicks
const interceptor = createIframeInterceptor(iframe, {
  onRequest: async (request) => {
    console.log('Request intercepted:', request);

    // Handle with WSGI
    const result = await adapter.handleRequest(request, 'myproject.wsgi.application');

    if (result.success && result.response) {
      // Update iframe with response
      const html = new TextDecoder().decode(result.response.body);
      iframe.contentDocument.body.innerHTML = html;
    }
  }
});

// Start intercepting
interceptor.start();

// Later: stop intercepting
// interceptor.stop();
```

## API Reference

### WSGIAdapter

```typescript
class WSGIAdapter {
  constructor(
    pyodide: PyodideInterface,
    options?: WSGIAdapterOptions,
    config?: AdapterConfig
  )

  handleRequest(
    request: BrowserRequest,
    wsgiAppPath?: string
  ): Promise<WSGIExecutionResult>

  getCookieJar(): CookieJar
  clearCookies(): void
}
```

**WSGIAdapterOptions:**
```typescript
{
  serverName?: string;        // default: 'localhost'
  serverPort?: string;        // default: '8000'
  serverProtocol?: string;    // default: 'HTTP/1.1'
  urlScheme?: string;         // default: 'http'
  scriptName?: string;        // default: ''
}
```

### ASGIAdapter

```typescript
class ASGIAdapter {
  constructor(
    pyodide: PyodideInterface,
    options?: ASGIAdapterOptions,
    config?: AdapterConfig
  )

  handleRequest(
    request: BrowserRequest,
    asgiAppPath?: string
  ): Promise<ASGIExecutionResult>

  getCookieJar(): CookieJar
  clearCookies(): void
}
```

**ASGIAdapterOptions:**
```typescript
{
  serverName?: string;        // default: 'localhost'
  serverPort?: number;        // default: 8000
  asgiVersion?: string;       // default: '3.0'
  specVersion?: string;       // default: '2.3'
  httpVersion?: string;       // default: '1.1'
  rootPath?: string;          // default: ''
}
```

### BrowserRequest

```typescript
interface BrowserRequest {
  method: HttpMethod;
  path: string;
  query: string;
  headers: HttpHeaders;
  cookies: Cookies;
  body?: string | FormData | Record<string, any>;
  contentType?: string;
}
```

### BrowserResponse

```typescript
interface BrowserResponse {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  cookies: Array<{ name: string; value: string; options?: CookieOptions }>;
  body: string | Uint8Array;
}
```

### RequestInterceptor

```typescript
class RequestInterceptor {
  constructor(document: Document, options?: InterceptorOptions)

  start(): void
  stop(): void
  isActive(): boolean
}
```

**InterceptorOptions:**
```typescript
{
  interceptForms?: boolean;     // default: true
  interceptLinks?: boolean;     // default: true
  baseUrl?: string;             // default: '/'
  onRequest?: (request: BrowserRequest) => void | Promise<void>;
  debug?: boolean;              // default: false
}
```

### CookieJar

```typescript
class CookieJar {
  constructor(storageKey?: string, storage?: Storage)

  set(name: string, value: string, options?: CookieOptions): void
  get(name: string): string | undefined
  delete(name: string): void
  getAll(): Cookies
  getCookieHeader(): string
  processSetCookieHeaders(headers: Array<[string, string]>): void
  clear(): void
}
```

## Real-World Example: Django Admin Login

```typescript
import { loadPyodide } from 'pyodide';
import { WSGIAdapter, createIframeInterceptor } from '@pyodide/http-adapter';

// Initialize Pyodide and Django
const pyodide = await loadPyodide();
await pyodide.loadPackage(['micropip', 'sqlite3']);
const micropip = pyodide.pyimport('micropip');
await micropip.install('django');

// Setup Django with admin enabled
await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings

settings.configure(
    DEBUG=True,
    SECRET_KEY='your-secret-key',
    INSTALLED_APPS=[
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',
        'django.contrib.messages',
    ],
    MIDDLEWARE=[
        'django.middleware.security.SecurityMiddleware',
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.middleware.common.CommonMiddleware',
        'django.middleware.csrf.CsrfViewMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        'django.contrib.messages.middleware.MessageMiddleware',
    ],
    DATABASES={
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    },
    ROOT_URLCONF='urls',
)
django.setup()

# Run migrations
from django.core.management import call_command
call_command('migrate', '--run-syncdb')

# Create superuser
from django.contrib.auth import get_user_model
User = get_user_model()
User.objects.create_superuser('admin', 'admin@example.com', 'password')
`);

// Create WSGI adapter with cookie persistence
const adapter = new WSGIAdapter(pyodide, {}, {
  persistCookies: true,  // Enable cookie persistence
  debug: true            // Enable debug logging
});

// Setup iframe interceptor
const iframe = document.getElementById('django-preview') as HTMLIFrameElement;
const interceptor = createIframeInterceptor(iframe, {
  onRequest: async (request) => {
    const result = await adapter.handleRequest(request, 'django.core.handlers.wsgi.WSGIHandler');

    if (result.success && result.response) {
      const html = new TextDecoder().decode(result.response.body);

      // Send HTML to iframe
      iframe.contentWindow?.postMessage({ type: 'update', html }, '*');
    } else {
      console.error('Request failed:', result.error);
    }
  }
});

interceptor.start();
```

Now users can:
1. Navigate to `/admin/`
2. Fill in the login form (username: `admin`, password: `password`)
3. Submit the form
4. The adapter handles POST request, processes session cookies, and logs the user in!

## WSGI vs ASGI: Which Should I Use?

### Use WSGI for:
- **Django (traditional)** - Most Django projects use WSGI
- **Flask** - Standard Flask apps
- **Bottle** - Lightweight WSGI framework
- **Simpler architecture** - WSGI is synchronous and easier to understand
- **Teaching** - Great for learning how web frameworks work

### Use ASGI for:
- **FastAPI** - Modern async Python framework
- **Starlette** - ASGI web framework
- **Django (async views)** - Django 3.1+ with async support
- **WebSocket support** - ASGI handles WebSockets (future feature)
- **Modern async/await** - Better performance for I/O-bound operations

## How It Works

1. **Request Capture**: The `RequestInterceptor` captures form submissions and link clicks from an iframe
2. **Request Conversion**: Browser requests are converted to WSGI `environ` dict or ASGI `scope` dict
3. **Python Execution**: Pyodide executes your Python web framework with the request
4. **Response Parsing**: The response (HTML, JSON, etc.) is extracted along with cookies/headers
5. **Cookie Management**: Set-Cookie headers are automatically parsed and stored
6. **Response Delivery**: The response is sent back to the iframe or your custom handler

## Browser Compatibility

Works in all modern browsers that support:
- WebAssembly
- ES2022+
- Web Workers (recommended for background execution)

Tested on:
- Chrome/Edge 90+
- Firefox 90+
- Safari 15+

## Limitations

- **File Uploads**: Multipart/form-data support is limited (coming soon)
- **WebSockets**: ASGI WebSocket support not yet implemented
- **Performance**: Slower than native server due to WebAssembly overhead
- **Memory**: Large frameworks (Django) may use significant memory

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © [Your Name]

## Related Projects

- [Pyodide](https://pyodide.org/) - Python for the browser
- [PyScript](https://pyscript.net/) - Run Python in HTML
- [JupyterLite](https://jupyterlite.readthedocs.io/) - Jupyter in the browser

---

**Made with ❤️ for the Python and WebAssembly communities**
