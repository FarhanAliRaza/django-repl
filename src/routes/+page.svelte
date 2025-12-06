<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import FileTree from '$lib/components/FileTree.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import Output from '$lib/components/Output.svelte';
	import { workspaceState } from '$lib/stores/workspace.svelte';
	import { executionState, ReplState } from '$lib/stores/execution.svelte';
	import type { WorkerResponse } from '$lib/types';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Button } from '$lib/components/ui/button';
	import { pathState } from '$lib/stores/path-state.svelte';
	import { RefreshCw, Play, Link2, Github, LoaderCircle, CircleCheck, Clock } from '@lucide/svelte';
	import { WorkerPool } from '$lib/worker-pool';
	import type { HttpMethod } from '$lib/types';
	import { shareState } from '$lib/stores/share.svelte';

	let workerPool: WorkerPool | null = null;
	let currentWorkerId: string | null = $state(null);
	let latestPendingRefresh: {
		files: Record<string, string>;
		path: string;
		timestamp: number;
	} | null = $state(null);
	let isExecutingRefresh: boolean = $state(false); // Prevent concurrent refresh executions
	let showShareToast = $state(false);
	let shareToastMessage = $state('');

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
					if (
						'status' in payload &&
						'redirectTo' in payload &&
						payload.status &&
						payload.redirectTo
					) {
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
						(payload && 'message' in payload ? String(payload.message) : undefined) ||
						'Unknown error'
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
				const pending = latestPendingRefresh;
				latestPendingRefresh = null;

				// Use $state.snapshot() to remove Svelte Proxy added by $state storage
				// When files are stored in $state variable, Svelte wraps them in Proxies
				// which cannot be cloned by postMessage()
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

		// Automatically run the Django project when worker becomes ready
		// SECURITY: Only auto-run for fresh projects, NOT for shared projects from URLs
		// Shared projects could contain malicious code, so require explicit user action
		const hasUrlHash = browser && window.location.hash.length > 1;
		if (!hasUrlHash) {
			// Fresh project - safe to auto-run
			runCode();
		}
		// For shared projects, user must click "Run" button manually
	}

	onMount(() => {
		// Try to load from URL hash first (shared project)
		shareState.loadFromHash().then((sharedData) => {
			if (sharedData) {
				workspaceState.fromJSON(sharedData);
			}
		});

		// Load saved path from localStorage
		pathState.loadFromLocalStorage();

		// Listen for navigation events from iframe
		const handleNavigation = (event: CustomEvent<{ path: string }>) => {
			// Update path state and re-run Django
			pathState.setPath(event.detail.path);
			runCodeWithPath(event.detail.path);
		};

		// Listen for address bar navigation
		const handleAddressBarNavigate = (event: CustomEvent<{ path: string }>) => {
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

		// Listen for hash changes (when user navigates back/forward with shared URLs)
		const handleHashChange = () => {
			shareState.loadFromHash().then((sharedData) => {
				if (sharedData) {
					workspaceState.fromJSON(sharedData);
				}
			});
		};

		window.addEventListener('django-navigate', handleNavigation as EventListener);
		window.addEventListener('address-bar-navigate', handleAddressBarNavigate as EventListener);
		window.addEventListener('django-form-submit', handleFormSubmit as EventListener);
		window.addEventListener('editor-save', handleEditorSave);
		window.addEventListener('hashchange', handleHashChange);

		const cleanup = () => {
			window.removeEventListener('django-navigate', handleNavigation as EventListener);
			window.removeEventListener('address-bar-navigate', handleAddressBarNavigate as EventListener);
			window.removeEventListener('django-form-submit', handleFormSubmit as EventListener);
			window.removeEventListener('editor-save', handleEditorSave);
			window.removeEventListener('hashchange', handleHashChange);
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

		// Compare with last run to see what changed
		const changedFiles: string[] = [];
		for (const [path, content] of Object.entries(files)) {
			if (lastFiles[path] !== content) {
				changedFiles.push(path);
			}
		}

		// Store current files for next comparison
		lastFiles = { ...files };

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

	async function handleShare() {
		try {
			const data = workspaceState.toJSON();
			const url = await shareState.generateUrl(data.name, data.files);
			const copied = await shareState.copyToClipboard(url);

			if (copied) {
				shareToastMessage = 'Link copied to clipboard!';
				showShareToast = true;
				setTimeout(() => {
					showShareToast = false;
				}, 3000);
			} else {
				alert('Failed to copy link. Please try again.');
			}
		} catch (error) {
			console.error('Failed to generate share link:', error);
			alert('Failed to generate share link. The project might be too large.');
		}
	}
</script>

<div class="playground dark">
	<header class="header">
		<div class="header-left">
			<div class="logo">
				<svg class="django-icon" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
					<path d="M11.146 0h3.924v18.166c-2.013.382-3.491.535-5.096.535-4.791 0-7.288-2.166-7.288-6.32 0-4.002 2.65-6.6 6.753-6.6.637 0 1.121.05 1.707.203zm0 9.143a3.894 3.894 0 00-1.325-.204c-1.988 0-3.134 1.223-3.134 3.365 0 2.09 1.096 3.236 3.109 3.236.433 0 .79-.025 1.35-.102V9.142zM21.314 6.06v9.098c0 3.134-.229 4.638-.917 5.937-.637 1.249-1.478 2.039-3.211 2.905l-3.644-1.733c1.733-.815 2.574-1.53 3.109-2.625.561-1.121.739-2.421.739-5.835V6.059h3.924zM17.39.021h3.924v4.026H17.39z"/>
				</svg>
				<div class="logo-text">
					<h1>Django Playground</h1>
					<span class="subtitle">Run Django in your browser</span>
				</div>
			</div>
		</div>
		<div class="header-center">
			<a
				class="github-link"
				href="https://github.com/FarhanAliRaza"
				target="_blank"
				rel="noopener noreferrer"
			>
				<Github class="size-4" />
				<span>Made by Farhan Ali Raza</span>
			</a>
		</div>
		<div class="header-right">
			<div class="status">
				{#if executionState.replState === ReplState.INITIALIZING}
					<LoaderCircle class="size-4 animate-spin text-amber-400" />
					<span>Initializing...</span>
				{:else if executionState.replState === ReplState.RUNNING}
					<LoaderCircle class="size-4 animate-spin text-blue-400" />
					<span>Running...</span>
				{:else if latestPendingRefresh}
					<Clock class="size-4 text-amber-400" />
					<span>Pending...</span>
				{:else if executionState.replState === ReplState.READY}
					<CircleCheck class="size-4 text-emerald-400" />
					<span>Ready</span>
				{:else}
					<CircleCheck class="size-4 text-emerald-400" />
					<span>Ready</span>
				{/if}
			</div>

			<Button size="default" variant="outline" onclick={handleShare} title="Share project">
				<Link2 class="size-4" />
				<span class="btn-text">Share</span>
			</Button>

			{#if executionState.replState === ReplState.READY}
				<Button size="default" onclick={refreshFiles}>
					<RefreshCw class="size-4" />
					<span class="btn-text">Refresh{latestPendingRefresh ? ' (Pending)' : ''}</span>
				</Button>
			{:else}
				<Button
					variant="default"
					size="default"
					onclick={runCode}
					disabled={executionState.replState !== ReplState.IDLE}
				>
					<Play class="size-4" />
					<span class="btn-text">Run</span>
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

	{#if showShareToast}
		<div class="toast">
			<CircleCheck class="size-5" />
			{shareToastMessage}
		</div>
	{/if}
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
		background: var(--background);
		color: var(--foreground);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 20px;
		background: var(--card);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
		position: relative;
	}

	.header-left {
		display: flex;
		align-items: center;
		flex: 1;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.django-icon {
		color: oklch(0.696 0.17 162.48);
	}

	.logo-text {
		display: flex;
		flex-direction: column;
	}

	.header h1 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--foreground);
		line-height: 1.2;
	}

	.subtitle {
		font-size: 11px;
		color: var(--muted-foreground);
	}

	.header-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
	}

	.github-link {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--muted-foreground);
		text-decoration: none;
		padding: 6px 12px;
		border-radius: var(--radius-md);
		transition: all 0.15s ease;
	}

	.github-link:hover {
		color: var(--foreground);
		background: var(--accent);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--muted-foreground);
		padding: 6px 12px;
		background: var(--secondary);
		border-radius: var(--radius-md);
	}

	.btn-text {
		margin-left: 2px;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	:global(.animate-spin) {
		animation: spin 1s linear infinite;
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

	.toast {
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: oklch(0.696 0.17 162.48);
		color: white;
		padding: 14px 20px;
		border-radius: var(--radius-lg);
		font-size: 14px;
		font-weight: 500;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		animation: slideIn 0.3s ease-out;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	@keyframes slideIn {
		from {
			transform: translateY(100px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.header-center {
			display: none;
		}

		.btn-text {
			display: none;
		}

		.subtitle {
			display: none;
		}
	}
</style>
