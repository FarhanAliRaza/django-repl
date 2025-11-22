import { log, getLogs } from '../logger';
import { getPyodide } from '../pyodide-manager';
import { writeFilesToVirtualFS } from '../filesystem';
import { inlineStaticFiles } from '../static-file-processor';
import type { ExecutionResult } from '$lib/types';

export async function executePython(code: string): Promise<ExecutionResult> {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized', 'error');
		return {
			success: false,
			output: '',
			error: 'Pyodide not initialized',
			logs: getLogs()
		};
	}

	try {
		log('Executing Python code...', 'info');

		// Capture stdout and stderr
		const result = await pyodide.runPythonAsync(`
import sys
from io import StringIO

# Capture stdout and stderr
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {'stdout': '', 'stderr': '', 'error': None, 'result': None}

try:
    # Execute the code
    ${code}
    output['result'] = 'Success'
except Exception as e:
    import traceback
    output['error'] = str(e)
    output['stderr'] = traceback.format_exc()
finally:
    # Get the captured output
    output['stdout'] = sys.stdout.getvalue()
    output['stderr'] = sys.stderr.getvalue()

    # Restore stdout and stderr
    sys.stdout = old_stdout
    sys.stderr = old_stderr

output
		`);

		return {
			success: !result.get('error'),
			output: result.get('stdout') || '',
			error: result.get('error') || result.get('stderr') || undefined,
			logs: getLogs()
		};
	} catch (error) {
		log(`Execution error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: getLogs()
		};
	}
}

export async function executeDjangoView(
	files: Record<string, string>,
	viewPath: string = '/',
	skipFileWrite: boolean = false,
	method: string = 'GET',
	headers: Record<string, string> = {},
	body: string | Record<string, any> = '',
	cookies: Record<string, string> = {},
	isStaticFileRequest: boolean = false
): Promise<ExecutionResult> {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized', 'error');
		return {
			success: false,
			output: '',
			error: 'Pyodide not initialized',
			logs: getLogs()
		};
	}

	try {
		if (!skipFileWrite) {
			// Only rewrite files on full refresh
			log('Setting up Django environment...', 'info');
			log(`Received ${Object.keys(files).length} files to execute`, 'info');

			// Write files to virtual FS
			await writeFilesToVirtualFS(files);
		} else {
			// Navigation only - just log the path change
			log(`Navigating to ${viewPath}`, 'info');
		}

		log('Executing Django WSGI handler...', 'info');

		// Serialize body to string
		const bodyStr =
			typeof body === 'object'
				? new URLSearchParams(body as Record<string, string>).toString()
				: String(body || '');
		const contentLength = new TextEncoder().encode(bodyStr).length;
		const contentType =
			headers['Content-Type'] ||
			headers['content-type'] ||
			(method === 'POST' ? 'application/x-www-form-urlencoded' : '');

		// Build cookie header from cookies object
		const cookieHeader = Object.entries(cookies)
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');

		// Parse path and query string from viewPath
		const [pathOnly, queryString] = viewPath.includes('?')
			? viewPath.split('?', 2)
			: [viewPath, ''];

		// Execute Django and get HTML output
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
    'stdout': '',
    'stderr': '',
    'error': None,
    'html': None,
    'status': None,
    'headers': []
}

try:
    # Import Django
    import django
    from django.conf import settings
    from django.core.handlers.wsgi import WSGIHandler
    from django.contrib.staticfiles.handlers import StaticFilesHandler
    import os

    # Force synchronous mode for Django ORM operations
    os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'

    # Configure Django settings if not already configured
    if not settings.configured:
        # Use the actual settings file from the project
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
        django.setup()

        # Auto-run migrations on first setup to create necessary tables
        from django.core.management import call_command
        call_command('migrate', '--run-syncdb', verbosity=0)

    # Create WSGI environ
    environ = {
        'REQUEST_METHOD': '${method}',
        'PATH_INFO': '${pathOnly}',
        'QUERY_STRING': '${queryString}',
        'CONTENT_TYPE': '${contentType}',
        'CONTENT_LENGTH': '${contentLength}',
        'SERVER_NAME': 'localhost',
        'SERVER_PORT': '8000',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'SCRIPT_NAME': '',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'http',
        'wsgi.input': BytesIO('''${bodyStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'''.encode('utf-8')),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': False,
        ${cookieHeader ? `'HTTP_COOKIE': '${cookieHeader.replace(/'/g, "\\'")}',` : ''}
    }

    # Execute WSGI handler with static files support
    # StaticFilesHandler wraps WSGIHandler to serve static files in development
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

    # Get the HTML
    html_bytes = b''.join(response_data['body'])
    output['html'] = html_bytes.decode('utf-8')
    output['status'] = response_data['status']
    output['headers'] = response_data['headers']

except Exception as e:
    import traceback
    output['error'] = str(e)
    output['stderr'] = traceback.format_exc()
finally:
    output['stdout'] = sys.stdout.getvalue()
    output['stderr'] = sys.stderr.getvalue()

    sys.stdout = old_stdout
    sys.stderr = old_stderr

output
		`);

		const stdout = result.get('stdout') || '';
		const stderr = result.get('stderr') || '';
		const error = result.get('error');
		const html = result.get('html');
		const status = result.get('status');
		const pyHeaders = result.toJs().get('headers') || [];

		// Extract Set-Cookie headers, Location header (for redirects), and Content-Type
		const cookiesToSet: Array<{ name: string; value: string }> = [];
		let redirectLocation: string | undefined;
		let responseContentType: string | undefined;

		for (const [name, value] of pyHeaders) {
			if (name.toLowerCase() === 'set-cookie') {
				// Parse cookie name/value from Set-Cookie header
				const parts = value.split(';')[0].split('=');
				if (parts.length >= 2) {
					cookiesToSet.push({
						name: parts[0].trim(),
						value: parts.slice(1).join('=').trim()
					});
				}
			} else if (name.toLowerCase() === 'location') {
				redirectLocation = value;
			} else if (name.toLowerCase() === 'content-type') {
				responseContentType = value;
			}
		}

		if (stdout) log(stdout, 'info');
		if (stderr && !error) log(stderr, 'warning');

		if (error) {
			log(`Django execution error: ${error}`, 'error');
			return {
				success: false,
				output: stdout,
				error: stderr || error,
				logs: getLogs()
			};
		}

		log(`Django view executed successfully (${status})`, 'success');

		// If this is a static file request, return it with appropriate metadata
		if (isStaticFileRequest) {
			return {
				success: true,
				output: html || '', // For static files, content is in html
				isStaticFile: true,
				requestedPath: viewPath,
				contentType: responseContentType || 'text/plain',
				logs: getLogs()
			};
		}

		// Process HTML to inline static files before returning
		let processedHtml = html;
		if (html && responseContentType?.includes('text/html')) {
			log('Processing HTML to inline static files...', 'info');
			processedHtml = await inlineStaticFiles(html);
		}

		return {
			success: true,
			output: stdout,
			html: processedHtml || undefined,
			cookies: cookiesToSet,
			status: status || undefined,
			redirectTo: redirectLocation,
			logs: getLogs()
		};
	} catch (error) {
		log(`Django execution error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: getLogs()
		};
	}
}
