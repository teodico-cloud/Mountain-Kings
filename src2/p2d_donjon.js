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
/* Monstres de la mine des gobelins (statistiques de base au niveau 1). */
const DJ_MONSTERS = {
  gobelin: { name: 'Gobelin', hp: 30, dmg: 5, speed: 2.6, range: 1.1, rate: 1.0, xp: 8, w: 4 },
  archer: { name: 'Gobelin archer', hp: 22, dmg: 6, speed: 2.2, range: 6, rate: 1.6, xp: 10, w: 2, ranged: true },
  chaman: { name: 'Chaman', hp: 26, dmg: 3, speed: 2.0, range: 5, rate: 2.2, xp: 14, w: 1, heals: true },
  troll: { name: 'Troll', hp: 90, dmg: 14, speed: 1.5, range: 1.4, rate: 1.8, xp: 30, w: 1, big: true },
};
const DJ_BOSSES = { chefTroll: { name: 'Chef troll', hp: 420, dmg: 22, speed: 1.7, range: 1.6, rate: 1.6, xp: 200, big: true, boss: true } };
const DJ_THEMES = { mine: { name: 'Mine des gobelins', monsters: ['gobelin', 'archer', 'chaman', 'troll'], boss: 'chefTroll' } };
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

/* Fabrique un donjon : 5 à 6 salles de combat + l'arène du boss, une salle annexe (trésor ou prisonnier). */
function genDungeon(seed, lvl, theme) {
  const R = mulberry32((seed ^ 0x9e3779b9) >>> 0), pick = a => a[Math.floor(R() * a.length)];
  const T = DJ_THEMES[theme || 'mine'], nFight = 5 + (R() < 0.5 ? 1 : 0);
  let rooms = null;
  for (let attempt = 0; attempt < 50 && !rooms; attempt++) {
    const list = [{ k: 'entree', w: 8, h: 8, shape: 'rect', kind: 'start', x: 0, y: 0 }];
    let ok = true;
    for (let i = 0; i <= nFight && ok; i++) {
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
  rooms.forEach((r, ri) => {
    const free = shuffle(inner(r).slice());
    if (r.kind === 'fight') {
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n && i < free.length; i++) monsters.push({ id: mid++, room: ri, type: monsterType(), x: free[i][0] + 0.5, y: free[i][1] + 0.5 });
      if (R() < 0.5) for (const c of free.slice(n, n + 2)) traps.push({ room: ri, x: c[0], y: c[1] });
    } else if (r.kind === 'boss') monsters.push({ id: mid++, room: ri, type: T.boss, boss: true, x: r.x + r.w / 2, y: r.y + r.h / 2 });
    else if (r.kind === 'treasure') for (const c of free.slice(0, 2)) chests.push({ room: ri, x: c[0] + 0.5, y: c[1] + 0.5 });
  });
  const altarRoom = chain.length > 4 ? 2 + Math.floor(R() * (chain.length - 4)) : null;
  const altar = altarRoom != null ? djCenter(chain[altarRoom]) : null;
  const pris = rooms.find(r => r.kind === 'prisoner');
  return { seed, lvl, theme: theme || 'mine', W, H, grid, rooms, start: djCenter(rooms[0]), monsters, traps, chests, altar,
    prisoner: pris ? djCenter(pris) : null };
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
