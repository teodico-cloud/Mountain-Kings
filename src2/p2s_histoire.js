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
  const hall = v.b.find(b => b.type === 'halle');
  const sp = freeSpot(v, 'chambre', hall ? hall.gx + 1 : 11, hall ? hall.gz + 1 : 11);
  if (sp) v.b.push({ id: v.nid++, type: 'chambre', lvl: 1, gx: sp[0], gz: sp[1], up: null });
  v.lilou = { at: t, by: hh ? hh.id : '', mood: LILOU.start, party: 0, nd: 0, nw: 0 };
  addLog(v, t, (hh ? hh.name : 'Un héros') + ' revient de la Source du Mal avec… un bébé ! Lilou s’installe au village' + (sp ? ', dans sa chambre près de la halle.' : '.'), 'lilou');
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
      return { ok: true, k: cap.k, big, mood: lilouMood(L).k, up: before !== lilouMood(L).k };
    }
  }
  return null;
}
