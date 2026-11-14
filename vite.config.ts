import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Static files for GitHub Pages (output goes to /build).
			adapter: adapter({ fallback: '404.html' }),

			// GitHub Pages serves the site from /<repo-name>; the deploy workflow sets BASE_PATH.
			// Locally it is empty, so `yarn dev` still runs at http://localhost:5173/.
			paths: {
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`
			}
		})
	]
});
