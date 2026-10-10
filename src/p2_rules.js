/* ===================== RÈGLES (pur, sans DOM) ===================== */
const VERSION = 2;
const GRID = 24, EDGE = 2;
const RES = ['bois', 'pierre', 'vivres'];
const RES_LABEL = { bois: 'Bois', pierre: 'Pierre', vivres: 'Vivres' };
const COLORS = ['#D27A22', '#2F8A63', '#4A78C2', '#B24F78', '#8A67C6'];
const BOT_COLOR = '#7A2E2E';

const BLD = {
  mairie: { name: 'Halle du clan', size: 3, max: 5, cost: { bois: 250, pierre: 200 }, mul: 2.4, time: 4, tmul: 3, hp: 2700, desc: 'Le cœur du village nain. L’améliorer débloque des bâtiments, des niveaux et des ouvriers.' },
  scierie: { name: 'Scierie', size: 2, max: 5, cost: { bois: 60, pierre: 30 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'bois', base: 120, desc: 'Produit du bois, même quand vous n’êtes pas là.' },
  carriere: { name: 'Mine', size: 2, max: 5, cost: { bois: 90 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'pierre', base: 90, desc: 'Les mineurs creusent la montagne et en tirent de la pierre.' },
  ferme: { name: 'Moulin', size: 2, max: 5, cost: { bois: 70, pierre: 30 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'vivres', base: 120, desc: 'Moud le grain qui nourrit les troupes.' },
  entrepot: { name: 'Entrepôt', size: 2, max: 5, cost: { bois: 150, pierre: 100 }, mul: 2.2, time: 2, tmul: 2.6, hp: 1080, desc: '+1 000 de stockage par niveau, pour chaque ressource.' },
  caserne: { name: 'Caserne', size: 2, max: 3, cost: { bois: 150, pierre: 80 }, mul: 3, time: 2, tmul: 3, hp: 810, desc: 'Entraîne les guerriers nains. Niveau 2 : arbalétriers. Niveau 3 : béliers.' },
  camp: { name: 'Taverne', size: 3, max: 5, cost: { bois: 180, pierre: 60 }, mul: 2.2, time: 2, tmul: 2.6, hp: 810, desc: 'Les guerriers y logent entre deux raids : 20 places, puis 10 de plus par niveau.' },
  tour: { name: 'Tour d’arbalétriers', size: 2, max: 5, cost: { bois: 200, pierre: 120 }, mul: 2.1, time: 2, tmul: 2.6, hp: 900, def: { range: 6.5, dmg: 28, rate: 1, speed: 14, kind: 'arrow' }, desc: 'Défense rapide qui tire sur tout ce qui approche.' },
  baliste: { name: 'Tour de garde', size: 2, max: 5, cost: { bois: 350, pierre: 350 }, mul: 2.1, time: 6, tmul: 2.6, hp: 1080, def: { range: 5.2, dmg: 110, rate: 2.2, speed: 18, kind: 'bolt' }, desc: 'Grosse arbalète de rempart : gros dégâts, une cible à la fois.' },
  mangonneau: { name: 'Catapulte', size: 2, max: 5, cost: { bois: 700, pierre: 800 }, mul: 2.1, time: 15, tmul: 2.6, hp: 1170, def: { range: 8, min: 2.5, dmg: 60, rate: 3.6, speed: 7, splash: 1.4, kind: 'stone' }, desc: 'Lance des pierres sur les groupes, mais ne peut pas viser au pied des murs.' },
};
const SHOP = ['scierie', 'carriere', 'ferme', 'entrepot', 'caserne', 'camp', 'tour', 'baliste', 'mangonneau'];
const LIMITS = {
  mairie: [1, 1, 1, 1, 1],
  scierie: [1, 2, 2, 3, 3], carriere: [1, 1, 2, 2, 3], ferme: [1, 2, 2, 3, 3], entrepot: [1, 1, 2, 2, 3],
  caserne: [1, 1, 1, 2, 2], camp: [1, 1, 2, 2, 3],
  tour: [1, 2, 2, 3, 4], baliste: [0, 1, 1, 2, 2], mangonneau: [0, 0, 1, 1, 2],
};
const TROOPS = {
  fantassin: { name: 'Guerrier', plural: 'Guerriers', foe: 'Orque', space: 1, cost: 25, time: 12, hp: 80, dmg: 11, hit: 1, range: 0.6, speed: 1.6, pref: 'any', cas: 1, desc: 'Nain à la hache, solide et pas cher. Frappe le bâtiment le plus proche.' },
  archer: { name: 'Arbalétrier', plural: 'Arbalétriers', foe: 'Archer orque', space: 1, cost: 50, time: 18, hp: 36, dmg: 9, hit: 1, range: 3.4, speed: 1.9, pref: 'any', cas: 2, desc: 'Tire de loin à l’arbalète, mais tombe vite.' },
  belier: { name: 'Bélier', plural: 'Béliers', foe: 'Troll', space: 5, cost: 300, time: 80, hp: 700, dmg: 50, hit: 2, range: 0.6, speed: 0.8, pref: 'def', cas: 3, desc: 'Poussé par quatre nains, très résistant. Fonce sur les défenses.' },
};
const TROOP_KEYS = ['fantassin', 'archer', 'belier'];
const LEAGUES = [
  { name: 'Paysans', min: 0, reward: 150, loss: 0 },
  { name: 'Écuyers', min: 60, reward: 350, loss: 5 },
  { name: 'Chevaliers', min: 150, reward: 700, loss: 5 },
  { name: 'Barons', min: 300, reward: 1200, loss: 15 },
  { name: 'Comtes', min: 500, reward: 2000, loss: 25 },
  { name: 'Ducs', min: 750, reward: 3000, loss: 35 },
  { name: 'Rois', min: 1050, reward: 4500, loss: 50 },
];
const EPOCH0 = Date.UTC(2026, 9, 10, 18, 0, 0); // un samedi, 20 h à Paris
const PERIOD = 48 * 3600000;
const epochAt = t => Math.floor((t - EPOCH0) / PERIOD);
const nextEpochTime = t => EPOCH0 + (epochAt(t) + 1) * PERIOD;
const leagueOf = m => { let i = 0; for (let k = 0; k < LEAGUES.length; k++) if ((m || 0) >= LEAGUES[k].min) i = k; return i; };
const chestOf = L => ({ bois: LEAGUES[L].reward, pierre: LEAGUES[L].reward, vivres: Math.round(LEAGUES[L].reward * 0.8) });
const CROWN_MEDALS = [0, 10, 20, 35];
const MARK_BONUS = [0, 0.1, 0.25, 0.5];
const sabresOf = pct => pct >= 0.999 ? 3 : pct >= 0.75 ? 2 : pct >= 0.5 ? 1 : 0;
const crownsOf = B => B.stars;
const LAIRS = ['Camp des Crocs-Noirs', 'Repaire de Gromash', 'Fosse aux Trolls', 'Bivouac des Mâche-Os', 'Tanière du chef Urgluk', 'Palissade des Sans-Oreilles', 'Fort des Crânes Rouges', 'Marais des Trolls Gris', 'Campement des Brise-Haches', 'Antre de Morg le Borgne', 'Butte des Ronge-Pierres', 'Camp de la Dent Cassée'];
const FORTS = ['Citadelle de Grakkhar', 'Forteresse du Roi Troll', 'Bastion des Mille Crocs', 'Donjon d’Ombre-Fer', 'Fort de la Horde Rouge'];

/* ---------- outils ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- bâtiments ---------- */
const hpOf = (type, lvl) => Math.round(BLD[type].hp * (1 + 0.35 * (lvl - 1)));
function defOf(type, lvl) { const d = BLD[type].def; if (!d) return null; return Object.assign({}, d, { dmg: d.dmg * (1 + 0.3 * (lvl - 1)) }); }
function costOf(type, toLvl) { const d = BLD[type], c = {}; for (const k in d.cost) c[k] = Math.round(d.cost[k] * Math.pow(d.mul, toLvl - 1) / 5) * 5; return c; }
function timeOf(type, toLvl) { return Math.round(BLD[type].time * Math.pow(BLD[type].tmul, toLvl - 1) * 60000); }
const maxLvlOf = (type, th) => type === 'mairie' ? 5 : Math.min(BLD[type].max, th + 1);
const limitOf = (type, th) => LIMITS[type][Math.max(1, Math.min(5, th)) - 1];
const prodRate = (type, lvl) => BLD[type].base * (1 + 0.7 * (lvl - 1));
const campCap = lvl => 20 + 10 * (lvl - 1);

/* ---------- village ---------- */
const thOf = v => { const m = v.b.find(b => b.type === 'mairie'); return m ? Math.max(1, m.lvl) : 1; };
const capOf = v => 500 + 500 * thOf(v) + v.b.reduce((a, b) => a + (b.type === 'entrepot' ? b.lvl * 1000 : 0), 0);
const housingOf = v => v.b.reduce((a, b) => a + (b.type === 'camp' && b.lvl > 0 ? campCap(b.lvl) : 0), 0);
const armySpace = v => TROOP_KEYS.reduce((a, k) => a + (v.army[k] || 0) * TROOPS[k].space, 0);
const armyCount = v => TROOP_KEYS.reduce((a, k) => a + (v.army[k] || 0), 0);
const queueSpace = v => v.train.reduce((a, q) => a + q.n * TROOPS[q.u].space, 0);
const casernes = v => v.b.filter(b => b.type === 'caserne' && b.lvl > 0).length;
const casLvl = v => v.b.reduce((a, b) => b.type === 'caserne' ? Math.max(a, b.lvl) : a, 0);
const buildersOf = v => 1 + (thOf(v) >= 2 ? 1 : 0) + (thOf(v) >= 4 ? 1 : 0);
const busyBuilders = v => v.b.filter(b => b.up).length;
const countOf = (v, type) => v.b.filter(b => b.type === type).length;
function prodOf(v, t) {
  const out = { bois: 0, pierre: 0, vivres: 0 }, m = v.buff > t ? 1.25 : 1;
  for (const b of v.b) { const d = BLD[b.type]; if (d.prod && b.lvl > 0) out[d.prod] += prodRate(b.type, b.lvl) * m; }
  return out;
}
function fits(v, type, gx, gz, ignoreId) {
  const s = BLD[type].size;
  if (!Number.isInteger(gx) || !Number.isInteger(gz)) return false;
  if (gx < EDGE || gz < EDGE || gx + s > GRID - EDGE || gz + s > GRID - EDGE) return false;
  for (const b of v.b) {
    if (b.id === ignoreId) continue;
    const t = BLD[b.type].size;
    if (gx < b.gx + t && gx + s > b.gx && gz < b.gz + t && gz + s > b.gz) return false;
  }
  return true;
}
function freeSpot(v, type, nearX, nearZ) {
  const s = BLD[type].size;
  const cx = nearX != null ? nearX : Math.floor((GRID - s) / 2), cz = nearZ != null ? nearZ : Math.floor((GRID - s) / 2);
  for (let r = 0; r < GRID; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (fits(v, type, cx + dx, cz + dz)) return [cx + dx, cz + dz];
      }
  return null;
}
function addLog(v, t, m) { v.log.push({ t: Math.round(t), m }); if (v.log.length > 30) v.log.splice(0, v.log.length - 30); }
function fmtRes(c) { return RES.filter(k => c[k]).map(k => c[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', '); }
function missingTxt(v, c) {
  const miss = RES.filter(k => (c[k] || 0) > v.r[k]);
  if (!miss.length) return '';
  return 'Il manque ' + miss.map(k => Math.ceil(c[k] - v.r[k]) + ' de ' + RES_LABEL[k].toLowerCase()).join(' et ') + '.';
}
function pay(v, c) { for (const k in c) v.r[k] = Math.max(0, v.r[k] - c[k]); }

function newVillage(key, name, c, t) {
  const v = {
    v: VERSION, key, name, c, t, born: t, seed: (hash(Math.floor(t / 1000) % 2147483647) ^ hashStr(key)) >>> 0,
    r: { bois: 500, pierre: 300, vivres: 300 }, b: [], nid: 1,
    army: { fantassin: 15, archer: 0, belier: 0 }, train: [], trainP: 0,
    medals: 0, ep: epochAt(t), played: 0, chest: null, lastDuo: 0, nextRaid: t + 12 * 3600000, shield: 0, raids: 0, lastActive: t, buff: 0,
    log: [], reports: [], claimed: [],
  };
  const add = (type, gx, gz) => v.b.push({ id: v.nid++, type, lvl: 1, gx, gz, up: null });
  add('mairie', 10, 10); add('tour', 14, 10); add('scierie', 6, 8); add('ferme', 6, 12); add('caserne', 10, 14); add('camp', 14, 14);
  addLog(v, t, 'Fondation de ' + name + '.');
  return v;
}

function stepVillage(v, dt) {
  const t = v.t, h = dt / 3600000, cap = capOf(v), p = prodOf(v, t);
  for (const k of RES) v.r[k] = Math.max(0, Math.min(Math.max(cap, v.r[k]), v.r[k] + p[k] * h));
  for (const b of v.b) {
    if (b.up && b.up.t1 <= t + dt) {
      const at = b.up.t1; b.lvl += 1; b.up = null;
      addLog(v, at, 'Travaux terminés : ' + BLD[b.type].name.toLowerCase() + (b.lvl > 1 ? ' niveau ' + b.lvl : '') + '.');
    }
  }
  const nc = casernes(v);
  if (v.train.length && nc) {
    v.trainP += dt / 1000 * nc;
    while (v.train.length) {
      const q = v.train[0], T = TROOPS[q.u];
      if (v.trainP < T.time) break;
      if (armySpace(v) + T.space > housingOf(v)) { v.trainP = T.time; break; }
      v.trainP -= T.time; v.army[q.u] = (v.army[q.u] || 0) + 1; q.n--;
      if (q.n <= 0) v.train.shift();
    }
    if (!v.train.length) v.trainP = 0;
  }
  const e = epochAt(t + dt);
  while (v.ep < e) {
    v.ep++;
    const at = EPOCH0 + v.ep * PERIOD, L = leagueOf(v.medals);
    if (v.played > 0) {
      const c = chestOf(L), old = v.chest || { bois: 0, pierre: 0, vivres: 0 };
      v.chest = { bois: old.bois + c.bois, pierre: old.pierre + c.pierre, vivres: old.vivres + c.vivres };
      addLog(v, at, 'Récompense de la ligue des ' + LEAGUES[L].name + ' arrivée : elle t’attend dans le menu À deux.');
    } else if (L > 0) {
      v.medals = LEAGUES[L - 1].min;
      addLog(v, at, 'Aucun raid à deux en 2 jours : pas de récompense, retour en ligue des ' + LEAGUES[L - 1].name + '.');
    } else addLog(v, at, 'Aucun raid à deux en 2 jours : pas de récompense de ligue.');
    v.played = 0;
  }
  if (t + dt >= v.nextRaid) {
    if (t + dt - (v.lastActive || 0) < 10 * 60000) v.nextRaid = t + dt + 15 * 60000;
    else runRaid(v, Math.max(v.nextRaid, t));
  }
}
function simulateVillage(v, now) {
  if (now - v.t > 14 * 86400000) v.t = now - 14 * 86400000;
  while (v.t < now) { const dt = Math.min(60000, now - v.t); stepVillage(v, dt); v.t += dt; }
  return v;
}
const RAID_BUDGET = [10, 22, 70, 120, 190];
const raidBudget = th => RAID_BUDGET[Math.max(1, Math.min(5, th)) - 1];
function layoutOf(v) { return v.b.filter(b => b.lvl > 0).map(b => [b.type, b.lvl, b.gx, b.gz]); }
function runRaid(v, t) {
  const layout = layoutOf(v);
  const seed = hash((v.seed ^ Math.imul(v.raids + 1, 2654435761)) >>> 0);
  const budget = raidBudget(thOf(v));
  const res = simulateRaid(layout, seed, budget);
  const lost = {};
  for (const k of RES) { lost[k] = Math.floor(v.r[k] * 0.25 * res.pct); v.r[k] -= lost[k]; }
  v.raids++;
  const shieldH = res.pct >= 0.75 ? 10 : res.pct >= 0.5 ? 7 : 4;
  v.shield = Math.round(t + shieldH * 3600000);
  const R = mulberry32(seed ^ 0x9e37);
  v.nextRaid = Math.round(v.shield + (1 + R() * 4) * 3600000);
  v.reports.push({ t: Math.round(t), seed, budget, layout, pct: Math.round(res.pct * 100), lost });
  if (v.reports.length > 5) v.reports.shift();
  const pct = Math.round(res.pct * 100);
  addLog(v, t, res.pct >= 0.5
    ? 'Des orques ont pillé le village : ' + pct + ' % détruit.'
    : 'Attaque d’orques repoussée (' + pct + ' % de dégâts).');
}

/* Actions sur son propre village. Retourne {ok, err, ...}. */
function applyV(v, a, t) {
  const fail = err => ({ ok: false, err });
  const th = thOf(v);
  let out = { ok: true };
  switch (a.type) {
    case 'build': {
      const d = BLD[a.b]; if (!d || a.b === 'mairie') return fail('Bâtiment inconnu.');
      if (countOf(v, a.b) >= limitOf(a.b, th)) return fail(limitOf(a.b, th) === 0 ? 'Débloqué avec une maison commune plus grande.' : 'Nombre maximum atteint. Améliorez la maison commune pour en construire plus.');
      if (busyBuilders(v) >= buildersOf(v)) return fail('Tous les ouvriers sont occupés.');
      if (!fits(v, a.b, a.gx, a.gz)) return fail('Emplacement occupé ou trop près du bord.');
      const c = costOf(a.b, 1), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      v.b.push({ id: v.nid++, type: a.b, lvl: 0, gx: a.gx, gz: a.gz, up: { t0: t, t1: t + timeOf(a.b, 1) } });
      addLog(v, t, 'Chantier lancé : ' + d.name.toLowerCase() + '.');
      break;
    }
    case 'upgrade': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (b.up) return fail('Ce bâtiment est déjà en travaux.');
      const to = b.lvl + 1;
      if (to > maxLvlOf(b.type, th)) return fail(to > BLD[b.type].max || b.type === 'mairie' ? 'Niveau maximum atteint.' : 'Améliorez d’abord la maison commune.');
      if (busyBuilders(v) >= buildersOf(v)) return fail('Tous les ouvriers sont occupés.');
      const c = costOf(b.type, to), m = missingTxt(v, c); if (m) return fail(m);
      if (RES.some(k => (c[k] || 0) > capOf(v))) return fail('Vos entrepôts sont trop petits pour réunir ce coût.');
      pay(v, c); b.up = { t0: t, t1: t + timeOf(b.type, to) };
      addLog(v, t, 'Amélioration lancée : ' + BLD[b.type].name.toLowerCase() + ' niveau ' + to + '.');
      break;
    }
    case 'move': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (!fits(v, b.type, a.gx, a.gz, b.id)) return fail('Emplacement occupé ou trop près du bord.');
      b.gx = a.gx; b.gz = a.gz;
      break;
    }
    case 'train': {
      const T = TROOPS[a.u]; if (!T) return fail('Troupe inconnue.');
      if (casLvl(v) < T.cas) return fail('Il faut une caserne de niveau ' + T.cas + '.');
      const n = Math.max(1, Math.min(50, a.n | 0));
      if (armySpace(v) + queueSpace(v) + n * T.space > housingOf(v)) return fail('Plus de place dans les tavernes. Construisez-en ou améliorez-les.');
      const c = { vivres: n * T.cost }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const last = v.train[v.train.length - 1];
      if (last && last.u === a.u) last.n += n; else v.train.push({ u: a.u, n });
      break;
    }
    case 'untrain': {
      const q = v.train[a.i]; if (!q) return fail('Rien à annuler.');
      q.n--; v.r.vivres = Math.min(Math.max(capOf(v), v.r.vivres), v.r.vivres + TROOPS[q.u].cost);
      if (q.n <= 0) { v.train.splice(a.i, 1); if (a.i === 0) v.trainP = 0; }
      break;
    }
    case 'reroll': {
      const c = { vivres: a.cost | 0 }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      break;
    }
    case 'battle': {
      for (const k of TROOP_KEYS) v.army[k] = Math.max(0, (v.army[k] || 0) - ((a.used && a.used[k]) | 0));
      const cap = capOf(v), got = {};
      for (const k of RES) { const g = Math.max(0, (a.loot && a.loot[k]) | 0); got[k] = Math.max(0, Math.min(g, cap - v.r[k])); v.r[k] += got[k]; }
      let dM = 0;
      if (a.kind === 'duo') {
        const L = leagueOf(v.medals), n = Math.max(0, Math.min(3, a.mark | 0));
        dM = n > 0 ? CROWN_MEDALS[n] : -LEAGUES[L].loss;
        v.medals = Math.max(0, v.medals + dM); v.played = (v.played || 0) + 1; v.lastDuo = Math.round(t);
        if (n >= 3) v.buff = Math.round(t + 12 * 3600000);
        addLog(v, t, 'Raid à deux sur ' + a.name + ' : ' + n + ' couronne' + (n > 1 ? 's' : '') + ', ' + a.pct + ' %, ' + (dM >= 0 ? '+' : '−') + Math.abs(dM) + ' médailles' + (fmtRes(got) ? ', butin ' + fmtRes(got) : '') + '.');
      } else if (a.deployed) {
        const n = Math.max(0, Math.min(3, a.mark | 0));
        addLog(v, t, 'Raid solo sur ' + a.name + ' : ' + n + ' sabre' + (n > 1 ? 's' : '') + ', ' + a.pct + ' %' + (fmtRes(got) ? ', butin ' + fmtRes(got) : '') + '.');
      }
      out.got = got; out.dM = dM;
      break;
    }
    case 'giftOut': {
      const c = {}; for (const k of RES) c[k] = Math.max(0, (a.r && a.r[k]) | 0);
      if (!RES.some(k => c[k] > 0)) return fail('Choisis ce que tu veux envoyer.');
      const m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      addLog(v, t, 'Envoyé à ' + a.toName + ' : ' + fmtRes(c) + '.');
      break;
    }
    case 'claim': {
      if (v.claimed.includes(a.gid)) return fail('Cadeau déjà reçu.');
      const cap = capOf(v);
      for (const k of RES) v.r[k] = Math.min(Math.max(cap, v.r[k]), v.r[k] + Math.max(0, (a.r && a.r[k]) | 0));
      v.claimed.push(a.gid); if (v.claimed.length > 30) v.claimed.shift();
      addLog(v, t, 'Cadeau de ' + a.fromName + ' : ' + fmtRes(a.r || {}) + '.');
      break;
    }
    case 'chest': {
      if (!v.chest) return fail('Aucune récompense à récupérer.');
      const cap = capOf(v), got = {};
      for (const k of RES) got[k] = Math.max(0, Math.min(v.chest[k] | 0, Math.floor(cap - v.r[k])));
      if (!RES.some(k => got[k] > 0)) return fail('Stockage plein : améliorez ou construisez un entrepôt.');
      for (const k of RES) { v.r[k] += got[k]; v.chest[k] -= got[k]; }
      if (RES.every(k => v.chest[k] <= 0)) v.chest = null;
      out.got = got; out.left = !!v.chest;
      addLog(v, t, 'Récompense de ligue récupérée : ' + fmtRes(got) + (v.chest ? ' (le reste attend de la place)' : '') + '.');
      break;
    }
    case 'ping': break;
    default: return fail('Action inconnue.');
  }
  v.lastActive = Math.round(t);
  return out;
}

/* ===================== BATAILLE ===================== */
const DT = 0.1;
function makeBattle(layout, limit) {
  const B = { t: 0, tk: 0, units: [], blds: [], proj: [], shots: [], uid: 1, over: false, limit: limit || 180, destroyed: 0, stars: 0, pct: 0, noMore: false, thDown: false, events: [] };
  layout.forEach(([type, lvl, gx, gz], i) => {
    const s = BLD[type].size, d = defOf(type, lvl), hp = hpOf(type, lvl);
    B.blds.push({ i, type, lvl, gx, gz, s, x: gx + s / 2, z: gz + s / 2, h: s / 2, hp, max: hp, def: d, cd: d ? 0.5 : 0, dead: false, tx: 0, tz: 0, fired: -9 });
  });
  B.total = B.blds.length || 1;
  return B;
}
function distRect(x, z, b) { const dx = Math.max(Math.abs(x - b.x) - b.h, 0), dz = Math.max(Math.abs(z - b.z) - b.h, 0); return Math.sqrt(dx * dx + dz * dz); }
function canDeploy(B, x, z) {
  if (x < 0.2 || z < 0.2 || x > GRID - 0.2 || z > GRID - 0.2) return false;
  for (const b of B.blds) if (distRect(x, z, b) < 1) return false;
  return true;
}
function deploy(B, type, x, z, owner, force) {
  if (B.over || !TROOPS[type]) return null;
  if (!force && !canDeploy(B, x, z)) return null;
  const T = TROOPS[type];
  const u = { id: B.uid++, type, x, z, px: x, pz: z, hp: T.hp, max: T.hp, owner: owner || 0, tgt: -1, cd: 0.4, dead: false, mv: 0, atk: -9 };
  B.units.push(u);
  return u;
}
function pickTarget(B, u) {
  const pref = TROOPS[u.type].pref;
  const onlyDef = pref === 'def' && B.blds.some(b => !b.dead && b.def);
  let best = -1, bd = 1e9;
  for (const b of B.blds) {
    if (b.dead || (onlyDef && !b.def)) continue;
    const d = distRect(u.x, u.z, b);
    if (d < bd) { bd = d; best = b.i; }
  }
  return best;
}
function hurt(u, dmg) { u.hp -= dmg; if (u.hp <= 0) { u.hp = 0; u.dead = true; } }
function destroyBld(B, b) {
  b.dead = true; b.hp = 0; B.destroyed++;
  if (b.type === 'mairie') B.thDown = true;
  B.pct = B.destroyed / B.total;
  B.stars = (B.pct >= 0.5 ? 1 : 0) + (B.thDown ? 1 : 0) + (B.destroyed >= B.total ? 1 : 0);
  B.events.push({ k: 'down', i: b.i });
}
function stepBattle(B) {
  if (B.over) return;
  for (const u of B.units) { u.px = u.x; u.pz = u.z; }
  for (const u of B.units) {
    if (u.dead) continue;
    const T = TROOPS[u.type];
    let b = u.tgt >= 0 ? B.blds[u.tgt] : null;
    if (!b || b.dead) { u.tgt = pickTarget(B, u); b = u.tgt >= 0 ? B.blds[u.tgt] : null; }
    if (!b) { u.mv = 0; continue; }
    const d = distRect(u.x, u.z, b);
    if (d > T.range) {
      const px = Math.max(b.x - b.h, Math.min(u.x, b.x + b.h)), pz = Math.max(b.z - b.h, Math.min(u.z, b.z + b.h));
      const dx = px - u.x, dz = pz - u.z, L = Math.sqrt(dx * dx + dz * dz) || 1;
      const len = Math.min(T.speed * DT, d - T.range * 0.85);
      u.x += dx / L * len; u.z += dz / L * len; u.mv = 1;
    } else {
      u.mv = 0; u.cd -= DT;
      if (u.cd <= 0) {
        u.cd += T.hit; u.atk = B.t; b.hp -= T.dmg;
        if (u.type === 'archer') B.shots.push({ k: 'arrowU', fx: u.x, fz: u.z, tx: b.x, tz: b.z, t: B.t });
        if (b.hp <= 0) destroyBld(B, b);
      }
    }
  }
  for (const b of B.blds) {
    if (b.dead || !b.def) continue;
    b.cd -= DT; if (b.cd > 0) continue;
    const D = b.def; let best = null, bd = 1e9;
    for (const u of B.units) {
      if (u.dead) continue;
      const dx = u.x - b.x, dz = u.z - b.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d <= D.range && d >= (D.min || 0) && d < bd) { bd = d; best = u; }
    }
    if (!best) { b.cd = 0.1; continue; }
    b.cd = D.rate; b.tx = best.x; b.tz = best.z; b.fired = B.t;
    const p = { k: D.kind, b: b.i, x0: b.x, z0: b.z, tx: best.x, tz: best.z, uid: best.id, age: 0, dur: Math.max(0.15, bd / D.speed), dmg: D.dmg, splash: D.splash || 0 };
    B.proj.push(p); B.shots.push(Object.assign({ t: B.t }, p));
  }
  for (const p of B.proj) {
    p.age += DT;
    if (p.age + 1e-9 >= p.dur) {
      p.done = true;
      if (p.splash) {
        for (const u of B.units) if (!u.dead) { const dx = u.x - p.tx, dz = u.z - p.tz; if (dx * dx + dz * dz <= p.splash * p.splash) hurt(u, p.dmg); }
        B.events.push({ k: 'boom', x: p.tx, z: p.tz });
      } else {
        const u = B.units.find(q => q.id === p.uid);
        if (u && !u.dead) hurt(u, p.dmg);
      }
    }
  }
  B.proj = B.proj.filter(p => !p.done);
  B.t = Math.round((B.t + DT) * 10) / 10; B.tk++;
  const alive = B.units.some(u => !u.dead);
  if (B.destroyed >= B.total || B.t >= B.limit || (B.noMore && !alive)) B.over = true;
}
function botPlan(seed, budget) {
  const R = mulberry32(seed), plan = [];
  const bel = budget >= 20 ? Math.floor(budget / 20) : 0;
  const rest = budget - bel * 5;
  const arch = Math.floor(rest * (0.25 + R() * 0.2)), fan = rest - arch;
  const sides = R() < 0.6 ? [Math.floor(R() * 4)] : [Math.floor(R() * 4), Math.floor(R() * 4)];
  const centers = sides.map(() => 5 + R() * (GRID - 10));
  const at = (k, spread) => {
    const side = sides[k % sides.length], c = centers[k % sides.length];
    const a = Math.max(0.5, Math.min(GRID - 0.5, c + (R() - 0.5) * spread)), off = 0.5 + R() * 0.5;
    return side === 0 ? [a, off] : side === 1 ? [GRID - off, a] : side === 2 ? [a, GRID - off] : [off, a];
  };
  for (let i = 0; i < bel; i++) { const [x, z] = at(i, 3); plan.push({ t: 1 + i * 0.6, u: 'belier', x, z }); }
  for (let i = 0; i < fan; i++) { const [x, z] = at(i, 5); plan.push({ t: 2.5 + Math.floor(i / 3) * 0.5 + R() * 0.3, u: 'fantassin', x, z }); }
  for (let i = 0; i < arch; i++) { const [x, z] = at(i, 5); plan.push({ t: 5 + i * 0.35, u: 'archer', x, z }); }
  plan.sort((a, b) => a.t - b.t);
  return plan.map(p => ({ t: Math.round(p.t * 10) / 10, u: p.u, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }));
}
function simulateRaid(layout, seed, budget) {
  const plan = botPlan(seed, budget), B = makeBattle(layout);
  let i = 0;
  while (!B.over) {
    while (i < plan.length && plan[i].t <= B.t + 1e-9) { deploy(B, plan[i].u, plan[i].x, plan[i].z, 1, true); i++; }
    if (i >= plan.length) B.noMore = true;
    stepBattle(B);
  }
  return { stars: B.stars, pct: B.pct };
}

/* ---------- villages de brigands ---------- */
function genBot(seed, th, fortress, league) {
  const lg = fortress ? Math.max(0, Math.min(LEAGUES.length - 1, league | 0)) : 0;
  const R = mulberry32(seed), v = { b: [], nid: 1 };
  th = Math.max(1, Math.min(5, th));
  const lvl = type => Math.max(1, Math.min(Math.min(5, maxLvlOf(type, th) + (lg >= 3 ? 1 : 0)), th - (R() < 0.5 ? 1 : 0) + (R() < 0.25 || fortress ? 1 : 0) + (lg >= 3 ? 1 : 0)));
  const place = (type, l, rMin, rMax) => {
    const s = BLD[type].size;
    for (let k = 0; k < 120; k++) {
      const dx = (R() * 2 - 1) * rMax, dz = (R() * 2 - 1) * rMax;
      if (Math.max(Math.abs(dx), Math.abs(dz)) < rMin) continue;
      const gx = Math.round(GRID / 2 + dx - s / 2), gz = Math.round(GRID / 2 + dz - s / 2);
      if (fits(v, type, gx, gz)) { v.b.push({ id: v.nid++, type, lvl: l, gx, gz }); return true; }
    }
    return false;
  };
  place('mairie', Math.min(5, th + (fortress ? 1 : 0)), 0, 1.5);
  const nT = limitOf('tour', th) + 1 + (fortress ? 1 + Math.floor(lg / 2) : 0), nB = limitOf('baliste', th) + (fortress && th >= 2 ? 1 : 0), nM = limitOf('mangonneau', th) + (fortress && th >= 3 ? 1 : 0);
  for (let i = 0; i < nT; i++) place('tour', lvl('tour'), 2.5, 5.5);
  for (let i = 0; i < nB; i++) place('baliste', lvl('baliste'), 1.5, 4.5);
  for (let i = 0; i < nM; i++) place('mangonneau', lvl('mangonneau'), 0.5, 3.5);
  for (const type of ['scierie', 'carriere', 'ferme', 'entrepot', 'caserne', 'camp']) {
    const n = Math.max(1, limitOf(type, th) - (R() < 0.4 ? 1 : 0)) + (fortress ? 1 : 0);
    for (let i = 0; i < n; i++) place(type, lvl(type), 4, 8.5);
  }
  const names = fortress ? FORTS : LAIRS;
  const name = names[Math.floor(R() * names.length)];
  const loot = {};
  for (const k of RES) loot[k] = Math.round((300 + 260 * th) * (0.75 + R() * 0.5) * (fortress ? 1.8 * (1 + 0.15 * lg) : 1) * (k === 'vivres' ? 0.8 : 1) / 5) * 5;
  return { name, th, fortress: !!fortress, league: lg, layout: v.b.map(b => [b.type, b.lvl, b.gx, b.gz]), loot };
}
function lootFor(bot, pct, mark) { const g = {}; for (const k of RES) g[k] = Math.floor(bot.loot[k] * (pct + MARK_BONUS[Math.max(0, Math.min(3, mark | 0))])); return g; }
