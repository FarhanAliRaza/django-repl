import type { WorkerRequest, WorkerResponse } from '$lib/types';
import { initializePyodide, installDjango, installPackage, setFirstLoad } from '../pyodide-manager';
import { executePython, executeDjangoView } from '../django/executor';
import { runMigrations, makeMigrations, createSuperuser } from '../django/management';
import { writeFilesToVirtualFS } from '../filesystem';
import { log, getLogs } from '../logger';

export async function handleInit(isFirstLoad?: boolean): Promise<WorkerResponse> {
	// Set the first load flag if provided
	if (isFirstLoad !== undefined) {
		setFirstLoad(isFirstLoad);
	}

	const success = await initializePyodide();
	if (success) {
		await installDjango();
		return {
			type: 'ready',
			payload: { success: true }
		};
	} else {
		return {
			type: 'ready',
			payload: { success: false }
		};
	}
}

export async function handleInstallPackage(packageName: string): Promise<WorkerResponse> {
	const success = await installPackage(packageName);
	if (success) {
		return {
			type: 'result',
			payload: {
				success: true,
				output: `Package ${packageName} installed successfully`,
				logs: getLogs()
			}
		};
	} else {
		return {
			type: 'error',
			payload: {
				message: `Failed to install ${packageName}`
			}
		};
	}
}

export async function handleExecute(payload: WorkerRequest['payload']): Promise<WorkerResponse> {
	if (payload?.files) {
		// Execute Django project with optional path
		const path = payload.path || '/';
		const skipFileWrite = payload.skipFileWrite || false;
		const method = payload.method || 'GET';
		const headers = payload.headers || {};
		const body = payload.body || '';
		const cookies = payload.cookies || {};
		const isStaticFileRequest = payload.isStaticFileRequest || false;

		const result = await executeDjangoView(
			payload.files,
			path,
			skipFileWrite,
			method,
			headers,
			body,
			cookies,
			isStaticFileRequest
		);
		return {
			type: 'result',
			payload: result
		};
	} else if (payload?.code) {
		// Execute plain Python code
		const result = await executePython(payload.code);
		return {
			type: 'result',
			payload: result
		};
	}

	return {
		type: 'error',
		payload: {
			message: 'No files or code provided for execution'
		}
	};
}

export async function handleWriteFiles(files: Record<string, string>): Promise<WorkerResponse> {
	const success = await writeFilesToVirtualFS(files);
	return {
		type: 'result',
		payload: {
			success,
			output: success ? 'Files written successfully' : 'Failed to write files',
			logs: getLogs()
		}
	};
}

export async function handleRunMigrations(files: Record<string, string>): Promise<WorkerResponse> {
	const result = await runMigrations(files);
	return {
		type: 'result',
		payload: result
	};
}

export async function handleMakeMigrations(
	files: Record<string, string>
): Promise<WorkerResponse> {
	const result = await makeMigrations(files);
	return {
		type: 'result',
		payload: result
	};
}

export async function handleCreateSuperuser(
	files: Record<string, string>,
	username: string,
	email: string,
	password: string
): Promise<WorkerResponse> {
	const result = await createSuperuser(files, username, email, password);
	return {
		type: 'result',
		payload: result
	};
}
