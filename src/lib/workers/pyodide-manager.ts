import { log } from './logger';
import { hasSnapshot, createSnapshot, restoreSnapshot } from './snapshot-manager';

let pyodide: any = null;
let djangoInstalled = false;
let isFirstLoad = true; // Will be set by the init message via setFirstLoad()
const DJANGO_VERSION = '5.0.1'; // Track Django version for snapshot versioning

console.log('[pyodide-manager] Module loaded with isFirstLoad:', isFirstLoad);

export async function initializePyodide() {
	try {
		log('Loading Pyodide...', 'info', 'django');

		// Load Pyodide dynamically using import for ES modules
		const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.mjs');

		pyodide = await pyodideModule.loadPyodide({
			indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
		});

		log('Pyodide loaded successfully', 'success', 'django');

		// Load micropip for package installation
		await pyodide.loadPackage('micropip');
		log('Micropip loaded', 'success', 'django');

		return true;
	} catch (error) {
		log(`Failed to initialize Pyodide: ${error}`, 'error', 'django');
		return false;
	}
}

export function setFirstLoad(value: boolean) {
	console.log('[pyodide-manager] setFirstLoad called with:', value, 'current value:', isFirstLoad);
	isFirstLoad = value;
	console.log('[pyodide-manager] isFirstLoad is now:', isFirstLoad);
}

export async function installDjango() {
	if (djangoInstalled) {
		log('Django already installed', 'info', 'django');
		return true;
	}

	console.log('[pyodide-manager] installDjango called, isFirstLoad:', isFirstLoad);

	try {
		// On first page load, always install fresh from internet (don't use cache)
		if (isFirstLoad) {
			console.log('[pyodide-manager] First load detected, installing Django from internet');
			log('Installing Django...', 'info', 'django');
			isFirstLoad = false;

			const micropip = pyodide.pyimport('micropip');

			// Install Django from internet
			await micropip.install('django');

			// Load sqlite3 package
			log('Loading SQLite3...', 'info', 'django');
			await pyodide.loadPackage('sqlite3');

			// Load tzdata package for timezone support
			log('Loading tzdata...', 'info', 'django');
			await pyodide.loadPackage('tzdata');

			// Pre-import Django modules to warm up sys.modules cache
			log('Pre-importing Django modules...', 'info', 'django');
			const preImportStart = performance.now();
			await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.contrib.staticfiles.handlers import StaticFilesHandler

# Set Django environment variables (but don't call django.setup() yet)
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
			`);
			const preImportDuration = performance.now() - preImportStart;
			log(`Django modules pre-imported in ${preImportDuration.toFixed(2)}ms`, 'success', 'django');

			djangoInstalled = true;
			log('Django installed successfully', 'success', 'django');

			// Note: Snapshot creation will be triggered by message-handlers after 'ready' is sent
			// This prevents blocking the worker from becoming ready

			return true;
		}

		// On subsequent workers, try to use snapshot
		const snapshotExists = await hasSnapshot(DJANGO_VERSION);

		if (snapshotExists) {
			// Restore from snapshot (fast path)
			log('Restoring Django from cache...', 'info', 'django');
			const restored = await restoreSnapshot(pyodide, DJANGO_VERSION);

			if (restored) {
				// Still need to load these binary packages (they're not in site-packages)
				log('Loading SQLite3...', 'info', 'django');
				await pyodide.loadPackage('sqlite3');

				log('Loading tzdata...', 'info', 'django');
				await pyodide.loadPackage('tzdata');

				// Pre-import Django modules to warm up sys.modules cache
				// This makes the first view execution much faster
				log('Pre-importing Django modules...', 'info', 'django');
				const preImportStart = performance.now();
				await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.contrib.staticfiles.handlers import StaticFilesHandler

# Set Django environment variables (but don't call django.setup() yet)
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
				`);
				const preImportDuration = performance.now() - preImportStart;
				log(`Django modules pre-imported in ${preImportDuration.toFixed(2)}ms`, 'success', 'django');

				djangoInstalled = true;
				log('Django restored successfully', 'success', 'django');
				return true;
			} else {
				log('Cache restore failed, installing fresh...', 'warning', 'django');
			}
		}

		// Fallback: Fresh installation if no snapshot or restore failed
		log('Installing Django...', 'info', 'django');
		const micropip = pyodide.pyimport('micropip');

		// Install Django
		await micropip.install('django');

		// Load sqlite3 package
		log('Loading SQLite3...', 'info', 'django');
		await pyodide.loadPackage('sqlite3');

		// Load tzdata package for timezone support
		log('Loading tzdata...', 'info', 'django');
		await pyodide.loadPackage('tzdata');

		// Pre-import Django modules to warm up sys.modules cache
		log('Pre-importing Django modules...', 'info', 'django');
		const preImportStart = performance.now();
		await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.contrib.staticfiles.handlers import StaticFilesHandler

# Set Django environment variables (but don't call django.setup() yet)
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
		`);
		const preImportDuration = performance.now() - preImportStart;
		log(`Django modules pre-imported in ${preImportDuration.toFixed(2)}ms`, 'success', 'django');

		djangoInstalled = true;
		log('Django installed successfully', 'success', 'django');

		// Create snapshot for future use (non-blocking since this is a fallback case)
		createSnapshot(pyodide, DJANGO_VERSION).catch((error) => {
			log(`Failed to create snapshot: ${error}`, 'warning', 'django');
		});

		return true;
	} catch (error) {
		log(`Failed to install Django: ${error}`, 'error', 'django');
		return false;
	}
}

export async function installPackage(packageName: string) {
	try {
		const micropip = pyodide.pyimport('micropip');
		await micropip.install(packageName);
		log(`Package ${packageName} installed`, 'success');
		return true;
	} catch (error) {
		log(`Failed to install ${packageName}: ${error}`, 'error');
		return false;
	}
}

export function getPyodide() {
	return pyodide;
}

export function isPyodideReady() {
	return pyodide !== null;
}

/**
 * Create a snapshot of the current Pyodide state
 * This should be called after the worker is ready to avoid blocking initialization
 */
export async function createPyodideSnapshot(): Promise<void> {
	if (!pyodide) {
		console.warn('[pyodide-manager] Cannot create snapshot: Pyodide not initialized');
		return;
	}

	console.log('[pyodide-manager] Creating snapshot for faster reloads...');
	try {
		await createSnapshot(pyodide, DJANGO_VERSION);
	} catch (error) {
		console.error('[pyodide-manager] Failed to create snapshot:', error);
	}
}
