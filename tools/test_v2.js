/* Essais des règles du nouveau jeu (village commun). Usage : node tools/test_v2.js */
const fs = require('fs'), path = require('path');
const src = ['p2_rules.js', 'p2e_equip.js'].map(f => fs.readFileSync(path.join(__dirname, '../src2/' + f), 'utf8')).join('\n');
const R = new Function(src + '\nreturn { VERSION, BLD, RES, SEASONS, SPEC, GOALS, FEAST, RACES, CLASSES, RACE_KEYS, CLASS_KEYS, heroSlots, heroesOf, activeHero, newVillage, simulateVillage, applyV, ratesOf, moraleOf, moraleParts, seasonIdx, capOf, housingOf, freeHousing, costOf, workOf, hallLvl, workersOf, builders, foodOf, clone, freeSpot, bldRate, goalsOf, goalProg, goalDone, genItem, cleanItem, itemInfo, canWear, gearOf, compareItem, bagOf, bagMax, mulberry32, merchHere, merchDay, RARITY, SETS, POWERS, GEMS, gemOf, craftCost, improveCost, SLOTS, DROP, rollRarity, forgeLvlOf };')();
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
ok(!R.applyV(vh, { type: 'hero', name: 'Bis', race: 'nain', cls: 'guerrier' }, who).ok, 'pas de deuxième héros sans taverne');
ok(R.applyV(vh, { type: 'join' }, who2).ok && vh.log.some(l => l.k === 'join'), 'arrivée de Léa annoncée');
ok(R.applyV(vh, { type: 'hero', name: 'Aelith', race: 'elfe', cls: 'rodeur' }, who2).ok, 'création du héros de Léa');
const chasse = vh.b.find(x => x.type === 'chasse');
const before = R.bldRate(vh, chasse, vh.t).viande;
R.applyV(vh, { type: 'heroAt', to: chasse.id }, who2);
const after = R.bldRate(vh, chasse, vh.t).viande;
ok(Math.abs(after / before - 1.25) < 1e-9, 'une elfe au pavillon de chasse : +25 %');
ok(!R.applyV(R.clone(vh), { type: 'heroAt', to: chasse.id }, who).ok, 'un seul héros par bâtiment');
ok(R.RACE_KEYS.length === 6 && R.CLASS_KEYS.length === 8 && R.CLASS_KEYS.every(k => R.CLASSES[k].skills.length === 3 && R.CLASSES[k].passives.length === 2 && R.CLASSES[k].specs.length === 2), '6 races et 8 classes, chacune avec 3 compétences, 2 passifs, 2 spécialisations');
/* Plusieurs héros : un emplacement de plus par niveau de taverne */
vh.b.push({ id: vh.nid++, type: 'taverne', lvl: 1, gx: 18, gz: 2, up: null });
ok(R.heroSlots(vh) === 2, 'taverne niveau 1 : 2 emplacements de héros');
r = R.applyV(vh, { type: 'hero', name: 'Grosh', race: 'orque', cls: 'necro', sex: 'm' }, who);
ok(r.ok && R.heroesOf(vh, 'u1').length === 2 && R.activeHero(vh, 'u1').name === 'Brokk', 'deuxième héros (orque nécromancien), Brokk reste le héros actif');
ok(!R.applyV(R.clone(vh), { type: 'hero', name: 'Trois', race: 'halfelin', cls: 'voleur' }, who).ok, 'pas de troisième héros avec une taverne niveau 1');
ok(R.applyV(vh, { type: 'heroAct', hid: r.id }, who).ok && R.activeHero(vh, 'u1').name === 'Grosh', 'Grosh devient le héros actif');
ok(!R.applyV(R.clone(vh), { type: 'heroAct', hid: r.id }, who2).ok, 'on ne prend pas le héros de l’autre');
const buch = vh.b.find(x => x.type === 'bucheron'), b0 = R.bldRate(vh, buch, vh.t).bois;
ok(R.applyV(vh, { type: 'heroAt', hid: r.id, to: buch.id }, who).ok && Math.abs(R.bldRate(vh, buch, vh.t).bois / b0 - 1.25) < 1e-9, 'un orque à la cabane de bûcheron : +25 %');

/* 10. Fête */
ok(!R.applyV(R.clone(v), { type: 'feast' }, who).ok, 'pas de fête sans taverne');

