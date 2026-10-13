/* ===================== L'HISTOIRE (lot A) : Lilou, son humeur et ses caprices =====================
   Lilou arrive au village au bout de la mission « La Source du Mal » (donjon guidé, thème 'source' de p2d_donjon.js).
   v.lilou = { at (arrivée), by (héros qui l'a ramenée), mood (0 à 100), d: caprice du jour { n, k, ok }, w: gros caprice de la semaine { n, k, ok },
               party (fin de la fête pour Lilou : +10 de moral), nd, nw (caprices satisfaits) }.
   Tout se calcule pareil sur les deux téléphones : jours comptés depuis l'arrivée de Lilou, caprices tirés avec la graine du village. */
const LILOU = { start: 60, day: 12, dayMiss: 12, week: 25, weekMiss: 20, party: 10 };
/* Son humeur : du plus bas au plus haut (seuil, nom, effet sur les dégâts des monstres, en donjon comme en raid). */
const LILOU_MOODS = [
  { min: 0, k: 'colere', name: 'en colère', mul: 1.1 },
  { min: 20, k: 'grognon', name: 'grognon', mul: 1.05 },
  { min: 40, k: 'calme', name: 'calme', mul: 1 },
  { min: 60, k: 'contente', name: 'contente', mul: 0.95 },
  { min: 80, k: 'ravie', name: 'ravie', mul: 0.9 },
];
/* Un caprice par jour, à fabriquer avec les ressources du village. */
const CAPRICES = {
  hochet: { name: 'un hochet', cost: { bois: 30, pierre: 10 }, txt: 'Un hochet en bois, avec des cailloux dedans qui font un bruit épouvantable.' },
  cubes: { name: 'des cubes', cost: { bois: 40 }, txt: 'Des cubes de bois à empiler, puis à jeter sur le chat.' },
  cheval: { name: 'un cheval à bascule', cost: { bois: 70, pierre: 20 }, txt: 'Un cheval à bascule, pour charger les gobelins imaginaires.' },
  bouillie: { name: 'une bouillie', cost: { ble: 30 }, txt: 'Une bouillie de blé bien chaude (dont la moitié finira par terre).' },
  biscuits: { name: 'des biscuits', cost: { pain: 25 }, txt: 'Des biscuits à mâchouiller, pour ses premières dents.' },
};
/* Un gros caprice par semaine : plus cher, et toute la vallée en profite (+10 de moral pendant un jour). */
const BIG_CAPRICES = {
  anniv: { name: 'un anniversaire à la taverne', cost: { pain: 60, viande: 60, biere: 20 }, txt: 'Tout le village à la taverne, des chansons, un gâteau, et Lilou au milieu.', need: v => hasTavern(v) && built(v, 'brasserie') > 0, needTxt: 'Il faut une taverne et une brasserie.' },
  manege: { name: 'un manège', cost: { bois: 220, pierre: 100 }, txt: 'Un manège de chevaux de bois sur la place du village.' },
  cabane: { name: 'une cabane', cost: { bois: 260 }, txt: 'Une cabane dans un arbre, avec un drapeau (rose).' },
  feux: { name: 'des feux d’artifice', cost: { or: 150 }, txt: 'Des feux d’artifice achetés au marchand, pour illuminer la vallée.' },
};
/* « de » + nom : d’un manège, d’une cabane, de feux d’artifice */
const deOf = s => s.indexOf('des ') === 0 ? 'de ' + s.slice(4) : 'd’' + s;
/* après une négation : de hochet, d’anniversaire… */
const negOf = s => { const w = s.replace(/^(un|une|des) /, ''); return (/^[aeiouyhéèêâ]/i.test(w) ? 'd’' : 'de ') + w; };
const lilouDay = (L, t) => Math.floor(Math.max(0, t - L.at) / DAY);
const lilouWeek = (L, t) => Math.floor(Math.max(0, t - L.at) / (7 * DAY));
const lilouNextDay = L => L.at + (L.d ? L.d.n + 1 : 1) * DAY;
const lilouNextWeek = L => L.at + (L.w ? L.w.n + 1 : 1) * 7 * DAY;
const lilouMood = L => LILOU_MOODS.reduce((a, m) => ((L ? L.mood : LILOU.start) >= m.min ? m : a), LILOU_MOODS[0]);
/* Effet sur les dégâts des monstres (1 tant que Lilou n'est pas au village). */
const lilouMul = v => (v && v.lilou ? lilouMood(v.lilou).mul : 1);
/* Les prix grandissent un peu avec le village (halle 1 : prix de base ; halle 5 : deux fois plus). */
function capCost(v, k, big) {
  const C = (big ? BIG_CAPRICES : CAPRICES)[k]; if (!C) return {};
  const f = 1 + 0.25 * (hallLvl(v) - 1), out = {};
  for (const r in C.cost) out[r] = Math.round(C.cost[r] * f / 5) * 5;
  return out;
}
function lilouAdd(L, n) { L.mood = Math.max(0, Math.min(100, Math.round((L.mood == null ? LILOU.start : L.mood) + n))); }
/* Tirage d'un caprice (jamais deux fois le même de suite). */
function lilouPick(v, keys, n, salt, avoid) {
  const R = mulberry32(hash((v.seed ^ Math.imul(n + 1, salt)) >>> 0));
  let k = keys[Math.floor(R() * keys.length)];
  if (k === avoid && keys.length > 1) k = keys[(keys.indexOf(k) + 1 + Math.floor(R() * (keys.length - 1))) % keys.length];
  return k;
}
/* Un caprice oublié : son humeur baisse (« Elle est maintenant grognon. », ou « Elle reste ravie… pour l’instant. ») */
function lilouSulk(L, n) {
  const before = lilouMood(L).name; lilouAdd(L, -n);
  const now = lilouMood(L).name;
  return now !== before ? 'Elle est maintenant ' + now + '.' : 'Elle reste ' + now + '… pour l’instant.';
}
/* Appelé à chaque minute par stepVillage : nouveau jour, nouvelle semaine (un caprice oublié la rend grognon). */
function lilouTick(v) {
  const L = v.lilou; if (!L) return;
  const t = v.t, dn = lilouDay(L, t), wn = lilouWeek(L, t);
  if (!L.d || L.d.n !== dn) {
    if (L.d && !L.d.ok) addLog(v, t, 'Lilou boude : personne ne lui a fabriqué ' + negOf(CAPRICES[L.d.k].name) + '. ' + lilouSulk(L, LILOU.dayMiss), 'lilou');
    const k = lilouPick(v, Object.keys(CAPRICES), dn, 2654435761, L.d && L.d.k);
    L.d = { n: dn, k, ok: 0 };
    addLog(v, t, 'Caprice du jour : Lilou veut ' + CAPRICES[k].name + '.', 'lilou');
  }
  if (!L.w || L.w.n !== wn) {
    if (L.w && !L.w.ok) addLog(v, t, 'Lilou n’a pas eu ' + negOf(BIG_CAPRICES[L.w.k].name) + ' : quelle déception ! ' + lilouSulk(L, LILOU.weekMiss), 'lilou');
    const keys = Object.keys(BIG_CAPRICES).filter(k => !BIG_CAPRICES[k].need || BIG_CAPRICES[k].need(v));
    const k = lilouPick(v, keys, wn, 40503, L.w && L.w.k);
    L.w = { n: wn, k, ok: 0 };
    addLog(v, t, 'Gros caprice de la semaine : Lilou rêve ' + deOf(BIG_CAPRICES[k].name) + '.', 'lilou');
  }
}
/* Fin de la mission « La Source du Mal » : Lilou arrive, avec sa chambre près de la halle (une seule fois par village). */
function lilouArrive(v, t, hh) {
  if (v.lilou) return null;
  if (!v.chron) chronInit(v);           // (avant Lilou : son arrivée n'y est écrite qu'une fois, plus bas)
  const hall = v.b.find(b => b.type === 'halle');
  const sp = freeSpot(v, 'chambre', hall ? hall.gx + 1 : 11, hall ? hall.gz + 1 : 11);
  if (sp) v.b.push({ id: v.nid++, type: 'chambre', lvl: 1, gx: sp[0], gz: sp[1], up: null });
  v.lilou = { at: t, by: hh ? hh.id : '', mood: LILOU.start, party: 0, nd: 0, nw: 0 };
  addLog(v, t, (hh ? hh.name : 'Un héros') + ' revient de la Source du Mal avec… un bébé ! Lilou s’installe au village' + (sp ? ', dans sa chambre près de la halle.' : '.'), 'lilou');
  chron(v, t, 'lilou', (hh ? hh.name : 'Un héros') + ' ramène Lilou de la Source du Mal.');
  lilouTick(v);
  return { chambre: !!sp };
}
/* Les actions de l'histoire (appelées par applyV). */
function applyStory(v, a, nm, t) {
  const fail = err => ({ ok: false, err });
  switch (a.type) {
    case 'lilouCap': {
      /* Satisfaire le caprice du jour (w: 0) ou le gros caprice de la semaine (w: 1). */
      const L = v.lilou; if (!L) return fail('Lilou n’est pas encore au village.');
      lilouTick(v);
      const big = !!a.w, cap = big ? L.w : L.d, C = cap && (big ? BIG_CAPRICES : CAPRICES)[cap.k];
      if (!C) return fail('Pas de caprice en ce moment.');
      if (cap.ok) return fail(big ? 'Le gros caprice de la semaine est déjà offert.' : 'Le caprice du jour est déjà fait : revenez demain.');
      if (big && C.need && !C.need(v)) return fail(C.needTxt || 'Pas possible pour l’instant.');
      const c = capCost(v, cap.k, big), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); cap.ok = 1;
      const before = lilouMood(L).k;
      lilouAdd(L, big ? LILOU.week : LILOU.day);
      if (big) { L.party = t + DAY; L.nw = (L.nw | 0) + 1; } else L.nd = (L.nd | 0) + 1;
      addLog(v, t, big ? nm + ' offre ' + C.name + ' à Lilou : toute la vallée fait la fête !' : nm + ' fabrique ' + C.name + ' pour Lilou : elle gazouille de joie.', 'lilou');
      if (big) chron(v, t, 'lilou', 'Fête pour Lilou : ' + nm + ' lui offre ' + C.name + '.');
      return { ok: true, k: cap.k, big, mood: lilouMood(L).k, up: before !== lilouMood(L).k };
    }
  }
  return null;
}

