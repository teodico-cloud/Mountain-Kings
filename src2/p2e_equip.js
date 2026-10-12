/* ===================== ÉQUIPEMENT DES HÉROS (pur, sans DOM) =====================
   Un objet ne garde que sa « recette » : emplacement (sl), sorte (k), rareté (r, 0 à 4), niveau (il), graine (sd),
   et s'il y a lieu son ensemble (set), son pouvoir légendaire (pw), son amélioration (up, +1 à +5) et ses pierres serties (gm).
   Ses bonus et son nom sont recalculés à partir de la graine : même objet = mêmes bonus sur les deux téléphones.
   Les valeurs sont en pour cent (12 = +12 %). */

const SLOTS = ['arme', 'casque', 'armure', 'bottes', 'bijou'];
const SLOT_LABEL = { arme: 'Arme', casque: 'Casque', armure: 'Armure', bottes: 'Bottes', bijou: 'Bijou' };
const BIJOU_LVL = 8;                       // le bijou se porte à partir du niveau 8
const IL_MAX = 60;
const RARITY = [
  { name: 'Commun', col: '#a3abb4', af: 0, mul: 1, so: 0, sell: 4, melt: 6 },
  { name: 'Peu commun', col: '#5cc27a', af: 1, mul: 1.1, so: 0, sell: 10, melt: 12 },
  { name: 'Rare', col: '#5b9cf0', af: 2, mul: 1.22, so: 1, sell: 25, melt: 25 },
  { name: 'Épique', col: '#b07ce8', af: 3, mul: 1.36, so: 1, sell: 60, melt: 50 },
  { name: 'Légendaire', col: '#f59a3c', af: 3, mul: 1.5, so: 2, sell: 150, melt: 100 },
];
const SET_COL = '#36c2a8';

/* Armes : trois familles (lames, arcs, bâtons) ; chaque classe manie une famille. */
const WEAPONS = {
  epee: { f: 'lame', name: 'Épée' }, hache: { f: 'lame', name: 'Hache' }, masse: { f: 'lame', name: 'Masse' }, dagues: { f: 'lame', name: 'Dagues' },
  arc: { f: 'arc', name: 'Arc' }, arbalete: { f: 'arc', name: 'Arbalète' },
  baton: { f: 'baton', name: 'Bâton' }, sceptre: { f: 'baton', name: 'Sceptre' }, grimoire: { f: 'baton', name: 'Grimoire' },
};
const FAMILY_LABEL = { lame: 'lames (épées, haches, masses, dagues)', arc: 'arcs et arbalètes', baton: 'bâtons, sceptres et grimoires' };
const CLASS_FAMILY = { guerrier: 'lame', paladin: 'lame', voleur: 'lame', rodeur: 'arc', mage: 'baton', pretre: 'baton', druide: 'baton', necro: 'baton' };
const CLASS_WEAPONS = { guerrier: ['epee', 'hache'], paladin: ['masse', 'epee'], voleur: ['dagues'], rodeur: ['arc', 'arbalete'], mage: ['baton', 'grimoire'], pretre: ['sceptre', 'baton'], druide: ['baton'], necro: ['grimoire', 'baton'] };
const ARMOR_KINDS = {
  casque: [['casque', 'Casque'], ['heaume', 'Heaume'], ['capuche', 'Capuche'], ['couronne', 'Couronne']],
  armure: [['armure', 'Armure'], ['cotte', 'Cotte de mailles'], ['tunique', 'Tunique'], ['robe', 'Robe de mage']],
  bottes: [['bottes', 'Bottes'], ['jambieres', 'Jambières'], ['sandales', 'Sandales']],
  bijou: [['amulette', 'Amulette'], ['anneau', 'Anneau'], ['talisman', 'Talisman']],
};
const SLOT_WEIGHT = { arme: 26, casque: 18, armure: 20, bottes: 18, bijou: 18 };

