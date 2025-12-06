<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState, Compartment, type Extension } from '@codemirror/state';
	import { python } from '@codemirror/lang-python';
	import { html } from '@codemirror/lang-html';
	import { css } from '@codemirror/lang-css';
	import { keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { workspaceState } from '$lib/stores/workspace.svelte';
	import { FileCode, FileText, File } from '@lucide/svelte';
	import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
	import { syntaxHighlighting } from '@codemirror/language';

	// Language compartment for dynamic switching
	const languageCompartment = new Compartment();

	// Get language extension based on file extension
	function getLanguageExtension(filename: string): Extension {
		if (filename.endsWith('.py')) return python();
		if (filename.endsWith('.html')) return html();
		if (filename.endsWith('.css')) return css();
		return python(); // Default to Python for Django project
	}

	// Editor state cache - preserves undo history when switching files
	const editorStateCache = new Map<string, EditorState>();

	// Custom theme matching our shadcn dark colors
	const shadcnDarkTheme = EditorView.theme(
		{
			'&': {
				color: 'oklch(0.984 0.003 247.858)',
				backgroundColor: 'oklch(0.129 0.042 264.695)'
			},
			'.cm-content': {
				caretColor: 'oklch(0.984 0.003 247.858)'
			},
			'.cm-cursor, .cm-dropCursor': {
				borderLeftColor: 'oklch(0.984 0.003 247.858)'
			},
			'&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
				{
					backgroundColor: 'oklch(0.279 0.041 260.031)'
				},
			'.cm-panels': {
				backgroundColor: 'oklch(0.208 0.042 265.755)',
				color: 'oklch(0.984 0.003 247.858)'
			},
			'.cm-panels.cm-panels-top': {
				borderBottom: '1px solid oklch(1 0 0 / 10%)'
			},
			'.cm-panels.cm-panels-bottom': {
				borderTop: '1px solid oklch(1 0 0 / 10%)'
			},
			'.cm-searchMatch': {
				backgroundColor: 'oklch(0.828 0.189 84.429 / 25%)',
				outline: '1px solid oklch(0.828 0.189 84.429 / 40%)'
			},
			'.cm-searchMatch.cm-searchMatch-selected': {
				backgroundColor: 'oklch(0.488 0.243 264.376 / 30%)'
			},
			'.cm-activeLine': {
				backgroundColor: 'oklch(0.279 0.041 260.031 / 40%)'
			},
			'.cm-selectionMatch': {
				backgroundColor: 'oklch(0.279 0.041 260.031 / 50%)'
			},
			'&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
				backgroundColor: 'oklch(0.488 0.243 264.376 / 25%)',
				outline: '1px solid oklch(0.488 0.243 264.376 / 50%)'
			},
			'.cm-gutters': {
				backgroundColor: 'oklch(0.129 0.042 264.695)',
				color: 'oklch(0.704 0.04 256.788)',
				border: 'none',
				borderRight: '1px solid oklch(1 0 0 / 10%)'
			},
			'.cm-activeLineGutter': {
				backgroundColor: 'oklch(0.279 0.041 260.031 / 40%)'
			},
			'.cm-foldPlaceholder': {
				backgroundColor: 'transparent',
				border: 'none',
				color: 'oklch(0.704 0.04 256.788)'
			},
			'.cm-tooltip': {
				border: '1px solid oklch(1 0 0 / 10%)',
				backgroundColor: 'oklch(0.208 0.042 265.755)'
			},
			'.cm-tooltip .cm-tooltip-arrow:before': {
				borderTopColor: 'transparent',
				borderBottomColor: 'transparent'
			},
			'.cm-tooltip .cm-tooltip-arrow:after': {
				borderTopColor: 'oklch(0.208 0.042 265.755)',
				borderBottomColor: 'oklch(0.208 0.042 265.755)'
			},
			'.cm-tooltip-autocomplete': {
				'& > ul > li[aria-selected]': {
					backgroundColor: 'oklch(0.279 0.041 260.031)',
					color: 'oklch(0.984 0.003 247.858)'
				}
			}
		},
		{ dark: true }
	);

	// Dispatch custom event to trigger run
	function triggerRun() {
		window.dispatchEvent(new CustomEvent('editor-save'));
		return true; // Prevent default save dialog
	}

	let editorElement: HTMLDivElement;
	let editorView: EditorView | null = null;
	let lastLoadedFile = $state('');
	let lastReloadTrigger = $state(0); // Track last processed trigger value
	let updateTimeout: ReturnType<typeof setTimeout> | null = null;

	// Update editor when file changes or when files are bulk loaded (e.g., from share)
	$effect(() => {
		const file = workspaceState.currentFile;
		const files = workspaceState.files;
		const reloadTrigger = workspaceState.fileReloadTrigger;

		// Update editor if: file name changed OR reload trigger changed
		if (editorView && file && (file !== lastLoadedFile || reloadTrigger !== lastReloadTrigger)) {
			// Save current state to cache before switching
			if (lastLoadedFile) {
				editorStateCache.set(lastLoadedFile, editorView.state);
			}

			const previousFile = lastLoadedFile;
			lastLoadedFile = file;
			lastReloadTrigger = reloadTrigger;

			// Check if we have a cached state for the new file
			const cachedState = editorStateCache.get(file);

			if (cachedState && reloadTrigger === lastReloadTrigger) {
				// Restore cached state (preserves undo history)
				editorView.setState(cachedState);
			} else {
				// Load fresh content
				const content = files[file] || '';
				editorView.dispatch({
					changes: {
						from: 0,
						to: editorView.state.doc.length,
						insert: content
					},
					selection: { anchor: 0, head: 0 }
				});
			}

			// Switch language mode if file type changed
			const prevExt = previousFile.split('.').pop();
			const newExt = file.split('.').pop();
			if (prevExt !== newExt) {
				editorView.dispatch({
					effects: languageCompartment.reconfigure(getLanguageExtension(file))
				});
			}
		}
	});

	onMount(() => {
		const initialFile = workspaceState.currentFile;
		const initialContent = workspaceState.files[initialFile] || '';
		lastLoadedFile = initialFile;

		const state = EditorState.create({
			doc: initialContent,
			extensions: [
				basicSetup,
				languageCompartment.of(getLanguageExtension(initialFile)),
				shadcnDarkTheme,
				syntaxHighlighting(oneDarkHighlightStyle),
				highlightSelectionMatches(),
				keymap.of([
					...searchKeymap,
					indentWithTab,
					{
						key: 'Mod-s',
						run: triggerRun
					}
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const newContent = update.state.doc.toString();

						// Debounce store updates to avoid updating on every keystroke
						if (updateTimeout) {
							clearTimeout(updateTimeout);
						}
						updateTimeout = setTimeout(() => {
							workspaceState.updateFile(workspaceState.currentFile, newContent);
						}, 300);
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
				}),
				// Disable Grammarly, spell check, and other browser extensions
				EditorView.contentAttributes.of({
					'data-gramm': 'false',
					'data-gramm_editor': 'false',
					'data-enable-grammarly': 'false',
					spellcheck: 'false',
					autocorrect: 'off',
					autocapitalize: 'off'
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorElement
		});

		return () => {
			if (updateTimeout) {
				clearTimeout(updateTimeout);
			}
			editorView?.destroy();
			editorStateCache.clear();
		};
	});

	onDestroy(() => {
		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}
		editorView?.destroy();
	});
</script>

<div class="flex h-full flex-col bg-background">
	<div class="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card pr-4 text-sm">
		<div class="flex items-center gap-2 border-r border-border bg-background px-4 py-2">
			{#if workspaceState.currentFile.endsWith('.py')}
				<FileCode class="size-4 text-blue-400" />
			{:else if workspaceState.currentFile.endsWith('.html')}
				<FileText class="size-4 text-orange-400" />
			{:else}
				<File class="size-4 text-muted-foreground" />
			{/if}
			<span class="font-medium text-foreground">{workspaceState.currentFile.split('/').pop()}</span>
		</div>
		<span class="font-mono text-xs text-muted-foreground">{workspaceState.currentFile}</span>
	</div>
	<div class="editor-container flex-1 overflow-hidden" bind:this={editorElement}></div>
</div>

<style>
	.editor-container :global(.cm-editor) {
		height: 100%;
	}

	.editor-container :global(.cm-scroller) {
		font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
	}
</style>
