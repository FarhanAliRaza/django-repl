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
    'django.contrib.admin',
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'myapp',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'myproject.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'myproject.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/db.sqlite3',  # Absolute path in Pyodide virtual filesystem
    }
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
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

	'myapp/apps.py': `from django.apps import AppConfig


class MyappConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'myapp'
`,

	'myapp/models.py': `from django.db import models


# Create your models here.
class Blog(models.Model):

  title = models.CharField(max_length=255)
`,

	'myapp/admin.py': `from django.contrib import admin

# Register your models here.
from  myapp.models import Blog 


admin.site.register(Blog)

`,

	'myapp/migrations/__init__.py': '',

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
               Run the migrate button first so tables are created in local db. Then click Create Superuer button to create the superuser.
                <strong>Admin Login:</strong> username: <code>admin</code> | password: <code>admin</code>
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
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('myapp.urls')),
]
`
};

// Workspace state management using Svelte 5 runes
class WorkspaceState {
	files = $state<Record<string, string>>(defaultDjangoProject);
	currentFile = $state<string>('myapp/views.py');

	// Derived file tree structure
	fileTree = $derived.by(() => {
		const tree: FileNode[] = [];
		const pathMap = new Map<string, FileNode>();

		// Sort files by path
		const sortedPaths = Object.keys(this.files).sort();

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
						content: isFile ? this.files[path] : undefined,
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

		// Sort function: directories first, then files, both alphabetically
		const sortNodes = (nodes: FileNode[]): FileNode[] => {
			return nodes.sort((a, b) => {
				// Directories come before files
				if (a.type === 'directory' && b.type === 'file') return -1;
				if (a.type === 'file' && b.type === 'directory') return 1;
				// Within same type, sort alphabetically by name
				return a.name.localeCompare(b.name);
			});
		};

		// Recursively sort all levels of the tree
		const sortTreeRecursive = (nodes: FileNode[]): FileNode[] => {
			const sorted = sortNodes(nodes);
			for (const node of sorted) {
				if (node.children) {
					node.children = sortTreeRecursive(node.children);
				}
			}
			return sorted;
		};

		return sortTreeRecursive(tree);
	});

	reset() {
		this.files = { ...defaultDjangoProject };
	}

	updateFile(path: string, content: string) {
		this.files = { ...this.files, [path]: content };
	}

	addFile(path: string, content: string = '') {
		this.files = { ...this.files, [path]: content };
	}

	deleteFile(path: string) {
		const newFiles = { ...this.files };
		delete newFiles[path];
		this.files = newFiles;
	}

	// Get all files as a plain object (for worker communication)
	getFiles(): Record<string, string> {
		// Defensive check: ensure files is an object
		if (!this.files || typeof this.files !== 'object') {
			console.error('[WorkspaceState] Invalid files state:', this.files);
			return {};
		}

		// Use $state.snapshot() to extract plain values from Svelte reactive state
		// This is the proper Svelte 5 way to remove Proxies
		const snapshot = $state.snapshot(this.files);

		return snapshot;
	}
}

export const workspaceState = new WorkspaceState();