/* Bonus possibles. Valeur de base selon le niveau L de l'objet. */
const STATS = {
  dmg: { t: v => '+' + v + ' % de dégâts', w: 1 },
  hp: { t: v => '+' + v + ' % de vie', w: 0.8 },
  armor: { t: v => '+' + v + ' % d’armure', w: 1.5 },
  crit: { t: v => '+' + v + ' % de coups critiques', w: 1.5 },
  haste: { t: v => 'attaque ' + v + ' % plus vite', w: 0.7 },
  cdr: { t: v => 'compétences ' + v + ' % plus vite prêtes', w: 0.8 },
  dodge: { t: v => '+' + v + ' % d’esquive', w: 1.2 },
  speed: { t: v => '+' + v + ' % de vitesse', w: 0.3 },
  leech: { t: v => 'vole ' + v + ' % des dégâts infligés', w: 2 },
  regen: { t: v => 'récupère ' + v + ' % de vie par seconde', w: 8 },
  potion: { t: v => 'potions +' + v + ' %', w: 0.2 },
  skill: { t: v => 'compétences +' + v + ' % plus fortes', w: 0.6 },
  gold: { t: v => '+' + v + ' % d’or trouvé', w: 0.1 },
};
const MAIN = {
  arme: { dmg: L => 2 + 0.8 * L },
  casque: { hp: L => 1.5 + 0.5 * L },
  armure: { hp: L => 2.5 + 0.6 * L, armor: L => 1 + 0.2 * L },
  bottes: { hp: L => 1 + 0.3 * L, speed: () => 4 },
  bijou: { skill: L => 2 + 0.6 * L },
};
const AFFIX = { dmg: L => 1 + 0.4 * L, hp: L => 1.5 + 0.5 * L, crit: L => 1 + 0.15 * L, haste: L => 2 + 0.3 * L, cdr: L => 2 + 0.3 * L, dodge: L => 1 + 0.12 * L,
  armor: L => 1 + 0.2 * L, leech: L => 0.5 + 0.1 * L, regen: L => 0.1 + 0.03 * L, speed: L => 2 + 0.2 * L, potion: L => 5 + L, skill: L => 2 + 0.5 * L, gold: L => 5 + L };
const AFFIX_POOL = {
  arme: ['crit', 'haste', 'leech', 'skill', 'cdr'],
  casque: ['armor', 'cdr', 'crit', 'regen', 'skill', 'dmg'],
  armure: ['regen', 'dodge', 'potion', 'dmg', 'crit'],
  bottes: ['dodge', 'armor', 'regen', 'dmg', 'crit'],
  bijou: ['dmg', 'crit', 'cdr', 'leech', 'gold', 'potion', 'hp'],
};
/* Plafonds de ce que l'équipement peut donner au total. */
const GEAR_CAP = { crit: 30, cdr: 40, dodge: 25, armor: 30, leech: 10, regen: 2, speed: 40, haste: 50 };
/* Noms : objets rares d'après leur bonus le plus fort, épiques d'après un titre, légendaires d'après leur pouvoir. */
const NAME_TIER = ['du soldat', 'du vétéran', 'du champion', 'du héros'];
const NAME_BEAST = { dmg: 'du loup', hp: 'de l’ours', crit: 'du faucon', haste: 'du lynx', cdr: 'du hibou', dodge: 'du renard', armor: 'de la tortue', leech: 'de la sangsue',
  regen: 'du troll', speed: 'du cerf', potion: 'de l’alchimiste', skill: 'du sage', gold: 'du marchand' };
const NAME_EPIC = ['des Cimes', 'de la Tempête', 'du Roi des Montagnes', 'de la Forge ancienne', 'de l’Aube', 'du Crépuscule', 'des Anciens Rois', 'du Dragon de pierre', 'du Gardien', 'des Profondeurs'];

