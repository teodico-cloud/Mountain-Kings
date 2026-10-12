/* Essais des donjons : fabrication, puis combats joués par un petit robot pour chaque classe. Usage : node tools/test_donjon.js [--long] */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src2/p2_rules.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src2/p2d_donjon.js'), 'utf8');
const D = new Function(src + '\nreturn { genDungeon, djReach, DJ_MONSTERS, DJ_BOSSES, djStart, djStep, djResult, djFlee, djProgress, djCast, DJ_DT, DJ_SKILLS, CLASS_KEYS, RACE_KEYS, djFree, djLos };')();
const LONG = process.argv.includes('--long');
let fails = 0;
const ok = (c, m) => { if (c) console.log('ok : ' + m); else { fails++; console.log('ÉCHEC : ' + m); } };

/* ---------- fabrication ---------- */
const a = D.genDungeon(12345, 1), b = D.genDungeon(12345, 1);
ok(JSON.stringify({ ...a, grid: [...a.grid] }) === JSON.stringify({ ...b, grid: [...b.grid] }), 'même graine, même donjon');
ok(JSON.stringify(D.genDungeon(12346, 1).rooms) !== JSON.stringify(a.rooms), 'autre graine, autre donjon');
let maxW = 0, maxH = 0, minFight = 99, maxFight = 0, prisoners = 0, unreachable = 0, monsters = [], t0 = Date.now();
for (let s = 1; s <= 400; s++) {
  const d = D.genDungeon(s * 7919, 1 + (s % 10));
  maxW = Math.max(maxW, d.W); maxH = Math.max(maxH, d.H);
  const fights = d.rooms.filter(r => r.kind === 'fight').length; minFight = Math.min(minFight, fights); maxFight = Math.max(maxFight, fights);
  if (d.prisoner) prisoners++;
  const seen = D.djReach(d);
  for (const r of d.rooms) if (!r.cells.some(([x, y]) => seen[y * d.W + x])) unreachable++;
  if (!d.rooms.some(r => r.kind === 'boss') || !d.monsters.some(m => m.boss)) unreachable += 100;
  monsters.push(d.monsters.length);
}
const ms = Date.now() - t0;
ok(unreachable === 0, 'toutes les salles sont reliées à l’entrée, chaque donjon a son boss (400 donjons)');
ok(minFight >= 5 && maxFight <= 6, 'de 5 à 6 salles de combat (' + minFight + ' à ' + maxFight + ')');
ok(maxW <= 110 && maxH <= 90, 'taille maximale ' + maxW + ' × ' + maxH + ' cases');
const avg = monsters.reduce((x, y) => x + y, 0) / monsters.length;
ok(avg >= 35 && avg <= 70, 'en moyenne ' + avg.toFixed(1) + ' monstres par donjon');
ok(prisoners > 0 && prisoners < 80, 'prisonnier rare : ' + prisoners + ' donjons sur 400');
ok(ms < 2000, '400 donjons fabriqués en ' + ms + ' ms');

