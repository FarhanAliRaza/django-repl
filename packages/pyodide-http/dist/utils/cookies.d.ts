import type { Cookies, CookieOptions } from '../types/http.js';
/**
 * Parse a Cookie header string into an object
 */
export declare function parseCookies(cookieHeader: string): Cookies;
/**
 * Parse a Set-Cookie header into cookie name, value, and options
 */
export declare function parseSetCookie(setCookieHeader: string): {
    name: string;
    value: string;
    options: CookieOptions;
} | null;
/**
 * Serialize a cookie to a Set-Cookie header string
 */
export declare function serializeCookie(name: string, value: string, options?: CookieOptions): string;
/**
 * Cookie jar for managing cookies across requests
 */
export declare class CookieJar {
    private cookies;
    private storage?;
    private storageKey;
    constructor(storageKey?: string, storage?: Storage);
    /**
     * Set a cookie
     */
    set(name: string, value: string, options?: CookieOptions): void;
    /**
     * Get a cookie value
     */
    get(name: string): string | undefined;
    /**
     * Delete a cookie
     */
    delete(name: string): void;
    /**
     * Get all cookies as an object
     */
    getAll(): Cookies;
    /**
     * Get cookies as a Cookie header string
     */
    getCookieHeader(): string;
    /**
     * Process Set-Cookie headers from a response
     */
    processSetCookieHeaders(headers: Array<[string, string]>): void;
    /**
     * Clear all cookies
     */
    clear(): void;
    /**
     * Save cookies to storage
     */
    private save;
    /**
     * Load cookies from storage
     */
    private load;
}
//# sourceMappingURL=cookies.d.ts.map