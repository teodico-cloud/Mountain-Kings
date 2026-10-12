/* ===================== DONJONS : fabrication à partir d'une graine (pur, sans DOM) =====================
   Même graine + même niveau = même donjon, sur les deux téléphones. Une case = 1 unité (≈ un personnage). */
const DJ_TILE = { WALL: 0, FLOOR: 1 };
/* Salles faites main : largeur, hauteur, forme. */
const DJ_ROOMS = [
  { k: 'carree', w: 9, h: 9, shape: 'rect' }, { k: 'longue', w: 12, h: 8, shape: 'rect' }, { k: 'haute', w: 8, h: 12, shape: 'rect' },
  { k: 'piliers', w: 11, h: 11, shape: 'pillars' }, { k: 'grande', w: 13, h: 10, shape: 'pillars' }, { k: 'carrefour', w: 11, h: 11, shape: 'cross' },
  { k: 'enL', w: 11, h: 10, shape: 'L' }, { k: 'couloir', w: 13, h: 7, shape: 'rect' }, { k: 'ronde', w: 11, h: 11, shape: 'round' },
];
const DJ_BOSS = { k: 'arene', w: 14, h: 14, shape: 'arena' };
/* Monstres (statistiques de base au niveau 1). w : fréquence dans le thème. */
const DJ_MONSTERS = {
  /* la mine des gobelins */
  gobelin: { name: 'Gobelin', hp: 40, dmg: 5, speed: 2.8, range: 1.1, rate: 1.7, xp: 4, w: 4 },
  archer: { name: 'Gobelin archer', hp: 28, dmg: 6, speed: 2.4, range: 6, rate: 2.2, xp: 5, w: 2, ranged: true },
  chaman: { name: 'Chaman', hp: 34, dmg: 4, speed: 2.2, range: 5, rate: 2.6, xp: 6, w: 1, heals: true },
  troll: { name: 'Troll', hp: 130, dmg: 14, speed: 1.6, range: 1.4, rate: 2.4, xp: 12, w: 1, big: true },
  /* la crypte des rois */
  squelette: { name: 'Squelette', hp: 44, dmg: 5, speed: 2.5, range: 1.2, rate: 1.8, xp: 4, w: 4 },
  archerSq: { name: 'Squelette archer', hp: 26, dmg: 6, speed: 2.2, range: 6, rate: 2.2, xp: 5, w: 2, ranged: true },
  goule: { name: 'Goule', hp: 30, dmg: 4, speed: 3.7, range: 1.0, rate: 1.0, xp: 4, w: 2 },
  spectre: { name: 'Spectre', hp: 32, dmg: 6, speed: 2.6, range: 5.5, rate: 2.4, xp: 6, w: 1, ranged: true, evade: 0.3, shot: 'ghost' },
  necromant: { name: 'Nécromant', hp: 34, dmg: 4, speed: 2.1, range: 5, rate: 2.8, xp: 7, w: 1, raises: true },
  golem: { name: 'Golem d’os', hp: 140, dmg: 15, speed: 1.5, range: 1.4, rate: 2.5, xp: 13, w: 1, big: true },
};
const DJ_BOSSES = {
  chefTroll: { name: 'Chef troll', hp: 520, dmg: 16, speed: 1.8, range: 1.6, rate: 2.1, xp: 80, big: true, boss: true },
  roiSquelette: { name: 'Roi squelette', hp: 560, dmg: 15, speed: 1.9, range: 1.7, rate: 2.0, xp: 85, big: true, boss: true },
};
const DJ_THEMES = {
  mine: { name: 'Mine des gobelins', the: 'la mine des gobelins', monsters: ['gobelin', 'archer', 'chaman', 'troll'], boss: 'chefTroll' },
  crypte: { name: 'Crypte des rois', the: 'la crypte des rois', monsters: ['squelette', 'archerSq', 'goule', 'spectre', 'necromant', 'golem'], boss: 'roiSquelette' },
};
const DJ_PRISONER_CHANCE = lvl => Math.min(0.10, 0.03 + 0.007 * lvl);   // rare : de 4 % (niveau 1) à 10 %

function djCarve(grid, W, x0, y0, w, h, shape) {
  const cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (shape === 'cross' && (i < (w / 3 | 0) || i >= w - (w / 3 | 0)) && (j < (h / 3 | 0) || j >= h - (h / 3 | 0))) continue;
    if (shape === 'L' && i >= (w / 2 | 0) && j < (h / 2 | 0)) continue;
    if (shape === 'round') { const dx = (i + 0.5) / w - 0.5, dy = (j + 0.5) / h - 0.5; if (dx * dx + dy * dy > 0.25) continue; }
    if ((shape === 'pillars' || shape === 'arena') && [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].some(([a, b]) => a === i && b === j)) continue;
    grid[(y0 + j) * W + x0 + i] = DJ_TILE.FLOOR; cells.push([x0 + i, y0 + j]);
  }
  return cells;
}
function djCorridor(grid, W, a, b) {
  /* Couloir de 3 cases de large, en L : d'abord à l'horizontale, puis à la verticale. */
  const [ax, ay] = a, [bx, by] = b;
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let d = -1; d <= 1; d++) grid[(ay + d) * W + x] = DJ_TILE.FLOOR;
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) for (let d = -1; d <= 1; d++) grid[y * W + bx + d] = DJ_TILE.FLOOR;
}
const djCenter = r => [r.x + (r.w >> 1), r.y + (r.h >> 1)];

/* Fabrique un donjon : 5 à 6 salles de combat (2 ou 3 vagues de monstres chacune) + l'arène du boss, une salle annexe (trésor ou prisonnier).
   opts (étages des Profondeurs) : { rooms: nombre de salles de combat, boss: false pour un étage sans boss }. */
function genDungeon(seed, lvl, theme, opts) {
  const o = opts || {}, R = mulberry32((seed ^ 0x9e3779b9) >>> 0), pick = a => a[Math.floor(R() * a.length)];
  const T = DJ_THEMES[theme] || DJ_THEMES.mine, coin = R() < 0.5 ? 1 : 0, nFight = o.rooms || 5 + coin, withBoss = o.boss !== false;
  let rooms = null;
  for (let attempt = 0; attempt < 50 && !rooms; attempt++) {
    const list = [{ k: 'entree', w: 8, h: 8, shape: 'rect', kind: 'start', x: 0, y: 0 }];
    let ok = true;
    for (let i = 0; i < nFight + (withBoss ? 1 : 0) && ok; i++) {
      const prev = list[list.length - 1], boss = i === nFight, t = boss ? DJ_BOSS : pick(DJ_ROOMS);
      let placed = null;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const dir = pick(['E', 'E', 'E', 'N', 'S']), gap = 4 + Math.floor(R() * 4);
        const x = dir === 'E' ? prev.x + prev.w + gap : prev.x + Math.floor(R() * 7) - 3;
        const y = dir === 'E' ? prev.y + Math.floor(R() * 9) - 4 : dir === 'N' ? prev.y - t.h - gap : prev.y + prev.h + gap;
        const c = { k: t.k, w: t.w, h: t.h, shape: t.shape, kind: boss ? 'boss' : 'fight', x, y };
        /* Le donjon reste ramassé (au plus ≈ 92 × 60 cases) : moins de marche, plus de combat. */
        const all = list.concat([c]), bw = Math.max(...all.map(r => r.x + r.w)) - Math.min(...all.map(r => r.x)), bh = Math.max(...all.map(r => r.y + r.h)) - Math.min(...all.map(r => r.y));
        if (bw <= (attempt < 30 ? 88 : 140) && bh <= (attempt < 30 ? 56 : 110) && !list.some(r => c.x < r.x + r.w + 2 && c.x + c.w + 2 > r.x && c.y < r.y + r.h + 2 && c.y + c.h + 2 > r.y)) placed = c;
      }
      if (placed) list.push(placed); else ok = false;
    }
    if (ok) rooms = list;
  }
  /* Salle annexe : accrochée à une salle du milieu (trésor, ou prisonnier, rare). */
  const prisoner = R() < DJ_PRISONER_CHANCE(lvl);
  for (let i = 2; i < rooms.length - 1; i++) {
    const host = rooms[i], w = 7, h = 6, g = 4, opts = [[host.x + (host.w >> 1) - 3, host.y - h - g], [host.x + (host.w >> 1) - 3, host.y + host.h + g], [host.x - w - g, host.y + (host.h >> 1) - 3], [host.x + host.w + g, host.y + (host.h >> 1) - 3]];
    const spot = opts.find(([x, y]) => !rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y));
    if (spot) { rooms.push({ k: prisoner ? 'cachot' : 'tresor', w, h, shape: 'rect', kind: prisoner ? 'prisoner' : 'treasure', x: spot[0], y: spot[1], host: i }); break; }
  }
  /* Grille : on décale tout pour commencer à (2, 2). */
  const minX = Math.min(...rooms.map(r => r.x)) - 2, minY = Math.min(...rooms.map(r => r.y)) - 2;
  for (const r of rooms) { r.x -= minX; r.y -= minY; }
  const W = Math.max(...rooms.map(r => r.x + r.w)) + 2, H = Math.max(...rooms.map(r => r.y + r.h)) + 2;
  const grid = new Uint8Array(W * H);
  for (const r of rooms) r.cells = djCarve(grid, W, r.x, r.y, r.w, r.h, r.shape);
  const chain = rooms.filter(r => r.host == null);
  for (let i = 1; i < chain.length; i++) djCorridor(grid, W, djCenter(chain[i - 1]), djCenter(chain[i]));
  for (const r of rooms) if (r.host != null) djCorridor(grid, W, djCenter(rooms[r.host]), djCenter(r));
  /* Contenu : monstres (3 à 6 par salle de combat), pièges, coffres, autel, boss. */
  const inner = r => r.cells.filter(([x, y]) => x > r.x + 1 && x < r.x + r.w - 2 && y > r.y + 1 && y < r.y + r.h - 2);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const weights = T.monsters.map(k => DJ_MONSTERS[k].w), wsum = weights.reduce((a, b) => a + b, 0);
  const monsterType = () => { let x = R() * wsum; for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return T.monsters[i]; } return T.monsters[0]; };
  let mid = 1;
  const monsters = [], traps = [], chests = [];
  /* Vagues : la 1re attend dans la salle ; les suivantes sortent des galeries quand la précédente est vaincue.
     2 vagues dans les premières salles, 3 dans les dernières. */
  let fi = 0;
  rooms.forEach((r, ri) => {
    const free = shuffle(inner(r).slice());
    if (r.kind === 'fight') {
      const waves = fi < Math.ceil(nFight / 2) ? 2 : 3; fi++;
      const edge = shuffle(r.cells.filter(([x, y]) => x <= r.x + 1 || x >= r.x + r.w - 2 || y <= r.y + 1 || y >= r.y + r.h - 2));
      let used = 0;
      for (let w = 0; w < waves; w++) {
        const n = w === 0 ? 3 + Math.floor(R() * 3) : 3 + Math.floor(R() * 2), pool = w === 0 ? free : edge;
        for (let i = 0; i < n; i++) {
          const c = pool[(w === 0 ? i : used++) % pool.length];
          monsters.push({ id: mid++, room: ri, type: monsterType(), x: c[0] + 0.5, y: c[1] + 0.5, wave: w });
        }
      }
      if (R() < 0.5) for (const c of free.slice(6, 8)) traps.push({ room: ri, x: c[0], y: c[1] });
    } else if (r.kind === 'boss') monsters.push({ id: mid++, room: ri, type: T.boss, boss: true, x: r.x + r.w / 2, y: r.y + r.h / 2, wave: 0 });
    else if (r.kind === 'treasure') for (const c of free.slice(0, 2)) chests.push({ room: ri, x: c[0] + 0.5, y: c[1] + 0.5 });
  });
  const altarRoom = chain.length > 4 ? 2 + Math.floor(R() * (chain.length - 4)) : null;
  const altar = altarRoom != null ? djCenter(chain[altarRoom]) : null;
  const pris = rooms.find(r => r.kind === 'prisoner');
  return { seed, lvl, theme: DJ_THEMES[theme] ? theme : 'mine', W, H, grid, rooms, start: djCenter(rooms[0]), monsters, traps, chests, altar,
    prisoner: pris ? djCenter(pris) : null, exitRoom: rooms.indexOf(chain[chain.length - 1]), floor: o.floor || 0 };
}
/* Cases atteignables depuis l'entrée (pour vérifier qu'aucune salle n'est coupée du reste). */
function djReach(d) {
  const seen = new Uint8Array(d.W * d.H), q = [d.start[1] * d.W + d.start[0]]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % d.W, y = (i / d.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * d.W + nx; if (nx >= 0 && ny >= 0 && nx < d.W && ny < d.H && !seen[ni] && d.grid[ni]) { seen[ni] = 1; q.push(ni); } }
  }
  return seen;
}