/* ---------- le robot : va de salle en salle, combat, boit une potion quand il le faut, prend la sortie ---------- */
function makeBot(st) {
  const d = st.d, W = d.W, field = new Float32Array(W * d.H);
  let goalKey = -1, fieldN = -99;
  const chain = d.rooms.map((r, i) => i).filter(i => d.rooms[i].host == null);
  function fill(gx, gy) {
    field.fill(1e9); const q = [gy * W + gx]; field[q[0]] = 0;
    const open = k => d.grid[k] && !st.door[k];
    for (let i = 0; i < q.length; i++) {
      const k = q[i], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nk = (y + dy) * W + x + dx; if (!open(nk) || field[nk] <= field[k] + 1) continue;
        if (dx && dy && (!open(y * W + x + dx) || !open((y + dy) * W + x))) continue;
        field[nk] = field[k] + 1; q.push(nk);
      }
    }
  }
  function toward(h, gx, gy) {
    const key = Math.floor(gy) * W + Math.floor(gx);
    if (key !== goalKey || st.n - fieldN > 10) { fill(Math.floor(gx), Math.floor(gy)); goalKey = key; fieldN = st.n; }
    const cx = Math.floor(h.x), cy = Math.floor(h.y);
    if (cx === Math.floor(gx) && cy === Math.floor(gy)) { const dx = gx - h.x, dy = gy - h.y, L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; }
    let best = field[cy * W + cx], bx = 0, by = 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const k = (cy + oy) * W + cx + ox; if (field[k] < best) { best = field[k]; bx = ox; by = oy; } }
    const dx = cx + bx + 0.5 - h.x, dy = cy + by + 0.5 - h.y, L = Math.hypot(dx, dy) || 1;
    return [dx / L, dy / L];
  }
  return function (h) {
    const inp = { mx: 0, my: 0, sk: -1, pot: false };
    if (h.dead) return inp;
    if (h.hp < h.hpMax * 0.35 && h.pot > 0) inp.pot = true;
    const los = m => D.djLos(st, h.x, h.y, m.x, m.y, true) ? 0 : 50;
    const awake = st.mobs.filter(m => m.awake && m.hp > 0).sort((p, q) => Math.hypot(p.x - h.x, p.y - h.y) + los(p) - Math.hypot(q.x - h.x, q.y - h.y) - los(q));
    if (awake.length && st.n % 4 === 0) for (let i = 0; i < 3; i++) if (h.rank[i] && h.cd[i] <= 0) { inp.sk = i; break; }
    let g = null;
    const near = awake[0];
    if (near) {
      const dd = Math.hypot(near.x - h.x, near.y - h.y);
      if (h.range < 2 || h.form) g = dd > 1.2 ? [near.x, near.y] : null;
      else if (dd > h.range - 0.8) g = [near.x, near.y];
      else if (dd < 2.2) { const ux = h.x - near.x, uy = h.y - near.y, L = Math.hypot(ux, uy) || 1; inp.mx = ux / L; inp.my = uy / L; return inp; }
    } else if (st.exit) g = [st.exit.x, st.exit.y];
    else {
      const side = d.rooms.findIndex((r, i) => r.host != null && st.rooms[r.host].st === 'clear' && (r.kind === 'treasure' ? st.chests.some(c => !c.open) : st.pris && !st.pris.freed));
      if (side >= 0) { const r = d.rooms[side], tgt = r.kind === 'treasure' ? st.chests.find(c => !c.open) : st.pris; g = [tgt.x, tgt.y]; }
      else if (st.altar && !st.altar.used && st.rooms[st.roomAt[Math.floor(st.altar.y) * W + Math.floor(st.altar.x)]].st === 'clear') g = [st.altar.x, st.altar.y];
      else { const next = chain.find(i => st.rooms[i].st === 'idle'); if (next != null) { const r = d.rooms[next]; const c = r.cells[Math.floor(r.cells.length / 2)]; g = [c[0] + 0.5, c[1] + 0.5]; } }
    }
    if (g) { const [mx, my] = toward(h, g[0], g[1]); inp.mx = mx; inp.my = my; }
    return inp;
  };
}
function play(heroes, lvl, seed, maxMin) {
  const d = D.genDungeon(seed, lvl), st = D.djStart(d, heroes, { seed });
  const bots = st.heroes.map(() => makeBot(st));
  let pots = 0;
  while (!st.over && st.t < (maxMin || 20) * 60) {
    const inputs = {};
    st.heroes.forEach((h, i) => { inputs[h.id] = bots[i](h); });
    D.djStep(st, inputs);
    for (const e of st.ev) if (e.k === 'potion') pots++;
    st.ev.length = 0;
  }
  const r = D.djResult(st);
  return { st, r, pots, hp: st.heroes.map(h => Math.round(h.hp / h.hpMax * 100)) };
}
const hero = (cls, race, lvl, extra) => Object.assign({ id: 'h' + cls + race, own: 'u1', name: cls, race, cls, sex: 'm', lvl, sk: {}, spec: null }, extra || {});

/* déterminisme */
const p1 = play([hero('guerrier', 'nain', 1)], 1, 4242), p2 = play([hero('guerrier', 'nain', 1)], 1, 4242);
ok(JSON.stringify(p1.r) === JSON.stringify(p2.r) && p1.st.n === p2.st.n, 'même graine et mêmes commandes : même combat (' + p1.r.secs + ' s, ' + p1.r.kills + ' monstres)');

/* salle : grilles fermées au combat, rouvertes après */
{
  const d = D.genDungeon(777, 1), st = D.djStart(d, [hero('guerrier', 'humain', 3)], { seed: 777 }), bot = makeBot(st);
  let locked = false, reopened = false, firstRoom = -1;
  while (!st.over && st.t < 600 && !reopened) {
    D.djStep(st, { [st.heroes[0].id]: bot(st.heroes[0]) });
    for (const e of st.ev) { if (e.k === 'lock' && firstRoom < 0) { firstRoom = e.room; locked = st.doors[e.room].every(k => st.door[k] === 1) && st.doors[e.room].length > 0; } if (e.k === 'clear' && e.room === firstRoom) reopened = st.doors[e.room].every(k => st.door[k] === 0); }
    st.ev.length = 0;
  }
  ok(locked && reopened, 'les grilles se ferment quand le combat commence et se rouvrent quand la salle est nettoyée');
}

