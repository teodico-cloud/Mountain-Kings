/* Une semaine de jeu simulée (10 jours) : deux joueurs qui passent deux fois par jour (8 h et 20 h), avec les vraies règles
   et le vrai moteur de donjon (un petit robot joue les donjons). Sert à régler l'équilibrage : on ne doit jamais être coincé.
   Usage : node tools/sim_semaine.js [jours] [--detail] [--solo]   (--solo : un seul joueur, qui passe aux mêmes heures) */
const fs = require('fs'), path = require('path');
const src = ['p2_rules.js', 'p2e_equip.js', 'p2g_garnison.js', 'p2r_raid.js', 'p2d_donjon.js'].map(f => fs.readFileSync(path.join(__dirname, '../src2/' + f), 'utf8')).join('\n');
const S = new Function(src + `
return { newVillage, simulateVillage, applyV, clone, goalsOf, goalDone, freeSpot, freeHousing, housingOf, hallLvl, BLD, costOf, missingTxt, limitV, countOf, maxLvlOf, sites, sitesMax,
  builders, buildersMax, workersOf, jobsOf, SPEC, heroesOf, activeHero, compareItem, canWear, itemInfo, bagOf, CLASSES, SKILL_LVLS, SPEC_LVL, PET_LVL, raidInfo, raidLevel,
  solList, solCap, postCap, postsOf, recruitCost, solCanPromote, promoteCost, caserneLvl, forgeLvlOf, solForgeCost, repairCostOf, FEAST, foodOf, moraleOf, ratesOf, capOf,
  genDungeon, djStart, djStep, djResult, djLos, mulberry32, hash, solFood, SOL_TYPES };`)();
const DAYS = +process.argv[2] || 10, DETAIL = process.argv.includes('--detail'), SOLO = process.argv.includes('--solo');
const H = 3600000, D = 24 * H, T0 = Date.UTC(2026, 9, 13, 6, 0);       // 8 h à Paris
const U = { u1: { uid: 'u1', name: 'Téo' }, u2: { uid: 'u2', name: 'Léa' } };
const act = (v, a, uid) => S.applyV(v, a, U[uid]);

/* ---------- le robot des donjons (le même que tools/test_donjon.js) ---------- */
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
    const los = m => S.djLos(st, h.x, h.y, m.x, m.y, true) ? 0 : 50;
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
function runDungeon(hh, lvl, theme, seed) {
  const d = S.genDungeon(seed, lvl, theme), st = S.djStart(d, [S.clone(hh)], { seed }), bot = makeBot(st);
  while (!st.over && st.t < 20 * 60) { S.djStep(st, { [st.heroes[0].id]: bot(st.heroes[0]) }); st.ev.length = 0; }
  return S.djResult(st);
}

