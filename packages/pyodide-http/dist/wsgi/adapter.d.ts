import type { PyodideInterface } from 'pyodide';
import type { BrowserRequest, AdapterConfig } from '../types/http.js';
import type { WSGIAdapterOptions, WSGIExecutionResult } from '../types/wsgi.js';
import { CookieJar } from '../utils/cookies.js';
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
export declare class WSGIAdapter {
    private pyodide;
    private options;
    private config;
    private cookieJar;
    private wsgiAppInitialized;
    constructor(pyodide: PyodideInterface, options?: WSGIAdapterOptions, config?: AdapterConfig);
    /**
     * Build WSGI environ dictionary from browser request
     */
    private buildEnviron;
    /**
     * Execute a WSGI application with the given request
     *
     * @param request - The browser HTTP request
     * @param wsgiAppPath - Python import path to WSGI app (e.g., 'myproject.wsgi.application')
     * @returns Execution result with response or error
     */
    handleRequest(request: BrowserRequest, wsgiAppPath?: string): Promise<WSGIExecutionResult>;
    /**
     * Build Python code to import WSGI application
     */
    private buildWSGIAppImport;
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