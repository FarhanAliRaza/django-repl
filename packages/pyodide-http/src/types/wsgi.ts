import type { BrowserRequest, BrowserResponse } from './http.js';

/**
 * WSGI environ dictionary as defined in PEP 3333
 * https://peps.python.org/pep-3333/
 */
export interface WSGIEnviron {
  // Required CGI variables
  REQUEST_METHOD: string;
  SCRIPT_NAME: string;
  PATH_INFO: string;
  QUERY_STRING: string;
  CONTENT_TYPE: string;
  CONTENT_LENGTH: string;
  SERVER_NAME: string;
  SERVER_PORT: string;
  SERVER_PROTOCOL: string;

  // WSGI-specific variables
  'wsgi.version': [number, number];
  'wsgi.url_scheme': string;
  'wsgi.input': any; // Python StringIO object
  'wsgi.errors': any; // Python stderr
  'wsgi.multithread': boolean;
  'wsgi.multiprocess': boolean;
  'wsgi.run_once': boolean;

  // Optional HTTP headers (HTTP_* format)
  [key: string]: any;
}

/**
 * WSGI response data captured from start_response
 */
export interface WSGIResponse {
  status: string; // e.g., "200 OK"
  headers: Array<[string, string]>;
  body: Uint8Array[];
}

/**
 * Options for WSGI adapter
 */
export interface WSGIAdapterOptions {
  /**
   * Server name (default: 'localhost')
   */
  serverName?: string;

  /**
   * Server port (default: '8000')
   */
  serverPort?: string;

  /**
   * Server protocol (default: 'HTTP/1.1')
   */
  serverProtocol?: string;

  /**
   * URL scheme (default: 'http')
   */
  urlScheme?: string;

  /**
   * Script name / mount point (default: '')
   */
  scriptName?: string;
}

/**
 * Result of executing a WSGI application
 */
export interface WSGIExecutionResult {
  success: boolean;
  response?: BrowserResponse;
  error?: string;
  pythonError?: string;
  stdout?: string;
  stderr?: string;
}
