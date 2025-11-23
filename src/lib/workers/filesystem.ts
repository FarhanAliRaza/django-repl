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

		// Debug: List files in root directory to see what exists
		try {
			const result = await pyodide.runPythonAsync(`
import os
import json

# List all files in root directory
root_files = []
try:
	root_files = os.listdir('/')
except Exception as e:
	root_files = [f"Error listing root: {e}"]

# Check if db.sqlite3 exists and get its size
db_info = {}
if os.path.exists('/db.sqlite3'):
	db_info['exists'] = True
	db_info['size'] = os.path.getsize('/db.sqlite3')
	db_info['path'] = os.path.abspath('/db.sqlite3')
else:
	db_info['exists'] = False

json.dumps({'root_files': root_files, 'db_info': db_info})
			`);

			const debugInfo = JSON.parse(result);
			log(`Root directory files: ${debugInfo.root_files.join(', ')}`, 'info');
			log(`Database info: ${JSON.stringify(debugInfo.db_info)}`, 'info');
		} catch (debugError) {
			log(`Debug listing failed: ${debugError}`, 'warning');
		}

		// Check if database exists
		try {
			pyodide.FS.stat(dbPath);
		} catch (e) {
			log(`Database file not found at ${dbPath}`, 'warning');
			return null;
		}

		// Read database file as binary data
		const dbData = pyodide.FS.readFile(dbPath, { encoding: 'binary' });
		log(`Database file read successfully (${dbData.length} bytes)`, 'success');
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
		log(`Database file written successfully (${dbData.length} bytes)`, 'success');

		// Verify the file was written correctly
		try {
			const stat = pyodide.FS.stat(dbPath);
			log(`Verified database file exists with size: ${stat.size} bytes`, 'success');
		} catch (e) {
			log(`Warning: Could not verify database file after write`, 'warning');
		}

		return true;
	} catch (error) {
		log(`Failed to write database: ${error}`, 'error');
		return false;
	}
}
