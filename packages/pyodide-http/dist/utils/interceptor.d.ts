import type { BrowserRequest } from '../types/http.js';
/**
 * Options for request interceptor
 */
export interface InterceptorOptions {
    /**
     * Intercept form submissions (default: true)
     */
    interceptForms?: boolean;
    /**
     * Intercept link clicks (default: true)
     */
    interceptLinks?: boolean;
    /**
     * Base URL for resolving relative URLs (default: '/')
     */
    baseUrl?: string;
    /**
     * Callback when a request is intercepted
     */
    onRequest?: (request: BrowserRequest) => void | Promise<void>;
    /**
     * Enable debug logging (default: false)
     */
    debug?: boolean;
}
/**
 * RequestInterceptor captures browser navigation and form submissions
 * and converts them to BrowserRequest objects.
 *
 * This is typically used with iframes to capture user interactions
 * and route them through WSGI/ASGI adapters.
 *
 * @example
 * ```typescript
 * const interceptor = new RequestInterceptor(iframeDocument, {
 *   onRequest: async (request) => {
 *     const result = await wsgiAdapter.handleRequest(request);
 *     updateUI(result.response);
 *   }
 * });
 *
 * interceptor.start();
 * ```
 */
export declare class RequestInterceptor {
    private document;
    private options;
    private isRunning;
    private formListener?;
    private linkListener?;
    constructor(document: Document, options?: InterceptorOptions);
    /**
     * Start intercepting requests
     */
    start(): void;
    /**
     * Stop intercepting requests
     */
    stop(): void;
    /**
     * Handle form submission
     */
    private handleFormSubmit;
    /**
     * Handle link click
     */
    private handleLinkClick;
    /**
     * Check if interceptor is running
     */
    isActive(): boolean;
}
/**
 * Create a request interceptor for an iframe element
 */
export declare function createIframeInterceptor(iframe: HTMLIFrameElement, options?: InterceptorOptions): RequestInterceptor | null;
//# sourceMappingURL=interceptor.d.ts.map