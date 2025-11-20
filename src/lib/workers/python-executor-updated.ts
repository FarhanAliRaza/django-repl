// This file contains the updated executeDjangoView function
// To be copied into python-executor.ts

async function executeDjangoView(
	files: Record<string, string>,
	viewPath: string = '/',
	skipFileWrite: boolean = false,
	method: string = 'GET',
	headers: Record<string, string> = {},
	body: string | Record<string, any> = '',
	cookies: Record<string, string> = {}
) {
	try {
		if (!skipFileWrite) {
			// Only rewrite files and clear caches on full refresh
			log('Setting up Django environment...', 'info');
			log(`Received ${Object.keys(files).length} files to execute`, 'info');

			// Write files to virtual FS
			await writeFilesToVirtualFS(files);

			log('Clearing Python module cache and Django caches...', 'info');

			// Clear the module cache to reload updated files
			await pyodide.runPythonAsync(`
import sys
import gc

# Remove all our modules from cache so they get reloaded
modules_to_remove = [key for key in sys.modules.keys() if key.startswith('myapp') or key.startswith('myproject') or key == 'urls']
for module in modules_to_remove:
    del sys.modules[module]

# Force garbage collection to clear any cached references
gc.collect()

# Clear Django's URL resolver cache
try:
    from django.urls import clear_url_caches
    clear_url_caches()
except:
    pass

# Clear Django's template cache - force complete reset
try:
    from django.template import engines

    # Completely reset template engines to force reload from filesystem
    engines._engines = {}
except Exception as e:
    pass


		`);
		} else {
			// Navigation only - just log the path change
			log(`Navigating to ${viewPath}`, 'info');
		}

		log('Executing Django WSGI handler...', 'info');

		// Serialize body
		const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body || '');
		const bodyBytes = new TextEncoder().encode(bodyStr);
		const contentLength = bodyBytes.length;
		const contentType = headers['Content-Type'] || headers['content-type'] ||
			(method === 'POST' ? 'application/x-www-form-urlencoded' : '');

		// Build cookie header
		const cookieHeader = Object.entries(cookies)
			.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
			.join('; ');

		// Build HTTP headers in WSGI format (HTTP_* prefix)
		const wsgiHeaders: Record<string, string> = {};
		for (const [name, value] of Object.entries(headers)) {
			const upperName = name.toUpperCase().replace(/-/g, '_');
			if (upperName !== 'CONTENT_TYPE' && upperName !== 'CONTENT_LENGTH') {
				wsgiHeaders[`HTTP_${upperName}`] = value;
			}
		}
		if (cookieHeader) {
			wsgiHeaders['HTTP_COOKIE'] = cookieHeader;
		}

		// Build environ dict as JSON
		const environDict = {
			'REQUEST_METHOD': method,
			'PATH_INFO': viewPath,
			'QUERY_STRING': '',
			'CONTENT_TYPE': contentType,
			'CONTENT_LENGTH': String(contentLength),
			'SERVER_NAME': 'localhost',
			'SERVER_PORT': '8000',
			'SERVER_PROTOCOL': 'HTTP/1.1',
			'SCRIPT_NAME': '',
			...wsgiHeaders
		};

		// Execute Django and get HTML output
		const result = await pyodide.runPythonAsync(`
import sys
import os
from io import StringIO, BytesIO
import json

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

    # Configure Django settings if not already configured
    if not settings.configured:
        # Get current working directory (where files are written)
        BASE_DIR = os.getcwd()

        settings.configure(
            DEBUG=True,
            SECRET_KEY='browser-django-playground-secret-key',
            ROOT_URLCONF='urls',
            ALLOWED_HOSTS=['*'],
            INSTALLED_APPS=[
                'django.contrib.admin',
                'django.contrib.contenttypes',
                'django.contrib.auth',
                'django.contrib.sessions',
                'django.contrib.messages',
            ],
            MIDDLEWARE=[
                'django.middleware.security.SecurityMiddleware',
                'django.contrib.sessions.middleware.SessionMiddleware',
                'django.middleware.common.CommonMiddleware',
                'django.middleware.csrf.CsrfViewMiddleware',
                'django.contrib.auth.middleware.AuthenticationMiddleware',
                'django.contrib.messages.middleware.MessageMiddleware',
            ],
            DATABASES={
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': ':memory:',
                }
            },
            TEMPLATES=[{
                'BACKEND': 'django.template.backends.django.DjangoTemplates',
                'DIRS': [os.path.join(BASE_DIR, 'templates')],
                'APP_DIRS': True,
                'OPTIONS': {
                    'context_processors': [
                        'django.template.context_processors.debug',
                        'django.template.context_processors.request',
                        'django.contrib.auth.context_processors.auth',
                        'django.contrib.messages.context_processors.messages',
                    ],
                },
            }],
        )
        django.setup()

    # Create WSGI environ
    environ_base = json.loads('${JSON.stringify(JSON.stringify(environDict))}')

    environ = {
        **environ_base,
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'http',
        'wsgi.input': BytesIO('${bodyStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'.encode('utf-8')),
        'wsgi.errors': sys.stderr,
        'wsgi.multithread': False,
        'wsgi.multiprocess': False,
        'wsgi.run_once': False,
    }

    # Execute WSGI handler
    handler = WSGIHandler()

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

		// Extract Set-Cookie headers
		const cookies: Array<{ name: string; value: string }> = [];
		for (const [name, value] of pyHeaders) {
			if (name.toLowerCase() === 'set-cookie') {
				// Parse cookie name/value
				const parts = value.split(';')[0].split('=');
				if (parts.length >= 2) {
					cookies.push({ name: parts[0].trim(), value: parts.slice(1).join('=').trim() });
				}
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
				logs: [...logs]
			};
		}

		log(`Django view executed successfully (${status})`, 'success');

		return {
			success: true,
			output: stdout,
			html: html || undefined,
			cookies,
			logs: [...logs]
		};
	} catch (error) {
		log(`Django execution error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: [...logs]
		};
	}
}

// Update the execute handler to pass new parameters
case 'execute':
	{
		if (payload?.files) {
			// Execute Django project with optional path
			const path = payload.path || '/';
			const skipFileWrite = payload.skipFileWrite || false;
			const method = payload.method || 'GET';
			const headers = payload.headers || {};
			const body = payload.body || '';
			const cookies = payload.cookies || {};

			const result = await executeDjangoView(
				payload.files,
				path,
				skipFileWrite,
				method,
				headers,
				body,
				cookies
			);
			self.postMessage({
				type: 'result',
				payload: result
			} as WorkerResponse);
		} else if (payload?.code) {
			// Execute plain Python code
			const result = await executePython(payload.code);
			self.postMessage({
				type: 'result',
				payload: result
			} as WorkerResponse);
		}
	}
	break;
