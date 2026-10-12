/* ===================== LA GARNISON (pur, sans DOM) =====================
   Une caserne (3 → 12 soldats selon son niveau) et des postes de garde (1 → 4) : chaque poste garde un cercle,
   ses soldats ne le quittent jamais et se placent tout seuls (fantassins et lanciers devant, archers et mages derrière).
   Données (communes aux deux joueurs) :
     v.sol  = { s12: soldat }  soldat = { id, n, num, type, race, sex, lvl, xp, post, w, a, o: { o0, o1, o2 }, hurt, vet, raids, kills }
     v.orbs = { vie2: 3 }      orbes en réserve (sorte + rareté 0 à 4)
     v.bans = { b5: { id, k, r } }  bannières en réserve ; celle d'un poste est sur le poste (b.ban = { k, r })
   Pas de nom propre : « Archère n°2 » (numéro par type). Un soldat abattu pendant un raid est blessé 8 heures (il ne perd rien,
   sauf sa série de raids : son titre de vétéran). */

const SOL_MAX_LVL = 15;
const SOLDIERS = {
  fant: { name: 'Fantassin', fem: 'Fantassine', plural: 'Fantassins', hp: 200, dmg: 10, armor: 0.28, range: 1.0, cd: 1.0, speed: 2.2, front: 1, desc: 'Épée et bouclier : solide, il tient la ligne.' },
  arch: { name: 'Archer', fem: 'Archère', plural: 'Archers', hp: 120, dmg: 9, armor: 0.06, range: 5.5, cd: 1.1, speed: 2.3, front: 0, desc: 'Il tire de loin, sur ce qui approche de son poste.' },
  lanc: { name: 'Lancier', fem: 'Lancière', plural: 'Lanciers', hp: 170, dmg: 11, armor: 0.18, range: 1.6, cd: 1.15, speed: 2.1, front: 1, troll: 1.8, desc: 'Longue allonge : il frappe un peu plus loin, et très fort les trolls.' },
  mage: { name: 'Mage de guerre', fem: 'Mage de guerre', plural: 'Mages de guerre', hp: 100, dmg: 10, armor: 0.04, range: 4.5, cd: 1.4, speed: 2.2, front: 0, splash: 1.3, desc: 'Une boule de feu qui touche aussi autour de sa cible.' },
};
const SOL_TYPES = ['fant', 'arch', 'lanc', 'mage'];
const POST_SLOTS = 6;                                   // gardes au plus par poste
const SOL_HURT = 8 * HOUR;                              // repos d'un soldat abattu
const solTypeName = (type, sex) => { const S = SOLDIERS[type] || SOLDIERS.fant; return sex === 'f' ? S.fem : S.name; };
const solName = s => solTypeName(s.type, s.sex) + ' n°' + Math.max(1, s.num | 0);
const caserneOf = v => v.b.find(b => b.type === 'caserne' && b.lvl > 0) || null;
const caserneLvl = v => { const c = caserneOf(v); return c ? Math.min(4, c.lvl) : 0; };
const solCap = v => 3 * caserneLvl(v);
const postCap = v => caserneLvl(v);
const postsOf = v => v.b.filter(b => b.type === 'poste' && b.lvl > 0).sort((a, b) => a.id - b.id);
const postR = b => BLD.poste.zone[Math.max(1, Math.min(3, b.lvl | 0)) - 1];
const postNum = (v, b) => postsOf(v).findIndex(x => x.id === b.id) + 1;
const solList = v => Object.values(v.sol || {}).filter(s => s && SOLDIERS[s.type]).sort((a, b) => (a.n || 0) - (b.n || 0));
const guardsOf = (v, pid) => solList(v).filter(s => s.post === pid);
const solHurt = (s, t) => (s.hurt || 0) > t;
const solXpNeed = L => 30 * Math.max(1, L);
const recruitCost = v => ({ or: 40 + 10 * solList(v).length });
const promoteCost = L => { const c = { or: 20 * L, viande: 10 * L }; if (L >= 5) c.fer = 4 * L; return c; };
const solEat = s => 10 + Math.max(1, s.lvl | 0);       // rations par jour (un villageois en mange 24)
const solCanPromote = s => s.lvl < SOL_MAX_LVL && (s.xp | 0) >= solXpNeed(s.lvl);
/* Titres : une série de raids sans tomber ; perdue s'il tombe. */
const SOL_TITLES = [[20, 'Héros de la garde', 15], [10, 'Briscard', 10], [5, 'Vétéran', 5]];
const solTitle = s => SOL_TITLES.find(x => (s.vet | 0) >= x[0]) || null;

