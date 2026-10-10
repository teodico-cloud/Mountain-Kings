"""Fabrique les vignettes des troupes et des héros (docs/thumbs/*.png) à partir des modèles 3D du jeu.
Usage : python3 tools/build.py && python3 tools/make_thumbs.py"""
import asyncio, base64, io, os, subprocess, sys, time
from PIL import Image
from playwright.async_api import async_playwright

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
OUT = R + 'docs/thumbs/'
PORT = 8797

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', R + 'docs'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
            pg = await b.new_page(viewport={'width': 600, 'height': 400})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://127.0.0.1:{PORT}/index.html?thumbs=1')
            await pg.wait_for_function('window.__thumbs', timeout=120000)
            thumbs = await pg.evaluate('window.__thumbs')
            await b.close()
            if errs: print('erreurs :', errs[:5])
    finally:
        srv.terminate()
    os.makedirs(OUT, exist_ok=True)
    for k, url in thumbs.items():
        im = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGBA')
        im = im.resize((160, 160), Image.LANCZOS)
        im.save(OUT + k + '.png', optimize=True)
        print(k, os.path.getsize(OUT + k + '.png') // 1024, 'ko')

asyncio.run(main())
