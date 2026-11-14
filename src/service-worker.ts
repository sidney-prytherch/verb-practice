/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Makes the app installable and lets it work offline.
 *
 * Every built file, static file and page is cached when a new version installs.
 * Pages are fetched from the network first (so updates show up when online) and
 * fall back to the cache when offline; built files are served from the cache.
 */

import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `verb-practice-${version}`;

// paths are relative to the base path (e.g. /verb-practice on GitHub Pages),
// which is where this service worker's scope starts
const toUrl = (path: string) => new URL(path.replace(/^\//, ''), self.registration.scope).href;

const PRECACHE = [...immutable, ...assets, ...prerendered]
  .map((f) => f.path as string)
  .filter((path) => !/(^|\/)\./.test(path)) // skip dotfiles like .nojekyll
  .map(toUrl);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // one file failing to download shouldn't stop the rest from being cached
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      const isPage = request.mode === 'navigate';

      // built files never change within a version: use the cached copy
      if (cached && !isPage) return cached;

      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch (error) {
        // offline
        if (cached) return cached;
        if (isPage) {
          const home = await cache.match(toUrl('/'));
          if (home) return home;
        }
        throw error;
      }
    })()
  );
});
