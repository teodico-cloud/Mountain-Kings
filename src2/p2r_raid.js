/* ===================== RAIDS : portails démoniaques, gobelins, voleurs et trolls (pur, sans DOM) =====================
   Le calendrier : le premier portail s'ouvre au début du 3e jour du village ; il se charge pendant 3 heures (on voit de quel côté
   viendra le raid), puis le raid part dès que les deux joueurs sont absents depuis 2 heures. Le portail suivant s'ouvre 20 à 28 heures
   après (au plus un raid par jour). Refermer tous les portails avec son héros (le donjon du portail) annule le raid.
   Le combat est simulé d'un coup, de façon déterministe : seulement + − × ÷ et la racine carrée (même résultat sur tous les téléphones),
   10 pas par seconde. La rediffusion rejoue exactement la même simulation à partir de ce qui est gardé dans v.lastRaid.
   Le village fait le donjon : bâtiments et palissades sont des murs, le terrain libre des couloirs. Tout le monde suit les mêmes chemins
   (le plus court, en comptant ce qu'il faudrait casser) ; les trolls cassent les murs et les portes 4 fois plus vite.
   Coordonnées en cases du village : x = colonne (gx), y = ligne (gz) ; le centre d'une case est à +0,5. */
const RAID_FIRST = 2 * DAY, RAID_CHARGE = 3 * HOUR, RAID_AWAY = 2 * HOUR, RAID_GAP = 20 * HOUR, RAID_GAP_RND = 8 * HOUR;
const RAID_DT = 0.1, RAID_LIMIT = 300;                // pas de 1/10 s ; au bout de 5 minutes, ceux qui restent repartent
const RAID_ZONE = 5.5;                                // les héros défendent autour de la halle, dans ce rayon (en cases)
const RAID_PATH_K = 40;                               // casser un mur de 200 de solidité « vaut » un détour de 5 cases
const RAID_BLD_HP = 2500;                             // un bâtiment ordinaire (par case de côté) : on le contourne presque toujours
const RAID_SIDES = ['nord', 'est', 'sud', 'ouest'], RAID_AT = ['au nord', 'à l’est', 'au sud', 'à l’ouest'], RAID_OF = ['du nord', 'de l’est', 'du sud', 'de l’ouest'];
const RAID_LOOT = ['bois', 'pierre', 'pain', 'viande', 'fer'];
/* Ennemis au niveau 1 (vie, dégâts sur les héros, secondes entre deux coups, allonge, vitesse en cases par seconde,
   butin emporté, dégâts sur les murs : sdmg × wall). */
const RAID_FOES = {
  gobelin: { name: 'Gobelin', plural: 'Gobelins', hp: 90, dmg: 8, rate: 1.0, reach: 0.35, speed: 1.6, r: 0.3, carry: 15, sdmg: 8, wall: 1, xp: 6, gold: 3, fight: true },
  voleur: { name: 'Gobelin voleur', plural: 'Gobelins voleurs', hp: 60, dmg: 0, rate: 1.0, reach: 0, speed: 2.3, r: 0.28, carry: 35, sdmg: 3, wall: 1, xp: 8, gold: 5, thief: true },
  troll: { name: 'Troll', plural: 'Trolls', hp: 520, dmg: 26, rate: 1.6, reach: 0.45, speed: 1.0, r: 0.45, carry: 25, sdmg: 26, wall: 4, xp: 25, gold: 12, fight: true },
};
/* Héros en défense, au niveau 1 (attaque simple seulement ; le mage touche aussi autour de sa cible, le prêtre soigne en frappant). */
const RAID_HERO = {
  guerrier: { hp: 340, dmg: 14, armor: 0.25, range: 1.0, cd: 1.0, speed: 2.4 },
  paladin: { hp: 320, dmg: 13, armor: 0.22, range: 1.0, cd: 1.0, speed: 2.3 },
  rodeur: { hp: 230, dmg: 11, armor: 0.05, range: 5.5, cd: 0.9, speed: 2.5 },
  mage: { hp: 200, dmg: 12, armor: 0, range: 5, cd: 1.1, speed: 2.3 },
  voleur: { hp: 260, dmg: 9, armor: 0.15, range: 1.0, cd: 0.6, speed: 2.6 },
  pretre: { hp: 210, dmg: 9, armor: 0.05, range: 4.5, cd: 1.1, speed: 2.3 },
  druide: { hp: 250, dmg: 10, armor: 0.1, range: 4.5, cd: 1.0, speed: 2.3 },
  necro: { hp: 200, dmg: 10, armor: 0.05, range: 5, cd: 1.2, speed: 2.3 },
};
const RAID_NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/* ---------- outils (déterministes) ---------- */
const raidPow = (b, n) => { let k = 1; for (let i = 0; i < n; i++) k *= b; return k; };
function raidRnd(st) { const a = st.rs = (st.rs + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const raidCell = v => Math.max(0, Math.min(GRID - 1, Math.floor(v)));
const raidLen = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const raidDist = (a, b) => raidLen(a.x - b.x, a.y - b.y);
const raidAlive = u => u.on && !u.dead && !u.out;
function raidDistRect(x, y, S) { const dx = Math.max(S.x0 - x, 0, x - (S.x0 + S.s)), dy = Math.max(S.y0 - y, 0, y - (S.y0 + S.s)); return raidLen(dx, dy); }
function raidFace(u, t) { const dx = t.x - u.x, dy = t.y - u.y, L = raidLen(dx, dy); if (L > 1e-6) { u.fx = dx / L; u.fy = dy / L; } }

/* ---------- le calendrier ---------- */
/* Niveau des ennemis : la moyenne du meilleur héros de chaque joueur. */
function raidLevel(v) {
  const best = Object.keys(v.members || {}).map(uid => heroesOf(v, uid).reduce((m, h) => Math.max(m, h.lvl | 0), 0)).filter(x => x > 0);
  return best.length ? Math.max(1, Math.round(best.reduce((a, b) => a + b, 0) / best.length)) : 1;
}
/* Appelé à chaque minute de la simulation du village. */
function raidTick(v) {
  const t = v.t;
  if (!v.raid || typeof v.raid !== 'object') v.raid = { n: 0, next: Math.max(v.born + RAID_FIRST, t + 6 * HOUR) };
  const R = v.raid;
  if (!R.p) { if (t >= (R.next || 0)) raidOpen(v, t); return; }
  if (t < (R.at || 0) + RAID_CHARGE) return;
  if (!R.rd) { R.rd = 1; addLog(v, t, (R.p.length > 1 ? 'Les portails sont chargés' : 'Le portail est chargé') + ' : les gobelins attaqueront dès que personne n’aura joué depuis 2 heures.', 'portal'); }
  if (t - (v.here || 0) < RAID_AWAY) return;
  raidResolve(v, t);
}
/* Un (ou plusieurs, selon la halle) portail s'ouvre au bord de la vallée, d'un côté tiré au hasard. */
function raidOpen(v, t) {
  const R = v.raid, rnd = mulberry32(hash((v.seed ^ Math.imul((R.n | 0) + 1 + 7 * (R.closed | 0), 0x2c1b3c6d)) >>> 0));
  const hl = hallLvl(v), n = hl >= 5 ? 3 : hl >= 3 ? 2 : 1, sides = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), s = sides[i]; sides[i] = sides[j]; sides[j] = s; }
  R.p = [];
  for (let i = 0; i < n; i++) { const s = sides[i], k = 4 + Math.floor(rnd() * (GRID - 8)); R.p.push(s === 0 ? [k, 0, 0] : s === 1 ? [GRID - 1, k, 1] : s === 2 ? [k, GRID - 1, 2] : [0, k, 3]); }
  R.cl = R.p.map(() => 0); R.sd = (Math.floor(rnd() * 4294967295) >>> 0) || 1; R.at = t; R.rd = 0;
  const where = R.p.map(p => RAID_AT[p[2]]);
  addLog(v, t, (n > 1 ? n + ' portails démoniaques s’ouvrent au bord de la vallée (' + where.join(', ') + ') : ils seront chargés' : 'Un portail démoniaque s’ouvre ' + where[0] + ' de la vallée : il sera chargé') + ' dans 3 heures. Préparez vos défenses, ou refermez-le avec votre héros !', 'portal');
}
/* Portail refermé par un héros (donjon du portail gagné). Tous refermés : pas de raid cette fois, le suivant viendra plus tard. */
function raidClosePortal(v, t, pi, who) {
  const R = v.raid; if (!R || !R.p || !R.p[pi] || !R.cl || R.cl[pi]) return null;
  R.cl[pi] = 1;
  const left = R.cl.filter(c => !c).length, side = R.p[pi][2];
  if (!left) { const rnd = mulberry32((R.sd ^ 0x51ed27) >>> 0); R.p = null; R.cl = null; R.rd = 0; R.closed = (R.closed | 0) + 1; R.next = t + RAID_GAP + Math.floor(rnd() * (RAID_GAP_RND / MIN)) * MIN; }
  addLog(v, t, who + ' referme le portail ' + RAID_OF[side] + (left ? ' : il en reste ' + left + ' ouvert' + (left > 1 ? 's' : '') + '.' : ' : pas de raid cette fois !'), 'portal');
  return { side, all: !left };
}
/* Pour l'affichage : calme, portail qui se charge, ou portail chargé. */
function raidInfo(v, t) {
  const R = v.raid || {};
  if (!R.p) return { st: 'calm', next: R.next || 0, p: [] };
  const ready = (R.at || 0) + RAID_CHARGE;
  return { st: t < ready ? 'charge' : 'ready', ready, frac: Math.max(0, Math.min(1, (t - (R.at || 0)) / RAID_CHARGE)), p: R.p.map((p, i) => ({ x: p[0], y: p[1], side: p[2], cl: !!(R.cl && R.cl[i]), i })) };
}