/* ===================== DONJONS : combat (pur, sans DOM) =====================
   20 pas par seconde. Le hasard vient de la graine : même départ et mêmes commandes = même combat.
   Coordonnées en cases (x vers l'est, y vers le sud) ; une entité = un cercle de rayon r. */
const DJ_DT = 0.05;
const DJ_POTION = 0.4;                                             // une potion rend 40 % de la vie
const djMul = lvl => Math.pow(1.1, Math.max(0, lvl - 1));          // héros : +10 % de vie et de dégâts par niveau
const djMobMul = lvl => Math.pow(1.12, Math.max(0, lvl - 1)) * (lvl <= 1 ? 0.85 : lvl === 2 ? 0.93 : 1);   // monstres : +12 % par niveau (les héros ont aussi leurs compétences) ; les 2 premiers niveaux plus doux
const djXpMul = lvl => 1 + 0.25 * (lvl - 1);                       // expérience selon le niveau du donjon
const djLootMul = lvl => 1 + 0.2 * (lvl - 1);
const DJ_CHEST = { pierre: 30, bois: 20 }, DJ_BOSS_LOOT = { pierre: 80, bois: 50, viande: 30 };
const DJ_BLESS = { force: 'Force : +20 % de dégâts', vigueur: 'Vigueur : +20 % de vie, soins complets', celerite: 'Célérité : plus rapide, compétences plus vite prêtes' };
/* Classes en donjon, au niveau 1 (cd : secondes entre deux attaques ; portée en cases). */
const DJ_CLASS = {
  guerrier: { hp: 340, dmg: 14, armor: 0.25, range: 1.5, cd: 1.0, speed: 4.0 },
  paladin: { hp: 320, dmg: 13, armor: 0.22, range: 1.5, cd: 1.0, speed: 3.9 },
  rodeur: { hp: 230, dmg: 10, armor: 0.05, range: 6.5, cd: 0.85, speed: 4.3, shot: 'arrow' },
  mage: { hp: 200, dmg: 13, armor: 0, range: 6, cd: 1.1, speed: 4.0, shot: 'fire', splash: 1.3 },
  voleur: { hp: 260, dmg: 8, armor: 0.15, range: 1.4, cd: 0.6, speed: 4.4, crit: 0.15, dodge: 0.1 },
  pretre: { hp: 210, dmg: 10, armor: 0.05, range: 5.5, cd: 1.1, speed: 4.0, shot: 'holy' },
  druide: { hp: 250, dmg: 10, armor: 0.1, range: 5, cd: 1.0, speed: 4.0, shot: 'thorn' },
  necro: { hp: 200, dmg: 9, armor: 0.05, range: 6, cd: 1.2, speed: 4.0, shot: 'shadow' },
};
/* Compétences, dans l'ordre de CLASSES[cls].skills. Chaque rang au-dessus du 1er : +15 % de puissance, −5 % de recharge.
   dmg : multiple des dégâts du héros ; rad : rayon ; range : portée (il faut une cible) ; dur : durée. */
const DJ_SKILLS = {
  guerrier: [{ id: 'charge', cd: 7, range: 7, dmg: 1.5, stun: 1.5 }, { id: 'tourbillon', cd: 8, rad: 2.2, dmg: 2 }, { id: 'cri', cd: 14, rad: 7, dur: 5, armor: 0.3, taunt: 4 }],
  paladin: [{ id: 'marteau', cd: 6, range: 6, dmg: 1.6, stun: 1.5 }, { id: 'bouclier', cd: 12, abs: 0.35, dur: 6 }, { id: 'consecration', cd: 14, rad: 2.5, dur: 5, dps: 0.5, hps: 0.03 }],
  rodeur: [{ id: 'roulade', cd: 6, dist: 3.5, dmg: 1, n: 2 }, { id: 'pluie', cd: 10, range: 7, rad: 2.5, dur: 3, dps: 1.2 }, { id: 'percant', cd: 8, range: 9, dmg: 2.5 }],
  mage: [{ id: 'boule', cd: 6, range: 7, rad: 1.8, dmg: 1.8 }, { id: 'nova', cd: 10, rad: 3, dmg: 0.8, frz: 2.5 }, { id: 'tp', cd: 9, dist: 5 }],
  voleur: [{ id: 'ombre', cd: 6, range: 7, dmg: 2.5 }, { id: 'poison', cd: 12, dur: 6, dps: 0.4, pt: 3 }, { id: 'fumee', cd: 14, dur: 3 }],
  pretre: [{ id: 'lumiere', cd: 5, heal: 0.25 }, { id: 'chatiment', cd: 6, range: 7, dmg: 2.4 }, { id: 'priere', cd: 16, heal: 0.35 }],
  druide: [{ id: 'ours', cd: 15, dur: 8 }, { id: 'loup', cd: 15, dur: 8 }, { id: 'racines', cd: 11, rad: 3.5, dmg: 0.6, root: 3 }],
  necro: [{ id: 'squelettes', cd: 18, n: 3, dur: 15, hp: 0.35, dmg: 0.5 }, { id: 'drain', cd: 7, range: 7, dmg: 2 }, { id: 'cadavre', cd: 8, range: 7, rad: 2.2, dmg: 2.5 }],
};
const DJ_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DJ_D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/* ---------- outils ---------- */
function djRnd(st) { const a = st.rs = (st.rs + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const djDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function djWalk(st, x, y) { const d = st.d, cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= d.W || cy >= d.H) return false; const k = cy * d.W + cx; return d.grid[k] === 1 && !st.door[k]; }
/* Le cercle tient-il sur des cases libres ? (coins, et milieux des côtés pour les gros) */
function djFree(st, x, y, r) {
  const n = r > 0.45 ? 2 : 1;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { if (i > 0 && i < n && j > 0 && j < n) continue; if (!djWalk(st, x - r + 2 * r * i / n, y - r + 2 * r * j / n)) return false; }
  return true;
}
/* Déplacement qui glisse le long des murs (par petits pas, pour ne jamais en traverser un). */
function djMove(st, e, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.25)); let moved = false;
  for (let i = 0; i < n; i++) {
    const sx = dx / n, sy = dy / n;
    if (sx && djFree(st, e.x + sx, e.y, e.r)) { e.x += sx; moved = true; }
    if (sy && djFree(st, e.x, e.y + sy, e.r)) { e.y += sy; moved = true; }
  }
  return moved;
}
/* Ligne de vue (les grilles fermées n'arrêtent le regard que si doors est vrai). */
function djLos(st, x0, y0, x1, y1, doors) {
  const d = st.d, dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.3);
  for (let i = 1; i < n; i++) { const k = Math.floor(y0 + dy * i / n) * d.W + Math.floor(x0 + dx * i / n); if (!d.grid[k] || (doors && st.door[k])) return false; }
  return true;
}
/* Dégage une entité coincée dans un mur ou une grille : vers la case libre la plus proche (de préférence dans la salle ri). */
function djUnstick(st, e, ri) {
  const cx = Math.floor(e.x), cy = Math.floor(e.y), W = st.d.W;
  for (const strict of ri != null ? [true, false] : [false]) {
    let best = null, bd = 1e9;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx + 0.5, y = cy + dy + 0.5, d = Math.hypot(x - e.x, y - e.y);
      if (d >= bd || (strict && st.roomAt[(cy + dy) * W + cx + dx] !== ri) || !djFree(st, x, y, e.r)) continue;
      bd = d; best = [x, y];
    }
    if (best) { e.x = e.px = best[0]; e.y = e.py = best[1]; if (e.kind === 'hero') e.tp = (e.tp || 0) + 1; return true; }
  }
  return false;
}
/* Une case libre de la salle, loin des héros (pour faire sortir ou replacer un monstre). */
function djRoomSpot(st, ri, r) {
  const cells = st.d.rooms[ri].cells, n = cells.length, k0 = Math.floor(djRnd(st) * n);
  let fallback = null;
  for (let i = 0; i < n; i++) {
    const c = cells[(k0 + i * 7) % n], x = c[0] + 0.5, y = c[1] + 0.5;
    if (!djFree(st, x, y, r)) continue;
    if (!st.heroes.some(h => !h.dead && Math.hypot(h.x - x, h.y - y) < 2.5)) return [x, y];
    fallback = fallback || [x, y];
  }
  return fallback;
}
const djEnt = (st, id) => st.heroes.find(e => e.id === id) || st.mobs.find(e => e.id === id) || st.allies.find(e => e.id === id) || null;
const djLiving = st => st.mobs.filter(m => m.hp > 0 && m.awake);
const djAround = (st, x, y, r) => st.mobs.filter(m => m.hp > 0 && m.awake && Math.hypot(m.x - x, m.y - y) <= r + m.r);
const djFoes = st => st.heroes.filter(h => !h.dead).concat(st.allies.filter(a => a.kind === 'skel' && a.hp > 0));
const djWeakest = st => st.heroes.filter(h => !h.dead).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] || null;
const djHpMax = (st, h) => h.hpBase * (h.form === 'ours' ? 1.3 : 1) * (st.bless === 'vigueur' ? 1.2 : 1);
function djNearest(st, e, max) {
  let best = null, bd = max;
  for (const m of st.mobs) { if (m.hp <= 0 || !m.awake) continue; const d = djDist(e, m) - m.r; if (d < bd && djLos(st, e.x, e.y, m.x, m.y)) { bd = d; best = m; } }
  return best;
}
/* Un spectre esquive parfois les attaques simples. */
function djEvade(st, m) { if (m.evade && djRnd(st) < m.evade) { st.ev.push({ k: 'miss', id: m.id }); return true; } return false; }
/* Cible d'un héros (attaque automatique et compétences) : d'abord les chamans à portée (sinon ils soignent tout le monde),
   puis la même cible que tout à l'heure, sinon la plus proche (un monstre presque mort passe un peu devant). */
function djTargetFor(st, h, range) {
  const ok = m => m.hp > 0 && m.awake && djDist(h, m) - m.r <= range && djLos(st, h.x, h.y, m.x, m.y);
  const cur = h.tgt && st.mobs.find(m => m.id === h.tgt), healer = st.mobs.some(m => (m.heals || m.raises) && ok(m));
  if (cur && ok(cur) && (cur.heals || cur.raises || !healer)) return cur;
  let best = null, bs = 1e9;
  for (const m of st.mobs) { if (!ok(m)) continue; const sc = djDist(h, m) - m.r - (m.heals || m.raises ? 4 : 0) - (m.hp < m.hpMax * 0.3 ? 1 : 0); if (sc < bs) { bs = sc; best = m; } }
  return best;
}
function djLootAdd(st, base, mul) { const got = {}; for (const k in base) { const n = Math.round(base[k] * mul); st.loot[k] = (st.loot[k] || 0) + n; got[k] = n; } return got; }

