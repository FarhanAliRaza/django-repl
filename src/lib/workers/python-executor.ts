import type { WorkerRequest, WorkerResponse } from '$lib/types';
import {
	handleInit,
	handleInstallPackage,
	handleExecute,
	handleWriteFiles,
	handleRunMigrations,
	handleMakeMigrations,
	handleCreateSuperuser
} from './handlers/message-handlers';

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const { type, payload } = event.data;

	let response: WorkerResponse;

	switch (type) {
		case 'init':
			response = await handleInit();
			break;

		case 'installPackage':
			if (payload?.package) {
				response = await handleInstallPackage(payload.package);
			} else {
				response = {
					type: 'error',
					payload: { message: 'No package name provided' }
				};
			}
			break;

		case 'execute':
			response = await handleExecute(payload);
			break;

		case 'writeFiles':
			if (payload?.files) {
				response = await handleWriteFiles(payload.files);
			} else {
				response = {
					type: 'error',
					payload: { message: 'No files provided' }
				};
			}
			break;

		case 'runMigrations':
			if (payload?.files) {
				response = await handleRunMigrations(payload.files);
			} else {
				response = {
					type: 'error',
					payload: { message: 'No files provided for migrations' }
				};
			}
			break;

		case 'makeMigrations':
			if (payload?.files) {
				response = await handleMakeMigrations(payload.files);
			} else {
				response = {
					type: 'error',
					payload: { message: 'No files provided for migrations' }
				};
			}
			break;

		case 'createSuperuser':
			if (payload?.files && payload?.username && payload?.email && payload?.password) {
				response = await handleCreateSuperuser(
					payload.files,
					payload.username,
					payload.email,
					payload.password
				);
			} else {
				response = {
					type: 'error',
					payload: { message: 'Missing required fields for superuser creation' }
				};
			}
			break;

		default:
			response = {
				type: 'error',
				payload: { message: `Unknown message type: ${type}` }
			};
	}

	self.postMessage(response);
};
