import type { BrowserResponse } from './http.js';
/**
 * ASGI HTTP scope as defined in ASGI spec
 * https://asgi.readthedocs.io/en/latest/specs/www.html
 */
export interface ASGIHTTPScope {
    type: 'http';
    asgi: {
        version: string;
        spec_version: string;
    };
    http_version: string;
    method: string;
    scheme: string;
    path: string;
    raw_path: Uint8Array;
    query_string: Uint8Array;
    root_path: string;
    headers: Array<[Uint8Array, Uint8Array]>;
    server: [string, number] | null;
    client: [string, number] | null;
    state?: Record<string, any>;
}
/**
 * ASGI receive messages
 */
export type ASGIReceiveMessage = {
    type: 'http.request';
    body: Uint8Array;
    more_body: boolean;
} | {
    type: 'http.disconnect';
};
/**
 * ASGI send messages
 */
export type ASGISendMessage = {
    type: 'http.response.start';
    status: number;
    headers: Array<[Uint8Array, Uint8Array]>;
    trailers?: boolean;
} | {
    type: 'http.response.body';
    body: Uint8Array;
    more_body?: boolean;
};
/**
 * Options for ASGI adapter
 */
export interface ASGIAdapterOptions {
    /**
     * Server name (default: 'localhost')
     */
    serverName?: string;
    /**
     * Server port (default: 8000)
     */
    serverPort?: number;
    /**
     * ASGI version (default: '3.0')
     */
    asgiVersion?: string;
    /**
     * ASGI spec version (default: '2.3')
     */
    specVersion?: string;
    /**
     * HTTP version (default: '1.1')
     */
    httpVersion?: string;
    /**
     * Root path / mount point (default: '')
     */
    rootPath?: string;
}
/**
 * Result of executing an ASGI application
 */
export interface ASGIExecutionResult {
    success: boolean;
    response?: BrowserResponse;
    error?: string;
    pythonError?: string;
    stdout?: string;
    stderr?: string;
}
//# sourceMappingURL=asgi.d.ts.map