<script lang="ts">
	import { onMount } from 'svelte';
	import { executionState } from '$lib/stores/execution.svelte';
	import { pathState } from '$lib/stores/path-state.svelte';
	import Console from './Console.svelte';
	import AddressBar from './AddressBar.svelte';
	import { srcdocTemplate } from './srcdoc-template';
	import * as Resizable from '$lib/components/ui/resizable/index.js';

	interface Props {
		onRunMigrations?: () => void;
		onMakeMigrations?: () => void;
		onCreateSuperuser?: () => void;
	}

	let { onRunMigrations, onMakeMigrations, onCreateSuperuser }: Props = $props();

	let iframeElement = $state<HTMLIFrameElement | null>(null);
	let iframeReady = $state(false);

	// Derived state
	let hasHtml = $derived(executionState.executionResult?.html);

	// Set up message listener once on mount
	onMount(() => {
		const handleMessage = (event: MessageEvent) => {
			if (event.data.type === 'ready') {
				console.log('IFrame is ready');
				iframeReady = true;

				// If we already have HTML when iframe becomes ready, send it immediately
				if (iframeElement && executionState.executionResult?.html) {
					console.log('Sending existing HTML to newly ready iframe');
					const message = {
						type: 'update',
						html: executionState.executionResult.html,
						currentPath: pathState.currentPath
					};
					iframeElement.contentWindow?.postMessage(message, '*');
				}
			} else if (event.data.type === 'navigate') {
				console.log('Navigation requested:', event.data.path);
				window.dispatchEvent(
					new CustomEvent('django-navigate', {
						detail: { path: event.data.path }
					})
				);
			} else if (event.data.type === 'formSubmit') {
				console.log('Form submission requested:', event.data);
				window.dispatchEvent(
					new CustomEvent('django-form-submit', {
						detail: {
							path: event.data.path,
							method: event.data.method,
							body: event.data.body,
							headers: event.data.headers
						}
					})
				);
			}
		};

		window.addEventListener('message', handleMessage);

		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});

	// Update iframe content reactively when result changes AND iframe is ready
	$effect(() => {
		console.log(
			'Effect triggered - iframeReady:',
			iframeReady,
			'iframeElement:',
			!!iframeElement,
			'hasHtml:',
			!!hasHtml
		);

		if (iframeElement && hasHtml && iframeReady) {
			try {
				const message = {
					type: 'update',
					html: executionState.executionResult?.html || '',
					currentPath: pathState.currentPath
				};
				console.log('Posting message:', message.type);

				iframeElement.contentWindow?.postMessage(message, '*');
				console.log('Message posted successfully');
			} catch (e) {
				console.error('Failed to update iframe:', e);
			}
		} else {
			if (!iframeElement) console.log('No iframe element');
			if (!hasHtml) console.log('No HTML to display');
			if (!iframeReady) console.log('IFrame not ready yet');
		}
	});
</script>

<div class="output">
	<Resizable.PaneGroup direction="vertical">
		<Resizable.Pane defaultSize={70}>
			<div class="preview">
				<AddressBar />
				<div class="preview-content">
					{#if hasHtml}
						<iframe
							bind:this={iframeElement}
							title="Django Output"
							srcdoc={srcdocTemplate}
							sandbox="allow-scripts allow-forms allow-same-origin"
							class="preview-frame"
						></iframe>
					{:else if executionState.executionResult?.error}
						<div class="error-display">
							<h3>Error</h3>
							<pre>{executionState.executionResult.error}</pre>
						</div>
					{:else}
						<div class="empty-state">
							<div class="empty-icon">🚀</div>
							<h3>Ready to Run</h3>
							<p>Click the "Run" button to execute your Django application.</p>
						</div>
					{/if}
				</div>
			</div>
		</Resizable.Pane>
		<Resizable.Handle withHandle={true} />
		<Resizable.Pane defaultSize={30} minSize={20}>
			<Console
				onRunMigrations={onRunMigrations}
				onMakeMigrations={onMakeMigrations}
				onCreateSuperuser={onCreateSuperuser}
			/>
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>

<style>
	.output {
		height: 100%;
		width: 100%;
		background: #1e1e1e;
	}

	.preview {
		height: 100%;
		width: 100%;
		background: #ffffff;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-content {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.preview-frame {
		width: 100%;
		height: 100%;
		border: none;
		background: white;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #6a6a6a;
		padding: 40px;
		text-align: center;
	}

	.empty-icon {
		font-size: 64px;
		margin-bottom: 20px;
		opacity: 0.5;
	}

	.empty-state h3 {
		color: #abb2bf;
		margin: 0 0 10px 0;
		font-size: 18px;
	}

	.empty-state p {
		color: #6a6a6a;
		margin: 0;
		font-size: 14px;
	}

	.error-display {
		padding: 20px;
		color: #f48771;
		background: #1e1e1e;
		height: 100%;
		overflow-y: auto;
	}

	.error-display h3 {
		margin-top: 0;
		color: #f48771;
	}

	.error-display pre {
		background: #252526;
		padding: 15px;
		border-radius: 4px;
		border-left: 3px solid #f48771;
		overflow-x: auto;
		font-family: 'Consolas', 'Monaco', monospace;
		font-size: 13px;
		line-height: 1.6;
	}
</style>
