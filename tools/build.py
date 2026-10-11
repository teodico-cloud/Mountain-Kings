"""Construit Mountain Kings : sources src/ -> site docs/ (Firebase, installable).
Usage : python3 tools/build.py [--test]   (--test : faux Firebase pour les essais locaux)"""
import json, os, shutil, sys, time, hashlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
D = ROOT + 'src/'
OUT = ROOT
SITE = ROOT + 'docs/'            # site publié (GitHub Pages, dossier /docs)
TEST = '--test' in sys.argv

rd = lambda p: open(p, encoding='utf-8').read()
head = rd(D + 'p1_head.html')
imp = json.load(open(D + 'import_village.json', encoding='utf-8'))
p0 = rd(D + 'p0_fb.js').replace('/*IMPORT*/null', json.dumps(imp, ensure_ascii=False, separators=(',', ':')))
js = "(() => {\n'use strict';\n" + p0 + "\n" + rd(D + 'p2_rules.js') + "\n" + rd(D + 'p3_render.js') + "\n" + rd(D + 'p5_audio.js') + "\n" + rd(D + 'p4_app.js') + "\n})();\n"
build = hashlib.sha1(js.encode()).hexdigest()[:10]

# models/ et lib/ (three.js r128) sont des fichiers fixes du dépôt : on ne les régénère pas.
os.makedirs(SITE + 'icons', exist_ok=True)
for f in ('fakefb.js',):
    if os.path.exists(SITE + f): os.remove(SITE + f)
open(SITE + 'game.js', 'w', encoding='utf-8').write(js)
open(SITE + '.nojekyll', 'w').write('')

# Icônes : couronne dorée au-dessus de montagnes, sur fond de nuit.
def icon(size, maskable=False):
    W = 1024
    im = Image.new('RGBA', (W, W))
    g = ImageDraw.Draw(im)
    for i in range(W):  # dégradé vertical
        t = i / W
        g.line([(0, i), (W, i)], fill=(int(20 + 34 * t), int(30 + 28 * t), int(28 + 12 * t), 255))
    k = 0.8 if maskable else 1.0      # zone sûre des icônes adaptatives
    c = W / 2
    P = lambda pts: [(c + (x - c) * k, c + (y - c) * k) for x, y in pts]
    glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(P([(282, 120), (742, 470)]), fill=(240, 165, 72, 110))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))
    d = ImageDraw.Draw(im)
    # montagnes (débordent volontairement : elles sont rognées par le masque)
    d.polygon([(-40, 1060), (360, 560), (520, 720), (660, 590), (1080, 1060)], fill=(95, 110, 123, 255))
    d.polygon([(360, 560), (300, 640), (365, 615), (420, 655)], fill=(232, 238, 242, 255))
    d.polygon([(660, 590), (612, 652), (668, 636), (715, 668)], fill=(232, 238, 242, 255))
    d.polygon([(-40, 1060), (280, 770), (470, 900), (590, 820), (1080, 1060)], fill=(46, 64, 54, 255))
    # couronne
    gold, dark = (240, 165, 72, 255), (173, 98, 16, 255)
    d.polygon(P([(312, 430), (312, 230), (402, 320), (512, 180), (622, 320), (712, 230), (712, 430)]), fill=gold)
    d.rectangle(P([(312, 430), (712, 495)]), fill=dark)
    for x, y in [(312, 220), (512, 168), (712, 220)]:
        d.ellipse(P([(x - 30, y - 30), (x + 30, y + 30)]), fill=gold)
    for x in (402, 512, 622):
        d.ellipse(P([(x - 20, 443), (x + 20, 483)]), fill=(166, 61, 44, 255))
    if not maskable:
        mask = Image.new('L', (W, W), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, W - 1], radius=220, fill=255)
        im.putalpha(mask)
    return im.resize((size, size), Image.LANCZOS)

icon(192).save(SITE + 'icons/icon-192.png')
icon(512).save(SITE + 'icons/icon-512.png')
icon(512, True).save(SITE + 'icons/maskable-512.png')
icon(180, True).convert('RGB').save(SITE + 'icons/apple-touch-icon.png')
icon(64).save(SITE + 'icons/favicon.png')