/* ---------- le raid : ce qu'on garde pour le simuler (et le rediffuser) ---------- */
function raidHeroStats(h) {
  const C = RAID_HERO[h.cls] || RAID_HERO.guerrier, L = Math.max(1, Math.min(HERO_MAX_LVL, h.lvl | 0)), pw = raidPow(1.1, L - 1), G = gearOf(h);
  const hp = Math.round(C.hp * pw * (h.race === 'nain' ? 1.15 : 1) * (1 + G.hp / 100));
  const dmg = r1(C.dmg * pw * (1 + G.dmg / 100));
  return [h.id, String(h.name || ''), RAID_HERO[h.cls] ? h.cls : 'guerrier', RACES[h.race] ? h.race : 'humain', h.sex === 'f' ? 'f' : 'm', COLORS.includes(h.col) ? h.col : COLORS[0], L, hp, dmg,
    r2(Math.min(0.6, C.armor + G.armor / 100)), C.range, r2(C.cd / (1 + G.haste / 100)), r2(C.speed * (h.race === 'elfe' ? 1.1 : 1))];
}
/* Les assaillants : gobelins, voleurs (1 + halle/2) et trolls (dès la halle 2) ; un peu plus nombreux au fil des raids. Le tout premier raid est doux. */
function raidForce(v, R, open) {
  const hl = hallLvl(v), n = R.n | 0, rnd = mulberry32((R.sd ^ 0x7f4a7c15) >>> 0);
  let gob = 3 + hl + Math.min(3, Math.floor(n / 3)), vol = 1 + Math.floor(hl / 2), tro = Math.floor(hl / 2);
  if (n === 0) { gob = 3; vol = 1; tro = 0; }
  const list = [];
  for (let i = 0; i < tro; i++) list.push('troll');
  for (let i = 0; i < gob; i++) list.push('gobelin');
  for (let i = 0; i < vol; i++) list.push('voleur');
  /* les trolls ouvrent la marche, les gobelins suivent, les voleurs se faufilent un peu après */
  return list.map((type, i) => [type, open[i % open.length], r1((type === 'troll' ? 0 : type === 'gobelin' ? 1.5 : 6) + i * 0.6 + rnd() * 0.8)]);
}
/* La garnison : les soldats affectés à un poste et pas blessés.
   [id, type, race, sexe, niveau, vie, dégâts, armure, allonge, secondes entre deux coups, vitesse, poste, esquive, régénération (% par s), épines, numéro, titre]
   Sans nourriture au village, ils frappent moins fort (−25 %). */
function raidGuards(v, t) {
  const posts = v.b.filter(b => b.type === 'poste' && b.lvl > 0), hungry = (v.hunger || 0) > 0 || foodOf(v) < 1;
  return solList(v).filter(s => s.post && !solHurt(s, t) && posts.some(b => b.id === s.post)).map(s => {
    const S = solStats(s, posts.find(b => b.id === s.post));
    return [s.id, s.type, s.race === 'nain' || s.race === 'elfe' ? s.race : 'humain', s.sex === 'f' ? 'f' : 'm', Math.max(1, s.lvl | 0), S.hp, hungry ? r1(S.dmg * 0.75) : S.dmg, S.armor, S.range, S.cd, S.speed, s.post, S.dodge, S.regen, S.thorns, s.num | 0, solTitle(s) ? 1 : 0];
  });
}
function raidInput(v, t) {
  const R = v.raid, open = R.p.map((p, i) => i).filter(i => !R.cl[i]);
  /* le 6e nombre : la solidité (palissade, porte, tour) ; pour un poste de garde, la rareté de sa bannière + 1 (0 : pas de bannière) */
  const B = v.b.filter(b => BLD[b.type] && b.type !== 'marchand').map(b => [b.id, b.type, b.lvl | 0, b.gx, b.gz, b.type === 'poste' ? (banOk(b.ban) ? 1 + b.ban.r : 0) : BLD[b.type].hps ? Math.round(hpOf(b)) : 0]);
  const H = Object.values(v.heroes || {}).filter(Boolean).sort((a, b) => (a.n || 0) - (b.n || 0)).map(raidHeroStats);
  const stock = {}; for (const k of RAID_LOOT.concat(['or'])) stock[k] = Math.floor(v.r[k] || 0);
  const inp = { t, n: R.n | 0, sd: R.sd, L: raidLevel(v), P: R.p.map((p, i) => [p[0], p[1], p[2], R.cl[i] ? 1 : 0]), B, H, F: raidForce(v, R, open), R: stock };
  const G = raidGuards(v, t); if (G.length) inp.G = G;
  /* L'humeur de Lilou (l'histoire) : les gobelins frappent plus ou moins fort ; dès le chapitre 3, la moitié d'entre eux vise sa chambre */
  const M = lilouMul(v); if (M !== 1) inp.M = M;
  if (crownRaidOn(v)) inp.C = 1;
  return inp;
}

