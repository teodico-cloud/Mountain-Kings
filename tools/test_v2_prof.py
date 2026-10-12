"""Essai dans le navigateur (faux Firebase) : le menu des 3 donjons, la crypte des rois, puis les Profondeurs
(étage fini → descendre → étage 2 → remonter ; puis une descente abandonnée), avec le record enregistré sur le serveur.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_prof.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Lent avec le rendu logiciel (≈ 6-8 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8796
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
arr = lambda x: [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])
txt = lambda s: s.replace('\n', ' | ')

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

# vide l'étage (le temps de l'essai), puis pose le héros sur la sortie
CLEAR = """(() => { const s = window.__mk.dj.st; s.mobs = [];
  s.rooms.forEach((R, i) => { const k = s.d.rooms[i].kind; if ((k === 'fight' || k === 'boss') && R.st !== 'clear') R.st = 'lock'; }); })()"""
TO_EXIT = """(() => { const s = window.__mk.dj.st; if (!s.exit) return false; const h = s.heroes[0]; h.x = h.px = s.exit.x; h.y = h.py = s.exit.y; h.tp = (h.tp || 0) + 1; return true; })()"""
INFO = '(() => { const s = window.__mk.dj && window.__mk.dj.st; return s ? { theme: s.d.theme, floor: s.d.floor || 0, lvl: s.lvl, info: document.getElementById("djInfo").textContent, boss: window.__mk.dj.bossN, hp: Math.round(s.heroes[0].hp / s.heroes[0].hpMax * 100), pot: s.heroes[0].pot } : null; })()'

async def main():
    logs = []
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
        await close_modal(A)
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        # le héros a déjà vaincu la mine au niveau 4 : crypte et Profondeurs ouvertes
        r = await A.evaluate("(() => { const hid = Object.keys(window.__mk.me.heroes)[0]; return window.__mk.act({ type: 'djEnd', hid, lvl: 4, win: true, xp: 2000, theme: 'mine' }, { quiet: true }); })()")
        print('hero after a level-4 win:', r)
        await until(A, 'window.__mk.busy === 0', 60)
        await close_modal(A)
        # le menu : trois donjons
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        print('menu:', txt(body)[:420])
        print('buttons:', await A.evaluate('[...document.querySelectorAll("[data-act=djGo]")].map(b => b.dataset.th + ":" + b.dataset.k)'))
        await A.screenshot(path=S + 'prof_menu.png', full_page=True)
        # la crypte des rois
        await A.click('[data-act="djGo"][data-th="crypte"]')
        await until(A, '!!window.__mk.dj', 60); await A.wait_for_timeout(4000)
        print('crypt:', await A.evaluate(INFO), '| mobs', await A.evaluate('[...new Set(window.__mk.dj.st.d.monsters.map(m => m.type))].join(",")'))
        await A.screenshot(path=S + 'prof_crypt.png')
        A.once('dialog', lambda d: (print('confirm:', d.message), asyncio.ensure_future(d.accept())))
        await A.click('[data-act="djFlee"]')
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 60)
        print('crypt results:', txt(await A.inner_text('#mcard'))[:240])
        await A.click('[data-act="djBack"]'); await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60)
        # les Profondeurs, étage 1
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        await A.click('[data-act="djGo"][data-th="prof"]')
        await until(A, '!!window.__mk.dj', 60); await A.wait_for_timeout(4000)
        print('prof floor 1:', await A.evaluate(INFO), '| run', await A.evaluate('JSON.stringify(window.__mk.dj.run)'))
        await A.screenshot(path=S + 'prof_floor1.png')
        await A.evaluate("(() => { const h = window.__mk.dj.st.heroes[0]; h.hp = h.hpMax * 0.5; h.pot = 2; })()")
        await A.evaluate(CLEAR)
        print('exit open:', await until(A, '!!window.__mk.dj.st.exit', 30))
        await A.evaluate(TO_EXIT)
        ok = await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djDown]")', 60)
        print('floor 1 done:', ok, '|', txt(await A.inner_text('#mcard'))[:420])
        await A.screenshot(path=S + 'prof_floor_done.png')
        await A.click('[data-act="djDown"]')
        await until(A, 'window.__mk.dj.st.d.floor === 2', 60); await A.wait_for_timeout(3000)
        print('prof floor 2:', await A.evaluate(INFO), '| modal', await A.evaluate('document.getElementById("modal").hidden'))
        await A.screenshot(path=S + 'prof_floor2.png')
        await A.evaluate(CLEAR); await until(A, '!!window.__mk.dj.st.exit', 30); await A.evaluate(TO_EXIT)
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djUp]")', 60)
        print('floor 2 done:', txt(await A.inner_text('#mcard'))[:200])
        await A.click('[data-act="djUp"]')
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 60)
        print('ascend results:', txt(await A.inner_text('#mcard'))[:320])
        await A.screenshot(path=S + 'prof_results.png')
        await A.click('[data-act="djBack"]'); await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60); await A.wait_for_timeout(2000)
        v = tree()['v2']['villages'][vid]; h = list(v['heroes'].values())[0]
        print('server hero:', {k: h.get(k) for k in ('lvl', 'xp', 'dj', 'deep', 'runs', 'wins')}, '| log:', [l['m'] for l in arr(v['log'])][-1:])
        # une descente abandonnée tout de suite : la moitié, le record reste
        await close_modal(A)
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        print('record shown in the menu:', 'Record de Brokk : 2 étages' in (await A.inner_text('#sheetBody')))
        await A.click('[data-act="djGo"][data-th="prof"]')
        await until(A, '!!window.__mk.dj', 60); await A.wait_for_timeout(3000)
        await A.evaluate('window.__mk.dj.st.xp = 80')
        A.once('dialog', lambda d: (print('confirm:', d.message), asyncio.ensure_future(d.accept())))
        await A.click('[data-act="djFlee"]')
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 60)
        print('flee results:', txt(await A.inner_text('#mcard'))[:300])
        await A.click('[data-act="djBack"]'); await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60); await A.wait_for_timeout(2000)
        v = tree()['v2']['villages'][vid]; h = list(v['heroes'].values())[0]
        print('server hero:', {k: h.get(k) for k in ('lvl', 'xp', 'dj', 'deep', 'runs', 'wins')}, '| log:', [l['m'] for l in arr(v['log'])][-1:])
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
