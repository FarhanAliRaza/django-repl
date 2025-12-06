<script lang="ts">
	import { pathState } from '$lib/stores/path-state.svelte';
	import { Lock, RefreshCw, ArrowLeft } from '@lucide/svelte';

	let inputValue = $state(pathState.currentPath);

	// Sync input with pathState changes (from link clicks)
	$effect(() => {
		inputValue = pathState.currentPath;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			navigateToPath();
		}
	}

	function navigateToPath() {
		// Ensure path starts with /
		const path = inputValue.startsWith('/') ? inputValue : '/' + inputValue;
		pathState.setPath(path);

		// Dispatch event for parent to handle
		window.dispatchEvent(
			new CustomEvent('address-bar-navigate', {
				detail: { path }
			})
		);
	}

	function handleRefresh() {
		navigateToPath();
	}

	function handleBack() {
		pathState.goBack();
		// Dispatch event to trigger navigation with the previous path
		window.dispatchEvent(
			new CustomEvent('address-bar-navigate', {
				detail: { path: pathState.currentPath }
			})
		);
	}

	let canGoBack = $derived(pathState.canGoBack);
</script>

<div class="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
	<button
		class="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
		onclick={handleBack}
		disabled={!canGoBack}
		title="Go back"
	>
		<ArrowLeft class="size-4" />
	</button>
	<div class="flex flex-1 items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 text-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
		<Lock class="size-3.5 text-emerald-500" />
		<span class="text-muted-foreground">localhost:8000</span>
		<input
			type="text"
			class="flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			placeholder="/"
		/>
	</div>
	<button
		class="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
		onclick={handleRefresh}
		title="Reload"
	>
		<RefreshCw class="size-4" />
	</button>
</div>