/* ---------- équipement : une arme (son nom suit le type du soldat) et une armure complète (un ensemble, avec son bonus) ----------
   Forgés au niveau du soldat (il), améliorables de +1 à +5 selon la forge (up). L'armure porte son ensemble (set). */
const SOL_WEAPON = { fant: 'Épée', arch: 'Arc', lanc: 'Lance', mage: 'Bâton de feu' };
const SOL_SETS = {
  fer: { name: 'Armure de la Garde de fer', st: 'armor', v: 10, t: '+10 % d’armure', fit: 'fant' },
  vent: { name: 'Tenue des Vents', st: 'haste', v: 15, t: 'attaque 15 % plus vite', fit: 'arch' },
  roc: { name: 'Harnois du Roc', st: 'thorns', v: 12, t: 'renvoie 12 % des coups reçus', fit: 'lanc' },
  braise: { name: 'Robe de braise', st: 'dmg', v: 12, t: '+12 % de dégâts', fit: 'mage' },
};
const SOL_SET_KEYS = Object.keys(SOL_SETS);
const solWeaponDmg = it => r1((10 + 2 * it.il) * (1 + 0.1 * (it.up | 0)));
const solArmorHp = it => r1((12 + 2.5 * it.il) * (1 + 0.1 * (it.up | 0)));
const solForgeCost = (k, L) => k === 'w' ? { fer: 20 + 4 * L, bois: 10 + 2 * L, or: 10 + 3 * L } : { fer: 25 + 5 * L, or: 15 + 3 * L };
const solImproveCost = it => { const k = (it.up | 0) + 1; return { fer: (10 + 2 * it.il) * k, or: (8 + 2 * it.il) * k }; };
const solMelt = it => Math.max(1, Math.round((10 + 2 * it.il) * (1 + 0.5 * (it.up | 0)) * 0.5));
const solItemName = (s, k) => { const it = s[k]; if (!it) return ''; return (k === 'w' ? SOL_WEAPON[s.type] + ' de soldat' : (SOL_SETS[it.set] || SOL_SETS.fer).name) + ' (niv. ' + it.il + ')' + (it.up ? ' +' + it.up : ''); };