/* ---------- le combat ---------- */
function raidMark(st, S, val) { for (let y = S.y0; y < S.y0 + S.s; y++) for (let x = S.x0; x < S.x0 + S.s; x++) if (x >= 0 && y >= 0 && x < GRID && y < GRID) st.occ[y * GRID + x] = val; }
function raidStart(inp) {
  const N = GRID * GRID, L = Math.max(1, inp.L | 0);
  const st = {
    inp, t: 0, n: 0, rs: (inp.sd ^ 0x2545f491) >>> 0, over: false, ev: [], mood: +inp.M || 1,
    S: [], occ: new Int16Array(N), trapAt: new Int16Array(N), traps: [], towers: [], foes: [], heroes: [], posts: [], guards: [],
    ff: {}, hf: new Map(), gen: 0, hall: -1, stores: [], ch: -1, lil: 0,
    stock: Object.assign({}, inp.R), taken: {}, lost: {}, back: {}, kills: 0, esc: 0, gold: 0, xp: 0, heart: 0, broke: 0,
    L, mul: raidPow(1.12, L - 1), lootMul: 1 + 0.15 * (L - 1),
    defMul: raidPow(1.08, L - 1),        // tours et pièges suivent un peu le niveau des ennemis (moins vite : il faut les améliorer)
  };
  for (const e of inp.B) {
    const id = e[0], type = e[1], lvl = e[2] | 0, gx = e[3], gz = e[4], d = BLD[type]; if (!d) continue;
    /* poste de garde : on passe à travers ; il garde un cercle (bannière : sa rareté + 1) */
    if (d.def === 'post') { if (lvl >= 1) st.posts.push({ id, lvl, gx, gz, x: gx + 0.5, y: gz + 0.5, r: d.zone[Math.min(lvl, d.max) - 1], ban: e[5] | 0 }); continue; }
    if (d.def === 'trap') {
      if (lvl < 1) continue;
      const T = d.trap, k = Math.min(lvl, d.max) - 1;
      st.traps.push({ id, type, lvl, x: gx, y: gz, uses: T.uses[k], cd: 0, dmg: T.dmg ? T.dmg[k] : 0, root: T.root ? T.root[k] : 0, shown: false });
      st.trapAt[gz * GRID + gx] = st.traps.length;
      continue;
    }
    const s = d.size, kind = type === 'halle' ? 'halle' : type === 'rempart' ? 'wall' : type === 'porte' ? 'gate' : type === 'tour' && lvl > 0 ? 'tower' : type === 'entrepot' && lvl > 0 ? 'store'
      : type === 'chambre' && inp.C ? 'chambre' : 'bld';
    const def = kind === 'wall' || kind === 'gate' || kind === 'tower', max = def ? hpMaxOf({ type, lvl }) : RAID_BLD_HP * s, hp = def ? Math.max(0, Math.min(max, e[5])) : max;
    const S = { id, type, kind, lvl, x0: gx, y0: gz, s, x: gx + s / 2, y: gz + s / 2, hp, max, hp0: hp, dead: hp <= 0 };
    st.S.push(S);
    const si = st.S.length - 1;
    if (!S.dead) raidMark(st, S, si + 1);
    if (kind === 'halle' && st.hall < 0) st.hall = si;
    if (kind === 'chambre' && st.ch < 0) st.ch = si;
    if (kind === 'store') st.stores.push(si);
    if (kind === 'tower') { const T = d.tw, k = Math.min(lvl, d.max) - 1; st.towers.push({ si, cd: 0.6, range: T.range[k], dmg: T.dmg[k], rate: T.rate, n: 0 }); }
  }
  if (st.hall < 0) { st.S.push({ id: 0, type: 'halle', kind: 'halle', lvl: 1, x0: 11, y0: 11, s: 2, x: 12, y: 12, hp: 1, max: 1, hp0: 1, dead: false }); st.hall = st.S.length - 1; }
  /* Les héros se postent autour de la halle */
  const spots = raidSpots(st, inp.H.length);
  inp.H.forEach((e, i) => {
    const sp = spots[i] || [st.S[st.hall].x, st.S[st.hall].y + st.S[st.hall].s / 2 + 0.5];
    st.heroes.push({ id: e[0], name: e[1], cls: e[2], race: e[3], sex: e[4], col: e[5], lvl: e[6], kind: 'hero', hp: e[7], hpMax: e[7], dmg: e[8], armor: e[9], range: e[10], cd: e[11], speed: e[12],
      r: 0.3, x: sp[0], y: sp[1], px: sp[0], py: sp[1], home: sp, atkT: 0.2 + 0.1 * i, atkN: 0, mv: false, ko: false, dead: false, fx: 0, fy: 1 });
  });
  /* La garnison : chaque garde à sa place dans la formation de son poste, tournée vers le portail ouvert le plus proche */
  const G = inp.G || [], open = inp.P.filter(p => !p[3]);
  for (const P0 of st.posts) {
    const mine = G.filter(e => e[11] === P0.id); if (!mine.length) continue;
    let dx = 0, dy = -1, bd = 1e18;
    for (const p of open) { const ex = p[0] + 0.5 - P0.x, ey = p[1] + 0.5 - P0.y, d2 = ex * ex + ey * ey; if (d2 < bd && d2 > 1e-6) { bd = d2; const L0 = Math.sqrt(d2); dx = ex / L0; dy = ey / L0; } }
    const spots = solFormation(P0, mine.map(e => e[1]), dx, dy, (cx, cy) => raidBlocked(st, cx, cy));
    mine.forEach((e, i) => {
      const sp = spots[i];
      st.guards.push({ id: e[0], type: SOLDIERS[e[1]] ? e[1] : 'fant', race: e[2], sex: e[3], lvl: e[4], kind: 'guard', hp: e[5], hpMax: e[5], dmg: e[6], armor: e[7], range: e[8], cd: e[9], speed: e[10],
        post: P0, dodge: e[12], regen: e[13], thorns: e[14], num: e[15], title: e[16], r: 0.28, x: sp[0], y: sp[1], px: sp[0], py: sp[1], home: sp,
        atkT: 0.3 + 0.07 * st.guards.length, atkN: 0, mv: false, ko: false, dead: false, fx: dx, fy: dy, kills: 0 });
    });
  }
  inp.F.forEach((f, i) => {
    const type = RAID_FOES[f[0]] ? f[0] : 'gobelin', D = RAID_FOES[type], k = st.mul;
    st.foes.push({ id: 100 + i, type, kind: 'mob', pi: Math.max(0, Math.min(inp.P.length - 1, f[1] | 0)), delay: +f[2] || 0, on: false, dead: false, out: false,
      r: D.r, big: type === 'troll', hp: r1(D.hp * k), hpMax: r1(D.hp * k), dmg: r1(D.dmg * k * st.mood), sdmg: r1(D.sdmg * k * st.mood), rate: D.rate, reach: D.reach, speed: D.speed,
      carry: D.carry, wall: D.wall, fight: !!D.fight, thief: !!D.thief, x: 0, y: 0, px: 0, py: 0, fx: 0, fy: 1, mv: false, atkT: 0.5, atkN: 0, goal: 't',
      tk: st.ch >= 0 && type === 'gobelin' && i % 2 === 0 ? 'c' : 'h', pl: 0, loot: null, root: 0 });     // un gobelin sur deux vise la chambre de Lilou (inp.C)
  });
  return st;
}
/* Places de départ des héros : les cases libres tout autour de la halle (puis un peu plus loin), réparties. */
function raidSpots(st, n) {
  const H = st.S[st.hall], out = [];
  for (let ring = 1; ring <= 3 && out.length < Math.max(n, 1) * 2; ring++) {
    const cells = [];
    for (let y = H.y0 - ring; y < H.y0 + H.s + ring; y++) for (let x = H.x0 - ring; x < H.x0 + H.s + ring; x++) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      const edge = x === H.x0 - ring || y === H.y0 - ring || x === H.x0 + H.s + ring - 1 || y === H.y0 + H.s + ring - 1;
      if (edge && !st.occ[y * GRID + x]) cells.push([x + 0.5, y + 0.5]);
    }
    for (const c of cells) out.push(c);
  }
  if (!n || !out.length) return out;
  const step = Math.max(1, Math.floor(out.length / n)), pick = [];
  for (let i = 0; i < n; i++) pick.push(out[(i * step) % out.length]);
  return pick;
}
/* Une case où un défenseur ne peut pas aller : hors de la vallée, un mur, un bâtiment (pas une porte ni une ruine). */
function raidBlocked(st, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return true;
  const o = st.occ[cy * GRID + cx] - 1; return o >= 0 && st.S[o].kind !== 'gate';
}
/* Formation d'un poste (P0 : { x, y, r }) : fantassins et lanciers devant, vers (dx, dy), archers et mages derrière ; 4 par rang.
   Une place prise par un mur ou hors du cercle : la case libre la plus proche dans le cercle. Même résultat partout (raid et village). */
