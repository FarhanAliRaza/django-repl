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
	private availableIds: Set<number> = new Set([0, 1, 2]); // Track available worker IDs for reuse
	private swapInProgress: boolean = false; // Prevent concurrent swaps
	public onWorkerReady?: () => void; // Callback when a worker becomes ready

	constructor(poolSize = 3) {
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
		const workerId = this.availableIds.size > 0 ? Array.from(this.availableIds)[0] : this.nextId++;

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
	 * Notify subscribers that a worker is ready
	 */
	private notifyWorkerReady(): void {
		if (this.onWorkerReady) {
			this.onWorkerReady();
		}
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
		// Prevent concurrent swaps
		if (this.swapInProgress) {
			onLog?.('⏸️ Another worker swap in progress, please wait...');
			return null;
		}

		this.swapInProgress = true;

		const swapStartTime = performance.now();

		const readyWorker = this.getReadyWorker();
		if (!readyWorker) {
			this.swapInProgress = false; // Release lock
			return null;
		}

		readyWorker.state = 'transferring';

		try {
			// Get database from current worker if we have one
			let dbData: Uint8Array | null = null;
			if (currentWorkerId) {
				const currentWorker = this.workers.get(currentWorkerId);
				if (currentWorker) {
					dbData = await this.getDatabaseFromWorker(currentWorker);
				}
			}

			await this.writeFilesToWorker(readyWorker, files);

			// Transfer database if we have one
			if (dbData) {
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

			// Release swap lock BEFORE starting background worker warming
			this.swapInProgress = false;

			// Immediately start creating replacement worker (non-blocking)
			// This worker will warm in parallel with the view execution
			onLog?.(`Creating replacement worker in background...`);
			this.createAndWarmWorker(onLog)
				.then(() => {
					// Notify that a new worker is ready
					console.log('[WorkerPool] Replacement worker ready, notifying subscribers');
					this.notifyWorkerReady();
				})
				.catch((err) => {
					onLog?.(`Failed to create replacement worker: ${err.message}`);
				});

			return readyWorker.id;
		} catch (error) {
			const totalDuration = performance.now() - swapStartTime;
			onLog?.(`❌ Failed to swap to fresh worker after ${totalDuration.toFixed(2)}ms: ${error}`);
			readyWorker.state = 'ready'; // Reset state on failure

			// Release swap lock on error
			this.swapInProgress = false;

			return null;
		}
	}

	/**
	 * Get database data from a worker
	 */
	private async getDatabaseFromWorker(worker: PooledWorker): Promise<Uint8Array | null> {
		const startTime = performance.now();

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
					const duration = performance.now() - startTime;
					if (payload.dbData) {
						console.log(
							`[WorkerPool] Got database from ${worker.id}: ${payload.dbData.length} bytes in ${duration.toFixed(2)}ms`
						);
					} else {
						console.log(
							`[WorkerPool] No database data from ${worker.id} (${duration.toFixed(2)}ms)`
						);
					}
					resolve(payload.dbData);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const duration = performance.now() - startTime;
					console.error(
						`[WorkerPool] Error getting database from ${worker.id} after ${duration.toFixed(2)}ms`
					);
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
		const startTime = performance.now();
		const fileCount = Object.keys(files).length;

		return new Promise((resolve) => {
			const timeout = setTimeout(() => {
				const duration = performance.now() - startTime;
				console.warn(
					`[WorkerPool] Timeout writing ${fileCount} files to ${worker.id} after ${duration.toFixed(2)}ms`
				);
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
					const duration = performance.now() - startTime;
					console.error(
						`[WorkerPool] Error writing files to ${worker.id} after ${duration.toFixed(2)}ms`
					);
					resolve(false);
				}
			};

			worker.worker.addEventListener('message', messageHandler);

			const request: WorkerRequest = {
				type: 'writeFiles',
				payload: { files }
			};

			try {
				worker.worker.postMessage(request);
			} catch (error) {
				console.error('[WorkerPool] postMessage failed:', error);
				console.error('[WorkerPool] Error name:', (error as Error).name);
				console.error('[WorkerPool] Error message:', (error as Error).message);
				console.error('[WorkerPool] Files object:', files);
				throw error; // Re-throw to be caught by outer catch
			}
		});
	}

	/**
	 * Set database data to a worker
	 */
	private async setDatabaseToWorker(worker: PooledWorker, dbData: Uint8Array): Promise<boolean> {
		const startTime = performance.now();

		return new Promise((resolve) => {
			console.log(`[WorkerPool] Setting database to ${worker.id}: ${dbData.length} bytes`);

			const timeout = setTimeout(() => {
				const duration = performance.now() - startTime;
				console.warn(
					`[WorkerPool] Timeout setting database to ${worker.id} after ${duration.toFixed(2)}ms`
				);
				resolve(false);
			}, 10000); // 10 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				if (response.type === 'result') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const payload = response.payload as { success: boolean };
					const duration = performance.now() - startTime;
					console.log(
						`[WorkerPool] Database set to ${worker.id} in ${duration.toFixed(2)}ms: ${payload.success ? 'success' : 'failed'}`
					);
					resolve(payload.success);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const duration = performance.now() - startTime;
					console.error(
						`[WorkerPool] Error setting database to ${worker.id} after ${duration.toFixed(2)}ms`
					);
					resolve(false);
				}
			};

			worker.worker.addEventListener('message', messageHandler);

			const postMessageStartTime = performance.now();
			const request: WorkerRequest = {
				type: 'setDatabase',
				payload: { dbData }
			};

			worker.worker.postMessage(request);
			const postMessageDuration = performance.now() - postMessageStartTime;
			console.log(
				`[WorkerPool] postMessage for setDatabase took ${postMessageDuration.toFixed(2)}ms (${dbData.length} bytes)`
			);
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
