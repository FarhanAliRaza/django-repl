import type { WorkerRequest, WorkerResponse } from './types';

export type WorkerState = 'warming' | 'ready' | 'busy' | 'transferring';

interface PooledWorker {
	id: string;
	worker: Worker;
	state: WorkerState;
	messageHandler?: (response: WorkerResponse) => void;
	eventListener?: (event: MessageEvent<WorkerResponse>) => void;
}

export class WorkerPool {
	private workers: Map<string, PooledWorker> = new Map();
	private poolSize: number;
	private nextId = 0;
	private isFirstLoad = true;
	private availableIds: Set<number> = new Set([0, 1]); // Track available worker IDs for reuse

	constructor(poolSize = 2) {
		this.poolSize = poolSize;
	}

	/**
	 * Initialize the worker pool with pre-warmed workers
	 * First worker is awaited, then second worker warms in background
	 */
	async initialize(
		onLog?: (message: string) => void,
		onMessage?: (response: WorkerResponse) => void
	): Promise<void> {
		onLog?.('Initializing worker pool...');

		// Warm first worker and wait for it (this becomes the active worker)
		await this.createAndWarmWorker(onLog, onMessage);
		onLog?.('First worker ready, warming additional workers in background...');

		// Warm remaining workers in background (don't await)
		for (let i = 1; i < this.poolSize; i++) {
			this.createAndWarmWorker(onLog).catch((err) => {
				onLog?.(`Failed to warm background worker: ${err.message}`);
			});
		}
	}

	/**
	 * Create a new worker and start warming it up
	 */
	private async createAndWarmWorker(
		onLog?: (message: string) => void,
		onMessage?: (response: WorkerResponse) => void
	): Promise<void> {
		// Get the next available ID (reuse from terminated workers)
		const workerId = this.availableIds.size > 0
			? Array.from(this.availableIds)[0]
			: this.nextId++;

		this.availableIds.delete(workerId);
		const id = `worker-${workerId}`;

		const worker = new Worker(new URL('./workers/python-executor.ts', import.meta.url), {
			type: 'module'
		});

		const pooledWorker: PooledWorker = {
			id,
			worker,
			state: 'warming'
		};

		// Set message handler if provided (for first worker during initialization)
		if (onMessage) {
			pooledWorker.messageHandler = onMessage;
		}

		this.workers.set(id, pooledWorker);
		onLog?.(`Starting to warm worker ${id}...`);

		// Wait for worker to be ready
		await this.warmWorker(pooledWorker, onLog);

		// Attach permanent event listener if message handler was set
		if (pooledWorker.messageHandler) {
			const eventListener = (event: MessageEvent<WorkerResponse>) => {
				if (pooledWorker.messageHandler) {
					pooledWorker.messageHandler(event.data);
				}
			};
			pooledWorker.eventListener = eventListener;
			pooledWorker.worker.addEventListener('message', eventListener);
		}
	}

