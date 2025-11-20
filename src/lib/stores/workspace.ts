import { writable, derived } from 'svelte/store';
import type { FileNode } from '$lib/types';

// Django starter template
const defaultDjangoProject: Record<string, string> = {
	'manage.py': `#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed?"
        ) from exc
    execute_from_command_line(sys.argv)
`,

	'myproject/__init__.py': '',

	'myproject/settings.py': `"""
Django settings for browser-based playground.
"""

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SECRET_KEY = 'browser-django-playground-secret-key-change-in-production'

DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'myapp',
]

MIDDLEWARE = []

ROOT_URLCONF = 'myproject.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': False,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'myproject.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'
`,

	'myproject/urls.py': `from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('myapp.urls')),
]
`,

	'myproject/wsgi.py': `"""
WSGI config for myproject.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')

application = get_wsgi_application()
`,

	'myapp/__init__.py': '',

	'myapp/views.py': `from django.http import HttpResponse
from django.shortcuts import render

def index(request):
    """Simple homepage view"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Django Playground</title>
        <style>
            body {
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 600px;
                margin: 80px auto;
                padding: 20px;
                background: #f8f9fa;
            }
            .container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1 style="margin-top: 0; color: #1a202c; font-size: 2em;">Django Playground</h1>
            <p style="color: #4a5568; line-height: 1.6;">Django running in your browser using Pyodide. Edit the code and see changes instantly!</p>
            <p style="color: #4a5568; line-height: 1.6;">Try modifying <strong>myapp/views.py</strong> to change this page!</p>
            <p style="color: #4a5568; line-height: 1.6;">
                <a href="/about/" style="color: #0066cc; text-decoration: none; margin-right: 15px;">About</a>
                <a href="/admin/" style="color: #0066cc; text-decoration: none;">Admin Panel</a>
            </p>
            <div style="background: #f0f4f8; padding: 15px; border-radius: 8px; margin-top: 20px;">
                <p style="margin: 0; color: #2d3748; font-size: 14px;">
                    <strong>Admin Login:</strong> username: <code>admin</code> | password: <code>admin123</code>
                </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #718096;">
                Built with ❤️ by <a href="https://www.linkedin.com/in/farhanaliraza" target="_blank" style="color: #0066cc; text-decoration: none;">Farhan Ali Raza</a>
            </div>
        </div>
    </body>
    </html>
    """
    return HttpResponse(html)

def about(request):
    """About page with template example"""
    context = {
        'title': 'About Django Playground',
        'features': [
            'Run Django in the browser',
            'No server required',
            'Powered by Pyodide',
        ]
    }
    return render(request, 'about.html', context)
`,

	'myapp/urls.py': `from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('about/', views.about, name='about'),
]
`,

	'templates/about.html': `<!DOCTYPE html>
<html>
<head>
    <title>{{ title }}</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #0c4b33; }
        ul { line-height: 1.8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ title }}</h1>
        <h2>Features:</h2>
        <ul>
            {% for feature in features %}
            <li>{{ feature }}</li>
            {% endfor %}
        </ul>
        <p><a href="/">Back to Home</a></p>
    </div>
</body>
</html>
`,

	'urls.py': `# Root URL configuration (used by worker)
from myapp.urls import urlpatterns
`
};

// File management store
function createWorkspaceStore() {
	const { subscribe, set, update } = writable<Record<string, string>>(defaultDjangoProject);

	return {
		subscribe,
		reset: () => set(defaultDjangoProject),
		updateFile: (path: string, content: string) => {
			update((files) => ({ ...files, [path]: content }));
		},
		addFile: (path: string, content: string = '') => {
			update((files) => ({ ...files, [path]: content }));
		},
		deleteFile: (path: string) => {
			update((files) => {
				const newFiles = { ...files };
				delete newFiles[path];
				return newFiles;
			});
		}
		// loadFromLocalStorage: () => {
		// 	if (typeof window !== 'undefined') {
		// 		const saved = localStorage.getItem('django-playground-files');
		// 		if (saved) {
		// 			try {
		// 				set(JSON.parse(saved));
		// 			} catch (e) {
		// 				console.error('Failed to load from localStorage:', e);
		// 			}
		// 		}
		// 	}
		// },
		// saveToLocalStorage: (files: Record<string, string>) => {
		// 	if (typeof window !== 'undefined') {
		// 		localStorage.setItem('django-playground-files', JSON.stringify(files));
		// 	}
		// }
	};
}

export const workspaceFiles = createWorkspaceStore();

// Current file selection
export const currentFile = writable<string>('myapp/views.py');

// File tree structure derived from files
export const fileTree = derived(workspaceFiles, ($files) => {
	const tree: FileNode[] = [];
	const pathMap = new Map<string, FileNode>();

	// Sort files by path
	const sortedPaths = Object.keys($files).sort();

	for (const path of sortedPaths) {
		const parts = path.split('/');
		let currentPath = '';

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;
			currentPath += (i > 0 ? '/' : '') + part;

			if (!pathMap.has(currentPath)) {
				const node: FileNode = {
					name: part,
					path: currentPath,
					type: isFile ? 'file' : 'directory',
					content: isFile ? $files[path] : undefined,
					children: isFile ? undefined : []
				};

				if (i === 0) {
					tree.push(node);
				} else {
					const parentPath = parts.slice(0, i).join('/');
					const parent = pathMap.get(parentPath);
					if (parent?.children) {
						parent.children.push(node);
					}
				}

				pathMap.set(currentPath, node);
			}
		}
	}

	return tree;
});
