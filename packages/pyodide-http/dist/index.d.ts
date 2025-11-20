/**
 * @pyodide/http-adapter
 *
 * WSGI and ASGI HTTP adapter for running Python web frameworks
 * (Django, Flask, FastAPI) in the browser with Pyodide.
 *
 * @packageDocumentation
 */
export type * from './types/index.js';
export { WSGIAdapter } from './wsgi/adapter.js';
export { ASGIAdapter } from './asgi/adapter.js';
export { CookieJar, parseCookies, parseSetCookie, serializeCookie, RequestInterceptor, createIframeInterceptor, headersToWSGIEnviron, headersToASGI, parseWSGIHeaders, parseASGIHeaders, parseStatus, serializeBody, parseQueryString } from './utils/index.js';
//# sourceMappingURL=index.d.ts.map