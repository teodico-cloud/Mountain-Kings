"""Essai du donjon dans le navigateur (faux Firebase) : entrer dans la mine, bouger, combattre, fuir, bilan, retour au village.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_dj.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Lent avec le rendu logiciel (≈ 5 min) : à lancer en arrière-plan avec un fichier de log."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8797
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))

async def close_modal(pg):
    for i in range(6):
        if not (await pg.is_visible('#modal') and await pg.is_visible('[data-act="closeModal"]')): return
        await pg.click('[data-act="closeModal"]'); await pg.wait_for_timeout(700)

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
        A = await ctx.new_page(); A.set_default_timeout(120000)
        A.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        A.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        await A.goto(URL + '?u=alice', timeout=120000, wait_until='domcontentloaded'); await A.wait_for_timeout(4000)
        await A.click('[data-act="login"]'); await A.wait_for_timeout(3000)
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await close_modal(A)
        for i in range(30):
            if await A.evaluate('!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0'): break
            await A.wait_for_timeout(1000)
        # le menu Donjon
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1200)
        print('sheet donjon:', (await A.inner_text('#sheetBody')).replace('\n', ' | ')[:260])
        await A.screenshot(path=S + 'dj_sheet.png')
        await A.click('[data-act="djGo"]'); await A.wait_for_timeout(6000)
        st = await A.evaluate('(() => { const d = window.__mk.dj; if (!d) return null; const s = d.st, h = s.heroes[0]; return { mode: window.__mk.mode, W: s.d.W, H: s.d.H, rooms: s.d.rooms.length, mobs: s.mobs.length, hero: [h.x, h.y], hp: h.hp, n: s.n }; })()')
        print('in dungeon:', st)
        print('hud:', (await A.inner_text('#djHud')).replace('\n', ' | ')[:200])
        await A.screenshot(path=S + 'dj_start.png')
        # se déplacer au clavier
        x0 = await A.evaluate('[window.__mk.dj.st.heroes[0].x, window.__mk.dj.st.heroes[0].y]')
        await A.keyboard.down('ArrowRight'); await A.wait_for_timeout(6000); await A.keyboard.up('ArrowRight')
        x1 = await A.evaluate('[window.__mk.dj.st.heroes[0].x, window.__mk.dj.st.heroes[0].y]')
        print('moved with the keyboard:', round(((x1[0] - x0[0]) ** 2 + (x1[1] - x0[1]) ** 2) ** 0.5, 2), 'cells (steps', await A.evaluate('window.__mk.dj.st.n'), ')')
        # le joystick (doigt posé à gauche, glissé vers la droite)
        # vers la gauche de l'écran (le clavier vient d'aller à droite, le héros est peut-être contre un mur)
        await A.mouse.move(200, 300); await A.mouse.down(); await A.mouse.move(150, 300, steps=4); await A.wait_for_timeout(4000)
        await A.screenshot(path=S + 'dj_joystick.png')
        await A.mouse.up()
        x2 = await A.evaluate('[window.__mk.dj.st.heroes[0].x, window.__mk.dj.st.heroes[0].y]')
        print('moved with the joystick:', round(((x2[0] - x1[0]) ** 2 + (x2[1] - x1[1]) ** 2) ** 0.5, 2), 'cells')
        # au combat : on pose le héros dans la 1re salle de combat (le temps de l'essai)
        await A.evaluate("""(() => { const s = window.__mk.dj.st, h = s.heroes[0], r = s.d.rooms.find(r => r.kind === 'fight'); const c = r.cells[Math.floor(r.cells.length / 2)]; h.x = h.px = c[0] + 0.5; h.y = h.py = c[1] + 0.5; })()""")
        await A.wait_for_timeout(5000)
        await A.keyboard.press('1'); await A.wait_for_timeout(6000)
        await A.screenshot(path=S + 'dj_fight.png')
        f = await A.evaluate('(() => { const s = window.__mk.dj.st, h = s.heroes[0]; return { locked: s.rooms.some(R => R.st === "lock"), awake: s.mobs.filter(m => m.awake).length, kills: s.kills, hp: Math.round(h.hp), cd: h.cd.map(x => +x.toFixed(1)), info: document.getElementById("djInfo").textContent }; })()')
        print('fight:', f)
        await A.wait_for_timeout(15000)
        await A.screenshot(path=S + 'dj_fight2.png')
        print('after 15 s more: kills', await A.evaluate('window.__mk.dj.st.kills'), '| hp', await A.evaluate('Math.round(window.__mk.dj.st.heroes[0].hp)'), '| fx', await A.evaluate('window.__mk.fx()'))
        # fuir → bilan → retour au village
        A.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await A.click('[data-act="djFlee"]'); await A.wait_for_timeout(5000)
        for i in range(20):
            if await A.is_visible('[data-act="djBack"]'): break
            await A.wait_for_timeout(1000)
        print('results:', (await A.inner_text('#mcard')).replace('\n', ' | ')[:300])
        await A.screenshot(path=S + 'dj_results.png')
        await A.click('[data-act="djBack"]'); await A.wait_for_timeout(4000)
        for i in range(30):
            if await A.evaluate('window.__mk.busy') == 0: break
            await A.wait_for_timeout(1000)
        print('back home:', await A.evaluate('window.__mk.mode'), '| dj', await A.evaluate('!!window.__mk.dj'))
        await A.screenshot(path=S + 'dj_home.png')
        vid = await A.evaluate('window.__mk.vid')
        v = tree()['v2']['villages'][vid]
        h = list(v['heroes'].values())[0]
        print('server hero:', {k: h.get(k) for k in ('name', 'lvl', 'xp', 'sp', 'dj', 'runs', 'wins')}, '| log:', [l['m'] for l in (v['log'] if isinstance(v['log'], list) else [v['log'][k] for k in sorted(v['log'], key=int)])][-1:])
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
