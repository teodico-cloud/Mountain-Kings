"""Essai de la Couronne de la Montagne (lot B de l'histoire) dans le navigateur (faux Firebase) : la lettre du Roi Déchu (scène),
l'objectif en tête du menu Donjon, un morceau gagné en donjon (bilan, scène du chapitre suivant), la faille vers l'abîme,
la couronne reconstituée (scène, coffre, titre), la couronne sur la halle et la chronique du village.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_couronne.py   (≈ 6-8 min ; captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8801
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()
fails = []
def check(c, m):
    print(('ok : ' if c else 'ÉCHEC : ') + m)
    if not c: fails.append(m)

async def until(pg, js, secs=120, step=1000):
    for i in range(int(secs * 1000 / step)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(step)
    return False

def village(vid):
    v = tree()['v2']['villages'][vid]
    if isinstance(v['b'], dict): v['b'] = [v['b'][k] for k in sorted(v['b'], key=int)]
    return v

# vide le donjon (le temps de l'essai), puis pose le héros sur la sortie
CLEAR = """(() => { const s = window.__mk.dj.st; s.mobs = [];
  s.rooms.forEach((R, i) => { const k = s.d.rooms[i].kind; if ((k === 'fight' || k === 'boss') && R.st !== 'clear') R.st = 'lock'; }); })()"""
TO_EXIT = """(() => { const s = window.__mk.dj.st; if (!s.exit) return false; const h = s.heroes[0]; h.x = h.px = s.exit.x; h.y = h.py = s.exit.y; h.tp = (h.tp || 0) + 1; return true; })()"""
SCENE = "(() => { const m = document.getElementById('modal'); return m && !m.hidden && /crownGo/.test(document.getElementById('mcard').innerHTML) ? document.getElementById('mcard').textContent : ''; })()"

logs = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
        A = await ctx.new_page(); A.set_default_timeout(180000)
        A.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        A.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        await A.goto(URL + '?u=alice', timeout=180000, wait_until='domcontentloaded'); await A.wait_for_timeout(4000)
        await A.click('[data-act="login"]'); await A.wait_for_timeout(3000)
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        hid = await A.evaluate('Object.keys(window.__mk.me.heroes)[0]')
        await A.click('[data-act="closeModal"]'); await A.wait_for_timeout(800)
        # la mission d'intro (le temps de l'essai : directement le retour), puis dix minutes plus tard, la lettre du Roi Déchu
        await A.evaluate(f"window.__mk.act({{ type: 'djEnd', hid: '{hid}', lvl: 1, win: true, xp: 120, theme: 'source' }})")
        await until(A, 'window.__mk.busy === 0 && !!window.__mk.me.lilou', 40)
        v = village(vid); v['lilou']['at'] -= 20 * 60000; v['heroes'][hid]['dj'] = 6
        v['r'].update({'bois': 900, 'pierre': 900, 'pain': 300, 'viande': 300})
        put('v2/villages/' + vid, v)
        got = await until(A, SCENE, 60)
        mc = await A.evaluate(SCENE)
        check(got and 'Chapitre 1' in mc and 'Roi Déchu' in mc and 'chef troll' in mc, 'la lettre du Roi Déchu : scène du chapitre 1 (« ' + mc[:60].strip() + '… »)')
        await A.screenshot(path=S + 'crown_letter.png')
        await A.click('[data-act="crownGo"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('Chapitre 1' in body and 'Les éclaireurs du Roi' in body and await A.is_visible('.crown [data-act="djGo"][data-th="mine"]'), 'menu Donjon : l’objectif du chapitre 1 en tête, avec son bouton')
        await A.screenshot(path=S + 'crown_menu.png')
        # le chef troll de la mine, niveau 3 : le bandeau
        await A.click('.crown [data-act="djGo"][data-th="mine"]'); await A.wait_for_timeout(6000)
        st = await A.evaluate('(() => { const d = window.__mk.dj; return d ? { th: d.st.d.theme, lvl: d.st.lvl } : null; })()')
        check(st and st['th'] == 'mine' and st['lvl'] == 3, 'le bouton lance la mine au niveau 3 (' + json.dumps(st) + ')')
        await A.evaluate(CLEAR); await until(A, '!!window.__mk.dj.st.exit', 40); await A.evaluate(TO_EXIT)
        won = await until(A, "!!document.querySelector('[data-act=\"djBack\"]')", 60)
        mc = await A.inner_text('#mcard') if won else ''
        check(won and 'bandeau de la couronne' in mc, 'au bilan : « Le bandeau de la couronne ! »')
        await A.screenshot(path=S + 'crown_win.png')
        await A.click('[data-act="djBack"]'); await A.wait_for_timeout(2500)
        await until(A, 'window.__mk.busy === 0', 30)
        v = village(vid)
        check(v.get('crown', {}).get('got') == 1, 'sur le serveur : le premier morceau (' + json.dumps(v.get('crown')) + ')')
        got = await until(A, SCENE, 40)
        mc = await A.evaluate(SCENE)
        check(got and 'Chapitre 2' in mc and 'couches' in mc, 'scène du chapitre 2 : la lettre dans la poche du troll')
        await A.screenshot(path=S + 'crown_ch2.png')
        await A.click('#mcard [data-act="closeModal"]'); await A.wait_for_timeout(1000)
        # le roi squelette (le temps de l'essai : directement le retour) ; chapitre 3 : la faille vers l'abîme
        await A.evaluate(f"window.__mk.act({{ type: 'djEnd', hid: '{hid}', lvl: 4, win: true, xp: 50, theme: 'crypte' }})")
        got = await until(A, SCENE, 40)
        mc = await A.evaluate(SCENE)
        check(got and 'Chapitre 3' in mc and 'Protégez l’enfant' in mc and 'chambre de Lilou' in mc, 'scène du chapitre 3 : le père du Roi Déchu, et les raids qui viseront la chambre de Lilou')
        await A.click('#mcard [data-act="closeModal"]'); await A.wait_for_timeout(800)
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        rift = '.crown [data-act="djGo"][data-th="portail"][data-pi="-1"]'
        check(await A.is_visible(rift), 'pas de portail ouvert : le bouton « Passer par la faille »')
        await A.click(rift); await A.wait_for_timeout(6000)
        st = await A.evaluate('(() => { const d = window.__mk.dj; return d ? { th: d.st.d.theme, pi: d.pi } : null; })()')
        check(st and st['th'] == 'portail' and st['pi'] == -1, 'la faille : le donjon du portail, sans portail ouvert (' + json.dumps(st) + ')')
        A.once('dialog', lambda d: asyncio.ensure_future(d.accept()))       # « Quitter le portail démoniaque ? »
        await A.click('[data-act="djFlee"]')
        await until(A, "!!document.querySelector('[data-act=\"djBack\"]')", 60)
        await A.click('[data-act="djBack"]'); await A.wait_for_timeout(2500)
        await until(A, 'window.__mk.busy === 0', 30)
        check(village(vid)['crown']['got'] == 3, 'fuir la faille ne rapporte pas l’arche')
        # l'arche puis la pierre de cœur : la couronne est reconstituée
        await A.evaluate(f"window.__mk.act({{ type: 'djEnd', hid: '{hid}', lvl: 2, win: true, xp: 50, theme: 'portail', pi: -1 }})")
        await until(A, SCENE, 40); await A.click('#mcard [data-act="closeModal"]'); await A.wait_for_timeout(800)
        await A.evaluate(f"window.__mk.act({{ type: 'djEnd', hid: '{hid}', lvl: 3, win: false, xp: 50, theme: 'prof', deep: 5 }})")
        got = await until(A, "(() => { const t = " + SCENE + "; return /Rois de la Montagne/.test(t) ? t : ''; })()", 40)
        mc = await A.evaluate(SCENE)
        check(got and 'Les Rois de la Montagne' in mc and 'coffre' in mc.lower() and 'Cycle 2' in mc, 'la couronne reconstituée : scène, coffre, lettre de malédiction, objectif du cycle 2')
        await A.screenshot(path=S + 'crown_kings.png')
        await A.click('#mcard [data-act="closeModal"]'); await A.wait_for_timeout(1000)
        await until(A, 'window.__mk.busy === 0', 30)
        v = village(vid)
        check(v['crown']['rank'] == 1 and v['crown']['cy'] == 2, 'sur le serveur : rang 1, cycle 2')
        check(await A.evaluate("!!document.querySelector('.kingmark')"), 'en haut, une couronne à côté du nom du village')
        await A.screenshot(path=S + 'crown_village.png')
        # menu Donjon : les quatre joyaux
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('Cycle 2' in body and 'joyau de la mine' in body and 'joyau des Profondeurs' in body, 'menu Donjon : les quatre joyaux du cycle 2')
        await A.screenshot(path=S + 'crown_cycle2.png')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        # la chronique du village
        await A.click('.nav [data-s="village"]'); await A.wait_for_timeout(1200)
        await A.click('[data-act="sheet"][data-s="chron"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('fonde le village' in body and 'Lilou' in body and 'bandeau' in body and 'Rois de la Montagne' in body, 'la chronique : fondation, Lilou, les morceaux, le couronnement')
        await A.screenshot(path=S + 'crown_chron.png')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await A.click('.nav [data-s="journal"]'); await A.wait_for_timeout(1200)
        check('Lettre du Roi Déchu' in await A.inner_text('#sheetBody'), 'au journal : les lettres du Roi Déchu')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')
    check(not [l for l in logs if l.startswith('pageerror')], 'aucune erreur dans la page')

try: asyncio.run(main())
finally: srv.terminate()
print(('%d échec(s) : ' % len(fails) + ' ; '.join(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