/* ---------- départ ---------- */
/* Un héros du village devient un combattant : statistiques selon la classe, le niveau, la race, les passifs et la spécialisation. */
function djHero(h) {
  const C = DJ_CLASS[h.cls] || DJ_CLASS.guerrier, lvl = Math.max(1, Math.min(HERO_MAX_LVL, h.lvl | 0)), pw = djMul(lvl), at = l => lvl >= l;
  const cls = DJ_CLASS[h.cls] ? h.cls : 'guerrier', race = RACES[h.race] ? h.race : 'humain', sk = h.sk || {};
  const sp = lvl >= SPEC_LVL && (h.spec === 0 || h.spec === 1) ? h.spec : null, spec = (c, s) => cls === c && sp === s;
  const hp = C.hp * pw * (race === 'nain' ? 1.15 : 1);
  let dmg = C.dmg * pw, armor = C.armor + (cls === 'guerrier' && at(4) ? 0.1 : 0);
  if (spec('guerrier', 0)) { dmg *= 1.2; armor -= 0.05; }
  if (spec('guerrier', 1)) armor += 0.1;
  if (spec('paladin', 0)) dmg *= 1.15;
  if (spec('rodeur', 0)) dmg *= 1.2;
  if (spec('pretre', 1)) dmg *= 1.3;
  return {
    id: h.id, own: h.own || '', name: h.name || '', race, cls, sex: h.sex === 'f' ? 'f' : 'm', col: h.col || COLORS[0], lvl, spec: sp, kind: 'hero',
    x: 0, y: 0, px: 0, py: 0, r: 0.35, fx: 1, fy: 0, hpBase: hp, hpMax: hp, hp, dmg, armor,
    range: C.range * (cls === 'rodeur' && at(4) ? 1.1 : 1), cdAtk: C.cd,
    speed: C.speed * (race === 'elfe' ? 1.1 : 1) * (cls === 'rodeur' && at(7) ? 1.1 : 1),
    crit: (C.crit || 0.05) + (race === 'halfelin' ? 0.05 : 0) + (cls === 'voleur' && at(4) ? 0.1 : 0), critMul: spec('voleur', 0) ? 2.5 : 2,
    dodge: (C.dodge || 0) + (race === 'elfe' ? 0.1 : 0) + (cls === 'voleur' && at(7) ? 0.1 : 0), taken: cls === 'mage' && at(7) ? 0.9 : 1,
    cdMul: cls === 'mage' && at(4) ? 0.9 : 1,
    heal: (cls === 'paladin' && at(4) ? 1.1 : 1) * (cls === 'pretre' && at(7) ? 1.15 : 1) * (spec('paladin', 1) ? 1.2 : 1) * (spec('pretre', 0) ? 1.25 : 1),
    regen: cls === 'druide' && at(4) ? 0.01 : 0, instinct: cls === 'druide' && at(7), souffle: cls === 'guerrier' && at(7), moisson: cls === 'necro' && at(7), aura: cls === 'paladin' && at(7),
    rank: [0, 1, 2].map(i => lvl >= SKILL_LVLS[i] ? 1 + Math.max(0, Math.min(4, sk['s' + i] | 0)) : 0),
    cd: [0, 0, 0], cdMax: [1, 1, 1], atkT: 0, tgt: 0, pot: lvl >= 2 ? 4 : 3, potT: 0, b: {}, criA: 0, shield: 0, form: null,
    dead: false, revived: false, mv: false, atkN: 0, castN: 0, lastCast: '',
    tp: 0, rev: 0, gone: false, remote: false,   // à deux : téléportations (le téléphone de l'autre se recale), relève, départ, héros piloté à distance
  };
}
function djMob(st, type, x, y, room, boss) {
  const D = (boss ? DJ_BOSSES : DJ_MONSTERS)[type], mk = djMobMul(st.lvl), pk = st.pk || 1;
  return { id: st.nid++, type, kind: 'mob', room, x, y, px: x, py: y, r: boss ? 0.75 : D.big ? 0.6 : 0.38,
    hp: D.hp * mk * pk, hpMax: D.hp * mk * pk, dmg: D.dmg * mk, range: D.range, rate: D.rate, speed: D.speed, xp: D.xp,
    ranged: !!D.ranged, heals: !!D.heals, raises: !!D.raises, evade: D.evade || 0, big: !!D.big, boss: !!boss, awake: false, wave: 0, hidden: false,
    shot: D.shot || (D.heals || D.raises ? 'curse' : 'arrow'),
    atkT: 0.4 + djRnd(st) * D.rate, wind: 0, act: null, actTgt: 0, tgt: 0, stun: 0, frz: 0, root: 0, poi: 0, poiD: 0, poiAcc: 0, taunt: 0, tauntBy: 0,
    fx: 0, fy: 1, mv: false, atkN: 0,
    sp: boss ? { slam: 4, charge: 8, phase: 0, enr: false, act: null, actT: 0, dx: 0, dy: 0, hit: [] } : null };
}
/* Début du combat. heroes : héros du village (un en solo, deux à deux). opts : { seed, dmgMul (dégâts des monstres), remote (id du héros piloté par l'autre téléphone) }.
   À deux, les monstres ont 70 % de vie en plus. */
function djStart(d, heroes, opts) {
  const o = opts || {}, W = d.W;
  const st = {
    d, lvl: d.lvl, t: 0, n: 0, rs: ((o.seed != null ? o.seed : d.seed) ^ 0x51ed270b) >>> 0, nid: 1, over: null, endT: 0, fled: false, dmgMul: o.dmgMul || 1,
    heroes: heroes.map(djHero), mobs: [], allies: [], shots: [], zones: [], corpses: [], ev: [],
    rooms: d.rooms.map(r => ({ st: r.kind === 'fight' || r.kind === 'boss' ? 'idle' : 'open', out: 0, wave: 0, waves: 1, waveT: 0 })),
    door: new Uint8Array(W * d.H), roomAt: new Int16Array(W * d.H).fill(-1), doors: [],
    chests: d.chests.map(c => ({ x: c.x, y: c.y, room: c.room, open: false })),
    altar: d.altar ? { x: d.altar[0] + 0.5, y: d.altar[1] + 0.5, used: false } : null,
    pris: d.prisoner ? { x: d.prisoner[0] + 0.5, y: d.prisoner[1] + 0.5, freed: false } : null,
    traps: d.traps.map((t, i) => ({ x: t.x, y: t.y, ph: (i * 0.37) % 2.4, on: false, hit: {} })),
    exit: null, bless: null, xp: 0, loot: {}, kills: 0, flow: null, flowN: -99, boss: 0, calmT: 0,
    pk: 1 + 0.7 * (heroes.length - 1),
  };
  for (const h of st.heroes) if (o.remote && h.id === o.remote) h.remote = true;
  d.rooms.forEach((r, ri) => { for (const [x, y] of r.cells) st.roomAt[y * W + x] = ri; });
  /* Grilles : les cases de couloir qui touchent une salle se ferment quand le combat y commence. */
  st.doors = d.rooms.map(r => { const out = []; for (const [x, y] of r.cells) for (const [dx, dy] of DJ_D4) { const k = (y + dy) * W + x + dx; if (d.grid[k] && st.roomAt[k] < 0 && !out.includes(k)) out.push(k); } return out; });
  for (const m of d.monsters) {
    const mob = djMob(st, m.type, m.x, m.y, m.room, !!m.boss); mob.wave = m.wave || 0; mob.hidden = mob.wave > 0; st.mobs.push(mob);
    if (mob.boss) st.boss = mob.id;
    st.rooms[m.room].waves = Math.max(st.rooms[m.room].waves, mob.wave + 1);
  }
  if (st.heroes.some(h => h.cls === 'pretre' && h.lvl >= 4)) for (const h of st.heroes) { h.hpBase *= 1.1; h.hpMax = h.hp = h.hpBase; }   // Bénédiction
  /* Profondeurs : ce que chaque héros rapporte de l'étage précédent (vie, potions, relèvement utilisé, partie) */
  for (const h of st.heroes) {
    const c = o.carry && o.carry[h.id]; if (!c) continue;
    h.hp = Math.max(1, Math.min(1, c.hp) * h.hpMax); h.pot = Math.max(0, Math.min(h.pot, c.pot)); h.revived = !!c.revived;
    if (c.gone) { h.gone = true; h.dead = true; h.hp = 0; }
  }
  st.heroes.forEach((h, i) => { h.x = h.px = d.start[0] + 0.5 + (i ? 1.2 : 0); h.y = h.py = d.start[1] + 0.5 + (i ? 0.6 : 0); });
  /* Le familier (niveau 6) : il suit son héros et mord sa cible ; les monstres ne s'en occupent pas. */
  for (const h of st.heroes) if (h.lvl >= 6) st.allies.push({ id: st.nid++, kind: 'pet', own: h.id, x: h.x - 0.8, y: h.y + 0.8, px: h.x - 0.8, py: h.y + 0.8, r: 0.25, hp: 1, hpMax: 1,
    dmg: h.dmg * 0.35 * (h.cls === 'rodeur' && h.spec === 1 ? 3 : 1), range: 1.1, rate: 1.2, speed: 5.5, atkT: 0, t: 1e9, inv: true, tgt: 0, mv: false, atkN: 0 });
  return st;
}

/* ---------- dégâts, soins, effets ---------- */
/* kind : 'skill' (compétence), 'basic' (attaque simple), 'dot' (zone, poison : pas de combo). */
function djHurt(st, m, v, src, crit, kind) {
  if (!m || m.hp <= 0 || !(v > 0)) return 0;
  /* Combo à deux : un monstre marqué par une compétence de l'autre héros (ou étourdi, gelé, enraciné par lui) prend 50 % de plus.
     Une compétence marque à son tour le monstre pour l'autre (3 secondes). */
  if (src && src.kind === 'hero' && st.heroes.length > 1 && kind && kind !== 'dot') {
    const mk = m.mark && m.mark.by !== src.id && m.mark.t > st.t, cc = m.ccBy && m.ccBy !== src.id && (m.stun > 0 || m.frz > 0 || m.root > 0);
    if (mk || cc) { v *= 1.5; st.combos = (st.combos || 0) + 1; if (mk) m.mark = null; st.ev.push({ k: 'combo', id: m.id, by: src.id }); }
    if (kind === 'skill') m.mark = { by: src.id, t: st.t + 3 };
  }
  const dealt = Math.min(v, m.hp);
  m.hp -= v; st.ev.push({ k: 'hit', id: m.id, v: Math.round(v), crit: !!crit });
  if (m.hp <= 0) djKill(st, m);
  return dealt;
}
function djKill(st, m) {
  m.hp = 0; st.kills++; st.xp += m.xp * djXpMul(st.lvl);
  st.corpses.push({ x: m.x, y: m.y, t: st.t }); if (st.corpses.length > 12) st.corpses.shift();
  st.ev.push({ k: 'die', id: m.id, x: m.x, y: m.y, boss: m.boss });
  for (const h of st.heroes) {
    if (h.dead) continue;
    if (h.souffle) djHeal(st, h, h.hpMax * 0.03);                               // Second souffle
    if (h.moisson) for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, h.cd[i] - 0.5);   // Moisson
  }
  if (m.boss) st.ev.push({ k: 'loot', got: djLootAdd(st, DJ_BOSS_LOOT, djLootMul(st.lvl)), x: m.x, y: m.y });
}
function djHeal(st, h, v) {
  if (!h || h.dead || !(v > 0)) return 0;
  const before = h.hp; h.hp = Math.min(h.hpMax, h.hp + v);
  if (h.hp - before >= 1) st.ev.push({ k: 'heal', id: h.id, v: Math.round(h.hp - before) });
  return h.hp - before;
}
/* Dégâts reçus par un héros, après esquive, armure et bouclier. */
function djHurtHero(st, h, v) {
  if (h.dead || h.b.inv > 0 || !(v > 0)) return 0;
  if (djRnd(st) < h.dodge) { st.ev.push({ k: 'miss', id: h.id }); return 0; }
  let ar = h.armor + (h.b.cri > 0 ? h.criA : 0) + (h.form === 'ours' ? 0.4 + (h.cls === 'druide' && h.spec === 0 ? 0.15 : 0) : 0);
  if (st.heroes.some(p => p.aura && !p.dead && djDist(p, h) <= 4)) ar += 0.1;          // Aura du paladin
  v *= (1 - Math.min(0.75, Math.max(0, ar))) * h.taken * st.dmgMul;
  if (h.shield > 0) { const a = Math.min(h.shield, v); h.shield -= a; v -= a; if (a >= 1) st.ev.push({ k: 'block', id: h.id, v: Math.round(a) }); }
  return djDamageHero(st, h, v);
}
function djDamageHero(st, h, v) {
  if (h.dead || !(v > 0)) return 0;
  h.hp -= v; st.ev.push({ k: 'hurt', id: h.id, v: Math.round(v) });
  if (h.hp <= 0) {
    if (h.race === 'mortvivant' && !h.revived) { h.revived = true; h.hp = h.hpMax * 0.4; h.b.inv = 1.5; st.ev.push({ k: 'revive', id: h.id }); }
    else { h.hp = 0; h.dead = true; h.form = null; h.mv = false; st.ev.push({ k: 'down', id: h.id }); }
  }
  return v;
}
function djRaise(st, h, frac, by) {
  h.dead = false; h.hp = Math.max(1, h.hpMax * frac); h.rev = 0; h.b = { inv: 1.5 };
  st.ev.push({ k: 'raise', id: h.id, by });
}
function djHit(st, t, v) {
  if (t.kind === 'hero') return djHurtHero(st, t, v);
  if (t.inv || t.hp <= 0) return 0;
  t.hp -= v * st.dmgMul; st.ev.push({ k: 'hit', id: t.id, v: Math.round(v * st.dmgMul), ally: true });
  if (t.hp <= 0) { t.hp = 0; st.ev.push({ k: 'die', id: t.id, x: t.x, y: t.y }); }
  return v;
}
/* Étourdi, gelé (ne fait plus rien) ou enraciné (ne bouge plus). Le boss y résiste en partie ; ça interrompt ses attaques spéciales. */
function djCC(st, m, kind, s, by) {
  if (!m || m.hp <= 0) return;
  if (by) m.ccBy = by;
  m[kind] = Math.max(m[kind], s * (m.boss ? (kind === 'stun' ? 0.3 : 0.5) : 1));
  if (kind !== 'root') { m.wind = 0; if (m.sp && m.sp.act) { m.sp.act = null; m.sp.slam = Math.max(m.sp.slam || 0, 2.5); m.sp.charge = Math.max(m.sp.charge || 0, 3); m.sp.storm = Math.max(m.sp.storm || 0, 2.5); st.ev.push({ k: 'interrupt', id: m.id }); st.ev.push({ k: 'teleCancel', id: m.id }); } }
  st.ev.push({ k: 'cc', id: m.id, c: kind, t: m[kind] });
}
function djPoison(st, h, m) {
  const S = DJ_SKILLS.voleur[1], P = 1 + 0.15 * ((h.rank[1] || 1) - 1);
  if (m.hp > 0) { m.poi = S.pt; m.poiD = Math.max(m.poiD, h.dmg * S.dps * P); }
}
/* Dégâts d'un coup de héros : passifs, autel, forme animale, coup critique. */
function djRoll(st, h, mult) {
  let k = mult;
  if (h.race === 'orque') k *= 1 + 0.25 * (1 - h.hp / h.hpMax);                     // Rage
  if (st.bless === 'force') k *= 1.2;
  if (h.form === 'ours') k *= 1.15 * (h.instinct ? 1.1 : 1);
  if (h.form === 'loup') k *= (h.spec === 1 ? 1.25 : 1) * (h.instinct ? 1.1 : 1);
  const crit = djRnd(st) < h.crit;
  return { v: h.dmg * k * (crit ? h.critMul : 1), crit };
}
function djSetForm(st, h, f) {
  h.form = f;
  const old = h.hpMax; h.hpMax = djHpMax(st, h);
  if (h.hpMax > old) h.hp += h.hpMax - old; else h.hp = Math.min(h.hp, h.hpMax);
  st.ev.push({ k: 'form', id: h.id, f });
}
function djPotion(st, h) {
  if (h.dead || h.pot <= 0 || h.potT > 0 || h.hp >= h.hpMax - 0.5) return false;
  h.pot--; h.potT = 1; djHeal(st, h, h.hpMax * DJ_POTION); st.ev.push({ k: 'potion', id: h.id });
  return true;
}
/* Endroit libre pour se téléporter, en ligne droite (sans traverser de mur ni de grille). */
function djBlinkSpot(st, h, ux, uy, dist) {
  for (let k = dist; k >= 1; k -= 0.25) { const x = h.x + ux * k, y = h.y + uy * k; if (djFree(st, x, y, h.r) && djLos(st, h.x, h.y, x, y, true)) return [x, y]; }
  return null;
}