function solFormation(P0, types, dx, dy, blocked) {
  const px = -dy, py = dx, out = new Array(types.length), taken = [], fr = [], bk = [], rows = [];
  types.forEach((ty, i) => ((SOLDIERS[ty] || SOLDIERS.fant).front ? fr : bk).push(i));
  const lay = (idx, d0) => { for (let k = 0; k < idx.length; k += 4) rows.push([idx.slice(k, k + 4), d0 - 0.9 * (k / 4)]); };
  lay(fr, Math.min(1.5, P0.r * 0.45)); lay(bk, -Math.min(0.6, P0.r * 0.15));
  for (const [list, d] of rows) list.forEach((i, j) => {
    const off = (j - (list.length - 1) / 2) * 0.9;
    let x = P0.x + dx * d + px * off, y = P0.y + dy * d + py * off;
    if (blocked(Math.floor(x), Math.floor(y)) || raidLen(x - P0.x, y - P0.y) > P0.r - 0.2) { const f = solFree(P0, x, y, blocked, taken); x = f[0]; y = f[1]; }
    taken.push([x, y]); out[i] = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
  return out;
}
function solFree(P0, x, y, blocked, taken) {
  let best = null, bd = 1e18;
  for (let cy = Math.floor(P0.y - P0.r); cy <= Math.floor(P0.y + P0.r); cy++) for (let cx = Math.floor(P0.x - P0.r); cx <= Math.floor(P0.x + P0.r); cx++) {
    if (blocked(cx, cy)) continue;
    const ox = cx + 0.5, oy = cy + 0.5; if (raidLen(ox - P0.x, oy - P0.y) > P0.r - 0.2) continue;
    let used = 0; for (const q of taken) if (raidLen(q[0] - ox, q[1] - oy) < 0.5) used++;
    const d = (ox - x) * (ox - x) + (oy - y) * (oy - y) + used * 4;
    if (d < bd) { bd = d; best = [ox, oy]; }
  }
  return best || [P0.x, P0.y];
}

/* ---------- chemins : une carte des distances par but (halle, réserve, portail), refaite quand un mur tombe ---------- */
function raidCost(st, i, ti) {
  const o = st.occ[i] - 1; if (o < 0) return 1;
  if (o === ti) return 1e7;
  const S = st.S[o]; return S.kind === 'halle' ? 1e7 : 1 + S.hp / RAID_PATH_K;
}
function raidGoals(st, key) {
  const out = [];
  if (key[0] === 'p') {
    const P = st.inp.P[+key.slice(1)] || st.inp.P[0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = P[0] + dx, y = P[1] + dy; if (x >= 0 && y >= 0 && x < GRID && y < GRID) out.push(y * GRID + x); }
    return out;
  }
  const S = st.S[key === 'h' ? st.hall : key === 'c' ? st.ch : st.stores[+key.slice(1)]];
  for (let y = S.y0 - 1; y <= S.y0 + S.s; y++) for (let x = S.x0 - 1; x <= S.x0 + S.s; x++) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    if (x >= S.x0 && x < S.x0 + S.s && y >= S.y0 && y < S.y0 + S.s) continue;
    out.push(y * GRID + x);
  }
  return out;
}
function raidField(st, key) {
  const f0 = st.ff[key]; if (f0 && f0.g === st.gen) return f0;
  const N = GRID * GRID, d = new Float64Array(N).fill(1e9), ti = key === 'h' ? st.hall : key === 'c' ? st.ch : key[0] === 's' ? st.stores[+key.slice(1)] : -1;
  /* tas binaire ; à égalité, la plus petite case d'abord (même ordre partout) */
  const hd = [], hi = [];
  const less = (da, ia, db, ib) => da < db || (da === db && ia < ib);
  const push = (i, x) => { let k = hd.length; hd.push(x); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (!less(x, i, hd[p], hi[p])) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = x; hi[k] = i; };
  for (const g of raidGoals(st, key)) if (d[g] > 0) { d[g] = 0; push(g, 0); }
  while (hd.length) {
    const i = hi[0], di = hd[0], li = hi.pop(), ld = hd.pop(), n = hd.length;
    if (n > 0) {
      let k = 0;
      for (;;) { const l = 2 * k + 1; if (l >= n) break; const r = l + 1, m = r < n && less(hd[r], hi[r], hd[l], hi[l]) ? r : l; if (!less(hd[m], hi[m], ld, li)) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; }
      hd[k] = ld; hi[k] = li;
    }
    if (di > d[i]) continue;
    const ec = raidCost(st, i, ti); if (ec >= 1e7) continue;      // on ne traverse ni la halle ni la cible
    const x = i % GRID, y = (i / GRID) | 0;
    for (const nb of RAID_NB) {
      const nx = x + nb[0], ny = y + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (nb[0] && nb[1] && (st.occ[y * GRID + nx] || st.occ[ny * GRID + x])) continue;   // pas de coin coupé entre deux murs
      const ni = ny * GRID + nx, nd = di + ec * nb[2];
      if (nd < d[ni]) { d[ni] = nd; push(ni, nd); }
    }
  }
  return (st.ff[key] = { d, g: st.gen, ti });
}
/* Les héros passent par les cases libres, les portes et les ruines (pas à travers les murs ni les bâtiments). */
const raidHeroPass = (st, i) => { const o = st.occ[i] - 1; return o < 0 || st.S[o].kind === 'gate'; };
function raidHeroField(st, goal) {
  const f0 = st.hf.get(goal); if (f0 && f0.g === st.gen) return f0.d;
  const N = GRID * GRID, d = new Float64Array(N).fill(1e9), q = [goal]; d[goal] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % GRID, y = (i / GRID) | 0;
    for (const nb of RAID_NB) {
      const nx = x + nb[0], ny = y + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = ny * GRID + nx; if (d[ni] < 1e9 || !raidHeroPass(st, ni)) continue;
      if (nb[0] && nb[1] && (!raidHeroPass(st, y * GRID + nx) || !raidHeroPass(st, ny * GRID + x))) continue;
      d[ni] = d[i] + 1; q.push(ni);
    }
  }
  if (st.hf.size > 80) st.hf.clear();
  st.hf.set(goal, { d, g: st.gen });
  return d;
}

