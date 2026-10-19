"""Essai des raids dans le navigateur (faux Firebase) : menu Défense, palissades posées en ligne, porte, raid pendant l'absence
(bilan à l'ouverture, rediffusion jusqu'au bout), réparation, portail qui se charge (puce, portail sur la carte), donjon du portail.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_raid.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Lent avec le rendu logiciel (≈ 8-12 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8795
URL = f'http://127.0.0.1:{PORT}/'
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

async def tap_cell(pg, gx, gz):
    x, y = await pg.evaluate(f'window.__mk.toScreen({gx} + 0.5, {gz} + 0.5)')
    await pg.mouse.click(x, y); await pg.wait_for_timeout(1200)

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
        check(await A.is_visible('.nav [data-s="defense"]'), 'bouton Défense dans la barre du bas')
        # le menu Défense
        await nav(A, 'defense')
        body = await A.inner_text('#sheetBody')
        check('La vallée est calme' in body and 'Palissades' in body and 'Tours d’archers' in body, 'menu Défense : ' + txt(body[:160]))
        await A.screenshot(path=S + 'raid_sheet.png')
        # des palissades en ligne : deux touchers sur la même ligne
        await A.click('[data-act="place"][data-type="rempart"]'); await A.wait_for_timeout(1500)
        check(await A.evaluate("window.__mk.mode === 'home'") and await A.is_visible('#hudBottom [data-act="placeCancel"]'), 'mode pose des palissades')
        await tap_cell(A, 8, 16); await tap_cell(A, 13, 16)
        await until(A, 'window.__mk.busy === 0', 30)
        n = await A.evaluate("window.__mk.me.b.filter(b => b.type === 'rempart').length")
        check(n == 6, f'deux touchers : une ligne de {n} palissades')
        await A.screenshot(path=S + 'raid_walls.png')
        await A.click('#hudBottom [data-act="placeCancel"]'); await A.wait_for_timeout(1000)
        # une palissade devient une porte (panneau de la palissade touchée)
        await tap_cell(A, 10, 16)
        check(await A.is_visible('[data-act="gate"]'), 'panneau de la palissade : « En faire une porte »')
        await A.click('[data-act="gate"]'); await A.wait_for_timeout(1500)
        await until(A, 'window.__mk.busy === 0', 30)
        check(await A.evaluate("window.__mk.me.b.some(b => b.type === 'porte' && b.gx === 10 && b.gz === 16)"), 'la porte est posée')
        await A.screenshot(path=S + 'raid_gate.png')
        await A.click('[data-act="desel"]'); await A.wait_for_timeout(800)
        # un raid pendant l'absence : le portail ouvert il y a 4 h, personne depuis 3 h
        tr = tree(); v = tr['v2']['villages'][vid]
        T = int(time.time() * 1000)
        if isinstance(v['b'], dict): v['b'] = [v['b'][k] for k in sorted(v['b'], key=int)]
        v['t'] = T - 3 * 3600000 - 30000; v['here'] = T - 3 * 3600000 - 30000
        v['raid'] = {'n': 2, 'next': T - 4 * 3600000, 'p': [[9, 0, 0]], 'cl': [0], 'sd': 4242, 'at': T - 4 * 3600000, 'rd': 1}
        v['r']['bois'] = 900; v['r']['pierre'] = 700; v['r']['or'] = 200
        put('v2/villages/' + vid, v)
        await A.reload(wait_until='domcontentloaded'); await A.wait_for_timeout(6000)
        await until(A, "!!window.__mk.me && !!window.__mk.me.lastRaid", 90)
        lr = await A.evaluate('window.__mk.me.lastRaid && window.__mk.me.lastRaid.res')
        check(bool(lr), 'le raid a eu lieu pendant l’absence : ' + json.dumps(lr))
        for i in range(30):    # « pendant votre absence » d'abord, puis le bilan du raid
            if await A.is_visible('#mcard [data-act="raidReplay"]'): break
            if await A.is_visible('#modal') and await A.is_visible('#mcard [data-act="closeModal"]'): await A.click('#mcard [data-act="closeModal"]')
            await A.wait_for_timeout(1000)
        body = await A.inner_text('#mcard')
        check('Revoir le raid' in body and 'Ennemis vaincus' in body, 'bilan du raid à l’ouverture : ' + txt(body[:220]))
        await A.screenshot(path=S + 'raid_report.png')
        await A.click('#mcard [data-act="raidReplay"]'); await A.wait_for_timeout(4000)
        check(await A.evaluate("window.__mk.mode === 'raid' && !!window.__mk.rp"), 'rediffusion lancée')
        await A.screenshot(path=S + 'raid_replay1.png')
        await A.click('[data-act="rpSpeed"]'); await A.wait_for_timeout(300); await A.click('[data-act="rpSpeed"]')
        await A.wait_for_timeout(6000); await A.screenshot(path=S + 'raid_replay2.png')
        ended = await until(A, "!!window.__mk.rp && window.__mk.rp.st.over", 300)
        same = await A.evaluate("(() => { const st = window.__mk.rp.st, r = window.__mk.me.lastRaid.res; return st.kills === r.k && st.esc === r.e; })()")
        check(ended and same, 'rediffusion jusqu’au bout, même bilan que le raid enregistré')
        await until(A, "!document.querySelector('#rpEnd').hidden", 20)
        await A.screenshot(path=S + 'raid_replay_end.png')
        await A.click('#rpEnd [data-act="rpQuit"]'); await A.wait_for_timeout(3000)
        check(await A.evaluate("window.__mk.mode === 'home' && !window.__mk.rp"), 'retour au village')
        # menu Défense : dernier raid, et réparations si besoin
        await nav(A, 'defense')
        body = await A.inner_text('#sheetBody')
        check('dernier raid' in body.lower(), 'le dernier raid est dans le menu Défense')
        dmg = await A.evaluate("window.__mk.me.b.filter(b => b.hp != null && b.hp < 99999).length")
        if dmg:
            await A.click('[data-act="repair"]'); await A.wait_for_timeout(1500); await until(A, 'window.__mk.busy === 0', 30)
            check(await A.evaluate("window.__mk.me.b.every(b => b.hp == null)"), f'{dmg} défense(s) abîmée(s), réparée(s)')
        # un portail qui se charge : puce en haut, portail sur la carte, bouton « Le refermer »
        tr = tree(); v = tr['v2']['villages'][vid]; T = int(time.time() * 1000)
        if isinstance(v['b'], dict): v['b'] = [v['b'][k] for k in sorted(v['b'], key=int)]
        v['raid'] = {'n': 3, 'next': T - 3600000, 'p': [[23, 12, 1]], 'cl': [0], 'sd': 777, 'at': T - 3600000, 'rd': 0}
        v['here'] = T; v['t'] = T - 60000
        put('v2/villages/' + vid, v)
        await A.wait_for_timeout(5000)
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        chip = await A.evaluate("[...document.querySelectorAll('#hudTop .medal.red')].map(e => e.title).join(' | ')")
        check('Portail' in chip, 'puce du portail en haut : ' + txt(chip[:120]))
        await A.screenshot(path=S + 'raid_portal.png')
        await nav(A, 'defense')
        body = await A.inner_text('#sheetBody')
        check('Portail de l’est' in body and 'Le refermer' in body, 'portail de l’est, bouton pour le refermer')
        await A.click('[data-act="djGo"][data-th="portail"]'); await A.wait_for_timeout(6000)
        info = await A.evaluate("window.__mk.dj && { th: window.__mk.dj.st.d.theme, boss: window.__mk.dj.st.mobs.some(m => m.type === 'gardien'), pi: window.__mk.dj.pi }")
        check(bool(info) and info['th'] == 'portail' and info['boss'], 'donjon du portail : ' + json.dumps(info))
        await A.screenshot(path=S + 'raid_portal_dj.png')
        # on gagne d'un coup (essai) : le gardien tombe, la sortie s'ouvre
        await A.evaluate("(() => { const st = window.__mk.dj.st; st.over = 'win'; })()")
        await until(A, "!document.querySelector('#modal').hidden && !!document.querySelector('#mcard [data-act=djBack]')", 60)
        await A.click('#mcard [data-act="djBack"]'); await A.wait_for_timeout(3000); await until(A, 'window.__mk.busy === 0', 30)
        closed = await A.evaluate("!window.__mk.me.raid.p && window.__mk.me.log.some(l => /referme le portail/.test(l.m))")
        check(closed, 'portail refermé : pas de raid cette fois')
        print('erreurs :', logs[:8])
        check(not logs, 'aucune erreur dans la page')
        await b.close()

try:
    asyncio.run(main())
finally:
    srv.terminate()
print('ÉCHECS : ' + str(len(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
