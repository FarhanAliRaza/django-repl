/**
 * @pyodide/http-adapter
 *
 * WSGI and ASGI HTTP adapter for running Python web frameworks
 * (Django, Flask, FastAPI) in the browser with Pyodide.
 *
 * @packageDocumentation
 */

// Export types
export type * from './types/index.js';

// Export WSGI adapter
export { WSGIAdapter } from './wsgi/adapter.js';

// Export ASGI adapter
export { ASGIAdapter } from './asgi/adapter.js';

// Export utilities
export {
  CookieJar,
  parseCookies,
  parseSetCookie,
  serializeCookie,
  RequestInterceptor,
  createIframeInterceptor,
  headersToWSGIEnviron,
  headersToASGI,
  parseWSGIHeaders,
  parseASGIHeaders,
  parseStatus,
  serializeBody,
  parseQueryString
} from './utils/index.js';
