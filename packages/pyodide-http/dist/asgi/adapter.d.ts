import type { PyodideInterface } from 'pyodide';
import type { BrowserRequest, AdapterConfig } from '../types/http.js';
import type { ASGIAdapterOptions, ASGIExecutionResult } from '../types/asgi.js';
import { CookieJar } from '../utils/cookies.js';
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
export declare class ASGIAdapter {
    private pyodide;
    private options;
    private config;
    private cookieJar;
    constructor(pyodide: PyodideInterface, options?: ASGIAdapterOptions, config?: AdapterConfig);
    /**
     * Build ASGI scope dictionary from browser request
     */
    private buildScope;
    /**
     * Execute an ASGI application with the given request
     *
     * @param request - The browser HTTP request
     * @param asgiAppPath - Python import path to ASGI app (e.g., 'myproject.asgi.application')
     * @returns Execution result with response or error
     */
    handleRequest(request: BrowserRequest, asgiAppPath?: string): Promise<ASGIExecutionResult>;
    /**
     * Build Python code to import ASGI application
     */
    private buildASGIAppImport;
    /**
     * Get the cookie jar for manual cookie management
     */
    getCookieJar(): CookieJar;
    /**
     * Clear all cookies
     */
    clearCookies(): void;
}
//# sourceMappingURL=adapter.d.ts.map