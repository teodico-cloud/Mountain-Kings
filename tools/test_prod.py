import asyncio, subprocess, sys, time
from playwright.async_api import async_playwright
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8792', '-d', R + 'docs'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': 844, 'height': 390})).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        for path in ('', 'v1/'):        # le jeu actuel à l'adresse principale, l'ancien jeu dans v1/
            errs.clear()
            await pg.goto('http://127.0.0.1:8792/' + path); await pg.wait_for_timeout(4000)
            print('/' + path, 'modal:', (await pg.inner_text('#mcard')).replace('\n', ' | '))
            print('/' + path, 'errors:', errs or 'none')
        await pg.goto('http://127.0.0.1:8792/v2/?join=abc'); await pg.wait_for_timeout(2500)
        print('/v2/?join=abc ->', pg.url)
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