/* ---------- compétences ---------- */
function djCast(st, h, i) {
  const S = DJ_SKILLS[h.cls] && DJ_SKILLS[h.cls][i];
  if (!S || h.dead || !h.rank[i] || h.cd[i] > 0) return false;
  const r = h.rank[i], P = 1 + 0.15 * (r - 1), L = 1 + 0.1 * (r - 1), D = mult => djRoll(st, h, mult * P);
  const shoot = (t, d, spd) => st.shots.push({ id: st.nid++, side: 'h', kind: DJ_CLASS[h.cls].shot || 'arrow', from: h.id, tgt: t.id, x: h.x, y: h.y, px: h.x, py: h.y, spd: spd || 14, dmg: d.v, crit: d.crit, life: 2 });
  let ok = true;
  switch (S.id) {
    case 'charge': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const x0 = h.x, y0 = h.y, dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1, go = Math.max(0, len - t.r - h.r - 0.15);
      djMove(st, h, dx / len * go, dy / len * go); h.fx = dx / len; h.fy = dy / len; h.b.inv = 0.25;
      st.ev.push({ k: 'dash', id: h.id, x0, y0, x1: h.x, y1: h.y });
      if (djDist(h, t) <= t.r + h.r + 0.8) { const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); djCC(st, t, 'stun', S.stun, h.id); }
      break;
    }
    case 'tourbillon':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'steel' }); break;
    case 'cri':
      for (const m of djAround(st, h.x, h.y, S.rad)) { m.taunt = S.taunt + (h.spec === 1 ? 2 : 0); m.tauntBy = h.id; }
      h.b.cri = S.dur * L; h.criA = S.armor * P;
      st.ev.push({ k: 'shout', id: h.id, x: h.x, y: h.y, r: S.rad }); break;
    case 'marteau': case 'chatiment': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.ev.push({ k: 'bolt', id: h.id, tgt: t.id, c: S.id });
      const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); if (S.stun) djCC(st, t, 'stun', S.stun, h.id);
      break;
    }
    case 'bouclier': {
      const t = djWeakest(st); if (!t) { ok = false; break; }
      t.shield = Math.max(t.shield, h.hpMax * S.abs * P * h.heal); t.b.shield = S.dur;
      st.ev.push({ k: 'shield', id: t.id, by: h.id }); break;
    }
    case 'consecration':
      st.zones.push({ id: st.nid++, k: 'cons', x: h.x, y: h.y, r: S.rad, t: S.dur, tick: 0, dps: h.dmg * S.dps * P, hps: S.hps * h.heal * P, own: h.id });
      st.ev.push({ k: 'zone', z: 'cons', x: h.x, y: h.y, r: S.rad, t: S.dur }); break;
    case 'roulade': {
      const t = djNearest(st, h, 8), x0 = h.x, y0 = h.y, dx = t ? h.x - t.x : -h.fx, dy = t ? h.y - t.y : -h.fy, len = Math.hypot(dx, dy) || 1;
      djMove(st, h, dx / len * S.dist, dy / len * S.dist); h.b.inv = 0.35;
      st.ev.push({ k: 'dash', id: h.id, x0, y0, x1: h.x, y1: h.y, roll: true });
      if (t) for (let n = 0; n < S.n; n++) shoot(t, D(S.dmg), 15 + n * 3);
      break;
    }
    case 'pluie': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.zones.push({ id: st.nid++, k: 'rain', x: t.x, y: t.y, r: S.rad, t: S.dur, tick: 0, dps: h.dmg * S.dps * P, own: h.id });
      st.ev.push({ k: 'zone', z: 'rain', x: t.x, y: t.y, r: S.rad, t: S.dur, from: h.id }); break;
    }
    case 'percant': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const dx = t.x - h.x, dy = t.y - h.y, len0 = Math.hypot(dx, dy) || 1, ux = dx / len0, uy = dy / len0;
      let len = 0; while (len < S.range && st.d.grid[Math.floor(h.y + uy * (len + 0.3)) * st.d.W + Math.floor(h.x + ux * (len + 0.3))]) len += 0.3;
      for (const m of djLiving(st)) { const ax = m.x - h.x, ay = m.y - h.y, p = ax * ux + ay * uy; if (p >= 0 && p <= len && Math.abs(ax * uy - ay * ux) <= 0.6 + m.r) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); } }
      st.ev.push({ k: 'line', id: h.id, x0: h.x, y0: h.y, x1: h.x + ux * len, y1: h.y + uy * len }); break;
    }
    case 'boule': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const x = t.x, y = t.y;
      for (const m of djAround(st, x, y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); if (h.spec === 0 && m.hp > 0) { m.poi = 3; m.poiD = Math.max(m.poiD, h.dmg * 0.5); } }
      st.ev.push({ k: 'boom', id: h.id, x, y, r: S.rad, c: 'fire' }); break;
    }
    case 'nova':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); djCC(st, m, 'frz', S.frz * (h.spec === 1 ? 1.5 : 1), h.id); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'ice' }); break;
    case 'tp': {
      const t = djNearest(st, h, 10), dx = t ? h.x - t.x : h.fx, dy = t ? h.y - t.y : h.fy, len = Math.hypot(dx, dy) || 1;
      const p = djBlinkSpot(st, h, dx / len, dy / len, S.dist); if (!p) { ok = false; break; }
      st.ev.push({ k: 'blink', id: h.id, x0: h.x, y0: h.y, x1: p[0], y1: p[1] });
      h.x = h.px = p[0]; h.y = h.py = p[1]; break;
    }
    case 'ombre': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1, k = t.r + h.r + 0.2;
      let nx = t.x + dx / len * k, ny = t.y + dy / len * k;
      if (!djFree(st, nx, ny, h.r)) { nx = h.x; ny = h.y; }
      st.ev.push({ k: 'blink', id: h.id, x0: h.x, y0: h.y, x1: nx, y1: ny });
      h.x = h.px = nx; h.y = h.py = ny; h.fx = -dx / len; h.fy = -dy / len;
      const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); if (h.b.poison > 0) djPoison(st, h, t);
      break;
    }
    case 'poison': h.b.poison = S.dur * L; st.ev.push({ k: 'buff', id: h.id, b: 'poison' }); break;
    case 'fumee':
      h.b.stealth = S.dur * L;
      for (const m of st.mobs) if (m.tgt === h.id || m.actTgt === h.id) { m.tgt = 0; m.wind = 0; }
      if (h.spec === 1) for (const m of djAround(st, h.x, h.y, 2.5)) djCC(st, m, 'stun', 1.5, h.id);
      st.ev.push({ k: 'smoke', id: h.id, x: h.x, y: h.y }); break;
    case 'lumiere': {
      const t = djWeakest(st); if (!t) { ok = false; break; }
      djHeal(st, t, t.hpMax * S.heal * P * h.heal); st.ev.push({ k: 'holy', id: t.id, by: h.id }); break;
    }
    case 'priere':
      for (const t of st.heroes) if (!t.dead) { djHeal(st, t, t.hpMax * S.heal * P * h.heal); st.ev.push({ k: 'holy', id: t.id, by: h.id }); }
      break;
    case 'ours': case 'loup': djSetForm(st, h, S.id); h.b.form = S.dur * L; break;
    case 'racines':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); djCC(st, m, 'root', S.root * L, h.id); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'root' }); break;
    case 'squelettes': {
      for (const a of st.allies) if (a.kind === 'skel' && a.own === h.id && a.hp > 0) { a.hp = 0; st.ev.push({ k: 'die', id: a.id, x: a.x, y: a.y }); }
      const n = S.n + (h.spec === 0 ? 1 : 0), hp = h.hpMax * S.hp * (h.lvl >= 4 ? 1.2 : 1) * (h.spec === 0 ? 1.3 : 1);
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.2832, x = h.x + Math.cos(a) * 1.1, y = h.y + Math.sin(a) * 1.1, free = djFree(st, x, y, 0.32);
        st.allies.push({ id: st.nid++, kind: 'skel', own: h.id, x: free ? x : h.x, y: free ? y : h.y, px: free ? x : h.x, py: free ? y : h.y, r: 0.32, hp, hpMax: hp,
          dmg: h.dmg * S.dmg * P, range: 1.2, rate: 1.0, speed: 3.8, atkT: 0.3, t: S.dur * L, tgt: 0, mv: false, atkN: 0 });
      }
      st.ev.push({ k: 'summon', id: h.id, x: h.x, y: h.y }); break;
    }
    case 'drain': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.ev.push({ k: 'drain', id: h.id, tgt: t.id });
      const d = D(S.dmg * (h.spec === 1 ? 1.3 : 1)); djHeal(st, h, djHurt(st, t, d.v, h, d.crit, 'skill')); break;
    }
    case 'cadavre': {
      const ref = djTargetFor(st, h, S.range) || h; let best = null, bd = 1e9;
      for (const c of st.corpses) { const dd = Math.hypot(c.x - ref.x, c.y - ref.y); if (Math.hypot(c.x - h.x, c.y - h.y) <= S.range && dd < bd) { bd = dd; best = c; } }
      if (!best) { ok = false; break; }
      st.corpses.splice(st.corpses.indexOf(best), 1);
      for (const m of djAround(st, best.x, best.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); }
      st.ev.push({ k: 'boom', id: h.id, x: best.x, y: best.y, r: S.rad, c: 'bone' }); break;
    }
    default: ok = false;
  }
  if (!ok) { st.ev.push({ k: 'nocast', id: h.id, i }); return false; }
  const cd = S.cd * (1 - 0.05 * (r - 1)) * h.cdMul * (st.bless === 'celerite' ? 0.85 : 1);
  h.cd[i] = cd; h.cdMax[i] = cd; h.castN++; h.lastCast = S.id;
  if (S.id === 'charge' || S.id === 'roulade' || S.id === 'tp' || S.id === 'ombre') h.tp = (h.tp || 0) + 1;
  st.ev.push({ k: 'cast', id: h.id, i, s: S.id });
  return true;
}