	/**
	 * Warm up a worker by initializing Pyodide and Django
	 */
	private async warmWorker(
		pooledWorker: PooledWorker,
		onLog?: (message: string) => void
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Worker ${pooledWorker.id} warming timed out`));
			}, 60000); // 60 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;

				if (response.type === 'ready') {
					clearTimeout(timeout);
					pooledWorker.state = 'ready';
					onLog?.(`Worker ${pooledWorker.id} is ready`);
					// Remove warmup listener to prevent duplicate messages
					pooledWorker.worker.removeEventListener('message', messageHandler);
					// Only use isFirstLoad for the first worker - set AFTER resolve to ensure snapshot is complete
					this.isFirstLoad = false;
					resolve();
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					onLog?.(`Worker ${pooledWorker.id} failed to warm up`);
					// Remove warmup listener on error
					pooledWorker.worker.removeEventListener('message', messageHandler);
					reject(new Error('Worker initialization failed'));
				} else if (response.type === 'log') {
					// Forward logs during warmup if handler is set, otherwise use onLog callback
					if (pooledWorker.messageHandler) {
						pooledWorker.messageHandler(response);
					} else if (onLog && response.payload && 'message' in response.payload) {
						// Forward log message to onLog callback during warmup
						onLog(String(response.payload.message));
					}
				}
			};

			pooledWorker.worker.addEventListener('message', messageHandler);

			// Send init message
			const initMessage: WorkerRequest = {
				type: 'init',
				payload: {
					isFirstLoad: this.isFirstLoad
				}
			};

			pooledWorker.worker.postMessage(initMessage);
		});
	}

	/**
	 * Get an available worker from the pool
	 * Returns null if no workers are ready
	 */
	getReadyWorker(): PooledWorker | null {
		for (const worker of this.workers.values()) {
			if (worker.state === 'ready') {
				return worker;
			}
		}
		return null;
	}

	/**
	 * Transfer files and database to a ready worker, then swap to it
	 * Returns the worker ID that's now active
	 */
	async swapToFreshWorker(
		files: Record<string, string>,
		currentWorkerId: string | null,
		onMessage: (response: WorkerResponse) => void,
		onLog?: (message: string) => void
	): Promise<string | null> {
		const readyWorker = this.getReadyWorker();
		if (!readyWorker) {
			onLog?.('No ready workers available in pool');
			return null;
		}

		onLog?.(`Swapping to fresh worker ${readyWorker.id}...`);
		readyWorker.state = 'transferring';

		try {
			// Get database from current worker if we have one
			let dbData: Uint8Array | null = null;
			if (currentWorkerId) {
				const currentWorker = this.workers.get(currentWorkerId);
				if (currentWorker) {
					onLog?.(`Getting database from ${currentWorkerId}...`);
					dbData = await this.getDatabaseFromWorker(currentWorker);
				}
			}

			// Transfer files to the new worker
			onLog?.(`Transferring files to ${readyWorker.id}...`);
			await this.writeFilesToWorker(readyWorker, files);

			// Transfer database if we have one
			if (dbData) {
				onLog?.(`Transferring database to ${readyWorker.id}...`);
				await this.setDatabaseToWorker(readyWorker, dbData);
			}

			// Terminate old worker (it has stale state) and create a fresh one
			if (currentWorkerId) {
				const oldWorker = this.workers.get(currentWorkerId);
				if (oldWorker) {
					// Remove event listener if it exists
					if (oldWorker.eventListener) {
						oldWorker.worker.removeEventListener('message', oldWorker.eventListener);
					}
					// Terminate the worker to free resources
					oldWorker.worker.terminate();
					// Remove from pool
					this.workers.delete(currentWorkerId);
					// Return the worker ID to available pool for reuse
					const workerId = parseInt(currentWorkerId.replace('worker-', ''));
					this.availableIds.add(workerId);
					onLog?.(`Terminated ${currentWorkerId} (stale state)`);
				}
			}

			// Set up message handler for the new active worker
			readyWorker.messageHandler = onMessage;
			const eventListener = (event: MessageEvent<WorkerResponse>) => {
				if (readyWorker.messageHandler) {
					readyWorker.messageHandler(event.data);
				}
			};
			readyWorker.eventListener = eventListener;
			readyWorker.worker.addEventListener('message', eventListener);

			readyWorker.state = 'ready';
			onLog?.(`Successfully swapped to worker ${readyWorker.id}`);

			// Create a fresh worker to replace the terminated one
			onLog?.(`Creating fresh worker to replace terminated ${currentWorkerId}...`);
			this.createAndWarmWorker(onLog).catch((err) => {
				onLog?.(`Failed to create replacement worker: ${err.message}`);
			});

			return readyWorker.id;
		} catch (error) {
			onLog?.(`Failed to swap to fresh worker: ${error}`);
			readyWorker.state = 'ready'; // Reset state on failure
			return null;
		}
	}

	/**
	 * Get database data from a worker
	 */
	private async getDatabaseFromWorker(worker: PooledWorker): Promise<Uint8Array | null> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				console.warn(`[WorkerPool] Timeout getting database from ${worker.id}`);
				resolve(null);
			}, 10000); // 10 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				if (response.type === 'database') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const payload = response.payload as { dbData: Uint8Array };
					if (payload.dbData) {
						console.log(`[WorkerPool] Got database from ${worker.id}: ${payload.dbData.length} bytes`);
					} else {
						console.log(`[WorkerPool] No database data from ${worker.id}`);
					}
					resolve(payload.dbData);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					console.error(`[WorkerPool] Error getting database from ${worker.id}`);
					resolve(null);
				}
			};

			worker.worker.addEventListener('message', messageHandler);

			const request: WorkerRequest = {
				type: 'getDatabase'
			};

			worker.worker.postMessage(request);
		});
	}

	/**
	 * Write files to a worker
	 */
	private async writeFilesToWorker(
		worker: PooledWorker,
		files: Record<string, string>
	): Promise<boolean> {
		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				resolve(false);
			}, 30000); // 30 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				if (response.type === 'result') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const payload = response.payload as { success: boolean };
					resolve(payload.success);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					resolve(false);
				}
			};

			worker.worker.addEventListener('message', messageHandler);

			const request: WorkerRequest = {
				type: 'writeFiles',
				payload: { files }
			};

			worker.worker.postMessage(request);
		});
	}

	/**
	 * Set database data to a worker
	 */
	private async setDatabaseToWorker(
		worker: PooledWorker,
		dbData: Uint8Array
	): Promise<boolean> {
		return new Promise((resolve) => {
			console.log(`[WorkerPool] Setting database to ${worker.id}: ${dbData.length} bytes`);

			const timeout = setTimeout(() => {
				console.warn(`[WorkerPool] Timeout setting database to ${worker.id}`);
				resolve(false);
			}, 10000); // 10 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				if (response.type === 'result') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const payload = response.payload as { success: boolean };
					console.log(`[WorkerPool] Database set to ${worker.id}: ${payload.success ? 'success' : 'failed'}`);
					resolve(payload.success);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					console.error(`[WorkerPool] Error setting database to ${worker.id}`);
					resolve(false);
				}
			};

			worker.worker.addEventListener('message', messageHandler);

			const request: WorkerRequest = {
				type: 'setDatabase',
				payload: { dbData }
			};

			worker.worker.postMessage(request);
		});
	}

	/**
	 * Get a worker by ID
	 */
	getWorker(workerId: string): PooledWorker | null {
		return this.workers.get(workerId) || null;
	}

	/**
	 * Send a message to a specific worker
	 */
	sendMessage(workerId: string, request: WorkerRequest): boolean {
		const worker = this.workers.get(workerId);
		if (!worker) {
			return false;
		}

		worker.state = 'busy';
		worker.worker.postMessage(request);
		return true;
	}

	/**
	 * Mark a worker as ready after completing a task
	 */
	markWorkerReady(workerId: string): void {
		const worker = this.workers.get(workerId);
		if (worker) {
			worker.state = 'ready';
		}
	}

	/**
	 * Mark a worker as busy
	 */
	markWorkerBusy(workerId: string): void {
		const worker = this.workers.get(workerId);
		if (worker) {
			worker.state = 'busy';
		}
	}

	/**
	 * Terminate all workers in the pool
	 */
	terminateAll(): void {
		for (const worker of this.workers.values()) {
			worker.worker.terminate();
		}
		this.workers.clear();
	}

	/**
	 * Get the count of workers in each state
	 */
	getStats(): Record<WorkerState, number> {
		const stats: Record<WorkerState, number> = {
			warming: 0,
			ready: 0,
			busy: 0,
			transferring: 0
		};

		for (const worker of this.workers.values()) {
			stats[worker.state]++;
		}

		return stats;
	}
}
