"""Prépare un modèle Meshy pour le jeu : textures réduites, maillage allégé, GLB léger.
Usage : python3 tools/meshy_import.py entree.glb sortie.glb [--tris 9000] [--tex 1024]
Il faut l'outil gltfpack (meshoptimizer) : variable GLTFPACK ou dans le PATH."""
import io, json, os, shutil, struct, subprocess, sys, tempfile
from PIL import Image

def read_glb(p):
    with open(p, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, 'pas un fichier GLB'
        js, binc = None, b''
        while f.tell() < length:
            clen, ctype = struct.unpack('<II', f.read(8))
            data = f.read(clen)
            if ctype == 0x4E4F534A: js = json.loads(data)
            elif ctype == 0x004E4942: binc = data
    return js, binc

def write_glb(p, js, binc):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    binc += b'\0' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(j) + (8 + len(binc) if binc else 0)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        if binc: f.write(struct.pack('<II', len(binc), 0x004E4942)); f.write(binc)

def texture_roles(js):
    """Rôle de chaque image : couleur, relief (normal map) ou métal/rugosité."""
    roles = {}
    tex = js.get('textures', [])
    for m in js.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        for key, role in ((pbr.get('baseColorTexture'), 'color'), (m.get('normalTexture'), 'normal'), (pbr.get('metallicRoughnessTexture'), 'mr'), (m.get('emissiveTexture'), 'color'), (m.get('occlusionTexture'), 'mr')):
            if key and key.get('index') is not None and key['index'] < len(tex) and 'source' in tex[key['index']]:
                roles.setdefault(tex[key['index']]['source'], role)
    return roles

def shrink_textures(js, binc, size):
    """Réduit les images intégrées (couleur : size, relief : size/2, métal/rugosité : 256) et les réencode en JPEG (PNG si transparence)."""
    views = js['bufferViews']
    out = bytearray(); newviews = []
    roles = texture_roles(js)
    img_views = {im['bufferView']: i for i, im in enumerate(js.get('images', [])) if 'bufferView' in im}
    for vi, bv in enumerate(views):
        data = binc[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
        if vi in img_views:
            ii = img_views[vi]; im = js['images'][ii]
            lim = {'normal': max(256, size // 2), 'mr': 256}.get(roles.get(ii), size)
            pic = Image.open(io.BytesIO(data))
            alpha = pic.mode in ('RGBA', 'LA') and pic.getextrema()[-1][0] < 255
            pic = pic.convert('RGBA' if alpha else 'RGB')
            if max(pic.size) > lim: pic = pic.resize((lim, lim) if pic.size[0] == pic.size[1] else (lim, int(lim * pic.size[1] / pic.size[0])), Image.LANCZOS)
            buf = io.BytesIO()
            if alpha: pic.save(buf, 'PNG', optimize=True); im['mimeType'] = 'image/png'
            else: pic.save(buf, 'JPEG', quality=86, optimize=True); im['mimeType'] = 'image/jpeg'
            data = buf.getvalue()
        while len(out) % 4: out.append(0)
        nb = dict(bv); nb['byteOffset'] = len(out); nb['byteLength'] = len(data)
        out += data; newviews.append(nb)
    js['bufferViews'] = newviews
    js['buffers'] = [{'byteLength': len(out)}]
    return js, bytes(out)

def tri_count(js):
    acc = js['accessors']; n = 0
    for m in js.get('meshes', []):
        for pr in m['primitives']:
            n += (acc[pr['indices']]['count'] if 'indices' in pr else acc[pr['attributes']['POSITION']]['count']) // 3
    return n

def main():
    a = sys.argv[1:]
    src, dst = a[0], a[1]
    tris = int(a[a.index('--tris') + 1]) if '--tris' in a else 9000
    tex = int(a[a.index('--tex') + 1]) if '--tex' in a else 1024
    gp = os.environ.get('GLTFPACK') or shutil.which('gltfpack')
    js, binc = read_glb(src)
    n0 = tri_count(js)
    js, binc = shrink_textures(js, binc, tex)
    with tempfile.TemporaryDirectory() as td:
        mid = os.path.join(td, 'mid.glb'); write_glb(mid, js, binc)
        ratio = min(1.0, tris / max(1, n0))
        cmd = [gp, '-i', mid, '-o', dst, '-noq', '-kn', '-km', '-si', '%.6f' % ratio]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode: print(r.stdout, r.stderr); sys.exit(1)
    js2, _ = read_glb(dst)
    print('%s : %d -> %d triangles, %d Ko -> %d Ko, %d animation(s), squelette : %s' % (
        os.path.basename(dst), n0, tri_count(js2), os.path.getsize(src) // 1024, os.path.getsize(dst) // 1024,
        len(js2.get('animations', [])), 'oui' if js2.get('skins') else 'non'))

if __name__ == '__main__':
    main()
