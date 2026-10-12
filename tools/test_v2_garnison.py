"""Essai de la garnison dans le navigateur (faux Firebase) : carte Garnison du menu Défense, caserne (recruter, fiche d'un soldat,
forger son arme), poste de garde posé puis « Répartir », panneau du poste, soldats debout au village, raid avec la garnison
(bilan, rediffusion jusqu'au bout avec les soldats).
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_garnison.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Lent avec le rendu logiciel (≈ 8-12 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8797
URL = f'http://127.0.0.1:{PORT}/v2/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()
txt = lambda s: s.replace('\n', ' | ')
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

async def nav(pg, s):
    if await pg.is_visible('#sheet') and await pg.is_visible('[data-act="closeSheet"]'):
        await pg.click('[data-act="closeSheet"]'); await pg.wait_for_timeout(800)
    await pg.click(f'.nav [data-s="{s}"]'); await pg.wait_for_timeout(1500)

def village(vid):
    v = tree()['v2']['villages'][vid]
    if isinstance(v['b'], dict): v['b'] = [v['b'][k] for k in sorted(v['b'], key=int)]
    return v

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
        await A.fill('#fVname', 'Fort-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await close_modal(A)
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        # le menu Défense, sans caserne
        await nav(A, 'defense')
        body = await A.inner_text('#sheetBody')
        check('Garnison' in body and 'halle niveau 2' in body, 'menu Défense : carte Garnison (halle niveau 2)')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        # une halle niveau 2, une caserne finie, une forge, de quoi payer
        v = village(vid)
        for bb in v['b']:
            if bb['type'] == 'halle': bb['lvl'] = 2
        nid = v['nid']
        v['b'].append({'id': nid, 'type': 'caserne', 'lvl': 1, 'gx': 3, 'gz': 3}); nid += 1
        v['b'].append({'id': nid, 'type': 'forge', 'lvl': 2, 'gx': 18, 'gz': 3}); nid += 1
        v['nid'] = nid
        v['r'].update({'bois': 900, 'pierre': 900, 'or': 600, 'viande': 400, 'fer': 300, 'pain': 300})
        put('v2/villages/' + vid, v)
        await A.reload(wait_until='domcontentloaded'); await A.wait_for_timeout(6000)
        await close_modal(A)
        await until(A, "!!window.__mk.me && window.__mk.me.b.some(b => b.type === 'caserne')", 60)
        await nav(A, 'defense')
        check(await A.is_visible('[data-act="sheet"][data-s="caserne"]'), 'carte Garnison : bouton « La caserne »')
        await A.click('#sheetBody [data-act="sheet"][data-s="caserne"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('Recruter' in body and 'Fantassin' in body and 'Mage de guerre' in body, 'fiche de la caserne : ' + txt(body[:140]))
        for t in ['fant', 'fant', 'arch']:
            await A.click(f'[data-act="recruit"][data-t="{t}"]'); await A.wait_for_timeout(1500)
            await until(A, 'window.__mk.busy === 0', 30)
        n = await A.evaluate("Object.keys(window.__mk.me.sol || {}).length")
        check(n == 3, f'trois recrues ({n})')
        body = await A.inner_text('#sheetBody')
        check('La caserne est pleine' in body, 'caserne niveau 1 pleine (3 soldats)')
        await A.screenshot(path=S + 'gar_caserne.png')
        # la fiche d'un soldat : forger son arme
        sid = await A.evaluate("Object.values(window.__mk.me.sol)[0].id")
        await A.click(f'[data-act="solSel"][data-id="{sid}"]'); await A.wait_for_timeout(1200)
        await A.click(f'[data-act="solForge"][data-id="{sid}"][data-k="w"]'); await A.wait_for_timeout(1500)
        await until(A, 'window.__mk.busy === 0', 30)
        check(await A.evaluate(f"!!window.__mk.me.sol['{sid}'].w"), 'une arme forgée pour le premier soldat')
        await A.screenshot(path=S + 'gar_soldat.png')
        # un poste de garde, puis « Répartir »
        await A.click('#sheetBody [data-act="place"][data-type="poste"]'); await A.wait_for_timeout(1500)
        check(await A.evaluate("window.__mk.mode === 'home'") and await A.is_visible('[data-act="placeOk"]'), 'pose du poste de garde')
        await A.click('[data-act="placeOk"]'); await A.wait_for_timeout(1500)
        await until(A, 'window.__mk.busy === 0', 30)
        post = await A.evaluate("(window.__mk.me.b.find(b => b.type === 'poste') || {}).id")
        check(bool(post), 'poste posé')
        await nav(A, 'defense')
        await A.click('#sheetBody [data-act="solAuto"]'); await A.wait_for_timeout(1500)
        await until(A, 'window.__mk.busy === 0', 30)
        check(await A.evaluate(f"Object.values(window.__mk.me.sol).every(s => s.post === {post})"), '« Répartir » : les trois au poste')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(1000)
        # le panneau du poste (touché sur la carte)
        gx, gz = await A.evaluate(f"(() => {{ const b = window.__mk.me.b.find(b => b.id === {post}); return [b.gx, b.gz]; }})()")
        x, y = await A.evaluate(f'window.__mk.toScreen({gx} + 0.5, {gz} + 0.5)')
        await A.mouse.click(x, y); await A.wait_for_timeout(1500)
        panel = await A.inner_text('#hudBottom')
        check('Poste 1' in panel and 'n°' in panel, 'panneau du poste : ' + txt(panel[:120]))
        await A.wait_for_timeout(4000)
        await A.screenshot(path=S + 'gar_poste.png')
        people = await A.evaluate('window.__mk.fx() && window.__mk.fx().people')
        check(people and people >= 3 + 4 + 1, f'soldats debout au village ({people} habitants affichés)')
        await A.click('[data-act="desel"]'); await A.wait_for_timeout(800)
        # un raid pendant l'absence : le portail au nord, personne depuis 3 h
        v = village(vid); T = int(time.time() * 1000)
        for s in v['sol'].values(): s['lvl'] = 3
        v['t'] = T - 3 * 3600000 - 30000; v['here'] = T - 3 * 3600000 - 30000
        v['raid'] = {'n': 2, 'next': T - 4 * 3600000, 'p': [[gx, 0, 0]], 'cl': [0], 'sd': 5151, 'at': T - 4 * 3600000, 'rd': 1}
        put('v2/villages/' + vid, v)
        await A.reload(wait_until='domcontentloaded'); await A.wait_for_timeout(6000)
        await until(A, "!!window.__mk.me && !!window.__mk.me.lastRaid", 90)
        lr = await A.evaluate('(() => { const l = window.__mk.me.lastRaid; return l && { G: (l.G || []).length, gd: l.res.gd, gk: l.res.gk, k: l.res.k, f: l.res.f }; })()')
        check(bool(lr) and lr['G'] == 3 and lr['gd'] and len(lr['gd']) == 3, 'raid avec la garnison : ' + json.dumps(lr))
        for i in range(30):
            if await A.is_visible('#mcard [data-act="raidReplay"]'): break
            if await A.is_visible('#modal') and await A.is_visible('#mcard [data-act="closeModal"]'): await A.click('#mcard [data-act="closeModal"]')
            await A.wait_for_timeout(1000)
        body = await A.inner_text('#mcard')
        check('Abattus par la garnison' in body, 'bilan du raid : ' + txt(body[:260]))
        await A.screenshot(path=S + 'gar_bilan.png')
        await A.click('#mcard [data-act="raidReplay"]'); await A.wait_for_timeout(5000)
        check(await A.evaluate("window.__mk.mode === 'raid' && !!window.__mk.rp && window.__mk.rp.st.guards.length === 3"), 'rediffusion : les trois soldats à leur poste')
        await A.mouse.move(422, 195); await A.mouse.wheel(0, -400); await A.wait_for_timeout(2500)
        await A.screenshot(path=S + 'gar_replay1.png')
        await A.wait_for_timeout(5000); await A.screenshot(path=S + 'gar_replay2.png')
        await A.click('[data-act="rpSpeed"]'); await A.wait_for_timeout(300); await A.click('[data-act="rpSpeed"]')
        ended = await until(A, "!!window.__mk.rp && window.__mk.rp.st.over", 300)
        same = await A.evaluate("(() => { const st = window.__mk.rp.st, r = window.__mk.me.lastRaid.res; return st.kills === r.k && st.esc === r.e && st.guards.reduce((a, g) => a + g.kills, 0) === (r.gk || 0); })()")
        check(ended and same, 'rediffusion jusqu’au bout, même bilan (soldats compris)')
        await A.click('[data-act="rpQuit"]'); await A.wait_for_timeout(3000)
        check(await A.evaluate("window.__mk.mode === 'home' && !window.__mk.rp"), 'retour au village')
        print('erreurs :', logs[:8])
        check(not logs, 'aucune erreur dans la page')
        await b.close()

try:
    asyncio.run(main())
finally:
    srv.terminate()
print('ÉCHECS : ' + str(len(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