/* ---------- orbes de défense : 3 emplacements par soldat (niveaux 4, 8 et 12) ---------- */
const ORB_LVLS = [4, 8, 12];
const ORBS = {
  vie: { name: 'Orbe de vie', st: 'hp', v: [8, 12, 17, 23, 30], t: x => '+' + x + ' % de vie', col: '#e0464e' },
  armure: { name: 'Orbe d’armure', st: 'armor', v: [4, 6, 9, 12, 16], t: x => '+' + x + ' % d’armure', col: '#8aa0b4' },
  regen: { name: 'Orbe de régénération', st: 'regen', v: [0.4, 0.6, 0.9, 1.3, 1.8], t: x => 'récupère ' + String(x).replace('.', ',') + ' % de vie par seconde', col: '#5cc27a' },
  epines: { name: 'Orbe d’épines', st: 'thorns', v: [8, 12, 18, 25, 35], t: x => 'renvoie ' + x + ' % des coups reçus', col: '#b07ce8' },
  esquive: { name: 'Orbe d’esquive', st: 'dodge', v: [4, 6, 9, 12, 16], t: x => '+' + x + ' % d’esquive', col: '#e8b23a' },
};
const ORB_KEYS = Object.keys(ORBS);
const ORB_DROP = [55, 30, 12, 2.6, 0.4];
const ORB_FUSE = [15, 40, 100, 250];                    // or pour fusionner trois orbes en une de la rareté suivante
const orbOf = key => { const m = /^([a-z]+)([0-4])$/.exec(String(key || '')); if (!m || !ORBS[m[1]]) return null; const O = ORBS[m[1]], r = +m[2]; return { key: m[1] + r, type: m[1], r, st: O.st, v: O.v[r], col: O.col, name: O.name, txt: O.t(O.v[r]) }; };
const orbLabel = key => { const O = orbOf(key); return O ? O.name + ' (' + RARITY[O.r].name.toLowerCase() + ')' : ''; };
function orbAdd(v, key, n) { if (!orbOf(key)) return; if (!v.orbs) v.orbs = {}; v.orbs[key] = (v.orbs[key] || 0) + (n || 1); }
function orbTake(v, key) { if (!v.orbs || !(v.orbs[key] > 0)) return false; v.orbs[key]--; if (!v.orbs[key]) delete v.orbs[key]; return true; }

/* ---------- bannières : une par poste, bonus à tous les gardes du cercle ---------- */
const BANNERS = {
  lion: { name: 'Bannière du lion', st: 'dmg', v: [8, 12, 17, 23, 30], t: x => '+' + x + ' % de dégâts' },
  ours: { name: 'Bannière de l’ours', st: 'hp', v: [10, 15, 21, 28, 36], t: x => '+' + x + ' % de vie' },
  faucon: { name: 'Bannière du faucon', st: 'haste', v: [8, 12, 17, 23, 30], t: x => 'attaquent ' + x + ' % plus vite' },
  tour: { name: 'Bannière de la tour', st: 'armor', v: [5, 7, 10, 13, 17], t: x => '+' + x + ' % d’armure' },
  chene: { name: 'Bannière du chêne', st: 'regen', v: [0.4, 0.6, 0.9, 1.2, 1.6], t: x => 'récupèrent ' + String(x).replace('.', ',') + ' % de vie par seconde' },
};
const BAN_KEYS = Object.keys(BANNERS);
const BAN_DROP = [35, 35, 20, 8, 2];
const BAN_MAX = 12;                                     // bannières en réserve au plus (au-delà : vendues d'office)
const banPrice = ban => [10, 25, 60, 150, 400][Math.max(0, Math.min(4, ban.r | 0))];
const banOk = ban => !!(ban && BANNERS[ban.k] && ban.r >= 0 && ban.r <= 4);
const banTxt = ban => banOk(ban) ? BANNERS[ban.k].t(BANNERS[ban.k].v[ban.r]) : '';
const banLabel = ban => banOk(ban) ? BANNERS[ban.k].name + ' (' + RARITY[ban.r].name.toLowerCase() + ')' : '';
/* Une bannière gagnée entre dans la réserve ; réserve pleine : vendue pour de l'or. Renvoie l'identifiant (ou null si vendue). */
function banAdd(v, k, r) {
  if (!v.bans) v.bans = {};
  if (Object.keys(v.bans).length >= BAN_MAX) { v.r.or = (v.r.or || 0) + banPrice({ r }); return null; }
  const id = 'b' + (v.banN = (v.banN | 0) + 1);
  v.bans[id] = { id, k, r };
  return id;
}

