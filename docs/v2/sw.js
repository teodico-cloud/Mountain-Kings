/* Ancienne adresse d'essai : ce service se retire tout seul (le jeu est maintenant à l'adresse principale). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));