/* 11. Objectifs du village */
let vg = R.clone(v);
ok(R.goalsOf(vg).map(g => g.id).join(',') === 'carriere,maisons,accueil', 'trois premiers objectifs : carrière, maisons, voyageur');
ok(!R.applyV(R.clone(vg), { type: 'claim', id: 'carriere' }, who).ok, 'pas de récompense avant d’avoir atteint l’objectif');
ok(!R.applyV(R.clone(vg), { type: 'claim', id: 'halle2' }, who).ok, 'pas de récompense pour un objectif pas encore affiché');
const sp = R.freeSpot(vg, 'carriere'); R.applyV(vg, { type: 'build', b: 'carriere', gx: sp[0], gz: sp[1] }, who);
R.simulateVillage(vg, vg.t + 3 * H);
ok(R.goalDone(vg, R.goalsOf(vg)[0]), 'objectif « Une carrière » atteint quand elle est construite');
const bois1 = vg.r.bois;
r = R.applyV(vg, { type: 'claim', id: 'carriere' }, who);
ok(r.ok && Math.round(vg.r.bois - bois1) === 60 && vg.log.some(l => l.k === 'goal'), 'récompense : +60 bois, notée au journal');
ok(R.goalsOf(vg).map(g => g.id).join(',') === 'maisons,accueil,halle2', 'l’objectif suivant apparaît (halle niveau 2)');
const bois2 = vg.r.bois;
ok(R.applyV(vg, { type: 'claim', id: 'carriere' }, who2).ok && vg.r.bois === bois2, 'récompense prise une seule fois, même si les deux joueurs appuient');

/* 12. Bière : orge dans un champ, brasserie, bière servie à la taverne */
let vb = R.clone(v);
vb.b.find(x => x.type === 'halle').lvl = 2;
ok(R.applyV(vb, { type: 'crop', id: vb.b.find(x => x.type === 'champ').id, c: 'orge' }, who).ok, 'on sème de l’orge dans le champ');
ok(!R.applyV(R.clone(vb), { type: 'crop', id: vb.b.find(x => x.type === 'halle').id, c: 'orge' }, who).ok, 'pas de culture ailleurs que dans un champ');
for (const [type, gx, gz] of [['brasserie', 2, 2], ['taverne', 18, 2]]) vb.b.push({ id: vb.nid++, type, lvl: 1, gx, gz, up: null });
const brass = vb.b.find(x => x.type === 'brasserie'), brewer = vb.vil.find(p => p.job === 'bat');
ok(R.applyV(vb, { type: 'job', vid: brewer.id, to: brass.id }, who).ok, 'un villageois devient brasseur');
const ble0 = vb.r.ble;
R.simulateVillage(vb, vb.t + 6 * H);
ok(vb.r.ble === ble0 && vb.r.biere > 1, 'le champ donne de l’orge, la brasserie en fait de la bière (' + vb.r.biere.toFixed(1) + ')');
ok(R.moraleParts(vb, vb.t).some(p => p[0] === 'Bière à la taverne'), 'bière à la taverne : le moral monte');
const nb = R.clone(vb); nb.b.find(x => x.type === 'brasserie').lvl = 1; for (const p of nb.vil) if (p.job === brass.id) p.job = null;
const beer0 = nb.r.biere; R.simulateVillage(nb, nb.t + 2 * H);
ok(nb.r.biere < beer0, 'les villageois boivent la bière (' + beer0.toFixed(1) + ' → ' + nb.r.biere.toFixed(1) + ')');
const vfe = R.clone(vb); vfe.r.pain = 100; vfe.r.viande = 100; vfe.r.biere = 0;
ok(!R.applyV(vfe, { type: 'feast' }, who).ok, 'pas de fête sans bière');
vfe.r.biere = 50;
ok(R.applyV(vfe, { type: 'feast' }, who).ok && vfe.cnt.fete === 1, 'fête avec de la bière, comptée pour les objectifs');

