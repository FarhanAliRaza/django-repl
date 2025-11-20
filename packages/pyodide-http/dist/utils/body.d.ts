/**
 * Convert request body to string format suitable for WSGI/ASGI
 */
export declare function serializeBody(body: string | FormData | Record<string, any> | undefined, contentType?: string): Promise<{
    content: string;
    type: string;
    length: number;
}>;
/**
 * Parse query string into object
 */
export declare function parseQueryString(query: string): Record<string, string>;
//# sourceMappingURL=body.d.ts.map