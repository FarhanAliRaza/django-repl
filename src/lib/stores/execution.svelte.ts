import type { ExecutionResult, LogEntry } from '$lib/types';

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

	addLog(entry: LogEntry) {
		this.logs = [...this.logs, entry];
	}

	clearLogs() {
		this.logs = [];
	}

	setWorkerReady() {
		this.isWorkerReady = true;
		this.replState = ReplState.IDLE;
	}

	setExecutionResult(result: ExecutionResult) {
		this.executionResult = result;
		this.isExecuting = false;
		this.replState = ReplState.READY;
	}

	startExecution() {
		this.isExecuting = true;
		this.replState = ReplState.RUNNING;
		this.clearLogs();
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
