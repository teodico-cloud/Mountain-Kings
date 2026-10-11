/* Essais des règles du nouveau jeu (village commun). Usage : node tools/test_v2.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src2/p2_rules.js'), 'utf8');
const R = new Function(src + '\nreturn { VERSION, BLD, RES, SEASONS, SPEC, newVillage, simulateVillage, applyV, ratesOf, moraleOf, moraleParts, seasonIdx, capOf, housingOf, freeHousing, costOf, workOf, hallLvl, workersOf, builders, foodOf, clone, freeSpot, bldRate };')();
let fails = 0;
const ok = (c, m) => { if (c) console.log('ok : ' + m); else { fails++; console.log('ÉCHEC : ' + m); } };
const H = 3600000, D = 24 * H, T0 = Date.UTC(2026, 9, 12, 8, 0, 0);
const who = { uid: 'u1', name: 'Téo' }, who2 = { uid: 'u2', name: 'Léa' };

/* 1. Fondation */
let v = R.newVillage('vtest', 'Val-Brume', '#D27A22', T0, 'u1', 'Téo');
ok(v.vil.length === 4 && v.vil.every(p => p.job != null), 'fondation : 4 villageois, tous au travail');
ok(R.housingOf(v) === 6, 'fondation : 6 places dans 2 maisons');
ok(v.vil.every(p => R.SPEC.every(s => p.st[s] >= 1 && p.st[s] <= 10)), 'notes entre 1 et 10');

/* 2. Même résultat, qu'on simule d'un coup ou par petits morceaux */
const a = R.clone(v), b = R.clone(v);
R.simulateVillage(a, T0 + 30 * H + 12345);
let t = T0; while (t < T0 + 30 * H + 12345) { t = Math.min(T0 + 30 * H + 12345, t + Math.floor(Math.random() * 5 * H)); R.simulateVillage(b, t); }
ok(JSON.stringify(a) === JSON.stringify(b), 'simulation identique en un bloc ou en morceaux');

/* 3. Production et repas sur 6 heures */
const v6 = R.simulateVillage(R.clone(v), T0 + 6 * H);
ok(v6.r.bois > v.r.bois, 'le bûcheron produit du bois (' + Math.round(v.r.bois) + ' → ' + Math.round(v6.r.bois) + ')');
ok(v6.r.ble > 0, 'le champ produit du blé (' + Math.round(v6.r.ble) + ')');
const rt = R.ratesOf(v, T0);
ok(rt.food < 0 && rt.bois > 0, 'rythmes : ' + Math.round(rt.bois) + ' bois/h, ' + Math.round(rt.viande) + ' viande/h, repas ' + Math.round(rt.food) + '/h');

/* 4. Construire une maison */
let w = R.clone(v);
const spot = R.freeSpot(w, 'maison');
let r = R.applyV(w, { type: 'build', b: 'maison', gx: spot[0], gz: spot[1] }, who);
ok(r.ok && w.b.some(x => x.id === r.id && x.lvl === 0 && x.up), 'chantier de maison lancé');
const bois0 = w.r.bois;
R.simulateVillage(w, w.t + 2 * H);
ok(w.b.find(x => x.id === r.id).lvl === 1, 'maison terminée en moins de 2 h avec un bâtisseur');
ok(R.housingOf(w) === 9, '9 places après la nouvelle maison');
ok(!R.applyV(R.clone(w), { type: 'build', b: 'taverne', gx: 3, gz: 3 }, who).ok, 'taverne refusée avant la halle niveau 2');

