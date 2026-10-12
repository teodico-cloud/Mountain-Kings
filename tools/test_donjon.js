/* Essais des donjons : fabrication, puis combats joués par un petit robot pour chaque classe. Usage : node tools/test_donjon.js [--long] */
const fs = require('fs'), path = require('path');
const src = ['p2_rules.js', 'p2e_equip.js', 'p2g_garnison.js', 'p2r_raid.js', 'p2s_histoire.js', 'p2d_donjon.js'].map(f => fs.readFileSync(path.join(__dirname, '../src2/' + f), 'utf8')).join('\n');
const D = new Function(src + '\nreturn { genDungeon, djReach, DJ_MONSTERS, DJ_BOSSES, djStart, djStep, djResult, djFlee, djProgress, djCast, DJ_DT, DJ_SKILLS, CLASS_KEYS, RACE_KEYS, djFree, djLos, djSnap, djApplySnap, djLocalMove, djLocalRoll, djFloorCfg, djFloor, djCarry, djRunAdd, djRunResult, genItem, mulberry32, gearOf, djPack, djUnpack, SLOTS, djHalfItems, itemInfo, djHurt, djDamageHero };')();
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
function play(heroes, lvl, seed, maxMin, theme) {
  const d = D.genDungeon(seed, lvl, theme), st = D.djStart(d, heroes, { seed });
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
/* ---------- à deux : l'hôte simule, l'invitée affiche (avec un retard réseau de 100 à 150 ms) ---------- */
function playDuo(seed, lvl, hA, hB, opts) {
  const o = opts || {}, d = D.genDungeon(seed, lvl), st = D.djStart(d, [hA, hB], { seed, remote: hB.id });
  const ms = D.djStart(D.genDungeon(seed, lvl), [hA, hB], { seed });           // copie de l'invitée, faite de son côté
  const botA = makeBot(st), botB = makeBot(ms), toGuest = [], toHost = [];
  let snapN = 0, evBuf = [], lastIn = null, q = [], qSeq = 0, done = 0, sizes = [], guestCasts = 0, raised = 0, desync = 0, rolls = 0;
  const me = ms.heroes.find(h => h.id === hB.id);
  while (!st.over && st.t < (o.maxMin || 20) * 60) {
    /* l'invitée : son héros bouge chez elle, ses boutons partent vers l'hôte */
    const ib = botB(me);
    if (o.roll && st.n % 100 === 50 && D.djLocalRoll(ms, me, ib.mx, ib.my)) { q.push([++qSeq, 'r']); rolls++; }
    D.djLocalMove(ms, me, ib.mx, ib.my, D.DJ_DT);
    if (ib.sk >= 0) q.push([++qSeq, 'k' + ib.sk]); if (ib.pot) q.push([++qSeq, 'p']);
    if (st.n % 2 === 0) { toHost.push({ at: st.n + 2, m: { p: [me.x, me.y, me.fx, me.fy, me.mv ? 1 : 0], tp: me.tp, q: q.slice(-6) } }); }
    while (toHost.length && toHost[0].at <= st.n) lastIn = toHost.shift().m;
    /* l'hôte : un pas de combat avec les commandes des deux */
    const inputs = { [st.heroes[0].id]: botA(st.heroes[0]) }, gi = { pos: lastIn && lastIn.p, tp: lastIn ? lastIn.tp : 0 };
    if (lastIn) for (const [n, c] of lastIn.q) if (n > done) { done = n; if (c === 'p') gi.pot = true; else if (c === 'r') gi.rl = true; else gi.sk = +c.slice(1); break; }
    inputs[hB.id] = gi;
    const castBefore = st.heroes[1].castN;
    D.djStep(st, inputs);
    if (st.heroes[1].castN > castBefore) guestCasts++;
    for (const e of st.ev) if (e.k === 'raise') raised++;
    evBuf.push(...st.ev); st.ev.length = 0;
    if (st.n % 3 === 0 || st.over) { const sn = JSON.parse(JSON.stringify(D.djSnap(st, evBuf, ++snapN))); sizes.push(JSON.stringify(sn).length); evBuf = []; toGuest.push({ at: st.n + 3, sn }); }
    while (toGuest.length && toGuest[0].at <= st.n) D.djApplySnap(ms, toGuest.shift().sn, hB.id);
    if (o.killB && st.t > o.killB && !o.killed) { o.killed = true; st.heroes[1].hp = 1; st.heroes[1].b = {}; st.heroes[1].dodge = 0; st.heroes[1].dead = true; st.heroes[1].hp = 0; }
  }
  while (toGuest.length) D.djApplySnap(ms, toGuest.shift().sn, hB.id);
  const hostB = st.heroes[1];
  desync = Math.hypot(hostB.x - me.x, hostB.y - me.y);
  return { st, ms, guestCasts, raised, desync, rolls, kb: sizes.reduce((x, y) => x + y, 0) / sizes.length / 1024, snaps: sizes.length };
}
{
  const A = hero('guerrier', 'nain', 3, { id: 'hA', own: 'uA' }), B = hero('mage', 'elfe', 3, { id: 'hB', own: 'uB' });
  const r = playDuo(4321, 2, A, B);
  ok(r.st.over === 'win' && r.ms.over === 'win', 'à deux : victoire, vue des deux côtés (' + Math.round(r.st.t) + ' s)');
  ok(r.guestCasts > 3, 'les compétences de l’invitée passent par l’hôte (' + r.guestCasts + ')');
  ok(r.desync < 1.5, 'le héros de l’invitée est au même endroit sur les deux téléphones (écart ' + r.desync.toFixed(2) + ' case)');
  ok(r.ms.mobs.length === r.st.mobs.filter(m => !m.hidden).length && r.ms.xp === Math.round(r.st.xp), 'monstres et expérience identiques sur la copie de l’invitée');
  ok(r.kb < 3, 'instantanés légers : ' + r.kb.toFixed(2) + ' Ko en moyenne, ' + (r.snaps / r.st.t).toFixed(1) + ' par seconde');
  const solo = D.djStart(D.genDungeon(4321, 2), [A], { seed: 4321 }), duo = D.djStart(D.genDungeon(4321, 2), [A, B], { seed: 4321 });
  ok(Math.abs(duo.mobs[0].hpMax / solo.mobs[0].hpMax - 1.7) < 1e-9, 'à deux, les monstres ont 70 % de vie en plus');
  const r2 = playDuo(777, 1, hero('paladin', 'humain', 2, { id: 'hA', own: 'uA' }), hero('voleur', 'orque', 2, { id: 'hB', own: 'uB' }), { killB: 20 });
  ok(r2.raised >= 1, 'un allié tombé se relève (à côté de son partenaire ou à la fin de la salle)');
}
{
  const r = playDuo(4321, 2, hero('mage', 'humain', 4, { id: 'hA', own: 'uA', sk: { s0: 1 } }), hero('guerrier', 'nain', 4, { id: 'hB', own: 'uB' }));
  ok((r.st.combos || 0) >= 5 && D.djResult(r.st).combos === r.st.combos, 'combos à deux : ' + r.st.combos + ' dans la partie (marques et contrôles de l’autre héros)');
  const so = play([hero('mage', 'humain', 4)], 2, 4321);
  ok(!so.st.combos, 'pas de combo en solo');
}
/* ---------- la crypte des rois ---------- */
{
  const d = D.genDungeon(99, 3, 'crypte');
  ok(d.theme === 'crypte' && d.monsters.some(m => m.type === 'squelette') && d.monsters.some(m => m.boss && m.type === 'roiSquelette') && !d.monsters.some(m => m.type === 'gobelin'), 'crypte : squelettes, goules, spectres… et le roi squelette au fond');
  let wins = 0, n = 0, raised = 0, storms = 0, misses = 0, secs = [];
  for (const [cls, race] of [['guerrier', 'nain'], ['mage', 'humain'], ['rodeur', 'elfe'], ['pretre', 'elfe'], ['necro', 'mortvivant'], ['voleur', 'halfelin']]) for (const lvl of [3, 6]) {
    const sk = lvl >= 5 ? { s0: 2, s1: 1, s2: 1 } : { s0: 1 };
    const dd = D.genDungeon(500 + lvl * 7 + n, lvl, 'crypte'), st = D.djStart(dd, [hero(cls, race, lvl, { sk })], { seed: 500 + lvl * 7 + n }), bot = makeBot(st);
    while (!st.over && st.t < 1200) { D.djStep(st, { [st.heroes[0].id]: bot(st.heroes[0]) }); for (const e of st.ev) { if (e.k === 'raised') raised++; if (e.k === 'storm') storms++; if (e.k === 'miss' && st.mobs.some(m => m.id === e.id)) misses++; } st.ev.length = 0; }
    n++; if (st.over === 'win') wins++; secs.push(Math.round(st.t));
  }
  ok(wins >= n - 2, 'crypte : le robot gagne ' + wins + ' fois sur ' + n + ' (niveaux 3 et 6), ' + Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) + ' s en moyenne');
  ok(raised > 0 && storms > 0 && misses > 0, 'nécromants qui relèvent les morts (' + raised + '), tempêtes d’os du roi (' + storms + '), spectres qui esquivent (' + misses + ')');
}
/* ---------- le portail démoniaque (étape 4 : le refermer avec son héros) ---------- */
{
  const d = D.genDungeon(77, 4, 'portail');
  ok(d.theme === 'portail' && d.rooms.filter(r => r.kind === 'fight').length === 3 && d.monsters.some(m => m.type === 'diablotin') && d.monsters.some(m => m.boss && m.type === 'gardien'), 'portail : 3 salles de diablotins (et de gobelins), puis le gardien du portail');
  let wins = 0, n = 0, fire = 0, adds = 0, secs = [];
  for (const [cls, race] of [['guerrier', 'nain'], ['mage', 'humain'], ['rodeur', 'elfe'], ['pretre', 'elfe']]) for (const lvl of [2, 5]) {
    const sk = lvl >= 5 ? { s0: 2, s1: 1, s2: 1 } : { s0: 1 };
    const dd = D.genDungeon(900 + lvl * 7 + n, lvl, 'portail'), st = D.djStart(dd, [hero(cls, race, lvl, { sk })], { seed: 900 + lvl * 7 + n }), bot = makeBot(st);
    while (!st.over && st.t < 900) { D.djStep(st, { [st.heroes[0].id]: bot(st.heroes[0]) }); for (const e of st.ev) { if (e.k === 'storm' && e.c === 'fire') fire++; if (e.k === 'spawn' && st.mobs.some(m => m.id === e.id && (m.type === 'diablotin' || m.type === 'lanceflamme') && m.room === dd.rooms.findIndex(r => r.kind === 'boss'))) adds++; } st.ev.length = 0; }
    n++; if (st.over === 'win') wins++; secs.push(Math.round(st.t));
  }
  ok(wins >= n - 2, 'portail : le robot gagne ' + wins + ' fois sur ' + n + ' (niveaux 2 et 5), ' + Math.round(secs.reduce((a, b) => a + b, 0) / secs.length) + ' s en moyenne (plus court qu’un donjon)');
  ok(fire > 0 && adds > 0, 'le gardien : pluies de feu (' + fire + ') et renforts de diablotins (' + adds + ')');
}
/* ---------- les Profondeurs : des étages sans fin ---------- */
{
  const cf = n => D.djFloorCfg(n, 5);
  ok(cf(1).lvl === 5 && cf(2).lvl === 5 && cf(3).lvl === 6 && cf(10).lvl === 9, 'Profondeurs : +1 niveau de monstres tous les 2 étages');
  ok([1, 2, 3, 4, 5].every(n => cf(n).theme === 'mine') && [6, 10].every(n => cf(n).theme === 'crypte') && cf(11).theme === 'mine', 'la mine (étages 1 à 5), la crypte (6 à 10), et ainsi de suite');
  ok([5, 10, 15].every(n => cf(n).boss) && ![1, 2, 3, 4, 6].some(n => cf(n).boss), 'un boss tous les 5 étages');
  let bad = 0;
  for (let n = 1; n <= 12; n++) for (const seed of [17, 4242, 99991]) {
    const d = D.djFloor(seed, n, 3), c = D.djFloorCfg(n, 3), fights = d.rooms.filter(r => r.kind === 'fight').length, seen = D.djReach(d);
    if (d.floor !== n || d.lvl !== c.lvl || d.theme !== c.theme || fights !== c.rooms || d.rooms.some(r => r.kind === 'boss') !== c.boss || d.monsters.some(m => m.boss) !== c.boss) bad++;
    for (const r of d.rooms) if (!r.cells.some(([x, y]) => seen[y * d.W + x])) bad++;
    if (JSON.stringify(D.djFloor(seed, n, 3).rooms) !== JSON.stringify(d.rooms)) bad++;
  }
  ok(bad === 0, 'étages : bonne taille, bon thème, boss au bon étage, salles reliées, même graine = même étage (36 étages)');
  ok(D.djFloor(17, 1, 3).seed !== D.djFloor(17, 2, 3).seed, 'chaque étage a sa propre graine');
}
{
  /* un robot descend : la vie et les potions suivent d'un étage à l'autre, le cumul grossit */
  const H = hero('guerrier', 'nain', 5, { sk: { s0: 1, s1: 1, s2: 1 } });
  const run = { start: 5, floor: 1, done: 0, xp: 0, loot: {}, kills: 0, secs: 0, combos: 0, pris: false };
  let carry = null, floors = 0, carried = true, last = null;
  for (let n = 1; n <= 6; n++) {
    const d = D.djFloor(31337, n, 5), st = D.djStart(d, [H], { seed: d.seed, carry }), bot = makeBot(st), h = st.heroes[0];
    if (carry) { const c = carry[H.id]; if ((c.hp < 1 && Math.abs(h.hp / h.hpMax - c.hp) > 0.01) || h.pot !== c.pot) carried = false; }
    while (!st.over && st.t < 900) { D.djStep(st, { [h.id]: bot(h) }); st.ev.length = 0; }
    last = st.over;
    if (st.over !== 'floor') break;
    D.djRunAdd(run, D.djResult(st)); run.done = n; floors++;
    carry = D.djCarry(st);
  }
  console.log('  descente du robot : ' + floors + ' étage(s), puis « ' + last + ' » · ' + Math.round(run.xp) + ' xp · ' + run.kills + ' monstres · ' + Math.floor(run.secs / 60) + ' min');
  ok(floors >= 3, 'Profondeurs : le robot (guerrier niveau 5) enchaîne ' + floors + ' étages, chacun finit par « étage terminé »');
  ok(carried, 'la vie (+25 %) et les potions passent d’un étage à l’autre');
  const before = JSON.stringify(run), w = D.djRunResult(run, true), l = D.djRunResult(run, false, { xp: 100, kills: 3, secs: 30, loot: { pierre: 10 }, fled: true }), z = D.djRunResult(run, false, { xp: 0, kills: 0, secs: 0, loot: {} });
  ok(w.win && w.prof && w.deep === floors && w.xp === Math.round(run.xp) && w.theme === 'prof' && JSON.stringify(run) === before, 'remonter : toute l’expérience de la descente (' + w.xp + ')');
  ok(!l.win && l.fled && l.xp === Math.round((run.xp + 100) * 0.5) && l.deep === floors && !z.fled, 'tomber ou fuir : la moitié de tout, étage en cours compris');
  const P = hero('pretre', 'elfe', 5, { sk: { s0: 1, s1: 1, s2: 1 } }), dp = D.djFloor(5, 2, 5);
  const sp = D.djStart(dp, [P], { seed: dp.seed, carry: { [P.id]: { hp: 0.5, pot: 1, revived: true, gone: false } } });
  ok(Math.abs(sp.heroes[0].hp / sp.heroes[0].hpMax - 0.5) < 0.01 && sp.heroes[0].pot === 1 && sp.heroes[0].revived, 'la vie rapportée compte aussi avec la Bénédiction du prêtre ; le relèvement du mort-vivant reste utilisé');
}
{
  /* à deux : l'hôte descend, l'invitée fabrique le même étage et suit */
  const A = hero('guerrier', 'nain', 6, { id: 'hA', own: 'uA', sk: { s0: 2, s1: 1, s2: 1 } }), B = hero('pretre', 'elfe', 6, { id: 'hB', own: 'uB', sk: { s0: 1, s1: 1, s2: 1 } });
  const seed = 2024, d1 = D.djFloor(seed, 1, 6), st = D.djStart(d1, [A, B], { seed: d1.seed }), ms = D.djStart(D.djFloor(seed, 1, 6), [A, B], { seed: d1.seed });
  const bots = st.heroes.map(() => makeBot(st));
  while (!st.over && st.t < 900) { const inp = {}; st.heroes.forEach((h, i) => { inp[h.id] = bots[i](h); }); D.djStep(st, inp); st.ev.length = 0; }
  const sn1 = JSON.parse(JSON.stringify(D.djSnap(st, [], 50)));
  D.djApplySnap(ms, sn1, 'hB');
  ok(st.over === 'floor' && ms.over === 'floor' && sn1.fl === 1 && !sn1.res, 'à deux : fin du 1er étage vue des deux côtés (pas encore de bilan)');
  const carry = D.djCarry(st), d2 = D.djFloor(seed, 2, 6), st2 = D.djStart(d2, [A, B], { seed: d2.seed, remote: 'hB', carry });
  for (let i = 0; i < 30; i++) D.djStep(st2, { hA: {}, hB: { pos: [st2.heroes[1].x, st2.heroes[1].y, 0, 1, 0], tp: 0 } });
  const sn2 = JSON.parse(JSON.stringify(D.djSnap(st2, [], 51)));
  const g2 = D.djFloor(seed, sn2.fl, 6), ms2 = D.djStart(g2, [A, B], { seed: g2.seed });
  const applied = D.djApplySnap(ms2, sn2, 'hB') !== null;
  ok(sn2.fl === 2 && g2.seed === sn2.sd && applied && D.djApplySnap(ms, sn2, 'hB') === null, 'l’invitée refait le 2e étage avec la même graine ; l’ancienne copie refuse le nouvel instantané');
  ok(ms2.heroes.every((h, i) => Math.abs(h.hp - st2.heroes[i].hp) < 0.06) && ms2.mobs.length === st2.mobs.filter(m => !m.hidden && m.hp > 0).length, 'vie rapportée et monstres identiques sur les deux téléphones');
}
/* ---------- l'équipement en donjon ---------- */
{
  const sk = { s0: 1, s1: 1, s2: 1 }, base = hero('guerrier', 'nain', 5, { sk }), geared = Object.assign({}, base, { id: 'hgear', eq: {} });
  for (const sl of ['arme', 'casque', 'armure', 'bottes']) geared.eq[sl] = D.genItem(D.mulberry32(sl.length * 31), { il: 5, r: 2, sl, cls: 'guerrier' });
  const d = D.genDungeon(77, 5), a = D.djStart(d, [base], { seed: 77 }).heroes[0], b = D.djStart(d, [geared], { seed: 77 }).heroes[0];
  ok(b.hpMax > a.hpMax && b.dmg > a.dmg, 'équipement rare de niveau 5 : vie ' + Math.round(a.hpMax) + ' → ' + Math.round(b.hpMax) + ', dégâts ' + a.dmg.toFixed(1) + ' → ' + b.dmg.toFixed(1));
  /* butin d'une partie (robot) */
  let items = 0, gold = 0, gemsN = 0, n = 0, rares = 0;
  for (const seed of [101, 202, 303, 404, 505, 606]) {
    const r = play([hero('guerrier', 'nain', 5, { sk })], 5, seed), l = (r.r.items && r.r.items.hguerriernain) || [];
    n++; items += l.length; gold += r.r.gold; rares += l.filter(x => x.r >= 2).length;
    for (const k in (r.r.gems.hguerriernain || {})) gemsN += r.r.gems.hguerriernain[k];
  }
  console.log('  butin moyen (robot, niveau 5) : ' + (items / n).toFixed(1) + ' objets (dont ' + (rares / n).toFixed(1) + ' rares ou mieux), ' + Math.round(gold / n) + ' or, ' + (gemsN / n).toFixed(1) + ' pierres');
  ok(items / n >= 2 && items / n <= 9, 'objets par donjon : ' + (items / n).toFixed(1));
  ok(gold / n > 100 && gold / n < 1500, 'or par donjon : ' + Math.round(gold / n));
  /* défaite ou fuite : la meilleure moitié des objets */
  const half = D.djHalfItems({ h: [{ r: 0, il: 1 }, { r: 3, il: 1 }, { r: 1, il: 1 }] }, false).h;
  ok(half.length === 2 && half[0].r === 3 && half[1].r === 1, 'défaite ou fuite : on garde la meilleure moitié des objets');
  /* pouvoirs légendaires et ensembles */
  const leg = (cls, sl, pw, lvl) => { const it = D.genItem(D.mulberry32(5), { il: 5, r: 4, sl, cls }); it.pw = pw; return Object.assign(hero(cls, 'humain', lvl || 8, { sk }), { id: 'h' + pw, eq: { [sl]: it } }); };
  {
    const st = D.djStart(D.genDungeon(5, 1), [leg('guerrier', 'armure', 'sursis')], { seed: 5 }), h = st.heroes[0], m = st.mobs[0];
    h.dodge = 0; h.b = {}; h.hp = 5; h.atkT = 99; st.ev.length = 0;
    m.awake = true; m.x = h.x + 0.6; m.y = h.y; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.atkT = 99; m.dmg = 9999; m.hp = m.hpMax = 1e6;
    D.djStep(st, {});
    const saved = st.ev.some(e => e.k === 'sursis') && !h.dead && h.hp === 1;
    st.ev.length = 0; h.b = {}; h.atkT = 99; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.x = h.x + 0.6; m.y = h.y;
    D.djStep(st, {});
    ok(saved && h.dead, 'Dernier Rempart : un coup fatal laisse à 1 point de vie, une seule fois');
  }
  {
    const st = D.djStart(D.genDungeon(5, 1), [leg('paladin', 'armure', 'epines')], { seed: 5 }), h = st.heroes[0], m = st.mobs[0];
    h.dodge = 0; h.atkT = 99; m.awake = true; m.x = h.x + 0.6; m.y = h.y; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.atkT = 99; m.hp = m.hpMax = 1e6;
    D.djStep(st, {});
    ok(m.hp < m.hpMax && st.ev.some(e => e.k === 'hit' && e.id === m.id), 'Peau-de-Ronces : le monstre se blesse en frappant (' + Math.round(m.hpMax - m.hp) + ')');
  }
  {
    const st = D.djStart(D.genDungeon(5, 1), [leg('guerrier', 'arme', 'chaine')], { seed: 5 }), h = st.heroes[0], [m1, m2] = st.mobs;
    for (const [m, dx] of [[m1, 0.9], [m2, 1.9]]) { m.awake = true; m.x = h.x + dx; m.y = h.y; m.atkT = 99; m.hp = m.hpMax = 9999; }
    for (const m of st.mobs.slice(2)) m.awake = false;
    h.atkT = 0; let chained = false;
    for (let i = 0; i < 40 && !chained; i++) { D.djStep(st, {}); chained = st.ev.some(e => e.k === 'chain'); st.ev.length = 0; }
    ok(chained && m2.hp < 9999, 'Croc-de-Foudre : le coup touche aussi un 2e monstre');
  }
  {
    const st = D.djStart(D.genDungeon(5, 1), [leg('mage', 'casque', 'echo')], { seed: 5 }), h = st.heroes[0];
    let echoes = 0;
    for (let i = 0; i < 60; i++) { h.cd[1] = 0; D.djCast(st, h, 1); echoes += st.ev.filter(e => e.k === 'echo').length; st.ev.length = 0; }
    ok(echoes > 3 && echoes < 25, 'Écho des Anciens : ' + echoes + ' compétences aussitôt prêtes sur 60');
  }
  {
    const st = D.djStart(D.genDungeon(5, 1), [leg('voleur', 'bijou', 'soif', 8)], { seed: 5 }), h = st.heroes[0], m = st.mobs[0];
    h.hp = h.hpMax * 0.5; const h0 = h.hp; m.awake = true; m.hp = 1;
    st.calmT = 0; D.djHurt(st, m, 50, h, false, 'basic');
    ok(h.hp > h0 + h.hpMax * 0.025, 'Cœur assoiffé : chaque monstre vaincu rend 3 % de vie');
  }
  {
    const set = (k, sl) => D.genItem(D.mulberry32(sl.length + 3), { il: 5, set: k, sl, cls: 'guerrier' });
    const t4 = Object.assign(hero('guerrier', 'nain', 6, { sk }), { id: 'htroll', eq: {} }); for (const sl of ['arme', 'casque', 'armure', 'bottes']) t4.eq[sl] = set('troll', sl);
    const st = D.djStart(D.genDungeon(5, 1), [t4], { seed: 5 }), h = st.heroes[0], m = st.mobs[0];
    m.awake = true; m.x = h.x + 0.9; m.y = h.y; m.hp = m.hpMax = 1e6; m.atkT = 99; for (const o of st.mobs.slice(1)) o.awake = false;
    let stuns = 0;
    for (let i = 0; i < 1200; i++) { D.djStep(st, {}); stuns += st.ev.filter(e => e.k === 'cc' && e.c === 'stun').length; st.ev.length = 0; m.x = h.x + 0.9; m.y = h.y; }
    ok(h.set4.troll && stuns >= 2, 'tenue du chef troll complète : les coups étourdissent parfois (' + stuns + ' fois en 60 s)');
    const r4 = Object.assign(hero('mage', 'humain', 6, { sk }), { id: 'hroi', eq: {} }); for (const sl of ['casque', 'armure', 'bottes']) r4.eq[sl] = set('roi', sl); r4.eq.arme = D.genItem(D.mulberry32(9), { il: 5, set: 'roi', sl: 'arme', cls: 'mage' });
    const s2 = D.djStart(D.genDungeon(5, 1), [r4], { seed: 5 }), h2 = s2.heroes[0], m2 = s2.mobs[0];
    h2.cd = [5, 5, 5]; m2.awake = true; m2.hp = 1; D.djHurt(s2, m2, 10, h2, false, 'basic');
    ok(h2.cd[0] === 4 && h2.skillMul > 1.1, 'atours du roi squelette : compétences plus fortes, et un monstre vaincu les rapproche d’une seconde');
  }
  /* familiers */
  {
    const pets = ['loup', 'faucon', 'sanglier', 'chouette'].map(p => D.djStart(D.genDungeon(5, 6), [Object.assign(hero('rodeur', 'elfe', 6, { sk }), { id: 'hp' + p, pet: p })], { seed: 5 }));
    const [lo, fa, sa, ch] = pets.map(s2 => s2.heroes[0]), petOf = s2 => s2.allies.find(x => x.kind === 'pet');
    ok(petOf(pets[0]).pt === 'loup' && petOf(pets[0]).dmg > petOf(pets[1]).dmg && fa.crit > lo.crit && sa.hpMax > lo.hpMax && ch.cdMul < lo.cdMul, 'familiers : loup qui mord fort, faucon (critiques), sanglier (vie), chouette (recharge)');
  }
  /* à deux : chacun ses objets ; les objets de l'invitée lui sont envoyés en forme courte */
  {
    const A = hero('guerrier', 'nain', 4, { id: 'hA', own: 'uA', sk: { s0: 1 } }), B = hero('mage', 'elfe', 4, { id: 'hB', own: 'uB', sk: { s0: 1 } });
    const r = playDuo(4321, 3, A, B), res = D.djResult(r.st), la = res.items.hA || [], lb = res.items.hB || [];
    ok(la.length + lb.length >= 2 && la.every(x => x.sl !== 'arme' || ['epee', 'hache'].includes(x.k)) && lb.every(x => x.sl !== 'arme' || ['baton', 'grimoire'].includes(x.k)), 'à deux : chacun ses objets (' + la.length + ' et ' + lb.length + '), les armes faites pour sa classe');
    const one = lb[0] || la[0], back = D.djUnpack(JSON.parse(JSON.stringify(D.djPack(one))));
    ok(JSON.stringify(D.itemInfo(back)) === JSON.stringify(D.itemInfo(one)), 'objet envoyé en forme courte : identique à l’arrivée');
  }
}
/* ---------- la roulade : un bond de côté, intouchable un instant, toutes les 4 s ---------- */
{
  const st = D.djStart(D.genDungeon(5, 1), [hero('guerrier', 'nain', 3)], { seed: 5 }), h = st.heroes[0], m = st.mobs[0];
  for (const o of st.mobs) o.awake = false;
  const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => [0.5, 1, 1.5, 2, 2.5, 3].every(k => D.djFree(st, h.x + dx * k, h.y + dy * k, h.r))) || [0, 1];
  h.dodge = 0; h.b = {}; h.atkT = 99; st.ev.length = 0;
  m.awake = true; m.x = h.x - dir[0] * 0.6; m.y = h.y - dir[1] * 0.6; m.wind = 0.01; m.act = 'melee'; m.actTgt = h.id; m.atkT = 99; m.dmg = 50; m.hp = m.hpMax = 1e6;
  const hp0 = h.hp, x0 = h.x, y0 = h.y, n0 = h.rollN | 0;
  D.djStep(st, { [h.id]: { rl: true, mx: dir[0], my: dir[1] } });
  ok(st.ev.some(e => e.k === 'roll') && h.hp === hp0 && h.rollN === n0 + 1, 'roulade : le coup qui tombe pendant le bond ne fait rien');
  for (let i = 0; i < 10; i++) D.djStep(st, {});
  const moved = Math.hypot(h.x - x0, h.y - y0);
  ok(moved > 2 && moved < 3.5, 'roulade : un bond de ' + moved.toFixed(1) + ' cases dans la direction du joystick');
  D.djStep(st, { [h.id]: { rl: true } });
  ok(h.rollN === n0 + 1, 'roulade : pas de deuxième bond avant la fin de la recharge');
  for (let i = 0; i < 80; i++) D.djStep(st, {});
  D.djStep(st, { [h.id]: { rl: true } });
  ok(h.rollN === n0 + 2, 'roulade : de nouveau prête après 4 secondes');
  /* même combat, mêmes roulades : même résultat (le jeu à deux en dépend) */
  const run = () => { const s = D.djStart(D.genDungeon(4242, 1), [hero('guerrier', 'nain', 1)], { seed: 4242 }), bot = makeBot(s);
    while (!s.over && s.t < 1200) { const hh = s.heroes[0], inp = bot(hh); if (s.n % 90 === 0) inp.rl = true; D.djStep(s, { [hh.id]: inp }); s.ev.length = 0; }
    return JSON.stringify(D.djResult(s)) + s.n + ':' + s.heroes[0].rollN; };
  const ra = run(), rb = run();
  ok(ra === rb, 'roulades comprises, même graine et mêmes commandes : même combat');
  /* à deux : l'invitée roule chez elle, l'hôte la rend intouchable au même moment */
  const r = playDuo(4321, 2, hero('guerrier', 'nain', 3, { id: 'hA', own: 'uA' }), hero('mage', 'elfe', 3, { id: 'hB', own: 'uB' }), { roll: true });
  ok(r.rolls >= 3 && r.st.heroes[1].rollN === r.rolls && r.desync < 1.5 && r.st.over === 'win', 'à deux : les roulades de l’invitée (' + r.rolls + ') arrivent chez l’hôte, les héros restent au même endroit (écart ' + r.desync.toFixed(2) + ')');
}
/* ---------- l'histoire : la mission d'intro « La Source du Mal », guidée par Sukhoï ---------- */
{
  const d = D.genDungeon(123, 1, 'source'), d2 = D.genDungeon(999, 7, 'source'), seen = D.djReach(d);
  ok(d.theme === 'source' && d.rooms.length === 5 && d.rooms.filter(r => r.kind === 'fight').length === 3 && d.rooms.every(r => r.cells.some(([x, y]) => seen[y * d.W + x])) && d.cradle && seen[d.cradle[1] * d.W + d.cradle[0]] && JSON.stringify(d.rooms.map(r => [r.x, r.y])) === JSON.stringify(d2.rooms.map(r => [r.x, r.y])) && d.monsters.length === 10,
    'la Source du Mal : toujours le même petit donjon (3 salles, le gardien, le berceau au fond), tout est relié');
  for (const [cls, race] of [['guerrier', 'nain'], ['mage', 'humain'], ['pretre', 'elfe'], ['voleur', 'halfelin']]) {
    const st = D.djStart(d, [hero(cls, race, 1)], { seed: 123 }), bot = makeBot(st), tut = [], oks = [];
    let saved = 0;
    while (!st.over && st.t < 900) {
      const h = st.heroes[0], inp = bot(h);
      if (st.tuto.on === 'roll' && !(h.rollCd > 0)) inp.rl = true;                 // le joueur écoute Sukhoï
      D.djStep(st, { [h.id]: inp });
      for (const e of st.ev) { if (e.k === 'tuto') tut.push(e.s); if (e.k === 'tutoOk') oks.push(e.s); if (e.k === 'saved') saved++; }
      st.ev.length = 0;
    }
    const r = D.djResult(st);
    ok(st.over === 'win' && r.win && !st.heroes[0].dead && ['move', 'fight', 'cradle'].every(s => tut.includes(s)) && oks.includes('cradle') && tut.includes('roll') && Math.hypot(st.exit.x - d.cradle[0] - 0.5, st.exit.y - d.cradle[1] - 0.5) < 0.01,
      cls + ' niveau 1 : la mission est gagnée en ' + Math.floor(st.t / 60) + ' min ' + String(Math.round(st.t % 60)).padStart(2, '0') + ', +' + r.xp + ' xp ; Sukhoï guide : ' + tut.join(' → ') + (saved ? ' (relevé ' + saved + ' fois)' : ''));
  }
  const st = D.djStart(d, [hero('mage', 'humain', 1)], { seed: 7 }), h = st.heroes[0];
  st.ev.length = 0; D.djDamageHero(st, h, h.hpMax * 5);
  ok(!h.dead && h.hp > h.hpMax * 0.3 && h.b.inv > 0 && st.ev.some(e => e.k === 'saved'), 'dans la mission d’intro, personne ne meurt : Sukhoï relève le héros');
  const g = st.mobs.find(m => m.type === 'gardeSource');
  ok(g && g.boss && g.sp.slam <= 2.5, 'le gardien de la Source annonce vite son premier coup (de quoi apprendre la roulade)');
}
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