/* une partie complète par classe, niveau 1 dans un donjon de niveau 1, puis niveau 5 et niveau 10 */
const RACE_FOR = { guerrier: 'nain', paladin: 'humain', rodeur: 'elfe', mage: 'humain', voleur: 'halfelin', pretre: 'elfe', druide: 'orque', necro: 'mortvivant' };
const results = {};
for (const [lvl, label] of [[1, 'niveau 1'], [5, 'niveau 5'], [10, 'niveau 10']]) {
  for (const cls of D.CLASS_KEYS) {
    const sk = lvl >= 5 ? { s0: Math.min(4, Math.floor(lvl / 3)), s1: Math.min(4, Math.floor(lvl / 4)), s2: 1 } : {};
    const runs = [], N = LONG ? 6 : 3;
    for (let k = 0; k < N; k++) runs.push(play([hero(cls, RACE_FOR[cls], lvl, { sk, spec: lvl >= 10 ? k % 2 : null })], lvl, 1000 + k * 97 + lvl * 13));
    const wins = runs.filter(x => x.r.win).length, secs = runs.map(x => x.r.secs), pots = runs.map(x => x.pots);
    results[cls + lvl] = { wins, N, secs, pots, xp: runs[0].r.xp, loot: runs[0].r.loot };
    console.log(`  ${label} ${cls.padEnd(9)} victoires ${wins}/${N} · durée ${secs.map(s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')).join(' ')} · potions ${pots.join(' ')} · vie à la fin ${runs.map(x => x.hp[0] + '%').join(' ')} · xp ${runs[0].r.xp}`);
  }
}
const all = Object.values(results);
ok(all.filter(x => x.wins > 0).length === all.length, 'chaque classe gagne au moins une fois à chaque palier (robot simple)');
const avgSecs = all.flatMap(x => x.secs).reduce((p, q) => p + q, 0) / all.flatMap(x => x.secs).length;
ok(avgSecs > 150 && avgSecs < 600, 'durée moyenne du robot : ' + Math.round(avgSecs) + ' s (un joueur est plus lent qu’un robot qui file droit)');

/* défaite et fuite : la moitié de l'expérience */
{
  const d = D.genDungeon(99, 1), st = D.djStart(d, [hero('mage', 'humain', 1)], { seed: 99 });
  for (let i = 0; i < 40; i++) D.djStep(st, {});
  st.xp = 100; st.loot = { pierre: 50 }; D.djFlee(st);
  const r = D.djResult(st);
  ok(!r.win && r.fled && r.xp === 50 && r.loot.pierre === 25, 'fuite : moitié de l’expérience et du butin');
}
/* mort-vivant : se relève une fois */
{
  const d = D.genDungeon(5, 1), st = D.djStart(d, [hero('voleur', 'mortvivant', 1)], { seed: 5 }), h = st.heroes[0];
  st.ev.length = 0; h.dodge = 0; h.hp = 1; h.b = {};
  /* un monstre au contact, son coup (fatal) part au prochain pas */
  const m = st.mobs[0]; m.awake = true;
  m.x = h.x + 0.6; m.y = h.y; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.atkT = 99; m.stun = 0; m.frz = 0; m.dmg = 999;
  D.djStep(st, {});
  const revived = st.ev.some(e => e.k === 'revive') && !h.dead && h.hp > 0;
  st.ev.length = 0; h.b = {}; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.x = h.x + 0.6; m.y = h.y;
  D.djStep(st, {});
  ok(revived && h.dead, 'mort-vivant : se relève une fois, pas deux');
}
/* boss : renforts et sortie */
{
  let summons = 0, exit = false, win = false;
  for (const seed of [11, 12, 13]) {
    const r = play([hero('guerrier', 'nain', 6, { sk: { s0: 2, s1: 2, s2: 1 } })], 3, seed);
    if (r.st.exit) exit = true; if (r.r.win) win = true;
  }
  const d = D.genDungeon(21, 2), st = D.djStart(d, [hero('guerrier', 'nain', 8, { sk: { s0: 3, s1: 3, s2: 2 } })], { seed: 21 }), bot = makeBot(st);
  while (!st.over && st.t < 1200) { D.djStep(st, { [st.heroes[0].id]: bot(st.heroes[0]) }); for (const e of st.ev) if (e.k === 'summon' && e.boss) summons++; st.ev.length = 0; }
  ok(summons === 2 && exit && win, 'le boss appelle des renforts deux fois (66 % et 33 %), puis la sortie apparaît');
}
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
