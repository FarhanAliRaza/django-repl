import type { WorkerRequest, WorkerResponse, LogEntry } from '$lib/types';

let pyodide: any = null;
let djangoInstalled = false;

const logs: LogEntry[] = [];

function log(message: string, type: LogEntry['type'] = 'info') {
	const entry: LogEntry = {
		timestamp: Date.now(),
		type,
		message
	};
	logs.push(entry);
	self.postMessage({
		type: 'log',
		payload: entry
	} as WorkerResponse);
}

async function initializePyodide() {
	try {
		log('Loading Pyodide...', 'info');

		// Load Pyodide dynamically using import for ES modules
		const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs');

		pyodide = await pyodideModule.loadPyodide({
			indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
		});

		log('Pyodide loaded successfully', 'success');

		// Load micropip for package installation
		await pyodide.loadPackage('micropip');
		log('Micropip loaded', 'success');

		return true;
	} catch (error) {
		log(`Failed to initialize Pyodide: ${error}`, 'error');
		return false;
	}
}

async function installDjango() {
	if (djangoInstalled) {
		log('Django already installed', 'info');
		return true;
	}

	try {
		log('Installing Django...', 'info');
		const micropip = pyodide.pyimport('micropip');

		// Install Django
		await micropip.install('django');

		// Load sqlite3 package
		log('Loading SQLite3...', 'info');
		await pyodide.loadPackage('sqlite3');

		// Load tzdata package for timezone support
		log('Loading tzdata...', 'info');
		await pyodide.loadPackage('tzdata');

		djangoInstalled = true;
		log('Django installed successfully', 'success');
		return true;
	} catch (error) {
		log(`Failed to install Django: ${error}`, 'error');
		return false;
	}
}

async function writeFilesToVirtualFS(files: Record<string, string>) {
	try {
		log(`Writing ${Object.keys(files).length} files to virtual filesystem...`, 'info');

		for (const [filepath, content] of Object.entries(files)) {
			// Create directory structure if needed
			const parts = filepath.split('/');
			let currentPath = '';

			for (let i = 0; i < parts.length - 1; i++) {
				currentPath += (i > 0 ? '/' : '') + parts[i];
				try {
					pyodide.FS.mkdir(currentPath);
				} catch (e) {
					// Directory might already exist, that's fine
				}
			}

			// Write the file
			pyodide.FS.writeFile(filepath, content);
		}

		log('Files written successfully', 'success');
		return true;
	} catch (error) {
		log(`Failed to write files: ${error}`, 'error');
		return false;
	}
}

async function executePython(code: string) {
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
			logs: [...logs]
		};
	} catch (error) {
		log(`Execution error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: [...logs]
		};
	}
}

async function executeDjangoView(
	files: Record<string, string>,
	viewPath: string = '/',
	skipFileWrite: boolean = false
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

		// Execute Django and get HTML output
		const result = await pyodide.runPythonAsync(`
import sys
import os
from io import StringIO

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
    'status': None
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
                'django.contrib.contenttypes',
                'django.contrib.auth',
            ],
            MIDDLEWARE=[],
            DATABASES={
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': ':memory:',
                }
            },
            TEMPLATES=[{
                'BACKEND': 'django.template.backends.django.DjangoTemplates',
                'DIRS': [os.path.join(BASE_DIR, 'templates')],
                'APP_DIRS': False,
                'OPTIONS': {},
            }],
        )
        django.setup()

    # Create WSGI environ
    environ = {
        'REQUEST_METHOD': 'GET',
        'PATH_INFO': '${viewPath}',
        'QUERY_STRING': '',
        'SERVER_NAME': 'localhost',
        'SERVER_PORT': '8000',
        'SERVER_PROTOCOL': 'HTTP/1.1',
        'wsgi.version': (1, 0),
        'wsgi.url_scheme': 'http',
        'wsgi.input': StringIO(''),
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

    def start_response(status, headers):
        response_data['status'] = status
        response_data['headers'] = headers
        return lambda data: response_data['body'].append(data)

    result = handler(environ, start_response)
    for chunk in result:
        if chunk:
            response_data['body'].append(chunk)

    # Get the HTML
    html_bytes = b''.join(response_data['body'])
    output['html'] = html_bytes.decode('utf-8')
    output['status'] = response_data['status']

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

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const { type, payload } = event.data;

	switch (type) {
		case 'init':
			{
				const success = await initializePyodide();
				if (success) {
					await installDjango();
					self.postMessage({
						type: 'ready',
						payload: { success: true }
					} as WorkerResponse);
				} else {
					self.postMessage({
						type: 'ready',
						payload: { success: false }
					} as WorkerResponse);
				}
			}
			break;

		case 'installPackage':
			{
				if (payload?.package) {
					try {
						const micropip = pyodide.pyimport('micropip');
						await micropip.install(payload.package);
						log(`Package ${payload.package} installed`, 'success');
						self.postMessage({
							type: 'result',
							payload: {
								success: true,
								output: `Package ${payload.package} installed successfully`,
								logs: [...logs]
							}
						} as WorkerResponse);
					} catch (error) {
						log(`Failed to install ${payload.package}: ${error}`, 'error');
						self.postMessage({
							type: 'error',
							payload: {
								message: `Failed to install ${payload.package}`
							}
						} as WorkerResponse);
					}
				}
			}
			break;

		case 'execute':
			{
				if (payload?.files) {
					// Execute Django project with optional path
					const path = payload.path || '/';
					const skipFileWrite = payload.skipFileWrite || false;
					const result = await executeDjangoView(payload.files, path, skipFileWrite);
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

		case 'writeFiles':
			{
				if (payload?.files) {
					const success = await writeFilesToVirtualFS(payload.files);
					self.postMessage({
						type: 'result',
						payload: {
							success,
							output: success ? 'Files written successfully' : 'Failed to write files',
							logs: [...logs]
						}
					} as WorkerResponse);
				}
			}
			break;
	}
};