/* ===================== L'HISTOIRE, lot B : la Couronne de la Montagne =====================
   10 minutes après l'arrivée de Lilou, le Roi Déchu réclame la Source : la quête de la couronne commence, et elle ne s'arrête jamais.
   v.crown = { cy : cycle (1 = l'histoire, ensuite les joyaux), got : ce qui est trouvé dans ce cycle (un bit chacun : mine, crypte, portail, Profondeurs),
               rank : cycles terminés (rang de la couronne : +1 de moral par rang, 10 au plus), at : début du cycle,
               nl : prochaine lettre du Roi Déchu, ln : lettres déjà reçues, lc : le dernier coffre { g, o, r } }.
   1er cycle : les 4 morceaux dans l'ordre (chapitres 1 à 4). La couronne reconstituée, le Roi Déchu la maudit : ses 4 joyaux s'éteignent ;
   les rallumer (dans l'ordre qu'on veut, gardés par des boss plus forts) fait un nouveau cycle, et ainsi de suite.
   v.chron = [[t, k, m], …] : la chronique du village (60 moments au plus ; la fondation reste toujours en tête). */
const CROWN_SRC = ['mine', 'crypte', 'portail', 'prof'];
const CROWN_PIECES = ['le bandeau', 'le fleuron', 'l’arche', 'la pierre de cœur'];
const CROWN_JEWELS = ['le joyau de la mine', 'le joyau de la crypte', 'le joyau de l’abîme', 'le joyau des Profondeurs'];
const CROWN_CHAPTERS = ['Les éclaireurs du Roi', 'La crypte des rois', 'Les portes de l’abîme', 'Le trône sous la montagne'];
const CROWN_DELAY = 10 * MIN, CROWN_LETTER_GAP = 40 * HOUR, CROWN_LETTER_RND = 16 * HOUR, CROWN_FEAR = 15;
const CROWN_FIRST = 'À la vermine qui m’a volé ma Source : elle m’appartient, c’est le prix de mon pacte. Rendez-la-moi, ou je reprendrai ma couronne, et avec elle toute la vallée.';
/* Les lettres du Roi Déchu, de temps en temps (et ce qu'en pense Sukhoï) */
const CROWN_LETTERS = [
  ['Rendez-moi la Source, ou je reviendrai. Avec une armée. Et un très grand chapeau.', 'Il a toujours aimé les chapeaux.'],
  ['Vos palissades ne m’arrêteront pas : mes trolls les mangent au petit-déjeuner.', 'Ça explique leur haleine.'],
  ['J’exige que la Source me soit livrée avant la pleine lune. Avec ses biscuits.', 'Les biscuits, jamais.'],
  ['Vous ignorez à qui vous avez affaire. Je suis le Roi de la Montagne ! Déchu, d’accord, mais roi quand même.', 'Surtout déchu.'],
  ['Mes gobelins disent que la Source pleure toute la nuit. Ha ! Vous souffrez ! Rendez-la-moi.', 'Là, il n’a pas tout à fait tort.'],
  ['Je sais où vous dormez. Dans la vallée. C’est grand, mais je sais.', 'Il ne sait pas.'],
  ['Dites à ce chat d’arrêter de me fixer dans mes rêves.', 'Non.'],
  ['Cette couronne est à moi. Chaque morceau. Même le petit, là, qui pique.', 'Celui qui pique, c’est le meilleur.'],
  ['Ultime avertissement. Après celui-ci, il y en aura un autre, encore plus ultime.', 'J’ai hâte de lire le suivant.'],
  ['Mon démon dit que vous trichez. Il ne sait pas comment, mais il le dit.', 'Son démon dit beaucoup de choses.'],
  ['Si vous me rendez la Source, je vous laisse la vallée. Et le chat. Surtout le chat.', 'Il a peur de moi. Comme il se doit.'],
  ['Ne croyez pas que je boude. Un roi ne boude pas. Il médite sa vengeance, nuance.', 'Il boude.'],
];
/* Ses lettres quand la couronne brille (le début du cycle suivant) */
const CROWN_CURSES = [
  'Vous croyez avoir gagné ? Cette couronne est maudite depuis mon pacte. Regardez ses joyaux s’éteindre, un à un… Ils sont à moi, désormais, et mes serviteurs les gardent.',
  'Encore ? Très bien. Mes joyaux retourneront dans l’ombre, mieux gardés que jamais.',
  'Vous ne garderez pas cette lumière. Personne ne la garde. Pas même moi.',
  'Je suis patient. Les montagnes aussi. Éteignez-vous, joyaux !',
  'Mon démon a doublé la garde. Bonne chance. Je ne le pense pas.',
];
const crownBits = g => (g & 1) + ((g >> 1) & 1) + ((g >> 2) & 1) + ((g >> 3) & 1);
/* Ce qu'il faut pour le morceau k au cycle cy : mine niveau 3, 6, 9… ; crypte 4, 7, 10… ; un portail ; Profondeurs : l'étage 5, 10, 15… terminé */
const crownNeed = (cy, k) => (k === 0 ? 3 * cy : k === 1 ? 3 * cy + 1 : k === 3 ? 5 * cy : 0);
const crownName = (cy, k) => (cy === 1 ? CROWN_PIECES : CROWN_JEWELS)[k];
/* Dès le chapitre 3 (et pour toujours), la moitié des gobelins des raids vise la chambre de Lilou. */
const crownRaidOn = v => !!(v.crown && (v.crown.cy > 1 || crownBits(v.crown.got) >= 2) && v.b.some(b => b.type === 'chambre'));
/* Ce que ce retour de donjon rapporte : le morceau k, ou -1. Au 1er cycle, seulement celui du chapitre en cours. */
function crownCan(v, th, L, deep, win) {
  const C = v && v.crown, k = CROWN_SRC.indexOf(th); if (!C || k < 0 || (C.got & (1 << k))) return -1;
  if (C.cy === 1 && k !== crownBits(C.got)) return -1;
  const need = crownNeed(C.cy, k);
  if (k === 3) return deep >= need ? k : -1;
  return win && L >= need ? k : -1;
}

