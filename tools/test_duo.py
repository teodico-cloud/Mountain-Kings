import asyncio, json, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8790
URL = f'http://127.0.0.1:{PORT}/v1/'   # l'ancien jeu (build.py --test construit dans .test/v1/)
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def writes(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/writes'))

async def page(b, name, logs):
    ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1, color_scheme='light')
    pg = await ctx.new_page()
    pg.on('console', lambda m: logs.append(f'[{name}] {m.type}: {m.text}') if m.type in ('error', 'warning') and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('pageerror', lambda e: logs.append(f'[{name}] pageerror: {e}'))
    await pg.goto(URL + '?u=' + name)
    return ctx, pg

async def text(pg, sel):
    try: return (await pg.inner_text(sel, timeout=8000)).replace('\n', ' | ')
    except Exception as e: return f'<none {sel}>'

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
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
        await B.wait_for_timeout(2500)
        print('B tutorial shown:', await B.is_visible('#tuto'))
        await B.click('[data-act="tutoSkip"]')
        # Héros et troupes pour les deux
        t = tree()
        arr = lambda x: [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])
        for uid, hk in (('uid_alice', 'roi'), ('uid_bob', 'berserker')):
            v = t['villages'][uid]; v['b'] = arr(v['b'])
            for bb in v['b']:
                if bb['type'] == 'mairie': bb['lvl'] = 3
            v['b'].append({'id': v['nid'], 'type': 'heros', 'lvl': 3, 'gx': 17, 'gz': 3}); v['nid'] += 1
            v['heroes'] = {hk: {'lvl': 2, 'rest': 0}}
            v['army'] = {'fantassin': 20, 'archer': 5, 'belier': 0}
            v['t'] = int(time.time() * 1000); v['lastActive'] = v['t']; v['cid'] = 'inj'
            req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': 'villages/' + uid, 'v': v}).encode(), headers={'content-type': 'application/json'})
            urllib.request.urlopen(req).read()
        await B.wait_for_timeout(10000)  # modèles 3D
        print('presence:', list(tree().get('presence', {}).keys()))
        print('A top:', (await text(A, '#hudTop'))[:200])
        await A.screenshot(path=S + 't_home_A.png')

        # Cadeau de Alice vers Léa
        await A.click('.nav [data-s="duo"]'); await A.wait_for_timeout(500)
        await A.screenshot(path=S + 't_duo_sheet.png')
        await A.click('[data-act="gift"]'); await A.wait_for_timeout(400)
        await A.click('[data-act="giftAdj"][data-r="bois"][data-d="100"]'); await A.wait_for_timeout(200)
        await A.click('[data-act="giftSend"]'); await A.wait_for_timeout(2500)
        print('B toast after gift:', await text(B, '#toast'), '| dons left:', tree().get('dons'))

        # Raid à deux : Alice invite Léa
        await A.click('.nav [data-s="duo"]'); await A.wait_for_timeout(500)
        await A.click('[data-act="duoInvite"]'); await A.wait_for_timeout(2000)
        print('B invite:', (await text(B, '#hudTop'))[-200:])
        await B.click('[data-act="duoAccept"]'); await B.wait_for_timeout(3000)
        async def spots(pg, n, side):
            # points de déploiement valides, visibles entre les deux barres de l'écran
            js = '''(side) => { const out = []; for (let i = 0; i <= 96; i++) { const t = i / 96 * 24;
              const cand = side ? [[t, 0.7], [23.3, t]] : [[0.7, t], [t, 23.3]];
              for (const [x, z] of cand) { if (!window.__mk.canDeploy(x, z)) continue; const p = window.__mk.toScreen(x, z); if (p[1] > 90 && p[1] < 255 && p[0] > 30 && p[0] < 814) out.push([x, z, p[0], p[1]]); } } return out; }'''
            pts = await pg.evaluate(js, side)
            return pts[len(pts) // 3: len(pts) // 3 + n] if len(pts) > n else pts
        async def tapxy(pg, p): await pg.mouse.click(p[2], p[3]); await pg.wait_for_timeout(250)
        pa, pb = await spots(A, 3, 0), await spots(B, 3, 1)
        print('deploy spots A/B:', [p[:2] for p in pa], [p[:2] for p in pb])
        await tapxy(A, pa[0]); await tapxy(A, pa[1])
        await A.click('[data-act="troop"][data-u="h:roi"]'); await tapxy(A, pa[2])
        await tapxy(B, pb[0]); await tapxy(B, pb[1])
        await B.click('[data-act="troop"][data-u="h:berserker"]'); await tapxy(B, pb[2])
        await A.wait_for_timeout(3000)
        hu = await A.evaluate("window.__mk.fight.B.units.filter(u => u.hero).map(u => [u.type, u.owner, u.lvl, Math.round(u.max)])")
        print('host sees heroes:', hu)
        print('guest bar:', (await text(B, '#hudBottom'))[:160])
        await B.click('[data-act="power"]'); await A.click('[data-act="power"]')
        await A.wait_for_timeout(2500)
        pw = await A.evaluate("window.__mk.fight.B.units.filter(u => u.hero).map(u => [u.type, u.pw, u.bT])")
        print('powers used (host view):', pw)
        await A.wait_for_timeout(4000)
        await A.screenshot(path=S + 't_fight_A.png'); await B.screenshot(path=S + 't_fight_B.png')
        print('A fight HUD:', (await text(A, '#hudTop'))[:160])
        print('B fight HUD:', (await text(B, '#hudTop'))[:160])
        w = writes()
        st = [x for x in w if x['path'].endswith('/st')]
        print('st writes:', len(st), 'avg size', sum(x['size'] for x in st) // max(1, len(st)))
        print('ev writes:', [x['path'].split('/')[-2] for x in w if '/ev/' in x['path']][:12])
        # Fin : chacun arrête de déployer, puis on termine la bataille côté hôte (sinon trop long avec le rendu logiciel)
        await A.click('[data-act="endFight"]'); await B.click('[data-act="endFight"]')
        await A.wait_for_timeout(3000)
        await A.evaluate('window.__mk.fight.B.over = true')
        for i in range(60):
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
        print('hero rest A/B:', va.get('heroes'), vb.get('heroes'))
        # Léa ferme le jeu : Alice doit la voir hors ligne
        await cb.close(); await A.wait_for_timeout(4000)
        print('presence after B closed:', list(tree().get('presence', {}).keys()))
        await A.click('.nav [data-s="village"]'); await A.wait_for_timeout(500)
        await A.screenshot(path=S + 't_village_sheet.png')
        # Rechargement : Alice reste connectée et retrouve son village
        await A.reload(); await A.wait_for_timeout(4000)
        print('A after reload top:', (await text(A, '#hudTop'))[:120], '| modal:', (await text(A, '#mcard'))[:60])
        await b.close()
    print('\n'.join(logs[:40]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
