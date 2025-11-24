/**
 * Share utilities for compressing and encoding Django project files
 * Based on Svelte REPL's approach: gzip + base64-URL-safe encoding
 */

/**
 * Compress and encode text for URL sharing
 * Uses gzip compression and base64 URL-safe encoding
 */
export async function compressAndEncode(input: string): Promise<string> {
	try {
		// Convert string to stream and compress with gzip
		const reader = new Blob([input])
			.stream()
			.pipeThrough(new CompressionStream('gzip'))
			.getReader();

		let buffer = '';

		// Read compressed data
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				reader.releaseLock();
				// Convert to base64 and make URL-safe
				// Replace + with -, / with _, and strip trailing =
				return btoa(buffer).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
			} else {
				// Append bytes to buffer as string
				for (let i = 0; i < value.length; i++) {
					buffer += String.fromCharCode(value[i]);
				}
			}
		}
	} catch (error) {
		console.error('Failed to compress and encode:', error);
		throw new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Decode and decompress text from URL hash
 * Reverses the URL-safe base64 encoding and gzip decompression
 */
export async function decodeAndDecompress(input: string): Promise<string> {
	try {
		// Reverse URL-safe encoding: - to +, _ to /
		const base64 = input.replaceAll('-', '+').replaceAll('_', '/');

		// Decode base64 to binary string
		const decoded = atob(base64);

		// Convert binary string to Uint8Array
		const u8 = new Uint8Array(decoded.length);
		for (let i = 0; i < decoded.length; i++) {
			u8[i] = decoded.charCodeAt(i);
		}

		// Decompress gzip
		const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));

		// Read decompressed text
		return await new Response(stream).text();
	} catch (error) {
		console.error('Failed to decode and decompress:', error);
		throw new Error(
			`Decompression failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Generate a shareable URL from project data
 */
export async function generateShareableUrl(
	projectName: string,
	files: Record<string, string>
): Promise<string> {
	const data = JSON.stringify({ name: projectName, files });
	const encoded = await compressAndEncode(data);

	// Return URL with hash
	return `${window.location.origin}${window.location.pathname}#${encoded}`;
}

/**
 * Parse shareable URL and extract project data
 */
export async function parseShareableUrl(
	hash: string
): Promise<{ name: string; files: Record<string, string> }> {
	// Remove leading # if present
	const encoded = hash.startsWith('#') ? hash.slice(1) : hash;

	if (!encoded) {
		throw new Error('No share data found in URL');
	}

	// Decode and parse
	const json = await decodeAndDecompress(encoded);
	const data = JSON.parse(json);

	// Validate structure
	if (!data.name || typeof data.name !== 'string') {
		throw new Error('Invalid share data: missing project name');
	}

	if (!data.files || typeof data.files !== 'object') {
		throw new Error('Invalid share data: missing files');
	}

	return data;
}

/**
 * Estimate the URL length for a given project
 * Useful for warning users about long URLs
 */
export async function estimateUrlLength(
	projectName: string,
	files: Record<string, string>
): Promise<number> {
	const url = await generateShareableUrl(projectName, files);
	return url.length;
}

/**
 * Check if URL is within safe limits (most browsers support ~2000 chars comfortably)
 */
export function isUrlSafe(urlLength: number): boolean {
	return urlLength < 2000;
}
