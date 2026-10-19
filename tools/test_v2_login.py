"""Essai de la connexion Google (faux Firebase) : avec le script Google (bouton officiel simulé), la connexion passe par le jeton ;
sans lui, l'ancien bouton ouvre la fenêtre Google ; une fenêtre bloquée donne un message clair (plus de redirection).
Usage : python3 tools/build2.py --test && python3 -u tools/test_v2_login.py   (≈ 1 min)"""
import asyncio, os, subprocess, sys, time
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
PORT = 8811
URL = f'http://127.0.0.1:{PORT}/'
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + '.test', str(PORT)])
time.sleep(1)
fails = []
def check(c, m):
    print(('ok : ' if c else 'ÉCHEC : ') + m)
    if not c: fails.append(m)

FAKE_GSI = """window.google = { accounts: { id: {
  initialize(o) { window.__gsiOpts = o; },
  renderButton(el, opt) { window.__gsiBtn = opt; el.innerHTML = '<button id="fakeGsi" type="button">Google</button>'; el.firstChild.onclick = () => window.__gsiOpts.callback({ credential: 'alice' }); },
} } };"""

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        # 1. avec le bouton officiel
        ctx = await b.new_context(viewport={'width': 844, 'height': 390}); await ctx.add_init_script(FAKE_GSI)
        A = await ctx.new_page(); A.set_default_timeout(120000)
        errs = []; A.on('pageerror', lambda e: errs.append(str(e)))
        await A.goto(URL + '?pro=1', wait_until='domcontentloaded')
        await A.wait_for_selector('#fakeGsi')
        check(await A.locator('[data-act="login"]').count() == 0, 'bouton officiel : l’ancien bouton n’est plus là')
        check(await A.evaluate('window.__gsiOpts.client_id.endsWith(".apps.googleusercontent.com")'), 'identifiant du client Google transmis')
        await A.click('#fakeGsi')
        await A.wait_for_function("!document.getElementById('gsiSlot')", timeout=30000)
        check(True, 'connexion par jeton : la fenêtre de connexion disparaît')
        await A.wait_for_timeout(1500)
        check(await A.evaluate("sessionStorage.getItem('fakefb.user') === 'alice'"), 'connecté avec le compte du jeton')
        check(not errs, 'aucune erreur dans la page ' + str(errs[:2]))
        await ctx.close()
        # 2. sans script Google : l'ancien bouton, et une fenêtre bloquée = message clair
        ctx = await b.new_context(viewport={'width': 844, 'height': 390})
        B = await ctx.new_page(); B.set_default_timeout(120000)
        await B.goto(URL + '?pro=1', wait_until='domcontentloaded')
        await B.wait_for_selector('[data-act="login"]')
        check(await B.locator('#gsiSlot').count() == 0, 'sans script Google : l’ancien bouton est proposé')
        await B.evaluate("(() => { firebase.auth().signInWithPopup = () => Promise.reject({ code: 'auth/popup-blocked' }); })()")
        await B.click('[data-act="login"]'); await B.wait_for_timeout(1500)
        t = await B.inner_text('#mcard')
        check('bloqué la fenêtre Google' in t, 'fenêtre bloquée : message clair (« ' + t[-110:].replace('\n', ' ') + ' »)')
        await b.close()
try: asyncio.run(run())
finally: srv.terminate()
print('ÉCHECS :', len(fails)) if fails else print('Tout est bon.')
sys.exit(1 if fails else 0)
