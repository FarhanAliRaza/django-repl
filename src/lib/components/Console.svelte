<script lang="ts">
	import { executionState } from '$lib/stores/execution.svelte';
	import type { LogEntry } from '$lib/types';

	interface Props {
		onRunMigrations?: () => void;
		onMakeMigrations?: () => void;
		onCreateSuperuser?: () => void;
	}

	let { onRunMigrations, onMakeMigrations, onCreateSuperuser }: Props = $props();

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}

	function getLogColor(type: LogEntry['type']): string {
		switch (type) {
			case 'success':
				return '#4ec9b0';
			case 'error':
				return '#f48771';
			case 'warning':
				return '#dcdcaa';
			default:
				return '#abb2bf';
		}
	}

	function clearConsole() {
		executionState.clearLogs();
	}

	function handleMigrate() {
		if (onRunMigrations) {
			onRunMigrations();
		}
	}

	function handleMakeMigrations() {
		if (onMakeMigrations) {
			onMakeMigrations();
		}
	}

	function handleCreateSuperuser() {
		if (onCreateSuperuser) {
			onCreateSuperuser();
		}
	}
</script>

<div class="console">
	<div class="console-header">
		<span>Console</span>
		<div class="console-actions">
			<button class="action-btn django-btn" onclick={handleMakeMigrations}>
				Make Migrations
			</button>
			<button class="action-btn django-btn" onclick={handleMigrate}>Migrate</button>
			<button class="action-btn django-btn superuser-btn" onclick={handleCreateSuperuser}>
				Create Superuser
			</button>
			<button class="action-btn clear-btn" onclick={clearConsole}>Clear</button>
		</div>
	</div>
	<div class="console-content">
		{#if executionState.logs.length === 0}
			<div class="empty-state">No logs yet. Run your Django app to see output.</div>
		{:else}
			{#each executionState.logs as log, index (index)}
				<div class="log-entry" style="color: {getLogColor(log.type)}">
					<span class="log-time">[{formatTime(log.timestamp)}]</span>
					<span class="log-message">{log.message}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.console {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #1e1e1e;
		color: #d4d4d4;
	}

	.console-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 16px;
		background: #252526;
		border-bottom: 1px solid #3e3e42;
		font-size: 13px;
	}

	.console-actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		background: transparent;
		border: 1px solid #3e3e42;
		color: #d4d4d4;
		padding: 4px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.action-btn:hover {
		background: #3e3e42;
		border-color: #565656;
	}

	.django-btn {
		background: #0e639c;
		border-color: #1177bb;
		color: #ffffff;
	}

	.django-btn:hover {
		background: #1177bb;
		border-color: #1890d5;
	}

	.superuser-btn {
		background: #44a047;
		border-color: #5cb85c;
	}

	.superuser-btn:hover {
		background: #5cb85c;
		border-color: #6ec071;
	}

	.console-content {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 13px;
		line-height: 1.6;
	}

	.empty-state {
		color: #6a6a6a;
		font-style: italic;
		padding: 20px;
		text-align: center;
	}

	.log-entry {
		margin: 4px 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.log-time {
		color: #6a6a6a;
		margin-right: 8px;
	}

	.log-message {
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.console-content::-webkit-scrollbar {
		width: 10px;
	}

	.console-content::-webkit-scrollbar-track {
		background: #1e1e1e;
	}

	.console-content::-webkit-scrollbar-thumb {
		background: #424242;
		border-radius: 5px;
	}

	.console-content::-webkit-scrollbar-thumb:hover {
		background: #4e4e4e;
	}
</style>
