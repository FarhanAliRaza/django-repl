<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import FileTree from '$lib/components/FileTree.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Output from '$lib/components/Output.svelte';
	import { workspaceState } from '$lib/stores/workspace.svelte';
	import { executionState, ReplState } from '$lib/stores/execution.svelte';
	import type { WorkerRequest, WorkerResponse } from '$lib/types';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Button } from '$lib/components/ui/button';
	import { pathState } from '$lib/stores/path-state.svelte';
	import { RefreshCw, Play } from '@lucide/svelte';
	import { WorkerPool } from '$lib/worker-pool';
	import type { HttpMethod } from '$lib/types';

	let workerPool: WorkerPool | null = null;
	let currentWorkerId: string | null = $state(null);
	let latestPendingRefresh: { files: Record<string, string>; path: string; timestamp: number } | null = $state(null);
	let isExecutingRefresh: boolean = $state(false); // Prevent concurrent refresh executions

	// Message handler for worker pool responses
	function handleWorkerMessage(response: WorkerResponse) {
		const { type, payload } = response;

		switch (type) {
			case 'ready':
				if (payload && 'success' in payload && payload.success === true) {
					executionState.setWorkerReady();
					executionState.addLog({
						timestamp: Date.now(),
						type: 'success',
						message: 'Python environment ready'
					});
				} else {
					executionState.addLog({
						timestamp: Date.now(),
						type: 'error',
						message: 'Failed to initialize Python environment'
					});
				}
				break;

			case 'log':
				if (payload && 'timestamp' in payload && 'type' in payload && 'message' in payload) {
					executionState.addLog(payload);
				}
				break;

			case 'result':
				if (payload && 'success' in payload && 'output' in payload && 'logs' in payload) {
					executionState.setExecutionResult(payload);

					// Handle migration files returned from makemigrations
					if ('migrationFiles' in payload && payload.migrationFiles) {
						console.log('✅ Received migration files from worker:', payload.migrationFiles);
						console.log('📝 File paths:', Object.keys(payload.migrationFiles));
						for (const [filePath, content] of Object.entries(payload.migrationFiles)) {
							console.log(`📄 Adding file: ${filePath as string}`);
							workspaceState.updateFile(filePath as string, content as string);
							console.log(`✓ File added to workspace: ${filePath as string}`);
						}
						console.log('📂 Current workspace files:', Object.keys(workspaceState.files));
					}

					// Handle redirects (3xx status codes) - follow redirect with GET request
					if ('status' in payload && 'redirectTo' in payload && payload.status && payload.redirectTo) {
						const statusCode = parseInt(payload.status.split(' ')[0]);
						if (statusCode >= 300 && statusCode < 400) {
							console.log(`Redirect ${statusCode}: Following redirect to ${payload.redirectTo}`);
							// Update path and make GET request to redirect location
							pathState.setPath(payload.redirectTo);
							runCodeWithPath(payload.redirectTo);
						}
					}
				}
				break;

			case 'error':
				executionState.addLog({
					timestamp: Date.now(),
					type: 'error',
					message:
						(payload && 'message' in payload ? String(payload.message) : undefined) || 'Unknown error'
				});
				executionState.isExecuting = false;
				break;
		}
	}

	async function initializeWorkerPool() {
		// Reset state when initializing
		executionState.resetState();

		workerPool = new WorkerPool(3); // Create pool with 3 workers

		await workerPool.initialize(
			(message) => {
				// Log worker pool operations to browser console only (not user Console)
				console.log(message);
			},
			handleWorkerMessage // Pass the message handler so first worker can receive Django logs
		);

		// Set up callback for when new workers become ready
		workerPool.onWorkerReady = () => {
			console.log('[WorkerPool] Worker ready event fired');
			if (latestPendingRefresh && !isExecutingRefresh) {
				console.log('[WorkerPool] Executing pending refresh');
				const pending = latestPendingRefresh;
				latestPendingRefresh = null;

				// Use $state.snapshot() to remove Svelte Proxy added by $state storage
				// When files are stored in $state variable, Svelte wraps them in Proxies
				// which cannot be cloned by postMessage()
				console.log('[WorkerPool] Using $state.snapshot to remove Svelte Proxy wrapper');
				const clonedFiles = $state.snapshot(pending.files);

				executeRefresh(clonedFiles, pending.path);
			} else if (isExecutingRefresh) {
				console.log('[WorkerPool] Skipping pending refresh - execution already in progress');
			}
		};

		// Get the first ready worker
		const readyWorker = workerPool.getReadyWorker();
		if (readyWorker) {
			currentWorkerId = readyWorker.id;
			// Message handler and event listener already set during initialization
		}

		// Mark worker as ready - this transitions state from INITIALIZING → IDLE
		executionState.setWorkerReady();
	}

	onMount(() => {
		// Load saved files from localStorage
		// workspaceFiles.loadFromLocalStorage();

		// Load saved path from localStorage
		pathState.loadFromLocalStorage();

		// Listen for navigation events from iframe
		const handleNavigation = (event: CustomEvent<{ path: string }>) => {
			console.log('Django navigation:', event.detail.path);
			// Update path state and re-run Django
			pathState.setPath(event.detail.path);
			runCodeWithPath(event.detail.path);
		};

		// Listen for address bar navigation
		const handleAddressBarNavigate = (event: CustomEvent<{ path: string }>) => {
			console.log('Address bar navigation:', event.detail.path);
			runCodeWithPath(event.detail.path);
		};

		// Listen for form submissions from iframe
		const handleFormSubmit = (
			event: CustomEvent<{
				path: string;
				method: string;
				body: Record<string, any>;
				headers: Record<string, string>;
			}>
		) => {
			console.log('Form submission:', event.detail);
			const { path, method, body, headers } = event.detail;
			runCodeWithRequest(path, method as HttpMethod, body, headers);
		};

		// Listen for editor save event (Ctrl+S / Cmd+S)
		const handleEditorSave = () => {
			if (executionState.replState === ReplState.READY) {
				refreshFiles();
			} else if (executionState.replState === ReplState.IDLE) {
				runCode();
			}
		};

		window.addEventListener('django-navigate', handleNavigation as EventListener);
		window.addEventListener('address-bar-navigate', handleAddressBarNavigate as EventListener);
		window.addEventListener('django-form-submit', handleFormSubmit as EventListener);
		window.addEventListener('editor-save', handleEditorSave);

		const cleanup = () => {
			window.removeEventListener('django-navigate', handleNavigation as EventListener);
			window.removeEventListener('address-bar-navigate', handleAddressBarNavigate as EventListener);
			window.removeEventListener('django-form-submit', handleFormSubmit as EventListener);
			window.removeEventListener('editor-save', handleEditorSave);
		};

		// Initialize worker pool
		if (browser) {
			initializeWorkerPool();
		}

		return () => {
			cleanup();
			workerPool?.terminateAll();
		};
	});

	let lastFiles: Record<string, string> = {};

	function runCodeWithPath(path: string) {
		if (!workerPool || !currentWorkerId || executionState.replState === ReplState.INITIALIZING)
			return;

		console.log(`Running Django with path: ${path}`);

		// Don't clear logs on page navigation - preserve execution history
		executionState.startExecution(false);

		const files = workspaceState.getFiles();

		// Save to localStorage
		// workspaceFiles.saveToLocalStorage(files);

		// Send files to worker with skipFileWrite=true for navigation only
		workerPool.sendMessage(currentWorkerId, {
			type: 'execute',
			payload: {
				files,
				path,
				skipFileWrite: true,
				cookies: executionState.getCookies()
			}
		});
	}

	function runCodeWithRequest(
		path: string,
		method: HttpMethod,
		body: Record<string, any>,
		headers: Record<string, string>
	) {
		if (!workerPool || !currentWorkerId || executionState.replState === ReplState.INITIALIZING)
			return;

		console.log(`Running Django with ${method} request to ${path}`, { body, headers });

		// Don't clear logs on form submission - preserve execution history
		executionState.startExecution(false);

		const files = workspaceState.getFiles();

		// Save to localStorage
		// workspaceFiles.saveToLocalStorage(files);

		// Update path state
		pathState.setPath(path);

		// Send files to worker with skipFileWrite=true for POST requests (navigation only)
		workerPool.sendMessage(currentWorkerId, {
			type: 'execute',
			payload: {
				files,
				path,
				skipFileWrite: true,
				method,
				headers,
				body,
				cookies: executionState.getCookies()
			}
		});
	}

	function runCode() {
		if (!workerPool || !currentWorkerId || executionState.replState !== ReplState.IDLE) return;

		// Clear logs on initial Run (not on refresh/navigation)
		executionState.startExecution(true);

		const files = workspaceState.getFiles();
		const currentFileName = workspaceState.currentFile;

		// Log to browser console what changed
		console.group('🔄 Django Playground - Running Code');
		console.log('Total files:', Object.keys(files).length);
		console.log('Current file:', currentFileName);

		// Compare with last run to see what changed
		const changedFiles: string[] = [];
		for (const [path, content] of Object.entries(files)) {
			if (lastFiles[path] !== content) {
				changedFiles.push(path);
			}
		}

		if (changedFiles.length === 0 && Object.keys(lastFiles).length > 0) {
			console.log('ℹ️  No files changed since last run');
		}

		console.groupEnd();

		// Store current files for next comparison
		lastFiles = { ...files };

		// Log what we're about to execute (user console)
		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: `Running with ${Object.keys(files).length} files`
		});

		// Log the current file being edited
		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: `Current file: ${currentFileName}`
		});

		// Save to localStorage
		// workspaceFiles.saveToLocalStorage(files);

		// Send files to worker with current path and cookies
		workerPool.sendMessage(currentWorkerId, {
			type: 'execute',
			payload: {
				files,
				path: pathState.currentPath,
				cookies: executionState.getCookies()
			}
		});
	}

	async function executeRefresh(files: Record<string, string>, path: string) {
		if (!workerPool || executionState.replState !== ReplState.READY) return;

		// Prevent concurrent executions
		if (isExecutingRefresh) {
			console.log('[executeRefresh] Already executing, skipping duplicate request');
			return;
		}

		isExecutingRefresh = true;
		console.log('[executeRefresh] Execution lock acquired');

		console.group('🔄 Django Playground - Worker Pool Swap');
		console.log('🔄 Swapping to fresh worker from pool');

		// Clear the lastFiles so it doesn't compare
		lastFiles = {};

		// Log to user console
		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: '🔄 Swapping to fresh worker...'
		});

		// Swap to a fresh worker from the pool
		const newWorkerId = await workerPool.swapToFreshWorker(
			files,
			currentWorkerId,
			handleWorkerMessage,
			(message) => {
				// Log worker pool operations to browser console only (not user Console)
				console.log(message);
			}
		);

		if (newWorkerId) {
			currentWorkerId = newWorkerId;
			console.log('✅ Swapped to worker', newWorkerId);
			console.groupEnd();

			executionState.startExecution(false);

			workerPool.sendMessage(currentWorkerId, {
				type: 'execute',
				payload: {
					files,
					path,
					skipFileWrite: true, // Files already transferred during swap
					cookies: executionState.getCookies()
				}
			});

			// Release execution lock after message sent
			isExecutingRefresh = false;
			console.log('[executeRefresh] Execution lock released (success)');
		} else {
			console.log('❌ Failed to swap to fresh worker');
			console.groupEnd();
			executionState.addLog({
				timestamp: Date.now(),
				type: 'error',
				message: 'Failed to swap to fresh worker'
			});

			// Release execution lock on failure
			isExecutingRefresh = false;
			console.log('[executeRefresh] Execution lock released (swap failed)');
		}
	}

	async function refreshFiles() {
		if (!workerPool || executionState.replState !== ReplState.READY) return;

		const files = workspaceState.getFiles();
		const path = pathState.currentPath;

		// Defensive check: ensure files are valid
		if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
			console.error('[RefreshFiles] Invalid files object:', files);
			executionState.addLog({
				timestamp: Date.now(),
				type: 'error',
				message: 'Cannot refresh: invalid file state'
			});
			return;
		}

		console.log('[RefreshFiles] Refreshing with', Object.keys(files).length, 'files to path:', path);

		// Check if a worker is ready
		const readyWorker = workerPool.getReadyWorker();

		if (readyWorker) {
			// Execute immediately
			console.log('[RefreshFiles] Worker available, executing immediately');
			latestPendingRefresh = null; // Clear any pending
			executeRefresh(files, path);
		} else {
			// No worker ready - update the latest pending refresh
			console.log('[RefreshFiles] No worker ready, queueing refresh');
			const timestamp = Date.now();
			latestPendingRefresh = {
				files,
				path,
				timestamp
			};
			console.log('[RefreshFiles] Queued refresh with timestamp:', timestamp);
			executionState.addLog({
				timestamp,
				type: 'info',
				message: '⏳ Refresh queued, waiting for worker...'
			});
		}
	}

	function runMigrations() {
		if (!workerPool || !currentWorkerId || executionState.replState === ReplState.INITIALIZING)
			return;

		const files = workspaceState.getFiles();

		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: 'Running migrations...'
		});

		workerPool.sendMessage(currentWorkerId, {
			type: 'runMigrations',
			payload: { files }
		});
	}

	function makeMigrations() {
		if (!workerPool || !currentWorkerId || executionState.replState === ReplState.INITIALIZING)
			return;

		const files = workspaceState.getFiles();

		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: 'Making migrations...'
		});

		workerPool.sendMessage(currentWorkerId, {
			type: 'makeMigrations',
			payload: { files }
		});
	}

	function createSuperuser() {
		if (!workerPool || !currentWorkerId || executionState.replState === ReplState.INITIALIZING)
			return;

		const files = workspaceState.getFiles();

		executionState.addLog({
			timestamp: Date.now(),
			type: 'info',
			message: 'Creating superuser (admin/admin)...'
		});

		workerPool.sendMessage(currentWorkerId, {
			type: 'createSuperuser',
			payload: {
				files,
				username: 'admin',
				email: 'admin@example.com',
				password: 'admin'
			}
		});
	}
