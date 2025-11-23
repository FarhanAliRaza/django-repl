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

# Disable bytecode to always read fresh .py files
sys.dont_write_bytecode = True

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

    # Django's makemigrations command automatically reads model files from disk
    # No need to manually reload modules - the files were already written to the virtual FS
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

		// Read back generated migration files from Pyodide filesystem
		const migrationFiles: Record<string, string> = {};
		const migrationResult = await pyodide.runPythonAsync(`
import os
import json

migration_files = {}

# Scan all app migration directories
for app in ['myapp']:  # Add more apps as needed
    migrations_dir = os.path.join(app, 'migrations')
    if os.path.exists(migrations_dir):
        for filename in os.listdir(migrations_dir):
            # Include all .py files (including __init__.py)
            if filename.endswith('.py'):
                filepath = os.path.join(migrations_dir, filename)
                with open(filepath, 'r') as f:
                    content = f.read()
                    file_path_key = filepath
                    migration_files[file_path_key] = content

json.dumps(migration_files)
		`);

		const migrationsJson = migrationResult.toString();
		const parsedMigrations = JSON.parse(migrationsJson);
		Object.assign(migrationFiles, parsedMigrations);

		log('Migrations created successfully', 'success');
		if (Object.keys(migrationFiles).length > 0) {
			log(`Created ${Object.keys(migrationFiles).length} migration file(s)`, 'info');
			// Log the actual file paths
			for (const path of Object.keys(migrationFiles)) {
				log(`Migration file: ${path}`, 'info');
			}
		}

		return {
			success: true,
			output: stdout,
			logs: getLogs(),
			html: undefined,
			migrationFiles // Return the migration files to be added to workspace
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