/* ---------- ce que font les joueurs à chaque visite ---------- */
const PLAN = [
  ['carriere', 1], ['maison', 3], ['champ', 2], ['chasse', 1], ['halle', 2], ['moulin', 1], ['boulangerie', 1], ['maison', 4], ['mine', 1], ['taverne', 1],
  ['forge', 1], ['caserne', 1], ['entrepot', 1, 2], ['maison', 5], ['tour', 1], ['champ', 3], ['bucheron', 2], ['carriere', 2], ['halle', 3], ['chasse', 2],
  ['caserne', 1, 2], ['brasserie', 1], ['maison', 7], ['entrepot', 2], ['entrepot', 1, 3], ['halle', 4], ['entrepot', 2, 3], ['caserne', 1, 3], ['maison', 9], ['tour', 2], ['caserne', 1, 4], ['maison', 11], ['halle', 5],
];
const stats = { dj: 0, djWin: 0, raids: [], built: [], recruits: 0, promotes: 0, famine: 0, gold: { donjons: 0, sacPlein: 0, ventes: 0, raids: 0 } };
function placeNear(v, type) { const hall = v.b.find(b => b.type === 'halle'); return S.freeSpot(v, type, hall ? hall.gx + 1 : 11, hall ? hall.gz + 1 : 11); }
function tryBuild(v, uid, type, want, lvl) {
  const t = v.t;
  if (type === 'halle') {
    const h = v.b.find(b => b.type === 'halle'); if (h.lvl >= want || h.up) return h.lvl >= want;
    return act(v, { type: 'upgrade', id: h.id }, uid).ok && false;
  }
  const list = v.b.filter(b => b.type === type);
  if (lvl) {      // agrandir les premiers (want) jusqu'au niveau voulu, un à la fois
    const todo = list.slice(0, want).filter(b => b.lvl < lvl); if (list.length < want) return false;
    if (!todo.length) return true;
    const b = todo[0]; if (b.up || b.lvl < 1) return false;
    act(v, { type: 'upgrade', id: b.id }, uid); return false;
  }
  if (list.length >= want) return true;
  if (S.sites(v).length >= S.sitesMax(v) + 1) return false;
  const sp = placeNear(v, type); if (!sp) return false;
  const r = act(v, { type: 'build', b: type, gx: sp[0], gz: sp[1] }, uid);
  if (r.ok) stats.built.push(Math.round((t - T0) / H) + ' h : ' + type);
  return false;
}
function jobs(v, uid) {
  /* au moins un bâtisseur (deux s'il y a des chantiers), les autres là où ils sont les meilleurs */
  const nSites = S.sites(v).length, wantB = Math.min(S.buildersMax(v), nSites ? 2 : 1);
  for (const p of v.vil) {
    if (p.job != null) continue;
    if (S.builders(v).length < wantB) { act(v, { type: 'job', vid: p.id, to: 'bat' }, uid); continue; }
    const open = v.b.filter(b => S.BLD[b.type].spec && b.lvl > 0 && S.workersOf(v, b.id).length < S.jobsOf(b));
    open.sort((a, b) => p.st[S.BLD[b.type].spec] - p.st[S.BLD[a.type].spec]);
    if (open.length) act(v, { type: 'job', vid: p.id, to: open[0].id }, uid);
  }
}
function heroTurn(v, uid, seedBase) {
  for (const hh of S.heroesOf(v, uid)) {
    /* points de compétence, spécialisation, familier */
    for (let k = 0; k < 6 && hh.sp; k++) { let done = false; for (const i of [0, 1, 2]) if (hh.lvl >= S.SKILL_LVLS[i] && ((hh.sk && hh.sk['s' + i]) | 0) < 4) { if (act(v, { type: 'skill', hid: hh.id, i }, uid).ok) { done = true; break; } } if (!done) break; }
    if (hh.lvl >= S.SPEC_LVL && hh.spec !== 0 && hh.spec !== 1) act(v, { type: 'spec', hid: hh.id, s: 0 }, uid);
    if (hh.lvl >= S.PET_LVL && !hh.pet) act(v, { type: 'pet', hid: hh.id, p: hh.race === 'elfe' ? 'faucon' : 'sanglier' }, uid);
    /* un donjon par visite : le portail s'il est ouvert, sinon la mine (ou la crypte) au plus haut niveau ouvert */
    const ri = S.raidInfo(v, v.t), open = ri.p.filter(p => !p.cl);
    let theme = 'mine', lvl = hh.dj || 1, pi = 0;
    if (open.length) { theme = 'portail'; lvl = S.raidLevel(v); pi = open[0].i; }
    else if ((hh.dj || 1) >= 3 && seedBase % 2) theme = 'crypte';
    const r = runDungeon(hh, lvl, theme, (S.hash(seedBase) >>> 0) || 1);
    stats.dj++; if (r.win) stats.djWin++;
    const res = act(v, { type: 'djEnd', hid: hh.id, lvl: r.lvl, win: r.win, xp: r.xp, loot: r.loot, pris: r.pris, theme, deep: 0, or: r.gold || 0, items: (r.items || {})[hh.id] || [], gems: (r.gems || {})[hh.id] || {}, pi }, uid);
    stats.gold.donjons += (res.got && res.got.or) || 0; stats.gold.sacPlein += res.autoGold || 0;
    if (DETAIL) console.log(`   ${hh.name} niv. ${hh.lvl} : ${theme} niv. ${lvl} ${r.win ? 'gagné' : 'perdu'} (${Math.round(r.secs / 60)} min, +${res.xp} xp, +${r.gold || 0} or, ${((r.items || {})[hh.id] || []).length} objets)`);
    S.simulateVillage(v, v.t + Math.max(60000, r.secs * 1000));
    /* s'équiper du mieux, vendre les objets communs */
    const bag = S.bagOf(v, uid);
    for (const it of Object.values(bag.it)) if (S.compareItem(hh, it) === 1) act(v, { type: 'equip', hid: hh.id, id: it.id }, uid);
    const junk = Object.values(bag.it).filter(it => it.r === 0 && !it.set).map(it => it.id); if (junk.length > 3) { const rs = act(v, { type: 'sell', ids: junk }, uid); if (rs.ok) stats.gold.ventes += rs.gain; }
    if (res.pris) for (const c of v.cands.slice()) act(v, { type: 'accept', id: c.id }, uid);
  }
}
function garrison(v, uid) {
  if (!S.caserneLvl(v)) return;
  while (S.postsOf(v).length < S.postCap(v)) {
    const hall = v.b.find(b => b.type === 'halle'), n = S.postsOf(v).length, spots = [[hall.gx + 4, hall.gz + 1], [hall.gx - 2, hall.gz + 1], [hall.gx + 1, hall.gz + 4], [hall.gx + 1, hall.gz - 2]];
    let ok = false;
    for (const [x, z] of spots.slice(n).concat(spots)) if (act(v, { type: 'build', b: 'poste', gx: x, gz: z }, uid).ok) { ok = true; break; }
    if (!ok) { const sp = placeNear(v, 'poste'); if (!sp || !act(v, { type: 'build', b: 'poste', gx: sp[0], gz: sp[1] }, uid).ok) break; }
  }
  /* recruter en gardant 60 or de côté, puis répartir */
  let changed = false;
  while (S.solList(v).length < S.solCap(v) && (v.r.or || 0) >= S.recruitCost(v).or + 60) { act(v, { type: 'recruit', t: S.SOL_TYPES[S.solList(v).length % 4] }, uid); stats.recruits++; changed = true; }
  if (changed) act(v, { type: 'solAuto' }, uid);
  for (const s of S.solList(v)) if (S.solCanPromote(s) && !S.missingTxt(v, Object.fromEntries(Object.entries(S.promoteCost(s.lvl)).map(([k, n]) => [k, n + (k === 'or' ? 60 : 30)])))) { act(v, { type: 'promote', sid: s.id }, uid); stats.promotes++; }
  if (S.forgeLvlOf(v)) for (const s of S.solList(v)) if (!s.w && (v.r.fer || 0) > S.solForgeCost('w', s.lvl).fer + 60 && (v.r.or || 0) > 150) act(v, { type: 'solForge', sid: s.id, k: 'w' }, uid);
}
function visit(v, uid, t, k) {
  S.simulateVillage(v, t);
  act(v, { type: 'sync' }, uid);
  for (const g of S.goalsOf(v)) if (S.goalDone(v, g)) act(v, { type: 'claim', id: g.id }, uid);
  for (const c of v.cands.slice()) if (S.freeHousing(v) > 0) act(v, { type: 'accept', id: c.id }, uid);
  jobs(v, uid);
  let n = 0; for (const [type, want, lvl] of PLAN) { if (tryBuild(v, uid, type, want, lvl)) continue; if (++n >= 3) break; }
  jobs(v, uid);
  if (v.b.some(b => S.repairCostOf(b))) act(v, { type: 'repair' }, uid);
  if (v.b.some(b => b.type === 'taverne' && b.lvl > 0) && v.feastCd <= v.t && S.foodOf(v) > 400) act(v, { type: 'feast' }, uid);
  heroTurn(v, uid, k * 7919 + (uid === 'u1' ? 1 : 2));
  garrison(v, uid);
  for (const hh of S.heroesOf(v, uid)) { const tgt = S.sites(v).length ? 'bat' : (v.b.find(b => S.BLD[b.type].spec === (hh.race === 'nain' ? 'mine' : 'chasse') && b.lvl > 0) || {}).id; if (tgt != null && hh.at !== tgt) act(v, { type: 'heroAt', hid: hh.id, to: tgt }, uid); }
}

