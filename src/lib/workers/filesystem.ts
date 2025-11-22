import { log } from './logger';
import { getPyodide } from './pyodide-manager';

export async function writeFilesToVirtualFS(files: Record<string, string>) {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized', 'error');
		return false;
	}

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

export async function getDatabaseFromVirtualFS(): Promise<Uint8Array | null> {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized', 'error');
		return null;
	}

	try {
		const dbPath = '/db.sqlite3';
		// Check if database exists
		try {
			pyodide.FS.stat(dbPath);
		} catch (e) {
			log('Database file not found', 'warning');
			return null;
		}

		// Read database file as binary data
		const dbData = pyodide.FS.readFile(dbPath, { encoding: 'binary' });
		log('Database file read successfully', 'success');
		return dbData;
	} catch (error) {
		log(`Failed to read database: ${error}`, 'error');
		return null;
	}
}

export async function setDatabaseToVirtualFS(dbData: Uint8Array): Promise<boolean> {
	const pyodide = getPyodide();
	if (!pyodide) {
		log('Pyodide not initialized', 'error');
		return false;
	}

	try {
		const dbPath = '/db.sqlite3';
		// Write database file as binary data
		pyodide.FS.writeFile(dbPath, dbData, { encoding: 'binary' });
		log('Database file written successfully', 'success');
		return true;
	} catch (error) {
		log(`Failed to write database: ${error}`, 'error');
		return false;
	}
}
