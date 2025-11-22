<script lang="ts">
	import type { FileNode } from '$lib/types';

	interface Props {
		node: FileNode;
		depth: number;
		expandedDirs: Set<string>;
		currentFile: string;
		toggleDir: (path: string) => void;
		selectFile: (path: string) => void;
		handleContextMenu: (event: MouseEvent, node: FileNode) => void;
	}

	let { node, depth, expandedDirs, currentFile, toggleDir, selectFile, handleContextMenu }: Props =
		$props();

	function getIcon(node: FileNode): string {
		if (node.type === 'directory') {
			return expandedDirs.has(node.path) ? '📂' : '📁';
		}
		if (node.name.endsWith('.py')) return '🐍';
		if (node.name.endsWith('.html')) return '📄';
		if (node.name === '.gitkeep') return '👻';
		return '📝';
	}

	const isExpanded = $derived(expandedDirs.has(node.path));
	const isActive = $derived(currentFile === node.path);
	const paddingLeft = $derived(12 + depth * 16);
</script>

{#if node.type === 'directory'}
	<div class="tree-node">
		<button
			class="node-button directory"
			class:expanded={isExpanded}
			style="padding-left: {paddingLeft}px"
			onclick={() => toggleDir(node.path)}
			oncontextmenu={(e) => handleContextMenu(e, node)}
		>
			<span class="icon">{getIcon(node)}</span>
			<span class="name">{node.name}</span>
		</button>
		{#if isExpanded && node.children}
			{#each node.children as child}
				<svelte:self
					node={child}
					depth={depth + 1}
					{expandedDirs}
					{currentFile}
					{toggleDir}
					{selectFile}
					{handleContextMenu}
				/>
			{/each}
		{/if}
	</div>
{:else}
	<button
		class="node-button file"
		class:active={isActive}
		style="padding-left: {paddingLeft}px"
		onclick={() => selectFile(node.path)}
		oncontextmenu={(e) => handleContextMenu(e, node)}
	>
		<span class="icon">{getIcon(node)}</span>
		<span class="name">{node.name}</span>
	</button>
{/if}

<style>
	.tree-node {
		display: flex;
		flex-direction: column;
	}

	.node-button {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 4px 12px;
		background: transparent;
		border: none;
		color: #cccccc;
		cursor: pointer;
		font-size: 13px;
		text-align: left;
		transition: background 0.1s;
	}

	.node-button:hover {
		background: #2a2d2e;
	}

	.node-button.active {
		background: #094771;
		color: #ffffff;
	}

	.icon {
		margin-right: 6px;
		font-size: 14px;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