/* ---------- la semaine ---------- */
const v = S.newVillage('vsim', 'Val-Brume', '#D27A22', T0, 'u1', 'Téo');
if (!SOLO) v.members.u2 = { name: 'Léa', t: T0, hi: 1 };
act(v, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', sex: 'm' }, 'u1');
if (!SOLO) act(v, { type: 'hero', name: 'Aelith', race: 'elfe', cls: 'rodeur', sex: 'f' }, 'u2');
const PLAYERS = SOLO ? ['u1'] : ['u1', 'u2'];
const fmt = n => String(Math.round(n));
console.log('jour | halle | habitants | moral | bois pierre pain viande fer or | héros | soldats | repas/j | raids (volé, vaincus)');
let lastRaidT = 0, k = 0;
for (let day = 0; day < DAYS; day++) {
  for (const hour of [0, 12]) {
    const t = T0 + day * D + hour * H;
    for (const uid of PLAYERS) { visit(v, uid, t + (uid === 'u2' ? 10 * 60000 : 0), k++); }
    if (v.lastRaid && v.lastRaid.t !== lastRaidT) { lastRaidT = v.lastRaid.t; const r = v.lastRaid.res; stats.gold.raids += v.lastRaid.res.g || 0; stats.raids.push({ d: day, L: v.lastRaid.L, f: r.f, k: r.k, lost: Object.values(r.lost).reduce((a, b) => a + b, 0), gk: r.gk || 0, G: (v.lastRaid.G || []).length }); }
  }
  S.simulateVillage(v, T0 + (day + 1) * D - 60000);
  const hs = Object.values(v.heroes).map(h => h.lvl).join('/'), sol = S.solList(v), rt = S.ratesOf(v, v.t);
  const raidsDay = stats.raids.filter(r => r.d === day).map(r => `-${r.lost} (${r.k}/${r.f}${r.G ? ', ' + r.G + ' soldats' : ''})`).join(' ');
  console.log(`${String(day + 1).padStart(4)} | ${S.hallLvl(v)} | ${v.vil.length}/${S.housingOf(v)} | ${S.moraleOf(v, v.t)} | ${[v.r.bois, v.r.pierre, v.r.pain, v.r.viande, v.r.fer, v.r.or].map(fmt).join(' ')} | ${hs} | ${sol.length ? sol.length + ' (niv. ' + sol.map(s => s.lvl).join(',') + ')' : '-'} | ${fmt((rt.food) * 24)} | ${raidsDay}`);
}
const leaves = v.log.filter(l => l.k === 'leave').length;
console.log('or gagné : ' + JSON.stringify(stats.gold));
console.log(`\ndonjons : ${stats.djWin} gagnés sur ${stats.dj} · recrues : ${stats.recruits} · promotions : ${stats.promotes} · départs (famine) : ${leaves}`);
console.log('bâtiments : ' + v.b.filter(b => b.lvl > 0).map(b => b.type + (b.lvl > 1 ? b.lvl : '')).sort().join(' '));
if (DETAIL) console.log('chantiers : ' + stats.built.join(', '));