</script>

<div class="playground">
	<header class="header">
		<div class="header-left">
			<h1>Django Repl</h1>
			<span class="subtitle">Run Django in your browser</span>
		</div>
		<div class="header-center">
			<span class="footer-credit">
				Made with ❤️ by <a
					href="https://github.com/FarhanAliRaza"
					target="_blank"
					rel="noopener noreferrer">Farhan Ali Raza</a
				>
			</span>
		</div>
		<div class="header-right">
			<div class="status">
				{#if executionState.replState === ReplState.INITIALIZING}
					<span class="status-indicator loading"></span>
					<span>Initializing Python...</span>
				{:else if executionState.replState === ReplState.RUNNING}
					<span class="status-indicator running"></span>
					<span>Running...</span>
				{:else if latestPendingRefresh}
					<span class="status-indicator pending"></span>
					<span>Refresh Pending...</span>
				{:else if executionState.replState === ReplState.READY}
					<span class="status-indicator ready"></span>
					<span>Ready</span>
				{:else}
					<span class="status-indicator ready"></span>
					<span>Ready</span>
				{/if}
			</div>

			{#if executionState.replState === ReplState.READY}
				<Button size="default" onclick={refreshFiles}>
					<RefreshCw class="size-4" />
					Refresh{latestPendingRefresh ? ' (Pending)' : ''}
				</Button>
			{:else}
				<Button
					variant="default"
					size="default"
					onclick={runCode}
					disabled={executionState.replState !== ReplState.IDLE}
				>
					<Play class="size-4" />
					Run
				</Button>
			{/if}
		</div>
	</header>

	<div class="content">
		<Resizable.PaneGroup direction="horizontal">
			<Resizable.Pane defaultSize={50} minSize={30}>
				<div class="left-pane">
					<Resizable.PaneGroup direction="horizontal">
						<Resizable.Pane defaultSize={30} minSize={15}>
							<div class="file-tree-container">
								<FileTree />
							</div>
						</Resizable.Pane>
						<Resizable.Handle withHandle={true} />
						<Resizable.Pane>
							<div class="editor-container">
								<Editor />
							</div>
						</Resizable.Pane>
					</Resizable.PaneGroup>
				</div>
			</Resizable.Pane>
			<Resizable.Handle withHandle={true} />
			<Resizable.Pane defaultSize={50}>
				<div class="right-pane">
					<Output
						onRunMigrations={runMigrations}
						onMakeMigrations={makeMigrations}
						onCreateSuperuser={createSuperuser}
					/>
				</div>
			</Resizable.Pane>
		</Resizable.PaneGroup>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.playground {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: #1e1e1e;
		color: #d4d4d4;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 24px;
		background: #2d2d30;
		border-bottom: 1px solid #3e3e42;
		flex-shrink: 0;
		position: relative;
	}

	.header-left {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex: 1;
	}

	.header-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
	}

	.header h1 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: #ffffff;
	}

	.subtitle {
		font-size: 13px;
		color: #999;
	}

	.footer-credit {
		font-size: 12px;
		color: #999;
	}

	.footer-credit a {
		color: #4ec9b0;
		text-decoration: none;
		transition: color 0.2s;
	}

	.footer-credit a:hover {
		color: #6fd9c0;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: #999;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		animation: pulse 2s infinite;
	}

	.status-indicator.loading {
		background: #dcdcaa;
	}

	.status-indicator.running {
		background: #569cd6;
		animation: pulse 1s infinite;
	}

	.status-indicator.ready {
		background: #4ec9b0;
		animation: none;
	}

	.status-indicator.pending {
		background: #d7ba7d;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.content {
		flex: 1;
		overflow: hidden;
	}

	.left-pane {
		height: 100%;
		width: 100%;
	}

	.file-tree-container {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.editor-container {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.right-pane {
		height: 100%;
		width: 100%;
		overflow: hidden;
	}
</style>
