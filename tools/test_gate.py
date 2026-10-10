import asyncio, subprocess, sys, time
from playwright.async_api import async_playwright
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
S = os.environ.get('MK_SHOTS', '/tmp/mk_shots') + '/'
os.makedirs(S, exist_ok=True)
srv = subprocess.Popen([sys.executable, R + 'tools/fakeserver.py', R + 'docs', '8791']); time.sleep(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
        pg = await (await b.new_context(viewport={'width': 844, 'height': 390})).new_page()
        await pg.goto('http://127.0.0.1:8791/?u=alice'); await pg.wait_for_timeout(2000)
        await pg.click('[data-act="login"]')
        for t in (1, 3, 6):
            await pg.wait_for_timeout(1000 if t == 1 else 2000 if t == 3 else 3000)
            h = await pg.evaluate("document.getElementById('mcard').innerHTML.includes('importOld')")
            print(t, 's import in DOM:', h)
        await pg.screenshot(path=S + 't_gate2.png')
        await b.close()
try: asyncio.run(main())
finally: srv.terminate()
