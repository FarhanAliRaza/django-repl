import { log } from './logger';

const DB_NAME = 'pyodide-snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const PYODIDE_VERSION = '0.26.4';

interface SnapshotMetadata {
	version: string;
	pyodideVersion: string;
	djangoVersion: string;
	timestamp: number;
}

interface SnapshotData {
	metadata: SnapshotMetadata;
	archive: Uint8Array;
}

/**
 * Opens IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error(`Failed to open IndexedDB: ${request.error}`));
		};

		request.onsuccess = () => {
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
	});
}

/**
 * Generate cache key based on versions
 */
function getCacheKey(djangoVersion: string): string {
	return `snapshot-py${PYODIDE_VERSION}-django${djangoVersion}`;
}

/**
 * Check if snapshot exists in IndexedDB
 */
export async function hasSnapshot(djangoVersion: string): Promise<boolean> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const key = getCacheKey(djangoVersion);

		return new Promise((resolve, reject) => {
			const request = store.get(key);

			request.onsuccess = () => {
				const exists = request.result !== undefined;
				resolve(exists);
			};

			request.onerror = () => {
				reject(new Error(`Failed to check snapshot: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});
	} catch (error) {
		log(`Error checking snapshot: ${error}`, 'warning');
		return false;
	}
}

/**
 * Create and store a snapshot of site-packages
 */
export async function createSnapshot(
	pyodide: any,
	djangoVersion: string
): Promise<boolean> {
	try {
		log('Creating Pyodide snapshot...', 'info');

		// Create a tar archive of site-packages using Python's tarfile module
		const archiveBytes = await pyodide.runPythonAsync(`
import tarfile
import io
import os

# Create in-memory tar archive
tar_buffer = io.BytesIO()
tar = tarfile.open(fileobj=tar_buffer, mode='w:gz')

# Add site-packages directory with full path structure
site_packages_path = '/lib/python3.12/site-packages'
if os.path.exists(site_packages_path):
    tar.add(site_packages_path, arcname='lib/python3.12/site-packages')

tar.close()
tar_buffer.seek(0)
tar_buffer.read()
		`);

		// Convert Python bytes to Uint8Array
		const archive = new Uint8Array(archiveBytes.toJs());

		const metadata: SnapshotMetadata = {
			version: '1.0',
			pyodideVersion: PYODIDE_VERSION,
			djangoVersion,
			timestamp: Date.now()
		};

		const snapshotData: SnapshotData = {
			metadata,
			archive
		};

		// Store in IndexedDB
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const key = getCacheKey(djangoVersion);

		return new Promise((resolve, reject) => {
			const request = store.put(snapshotData, key);

			request.onsuccess = () => {
				log(
					`Snapshot created successfully (${(archive.length / 1024 / 1024).toFixed(2)} MB)`,
					'success'
				);
				resolve(true);
			};

			request.onerror = () => {
				log(`Failed to store snapshot: ${request.error}`, 'error');
				reject(new Error(`Failed to store snapshot: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});
	} catch (error) {
		log(`Failed to create snapshot: ${error}`, 'error');
		return false;
	}
}

/**
 * Restore snapshot from IndexedDB
 */
export async function restoreSnapshot(
	pyodide: any,
	djangoVersion: string
): Promise<boolean> {
	try {
		log('Restoring Pyodide snapshot from cache...', 'info');

		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readonly');
		const store = transaction.objectStore(STORE_NAME);
		const key = getCacheKey(djangoVersion);

		const snapshotData: SnapshotData = await new Promise((resolve, reject) => {
			const request = store.get(key);

			request.onsuccess = () => {
				if (request.result) {
					resolve(request.result);
				} else {
					reject(new Error('Snapshot not found'));
				}
			};

			request.onerror = () => {
				reject(new Error(`Failed to retrieve snapshot: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});

		// Write the archive to the virtual filesystem first
		const archivePath = '/tmp/snapshot.tar.gz';
		pyodide.FS.writeFile(archivePath, snapshotData.archive);

		// Extract the archive in Python and verify Django is accessible
		const extractionResult = await pyodide.runPythonAsync(`
import tarfile
import os
import shutil
import sys

# Remove existing site-packages if it exists
site_packages_path = '/lib/python3.12/site-packages'
if os.path.exists(site_packages_path):
    shutil.rmtree(site_packages_path)

# Create the parent directories
os.makedirs('/lib/python3.12', exist_ok=True)

# Extract the archive from the virtual filesystem
tar = tarfile.open('/tmp/snapshot.tar.gz', mode='r:gz')
members = tar.getmembers()
member_count = len(members)
tar.extractall('/')
tar.close()

# Clean up the temporary file
os.remove('/tmp/snapshot.tar.gz')

# Ensure site-packages is in sys.path
if site_packages_path not in sys.path:
    sys.path.insert(0, site_packages_path)

# Invalidate import caches to force Python to recognize the new packages
import importlib
importlib.invalidate_caches()

# Verify Django is accessible
django_found = False
django_version = None
try:
    import django
    django_found = True
    django_version = django.__version__
except ImportError as e:
    import_error = str(e)

# Return debug info
{
    'member_count': member_count,
    'django_found': django_found,
    'django_version': django_version,
    'site_packages_exists': os.path.exists(site_packages_path),
    'site_packages_contents_count': len(os.listdir(site_packages_path)) if os.path.exists(site_packages_path) else 0
}
		`);

		// Log debug info
		const debugInfo = extractionResult.toJs({ dict_converter: Object.fromEntries });
		const ageInMinutes = Math.round((Date.now() - snapshotData.metadata.timestamp) / 60000);
		log(
			`Snapshot restored (${ageInMinutes}m ago): ${debugInfo.member_count} files, Django ${debugInfo.django_found ? 'found v' + debugInfo.django_version : 'NOT FOUND'}, ${debugInfo.site_packages_contents_count} packages`,
			debugInfo.django_found ? 'success' : 'error'
		);

		return true;
	} catch (error) {
		log(`Failed to restore snapshot: ${error}`, 'warning');
		return false;
	}
}

/**
 * Clear all snapshots from IndexedDB
 */
export async function clearAllSnapshots(): Promise<boolean> {
	try {
		log('Clearing all snapshots...', 'info');

		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.clear();

			request.onsuccess = () => {
				log('All snapshots cleared', 'success');
				resolve(true);
			};

			request.onerror = () => {
				log(`Failed to clear snapshots: ${request.error}`, 'error');
				reject(new Error(`Failed to clear snapshots: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});
	} catch (error) {
		log(`Error clearing snapshots: ${error}`, 'error');
		return false;
	}
}

/**
 * Clear a specific snapshot
 */
export async function clearSnapshot(djangoVersion: string): Promise<boolean> {
	try {
		const db = await openDB();
		const transaction = db.transaction([STORE_NAME], 'readwrite');
		const store = transaction.objectStore(STORE_NAME);
		const key = getCacheKey(djangoVersion);

		return new Promise((resolve, reject) => {
			const request = store.delete(key);

			request.onsuccess = () => {
				log(`Snapshot ${key} cleared`, 'success');
				resolve(true);
			};

			request.onerror = () => {
				log(`Failed to clear snapshot: ${request.error}`, 'error');
				reject(new Error(`Failed to clear snapshot: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});
	} catch (error) {
		log(`Error clearing snapshot: ${error}`, 'error');
		return false;
	}
}
