import type { LogEntry, WorkerResponse } from '$lib/types';

export const logs: LogEntry[] = [];

export function log(message: string, type: LogEntry['type'] = 'info') {
	const entry: LogEntry = {
		timestamp: Date.now(),
		type,
		message
	};
	logs.push(entry);
	self.postMessage({
		type: 'log',
		payload: entry
	} as WorkerResponse);
}

export function getLogs(): LogEntry[] {
	return [...logs];
}

export function clearLogs() {
	logs.length = 0;
}
