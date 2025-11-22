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
	status?: string; // HTTP status code (e.g., "200 OK", "302 Found")
	redirectTo?: string; // Location header for redirects
	isStaticFile?: boolean; // True if this is a static file response
	requestedPath?: string; // The path that was requested
	contentType?: string; // Content-Type header for static files
	migrationFiles?: Record<string, string>; // Generated migration files from makemigrations
}

export interface LogEntry {
	timestamp: number;
	type: 'info' | 'warning' | 'error' | 'success';
	message: string;
}

// Worker message types
export interface WorkerRequest {
	type:
		| 'init'
		| 'execute'
		| 'installPackage'
		| 'writeFiles'
		| 'runMigrations'
		| 'makeMigrations'
		| 'createSuperuser';
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
		isStaticFileRequest?: boolean; // True if requesting a static file
		username?: string;
		email?: string;
		password?: string;
	};
}

export interface WorkerResponse {
	type: 'ready' | 'result' | 'error' | 'log';
	payload?: ExecutionResult | LogEntry | { message: string } | { success: boolean };
}

// Django project structure
export interface DjangoProject {
	name: string;
	files: Record<string, string>;
}
