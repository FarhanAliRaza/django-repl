// File types
export interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	content?: string;
	children?: FileNode[];
}

// Execution types
export interface ExecutionResult {
	success: boolean;
	output: string;
	error?: string;
	html?: string;
	logs: LogEntry[];
}

export interface LogEntry {
	timestamp: number;
	type: 'info' | 'warning' | 'error' | 'success';
	message: string;
}

// Worker message types
export interface WorkerRequest {
	type: 'init' | 'execute' | 'installPackage' | 'writeFiles';
	payload?: {
		code?: string;
		files?: Record<string, string>;
		package?: string;
		path?: string;
		skipFileWrite?: boolean; // For navigation - only execute with new path
	};
}

export interface WorkerResponse {
	type: 'ready' | 'result' | 'error' | 'log';
	payload?: ExecutionResult | LogEntry | { message: string };
}

// Django project structure
export interface DjangoProject {
	name: string;
	files: Record<string, string>;
}
