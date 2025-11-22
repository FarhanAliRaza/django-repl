import { log } from './logger';
import { getPyodide } from './pyodide-manager';

/**
 * Process HTML to inline all static file references
 * Finds <link> and <script> tags pointing to /static/* and replaces them with inline content
 */
export async function inlineStaticFiles(html: string): Promise<string> {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized, skipping static file inlining', 'warning');
		return html;
	}

	// Extract all stylesheet links
	const linkRegex = /<link\s+[^>]*href=["']([^"']*\/static\/[^"']*)["'][^>]*>/gi;
	const scriptRegex = /<script\s+[^>]*src=["']([^"']*\/static\/[^"']*)["'][^>]*><\/script>/gi;

	const staticFileUrls = new Set<string>();

	// Find all static file URLs
	let match;
	while ((match = linkRegex.exec(html)) !== null) {
		staticFileUrls.add(match[1]);
	}
	while ((match = scriptRegex.exec(html)) !== null) {
		staticFileUrls.add(match[1]);
	}

	if (staticFileUrls.size === 0) {
		return html; // No static files to inline
	}

	log(`Found ${staticFileUrls.size} static files to inline`, 'info');
	const startFetch = performance.now();

	// Fetch all static files in one batch Python call (much faster than sequential WSGI requests)
	const staticFiles = await fetchStaticFilesBatch(Array.from(staticFileUrls));

	const fetchTime = ((performance.now() - startFetch) / 1000).toFixed(2);
	log(`Static file fetch took ${fetchTime}s`, 'info');

	// Replace <link> tags with inline <style>
	html = html.replace(linkRegex, (fullMatch, url) => {
		const file = staticFiles.get(url);
		if (file && file.contentType.includes('css')) {
			return `<style data-original-href="${url}">\n${file.content}\n</style>`;
		}
		return fullMatch; // Keep original if fetch failed
	});

	// Replace <script src="..."> with inline <script>
	html = html.replace(scriptRegex, (fullMatch, url) => {
		const file = staticFiles.get(url);
		if (file && file.contentType.includes('javascript')) {
			return `<script data-original-src="${url}">\n${file.content}\n</script>`;
		}
		return fullMatch; // Keep original if fetch failed
	});

	log(`Inlined ${staticFiles.size} static files successfully`, 'success');
	return html;
}

/**
 * Fetch all static files in one batch Python call (much faster than sequential WSGI requests)
 */
async function fetchStaticFilesBatch(
	urls: string[]
): Promise<Map<string, { content: string; contentType: string }>> {
	const pyodide = getPyodide();
	if (!pyodide || urls.length === 0) {
		return new Map();
	}

	try {
		// Send all URLs to Python and fetch them using Django's staticfiles finders
		const urlsJson = JSON.stringify(urls);
		const resultJson = await pyodide.runPythonAsync(`
import json
from django.contrib.staticfiles import finders
from django.conf import settings

urls = json.loads('${urlsJson.replace(/'/g, "\\'")}')
results = {}

for url in urls:
    # Remove '/static/' prefix to get the relative path
    clean_path = url
    if clean_path.startswith('/static/'):
        clean_path = clean_path.replace('/static/', '', 1)
    elif clean_path.startswith('static/'):
        clean_path = clean_path.replace('static/', '', 1)

    # Find the absolute path on the virtual filesystem
    abs_path = finders.find(clean_path)

    if abs_path:
        try:
            # Read file directly from virtual filesystem
            with open(abs_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Determine content type
            content_type = 'text/plain'
            if url.endswith('.css'):
                content_type = 'text/css'
            elif url.endswith('.js'):
                content_type = 'application/javascript'
            elif url.endswith('.json'):
                content_type = 'application/json'

            results[url] = {
                'content': content,
                'contentType': content_type
            }
        except Exception as e:
            # File not readable, skip it
            pass

json.dumps(results)
		`);

		// Parse JSON result and convert to Map
		const resultsObj = JSON.parse(resultJson);
		const resultsMap = new Map<string, { content: string; contentType: string }>();

		for (const [url, fileData] of Object.entries(resultsObj)) {
			resultsMap.set(url, fileData as { content: string; contentType: string });
		}

		log(`Fetched ${resultsMap.size} static files in batch`, 'success');
		return resultsMap;
	} catch (error) {
		log(`Error fetching static files in batch: ${error}`, 'error');
		return new Map();
	}
}