/* ---------- un pas de simulation ---------- */
function djHeroStep(st, h, inp) {
  const dt = DJ_DT;
  for (const k in h.b) { h.b[k] -= dt; if (h.b[k] <= 0) { delete h.b[k]; if (k === 'shield') h.shield = 0; if (k === 'form' && !h.dead) djSetForm(st, h, null); } }
  if (h.dead) return;
  if (!djFree(st, h.x, h.y, h.r)) djUnstick(st, h);
  for (let i = 0; i < 3; i++) if (h.cd[i] > 0) h.cd[i] = Math.max(0, h.cd[i] - dt);
  h.atkT -= dt; h.potT -= dt;
  if (h.regen) h.hp = Math.min(h.hpMax, h.hp + h.hpMax * h.regen * dt);   // Régénération (sans bulle)
  if (st.calmT > 1) h.hp = Math.min(h.hpMax, h.hp + h.hpMax * 0.1 * dt);   // entre deux combats, on reprend son souffle (10 % par seconde)
  if (inp.pot) djPotion(st, h);
  if (inp.sk != null && inp.sk >= 0) djCast(st, h, inp.sk);
  if (h.dead) return;
  let mx = +inp.mx || 0, my = +inp.my || 0; const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  const spd = h.speed * (h.form === 'loup' ? 1.25 : 1) * (st.bless === 'celerite' ? 1.15 : 1);
  const reach = h.form ? 1.6 : h.range;
  if (h.remote) {
    /* À deux : l'invitée déplace son héros sur son téléphone et envoie sa position (acceptée si la case est libre
       et si son téléphone a bien vu la dernière téléportation). */
    const p = inp.pos;
    if (p && (inp.tp | 0) === (h.tp | 0) && isFinite(p[0]) && isFinite(p[1]) && djFree(st, +p[0], +p[1], h.r)) { h.x = +p[0]; h.y = +p[1]; }
    if (p) { if (p[2] || p[3]) { h.fx = +p[2]; h.fy = +p[3]; } h.mv = !!p[4]; }
  } else if (m > 0.2) { h.mv = djMove(st, h, mx * spd * dt, my * spd * dt); h.fx = mx / Math.max(1, m); h.fy = my / Math.max(1, m); }
  else {
    h.mv = false;
    /* Au contact, joystick lâché : le héros s'avance vers le monstre le plus proche. */
    if (reach < 2) {
      const t = djNearest(st, h, 4.5);
      if (t && djDist(h, t) > reach + t.r) { const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy); h.mv = djMove(st, h, dx / len * spd * dt, dy / len * spd * dt); h.fx = dx / len; h.fy = dy / len; }
    }
  }
  /* Attaque automatique (même en marchant), sur la cible la plus proche à portée. */
  if (h.atkT <= 0) {
    const t = djTargetFor(st, h, reach);
    if (t) {
      h.tgt = t.id;
      const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1; if (!h.mv) { h.fx = dx / len; h.fy = dy / len; }
      const d = djRoll(st, h, 1); let v = d.v;
      if (h.b.stealth > 0) { v *= 2; delete h.b.stealth; st.ev.push({ k: 'unstealth', id: h.id }); }
      h.atkT = h.form === 'loup' ? 0.5 : h.form === 'ours' ? 1.1 : h.cdAtk; h.atkN++;
      st.ev.push({ k: 'atk', id: h.id, tgt: t.id });
      if (reach < 2) { if (!djEvade(st, t)) { djHurt(st, t, v, h, d.crit, 'basic'); if (h.b.poison > 0) djPoison(st, h, t); } }
      else st.shots.push({ id: st.nid++, side: 'h', kind: DJ_CLASS[h.cls].shot || 'arrow', from: h.id, tgt: t.id, x: h.x, y: h.y, px: h.x, py: h.y, spd: 14, dmg: v, crit: d.crit, life: 2, splash: DJ_CLASS[h.cls].splash || 0 });
    }
  }
}
function djAllyStep(st, a) {
  const dt = DJ_DT; if (!a.inv && a.hp <= 0) return;
  a.t -= dt;
  if (a.t <= 0) { a.hp = 0; st.ev.push({ k: 'die', id: a.id, x: a.x, y: a.y }); return; }
  const o = st.heroes.find(h => h.id === a.own); a.atkT -= dt;
  let t = null;
  if (a.kind === 'pet') { const ht = o && !o.dead && o.tgt ? st.mobs.find(m => m.id === o.tgt && m.hp > 0 && m.awake) : null; if (ht && djDist(o, ht) < 7) t = ht; }
  else t = djNearest(st, a, 7);
  const goTo = (x, y) => { const dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1; a.mv = djMove(st, a, dx / len * a.speed * dt, dy / len * a.speed * dt); a.fx = dx / len; a.fy = dy / len; };
  if (t) {
    if (djDist(a, t) > a.range + t.r + a.r) goTo(t.x, t.y);
    else { a.mv = false; a.fx = t.x - a.x; a.fy = t.y - a.y; if (a.atkT <= 0) { a.atkT = a.rate; a.atkN++; st.ev.push({ k: 'atk', id: a.id, tgt: t.id }); djHurt(st, t, a.dmg, a, false); } }
  } else if (o && !o.dead && djDist(a, o) > 1.8) goTo(o.x, o.y);
  else a.mv = false;
}
/* Cible d'un monstre : celui qui l'a provoqué, sinon le plus proche (héros ou squelette ; il ne lâche pas sa cible pour un rien). */
function djMobTarget(st, m) {
  if (m.taunt > 0) { const h = st.heroes.find(x => x.id === m.tauntBy && !x.dead); if (h) return h; }
  let best = null, bd = 1e9;
  for (const e of djFoes(st)) { if (e.b && e.b.stealth > 0) continue; const d = djDist(m, e) - (e.id === m.tgt ? 1.5 : 0); if (d < bd) { bd = d; best = e; } }
  return best;
}
/* Champ de distances vers les héros (recalculé 5 fois par seconde) : les monstres le suivent quand ils ne voient pas leur cible. */
function djFlow(st) {
  const d = st.d, W = d.W, N = W * d.H;
  if (!st.flow || st.flow.length !== N) st.flow = new Float32Array(N);
  const F = st.flow; F.fill(1e9);
  const q = [];
  for (const h of st.heroes) { if (h.dead || h.b.stealth > 0) continue; const k = Math.floor(h.y) * W + Math.floor(h.x); if (F[k]) { F[k] = 0; q.push(k); } }
  const open = k => d.grid[k] && !st.door[k];
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % W, y = (k / W) | 0, nd = F[k] + 1;
    for (const [dx, dy] of DJ_D8) {
      const nx = x + dx, ny = y + dy, nk = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= d.H || F[nk] <= nd || !open(nk)) continue;
      if (dx && dy && (!open(y * W + nx) || !open(ny * W + x))) continue;
      F[nk] = nd; q.push(nk);
    }
  }
  st.flowN = st.n;
}
/* Le passage est-il assez large pour ce monstre, en ligne droite jusqu'à (x, y) ? */
function djFatLos(st, e, x, y) {
  const dx = x - e.x, dy = y - e.y, n = Math.ceil(Math.hypot(dx, dy) / 0.25);
  for (let i = 1; i <= n; i++) if (!djFree(st, e.x + dx * i / n, e.y + dy * i / n, e.r)) return false;
  return true;
}
/* Suit le champ de distances sur quelques cases et vise la plus lointaine qu'on peut atteindre tout droit (contourne bien les piliers). */
function djPathPoint(st, m) {
  const W = st.d.W, F = st.flow; let cx = Math.floor(m.x), cy = Math.floor(m.y); const pts = [];
  for (let s = 0; s < 5; s++) {
    let best = F[cy * W + cx], bx = 0, by = 0;
    for (const [ox, oy] of DJ_D8) { const k = (cy + oy) * W + cx + ox; if (F[k] < best) { best = F[k]; bx = ox; by = oy; } }
    if (!bx && !by) break;
    cx += bx; cy += by; pts.push([cx + 0.5, cy + 0.5]);
  }
  for (let i = pts.length - 1; i > 0; i--) if (djFatLos(st, m, pts[i][0], pts[i][1])) return pts[i];
  return pts[0] || null;
}
function djSteer(st, m, t, away) {
  let dx = t.x - m.x, dy = t.y - m.y;
  if (away) { dx = -dx; dy = -dy; }
  else if (!djLos(st, m.x, m.y, t.x, t.y) || (m.r > 0.45 && !djFatLos(st, m, m.x + dx * Math.min(1, 1.5 / (Math.hypot(dx, dy) || 1)), m.y + dy * Math.min(1, 1.5 / (Math.hypot(dx, dy) || 1))))) {
    const p = djPathPoint(st, m);
    if (!p) { m.mv = false; return; }
    dx = p[0] - m.x; dy = p[1] - m.y;
  }
  if (m.root > 0) { m.mv = false; return; }
  const len = Math.hypot(dx, dy) || 1, sp = m.speed * DJ_DT;
  m.mv = djMove(st, m, dx / len * sp, dy / len * sp); m.fx = dx / len; m.fy = dy / len;
}
function djMobStep(st, m) {
  const dt = DJ_DT;
  if (m.poi > 0) {
    m.poi -= dt; m.poiAcc += m.poiD * dt;
    if (m.poiAcc >= 3 || m.poi <= 0) { const v = m.poiAcc; m.poiAcc = 0; djHurt(st, m, v, null, false); if (m.hp <= 0) return; }
    if (m.poi <= 0) m.poiD = 0;
  }
  if (m.stun > 0) m.stun -= dt; if (m.frz > 0) m.frz -= dt; if (m.root > 0) m.root -= dt; if (m.taunt > 0) m.taunt -= dt;
  if (!m.awake || m.hp <= 0) return;
  m.atkT -= dt;
  /* Sécurité : un monstre hors de sa salle fermée, ou bloqué depuis 5 s, est replacé dans la salle. */
  const R = st.rooms[m.room];
  if (!m.chk) m.chk = { x: m.x, y: m.y, t: st.t, a: m.atkN };
  let stuck = false;
  if (st.t - m.chk.t >= 4) { stuck = Math.hypot(m.x - m.chk.x, m.y - m.chk.y) < 0.6 && m.atkN === m.chk.a && !(m.sp && m.sp.act); m.chk = { x: m.x, y: m.y, t: st.t, a: m.atkN }; }
  if (R && R.st === 'lock' && (stuck || st.roomAt[Math.floor(m.y) * st.d.W + Math.floor(m.x)] !== m.room)) {
    const p = djRoomSpot(st, m.room, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; st.ev.push({ k: 'spawn', id: m.id, x: m.x, y: m.y }); }
  }
  if (m.stun > 0 || m.frz > 0) { m.mv = false; m.wind = 0; return; }
  if (m.boss && djBossStep(st, m)) return;
  /* Coup en préparation : il part à la fin (on peut l'esquiver en s'éloignant). */
  if (m.wind > 0) {
    m.wind -= dt; m.mv = false;
    if (m.wind > 0) return;
    const tt = djEnt(st, m.actTgt);
    if (m.act === 'melee') { if (tt && !tt.dead && tt.hp > 0 && djDist(m, tt) <= m.range + tt.r + m.r + 0.45) djHit(st, tt, m.dmg); }
    else if (m.act === 'shot') { if (tt) { const ax = tt.x - m.x, ay = tt.y - m.y, len = Math.hypot(ax, ay) || 1, sp = m.shot === 'arrow' ? 9 : 6; st.shots.push({ id: st.nid++, side: 'm', kind: m.shot, from: m.id, x: m.x, y: m.y, px: m.x, py: m.y, vx: ax / len * sp, vy: ay / len * sp, dmg: m.dmg, life: (m.range + 2) / sp, r: 0.25 }); } }
    else if (m.act === 'heal') { if (tt && tt.hp > 0) { tt.hp = Math.min(tt.hpMax, tt.hp + tt.hpMax * 0.15); st.ev.push({ k: 'mheal', id: tt.id, by: m.id }); } }
    else if (m.act === 'raise' && m.raiseAt) {
      /* le nécromant relève un squelette (plus faible) à la place d'un monstre tombé */
      const n = djMob(st, 'squelette', m.raiseAt[0], m.raiseAt[1], m.room, false);
      n.hp *= 0.6; n.hpMax *= 0.6; n.xp = 1; n.awake = true; n.raisedBy = m.id; n.atkT = 1;
      if (!djFree(st, n.x, n.y, n.r)) { const p = djRoomSpot(st, m.room, n.r); if (p) { n.x = n.px = p[0]; n.y = n.py = p[1]; } }
      st.mobs.push(n); st.ev.push({ k: 'spawn', id: n.id, x: n.x, y: n.y }); st.ev.push({ k: 'raised', id: n.id, by: m.id });
      m.raiseAt = null;
    }
    return;
  }
  const start = (act, tgt, wind, a) => { m.act = act; m.actTgt = tgt; m.wind = wind; m.atkT = m.rate; m.atkN++; st.ev.push({ k: 'matk', id: m.id, a, tgt }); };
  /* Le chaman soigne d'abord les blessés autour de lui. */
  if (m.raises && m.atkT <= 0 && st.mobs.filter(o => o.raisedBy === m.id && o.hp > 0).length < 3) {
    let best = null, bd = 6;
    for (const c of st.corpses) { const dd = Math.hypot(c.x - m.x, c.y - m.y); if (dd < bd && st.roomAt[Math.floor(c.y) * st.d.W + Math.floor(c.x)] === m.room) { bd = dd; best = c; } }
    if (best) { st.corpses.splice(st.corpses.indexOf(best), 1); m.raiseAt = [best.x, best.y]; start('raise', 0, 0.6, 'raise'); return; }
  }
  if (m.heals && m.atkT <= 0) {
    let best = null, bf = 0.7;
    for (const o of st.mobs) if (o !== m && o.hp > 0 && o.awake && o.hp / o.hpMax < bf && djDist(m, o) < 5) { bf = o.hp / o.hpMax; best = o; }
    if (best) { start('heal', best.id, 0.4, 'heal'); return; }
  }
  const t = djMobTarget(st, m);
  if (!t) { m.mv = false; return; }
  m.tgt = t.id;
  const dx = t.x - m.x, dy = t.y - m.y, dd = Math.hypot(dx, dy) || 0.001;
  if (m.ranged || m.heals || m.raises) {
    const los = djLos(st, m.x, m.y, t.x, t.y);
    if (dd < 2.8 && los && m.root <= 0) { djSteer(st, m, t, true); if (m.mv || m.atkT > 0) return; }
    else if (dd > m.range || !los) { djSteer(st, m, t, false); return; }
    m.mv = false; m.fx = dx / dd; m.fy = dy / dd;
    if (m.atkT <= 0) start('shot', t.id, 0.3, 'shot');
    return;
  }
  if (dd > m.range + t.r + m.r) { djSteer(st, m, t, false); return; }
  m.mv = false; m.fx = dx / dd; m.fy = dy / dd;
  if (m.atkT <= 0) start('melee', t.id, m.big ? 0.55 : 0.35, 'melee');
}
function djBossStep(st, m) { return m.type === 'roiSquelette' ? djBossRoi(st, m) : djBossTroll(st, m); }
/* Le roi squelette : tempête d'os (des cercles s'allument sous les héros puis explosent), renforts à 70 % et 40 %, rage sous 30 %. */
function djBossRoi(st, m) {
  const S = m.sp, dt = DJ_DT;
  if (S.storm == null) S.storm = 5;
  S.storm -= dt;
  if ((S.phase === 0 && m.hp < m.hpMax * 0.7) || (S.phase === 1 && m.hp < m.hpMax * 0.4)) {
    S.phase++;
    const c = djCenter(st.d.rooms[m.room]);
    ['squelette', 'squelette', 'squelette', 'archerSq'].forEach((type, k) => {
      const a = k / 4 * 6.2832 + S.phase, x = m.x + Math.cos(a) * 2.6, y = m.y + Math.sin(a) * 2.6, ok = djFree(st, x, y, 0.38);
      const n = djMob(st, type, ok ? x : c[0] + 0.5, ok ? y : c[1] + 0.5, m.room, false); n.awake = true; st.mobs.push(n);
      st.ev.push({ k: 'spawn', id: n.id, x: n.x, y: n.y });
    });
    st.ev.push({ k: 'summon', id: m.id, x: m.x, y: m.y, boss: true });
  }
  if (!S.enr && m.hp < m.hpMax * 0.3) { S.enr = true; m.rate *= 0.7; m.speed *= 1.25; st.ev.push({ k: 'enrage', id: m.id }); }
  if (S.act === 'storm') {
    S.actT -= dt; m.mv = false;
    if (S.actT <= 0) {
      for (const p of S.pts) for (const t of djFoes(st)) if (Math.hypot(t.x - p[0], t.y - p[1]) <= 1.6 + t.r) djHit(st, t, m.dmg * 1.4);
      st.ev.push({ k: 'storm', id: m.id, pts: S.pts, r: 1.6 }); S.act = null; S.storm = 7.5;
    }
    return true;
  }
  if (m.wind > 0) return false;
  if (S.storm <= 0 && djMobTarget(st, m)) {
    /* un cercle sous chaque héros, et deux de plus autour, au hasard */
    const pts = [];
    for (const h of st.heroes) if (!h.dead) { pts.push([djR2(h.x), djR2(h.y)]); const a = djRnd(st) * 6.2832; pts.push([djR2(h.x + Math.cos(a) * 2.4), djR2(h.y + Math.sin(a) * 2.4)]); }
    S.pts = pts; S.act = 'storm'; S.actT = 1.3;
    st.ev.push({ k: 'tele', id: m.id, a: 'storm', pts, r: 1.6, t: 1.3 });
    return true;
  }
  return false;
}
/* Le chef troll : coup de massue en cercle, charge, renforts à 66 % et 33 % de vie, rage sous 25 %. */
function djBossTroll(st, m) {
  const S = m.sp, dt = DJ_DT;
  S.slam -= dt; S.charge -= dt;
  if ((S.phase === 0 && m.hp < m.hpMax * 0.66) || (S.phase === 1 && m.hp < m.hpMax * 0.33)) {
    S.phase++;
    const R = st.d.rooms[m.room], c = djCenter(R);
    ['gobelin', 'gobelin', 'archer'].forEach((type, k) => {
      const a = k / 3 * 6.2832 + S.phase, x = m.x + Math.cos(a) * 2.4, y = m.y + Math.sin(a) * 2.4, ok = djFree(st, x, y, 0.38);
      const n = djMob(st, type, ok ? x : c[0] + 0.5, ok ? y : c[1] + 0.5, m.room, false); n.awake = true; st.mobs.push(n);
    });
    st.ev.push({ k: 'summon', id: m.id, x: m.x, y: m.y, boss: true });
  }
  if (!S.enr && m.hp < m.hpMax * 0.25) { S.enr = true; m.rate *= 0.7; m.speed *= 1.2; st.ev.push({ k: 'enrage', id: m.id }); }
  if (S.act === 'slam') {
    S.actT -= dt; m.mv = false;
    if (S.actT <= 0) { for (const t of djFoes(st)) if (djDist(m, t) <= 3 + t.r) djHit(st, t, m.dmg * 1.6); st.ev.push({ k: 'slam', id: m.id, x: m.x, y: m.y, r: 3 }); S.act = null; S.slam = 7; }
    return true;
  }
  if (S.act === 'chargeW') { S.actT -= dt; m.mv = false; if (S.actT <= 0) { S.act = 'charge'; S.actT = 0.85; S.hit = []; st.ev.push({ k: 'charge', id: m.id }); } return true; }
  if (S.act === 'charge') {
    S.actT -= dt; const step = 11 * dt, x0 = m.x, y0 = m.y;
    djMove(st, m, S.dx * step, S.dy * step); m.mv = true; m.fx = S.dx; m.fy = S.dy;
    for (const t of djFoes(st)) if (!S.hit.includes(t.id) && djDist(m, t) <= m.r + t.r + 0.25) { S.hit.push(t.id); djHit(st, t, m.dmg * 1.5); if (t.kind === 'hero' && !t.dead) { djMove(st, t, -S.dy * 1.4, S.dx * 1.4); t.tp = (t.tp || 0) + 1; } }
    const moved = Math.hypot(m.x - x0, m.y - y0);
    if (S.actT <= 0 || moved < step * 0.3) {
      S.act = null; S.charge = 11; m.mv = false;
      if (moved < step * 0.3) { m.stun = Math.max(m.stun, 1.2); st.ev.push({ k: 'wall', id: m.id, x: m.x, y: m.y }); }   // il s'assomme contre le mur
    }
    return true;
  }
  if (m.wind > 0) return false;
  const t = djMobTarget(st, m); if (!t) return false;
  const dd = djDist(m, t);
  if (S.slam <= 0 && dd <= 3.5) { S.act = 'slam'; S.actT = 1.0; st.ev.push({ k: 'tele', id: m.id, a: 'slam', x: m.x, y: m.y, r: 3, t: 1.0 }); return true; }
  if (S.charge <= 0 && dd >= 3 && dd <= 10 && djLos(st, m.x, m.y, t.x, t.y)) {
    S.dx = (t.x - m.x) / dd; S.dy = (t.y - m.y) / dd; S.act = 'chargeW'; S.actT = 0.8;
    st.ev.push({ k: 'tele', id: m.id, a: 'charge', x: m.x, y: m.y, dx: S.dx, dy: S.dy, len: 9, t: 0.8 }); return true;
  }
  return false;
}
/* Les monstres s'écartent les uns des autres, et les héros les poussent (on ne reste pas coincé). */
function djSeparate(st) {
  const L = st.mobs.filter(m => m.hp > 0 && m.awake);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; let dx = b.x - a.x, dy = b.y - a.y; const R = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    let d = Math.sqrt(d2); if (d < 1e-4) { dx = Math.cos(a.id + b.id); dy = Math.sin(a.id + b.id); d = 1; }
    const push = (R - Math.min(d, R)) / 2, ux = dx / d, uy = dy / d, wa = a.boss ? 0.15 : b.boss ? 1.85 : 1;
    djMove(st, a, -ux * push * wa, -uy * push * wa); djMove(st, b, ux * push * (2 - wa), uy * push * (2 - wa));
  }
  for (const h of st.heroes) {
    if (h.dead) continue;
    for (const m of L) { const dx = m.x - h.x, dy = m.y - h.y, R = m.r + h.r, d = Math.hypot(dx, dy); if (d < R && d > 1e-4 && !m.boss) djMove(st, m, dx / d * (R - d), dy / d * (R - d)); }
  }
}
function djShotStep(st, s) {
  const dt = DJ_DT; s.life -= dt;
  if (s.side === 'h') {
    const t = st.mobs.find(m => m.id === s.tgt && m.hp > 0);
    if (!t || s.life <= 0) { s.dead = true; return; }
    const dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy), step = s.spd * dt;
    if (len <= step + t.r) {
      s.dead = true; s.x = t.x; s.y = t.y; if (djEvade(st, t)) return; djHurt(st, t, s.dmg, djEnt(st, s.from), s.crit, 'basic');
      if (s.splash) for (const m of djAround(st, s.x, s.y, s.splash)) if (m !== t) djHurt(st, m, s.dmg * 0.4, null, false);   // la boule du mage éclabousse
      return;
    }
    s.x += dx / len * step; s.y += dy / len * step;
  } else {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.life <= 0 || !st.d.grid[Math.floor(s.y) * st.d.W + Math.floor(s.x)]) { s.dead = true; return; }
    for (const t of djFoes(st)) if (Math.hypot(t.x - s.x, t.y - s.y) <= t.r + s.r) { s.dead = true; djHit(st, t, s.dmg); return; }
  }
}
function djZoneStep(st, z) {
  z.t -= DJ_DT; z.tick -= DJ_DT;
  if (z.tick <= 0) {
    z.tick += 0.5;
    if (z.dps) for (const m of djAround(st, z.x, z.y, z.r)) djHurt(st, m, z.dps * 0.5, djEnt(st, z.own), false, 'dot');
    if (z.hps) for (const h of st.heroes) if (!h.dead && Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) djHeal(st, h, h.hpMax * z.hps * 0.5);
  }
  if (z.t <= 0) z.dead = true;
}
/* Un héros entre dans une salle : les grilles se ferment, les monstres se réveillent, l'autre héros le rejoint. */
function djLock(st, ri, h) {
  const R = st.rooms[ri], d = st.d;
  if (!st.mobs.some(m => m.room === ri && m.hp > 0)) { R.st = 'clear'; return; }
  R.st = 'lock';
  for (const k of st.doors[ri]) st.door[k] = 1;
  for (const m of st.mobs) if (m.room === ri && !m.hidden) m.awake = true;
  for (const o of st.heroes.concat(st.allies)) {
    if (o === h || o.dead || (o.kind !== 'hero' && !o.inv && o.hp <= 0)) continue;
    if (st.roomAt[Math.floor(o.y) * d.W + Math.floor(o.x)] !== ri) { st.ev.push({ k: 'blink', id: o.id, x0: o.x, y0: o.y, x1: h.x, y1: h.y }); o.x = o.px = h.x; o.y = o.py = h.y; if (o.kind === 'hero') o.tp = (o.tp || 0) + 1; }
  }
  for (const e of st.heroes.concat(st.allies)) if (!djFree(st, e.x, e.y, e.r)) djUnstick(st, e, ri);
  for (const m of st.mobs) if (m.room === ri && !m.hidden && !djFree(st, m.x, m.y, m.r)) { const p = djRoomSpot(st, ri, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; } }
  st.ev.push({ k: 'lock', room: ri, boss: d.rooms[ri].kind === 'boss' });
}
function djWorld(st) {
  const d = st.d, W = d.W, cellRoom = e => st.roomAt[Math.floor(e.y) * W + Math.floor(e.x)];
  for (const h of st.heroes) { if (h.dead) continue; const ri = cellRoom(h); if (ri >= 0 && st.rooms[ri].st === 'idle') djLock(st, ri, h); }
  st.rooms.forEach((R, ri) => {
    if (R.st !== 'lock' && R.st !== 'fight') return;
    if (!st.mobs.some(m => m.room === ri && m.hp > 0)) {
      R.st = 'clear'; for (const k of st.doors[ri]) st.door[k] = 0;
      const boss = d.rooms[ri].kind === 'boss';
      const left = st.rooms.some((R2, i) => (d.rooms[i].kind === 'fight' || d.rooms[i].kind === 'boss') && R2.st !== 'clear');
      if (!left && !st.exit) { const c = djCenter(d.rooms[d.exitRoom != null ? d.exitRoom : ri]); st.exit = { x: c[0] + 0.5, y: c[1] + 0.5 }; }
      st.ev.push({ k: 'clear', room: ri, boss });
      for (const h of st.heroes) if (h.dead && !h.gone) djRaise(st, h, 0.3, 0);      // salle nettoyée : l'allié tombé se relève
      return;
    }
    /* Vague suivante : quand tous les monstres visibles sont vaincus, d'autres sortent des galeries (1,2 s plus tard). */
    if (!st.mobs.some(m => m.room === ri && m.hp > 0 && !m.hidden)) {
      if (!R.waveT) { R.waveT = 1.2; st.ev.push({ k: 'wavecome', room: ri, n: R.wave + 2, of: R.waves }); }
      R.waveT -= DJ_DT;
      if (R.waveT <= 0) {
        R.waveT = 0; R.wave++;
        for (const m of st.mobs) {
          if (m.room !== ri || !m.hidden || m.wave > R.wave) continue;
          /* jamais dans les pattes d'un héros, toujours dans la salle */
          if (st.heroes.some(h => !h.dead && djDist(h, m) < 2.5) || !djFree(st, m.x, m.y, m.r) || st.roomAt[Math.floor(m.y) * d.W + Math.floor(m.x)] !== ri) {
            const p = djRoomSpot(st, ri, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; }
          }
          m.hidden = false; m.awake = true; m.atkT = 0.8 + djRnd(st) * 0.6;
          st.ev.push({ k: 'spawn', id: m.id, x: m.x, y: m.y });
        }
        st.ev.push({ k: 'wave', room: ri, n: R.wave + 1, of: R.waves });
      }
    }
    /* Sécurité : si plus aucun héros vivant n'est dans la salle, les grilles se rouvrent. */
    if (R.st === 'lock') { R.out = st.heroes.some(h => !h.dead && cellRoom(h) === ri) ? 0 : R.out + DJ_DT; if (R.out > 3) { R.st = 'fight'; for (const k of st.doors[ri]) st.door[k] = 0; } }
  });
  for (const h of st.heroes) {
    if (h.dead) continue;
    for (const c of st.chests) if (!c.open && Math.hypot(c.x - h.x, c.y - h.y) < 1.1) {
      c.open = true;
      st.ev.push({ k: 'chest', x: c.x, y: c.y, got: djLootAdd(st, DJ_CHEST, djLootMul(st.lvl) * (st.heroes.some(p => p.race === 'halfelin') ? 1.5 : 1)) });
    }
    if (st.altar && !st.altar.used && Math.hypot(st.altar.x - h.x, st.altar.y - h.y) < 1.2) {
      st.altar.used = true; st.bless = ['force', 'vigueur', 'celerite'][Math.floor(djRnd(st) * 3)];
      if (st.bless === 'vigueur') for (const p of st.heroes) { p.hpMax = djHpMax(st, p); if (!p.dead) p.hp = p.hpMax; }
      st.ev.push({ k: 'altar', b: st.bless, x: st.altar.x, y: st.altar.y });
    }
    if (st.pris && !st.pris.freed && Math.hypot(st.pris.x - h.x, st.pris.y - h.y) < 1.3) { st.pris.freed = true; st.ev.push({ k: 'free', x: st.pris.x, y: st.pris.y }); }
    if (st.exit && !st.over && Math.hypot(st.exit.x - h.x, st.exit.y - h.y) < 1.0) { st.over = st.d.floor ? 'floor' : 'win'; st.ev.push({ k: st.over }); }
  }
  /* À deux : rester 3 s près d'un allié tombé le relève (40 % de vie). */
  for (const h of st.heroes) {
    if (!h.dead || h.gone) { h.rev = 0; continue; }
    const helper = st.heroes.find(o => o !== h && !o.dead && djDist(o, h) < 1.6);
    if (helper) { h.rev += DJ_DT; if (h.rev >= 3) djRaise(st, h, 0.4, helper.id); }
    else h.rev = Math.max(0, h.rev - DJ_DT * 2);
  }
  /* Pièges à pointes : sortis 0,6 s toutes les 2,4 s ; 12 % de la vie à chaque fois. */
  for (const tr of st.traps) {
    const u = st.t + tr.ph, cyc = Math.floor(u / 2.4); tr.on = u - cyc * 2.4 < 0.6;
    if (!tr.on) continue;
    for (const h of st.heroes) if (!h.dead && h.b.inv === undefined && Math.floor(h.x) === tr.x && Math.floor(h.y) === tr.y && tr.hit[h.id] !== cyc) {
      tr.hit[h.id] = cyc; st.ev.push({ k: 'trap', id: h.id, x: tr.x + 0.5, y: tr.y + 0.5 }); djDamageHero(st, h, h.hpMax * 0.12);
    }
  }
  if (!st.over && st.heroes.every(h => h.dead)) { st.endT += DJ_DT; if (st.endT >= 1.8) { st.over = 'lose'; st.ev.push({ k: 'lose' }); } }
}
/* Avance d'un pas. inputs : { [id du héros]: { mx, my (joystick, -1 à 1), sk (compétence 0-2 ou -1), pot (potion) } }. */
function djStep(st, inputs) {
  if (st.over) return st;
  st.n++; st.t += DJ_DT;
  for (const L of [st.heroes, st.mobs, st.allies, st.shots]) for (const e of L) { e.px = e.x; e.py = e.y; }
  if (st.n - st.flowN >= 4 || !st.flow) djFlow(st);
  st.calmT = st.mobs.some(m => m.awake && m.hp > 0) ? 0 : st.calmT + DJ_DT;
  for (const h of st.heroes) djHeroStep(st, h, (inputs && inputs[h.id]) || {});
  for (const a of st.allies) djAllyStep(st, a);
  for (const m of st.mobs) djMobStep(st, m);
  djSeparate(st);
  for (const s of st.shots) djShotStep(st, s);
  for (const z of st.zones) djZoneStep(st, z);
  djWorld(st);
  st.mobs = st.mobs.filter(m => m.hp > 0);
  st.allies = st.allies.filter(a => a.inv || a.hp > 0);
  st.shots = st.shots.filter(s => !s.dead);
  st.zones = st.zones.filter(z => !z.dead);
  st.corpses = st.corpses.filter(c => st.t - c.t < 10);
  return st;
}
function djFlee(st) { if (!st.over) { st.fled = true; st.over = 'lose'; st.ev.push({ k: 'lose', fled: true }); } }
/* Bilan : victoire = tout ; défaite ou fuite = moitié de l'expérience et du butin. Le prisonnier délivré est sauvé dans tous les cas. */
function djResult(st) {
  const win = st.over === 'win' || st.over === 'floor', L = st.lvl, k = win ? 1 : 0.5, loot = {};
  for (const r in st.loot) { const n = Math.round(st.loot[r] * k); if (n > 0) loot[r] = n; }
  return { win, lvl: L, xp: Math.round((st.xp + (win ? 60 * djXpMul(L) : 0)) * k), loot, pris: !!(st.pris && st.pris.freed), kills: st.kills, secs: Math.round(st.t), fled: !!st.fled, combos: st.combos || 0, theme: st.d.theme };
}
/* Où en est-on ? (pour l'interface) */
function djProgress(st) {
  const fights = st.d.rooms.map((r, i) => [r, i]).filter(([r]) => r.kind === 'fight');
  const boss = st.mobs.find(m => m.boss), bi = st.d.rooms.findIndex(r => r.kind === 'boss');
  const cur = st.rooms.findIndex(R => R.st === 'lock');
  return { done: fights.filter(([, i]) => st.rooms[i].st === 'clear').length, total: fights.length, boss: boss && st.rooms[bi].st === 'lock' ? boss : null,
    bossDead: !st.mobs.some(m => m.boss), fighting: cur >= 0, wave: cur >= 0 ? st.rooms[cur].wave + 1 : 0, waves: cur >= 0 ? st.rooms[cur].waves : 0 };
}

