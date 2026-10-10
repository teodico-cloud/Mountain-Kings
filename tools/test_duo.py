import asyncio, json, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8790
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + 'docs', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(URL + 'fb/tree'))
def writes(): return json.load(urllib.request.urlopen(URL + 'fb/writes'))

async def page(b, name, logs):
    ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, color_scheme='light')
    pg = await ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{name}] {m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[{name}] pageerror: {e}'))
    await pg.goto(URL + '?u=' + name)
    return ctx, pg

async def text(pg, sel):
    try: return (await pg.inner_text(sel, timeout=2000)).replace('\n', ' | ')
    except Exception as e: return f'<none {sel}>'

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        ca, A = await page(b, 'alice', logs)
        await A.wait_for_timeout(2500)
        print('A modal:', await text(A, '#mcard'))
        await A.screenshot(path=S + 't_login.png')
        await A.click('[data-act="login"]')
        await A.wait_for_timeout(2500)
        print('A gate:', (await text(A, '#mcard'))[:300])
        await A.screenshot(path=S + 't_gate_import.png')
        await A.click('[data-act="importOld"]')
        await A.wait_for_timeout(2000)
        t = tree()
        print('imported:', t.get('imported'), '| village A:', t['villages']['uid_alice']['name'], 'key', t['villages']['uid_alice']['key'])

        cb, B = await page(b, 'bob', logs)
        await B.wait_for_timeout(2000)
        await B.click('[data-act="login"]')
        await B.wait_for_timeout(2500)
        g = await text(B, '#mcard')
        print('B gate has import?', 'Reprendre' in g, '| mentions Alice village?', 'Téo' in g)
        await B.fill('#fVname', 'Forge-Basse'); await B.fill('#fPname', 'Léa')
        await B.click('#foundForm button[type=submit]')
        await B.wait_for_timeout(12000)  # modèles 3D
        print('presence:', list(tree().get('presence', {}).keys()))
        print('A top:', (await text(A, '#hudTop'))[:200])
        await A.screenshot(path=S + 't_home_A.png')

        # Cadeau de Alice vers Léa
        await A.click('[data-act="sheet"][data-s="duo"]'); await A.wait_for_timeout(500)
        await A.screenshot(path=S + 't_duo_sheet.png')
        await A.click('[data-act="gift"]'); await A.wait_for_timeout(400)
        await A.click('[data-act="giftAdj"][data-r="bois"][data-d="100"]'); await A.wait_for_timeout(200)
        await A.click('[data-act="giftSend"]'); await A.wait_for_timeout(2500)
        print('B toast after gift:', await text(B, '#toast'), '| dons left:', tree().get('dons'))

        # Raid à deux : Alice invite Léa
        await A.click('[data-act="sheet"][data-s="duo"]'); await A.wait_for_timeout(500)
        await A.click('[data-act="duoInvite"]'); await A.wait_for_timeout(2000)
        print('B invite:', (await text(B, '#hudTop'))[-200:])
        await B.click('[data-act="duoAccept"]'); await B.wait_for_timeout(3000)
        for (x, y) in [(120, 200), (720, 200), (422, 330)]:
            await A.mouse.click(x, y); await A.wait_for_timeout(200)
        for (x, y) in [(300, 120), (560, 300), (720, 120)]:
            await B.mouse.click(x, y); await B.wait_for_timeout(200)
        await A.wait_for_timeout(8000)
        await A.screenshot(path=S + 't_fight_A.png'); await B.screenshot(path=S + 't_fight_B.png')
        print('A fight HUD:', (await text(A, '#hudTop'))[:160])
        print('B fight HUD:', (await text(B, '#hudTop'))[:160])
        w = writes()
        st = [x for x in w if x['path'].endswith('/st')]
        print('st writes:', len(st), 'avg size', sum(x['size'] for x in st) // max(1, len(st)))
        print('ev writes:', [x['path'].split('/')[-2] for x in w if '/ev/' in x['path']][:12])
        # Fin : chacun arrête de déployer, on attend la fin
        await A.click('[data-act="endFight"]'); await B.click('[data-act="endFight"]')
        for i in range(130):
            await A.wait_for_timeout(2000)
            if i % 10 == 0: print('  ...', (await text(A, '#hudTop'))[-30:], '/', (await text(B, '#hudTop'))[-30:])
            if i == 6: await A.screenshot(path=S + 't_fight_A2.png'); await B.screenshot(path=S + 't_fight_B2.png')
            if await A.is_visible('[data-act="resultOk"]') and await B.is_visible('[data-act="resultOk"]'): break
        print('A result:', (await text(A, '#mcard'))[:220])
        print('B result:', (await text(B, '#mcard'))[:220])
        await B.screenshot(path=S + 't_result_B.png')
        await A.click('[data-act="resultOk"]'); await B.click('[data-act="resultOk"]')
        await A.wait_for_timeout(10000)
        t = tree()
        print('live nodes left:', list(t.get('duo', {}).get('live', {}).keys()))
        va, vb = t['villages']['uid_alice'], t['villages']['uid_bob']
        print('medals A/B:', va.get('medals'), vb.get('medals'), '| played', va.get('played'), vb.get('played'))
        # Léa ferme le jeu : Alice doit la voir hors ligne
        await cb.close(); await A.wait_for_timeout(4000)
        print('presence after B closed:', list(tree().get('presence', {}).keys()))
        await A.click('[data-act="sheet"][data-s="village"]'); await A.wait_for_timeout(500)
        await A.screenshot(path=S + 't_village_sheet.png')
        # Rechargement : Alice reste connectée et retrouve son village
        await A.reload(); await A.wait_for_timeout(4000)
        print('A after reload top:', (await text(A, '#hudTop'))[:120], '| modal:', (await text(A, '#mcard'))[:60])
        await b.close()
    print('\n'.join(logs[:40]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
