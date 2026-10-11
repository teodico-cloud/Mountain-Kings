/* ===================== VUE 3D (three.js r128) ===================== */
const V3 = (() => {
  const half = GRID / 2;
  let renderer = null, scene, camera, hemi, sun, ok = false, canvas, aspect = 1;
  const YAW = Math.PI / 4, PITCH = 0.68;
  const cam = { tx: 0, tz: 0, view: 18 };
  const M = {}, G = {};
  let winMat, fireMat, barBg, selMat, ghostOk, ghostBad, zoneTex, zoneMesh, gridMesh, selMesh, ghostMesh, ringMat, ringFill, glowTex, emberMat;
  const bldGroup = new THREE.Group(), unitGroup = new THREE.Group(), fxGroup = new THREE.Group(), rangeGroup = new THREE.Group(), wallGroup = new THREE.Group();
  const decoProc = new THREE.Group(), decoModel = new THREE.Group();
  const blds = new Map();   // key -> {g, sig, item, info, bar, hp, glow}
  const units = new Map();  // id -> {g, lx, lz, model}
  const dying = [], shots = [], puffs = [], embers = [], chunks = [], waves = [], sparks = [];
  let shakeT = 0, shakeA = 0;
  let anims = [];
  let frameHook = null, tapHook = null, mood = '', groundMat = null, outerMat = null;
  const LIB = { ok: false, b: {}, ch: {}, tex: {}, ver: 0, xbow: null, gear: {}, clips: {}, m2: {} };
  /* Modèles générés avec Meshy pour le nouveau jeu (remplacent les modèles provisoires au fur et à mesure). */
  const M2_NAMES = ['taverne', 'halle', 'chantier'];   // modèles Meshy de docs/v2/models (chantier = bâtiment en construction)
  const C = { stone: 0x9a9488, stoneL: 0xb6b2a8, stoneD: 0x7d858b, wood: 0x9b7a54, woodD: 0x5f4127, woodL: 0xc49a63, timber: 0xdac9a6, roof: 0x8e3b2d, roofD: 0x5a3320, roofB: 0x5b4430, door: 0x3e2716, dirt: 0xa88a5c, field: 0x7a5a32, crop: 0x8fbf5a, gold: 0xd9b54c, red: 0x8c3b2d, cream: 0xede3d3, metal: 0xaeb4b8, rock: 0x8b9297, rockL: 0xcfd3d6, canvas: 0xe8dfc8, skin: 0xe6c29c };

  /* ---------- géométries et matériaux ---------- */
  function normGeo(g) {
    g.computeBoundingBox();
    const b = g.boundingBox, sx = (b.max.x - b.min.x) || 1, sy = (b.max.y - b.min.y) || 1, sz = (b.max.z - b.min.z) || 1;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    g.scale(1 / sx, 1 / sy, 1 / sz);
    return g;
  }
  function geo(k) {
    if (G[k]) return G[k];
    let g;
    switch (k) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cyl6': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); break;
      case 'cyl8': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); break;
      case 'cyl12': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); break;
      case 'cone4': g = new THREE.ConeGeometry(0.5, 1, 4, 1); g.rotateY(Math.PI / 4); break;
      case 'cone6': g = new THREE.ConeGeometry(0.5, 1, 6, 1); break;
      case 'cone7': g = new THREE.ConeGeometry(0.5, 1, 7, 1); break;
      case 'sph': g = new THREE.SphereGeometry(0.5, 8, 6); break;
      case 'ico': g = new THREE.IcosahedronGeometry(0.5, 0); break;
      case 'dode': g = new THREE.DodecahedronGeometry(0.5, 0); break;
      case 'prism': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); break;
      case 'plane': g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return (G[k] = g);
      case 'barfg': g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0); return (G[k] = g);
      case 'barbg': g = new THREE.PlaneGeometry(1, 1); return (G[k] = g);
    }
    if (g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    return (G[k] = normGeo(g));
  }
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  const mat = c => M[c] || (M[c] = new THREE.MeshLambertMaterial({ color: lin(c) }));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(c) }, o || {}));
  function P(k, c, sx, sy, sz, x, y, z, ry, noShadow) {
    const m = new THREE.Mesh(geo(k), (typeof c === 'object') ? c : mat(c));
    m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    m.castShadow = !noShadow; m.receiveShadow = true;
    return m;
  }
  function piv(x, y, z, kids, rx, ry, rz) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    if (rx) g.rotation.x = rx; if (ry) g.rotation.y = ry; if (rz) g.rotation.z = rz;
    (kids || []).forEach(k => g.add(k)); return g;
  }
  const logX = (len, d, x, y, z, c) => piv(x, y, z, [P('cyl8', c || 0x8b5e34, d, len, d, 0, -len / 2, 0)], 0, 0, Math.PI / 2);
  const logZ = (len, d, x, y, z, c) => piv(x, y, z, [P('cyl8', c || 0x8b5e34, d, len, d, 0, -len / 2, 0)], Math.PI / 2, 0, 0);
  function flag(x, y, z, col, h) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(P('cyl6', C.woodD, 0.05, h, 0.05, 0, 0, 0, 0, true));
    const f = piv(0, h, 0, [P('box', col, 0.5, 0.3, 0.03, 0.25, -0.32, 0, 0, true)]);
    g.add(f); anims.push({ k: 'flag', o: f, ph: Math.random() * 6 });
    return g;
  }
  function makeBar(w, color) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(geo('barbg'), barBg); bg.scale.set(w + 0.06, 0.14, 1);
    const fg = new THREE.Mesh(geo('barfg'), basic(color, { depthTest: false })); fg.scale.set(w, 0.08, 1); fg.position.set(-w / 2, 0, 0.001);
    bg.renderOrder = 10; fg.renderOrder = 11;
    g.add(bg); g.add(fg); g.userData = { fg, w };
    return g;
  }
  function setBar(bar, frac) { const f = Math.max(0.001, Math.min(1, frac)); bar.userData.fg.scale.x = bar.userData.w * f; }

  /* ---------- bâtiments : nains (joueurs) et orques (ennemis) ---------- */
  const DW = { stone: 0x9a9488, stoneL: 0xb8b3a8, stoneD: 0x6f767c, slate: 0x4d5966, slateD: 0x3c4552, wood: 0x8b6a45, woodD: 0x5f4127, woodL: 0xc49a63, gold: 0xc9922e, door: 0x3e2716, metal: 0xaeb4b8 };
  const OR = { wood: 0x4a3424, woodD: 0x34241a, woodL: 0x6b4a2b, hide: 0x8d6e4a, hideD: 0x6e5236, cloth: 0x8e2a1e, bone: 0xe6dcc0, metal: 0x6e5a48, stone: 0x6a6a5e, mud: 0x5b4a36, skin: 0x6f8f3a };
  function spikes(g, s, n, h) {
    const e = s / 2 - 0.08;
    for (let i = 0; i < n; i++) {
      const t = i / n * 4; let x, z;
      if (t < 1) { x = -e + 2 * e * t; z = e; } else if (t < 2) { x = e; z = e - 2 * e * (t - 1); } else if (t < 3) { x = e - 2 * e * (t - 2); z = -e; } else { x = -e; z = -e + 2 * e * (t - 3); }
      g.add(P('cone6', OR.woodL, 0.1, h || 0.5, 0.1, x, 0, z, 0, true));
    }
  }
  function totem(g, x, z, h) {
    g.add(P('cyl6', OR.wood, 0.1, h, 0.1, x, 0, z));
    g.add(P('sph', OR.bone, 0.2, 0.17, 0.2, x, h, z, 0, true));
    g.add(P('box', 0x111111, 0.05, 0.04, 0.02, x - 0.045, h + 0.07, z + 0.095, 0, true));
    g.add(P('box', 0x111111, 0.05, 0.04, 0.02, x + 0.045, h + 0.07, z + 0.095, 0, true));
  }
  function brazier(g, x, z) {
    g.add(P('cyl6', DW.stoneD, 0.22, 0.4, 0.22, x, 0, z));
    const f = P('cone6', fireMat, 0.16, 0.3, 0.16, x, 0.4, z, 0, true); g.add(f); anims.push({ k: 'fire', o: f, base: 0.3 });
  }
  function makeBld(type, lvl, col, orc) {
    const g = new THREE.Group(), info = { top: 1.5, muzzle: 1, emit: [], aim: null, arm: null };
    const add = m => { g.add(m); return m; };
    const K = orc
      ? { wall: OR.wood, wallL: OR.hide, wallD: OR.woodD, roof: OR.hide, roof2: OR.cloth, trim: OR.bone, wood: OR.wood, woodD: OR.woodD, woodL: OR.woodL, metal: OR.metal, door: 0x1d1510, accent: OR.cloth, base: OR.mud }
      : { wall: DW.stoneL, wallL: DW.stone, wallD: DW.stoneD, roof: DW.slate, roof2: DW.slateD, trim: DW.gold, wood: DW.wood, woodD: DW.woodD, woodL: DW.woodL, metal: DW.metal, door: DW.door, accent: col, base: DW.stoneD };
    switch (type) {
      case 'mairie': {
        if (orc) {
          add(P('cyl12', OR.mud, 2.9, 0.1, 2.9));
          add(P('cone6', OR.hide, 2.5, 2.3 + 0.15 * lvl, 2.5, 0, 0.1, 0));
          add(P('cone6', OR.hideD, 1.0, 0.5, 1.0, 0, 1.9 + 0.15 * lvl, 0));
          add(P('box', 0x1d1510, 0.55, 0.75, 0.05, 0, 0.1, 1.02, 0, true));
          for (const x of [-0.35, 0.35]) add(piv(x, 0.95, 1.0, [P('cone6', OR.bone, 0.12, 0.5, 0.12, 0, 0, 0, 0, true)], 0.9));
          totem(g, -1.15, 1.1, 1.3); totem(g, 1.15, 1.1, 1.3);
          add(P('box', OR.cloth, 0.4, 0.7, 0.03, 0.75, 0.6, 0.72, 0.5, true));
          spikes(g, 3, 10 + 2 * lvl, 0.6);
          info.emit.push([0, 2.6 + 0.15 * lvl, 0]); info.top = 3.1 + 0.15 * lvl;
        } else {
          add(P('box', DW.stoneD, 2.8, 0.3, 2.8));
          add(P('box', DW.stoneL, 2.2, 1.5, 1.8, 0, 0.3, -0.05));
          add(P('prism', DW.slate, 2.5, 0.9, 2.1, 0, 1.8, -0.05));
          add(P('box', DW.gold, 0.8, 1.0, 0.05, 0, 0.3, 0.86, 0, true));
          add(P('box', DW.door, 0.62, 0.88, 0.06, 0, 0.3, 0.87, 0, true));
          for (const x of [-0.75, 0.75]) add(P('box', winMat, 0.22, 0.3, 0.05, x, 1.05, 0.86, 0, true));
          brazier(g, -1.1, 1.15); brazier(g, 1.1, 1.15);
          add(P('box', DW.stoneD, 0.3, 0.8, 0.3, 0.7, 1.9, -0.45)); info.emit.push([0.7, 2.8, -0.45]);
          if (lvl >= 2) {
            const th = 2.0 + 0.25 * lvl;
            add(P('box', DW.stone, 0.85, th, 0.85, -1.0, 0.3, -0.85));
            add(P('cone4', DW.slateD, 1.1, 0.85, 1.1, -1.0, 0.3 + th, -0.85));
            add(P('box', winMat, 0.16, 0.26, 0.05, -1.0, 0.3 + th - 0.6, -0.42, 0, true));
            add(flag(-1.0, 0.3 + th + 0.8, -0.85, col, 0.9));
          } else add(flag(0, 2.7, -0.05, col, 0.8));
          if (lvl >= 3) { add(P('box', DW.stone, 0.7, 1.8, 0.7, 1.05, 0.3, -0.9)); add(P('cone4', DW.slateD, 0.9, 0.7, 0.9, 1.05, 2.1, -0.9)); }
          if (lvl >= 4) { add(P('box', DW.gold, 2.24, 0.07, 0.03, 0, 1.6, 0.86, 0, true)); for (const x of [-1.15, 1.15]) add(P('box', col, 0.24, 0.65, 0.03, x, 0.55, 0.87, 0, true)); }
          if (lvl >= 5) add(P('box', DW.gold, 2.5, 0.07, 0.08, 0, 2.68, -0.05, 0, true));
          info.top = 3.5;
        }
        break;
      }
      case 'scierie': {
        add(P('box', orc ? OR.mud : 0x8a6f4a, 1.8, 0.04, 1.8, 0, 0, 0, 0, true));
        add(P('box', K.wood, 1.1, 0.65, 0.8, -0.3, 0.04, -0.35));
        add(P(orc ? 'cone4' : 'prism', K.roof, 1.3, orc ? 0.7 : 0.45, orc ? 1.1 : 1.0, -0.3, 0.69, -0.35));
        const n = Math.min(6, 2 + lvl);
        for (let i = 0; i < n; i++) add(logZ(0.9, 0.2, 0.42 + (i % 3) * 0.2 - 0.05 * Math.floor(i / 3), 0.14 + Math.floor(i / 3) * 0.17, 0.25, orc ? 0x6b4a2b : 0x8b5e34));
        const spin = piv(0, 0, 0, [P('cyl12', K.metal, 0.55, 0.04, 0.55, 0, -0.02, 0, 0, true)]);
        add(piv(-0.3, 0.42, 0.2, [spin], Math.PI / 2, 0, 0)); anims.push({ k: 'spin', o: spin, s: 5 });
        add(P('box', K.woodL, 0.9, 0.18, 0.3, -0.3, 0.04, 0.25));
        if (orc) spikes(g, 2, 7, 0.45);
        info.top = 1.6; break;
      }
      case 'carriere': {
        add(P('box', orc ? OR.mud : 0x8f8a80, 1.9, 0.04, 1.9, 0, 0, 0, 0, true));
        add(P('dode', orc ? OR.stone : 0x8b9297, 1.5, 1.1, 1.2, -0.1, 0, -0.35));
        add(P('dode', orc ? 0x5c5c52 : 0x9aa1a6, 0.6, 0.5, 0.5, 0.6, 0, -0.55));
        if (!orc) {
          add(P('box', 0x1a1612, 0.48, 0.55, 0.06, -0.1, 0, 0.26, 0, true));
          add(P('box', DW.woodD, 0.08, 0.62, 0.08, -0.38, 0, 0.3)); add(P('box', DW.woodD, 0.08, 0.62, 0.08, 0.18, 0, 0.3)); add(P('box', DW.woodD, 0.66, 0.08, 0.1, -0.1, 0.6, 0.3));
          for (const x of [-0.22, 0.02]) add(P('box', DW.metal, 0.03, 0.03, 0.65, x, 0.04, 0.62, 0, true));
          add(P('box', 0x5d646a, 0.3, 0.2, 0.36, -0.1, 0.06, 0.75)); add(P('box', 0xcfd3d6, 0.24, 0.08, 0.3, -0.1, 0.26, 0.75, 0, true));
          if (lvl >= 3) brazier(g, 0.75, 0.75);
        } else {
          add(P('box', OR.woodD, 0.1, 1.3, 0.1, 0.7, 0, 0.6)); add(P('box', OR.woodD, 0.9, 0.08, 0.08, 0.3, 1.25, 0.6));
          spikes(g, 2, 6, 0.45);
        }
        for (let i = 0; i < Math.min(6, lvl + 1); i++) add(P('box', orc ? 0x8a8a7e : 0xcfd3d6, 0.26, 0.2, 0.26, 0.45 + (i % 2) * 0.3, 0.04 + Math.floor(i / 2) * 0.2, 0.15 + (i % 3) * 0.02));
        info.top = 1.5; break;
      }
      case 'ferme': {
        if (orc) {
          add(P('box', OR.mud, 1.85, 0.06, 1.85, 0, 0, 0, 0, true));
          for (let i = 0; i < 4; i++) add(P('box', 0x6b5a3c, 1.6, 0.1, 0.14, 0, 0.06, 0.15 + i * 0.22));
          add(P('cone6', OR.hide, 0.9, 0.9, 0.9, -0.45, 0.06, -0.5));
          for (let i = 0; i < 3; i++) add(P('box', OR.bone, 0.32, 0.05, 0.06, 0.4 + i * 0.12, 0.08, -0.55 + i * 0.1, i, true));
          totem(g, 0.7, -0.75, 0.9); spikes(g, 2, 8, 0.4);
        } else {
          add(P('box', 0x5a4632, 1.85, 0.06, 1.85, 0, 0, 0, 0, true));
          const caps = [0xb84a3a, 0xd9a441, 0x9a6ab0, 0xc85a3a];
          const spots = [[-0.55, -0.5], [0.15, -0.6], [0.6, -0.15], [-0.6, 0.15], [0.05, 0.05], [0.55, 0.55], [-0.2, 0.6], [-0.65, 0.65]];
          for (let i = 0; i < Math.min(8, 3 + lvl); i++) {
            const [x, z] = spots[i], h = 0.25 + ((i * 37) % 10) / 30, w = 0.3 + ((i * 53) % 10) / 40;
            add(P('cyl6', 0xeee3cc, 0.11, h, 0.11, x, 0.06, z));
            add(P('sph', caps[i % caps.length], w, w * 0.45, w, x, 0.06 + h - 0.04, z));
          }
          add(P('cyl6', DW.woodD, 0.05, 0.75, 0.05, 0.75, 0.06, -0.75)); add(P('box', winMat, 0.12, 0.14, 0.12, 0.75, 0.8, -0.75, 0, true));
          if (lvl >= 4) add(flag(-0.8, 0.06, -0.8, col, 0.7));
        }
        info.top = 1.2; break;
      }
      case 'entrepot': {
        if (orc) {
          add(P('cyl12', OR.mud, 1.9, 0.06, 1.9));
          add(P('cone4', OR.hide, 1.7, 1.2, 1.5, 0, 0.06, -0.1));
          for (let i = 0; i < Math.min(5, lvl + 1); i++) add(P('box', i % 2 ? OR.woodL : 0x7d6a4c, 0.3, 0.3, 0.3, -0.7 + i * 0.32, 0.06, 0.72, i * 0.3));
          spikes(g, 2, 8, 0.5);
        } else {
          add(P('box', DW.stoneL, 1.6, 0.9, 1.3, 0, 0, -0.05));
          add(P('prism', DW.slate, 1.75, 0.6, 1.45, 0, 0.9, -0.05));
          add(P('box', DW.wood, 0.55, 0.62, 0.05, 0, 0, 0.61, 0, true));
          add(P('box', DW.gold, 0.6, 0.06, 0.06, 0, 0.62, 0.61, 0, true));
          for (let i = 0; i < Math.min(5, lvl); i++) add(P('cyl8', 0x7a5534, 0.26, 0.32, 0.26, -0.75 + i * 0.3, 0, 0.82));
        }
        info.top = 1.8; break;
      }
      case 'caserne': {
        add(P('box', K.wallD, 1.5, 0.95, 1.4, 0, 0, -0.1));
        if (orc) { add(P('cone4', OR.cloth, 1.9, 0.8, 1.8, 0, 0.95, -0.1)); spikes(g, 2, 9, 0.55); totem(g, 0.8, 0.8, 1.0); }
        else {
          for (const x of [-0.62, 0, 0.62]) for (const z of [-0.7, 0.5]) add(P('box', DW.stoneD, 0.24, 0.22, 0.24, x, 0.95, z));
          add(P('box', DW.gold, 1.52, 0.06, 0.03, 0, 0.8, 0.61, 0, true));
          if (lvl >= 2) add(P('box', DW.stone, 0.85, 0.5, 0.75, 0, 0.95, -0.2));
          add(flag(0.55, lvl >= 2 ? 1.45 : 0.95, -0.55, col, 0.8));
          for (const x of [-0.65, 0.65]) { add(P('cyl6', DW.woodL, 0.1, 0.45, 0.1, x, 0, 0.82)); add(P('sph', 0xd9b54c, 0.18, 0.18, 0.18, x, 0.45, 0.82)); }
          if (lvl >= 3) add(P('box', col, 0.3, 0.55, 0.03, 0, 0.2, 0.63, 0, true));
        }
        add(P('box', K.door, 0.4, 0.6, 0.05, 0, 0, 0.61, 0, true));
        add(P('box', winMat, 0.16, 0.22, 0.05, -0.45, 0.5, 0.61, 0, true));
        add(P('box', winMat, 0.16, 0.22, 0.05, 0.45, 0.5, 0.61, 0, true));
        info.top = 2.0; break;
      }
      case 'camp': {
        add(P('cyl12', orc ? OR.mud : 0xa88a5c, 2.7, 0.04, 2.7, 0, 0, 0, 0, true));
        const spots = [[-0.85, -0.65], [0.85, -0.65], [-0.9, 0.7], [0.9, 0.7], [0, -1.05]];
        for (let i = 0; i < Math.min(5, lvl + 1); i++) add(P('cone4', orc ? (i % 2 ? OR.hide : OR.hideD) : (i % 2 ? 0xe8dfc8 : col), 0.85, 0.8, 0.85, spots[i][0], 0.04, spots[i][1]));
        add(logX(0.5, 0.08, 0, 0.08, 0.15)); add(logZ(0.5, 0.08, 0, 0.08, 0.15));
        const fl = P('cone6', fireMat, 0.24, 0.42, 0.24, 0, 0.06, 0.15, 0, true); add(fl);
        anims.push({ k: 'fire', o: fl }); info.emit.push([0, 0.7, 0.15]);
        if (orc) { spikes(g, 3, 12, 0.55); totem(g, 1.15, 1.15, 1.1); }
        else { add(P('box', DW.woodD, 0.7, 0.35, 0.07, 0, 0.04, 1.15)); for (const x of [-0.2, 0.05, 0.3]) add(P('box', DW.metal, 0.12, 0.08, 0.02, x, 0.38, 1.17, 0, true)); }
        info.top = 1.4; break;
      }
      case 'tour': {
        const H = 1.5 + 0.22 * lvl;
        if (orc) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(P('box', OR.woodD, 0.14, H, 0.14, sx * 0.42, 0, sz * 0.42));
          for (const sz of [-1, 1]) add(P('box', OR.woodD, 0.9, 0.07, 0.07, 0, H * 0.45, sz * 0.42, 0.25 * sz, true));
          add(P('box', OR.wood, 1.0, 0.45, 1.0, 0, H, 0));
          add(P('cone4', OR.cloth, 1.35, 0.85, 1.35, 0, H + 0.45, 0));
          add(P('sph', OR.bone, 0.2, 0.17, 0.2, 0, H + 0.12, 0.52, 0, true));
          spikes(g, 2, 6, 0.4);
        } else {
          add(P('box', DW.stoneD, 1.25, 0.3, 1.25));
          add(P('box', DW.stoneL, 0.95, H, 0.95, 0, 0.3, 0));
          add(P('box', DW.stone, 1.18, 0.3, 1.18, 0, H + 0.3, 0));
          for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) add(P('box', DW.stone, 0.22, 0.2, 0.22, x, H + 0.6, z));
          add(P('box', 0x2e2420, 0.12, 0.35, 0.04, 0, H * 0.55, 0.48, 0, true));
          if (lvl >= 3) add(P('cone4', DW.slateD, 1.2, 0.7, 1.2, 0, H + 0.8, 0));
          if (lvl >= 4) add(P('box', DW.gold, 0.97, 0.07, 0.97, 0, H * 0.75, 0, 0, true));
          if (lvl >= 5) add(flag(0.45, H + 1.4, 0.45, col, 0.7));
        }
        info.top = H + 1.4; info.muzzle = H + 0.45; break;
      }
      case 'baliste': {
        add(P('cyl8', orc ? OR.stone : DW.stoneL, 1.6, 0.4, 1.6));
        const a = piv(0, 0.4, 0, [
          P('box', K.woodD, 0.55, 0.25, 0.55),
          P('box', orc ? OR.wood : 0x7a5534, 0.18, 0.16, 1.1, 0, 0.25, 0.1),
          P('box', orc ? OR.woodL : (lvl >= 3 ? DW.gold : 0x5a3d22), 1.1, 0.09, 0.1, 0, 0.3, 0.55),
          P('box', K.metal, 0.05, 0.05, 0.6, 0, 0.42, 0.3, 0, true),
        ]);
        add(a); info.aim = a;
        if (orc) spikes(g, 2, 8, 0.45);
        info.top = 1.5; info.muzzle = 0.85; break;
      }
      case 'mangonneau': {
        const arm = piv(0, 0.95, 0, [P('box', K.woodL, 0.12, 0.12, 1.5, 0, -0.06, -0.45), P('sph', orc ? OR.stone : DW.stoneD, 0.26, 0.26, 0.26, 0, 0, -1.15)], -0.9);
        const a = piv(0, 0, 0, [
          P('box', orc ? OR.wood : 0x7a5534, 1.2, 0.22, 0.95),
          P('box', K.woodD, 0.12, 0.85, 0.12, -0.42, 0.22, 0), P('box', K.woodD, 0.12, 0.85, 0.12, 0.42, 0.22, 0),
          P('box', orc ? OR.woodD : DW.metal, 0.95, 0.1, 0.1, 0, 0.98, 0),
          logX(0.2, 0.3, 0.6, 0.12, 0.35, 0x3a2a1e), logX(0.2, 0.3, 0.6, 0.12, -0.35, 0x3a2a1e),
          arm,
        ]);
        add(a); info.aim = a; info.arm = arm;
        if (orc) spikes(g, 2, 8, 0.45);
        info.top = 1.7; info.muzzle = 1.3; break;
      }
    }
    return { g, info };
  }
  function makeRubble(s) {
    const g = new THREE.Group();
    g.add(P('box', 0x5c5248, s * 0.85, 0.1, s * 0.85, 0, 0, 0, 0, true));
    const R = mulberry32((s * 977) | 0);
    for (let i = 0; i < 4 + s * 2; i++) g.add(P('dode', i % 2 ? C.stoneD : C.woodD, 0.25 + R() * 0.3, 0.2 + R() * 0.2, 0.25 + R() * 0.3, (R() - 0.5) * s * 0.7, 0.05, (R() - 0.5) * s * 0.7, R() * 3));
    return g;
  }
  function makeScaffold(s, H) {
    const g = new THREE.Group(), e = s / 2 - 0.12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(P('box', C.woodL, 0.06, H, 0.06, sx * e, 0, sz * e, 0, true));
    for (const y of [H * 0.5, H]) for (const sz of [-1, 1]) { g.add(P('box', C.woodL, s - 0.2, 0.05, 0.05, 0, y, sz * e, 0, true)); g.add(P('box', C.woodL, 0.05, 0.05, s - 0.2, sz * e, y, 0, 0, true)); }
    g.add(P('box', C.woodL, 0.6, 0.12, 0.25, -e + 0.3, 0, e + 0.05));
    return g;
  }

  /* ---------- terrain : sol peint par le code, eau, végétation, décor ---------- */
  function radialTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const W_HALF = 20, TEX_N = 2048, TEX_P = TEX_N / (2 * W_HALF);   // 40 unités peintes, ~51 pixels par unité
  const MASK_K = 4, MASK_N = 2 * W_HALF * MASK_K;                     // masque « pas d'herbe » : 4 cases par unité
  let seasonBiome = 'green', cropStage = 1;
  let biome = '', baseCanvas = null, groundCanvas = null, groundTex = null, groundSig = '', groundTimer = null, waterMesh = null, waterNormal = null, outerMesh = null;
  const terrainGroup = new THREE.Group(), decoGroup = new THREE.Group(), forestGroup = new THREE.Group();
  const PAL = {
    green: { base: '#5f8d33', blot: ['#4d7d29', '#76a33e', '#8fa94a', '#3f6c22', '#6f9a37', '#a1b257', '#557f2c'], light: '#94bf55', dark: '#3a6420', spec: ['#f4f1e6', '#f2d24a', '#b58ad9', '#e86a5a', '#f4f1e6'],
      dirt: '#8d6f47', dirtD: '#6d5434', path: '#a07f52', stone: ['#8f8b82', '#a19c92', '#7d7a73', '#b0aa9e'], far: [0.36, 0.55, 0.2], rock: [0.48, 0.47, 0.44] },
    snow: { base: '#c4cfdb', blot: ['#aebccb', '#d8e1e9', '#9fb0c2', '#c9d3dd', '#e6edf3', '#b7c4d0'], light: '#eef3f8', dark: '#91a3b5', spec: ['#5b5149', '#6e655c'],
      dirt: '#54483c', dirtD: '#3b332c', path: '#4a3f35', stone: ['#77746f', '#8a8680', '#64615d', '#9a958d'], far: [0.86, 0.9, 0.94], rock: [0.42, 0.42, 0.44] },
  };
  /* Bruit doux (valeur) pour les reliefs et les couleurs. */
  function hash2(x, z) { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.03, z * 2.03) * 0.25 + vnoise(x * 4.1, z * 4.1) * 0.125 + vnoise(x * 8.3, z * 8.3) * 0.0625;
  const toPx = v => (v + W_HALF) * TEX_P;
  const mkCanvas = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  /* Pinceaux : disques flous pré-dessinés, un par couleur. */
  const brushes = {};
  function brush(color) {
    if (brushes[color]) return brushes[color];
    const c = mkCanvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.55, color + 'aa'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (brushes[color] = c);
  }
  function dab(x, color, wx, wz, r, alpha) { const s = r * TEX_P; x.globalAlpha = alpha; x.drawImage(brush(color), toPx(wx) - s, toPx(wz) - s, 2 * s, 2 * s); }
  /* Le lac du village : hors de la zone constructible, en bas à gauche de l'écran. */
  const LAKE = { x: -3, z: 18.6 };
  const lakeR = a => 4.2 + 1.1 * Math.sin(3 * a + 1) + 0.6 * Math.sin(5 * a + 2) + 0.35 * Math.sin(9 * a);
  function lakePath(x, k) {
    x.beginPath();
    for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = lakeR(a) * k; const px = toPx(LAKE.x + Math.cos(a) * r), pz = toPx(LAKE.z + Math.sin(a) * r); if (i) x.lineTo(px, pz); else x.moveTo(px, pz); }
    x.closePath();
  }
  function inLake(wx, wz, k) { const dx = wx - LAKE.x, dz = wz - LAKE.z, a = Math.atan2(dz, dx); return Math.sqrt(dx * dx + dz * dz) < lakeR(a) * k; }
  const baseCache = {};
  function paintBase(bi) {
    if (baseCache[bi]) { baseCanvas = baseCache[bi]; return; }
    const c = baseCanvas = baseCache[bi] = mkCanvas(TEX_N), x = c.getContext('2d'), pal = PAL[bi], R = mulberry32(bi === 'snow' ? 99 : 7);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = pal.base; x.fillRect(0, 0, TEX_N, TEX_N);
    const rnd = () => (R() * 2 - 1) * W_HALF;
    for (let i = 0; i < 260; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 2.5 + R() * 4.5, 0.18 + R() * 0.2);
    for (let i = 0; i < 900; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 0.8 + R() * 1.8, 0.2 + R() * 0.25);
    for (let i = 0; i < 4200; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 0.12 + R() * 0.4, 0.25 + R() * 0.35);
    x.lineCap = 'round';
    for (const [col, a, w] of [[pal.dark, 0.32, 1.4], [pal.light, 0.3, 1.2], [pal.dark, 0.22, 1], [pal.light, 0.22, 1]]) {
      x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = w; x.beginPath();
      for (let i = 0; i < 9000; i++) { const px = R() * TEX_N, py = R() * TEX_N; x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 2.5, py - 1.5 - R() * 3); }
      x.stroke();
    }
    for (const col of pal.spec) {
      x.fillStyle = col; x.globalAlpha = 0.85; x.beginPath();
      for (let i = 0; i < (bi === 'snow' ? 45 : 110); i++) { const px = R() * TEX_N, py = R() * TEX_N, r = 1 + R() * 1.7; x.moveTo(px + r, py); x.arc(px, py, r, 0, 6.2832); }
      x.fill();
    }
    if (bi === 'green') {
      x.globalAlpha = 1;
      x.fillStyle = '#c9b585'; lakePath(x, 1.28); x.fill();
      x.fillStyle = '#a99366'; lakePath(x, 1.1); x.fill();
      const g = x.createRadialGradient(toPx(LAKE.x), toPx(LAKE.z), 0, toPx(LAKE.x), toPx(LAKE.z), 5.5 * TEX_P);
      g.addColorStop(0, '#1f4a57'); g.addColorStop(0.7, '#3d7064'); g.addColorStop(1, '#6f8f6a');
      x.fillStyle = g; lakePath(x, 1.0); x.fill();
      for (let i = 0; i < 160; i++) { const a = R() * 6.2832, r = lakeR(a) * (1.02 + R() * 0.24); dab(x, R() < 0.5 ? '#8a7a55' : '#d8c79a', LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r, 0.2 + R() * 0.3, 0.5); }
    }
    // bords fondus vers la couleur du terrain lointain
    const f = pal.far, rgb = `${Math.round(f[0] * 255)},${Math.round(f[1] * 255)},${Math.round(f[2] * 255)}`;
    x.globalAlpha = 1;
    for (const [x0, y0, x1, y1, w, h, cx, cy] of [[0, 0, 0, 160, 0, 0, TEX_N, 160], [0, TEX_N, 0, TEX_N - 160, 0, TEX_N - 160, TEX_N, 160], [0, 0, 160, 0, 0, 0, 160, TEX_N], [TEX_N, 0, TEX_N - 160, 0, TEX_N - 160, 0, 160, TEX_N]]) {
      const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(w, h, cx, cy);
    }
  }
  /* Masque des zones sans herbe (bâtiments, terre, chemins, champs, eau). */
  let mask = new Uint8Array(MASK_N * MASK_N), fieldTiles = [];
  const mIdx = (wx, wz) => { const i = Math.floor((wx + W_HALF) * MASK_K), j = Math.floor((wz + W_HALF) * MASK_K); return i < 0 || j < 0 || i >= MASK_N || j >= MASK_N ? -1 : j * MASK_N + i; };
  function markRect(x0, z0, x1, z1, v) { for (let z = z0; z < z1; z += 1 / MASK_K) for (let x = x0; x < x1; x += 1 / MASK_K) { const k = mIdx(x, z); if (k >= 0) mask[k] = Math.max(mask[k], v); } }
  let lastGroundItems = [];
  function paintGround(items) {
    if (!groundCanvas) return;
    lastGroundItems = items;
    const x = groundCanvas.getContext('2d'), pal = PAL[biome], snow = biome === 'snow';
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.shadowBlur = 0;
    x.drawImage(baseCanvas, 0, 0);
    mask = new Uint8Array(MASK_N * MASK_N); fieldTiles = [];
    if (biome === 'green') for (let j = 0; j < MASK_N; j++) for (let i = 0; i < MASK_N; i++) { if (inLake(i / MASK_K - W_HALF, j / MASK_K - W_HALF, 1.15)) mask[j * MASK_N + i] = 3; }
    const blds = items.filter(it => it.type !== 'rempart' && it.key !== 'ghost'), walls = items.filter(it => it.type === 'rempart');
    const cen = b => { const s = BLD[b.type].size; return [b.gx + s / 2 - half, b.gz + s / 2 - half, s]; };
    const R = mulberry32(blds.length * 131 + 7);
    // sol tassé autour des bâtiments
    for (const b of blds) { const [cx, cz, s] = cen(b); dab(x, pal.dirt, cx, cz, s * (snow ? 1.7 : 1.25), snow ? 0.55 : 0.24); }
    if (snow) for (let i = 0; i < 40; i++) { const b = blds[i % Math.max(1, blds.length)]; if (!b) break; const [cx, cz, s] = cen(b); dab(x, pal.dirtD, cx + (R() - 0.5) * 6, cz + (R() - 0.5) * 6, 0.4 + R() * 0.9, 0.35); }
    // chemins jusqu'à la halle
    const hall = blds.find(b => b.type === 'halle' || b.type === 'mairie');
    if (hall) {
      const [hx, hz] = cen(hall);
      for (const b of blds) {
        if (b === hall || BLD[b.type].size < 2) continue;
        const [bx, bz] = cen(b), mx = (bx + hx) / 2 + (hash2(b.gx, b.gz) - 0.5) * 2.4, mz = (bz + hz) / 2 + (hash2(b.gz, b.gx) - 0.5) * 2.4;
        for (const [w, a, col] of [[1.5, 0.25, pal.dirt], [1.0, 0.6, pal.path], [0.5, 0.35, pal.dirtD]]) {
          x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = w * TEX_P; x.lineCap = 'round'; x.lineJoin = 'round';
          x.beginPath(); x.moveTo(toPx(bx), toPx(bz)); x.quadraticCurveTo(toPx(mx), toPx(mz), toPx(hx), toPx(hz)); x.stroke();
        }
        for (let t = 0; t <= 1; t += 0.04) {
          const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * hx, pz = (1 - t) * (1 - t) * bz + 2 * (1 - t) * t * mz + t * t * hz;
          markRect(px - 0.6, pz - 0.6, px + 0.6, pz + 0.6, 1);
          if (R() < 0.5) dab(x, pal.stone[Math.floor(R() * pal.stone.length)], px + (R() - 0.5) * 0.6, pz + (R() - 0.5) * 0.6, 0.06 + R() * 0.06, 0.8);
        }
      }
    }
    // champs de blé : leur aspect suit la saison
    for (const b of blds) {
      if (b.type !== 'champ' || b.dead || b.lvl <= 0) continue;
      const s2 = BLD[b.type].size, vert = hash2(b.gz, b.gx * 5) < 0.5, stage = cropStage, barley = b.crop === 'orge';
      for (let i = 0; i < s2; i++) for (let j = 0; j < s2; j++) {
        const gx = b.gx + i, gz = b.gz + j, wx = gx - half, wz = gz - half, X0 = toPx(wx), Y0 = toPx(wz);
        x.globalAlpha = 1; x.fillStyle = snow ? '#cfd6db' : '#7b5b35'; x.fillRect(X0, Y0, TEX_P, TEX_P);
        // l'orge est plus pâle que le blé : vert tendre au printemps, paille claire quand elle est mûre
        const crop = snow ? '#e8edf0' : stage === 2 ? (barley ? '#e2d08e' : '#cfb24e') : (barley ? '#a3bd55' : '#79a83c');
        for (const [col, w, off] of [[snow ? '#9aa4ab' : '#5c4225', 0.07, 0], [crop, 0.09, -0.06]]) {
          x.strokeStyle = col; x.lineWidth = TEX_P * w; x.globalAlpha = 0.85; x.beginPath();
          for (let k = 0; k < 6; k++) { const q = (k + 0.5) / 6 * TEX_P + off * TEX_P; if (vert) { x.moveTo(X0 + q, Y0); x.lineTo(X0 + q, Y0 + TEX_P); } else { x.moveTo(X0, Y0 + q); x.lineTo(X0 + TEX_P, Y0 + q); } }
          x.stroke();
        }
        if (!snow) fieldTiles.push([gx, gz, stage, vert, barley]);
        markRect(wx, wz, wx + 1, wz + 1, 2);
      }
    }
    // parcelles et ombre au pied des bâtiments
    for (const b of blds) {
      if (b.type === 'champ') continue;
      const big = b.type === 'mairie' || b.type === 'halle';
      if (BLD[b.type].size < 2) { const [cx1, cz1] = cen(b); dab(x, pal.dirt, cx1, cz1, 0.7, 0.35); markRect(cx1 - 0.6, cz1 - 0.6, cx1 + 0.6, cz1 + 0.6, 2); continue; }
      const [cx, cz, s] = cen(b), m = big ? 0.9 : 0.32, x0 = toPx(cx - s / 2 - m), y0 = toPx(cz - s / 2 - m), w = (s + 2 * m) * TEX_P;
      x.globalAlpha = 0.95; x.fillStyle = big ? pal.stone[0] : pal.dirt;
      x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, w, TEX_P * 0.35); else x.rect(x0, y0, w, w); x.fill();
      const nSt = big ? 140 : 26;
      for (let k = 0; k < nSt; k++) { x.globalAlpha = 0.75; x.fillStyle = pal.stone[k % pal.stone.length]; const sx = x0 + R() * w, sy = y0 + R() * w, sw = TEX_P * (big ? 0.26 : 0.1) * (0.6 + R() * 0.6); x.fillRect(sx, sy, sw, sw * 0.7); }
      x.globalAlpha = 1; x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = TEX_P * 0.5; x.fillStyle = 'rgba(30,22,14,0.35)';
      x.fillRect(toPx(cx - s / 2), toPx(cz - s / 2), s * TEX_P, s * TEX_P); x.shadowBlur = 0;
      markRect(cx - s / 2 - m - 0.15, cz - s / 2 - m - 0.15, cx + s / 2 + m + 0.15, cz + s / 2 + m + 0.15, 2);
    }
    // remparts : bande de terre et petite ombre
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = TEX_P * 0.25;
    for (const w of walls) { x.globalAlpha = 0.7; x.fillStyle = pal.dirtD; x.fillRect(toPx(w.gx - half) + 3, toPx(w.gz - half) + 3, TEX_P - 6, TEX_P - 6); markRect(w.gx - half - 0.1, w.gz - half - 0.1, w.gx - half + 1.1, w.gz - half + 1.1, 2); }
    x.shadowBlur = 0; x.globalAlpha = 1;
    groundTex.needsUpdate = true;
    buildDeco();
    planVillage(items);
  }
  /* Géométries simples fusionnées (arbres, touffes d'herbe) avec couleurs par sommet. */
  function mergeColored(parts) {
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const p of parts) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g; g.computeVertexNormals();
      const P3 = g.attributes.position, N3 = g.attributes.normal;
      for (let i = 0; i < P3.count; i++) {
        pos[(o + i) * 3] = P3.getX(i); pos[(o + i) * 3 + 1] = P3.getY(i); pos[(o + i) * 3 + 2] = P3.getZ(i);
        if (p.n) { const dx = P3.getX(i) - p.n[0], dy = P3.getY(i) - p.n[1], dz = P3.getZ(i) - p.n[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; nor[(o + i) * 3] = dx / l * 0.75 + N3.getX(i) * 0.25; nor[(o + i) * 3 + 1] = dy / l * 0.75 + N3.getY(i) * 0.25; nor[(o + i) * 3 + 2] = dz / l * 0.75 + N3.getZ(i) * 0.25; }
        else { nor[(o + i) * 3] = N3.getX(i); nor[(o + i) * 3 + 1] = N3.getY(i); nor[(o + i) * 3 + 2] = N3.getZ(i); }
        const c = typeof p.c === 'function' ? p.c(P3.getX(i), P3.getY(i), P3.getZ(i)) : p.c;
        col[(o + i) * 3] = c[0]; col[(o + i) * 3 + 1] = c[1]; col[(o + i) * 3 + 2] = c[2];
      }
      o += P3.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  const srgb = (r, g, b) => { const c = new THREE.Color(r, g, b).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
  function bumpy(g, amt, seed) {
    const P3 = g.attributes.position;
    for (let i = 0; i < P3.count; i++) { const x = P3.getX(i), y = P3.getY(i), z = P3.getZ(i), k = 1 + (vnoise(x * 3 + seed, z * 3 + y * 2) - 0.5) * amt; P3.setXYZ(i, x * k, y * (1 + (k - 1) * 0.5), z * k); }
    return g;
  }
  const TREE_GEO = {};
  function treeGeo(kind) {
    if (TREE_GEO[kind]) return TREE_GEO[kind];
    const parts = [], trunk = new THREE.CylinderGeometry(0.07, 0.11, 0.9, 6); trunk.translate(0, 0.45, 0);
    parts.push({ g: trunk, c: srgb(0.36, 0.25, 0.15) });
    if (kind.startsWith('oak')) {
      const v = kind === 'oak2' ? 1 : 0, blobs = [[0, 1.25, 0, 0.62], [0.32, 1.05, 0.1, 0.42], [-0.3, 1.1, -0.12, 0.45], [0.05, 1.6, -0.05, 0.4]];
      blobs.forEach(([bx, by, bz, r], i) => {
        const g = bumpy(new THREE.IcosahedronGeometry(r, 1), 0.3, i * 7 + v * 13); g.translate(bx, by, bz);
        const base = v ? [0.3, 0.48, 0.17] : [0.23, 0.41, 0.15];
        parts.push({ g, n: [bx, by - r * 0.3, bz], c: (x, y, z) => { const k = (0.66 + (y - 0.8) * 0.5) * (0.85 + vnoise(x * 6 + 3, z * 6 + y * 4) * 0.3); return srgb(base[0] * k, base[1] * k, base[2] * k); } });
      });
    } else {
      const snowy = kind === 'pineS';
      for (let i = 0; i < 4; i++) {
        const r = 0.62 - i * 0.13, h = 0.75, g = new THREE.ConeGeometry(r, h, 8, 1); g.translate(0, 0.65 + i * 0.36, 0);
        parts.push({ g, c: (x, y) => { const up = y - (0.4 + i * 0.36); if (snowy && up > 0.18) return srgb(0.9, 0.93, 0.96); const k = 0.6 + up * 0.5; return srgb(0.12 * k, 0.3 * k, 0.17 * k); } });
      }
    }
    return (TREE_GEO[kind] = mergeColored(parts));
  }
  let bushG = null;
  function bushGeo() {
    if (bushG) return bushG;
    const parts = [];
    [[0, 0.32, 0, 0.42], [0.28, 0.24, 0.12, 0.3], [-0.26, 0.22, -0.08, 0.32]].forEach(([bx, by, bz, r], i) => {
      const g = bumpy(new THREE.IcosahedronGeometry(r, 1), 0.3, i * 5 + 2); g.translate(bx, by, bz);
      parts.push({ g, n: [bx, by - r * 0.4, bz], c: (x, y, z) => { const k = (0.7 + y * 0.6) * (0.85 + vnoise(x * 7, z * 7 + y * 3) * 0.3); return srgb(0.22 * k, 0.4 * k, 0.14 * k); } });
    });
    return (bushG = mergeColored(parts));
  }
  let tuftGeo = null;
  function tuftGeometry() {
    if (tuftGeo) return tuftGeo;
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.16, 0.3, 1, 1); g.translate(0, 0.15, 0); g.rotateY(i * Math.PI / 3);
      const P3 = g.attributes.position; for (let k = 0; k < P3.count; k++) if (P3.getY(k) > 0.2) P3.setX(k, P3.getX(k) * 0.25);
      parts.push({ g, c: (x, y) => y > 0.2 ? srgb(0.62, 0.78, 0.33) : srgb(0.25, 0.42, 0.14) });
    }
    return (tuftGeo = mergeColored(parts));
  }
  const vcMat = {};
  const vertexMat = side => vcMat[side] || (vcMat[side] = new THREE.MeshLambertMaterial({ vertexColors: true, side: side ? THREE.DoubleSide : THREE.FrontSide }));
  function instanced(geom, material, list, shadow) {
    const im = new THREE.InstancedMesh(geom, material, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    list.forEach(([x, y, z, s, ry, sy], i) => { q.setFromAxisAngle(up, ry || 0); ps.set(x, y, z); sc.set(s, s * (sy || 1), s); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); });
    im.count = list.length; im.castShadow = !!shadow; im.receiveShadow = true;
    return im;
  }
  function clearGroup(g) { while (g.children.length) { const c = g.children[0]; g.remove(c); if (c.dispose) c.dispose(); } }
  /* Décor qui dépend du village : herbe haute, épis dans les champs, petites caisses et tonneaux. */
  function buildDeco() {
    clearGroup(decoGroup);
    const R = mulberry32(fieldTiles.length * 17 + 3), snow = biome === 'snow', tufts = [], crops = [], rocks = [], props = [];
    if (!snow) {
      for (let c = 0; c < 60; c++) {
        const cx = (R() * 2 - 1) * (W_HALF - 1), cz = (R() * 2 - 1) * (W_HALF - 1), n = 2 + Math.floor(R() * 5);
        for (let i = 0; i < n; i++) {
          const wx = cx + (R() - 0.5) * 1.4, wz = cz + (R() - 0.5) * 1.4, k = mIdx(wx, wz);
          if (k < 0 || mask[k]) continue;
          if (Math.max(Math.abs(wx), Math.abs(wz)) < half - 2 && R() < 0.6) continue;
          tufts.push([wx, 0.02, wz, 0.22 + R() * 0.22, R() * 6.28, 0.7]);
        }
      }
      for (const [gx, gz, stage, vert, barley] of fieldTiles) for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) {
        const u = (a + 0.5) / 6, w = 0.12 + b * 0.25;
        crops.push([gx - half + (vert ? u : w), 0, gz - half + (vert ? w : u), 0.55 + R() * 0.25, R() * 6.28, (stage === 2 ? 1.15 : stage === 1 ? 0.85 : 0.35) * (barley ? 0.85 : 1), stage === 2, !!barley]);
      }
    } else {
      for (let i = 0; i < 260; i++) { const wx = (R() * 2 - 1) * (W_HALF - 0.5), wz = (R() * 2 - 1) * (W_HALF - 0.5), k = mIdx(wx, wz); if (k < 0 || mask[k]) continue; rocks.push([wx, 0, wz, 0.12 + R() * 0.2, R() * 6.28, 0.6]); }
    }
    for (let i = 0; i < 70; i++) { const wx = (R() * 2 - 1) * (W_HALF - 1), wz = (R() * 2 - 1) * (W_HALF - 1); if (Math.max(Math.abs(wx), Math.abs(wz)) < half + 0.5) continue; const k = mIdx(wx, wz); if (k >= 0 && mask[k] === 3) continue; rocks.push([wx, 0, wz, 0.18 + R() * 0.35, R() * 6.28, 0.55]); }
    const PROPS = { bucheron: ['logs', 'logs', 'crate'], carriere: ['block', 'block', 'barrel'], champ: ['hay'], moulin: ['sack', 'sack', 'hay'], boulangerie: ['sack', 'barrel'], brasserie: ['sack', 'crate'], entrepot: ['crate', 'barrel', 'sack'], taverne: ['barrel', 'barrel', 'crate'], halle: ['barrel', 'crate', 'sack'], chasse: ['crate', 'logs'] };
    const propL = { barrel: [], crate: [], sack: [], logs: [], block: [], hay: [] };
    for (const it of lastGroundItems) {
      if (it.dead || it.key === 'ghost' || !PROPS[it.type] || it.lvl <= 0) continue;
      const sz = BLD[it.type].size, list = PROPS[it.type];
      list.forEach((kind, i) => {
        const corner = [[-1, -1], [1, -1], [-1, 1], [1, 1]][(i + it.gx + it.gz) % 4], m = sz / 2 + 0.18;
        const wx = it.gx + sz / 2 - half + corner[0] * m + (R() - 0.5) * 0.2, wz = it.gz + sz / 2 - half + corner[1] * m + (R() - 0.5) * 0.2;
        propL[kind].push([wx, 0, wz, 1, R() * 6.28]);
      });
    }
    const PG = { barrel: ['cyl8', 0x7a5534, 0.26, 0.34], crate: ['box', 0x9b7448, 0.3, 0.28], sack: ['sph', 0xd8c49a, 0.3, 0.24], logs: ['cyl6', 0x6e4a2a, 0.5, 0.2], block: ['box', 0x9a968c, 0.32, 0.24], hay: ['cyl8', 0xd8b65a, 0.34, 0.3] };
    for (const k in propL) if (propL[k].length) { const [gk, col, w, h] = PG[k]; decoGroup.add(instanced(geo(gk), mat(col), propL[k].map(p => [p[0], 0, p[2], 1, p[4]]).map(p => p), true)); const im = decoGroup.children[decoGroup.children.length - 1]; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(w, h, w), up = new THREE.Vector3(0, 1, 0); propL[k].forEach((p, i) => { q.setFromAxisAngle(up, p[4]); if (k === 'logs') q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); ps.set(p[0], k === 'logs' ? 0.1 : 0, p[2]); m4.compose(ps, q, k === 'logs' ? new THREE.Vector3(0.2, 0.5, 0.2) : sc); im.setMatrixAt(i, m4); }); }
    if (tufts.length) decoGroup.add(instanced(bushGeo(), vertexMat(false), tufts, true));
    /* épis : blé mûr, blé vert, orge mûre, orge verte */
    for (const [ripe, barley, col] of [[true, false, 0xd4b45a], [false, false, 0x6f9e37], [true, true, 0xe4d394], [false, true, 0x9dbb50]]) {
      const L = crops.filter(c => c[6] === ripe && c[7] === barley);
      if (L.length) decoGroup.add(instanced(geo('cone4'), mat(col), L.map(c => [c[0], 0, c[2], 0.1, c[4], c[5] * 3]), false));
    }
    if (rocks.length) decoGroup.add(instanced(geo('dode'), mat(snow ? 0x6f6c68 : 0x8a8d8a), rocks, true));
  }
  /* Forêts, collines lointaines : selon le biome (vert au village, neige chez les orques). */
  function buildForest() {
    clearGroup(forestGroup);
    const snow = biome === 'snow', R = mulberry32(snow ? 404 : 202), lists = {}, kinds = snow ? ['pineS', 'pine'] : ['oak', 'oak2', 'pine'];
    for (const k of kinds) lists[k] = [];
    const place = (x, z, s) => { const k = kinds[snow ? (R() < 0.75 ? 0 : 1) : (R() < 0.42 ? 0 : R() < 0.75 ? 1 : 2)]; lists[k].push([x, heightAt(x, z), z, s, R() * 6.28, 0.85 + R() * 0.35]); };
    // bosquets serrés autour du plateau, plus clairsemés au loin
    for (let c = 0; c < 22; c++) {
      const a = R() * 6.2832, d = 15 + R() * 26, cx = Math.cos(a) * d, cz = Math.sin(a) * d, n = 6 + Math.floor(R() * 14);
      for (let i = 0; i < n; i++) {
        const x = cx + (R() - 0.5) * 7, z = cz + (R() - 0.5) * 7;
        if (Math.max(Math.abs(x), Math.abs(z)) < half + 1.2) continue;
        if (!snow && inLake(x, z, 1.3)) continue;
        place(x, z, 1.1 + R() * 0.9);
      }
    }
    for (let i = 0; i < 100; i++) {
      const x = (R() * 2 - 1) * 70, z = (R() * 2 - 1) * 70;
      if (Math.max(Math.abs(x), Math.abs(z)) < half + 2 || (!snow && inLake(x, z, 1.3))) continue;
      place(x, z, 1 + R() * 1.1);
    }
    for (const k of kinds) if (lists[k].length) {
      const near = lists[k].filter(t => Math.abs(t[0]) < 19 && Math.abs(t[2]) < 19), far = lists[k].filter(t => !(Math.abs(t[0]) < 19 && Math.abs(t[2]) < 19));
      if (near.length) forestGroup.add(instanced(treeGeo(k), vertexMat(false), near, true));
      if (far.length) forestGroup.add(instanced(treeGeo(k), vertexMat(false), far, false));
    }
  }
  /* Relief au-delà du plateau peint. */
  function heightAt(x, z) {
    const d = Math.max(Math.abs(x), Math.abs(z)) - W_HALF;
    if (d < 0) return 0;
    const k = Math.min(1, d / 14);
    return k * k * (fbm(x * 0.045 + 3, z * 0.045 + 7) * 11 - 2.5) + d * 0.05;
  }
  function buildOuter() {
    if (outerMesh) { terrainGroup.remove(outerMesh); outerMesh.geometry.dispose(); }
    const g = new THREE.PlaneGeometry(240, 240, 120, 120); g.rotateX(-Math.PI / 2);
    const P3 = g.attributes.position, col = new Float32Array(P3.count * 3), pal = PAL[biome], snow = biome === 'snow';
    for (let i = 0; i < P3.count; i++) {
      const x = P3.getX(i), z = P3.getZ(i), y = heightAt(x, z) - 0.04; P3.setY(i, y);
      const n = fbm(x * 0.12, z * 0.12), hi = Math.max(0, Math.min(1, (y - 3) / 5));
      let c = pal.far.map(v => v * (0.82 + n * 0.36));
      c = c.map((v, j) => v * (1 - hi) + pal.rock[j] * hi);
      if (snow && y > 4) c = [0.9, 0.93, 0.96];
      const s = srgb(c[0], c[1], c[2]); col[i * 3] = s[0]; col[i * 3 + 1] = s[1]; col[i * 3 + 2] = s[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    outerMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    outerMesh.receiveShadow = true; terrainGroup.add(outerMesh);
  }
  function waterNormalMap() {
    const c = mkCanvas(256), x = c.getContext('2d'), img = x.createImageData(256, 256), h = (i, j) => fbm(i / 256 * 6, j / 256 * 6) + 0.5 * fbm(i / 256 * 14 + 9, j / 256 * 14);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const dx = (h((i + 1) & 255, j) - h((i + 255) & 255, j)) * 6, dz = (h(i, (j + 1) & 255) - h(i, (j + 255) & 255)) * 6, l = Math.sqrt(dx * dx + dz * dz + 1), k = (j * 256 + i) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dz / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    return t;
  }
  function buildWater() {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = lakeR(a) * 1.03, px = LAKE.x + Math.cos(a) * r, pz = LAKE.z + Math.sin(a) * r; if (i) shape.lineTo(px, -pz); else shape.moveTo(px, -pz); }
    const g = new THREE.ShapeGeometry(shape, 24); g.rotateX(-Math.PI / 2);
    waterNormal = waterNormalMap();
    waterMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lin(0x2d6f86), roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.78, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3 }));
    waterMesh.position.y = 0.03; waterMesh.receiveShadow = true; waterMesh.renderOrder = 1;
    terrainGroup.add(waterMesh);
  }
  /* Montagnes à l'horizon. */
  function buildHorizon() {
    for (const c of decoProc.children.slice()) decoProc.remove(c);
    const R = mulberry32(7), snow = biome === 'snow';
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + R() * 0.2, r = 80 + R() * 30, h = 20 + R() * 26, w = 24 + R() * 22;
      decoProc.add(P('cone7', snow ? 0xc9d3dc : (R() < 0.5 ? 0x7b8a92 : 0x6c7c74), w, h, w * (0.8 + R() * 0.4), Math.cos(a) * r, -0.5, Math.sin(a) * r, R() * 3, true));
      decoProc.add(P('cone7', 0xeef3f6, w * 0.38, h * 0.38, w * 0.33, Math.cos(a) * r, h * 0.63 - 0.5, Math.sin(a) * r, R() * 3, true));
    }
  }
  function setBiome(bi) {
    if (bi === biome) return;
    biome = bi;
    paintBase(bi); buildOuter(); buildForest(); buildHorizon();
    if (waterMesh) waterMesh.visible = bi === 'green';
    groundSig = '';
  }
  function buildWorld() {
    groundCanvas = mkCanvas(TEX_N);
    groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.anisotropy = 4; groundTex.encoding = THREE.sRGBEncoding;
    groundMat = new THREE.MeshStandardMaterial({ map: groundTex, bumpMap: groundTex, bumpScale: 0.035, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
    outerMat = groundMat;
    const play = new THREE.Mesh(new THREE.PlaneGeometry(2 * W_HALF, 2 * W_HALF), groundMat);
    play.rotation.x = -Math.PI / 2; play.position.y = -0.005; play.receiveShadow = true; terrainGroup.add(play);
    buildWater();
    scene.add(terrainGroup); scene.add(decoGroup); scene.add(forestGroup); scene.add(decoProc); scene.add(lifeGroup);
    setBiome('green');
    paintGround([]);
  }
  /* Le sol est repeint quand les bâtiments changent de place (pas quand ils sont détruits). */
  function scheduleGround(items) {
    /* repeindre le sol si un bâtiment bouge, se termine (un champ fini) ou change de culture */
    const sig = biome + '|' + items.filter(it => it.key !== 'ghost').map(it => it.type[0] + it.gx + ',' + it.gz + (it.lvl > 0 ? '' : '_') + (it.crop === 'orge' ? 'o' : '')).join(';');
    if (sig === groundSig) return;
    groundSig = sig;
    clearTimeout(groundTimer);
    groundTimer = setTimeout(() => paintGround(items), 60);
  }
  function buildWorldModels() { /* le décor est maintenant entièrement généré (forêts, relief, eau) */ }

  /* ---------- initialisation ---------- */
  function init(cv) {
    canvas = cv;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222233);
    scene.fog = new THREE.Fog(0xe9c27e, 70, 150);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 140 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    winMat = basic(0xffc56b); fireMat = basic(0xffa040);
    barBg = basic(0x1b1b1b, { transparent: true, opacity: 0.7, depthTest: false });
    selMat = basic(0xfff2c0, { transparent: true, opacity: 0.35, depthWrite: false });
    ghostOk = basic(0x6cdc8c, { transparent: true, opacity: 0.45, depthWrite: false });
    ghostBad = basic(0xe86a5a, { transparent: true, opacity: 0.5, depthWrite: false });
    ringMat = basic(0xff6a3c, { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    ringFill = basic(0xff4a2c, { transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    glowTex = radialTexture();
    emberMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a3a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    try { buildWorld(); } catch (e) { console.error('décor', e); }
    scene.add(bldGroup); scene.add(unitGroup); scene.add(fxGroup); scene.add(rangeGroup); scene.add(wallGroup);
    selMesh = new THREE.Mesh(geo('plane'), selMat); selMesh.visible = false; selMesh.renderOrder = 2; scene.add(selMesh);
    ghostMesh = new THREE.Mesh(geo('plane'), ghostOk); ghostMesh.visible = false; ghostMesh.renderOrder = 3; scene.add(ghostMesh);
    const zc = document.createElement('canvas'); zc.width = zc.height = GRID * 4;
    zoneTex = new THREE.CanvasTexture(zc); zoneTex.magFilter = THREE.NearestFilter; zoneTex.minFilter = THREE.NearestFilter;
    zoneMesh = new THREE.Mesh(geo('plane'), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false }));
    zoneMesh.scale.set(GRID, 1, GRID); zoneMesh.position.y = 0.02; zoneMesh.visible = false; zoneMesh.renderOrder = 1; scene.add(zoneMesh);
    gridMesh = new THREE.GridHelper(GRID - 2 * EDGE, GRID - 2 * EDGE, 0xffffff, 0xffffff);
    gridMesh.material.transparent = true; gridMesh.material.opacity = 0.22; gridMesh.position.y = 0.015; gridMesh.visible = false; scene.add(gridMesh);
    setupControls();
    resize(); window.addEventListener('resize', resize);
    setMood('warm');
    ok = true;
    requestAnimationFrame(loop);
    return true;
  }
  function resize() {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h; frustum();
  }
  function frustum() {
    const v = cam.view;
    camera.left = -v * aspect / 2; camera.right = v * aspect / 2; camera.top = v / 2; camera.bottom = -v / 2;
    camera.updateProjectionMatrix();
  }

  /* ---------- caméra isométrique et gestes ---------- */
  const ptrs = new Map(); let gest = null;
  let mapPt = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  const defaultMap = mapPt;
  function setPointerMap(f) { mapPt = f || defaultMap; }
  const VMIN = 7, VMAX = 42;
  const clampT = v => Math.max(-half - 2, Math.min(half + 2, v));
  function panBy(dx, dy) {
    const k = cam.view / (canvas.clientHeight || 1), sv = k / Math.sin(PITCH);
    const rx = Math.cos(YAW), rz = -Math.sin(YAW), ux = -Math.sin(YAW), uz = -Math.cos(YAW);
    cam.tx = clampT(cam.tx - rx * dx * k + ux * dy * sv);
    cam.tz = clampT(cam.tz - rz * dx * k + uz * dy * sv);
  }
  function setupControls() {
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      const [x, y] = mapPt(e.clientX, e.clientY);
      ptrs.set(e.pointerId, { x, y });
      if (ptrs.size === 1) gest = { k: 'one', x0: x, y0: y, lx: x, ly: y, t0: performance.now(), moved: false };
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        gest = { k: 'two', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, v0: cam.view, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true };
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const [x, y] = mapPt(e.clientX, e.clientY);
      ptrs.set(e.pointerId, { x, y });
      if (!gest) return;
      if (gest.k === 'one' && ptrs.size === 1) {
        if (!gest.moved && Math.hypot(x - gest.x0, y - gest.y0) > 8) gest.moved = true;
        if (gest.moved) { panBy(x - gest.lx, y - gest.ly); gest.lx = x; gest.ly = y; }
      } else if (gest.k === 'two' && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.view = Math.max(VMIN, Math.min(VMAX, gest.v0 * gest.d0 / d)); frustum();
        panBy(mx - gest.mx, my - gest.my); gest.mx = mx; gest.my = my;
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (gest && gest.k === 'one' && !gest.moved && performance.now() - gest.t0 < 600 && tapHook) tapHook(e.clientX, e.clientY);
      if (ptrs.size === 0) gest = null;
      else if (gest && gest.k === 'two') { const [a] = [...ptrs.values()]; gest = { k: 'one', x0: a.x, y0: a.y, lx: a.x, ly: a.y, t0: 0, moved: true }; }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.view = Math.max(VMIN, Math.min(VMAX, cam.view * (1 + e.deltaY * 0.0012))); frustum(); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  function updateCamera(dt) {
    const cp = Math.cos(PITCH), D = 70;
    let ox = 0, oz = 0;
    if (shakeT > 0) { shakeT = Math.max(0, shakeT - (dt || 0)); const a = shakeA * shakeT / 0.35; ox = (Math.random() - 0.5) * a; oz = (Math.random() - 0.5) * a; }
    camera.position.set(cam.tx + ox + D * cp * Math.sin(YAW), D * Math.sin(PITCH), cam.tz + oz + D * cp * Math.cos(YAW));
    camera.lookAt(cam.tx + ox, 0, cam.tz + oz);
  }
  function shake(a) { shakeA = Math.max(shakeT > 0 ? shakeA : 0, a); shakeT = 0.35; }
  function resetCamera(view) { cam.tx = 0; cam.tz = 0; cam.view = view || (aspect < 0.8 ? 28 : aspect > 1.6 ? 15 : 19); if (camera) frustum(); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function setRay(cx, cy) { const [lx, ly] = mapPt(cx, cy), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; ndc.set(lx / w * 2 - 1, -(ly / h) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pickGround(cx, cy) { setRay(cx, cy); if (!ray.ray.intersectPlane(plane, hit)) return null; return [hit.x + half, hit.z + half]; }
  function pickBuilding(cx, cy) {
    setRay(cx, cy);
    const hits = ray.intersectObjects(bldGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && o.parent !== bldGroup) o = o.parent; if (o && o.userData.key != null) return o.userData.key; }
    const g = pickGround(cx, cy);
    if (g) { const w = wallAt.get(Math.floor(g[0]) + ',' + Math.floor(g[1])); if (w) return w.key; }
    return null;
  }

  /* ---------- bâtiments affichés ---------- */
  /* Modèles provisoires (en attendant ceux générés avec Meshy) et équivalents dessinés par le code. */
  const B_MODEL = { halle: 'castle', taverne: 'tavern', bucheron: 'lumbermill', carriere: 'mine', moulin: 'windmill', boulangerie: 'market', entrepot: 'barracks' };
  const V1_PROC = { halle: 'mairie', taverne: 'camp', bucheron: 'scierie', carriere: 'carriere', moulin: 'ferme', entrepot: 'entrepot', boulangerie: 'caserne' };
  const SMOKE = ['halle', 'taverne', 'bucheron', 'boulangerie'];
  const TEAM = { '#D27A22': 2, '#2F8A63': 3, '#4A78C2': 0, '#B24F78': 2, '#8A67C6': 0 };
  const MODEL_RY = Math.PI / 4;
  const protos = new Map();
  function remapUV(g, k) {
    const uv = g.attributes.uv; if (!uv) return;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < 0.125 && v >= 0.75) uv.setX(i, u + 0.125 * k); }
    uv.needsUpdate = true;
  }
  function proto(name, team, orc) {
    const key = name + '|' + team + '|' + (orc ? 1 : 0);
    if (protos.has(key)) return protos.get(key);
    const m2 = name.indexOf('m2:') === 0;
    const src = m2 ? LIB.m2[name.slice(3)] : LIB.b[name]; if (!src) return null;
    if (m2) team = 0;
    const root = src.scene.clone(true);
    const tint = new THREE.Color(0.66, 0.56, 0.52);
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (team) { o.geometry = o.geometry.clone(); remapUV(o.geometry, team); }
      if (orc) { o.material = o.material.clone(); o.material.color.multiply(tint); }
    });
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    const wrap = new THREE.Group(); wrap.add(root); wrap.userData.size = size;
    protos.set(key, wrap);
    return wrap;
  }
  function modelInst(name, team, orc, foot, ry) {
    const p = proto(name, team, orc); if (!p) return null;
    const o = p.clone(true), sz = p.userData.size, k = foot / Math.max(sz.x, sz.z, 0.01);
    o.scale.setScalar(k); o.rotation.y = ry || 0; o.userData.h = sz.y * k;
    return o;
  }
  function sigOf(it) { return [it.type, it.lvl, it.gx, it.gz, it.up ? 1 : 0, it.dead ? 1 : 0, it.col, it.orc ? 1 : 0, it.id || 0, LIB.ver].join('|'); }
  function placeGroup(g, it) { const s = BLD[it.type].size; g.position.set(it.gx + s / 2 - half, 0, it.gz + s / 2 - half); }
  function makeGlow(color, size, y) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    s.scale.set(size, size, 1); s.position.y = y; s.renderOrder = 5;
    return s;
  }
  /* ---------- bâtiments dessinés par le code : maisons, pavillon de chasse, champs, décorations ---------- */
  const ROOFS = [0x8e3b2d, 0x6b4a2e, 0x7a6a4a, 0x5d4a3a, 0x8a5a2a, 0x46576a];
  const rotXZ = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  function houseG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), R = mulberry32((it.id || 1) * 7919 + 3);
    const roofC = ROOFS[Math.floor(R() * ROOFS.length)], wallC = R() < 0.5 ? 0xe8dcc0 : 0xd8c6a0, ry = R() < 0.5 ? 0 : Math.PI / 2;
    const b = new THREE.Group(); b.rotation.y = ry; g.add(b);
    const H = 0.72 + 0.32 * (lv - 1), y0 = 0.14;
    b.add(P('box', 0x8a8378, 1.62, y0, 1.32, 0, 0, 0));
    b.add(P('box', wallC, 1.45, H, 1.15, 0, y0, 0));
    for (const x of [-0.7, 0, 0.7]) b.add(P('box', 0x5f4127, 0.06, H, 0.04, x, y0, 0.585, 0, true));
    b.add(P('box', 0x5f4127, 1.46, 0.06, 0.04, 0, y0 + H * 0.55, 0.585, 0, true));
    b.add(P('prism', roofC, 1.72, 0.78, 1.44, 0, y0 + H, 0));
    b.add(P('box', 0x3e2716, 0.28, 0.46, 0.04, 0.32, y0, 0.6, 0, true));
    b.add(P('box', winMat, 0.2, 0.2, 0.04, -0.36, y0 + H * 0.42, 0.6, 0, true));
    b.add(P('box', winMat, 0.2, 0.2, 0.04, 0.36, y0 + H * 0.42, -0.6, 0, true));
    b.add(P('box', 0x7d858b, 0.2, 0.62, 0.2, -0.45, y0 + H + 0.12, -0.3));
    if (lv >= 2) { b.add(P('box', wallC, 0.62, 0.62, 0.62, 0.9, y0, -0.22)); b.add(P('prism', roofC, 0.76, 0.42, 0.72, 0.9, y0 + 0.62, -0.22)); }
    if (lv >= 3) b.add(P('box', 0x9b7a54, 0.5, 0.08, 0.32, -0.4, y0 + H * 0.55, 0.72, 0, true));
    const [ex, ez] = rotXZ(-0.45, -0.3, ry);
    return { g, info: { top: y0 + H + 0.8, muzzle: 1, emit: [[ex, y0 + H + 0.8, ez]] } };
  }
  function lodgeG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl);
    g.add(P('box', 0x6b5a44, 1.62, 0.12, 1.4, 0, 0, 0));
    for (let i = 0; i < 6; i++) g.add(logX(1.42, 0.16, 0.71, 0.2 + i * 0.15, 0.55, 0x5f4127));
    g.add(P('box', 0x5f4127, 1.3, 0.9, 1.0, 0, 0.12, -0.05));
    g.add(P('prism', 0xb8914a, 1.75, 0.7 + 0.08 * lv, 1.5, 0, 1.02, -0.05));
    g.add(P('box', 0x2e1f12, 0.3, 0.5, 0.04, 0, 0.12, 0.62, 0, true));
    for (const sx of [-1, 1]) { g.add(piv(sx * 0.12, 1.0, 0.64, [P('box', 0xe8dcc0, 0.04, 0.32, 0.04, 0, 0, 0, 0, true), P('box', 0xe8dcc0, 0.03, 0.16, 0.03, sx * 0.06, 0.18, 0, 0, true)], 0, 0, sx * 0.5)); }
    for (const x of [-0.95, -0.35]) g.add(P('box', 0x5f4127, 0.06, 0.9, 0.06, x, 0, 0.95, 0, true));
    g.add(P('box', 0x5f4127, 0.66, 0.05, 0.05, -0.65, 0.88, 0.95, 0, true));
    g.add(P('box', 0x8a5a36, 0.5, 0.55, 0.03, -0.65, 0.32, 0.95, 0, true));
    return { g, info: { top: 1.9, muzzle: 1, emit: [[0.45, 1.75, -0.3]] } };
  }
  function fieldG(it) {
    const g = new THREE.Group(), s = BLD[it.type].size, e = s / 2 - 0.04;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(P('box', 0x7a5c3a, 0.08, 0.38, 0.08, sx * e, 0, sz * e, 0, true));
    for (const sz of [-1, 1]) g.add(P('box', 0x8b6a45, s - 0.1, 0.04, 0.04, 0, 0.26, sz * e, 0, true));
    g.add(P('box', 0x8b6a45, 0.04, 0.04, s - 0.1, -e, 0.26, 0, 0, true));
    g.add(P('box', 0x6b4a2e, 0.05, 0.8, 0.05, e - 0.35, 0, e - 0.35, 0, true));
    g.add(P('box', 0x6b4a2e, 0.5, 0.05, 0.05, e - 0.35, 0.55, e - 0.35, 0.6, true));
    g.add(P('sph', 0xd8c49a, 0.16, 0.16, 0.16, e - 0.35, 0.78, e - 0.35, 0, true));
    g.add(P('cone6', 0x8a6a3a, 0.24, 0.12, 0.24, e - 0.35, 0.86, e - 0.35, 0, true));
    return { g, info: { top: 0.9, muzzle: 0.5, emit: [] } };
  }
  function benchG() {
    const g = new THREE.Group();
    g.add(P('box', 0x9b7a54, 0.7, 0.06, 0.24, 0, 0.24, 0)); g.add(P('box', 0x9b7a54, 0.7, 0.2, 0.05, 0, 0.3, -0.11));
    for (const x of [-0.28, 0.28]) g.add(P('box', 0x5f4127, 0.06, 0.24, 0.2, x, 0, 0, 0, true));
    return { g, info: { top: 0.6, muzzle: 0.4, emit: [] } };
  }
  function flowersG(it) {
    const g = new THREE.Group(), R = mulberry32((it.id || 1) * 131);
    g.add(P('box', 0x6b4a2e, 0.82, 0.12, 0.82, 0, 0, 0)); g.add(P('box', 0x5a4028, 0.7, 0.13, 0.7, 0, 0, 0, 0, true));
    const cols = [0xd8483a, 0xf2c94c, 0x9b6fd0, 0xf4f1ea, 0xe87fb0];
    for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 0.22 + (R() - 0.5) * 0.06, z = (Math.floor(i / 3) - 1) * 0.22 + (R() - 0.5) * 0.06; g.add(P('cyl6', 0x4f7f2e, 0.03, 0.18, 0.03, x, 0.12, z, 0, true)); g.add(P('sph', cols[Math.floor(R() * cols.length)], 0.12, 0.09, 0.12, x, 0.28, z, 0, true)); }
    return { g, info: { top: 0.5, muzzle: 0.3, emit: [] } };
  }
  function fountainG() {
    const g = new THREE.Group();
    g.add(P('cyl12', 0x9a968c, 1.7, 0.36, 1.7, 0, 0, 0)); g.add(P('cyl12', 0x7d858b, 1.5, 0.37, 1.5, 0, 0.01, 0, 0, true));
    const w = P('cyl12', new THREE.MeshStandardMaterial({ color: lin(0x3f8fb4), roughness: 0.15, metalness: 0.05, envMapIntensity: 1.2 }), 1.42, 0.04, 1.42, 0, 0.3, 0, 0, true); g.add(w);
    g.add(P('cyl8', 0xb6b2a8, 0.24, 0.9, 0.24, 0, 0.3, 0)); g.add(P('cyl12', 0xb6b2a8, 0.62, 0.12, 0.62, 0, 1.1, 0)); g.add(P('cyl12', 0x3f8fb4, 0.52, 0.03, 0.52, 0, 1.2, 0, 0, true));
    return { g, info: { top: 1.4, muzzle: 1, emit: [] } };
  }
  function statueG() {
    const g = new THREE.Group(), st = 0xb6b2a8;
    g.add(P('box', 0x8a8378, 0.66, 0.42, 0.66, 0, 0, 0)); g.add(P('box', 0xc9922e, 0.68, 0.05, 0.68, 0, 0.42, 0, 0, true));
    g.add(P('cyl8', st, 0.3, 0.55, 0.26, 0, 0.47, 0)); g.add(P('sph', st, 0.2, 0.2, 0.2, 0, 1.06, 0));
    g.add(piv(0.16, 0.92, 0, [P('box', st, 0.08, 0.45, 0.08, 0, 0, 0)], 0, 0, -0.5));
    g.add(piv(0.36, 1.2, 0, [P('box', 0xc9d0d6, 0.05, 0.5, 0.05, 0, 0, 0, 0, true)], 0, 0, -0.2));
    return { g, info: { top: 1.6, muzzle: 1, emit: [] } };
  }
  /* Brasserie : maison à colombages, cuve de cuivre sous un auvent, tonneaux et enseigne (en attendant son modèle Meshy). */
  function brasserieG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), y0 = 0.14, H = 0.78 + 0.22 * (lv - 1);
    g.add(P('box', 0x8a8378, 1.72, y0, 1.5, 0, 0, 0));
    g.add(P('box', 0xe4d6b4, 1.12, H, 1.06, -0.24, y0, -0.16));
    for (const x of [-0.79, -0.24, 0.31]) g.add(P('box', 0x5f4127, 0.06, H, 0.04, x, y0, 0.38, 0, true));
    g.add(P('box', 0x5f4127, 1.13, 0.06, 0.04, -0.24, y0 + H * 0.55, 0.38, 0, true));
    g.add(P('prism', 0x8e3b2d, 1.34, 0.68, 1.28, -0.24, y0 + H, -0.16));
    g.add(P('box', 0x3e2716, 0.28, 0.46, 0.04, -0.42, y0, 0.4, 0, true));
    g.add(P('box', winMat, 0.2, 0.2, 0.04, 0.02, y0 + H * 0.3, 0.4, 0, true));
    g.add(P('box', 0x8a4a32, 0.22, 0.75, 0.22, -0.6, y0 + H + 0.05, -0.45));
    // auvent et cuve de cuivre
    for (const [x, z] of [[0.36, 0.62], [0.78, 0.62], [0.78, -0.05]]) g.add(P('box', 0x5f4127, 0.06, 0.78, 0.06, x, y0, z, 0, true));
    g.add(P('box', 0x9b6a3a, 0.56, 0.05, 0.82, 0.57, y0 + 0.78, 0.29, 0, true));
    g.add(P('cyl12', 0xb87333, 0.46, 0.36, 0.46, 0.56, y0, 0.3));
    g.add(P('sph', 0xc98a4a, 0.46, 0.26, 0.46, 0.56, y0 + 0.23, 0.3, 0, true));
    g.add(P('cyl8', 0xb87333, 0.06, 0.26, 0.06, 0.56, y0 + 0.44, 0.3, 0, true));
    // tonneaux et enseigne à la chope
    for (const [x, z, ry] of [[0.62, -0.45, 0], [0.32, -0.62, 0.6]]) g.add(P('cyl8', 0x7a5534, 0.3, 0.38, 0.3, x, y0, z, ry));
    g.add(P('box', 0x5f4127, 0.04, 0.04, 0.32, -0.83, y0 + H * 0.8, 0.5, 0, true));
    g.add(P('box', 0x9b7448, 0.04, 0.24, 0.22, -0.84, y0 + H * 0.8 - 0.26, 0.6, 0, true));
    g.add(P('cyl8', 0xd8a23a, 0.05, 0.1, 0.08, -0.87, y0 + H * 0.8 - 0.2, 0.6, 0, true));
    if (lv >= 2) g.add(P('cyl8', 0x7a5534, 0.3, 0.38, 0.3, 0.8, y0, -0.3));
    if (lv >= 3) { g.add(P('box', 0xe4d6b4, 0.5, 0.5, 0.5, -0.55, y0, 0.55)); g.add(P('prism', 0x8e3b2d, 0.62, 0.34, 0.6, -0.55, y0 + 0.5, 0.55)); }
    return { g, info: { top: y0 + H + 0.8, muzzle: 1, emit: [[-0.6, y0 + H + 0.85, -0.45]] } };
  }
  const PROC2 = { maison: houseG, chasse: lodgeG, champ: fieldG, banc: benchG, fleurs: flowersG, fontaine: fountainG, statue: statueG, brasserie: brasserieG };
  function build(it) {
    const s = BLD[it.type].size, g = new THREE.Group();
    let info = { top: 1.2, muzzle: 1, emit: [] };
    let glow = null;
    const team = TEAM[it.col] != null ? TEAM[it.col] : 0, foot = s * 0.98, small = s < 2 || it.type === 'champ';
    if (it.dead) { const m = LIB.ok && modelInst('destroyed', 0, false, foot * 0.92, MODEL_RY); if (m) g.add(m); else g.add(makeRubble(s)); info.top = 0.8; }
    else if (it.lvl <= 0) {
      const m = LIB.ok && s >= 2 && modelInst(LIB.m2.chantier ? 'm2:chantier' : 'scaffolding', 0, false, foot * (LIB.m2.chantier ? 0.95 : 0.85), MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h + 0.2; }
      else { g.add(P('box', 0xb39669, s - 0.2, 0.06, s - 0.2, 0, 0, 0, 0, true)); g.add(makeScaffold(s, s < 2 ? 0.5 : 1.0)); info.top = s < 2 ? 0.8 : 1.4; }
    } else if (PROC2[it.type] && !(LIB.ok && LIB.m2[it.type])) {
      const b = PROC2[it.type](it); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    } else if (LIB.ok && (LIB.m2[it.type] || B_MODEL[it.type])) {
      const m = modelInst(LIB.m2[it.type] ? 'm2:' + it.type : B_MODEL[it.type], team, false, foot * (1 + 0.035 * (Math.min(5, it.lvl) - 1)), MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h; info.muzzle = Math.max(0.8, info.top * 0.8); }
      if (SMOKE.includes(it.type) && !LIB.m2[it.type]) info.emit.push([0.15, info.top * 0.9, -0.15]);   // les modèles Meshy ont leur propre fumée (ou pas de cheminée)
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.6)));
    } else {
      const b = makeBld(V1_PROC[it.type] || 'entrepot', it.lvl, it.col || COLORS[0], false); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    }
    if (!it.dead && it.lvl > 0 && !small) { glow = makeGlow(0xffc070, s * 1.6, Math.min(1.4, info.top * 0.45)); g.add(glow); }
    g.userData.key = it.key;
    placeGroup(g, it);
    const rec = { g, sig: sigOf(it), item: it, info, bar: null, hp: null, glow, ph: Math.random() * 6, burnT: 0 };
    if (it.up) { rec.bar = makeBar(Math.min(1.2, s * 0.6), 0xf0a548); rec.bar.position.set(0, info.top + 0.5, 0); g.add(rec.bar); }
    return rec;
  }
  function setBuildings(items) {
    const seen = new Set(), walls = [];
    const fresh = blds.size === 0 && wallAt.size === 0;
    for (const it of items) {
      if (it.type === 'rempart') { walls.push(it); continue; }
      seen.add(it.key);
      const old = blds.get(it.key), sig = sigOf(it);
      if (old && old.sig === sig) { old.item = it; continue; }
      if (old) { bldGroup.remove(old.g); pruneAnims(old.g); }
      const rec = build(it); blds.set(it.key, rec); bldGroup.add(rec.g);
      if (!fresh && !it.dead && it.key !== 'ghost' && (!old || old.item.lvl !== it.lvl || old.item.gx !== it.gx || old.item.gz !== it.gz || !!old.item.up !== !!it.up)) {
        anims.push({ k: 'pop', o: rec.g, t: 0 });
        const s = BLD[it.type].size;
        dustRing(it.gx + s / 2, it.gz + s / 2, s * 0.6);
      }
    }
    for (const [k, rec] of blds) if (!seen.has(k)) { bldGroup.remove(rec.g); pruneAnims(rec.g); blds.delete(k); }
    setWalls(walls, fresh);
    scheduleGround(items);
  }

  /* ---------- remparts : dessinés en série (instances), reliés à leurs voisins ---------- */
  const wallAt = new Map(), wallBars = new Map();
  let wallSig = '';
  const WS = {
    d1: { post: ['cyl8', 0x8b6a45, 0.34, 0.95], cap: ['cone6', 0xa98353, 0.36, 0.3], link: [0x7a5c3a, 0.16, 0.74] },
    d2: { post: ['box', 0x8e8a80, 0.56, 0.85], cap: ['box', 0x6f767c, 0.64, 0.1], link: [0x9a958a, 0.42, 0.68] },
    d3: { post: ['box', 0xb8b3a8, 0.6, 1.0], cap: ['box', 0x7d858b, 0.68, 0.12], link: [0xaaa69b, 0.44, 0.82] },
    d4: { post: ['box', 0x6f767c, 0.64, 1.12], cap: ['box', 0x4d5966, 0.72, 0.12], band: [0xc9922e, 0.66, 0.07, 0.78], link: [0x7d858b, 0.46, 0.92] },
    d5: { post: ['box', 0x4d5966, 0.66, 1.25], cap: ['box', 0x3c4552, 0.74, 0.13], band: [0x7fe0ff, 0.68, 0.07, 0.86, true], link: [0x56626f, 0.48, 1.02] },
  };
  for (let l = 1; l <= 5; l++) WS['o' + l] = { post: ['cyl6', 0x4a3424, 0.3, 0.95 + 0.07 * l], cap: ['cone6', l >= 4 ? 0xe6dcc0 : 0x6b4a2b, 0.32, 0.34], band: l >= 3 ? [0x6e5a48, 0.33, 0.07, 0.6] : null, link: [0x34241a, 0.16, 0.72 + 0.06 * l] };
  function setWalls(items, fresh) {
    const live = items.filter(w => !w.dead), dead = items.filter(w => w.dead);
    const sig = items.map(w => w.gx + ',' + w.gz + ',' + w.lvl + (w.orc ? 'o' : '') + (w.dead ? 'x' : '')).join(';');
    const prev = new Set(wallAt.keys());
    wallAt.clear();
    for (const w of items) if (!w.dead) wallAt.set(w.gx + ',' + w.gz, w);
    if (sig === wallSig) return;
    wallSig = sig;
    if (!fresh && prev.size) { let n = 0; for (const w of live) if (!prev.has(w.gx + ',' + w.gz) && n++ < 12) dustRing(w.gx + 0.5, w.gz + 0.5, 0.4); }
    while (wallGroup.children.length) { const c = wallGroup.children[0]; wallGroup.remove(c); if (c.dispose) c.dispose(); }
    for (const [k, bar] of wallBars) { if (!wallAt.has(k.split('|')[1])) { fxGroup.remove(bar); wallBars.delete(k); } }
    const sets = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const push = (key, k, color, basicM, x, y, z, sx, sy, sz, ry) => {
      const id = key + '|' + k + '|' + color;
      if (!sets.has(id)) sets.set(id, { k, color, basicM, mats: [] });
      q.setFromAxisAngle(up, ry || 0); ps.set(x, y, z); sc.set(sx, sy, sz);
      sets.get(id).mats.push(m4.clone().compose(ps, q, sc));
    };
    const styleOf = w => WS[(w.orc ? 'o' : 'd') + Math.max(1, Math.min(5, w.lvl | 0))];
    const isW = (x, z) => wallAt.has(x + ',' + z);
    for (const w of live) {
      const st = styleOf(w), X = w.gx + 0.5 - half, Z = w.gz + 0.5 - half, key = (w.orc ? 'o' : 'd') + w.lvl;
      const [pk, pc, pw, ph] = st.post;
      push(key, pk, pc, false, X, 0, Z, pw, ph, pw);
      const [ck, cc, cw, chh] = st.cap; push(key, ck, cc, false, X, ph, Z, cw, chh, cw);
      if (st.band) { const [bc, bw, bh, by, glow] = st.band; push(key, 'box', bc, !!glow, X, by, Z, bw, bh, bw); }
      const link = (o, cx, cz, len, ry) => { const lw = o.lvl < w.lvl ? o : w, ls = styleOf(lw), [lc, lwid, lh] = ls.link; push((lw.orc ? 'o' : 'd') + lw.lvl, 'box', lc, false, cx, 0, cz, len, lh, lwid, ry); };
      const E = wallAt.get((w.gx + 1) + ',' + w.gz), S = wallAt.get(w.gx + ',' + (w.gz + 1));
      if (E) link(E, X + 0.5, Z, 1, 0);
      if (S) link(S, X, Z + 0.5, 1, Math.PI / 2);
      const SE = wallAt.get((w.gx + 1) + ',' + (w.gz + 1)), SW = wallAt.get((w.gx - 1) + ',' + (w.gz + 1));
      if (SE && !isW(w.gx + 1, w.gz) && !isW(w.gx, w.gz + 1)) link(SE, X + 0.5, Z + 0.5, Math.SQRT2, -Math.PI / 4);
      if (SW && !isW(w.gx - 1, w.gz) && !isW(w.gx, w.gz + 1)) link(SW, X - 0.5, Z + 0.5, Math.SQRT2, Math.PI / 4);
    }
    for (const w of dead) {
      const X = w.gx + 0.5 - half, Z = w.gz + 0.5 - half, c = w.orc ? 0x3a2a1e : 0x6b6258, r = ((w.gx * 7 + w.gz * 13) % 10) / 10;
      push('rb', 'dode', c, false, X - 0.15, 0, Z + 0.1, 0.42, 0.18, 0.36, r * 3);
      push('rb', 'dode', c, false, X + 0.18, 0, Z - 0.12, 0.3, 0.14, 0.3, r * 5);
    }
    for (const [, S] of sets) {
      const im = new THREE.InstancedMesh(geo(S.k), S.basicM ? basic(S.color) : mat(S.color), S.mats.length);
      S.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = !S.basicM; im.receiveShadow = true;
      wallGroup.add(im);
    }
  }
  function wallBar(key, frac) {
    let w = null; for (const it of wallAt.values()) if (it.key === key) { w = it; break; }
    const id = 'b|' + (w ? w.gx + ',' + w.gz : key);
    let bar = wallBars.get(id);
    if (!w || frac >= 0.999 || frac <= 0) { if (bar) { fxGroup.remove(bar); wallBars.delete(id); } return; }
    if (!bar) { bar = makeBar(0.7, 0x5fd17a); bar.position.set(w.gx + 0.5 - half, 1.6, w.gz + 0.5 - half); fxGroup.add(bar); wallBars.set(id, bar); }
    setBar(bar, frac);
  }
  function pruneAnims(g) { anims = anims.filter(a => { let o = a.o; while (o) { if (o === g) return false; o = o.parent; } return true; }); }
  function clearBuildings() { setBuildings([]); }
  function setBldHp(key, frac) {
    const rec = blds.get(key); if (!rec) { wallBar(key, frac); return; }
    rec.burn = frac > 0 && frac < 0.55;
    if (frac >= 0.999 || frac <= 0) { if (rec.hp) rec.hp.visible = false; return; }
    if (!rec.hp) { rec.hp = makeBar(1.1, 0x5fd17a); rec.hp.position.set(0, rec.info.top + 0.3, 0); rec.g.add(rec.hp); }
    rec.hp.visible = true; setBar(rec.hp, frac);
    rec.hp.userData.fg.material.color.copy(lin(frac > 0.5 ? 0x5fd17a : frac > 0.25 ? 0xf0b040 : 0xe8584a));
  }
  function bldInfo(key) { const r = blds.get(key); return r ? r.info : null; }
  function aimAt(key, x, z) {
    const r = blds.get(key); if (!r || !r.info.aim) return;
    const p = r.g.position, ang = Math.atan2(x - half - p.x, z - half - p.z);
    r.info.aim.rotation.y = ang;
    if (r.info.arm) anims.push({ k: 'throw', o: r.info.arm, t: 0 });
  }
  function select(it) {
    if (!it) { selMesh.visible = false; return; }
    const s = BLD[it.type].size; selMesh.visible = true; selMesh.scale.set(s + 0.3, 1, s + 0.3);
    selMesh.position.set(it.gx + s / 2 - half, 0.02, it.gz + s / 2 - half);
  }
  function ghost(type, gx, gz, valid) {
    if (!type) { ghostMesh.visible = false; gridMesh.visible = false; return; }
    const s = BLD[type].size; ghostMesh.visible = true; gridMesh.visible = true;
    ghostMesh.material = valid ? ghostOk : ghostBad;
    ghostMesh.scale.set(s, 1, s); ghostMesh.position.set(gx + s / 2 - half, 0.03, gz + s / 2 - half);
  }
  function focus(gx, gz) { cam.tx = clampT(gx - half); cam.tz = clampT(gz - half); }
  const projV = new THREE.Vector3();
  function panOf(x, z) { if (!camera) return 0; projV.set(x - half, 0.5, z - half).project(camera); return Math.max(-1, Math.min(1, projV.x)); }
  function toScreen(x, z) { projV.set(x - half, 0, z - half).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (projV.x + 1) / 2 * r.width, r.top + (1 - projV.y) / 2 * r.height]; }
  function showZone(B) {
    if (!B) { zoneMesh.visible = false; return; }
    const c = zoneTex.image, x = c.getContext('2d'), k = c.width / GRID;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(220,60,50,0.32)';
    for (let i = 0; i < c.width; i++) for (let j = 0; j < c.height; j++) { if (!canDeploy(B, (i + 0.5) / k, (j + 0.5) / k)) x.fillRect(i, j, 1, 1); }
    zoneTex.needsUpdate = true; zoneMesh.visible = true;
  }  function showRanges(list) {
    while (rangeGroup.children.length) { const c = rangeGroup.children[0]; rangeGroup.remove(c); c.geometry.dispose(); }
    if (!list) return;
    for (const d of list) {
      const rg = new THREE.RingGeometry(Math.max(0.01, d.r - 0.1), d.r, 56); rg.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(rg, ringMat); ring.position.set(d.x - half, 0.035, d.z - half); ring.renderOrder = 3; rangeGroup.add(ring);
      const fg = new THREE.CircleGeometry(d.r, 56); fg.rotateX(-Math.PI / 2);
      const fill = new THREE.Mesh(fg, ringFill); fill.position.set(d.x - half, 0.03, d.z - half); fill.renderOrder = 2; rangeGroup.add(fill);
    }
  }


  /* ---------- unités : nains et orques ---------- */
  const BEARDS = [0xb5642c, 0x6b4423, 0xa8a8a0, 0xd2b06a, 0x3a2a1e];
  function makeUnit(type, col, orc, id) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    let barY = 1.0;
    if (type === 'belier' && !orc) {
      body.add(P('box', 0x7a5534, 0.5, 0.26, 0.9, 0, 0.12, 0));
      body.add(P('prism', 0x5a3d22, 0.95, 0.3, 0.6, 0, 0.38, 0, Math.PI / 2));
      body.add(P('box', col, 0.52, 0.06, 0.32, 0, 0.36, -0.15, 0, true));
      body.add(logZ(0.55, 0.16, 0, 0.26, 0.42, 0x8b6a45));
      body.add(P('box', DW.metal, 0.22, 0.22, 0.12, 0, 0.15, 0.95));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.add(piv(sx * 0.28, 0.11, sz * 0.3, [P('cyl8', 0x3a2a1e, 0.22, 0.06, 0.22, 0, -0.03, 0, 0, true)], 0, 0, Math.PI / 2));
      barY = 0.95;
    } else if (type === 'belier') {
      body.add(P('cyl8', 0x5c6e4c, 0.16, 0.38, 0.16, -0.17, 0, 0)); body.add(P('cyl8', 0x5c6e4c, 0.16, 0.38, 0.16, 0.17, 0, 0));
      body.add(P('sph', 0x7d8f6a, 0.75, 0.8, 0.6, 0, 0.3, 0));
      body.add(P('box', OR.hideD, 0.62, 0.16, 0.5, 0, 0.36, 0, 0, true));
      body.add(P('sph', 0x7d8f6a, 0.3, 0.28, 0.3, 0, 1.0, 0.12));
      for (const x of [-0.06, 0.06]) body.add(P('box', OR.bone, 0.03, 0.08, 0.03, x, 1.0, 0.26, 0, true));
      body.add(P('cyl8', 0x6c7e5a, 0.15, 0.62, 0.15, -0.42, 0.3, 0.05)); body.add(P('cyl8', 0x6c7e5a, 0.15, 0.62, 0.15, 0.42, 0.3, 0.05));
      body.add(piv(0.45, 0.35, 0.2, [P('cyl8', OR.woodD, 0.16, 0.75, 0.16, 0, 0, 0, 0, true)], 0.9));
      body.scale.setScalar(1.25); barY = 1.75;
    } else if (HEROES[type]) {
      const hc = HERO_GLOW[type];
      body.add(P('box', 0x3a2a20, 0.22, 0.1, 0.15, 0, 0, 0, 0, true));
      body.add(P('cyl8', hc, 0.36, 0.3, 0.36, 0, 0.08, 0));
      body.add(P('sph', C.skin, 0.22, 0.22, 0.22, 0, 0.36, 0, 0, true));
      body.add(piv(0, 0.46, 0.07, [P('cone6', BEARDS[(id || 0) % BEARDS.length], 0.24, 0.3, 0.16, 0, 0, 0, 0, true)], Math.PI));
      body.add(P('cone6', 0xd9b54c, 0.26, 0.16, 0.26, 0, 0.47, 0, 0, true));
      body.scale.setScalar(1.7); barY = 1.25;
    } else if (!orc) {
      body.add(P('box', 0x3a2a20, 0.2, 0.1, 0.13, 0, 0, 0, 0, true));
      body.add(P('cyl8', col, 0.31, 0.26, 0.31, 0, 0.08, 0));
      body.add(P('box', 0x3a2a1e, 0.32, 0.04, 0.32, 0, 0.17, 0, 0, true));
      body.add(P('sph', C.skin, 0.2, 0.2, 0.2, 0, 0.32, 0, 0, true));
      body.add(piv(0, 0.42, 0.06, [P('cone6', BEARDS[(id || 0) % BEARDS.length], 0.21, 0.27, 0.14, 0, 0, 0, 0, true)], Math.PI));
      body.add(P('sph', DW.metal, 0.23, 0.13, 0.23, 0, 0.42, 0, 0, true));
      body.add(P('box', DW.metal, 0.03, 0.09, 0.03, 0, 0.36, 0.11, 0, true));
      if (type === 'fantassin') {
        body.add(P('box', DW.woodD, 0.03, 0.34, 0.03, 0.19, 0.06, 0.06, 0, true));
        body.add(P('box', DW.metal, 0.15, 0.11, 0.03, 0.23, 0.33, 0.06, 0, true));
      } else {
        body.add(P('box', DW.wood, 0.05, 0.05, 0.32, 0.12, 0.2, 0.14, 0, true));
        body.add(P('box', DW.metal, 0.3, 0.03, 0.03, 0.12, 0.22, 0.29, 0, true));
      }
      body.scale.setScalar(1.4);
    } else {
      body.add(P('box', 0x2e241a, 0.16, 0.14, 0.12, 0, 0, 0, 0, true));
      body.add(P('cyl8', 0x5a3d2a, 0.26, 0.34, 0.26, 0, 0.12, 0));
      body.add(P('box', OR.cloth, 0.27, 0.06, 0.27, 0, 0.32, 0, 0, true));
      body.add(P('sph', OR.skin, 0.21, 0.21, 0.21, 0, 0.45, 0, 0, true));
      for (const x of [-0.05, 0.05]) body.add(P('box', OR.bone, 0.025, 0.06, 0.025, x, 0.45, 0.1, 0, true));
      if (type === 'fantassin') body.add(P('box', OR.metal, 0.04, 0.32, 0.12, 0.18, 0.1, 0.08, 0, true));
      else { body.add(P('cone6', 0x3a3a2a, 0.23, 0.2, 0.23, 0, 0.55, 0, 0, true)); body.add(P('box', OR.woodD, 0.03, 0.42, 0.03, 0.17, 0.08, 0.06, 0, true)); }
      body.scale.setScalar(1.4); barY = 1.12;
    }
    const ring = new THREE.Mesh(geo('plane'), basic(orc ? 0xb8402e : col, { transparent: true, opacity: 0.55, depthWrite: false }));
    ring.scale.set(type === 'belier' ? 1.3 : 0.62, 1, type === 'belier' ? 1.3 : 0.62); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
    g.scale.setScalar(1.3);
    const bar = makeBar(0.5, 0x5fd17a); bar.position.y = barY; bar.visible = false; g.add(bar);
    g.userData = { body, bar };
    return g;
  }
  /* ---------- habitants : les villageois vont travailler, les héros se promènent ---------- */
  const people = new Map(), lifeGroup = new THREE.Group();
  let vilBlocked = null, vilSpots = [], bldSpots = new Map(), bldCenters = new Map();
  function planVillage(items) {
    const blds = items.filter(it => it.type !== 'rempart' && it.key !== 'ghost' && !it.dead);
    vilBlocked = new Uint8Array(GRID * GRID); vilSpots = []; bldSpots = new Map(); bldCenters = new Map();
    for (const b of items) { if (b.key === 'ghost') continue; const sz = BLD[b.type].size; for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) { const x = b.gx + i, z = b.gz + j; if (x >= 0 && z >= 0 && x < GRID && z < GRID) vilBlocked[z * GRID + x] = 1; } }
    for (const b of blds) {
      const sz = BLD[b.type].size, seen = new Set(), cands = [];
      for (let i = -1; i <= sz; i++) for (const [x, z] of [[b.gx + i, b.gz + sz], [b.gx + sz, b.gz + i], [b.gx + i, b.gz - 1], [b.gx - 1, b.gz + i]]) {
        const k = x + ',' + z;
        if (x >= 0 && z >= 0 && x < GRID && z < GRID && !vilBlocked[z * GRID + x] && !seen.has(k)) { seen.add(k); cands.push([x, z]); }
      }
      bldSpots.set(b.key, cands); bldCenters.set(b.key, [b.gx + sz / 2, b.gz + sz / 2]);
      if (cands.length && sz >= 2) vilSpots.push(cands[Math.floor(hash2(b.gx * 13, b.gz * 7) * cands.length)]);
    }
    for (const [, r] of people) { r.path = []; if (vilBlocked[Math.floor(r.z) * GRID + Math.floor(r.x)]) { const sp = vilSpots[Math.floor(Math.random() * vilSpots.length)]; if (sp) { r.x = sp[0] + 0.5; r.z = sp[1] + 0.5; } } }
  }
  function findPath(x0, z0, x1, z1) {
    const N = GRID * GRID, prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N), q = [z0 * GRID + x0], goal = z1 * GRID + x1;
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === goal) break;
      const x = i % GRID, z = (i / GRID) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz, ni = nz * GRID + nx; if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID || seen[ni] || vilBlocked[ni]) continue; seen[ni] = 1; prev[ni] = i; q.push(ni); }
    }
    if (!seen[goal]) return [];
    const out = []; for (let i = goal; i !== -1 && i !== z0 * GRID + x0; i = prev[i]) out.push([(i % GRID) + 0.5 + (Math.random() - 0.5) * 0.4, ((i / GRID) | 0) + 0.5 + (Math.random() - 0.5) * 0.4]);
    return out.reverse();
  }
  /* Apparence : la race donne le modèle, le métier ou la classe donne l'équipement. */
  const P_DEF = { humain: { m: 'knight', h: 1.06, w: 1.0 }, nain: { m: 'barbarian', h: 0.9, w: 1.3 }, elfe: { m: 'rogue', h: 1.12, w: 0.9 } };
  const JOB_GEAR = { bucheron: ['1H_Axe'], carriere: ['2H_Axe'], champ: [], chasse: ['1H_Crossbow'], moulin: ['Mug'], boulangerie: ['Mug'], brasserie: ['Mug'], bat: ['1H_Axe'] };
  const JOB_WORK = { bucheron: '1H_Melee_Attack_Chop', carriere: '2H_Melee_Attack_Chop', bat: '1H_Melee_Attack_Chop', chasse: '2H_Ranged_Shoot' };
  const HERO_GEAR = {
    guerrier: { humain: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], nain: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat', 'Barbarian_Cape'], elfe: ['1H_Sword', 'Round_Shield', 'Rogue_Cape'] },
    rodeur: { humain: ['2H_Crossbow', 'Knight_Cape'], nain: ['2H_Crossbow', 'Barbarian_Hat'], elfe: ['2H_Crossbow', 'Rogue_Cape'] },
    mage: { humain: ['Throwable', 'Knight_Cape'], nain: ['Throwable', 'Barbarian_Cape'], elfe: ['Throwable', 'Rogue_Cape'] },
  };
  const GEAR_NAMES = new Set(['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape',
    '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape']);
  function nameTag(text, col) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = '700 30px system-ui, sans-serif'; const w = Math.min(244, x.measureText(text).width + 34);
    x.fillStyle = 'rgba(20,16,12,0.62)'; x.beginPath(); if (x.roundRect) x.roundRect((256 - w) / 2, 8, w, 46, 23); else x.rect((256 - w) / 2, 8, w, 46); x.fill();
    x.fillStyle = col || '#ffd27a'; x.beginPath(); x.arc((256 - w) / 2 + 17, 31, 7, 0, 6.2832); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128 + 8, 32);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(2.2, 0.55, 1); sp.renderOrder = 8;
    return sp;
  }
  function makePerson(p) {
    const def = P_DEF[p.race] || P_DEF.humain, src = LIB.ch[def.m];
    if (!src || !THREE.SkeletonUtils) return null;
    const obj = THREE.SkeletonUtils.clone(src.scene);
    const hero = p.kind === 'hero';
    const gear = hero ? ((HERO_GEAR[p.cls] || {})[p.race] || []) : (JOB_GEAR[p.job] || []);
    const have = new Set();
    obj.traverse(o => {
      if (GEAR_NAMES.has(o.name)) { o.visible = gear.includes(o.name); if (o.visible) have.add(o.name); }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    for (const n of gear) {
      const G = LIB.gear[n]; if (have.has(n) || !G) continue;
      let bone = null; obj.traverse(o => { if (!bone && o.name === G.parent) bone = o; });
      if (bone) { const c = G.obj.clone(); c.visible = true; bone.add(c); }
    }
    const k = def.h / src.h * (hero ? 1.12 : 1); obj.scale.set(k * def.w, k, k * def.w);
    const g = new THREE.Group(), body = new THREE.Group(); body.add(obj); g.add(body);
    const mixer = new THREE.AnimationMixer(obj);
    const act = n => LIB.clips[n] ? mixer.clipAction(LIB.clips[n]) : null;
    const wk = hero ? null : JOB_WORK[p.job];
    const A = { idle: act('Idle'), walk: act('Walking_A'), work: wk ? act(wk) : null, cheer: act('Cheer') };
    g.userData = { body, mixer, A, cur: null, hero };
    if (hero) {
      const ring = new THREE.Mesh(geo('plane'), basic(p.col || COLORS[0], { transparent: true, opacity: 0.75, depthWrite: false }));
      ring.scale.set(0.85, 1, 0.85); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
      const tag = nameTag(p.name || '', p.col); tag.position.y = def.h * 1.12 + 0.8; g.add(tag);
      const halo = makeGlow(p.cls === 'mage' ? 0xb48cff : 0xffd27a, 1.3, 0.5); halo.material.opacity = 0.3; g.add(halo); g.userData.halo = halo;
    }
    play(g, 'idle');
    return g;
  }
  function setPeople(list) {
    if (!LIB.ok || !vilBlocked) return;
    const seen = new Set();
    for (const p of list) {
      seen.add(p.key);
      let r = people.get(p.key);
      const sig = [p.race, p.cls || '', p.job || '', p.col || '', p.name || ''].join('|');
      if (!r || r.sig !== sig) {
        const g = makePerson(p); if (!g) continue;
        let x, z;
        if (r) { x = r.x; z = r.z; lifeGroup.remove(r.g); }
        else { const sps = p.at && bldSpots.get(p.at), sp = (sps && sps.length && sps[Math.floor(Math.random() * sps.length)]) || vilSpots[Math.floor(Math.random() * vilSpots.length)] || [half, half]; x = sp[0] + 0.5; z = sp[1] + 0.5; }
        const nr = { g, x, z, path: [], wait: Math.random() * 2, sig, data: p, working: false };
        g.position.set(x - half, 0, z - half); lifeGroup.add(g); people.set(p.key, nr);
        r = nr;
      }
      if (r.data.at !== p.at) { r.path = []; r.wait = 0; r.working = false; }
      r.data = p;
    }
    for (const [k, r] of people) if (!seen.has(k)) { lifeGroup.remove(r.g); people.delete(k); }
  }
  const cellOf = v => Math.max(0, Math.min(GRID - 1, Math.floor(v)));
  function arrive(r) {
    const p = r.data;
    if (r.goalWork && p.at) { r.working = true; r.face = bldCenters.get(p.at); r.wait = 6 + Math.random() * 9; }
    else r.wait = 2 + Math.random() * 5;
  }
  function stepPeople(dt, tNow) {
    if (!vilBlocked) return;
    for (const [, r] of people) {
      const U = r.g.userData; if (U.mixer) U.mixer.update(dt);
      if (U.halo) U.halo.material.opacity = 0.22 + 0.1 * Math.sin(tNow * 3 + r.x);
      const p = r.data;
      if (r.wait > 0) {
        r.wait -= dt;
        play(r.g, r.working && U.A.work ? 'work' : 'idle', 1);
        if (r.working && r.face) r.g.rotation.y = Math.atan2(r.face[0] - r.x, r.face[1] - r.z);
        continue;
      }
      if (!r.path.length) {
        r.working = false;
        const sps = p.at && bldSpots.get(p.at);
        let dest = null, work = false;
        if (sps && sps.length && (!r.lastWork || Math.random() < 0.8)) { dest = sps[Math.floor(Math.random() * sps.length)]; work = true; }
        else dest = vilSpots[Math.floor(Math.random() * vilSpots.length)];
        r.lastWork = work; r.goalWork = work;
        if (!dest) { r.wait = 2; continue; }
        const x0 = cellOf(r.x), z0 = cellOf(r.z);
        r.path = x0 === dest[0] && z0 === dest[1] ? [] : findPath(x0, z0, dest[0], dest[1]);
        if (!r.path.length) { arrive(r); continue; }
      }
      const [tx, tz] = r.path[0], dx = tx - r.x, dz = tz - r.z, L = Math.sqrt(dx * dx + dz * dz), step = (p.kind === 'hero' ? 0.95 : 0.75) * dt;
      if (L <= step) { r.x = tx; r.z = tz; r.path.shift(); if (!r.path.length) arrive(r); }
      else { r.x += dx / L * step; r.z += dz / L * step; r.g.rotation.y = Math.atan2(dx, dz); }
      r.g.position.set(r.x - half, 0, r.z - half);
      if (r.path.length) play(r.g, 'walk', p.kind === 'hero' ? 0.62 : 0.55);
    }
  }
  /* Habitant le plus proche de l'endroit touché (à l'écran). */
  function pickPerson(cx, cy, maxPx) {
    if (!camera || !people.size) return null;
    const [lx, ly] = mapPt(cx, cy), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, m = maxPx || 30;
    let best = null, bd = m * m;
    for (const [k, r] of people) {
      projV.set(r.x - half, 0.6, r.z - half).project(camera);
      const sx = (projV.x + 1) / 2 * w, sy = (1 - projV.y) / 2 * h, d = (sx - lx) * (sx - lx) + (sy - ly) * (sy - ly);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function setSeason(si) {
    const bi = si === 3 ? 'snow' : 'green';
    if (si === cropStage && bi === seasonBiome) return;
    cropStage = si; seasonBiome = bi;
    if (mood === 'warm') setBiome(bi);
    groundSig = '';
  }
  /* ---------- incendies pendant les raids ---------- */
  const flames = [];
  let flameMats = null;
  function flameTexture() {
    const c = mkCanvas(64), x = c.getContext('2d');
    x.translate(32, 40); x.scale(1, 1.6);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,220,140,0.9)'); g.addColorStop(0.7, 'rgba(255,140,40,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 22, 0, 6.2832); x.fill();
    return new THREE.CanvasTexture(c);
  }
  function flame(x, y, z) {
    if (flames.length > 110) return;
    if (!flameMats) { const t = flameTexture(); flameMats = [0xff5a1a, 0xff8a2a, 0xffc060].map(c => new THREE.SpriteMaterial({ map: t, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); }
    const sp = new THREE.Sprite(flameMats[Math.floor(Math.random() * 3)]), k = 0.55 + Math.random() * 0.55;
    sp.scale.set(k, k * 1.4, 1); sp.position.set(x, y, z); fxGroup.add(sp);
    flames.push({ s: sp, k, age: 0, life: 0.45 + Math.random() * 0.35, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3 });
  }

  /* ---------- unités en modèles animés ---------- */
  const U_DEF = {
    dwarf: {
      fantassin: { m: 'barbarian', show: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat'], atk: '1H_Melee_Attack_Chop', h: 1.0, w: 1.28 },
      archer: { m: 'barbarian', show: ['Barbarian_Hat'], xbow: true, atk: '2H_Ranged_Shoot', h: 1.0, w: 1.28 },
      villager: { m: 'barbarian', show: ['Mug'], atk: 'Cheer', h: 0.92, w: 1.3 },
      bucheron: { m: 'barbarian', show: ['1H_Axe', 'Barbarian_Hat'], atk: '1H_Melee_Attack_Chop', h: 0.92, w: 1.3 },
    },
    hero: {
      roi: { m: 'knight', show: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], atk: '1H_Melee_Attack_Chop', pow: 'Cheer', h: 1.3, w: 1.3 },
      chasseresse: { m: 'rogue', show: ['2H_Crossbow', 'Rogue_Cape'], atk: '2H_Ranged_Shoot', pow: 'Cheer', h: 1.22, w: 1.18 },
      berserker: { m: 'barbarian', show: ['2H_Axe', 'Barbarian_Cape'], atk: '2H_Melee_Attack_Chop', pow: '2H_Melee_Attack_Spin', h: 1.38, w: 1.34 },
    },
    orc: {
      fantassin: { m: 'barbarian', tex: 'orc_barbarian', show: ['1H_Axe', '1H_Axe_Offhand'], atk: '1H_Melee_Attack_Chop', h: 1.28, w: 1.06 },
      archer: { m: 'rogue', tex: 'orc_rogue', show: ['2H_Crossbow'], atk: '2H_Ranged_Shoot', h: 1.22, w: 1.0 },
      belier: { m: 'barbarian', tex: 'troll', show: ['2H_Axe'], atk: '2H_Melee_Attack_Chop', h: 2.4, w: 1.32 },
    },
  };
  const WEAPONS = ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable',
    '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape', 'Rogue_Cape', 'Barbarian_Cape'];
  const HERO_GLOW = { roi: 0xffd27a, chasseresse: 0x9be37a, berserker: 0xff6a3c };
  const skinMats = new Map();
  function skinMat(orig, texName) {
    const key = orig.uuid + '|' + texName;
    if (!skinMats.has(key)) { const m = orig.clone(); m.map = LIB.tex[texName]; m.needsUpdate = true; skinMats.set(key, m); }
    return skinMats.get(key);
  }
  function makeUnitModel(type, col, orc) {
    const def = HEROES[type] ? U_DEF.hero[type] : (orc ? U_DEF.orc : U_DEF.dwarf)[type];
    if (!def || !LIB.ch[def.m] || !THREE.SkeletonUtils) return null;
    const src = LIB.ch[def.m], obj = THREE.SkeletonUtils.clone(src.scene);
    obj.traverse(o => {
      if (WEAPONS.includes(o.name)) o.visible = def.show.includes(o.name);
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (def.tex && LIB.tex[def.tex]) o.material = skinMat(o.material, def.tex); }
    });
    if (def.xbow && LIB.xbow) {
      let bone = null; obj.traverse(o => { if (!bone && o.name === LIB.xbow.parent) bone = o; });
      if (bone) { const c = LIB.xbow.obj.clone(); c.visible = true; bone.add(c); }
    }
    const k = def.h / src.h; obj.scale.set(k * def.w, k, k * def.w);
    const g = new THREE.Group(), body = new THREE.Group(); body.add(obj); g.add(body);
    const hero = !!HEROES[type];
    const ring = new THREE.Mesh(geo('plane'), basic(orc ? 0xb8402e : hero ? HERO_GLOW[type] : col, { transparent: true, opacity: hero ? 0.75 : 0.55, depthWrite: false }));
    const rs = type === 'belier' ? 1.1 : hero ? 0.95 : 0.6; ring.scale.set(rs, 1, rs); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
    const mixer = new THREE.AnimationMixer(obj);
    const act = n => src.clips[n] ? mixer.clipAction(src.clips[n]) : null;
    const A = { idle: act('Idle'), walk: act('Walking_A'), atk: act(def.atk), death: act('Death_A'), cheer: act('Cheer'), pow: act(def.pow || 'Cheer') };
    if (A.death) { A.death.setLoop(THREE.LoopOnce); A.death.clampWhenFinished = true; }
    if (A.pow) { A.pow.setLoop(THREE.LoopOnce); A.pow.clampWhenFinished = false; }
    const bar = makeBar(hero ? 0.8 : 0.5, hero ? 0xffd27a : 0x5fd17a); bar.position.y = def.h + 0.3; bar.visible = false; g.add(bar);
    g.userData = { body, bar, mixer, A, cur: null, hero, ring };
    if (hero) { const gl = makeGlow(HERO_GLOW[type], 1.6, 0.25); gl.material.opacity = 0.35; g.add(gl); g.userData.halo = gl; }
    play(g, 'idle');
    return g;
  }
  function play(g, name, speed) {
    const u = g.userData; if (!u.A) return;
    const a = u.A[name]; if (!a) return;
    if (speed) a.timeScale = speed;
    if (u.cur === a) return;
    if (u.cur) u.cur.fadeOut(0.15);
    a.reset().fadeIn(0.15).play(); u.cur = a;
  }
  function syncUnits(list, alpha, tNow) {
    const seen = new Set();
    for (const u of list) {
      seen.add(u.id);
      let rec = units.get(u.id);
      if (!rec) {
        const mg = LIB.ok ? makeUnitModel(u.type, u.col, !!u.orc) : null;
        const g = mg || makeUnit(u.type, u.col, !!u.orc, u.id);
        rec = { g, lx: u.x, lz: u.z, model: !!mg }; units.set(u.id, rec); unitGroup.add(g);
      }
      const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha;
      const dx = x - rec.lx, dz = z - rec.lz;
      if (dx * dx + dz * dz > 1e-6) rec.g.rotation.y = Math.atan2(dx, dz);
      else if (u.face) rec.g.rotation.y = Math.atan2(u.face[0] - x, u.face[1] - z);
      rec.lx = x; rec.lz = z;
      if (rec.model) {
        const T = TROOPS[u.type] || TROOPS.fantassin;
        rec.g.position.set(x - half, 0, z - half);
        const U = rec.g.userData;
        if (U.powUntil > tNow) { /* animation du pouvoir en cours */ }
        else if (u.mv) play(rec.g, 'walk', T.speed / 1.4);
        else if (u.atkAge != null && u.atkAge < T.hit * 1.6) { const a = U.A.atk; play(rec.g, 'atk', a ? a.getClip().duration / T.hit : 1); }
        else play(rec.g, 'idle', 1);
      } else {
        const bob = u.mv ? Math.abs(Math.sin(tNow * 12 + u.id)) * 0.06 : 0;
        const lunge = !u.mv && u.atkAge != null && u.atkAge < 0.25 ? Math.sin(u.atkAge / 0.25 * Math.PI) * 0.12 : 0;
        rec.g.position.set(x - half, bob, z - half);
        rec.g.userData.body.position.z = lunge;
      }
      const f = u.hp / u.max, UD = rec.g.userData;
      UD.bar.visible = f < 0.999 || !!UD.hero;
      if (UD.bar.visible) setBar(UD.bar, f);
      if (u.buff && !UD.aura) { UD.aura = makeGlow(u.hero ? HERO_GLOW[u.type] : 0xffc94a, 1.3, 0.6); UD.aura.material.opacity = 0.45; rec.g.add(UD.aura); }
      if (UD.aura) { UD.aura.visible = !!u.buff; if (u.buff) UD.aura.material.opacity = 0.35 + 0.2 * Math.sin(tNow * 9 + u.id); }
      if (UD.halo) UD.halo.material.opacity = 0.28 + 0.1 * Math.sin(tNow * 3);
    }
    for (const [id, rec] of units) if (!seen.has(id)) {
      units.delete(id);
      if (rec.model && rec.g.userData.A.death) { rec.g.userData.bar.visible = false; play(rec.g, 'death', 1.3); dying.push({ g: rec.g, t: 0 }); }
      else { unitGroup.remove(rec.g); burst(rec.lx, rec.lz, 0.3, 0xd8d0c0, 4); }
    }
  }
  function unitPower(id) {
    const rec = units.get(id); if (!rec) return;
    if (rec.model && rec.g.userData.A.pow) { play(rec.g, 'pow', 1.1); rec.g.userData.powUntil = performance.now() / 1000 + 1.1; }
  }
  function clearUnits() {
    for (const [, rec] of units) unitGroup.remove(rec.g); units.clear();
    for (const d of dying) unitGroup.remove(d.g); dying.length = 0;
    for (const s of shots) fxGroup.remove(s.m); shots.length = 0;
    for (const c of chunks) fxGroup.remove(c.m); chunks.length = 0;
  }

  /* ---------- projectiles et effets ---------- */
  function spawnShot(kind, fx, fy, fz, target, dur, arcK) {
    let m;
    if (kind === 'stone') m = P('dode', 0x7d858b, 0.3, 0.3, 0.3, 0, 0, 0, 0, true);
    else if (kind === 'bolt') m = P('box', 0x4b3a2a, 0.07, 0.07, 0.6, 0, 0, 0, 0, true);
    else m = P('box', 0x3a2a1e, 0.035, 0.035, 0.42, 0, 0, 0, 0, true);
    fxGroup.add(m);
    shots.push({ m, kind, fx: fx - half, fy, fz: fz - half, target, age: 0, dur: Math.max(0.12, dur), lx: fx - half, ly: fy, lz: fz - half, arcK: arcK || 0 });
  }
  function burst(x, z, y, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo('sph'), basic(color, { transparent: true, opacity: 0.7, depthWrite: false }));
      const s = 0.25 + Math.random() * 0.3; m.scale.setScalar(s);
      m.position.set(x - half + (Math.random() - 0.5) * 0.6, y, z - half + (Math.random() - 0.5) * 0.6);
      fxGroup.add(m); puffs.push({ m, vy: 0.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, age: 0, life: 0.8 + Math.random() * 0.6, s });
    }
  }
  /* Effets : poussière, débris, ondes, étincelles, pouvoirs des héros. */
  function dustRing(x, z, r) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, m = new THREE.Mesh(geo('sph'), basic(0xd8c8a8, { transparent: true, opacity: 0.6, depthWrite: false }));
      const s = 0.22 + Math.random() * 0.12; m.scale.setScalar(s);
      m.position.set(x - half + Math.cos(a) * r, 0.12, z - half + Math.sin(a) * r);
      fxGroup.add(m); puffs.push({ m, vy: 0.35, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9, age: 0, life: 0.7, s });
    }
  }
  const chunkMats = {};
  function debris(x, z, s, orc, n) {
    const cols = orc ? [0x4a3424, 0x6b4a2b, 0x8d6e4a] : [0x9a9488, 0x7d858b, 0x8b6a45];
    for (let i = 0; i < (n || 10); i++) {
      const c = cols[i % cols.length], m = new THREE.Mesh(geo('box'), chunkMats[c] || (chunkMats[c] = mat(c)));
      const k = 0.12 + Math.random() * 0.18; m.scale.set(k, k * 0.8, k * 1.1); m.castShadow = false;
      m.position.set(x - half + (Math.random() - 0.5) * s * 0.6, 0.3 + Math.random() * s * 0.4, z - half + (Math.random() - 0.5) * s * 0.6);
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      fxGroup.add(m); chunks.push({ m, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 3.5, vz: Math.sin(a) * sp, rx: (Math.random() - 0.5) * 12, rz: (Math.random() - 0.5) * 12, age: 0, life: 1.3 + Math.random() * 0.5, k });
    }
  }
  function wave(x, z, color, r, life) {
    const rg = new THREE.RingGeometry(0.75, 1, 40); rg.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(rg, basic(color, { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x - half, 0.06, z - half); m.renderOrder = 4; fxGroup.add(m);
    waves.push({ m, r: r || 2, age: 0, life: life || 0.6 });
  }
  function spark(x, y, z, color) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color || 0xfff0b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    const k = 0.5 + Math.random() * 0.3; sp.scale.set(k, k, 1); sp.position.set(x - half + (Math.random() - 0.5) * 0.3, y, z - half + (Math.random() - 0.5) * 0.3);
    fxGroup.add(sp); sparks.push({ s: sp, age: 0, life: 0.18, k });
  }
  function powerFx(type, x, z) {
    const c = HERO_GLOW[type] || 0xffd27a;
    wave(x, z, c, type === 'roi' ? 5 : 2.2, 0.8); wave(x, z, c, type === 'roi' ? 3.5 : 1.4, 0.55);
    for (let i = 0; i < 6; i++) spark(x + (Math.random() - 0.5), 0.5 + Math.random() * 1.5, z + (Math.random() - 0.5), c);
  }
  function volley(fx, fz, x, z) {
    for (let i = 0; i < 9; i++) {
      const tx = x + (Math.random() - 0.5) * 4, tz = z + (Math.random() - 0.5) * 4;
      spawnShot('arrow', fx + (Math.random() - 0.5), 1.2, fz + (Math.random() - 0.5), () => [tx, 0.1, tz], 0.45 + Math.random() * 0.2, 2.2);
    }
    setTimeout(() => { for (let i = 0; i < 4; i++) spark(x + (Math.random() - 0.5) * 3, 0.3, z + (Math.random() - 0.5) * 3, 0x9be37a); }, 500);
  }
  function smokeAt(wx, wy, wz, dark) {
    const m = new THREE.Mesh(geo('sph'), basic(dark ? 0x4a4440 : 0xeeeeea, { transparent: true, opacity: 0.4, depthWrite: false }));
    m.scale.setScalar(0.2); m.position.set(wx, wy, wz); fxGroup.add(m);
    puffs.push({ m, vy: 0.45, vx: 0.08, vz: 0.03, age: 0, life: 2.6, s: 0.2, grow: 0.35 });
  }

  /* ---------- ambiances : chaude au village, sombre en attaque ---------- */
  const MOODS = {
    warm: { exp: 0.88, bg: 0xb7d0de, fog: 0xc8dae3, near: 75, far: 175, sun: 0xffeccc, sunI: 2.0, sunPos: [-26, 30, 18], hemiS: 0xcfe0f2, hemiG: 0x5e5032, hemiI: 0.55, ground: 0xffffff, win: 0xffd28a, glow: 0.18, embers: false, env: [0xbfd9ef, 0xf3e7cf, 0x6f6a4a], envI: 0.6, bio: 'green' },
    dark: { exp: 0.8, bg: 0x1a2032, fog: 0x1d2437, near: 58, far: 125, sun: 0xa9b8ff, sunI: 1.3, sunPos: [26, 32, -8], hemiS: 0x7d8cc6, hemiG: 0x2b2a36, hemiI: 0.8, ground: 0xe4e9f4, win: 0xffa040, glow: 0.55, embers: true, env: [0x2a3558, 0x3a4566, 0x1c1d26], envI: 0.5, bio: 'snow' },
  };
  let P_MOOD = MOODS.warm;
  const envCache = {};
  function makeEnv(k, cols) {
    if (envCache[k]) return envCache[k];
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene(), g = new THREE.SphereGeometry(10, 32, 16), P3 = g.attributes.position, col = new Float32Array(P3.count * 3);
    const [top, hor, bot] = cols.map(c => lin(c));
    for (let i = 0; i < P3.count; i++) { const y = P3.getY(i) / 10, c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.min(1, -y * 2.5)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sunM.position.set(-6, 7, 4); sc.add(sunM);
    const t = pm.fromScene(sc, 0.03).texture; pm.dispose();
    return (envCache[k] = t);
  }
  function setMood(m) {
    if (m === mood || !MOODS[m] || !scene) return;
    mood = m; const Q = P_MOOD = MOODS[m];
    scene.background = lin(Q.bg); scene.fog.color.copy(lin(Q.fog)); scene.fog.near = Q.near; scene.fog.far = Q.far;
    sun.color.copy(lin(Q.sun)); sun.intensity = Q.sunI; sun.position.set(Q.sunPos[0], Q.sunPos[1], Q.sunPos[2]);
    hemi.color.copy(lin(Q.hemiS)); hemi.groundColor.copy(lin(Q.hemiG)); hemi.intensity = Q.hemiI;
    groundMat.color.copy(lin(Q.ground)); winMat.color.copy(lin(Q.win));
    renderer.toneMappingExposure = Q.exp;
    try { scene.environment = makeEnv(m, Q.env); setBiome(m === 'warm' ? seasonBiome : Q.bio); } catch (e) { console.error('ambiance', e); }
    if (!Q.embers) { for (const e of embers) fxGroup.remove(e.s); embers.length = 0; }
  }

  /* ---------- chargement des modèles ---------- */
  const MODEL_NAMES = ['castle', 'lumbermill', 'mine', 'windmill', 'market', 'barracks', 'tavern', 'tower_A', 'tower_B', 'tower_catapult', 'church', 'destroyed', 'scaffolding', 'trees_A_large', 'trees_A_medium', 'trees_B_large', 'tree_A', 'tree_B', 'mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_C', 'rock_A', 'rock_C', 'rock_E'];
  function loadModels(base, onProgress, base2) {
    if (!ok || !THREE.GLTFLoader) return Promise.resolve(false);
    THREE.Cache.enabled = true;
    const loader = new THREE.GLTFLoader(), tl = new THREE.TextureLoader();
    const chars = ['barbarian', 'rogue', 'knight'], texs = ['orc_barbarian', 'orc_rogue', 'troll'];
    const m2 = base2 ? M2_NAMES : [];
    const total = MODEL_NAMES.length + chars.length + texs.length + m2.length;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done, total); };
    const one = n => new Promise(res => loader.load(base + n + '.json', g => { LIB.b[n] = g; tick(); res(); }, undefined, () => { tick(); res(); }));
    const ch = n => new Promise(res => loader.load(base + n + '.json', g => {
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB.ch[n] = { scene: g.scene, clips: Object.fromEntries(g.animations.map(a => [a.name, a])), h: box.getSize(new THREE.Vector3()).y || 2 };
      tick(); res();
    }, undefined, () => { tick(); res(); }));
    const tx = n => new Promise(res => tl.load(base + n + '.png', t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; LIB.tex[n] = t; tick(); res(); }, undefined, () => { tick(); res(); }));
    const one2 = n => new Promise(res => loader.load(base2 + n + '.glb', g => { LIB.m2[n] = g; tick(); res(); }, undefined, () => { tick(); res(); }));
    return Promise.all([...MODEL_NAMES.map(one), ...chars.map(ch), ...texs.map(tx), ...m2.map(one2)]).then(() => {
      if (!LIB.b.castle || !LIB.b.tower_A) return false;
      if (LIB.ch.rogue) LIB.ch.rogue.scene.traverse(o => { if (o.name === '2H_Crossbow' && o.parent && !LIB.xbow) LIB.xbow = { parent: o.parent.name, obj: o }; });
      /* Les personnages KayKit partagent le même squelette : armes et animations passent de l'un à l'autre. */
      for (const n of ['knight', 'barbarian', 'rogue']) {
        const c = LIB.ch[n]; if (!c) continue;
        c.scene.traverse(o => { if (GEAR_NAMES.has(o.name) && o.parent && /handslot/.test(o.parent.name) && !LIB.gear[o.name]) LIB.gear[o.name] = { parent: o.parent.name, obj: o }; });
        for (const k in c.clips) if (!LIB.clips[k]) LIB.clips[k] = c.clips[k];
      }
      const matte = o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.roughness = 0.88; o.material.envMapIntensity = 0.55; } };
      for (const k in LIB.b) LIB.b[k].scene.traverse(matte);
      for (const k in LIB.m2) LIB.m2[k].scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.5; o.material.roughness = Math.max(0.75, o.material.roughness); } });
      for (const k in LIB.ch) LIB.ch[k].scene.traverse(matte);
      for (const k in LIB.tex) if (LIB.tex[k]) LIB.tex[k].anisotropy = 4;
      LIB.ok = true; LIB.ver++; protos.clear(); groundSig = '';
      buildWorldModels();
      return true;
    });
  }

  /* ---------- vignettes des troupes (rendues une fois, à la construction du site) ---------- */
  function renderThumbs(keys, size) {
    size = size || 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
    const out = {};
    for (const k of keys) {
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xfff4e0, 0x4a3a2a, 0.95));
      const key = new THREE.DirectionalLight(0xffe2b8, 1.25); key.position.set(-2, 3, 4); sc.add(key);
      const rim = new THREE.DirectionalLight(0x9ab8ff, 0.7); rim.position.set(3, 2, -3); sc.add(rim);
      const mg = LIB.ok ? makeUnitModel(k, COLORS[2], false) : null;
      const g = mg || makeUnit(k, COLORS[2], false, 3);
      if (g.userData.bar) g.userData.bar.visible = false;
      if (g.userData.ring) g.userData.ring.visible = false;
      if (g.userData.halo) g.userData.halo.visible = false;
      g.children.forEach(c => { if (c.isMesh && c.geometry === geo('plane')) c.visible = false; });
      if (g.userData.mixer) { play(g, 'idle', 1); g.userData.mixer.update(0.6); }
      g.rotation.y = -0.45; sc.add(g);
      g.updateMatrixWorld(true);
      const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
      let h, cx = 0, cz = 0;
      const def = HEROES[k] ? U_DEF.hero[k] : U_DEF.dwarf[k];
      if (mg && def) h = def.h;
      else {
        const box = new THREE.Box3();
        g.traverse(o => { if (o.isMesh && shown(o) && o.geometry !== geo('plane')) box.expandByObject(o); });
        h = box.max.y - box.min.y || 1; cx = (box.min.x + box.max.x) / 2; cz = (box.min.z + box.max.z) / 2;
      }
      const wide = k === 'belier';
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
      const ty = wide ? h * 0.42 : h * 0.55, dist = wide ? h * 3.4 : h * 2.2;
      cam.position.set(cx + 0.28 * dist, ty + h * 0.16, cz + dist); cam.lookAt(cx, ty, cz);
      r.render(sc, cam);
      out[k] = cv.toDataURL('image/png');
    }
    r.dispose();
    return out;
  }

  /* ---------- boucle ---------- */
  let lastFrame = 0, emitClock = 0, emberClock = 0;
  const camQ = new THREE.Quaternion();
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden || !ok) return;
    if (ts - lastFrame < 30) return;
    const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000); lastFrame = ts;
    const tNow = ts / 1000;
    if (frameHook) frameHook(dt, tNow);
    updateCamera(dt);
    camQ.copy(camera.quaternion);
    for (const [, bar] of wallBars) bar.quaternion.copy(camQ);
    if (waterNormal && waterMesh.visible) { waterNormal.offset.x = (tNow * 0.012) % 1; waterNormal.offset.y = (tNow * 0.007) % 1; }
    for (const [, r] of blds) {
      if (r.bar) { r.bar.quaternion.copy(camQ); const up = r.item.up; if (up) setBar(r.bar, up.frac != null ? up.frac : (Date.now() - up.t0) / Math.max(1, up.t1 - up.t0)); }
      if (r.hp) r.hp.quaternion.copy(camQ);
      if (r.glow) r.glow.material.opacity = P_MOOD.glow * (0.85 + 0.15 * Math.sin(tNow * 6 + r.ph) + 0.06 * Math.sin(tNow * 17 + r.ph));
    }
    for (const [, r] of units) { r.g.userData.bar.quaternion.copy(camQ); if (r.g.userData.mixer) r.g.userData.mixer.update(dt); }
    for (const d of dying) {
      d.t += dt; d.g.userData.mixer.update(dt);
      if (d.t > 1.6) { const k = Math.max(0, 1 - (d.t - 1.6) / 0.5); d.g.scale.setScalar(k); if (k <= 0) { d.done = true; unitGroup.remove(d.g); } }
    }
    for (let i = dying.length - 1; i >= 0; i--) if (dying[i].done) dying.splice(i, 1);
    for (const a of anims) {
      if (a.k === 'spin') a.o.rotation.y += dt * a.s;
      else if (a.k === 'flag') a.o.rotation.y = Math.sin(tNow * 2.2 + a.ph) * 0.35;
      else if (a.k === 'fire') { const f = 0.85 + Math.sin(tNow * 17) * 0.1 + Math.sin(tNow * 29) * 0.07; a.o.scale.y = (a.base || 0.42) * f; }
      else if (a.k === 'pop') { a.t += dt; const x = Math.min(1, a.t / 0.45), k = x < 0.6 ? 0.6 + 0.48 * (x / 0.6) : 1.08 - 0.08 * ((x - 0.6) / 0.4); a.o.scale.setScalar(k); if (x >= 1) { a.o.scale.setScalar(1); a.done = true; } }
      else if (a.k === 'pulse') { const k = a.base * (0.9 + 0.12 * Math.sin(tNow * 2.4)); a.o.scale.set(k, k, 1); }
      else if (a.k === 'throw') { a.t += dt; const x = a.t / 0.5; a.o.rotation.x = x < 0.3 ? -0.9 + 1.6 * (x / 0.3) : x < 1 ? 0.7 - 1.6 * ((x - 0.3) / 0.7) : -0.9; if (x >= 1) a.done = true; }
    }
    anims = anims.filter(a => !a.done);
    emitClock += dt;
    if (emitClock > 0.55) {
      emitClock = 0;
      for (const [, r] of blds) {
        if (r.item.dead) { if (Math.random() < 0.5) smokeAt(r.g.position.x, 0.4, r.g.position.z, true); continue; }
        for (const e of r.info.emit || []) if (Math.random() < 0.7) smokeAt(r.g.position.x + e[0], e[1], r.g.position.z + e[2], mood === 'dark');
      }
    }
    if (P_MOOD.embers && blds.size) {
      emberClock += dt;
      while (emberClock > 0.09) {
        emberClock -= 0.09;
        const recs = [...blds.values()], r = recs[Math.floor(Math.random() * recs.length)];
        if (!r || r.item.lvl <= 0) continue;
        const s = new THREE.Sprite(emberMat); const k = 0.12 + Math.random() * 0.12; s.scale.set(k, k, 1);
        s.position.set(r.g.position.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * r.info.top, r.g.position.z + (Math.random() - 0.5) * 1.6);
        fxGroup.add(s); embers.push({ s, vy: 0.5 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.4, age: 0, life: 1.6 + Math.random() * 1.4 });
      }
    }
    stepPeople(dt, tNow);
    for (const [, r] of blds) {
      if (r.burnT > 0) r.burnT -= dt;
      const on = r.burn || r.burnT > 0;
      if (on && !r.fireGlow) { r.fireGlow = makeGlow(0xff7a2a, BLD[r.item.type].size * 2.2, 0.6); r.fireGlow.material.toneMapped = false; r.g.add(r.fireGlow); }
      if (r.fireGlow) { r.fireGlow.visible = on; if (on) r.fireGlow.material.opacity = 0.55 + 0.25 * Math.sin(tNow * 13 + r.ph) + 0.1 * Math.sin(tNow * 31); }
      if (!on || Math.random() > dt * (r.item.dead ? 9 : 16)) continue;
      const s = BLD[r.item.type].size, top = r.item.dead ? 0.6 : r.info.top * 0.7;
      flame(r.g.position.x + (Math.random() - 0.5) * s * 0.7, 0.2 + Math.random() * top, r.g.position.z + (Math.random() - 0.5) * s * 0.7);
      if (Math.random() < 0.18) smokeAt(r.g.position.x + (Math.random() - 0.5) * s * 0.5, top + 0.4, r.g.position.z + (Math.random() - 0.5) * s * 0.5, true);
    }
    for (const f of flames) { f.age += dt; const k = f.age / f.life; f.s.position.y += dt * 1.1; f.s.position.x += f.vx * dt; f.s.position.z += f.vz * dt; const sc = f.k * (1 - k * 0.8); f.s.scale.set(sc, sc * 1.35, 1); if (k >= 1) { f.done = true; fxGroup.remove(f.s); } }
    for (let i = flames.length - 1; i >= 0; i--) if (flames[i].done) flames.splice(i, 1);
    for (const e of embers) { e.age += dt; e.s.position.y += e.vy * dt; e.s.position.x += e.vx * dt + Math.sin(tNow * 3 + e.life) * 0.004; if (e.age > e.life) { e.done = true; fxGroup.remove(e.s); } }
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].done) embers.splice(i, 1);
    for (const s of shots) {
      s.age += dt;
      const t = Math.min(1, s.age / s.dur), tg = s.target();
      const tx = tg[0] - half, ty = tg[1], tz = tg[2] - half;
      const arc = s.arcK || (s.kind === 'stone' ? 3.5 : s.kind === 'bolt' ? 0.3 : 0.9);
      const x = s.fx + (tx - s.fx) * t, z = s.fz + (tz - s.fz) * t, y = s.fy + (ty - s.fy) * t + Math.sin(Math.PI * t) * arc;
      s.m.position.set(x, y, z);
      if (s.kind !== 'stone') s.m.lookAt(x + (x - s.lx) * 10, y + (y - s.ly) * 10, z + (z - s.lz) * 10);
      else s.m.rotation.x += dt * 6;
      s.lx = x; s.ly = y; s.lz = z;
      if (t >= 1) { s.done = true; fxGroup.remove(s.m); if (s.kind === 'stone') burst(tg[0], tg[2], 0.2, 0xb7a58a, 6); }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
    for (const p of puffs) {
      p.age += dt; const k = p.age / p.life;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.s * (1 + k * (p.grow ? 6 : 1.5)));
      p.m.material.opacity = 0.55 * (1 - k);
      if (k >= 1) { p.done = true; fxGroup.remove(p.m); p.m.material.dispose(); }
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].done) puffs.splice(i, 1);
    for (const c of chunks) {
      c.age += dt; c.vy -= 12 * dt;
      c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
      if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.rx *= 0.5; c.rz *= 0.5; }
      c.m.rotation.x += c.rx * dt; c.m.rotation.z += c.rz * dt;
      if (c.age > c.life) { const k = Math.max(0, 1 - (c.age - c.life) / 0.4); c.m.scale.setScalar(c.k * k); if (k <= 0) { c.done = true; fxGroup.remove(c.m); } }
    }
    for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].done) chunks.splice(i, 1);
    for (const w of waves) {
      w.age += dt; const k = Math.min(1, w.age / w.life);
      w.m.scale.setScalar(0.2 + w.r * k); w.m.material.opacity = 0.8 * (1 - k);
      if (k >= 1) { w.done = true; fxGroup.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); }
    }
    for (let i = waves.length - 1; i >= 0; i--) if (waves[i].done) waves.splice(i, 1);
    for (const sp of sparks) {
      sp.age += dt; const k = sp.age / sp.life;
      sp.s.scale.set(sp.k * (1 + k), sp.k * (1 + k), 1); sp.s.material.opacity = 1 - k;
      if (k >= 1) { sp.done = true; fxGroup.remove(sp.s); sp.s.material.dispose(); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].done) sparks.splice(i, 1);
    renderer.render(scene, camera);
  }

  return {
    setPeople, pickPerson, setSeason,
    init, ok: () => ok, resize, resetCamera, setBuildings, clearBuildings, setBldHp, bldInfo, aimAt, select, ghost, showZone, showRanges,
    syncUnits, clearUnits, spawnShot, burst, pickGround, pickBuilding, focus, setPointerMap, setMood, loadModels, modelsReady: () => LIB.ok,
    debris, wave, spark, shake, dustRing, powerFx, volley, unitPower, renderThumbs, panOf, toScreen,
    _ground: () => groundCanvas && groundCanvas.toDataURL('image/jpeg', 0.8),
    _bench: () => { const t0 = performance.now(); paintBase(biome); const t1 = performance.now(); paintGround(lastGroundItems); return { base: Math.round(t1 - t0), ground: Math.round(performance.now() - t1) }; },
    _fx: () => ({ flames: flames.length, burning: [...blds.values()].filter(r => r.burn).length, people: people.size, mood, biome }),
    onFrame: f => { frameHook = f; }, onTap: f => { tapHook = f; },
  };
})();
