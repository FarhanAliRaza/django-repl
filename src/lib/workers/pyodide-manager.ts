import { log } from './logger';
import { hasSnapshot, createSnapshot, restoreSnapshot } from './snapshot-manager';

let pyodide: any = null;
let djangoInstalled = false;
let isFirstLoad = true; // Will be set by the init message
const DJANGO_VERSION = '5.0.1'; // Track Django version for snapshot versioning

export async function initializePyodide() {
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

export function setFirstLoad(value: boolean) {
	isFirstLoad = value;
}

export async function installDjango() {
	if (djangoInstalled) {
		log('Django already installed', 'info');
		return true;
	}

	try {
		// On first page load, always install fresh from internet (don't use cache)
		if (isFirstLoad) {
			log('🌐 First page load - installing from internet...', 'info');
			isFirstLoad = false;

			const micropip = pyodide.pyimport('micropip');

			// Install Django from internet
			await micropip.install('django');

			// Load sqlite3 package
			log('Loading SQLite3...', 'info');
			await pyodide.loadPackage('sqlite3');

			// Load tzdata package for timezone support
			log('Loading tzdata...', 'info');
			await pyodide.loadPackage('tzdata');

			djangoInstalled = true;
			log('Django installed successfully', 'success');

			// Create snapshot for future restarts (non-blocking)
			log('Creating snapshot for future hot restarts...', 'info');
			createSnapshot(pyodide, DJANGO_VERSION).catch((error) => {
				log(`Failed to create snapshot: ${error}`, 'warning');
			});

			return true;
		}

		// On subsequent loads (hot restarts), try to use snapshot
		const snapshotExists = await hasSnapshot(DJANGO_VERSION);

		if (snapshotExists) {
			// Restore from snapshot (fast path)
			log('📦 Snapshot found! Restoring from cache...', 'info');
			const restored = await restoreSnapshot(pyodide, DJANGO_VERSION);

			if (restored) {
				// Still need to load these binary packages (they're not in site-packages)
				log('Loading SQLite3...', 'info');
				await pyodide.loadPackage('sqlite3');

				log('Loading tzdata...', 'info');
				await pyodide.loadPackage('tzdata');

				djangoInstalled = true;
				log('✅ Django restored from snapshot', 'success');
				return true;
			} else {
				log('⚠️ Snapshot restore failed, falling back to normal installation', 'warning');
			}
		}

		// Fallback: Fresh installation if no snapshot or restore failed
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

		// Create snapshot for future use (non-blocking)
		createSnapshot(pyodide, DJANGO_VERSION).catch((error) => {
			log(`Failed to create snapshot: ${error}`, 'warning');
		});

		return true;
	} catch (error) {
		log(`Failed to install Django: ${error}`, 'error');
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
