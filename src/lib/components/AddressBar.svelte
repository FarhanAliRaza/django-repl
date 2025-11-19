<script lang="ts">
	import { pathState } from '$lib/stores/path-state.svelte';

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
</script>

<div class="address-bar">
	<span class="lock-icon">🔒</span>
	<span class="host">localhost:8000</span>
	<input
		type="text"
		class="path-input"
		bind:value={inputValue}
		onkeydown={handleKeydown}
		placeholder="/"
	/>
	<button class="refresh-btn" onclick={handleRefresh} title="Reload">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
		</svg>
	</button>
</div>

<style>
	.address-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #f5f5f5;
		border-bottom: 1px solid #d4d4d4;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 13px;
	}

	.lock-icon {
		font-size: 14px;
		opacity: 0.6;
	}

	.host {
		color: #666;
		font-weight: 500;
	}

	.path-input {
		flex: 1;
		border: none;
		background: white;
		padding: 6px 10px;
		border-radius: 4px;
		font-size: 13px;
		font-family: 'Consolas', 'Monaco', monospace;
		outline: none;
		border: 1px solid #d4d4d4;
	}

	.path-input:focus {
		border-color: #007acc;
		box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
	}

	.refresh-btn {
		background: transparent;
		border: none;
		padding: 6px;
		cursor: pointer;
		color: #666;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.refresh-btn:hover {
		background: #e4e4e4;
		color: #333;
	}

	.refresh-btn:active {
		transform: scale(0.95);
	}
</style>