/* ---------- la chronique du village ---------- */
function chron(v, t, k, m) {
  if (!v.chron) chronInit(v);
  v.chron.push([Math.round(t), k, m]);
  if (v.chron.length > 60) v.chron.splice(1, v.chron.length - 60);
}
/* Village fondé avant la chronique : on la commence avec ce qu'on sait (la fondation, l'arrivée de Lilou). */
function chronInit(v) {
  const m = Object.values(v.members || {}).filter(Boolean).sort((a, b) => (a.t || 0) - (b.t || 0))[0];
  v.chron = [[Math.round(v.born || v.t), 'found', (m ? m.name + ' fonde ' : 'Fondation du ') + 'le village de ' + v.name + '.']];
  if (v.lilou) { const hh = v.heroes && v.heroes[v.lilou.by]; v.chron.push([Math.round(v.lilou.at), 'lilou', (hh ? hh.name : 'Un héros') + ' ramène Lilou de la Source du Mal.']); }
}
/* Un héros passe un cap (niveau 5, 10, 15…) */
function chronLvl(v, t, hh, lv0) { if (Math.floor(hh.lvl / 5) > Math.floor(lv0 / 5)) chron(v, t, 'hero', hh.name + ' atteint le niveau ' + (Math.floor(hh.lvl / 5) * 5) + '.'); }

