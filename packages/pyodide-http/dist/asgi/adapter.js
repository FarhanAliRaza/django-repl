import { CookieJar } from '../utils/cookies.js';
import { headersToASGI, parseWSGIHeaders } from '../utils/headers.js';
import { serializeBody } from '../utils/body.js';
/**
 * ASGI Adapter for running Python ASGI applications in the browser with Pyodide
 *
 * ASGI uses async/await and is more complex than WSGI, but provides better
 * support for modern async Python frameworks like FastAPI, Starlette, Django Channels.
 *
 * @example
 * ```typescript
 * const adapter = new ASGIAdapter(pyodide, {
 *   serverName: 'localhost',
 *   serverPort: 8000
 * });
 *
 * const result = await adapter.handleRequest({
 *   method: 'POST',
 *   path: '/api/users',
 *   query: '',
 *   headers: { 'Content-Type': 'application/json' },
 *   cookies: {},
 *   body: { name: 'John' }
 * });
 * ```
 */
export class ASGIAdapter {
    pyodide;
    options;
    config;
    cookieJar;
    constructor(pyodide, options = {}, config = {}) {
        this.pyodide = pyodide;
        this.options = {
            serverName: options.serverName || 'localhost',
            serverPort: options.serverPort || 8000,
            asgiVersion: options.asgiVersion || '3.0',
            specVersion: options.specVersion || '2.3',
            httpVersion: options.httpVersion || '1.1',
            rootPath: options.rootPath || ''
        };
        this.config = {
            basePath: config.basePath || '',
            persistCookies: config.persistCookies !== false,
            cookieStorageKey: config.cookieStorageKey || 'pyodide-http-cookies',
            cookieStorage: config.cookieStorage || (typeof localStorage !== 'undefined' ? localStorage : undefined),
            debug: config.debug || false
        };
        this.cookieJar = new CookieJar(this.config.cookieStorageKey, this.config.persistCookies ? this.config.cookieStorage : undefined);
    }
    /**
     * Build ASGI scope dictionary from browser request
     */
    async buildScope(request) {
        const { content, type } = await serializeBody(request.body, request.contentType);
        // Get cookies from jar and merge with request cookies
        const allCookies = { ...this.cookieJar.getAll(), ...request.cookies };
        const cookieHeader = Object.entries(allCookies)
            .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
            .join('; ');
        // Build headers with cookies
        const headers = {
            ...request.headers,
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        };
        const asgiHeaders = headersToASGI(headers);
        // Build scope
        const encoder = new TextEncoder();
        const scope = {
            type: 'http',
            asgi: {
                version: this.options.asgiVersion,
                spec_version: this.options.specVersion
            },
            http_version: this.options.httpVersion,
            method: request.method,
            scheme: 'http',
            path: request.path,
            raw_path: Array.from(encoder.encode(request.path)),
            query_string: Array.from(encoder.encode(request.query)),
            root_path: this.options.rootPath,
            headers: asgiHeaders.map(([name, value]) => [Array.from(name), Array.from(value)]),
            server: [this.options.serverName, this.options.serverPort],
            client: null,
            state: {}
        };
        return { scope, bodyContent: content };
    }
    /**
     * Execute an ASGI application with the given request
     *
     * @param request - The browser HTTP request
     * @param asgiAppPath - Python import path to ASGI app (e.g., 'myproject.asgi.application')
     * @returns Execution result with response or error
     */
    async handleRequest(request, asgiAppPath = 'application') {
        try {
            if (this.config.debug) {
                console.log('[ASGI] Handling request:', request);
            }
            // Build scope
            const { scope, bodyContent } = await this.buildScope(request);
            if (this.config.debug) {
                console.log('[ASGI] Scope:', scope);
            }
            // Execute ASGI application in Python (requires asyncio support in Pyodide)
            const result = await this.pyodide.runPythonAsync(`
import sys
from io import StringIO
import asyncio

# Capture stdout and stderr
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {
    'stdout': '',
    'stderr': '',
    'error': None,
    'status': None,
    'headers': [],
    'body': []
}

async def run_asgi():
    try:
        # Get the ASGI application
        ${this.buildASGIAppImport(asgiAppPath)}

        # Build scope from JavaScript
        scope = ${JSON.stringify(scope)}

        # Convert header byte arrays back to bytes
        scope['headers'] = [
            (bytes(name), bytes(value))
            for name, value in scope['headers']
        ]
        scope['raw_path'] = bytes(scope['raw_path'])
        scope['query_string'] = bytes(scope['query_string'])

        # Request body
        body_content = ${JSON.stringify(bodyContent).replace(/'/g, "\\'")}encode('utf-8')
        body_sent = False

        # ASGI receive callable
        async def receive():
            nonlocal body_sent
            if not body_sent:
                body_sent = True
                return {
                    'type': 'http.request',
                    'body': body_content,
                    'more_body': False
                }
            else:
                return {'type': 'http.disconnect'}

        # ASGI send callable
        response_started = False

        async def send(message):
            nonlocal response_started

            if message['type'] == 'http.response.start':
                if response_started:
                    raise RuntimeError('Response already started')
                response_started = True
                output['status'] = message['status']
                output['headers'] = [
                    (name.decode('utf-8'), value.decode('utf-8'))
                    for name, value in message['headers']
                ]
            elif message['type'] == 'http.response.body':
                body = message.get('body', b'')
                if body:
                    output['body'].append(body)

        # Call ASGI application
        await application(scope, receive, send)

    except Exception as e:
        import traceback
        output['error'] = str(e)
        output['stderr'] = traceback.format_exc()

# Run the async function
try:
    asyncio.run(run_asgi())
except Exception as e:
    import traceback
    output['error'] = str(e)
    output['stderr'] = traceback.format_exc()
finally:
    output['stdout'] = sys.stdout.getvalue()
    output['stderr'] = sys.stderr.getvalue()

    sys.stdout = old_stdout
    sys.stderr = old_stderr

output
      `);
            const stdout = result.get('stdout') || '';
            const stderr = result.get('stderr') || '';
            const error = result.get('error');
            if (stdout && this.config.debug) {
                console.log('[ASGI] stdout:', stdout);
            }
            if (stderr && this.config.debug) {
                console.warn('[ASGI] stderr:', stderr);
            }
            if (error) {
                return {
                    success: false,
                    error: 'ASGI application error',
                    pythonError: stderr || error,
                    stdout,
                    stderr
                };
            }
            // Parse response
            const status = result.get('status');
            const pyHeaders = result.toJs().get('headers');
            const pyBody = result.toJs().get('body');
            if (status === null || status === undefined) {
                return {
                    success: false,
                    error: 'ASGI application did not send http.response.start',
                    stdout,
                    stderr
                };
            }
            const { headers, cookies } = parseWSGIHeaders(Array.from(pyHeaders)); // Same format as WSGI
            // Process Set-Cookie headers
            if (cookies.length > 0) {
                this.cookieJar.processSetCookieHeaders(cookies);
            }
            // Combine body chunks
            let bodyBytes = new Uint8Array(0);
            for (const chunk of pyBody) {
                const chunkBytes = typeof chunk === 'string'
                    ? new TextEncoder().encode(chunk)
                    : new Uint8Array(chunk);
                const combined = new Uint8Array(bodyBytes.length + chunkBytes.length);
                combined.set(bodyBytes);
                combined.set(chunkBytes, bodyBytes.length);
                bodyBytes = combined;
            }
            const response = {
                status,
                statusText: '', // ASGI doesn't include status text
                headers,
                cookies: cookies.map(([_name, value]) => {
                    const parts = value.split(';')[0].split('=');
                    return { name: parts[0], value: parts.slice(1).join('=') };
                }),
                body: bodyBytes
            };
            if (this.config.debug) {
                console.log('[ASGI] Response:', response);
            }
            return {
                success: true,
                response,
                stdout,
                stderr
            };
        }
        catch (error) {
            console.error('[ASGI] Execution error:', error);
            return {
                success: false,
                error: String(error),
                pythonError: error instanceof Error ? error.stack : undefined
            };
        }
    }
    /**
     * Build Python code to import ASGI application
     */
    buildASGIAppImport(asgiAppPath) {
        if (asgiAppPath.includes('.')) {
            // Import from module (e.g., 'myproject.asgi.application')
            const parts = asgiAppPath.split('.');
            const modulePath = parts.slice(0, -1).join('.');
            const appName = parts[parts.length - 1];
            return `from ${modulePath} import ${appName} as application`;
        }
        else {
            // Already in scope or simple name
            return `# Using application: ${asgiAppPath}`;
        }
    }
    /**
     * Get the cookie jar for manual cookie management
     */
    getCookieJar() {
        return this.cookieJar;
    }
    /**
     * Clear all cookies
     */
    clearCookies() {
        this.cookieJar.clear();
    }
}
//# sourceMappingURL=adapter.js.map