/* 13. Hiver sans famine (ou pas) */
let vh1 = R.clone(v); vh1.r.pain = 3000; vh1.r.viande = 3000; vh1.r.bois = 3000;
R.simulateVillage(vh1, T0 + 8 * D + H);
ok(vh1.cnt.win === 1 && vh1.log.some(l => /sans famine/.test(l.m)), 'un hiver passé sans famine est compté');
ok(vh1.r.bois >= 3000, 'les maisons ne brûlent plus de bois en hiver (' + Math.round(vh1.r.bois) + ')');
let vh2 = R.clone(v); vh2.r.pain = 3000; vh2.r.viande = 3000;
R.simulateVillage(vh2, T0 + 6 * D + 2 * H); vh2.r.pain = 0; vh2.r.viande = 0; for (const p of vh2.vil) if (p.job === vh2.b.find(x => x.type === 'chasse').id) p.job = null;
R.simulateVillage(vh2, T0 + 6 * D + 4 * H); vh2.r.pain = 3000;
R.simulateVillage(vh2, T0 + 8 * D + H);
ok(vh2.cnt.win === 0, 'un hiver avec famine ne compte pas');

/* 15. Retour de donjon : expérience, niveaux, points de compétence, butin, prisonnier */
{
  const vd = R.clone(vh), hid = R.activeHero(vd, 'u1').id;          // Grosh, orque nécromancien niveau 1
  const r1 = R.applyV(vd, { type: 'djEnd', hid, lvl: 1, win: true, xp: 450, loot: { pierre: 90, bois: 60 }, pris: false }, who);
  const g = vd.heroes[hid];
  ok(r1.ok && g.lvl === 3 && g.sp === 2 && g.dj === 2, 'victoire au niveau 1 : +450 d’expérience → niveau 3, 2 points de compétence, niveau 2 du donjon ouvert');
  ok(vd.log.slice(-1)[0].m.includes('passe au niveau 3'), 'le journal raconte le retour de donjon');
  const p0 = vd.r.pierre; R.applyV(vd, { type: 'djEnd', hid, lvl: 1, win: false, xp: 10, loot: { pierre: 99999 } }, who);
  ok(vd.r.pierre <= Math.max(R.capOf(vd), p0) && g.dj === 2, 'le butin ne dépasse pas les réserves ; une défaite n’ouvre pas de niveau');
  ok(!R.applyV(R.clone(vd), { type: 'djEnd', hid, lvl: 1, win: true, xp: 10 }, who2).ok, 'on ne déclare pas le donjon du héros de l’autre');
  const c0 = vd.cands.length; const r2 = R.applyV(vd, { type: 'djEnd', hid, lvl: 2, win: true, xp: 100, pris: true }, who);
  const pr = vd.cands.find(c => c.pris);
  ok(r2.ok && vd.cands.length === c0 + 1 && pr && Math.max(...Object.values(pr.st)) >= 9 && Math.min(...Object.values(pr.st)) >= 5, 'prisonnier délivré : un villageois doué (' + pr.name + ', meilleure note ' + Math.max(...Object.values(pr.st)) + ')');
  ok(R.applyV(vd, { type: 'skill', hid, i: 0 }, who).ok && g.sk.s0 === 1 && g.sp === 1, 'un point dans la 1re compétence : rang 2');
  ok(!R.applyV(R.clone(vd), { type: 'skill', hid, i: 2 }, who).ok, 'pas de point dans une compétence encore fermée (niveau 5)');
  R.applyV(vd, { type: 'skill', hid, i: 1 }, who);
  ok(!R.applyV(R.clone(vd), { type: 'skill', hid, i: 0 }, who).ok && g.sp === 0, 'plus de point : refusé');
  ok(!R.applyV(R.clone(vd), { type: 'spec', hid, s: 1 }, who).ok, 'pas de spécialisation avant le niveau 10');
  g.lvl = 10; ok(R.applyV(vd, { type: 'spec', hid, s: 1 }, who).ok && g.spec === 1 && !R.applyV(R.clone(vd), { type: 'spec', hid, s: 0 }, who).ok, 'spécialisation au niveau 10, une seule fois');
  const hb = R.clone(vh), hh = Object.values(hb.heroes).find(x => x.race === 'nain');
  hh.xp = 0; R.applyV(hb, { type: 'djEnd', hid: hh.id, lvl: 1, win: true, xp: 99999 }, who);
  ok(hh.lvl < 10, 'garde-fou : une expérience absurde est plafonnée (niveau ' + hh.lvl + ')');
  const hu = R.clone(vh); R.applyV(hu, { type: 'hero', name: 'Hu', race: 'humain', cls: 'pretre' }, who2);
  const hum = Object.values(hu.heroes).find(x => x.name === 'Hu'); R.applyV(hu, { type: 'djEnd', hid: hum.id, lvl: 1, win: false, xp: 50 }, who2);
  ok(hum.xp === 55, 'humain : +10 % d’expérience (50 → ' + hum.xp + ')');
  /* Profondeurs : record d'étages, pas de niveau de donjon ouvert, plafond d'expérience qui grandit avec les étages */
  const vp = R.clone(vh), gp = vp.heroes[R.activeHero(vp, 'u1').id], dj0 = gp.dj || 1;
  const rp = R.applyV(vp, { type: 'djEnd', hid: gp.id, lvl: 4, win: true, xp: 900, loot: { pierre: 40 }, theme: 'prof', deep: 4 }, who);
  ok(rp.ok && gp.deep === 4 && (gp.dj || 1) === dj0 && vp.log.slice(-1)[0].m.includes('remonte des Profondeurs (4 étages terminés)'), 'Profondeurs : record de 4 étages, aucun niveau de donjon ouvert, le journal le raconte');
  R.applyV(vp, { type: 'djEnd', hid: gp.id, lvl: 4, win: false, xp: 10, theme: 'prof', deep: 2 }, who);
  ok(gp.deep === 4 && vp.log.slice(-1)[0].m.includes('a dû fuir les Profondeurs (2 étages terminés)'), 'un moins bon résultat ne baisse pas le record');
  const c1 = R.clone(vh), g1 = c1.heroes[R.activeHero(c1, 'u1').id]; g1.lvl = 1; g1.xp = 0;
  const c2 = R.clone(vh), g2 = c2.heroes[R.activeHero(c2, 'u1').id]; g2.lvl = 1; g2.xp = 0;
  const x1 = R.applyV(c1, { type: 'djEnd', hid: g1.id, lvl: 1, win: true, xp: 99999, theme: 'prof', deep: 0 }, who).xp, x2 = R.applyV(c2, { type: 'djEnd', hid: g2.id, lvl: 1, win: true, xp: 99999, theme: 'prof', deep: 3 }, who).xp;
  ok(x2 === x1 * 4, 'plafond d’expérience des Profondeurs : ×(1 + étages) (' + x1 + ' → ' + x2 + ')');
}

