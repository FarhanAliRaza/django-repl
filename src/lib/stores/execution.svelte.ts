import type { ExecutionResult, LogEntry, HttpCookies } from '$lib/types';
import { CookieJar } from '@pyodide/http-adapter';

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
	cookieJar: CookieJar;

	constructor() {
		// Initialize cookie jar with localStorage persistence
		this.cookieJar = new CookieJar(
			'django-repl-cookies',
			typeof localStorage !== 'undefined' ? localStorage : undefined
		);
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
		return this.cookieJar.getAll();
	}

	/**
	 * Process Set-Cookie headers from execution result
	 */
	processCookies(cookies: Array<{ name: string; value: string }>) {
		for (const { name, value } of cookies) {
			this.cookieJar.set(name, value);
		}
	}

	/**
	 * Clear all cookies (e.g., for logout)
	 */
	clearCookies() {
		this.cookieJar.clear();
	}

	setWorkerReady() {
		this.isWorkerReady = true;
		this.replState = ReplState.IDLE;
	}

	setExecutionResult(result: ExecutionResult) {
		this.executionResult = result;
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
