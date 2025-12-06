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

<div class="flex items-center gap-2 border-b bg-white px-3 py-2">
	<button
		class="flex size-8 items-center justify-center rounded-md border text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
		onclick={handleBack}
		disabled={!canGoBack}
		title="Go back"
	>
		<ArrowLeft class="size-4" />
	</button>
	<div class="flex flex-1 items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
		<Lock class="size-3.5 text-emerald-500" />
		<span class="text-gray-500">localhost:8000</span>
		<input
			type="text"
			class="flex-1 bg-transparent font-mono text-sm text-gray-900 outline-none placeholder:text-gray-400"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			placeholder="/"
		/>
	</div>
	<button
		class="flex size-8 items-center justify-center rounded-md border text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
		onclick={handleRefresh}
		title="Reload"
	>
		<RefreshCw class="size-4" />
	</button>
</div>
