/* Mountain Kings : mise en cache pour un démarrage rapide et des mises à jour automatiques. */
const CACHE = 'mk-4e3e38507a';
const MCACHE = 'mk-models-9968e1eb54';
const CORE = ["./", "game.js", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "lib/GLTFLoader.js", "lib/SkeletonUtils.js", "lib/three.min.js", "manifest.json", "thumbs/archer.png", "thumbs/belier.png", "thumbs/berserker.png", "thumbs/chasseresse.png", "thumbs/fantassin.png", "thumbs/roi.png"];
const MODELS = ["models/atlas.png", "models/barbarian.json", "models/barracks.json", "models/castle.json", "models/church.json", "models/destroyed.json", "models/fence.json", "models/hills_A.json", "models/hills_C.json", "models/knight.json", "models/lumbermill.json", "models/market.json", "models/mine.json", "models/mountain_A.json", "models/mountain_B.json", "models/mountain_C.json", "models/orc_barbarian.png", "models/orc_rogue.png", "models/rock_A.json", "models/rock_C.json", "models/rock_E.json", "models/rogue.json", "models/scaffolding.json", "models/stone.json", "models/tavern.json", "models/tower_A.json", "models/tower_B.json", "models/tower_catapult.json", "models/tree_A.json", "models/tree_B.json", "models/trees_A_large.json", "models/trees_A_medium.json", "models/trees_B_large.json", "models/troll.png", "models/windmill.json"];
self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(CORE.map(u => u === 'game.js' ? 'game.js?v=4e3e38507a' : u))),
    // Les modèles 3D ne changent presque jamais : ils restent en cache d'une version à l'autre.
    caches.open(MCACHE).then(c => Promise.all(MODELS.map(u => c.match(u).then(r => r || c.add(u))))),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== MCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json')) {
      // La page d'abord depuis le réseau, pour recevoir les mises à jour ; sinon depuis le cache.
      e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./'))));
      return;
    }
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { if (n.ok) { const c = n.clone(); caches.open(CACHE).then(k => k.put(req, c)); } return n; })));
    return;
  }
  if (LIBS.test(req.url)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const c = n.clone(); caches.open(CACHE).then(k => k.put(req, c)); return n; })));
  }
});