/* ---------- ce que vaut un soldat (vie, dégâts…) : niveau, équipement, orbes, bannière de son poste, titre ---------- */
const gPow = (b, n) => { let k = 1; for (let i = 0; i < n; i++) k *= b; return k; };
function solStats(s, post) {
  const S = SOLDIERS[s.type] || SOLDIERS.fant, L = Math.max(1, Math.min(SOL_MAX_LVL, s.lvl | 0)), pw = gPow(1.08, L - 1);
  const G = { hp: 0, dmg: 0, armor: 0, haste: 0, regen: 0, thorns: 0, dodge: 0 };
  if (s.w) G.dmg += solWeaponDmg(s.w);
  if (s.a) { G.hp += solArmorHp(s.a); const SS = SOL_SETS[s.a.set]; if (SS) G[SS.st] += SS.v; }
  for (let i = 0; i < 3; i++) { const O = orbOf(s.o && s.o['o' + i]); if (O && L >= ORB_LVLS[i]) G[O.st] += O.v; }
  const ban = post && banOk(post.ban) ? post.ban : null; if (ban) G[BANNERS[ban.k].st] += BANNERS[ban.k].v[ban.r];
  const ti = solTitle(s); if (ti) { G.hp += ti[2]; G.dmg += ti[2]; }
  return {
    hp: Math.round(S.hp * pw * (1 + G.hp / 100)), dmg: r1(S.dmg * pw * (1 + G.dmg / 100)),
    armor: r2(Math.min(0.7, S.armor + G.armor / 100)), cd: r2(S.cd / (1 + G.haste / 100)),
    regen: r2(Math.min(3, G.regen)), thorns: r2(Math.min(0.6, G.thorns / 100)), dodge: r2(Math.min(0.4, G.dodge / 100)),
    range: S.range, speed: S.speed,
  };
}
const solFood = v => solList(v).reduce((a, s) => a + solEat(s), 0);

/* ---------- butin pour la garnison (donjon gagné, gardien du portail, Profondeurs) ----------
   Orbe : 2 chances sur 5 pour la mine et la crypte, toujours une au portail, une tous les 3 étages des Profondeurs.
   Bannière : 3 chances sur 5 sur le gardien du portail, une pour 5 étages des Profondeurs ou plus. */
function garLoot(v, th, L, deep) {
  const R = mulberry32(hash((v.seed ^ Math.imul((v.gN = (v.gN | 0) + 1), 0x27d4eb2d)) >>> 0)), orbs = [];
  const lv = L + (th === 'prof' ? Math.ceil(deep / 2) : 0);
  const n = th === 'prof' ? Math.min(5, Math.ceil(deep / 3)) : th === 'portail' ? 1 : R() < 0.4 ? 1 : 0;
  for (let i = 0; i < n; i++) { const key = pickOf(R, ORB_KEYS) + rollRarity(R, ORB_DROP, lv); orbAdd(v, key); orbs.push(key); }
  let ban = null;
  if ((th === 'portail' && R() < 0.6) || (th === 'prof' && deep >= 5)) { const k = pickOf(R, BAN_KEYS), r = rollRarity(R, BAN_DROP, lv); ban = { k, r, sold: !banAdd(v, k, r) }; }
  return { orbs, ban };
}
/* Défense réussie (rien n'a été emporté) : une orbe, deux si personne ne s'est enfui. */
function garRaidOrbs(v, inp, res) {
  if (Object.keys(res.lost || {}).length) return [];
  const R = mulberry32((inp.sd ^ 0x2f6b55a7) >>> 0), out = [];
  for (let i = 0; i < (res.e ? 1 : 2); i++) { const key = pickOf(R, ORB_KEYS) + rollRarity(R, ORB_DROP, inp.L); orbAdd(v, key); out.push(key); }
  return out;
}

