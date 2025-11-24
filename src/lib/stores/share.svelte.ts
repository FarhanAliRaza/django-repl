/**
 * Share state management using Svelte 5 runes
 * Handles debounced hash updates and share status
 */

import { generateShareableUrl, parseShareableUrl } from '$lib/utils/share';

class ShareState {
	isSharedProject = $state<boolean>(false);
	isGeneratingShareLink = $state<boolean>(false);
	lastGeneratedUrl = $state<string | null>(null);
	hashUpdateTimeout: number | null = null;

	/**
	 * Mark current project as loaded from a shared link
	 */
	markAsShared() {
		this.isSharedProject = true;
	}

	/**
	 * Mark current project as local (not shared)
	 */
	markAsLocal() {
		this.isSharedProject = false;
	}

	/**
	 * Generate and return shareable URL
	 */
	async generateUrl(projectName: string, files: Record<string, string>): Promise<string> {
		this.isGeneratingShareLink = true;
		try {
			const url = await generateShareableUrl(projectName, files);
			this.lastGeneratedUrl = url;
			return url;
		} finally {
			this.isGeneratingShareLink = false;
		}
	}

	/**
	 * Update URL hash with current project data (debounced)
	 * This prevents excessive history pollution while typing
	 */
	updateHash(projectName: string, files: Record<string, string>, immediate: boolean = false) {
		// Clear existing timeout
		if (this.hashUpdateTimeout !== null) {
			clearTimeout(this.hashUpdateTimeout);
		}

		const update = async () => {
			try {
				const url = await generateShareableUrl(projectName, files);
				const hash = url.split('#')[1];

				if (hash) {
					// Use replaceState to avoid polluting browser history
					const newUrl = `${window.location.pathname}#${hash}`;
					window.history.replaceState({}, '', newUrl);
				}
			} catch (error) {
				console.error('Failed to update hash:', error);
			}
		};

		if (immediate) {
			update();
		} else {
			// Debounce: wait 500ms before updating
			this.hashUpdateTimeout = window.setTimeout(update, 500);
		}
	}

	/**
	 * Load project from URL hash
	 * Returns null if no hash or invalid hash
	 */
	async loadFromHash(): Promise<{ name: string; files: Record<string, string> } | null> {
		const hash = window.location.hash;

		if (!hash || hash === '#') {
			return null;
		}

		try {
			const data = await parseShareableUrl(hash);
			this.markAsShared();
			return data;
		} catch (error) {
			console.error('Failed to load from hash:', error);
			// Show user-friendly error
			alert(
				"Couldn't load the project from the URL. Make sure you copied the link correctly."
			);
			return null;
		}
	}

	/**
	 * Clear the URL hash
	 */
	clearHash() {
		window.history.replaceState({}, '', window.location.pathname);
	}

	/**
	 * Copy URL to clipboard
	 */
	async copyToClipboard(url: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(url);
			return true;
		} catch (error) {
			console.error('Failed to copy to clipboard:', error);
			return false;
		}
	}
}

export const shareState = new ShareState();
