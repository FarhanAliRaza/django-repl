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

			djangoInstalled = true;
			log('Django installed successfully', 'success', 'django');

			// Create snapshot for future workers (blocking to ensure it's ready for next worker)
			console.log('[pyodide-manager] Creating snapshot for faster reloads...');
			await createSnapshot(pyodide, DJANGO_VERSION);

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
