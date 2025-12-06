<script lang="ts">
	import { workspaceState } from '$lib/stores/workspace.svelte';
	import type { FileNode } from '$lib/types';
	import TreeNode from './TreeNode.svelte';
	import { FilePlus, FolderPlus, Trash2 } from '@lucide/svelte';

	let expandedDirs = $state(
		new Set<string>(['myproject', 'myapp', 'myapp/migrations', 'templates'])
	);

	let showContextMenu = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuPath = $state('');
	let contextMenuIsDir = $state(false);

	let showNewItemDialog = $state(false);
	let newItemType: 'file' | 'folder' = $state('file');
	let newItemName = $state('');
	let newItemParentPath = $state('');

	// Track the last clicked folder for creating new files/folders
	let lastClickedFolder = $state<string>('');

	function toggleDir(path: string) {
		// Track the clicked folder
		lastClickedFolder = path;

		if (expandedDirs.has(path)) {
			expandedDirs.delete(path);
		} else {
			expandedDirs.add(path);
		}
		// Trigger reactivity
		expandedDirs = new Set(expandedDirs);
	}

	function selectFile(path: string) {
		workspaceState.currentFile = path;

		// Update lastClickedFolder to the parent directory of the selected file
		const lastSlashIndex = path.lastIndexOf('/');
		lastClickedFolder = lastSlashIndex > 0 ? path.substring(0, lastSlashIndex) : '';
	}

	function handleContextMenu(event: MouseEvent, node: FileNode) {
		event.preventDefault();
		event.stopPropagation();

		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		contextMenuPath = node.path;
		contextMenuIsDir = node.type === 'directory';
		showContextMenu = true;
	}

	function handleRootContextMenu(event: MouseEvent) {
		event.preventDefault();
		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		contextMenuPath = '';
		contextMenuIsDir = true;
		showContextMenu = true;
	}

	function hideContextMenu() {
		showContextMenu = false;
	}

	function getCurrentFileDirectory(): string {
		// Prioritize the last clicked folder over the current file's directory
		if (lastClickedFolder) {
			return lastClickedFolder;
		}

		// Get the directory of the currently open file
		const currentFile = workspaceState.currentFile;
		if (!currentFile) return '';

		const lastSlashIndex = currentFile.lastIndexOf('/');
		return lastSlashIndex > 0 ? currentFile.substring(0, lastSlashIndex) : '';
	}

	function startNewFile(parentPath: string | null = null) {
		newItemType = 'file';
		// If parentPath is explicitly provided (from context menu), use it
		// Otherwise, use the directory of the currently open file
		newItemParentPath = parentPath !== null ? parentPath : getCurrentFileDirectory();
		newItemName = '';
		showNewItemDialog = true;
		showContextMenu = false;
	}

	function startNewFolder(parentPath: string | null = null) {
		newItemType = 'folder';
		// If parentPath is explicitly provided (from context menu), use it
		// Otherwise, use the directory of the currently open file
		newItemParentPath = parentPath !== null ? parentPath : getCurrentFileDirectory();
		newItemName = '';
		showNewItemDialog = true;
		showContextMenu = false;
	}

	function createNewItem() {
		if (!newItemName.trim()) return;

		const fullPath = newItemParentPath
			? `${newItemParentPath}/${newItemName.trim()}`
			: newItemName.trim();

		if (newItemType === 'file') {
			workspaceState.addFile(fullPath, '');
			workspaceState.currentFile = fullPath;
		} else {
			// Create a folder by adding a placeholder .gitkeep file
			workspaceState.addFile(`${fullPath}/.gitkeep`, '');
			// Expand the new folder
			expandedDirs.add(fullPath);
			expandedDirs = new Set(expandedDirs);
		}

		showNewItemDialog = false;
		newItemName = '';
	}

	function deleteItem(path: string) {
		if (confirm(`Are you sure you want to delete ${path}?`)) {
			// If it's a directory, delete all files inside it
			const filesToDelete = Object.keys(workspaceState.files).filter(
				(filePath) => filePath === path || filePath.startsWith(path + '/')
			);

			filesToDelete.forEach((filePath) => {
				workspaceState.deleteFile(filePath);
			});

			// If the deleted file was selected, select another file
			if (workspaceState.currentFile === path || workspaceState.currentFile.startsWith(path + '/')) {
				const remainingFiles = Object.keys(workspaceState.files);
				if (remainingFiles.length > 0) {
					workspaceState.currentFile = remainingFiles[0];
				}
			}
		}
		showContextMenu = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			showNewItemDialog = false;
			newItemName = '';
		} else if (event.key === 'Enter') {
			createNewItem();
		}
	}

	// Close context menu when clicking outside
	function handleWindowClick() {
		hideContextMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="flex h-full flex-col bg-sidebar text-sidebar-foreground select-none" oncontextmenu={handleRootContextMenu}>
	<div class="flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
		<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Explorer</span>
		<div class="flex gap-0.5">
			<button
				class="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				title="New File"
				onclick={(e) => {
					e.stopPropagation();
					startNewFile();
				}}
			>
				<FilePlus class="size-4" />
			</button>
			<button
				class="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				title="New Folder"
				onclick={(e) => {
					e.stopPropagation();
					startNewFolder();
				}}
			>
				<FolderPlus class="size-4" />
			</button>
		</div>
	</div>
	<div class="flex-1 overflow-y-auto py-2">
		{#each workspaceState.fileTree as node}
			<TreeNode
				{node}
				depth={0}
				{expandedDirs}
				currentFile={workspaceState.currentFile}
				{toggleDir}
				{selectFile}
				{handleContextMenu}
			/>
		{/each}
	</div>
</div>

<!-- Context Menu -->
{#if showContextMenu}
	<div
		class="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		onclick={(e) => e.stopPropagation()}
	>
		{#if contextMenuIsDir}
			<button
				class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent"
				onclick={() => startNewFile(contextMenuPath)}
			>
				<FilePlus class="size-4" />
				<span>New File</span>
			</button>
			<button
				class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent"
				onclick={() => startNewFolder(contextMenuPath)}
			>
				<FolderPlus class="size-4" />
				<span>New Folder</span>
			</button>
			<div class="my-1 h-px bg-border"></div>
		{/if}
		<button
			class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
			onclick={() => deleteItem(contextMenuPath)}
		>
			<Trash2 class="size-4" />
			<span>Delete</span>
		</button>
	</div>
{/if}

<!-- New Item Dialog -->
{#if showNewItemDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick={() => (showNewItemDialog = false)}>
		<div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg" onclick={(e) => e.stopPropagation()}>
			<h3 class="mb-4 text-base font-semibold text-card-foreground">New {newItemType === 'file' ? 'File' : 'Folder'}</h3>
			<input
				type="text"
				class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
				placeholder={newItemType === 'file' ? 'filename.py' : 'foldername'}
				bind:value={newItemName}
				onkeydown={handleKeydown}
				autofocus
			/>
			{#if newItemParentPath}
				<p class="mt-2 font-mono text-xs text-muted-foreground">in: {newItemParentPath}/</p>
			{/if}
			<div class="mt-5 flex justify-end gap-2">
				<button class="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80" onclick={() => (showNewItemDialog = false)}>
					Cancel
				</button>
				<button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" onclick={createNewItem}>Create</button>
			</div>
		</div>
	</div>
{/if}

