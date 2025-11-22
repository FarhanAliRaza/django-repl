<script lang="ts">
	import { workspaceState } from '$lib/stores/workspace.svelte';
	import type { FileNode } from '$lib/types';
	import TreeNode from './TreeNode.svelte';

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

	function toggleDir(path: string) {
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
		<span>FILES</span>
		<div class="header-actions">
			<button
				class="icon-button"
				title="New File"
				onclick={(e) => {
					e.stopPropagation();
					startNewFile();
				}}
			>
				📄
			</button>
			<button
				class="icon-button"
				title="New Folder"
				onclick={(e) => {
					e.stopPropagation();
					startNewFolder();
				}}
			>
				📁
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
				New File
			</button>
			<button
				class="context-menu-item"
				onclick={() => startNewFolder(contextMenuPath)}
			>
				New Folder
			</button>
			<div class="context-menu-divider"></div>
		{/if}
		<button
			class="context-menu-item danger"
			onclick={() => deleteItem(contextMenuPath)}
		>
			Delete
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
		background: #252526;
		color: #cccccc;
		user-select: none;
	}

	.file-tree-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: #2d2d30;
		border-bottom: 1px solid #3e3e42;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		color: #999;
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-button {
		background: transparent;
		border: none;
		color: #cccccc;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 14px;
		transition: background 0.1s;
	}

	.icon-button:hover {
		background: #3e3e42;
	}

	.file-tree-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.file-tree-content::-webkit-scrollbar {
		width: 10px;
	}

	.file-tree-content::-webkit-scrollbar-track {
		background: #252526;
	}

	.file-tree-content::-webkit-scrollbar-thumb {
		background: #424242;
		border-radius: 5px;
	}

	.file-tree-content::-webkit-scrollbar-thumb:hover {
		background: #4e4e4e;
	}

	/* Context Menu */
	.context-menu {
		position: fixed;
		background: #2d2d30;
		border: 1px solid #3e3e42;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		min-width: 180px;
		padding: 4px 0;
	}

	.context-menu-item {
		display: block;
		width: 100%;
		padding: 8px 16px;
		background: transparent;
		border: none;
		color: #cccccc;
		text-align: left;
		cursor: pointer;
		font-size: 13px;
		transition: background 0.1s;
	}

	.context-menu-item:hover {
		background: #094771;
	}

	.context-menu-item.danger {
		color: #f48771;
	}

	.context-menu-item.danger:hover {
		background: #5a1d1d;
	}

	.context-menu-divider {
		height: 1px;
		background: #3e3e42;
		margin: 4px 0;
	}

	/* Dialog */
	.dialog-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.dialog {
		background: #2d2d30;
		border: 1px solid #3e3e42;
		border-radius: 6px;
		padding: 20px;
		min-width: 400px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	.dialog h3 {
		margin: 0 0 16px 0;
		color: #cccccc;
		font-size: 16px;
	}

	.dialog input {
		width: 100%;
		padding: 8px 12px;
		background: #1e1e1e;
		border: 1px solid #3e3e42;
		border-radius: 4px;
		color: #cccccc;
		font-size: 14px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.dialog input:focus {
		outline: none;
		border-color: #007acc;
	}

	.parent-path {
		margin: 8px 0 0 0;
		color: #999;
		font-size: 12px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.dialog-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		margin-top: 16px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: background 0.1s;
	}

	.btn-primary {
		background: #0e639c;
		color: #ffffff;
	}

	.btn-primary:hover {
		background: #1177bb;
	}

	.btn-secondary {
		background: #3e3e42;
		color: #cccccc;
	}

	.btn-secondary:hover {
		background: #505050;
	}
</style>
