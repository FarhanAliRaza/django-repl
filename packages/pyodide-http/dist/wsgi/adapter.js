import { CookieJar } from '../utils/cookies.js';
import { headersToWSGIEnviron, parseWSGIHeaders, parseStatus } from '../utils/headers.js';
import { serializeBody } from '../utils/body.js';
/**
 * WSGI Adapter for running Python WSGI applications in the browser with Pyodide
 *
 * @example
 * ```typescript
 * const adapter = new WSGIAdapter(pyodide, {
 *   serverName: 'localhost',
 *   serverPort: '8000'
 * });
 *
 * const result = await adapter.handleRequest({
 *   method: 'POST',
 *   path: '/admin/login/',
 *   query: '',
 *   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 *   cookies: {},
 *   body: { username: 'admin', password: 'secret' }
 * });
 * ```
 */
export class WSGIAdapter {
    pyodide;
    options;
    config;
    cookieJar;
    wsgiAppInitialized = false;
    constructor(pyodide, options = {}, config = {}) {
        this.pyodide = pyodide;
        this.options = {
            serverName: options.serverName || 'localhost',
            serverPort: options.serverPort || '8000',
            serverProtocol: options.serverProtocol || 'HTTP/1.1',
            urlScheme: options.urlScheme || 'http',
            scriptName: options.scriptName || ''
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
     * Build WSGI environ dictionary from browser request
     */
    async buildEnviron(request) {
        const { content, type, length } = await serializeBody(request.body, request.contentType);
        // Get cookies from jar and merge with request cookies
        const allCookies = { ...this.cookieJar.getAll(), ...request.cookies };
        const cookieHeader = Object.entries(allCookies)
            .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
            .join('; ');
        // Build headers environ
        const headersEnv = headersToWSGIEnviron({
            ...request.headers,
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        });
        // Build base environ
        const environ = {
            REQUEST_METHOD: request.method,
            SCRIPT_NAME: this.options.scriptName,
            PATH_INFO: request.path,
            QUERY_STRING: request.query,
            CONTENT_TYPE: type,
            CONTENT_LENGTH: String(length),
            SERVER_NAME: this.options.serverName,
            SERVER_PORT: this.options.serverPort,
            SERVER_PROTOCOL: this.options.serverProtocol,
            'wsgi.version': [1, 0],
            'wsgi.url_scheme': this.options.urlScheme,
            'wsgi.multithread': false,
            'wsgi.multiprocess': false,
            'wsgi.run_once': false,
            ...headersEnv
        };
        return { environ, bodyContent: content };
    }
    /**
     * Execute a WSGI application with the given request
     *
     * @param request - The browser HTTP request
     * @param wsgiAppPath - Python import path to WSGI app (e.g., 'myproject.wsgi.application')
     * @returns Execution result with response or error
     */
    async handleRequest(request, wsgiAppPath = 'application') {
        try {
            if (this.config.debug) {
                console.log('[WSGI] Handling request:', request);
            }
            // Build environ
            const { environ, bodyContent } = await this.buildEnviron(request);
            if (this.config.debug) {
                console.log('[WSGI] Environ:', environ);
            }
            // Execute WSGI application in Python
            const result = await this.pyodide.runPythonAsync(`
import sys
from io import StringIO, BytesIO

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

try:
    # Get the WSGI application
    ${this.buildWSGIAppImport(wsgiAppPath)}

    # Build environ from JavaScript
    environ = ${JSON.stringify(environ)}

    # Add WSGI-specific objects
    environ['wsgi.input'] = BytesIO(${JSON.stringify(bodyContent).replace(/'/g, "\\'")}encode('utf-8'))
    environ['wsgi.errors'] = sys.stderr
    environ['wsgi.version'] = tuple(environ['wsgi.version'])

    # Response capture
    response_data = {
        'status': None,
        'headers': []
    }

    def start_response(status, headers, exc_info=None):
        if exc_info:
            try:
                if response_data['headers']:
                    raise exc_info[1].with_traceback(exc_info[2])
            finally:
                exc_info = None
        elif response_data['headers']:
            raise RuntimeError("Response already started")

        response_data['status'] = status
        response_data['headers'] = headers
        return lambda data: output['body'].append(data)

    # Call WSGI application
    result = application(environ, start_response)

    # Collect response body
    try:
        for chunk in result:
            if chunk:
                output['body'].append(chunk)
    finally:
        # Close iterator if it has close()
        if hasattr(result, 'close'):
            result.close()

    output['status'] = response_data['status']
    output['headers'] = response_data['headers']

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
                console.log('[WSGI] stdout:', stdout);
            }
            if (stderr && this.config.debug) {
                console.warn('[WSGI] stderr:', stderr);
            }
            if (error) {
                return {
                    success: false,
                    error: 'WSGI application error',
                    pythonError: stderr || error,
                    stdout,
                    stderr
                };
            }
            // Parse response
            const statusLine = result.get('status');
            const pyHeaders = result.toJs().get('headers');
            const pyBody = result.toJs().get('body');
            if (!statusLine) {
                return {
                    success: false,
                    error: 'WSGI application did not call start_response',
                    stdout,
                    stderr
                };
            }
            const { code, text } = parseStatus(statusLine);
            const { headers, cookies } = parseWSGIHeaders(Array.from(pyHeaders));
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
                status: code,
                statusText: text,
                headers,
                cookies: cookies.map(([_, value]) => {
                    const parts = value.split(';')[0].split('=');
                    return { name: parts[0], value: parts.slice(1).join('=') };
                }),
                body: bodyBytes
            };
            if (this.config.debug) {
                console.log('[WSGI] Response:', response);
            }
            return {
                success: true,
                response,
                stdout,
                stderr
            };
        }
        catch (error) {
            console.error('[WSGI] Execution error:', error);
            return {
                success: false,
                error: String(error),
                pythonError: error instanceof Error ? error.stack : undefined
            };
        }
    }
    /**
     * Build Python code to import WSGI application
     */
    buildWSGIAppImport(wsgiAppPath) {
        if (wsgiAppPath.includes('.')) {
            // Import from module (e.g., 'myproject.wsgi.application')
            const parts = wsgiAppPath.split('.');
            const modulePath = parts.slice(0, -1).join('.');
            const appName = parts[parts.length - 1];
            return `from ${modulePath} import ${appName} as application`;
        }
        else {
            // Already in scope or simple name
            return `# Using application: ${wsgiAppPath}`;
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