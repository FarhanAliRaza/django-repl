// File types
export interface FileNode {
	name: string;
	path: string;
	type: 'file' | 'directory';
	content?: string;
	children?: FileNode[];
}

// HTTP types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface HttpHeaders {
	[key: string]: string;
}

export interface HttpCookies {
	[key: string]: string;
}

// Execution types
export interface ExecutionResult {
	success: boolean;
	output: string;
	error?: string;
	html?: string;
	logs: LogEntry[];
	cookies?: Array<{ name: string; value: string }>; // Cookies to set
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
		method?: HttpMethod; // HTTP method for the request
		headers?: HttpHeaders; // HTTP headers
		body?: string | Record<string, any>; // Request body (POST data)
		cookies?: HttpCookies; // Cookies to send with request
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
