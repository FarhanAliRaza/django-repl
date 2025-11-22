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

    # Clear Python module cache so Django detects model changes
    import gc
    import importlib
    from django.apps import apps

    # Get app configs before clearing
    custom_apps = [app for app in apps.get_app_configs() if not app.name.startswith('django.')]

    # CRITICAL: Clear models from the global all_models registry
    # NOTE: app_config.models is a PROPERTY that reads from all_models,
    # so we should NOT set it directly - only clear all_models!
    for app_config in custom_apps:
        app_label = app_config.label

        # Clear from apps.all_models global registry
        if app_label in apps.all_models:
            apps.all_models[app_label] = {}

    # ONLY remove the models.py module, NOT the entire app package!
    for app_config in custom_apps:
        models_module_name = f"{app_config.name}.models"
        if models_module_name in sys.modules:
            del sys.modules[models_module_name]

    # Force garbage collection
    gc.collect()

    # Invalidate import caches to ensure fresh file reads
    importlib.invalidate_caches()

    # Re-import models to trigger fresh registration
    for app_config in custom_apps:
        try:
            models_module_name = f"{app_config.name}.models"

            # Import and reload the models module
            models_module = importlib.import_module(models_module_name)
            importlib.reload(models_module)

        except Exception as e:
            print(f"Error reloading {app_config.name}: {e}")
            import traceback
            traceback.print_exc()

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
