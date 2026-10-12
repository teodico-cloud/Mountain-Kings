"""Essai du donjon à deux dans le navigateur (faux Firebase) : Téo invite, Léa accepte, les deux héros dans la même mine,
Léa bouge et lance une compétence (vue chez Téo), Léa part, Téo fuit, chacun récupère son expérience.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_djduo.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Très lent avec le rendu logiciel (deux pages, ≈ 15-20 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8798
URL = f'http://127.0.0.1:{PORT}/v2/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
arr = lambda x: [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])

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
        # Téo invite Léa
        await close_modal(A)
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        print('sheet (A):', (await A.inner_text('#sheetBody')).replace('\n', ' | ')[:300])
        await A.click('[data-act="djInvite"]')
        ok = await until(B, 'document.querySelector("[data-act=djYes]") !== null', 90)
        print('invitation shown on B:', ok, '|', (await B.inner_text('#mcard')).replace('\n', ' | ')[:200] if ok else '')
        await B.screenshot(path=S + 'duo_invite.png')
        await B.click('[data-act="djYes"]')
        okA = await until(A, '!!(window.__mk.dj && window.__mk.dj.duo)', 120)
        okB = await until(B, '!!(window.__mk.dj && window.__mk.dj.duo)', 120)
        print('both in the dungeon:', okA, okB, '| roles', await A.evaluate('window.__mk.dj && window.__mk.dj.duo.role'), await B.evaluate('window.__mk.dj && window.__mk.dj.duo.role'))
        print('same dungeon:', await A.evaluate('window.__mk.dj.seed') == await B.evaluate('window.__mk.dj.seed'), '| heroes', await A.evaluate('window.__mk.dj.st.heroes.map(h => h.name + (h.remote ? "*" : ""))'), '| hp mob0 A/B', await A.evaluate('Math.round(window.__mk.dj.st.mobs[0].hpMax)'), await B.evaluate('Math.round(window.__mk.dj.st.mobs[0].hpMax)'))
        await until(B, 'window.__mk.dj.st.snapN > 2', 60)
        # Léa bouge chez elle : Téo doit la voir bouger
        pa0 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[1]; return [h.x, h.y]; })()')
        await B.keyboard.down('ArrowUp'); await B.wait_for_timeout(5000); await B.keyboard.up('ArrowUp'); await B.wait_for_timeout(3000)
        pb = await B.evaluate('(() => { const h = window.__mk.dj.st.heroes[1]; return [h.x, h.y]; })()')
        pa1 = await A.evaluate('(() => { const h = window.__mk.dj.st.heroes[1]; return [h.x, h.y]; })()')
        print('Lea moved on her phone:', [round(v, 2) for v in pb], '| seen by Teo:', [round(v, 2) for v in pa1], '| moved', round(((pa1[0] - pa0[0]) ** 2 + (pa1[1] - pa0[1]) ** 2) ** 0.5, 2))
        await A.screenshot(path=S + 'duo_A_start.png'); await B.screenshot(path=S + 'duo_B_start.png')
        # au combat : l'hôte place les deux héros dans la 1re salle (Léa est « téléportée » : son téléphone se recale)
        await A.evaluate("""(() => { const s = window.__mk.dj.st, r = s.d.rooms.find(r => r.kind === 'fight'); const c = r.cells[Math.floor(r.cells.length / 2)];
          s.heroes.forEach((h, i) => { h.x = h.px = c[0] + 0.5 + i * 0.8; h.y = h.py = c[1] + 0.5; h.tp = (h.tp || 0) + 1; }); })()""")
        await until(B, '(() => { const s = window.__mk.dj.st; return s.rooms.some(R => R.st === "lock"); })()', 90)
        c0 = await A.evaluate('window.__mk.dj.st.heroes[1].castN')
        await B.keyboard.press('1'); await B.wait_for_timeout(8000)
        c1 = await A.evaluate('window.__mk.dj.st.heroes[1].castN')
        print('Lea skill seen by the host:', c0, '->', c1)
        await A.wait_for_timeout(10000)
        await A.screenshot(path=S + 'duo_A_fight.png'); await B.screenshot(path=S + 'duo_B_fight.png')
        fa = await A.evaluate('(() => { const s = window.__mk.dj.st; return { kills: s.kills, awake: s.mobs.filter(m => m.awake).length, hp: s.heroes.map(h => Math.round(h.hp)), info: document.getElementById("djInfo").textContent, mate: (document.getElementById("djMateN") || {}).textContent }; })()')
        fb = await B.evaluate('(() => { const s = window.__mk.dj.st; return { kills: s.kills, awake: s.mobs.filter(m => m.awake).length, hp: s.heroes.map(h => Math.round(h.hp)), info: document.getElementById("djInfo").textContent, mate: (document.getElementById("djMateN") || {}).textContent }; })()')
        print('fight A:', fa); print('fight B:', fb)
        # Léa part (moitié de l'expérience), Téo continue puis fuit
        B.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await B.click('[data-act="djFlee"]')
        await until(B, 'document.querySelector("[data-act=djBack]") !== null', 60)
        print('results B:', (await B.inner_text('#mcard')).replace('\n', ' | ')[:240])
        gone = await until(A, 'window.__mk.dj.duo.gone', 60)
        print('host sees Lea gone:', gone)
        await B.click('[data-act="djBack"]')
        A.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await A.click('[data-act="djFlee"]')
        await until(A, 'document.querySelector("[data-act=djBack]") !== null', 60)
        print('results A:', (await A.inner_text('#mcard')).replace('\n', ' | ')[:240])
        await A.screenshot(path=S + 'duo_A_results.png')
        await A.click('[data-act="djBack"]')
        await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60); await until(B, 'window.__mk.busy === 0 && !window.__mk.dj', 60)
        await A.wait_for_timeout(3000)
        v = tree()['v2']['villages'][vid]
        print('server heroes:', {h['name']: {k: h.get(k) for k in ('lvl', 'xp', 'runs')} for h in v['heroes'].values()}, '| log:', [l['m'] for l in arr(v['log'])][-2:])
        print('live channel cleaned:', 'live' not in tree()['v2'] or vid not in tree()['v2'].get('live', {}))
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
