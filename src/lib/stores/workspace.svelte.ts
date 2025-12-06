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
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                min-height: 100vh;
                background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                max-width: 520px;
                width: 100%;
                background: linear-gradient(160deg, rgba(30, 27, 75, 0.9) 0%, rgba(49, 46, 129, 0.8) 50%, rgba(30, 27, 75, 0.9) 100%);
                padding: 48px;
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
                backdrop-filter: blur(12px);
            }
            .logo {
                width: 48px;
                height: 48px;
                margin-bottom: 24px;
                fill: #10b981;
                filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.4));
            }
            h1 {
                color: #f8fafc;
                font-size: 1.875rem;
                font-weight: 700;
                margin-bottom: 16px;
                letter-spacing: -0.025em;
            }
            .subtitle {
                color: #94a3b8;
                font-size: 1rem;
                line-height: 1.7;
                margin-bottom: 12px;
            }
            .highlight {
                color: #c4b5fd;
                font-weight: 600;
            }
            .links {
                display: flex;
                gap: 12px;
                margin: 28px 0;
            }
            .link {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 20px;
                border-radius: 12px;
                font-size: 0.875rem;
                font-weight: 600;
                text-decoration: none;
                transition: all 0.2s ease;
            }
            .link-primary {
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                color: white;
                box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
            }
            .link-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255,255,255,0.2);
            }
            .link-secondary {
                background: rgba(255, 255, 255, 0.08);
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.12);
            }
            .link-secondary:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .info-card {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%);
                border: 1px solid rgba(16, 185, 129, 0.25);
                border-radius: 16px;
                padding: 20px;
                margin-top: 24px;
            }
            .info-card p {
                color: #a7f3d0;
                font-size: 0.875rem;
                line-height: 1.6;
            }
            .info-card code {
                background: rgba(0, 0, 0, 0.3);
                padding: 2px 8px;
                border-radius: 6px;
                font-family: 'SF Mono', Monaco, monospace;
                color: #fde68a;
            }
            .footer {
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid rgba(255, 255, 255, 0.08);
                text-align: center;
            }
            .footer a {
                color: #818cf8;
                text-decoration: none;
                font-weight: 500;
                transition: color 0.2s;
            }
            .footer a:hover { color: #a5b4fc; }
            .footer span { color: #64748b; font-size: 0.875rem; }
        </style>
    </head>
    <body>
        <div class="container">
            <svg class="logo" viewBox="0 0 24 24">
                <path d="M11.146 0h3.924v18.166c-2.013.382-3.491.535-5.096.535-4.791 0-7.288-2.166-7.288-6.32 0-4.002 2.65-6.6 6.753-6.6.637 0 1.121.05 1.707.203zm0 9.143a3.894 3.894 0 00-1.325-.204c-1.988 0-3.134 1.223-3.134 3.365 0 2.09 1.096 3.236 3.109 3.236.433 0 .79-.025 1.35-.102V9.142zM21.314 6.06v9.098c0 3.134-.229 4.638-.917 5.937-.637 1.249-1.478 2.039-3.211 2.905l-3.644-1.733c1.733-.815 2.574-1.53 3.109-2.625.561-1.121.739-2.421.739-5.835V6.059h3.924zM17.39.021h3.924v4.026H17.39z"/>
            </svg>
            <h1>Django Playground</h1>
            <p class="subtitle">Django running in your browser using Pyodide. Edit the code and see changes instantly!</p>
            <p class="subtitle">Try modifying <span class="highlight">myapp/views.py</span> to change this page!</p>

            <div class="links">
                <a href="/about/" class="link link-primary">About</a>
                <a href="/admin/" class="link link-secondary">Admin Panel</a>
            </div>

            <div class="info-card">
                <p>Run the <strong>Migrate</strong> button first to create tables. Then click <strong>Create Superuser</strong> to set up admin access.</p>
                <p style="margin-top: 12px;"><strong>Login:</strong> <code>admin</code> / <code>admin</code></p>
            </div>

            <div class="footer">
                <span>Built by </span><a href="#" onclick="window.top.open('https://www.linkedin.com/in/farhanaliraza', '_blank'); return false;">Farhan Ali Raza</a>
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            max-width: 560px;
            width: 100%;
            background: linear-gradient(160deg, rgba(30, 27, 75, 0.9) 0%, rgba(49, 46, 129, 0.8) 50%, rgba(30, 27, 75, 0.9) 100%);
            padding: 48px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            backdrop-filter: blur(12px);
        }
        h1 {
            color: #f8fafc;
            font-size: 1.875rem;
            font-weight: 700;
            margin-bottom: 32px;
            letter-spacing: -0.025em;
        }
        h2 {
            color: #a5b4fc;
            font-size: 0.875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 20px;
        }
        ul {
            list-style: none;
            margin-bottom: 32px;
        }
        li {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 20px;
            margin-bottom: 12px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 14px;
            color: #e2e8f0;
            font-size: 0.9375rem;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        li:hover {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.12) 100%);
            border-color: rgba(99, 102, 241, 0.3);
            transform: translateX(4px);
        }
        li::before {
            content: '';
            width: 8px;
            height: 8px;
            background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
            border-radius: 50%;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }
        .back-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            color: #e2e8f0;
            font-size: 0.875rem;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
        }
        .back-link:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateX(-4px);
        }
        .back-link::before {
            content: '\\2190';
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>{{ title }}</h1>
        <h2>Features</h2>
        <ul>
            {% for feature in features %}
            <li>{{ feature }}</li>
            {% endfor %}
        </ul>
        <a href="/" class="back-link">Back to Home</a>
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
	projectName = $state<string>('Django Playground');
	fileReloadTrigger = $state<number>(0); // Increments when files are bulk loaded

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

	// Serialize workspace to JSON for sharing
	toJSON(): { name: string; files: Record<string, string> } {
		return {
			name: this.projectName,
			files: this.getFiles()
		};
	}

	// Load workspace from JSON (for shared projects)
	fromJSON(data: { name: string; files: Record<string, string> }) {
		this.projectName = data.name;
		this.files = { ...data.files };
		this.fileReloadTrigger++; // Trigger editor reload for currently open file

		// Set first Python file as current file if current file doesn't exist
		if (!this.files[this.currentFile]) {
			const pythonFiles = Object.keys(this.files).filter((path) => path.endsWith('.py'));
			if (pythonFiles.length > 0) {
				this.currentFile = pythonFiles[0];
			}
		}
	}

	// Update project name
	setProjectName(name: string) {
		this.projectName = name;
	}
}

export const workspaceState = new WorkspaceState();
