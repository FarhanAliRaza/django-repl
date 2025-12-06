<script lang="ts">
	import { pathState } from '$lib/stores/path-state.svelte';
	import { Lock, RefreshCw, Globe } from '@lucide/svelte';

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
	<div class="url-container">
		<span class="lock-icon">
			<Lock class="size-3.5 text-emerald-500" />
		</span>
		<span class="host">localhost:8000</span>
		<input
			type="text"
			class="path-input"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			placeholder="/"
		/>
	</div>
	<button class="refresh-btn" onclick={handleRefresh} title="Reload">
		<RefreshCw class="size-4" />
	</button>
</div>

<style>
	.address-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: #f8f9fa;
		border-bottom: 1px solid #e5e7eb;
		font-family: system-ui, -apple-system, sans-serif;
		font-size: 13px;
	}

	.url-container {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 6px 12px;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.url-container:focus-within {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.lock-icon {
		display: flex;
		align-items: center;
	}

	.host {
		color: #6b7280;
		font-weight: 500;
		font-size: 13px;
	}

	.path-input {
		flex: 1;
		border: none;
		background: transparent;
		padding: 2px 0;
		font-size: 13px;
		font-family: 'Consolas', 'Monaco', monospace;
		outline: none;
		color: #111827;
	}

	.path-input::placeholder {
		color: #9ca3af;
	}

	.refresh-btn {
		background: transparent;
		border: 1px solid #e5e7eb;
		padding: 8px;
		cursor: pointer;
		color: #6b7280;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover {
		background: #f3f4f6;
		color: #374151;
		border-color: #d1d5db;
	}

	.refresh-btn:active {
		transform: scale(0.95);
	}
</style>
