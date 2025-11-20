import type { HttpHeaders } from '../types/http.js';

/**
 * Convert HTTP headers to WSGI environ format (uppercase with HTTP_ prefix)
 */
export function headersToWSGIEnviron(headers: HttpHeaders): Record<string, string> {
  const environ: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    const upperName = name.toUpperCase().replace(/-/g, '_');

    // Special handling for Content-Type and Content-Length
    if (upperName === 'CONTENT_TYPE' || upperName === 'CONTENT_LENGTH') {
      environ[upperName] = value;
    } else {
      // Other headers get HTTP_ prefix
      environ[`HTTP_${upperName}`] = value;
    }
  }

  return environ;
}

/**
 * Convert HTTP headers to ASGI format (lowercase bytes tuples)
 */
export function headersToASGI(headers: HttpHeaders): Array<[Uint8Array, Uint8Array]> {
  const encoder = new TextEncoder();
  const asgiHeaders: Array<[Uint8Array, Uint8Array]> = [];

  for (const [name, value] of Object.entries(headers)) {
    asgiHeaders.push([encoder.encode(name.toLowerCase()), encoder.encode(value)]);
  }

  return asgiHeaders;
}

/**
 * Parse WSGI response headers from Python list of tuples
 */
export function parseWSGIHeaders(
  pyHeaders: Array<[string, string]>
): { headers: HttpHeaders; cookies: Array<[string, string]> } {
  const headers: HttpHeaders = {};
  const cookies: Array<[string, string]> = [];

  for (const [name, value] of pyHeaders) {
    const lowerName = name.toLowerCase();

    if (lowerName === 'set-cookie') {
      // Collect all Set-Cookie headers separately
      cookies.push([name, value]);
    } else {
      // Other headers - last one wins if duplicated
      headers[name] = value;
    }
  }

  return { headers, cookies };
}

/**
 * Parse ASGI response headers from Python list of bytes tuples
 */
export function parseASGIHeaders(
  pyHeaders: Array<[Uint8Array, Uint8Array]>
): { headers: HttpHeaders; cookies: Array<[string, string]> } {
  const decoder = new TextDecoder();
  const headers: HttpHeaders = {};
  const cookies: Array<[string, string]> = [];

  for (const [nameBytes, valueBytes] of pyHeaders) {
    const name = decoder.decode(nameBytes);
    const value = decoder.decode(valueBytes);
    const lowerName = name.toLowerCase();

    if (lowerName === 'set-cookie') {
      cookies.push([name, value]);
    } else {
      headers[name] = value;
    }
  }

  return { headers, cookies };
}

/**
 * Parse HTTP status line (e.g., "200 OK")
 */
export function parseStatus(statusLine: string): { code: number; text: string } {
  const parts = statusLine.split(' ', 2);
  const code = parseInt(parts[0], 10);
  const text = parts[1] || '';

  return { code, text };
}
