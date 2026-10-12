"""Essai de l'histoire (lot A) dans le navigateur (faux Firebase) : l'accueil de Sukhoï, la mission « La Source du Mal »
(bulles du donjon guidé, berceau, bilan), l'arrivée de Lilou, sa chambre (caprice fabriqué, berceuse), la puce du caprice.
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_histoire.py   (≈ 6-8 min ; captures dans $MK_SHOTS, /tmp/mk_shots par défaut)"""
import asyncio, json, os, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
PORT = 8800
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
def tree(): return json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/fb/tree'))
def put(path, v):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/fb/op?cid=test', data=json.dumps({'path': path, 'v': v}).encode(), headers={'content-type': 'application/json'})
    urllib.request.urlopen(req).read()
fails = []
def check(c, m):
    print(('ok : ' if c else 'ÉCHEC : ') + m)
    if not c: fails.append(m)

async def until(pg, js, secs=120, step=1000):
    for i in range(int(secs * 1000 / step)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(step)
    return False

def village(vid):
    v = tree()['v2']['villages'][vid]
    if isinstance(v['b'], dict): v['b'] = [v['b'][k] for k in sorted(v['b'], key=int)]
    return v

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
        # l'accueil : Sukhoï parle de la lueur de la mine
        mc = await A.inner_text('#mcard')
        check('Sukhoï' in mc and 'Source du Mal' in mc and await A.is_visible('[data-act="sukGo"]'), 'accueil : Sukhoï propose d’aller voir la Source du Mal')
        await A.screenshot(path=S + 'hist_welcome.png')
        await until(A, '!!(window.__mk.me && Object.keys(window.__mk.me.heroes).length) && window.__mk.busy === 0')
        vid = await A.evaluate('window.__mk.vid')
        # le menu Donjon montre la mission en premier
        await A.click('[data-act="closeModal"]'); await A.wait_for_timeout(800)
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('La Source du Mal' in body and await A.is_visible('[data-act="djGo"][data-th="source"]'), 'menu Donjon : la mission en tête')
        await A.click('[data-act="djGo"][data-th="source"]'); await A.wait_for_timeout(6000)
        st = await A.evaluate('(() => { const d = window.__mk.dj; return d ? { th: d.st.d.theme, rooms: d.st.d.rooms.length, tuto: !!d.st.tuto } : null; })()')
        check(st and st['th'] == 'source' and st['rooms'] == 5 and st['tuto'], 'mission lancée : le petit donjon guidé (' + json.dumps(st) + ')')
        ok_bub = await until(A, "(() => { const e = document.getElementById('djTuto'); return e && !e.hidden && /pouce/.test(e.textContent); })()", 30, 500)
        check(ok_bub, 'la bulle de Sukhoï : « Pose le pouce… »')
        await A.screenshot(path=S + 'hist_dj_move.png')
        # marcher (clavier) : l'étape « move » est validée, Sukhoï félicite
        await A.keyboard.down('ArrowRight'); await A.wait_for_timeout(5000); await A.keyboard.up('ArrowRight')
        moved = await until(A, '!!window.__mk.dj.st.tuto.done.move', 20, 500)
        check(moved, 'en marchant, l’étape est validée')
        # jusqu'au berceau (le temps de l'essai) : toutes les salles nettoyées, le héros posé devant
        await A.evaluate("""(() => { const s = window.__mk.dj.st, h = s.heroes[0], c = s.d.cradle;
          s.rooms.forEach(R => R.st = 'clear'); s.mobs.forEach(m => { m.hp = 0; }); s.exit = { x: c[0] + 0.5, y: c[1] + 0.5 };
          h.x = h.px = c[0] - 1.5; h.y = h.py = c[1] + 0.5; })()""")
        await A.wait_for_timeout(2500)
        await A.screenshot(path=S + 'hist_cradle.png')
        await A.evaluate("(() => { const s = window.__mk.dj.st, h = s.heroes[0]; h.x = h.px = s.exit.x; h.y = h.py = s.exit.y; })()")
        won = await until(A, "!!document.querySelector('[data-act=\"djBack\"]')", 40)
        mc = await A.inner_text('#mcard') if won else ''
        check(won and 'Source du Mal' in mc and 'bébé' in mc and 'Ramener Lilou' in mc, 'au berceau : « c’est un bébé ?! » et le bouton « Ramener Lilou au village »')
        await A.screenshot(path=S + 'hist_found.png')
        await A.click('[data-act="djBack"]'); await A.wait_for_timeout(3000)
        arrived = await until(A, "!!(window.__mk.me && window.__mk.me.lilou) && /Lilou arrive/.test(document.getElementById('mcard').textContent)", 40)
        check(arrived, 'retour : la fenêtre « Lilou arrive au village »')
        await A.screenshot(path=S + 'hist_arrive.png')
        await until(A, 'window.__mk.busy === 0', 30)
        v = village(vid)
        check(v.get('lilou') and any(bb['type'] == 'chambre' for bb in v['b']) and v['lilou']['d']['k'], 'sur le serveur : Lilou (caprice du jour : ' + str(v.get('lilou', {}).get('d', {}).get('k')) + ') et sa chambre')
        # sa chambre : humeur, caprices, et le caprice du jour fabriqué
        await A.click('[data-act="lilouSee"]'); await A.wait_for_timeout(1500)
        body = await A.inner_text('#sheetBody')
        check('Lilou est contente' in body and 'Caprice du jour' in body and 'Gros caprice de la semaine' in body and 'Sukhoï' in body, 'la chambre : humeur, caprice du jour, gros caprice, Sukhoï')
        await A.screenshot(path=S + 'hist_room.png')
        chip = await A.evaluate("!!document.querySelector('#hudTop [data-s=\"lilou\"]')")
        check(chip, 'en haut : la puce « Caprice de Lilou »')
        # le gros caprice coûte trop cher au début : le jeu dit ce qui manque
        await A.click('[data-act="lilouCap"][data-w="1"]'); await A.wait_for_timeout(800)
        t = await A.inner_text('#toast')
        check('Il manque' in t or 'Réserves trop petites' in t, 'gros caprice trop cher : « ' + t.strip() + ' »')
        v = village(vid); v['r'].update({'bois': 900, 'pierre': 900, 'ble': 300, 'pain': 300, 'viande': 200, 'or': 300}); put('v2/villages/' + vid, v)
        await A.wait_for_timeout(3000)
        await A.click('[data-act="lilouCap"][data-w="0"]'); await A.wait_for_timeout(2000)
        await until(A, 'window.__mk.busy === 0', 30)
        v = village(vid)
        check(v['lilou']['d'].get('ok') == 1 and v['lilou']['mood'] == 72, 'caprice fabriqué : Lilou plus contente (' + str(v['lilou']['mood']) + ')')
        chip = await A.evaluate("!!document.querySelector('#hudTop [data-s=\"lilou\"]')")
        check(not chip, 'la puce du caprice disparaît')
        await A.click('[data-act="sukPet"]'); await A.wait_for_timeout(800)
        check('Sukhoï' in await A.inner_text('#toast'), 'gratouiller Sukhoï : une réplique')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        # dans le menu Donjon, la mission n'est plus là ; le donjon annonce l'humeur de Lilou
        await A.click('.nav [data-s="donjon"]'); await A.wait_for_timeout(1500)
        check(not await A.is_visible('[data-act="djGo"][data-th="source"]'), 'la mission ne se refait pas')
        await A.click('[data-act="closeSheet"]'); await A.wait_for_timeout(800)
        await A.screenshot(path=S + 'hist_village.png')
        await b.close()
    print('\n'.join(logs[:30]) or 'no page errors')
    check(not [l for l in logs if l.startswith('pageerror')], 'aucune erreur dans la page')

try: asyncio.run(main())
finally: srv.terminate()
print(('%d échec(s) : ' % len(fails) + ' ; '.join(fails)) if fails else 'Tout est bon.')
sys.exit(1 if fails else 0)
