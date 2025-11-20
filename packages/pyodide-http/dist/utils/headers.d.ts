import type { HttpHeaders } from '../types/http.js';
/**
 * Convert HTTP headers to WSGI environ format (uppercase with HTTP_ prefix)
 */
export declare function headersToWSGIEnviron(headers: HttpHeaders): Record<string, string>;
/**
 * Convert HTTP headers to ASGI format (lowercase bytes tuples)
 */
export declare function headersToASGI(headers: HttpHeaders): Array<[Uint8Array, Uint8Array]>;
/**
 * Parse WSGI response headers from Python list of tuples
 */
export declare function parseWSGIHeaders(pyHeaders: Array<[string, string]>): {
    headers: HttpHeaders;
    cookies: Array<[string, string]>;
};
/**
 * Parse ASGI response headers from Python list of bytes tuples
 */
export declare function parseASGIHeaders(pyHeaders: Array<[Uint8Array, Uint8Array]>): {
    headers: HttpHeaders;
    cookies: Array<[string, string]>;
};
/**
 * Parse HTTP status line (e.g., "200 OK")
 */
export declare function parseStatus(statusLine: string): {
    code: number;
    text: string;
};
//# sourceMappingURL=headers.d.ts.map