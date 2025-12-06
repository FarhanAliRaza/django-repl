<script lang="ts">
	import type { FileNode } from '$lib/types';
	import {
		Folder,
		FolderOpen,
		FileCode,
		FileText,
		File,
		ChevronRight,
		ChevronDown
	} from '@lucide/svelte';

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

	const isExpanded = $derived(expandedDirs.has(node.path));
	const isActive = $derived(currentFile === node.path);
	const paddingLeft = $derived(8 + depth * 16);
</script>

{#if node.type === 'directory'}
	<div class="tree-node">
		<button
			class="node-button directory group"
			class:expanded={isExpanded}
			style="padding-left: {paddingLeft}px"
			onclick={() => toggleDir(node.path)}
			oncontextmenu={(e) => handleContextMenu(e, node)}
		>
			<span class="chevron">
				{#if isExpanded}
					<ChevronDown class="size-3.5 text-muted-foreground" />
				{:else}
					<ChevronRight class="size-3.5 text-muted-foreground" />
				{/if}
			</span>
			<span class="icon">
				{#if isExpanded}
					<FolderOpen class="size-4 text-amber-400" />
				{:else}
					<Folder class="size-4 text-amber-400" />
				{/if}
			</span>
			<span class="name">{node.name}</span>
		</button>
		{#if isExpanded && node.children}
			{#each node.children.filter((child) => child.name !== '.gitkeep') as child}
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
		class="node-button file group"
		class:active={isActive}
		style="padding-left: {paddingLeft + 18}px"
		onclick={() => selectFile(node.path)}
		oncontextmenu={(e) => handleContextMenu(e, node)}
	>
		<span class="icon">
			{#if node.name.endsWith('.py')}
				<FileCode class="size-4 text-blue-400" />
			{:else if node.name.endsWith('.html')}
				<FileText class="size-4 text-orange-400" />
			{:else if node.name === '.gitkeep'}
				<File class="size-4 text-muted-foreground/50" />
			{:else}
				<File class="size-4 text-muted-foreground" />
			{/if}
		</span>
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
		padding: 5px 8px;
		background: transparent;
		border: none;
		color: var(--foreground);
		cursor: pointer;
		font-size: 13px;
		text-align: left;
		transition: background 0.15s ease;
		border-radius: 4px;
		margin: 1px 4px;
		width: calc(100% - 8px);
	}

	.node-button:hover {
		background: var(--accent);
	}

	.node-button.active {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	.chevron {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 2px;
		flex-shrink: 0;
	}

	.icon {
		display: flex;
		align-items: center;
		margin-right: 8px;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
