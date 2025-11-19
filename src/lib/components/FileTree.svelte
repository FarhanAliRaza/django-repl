<script lang="ts">
	import { fileTree, currentFile } from '$lib/stores/workspace';
	import type { FileNode } from '$lib/types';

	let expandedDirs = new Set<string>(['myproject', 'myapp', 'templates']);

	function toggleDir(path: string) {
		if (expandedDirs.has(path)) {
			expandedDirs.delete(path);
		} else {
			expandedDirs.add(path);
		}
		expandedDirs = expandedDirs;
	}

	function selectFile(path: string) {
		currentFile.set(path);
	}

	function getIcon(node: FileNode): string {
		if (node.type === 'directory') {
			return expandedDirs.has(node.path) ? '📂' : '📁';
		}
		if (node.name.endsWith('.py')) return '🐍';
		if (node.name.endsWith('.html')) return '📄';
		return '📝';
	}
</script>

<div class="file-tree">
	<div class="file-tree-header">
		<span>Files</span>
	</div>
	<div class="file-tree-content">
		{#each $fileTree as node}
			<div class="tree-node">
				{#if node.type === 'directory'}
					<div class="directory" class:expanded={expandedDirs.has(node.path)}>
						<button class="node-button" onclick={() => toggleDir(node.path)}>
							<span class="icon">{getIcon(node)}</span>
							<span class="name">{node.name}</span>
						</button>
						{#if expandedDirs.has(node.path) && node.children}
							<div class="children">
								{#each node.children as child}
									{#if child.type === 'directory'}
										<div class="directory" class:expanded={expandedDirs.has(child.path)}>
											<button class="node-button nested" onclick={() => toggleDir(child.path)}>
												<span class="icon">{getIcon(child)}</span>
												<span class="name">{child.name}</span>
											</button>
											{#if expandedDirs.has(child.path) && child.children}
												<div class="children">
													{#each child.children as grandchild}
														<button
															class="node-button file nested-2"
															class:active={$currentFile === grandchild.path}
															onclick={() => selectFile(grandchild.path)}
														>
															<span class="icon">{getIcon(grandchild)}</span>
															<span class="name">{grandchild.name}</span>
														</button>
													{/each}
												</div>
											{/if}
										</div>
									{:else}
										<button
											class="node-button file nested"
											class:active={$currentFile === child.path}
											onclick={() => selectFile(child.path)}
										>
											<span class="icon">{getIcon(child)}</span>
											<span class="name">{child.name}</span>
										</button>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<button
						class="node-button file"
						class:active={$currentFile === node.path}
						onclick={() => selectFile(node.path)}
					>
						<span class="icon">{getIcon(node)}</span>
						<span class="name">{node.name}</span>
					</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

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
		padding: 10px 12px;
		background: #2d2d30;
		border-bottom: 1px solid #3e3e42;
		font-size: 13px;
		font-weight: 500;
		text-transform: uppercase;
		color: #999;
	}

	.file-tree-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.tree-node {
		margin: 0;
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

	.node-button.nested {
		padding-left: 28px;
	}

	.node-button.nested-2 {
		padding-left: 44px;
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

	.children {
		margin: 0;
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
</style>
