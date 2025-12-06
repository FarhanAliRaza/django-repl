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
	<div class="flex flex-col">
		<button
			class="mx-1 my-px flex w-[calc(100%-8px)] items-center rounded py-1 pr-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
			style="padding-left: {paddingLeft}px"
			onclick={() => toggleDir(node.path)}
			oncontextmenu={(e) => handleContextMenu(e, node)}
		>
			<span class="mr-0.5 flex shrink-0 items-center justify-center">
				{#if isExpanded}
					<ChevronDown class="size-3.5 text-muted-foreground" />
				{:else}
					<ChevronRight class="size-3.5 text-muted-foreground" />
				{/if}
			</span>
			<span class="mr-2 flex shrink-0 items-center">
				{#if isExpanded}
					<FolderOpen class="size-4 text-amber-400" />
				{:else}
					<Folder class="size-4 text-amber-400" />
				{/if}
			</span>
			<span class="flex-1 truncate">{node.name}</span>
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
		class="mx-1 my-px flex w-[calc(100%-8px)] items-center rounded py-1 pr-2 text-left text-sm transition-colors {isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'}"
		style="padding-left: {paddingLeft + 18}px"
		onclick={() => selectFile(node.path)}
		oncontextmenu={(e) => handleContextMenu(e, node)}
	>
		<span class="mr-2 flex shrink-0 items-center">
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
		<span class="flex-1 truncate">{node.name}</span>
	</button>
{/if}
