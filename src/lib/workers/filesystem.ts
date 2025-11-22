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