/* ---------- dégâts ---------- */
function raidHurtFoe(st, u, v, by) {
  if (!raidAlive(u) || !(v > 0)) return;
  u.hp -= v; st.ev.push({ k: 'hit', id: u.id, v: Math.round(v) });
  if (u.hp <= 0) { raidKill(st, u); if (by && by.kind === 'guard') by.kills++; }
}
/* Un garde touché : il esquive peut-être, son armure encaisse, ses épines renvoient une part du coup ; à 0, il tombe (blessé). */
function raidHurtGuard(st, g, v, u) {
  if (g.ko) return;
  if (g.dodge > 0 && raidRnd(st) < g.dodge) { st.ev.push({ k: 'dodge', id: g.id }); return; }
  const n = v * (1 - g.armor); g.hp -= n; st.ev.push({ k: 'hurt', id: g.id, v: Math.round(n) });
  if (g.thorns > 0 && u) raidHurtFoe(st, u, n * g.thorns, g);
  if (g.hp <= 0) { g.hp = 0; g.ko = true; g.dead = true; st.ev.push({ k: 'ko', id: g.id, x: g.x, y: g.y }); }
}
function raidKill(st, u) {
  const D = RAID_FOES[u.type];
  u.hp = 0; u.dead = true; st.kills++;
  st.gold += D.gold * (1 + 0.1 * (st.L - 1)); st.xp += D.xp * (1 + 0.25 * (st.L - 1));
  if (u.loot) { st.back[u.loot[0]] = (st.back[u.loot[0]] || 0) + u.loot[1]; st.ev.push({ k: 'drop', id: u.id, x: u.x, y: u.y, r: u.loot[0], n: u.loot[1] }); u.loot = null; }
  st.ev.push({ k: 'die', id: u.id, x: u.x, y: u.y, big: u.big });
}
function raidHurtHero(st, h, v) {
  if (h.ko) return;
  const n = v * (1 - h.armor); h.hp -= n; st.ev.push({ k: 'hurt', id: h.id, v: Math.round(n) });
  if (h.hp <= 0) { h.hp = 0; h.ko = true; h.dead = true; st.ev.push({ k: 'ko', id: h.id, x: h.x, y: h.y }); }
}
function raidHurtStruct(st, si, v) {
  const S = st.S[si]; if (S.dead || S.kind === 'halle') return;
  S.hp -= v; S.hitT = st.t;
  if (S.hp <= 0) {
    S.hp = 0; S.dead = true; raidMark(st, S, 0); st.gen++;
    if (S.kind !== 'bld' && S.kind !== 'store' && S.kind !== 'chambre') st.broke++;
    st.ev.push({ k: 'break', si, x: S.x, y: S.y, kind: S.kind });
  }
}

/* ---------- chacun son tour ---------- */
function raidSpawn(st, u) {
  const P = st.inp.P[u.pi] || st.inp.P[0], j = (raidRnd(st) - 0.5) * 0.6, side = P[2];
  u.x = u.px = P[0] + 0.5 + (side === 0 || side === 2 ? j : 0);
  u.y = u.py = P[1] + 0.5 + (side === 1 || side === 3 ? j : 0);
  u.on = true;
  /* le voleur file vers les réserves (l'entrepôt le plus facile à atteindre) ; s'il n'y en a pas, vers la halle */
  if (u.thief && st.stores.length) { const ci = raidCell(u.y) * GRID + raidCell(u.x); let bk = '', bd = 1e18; st.stores.forEach((si, k) => { const dd = raidField(st, 's' + k).d[ci]; if (dd < bd) { bd = dd; bk = 's' + k; } }); u.tk = bk; }
  st.ev.push({ k: 'spawn', id: u.id, x: u.x, y: u.y });
}
function raidMoveTo(u, tx, ty, sp) {
  const dx = tx - u.x, dy = ty - u.y, L = raidLen(dx, dy); if (L < 1e-6) return;
  const k = Math.min(sp, L) / L; u.x += dx * k; u.y += dy * k; u.mv = true; u.fx = dx / L; u.fy = dy / L;
}
/* Pillage : chacun emporte sa part (le voleur prend de l'or s'il y en a) ; à la halle, le cœur du village, la part est plus grosse.
   Jamais plus de 30 % d'une ressource par raid. */