/* ===================== DONJONS À DEUX : l'hôte simule, l'invitée affiche =====================
   Le téléphone de l'hôte fait tourner le combat et envoie l'état ~7 fois par seconde ; celui de l'invitée l'affiche
   (en lissant), déplace lui-même son héros (pour qu'il réponde tout de suite) et envoie sa position et ses boutons. */
const DJ_PV = 2;                       // version du jeu à deux : à augmenter quand le combat ou les messages changent
const DJ_MT = ['gobelin', 'archer', 'chaman', 'troll', 'chefTroll', 'squelette', 'archerSq', 'goule', 'spectre', 'necromant', 'golem', 'roiSquelette'];
const DJ_ST = { idle: 'i', lock: 'l', clear: 'c', open: 'o', fight: 'f' }, DJ_STR = { i: 'idle', l: 'lock', c: 'clear', o: 'open', f: 'fight' };
const djR1 = x => Math.round(x * 10) / 10, djR2 = x => Math.round(x * 100) / 100;
/* Instantané envoyé par l'hôte (nombres arrondis, listes courtes). evs : événements depuis le précédent (pour les effets). */
function djSnap(st, evs, n, res) {
  return {
    n, t: djR2(st.t), sn: st.n, pv: DJ_PV, sd: st.d.seed, fl: st.d.floor || 0, lv: st.lvl, th: st.d.theme, nr: st.d.rooms.filter(r => r.kind === 'fight').length, bs: st.d.rooms.some(r => r.kind === 'boss') ? 1 : 0,
    h: st.heroes.map(h => [h.id, djR2(h.x), djR2(h.y), djR1(h.hp), djR1(h.hpMax),
      (h.dead ? 1 : 0) | (h.mv ? 2 : 0) | (h.b.stealth > 0 ? 4 : 0) | (h.b.inv > 0 ? 8 : 0) | (h.gone ? 16 : 0),
      djR2(h.fx), djR2(h.fy), djR1(h.cd[0]), djR1(h.cd[1]), djR1(h.cd[2]), djR1(h.cdMax[0]), djR1(h.cdMax[1]), djR1(h.cdMax[2]),
      h.pot, djR1(h.shield), h.form === 'ours' ? 1 : h.form === 'loup' ? 2 : 0, h.tp | 0, djR1(Math.max(0, h.potT)), h.atkN, h.castN, djR1(h.rev), h.tgt | 0]),
    m: st.mobs.filter(m => !m.hidden && m.hp > 0).map(m => [m.id, DJ_MT.indexOf(m.type), djR2(m.x), djR2(m.y), djR1(m.hp), djR1(m.hpMax),
      (m.awake ? 1 : 0) | (m.mv ? 2 : 0) | (m.stun > 0 ? 4 : 0) | (m.frz > 0 ? 8 : 0) | (m.root > 0 ? 16 : 0) | (m.boss ? 32 : 0) | (m.sp && m.sp.enr ? 64 : 0) | (m.big ? 128 : 0),
      djR2(m.fx), djR2(m.fy), m.atkN, m.room, m.r]),
    a: st.allies.filter(a => a.inv || a.hp > 0).map(a => [a.id, a.kind === 'pet' ? 1 : 0, a.own, djR2(a.x), djR2(a.y), djR1(a.hp), djR1(a.hpMax), a.mv ? 1 : 0, a.atkN, djR2(a.fx || 0), djR2(a.fy || 0)]),
    s: st.shots.map(s => [s.id, s.kind, djR2(s.x), djR2(s.y)]),
    z: st.zones.map(z => [z.id, z.k, djR2(z.x), djR2(z.y), z.r]),
    r: st.rooms.map(R => [DJ_ST[R.st] || 'o', R.wave, R.waves]),
    ch: st.chests.map(c => (c.open ? '1' : '0')).join('') || '0',
    al: st.altar && st.altar.used ? 1 : 0, bl: st.bless || 0, pr: st.pris && st.pris.freed ? 1 : 0,
    ex: st.exit ? [djR2(st.exit.x), djR2(st.exit.y)] : 0,
    ov: st.over || 0, res: res || (st.over && st.over !== 'floor' ? djResult(st) : 0), xp: Math.round(st.xp), k: st.kills, cb: st.combos || 0,
    ev: evs && evs.length ? evs : 0,
  };
}
/* L'invitée applique un instantané à sa copie de l'état (créée au départ par djStart avec la même graine). me : id de son héros.
   Renvoie les événements à jouer, ou null si l'instantané est ancien. */