/* ---------- actions de la garnison (appelées par applyV) : null si l'action n'est pas d'ici ---------- */
function applyGar(v, a, nm, t) {
  const fail = err => ({ ok: false, err });
  const solAt = () => (v.sol && v.sol[a.sid]) || null;
  switch (a.type) {
    case 'recruit': {
      if (!caserneLvl(v)) return fail('Il faut d’abord construire la caserne.');
      if (!SOLDIERS[a.t]) return fail('Type de soldat inconnu.');
      const list = solList(v);
      if (list.length >= solCap(v)) return fail(list.length >= 12 ? 'La garnison est complète (12 soldats).' : 'La caserne est pleine : agrandissez-la pour recruter plus.');
      const c = recruitCost(v), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const n = v.nid++, R = mulberry32(hash((v.seed ^ Math.imul(n, 0x85ebca6b)) >>> 0));
      const x = R(), race = x < 0.5 ? 'humain' : x < 0.78 ? 'nain' : 'elfe', sex = R() < 0.5 ? 'm' : 'f';
      const used = new Set(list.filter(s => s.type === a.t).map(s => s.num | 0)); let num = 1; while (used.has(num)) num++;
      if (!v.sol) v.sol = {};
      const s = { id: 's' + n, n, num, type: a.t, race, sex, lvl: 1, xp: 0, post: 0, o: {}, hurt: 0, vet: 0, raids: 0, kills: 0 };
      v.sol[s.id] = s;
      /* il rejoint tout seul le premier poste qui a de la place */
      const p = postsOf(v).find(b => guardsOf(v, b.id).length < POST_SLOTS); if (p) s.post = p.id;
      addLog(v, t, nm + ' recrute ' + (sex === 'f' ? 'une ' : 'un ') + solTypeName(a.t, sex).toLowerCase() + ' à la caserne (' + solName(s) + ').', 'sol');
      return { ok: true, id: s.id, name: solName(s), post: s.post };
    }
    case 'dismiss': {
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      for (const k of ['o0', 'o1', 'o2']) if (orbOf(s.o && s.o[k])) orbAdd(v, s.o[k]);
      const back = (s.w ? solMelt(s.w) : 0) + (s.a ? solMelt(s.a) : 0);
      if (back) v.r.fer = Math.min(Math.max(capOf(v), v.r.fer || 0), (v.r.fer || 0) + back);
      delete v.sol[s.id];
      addLog(v, t, nm + ' renvoie ' + solName(s) + ' de la caserne.', 'sol');
      return { ok: true, back };
    }
    case 'promote': {
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      if (s.lvl >= SOL_MAX_LVL) return fail('Déjà au niveau maximum (' + SOL_MAX_LVL + ').');
      if ((s.xp | 0) < solXpNeed(s.lvl)) return fail('Pas encore assez d’expérience : elle se gagne en défendant le village.');
      const c = promoteCost(s.lvl), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); s.xp = (s.xp | 0) - solXpNeed(s.lvl); s.lvl++;
      return { ok: true, lvl: s.lvl, orb: ORB_LVLS.includes(s.lvl) };
    }
    case 'solPost': {
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      const to = a.post | 0;
      if (to) {
        const b = v.b.find(x => x.id === to && x.type === 'poste'); if (!b) return fail('Poste introuvable.');
        if (guardsOf(v, to).filter(x => x.id !== s.id).length >= POST_SLOTS) return fail('Ce poste est complet (' + POST_SLOTS + ' gardes).');
      }
      s.post = to;
      return { ok: true };
    }
    case 'solAuto': {
      /* chacun son tour, poste après poste : un peu de chaque type partout (fantassins et lanciers d'abord, les plus forts d'abord) */
      const posts = postsOf(v); if (!posts.length) return fail('Posez d’abord un poste de garde (menu Défense).');
      const list = solList(v).slice().sort((x, y) => SOL_TYPES.indexOf(x.type) - SOL_TYPES.indexOf(y.type) || y.lvl - x.lvl || x.n - y.n);
      if (!list.length) return fail('Recrutez d’abord des soldats à la caserne.');
      const cnt = posts.map(() => 0); let i = 0;
      for (const s of list) {
        let k = 0; while (k < posts.length && cnt[(i + k) % posts.length] >= POST_SLOTS) k++;
        if (k >= posts.length) { s.post = 0; continue; }
        const j = (i + k) % posts.length; s.post = posts[j].id; cnt[j]++; i = j + 1;
      }
      return { ok: true, n: list.length, p: posts.length };
    }
    case 'solForge': {
      if (!forgeLvlOf(v)) return fail('Il faut une forge pour équiper les soldats.');
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      const k = a.k === 'a' ? 'a' : 'w', set = k === 'a' ? (SOL_SETS[a.set] ? a.set : null) : null;
      if (k === 'a' && !set) return fail('Choisis une armure.');
      const c = solForgeCost(k, s.lvl), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const old = s[k], back = old ? solMelt(old) : 0;
      if (back) v.r.fer = Math.min(Math.max(capOf(v), v.r.fer || 0), (v.r.fer || 0) + back);
      s[k] = k === 'a' ? { il: s.lvl, up: 0, set } : { il: s.lvl, up: 0 };
      return { ok: true, back, name: solItemName(s, k) };
    }
    case 'solImprove': {
      const f = forgeLvlOf(v); if (!f) return fail('Il faut une forge.');
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      const it = s[a.k === 'a' ? 'a' : 'w']; if (!it) return fail('Rien à améliorer : forgez-le d’abord.');
      if ((it.up | 0) >= maxUpOf(f)) return fail((it.up | 0) >= 5 ? 'Déjà amélioré au maximum (+5).' : 'Agrandissez la forge pour aller plus loin.');
      const c = solImproveCost(it), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); it.up = (it.up | 0) + 1;
      return { ok: true, up: it.up };
    }
    case 'orbSet': case 'orbOff': {
      const s = solAt(); if (!s) return fail('Soldat introuvable.');
      const i = a.s | 0; if (i < 0 || i > 2) return fail('Emplacement inconnu.');
      if (!s.o) s.o = {};
      const old = s.o['o' + i];
      if (a.type === 'orbOff') { if (orbOf(old)) { orbAdd(v, old); delete s.o['o' + i]; } return { ok: true }; }
      if (s.lvl < ORB_LVLS[i]) return fail('Cet emplacement s’ouvre au niveau ' + ORB_LVLS[i] + '.');
      const O = orbOf(a.o); if (!O) return fail('Orbe inconnue.');
      if (!orbTake(v, O.key)) return fail('Plus d’orbe de ce genre en réserve.');
      if (orbOf(old)) orbAdd(v, old);
      s.o['o' + i] = O.key;
      return { ok: true, name: orbLabel(O.key) };
    }
    case 'orbFuse': {
      const O = orbOf(a.o); if (!O) return fail('Orbe inconnue.');
      if (O.r >= 4) return fail('Cette orbe est déjà légendaire.');
      if (((v.orbs || {})[O.key] || 0) < 3) return fail('Il faut trois orbes pareilles.');
      const c = { or: ORB_FUSE[O.r] }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      v.orbs[O.key] -= 3; if (!v.orbs[O.key]) delete v.orbs[O.key];
      const nk = O.type + (O.r + 1); orbAdd(v, nk);
      return { ok: true, o: nk, name: orbLabel(nk) };
    }
    case 'banSet': case 'banOff': {
      const b = v.b.find(x => x.id === a.id && x.type === 'poste'); if (!b) return fail('Poste introuvable.');
      let ban = null;
      if (a.type === 'banSet') { ban = v.bans && v.bans[a.ban]; if (!banOk(ban)) return fail('Bannière introuvable.'); delete v.bans[a.ban]; }
      if (banOk(b.ban)) banAdd(v, b.ban.k, b.ban.r);      // l'ancienne retourne dans la réserve (vendue si la réserve est pleine)
      delete b.ban;
      if (ban) b.ban = { k: ban.k, r: ban.r };
      return { ok: true, name: ban ? banLabel(ban) : '' };
    }
    case 'banSell': {
      const ban = v.bans && v.bans[a.ban]; if (!banOk(ban)) return fail('Bannière introuvable.');
      const gain = banPrice(ban); delete v.bans[a.ban]; v.r.or = (v.r.or || 0) + gain;
      return { ok: true, gain };
    }
  }
  return null;
}
