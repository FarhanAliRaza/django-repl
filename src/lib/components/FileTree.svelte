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

<div class="file-tree" oncontextmenu={handleRootContextMenu}>
	<div class="file-tree-header">
		<span class="header-title">Explorer</span>
		<div class="header-actions">
			<button
				class="icon-button"
				title="New File"
				onclick={(e) => {
					e.stopPropagation();
					startNewFile();
				}}
			>
				<FilePlus class="size-4" />
			</button>
			<button
				class="icon-button"
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
	<div class="file-tree-content">
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
		class="context-menu"
		style="left: {contextMenuX}px; top: {contextMenuY}px;"
		onclick={(e) => e.stopPropagation()}
	>
		{#if contextMenuIsDir}
			<button
				class="context-menu-item"
				onclick={() => startNewFile(contextMenuPath)}
			>
				<FilePlus class="size-4" />
				<span>New File</span>
			</button>
			<button
				class="context-menu-item"
				onclick={() => startNewFolder(contextMenuPath)}
			>
				<FolderPlus class="size-4" />
				<span>New Folder</span>
			</button>
			<div class="context-menu-divider"></div>
		{/if}
		<button
			class="context-menu-item danger"
			onclick={() => deleteItem(contextMenuPath)}
		>
			<Trash2 class="size-4" />
			<span>Delete</span>
		</button>
	</div>
{/if}

<!-- New Item Dialog -->
{#if showNewItemDialog}
	<div class="dialog-overlay" onclick={() => (showNewItemDialog = false)}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<h3>New {newItemType === 'file' ? 'File' : 'Folder'}</h3>
			<input
				type="text"
				placeholder={newItemType === 'file' ? 'filename.py' : 'foldername'}
				bind:value={newItemName}
				onkeydown={handleKeydown}
				autofocus
			/>
			{#if newItemParentPath}
				<p class="parent-path">in: {newItemParentPath}/</p>
			{/if}
			<div class="dialog-actions">
				<button class="btn-secondary" onclick={() => (showNewItemDialog = false)}>
					Cancel
				</button>
				<button class="btn-primary" onclick={createNewItem}>Create</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.file-tree {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--sidebar);
		color: var(--sidebar-foreground);
		user-select: none;
	}

	.file-tree-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 12px;
		background: var(--sidebar);
		border-bottom: 1px solid var(--sidebar-border);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.header-actions {
		display: flex;
		gap: 2px;
	}

	.icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		padding: 6px;
		border-radius: var(--radius-sm);
		transition: all 0.15s ease;
	}

	.icon-button:hover {
		background: var(--sidebar-accent);
		color: var(--sidebar-accent-foreground);
	}

	.file-tree-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.file-tree-content::-webkit-scrollbar {
		width: 8px;
	}

	.file-tree-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.file-tree-content::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 4px;
	}

	.file-tree-content::-webkit-scrollbar-thumb:hover {
		background: var(--muted-foreground);
	}

	/* Context Menu */
	.context-menu {
		position: fixed;
		background: var(--popover);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24);
		z-index: 1000;
		min-width: 180px;
		padding: 4px;
	}

	.context-menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: var(--popover-foreground);
		text-align: left;
		cursor: pointer;
		font-size: 13px;
		border-radius: var(--radius-sm);
		transition: background 0.15s ease;
	}

	.context-menu-item:hover {
		background: var(--accent);
	}

	.context-menu-item.danger {
		color: var(--destructive);
	}

	.context-menu-item.danger:hover {
		background: oklch(0.577 0.245 27.325 / 15%);
	}

	.context-menu-divider {
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	/* Dialog */
	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		backdrop-filter: blur(2px);
	}

	.dialog {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 24px;
		min-width: 400px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
	}

	.dialog h3 {
		margin: 0 0 16px 0;
		color: var(--card-foreground);
		font-size: 16px;
		font-weight: 600;
	}

	.dialog input {
		width: 100%;
		padding: 10px 12px;
		background: var(--input);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--foreground);
		font-size: 14px;
		font-family: 'Consolas', 'Monaco', monospace;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.dialog input:focus {
		outline: none;
		border-color: var(--ring);
		box-shadow: 0 0 0 2px oklch(from var(--ring) l c h / 25%);
	}

	.parent-path {
		margin: 8px 0 0 0;
		color: var(--muted-foreground);
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 10px 18px;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.btn-primary {
		background: var(--primary);
		color: var(--primary-foreground);
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		background: var(--secondary);
		color: var(--secondary-foreground);
	}

	.btn-secondary:hover {
		opacity: 0.9;
	}
</style>