function djApplySnap(ms, sn, me) {
  if (!sn || sn.sd !== ms.d.seed || (ms.snapN != null && sn.n <= ms.snapN)) return null;   // un ancien message (autre partie) est ignoré
  ms.snapN = sn.n; ms.t = sn.t; ms.n = sn.sn;
  const H = new Map(ms.heroes.map(h => [h.id, h]));
  for (const a of sn.h || []) {
    const h = H.get(a[0]); if (!h) continue;
    const mine = h.id === me, tp = a[17] | 0;
    if (!mine) { h.px = h.x; h.py = h.y; h.x = a[1]; h.y = a[2]; }
    else if (tp !== (h.tp | 0) || Math.hypot(h.x - a[1], h.y - a[2]) > 4) { h.x = h.px = a[1]; h.y = h.py = a[2]; }   // téléporté par l'hôte (ou trop loin) : on se recale
    h.tp = tp; h.hp = a[3]; h.hpMax = a[4];
    const f = a[5]; h.dead = !!(f & 1); h.gone = !!(f & 16);
    h.b.stealth = f & 4 ? 1 : 0; h.b.inv = f & 8 ? 1 : 0;
    if (!mine) { h.mv = !!(f & 2); h.fx = a[6]; h.fy = a[7]; }
    h.cd = [a[8], a[9], a[10]]; h.cdMax = [a[11] || 1, a[12] || 1, a[13] || 1]; h.pot = a[14]; h.shield = a[15];
    h.form = a[16] === 1 ? 'ours' : a[16] === 2 ? 'loup' : null; h.potT = a[18]; h.atkN = a[19]; h.castN = a[20]; h.rev = a[21]; h.tgt = a[22];
  }
  const keep = (list, rows, make, upd) => { const old = new Map(list.map(e => [e.id, e])), out = []; for (const a of rows || []) { let e = old.get(a[0]); if (!e) e = make(a); else { e.px = e.x; e.py = e.y; } upd(e, a); out.push(e); } return out; };
  ms.mobs = keep(ms.mobs, sn.m, a => ({ id: a[0], kind: 'mob', type: DJ_MT[a[1]] || 'gobelin', x: a[2], y: a[3], px: a[2], py: a[3], b: {} }), (m, a) => {
    m.x = a[2]; m.y = a[3]; m.hp = a[4]; m.hpMax = a[5];
    const f = a[6]; m.awake = !!(f & 1); m.mv = !!(f & 2); m.stun = f & 4 ? 1 : 0; m.frz = f & 8 ? 1 : 0; m.root = f & 16 ? 1 : 0;
    m.boss = !!(f & 32); m.big = !!(f & 128); m.sp = m.boss ? { enr: !!(f & 64) } : null;
    m.fx = a[7]; m.fy = a[8]; m.atkN = a[9]; m.room = a[10]; m.r = a[11] || 0.38; m.hidden = false;
  });
  ms.allies = keep(ms.allies, sn.a, a => ({ id: a[0], kind: a[1] ? 'pet' : 'skel', own: a[2], x: a[3], y: a[4], px: a[3], py: a[4], r: a[1] ? 0.25 : 0.32, inv: !!a[1] }), (e, a) => {
    e.x = a[3]; e.y = a[4]; e.hp = a[5]; e.hpMax = a[6]; e.mv = !!a[7]; e.atkN = a[8]; e.fx = a[9]; e.fy = a[10];
  });
  ms.shots = keep(ms.shots, sn.s, a => ({ id: a[0], kind: a[1], x: a[2], y: a[3], px: a[2], py: a[3] }), (e, a) => { e.x = a[2]; e.y = a[3]; });
  ms.zones = keep(ms.zones, sn.z, a => ({ id: a[0], k: a[1], x: a[2], y: a[3], r: a[4] }), () => {});
  (sn.r || []).forEach((a, i) => { const R = ms.rooms[i]; if (!R) return; R.st = DJ_STR[a[0]] || 'open'; R.wave = a[1]; R.waves = a[2]; });
  ms.door.fill(0); ms.rooms.forEach((R, i) => { if (R.st === 'lock') for (const k of ms.doors[i]) ms.door[k] = 1; });
  const ch = String(sn.ch || ''); ms.chests.forEach((c, i) => { c.open = ch[i] === '1'; });
  if (ms.altar) ms.altar.used = !!sn.al;
  ms.bless = sn.bl || null;
  if (ms.pris) ms.pris.freed = !!sn.pr;
  ms.exit = sn.ex ? { x: sn.ex[0], y: sn.ex[1] } : null;
  for (const tr of ms.traps) { const u = ms.t + tr.ph, cyc = Math.floor(u / 2.4); tr.on = u - cyc * 2.4 < 0.6; }
  ms.xp = sn.xp; ms.kills = sn.k; ms.combos = sn.cb || 0;
  if ((sn.ov || null) !== (ms.over || null)) { ms.over = sn.ov || null; ms.res = sn.res || null; }
  return sn.ev || [];
}
/* Sur le téléphone de l'invitée : son héros bouge tout de suite (mêmes murs, même vitesse, même pas en avant au contact). */
function djLocalMove(st, h, mx, my, dt) {
  h.px = h.x; h.py = h.y;
  if (h.dead) { h.mv = false; return; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  const spd = h.speed * (h.form === 'loup' ? 1.25 : 1) * (st.bless === 'celerite' ? 1.15 : 1), reach = h.form ? 1.6 : h.range;
  if (m > 0.2) { h.mv = djMove(st, h, mx * spd * dt, my * spd * dt); h.fx = mx / Math.max(1, m); h.fy = my / Math.max(1, m); return; }
  h.mv = false;
  if (reach < 2) {
    const t = djNearest(st, h, 4.5);
    if (t && djDist(h, t) > reach + t.r) { const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy); h.mv = djMove(st, h, dx / len * spd * dt, dy / len * spd * dt); h.fx = dx / len; h.fy = dy / len; }
  }
}