manifest = {
    'name': 'Mountain Kings', 'short_name': 'Mountain Kings', 'lang': 'fr',
    'description': 'Village nain, raids contre les orques, et raids à deux en direct.',
    'id': './', 'start_url': './', 'scope': './',
    'display': 'fullscreen', 'display_override': ['fullscreen', 'standalone'],
    'orientation': 'landscape', 'background_color': '#0F1613', 'theme_color': '#16201C',
    'categories': ['games'],
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
<meta name="theme-color" content="#16201C">
<meta name="description" content="Mountain Kings : village nain, raids contre les orques, raids à deux en direct.">
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
<script>window.MK_SITE = true;</script>
{fb}<script src="game.js?v={build}"></script>
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {{
  navigator.serviceWorker.register('sw.js').then(r => {{
    // Une nouvelle version est prête : on recharge une fois, au retour sur le jeu.
    r.addEventListener('updatefound', () => {{
      const w = r.installing;
      w && w.addEventListener('statechange', () => {{
        if (w.state === 'activated' && navigator.serviceWorker.controller) window.__mkUpdate = true;
      }});
    }});
  }}).catch(() => {{}});
  document.addEventListener('visibilitychange', () => {{
    if (document.hidden && window.__mkUpdate) location.reload();
    else if (!document.hidden) navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {{}});
  }});
}}
</script>
</body>
</html>
'''
open(SITE + 'index.html', 'w', encoding='utf-8').write(index)

files = sorted(os.path.relpath(os.path.join(r, f), SITE).replace(os.sep, '/') for r, _, fs in os.walk(SITE) for f in fs if not f.startswith('.'))
files = [f for f in files if not f.startswith('v2/')]   # le nouveau jeu (adresse de test) a son propre cache
core = ['./'] + [f for f in files if f not in ('index.html', 'sw.js', 'fakefb.js') and not f.startswith('models/')]
models = [f for f in files if f.startswith('models/')]
mhash = hashlib.sha1(b''.join(open(SITE + f, 'rb').read() for f in models)).hexdigest()[:10]
sw = f'''/* Mountain Kings : mise en cache pour un démarrage rapide et des mises à jour automatiques. */
const CACHE = 'mk-{build}';
const MCACHE = 'mk-models-{mhash}';
const CORE = {json.dumps(core)};
const MODELS = {json.dumps(models)};
self.addEventListener('install', e => {{
  e.waitUntil(Promise.all([
    caches.open(CACHE).then(c => c.addAll(CORE.map(u => u === 'game.js' ? 'game.js?v={build}' : u))),
    // Les modèles 3D ne changent presque jamais : ils restent en cache d'une version à l'autre.
    caches.open(MCACHE).then(c => Promise.all(MODELS.map(u => c.match(u).then(r => r || c.add(u))))),
  ]).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== MCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
const LIBS = /^https:\\/\\/(www\\.gstatic\\.com\\/firebasejs\\/|fonts\\.googleapis\\.com\\/|fonts\\.gstatic\\.com\\/)/;
self.addEventListener('fetch', e => {{
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {{
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json')) {{
      // La page d'abord depuis le réseau, pour recevoir les mises à jour ; sinon depuis le cache.
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
if TEST: shutil.copy(ROOT + 'tools/fakefb.js', SITE + 'fakefb.js')

rules = {'rules': {
    'villages': {'.read': 'auth != null', '$uid': {'.write': 'auth != null && auth.uid === $uid'}},
    'dons': {'.read': 'auth != null', '.indexOn': ['to'],
             '$id': {'.write': "auth != null && (data.exists() ? (data.child('to').val() === auth.uid || data.child('from').val() === auth.uid) : newData.child('from').val() === auth.uid)"}},
    'presence': {'.read': 'auth != null', '$uid': {'.write': 'auth != null && auth.uid === $uid'}},
    'duo': {'inbox': {'$uid': {'.read': 'auth != null && auth.uid === $uid', '$msg': {'.write': 'auth != null'}}},
            'live': {'.read': 'auth != null', '.write': 'auth != null'}},
    'imported': {'.read': 'auth != null', '$k': {'.write': 'auth != null && (!data.exists() || data.val() === auth.uid) && newData.val() === auth.uid'}},
}}
json.dump(rules, open(OUT + 'database.rules.json', 'w'), indent=2)
json.dump({'hosting': {'public': 'docs', 'ignore': ['**/.*']}, 'database': {'rules': 'database.rules.json'}}, open(OUT + 'firebase.json', 'w'), indent=2)
total = sum(os.path.getsize(SITE + f) for f in files)
print('build', build, 'files', len(files), 'size %.1f MB' % (total / 1e6), 'test' if TEST else '')
