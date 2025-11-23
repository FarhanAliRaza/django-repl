import { log } from './logger';

const DB_NAME = 'pyodide-snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const PYODIDE_VERSION = '0.29.0';

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
		// This is an internal operation - log to browser console only
		console.log('Creating Pyodide snapshot...');

		// Create a tar archive of site-packages using Python's tarfile module
		const archiveBytes = await pyodide.runPythonAsync(`
import tarfile
import io
import os

# Create in-memory tar archive
tar_buffer = io.BytesIO()
tar = tarfile.open(fileobj=tar_buffer, mode='w:gz')

# Add site-packages directory with full path structure
site_packages_path = '/lib/python3.13/site-packages'
if os.path.exists(site_packages_path):
    tar.add(site_packages_path, arcname='lib/python3.13/site-packages')

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
				console.log(
					`Snapshot created successfully (${(archive.length / 1024 / 1024).toFixed(2)} MB)`
				);
				resolve(true);
			};

			request.onerror = () => {
				console.error(`Failed to store snapshot: ${request.error}`);
				reject(new Error(`Failed to store snapshot: ${request.error}`));
			};

			transaction.oncomplete = () => {
				db.close();
			};
		});
	} catch (error) {
		console.error(`Failed to create snapshot: ${error}`);
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
		// This is an internal operation - log to browser console only
		console.log('Restoring Pyodide snapshot from cache...');

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

		// Write archive to virtual FS and extract using Python
		// (unpackArchive doesn't support extracting to custom path in older Pyodide versions)
		pyodide.FS.writeFile('/tmp/snapshot.tar.gz', snapshotData.archive);

		// Extract and verify Django in one Python call (optimized)
		const verifyResult = await pyodide.runPythonAsync(`
import tarfile
import os
import sys
import importlib

# Extract the archive
tar = tarfile.open('/tmp/snapshot.tar.gz', mode='r:gz')
tar.extractall('/')
tar.close()

# Clean up
os.remove('/tmp/snapshot.tar.gz')

# Ensure site-packages is in sys.path
site_packages_path = '/lib/python3.13/site-packages'
if site_packages_path not in sys.path:
    sys.path.insert(0, site_packages_path)

# Invalidate import caches
importlib.invalidate_caches()

# Verify Django
django_found = False
django_version = None
try:
    import django
    django_found = True
    django_version = django.__version__
except ImportError:
    pass

{
    'django_found': django_found,
    'django_version': django_version,
    'site_packages_exists': os.path.exists(site_packages_path)
}
		`);

		// Log debug info to browser console
		const debugInfo = verifyResult.toJs();
		const ageInMinutes = Math.round((Date.now() - snapshotData.metadata.timestamp) / 60000);
		console.log(
			`Snapshot restored (${ageInMinutes}m ago): Django ${debugInfo.django_found ? 'v' + debugInfo.django_version : 'NOT FOUND'}`
		);

		return true;
	} catch (error) {
		console.warn(`Failed to restore snapshot: ${error}`);
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
