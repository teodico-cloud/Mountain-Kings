"""Essai de l'interface à un joueur (faux Firebase) : tutoriel, remparts, héros, raid avec pouvoir, aide.
Usage : python3 tools/build.py --test && python3 tools/test_ui.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8793
URL = f'http://127.0.0.1:{PORT}/v1/'   # l'ancien jeu (build.py --test construit dans .test/v1/)
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()

async def text(pg, sel):
    try: return (await pg.inner_text(sel, timeout=2000)).replace('\n', ' | ')
    except Exception: return f'<none {sel}>'

async def main():
    logs = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=1)
        pg = await ctx.new_page()
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        await pg.goto(URL + '?u=carol'); await pg.wait_for_timeout(2000)
        await pg.click('[data-act="login"]'); await pg.wait_for_timeout(2500)
        await pg.fill('#fVname', 'Roc-Tonnerre'); await pg.fill('#fPname', 'Carol')
        await pg.click('#foundForm button[type=submit]')
        await pg.wait_for_timeout(12000)
        # Tutoriel
        for i in range(7):
            await pg.screenshot(path=S + f'u_tuto{i}.png')
            print('tuto', i, (await text(pg, '#tuto .tuto-card'))[:90])
            await pg.click('[data-act="tutoNext"]'); await pg.wait_for_timeout(500)
        print('tuto hidden after end:', await pg.is_hidden('#tuto'))
        # Village plus avancé : halle 3, salle des héros, ressources, armée
        t = tree(); v = t['villages']['uid_carol']
        arr = lambda x: [x[k] for k in sorted(x, key=int)] if isinstance(x, dict) else (x or [])
        v['b'] = arr(v['b'])
        for bb in v['b']:
            if bb['type'] == 'mairie': bb['lvl'] = 3
        nid = v['nid']
        v['b'] += [{'id': nid, 'type': 'heros', 'lvl': 3, 'gx': 3, 'gz': 3}, {'id': nid + 1, 'type': 'entrepot', 'lvl': 3, 'gx': 17, 'gz': 3}, {'id': nid + 2, 'type': 'entrepot', 'lvl': 2, 'gx': 17, 'gz': 18}]
        v['nid'] = nid + 3
        v['r'] = {'bois': 7000, 'pierre': 7000, 'vivres': 7000}
        v['army'] = {'fantassin': 30, 'archer': 10, 'belier': 1}
        v['b'] += [{'id': v['nid'] + i, 'type': 'camp', 'lvl': 3, 'gx': 3 + 4 * i, 'gz': 18} for i in range(2)]
        v['nid'] += 2
        v['t'] = int(time.time() * 1000); v['lastActive'] = v['t']; v['cid'] = 'test'
        put('villages/uid_carol', v)
        await pg.wait_for_timeout(2500)
        # Remparts : une ligne
        await pg.click('.nav [data-s="build"]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=S + 'u_build.png')
        await pg.click('[data-act="place"][data-type="rempart"]'); await pg.wait_for_timeout(600)
        print('wall card:', (await text(pg, '#hudBottom'))[:160])
        # touche deux cases alignées à l'écran (au sol)
        async def tap_tile(x, z):
            pt = await pg.evaluate(f'window.__mk.toScreen({x + 0.5}, {z + 0.5})')
            await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(450)
            print('  tap', (x, z), [round(v) for v in pt], 'walls', await pg.evaluate("window.__mk.me.b.filter(b => b.type === 'rempart').length"), 'toast:', await text(pg, '#toast'))
        await tap_tile(8, 7); await tap_tile(13, 7); await tap_tile(13, 2)
        t = tree(); bs = t['villages']['uid_carol']['b']; bs = list(bs.values()) if isinstance(bs, dict) else bs
        walls = [bb for bb in bs if bb['type'] == 'rempart']
        print('walls after taps (saved):', len(walls))
        await pg.screenshot(path=S + 'u_walls_place.png')
        await pg.click('[data-act="placeCancel"]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=S + 'u_walls.png')
        await tap_tile(13, 3); await pg.wait_for_timeout(500)
        print('wall panel:', (await text(pg, '#hudBottom'))[:220])
        await pg.click('[data-act="upwalls"]'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=S + 'u_walls_up.png')
        t = tree(); bs = t['villages']['uid_carol']['b']; bs = list(bs.values()) if isinstance(bs, dict) else bs
        print('walls lvl2 after upwalls:', len([bb for bb in bs if bb['type'] == 'rempart' and bb['lvl'] == 2]))
        await pg.click('[data-act="desel"]'); await pg.wait_for_timeout(300)
        # Héros
        await pg.click('.nav [data-s="army"]'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=S + 'u_army.png')
        for k in ['berserker', 'roi', 'chasseresse']:
            await pg.click(f'[data-act="heroBuy"][data-k="{k}"]'); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1500)
        el = await pg.query_selector('#heroSec')
        if el: await el.scroll_into_view_if_needed()
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=S + 'u_heroes.png')
        t = tree(); print('heroes saved:', t['villages']['uid_carol'].get('heroes'))
        await pg.click('[data-act="closeSheet"]'); await pg.wait_for_timeout(400)
        # Raid solo avec héros
        await pg.click('[data-act="attack"]'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path=S + 'u_scout.png')
        print('scout:', (await text(pg, '#hudTop'))[:160])
        await pg.click('[data-act="scoutGo"]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=S + 'u_fight0.png')
        js = '''() => { const out = []; for (let i = 0; i <= 96; i++) { const t = i / 96 * 24;
          for (const [x, z] of [[0.7, t], [t, 23.3], [t, 0.7], [23.3, t]]) { if (!window.__mk.canDeploy(x, z)) continue; const p = window.__mk.toScreen(x, z); if (p[1] > 90 && p[1] < 255 && p[0] > 30 && p[0] < 814) out.push([x, z, p[0], p[1]]); } } return out; }'''
        spots = await pg.evaluate(js)
        print('deploy spots:', len(spots))
        for sp in spots[:3]:
            await pg.mouse.click(sp[2], sp[3]); await pg.wait_for_timeout(250)
        await pg.click('[data-act="troop"][data-u="h:berserker"]'); await pg.wait_for_timeout(200)
        await pg.mouse.click(spots[1][2], spots[1][3]); await pg.wait_for_timeout(300)
        print('fight bar:', (await text(pg, '#hudBottom'))[:200])
        await pg.wait_for_timeout(6000)
        await pg.click('[data-act="power"]'); await pg.wait_for_timeout(700)
        await pg.screenshot(path=S + 'u_fight_power.png')
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path=S + 'u_fight_mid.png')
        print('fight HUD:', (await text(pg, '#hudTop'))[:120])
        await pg.click('[data-act="endFight"]')
        for i in range(60):
            await pg.wait_for_timeout(1000)
            if await pg.is_visible('[data-act="resultOk"]'): break
        await pg.wait_for_timeout(1800)
        await pg.screenshot(path=S + 'u_result.png')
        print('result:', (await text(pg, '#mcard'))[:260])
        await pg.click('[data-act="resultOk"]'); await pg.wait_for_timeout(2000)
        t = tree(); print('hero rest after raid:', t['villages']['uid_carol'].get('heroes', {}).get('berserker'))
        # Aide et réglages
        await pg.click('[data-act="help"]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=S + 'u_help.png')
        await pg.click('[data-act="closeSheet"]'); await pg.wait_for_timeout(300)
        await pg.click('.nav [data-s="village"]'); await pg.wait_for_timeout(600)
        await pg.screenshot(path=S + 'u_village.png')
        await pg.click('[data-act="snd"][data-k="music"]'); await pg.wait_for_timeout(300)
        print('music toggled:', await text(pg, '[data-act="snd"][data-k="music"]'))
        # Rechargement : pas de tutoriel ni de nouveautés une 2e fois
        await pg.reload(); await pg.wait_for_timeout(5000)
        print('after reload modal:', (await text(pg, '#mcard'))[:60] if await pg.is_visible('#modal') else 'none', '| tuto visible:', await pg.is_visible('#tuto'))
        # Portrait : rotation forcée et tutoriel
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(800)
        await pg.click('[data-act="help"]') if await pg.is_visible('[data-act="help"]') else None
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=S + 'u_portrait_help.png')
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally: srv.terminate()