/* ---------- la quête ---------- */
/* Appelé à chaque minute par stepVillage */
function crownTick(v) {
  const t = v.t;
  if (!v.chron) chronInit(v);
  if (!v.crown) { if (v.lilou && t >= v.lilou.at + CROWN_DELAY) crownStart(v, t); return; }
  if (t >= v.crown.nl) crownLetter(v, t);
}
function crownStart(v, t) {
  v.crown = { cy: 1, got: 0, rank: 0, at: t, nl: t + 36 * HOUR, ln: 0 };
  addLog(v, t, 'Une lettre cachetée de noir est clouée sur la porte de la halle : « ' + CROWN_FIRST + ' » Signé : le Roi Déchu.', 'roi');
  chron(v, t, 'roi', 'Le Roi Déchu réclame la Source : la quête de la Couronne de la Montagne commence.');
}
function crownLetter(v, t) {
  const C = v.crown, L = CROWN_LETTERS[(C.ln | 0) % CROWN_LETTERS.length];
  C.ln = (C.ln | 0) + 1;
  const R = mulberry32(hash((v.seed ^ Math.imul(C.ln, 0x2c1b3c6d)) >>> 0));
  C.nl = t + CROWN_LETTER_GAP + Math.floor(R() * (CROWN_LETTER_RND / MIN)) * MIN;
  addLog(v, t, 'Lettre du Roi Déchu : « ' + L[0] + ' » Sukhoï : « ' + L[1] + ' »', 'roi');
}
/* Un objet en cadeau, dans le sac du joueur (vendu d'office si le sac est plein) */
function crownGift(v, t, uid, hh, r, salt) {
  if (!hh) return null;
  const R = mulberry32(hash((v.seed ^ hashStr(uid) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0));
  const it = genItem(R, { il: hh.lvl, r, cls: hh.cls }), I = itemInfo(it);
  if (bagCount(bagOf(v, uid)) >= bagMax(v)) { v.r.or = (v.r.or || 0) + I.sell; return { name: I.name, r: it.r, sold: I.sell }; }
  bagAdd(v, uid, it);
  if (it.r === 4) chron(v, t, 'leg', hh.name + ' reçoit un objet légendaire : ' + I.name + '.');
  return { name: I.name, r: it.r };
}
const crownGiftTxt = g => !g ? '' : ' et ' + (g.sold ? 'un objet vendu d’office (sac plein) : +' + g.sold + ' or' : RARITY[g.r].name.toLowerCase() + ' : ' + g.name);
/* Retour de donjon (djEnd) : un morceau ou un joyau ? De l'or pour la bourse et un objet pour celui qui le rapporte ; les quatre : la couronne brille. */
function crownFound(v, t, th, L, deep, win, hh, uid) {
  const k = crownCan(v, th, L, deep, win); if (k < 0) return null;
  const C = v.crown, cy = C.cy;
  C.got |= 1 << k;
  const gold = 30 + 15 * cy + 10 * k, n = crownBits(C.got), name = crownName(cy, k);
  v.r.or = (v.r.or || 0) + gold;
  const gift = crownGift(v, t, uid, hh, cy === 1 && k < 2 ? 2 : 3, cy * 8 + k);
  if (cy === 1) {
    addLog(v, t, hh.name + ' rapporte ' + name + ' de la Couronne de la Montagne (' + n + ' sur 4) : +' + gold + ' or' + crownGiftTxt(gift) + '.', 'crown');
    chron(v, t, 'crown', hh.name + ' rapporte ' + name + ' de la couronne (' + n + ' sur 4).');
  } else {
    addLog(v, t, hh.name + ' rallume ' + name + ' (' + n + ' sur 4) : +' + gold + ' or' + crownGiftTxt(gift) + '.', 'crown');
    chron(v, t, 'crown', hh.name + ' rallume ' + name + ' (cycle ' + cy + ').');
  }
  const out = { k, cy, n, name, gold, gift };
  if (C.got === 15) out.done = crownComplete(v, t);
  return out;
}
/* Les quatre : la couronne gagne un rang, un coffre (100 or par cycle, une orbe, un objet épique — légendaire tous les 3 cycles — pour le héros actif de chaque joueur),
   puis le Roi Déchu la maudit. */
function crownComplete(v, t) {
  const C = v.crown, cy = C.cy;
  C.rank = (C.rank | 0) + 1;
  const gold = 100 * cy; v.r.or = (v.r.or || 0) + gold;
  const R = mulberry32(hash((v.seed ^ Math.imul(cy + 7, 0x7feb352d)) >>> 0));
  const orb = pickOf(R, ORB_KEYS) + rollRarity(R, ORB_DROP, 3 * cy + 2); orbAdd(v, orb);
  const gifts = [];
  for (const uid of Object.keys(v.members || {}).sort()) {
    const hh = activeHero(v, uid), g = crownGift(v, t, uid, hh, cy % 3 === 0 ? 4 : 3, 1000 + cy);      // légendaire tous les 3 cycles
    if (g) gifts.push(hh.name + ' : ' + (g.sold ? 'objet vendu (sac plein)' : g.name));
  }
  C.lc = { g: gold, o: orb, r: C.rank };
  addLog(v, t, (cy === 1 ? 'La Couronne de la Montagne est reconstituée ! Elle brille sur la halle : ' + v.name + ' a ses Rois de la Montagne.' : 'Les quatre joyaux brillent : la couronne passe au rang ' + C.rank + '.')
    + ' Coffre : +' + gold + ' or, ' + orbLabel(orb) + (gifts.length ? ', ' + gifts.join(', ') : '') + '.', 'crown');
  chron(v, t, 'crown', cy === 1 ? 'La couronne est reconstituée : ' + v.name + ' a ses Rois de la Montagne !' : 'La couronne brille plus fort : rang ' + C.rank + '.');
  /* le Roi Déchu riposte : un nouveau cycle commence */
  C.cy = cy + 1; C.got = 0; C.at = t;
  addLog(v, t, 'Lettre du Roi Déchu : « ' + CROWN_CURSES[(cy - 1) % CROWN_CURSES.length] + ' » Les quatre joyaux de la couronne s’éteignent et s’envolent vers les donjons.', 'roi');
  chron(v, t, 'roi', 'Le Roi Déchu maudit la couronne : ses joyaux s’éteignent (cycle ' + C.cy + ').');
  return { rank: C.rank, gold, orb, gifts };
}
