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

<div class="flex h-full flex-col bg-background text-foreground">
	<div class="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Terminal class="size-4" />
			<span>Console</span>
		</div>
		<div class="flex gap-1.5">
			<button
				class="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
				onclick={handleMakeMigrations}
				{disabled}
			>
				<DatabaseBackup class="size-3" />
				<span class="hidden sm:inline">Make Migrations</span>
			</button>
			<button
				class="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
				onclick={handleMigrate}
				{disabled}
			>
				<Database class="size-3" />
				<span class="hidden sm:inline">Migrate</span>
			</button>
			<button
				class="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
				onclick={handleCreateSuperuser}
				{disabled}
			>
				<UserPlus class="size-3" />
				<span class="hidden sm:inline">Superuser</span>
			</button>
			<button
				class="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
				onclick={clearConsole}
			>
				<Trash2 class="size-3" />
			</button>
		</div>
	</div>
	<div class="flex-1 overflow-y-auto p-3 font-mono text-sm leading-relaxed">
		{#if executionState.logs.length === 0}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
				<Terminal class="size-8 opacity-40" />
				<p class="text-sm">No logs yet</p>
			</div>
		{:else}
			{#each executionState.logs as log, index (index)}
				<div class="my-1 whitespace-pre-wrap break-words {getLogClass(log.type)}">
					<span class="mr-2 text-muted-foreground/70">[{formatTime(log.timestamp)}]</span>
					<span>{log.message}</span>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.log-success { color: oklch(0.696 0.17 162.48); }
	.log-error { color: var(--destructive); }
	.log-warning { color: oklch(0.828 0.189 84.429); }
	.log-info { color: var(--muted-foreground); }
</style>
