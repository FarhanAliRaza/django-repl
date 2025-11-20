/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * HTTP headers as key-value pairs
 */
export type HttpHeaders = Record<string, string>;

/**
 * HTTP cookies as key-value pairs
 */
export type Cookies = Record<string, string>;

/**
 * Represents an HTTP request from the browser
 */
export interface BrowserRequest {
  method: HttpMethod;
  path: string;
  query: string;
  headers: HttpHeaders;
  cookies: Cookies;
  body?: string | FormData | Record<string, any>;
  contentType?: string;
}

/**
 * Represents an HTTP response to be sent to the browser
 */
export interface BrowserResponse {
  status: number;
  statusText: string;
  headers: HttpHeaders;
  cookies: Array<{ name: string; value: string; options?: CookieOptions }>;
  body: string | Uint8Array;
}

/**
 * Cookie options for Set-Cookie header
 */
export interface CookieOptions {
  path?: string;
  domain?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Configuration for the HTTP adapter
 */
export interface AdapterConfig {
  /**
   * Base path for the application
   */
  basePath?: string;

  /**
   * Enable cookie persistence (default: true)
   */
  persistCookies?: boolean;

  /**
   * Storage key for persisting cookies (default: 'pyodide-http-cookies')
   */
  cookieStorageKey?: string;

  /**
   * Custom cookie storage (default: localStorage)
   */
  cookieStorage?: Storage;

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean;
}
