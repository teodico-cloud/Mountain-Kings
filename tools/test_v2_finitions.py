"""Essai des finitions dans le navigateur (faux Firebase) : l'ancienne adresse d'essai (v2/) renvoie vers le jeu, les modèles Meshy
arrivent après le village, un conseil au bon moment (bouton qui ouvre le bon menu, plus jamais ensuite), les graphismes légers,
la roulade en donjon (bouton et barre d'espace, recharge).
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_finitions.py   (≈ 5-8 min ; captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8799
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

async def close_modal(pg):
    for i in range(6):
        if not (await pg.is_visible('#modal') and await pg.is_visible('[data-act="closeModal"]')): return
        await pg.click('[data-act="closeModal"]'); await pg.wait_for_timeout(700)

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

logs = []
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=2)
        # les conseils sont coupés par défaut dans les essais : on les rallume ici
        await ctx.add_init_script("try { if (localStorage.getItem('mk2.tipsOff') == null) localStorage.setItem('mk2.tipsOff', '0'); } catch (e) {}")
        A = await ctx.new_page(); A.set_default_timeout(180000)
        A.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        A.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        # l'ancienne adresse d'essai renvoie vers l'adresse principale, en gardant ce qui suit le « ? »
        await A.goto(URL + 'v2/?u=alice', timeout=180000, wait_until='domcontentloaded')
        await until(A, "location.pathname === '/'", 20, 500)
        check(A.url == URL + '?u=alice', 'l’ancienne adresse d’essai renvoie vers le jeu (' + A.url + ')')
        await A.wait_for_timeout(4000)
        await A.click('[data-act="login"]'); await A.wait_for_timeout(3000)
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await close_modal(A)
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        # les modèles Meshy (halle, taverne, chantier) arrivent après les autres
        okm = await until(A, 'window.__mk.fx().m2 >= 3', 240, 2000)
        fx = await A.evaluate('window.__mk.fx()')
        check(okm, 'les modèles Meshy arrivent après le village (' + str(fx.get('m2')) + ' sur 3)')
        await A.screenshot(path=S + 'fin_village.png')
        # un conseil au bon moment : une forge toute neuve
        v = village(vid)
        v['b'].append({'id': v['nid'], 'type': 'forge', 'lvl': 1, 'gx': 18, 'gz': 3}); v['nid'] += 1
        put('v2/villages/' + vid, v)
        seen_tip = await until(A, "!!document.querySelector('#hudBottom .card.tip')", 90, 1000)
        tip_txt = (await A.inner_text('#hudBottom .card.tip')) if seen_tip else ''
        check(seen_tip and len(tip_txt) > 40 and 'Compris' in tip_txt, 'un conseil apparaît en bas de l’écran : ' + tip_txt.replace('\n', ' | ')[:120])
        await A.screenshot(path=S + 'fin_tip.png')
        if seen_tip:
            await A.click('#hudBottom .card.tip [data-act="tipGo"]'); await A.wait_for_timeout(1500)
            title = await A.inner_text('#sheetTitle') if await A.is_visible('#sheet') else ''
            seen = await A.evaluate("JSON.parse(localStorage.getItem('mk2.tips') || '[]')")
            check(await A.is_visible('#sheet') and len(seen) == 1, 'son bouton ouvre le menu « ' + title + ' », et le conseil est noté comme vu (' + ','.join(seen) + ')')
            await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
            # plus le même conseil : au plus un autre, différent, après 25 s
            await A.wait_for_timeout(30000)
            again = await A.evaluate("(() => { const c = document.querySelector('#hudBottom .card.tip'); return c ? c.textContent : ''; })()")
            check(tip_txt.split('\n')[-2:] != again.split('\n')[-2:] or not again, 'le même conseil ne revient pas' + (' (un autre est arrivé)' if again else ''))
            if again: await A.click('#hudBottom .card.tip [data-act="tipOk"]'); await A.wait_for_timeout(600)
        # les graphismes légers (menu Village, Affichage)
        pr0 = (await A.evaluate('window.__mk.fx()'))['pr']
        await A.click('.me[data-s="village"]'); await A.wait_for_timeout(1200)
        body = await A.inner_text('#sheetBody')
        check('Graphismes légers' in body and 'Conseils au bon moment' in body, 'menu Village : réglages « graphismes légers » et « conseils »')
        await A.click('[data-act="gfxToggle"]'); await A.wait_for_timeout(1500)
        fx = await A.evaluate('window.__mk.fx()')
        check(fx['light'] and fx['pr'] == 1 and pr0 == 2 and await A.evaluate("localStorage.getItem('mk2.light') === '1'"), f'graphismes légers : image {pr0}× → {fx["pr"]}×, sans ombres, gardé sur le téléphone')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await A.screenshot(path=S + 'fin_light.png')
        # la roulade en donjon
        await A.evaluate("window.__mk.djBegin(1, 'mine')"); await A.wait_for_timeout(6000)
        check(await A.evaluate("window.__mk.mode === 'donjon'") and await A.is_visible('[data-djroll]'), 'en donjon : le bouton « Roulade » est là')
        await A.screenshot(path=S + 'fin_dj.png')
        h0 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[0]; return [h.x, h.y, h.rollN | 0]; })()')
        await A.click('[data-djroll]'); await A.wait_for_timeout(120)
        await A.screenshot(path=S + 'fin_roll.png')
        await A.wait_for_timeout(600)
        h1 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[0]; return [h.x, h.y, h.rollN | 0, +(h.rollCd || 0).toFixed(1)]; })()')
        check(h1[2] == h0[2] + 1 and h1[3] > 2, f'le bouton lance une roulade (n° {h1[2]}, recharge {h1[3]} s)')
        await A.keyboard.press(' '); await A.wait_for_timeout(400)
        n2 = await A.evaluate('window.__mk.dj.st.heroes[0].rollN | 0')
        check(n2 == h1[2], 'pas de deuxième roulade pendant la recharge')
        # la recharge compte en temps de jeu (plus lent que l'horloge avec le rendu logiciel des essais)
        await until(A, '!(window.__mk.dj.st.heroes[0].rollCd > 0)', 60, 300)
        await A.keyboard.press(' '); await A.wait_for_timeout(600)
        n3 = await A.evaluate('window.__mk.dj.st.heroes[0].rollN | 0')
        check(n3 == h1[2] + 1, 'la barre d’espace relance une roulade après 4 s')
        A.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await A.click('[data-act="djFlee"]'); await A.wait_for_timeout(4000)
        await until(A, "!!document.querySelector('[data-act=\"djBack\"]')", 30)
        await A.click('[data-act="djBack"]'); await A.wait_for_timeout(3000)
        await until(A, "window.__mk.mode === 'home' && window.__mk.busy === 0", 60)
        check(await A.evaluate("window.__mk.mode === 'home'"), 'retour au village')
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')
    check(not [l for l in logs if l.startswith('pageerror')], 'aucune erreur dans la page')

try: asyncio.run(main())
finally: srv.terminate()
print(('%d échec(s) : ' % len(fails) + ' ; '.join(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