function raidTake(st, u) {
  const T = st.S[raidField(st, u.tk).ti], heart = !!T && T.kind === 'halle', lil = !!T && T.kind === 'chambre';
  if (heart && !st.heart) { st.heart = 1; st.ev.push({ k: 'heart', id: u.id }); }
  if (lil && !st.lil) { st.lil = 1; st.ev.push({ k: 'lilou', id: u.id }); }        // la chambre de Lilou fouillée : elle a très peur
  const want = Math.round(u.carry * st.lootMul * (heart || lil ? 1.5 : 1));
  const avail = k => Math.max(0, Math.min(st.stock[k] || 0, Math.floor((st.inp.R[k] || 0) * 0.3) - (st.taken[k] || 0)));
  let res = null;
  if (u.thief && avail('or') >= 5) res = 'or';
  else for (const k of RAID_LOOT) if (avail(k) > 0 && (!res || avail(k) > avail(res))) res = k;
  const n = res ? Math.min(want, avail(res)) : 0;
  if (n > 0) { st.stock[res] -= n; st.taken[res] = (st.taken[res] || 0) + n; u.loot = [res, n]; st.ev.push({ k: 'loot', id: u.id, r: res, n }); }
  u.goal = 'h';
}
function raidTrapCheck(st, u) {
  const ti = st.trapAt[raidCell(u.y) * GRID + raidCell(u.x)] - 1; if (ti < 0) return;
  const T = st.traps[ti]; if (T.uses <= 0) return;
  if (T.type === 'piege') {
    if (T.cd > 1e-9) return;
    T.uses--; T.cd = 2; T.shown = true;
    st.ev.push({ k: 'trap', i: ti, x: T.x + 0.5, y: T.y + 0.5, t: 'piege' });
    for (const o of st.foes) if (raidAlive(o) && raidCell(o.x) === T.x && raidCell(o.y) === T.y) raidHurtFoe(st, o, T.dmg * st.defMul);
  } else if (u.root <= 0) {
    T.uses--; T.shown = true; u.root = T.root * (u.type === 'troll' ? 0.5 : 1);
    st.ev.push({ k: 'trap', i: ti, x: T.x + 0.5, y: T.y + 0.5, t: 'filet', id: u.id });
  }
}
function raidFoeStep(st, u) {
  if (!raidAlive(u)) return;
  u.mv = false; u.atkT -= RAID_DT; if (u.root > 0) u.root -= RAID_DT;
  /* 1) un héros ou un garde à portée : on se bat (les voleurs, eux, ne se battent jamais) */
  if (u.fight) {
    let h = null, bd = 1e9;
    for (const o of st.heroes) { if (o.ko) continue; const d = raidDist(u, o); if (d <= u.r + o.r + u.reach && d < bd) { bd = d; h = o; } }
    for (const o of st.guards) { if (o.ko) continue; const d = raidDist(u, o); if (d <= u.r + o.r + u.reach && d < bd) { bd = d; h = o; } }
    if (h) { raidFace(u, h); if (u.atkT <= 1e-9) { u.atkT = u.rate; u.atkN++; if (h.kind === 'guard') raidHurtGuard(st, h, u.dmg, u); else raidHurtHero(st, h, u.dmg); } return; }
  }
  if (u.atkT < 0) u.atkT = 0;
  /* 2) en plein pillage */
  if (u.pl > 0) { u.pl -= RAID_DT; if (u.pl <= 0) raidTake(st, u); return; }
  if (u.root > 0) return;
  /* 3) en route : vers sa cible, puis vers son portail avec le butin */
  const f = raidField(st, u.goal === 'h' ? 'p' + u.pi : u.tk), cx = raidCell(u.x), cy = raidCell(u.y), ci = cy * GRID + cx;
  if (f.d[ci] <= 0) {
    if (u.goal === 'h') {
      /* il rentre dans le portail (au bord de la vallée, le terrain est libre) avant de disparaître */
      const P = st.inp.P[u.pi] || st.inp.P[0], px = P[0] + 0.5, py = P[1] + 0.5;
      if (raidLen(u.x - px, u.y - py) > 0.45) { raidMoveTo(u, px, py, u.speed * RAID_DT * (u.loot ? 0.85 : 1)); return; }
      u.out = true; st.esc++;
      if (u.loot) st.lost[u.loot[0]] = (st.lost[u.loot[0]] || 0) + u.loot[1];
      st.ev.push({ k: 'escape', id: u.id, x: u.x, y: u.y, r: u.loot ? u.loot[0] : '', n: u.loot ? u.loot[1] : 0 });
      return;
    }
    u.pl = u.thief ? 1.0 : 1.5;
    const T = st.S[f.ti]; if (T) raidFace(u, T);
    st.ev.push({ k: 'plunder', id: u.id });
    return;
  }
  let best = -1, bv = 1e18;
  for (const nb of RAID_NB) {
    const nx = cx + nb[0], ny = cy + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
    if (nb[0] && nb[1] && (st.occ[cy * GRID + nx] || st.occ[ny * GRID + cx])) continue;
    const ni = ny * GRID + nx, c = raidCost(st, ni, f.ti); if (c >= 1e7) continue;
    const val = f.d[ni] + c * nb[2];
    if (val < bv) { bv = val; best = ni; }
  }
  if (best < 0) return;
  const o = st.occ[best] - 1;
  if (o >= 0) {
    /* le chemin passe par un mur, une porte (ou, faute de mieux, un bâtiment) : on le casse */
    const S = st.S[o];
    if (raidDistRect(u.x, u.y, S) <= u.r + 0.4) { raidFace(u, S); if (u.atkT <= 1e-9) { u.atkT = u.rate; u.atkN++; raidHurtStruct(st, o, u.sdmg * (S.kind === 'wall' || S.kind === 'gate' || S.kind === 'tower' ? u.wall : 1)); } return; }
    const px = Math.max(S.x0, Math.min(u.x, S.x0 + S.s)), py = Math.max(S.y0, Math.min(u.y, S.y0 + S.s)), dx = px - u.x, dy = py - u.y, L = raidLen(dx, dy), want = L - (u.r + 0.3);
    if (want > 0 && L > 1e-6) { const k = Math.min(u.speed * RAID_DT, want) / L; u.x += dx * k; u.y += dy * k; u.mv = true; u.fx = dx / L; u.fy = dy / L; }
    return;
  }
  raidMoveTo(u, best % GRID + 0.5, ((best / GRID) | 0) + 0.5, u.speed * RAID_DT * (u.loot ? 0.85 : 1));
  raidTrapCheck(st, u);
}
function raidHeroStep(st, h) {
  if (h.ko) return;
  h.atkT -= RAID_DT; h.mv = false;
  /* d'abord ceux qui emportent du butin ou qui pillent, puis les voleurs, puis le plus proche */
  const score = u => raidDist(h, u) - (u.loot ? 3 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1 : 0);
  let tgt = null, bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidDist(h, u) > h.range + u.r) continue; const sc = score(u); if (sc < bd) { bd = sc; tgt = u; } }
  if (tgt) {
    raidFace(h, tgt);
    if (h.atkT <= 1e-9) {
      h.atkT = h.cd; h.atkN++;
      st.ev.push({ k: 'hhit', id: h.id, tgt: tgt.id, sh: h.range > 2 ? h.cls : '' });
      raidHurtFoe(st, tgt, h.dmg);
      if (h.cls === 'mage') for (const o of st.foes) if (o !== tgt && raidAlive(o) && raidDist(o, tgt) <= 1.2 + o.r) raidHurtFoe(st, o, h.dmg * 0.5);
      if (h.cls === 'pretre') {
        let w = null; for (const o of st.heroes) if (!o.ko && o.hp < o.hpMax * 0.8 && (!w || o.hp / o.hpMax < w.hp / w.hpMax)) w = o;
        if (w) { const n = Math.min(w.hpMax - w.hp, h.dmg * 1.2); w.hp += n; st.ev.push({ k: 'heal', id: w.id, v: Math.round(n) }); }
      }
    }
    return;
  }
  if (h.atkT < 0) h.atkT = 0;
  /* l'ennemi le plus proche dans la zone de défense, sinon retour à son poste */
  const H = st.S[st.hall]; let ch = null; bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidLen(u.x - H.x, u.y - H.y) > RAID_ZONE + (u.loot ? 2.5 : 0.5)) continue; const sc = score(u); if (sc < bd) { bd = sc; ch = u; } }   // un pillard qui s'enfuit, on le poursuit un peu plus loin
  const gx = ch ? ch.x : h.home[0], gy = ch ? ch.y : h.home[1];
  if (!ch && raidLen(h.x - gx, h.y - gy) < 0.15) return;
  const cx = raidCell(h.x), cy = raidCell(h.y), goal = raidCell(gy) * GRID + raidCell(gx);
  let tx = gx, ty = gy;
  if (cy * GRID + cx !== goal) {
    const d = raidHeroField(st, goal);
    let best = -1, bv = d[cy * GRID + cx];
    for (const nb of RAID_NB) {
      const nx = cx + nb[0], ny = cy + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = ny * GRID + nx; if (!raidHeroPass(st, ni)) continue;
      if (nb[0] && nb[1] && (!raidHeroPass(st, cy * GRID + nx) || !raidHeroPass(st, ny * GRID + cx))) continue;
      if (d[ni] < bv) { bv = d[ni]; best = ni; }
    }
    if (best < 0) return;
    tx = best % GRID + 0.5; ty = ((best / GRID) | 0) + 0.5;
  }
  const dx = tx - h.x, dy = ty - h.y, L = raidLen(dx, dy); if (L < 1e-6) return;
  const k = Math.min(h.speed * RAID_DT, L) / L, nx = h.x + dx * k, ny = h.y + dy * k;
  const far = raidLen(nx - H.x, ny - H.y);
  if (far > RAID_ZONE + 3 && far > raidLen(h.x - H.x, h.y - H.y)) return;     // on ne s'éloigne pas trop de la halle
  h.x = nx; h.y = ny; h.mv = true; h.fx = dx / L; h.fy = dy / L;
}
/* Un garde de la garnison : il frappe ce qui est à sa portée ; au corps à corps, il va au-devant de ce qui entre dans le cercle
   de son poste, sans jamais en sortir (ni traverser un mur) ; sinon, il reprend sa place dans la formation. */
