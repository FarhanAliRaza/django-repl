import { log, getLogs } from '../logger';
import { getPyodide } from '../pyodide-manager';
import { writeFilesToVirtualFS } from '../filesystem';
import type { ExecutionResult } from '$lib/types';

export async function runMigrations(files: Record<string, string>): Promise<ExecutionResult> {
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
		log('Running migrations...', 'info');

		// Write files first
		await writeFilesToVirtualFS(files);

		const result = await pyodide.runPythonAsync(`
import sys
from io import StringIO
import os

# Force synchronous mode
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'

old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {'stdout': '', 'stderr': '', 'error': None}

try:
    import django
    from django.conf import settings
    from django.core.management import call_command

    if not settings.configured:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
        django.setup()

    call_command('migrate', '--run-syncdb', verbosity=2)

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

		if (stdout) log(stdout, 'info');
		if (stderr && !error) log(stderr, 'warning');

		if (error) {
			log(`Migration error: ${error}`, 'error');
			return {
				success: false,
				output: stdout,
				error: stderr || error,
				logs: getLogs()
			};
		}

		log('Migrations completed successfully', 'success');
		return {
			success: true,
			output: stdout,
			logs: getLogs(),
			html: undefined // Don't update HTML for migrations
		};
	} catch (error) {
		log(`Migration error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: getLogs()
		};
	}
}

export async function makeMigrations(files: Record<string, string>): Promise<ExecutionResult> {
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
		log('Making migrations...', 'info');

		// Write files first
		await writeFilesToVirtualFS(files);

		const result = await pyodide.runPythonAsync(`
import sys
from io import StringIO
import os

# Force synchronous mode
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'

old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {'stdout': '', 'stderr': '', 'error': None}

try:
    import django
    from django.conf import settings
    from django.core.management import call_command

    if not settings.configured:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
        django.setup()

    call_command('makemigrations', verbosity=2)

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

		if (stdout) log(stdout, 'info');
		if (stderr && !error) log(stderr, 'warning');

		if (error) {
			log(`Make migrations error: ${error}`, 'error');
			return {
				success: false,
				output: stdout,
				error: stderr || error,
				logs: getLogs()
			};
		}

		log('Migrations created successfully', 'success');
		return {
			success: true,
			output: stdout,
			logs: getLogs(),
			html: undefined // Don't update HTML for migrations
		};
	} catch (error) {
		log(`Make migrations error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: getLogs()
		};
	}
}

export async function createSuperuser(
	files: Record<string, string>,
	username: string,
	email: string,
	password: string
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
		log(`Creating superuser ${username}...`, 'info');

		// Write files first
		await writeFilesToVirtualFS(files);

		const result = await pyodide.runPythonAsync(`
import sys
from io import StringIO
import os

# Force synchronous mode
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'

old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()

output = {'stdout': '', 'stderr': '', 'error': None}

try:
    import django
    from django.conf import settings
    from django.contrib.auth import get_user_model

    if not settings.configured:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
        django.setup()

        # Run migrations first
        from django.core.management import call_command
        call_command('migrate', '--run-syncdb', verbosity=0)

    User = get_user_model()
    if User.objects.filter(username='${username}').exists():
        print(f"User ${username} already exists")
    else:
        User.objects.create_superuser('${username}', '${email}', '${password}')
        print(f"Superuser ${username} created successfully")

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

		if (stdout) log(stdout, 'info');
		if (stderr && !error) log(stderr, 'warning');

		if (error) {
			log(`Superuser creation error: ${error}`, 'error');
			return {
				success: false,
				output: stdout,
				error: stderr || error,
				logs: getLogs()
			};
		}

		// Log credentials for user convenience
		log(`Username: ${username}`, 'success');
		log(`Password: ${password}`, 'success');

		return {
			success: true,
			output: stdout,
			logs: getLogs(),
			html: undefined // Don't update HTML for superuser creation
		};
	} catch (error) {
		log(`Superuser creation error: ${error}`, 'error');
		return {
			success: false,
			output: '',
			error: String(error),
			logs: getLogs()
		};
	}
}
