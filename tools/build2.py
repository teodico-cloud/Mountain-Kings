"""Construit Mountain Kings (le jeu actuel : village commun) : sources src2/ -> docs/ (adresse principale du site).
Usage : python3 tools/build2.py [--test]   (--test : faux Firebase pour les essais locaux, construit dans .test/)
Partagés avec l'ancien jeu (docs/v1/) : les bibliothèques (docs/lib), les modèles KayKit (docs/models) et les icônes (docs/icons).
Les modèles Meshy du jeu sont dans docs/v2/models/. L'ancienne adresse d'essai (docs/v2/) renvoie vers l'adresse principale."""
import json, os, sys, hashlib, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
D = ROOT + 'src2/'
DOCS = ROOT + 'docs/'
TEST = '--test' in sys.argv
# Les essais se construisent à part (.test/, même disposition que le site), pour ne jamais salir le site publié.
SITE = ROOT + ('.test/' if TEST else 'docs/')
os.makedirs(SITE + 'v2', exist_ok=True)
if TEST:
    for d in ('lib', 'models', 'icons', 'thumbs', 'fonts'):
        if not os.path.lexists(SITE + d): os.symlink(DOCS + d, SITE + d)
    if not os.path.lexists(SITE + 'v2/models'): os.symlink(DOCS + 'v2/models', SITE + 'v2/models')
sys.path.insert(0, ROOT + 'tools'); import rules as RULES

rd = lambda p: open(p, encoding='utf-8').read()
head = rd(D + 'p1_head.html')
# ordre : Firebase, règles du village, équipement, garnison, raids, histoire, donjons, rendu 3D, sons, icônes peintes, interfaces (donjons, équipement, raids, garnison, conseils), application
PARTS = ['p0_fb.js', 'p2_rules.js', 'p2e_equip.js', 'p2g_garnison.js', 'p2r_raid.js', 'p2s_histoire.js', 'p2d_donjon.js', 'p3_render.js', 'p5_audio.js', 'p4i_icones.js',
         'p4d_donjon.js', 'p4e_equip.js', 'p4r_raid.js', 'p4g_garnison.js', 'p4c_conseils.js', 'p4s_histoire.js', 'p4_app.js']
js = "(() => {\n'use strict';\n" + "\n".join(rd(D + f) for f in PARTS) + "\n})();\n"
build = hashlib.sha1(js.encode()).hexdigest()[:10]
for f in ('fakefb.js', 'v2/fakefb.js', 'v2/game.js', 'v2/manifest.json'):      # restes d'un ancien essai ou de l'ancienne adresse d'essai
    if os.path.lexists(SITE + f) and not os.path.isdir(SITE + f): os.remove(SITE + f)
open(SITE + 'game.js', 'w', encoding='utf-8').write(js)
open(SITE + '.nojekyll', 'w').write('')

manifest = {
    'name': 'Mountain Kings', 'short_name': 'Mountain Kings', 'lang': 'fr',
    'description': 'Un village commun, un héros chacun : donjons, raids et garnison.',
    'id': './', 'start_url': './', 'scope': './',
    'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'],
    'orientation': 'landscape', 'background_color': '#0F1613', 'theme_color': '#16201C', 'categories': ['games'],
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': 'icons/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
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
<meta name="theme-color" content="#3e2716">
<meta name="description" content="Mountain Kings : un village commun, un héros chacun.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mountain Kings">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/favicon.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
{head[:i]}
<style>[hidden]{{display:none!important}}img{{max-width:100%}}</style>
</head>
<body>
{head[i:].strip()}
<script src="lib/three.min.js"></script>
<script src="lib/GLTFLoader.js"></script>
<script src="lib/SkeletonUtils.js"></script>
<script>window.MK_SITE = true; window.MK_PATHS = {{ models: 'models/', m2: 'v2/models/' }};</script>
{fb}<script src="game.js?v={build}"></script>
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {{
  /* Le cache hors ligne s'installe une fois les modèles 3D chargés (le jeu appelle __mkSW), pour ne pas ralentir le premier chargement. */
  const reg = () => {{
    if (reg.done) return; reg.done = true;
    navigator.serviceWorker.register('sw.js', {{ scope: './' }}).then(r => {{
      r.addEventListener('updatefound', () => {{
        const w = r.installing;
        w && w.addEventListener('statechange', () => {{
          if (w.state === 'activated' && navigator.serviceWorker.controller) window.__mkUpdate = true;
        }});
      }});
    }}).catch(() => {{}});
  }};
  window.__mkSW = reg; setTimeout(reg, 25000);
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
shared_models = sorted('models/' + f for f in os.listdir(DOCS + 'models') if not f.startswith('.'))
# Seuls les modèles Meshy utilisés par le jeu (liste M2_NAMES du rendu) sont mis en cache.
m2_names = re.findall(r"'([a-z_]+)'", re.search(r'const M2_NAMES = \[([^\]]*)\]', rd(D + 'p3_render.js')).group(1))
own_models = sorted('v2/models/' + n + '.glb' for n in m2_names if os.path.exists(DOCS + 'v2/models/' + n + '.glb'))
core = ['./', 'game.js?v=' + build, 'manifest.json', 'lib/three.min.js', 'lib/GLTFLoader.js', 'lib/SkeletonUtils.js',
        'icons/icon-192.png', 'icons/favicon.png'] + sorted('fonts/' + f for f in os.listdir(DOCS + 'fonts') if f.endswith('.woff'))
models = shared_models + own_models
mhash = hashlib.sha1(b''.join(open(DOCS + m, 'rb').read() for m in models)).hexdigest()[:10]
sw = f'''/* Mountain Kings : mise en cache pour un démarrage rapide et des mises à jour automatiques. */
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
/* On efface les anciennes versions du jeu (mk2-…) et les caches de l'ancien jeu du temps où il était à cette adresse (mk-…).
   L'ancien jeu, maintenant dans v1/, a les siens (mk1-…) : on n'y touche pas. */
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('mk2') && k !== CACHE && k !== MCACHE) || k.startsWith('mk-')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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

# L'ancienne adresse d'essai (v2/) : la page renvoie vers l'adresse principale (en gardant ?join=… des liens d'invitation),
# et son ancien cache hors ligne se désinscrit tout seul. Ses modèles Meshy (v2/models/) restent là : le jeu s'en sert.
redirect = '''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mountain Kings</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0F1613;color:#F3EEE5;font:16px system-ui,sans-serif;text-align:center}a{color:#F0A548}</style></head>
<body><p>Mountain Kings a déménagé : <a id="go" href="../">ouvrir le jeu</a></p>
<script>
const to = '../' + location.search + location.hash; document.getElementById('go').href = to;
const go = () => location.replace(to);
if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.filter(r => /\\/v2\\/$/.test(r.scope)).map(r => r.unregister()))).then(go, go);
  setTimeout(go, 1500);
} else go();
</script></body></html>
'''
open(SITE + 'v2/index.html', 'w', encoding='utf-8').write(redirect)
open(SITE + 'v2/sw.js', 'w', encoding='utf-8').write('''/* Ancienne adresse d'essai : ce service se retire tout seul (le jeu est maintenant à l'adresse principale). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.registration.unregister()));
''')
if TEST:
    import shutil
    shutil.copy(ROOT + 'tools/fakefb.js', SITE + 'fakefb.js')
RULES.write(ROOT + 'database.rules.json')
total = sum(os.path.getsize(SITE + f) for f in ('index.html', 'game.js', 'sw.js', 'manifest.json'))
print('build', build, 'size %.2f MB' % (total / 1e6), 'test' if TEST else '')
