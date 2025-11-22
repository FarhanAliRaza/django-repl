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

	// Fetch all static files through Django's StaticFilesHandler
	const staticFiles = new Map<string, { content: string; contentType: string }>();

	for (const url of staticFileUrls) {
		try {
			const fileContent = await fetchStaticFileThroughDjango(url);
			if (fileContent) {
				staticFiles.set(url, fileContent);
				log(`Fetched static file: ${url}`, 'info');
			}
		} catch (error) {
			log(`Failed to fetch static file ${url}: ${error}`, 'warning');
		}
	}

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
 * Fetch a static file through Django's StaticFilesHandler
 */
async function fetchStaticFileThroughDjango(
	path: string
): Promise<{ content: string; contentType: string } | null> {
	const pyodide = getPyodide();
	if (!pyodide) {
		return null;
	}

	try {
		// Execute Django WSGI handler to get static file
		const result = await pyodide.runPythonAsync(`
import sys
import os
from io import StringIO, BytesIO

# Capture stdout and stderr
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {
    'content': None,
    'content_type': 'text/plain',
    'error': None
}

try:
    from django.conf import settings
    from django.core.handlers.wsgi import WSGIHandler
    from django.contrib.staticfiles.handlers import StaticFilesHandler

    # Force synchronous mode
    os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'

    # Create WSGI environ for static file request
    environ = {
        'REQUEST_METHOD': 'GET',
        'PATH_INFO': '${path}',
        'QUERY_STRING': '',
        'CONTENT_TYPE': '',
        'CONTENT_LENGTH': '0',
        'SERVER_NAME': 'localhost',
        'SERVER_PORT': '8000',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'SCRIPT_NAME': '',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'http',
        'wsgi.input': BytesIO(b''),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': False,
    }

    # Execute WSGI handler with static files support
    handler = StaticFilesHandler(WSGIHandler())

    response_data = {
        'status': None,
        'headers': [],
        'body': []
    }

    def start_response(status, headers, exc_info=None):
        if exc_info:
            try:
                if response_data['headers']:
                    raise exc_info[1].with_traceback(exc_info[2])
            finally:
                exc_info = None
        elif response_data['headers']:
            raise RuntimeError("Response already started")

        response_data['status'] = status
        response_data['headers'] = headers
        return lambda data: response_data['body'].append(data)

    result = handler(environ, start_response)
    try:
        for chunk in result:
            if chunk:
                response_data['body'].append(chunk)
    finally:
        if hasattr(result, 'close'):
            result.close()

    # Get the content
    content_bytes = b''.join(response_data['body'])
    output['content'] = content_bytes.decode('utf-8')

    # Extract Content-Type header
    for name, value in response_data['headers']:
        if name.lower() == 'content-type':
            output['content_type'] = value
            break

except Exception as e:
    import traceback
    output['error'] = str(e)
    output['stderr'] = traceback.format_exc()
finally:
    sys.stdout = old_stdout
    sys.stderr = old_stderr

output
		`);

		const error = result.get('error');
		if (error) {
			log(`Django error fetching ${path}: ${error}`, 'error');
			return null;
		}

		const content = result.get('content');
		const contentType = result.get('content_type') || 'text/plain';

		if (!content) {
			log(`Empty content for ${path}`, 'warning');
			return null;
		}

		return {
			content: content,
			contentType: contentType
		};
	} catch (error) {
		log(`Error fetching static file ${path}: ${error}`, 'error');
		return null;
	}
}
