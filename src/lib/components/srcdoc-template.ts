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
		console.log('IFrame srcdoc loaded');

		// Listen for messages from parent
		window.addEventListener('message', (event) => {
			// Ignore messages without data
			if (!event.data || typeof event.data !== 'object') {
				return;
			}

			console.log('IFrame received message:', event.data.type);

			if (event.data.type === 'update') {
				console.log('Updating content, HTML length:', event.data.html?.length);
				// Update the content
				document.getElementById('content').innerHTML = event.data.html;
				console.log('Content updated');
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

		// Signal that iframe is ready
		window.parent.postMessage({ type: 'ready' }, '*');
	</script>
</body>
</html>
`;
