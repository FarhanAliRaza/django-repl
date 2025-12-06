class PathState {
	currentPath = $state('/');
	private history: string[] = $state(['/']);
	private historyIndex = $state(0);

	get canGoBack() {
		return this.historyIndex > 0;
	}

	setPath(path: string) {
		// Only add to history if it's a different path
		if (path !== this.currentPath) {
			// If we're not at the end of history, truncate forward history
			if (this.historyIndex < this.history.length - 1) {
				this.history = this.history.slice(0, this.historyIndex + 1);
			}
			this.history.push(path);
			this.historyIndex = this.history.length - 1;
		}
		this.currentPath = path;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('django-playground-path', path);
		}
	}

	goBack() {
		if (this.canGoBack) {
			this.historyIndex--;
			this.currentPath = this.history[this.historyIndex];
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem('django-playground-path', this.currentPath);
			}
		}
	}

	loadFromLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('django-playground-path');
			if (saved) {
				this.currentPath = saved;
				this.history = [saved];
				this.historyIndex = 0;
			}
		}
	}
}

export const pathState = new PathState();
