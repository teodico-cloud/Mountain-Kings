"""Essai des Profondeurs à deux dans le navigateur (faux Firebase) : Téo invite Léa dans les Profondeurs, l'étage 1 se termine,
Téo choisit de descendre, le téléphone de Léa fabrique le même étage 2 et la suit, puis Téo remonte : le cumul et le record
sont enregistrés pour les deux héros.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_profduo.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Très lent avec le rendu logiciel (deux pages, ≈ 15-20 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
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

CLEAR = """(() => { const s = window.__mk.dj.st; s.mobs = [];
  s.rooms.forEach((R, i) => { const k = s.d.rooms[i].kind; if ((k === 'fight' || k === 'boss') && R.st !== 'clear') R.st = 'lock'; }); })()"""
TO_EXIT = """(() => { const s = window.__mk.dj.st; if (!s.exit) return false; const h = s.heroes[0]; h.x = h.px = s.exit.x; h.y = h.py = s.exit.y; h.tp = (h.tp || 0) + 1; return true; })()"""
STATE = '(() => { const d = window.__mk.dj; if (!d) return null; const s = d.st; return { role: d.duo ? d.duo.role : "solo", floor: s.d.floor, seed: s.d.seed, over: s.over, run: d.run && [d.run.floor, d.run.done, Math.round(d.run.xp)], modal: (document.getElementById("modal").hidden ? "" : document.getElementById("mcard").innerText.split("\\n").slice(0, 2).join(" / ")), info: (document.getElementById("djInfo") || {}).textContent }; })()'

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        async def page(name):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
            pg = await ctx.new_page(); pg.set_default_timeout(180000)
            pg.on('console', lambda m: logs.append(f'[{name}] {m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
            pg.on('pageerror', lambda e: logs.append(f'[{name}] pageerror: {e}'))
            return pg
        A = await page('teo')
        await A.goto(URL + '?u=alice', timeout=180000, wait_until='domcontentloaded'); await A.wait_for_timeout(4000)
        await A.click('[data-act="login"]'); await A.wait_for_timeout(3000)
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await close_modal(A)
        await until(A, 'window.__mk.busy === 0 && !!window.__mk.vid')
        vid = await A.evaluate('window.__mk.vid')
        B = await page('lea')
        await B.goto(URL + '?u=lea&join=' + vid, timeout=180000, wait_until='domcontentloaded'); await B.wait_for_timeout(6000)
        await B.click('[data-act="login"]'); await B.wait_for_timeout(3000)
        await B.fill('#jPname', 'Léa'); await B.click('#joinForm button[type=submit]'); await B.wait_for_timeout(5000)
        await B.fill('#hName', 'Aelith'); await B.click('label.optc:has(input[value="f"])')
        await B.click('label.optc:has(input[value="elfe"])'); await B.click('label.optc:has(input[value="rodeur"])')
        await B.click('#heroForm button[type=submit]'); await B.wait_for_timeout(5000)
        await close_modal(B)
        await until(B, 'window.__mk.busy === 0 && Object.keys(window.__mk.me.heroes).length === 2')
        await until(A, 'Object.keys(window.__mk.me.heroes).length === 2')
        # Brokk a déjà vaincu la mine au niveau 4 : les Profondeurs sont ouvertes
        await A.evaluate("(() => { const hid = window.__mk.me.members[Object.keys(window.__mk.me.members).find(k => window.__mk.me.members[k].name === 'Téo')].hero; return window.__mk.act({ type: 'djEnd', hid, lvl: 4, win: true, xp: 2000, theme: 'mine' }, { quiet: true }); })()")
        await until(A, 'window.__mk.busy === 0', 60); await A.wait_for_timeout(2000)
        await close_modal(A)
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        await A.click('[data-act="djInvite"][data-th="prof"]')
        ok = await until(B, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djYes]")', 90)
        print('invitation on B:', ok, '|', txt(await B.inner_text('#mcard'))[:200] if ok else '')
        await B.click('[data-act="djYes"]')
        okA = await until(A, '!!(window.__mk.dj && window.__mk.dj.duo)', 120); okB = await until(B, '!!(window.__mk.dj && window.__mk.dj.duo)', 120)
        await until(B, 'window.__mk.dj.st.snapN > 2', 60)
        a1, b1 = await A.evaluate(STATE), await B.evaluate(STATE)
        print('floor 1 A:', a1); print('floor 1 B:', b1)
        print('same floor 1:', okA and okB and a1['seed'] == b1['seed'] and a1['floor'] == b1['floor'] == 1)
        # Téo vide l'étage 1 et prend la sortie
        await A.evaluate(CLEAR); await until(A, '!!window.__mk.dj.st.exit', 30); await A.evaluate(TO_EXIT)
        okA = await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djDown]")', 60)
        okB = await until(B, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djLeaveFloor]")', 60)
        print('end of floor 1 — A choice:', okA, '| B waits:', okB)
        print('  A:', await A.evaluate(STATE)); print('  B:', await B.evaluate(STATE))
        await B.screenshot(path=S + 'profduo_B_wait.png')
        await A.click('[data-act="djDown"]')
        okA = await until(A, 'window.__mk.dj.st.d.floor === 2', 60); okB = await until(B, 'window.__mk.dj.st.d.floor === 2', 90)
        await B.wait_for_timeout(4000)
        a2, b2 = await A.evaluate(STATE), await B.evaluate(STATE)
        print('floor 2 A:', a2); print('floor 2 B:', b2)
        print('same floor 2:', okA and okB and a2['seed'] == b2['seed'], '| B modal closed:', not b2['modal'])
        # Léa bouge sur l'étage 2 : Téo la voit bouger
        pa0 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[1]; return [h.x, h.y]; })()')
        await B.keyboard.down('ArrowUp'); await B.wait_for_timeout(4000); await B.keyboard.up('ArrowUp'); await B.wait_for_timeout(3000)
        pa1 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[1]; return [h.x, h.y]; })()')
        print('Lea moves on floor 2, seen by Teo:', round(((pa1[0] - pa0[0]) ** 2 + (pa1[1] - pa0[1]) ** 2) ** 0.5, 2), 'cells')
        await A.screenshot(path=S + 'profduo_A_floor2.png'); await B.screenshot(path=S + 'profduo_B_floor2.png')
        # étage 2 fini : Téo remonte
        await A.evaluate(CLEAR); await until(A, '!!window.__mk.dj.st.exit', 30); await A.evaluate(TO_EXIT)
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djUp]")', 60)
        await until(B, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djLeaveFloor]")', 60)
        await A.click('[data-act="djUp"]')
        okA = await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 60); okB = await until(B, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 90)
        print('results A:', okA, txt(await A.inner_text('#mcard'))[:300])
        print('results B:', okB, txt(await B.inner_text('#mcard'))[:300])
        await B.screenshot(path=S + 'profduo_B_results.png')
        await B.click('[data-act="djBack"]'); await A.click('[data-act="djBack"]')
        await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60); await until(B, 'window.__mk.busy === 0 && !window.__mk.dj', 60)
        await A.wait_for_timeout(3000)
        v = tree()['v2']['villages'][vid]
        print('server heroes:', {h['name']: {k: h.get(k) for k in ('lvl', 'xp', 'deep', 'runs')} for h in v['heroes'].values()}, '| log:', [l['m'] for l in arr(v['log'])][-2:])
        print('live channel cleaned:', 'live' not in tree()['v2'] or vid not in tree()['v2'].get('live', {}))
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
