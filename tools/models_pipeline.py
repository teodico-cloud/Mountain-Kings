import json, struct, base64, os, colorsys
from PIL import Image
S = '/tmp/claude-0/-home-claude/be95f51b-a61c-5ea0-96a1-2fc7b921ca15/scratchpad/'
HB = S + 'assets/KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf/'
CH = S + 'assets/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/'
OUT = S + 'v3/models/'

def load(path):
    if path.endswith('.glb'):
        b = open(path, 'rb').read()
        l = struct.unpack('<I', b[12:16])[0]
        j = json.loads(b[20:20 + l])
        bl = struct.unpack('<I', b[20 + l:24 + l])[0]
        return j, b[28 + l:28 + l + bl]
    j = json.load(open(path))
    return j, open(os.path.join(os.path.dirname(path), j['buffers'][0]['uri']), 'rb').read()

def repack(j, binb):
    used = set()
    for m in j.get('meshes', []):
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p: used.add(p['indices'])
            for t in p.get('targets', []): used.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: used.add(s['inverseBindMatrices'])
    for a in j.get('animations', []):
        for s in a['samplers']: used.add(s['input']); used.add(s['output'])
    order = sorted(used); amap = {o: n for n, o in enumerate(order)}
    accs = [dict(j['accessors'][o]) for o in order]
    bvs_used = sorted({a['bufferView'] for a in accs if 'bufferView' in a} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im})
    bmap = {}; out = bytearray(); nbv = []
    for o in bvs_used:
        bv = dict(j['bufferViews'][o]); off = bv.get('byteOffset', 0); data = binb[off:off + bv['byteLength']]
        while len(out) % 4: out.append(0)
        bv['byteOffset'] = len(out); bv['buffer'] = 0; out += data
        bmap[o] = len(nbv); nbv.append(bv)
    for a in accs:
        if 'bufferView' in a: a['bufferView'] = bmap[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im: im['bufferView'] = bmap[im['bufferView']]
    for m in j.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = amap[p['indices']]
            if 'targets' in p: p['targets'] = [{k: amap[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = amap[s['inverseBindMatrices']]
    for a in j.get('animations', []):
        for s in a['samplers']: s['input'] = amap[s['input']]; s['output'] = amap[s['output']]
    j['accessors'] = accs; j['bufferViews'] = nbv
    j['buffers'] = [{'byteLength': len(out), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(out)).decode()}]
    return j

def write(name, j):
    s = json.dumps(j, separators=(',', ':'))
    open(OUT + name + '.json', 'w').write(s)
    return len(s)

total = 0
# --- bâtiments (variante bleue : couleur de clan recalculée à l'exécution) ---
blds = {'castle': 'buildings/blue/building_castle_blue', 'lumbermill': 'buildings/blue/building_lumbermill_blue', 'mine': 'buildings/blue/building_mine_blue',
        'windmill': 'buildings/blue/building_windmill_blue', 'market': 'buildings/blue/building_market_blue', 'barracks': 'buildings/blue/building_barracks_blue',
        'tavern': 'buildings/blue/building_tavern_blue', 'tower_A': 'buildings/blue/building_tower_A_blue', 'tower_B': 'buildings/blue/building_tower_B_blue',
        'tower_catapult': 'buildings/blue/building_tower_catapult_blue', 'destroyed': 'buildings/neutral/building_destroyed', 'scaffolding': 'buildings/neutral/building_scaffolding',
        'fence': 'buildings/neutral/fence_wood_straight', 'stone': 'buildings/neutral/projectile_catapult',
        'trees_A_large': 'decoration/nature/trees_A_large', 'trees_A_medium': 'decoration/nature/trees_A_medium', 'trees_B_large': 'decoration/nature/trees_B_large',
        'tree_A': 'decoration/nature/tree_single_A', 'tree_B': 'decoration/nature/tree_single_B', 'mountain_A': 'decoration/nature/mountain_A_grass_trees',
        'mountain_B': 'decoration/nature/mountain_B_grass_trees', 'mountain_C': 'decoration/nature/mountain_C_grass', 'hills_A': 'decoration/nature/hills_A_trees',
        'hills_C': 'decoration/nature/hills_C_trees', 'rock_A': 'decoration/nature/rock_single_A', 'rock_C': 'decoration/nature/rock_single_C', 'rock_E': 'decoration/nature/rock_single_E'}
missing = []
for k, p in blds.items():
    path = HB + p + '.gltf'
    if not os.path.exists(path): missing.append(p); continue
    j, b = load(path)
    for im in j.get('images', []): im['uri'] = 'atlas.png'
    total += write(k, repack(j, b))
Image.open(HB + 'buildings/blue/hexagons_medieval.png').save(OUT + 'atlas.png', optimize=True)

# --- personnages : animations utiles seulement ---
KEEP = ['Idle', 'Walking_A', 'Running_A', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Chop', '2H_Ranged_Shoot', 'Death_A', 'Cheer']
for k, f in [('barbarian', 'Barbarian.glb'), ('rogue', 'Rogue_Hooded.glb')]:
    j, b = load(CH + f)
    j['animations'] = [a for a in j['animations'] if a['name'] in KEEP]
    total += write(k, repack(j, b))

# --- textures orques / trolls : cases de peau recolorées ---
def recolor(src, dst, hue, sat, val):
    im = Image.open(src).convert('RGBA'); px = im.load(); W, H = im.size; cw, chh = W // 8, H // 4
    cells = []
    for cx in range(8):
        for cy in range(4):
            r = g = bl = n = 0
            for x in range(cx * cw + 8, cx * cw + cw - 8, 8):
                for y in range(cy * chh + 8, cy * chh + chh - 8, 8):
                    p = px[x, y]; r += p[0]; g += p[1]; bl += p[2]; n += 1
            r, g, bl = r / n, g / n, bl / n
            if r > 200 and 150 < g < 222 and 110 < bl < 195 and 20 < r - g < 85: cells.append((cx, cy))
    for cx, cy in cells:
        for x in range(cx * cw, cx * cw + cw):
            for y in range(cy * chh, cy * chh + chh):
                p = px[x, y]; h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
                nr, ng, nb = colorsys.hsv_to_rgb(hue, sat, min(1, v * val))
                px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), p[3])
    im.save(dst, optimize=True)
    return cells
print('orc skin cells', recolor(CH + 'barbarian_texture.png', OUT + 'orc_barbarian.png', 0.24, 0.55, 0.78))
print('orc rogue cells', recolor(CH + 'rogue_texture.png', OUT + 'orc_rogue.png', 0.24, 0.55, 0.78))
print('troll cells', recolor(CH + 'barbarian_texture.png', OUT + 'troll.png', 0.27, 0.28, 0.72))
print('missing', missing)
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(OUT + f) // 1024, 'k')
print('total json', total // 1024, 'k')
