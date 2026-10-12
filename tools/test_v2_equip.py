"""Essai de l'équipement dans le navigateur (faux Firebase) : objets rapportés d'un donjon, fiche du héros (emplacements),
sac (comparaison, équiper), forge (fabriquer, améliorer, sertir), marchand ambulant (acheter), bilan de donjon avec objets.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_equip.py   (captures dans $MK_SHOTS, /tmp/mk_shots par défaut)
Lent avec le rendu logiciel (≈ 8-10 min) : en arrière-plan avec un fichier de log, sans autre Chromium en même temps."""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8794
URL = f'http://127.0.0.1:{PORT}/v2/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()
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

async def nav(pg, s):
    if await pg.is_visible('#sheet') and await pg.is_visible('[data-act="closeSheet"]'):
        await pg.click('[data-act="closeSheet"]'); await pg.wait_for_timeout(800)
    await pg.click(f'.nav [data-s="{s}"]'); await pg.wait_for_timeout(1500)

BAG = '(() => { const b = window.__mk.me.bag && window.__mk.me.bag[window.__mk.me.members ? Object.keys(window.__mk.me.members)[0] : ""]; return b ? Object.keys(b.it).length : 0; })()'

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
        await A.fill('#fVname', 'Val-Brume'); await A.fill('#fPname', 'Téo')
        await A.click('#foundForm button[type=submit]'); await A.wait_for_timeout(4000)
        await A.fill('#hName', 'Brokk')
        await A.click('label.optc:has(input[value="nain"])'); await A.click('label.optc:has(input[value="guerrier"])')
        await A.click('#heroForm button[type=submit]'); await A.wait_for_timeout(5000)
        await close_modal(A)
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        hid = await A.evaluate('Object.keys(window.__mk.me.heroes)[0]')
        me = await A.evaluate('Object.keys(window.__mk.me.members)[0]')
        # un retour de donjon avec des objets (épée commune, hache rare, casque, bottes, bijou), des pierres et de l'or
        items = [{'sl': 'arme', 'k': 'epee', 'r': 0, 'il': 1, 'sd': 11}, {'sl': 'arme', 'k': 'hache', 'r': 2, 'il': 1, 'sd': 22}, {'sl': 'casque', 'k': 'heaume', 'r': 1, 'il': 1, 'sd': 33},
                 {'sl': 'bottes', 'k': 'bottes', 'r': 3, 'il': 1, 'sd': 44}, {'sl': 'bijou', 'k': 'anneau', 'r': 2, 'il': 1, 'sd': 55}, {'sl': 'arme', 'k': 'arc', 'r': 4, 'il': 1, 'sd': 66, 'pw': 'chaine'}]
        r = await A.evaluate(f"window.__mk.act({{ type: 'djEnd', hid: '{hid}', lvl: 2, win: true, xp: 0, or: 400, items: {json.dumps(items)}, gems: {{ topaze1: 2, rubis1: 3 }} }}, {{ quiet: true }})")
        print('dungeon return:', {k: r.get(k) for k in ('ok', 'items', 'got')} if r else r)
        await until(A, 'window.__mk.busy === 0', 60); await A.wait_for_timeout(1500)
        # la fiche du héros : son équipement
        await close_modal(A)
        await nav(A, 'hero')
        body = await A.inner_text('#sheetBody')
        i0 = body.find('ÉQUIPEMENT')
        print('hero sheet:', txt(body[i0:i0 + 330]))
        await A.screenshot(path=S + 'eq_hero.png')
        await A.click('[data-act="gearSlot"][data-sl="arme"]'); await A.wait_for_timeout(1500)
        print('bag (weapons):', txt((await A.inner_text('#sheetBody'))[:420]))
        print('arrows:', await A.evaluate('[...document.querySelectorAll(".irow")].map(b => b.querySelector(".iname").textContent + " " + ((b.querySelector(".arr") || {}).textContent || "–"))'))
        await A.screenshot(path=S + 'eq_bag.png')
        # équiper la hache rare
        await A.click('.irow:has(.iname:has-text("Hache"))'); await A.wait_for_timeout(1500)
        print('detail open:', await A.evaluate('document.querySelectorAll(".idet").length'), '| errors so far:', logs[:3])
        await A.click('[data-act="equip"]', timeout=30000); await A.wait_for_timeout(1500)
        await until(A, 'window.__mk.busy === 0', 60)
        print('equipped:', await A.evaluate(f"(() => {{ const e = window.__mk.me.heroes['{hid}'].eq; return Object.keys(e).map(k => k + ':' + e[k].k + '/r' + e[k].r); }})()"))
        # forge (niveau 2), du fer et du bois : posés directement sur le serveur pour l'essai
        v = tree()['v2']['villages'][vid]
        bl = v['b'] if isinstance(v['b'], list) else [v['b'][k] for k in sorted(v['b'], key=int)]
        for x in bl:
            if x['type'] == 'halle': x['lvl'] = 2
        bl.append({'id': 900, 'type': 'forge', 'lvl': 2, 'gx': 2, 'gz': 2})
        put(f'v2/villages/{vid}/b', bl); put(f'v2/villages/{vid}/r/fer', 900); put(f'v2/villages/{vid}/r/bois', 900)
        await until(A, "window.__mk.me.b.some(b => b.type === 'forge')", 30); await A.wait_for_timeout(1500)
        await nav(A, 'hero')
        await A.click('[data-act="sheet"][data-s="forge"]'); await A.wait_for_timeout(1500)
        print('forge:', txt((await A.inner_text('#sheetBody'))[:360]))
        n0 = await A.evaluate(f"Object.keys(window.__mk.me.bag['{me}'].it).length")
        await A.click('[data-act="craft"][data-sl="casque"]'); await A.wait_for_timeout(2000); await until(A, 'window.__mk.busy === 0', 60)
        n1 = await A.evaluate(f"Object.keys(window.__mk.me.bag['{me}'].it).length")
        print('crafted:', n0, '->', n1, '| toast:', await A.inner_text('#toast'))
        await A.click('[data-act="improve"][data-sl="arme"]'); await A.wait_for_timeout(1500); await until(A, 'window.__mk.busy === 0', 60)
        print('improved weapon:', await A.evaluate(f"window.__mk.me.heroes['{hid}'].eq.arme.up"))
        await A.screenshot(path=S + 'eq_forge.png')
        # sertir une topaze dans la hache (depuis le sac, objet porté)
        await A.click('[data-act="sheet"][data-s="bag"]'); await A.wait_for_timeout(1200)
        await A.click('[data-act="bagFilter"][data-sl="arme"]'); await A.wait_for_timeout(800)
        await A.click('.irow[data-id="eq:arme"]'); await A.wait_for_timeout(1000)
        await A.click('[data-act="socket"][data-g="topaze1"]'); await A.wait_for_timeout(1500); await until(A, 'window.__mk.busy === 0', 60)
        print('socketed:', await A.evaluate(f"JSON.stringify(window.__mk.me.heroes['{hid}'].eq.arme.gm)"), '| gems left:', await A.evaluate(f"JSON.stringify(window.__mk.me.bag['{me}'].gm)"))
        await A.screenshot(path=S + 'eq_socket.png')
        # vendre l'épée commune
        await A.click('.irow:has(.iname:has-text("Épée"))'); await A.wait_for_timeout(800)
        or0 = await A.evaluate('window.__mk.me.r.or')
        await A.click('[data-act="sell"]'); await A.wait_for_timeout(1500); await until(A, 'window.__mk.busy === 0', 60)
        print('sold the sword: gold', or0, '->', await A.evaluate('window.__mk.me.r.or'))
        # le marchand ambulant : on recule la naissance du village pour être un « 2e jour »
        put(f'v2/villages/{vid}/born', int(time.time() * 1000) - int(1.5 * 86400000))
        ok = await until(A, 'document.querySelector("[data-act=sheet][data-s=merch]") !== null', 150)
        print('merchant chip:', ok)
        if await A.is_visible('#sheet') and await A.is_visible('[data-act="closeSheet"]'): await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await A.click('[data-act="sheet"][data-s="merch"]'); await A.wait_for_timeout(1500)
        print('merchant:', txt((await A.inner_text('#sheetBody'))[:420]))
        await A.screenshot(path=S + 'eq_merch.png')
        n2 = await A.evaluate(f"Object.keys(window.__mk.me.bag['{me}'].it).length")
        buy = await A.query_selector('[data-act="buy"]:not(.off)')
        if buy: await buy.click(); await A.wait_for_timeout(1500); await until(A, 'window.__mk.busy === 0', 60)
        print('bought:', n2, '->', await A.evaluate(f"Object.keys(window.__mk.me.bag['{me}'].it).length"), '| toast:', await A.inner_text('#toast'))
        # bilan de donjon avec des objets : entrer, donner des objets au héros (le temps de l'essai), fuir
        if await A.is_visible('#sheet') and await A.is_visible('[data-act="closeSheet"]'): await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await A.evaluate("window.__mk.djBegin(1, 'mine')")
        await until(A, '!!window.__mk.dj', 60); await A.wait_for_timeout(3000)
        await A.evaluate(f"(() => {{ const s = window.__mk.dj.st; s.items['{hid}'] = [{{ sl: 'casque', k: 'casque', r: 3, il: 1, sd: 77 }}, {{ sl: 'bottes', k: 'bottes', r: 0, il: 1, sd: 78 }}]; s.gems['{hid}'] = {{ saphir1: 1 }}; s.gold = 90; }})()")
        A.once('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await A.click('[data-act="djFlee"]')
        await until(A, '!document.getElementById("modal").hidden && !!document.querySelector("#mcard [data-act=djBack]")', 60)
        print('results:', txt(await A.inner_text('#mcard'))[:420])
        await A.screenshot(path=S + 'eq_results.png')
        await A.click('[data-act="djBack"]'); await until(A, 'window.__mk.busy === 0 && !window.__mk.dj', 60); await A.wait_for_timeout(2500)
        v = tree()['v2']['villages'][vid]
        bag = v['bag'][me]
        print('server: bag', len(bag['it']), 'items | gems', bag.get('gm'), '| gold', v['r'].get('or'), '| fer', v['r'].get('fer'), '| hero eq', {k: (x['k'], x['r'], x.get('up'), x.get('gm')) for k, x in v['heroes'][hid].get('eq', {}).items()})
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')

try: asyncio.run(main())
finally:
    srv.terminate()
    print('\n'.join(logs[:30]) or 'no page errors (end)')
