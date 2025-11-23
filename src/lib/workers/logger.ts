import type { LogEntry, WorkerResponse } from '$lib/types';

export const logs: LogEntry[] = [];

export function log(message: string, type: LogEntry['type'] = 'info', category: LogEntry['category'] = 'django') {
	const entry: LogEntry = {
		timestamp: Date.now(),
		type,
		message,
		category
	};
	logs.push(entry);

	// Worker debug logs go to browser console, Django logs go to UI
	if (category === 'worker') {
		// Log to browser console with timestamp
		const time = new Date(entry.timestamp).toLocaleTimeString();
		const prefix = `[${time}]`;

		switch (type) {
			case 'error':
				console.error(prefix, message);
				break;
			case 'warning':
				console.warn(prefix, message);
				break;
			case 'success':
			case 'info':
			default:
				console.log(prefix, message);
				break;
		}
	} else {
		// Django logs go to UI Console
		self.postMessage({
			type: 'log',
			payload: entry
		} as WorkerResponse);
	}
}

export function getLogs(): LogEntry[] {
	return [...logs];
}

export function clearLogs() {
	logs.length = 0;
}
