/**
 * Convert request body to string format suitable for WSGI/ASGI
 */
export async function serializeBody(body, contentType) {
    if (!body) {
        return { content: '', type: '', length: 0 };
    }
    // Already a string
    if (typeof body === 'string') {
        return {
            content: body,
            type: contentType || 'text/plain',
            length: new TextEncoder().encode(body).length
        };
    }
    // FormData - convert to URL-encoded or multipart
    if (body instanceof FormData) {
        // For simplicity, convert to URL-encoded (most common for Django)
        // TODO: Support multipart/form-data for file uploads
        const params = new URLSearchParams();
        // FormData.forEach is more widely supported in TypeScript
        body.forEach((value, key) => {
            if (typeof value === 'string') {
                params.append(key, value);
            }
            else {
                // File - for now just include filename
                params.append(key, value.name || '[File]');
            }
        });
        const encoded = params.toString();
        return {
            content: encoded,
            type: 'application/x-www-form-urlencoded',
            length: new TextEncoder().encode(encoded).length
        };
    }
    // Plain object - convert to JSON or URL-encoded based on content type
    if (typeof body === 'object') {
        if (contentType?.includes('application/json')) {
            const json = JSON.stringify(body);
            return {
                content: json,
                type: 'application/json',
                length: new TextEncoder().encode(json).length
            };
        }
        else {
            // Default to URL-encoded for objects
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(body)) {
                params.append(key, String(value));
            }
            const encoded = params.toString();
            return {
                content: encoded,
                type: 'application/x-www-form-urlencoded',
                length: new TextEncoder().encode(encoded).length
            };
        }
    }
    return { content: '', type: '', length: 0 };
}
/**
 * Parse query string into object
 */
export function parseQueryString(query) {
    const params = {};
    if (!query)
        return params;
    // Remove leading ? if present
    const cleanQuery = query.startsWith('?') ? query.slice(1) : query;
    const pairs = cleanQuery.split('&');
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
        }
    }
    return params;
}
//# sourceMappingURL=body.js.map