/* ===================== LES PROFONDEURS : des étages sans fin =====================
   Étages de 3 ou 4 salles ; un boss tous les 5 étages ; la mine puis la crypte, par tranches de 5 étages ;
   +1 niveau de monstres tous les 2 étages. À la sortie de chaque étage : descendre, ou remonter avec tout le butin. */
function djFloorCfg(floor, start) {
  return { floor, lvl: Math.max(1, start) + Math.floor((floor - 1) / 2), theme: Math.floor((floor - 1) / 5) % 2 ? 'crypte' : 'mine',
    rooms: floor % 5 === 0 ? 3 : 3 + (floor % 2 ? 0 : 1), boss: floor % 5 === 0 };
}
const djFloorSeed = (seed, floor) => (hash((seed ^ Math.imul(floor, 7919)) >>> 0) || 1) >>> 0;
function djFloor(seed, floor, start) {
  const c = djFloorCfg(floor, start), sd = djFloorSeed(seed, floor);
  return genDungeon(sd, c.lvl, c.theme, { rooms: c.rooms, boss: c.boss, floor });
}
/* Ce que les héros emportent à l'étage suivant : leur vie (+25 %), leurs potions, le relèvement déjà utilisé. */
function djCarry(st) {
  const out = {};
  for (const h of st.heroes) out[h.id] = { hp: h.dead ? (h.gone ? 0 : 0.3) : Math.min(1, h.hp / h.hpMax + 0.25), pot: h.pot, revived: h.revived, gone: h.gone };
  return out;
}
/* Cumul d'une descente : chaque étage fini ajoute son bilan ; à la fin, défaite ou fuite = la moitié de tout. */
function djRunAdd(run, r) {
  run.xp += r.xp; run.kills += r.kills; run.secs += r.secs; run.combos += r.combos || 0; if (r.pris) run.pris = true;
  for (const k in r.loot) run.loot[k] = (run.loot[k] || 0) + r.loot[k];
  return run;
}
function djRunResult(run, win, partial) {
  const all = djRunAdd(JSON.parse(JSON.stringify(run)), partial || { xp: 0, kills: 0, secs: 0, loot: {} }), k = win ? 1 : 0.5, loot = {};
  for (const r in all.loot) { const n = Math.round(all.loot[r] * k); if (n > 0) loot[r] = n; }
  return { win, prof: true, lvl: run.start, deep: run.done, xp: Math.round(all.xp * k), loot, pris: !!all.pris, kills: all.kills, secs: all.secs, combos: all.combos, fled: !win && !!(partial && partial.fled), theme: 'prof' };
}
