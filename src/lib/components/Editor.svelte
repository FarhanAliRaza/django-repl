<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { python } from '@codemirror/lang-python';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { workspaceState } from '$lib/stores/workspace.svelte';

	// Dispatch custom event to trigger run
	function triggerRun() {
		window.dispatchEvent(new CustomEvent('editor-save'));
		return true; // Prevent default save dialog
	}

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = null;
	let currentContent = $state('');
	let lastLoadedFile = $state('');

	// Update editor when file changes
	$effect(() => {
		const file = workspaceState.currentFile;
		const files = workspaceState.files;

		if (editorView && file && file !== lastLoadedFile) {
			const content = files[file] || '';
			currentContent = content;
			lastLoadedFile = file;
			editorView.dispatch({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: content
				}
			});
		}
	});

	onMount(() => {
		const initialContent = workspaceState.files[workspaceState.currentFile] || '';
		currentContent = initialContent;

		const state = EditorState.create({
			doc: initialContent,
			extensions: [
				basicSetup,
				python(),
				oneDark,
				keymap.of([
					indentWithTab,
					{
						key: 'Mod-s',
						run: triggerRun
					}
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newContent = update.state.doc.toString();
						currentContent = newContent;
						workspaceState.updateFile(workspaceState.currentFile, newContent);
					}
				}),
				EditorView.theme({
					'&': {
						height: '100%',
						fontSize: '14px'
					},
					'.cm-scroller': {
						overflow: 'auto',
						fontFamily: "'Fira Code', 'Consolas', monospace"
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorElement
		});

		return () => {
			editorView?.destroy();
		};
	});

	onDestroy(() => {
		editorView?.destroy();
	});
</script>

<div class="editor-wrapper">
	<div class="editor-header">
		<span class="file-name">{workspaceState.currentFile}</span>
	</div>
	<div class="editor-container" bind:this={editorElement}></div>
</div>

<style>
	.editor-wrapper {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #282c34;
	}

	.editor-header {
		padding: 8px 16px;
		background: #21252b;
		border-bottom: 1px solid #181a1f;
		color: #abb2bf;
		font-size: 13px;
		font-family: system-ui, -apple-system, sans-serif;
	}

	.file-name {
		color: #61afef;
	}

	.editor-container {
		flex: 1;
		overflow: hidden;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
	}

	.editor-container :global(.cm-scroller) {
		font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
	}
</style>
