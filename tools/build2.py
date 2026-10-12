"""Construit le nouveau jeu (village commun) : sources src2/ -> docs/v2/ (adresse de test).
Usage : python3 tools/build2.py [--test]   (--test : faux Firebase pour les essais locaux)
Les bibliothèques (docs/lib), les modèles de l'ancien jeu (docs/models) et les icônes (docs/icons) sont partagés."""
import json, os, sys, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
D = ROOT + 'src2/'
TEST = '--test' in sys.argv
# Les essais se construisent à part (.test/), pour ne jamais salir le site publié.
SITE = ROOT + ('.test/v2/' if TEST else 'docs/v2/')
if TEST:
    os.makedirs(ROOT + '.test', exist_ok=True)
    for d in ('lib', 'models', 'icons'):
        if not os.path.exists(ROOT + '.test/' + d): os.symlink(ROOT + 'docs/' + d, ROOT + '.test/' + d)
    os.makedirs(SITE, exist_ok=True)
    if not os.path.exists(SITE + 'models'): os.symlink(ROOT + 'docs/v2/models', SITE + 'models')
sys.path.insert(0, ROOT + 'tools'); import rules as RULES

rd = lambda p: open(p, encoding='utf-8').read()
head = rd(D + 'p1_head.html')
# ordre : Firebase, règles du village, équipement, raids, règles et combat des donjons, rendu 3D, sons, interface des donjons, de l'équipement, des raids, interface
js = "(() => {\n'use strict';\n" + "\n".join(rd(D + f) for f in ['p0_fb.js', 'p2_rules.js', 'p2e_equip.js', 'p2g_garnison.js', 'p2r_raid.js', 'p2d_donjon.js', 'p3_render.js', 'p5_audio.js', 'p4d_donjon.js', 'p4e_equip.js', 'p4r_raid.js', 'p4g_garnison.js', 'p4_app.js']) + "\n})();\n"
build = hashlib.sha1(js.encode()).hexdigest()[:10]
if not TEST: os.makedirs(SITE + 'models', exist_ok=True)
if os.path.exists(SITE + 'fakefb.js'): os.remove(SITE + 'fakefb.js')
open(SITE + 'game.js', 'w', encoding='utf-8').write(js)

manifest = {
    'name': 'Mountain Kings (essai)', 'short_name': 'MK essai', 'lang': 'fr',
    'description': 'Le nouveau Mountain Kings : un village commun, un héros chacun.',
    'id': './', 'start_url': './', 'scope': './',
    'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'],
    'orientation': 'landscape', 'background_color': '#0F1613', 'theme_color': '#16201C', 'categories': ['games'],
    'icons': [
        {'src': '../icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': '../icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': '../icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
json.dump(manifest, open(SITE + 'manifest.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

FBV = '10.12.2'
fb = ''.join(f'<script src="https://www.gstatic.com/firebasejs/{FBV}/firebase-{m}-compat.js"></script>\n' for m in ('app', 'auth', 'database'))
if TEST: fb = '<script>window.MK_TEST = true;</script>\n<script src="fakefb.js"></script>\n'
i = head.index('</style>') + len('</style>')
index = f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#16201C">
<meta name="description" content="Mountain Kings : un village commun, un héros chacun.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MK essai">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="../icons/favicon.png">
<link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
{head[:i]}
<style>[hidden]{{display:none!important}}img{{max-width:100%}}</style>
</head>
<body>
{head[i:].strip()}
<script src="../lib/three.min.js"></script>
<script src="../lib/GLTFLoader.js"></script>
<script src="../lib/SkeletonUtils.js"></script>
<script>window.MK_SITE = true;</script>
{fb}<script src="game.js?v={build}"></script>
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {{
  navigator.serviceWorker.register('sw.js', {{ scope: './' }}).then(r => {{
    r.addEventListener('updatefound', () => {{
      const w = r.installing;
      w && w.addEventListener('statechange', () => {{
        if (w.state === 'activated' && navigator.serviceWorker.controller) window.__mkUpdate = true;
      }});
    }});
  }}).catch(() => {{}});
  document.addEventListener('visibilitychange', () => {{
    if (document.hidden && window.__mkUpdate) location.reload();
    else if (!document.hidden) navigator.serviceWorker.getRegistration('./').then(r => r && r.update()).catch(() => {{}});
  }});
}}
</script>
</body>
</html>
'''
open(SITE + 'index.html', 'w', encoding='utf-8').write(index)

# Cache hors ligne : le jeu, les bibliothèques et les modèles partagés, puis les modèles Meshy.
DOCS = ROOT + 'docs/'
shared_models = sorted('../models/' + f for f in os.listdir(DOCS + 'models') if not f.startswith('.'))
# Seuls les modèles Meshy utilisés par le jeu (liste M2_NAMES du rendu) sont mis en cache.
import re
m2_names = re.findall(r"'([a-z_]+)'", re.search(r'const M2_NAMES = \[([^\]]*)\]', rd(D + 'p3_render.js')).group(1))
own_models = sorted('models/' + n + '.glb' for n in m2_names if os.path.exists(ROOT + 'docs/v2/models/' + n + '.glb'))
core = ['./', 'game.js?v=' + build, 'manifest.json', '../lib/three.min.js', '../lib/GLTFLoader.js', '../lib/SkeletonUtils.js',
        '../icons/icon-192.png', '../icons/favicon.png']
models = shared_models + own_models
mhash = hashlib.sha1(b''.join(open(ROOT + 'docs/v2/' + m if m.startswith('models/') else DOCS + m[3:], 'rb').read() for m in models)).hexdigest()[:10]
sw = f'''/* Mountain Kings (essai) : mise en cache pour un démarrage rapide et des mises à jour automatiques. */
const CACHE = 'mk2-{build}';
const MCACHE = 'mk2-models-{mhash}';
const CORE = {json.dumps(core)};
const MODELS = {json.dumps(models)};
self.addEventListener('install', e => {{
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(CORE)),
    caches.open(MCACHE).then(c => Promise.all(MODELS.map(u => c.match(u).then(r => r || c.add(u))))),
  ]).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mk2') && k !== CACHE && k !== MCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
const LIBS = /^https:\\/\\/(www\\.gstatic\\.com\\/firebasejs\\/|fonts\\.googleapis\\.com\\/|fonts\\.gstatic\\.com\\/)/;
self.addEventListener('fetch', e => {{
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {{
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json')) {{
      e.respondWith(fetch(req).then(r => {{ const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r; }}).catch(() => caches.match(req).then(r => r || caches.match('./'))));
      return;
    }}
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => {{ if (n.ok) {{ const c = n.clone(); caches.open(CACHE).then(k => k.put(req, c)); }} return n; }})));
    return;
  }}
  if (LIBS.test(req.url)) {{
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => {{ const c = n.clone(); caches.open(CACHE).then(k => k.put(req, c)); return n; }})));
  }}
}});
'''
open(SITE + 'sw.js', 'w', encoding='utf-8').write(sw)
if TEST:
    import shutil
    shutil.copy(ROOT + 'tools/fakefb.js', SITE + 'fakefb.js')
RULES.write(ROOT + 'database.rules.json')
total = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(SITE) for f in fs)
print('build v2', build, 'size %.1f MB' % (total / 1e6), 'test' if TEST else '')
