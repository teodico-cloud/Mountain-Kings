"""Essai du prologue dans le navigateur (faux Firebase, ?pro=1) : l'introduction racontée, le héros créé avant le village,
« La Source du Mal », puis la fondation (héros, Lilou et sa chambre dès le départ) ; la compagne par le lien d'invitation
(son propre prologue, puis elle rejoint avec son héros) ; « Nouvelle partie » (le village reste archivé) ; un lien vers un autre village.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_prologue.py   (≈ 8-12 min ; captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8803
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

def arr(x): return [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])
MC = "document.getElementById('modal') && !document.getElementById('modal').hidden ? document.getElementById('mcard').textContent : ''"
# jusqu'au berceau (le temps de l'essai) : salles nettoyées, sortie ouverte, le héros posé dessus
TO_CRADLE = """(() => { const s = window.__mk.dj.st, h = s.heroes[0], c = s.d.cradle;
  s.rooms.forEach(R => R.st = 'clear'); s.mobs.forEach(m => { m.hp = 0; }); s.exit = { x: c[0] + 0.5, y: c[1] + 0.5 };
  h.x = h.px = s.exit.x; h.y = h.py = s.exit.y; h.tp = (h.tp || 0) + 1; })()"""

logs = []
async def page(b, user, extra=''):
    ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
    P = await ctx.new_page(); P.set_default_timeout(180000)
    P.on('console', lambda m: logs.append(f'{user} {m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    P.on('pageerror', lambda e: logs.append(f'pageerror {user}: {e}'))
    await P.goto(URL + '?u=' + user + '&pro=1' + extra, timeout=180000, wait_until='domcontentloaded'); await P.wait_for_timeout(4000)
    await P.click('[data-act="login"]'); await P.wait_for_timeout(3000)
    return P

async def prologue(P, hero, race, cls, shot, clicks=3):
    """l'introduction (« Suite », « Suite », « Créer mon héros »), le héros, la mine, le berceau ; renvoie le texte du bilan"""
    for i in range(clicks): await P.click('[data-act="introNext"]'); await P.wait_for_timeout(700)
    await P.fill('#hName', hero)
    await P.click(f'label.optc:has(input[value="{race}"])'); await P.click(f'label.optc:has(input[value="{cls}"])')
    await P.click('#heroForm button[type=submit]')
    started = await until(P, "!!(window.__mk.dj && window.__mk.dj.st.d.theme === 'source' && window.__mk.dj.pro)", 60)
    check(started, hero + ' : le donjon d’intro commence, avant tout village')
    await P.wait_for_timeout(3000); await P.screenshot(path=S + 'pro_' + shot + '_dj.png')
    await P.evaluate(TO_CRADLE)
    won = await until(P, "!!document.querySelector('[data-act=\"djBack\"]')", 60)
    txt = await P.evaluate(MC) if won else ''
    await P.screenshot(path=S + 'pro_' + shot + '_found.png')
    await P.click('[data-act="djBack"]'); await P.wait_for_timeout(2500)
    return txt

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        A = await page(b, 'alice')
        intro = await A.evaluate(MC)
        check(await A.evaluate('window.__mk.mode') == 'intro' and 'Il était une fois' in intro and 'Sukhoï' in intro and await A.is_visible('[data-act="introSkip"]'), 'au début : l’introduction racontée par Sukhoï (qu’on peut passer)')
        await A.screenshot(path=S + 'pro_intro.png')
        txt = await prologue(A, 'Brokk', 'nain', 'guerrier', 'a')
        check('bébé' in txt and 'Ramener Lilou' in txt, 'au berceau : le bébé, et « Ramener Lilou au village »')
        mc = await A.evaluate(MC)
        check(await A.evaluate('window.__mk.mode') == 'gate' and 'Un toit pour Lilou' in mc and 'Brokk' in mc, 'puis seulement : nommer le village (« Un toit pour Lilou »)')
        await A.screenshot(path=S + 'pro_gate.png')
        await A.fill('#fVname', 'Val-Brume')
        await A.click('#foundForm button[type=submit]')
        ok = await until(A, "window.__mk.mode === 'home' && !!window.__mk.me && window.__mk.busy === 0", 60)
        vid = await A.evaluate('window.__mk.vid')
        v = tree()['v2']['villages'][vid] if vid else {}
        heroes = list((v.get('heroes') or {}).values())
        b_ = arr(v.get('b'))
        check(ok and len(heroes) == 1 and heroes[0]['name'] == 'Brokk' and (heroes[0].get('xp', 0) > 0 or heroes[0].get('lvl', 1) > 1) and v.get('lilou') and any(x['type'] == 'chambre' for x in b_), 'le village est fondé avec Brokk (et son expérience), Lilou et sa chambre')
        mc = await A.evaluate(MC)
        check('Lilou a sa chambre' in mc and await A.is_visible('[data-act="lilouSee"]'), 'bienvenue : Sukhoï présente la chambre de Lilou')
        await A.screenshot(path=S + 'pro_welcome.png')
        check(await A.evaluate("localStorage.getItem('mk2.pro.uid_alice') === null"), 'le prologue n’est plus gardé sur le téléphone')
        await A.click('#mcard [data-act="closeModal"]'); await A.wait_for_timeout(800)
        # la compagne, par le lien d'invitation : son propre prologue
        B = await page(b, 'bob', '&join=' + vid)
        await B.click('[data-act="introNext"]'); await B.wait_for_timeout(500); await B.click('[data-act="introNext"]'); await B.wait_for_timeout(500)
        last = await B.evaluate(MC)
        check('Alice t’attend au village de Val-Brume' in last, 'invitée : l’introduction lui dit qui l’attend')
        txt = await prologue(B, 'Aelith', 'elfe', 'rodeur', 'b', clicks=1)
        check('encore sauvée' in txt, 'son berceau : « elle s’est encore sauvée ! »')
        mc = await B.evaluate(MC)
        check(await B.evaluate('window.__mk.mode') == 'join' and 'Lilou est sauvée' in mc, 'puis l’invitation (Sukhoï : « Lilou est sauvée »)')
        await B.click('#joinForm button[type=submit]')
        ok = await until(B, "window.__mk.mode === 'home' && !!window.__mk.me && window.__mk.busy === 0", 60)
        await B.wait_for_timeout(2000)
        v = tree()['v2']['villages'][vid]
        hb = [h for h in (v.get('heroes') or {}).values() if h['own'] == 'uid_bob']
        check(ok and len(v['members']) == 2 and len(hb) == 1 and hb[0]['name'] == 'Aelith' and (hb[0].get('xp', 0) > 0 or hb[0].get('lvl', 1) > 1) and sum(1 for x in arr(v['b']) if x['type'] == 'chambre') == 1, 'elle rejoint avec Aelith (et son expérience) ; toujours une seule Lilou')
        check('Bienvenue à Val-Brume' in await B.evaluate(MC), 'bienvenue pour elle aussi')
        await B.screenshot(path=S + 'pro_b_welcome.png')
        await B.click('#mcard [data-act="closeModal"]'); await B.wait_for_timeout(600)
        # Nouvelle partie (Alice) : le village reste dans la base, elle repart du début
        await A.click('.nav [data-s="village"]'); await A.wait_for_timeout(1200)
        await A.click('[data-act="newGame"]'); await A.wait_for_timeout(800)
        check('Tout recommencer' in await A.evaluate(MC) and 'Bob reste dans l’ancien village' in await A.evaluate(MC), 'Nouvelle partie : confirmation (Bob reste dans l’ancien village)')
        await A.click('[data-act="newGameOk"]')
        back = await until(A, "window.__mk && window.__mk.mode === 'intro'", 90)
        t = tree()['v2']
        check(back and 'uid_alice' not in (t.get('users') or {}) and vid in t['villages'], 'après la confirmation : l’introduction de nouveau ; l’ancien village est toujours dans la base')
        # un lien vers un autre village quand on en a déjà un (Bob) : rester, ou rejoindre
        put('v2/invites/vautre', {'name': 'Roche-Lune', 'by': 'Alice', 't': int(time.time() * 1000)})
        await B.goto(URL + '?u=bob&pro=1&join=vautre', timeout=180000, wait_until='domcontentloaded')
        sw = await until(B, "/Rejoindre Roche-Lune/.test(" + MC + ")", 60)
        check(sw, 'Bob, déjà dans un village, ouvre un autre lien : « Rejoindre Roche-Lune ? »')
        await B.screenshot(path=S + 'pro_switch.png')
        await B.click('[data-act="switchStay"]'); await B.wait_for_timeout(1500)
        check(await B.evaluate("window.__mk.mode === 'home' && window.__mk.vid") == vid, '« Rester » : il reste dans son village')
        await B.goto(URL + '?u=bob&pro=1&join=vautre', timeout=180000, wait_until='domcontentloaded')
        await until(B, "/Rejoindre Roche-Lune/.test(" + MC + ")", 60)
        await B.click('[data-act="switchGo"]')
        gone = await until(B, "window.__mk && window.__mk.mode === 'intro'", 90)
        t = tree()['v2']
        check(gone and 'uid_bob' not in (t.get('users') or {}) and vid in t['villages'], '« Rejoindre » : son prologue commence ; l’ancien village reste archivé')
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')
    check(not [l for l in logs if l.startswith('pageerror')], 'aucune erreur dans la page')

try: asyncio.run(main())
finally: srv.terminate()
print(('%d échec(s) : ' % len(fails) + ' ; '.join(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
