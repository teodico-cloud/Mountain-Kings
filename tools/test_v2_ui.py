"""Essai du nouveau jeu à deux joueurs (faux Firebase) : fonder, créer son héros, inviter, rejoindre, agir en même temps.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_ui.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8796
URL = f'http://127.0.0.1:{PORT}/v2/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()
arr = lambda x: [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])

async def text(pg, sel):
    try: return (await pg.inner_text(sel, timeout=8000)).replace('\n', ' | ')
    except Exception: return f'<none {sel}>'

async def close_modal(pg):
    if await pg.is_visible('#modal') and await pg.is_visible('[data-act="closeModal"]'):
        await pg.click('[data-act="closeModal"]'); await pg.wait_for_timeout(500)

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        async def page(name):
            ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
            pg = await ctx.new_page()
            pg.on('console', lambda m: logs.append(f'[{name}] {m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
            pg.on('pageerror', lambda e: logs.append(f'[{name}] pageerror: {e}'))
            return pg
        A = await page('alice')
        await A.goto(URL + '?u=alice', timeout=120000, wait_until='domcontentloaded'); await A.wait_for_timeout(4000)
        print('A modal:', (await text(A, '#mcard'))[:120])
        await A.click('[data-act="login"]'); await A.wait_for_timeout(3000)
        print('A gate:', (await text(A, '#mcard'))[:160])
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        print('A hero form:', (await text(A, '#mcard'))[:120])
        await A.screenshot(path=S + 'v2_hero_form.png')
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(6000)
        print('A mode:', await A.evaluate('window.__mk.mode'), '| top:', (await text(A, '#hudTop'))[:200], '| welcome:', (await text(A, '#mcard'))[:60] if await A.is_visible('#modal') else 'none')
        await close_modal(A)
        await A.screenshot(path=S + 'v2_home.png')
        vid = await A.evaluate('window.__mk.vid')
        t = tree(); v = t['v2']['villages'][vid]
        print('server: members', list(v['members'].keys()), 'heroes', {k: h['name'] for k, h in v.get('heroes', {}).items()}, 'villagers', len(arr(v['vil'])), 'buildings', len(arr(v['b'])))
        # menus
        for s in ['build', 'people', 'hero', 'journal', 'village']:
            await close_modal(A)
            await A.click(f'.nav [data-s="{s}"]'); await A.wait_for_timeout(900)
            await A.screenshot(path=S + f'v2_sheet_{s}.png')
            print('sheet', s, ':', (await text(A, '#sheetBody'))[:150])
            await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(300)
        # construire une maison
        await close_modal(A)
        await A.click('.nav [data-s="build"]'); await A.wait_for_timeout(600)
        await A.click('[data-act="place"][data-type="maison"]'); await A.wait_for_timeout(800)
        await A.click('[data-act="placeOk"]'); await A.wait_for_timeout(1500)
        print('after build:', await A.evaluate('window.__mk.me.b.filter(b => b.up).map(b => b.type + ":" + b.up.need)'))
        # toucher la halle pour ouvrir son panneau
        await close_modal(A)
        pt = await A.evaluate('window.__mk.toScreen(11.5, 11.5)')
        await A.mouse.click(pt[0], pt[1]); await A.wait_for_timeout(800)
        print('panel:', (await text(A, '#hudBottom'))[:160])
        await A.screenshot(path=S + 'v2_panel.png')
        await A.click('[data-act="desel"]'); await A.wait_for_timeout(300)
        # Léa rejoint avec le lien d'invitation
        B = await page('lea')
        await B.goto(URL + '?u=lea&join=' + vid, timeout=120000, wait_until='domcontentloaded'); await B.wait_for_timeout(6000)
        await B.click('[data-act="login"]'); await B.wait_for_timeout(3000)
        print('B join:', (await text(B, '#mcard'))[:140])
        await B.fill('#jPname', 'Léa'); await B.click('#joinForm button[type=submit]'); await B.wait_for_timeout(5000)
        print('B hero form:', (await text(B, '#mcard'))[:80])
        await B.fill('#hName', 'Aelith'); await B.click('label.optc:has(input[value="f"])')
        await B.click('label.optc:has(input[value="elfe"])'); await B.click('label.optc:has(input[value="rodeur"])')
        await B.click('#heroForm button[type=submit]'); await B.wait_for_timeout(6000)
        print('B mode:', await B.evaluate('window.__mk.mode'), '| top:', (await text(B, '#hudTop'))[:160])
        await close_modal(B)
        await B.screenshot(path=S + 'v2_home_B.png')
        # actions en même temps : Téo affecte son héros, Léa change un métier
        vb = await B.evaluate('window.__mk.me.vil.find(p => p.job === "bat").id')
        chasse = await A.evaluate('window.__mk.me.b.find(b => b.type === "carriere" || b.type === "chasse").id')
        await asyncio.gather(A.evaluate(f'window.__mk.act({{type: "heroAt", to: {chasse}}})'), B.evaluate(f'window.__mk.act({{type: "job", vid: {vb}, to: null}})'))
        for i in range(60):
            await A.wait_for_timeout(1000)
            if await A.evaluate('window.__mk.busy') == 0 and await B.evaluate('window.__mk.busy') == 0: break
        await A.wait_for_timeout(2000)
        print('both phones saved after', i + 1, 's')
        t = tree(); v = t['v2']['villages'][vid]
        heroes = v.get('heroes', {})
        print('server after both: members', [m['name'] for m in v['members'].values()], '| hero Téo at', heroes.get('uid_alice', {}).get('at'), '| villager', vb, 'job', [p.get('job') for p in arr(v['vil']) if p['id'] == vb], '| log tail:', [l['m'] for l in arr(v['log'])][-4:])
        sa = await A.evaluate('JSON.stringify([window.__mk.me.heroes, window.__mk.me.vil.map(p => p.job)])')
        sb = await B.evaluate('JSON.stringify([window.__mk.me.heroes, window.__mk.me.vil.map(p => p.job)])')
        print('A and B see the same village:', sa == sb)
        # deux jours plus tard : on recule toutes les horloges du village (et ce que Téo a déjà lu) pour simuler son absence
        D2 = 2 * 86400000
        for k in ('t', 'born'): v[k] -= D2
        for k in ('feast', 'feastCd'):
            if v.get(k): v[k] -= D2
        for coll in ('log', 'vil', 'cands'):
            if isinstance(v.get(coll), dict): v[coll] = arr(v[coll])
            for e in v.get(coll) or []:
                if e and 't' in e: e['t'] -= D2
        for m in v['members'].values(): m['t'] -= D2
        await A.evaluate(f"""(() => {{ for (const k of ['mk2.log.{vid}', 'mk2.read.{vid}']) {{ const x = JSON.parse(localStorage.getItem(k) || '0'); if (x) localStorage.setItem(k, JSON.stringify(x - {D2})); }} }})()""")
        put('v2/villages/' + vid, v)
        await A.reload(timeout=120000, wait_until='domcontentloaded'); await A.wait_for_timeout(9000)
        print('after 2 days: mode', await A.evaluate('window.__mk.mode'), '| cands', await A.evaluate('window.__mk.me && window.__mk.me.cands.length'), '| season', await A.evaluate('window.__mk.me && window.__mk.me.ws'), '| food', await A.evaluate('window.__mk.me && Math.round(window.__mk.me.r.pain + window.__mk.me.r.viande)'), '| modal:', (await text(A, '#mcard'))[:300] if await A.is_visible('#modal') else 'none')
        await A.screenshot(path=S + 'v2_after2days.png')
        await close_modal(A)
        await A.wait_for_timeout(1500)
        print('after 2 days, next modal:', (await text(A, '#mcard'))[:200] if await A.is_visible('#modal') else 'none')
        T = await A.evaluate('window.__mk.now()')
        sa = await A.evaluate(f'window.__mk.simAt({T})'); sb = await B.evaluate(f'window.__mk.simAt({T})')
        print('after 2 days, A and B compute the same village:', sa == sb, '| A:', (sa or '')[:120])
        await b.close()
    print('\n'.join(logs[:40]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
