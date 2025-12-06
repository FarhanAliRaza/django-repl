import { log } from './logger';
import { hasSnapshot, createSnapshot, restoreSnapshot } from './snapshot-manager';

let pyodide: any = null;
let djangoInstalled = false;
let isFirstLoad = true; // Will be set by the init message via setFirstLoad()
const DJANGO_VERSION = '5.2'; // Track Django version for snapshot versioning (Python 3.13 compatible)

export async function initializePyodide() {
	try {
		log('Loading Pyodide...', 'info', 'django');

		// Load Pyodide dynamically using import for ES modules
		// Using .mjs version because this runs in a Web Worker (strict ES module environment)
		const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.mjs');

		pyodide = await pyodideModule.loadPyodide({
			indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'
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
	isFirstLoad = value;
}

export async function installDjango() {
	if (djangoInstalled) {
		log('Django already installed', 'info', 'django');
		return true;
	}

	try {
		// First, check if a snapshot exists in IndexedDB
		// This is more reliable than relying on isFirstLoad flag (which is per-worker)
		const snapshotExists = await hasSnapshot(DJANGO_VERSION);

		if (snapshotExists && !isFirstLoad) {
			// Restore from snapshot (fast path) - but only if NOT the first worker
			// First worker should always install fresh even if old snapshot exists
			log('Restoring Django from cache...', 'info', 'django');
			const restored = await restoreSnapshot(pyodide, DJANGO_VERSION);

			if (restored) {
				// Still need to load these binary packages (they're not in site-packages)
				// Load them in parallel for faster initialization
				log('Loading SQLite3 and tzdata in parallel...', 'info', 'django');
				await Promise.all([
					pyodide.loadPackage('sqlite3'),
					pyodide.loadPackage('tzdata')
				]);

				// Pre-import Django modules to warm up sys.modules cache
				// This makes the first view execution much faster
				log('Pre-importing Django modules...', 'info', 'django');
				await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.contrib.staticfiles.handlers import StaticFilesHandler

# Set Django environment variables (but don't call django.setup() yet)
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
				`);

				djangoInstalled = true;
				log('Django restored successfully', 'success', 'django');
				return true;
			} else {
				log('Cache restore failed, installing fresh...', 'warning', 'django');
			}
		}

		// Fresh installation if:
		// 1. No snapshot exists (first worker ever), OR
		// 2. This is marked as first load (first worker of this session), OR
		// 3. Snapshot restore failed
		log('Installing Django and all dependencies in parallel...', 'info', 'django');
		const micropip = pyodide.pyimport('micropip');

		// Install all packages in parallel for faster initialization
		// Include Django's dependencies (asgiref, sqlparse) explicitly to avoid sequential resolution
		await Promise.all([
			micropip.install('django'),
			micropip.install('asgiref'),
			micropip.install('sqlparse'),
			pyodide.loadPackage('sqlite3'),
			pyodide.loadPackage('tzdata')
		]);

		log('All packages installed', 'success', 'django');

		// Pre-import Django modules to warm up sys.modules cache
		log('Pre-importing Django modules...', 'info', 'django');
		await pyodide.runPythonAsync(`
import os
import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.contrib.staticfiles.handlers import StaticFilesHandler

# Set Django environment variables (but don't call django.setup() yet)
os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'
		`);

		djangoInstalled = true;
		log('Django installed successfully', 'success', 'django');

		// Note: Snapshot creation is handled by message-handlers.ts after 'ready' is sent
		// This prevents duplicate snapshot creation and ensures it's only done for first worker

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

	try {
		await createSnapshot(pyodide, DJANGO_VERSION);
	} catch (error) {
		console.error('[pyodide-manager] Failed to create snapshot:', error);
	}
}
