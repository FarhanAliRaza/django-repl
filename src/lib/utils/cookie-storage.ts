import type { HttpCookies } from '$lib/types';

/**
 * Simple cookie storage for managing cookies across requests
 */
export class CookieStorage {
	private cookies = $state<Map<string, string>>(new Map());
	private storageKey = 'django-repl-cookies';

	constructor() {
		this.load();
	}

	set(name: string, value: string): void {
		this.cookies.set(name, value);
		this.save();
	}

	get(name: string): string | undefined {
		return this.cookies.get(name);
	}

	delete(name: string): void {
		this.cookies.delete(name);
		this.save();
	}

	getAll(): HttpCookies {
		const result: HttpCookies = {};
		for (const [name, value] of this.cookies.entries()) {
			result[name] = value;
		}
		return result;
	}

	clear(): void {
		this.cookies.clear();
		this.save();
	}

	private save(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			const data = Array.from(this.cookies.entries());
			localStorage.setItem(this.storageKey, JSON.stringify(data));
		} catch (e) {
			console.warn('Failed to save cookies to localStorage:', e);
		}
	}

	private load(): void {
		if (typeof localStorage === 'undefined') return;
		try {
			const data = localStorage.getItem(this.storageKey);
			if (data) {
				const parsed = JSON.parse(data) as Array<[string, string]>;
				this.cookies = new Map(parsed);
			}
		} catch (e) {
			console.warn('Failed to load cookies from localStorage:', e);
		}
	}
}
