import type { Cookies, CookieOptions } from '../types/http.js';

/**
 * Parse a Cookie header string into an object
 */
export function parseCookies(cookieHeader: string): Cookies {
  const cookies: Cookies = {};

  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // Handle values with = in them
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  }

  return cookies;
}

/**
 * Parse a Set-Cookie header into cookie name, value, and options
 */
export function parseSetCookie(setCookieHeader: string): {
  name: string;
  value: string;
  options: CookieOptions;
} | null {
  const parts = setCookieHeader.split(';');
  if (parts.length === 0) return null;

  const [nameValue] = parts;
  const [name, ...valueParts] = nameValue.split('=');
  const value = valueParts.join('=');

  if (!name || value === undefined) return null;

  const options: CookieOptions = {};

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    const [key, val] = part.split('=');
    const lowerKey = key.toLowerCase();

    switch (lowerKey) {
      case 'path':
        options.path = val;
        break;
      case 'domain':
        options.domain = val;
        break;
      case 'expires':
        options.expires = new Date(val);
        break;
      case 'max-age':
        options.maxAge = parseInt(val, 10);
        break;
      case 'secure':
        options.secure = true;
        break;
      case 'httponly':
        options.httpOnly = true;
        break;
      case 'samesite':
        options.sameSite = val as 'Strict' | 'Lax' | 'None';
        break;
    }
  }

  return {
    name: name.trim(),
    value: decodeURIComponent(value.trim()),
    options
  };
}

/**
 * Serialize a cookie to a Set-Cookie header string
 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.path) {
    cookie += `; Path=${options.path}`;
  }

  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }

  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }

  if (options.secure) {
    cookie += '; Secure';
  }

  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }

  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite}`;
  }

  return cookie;
}

/**
 * Cookie jar for managing cookies across requests
 */
export class CookieJar {
  private cookies: Map<string, { value: string; options: CookieOptions }>;
  private storage?: Storage;
  private storageKey: string;

  constructor(storageKey: string = 'pyodide-http-cookies', storage?: Storage) {
    this.cookies = new Map();
    this.storage = storage;
    this.storageKey = storageKey;
    this.load();
  }

  /**
   * Set a cookie
   */
  set(name: string, value: string, options: CookieOptions = {}): void {
    this.cookies.set(name, { value, options });
    this.save();
  }

  /**
   * Get a cookie value
   */
  get(name: string): string | undefined {
    const cookie = this.cookies.get(name);

    // Check if cookie is expired
    if (cookie?.options.expires && cookie.options.expires < new Date()) {
      this.cookies.delete(name);
      this.save();
      return undefined;
    }

    return cookie?.value;
  }

  /**
   * Delete a cookie
   */
  delete(name: string): void {
    this.cookies.delete(name);
    this.save();
  }

  /**
   * Get all cookies as an object
   */
  getAll(): Cookies {
    const result: Cookies = {};
    const now = new Date();

    for (const [name, { value, options }] of this.cookies.entries()) {
      // Skip expired cookies
      if (options.expires && options.expires < now) {
        this.cookies.delete(name);
        continue;
      }
      result[name] = value;
    }

    this.save();
    return result;
  }

  /**
   * Get cookies as a Cookie header string
   */
  getCookieHeader(): string {
    const cookies = this.getAll();
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  /**
   * Process Set-Cookie headers from a response
   */
  processSetCookieHeaders(headers: Array<[string, string]>): void {
    for (const [name, value] of headers) {
      if (name.toLowerCase() === 'set-cookie') {
        const parsed = parseSetCookie(value);
        if (parsed) {
          // Handle cookie deletion (Max-Age=0 or Expires in past)
          if (
            parsed.options.maxAge === 0 ||
            (parsed.options.expires && parsed.options.expires < new Date())
          ) {
            this.delete(parsed.name);
          } else {
            this.set(parsed.name, parsed.value, parsed.options);
          }
        }
      }
    }
  }

  /**
   * Clear all cookies
   */
  clear(): void {
    this.cookies.clear();
    this.save();
  }

  /**
   * Save cookies to storage
   */
  private save(): void {
    if (!this.storage) return;

    const data = Array.from(this.cookies.entries()).map(([name, { value, options }]) => ({
      name,
      value,
      options
    }));

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save cookies to storage:', e);
    }
  }

  /**
   * Load cookies from storage
   */
  private load(): void {
    if (!this.storage) return;

    try {
      const data = this.storage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        for (const { name, value, options } of parsed) {
          // Convert expires string back to Date
          if (options.expires) {
            options.expires = new Date(options.expires);
          }
          this.cookies.set(name, { value, options });
        }
      }
    } catch (e) {
      console.warn('Failed to load cookies from storage:', e);
    }
  }
}
