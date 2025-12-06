<script lang="ts">
	import { executionState, ReplState } from '$lib/stores/execution.svelte';
	import type { LogEntry } from '$lib/types';
	import { Terminal, Database, DatabaseBackup, UserPlus, Trash2 } from '@lucide/svelte';

	interface Props {
		onRunMigrations?: () => void;
		onMakeMigrations?: () => void;
		onCreateSuperuser?: () => void;
	}

	let { onRunMigrations, onMakeMigrations, onCreateSuperuser }: Props = $props();

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}

	function getLogClass(type: LogEntry['type']): string {
		switch (type) {
			case 'success':
				return 'log-success';
			case 'error':
				return 'log-error';
			case 'warning':
				return 'log-warning';
			default:
				return 'log-info';
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

	let disabled = $derived.by(() => {
		if (executionState.replState == ReplState.READY || executionState.replState == ReplState.IDLE) {
			return false;
		}
		return true;
	});
</script>

<div class="console">
	<div class="console-header">
		<div class="console-title">
			<Terminal class="size-4" />
			<span>Console</span>
		</div>
		<div class="console-actions">
			<button class="action-btn" onclick={handleMakeMigrations} {disabled}>
				<DatabaseBackup class="size-3.5" />
				<span>Make Migrations</span>
			</button>
			<button class="action-btn" onclick={handleMigrate} {disabled}>
				<Database class="size-3.5" />
				<span>Migrate</span>
			</button>
			<button
				class="action-btn superuser-btn"
				onclick={handleCreateSuperuser}
				{disabled}
			>
				<UserPlus class="size-3.5" />
				<span>Create Superuser</span>
			</button>
			<button class="action-btn clear-btn" onclick={clearConsole}>
				<Trash2 class="size-3.5" />
				<span>Clear</span>
			</button>
		</div>
	</div>
	<div class="console-content">
		{#if executionState.logs.length === 0}
			<div class="empty-state">
				<Terminal class="size-8 opacity-40" />
				<p>No logs yet. Run your Django app to see output.</p>
			</div>
		{:else}
			{#each executionState.logs as log, index (index)}
				<div class="log-entry {getLogClass(log.type)}">
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
		background: var(--background);
		color: var(--foreground);
	}

	.console-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: var(--card);
		border-bottom: 1px solid var(--border);
		font-size: 13px;
	}

	.console-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
		color: var(--muted-foreground);
	}

	.console-actions {
		display: flex;
		gap: 6px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--secondary);
		border: 1px solid var(--border);
		color: var(--secondary-foreground);
		padding: 5px 10px;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--accent);
		border-color: var(--border);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.superuser-btn {
		background: oklch(0.527 0.154 150.069);
		border-color: oklch(0.527 0.154 150.069);
		color: white;
	}

	.superuser-btn:hover:not(:disabled) {
		background: oklch(0.577 0.174 150.069);
		border-color: oklch(0.577 0.174 150.069);
	}

	.clear-btn {
		background: transparent;
		border-color: var(--border);
		color: var(--muted-foreground);
	}

	.clear-btn:hover:not(:disabled) {
		background: var(--destructive);
		border-color: var(--destructive);
		color: white;
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		height: 100%;
		color: var(--muted-foreground);
		font-style: italic;
		padding: 20px;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
	}

	.log-entry {
		margin: 4px 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.log-success {
		color: oklch(0.696 0.17 162.48);
	}

	.log-error {
		color: var(--destructive);
	}

	.log-warning {
		color: oklch(0.828 0.189 84.429);
	}

	.log-info {
		color: var(--muted-foreground);
	}

	.log-time {
		color: var(--muted-foreground);
		opacity: 0.7;
		margin-right: 8px;
	}

	.log-message {
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.console-content::-webkit-scrollbar {
		width: 8px;
	}

	.console-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.console-content::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 4px;
	}

	.console-content::-webkit-scrollbar-thumb:hover {
		background: var(--muted-foreground);
	}
</style>
