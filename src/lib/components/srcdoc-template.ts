export const srcdocTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* {
			box-sizing: border-box;
		}
		body {
			margin: 0;
			padding: 0;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		}
	</style>
</head>
<body>
	<div id="content"></div>
	<script>

		// Track the current Django path (received from parent)
		let currentPath = '/';

		// Listen for messages from parent
		window.addEventListener('message', (event) => {
			// Ignore messages without data
			if (!event.data || typeof event.data !== 'object') {
				return;
			}


			if (event.data.type === 'update') {
				// Update the current path if provided
				if (event.data.currentPath) {
					currentPath = event.data.currentPath;
				}
				// Update the content
				document.getElementById('content').innerHTML = event.data.html;
			}
		});

		// Intercept link clicks
		document.body.addEventListener('click', (event) => {
			// Only handle left clicks
			if (event.which !== 1) return;

			// Allow modifier keys to open in new tab
			if (event.metaKey || event.ctrlKey || event.shiftKey) return;

			// Already prevented
			if (event.defaultPrevented) return;

			// Find the anchor tag
			let el = event.target;
			while (el && el.nodeName !== 'A') {
				el = el.parentNode;
			}

			// Not a link
			if (!el || el.nodeName !== 'A') return;

			// Skip special links
			if (
				el.hasAttribute('download') ||
				el.getAttribute('rel') === 'external' ||
				el.target
			) {
				return;
			}

			// Prevent default navigation
			event.preventDefault();

			// Get the href
			const href = el.getAttribute('href');

			// Handle hash links (internal navigation)
			if (href && href.startsWith('#')) {
				window.location.hash = href;
				return;
			}

			// Send path to parent for Django to handle
			if (href) {
				window.parent.postMessage({
					type: 'navigate',
					path: href
				}, '*');
			}
		});

		// Intercept form submissions - use capture phase to ensure we catch it
		document.addEventListener('submit', (event) => {
			// Find the form element
			let form = event.target;
			if (!form || form.nodeName !== 'FORM') return;

			// Prevent default form submission
			event.preventDefault();
			event.stopPropagation();

			// Get form details - use tracked currentPath instead of window.location.pathname
			const action = form.getAttribute('action') || currentPath;
			const method = (form.getAttribute('method') || 'GET').toUpperCase();

			// Collect form data
			const formData = new FormData(form);
			const formObject = {};
			const headers = {};

			// Convert FormData to plain object and extract CSRF token
			let csrfToken = null;
			for (const [key, value] of formData.entries()) {
				formObject[key] = value;
				if (key === 'csrfmiddlewaretoken') {
					csrfToken = value;
				}
			}

			// Set content type and CSRF header for POST requests
			if (method === 'POST') {
				headers['Content-Type'] = 'application/x-www-form-urlencoded';
				// Add CSRF token as header (Django checks this)
				if (csrfToken) {
					headers['X-CSRFToken'] = csrfToken;
				}
				// Set referer to make Django's CSRF middleware happy
				headers['Referer'] = window.location.href || 'http://localhost:8000';
			}

			

			// Send form submission to parent for Django to handle
			window.parent.postMessage({
				type: 'formSubmit',
				path: action,
				method: method,
				body: formObject,
				headers: headers
			}, '*');
		}, true);

		// Signal that iframe is ready
		window.parent.postMessage({ type: 'ready' }, '*');
	</script>
</body>
</html>
`;