/* 16. Équipement : objets, sac, forge, marchand, familier */
{
  const R1 = R.mulberry32(42), R2 = R.mulberry32(42);
  const i1 = R.genItem(R1, { il: 5, src: 'chest', cls: 'guerrier' }), i2 = R.genItem(R2, { il: 5, src: 'chest', cls: 'guerrier' });
  ok(JSON.stringify(i1) === JSON.stringify(i2) && JSON.stringify(R.itemInfo(i1)) === JSON.stringify(R.itemInfo(R.cleanItem(JSON.parse(JSON.stringify(i1))))), 'même tirage = même objet ; ses bonus se recalculent à l’identique');
  const cnt = [0, 0, 0, 0, 0], RR = R.mulberry32(7);
  for (let i = 0; i < 4000; i++) cnt[R.rollRarity(RR, R.DROP.chest, 1)]++;
  ok(cnt[0] > 1700 && cnt[0] < 2300 && cnt[4] < 60 && cnt[4] > 0, 'raretés des coffres au niveau 1 : ' + cnt.join(' / ') + ' sur 4000');
  const hi = [0, 0, 0, 0, 0]; for (let i = 0; i < 4000; i++) hi[R.rollRarity(RR, R.DROP.chest, 10)]++;
  ok(hi[2] + hi[3] + hi[4] > cnt[2] + cnt[3] + cnt[4], 'meilleures chances dans les donjons plus hauts (rare et mieux : ' + (cnt[2] + cnt[3] + cnt[4]) + ' → ' + (hi[2] + hi[3] + hi[4]) + ')');
  const leg = R.genItem(R.mulberry32(3), { il: 10, r: 4, sl: 'arme', cls: 'mage' }), L = R.itemInfo(leg);
  ok(leg.pw && R.POWERS[leg.pw].sl === 'arme' && Object.keys(L.af).length === 3 && L.so === 2 && ['baton', 'grimoire'].includes(leg.k) && /«/.test(L.name), 'légendaire : un pouvoir, 3 bonus, 2 pierres, une arme de mage (' + L.name + ')');
  const com = R.itemInfo(R.genItem(R.mulberry32(5), { il: 1, r: 0, sl: 'arme', cls: 'guerrier' }));
  ok(com.main.dmg >= 2.5 && com.main.dmg <= 3.1 && !Object.keys(com.af).length && com.so === 0, 'arme commune niveau 1 : +' + com.main.dmg + ' % de dégâts, sans bonus');
  const setp = R.genItem(R.mulberry32(9), { il: 4, src: 'boss', set: 'troll', cls: 'guerrier' });
  ok(setp.set === 'troll' && setp.r === 3 && setp.sl !== 'bijou' && /Chef troll/.test(R.itemInfo(setp).name), 'pièce d’ensemble : ' + R.itemInfo(setp).name);
  ok(!R.cleanItem({ sl: 'chapeau' }) && R.cleanItem({ sl: 'arme', k: 'lance', r: 9, il: 999, sd: 1 }).r === 4 && R.cleanItem({ sl: 'arme', r: 2, il: 999, sd: 1 }, 7).il === 7, 'un objet reçu est remis dans les limites (rareté, niveau, sorte)');
  /* le sac, équiper, comparer */
  const ve = R.clone(vh), brokk = Object.values(ve.heroes).find(x => x.name === 'Brokk'), aelith = Object.values(ve.heroes).find(x => x.name === 'Aelith');
  const it = (sl, r, il, k, extra) => Object.assign({ sl, k, r, il, sd: 1000 + sl.length * 7 + r * 13 + il }, extra || {});
  let res = R.applyV(ve, { type: 'djEnd', hid: brokk.id, lvl: 3, win: true, xp: 10, or: 150, items: [it('arme', 2, 3, 'hache'), it('arme', 0, 1, 'epee'), it('bijou', 1, 2, 'anneau'), it('arme', 3, 3, 'arc'), it('casque', 1, 3, 'heaume')], gems: { rubis1: 2, topaze1: 1, xx: 5 } }, who);
  const bag = ve.bag.u1, ids = Object.keys(bag.it);
  ok(res.ok && res.items === 5 && ids.length === 5 && bag.gm.rubis1 === 2 && !bag.gm.xx && ve.r.or === 150, 'retour de donjon : 5 objets et 3 pierres dans le sac de Téo, 150 or dans la bourse commune');
  const axe = ids.find(k => bag.it[k].k === 'hache'), bow = ids.find(k => bag.it[k].k === 'arc'), ring = ids.find(k => bag.it[k].sl === 'bijou'), oldSword = ids.find(k => bag.it[k].k === 'epee');
  ok(!R.applyV(R.clone(ve), { type: 'equip', hid: brokk.id, id: bow }, who).ok && !R.applyV(R.clone(ve), { type: 'equip', hid: brokk.id, id: ring }, who).ok, 'un guerrier ne prend pas d’arc ; pas de bijou avant le niveau 8');
  ok(!R.applyV(R.clone(ve), { type: 'equip', hid: aelith.id, id: axe }, who).ok, 'on n’équipe pas le héros de l’autre');
  brokk.lvl = 3;
  ok(R.applyV(ve, { type: 'equip', hid: brokk.id, id: oldSword }, who).ok && brokk.eq.arme.k === 'epee', 'Brokk prend l’épée commune');
  ok(R.compareItem(brokk, bag.it[axe]) === 1, 'la hache rare est marquée « mieux » (▲)');
  ok(R.applyV(ve, { type: 'equip', hid: brokk.id, id: axe }, who).ok && brokk.eq.arme.k === 'hache' && Object.values(bag.it).some(x => x.k === 'epee'), 'il prend la hache : l’épée retourne dans le sac');
  const g0 = R.gearOf(brokk);
  ok(g0.dmg > 0 && g0.crit + g0.haste + g0.leech + g0.skill + g0.cdr > 0, 'ce que donne l’équipement : +' + g0.dmg + ' % de dégâts et ses bonus');
  /* vendre, fondre, forger, améliorer, sertir, fusionner */
  const or0 = ve.r.or, sword = Object.keys(bag.it).find(k => bag.it[k].k === 'epee'), sv = R.itemInfo(bag.it[sword]).sell;
  ok(R.applyV(ve, { type: 'sell', ids: [sword] }, who).ok && ve.r.or === or0 + sv && !bag.it[sword], 'vendre l’épée : +' + sv + ' or');
  ok(!R.applyV(R.clone(ve), { type: 'melt', ids: [ring] }, who).ok && !R.applyV(R.clone(ve), { type: 'craft', sl: 'casque', hid: brokk.id }, who).ok, 'sans forge : pas de fonte ni de fabrication');
  ve.b.find(x => x.type === 'halle').lvl = 2;
  ve.b.push({ id: ve.nid++, type: 'forge', lvl: 1, gx: 2, gz: 2, up: null });
  ok(R.forgeLvlOf(ve) === 1 && R.bagMax(ve) === 40, 'forge niveau 1 : sacs de 40 places');
  ok(!R.applyV(R.clone(ve), { type: 'craft', sl: 'casque', hid: brokk.id }, who).ok, 'forger demande du fer');
  ve.r.fer = 500; ve.r.bois = 500; ve.r.or = 1000;
  const fer0 = ve.r.fer; res = R.applyV(ve, { type: 'melt', ids: [ring] }, who);
  ok(res.ok && ve.r.fer > fer0 && !bag.it[ring], 'fondre l’anneau : +' + res.gain + ' fer');
  const c0 = R.craftCost(brokk.lvl), b1 = Object.keys(bag.it).length, ferB = ve.r.fer, orB = ve.r.or; res = R.applyV(ve, { type: 'craft', sl: 'casque', hid: brokk.id }, who);
  const made = bag.it[res.id];
  ok(res.ok && Object.keys(bag.it).length === b1 + 1 && made.sl === 'casque' && made.il === brokk.lvl && made.r <= 2 && ve.r.fer === ferB - c0.fer && ve.r.or === orB - c0.or, 'la forge fabrique un casque de niveau ' + made.il + ' (' + R.RARITY[made.r].name.toLowerCase() + ') pour ' + c0.fer + ' fer, ' + c0.bois + ' bois et ' + c0.or + ' or');
  const twin = R.clone(R.clone(ve)); // même compteur du sac : le même objet sortirait (pas de surprise après l'envoi au serveur)
  ok(JSON.stringify(R.applyV(R.clone(ve), { type: 'craft', sl: 'bottes', hid: brokk.id }, who)) === JSON.stringify(R.applyV(twin, { type: 'craft', sl: 'bottes', hid: brokk.id }, who)), 'fabrication rejouée sur le serveur : le même objet');
  const ax0 = R.itemInfo(brokk.eq.arme).main.dmg;
  for (let k = 0; k < 3; k++) R.applyV(ve, { type: 'improve', hid: brokk.id, sl: 'arme' }, who);
  ok(brokk.eq.arme.up === 3 && R.itemInfo(brokk.eq.arme).main.dmg > ax0 * 1.25 && !R.applyV(R.clone(ve), { type: 'improve', hid: brokk.id, sl: 'arme' }, who).ok, 'améliorée +3 (+30 % sur ses bonus principaux), +4 demande une forge plus grande');
  ok(R.applyV(ve, { type: 'socket', hid: brokk.id, sl: 'arme', s: 0, g: 'topaze1' }, who).ok && brokk.eq.arme.gm.g0 === 'topaze1' && !bag.gm.topaze1, 'topaze sertie dans la hache');
  const gs = R.gearOf(brokk).dmg;
  ok(R.applyV(ve, { type: 'unsocket', hid: brokk.id, sl: 'arme', s: 0 }, who).ok && bag.gm.topaze1 === 1 && R.gearOf(brokk).dmg < gs, 'retirée : elle revient dans le sac');
  bag.gm.rubis1 = 3;
  ok(!R.applyV(R.clone(ve), { type: 'fuse', g: 'rubis1' }, who).ok, 'fusion : il faut une forge de niveau 2');
  ve.b.find(x => x.type === 'forge').lvl = 2;
  ok(R.applyV(ve, { type: 'fuse', g: 'rubis1' }, who).ok && bag.gm.rubis2 === 1 && !bag.gm.rubis1, '3 éclats de rubis → 1 rubis');
  /* ensembles et plafonds */
  const hs = { lvl: 10, cls: 'guerrier', eq: {} };
  for (const sl of ['arme', 'casque', 'armure', 'bottes']) hs.eq[sl] = R.genItem(R.mulberry32(sl.length), { il: 8, set: 'abime', sl, cls: 'guerrier' });
  const gsx = R.gearOf(hs);
  ok(gsx.sets.abime === 4 && gsx.set4.abime && gsx.potX === 1 && gsx.potion >= 30, 'panoplie de l’abîme complète : bonus à 2 et 4 pièces (une potion de plus)');
  const hcap = { lvl: 10, cls: 'voleur', eq: {} };
  for (const sl of R.SLOTS) hcap.eq[sl] = Object.assign(R.genItem(R.mulberry32(99 + sl.length), { il: 60, r: 4, sl, cls: 'voleur' }), { gm: { g0: 'emeraude3', g1: 'emeraude3' } });
  ok(R.gearOf(hcap).crit <= 30, 'plafond : pas plus de +30 % de coups critiques par l’équipement');
  /* sac plein */
  const vf2 = R.clone(ve); vf2.b = vf2.b.filter(x => x.type !== 'forge');
  for (let k = Object.keys(vf2.bag.u1.it).length; k < 30; k++) vf2.bag.u1.it['z' + k] = it('bottes', 0, 1, 'bottes');
  const orf = vf2.r.or; res = R.applyV(vf2, { type: 'djEnd', hid: brokk.id, lvl: 1, win: true, xp: 1, items: [it('casque', 0, 1, 'casque')] }, who);
  ok(res.ok && res.autoSold === 1 && vf2.r.or > orf && vf2.log.slice(-1)[0].m.includes('Sac plein'), 'sac plein : l’objet en trop est vendu (+' + res.autoGold + ' or)');
  /* le marchand ambulant : un jour sur deux */
  const vm = R.clone(ve);
  R.simulateVillage(vm, vm.born + 1 * D + 2 * H);
  ok(R.merchHere(vm, vm.t) && vm.merch.it.length === 4 && vm.merch.gm.length === 2 && vm.log.some(l => l.k === 'merch'), 'le 2e jour, le marchand s’installe (4 objets, 2 pierres)');
  vm.r.or = 5000;
  res = R.applyV(vm, { type: 'buy', i: 0 }, who);
  ok(res.ok && Object.values(vm.bag.u1.it).some(x => x.sd === vm.merch.it[0].sd) && !R.applyV(R.clone(vm), { type: 'buy', i: 0 }, who2).ok, 'on achète son premier objet ; il n’est vendu qu’une fois');
  ok(R.applyV(vm, { type: 'buy', g: 1 }, who2).ok && Object.keys(vm.bag.u2.gm).length === 1, 'Léa lui achète une pierre (rangée dans son sac à elle)');
  R.simulateVillage(vm, vm.born + 2 * D + H);
  ok(!R.merchHere(vm, vm.t) && !R.applyV(R.clone(vm), { type: 'buy', i: 1 }, who).ok, 'le lendemain, il est reparti');
  /* familier */
  ok(!R.applyV(R.clone(ve), { type: 'pet', hid: brokk.id, p: 'faucon' }, who).ok, 'pas de familier avant le niveau 6');
  brokk.lvl = 6;
  ok(R.applyV(ve, { type: 'pet', hid: brokk.id, p: 'faucon' }, who).ok && brokk.pet === 'faucon' && !R.applyV(R.clone(ve), { type: 'pet', hid: brokk.id, p: 'dragon' }, who).ok, 'au niveau 6, Brokk choisit un faucon');
  /* fer : la mine de fer */
  const vi = R.clone(ve); vi.b.push({ id: vi.nid++, type: 'mine', lvl: 1, gx: 18, gz: 18, up: null });
  const miner = vi.vil.find(p => p.job === 'bat'); R.applyV(vi, { type: 'job', vid: miner.id, to: vi.b[vi.b.length - 1].id }, who);
  const fi = vi.r.fer; R.simulateVillage(vi, vi.t + 5 * H);
  ok(vi.r.fer > fi + 10, 'un mineur à la mine de fer : +' + Math.round(vi.r.fer - fi) + ' fer en 5 heures');
  const nv = R.newVillage('vnew', 'Neuf', '#D27A22', T0, 'u9', 'X');
  ok(nv.r.fer === 0 && nv.r.or === 0 && R.goalsOf(nv).length === 3, 'nouveau village : fer et or à zéro');
}

/* 14. Rapidité : simuler 3 jours */
const t0 = Date.now(); R.simulateVillage(R.clone(v3), v3.t + 3 * D); const ms = Date.now() - t0;
ok(ms < 1500, 'simulation de 3 jours en ' + ms + ' ms');
console.log(JSON.stringify(v3).length + ' octets pour un village de ' + v3.vil.length + ' villageois');
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