/* 5. Emplois */
const idle = w.vil.find(p => p.job === 'bat');
const carr = R.applyV(w, { type: 'build', b: 'carriere', gx: R.freeSpot(w, 'carriere')[0], gz: R.freeSpot(w, 'carriere')[1] }, who);
ok(!R.applyV(R.clone(w), { type: 'job', vid: idle.id, to: carr.id }, who).ok, 'impossible de travailler dans un chantier');
R.simulateVillage(w, w.t + 3 * H);
r = R.applyV(w, { type: 'job', vid: idle.id, to: carr.id }, who);
ok(r.ok && R.workersOf(w, carr.id).length === 1, 'un villageois devient carrier');
const p0 = w.r.pierre; R.simulateVillage(w, w.t + 2 * H);
ok(w.r.pierre > p0, 'la carrière produit de la pierre');

/* 6. Arrivées sur 3 jours */
let v3 = R.clone(w); const seen = new Set();
for (let i = 0; i < 72; i++) { R.simulateVillage(v3, v3.t + H); v3.cands.forEach(c => seen.add(c.id)); }
ok(seen.size > 0, 'des villageois se présentent (' + seen.size + ' en 3 jours)');
const cand = v3.cands[0] || null;
if (cand) {
  const n = v3.vil.length; r = R.applyV(v3, { type: 'accept', id: cand.id }, who2.uid in v3.members ? who2 : who);
  ok(r.ok && v3.vil.length === n + 1, 'accueil d’un nouveau villageois (' + cand.name + ')');
}

/* 7. Saisons : l'hiver arrive au bout de 6 jours */
let vw = R.clone(v);
R.simulateVillage(vw, T0 + 6 * D + H);
ok(R.seasonIdx(vw, vw.t) === 3, 'hiver au 7e jour');
ok(vw.log.some(l => l.k === 'season' && /Hiver/.test(l.m)), 'annonce de l’hiver dans le journal');
const rw = R.ratesOf(vw, vw.t);
ok(rw.ble === 0, 'pas de blé en hiver');

/* 8. Famine : sans nourriture ni chasseur, quelqu'un s'en va */
let vf = R.clone(v); vf.r.pain = 0; vf.r.viande = 0; for (const p of vf.vil) if (p.job !== 'bat') p.job = null;
R.simulateVillage(vf, vf.t + 26 * H);
ok(vf.vil.length === 3 && vf.log.some(l => l.k === 'leave'), 'un villageois part après un jour de famine');
ok(R.moraleOf(vf, vf.t) < 40, 'moral en berne pendant la famine (' + R.moraleOf(vf, vf.t) + ')');

/* 9. Héros */
let vh = R.clone(v); vh.members.u2 = { name: 'Léa', t: T0 };
ok(R.applyV(vh, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', col: '#2F8A63' }, who).ok, 'création du héros de Téo');
ok(!R.applyV(vh, { type: 'hero', name: 'Bis', race: 'nain', cls: 'guerrier' }, who).ok, 'un seul héros par joueur');
ok(R.applyV(vh, { type: 'join' }, who2).ok && vh.log.some(l => l.k === 'join'), 'arrivée de Léa annoncée');
ok(R.applyV(vh, { type: 'hero', name: 'Aelith', race: 'elfe', cls: 'rodeur' }, who2).ok, 'création du héros de Léa');
const chasse = vh.b.find(x => x.type === 'chasse');
const before = R.bldRate(vh, chasse, vh.t).viande;
R.applyV(vh, { type: 'heroAt', to: chasse.id }, who2);
const after = R.bldRate(vh, chasse, vh.t).viande;
ok(Math.abs(after / before - 1.25) < 1e-9, 'une elfe au pavillon de chasse : +25 %');

/* 10. Fête */
ok(!R.applyV(R.clone(v), { type: 'feast' }, who).ok, 'pas de fête sans taverne');

/* 11. Rapidité : simuler 3 jours */
const t0 = Date.now(); R.simulateVillage(R.clone(v3), v3.t + 3 * D); const ms = Date.now() - t0;
ok(ms < 1500, 'simulation de 3 jours en ' + ms + ' ms');
console.log(JSON.stringify(v3).length + ' octets pour un village de ' + v3.vil.length + ' villageois');
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
