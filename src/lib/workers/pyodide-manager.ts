import { log } from './logger';

let pyodide: any = null;
let djangoInstalled = false;

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

export async function installDjango() {
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
