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
export class RequestInterceptor {
    document;
    options;
    isRunning = false;
    formListener;
    linkListener;
    constructor(document, options = {}) {
        this.document = document;
        this.options = {
            interceptForms: options.interceptForms !== false,
            interceptLinks: options.interceptLinks !== false,
            baseUrl: options.baseUrl || '/',
            onRequest: options.onRequest || (() => { }),
            debug: options.debug || false
        };
    }
    /**
     * Start intercepting requests
     */
    start() {
        if (this.isRunning) {
            console.warn('[Interceptor] Already running');
            return;
        }
        this.isRunning = true;
        if (this.options.interceptForms) {
            this.formListener = this.handleFormSubmit.bind(this);
            this.document.addEventListener('submit', this.formListener, true);
        }
        if (this.options.interceptLinks) {
            this.linkListener = this.handleLinkClick.bind(this);
            this.document.addEventListener('click', this.linkListener, true);
        }
        if (this.options.debug) {
            console.log('[Interceptor] Started');
        }
    }
    /**
     * Stop intercepting requests
     */
    stop() {
        if (!this.isRunning)
            return;
        this.isRunning = false;
        if (this.formListener) {
            this.document.removeEventListener('submit', this.formListener, true);
        }
        if (this.linkListener) {
            this.document.removeEventListener('click', this.linkListener, true);
        }
        if (this.options.debug) {
            console.log('[Interceptor] Stopped');
        }
    }
    /**
     * Handle form submission
     */
    handleFormSubmit(e) {
        e.preventDefault();
        e.stopPropagation();
        const form = e.target;
        const formData = new FormData(form);
        const method = (form.method || 'GET').toUpperCase();
        const action = form.action || this.options.baseUrl;
        // Parse URL
        const url = new URL(action, window.location.origin);
        const path = url.pathname;
        const query = url.search.slice(1); // Remove leading ?
        // Get content type
        const contentType = form.enctype || (method === 'POST' ? 'application/x-www-form-urlencoded' : '');
        const request = {
            method,
            path,
            query,
            headers: {
                'Content-Type': contentType
            },
            cookies: {},
            body: method === 'POST' || method === 'PUT' || method === 'PATCH' ? formData : undefined,
            contentType
        };
        if (this.options.debug) {
            console.log('[Interceptor] Form submitted:', request);
        }
        this.options.onRequest(request);
    }
    /**
     * Handle link click
     */
    handleLinkClick(e) {
        const target = e.target;
        // Find the closest <a> tag
        const link = target.closest('a');
        if (!link)
            return;
        // Only intercept same-origin links
        const href = link.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
            return;
        }
        // Check if external link
        try {
            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) {
                // External link - let it go through
                return;
            }
            // Check for target="_blank" or download attribute
            if (link.target === '_blank' || link.hasAttribute('download')) {
                return;
            }
            // Intercept the click
            e.preventDefault();
            e.stopPropagation();
            const path = url.pathname;
            const query = url.search.slice(1);
            const request = {
                method: 'GET',
                path,
                query,
                headers: {},
                cookies: {}
            };
            if (this.options.debug) {
                console.log('[Interceptor] Link clicked:', request);
            }
            this.options.onRequest(request);
        }
        catch (error) {
            // Invalid URL - let it go through
            return;
        }
    }
    /**
     * Check if interceptor is running
     */
    isActive() {
        return this.isRunning;
    }
}
/**
 * Create a request interceptor for an iframe element
 */
export function createIframeInterceptor(iframe, options = {}) {
    if (!iframe.contentDocument) {
        console.error('[Interceptor] Cannot access iframe content document');
        return null;
    }
    return new RequestInterceptor(iframe.contentDocument, options);
}
//# sourceMappingURL=interceptor.js.map