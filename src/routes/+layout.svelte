<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// resolve() adds the base path (e.g. /verb-practice) when hosted on GitHub Pages
	const links = [
		{ href: resolve('/'), label: 'Crossword' },
		{ href: resolve('/dictionary'), label: 'Dictionary' },
		{ href: resolve('/settings'), label: 'Settings' }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	{#each links as link}
		<a href={link.href} aria-current={page.url.pathname.replace(/\/$/, '') === link.href.replace(/\/$/, '') ? 'page' : undefined}>
			{link.label}
		</a>
	{/each}
</nav>

{@render children()}

<style>
	:global(body) {
		margin: 0;
	}
	nav {
		display: flex;
		gap: 0.25rem;
		max-width: 72rem;
		margin: 0 auto;
		padding: 1rem 1.5rem 0;
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
	}
	a {
		padding: 0.4rem 0.9rem;
		border-radius: 6px;
		color: #374151;
		text-decoration: none;
		font-weight: 500;
	}
	a:hover {
		background: #f3f4f6;
	}
	a[aria-current='page'] {
		background: #2563eb;
		color: #fff;
	}
	@media (max-width: 700px) {
		nav {
			padding: 0.5rem 0.75rem 0;
		}
		a {
			flex: 1;
			text-align: center;
			padding: 0.5rem 0.25rem;
		}
	}
</style>
