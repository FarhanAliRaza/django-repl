<script lang="ts">
	import { onMount } from 'svelte';
	import { executionState } from '$lib/stores/execution.svelte';
	import { pathState } from '$lib/stores/path-state.svelte';
	import Console from './Console.svelte';
	import AddressBar from './AddressBar.svelte';
	import { srcdocTemplate } from './srcdoc-template';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import { Rocket, AlertCircle } from '@lucide/svelte';

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
				iframeReady = true;

				// If we already have HTML when iframe becomes ready, send it immediately
				if (iframeElement && executionState.executionResult?.html) {
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
		if (iframeElement && hasHtml && iframeReady) {
			try {
				const message = {
					type: 'update',
					html: executionState.executionResult?.html || '',
					currentPath: pathState.currentPath
				};
				iframeElement.contentWindow?.postMessage(message, '*');
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

<div class="h-full w-full bg-background">
	<Resizable.PaneGroup direction="vertical">
		<Resizable.Pane defaultSize={70}>
			<div class="flex h-full w-full flex-col overflow-hidden bg-white">
				<AddressBar />
				<div class="relative flex-1 overflow-hidden">
					{#if hasHtml}
						<iframe
							bind:this={iframeElement}
							title="Django Output"
							srcdoc={srcdocTemplate}
							sandbox="allow-scripts allow-forms allow-same-origin"
							class="h-full w-full border-none bg-white"
						></iframe>
					{:else if executionState.executionResult?.error}
						<div class="h-full overflow-y-auto bg-background p-6 text-destructive">
							<div class="mb-4 flex items-center gap-2">
								<AlertCircle class="size-5" />
								<h3 class="text-base font-semibold">Error</h3>
							</div>
							<pre class="overflow-x-auto rounded-md border-l-2 border-destructive bg-card p-4 font-mono text-sm leading-relaxed text-foreground">{executionState.executionResult.error}</pre>
						</div>
					{:else}
						<div class="flex h-full flex-col items-center justify-center gap-5 bg-background p-10 text-center">
							<Rocket class="size-12 text-muted-foreground/30" />
							<div>
								<h3 class="mb-2 text-lg font-semibold text-foreground">Ready to Run</h3>
								<p class="text-sm text-muted-foreground">Click the "Run" button to execute your Django application.</p>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</Resizable.Pane>
		<Resizable.Handle withHandle={true} />
		<Resizable.Pane defaultSize={30} minSize={20}>
			<Console {onRunMigrations} {onMakeMigrations} {onCreateSuperuser} />
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>
