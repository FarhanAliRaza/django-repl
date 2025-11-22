import type { WorkerRequest, WorkerResponse } from './types';

export type WorkerState = 'warming' | 'ready' | 'busy' | 'transferring';

interface PooledWorker {
	id: string;
	worker: Worker;
	state: WorkerState;
	messageHandler?: (response: WorkerResponse) => void;
}

export class WorkerPool {
	private workers: Map<string, PooledWorker> = new Map();
	private poolSize: number;
	private nextId = 0;
	private isFirstLoad = true;

	constructor(poolSize = 2) {
		this.poolSize = poolSize;
	}

	/**
	 * Initialize the worker pool with pre-warmed workers
	 */
	async initialize(onLog?: (message: string) => void): Promise<void> {
		onLog?.('Initializing worker pool...');
		// Start warming up workers
		const warmPromises: Promise<void>[] = [];
		for (let i = 0; i < this.poolSize; i++) {
			warmPromises.push(this.createAndWarmWorker(onLog));
		}
		await Promise.all(warmPromises);
		onLog?.(`Worker pool initialized with ${this.poolSize} workers`);
	}

	/**
	 * Create a new worker and start warming it up
	 */
	private async createAndWarmWorker(onLog?: (message: string) => void): Promise<void> {
		const id = `worker-${this.nextId++}`;
		const worker = new Worker(new URL('./workers/python-executor.ts', import.meta.url), {
			type: 'module'
		});

		const pooledWorker: PooledWorker = {
			id,
			worker,
			state: 'warming'
		};

		this.workers.set(id, pooledWorker);
		onLog?.(`Starting to warm worker ${id}...`);

		// Wait for worker to be ready
		await this.warmWorker(pooledWorker, onLog);
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
					// Only use isFirstLoad for the first worker
					this.isFirstLoad = false;
					resolve();
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					onLog?.(`Worker ${pooledWorker.id} failed to warm up`);
					reject(new Error('Worker initialization failed'));
				} else if (response.type === 'log') {
					// Forward logs if handler is set
					if (pooledWorker.messageHandler) {
						pooledWorker.messageHandler(response);
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

			// Set up message handler for this worker
			readyWorker.messageHandler = onMessage;
			readyWorker.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
				if (readyWorker.messageHandler) {
					readyWorker.messageHandler(event.data);
				}
			});

			readyWorker.state = 'ready';
			onLog?.(`Successfully swapped to worker ${readyWorker.id}`);

			// Start warming a new worker in the background to replace this one
			this.createAndWarmWorker(onLog).catch((err) => {
				onLog?.(`Failed to warm replacement worker: ${err.message}`);
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
				resolve(null);
			}, 10000); // 10 second timeout

			const messageHandler = (event: MessageEvent<WorkerResponse>) => {
				const response = event.data;
				if (response.type === 'database') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
					const payload = response.payload as { dbData: Uint8Array };
					resolve(payload.dbData);
				} else if (response.type === 'error') {
					clearTimeout(timeout);
					worker.worker.removeEventListener('message', messageHandler);
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
			const timeout = setTimeout(() => {
				resolve(false);
			}, 10000); // 10 second timeout

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
