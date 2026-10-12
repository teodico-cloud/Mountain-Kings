/* Mountain Kings (essai) : mise en cache pour un démarrage rapide et des mises à jour automatiques. */
const CACHE = 'mk2-ac2d3c42e2';
const MCACHE = 'mk2-models-83744f3adc';
const CORE = ["./", "game.js?v=ac2d3c42e2", "manifest.json", "../lib/three.min.js", "../lib/GLTFLoader.js", "../lib/SkeletonUtils.js", "../icons/icon-192.png", "../icons/favicon.png"];
const MODELS = ["../models/atlas.png", "../models/barbarian.json", "../models/barracks.json", "../models/castle.json", "../models/church.json", "../models/destroyed.json", "../models/fence.json", "../models/hills_A.json", "../models/hills_C.json", "../models/knight.json", "../models/lumbermill.json", "../models/market.json", "../models/mine.json", "../models/mountain_A.json", "../models/mountain_B.json", "../models/mountain_C.json", "../models/orc_barbarian.png", "../models/orc_rogue.png", "../models/rock_A.json", "../models/rock_C.json", "../models/rock_E.json", "../models/rogue.json", "../models/scaffolding.json", "../models/stone.json", "../models/tavern.json", "../models/tower_A.json", "../models/tower_B.json", "../models/tower_catapult.json", "../models/tree_A.json", "../models/tree_B.json", "../models/trees_A_large.json", "../models/trees_A_medium.json", "../models/trees_B_large.json", "../models/troll.png", "../models/windmill.json", "models/chantier.glb", "models/halle.glb", "models/taverne.glb"];
self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(CORE)),
    caches.open(MCACHE).then(c => Promise.all(MODELS.map(u => c.match(u).then(r => r || c.add(u))))),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mk2') && k !== CACHE && k !== MCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json')) {
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