/* Pouvoirs légendaires (un par objet légendaire, selon l'emplacement). */
const POWERS = {
  chaine: { sl: 'arme', title: 'Croc-de-Foudre', txt: 'Vos attaques touchent aussi un 2e monstre proche (moitié des dégâts).' },
  brasier: { sl: 'arme', title: 'Brasier', txt: 'Vos attaques enflamment la cible : un quart des dégâts en plus, en 3 secondes.' },
  echo: { sl: 'casque', title: 'Écho des Anciens', txt: '1 chance sur 5 qu’une compétence soit aussitôt prête à nouveau.' },
  epines: { sl: 'armure', title: 'Peau-de-Ronces', txt: 'Renvoie 30 % des coups reçus au corps à corps.' },
  sursis: { sl: 'armure', title: 'Dernier Rempart', txt: 'Une fois par donjon, un coup fatal vous laisse à 1 point de vie, intouchable 2 secondes.' },
  vent: { sl: 'bottes', title: 'Pas-du-Vent', txt: '+15 % de vitesse et +8 % d’esquive.' },
  soif: { sl: 'bijou', title: 'Cœur assoiffé', txt: 'Chaque monstre vaincu vous rend 3 % de vie.' },
  tresor: { sl: 'bijou', title: 'Œil du Dragon', txt: '+50 % d’or, et de meilleures chances de trouver des objets rares.' },
};
const POWER_KEYS = Object.keys(POWERS);
/* Ensembles : une tenue par donjon (arme, casque, armure, bottes), bonus à 2 et 4 pièces. */
const SETS = {
  troll: { name: 'Tenue du chef troll', sfx: 'du Chef troll', b2: { hp: 10 }, b2t: '+10 % de vie', b4t: 'Vos coups ont 1 chance sur 10 d’étourdir (1 seconde).' },
  roi: { name: 'Atours du roi squelette', sfx: 'du Roi squelette', b2: { skill: 12 }, b2t: 'Compétences +12 % plus fortes', b4t: 'Chaque monstre vaincu rapproche vos compétences d’une seconde.' },
  abime: { name: 'Panoplie de l’abîme', sfx: 'de l’Abîme', b2: { dmg: 8, hp: 8 }, b2t: '+8 % de dégâts et de vie', b4t: 'Une potion de plus, et les potions soignent 30 % de plus.' },
};
const SET_SLOTS = ['arme', 'casque', 'armure', 'bottes'];
const SET_OF_THEME = { mine: 'troll', crypte: 'roi' };
/* Pierres précieuses : 3 tailles (éclat, pierre, parfaite) ; trois pareilles se fusionnent en une plus belle. */
const GEMS = {
  rubis: { name: 'Rubis', fem: false, stat: 'hp', v: [2, 4, 7], col: '#e0464e' },
  saphir: { name: 'Saphir', fem: false, stat: 'cdr', v: [2, 4, 6], col: '#4a7fe0' },
  emeraude: { name: 'Émeraude', fem: true, stat: 'crit', v: [1.5, 3, 5], col: '#3fb56b' },
  topaze: { name: 'Topaze', fem: true, stat: 'dmg', v: [2, 4, 7], col: '#e8b23a' },
};
const GEM_KEYS = Object.keys(GEMS);
const GEM_FUSE_COST = [0, 15, 50];         // or pour passer de la taille 1 à 2, de 2 à 3
const gemOf = key => { const m = /^([a-z]+)([123])$/.exec(String(key || '')); if (!m || !GEMS[m[1]]) return null; const G = GEMS[m[1]], n = +m[2]; return { key: m[1] + n, type: m[1], n, stat: G.stat, v: G.v[n - 1], col: G.col, name: gemName(m[1], n) }; };
function gemName(type, n) {
  const G = GEMS[type], low = G.name.toLowerCase();
  return n === 1 ? 'Éclat ' + (/^[aeiouéèêh]/i.test(low) ? 'd’' : 'de ') + low : n === 2 ? G.name : G.name + (G.fem ? ' parfaite' : ' parfait');
}
/* Familiers (niveau 6) : chacun son petit bonus. */
const PETS = {
  loup: { name: 'Loup', txt: 'Il mord fort : +30 % de dégâts pour le familier.' },
  faucon: { name: 'Faucon', txt: '+5 % de coups critiques pour son maître.' },
  sanglier: { name: 'Sanglier', txt: '+8 % de vie pour son maître.' },
  chouette: { name: 'Chouette', txt: 'Compétences 5 % plus vite prêtes.' },
};
const PET_KEYS = Object.keys(PETS);
const PET_LVL = 6;

