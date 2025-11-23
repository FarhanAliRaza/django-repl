import type { ExecutionResult, LogEntry, HttpCookies } from '$lib/types';
import { CookieStorage } from '$lib/utils/cookie-storage.svelte';

export enum ReplState {
	INITIALIZING = 'initializing',  // Python environment is loading
	IDLE = 'idle',                   // Ready but not executed yet
	RUNNING = 'running',             // Currently executing Python code
	READY = 'ready'                  // Has executed at least once, ready for changes/refresh
}

class ExecutionState {
	replState = $state<ReplState>(ReplState.INITIALIZING);
	isExecuting = $state(false);
	executionResult = $state<ExecutionResult | null>(null);
	logs = $state<LogEntry[]>([]);
	isWorkerReady = $state(false);
	cookieStorage: CookieStorage;

	constructor() {
		// Initialize cookie storage with localStorage persistence
		this.cookieStorage = new CookieStorage();
	}

	addLog(entry: LogEntry) {
		this.logs = [...this.logs, entry];
	}

	clearLogs() {
		this.logs = [];
	}

	/**
	 * Get all cookies as an object to send with requests
	 */
	getCookies(): HttpCookies {
		return this.cookieStorage.getAll();
	}

	/**
	 * Process Set-Cookie headers from execution result
	 */
	processCookies(cookies: Array<{ name: string; value: string }>) {
		for (const { name, value } of cookies) {
			this.cookieStorage.set(name, value);
		}
	}

	/**
	 * Clear all cookies (e.g., for logout)
	 */
	clearCookies() {
		this.cookieStorage.clear();
	}

	setWorkerReady() {
		this.isWorkerReady = true;
		this.replState = ReplState.IDLE;
	}

	setExecutionResult(result: ExecutionResult) {
		// Preserve existing HTML if the new result doesn't have HTML
		// This prevents management commands (migrate, makemigrations, createSuperuser)
		// from clearing the displayed HTML
		if (result.html === undefined && this.executionResult?.html) {
			this.executionResult = {
				...result,
				html: this.executionResult.html
			};
		} else {
			this.executionResult = result;
		}

		this.isExecuting = false;
		this.replState = ReplState.READY;

		// Automatically process any cookies returned from the execution
		if (result.cookies && result.cookies.length > 0) {
			this.processCookies(result.cookies);
		}
	}

	startExecution(clearLogs: boolean = false) {
		this.isExecuting = true;
		this.replState = ReplState.RUNNING;
		if (clearLogs) {
			this.clearLogs();
		}
	}

	resetState() {
		this.replState = ReplState.INITIALIZING;
		this.isExecuting = false;
		this.executionResult = null;
		this.logs = [];
		this.isWorkerReady = false;
	}
}

export const executionState = new ExecutionState();