function raidGuardStep(st, g) {
  if (g.ko) return;
  g.atkT -= RAID_DT; g.mv = false;
  if (g.regen > 0 && g.hp < g.hpMax) g.hp = Math.min(g.hpMax, g.hp + g.hpMax * g.regen / 100 * RAID_DT);
  const P0 = g.post, melee = g.range < 2, lanc = g.type === 'lanc';
  /* d'abord ceux qui emportent du butin ou qui pillent, puis les voleurs ; les lanciers visent les trolls */
  const score = u => raidDist(g, u) - (u.loot ? 3 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1.5 : 0) - (lanc && u.big ? 3 : 0);
  let tgt = null, bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidDist(g, u) > g.range + u.r) continue; const sc = score(u); if (sc < bd) { bd = sc; tgt = u; } }
  if (tgt) {
    raidFace(g, tgt);
    if (g.atkT <= 1e-9) {
      g.atkT = g.cd; g.atkN++;
      st.ev.push({ k: 'ghit', id: g.id, tgt: tgt.id, sh: melee ? '' : g.type });
      raidHurtFoe(st, tgt, g.dmg * (lanc && tgt.big ? SOLDIERS.lanc.troll : 1), g);
      if (g.type === 'mage') for (const o of st.foes) if (o !== tgt && raidAlive(o) && raidDist(o, tgt) <= SOLDIERS.mage.splash + o.r) raidHurtFoe(st, o, g.dmg * 0.6, g);
    }
    return;
  }
  if (g.atkT < 0) g.atkT = 0;
  let gx = g.home[0], gy = g.home[1];
  if (melee) {
    let ch = null; bd = 1e9;
    for (const u of st.foes) { if (!raidAlive(u) || raidLen(u.x - P0.x, u.y - P0.y) > P0.r + 0.3) continue; const sc = score(u); if (sc < bd) { bd = sc; ch = u; } }
    if (ch) { gx = ch.x; gy = ch.y; }
  }
  const dx = gx - g.x, dy = gy - g.y, L = raidLen(dx, dy); if (L < 0.12) return;
  const k = Math.min(g.speed * RAID_DT, L) / L;
  let nx = g.x + dx * k, ny = g.y + dy * k;
  const ox = nx - P0.x, oy = ny - P0.y, oL = raidLen(ox, oy);
  if (oL > P0.r) { nx = P0.x + ox / oL * P0.r; ny = P0.y + oy / oL * P0.r; }
  if (raidBlocked(st, raidCell(nx), raidCell(ny))) {
    if (!raidBlocked(st, raidCell(nx), raidCell(g.y))) ny = g.y; else if (!raidBlocked(st, raidCell(g.x), raidCell(ny))) nx = g.x; else return;
  }
  if (raidLen(nx - g.x, ny - g.y) < 1e-6) return;
  g.fx = dx / L; g.fy = dy / L; g.x = nx; g.y = ny; g.mv = true;
}
function raidTowerStep(st, tw, i) {
  const S = st.S[tw.si]; if (S.dead) return;
  tw.cd -= RAID_DT; if (tw.cd > 1e-9) return;
  /* les archers visent d'abord les pillards chargés de butin, puis les voleurs et les blessés ; un troll seulement s'il n'y a rien d'autre */
  let best = null, bs = 1e9;
  for (const u of st.foes) {
    if (!raidAlive(u)) continue;
    const d = raidLen(u.x - S.x, u.y - S.y); if (d > tw.range) continue;
    const sc = d - (u.loot ? 4 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1.5 : 0) + (u.big ? 2.5 : 0) - 2 * (1 - u.hp / u.hpMax);
    if (sc < bs) { bs = sc; best = u; }
  }
  if (!best) { tw.cd = 0.2; return; }
  tw.cd = tw.rate; tw.n++;
  st.ev.push({ k: 'tshot', i, si: tw.si, tgt: best.id, x: S.x, y: S.y });
  raidHurtFoe(st, best, tw.dmg * st.defMul);
}
/* Les assaillants s'écartent un peu les uns des autres (sans jamais entrer dans un mur). */
function raidNudge(st, u, dx, dy) { if (u.pl > 0) return; const x = u.x + dx, y = u.y + dy; if (x < 0.05 || y < 0.05 || x > GRID - 0.05 || y > GRID - 0.05 || st.occ[raidCell(y) * GRID + raidCell(x)]) return; u.x = x; u.y = y; }
function raidSeparate(st) {
  const L = st.foes.filter(raidAlive);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = a.r + b.r;
    if (d2 >= m * m) continue;
    const d = Math.sqrt(d2), nx = d < 1e-4 ? 1 : dx / d, ny = d < 1e-4 ? 0 : dy / d, push = (m - d) * 0.25;
    raidNudge(st, a, -nx * push, -ny * push); raidNudge(st, b, nx * push, ny * push);
  }
}
function raidStep(st) {
  if (st.over) return;
  for (const u of st.foes) { u.px = u.x; u.py = u.y; }
  for (const h of st.heroes) { h.px = h.x; h.py = h.y; }
  for (const g of st.guards) { g.px = g.x; g.py = g.y; }
  for (const u of st.foes) if (!u.on && !u.dead && !u.out && st.t + 1e-9 >= u.delay) raidSpawn(st, u);
  for (const T of st.traps) if (T.cd > 0) T.cd -= RAID_DT;
  st.towers.forEach((tw, i) => raidTowerStep(st, tw, i));
  for (const h of st.heroes) raidHeroStep(st, h);
  for (const g of st.guards) raidGuardStep(st, g);
  for (const u of st.foes) raidFoeStep(st, u);
  raidSeparate(st);
  st.t = Math.round((st.t + RAID_DT) * 10) / 10; st.n++;
  const waiting = st.foes.some(u => !u.on && !u.dead && !u.out), alive = st.foes.some(raidAlive);
  if (!waiting && !alive) st.over = true;
  else if (st.t >= RAID_LIMIT) {
    /* le temps est écoulé : ceux qui restent repartent par le portail (avec ce qu'ils portent) */
    for (const u of st.foes) if (raidAlive(u)) { u.out = true; st.esc++; if (u.loot) st.lost[u.loot[0]] = (st.lost[u.loot[0]] || 0) + u.loot[1]; st.ev.push({ k: 'escape', id: u.id, x: u.x, y: u.y, r: u.loot ? u.loot[0] : '', n: u.loot ? u.loot[1] : 0 }); }
    st.over = true;
  }
  if (st.over) st.ev.push({ k: 'end' });
}
function raidResult(st) {
  const dmg = [];
  for (const S of st.S) if ((S.kind === 'wall' || S.kind === 'gate' || S.kind === 'tower') && S.hp !== S.hp0) dmg.push([S.id, Math.max(0, Math.round(S.hp))]);
  const round = o => { const out = {}; for (const k of RAID_LOOT.concat(['or'])) { const n = Math.round(o[k] || 0); if (n > 0) out[k] = n; } return out; };
  const res = { k: st.kills, e: st.esc, f: st.foes.length, lost: round(st.lost), back: round(st.back), h: st.heart, g: Math.round(st.gold), xp: Math.round(st.xp), br: st.broke,
    ko: st.heroes.filter(h => h.ko).map(h => h.id), dmg, s: Math.round(st.t) };
  /* la garnison : ennemis abattus par chaque garde, et ceux qui sont tombés */
  if (st.guards.length) { res.gd = st.guards.map(g => [g.id, g.kills, g.ko ? 1 : 0]); res.gk = st.guards.reduce((a, g) => a + g.kills, 0); }
  if (st.inp.C) res.c = st.lil | 0;                    // la chambre de Lilou a-t-elle été fouillée ?
  return res;
}
/* Tout le raid d'un coup, à la minute où il part ; le village garde de quoi le rediffuser. */
function raidResolve(v, t) {
  const inp = raidInput(v, t), st = raidStart(inp);
  for (let guard = 0; !st.over && guard < 4000; guard++) { raidStep(st); st.ev.length = 0; }
  raidApply(v, t, inp, raidResult(st));
}
function raidApply(v, t, inp, res) {
  for (const [id, hp] of res.dmg) { const b = v.b.find(x => x.id === id); if (!b || !BLD[b.type].hps) continue; if (hp >= hpMaxOf(b)) delete b.hp; else b.hp = hp; }
  for (const k in res.lost) v.r[k] = Math.max(0, (v.r[k] || 0) - res.lost[k]);
  if (res.g) v.r.or = (v.r.or || 0) + res.g;
  const ups = [];
  if (res.xp) for (const h of Object.values(v.heroes || {}).filter(Boolean).sort((a, b) => (a.n || 0) - (b.n || 0))) { const lv0 = h.lvl; if (heroAddXp(h, h.race === 'humain' ? res.xp * 1.1 : res.xp)) { ups.push(h.name + ' (niveau ' + h.lvl + ')'); chronLvl(v, t, h, lv0); } }
  if (res.h) v.raidMor = t + DAY;
  /* la chambre de Lilou fouillée (dès le chapitre 3 de la couronne) : elle a très peur */
  if (res.c && v.lilou) { lilouAdd(v.lilou, -CROWN_FEAR); }
  /* la garnison : de l'expérience pour ceux qui ont tenu (et un raid de plus dans leur série), 8 heures de repos pour ceux qui sont tombés (série perdue) */
  const gm = 1 + 0.2 * ((inp.L | 0) - 1), hurt = [], titles = [];
  for (const [id, kills, ko] of res.gd || []) {
    const s = v.sol && v.sol[id]; if (!s) continue;
    s.kills = (s.kills | 0) + kills;
    if (ko) { const had = solTitle(s); s.hurt = t + SOL_HURT; s.vet = 0; hurt.push(solName(s) + (had ? ' (perd son titre : ' + had[1].toLowerCase() + ')' : '')); continue; }
    const was = solTitle(s);
    s.vet = (s.vet | 0) + 1; s.raids = (s.raids | 0) + 1;
    s.xp = Math.min(3 * solXpNeed(s.lvl), (s.xp | 0) + Math.round((15 + 5 * kills) * gm));
    const ti = solTitle(s); if (ti && ti !== was) titles.push(solName(s) + ' devient ' + ti[1].toLowerCase());
  }
  const orbs = garRaidOrbs(v, inp, res);
  const lostTxt = Object.keys(res.lost).map(k => res.lost[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', ');
  let m = (lostTxt ? 'Raid des gobelins : ' : 'Raid repoussé ! ') + res.k + ' ennemi' + (res.k > 1 ? 's' : '') + ' vaincu' + (res.k > 1 ? 's' : '') + ' sur ' + res.f;
  if (res.e) m += ', ' + res.e + ' enfui' + (res.e > 1 ? 's' : '') + (lostTxt ? ' avec ' + lostTxt : ' les mains vides');
  m += '.' + (res.g ? ' +' + res.g + ' or.' : '') + (res.br ? ' ' + res.br + ' défense' + (res.br > 1 ? 's détruites' : ' détruite') + ' : à réparer (menu Défense).' : '');
  addLog(v, t, m, 'raid');
  if (res.h) addLog(v, t, 'Les gobelins ont pillé la halle, le cœur du village : le moral baisse pour un jour.', 'raid');
  if (res.c && v.lilou) addLog(v, t, 'Les gobelins ont fouillé la chambre de Lilou : elle a eu très peur. Elle est maintenant ' + lilouMood(v.lilou).name + '.', 'lilou');
  /* la chronique : le tout premier raid, le premier repoussé */
  const lostAny = Object.keys(res.lost).length > 0;
  if (!(inp.n | 0)) chron(v, t, 'raid', lostAny ? 'Premier raid des gobelins : ils repartent avec une partie des réserves.' : 'Premier raid des gobelins, repoussé !');
  else if (!lostAny && !cntOf(v, 'rr')) chron(v, t, 'raid', 'Premier raid repoussé sans rien perdre !');
  if (!lostAny) { if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 }; v.cnt.rr = (v.cnt.rr | 0) + 1; }
  if (ups.length) addLog(v, t, 'En défendant le village : ' + ups.join(', ') + ' !', 'hero');
  if (res.gd) addLog(v, t, 'La garnison abat ' + res.gk + ' ennemi' + (res.gk > 1 ? 's' : '') + '.' + (hurt.length ? ' Blessé' + (hurt.length > 1 ? 's' : '') + ' (8 h de repos à la caserne) : ' + hurt.join(', ') + '.' : '') + (titles.length ? ' ' + titles.join(', ') + ' !' : ''), 'sol');
  if (orbs.length) addLog(v, t, 'Défense réussie : ' + orbs.map(orbLabel).join(', ') + ' pour la garnison.', 'sol');
  v.lastRaid = { t, n: inp.n, sd: inp.sd, L: inp.L, P: inp.P, B: inp.B, H: inp.H, F: inp.F, R: inp.R, res };
  if (inp.G) v.lastRaid.G = inp.G;
  if (inp.M) v.lastRaid.M = inp.M;
  if (inp.C) v.lastRaid.C = inp.C;
  if (orbs.length) v.lastRaid.orbs = orbs;
  const rnd = mulberry32((inp.sd ^ 0x63d83595) >>> 0);
  v.raid = { n: (inp.n | 0) + 1, next: t + RAID_GAP + Math.floor(rnd() * (RAID_GAP_RND / MIN)) * MIN, closed: (v.raid && v.raid.closed) | 0 };
}
/* Rediffusion : le même combat, rejoué à partir de ce que le village a gardé. */
const raidReplay = lr => raidStart({ t: lr.t, n: lr.n, sd: lr.sd, L: lr.L, P: lr.P, B: lr.B, H: lr.H, F: lr.F, R: lr.R, G: lr.G, M: lr.M, C: lr.C });