/* ---------- tirage d'un objet ---------- */
/* Chances de chaque rareté selon la source (en %), avant le bonus du niveau et de la chance. */
const DROP = {
  mob: [62, 28, 8, 1.8, 0.2], chest: [50, 32, 14, 3.5, 0.5], boss: [0, 45, 38, 14, 3],
  forge1: [50, 35, 15, 0, 0], forge2: [20, 40, 30, 10, 0], forge3: [0, 35, 40, 21, 4], merch: [0, 40, 40, 18, 2],
};
const pickOf = (R, a) => a[Math.floor(R() * a.length) % a.length];
function rollRarity(R, table, L, luck) {
  const w = table.slice(), boost = (1 + 0.04 * Math.max(0, (L | 0) - 1)) * (luck || 1);
  for (let i = 2; i < 5; i++) w[i] *= boost;
  w[1] *= Math.sqrt(boost);
  const tot = w.reduce((a, b) => a + b, 0); let x = R() * tot;
  for (let i = 0; i < 5; i++) { x -= w[i]; if (x < 0 && w[i] > 0) return i; }
  return w.findIndex(x2 => x2 > 0);
}
/* o : { il, src (clé de DROP), cls (classe de celui qui le trouve : l'arme sera pour lui), sl, r, set, luck } */
function genItem(R, o) {
  let sl = o.sl;
  if (!sl) {
    const list = o.set ? SET_SLOTS : SLOTS, tot = list.reduce((a, s) => a + SLOT_WEIGHT[s], 0);
    let x = R() * tot; sl = list[list.length - 1];
    for (const s of list) { x -= SLOT_WEIGHT[s]; if (x < 0) { sl = s; break; } }
  }
  const r = o.set ? 3 : o.r != null ? Math.max(0, Math.min(4, o.r | 0)) : rollRarity(R, DROP[o.src] || DROP.chest, o.il, o.luck);
  const k = sl === 'arme' ? pickOf(R, CLASS_WEAPONS[o.cls] || Object.keys(WEAPONS)) : pickOf(R, ARMOR_KINDS[sl].filter((a, i) => i < 3 || r >= 2))[0];
  const it = { sl, k, r, il: Math.max(1, Math.min(IL_MAX, Math.round(o.il) || 1)), sd: (Math.floor(R() * 4294967295) >>> 0) || 1 };
  if (o.set && SET_SLOTS.includes(sl)) it.set = o.set;
  if (it.r === 4) it.pw = pickOf(R, POWER_KEYS.filter(p => POWERS[p].sl === sl));
  return it;
}
/* Objet reçu d'un téléphone (retour de donjon) : on ne garde que ce qui est possible. */
function cleanItem(x, maxIl) {
  if (!x || typeof x !== 'object' || !SLOTS.includes(x.sl)) return null;
  const sl = x.sl, kinds = sl === 'arme' ? Object.keys(WEAPONS) : ARMOR_KINDS[sl].map(a => a[0]);
  const it = { sl, k: kinds.includes(x.k) ? x.k : kinds[0], r: Math.max(0, Math.min(4, x.r | 0)), il: Math.max(1, Math.min(maxIl || IL_MAX, IL_MAX, x.il | 0)), sd: (x.sd >>> 0) || 1 };
  if (x.set && SETS[x.set] && SET_SLOTS.includes(sl)) { it.set = x.set; it.r = 3; }
  if (it.r === 4) it.pw = POWERS[x.pw] && POWERS[x.pw].sl === sl ? x.pw : POWER_KEYS.find(p => POWERS[p].sl === sl);
  return it;
}

