class PathState {
	currentPath = $state('/');

	setPath(path: string) {
		this.currentPath = path;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('django-playground-path', path);
		}
	}

	loadFromLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('django-playground-path');
			if (saved) {
				this.currentPath = saved;
			}
		}
	}
}

export const pathState = new PathState();