/* ---------- ce que vaut un objet (recalculé, mis en cache) ---------- */
const itemCache = new Map();
const r1 = x => Math.round(x * 10) / 10;
const itemKey = it => [it.sl, it.k, it.r, it.il, it.sd, it.set || '', it.pw || '', it.up | 0, gemList(it).join(',')].join('|');
function gemList(it) { const n = socketsOf(it), out = []; for (let i = 0; i < n; i++) { const g = it.gm && it.gm['g' + i]; out.push(gemOf(g) ? g : null); } return out; }
const socketsOf = it => it.set ? 1 : RARITY[Math.max(0, Math.min(4, it.r | 0))].so;
const itemReq = it => Math.min(HERO_MAX_LVL, Math.max(1, (it.il | 0) - 2));
const maxUpOf = forgeLvl => forgeLvl >= 3 ? 5 : forgeLvl >= 2 ? 4 : forgeLvl >= 1 ? 3 : 0;
function itemInfo(it) {
  const key = itemKey(it), hit = itemCache.get(key); if (hit) return hit;
  const R = mulberry32((it.sd ^ 0x5bd1e995) >>> 0), L = it.il, rr = RARITY[it.r] || RARITY[0], up = 1 + 0.1 * Math.max(0, Math.min(5, it.up | 0));
  const main = {}, af = {};
  for (const k in MAIN[it.sl]) main[k] = r1(MAIN[it.sl][k](L) * (k === 'speed' ? 1 : rr.mul * (0.95 + 0.1 * R())) * up);
  const pool = AFFIX_POOL[it.sl].filter(k => !(k in main)), n = it.set ? 2 : rr.af;
  for (let i = 0; i < n && pool.length; i++) { const k = pool.splice(Math.floor(R() * pool.length), 1)[0]; af[k] = r1(AFFIX[k](L) * (0.8 + 0.4 * R()) * (1 + 0.08 * it.r)); }
  const gems = gemList(it);
  /* Nom */
  const base = it.sl === 'arme' ? (WEAPONS[it.k] || WEAPONS.epee).name : ((ARMOR_KINDS[it.sl].find(a => a[0] === it.k) || ARMOR_KINDS[it.sl][0])[1]);
  let name;
  if (it.set && SETS[it.set]) name = base + ' ' + SETS[it.set].sfx;
  else if (it.r === 4 && POWERS[it.pw]) name = base + ' « ' + POWERS[it.pw].title + ' »';
  else if (it.r === 3) name = base + ' ' + NAME_EPIC[it.sd % NAME_EPIC.length];
  else if (it.r === 2) { const best = Object.keys(af).sort((a, b) => af[b] * STATS[b].w - af[a] * STATS[a].w)[0]; name = base + ' ' + (NAME_BEAST[best] || 'du loup'); }
  else name = base + ' ' + NAME_TIER[L >= 20 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0];
  if (it.up > 0) name += ' +' + it.up;
  /* Valeur (pour comparer), prix de vente, fer rendu à la fonte */
  let score = 0;
  for (const k in main) score += main[k] * STATS[k].w;
  for (const k in af) score += af[k] * STATS[k].w;
  for (const g of gems) if (g) { const G = gemOf(g); score += G.v * STATS[G.stat].w; }
  if (it.pw) score += 8; if (it.set) score += 4;
  const lv = 1 + 0.12 * (L - 1), upv = 1 + 0.3 * (it.up | 0);
  const info = { name, base, main, af, gems, so: gems.length, req: itemReq(it), score: r1(score), sell: Math.max(1, Math.round(rr.sell * lv * upv)),
    melt: Math.max(1, Math.round(rr.melt * (1 + 0.1 * (L - 1)) * (1 + 0.5 * (it.up | 0)))), col: it.set ? SET_COL : rr.col, fam: it.sl === 'arme' ? (WEAPONS[it.k] || WEAPONS.epee).f : null };
  if (itemCache.size > 600) itemCache.clear();
  itemCache.set(key, info);
  return info;
}
/* Ce héros peut-il porter cet objet ? */
function canWear(hh, it) {
  if (!hh || !it) return { ok: false, why: 'Objet introuvable.' };
  if (it.sl === 'bijou' && hh.lvl < BIJOU_LVL) return { ok: false, why: 'Un bijou se porte à partir du niveau ' + BIJOU_LVL + '.' };
  if (it.sl === 'arme' && (WEAPONS[it.k] || WEAPONS.epee).f !== CLASS_FAMILY[hh.cls]) return { ok: false, why: className(hh.cls, hh.sex) + ' : seulement les ' + FAMILY_LABEL[CLASS_FAMILY[hh.cls]] + '.' };
  const req = itemReq(it); if (hh.lvl < req) return { ok: false, why: 'Il faut être niveau ' + req + '.' };
  return { ok: true };
}
/* Tout ce que l'équipement porté donne au héros (en %), ensembles et pouvoirs compris. */
function gearOf(hh) {
  const s = { dmg: 0, hp: 0, armor: 0, crit: 0, haste: 0, cdr: 0, dodge: 0, speed: 0, leech: 0, regen: 0, potion: 0, skill: 0, gold: 0, pw: {}, set4: {}, sets: {}, potX: 0 };
  for (const sl of SLOTS) {
    const it = hh && hh.eq && hh.eq[sl]; if (!it || it.sl !== sl || !canWear(hh, it).ok) continue;
    const I = itemInfo(it);
    for (const k in I.main) s[k] += I.main[k];
    for (const k in I.af) s[k] += I.af[k];
    for (const g of I.gems) if (g) { const G = gemOf(g); s[G.stat] += G.v; }
    if (it.pw) s.pw[it.pw] = 1;
    if (it.set) s.sets[it.set] = (s.sets[it.set] || 0) + 1;
  }
  for (const k in s.sets) { const S = SETS[k]; if (!S) continue; if (s.sets[k] >= 2) for (const st in S.b2) s[st] += S.b2[st]; if (s.sets[k] >= 4) s.set4[k] = 1; }
  if (s.pw.vent) { s.speed += 15; s.dodge += 8; }
  if (s.pw.tresor) s.gold += 50;
  if (s.set4.abime) { s.potion += 30; s.potX = 1; }
  for (const k in GEAR_CAP) s[k] = Math.min(s[k], GEAR_CAP[k]);
  for (const k in STATS) s[k] = r1(s[k]);
  return s;
}
/* Comparaison avec l'objet porté au même emplacement : 1 mieux, -1 moins bien, 0 pareil (null si on ne peut pas le porter). */
function compareItem(hh, it) {
  if (!hh || !canWear(hh, it).ok) return null;
  const cur = hh.eq && hh.eq[it.sl], a = itemInfo(it).score, b = cur ? itemInfo(cur).score : 0;
  return a > b * 1.03 + 0.05 ? 1 : a < b * 0.97 - 0.05 ? -1 : 0;
}

/* ---------- le sac (un par joueur) et la forge ---------- */
const BAG_BASE = 30;
const forgeLvlOf = v => { const f = v.b.find(b => b.type === 'forge' && b.lvl > 0); return f ? f.lvl : 0; };
const bagMax = v => BAG_BASE + 10 * forgeLvlOf(v);
function bagOf(v, uid) {
  if (!v.bag) v.bag = {};
  if (!v.bag[uid]) v.bag[uid] = { it: {}, gm: {}, n: 1 };
  const b = v.bag[uid]; if (!b.it) b.it = {}; if (!b.gm) b.gm = {}; if (!b.n) b.n = 1;
  return b;
}
const bagCount = b => Object.keys(b.it).length;
function bagAdd(v, uid, it) { const b = bagOf(v, uid); const id = 'i' + (b.n++); it.id = id; b.it[id] = it; return id; }
/* Les pierres serties d'un objet vendu ou fondu reviennent dans le sac. */
function gemsBack(bag, it) { for (const g of Object.values(it.gm || {})) if (gemOf(g)) bag.gm[g] = (bag.gm[g] || 0) + 1; }
const craftCost = L => ({ fer: 30 + 6 * L, bois: 20 + 4 * L, or: 20 + 5 * L });
const improveCost = (it) => { const k = (it.up | 0) + 1, L = it.il; return { fer: (15 + 3 * L) * k, or: (10 + 2 * L) * k }; };
/* Où est l'objet visé par une action ? a.hid + a.sl : porté par ce héros (à moi) ; sinon a.id dans mon sac. */
function itemAt(v, uid, a) {
  if (a.hid) { const hh = v.heroes[a.hid]; if (!hh || hh.own !== uid || !hh.eq || !hh.eq[a.sl]) return null; return { it: hh.eq[a.sl], hh }; }
  const b = bagOf(v, uid), it = b.it[a.id]; return it ? { it, bag: b } : null;
}

/* ---------- le marchand ambulant : un jour sur deux, il s'installe sur la place ---------- */
const merchDay = (v, t) => Math.floor(Math.max(0, t - v.born) / DAY);
const merchHere = (v, t) => { const d = merchDay(v, t); return d % 2 === 1 && !!v.merch && v.merch.d === d; };
const merchLeaves = (v, t) => v.born + (merchDay(v, t) + 1) * DAY;
const merchPrice = it => Math.round(itemInfo(it).sell * 4);
const gemPrice = key => { const G = gemOf(key); return G ? [0, 40, 130, 400][G.n] : 0; };
function genMerch(v, d) {
  const R = mulberry32(hash((v.seed ^ Math.imul(d + 1, 7919)) >>> 0)), lv = Object.values(v.heroes || {}).reduce((m, h) => Math.max(m, h && h.lvl || 1), 1);
  const classes = [...new Set(Object.values(v.heroes || {}).map(h => h && h.cls).filter(Boolean))];
  const it = [];
  for (let i = 0; i < 4; i++) it.push(genItem(R, { il: lv + Math.floor(R() * 2), src: 'merch', cls: classes.length ? pickOf(R, classes) : null }));
  const gm = [pickOf(R, GEM_KEYS) + 1, pickOf(R, GEM_KEYS) + (R() < 0.35 ? 2 : 1)];
  return { d, it, gm, sold: '' };
}
