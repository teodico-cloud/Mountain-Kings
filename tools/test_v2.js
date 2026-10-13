/* Essais des règles du nouveau jeu (village commun). Usage : node tools/test_v2.js */
const fs = require('fs'), path = require('path');
const src = ['p0_fb.js', 'p2_rules.js', 'p2e_equip.js', 'p2g_garnison.js', 'p2r_raid.js', 'p2s_histoire.js'].map(f => fs.readFileSync(path.join(__dirname, '../src2/' + f), 'utf8')).join('\n');
const R = new Function(src + '\nreturn { normVillage, solList, solStats, solCap, postCap, postsOf, guardsOf, solHurt, solXpNeed, recruitCost, promoteCost, solEat, solFood, solTitle, solName, orbOf, orbAdd, banAdd, banOk, garLoot, solFormation, raidGuards, SOLDIERS, ORB_LVLS, ORBS, BANNERS, SOL_SETS, POST_SLOTS, limitV, caserneLvl, VERSION, BLD, RES, SEASONS, SPEC, GOALS, FEAST, RACES, CLASSES, RACE_KEYS, CLASS_KEYS, heroSlots, heroesOf, activeHero, newVillage, simulateVillage, applyV, ratesOf, moraleOf, moraleParts, seasonIdx, capOf, housingOf, freeHousing, costOf, workOf, hallLvl, workersOf, builders, foodOf, clone, freeSpot, bldRate, goalsOf, goalProg, goalDone, genItem, cleanItem, itemInfo, canWear, gearOf, compareItem, bagOf, bagMax, mulberry32, merchHere, merchDay, RARITY, SETS, POWERS, GEMS, gemOf, craftCost, improveCost, SLOTS, DROP, rollRarity, forgeLvlOf, hpOf, hpMaxOf, repairCostOf, raidTick, raidInput, raidStart, raidStep, raidResult, raidReplay, raidInfo, raidLevel, raidClosePortal, raidField, raidFoeStep, raidHurtFoe, RAID_FIRST, RAID_CHARGE, RAID_AWAY, RAID_FOES, limitOf, fits, lilouTick, lilouArrive, lilouMood, lilouMul, capCost, CAPRICES, BIG_CAPRICES, LILOU, LILOU_MOODS, DAY, crownCan, crownNeed, crownBits, crownRaidOn, CROWN_DELAY, CROWN_FEAR, CROWN_LETTERS, chronInit, raidApply };')();
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
let vh1 = R.clone(v); vh1.r.pain = 3000; vh1.r.viande = 3000; vh1.r.bois = 3000; vh1.raid = { n: 0, next: 9e15 };   // pas de raid ici : on ne regarde que l'hiver
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
  const r1 = R.applyV(vd, { type: 'djEnd', hid, lvl: 1, win: true, xp: 900, loot: { pierre: 90, bois: 60 }, pris: false }, who);
  const g = vd.heroes[hid];
  ok(r1.ok && g.lvl === 3 && g.sp === 2 && g.dj === 2, 'victoire au niveau 1 : +900 d’expérience → niveau 3, 2 points de compétence, niveau 2 du donjon ouvert');
  ok(vd.log.slice(-2).some(l => l.m.includes('passe au niveau 3')), 'le journal raconte le retour de donjon');
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
  ok(rp.ok && gp.deep === 4 && (gp.dj || 1) === dj0 && vp.log.slice(-2).some(l => l.m.includes('remonte des Profondeurs (4 étages terminés)')), 'Profondeurs : record de 4 étages, aucun niveau de donjon ouvert, le journal le raconte');
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

/* 17. Défense : palissades, portes, tours, pièges ; portails et raids */
{
  const vd = R.newVillage('vdef', 'Fort-Brume', '#D27A22', T0, 'u1', 'Téo');
  vd.members.u2 = { name: 'Léa', t: T0, hi: 1 };
  vd.r.bois = 2000; vd.r.pierre = 2000; vd.r.fer = 200;
  ok(JSON.stringify(R.costOf('rempart', 1)) === '{"bois":8}' && JSON.stringify(R.costOf('rempart', 3)) === '{"pierre":20,"fer":5}', 'prix des palissades par niveau (bois, puis pierre, puis pierre et fer)');
  /* une ligne de palissades, d'un coup */
  const tiles = []; for (let x = 4; x <= 9; x++) tiles.push([x, 4]);
  let r = R.applyV(vd, { type: 'walls', tiles }, who);
  ok(r.ok && r.n === 6 && vd.b.filter(b => b.type === 'rempart').length === 6 && vd.r.bois === 2000 - 48, 'une ligne de 6 palissades posée tout de suite (48 bois)');
  r = R.applyV(vd, { type: 'walls', tiles: [[4, 4], [10, 4]] }, who);
  ok(r.ok && r.n === 1 && r.why, 'une case déjà prise est sautée');
  ok(!R.applyV(R.clone(vd), { type: 'walls', tiles: [[0, 0]] }, who).ok, 'pas de palissade au bord de la vallée');
  const lim = R.limitOf('rempart', 1), many = []; for (let i = 0; i < 40; i++) many.push([3 + (i % 18), 20 + Math.floor(i / 18)]);
  r = R.applyV(R.clone(vd), { type: 'walls', tiles: many }, who);
  ok(r.ok && r.n === lim - 7 && /agrandissez la halle/.test(r.why), 'au plus ' + lim + ' palissades avec la halle niveau 1');
  /* porte, amélioration de toutes les palissades, piège, tour */
  const w1 = vd.b.find(b => b.type === 'rempart' && b.gx === 6);
  ok(R.applyV(vd, { type: 'gate', id: w1.id }, who).ok && w1.type === 'porte' && w1.lvl === 1, 'une palissade devient une porte');
  r = R.applyV(vd, { type: 'upwalls', t: 'rempart', lvl: 1 }, who);
  ok(r.ok && r.n === 6 && vd.b.filter(b => b.type === 'rempart').every(b => b.lvl === 2), 'toutes les palissades passent en mur de pierre');
  ok(!R.applyV(R.clone(vd), { type: 'upwalls', t: 'rempart', lvl: 2 }, who).ok, 'mur renforcé : il faut une halle plus grande');
  r = R.applyV(vd, { type: 'build', b: 'piege', gx: 12, gz: 16 }, who);
  ok(r.ok && r.inst && vd.b.find(b => b.id === r.id).lvl === 1, 'piège posé tout de suite');
  const tsp = R.freeSpot(vd, 'tour', 15, 4); r = R.applyV(vd, { type: 'build', b: 'tour', gx: tsp[0], gz: tsp[1] }, who);
  const tour = vd.b.find(b => b.id === r.id);
  ok(r.ok && !r.inst && tour.lvl === 0 && tour.up, 'la tour d’archers, elle, se construit');
  R.simulateVillage(vd, vd.t + 3 * H);
  ok(tour.lvl === 1, 'tour terminée');
  /* dégâts et réparation */
  const w2 = vd.b.find(b => b.type === 'rempart'); w2.hp = 0; const w3 = vd.b.filter(b => b.type === 'rempart')[1]; w3.hp = 250;
  const rc = R.repairCostOf(w2), p0 = vd.r.pierre;
  r = R.applyV(vd, { type: 'repair' }, who);
  ok(r.ok && r.n === 2 && w2.hp == null && w3.hp == null && vd.r.pierre < p0 && rc.pierre === Math.ceil(14 * 0.6), 'réparation : la ruine et le mur abîmé (' + (p0 - vd.r.pierre) + ' pierre)');
  ok(!R.applyV(R.clone(vd), { type: 'repair' }, who).ok, 'rien à réparer ensuite');

  /* calendrier des portails */
  const vc = R.newVillage('vcal', 'Val', '#D27A22', T0, 'u1', 'Téo');
  vc.members.u2 = { name: 'Léa', t: T0, hi: 1 };
  ok(vc.raid.next === T0 + 2 * D && !vc.raid.p, 'premier portail prévu au début du 3e jour');
  R.simulateVillage(vc, T0 + 2 * D - 5 * 60000);
  ok(!vc.raid.p && !vc.lastRaid, 'rien avant le 3e jour');
  R.simulateVillage(vc, T0 + 2 * D + 60000);
  ok(vc.raid.p && vc.raid.p.length === 1 && vc.log.some(l => l.k === 'portal'), 'le 3e jour, un portail s’ouvre (halle niveau 1) : ' + vc.log.filter(l => l.k === 'portal').slice(-1)[0].m);
  ok(R.raidInfo(vc, vc.t).st === 'charge', 'il se charge');
  /* quelqu'un est là : pas de raid, même portail chargé */
  let tt = vc.t;
  for (let i = 0; i < 18; i++) { tt += 20 * 60000; R.simulateVillage(vc, tt); R.applyV(vc, { type: 'sync' }, i % 2 ? who : who2); }
  ok(!vc.lastRaid && vc.raid.p && R.raidInfo(vc, vc.t).st === 'ready' && vc.log.some(l => /chargé/.test(l.m)), 'portail chargé, mais un joueur est là toutes les 20 minutes : pas de raid');
  const absent = vc.t;
  R.simulateVillage(vc, absent + 2 * H - 2 * 60000);
  ok(!vc.lastRaid, 'pas encore de raid après 1 h 58 d’absence');
  R.simulateVillage(vc, absent + 2 * H + 2 * 60000);
  ok(vc.lastRaid && !vc.raid.p && vc.raid.n === 1 && vc.log.some(l => l.k === 'raid'), 'après 2 h d’absence des deux : le raid (' + vc.log.filter(l => l.k === 'raid')[0].m + ')');
  const lr = vc.lastRaid;
  ok(vc.raid.next >= lr.t + 20 * H && vc.raid.next <= lr.t + 28 * H, 'portail suivant dans ' + Math.round((vc.raid.next - lr.t) / H) + ' h (au plus un raid par jour)');
  ok(lr.F.length === 4 && lr.F.filter(f => f[0] === 'voleur').length === 1, 'premier raid, doux : 3 gobelins et 1 voleur');
  /* rediffusion : le même combat, même après un aller-retour par la base de données */
  const rep = st => { let n = 0; while (!st.over && n++ < 4000) { R.raidStep(st); st.ev.length = 0; } return R.raidResult(st); };
  const back = JSON.parse(JSON.stringify(lr));
  ok(JSON.stringify(rep(R.raidReplay(back))) === JSON.stringify(lr.res), 'la rediffusion rejoue exactement le même raid');
  ok(lr.res.f === 4 && lr.res.k + lr.res.e === 4, 'bilan : ' + lr.res.k + ' vaincus, ' + lr.res.e + ' enfuis, volé ' + JSON.stringify(lr.res.lost) + ', repris ' + JSON.stringify(lr.res.back));

  /* un village sans défense (sans héros) : le butin s'en va, la halle est pillée */
  const vn = R.newVillage('vnu', 'Nu', '#D27A22', T0, 'u1', 'Téo'); vn.r.bois = 1000; vn.r.pierre = 1000; vn.r.or = 300;
  vn.raid = { n: 3, next: vn.t }; R.simulateVillage(vn, vn.t + 60000);
  const bois0 = vn.r.bois, or0 = vn.r.or;
  R.simulateVillage(vn, vn.raid.at + 3 * H + 2 * 60000);
  const rn = vn.lastRaid && vn.lastRaid.res;
  ok(rn && rn.k === 0 && rn.e === rn.f && Object.keys(rn.lost).length > 0, 'sans défense : tous repartent avec du butin ' + JSON.stringify(rn && rn.lost));
  ok(rn && rn.h === 1 && vn.raidMor > vn.t && R.moraleParts(vn, vn.t).some(p => /pillée/.test(p[0])), 'la halle est pillée : moral en baisse pour un jour');
  ok(rn && rn.lost.or > 0 && vn.r.or < or0, 'le voleur file avec de l’or (' + (rn && rn.lost.or) + ')');
  ok(rn && Object.keys(rn.lost).every(k => rn.lost[k] <= Math.floor(vn.lastRaid.R[k] * 0.3)), 'jamais plus de 30 % d’une ressource');

  /* des défenseurs : deux héros de niveau 5, puis avec une tour d'archers en plus */
  const guard = tower => {
    const vg = R.newVillage('vgd', 'Garde', '#D27A22', T0, 'u1', 'Téo'); vg.members.u2 = { name: 'Léa', t: T0, hi: 1 };
    R.applyV(vg, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', sex: 'm', col: '#D27A22' }, who);
    R.applyV(vg, { type: 'hero', name: 'Aelith', race: 'elfe', cls: 'rodeur', sex: 'f', col: '#4A78C2' }, who2);
    for (const h of Object.values(vg.heroes)) h.lvl = 5;
    vg.r.bois = 800; vg.r.pierre = 800;
    if (tower) vg.b.push({ id: vg.nid++, type: 'tour', lvl: 3, gx: 12, gz: 15, up: null });
    vg.raid = { n: 3, next: vg.t }; R.simulateVillage(vg, vg.t + 60000);
    const xp0 = Object.values(vg.heroes).map(h => h.xp);
    R.simulateVillage(vg, vg.raid.at + 3 * H + 2 * 60000);
    return { vg, res: vg.lastRaid && vg.lastRaid.res, xp0 };
  };
  const g1 = guard(false), g2 = guard(true), vg = g2.vg;
  const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  ok(g1.res && g1.res.k >= 3 && g1.res.g > 0, 'deux héros de niveau 5 défendent la halle : ' + g1.res.k + ' ennemis vaincus sur ' + g1.res.f + ', +' + g1.res.g + ' or');
  ok(g2.res && g2.res.k > g1.res.k && sum(g2.res.lost) < sum(g1.res.lost), 'avec une tour d’archers en plus : ' + g2.res.k + ' vaincus, ' + sum(g2.res.lost) + ' volés au lieu de ' + sum(g1.res.lost));
  ok(Object.values(vg.heroes).every((h, i) => h.xp > g2.xp0[i] || h.lvl > 5), 'les héros gagnent de l’expérience en défendant (+' + g2.res.xp + ')');

  /* les trolls suivent les mêmes chemins mais cassent les murs 4 fois plus vite */
  ok(R.RAID_FOES.troll.wall === 4 && R.RAID_FOES.gobelin.wall === 1, 'trolls : ×4 sur les murs et les portes');
  const ring = []; const hall = vg.b.find(b => b.type === 'halle');
  for (let x = hall.gx - 2; x <= hall.gx + 4; x++) for (let z = hall.gz - 2; z <= hall.gz + 4; z++) if (x === hall.gx - 2 || x === hall.gx + 4 || z === hall.gz - 2 || z === hall.gz + 4) ring.push([x, z]);
  const inpT = { t: 0, n: 5, sd: 12345, L: 1, P: [[12, 0, 0, 0]], B: [[1, 'halle', 1, hall.gx, hall.gz, 0]].concat(ring.map((c, i) => [500 + i, 'rempart', 1, c[0], c[1], 200])), H: [], F: [['troll', 0, 0]], R: { bois: 500, pierre: 500, pain: 0, viande: 0, fer: 0, or: 0 } };
  let st = R.raidStart(inpT), firstHit = null;
  for (let i = 0; i < 3000 && !st.over && firstHit == null; i++) { R.raidStep(st); for (const S of st.S) if (S.kind === 'wall' && S.hp < 200) firstHit = 200 - S.hp; st.ev.length = 0; }
  ok(firstHit === R.RAID_FOES.troll.sdmg * 4, 'un coup de troll enlève ' + firstHit + ' à la palissade (4 × ' + R.RAID_FOES.troll.sdmg + ')');
  const resT = rep(R.raidStart(inpT));
  ok(resT.br >= 1 && resT.h === 1, 'le troll perce l’enceinte (' + resT.br + ' palissade cassée) et atteint la halle');
  const inpG = Object.assign({}, inpT, { F: [['gobelin', 0, 0]] }), resG = rep(R.raidStart(inpG));
  ok(resG.br >= 1 && resG.s > resT.s, 'un gobelin y arrive aussi, mais bien plus lentement (' + resG.s + ' s contre ' + resT.s + ' s)');
  /* une porte dans l'enceinte : les ennemis vont droit dessus (plus facile à casser), comme les trolls */
  const gi = ring.findIndex(c => c[0] === hall.gx + 1 && c[1] === hall.gz - 2);
  const inpD = Object.assign({}, inpT, { B: inpT.B.map((e, i) => i === gi + 1 ? [e[0], 'porte', 1, e[3], e[4], 150] : e) });
  let sd = R.raidStart(inpD), broke = null;
  for (let i = 0; i < 3000 && !sd.over && !broke; i++) { R.raidStep(sd); for (const e of sd.ev) if (e.k === 'break') broke = sd.S[e.si]; sd.ev.length = 0; }
  ok(broke && broke.kind === 'gate', 'le troll casse la porte plutôt que le mur');
  /* les pièges et les tours font leur travail */
  const inpP = Object.assign({}, inpT, { B: [[1, 'halle', 1, hall.gx, hall.gz, 0], [2, 'piege', 3, 12, 3, 0], [3, 'piege', 3, 12, 4, 0], [4, 'tour', 3, 14, 5, 1900]], F: [['gobelin', 0, 0], ['gobelin', 0, 0.4]] });
  const resP = rep(R.raidStart(inpP));
  ok(resP.k === 2, 'deux pièges à pointes et une tour : les deux gobelins tombent');
  /* un voleur abattu rend son butin */
  const sb = R.raidStart(Object.assign({}, inpT, { B: [[1, 'halle', 1, hall.gx, hall.gz, 0]], F: [['voleur', 0, 0]], R: { bois: 0, pierre: 0, pain: 0, viande: 0, fer: 0, or: 200 } }));
  for (let i = 0; i < 3000 && !sb.over && !sb.foes[0].loot; i++) { R.raidStep(sb); sb.ev.length = 0; }
  const thief = sb.foes[0], lootN = thief.loot ? thief.loot[1] : -1; ok(thief.loot && thief.loot[0] === 'or', 'le voleur prend de l’or (' + lootN + ')');
  R.raidHurtFoe(sb, thief, 9999);
  ok(thief.dead && sb.back.or === lootN && !sb.lost.or, 'abattu avant le portail : l’or est repris');

  /* fermer le portail avec son héros */
  const vp = R.newVillage('vpo', 'Porte', '#D27A22', T0, 'u1', 'Téo');
  R.applyV(vp, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', sex: 'm', col: '#D27A22' }, who);
  vp.raid = { n: 1, next: vp.t }; R.simulateVillage(vp, vp.t + 60000);
  const bk = Object.values(vp.heroes)[0];
  r = R.applyV(R.clone(vp), { type: 'djEnd', hid: bk.id, lvl: 1, win: false, xp: 50, theme: 'portail', pi: 0 }, who);
  ok(r.ok && !r.closed, 'défaite au portail : il reste ouvert');
  r = R.applyV(vp, { type: 'djEnd', hid: bk.id, lvl: 1, win: true, xp: 200, theme: 'portail', pi: 0 }, who);
  ok(r.ok && r.closed && r.closed.all && !vp.raid.p && vp.raid.next >= vp.t + 20 * H && bk.dj === 1, 'gardien vaincu : le portail se referme, pas de raid cette fois (le niveau des donjons ne bouge pas)');
  R.simulateVillage(vp, vp.t + 10 * H);
  ok(!vp.lastRaid, 'aucun raid ensuite');

  /* rapidité : un gros raid (halle 5, 3 portails, enceinte) */
  const vb = R.newVillage('vbig', 'Grand', '#D27A22', T0, 'u1', 'Téo');
  vb.b.find(b => b.type === 'halle').lvl = 5; vb.r.bois = 3000; vb.r.pierre = 3000;
  R.applyV(vb, { type: 'walls', tiles: ring }, who);
  vb.raid = { n: 9, next: vb.t }; R.simulateVillage(vb, vb.t + 60000);
  const tb = Date.now(); R.simulateVillage(vb, vb.raid.at + 3 * H + 2 * 60000); const mb = Date.now() - tb;
  ok(vb.lastRaid && vb.lastRaid.P.length === 3 && vb.lastRaid.F.length >= 14 && mb < 800, 'halle 5 : 3 portails, ' + (vb.lastRaid && vb.lastRaid.F.length) + ' ennemis, raid simulé (avec 3 h de village) en ' + mb + ' ms');
}

/* 18. La garnison : caserne, postes de garde, soldats, équipement, orbes, bannières ; soldats dans les raids */
{
  const vs = R.newVillage('vgar', 'Garnison', '#D27A22', T0, 'u1', 'Téo');
  vs.members.u2 = { name: 'Léa', t: T0, hi: 1 };
  vs.r.bois = 5000; vs.r.pierre = 5000; vs.r.fer = 800; vs.r.or = 2000; vs.r.viande = 900; vs.r.pain = 900;
  ok(!R.applyV(R.clone(vs), { type: 'build', b: 'caserne', gx: 3, gz: 3 }, who).ok, 'caserne : il faut la halle niveau 2');
  let r = R.applyV(R.clone(vs), { type: 'build', b: 'poste', gx: 12, gz: 5 }, who);
  ok(!r.ok && /caserne/.test(r.err), 'poste de garde : il faut d’abord la caserne (' + r.err + ')');
  ok(!R.applyV(R.clone(vs), { type: 'recruit', t: 'fant' }, who).ok, 'pas de recrue sans caserne');
  vs.b.find(b => b.type === 'halle').lvl = 2;
  const cs = R.freeSpot(vs, 'caserne', 4, 4); r = R.applyV(vs, { type: 'build', b: 'caserne', gx: cs[0], gz: cs[1] }, who);
  ok(r.ok && !r.inst, 'la caserne se construit');
  R.simulateVillage(vs, vs.t + 4 * H);
  ok(R.caserneLvl(vs) === 1 && R.solCap(vs) === 3 && R.postCap(vs) === 1, 'caserne niveau 1 : 3 soldats, 1 poste');
  r = R.applyV(vs, { type: 'build', b: 'poste', gx: 12, gz: 5 }, who);
  const p1 = vs.b.find(b => b.id === r.id);
  ok(r.ok && r.inst && p1.lvl === 1, 'un poste de garde posé tout de suite');
  r = R.applyV(R.clone(vs), { type: 'build', b: 'poste', gx: 16, gz: 5 }, who);
  ok(!r.ok && /agrandissez la caserne/.test(r.err), 'un seul poste avec la caserne niveau 1');
  /* recruter */
  const or0 = vs.r.or;
  r = R.applyV(vs, { type: 'recruit', t: 'fant' }, who);
  const s1 = vs.sol[r.id];
  ok(r.ok && vs.r.or === or0 - 40 && s1.lvl === 1 && s1.post === p1.id && /n°1$/.test(r.name), 'recrue : ' + r.name + ' pour 40 or, qui rejoint tout seul le poste');
  r = R.applyV(vs, { type: 'recruit', t: 'fant' }, who2);
  ok(r.ok && vs.r.or === or0 - 90 && vs.sol[r.id].num === 2, 'la suivante coûte 50 or : ' + r.name);
  r = R.applyV(vs, { type: 'recruit', t: 'arch' }, who);
  ok(r.ok && vs.sol[r.id].num === 1 && R.solList(vs).length === 3, 'un archer, numéroté à part : ' + r.name);
  ok(!R.applyV(R.clone(vs), { type: 'recruit', t: 'mage' }, who).ok, 'la caserne niveau 1 est pleine (3 soldats)');
  /* ils mangent */
  const rt0 = R.ratesOf(vs, vs.t);
  ok(Math.abs(R.solFood(vs) - 33) < 1e-9 && rt0.food < -(vs.vil.length + 1.3), 'les soldats mangent : 33 rations par jour à eux trois');
  /* agrandir la caserne : 2 postes, répartir */
  const cas = vs.b.find(b => b.type === 'caserne'); cas.lvl = 4;
  vs.b.find(b => b.type === 'halle').lvl = 3;
  r = R.applyV(vs, { type: 'build', b: 'poste', gx: 8, gz: 16 }, who);
  const p2 = vs.b.find(b => b.id === r.id);
  for (const t2 of ['lanc', 'mage', 'arch', 'fant', 'lanc']) R.applyV(vs, { type: 'recruit', t: t2 }, who);
  ok(R.solList(vs).length === 8, '8 soldats avec la caserne niveau 4');
  r = R.applyV(vs, { type: 'solAuto' }, who);
  const g1 = R.guardsOf(vs, p1.id), g2 = R.guardsOf(vs, p2.id);
  ok(r.ok && g1.length === 4 && g2.length === 4 && ['fant', 'arch'].every(ty => g1.some(s => s.type === ty) && g2.some(s => s.type === ty)), 'Répartir : 4 et 4, avec des fantassins et des archers à chaque poste');
  /* un poste a 6 places */
  for (const s of R.solList(vs)) R.applyV(vs, { type: 'solPost', sid: s.id, post: 0 }, who);
  for (const s of R.solList(vs).slice(0, 6)) R.applyV(vs, { type: 'solPost', sid: s.id, post: p1.id }, who);
  const s7 = R.solList(vs)[6];
  r = R.applyV(R.clone(vs), { type: 'solPost', sid: s7.id, post: p1.id }, who);
  ok(R.guardsOf(vs, p1.id).length === 6 && !r.ok && /complet/.test(r.err), 'un poste : 6 gardes au plus');
  R.applyV(vs, { type: 'solAuto' }, who);
  /* promotion */
  ok(!R.applyV(R.clone(vs), { type: 'promote', sid: s1.id }, who).ok, 'pas de promotion sans expérience');
  s1.xp = 500; const or1 = vs.r.or, vi1 = vs.r.viande;
  r = R.applyV(vs, { type: 'promote', sid: s1.id }, who);
  ok(r.ok && s1.lvl === 2 && s1.xp === 470 && vs.r.or === or1 - 20 && vs.r.viande === vi1 - 10, 'promotion au niveau 2 : 20 or et 10 viande');
  while (s1.lvl < 4) R.applyV(vs, { type: 'promote', sid: s1.id }, who);
  ok(s1.lvl === 4 && R.solEat(s1) === 14, 'niveau 4 : il mange un peu plus (14 rations par jour)');
  /* équipement : il faut une forge */
  ok(!R.applyV(R.clone(vs), { type: 'solForge', sid: s1.id, k: 'w' }, who).ok, 'pas d’équipement de soldat sans forge');
  vs.b.push({ id: vs.nid++, type: 'forge', lvl: 2, gx: 19, gz: 16, up: null });
  const st0 = R.solStats(s1, p1);
  r = R.applyV(vs, { type: 'solForge', sid: s1.id, k: 'w' }, who);
  ok(r.ok && s1.w && s1.w.il === 4, 'une arme forgée au niveau du soldat : ' + r.name);
  r = R.applyV(vs, { type: 'solForge', sid: s1.id, k: 'a', set: 'fer' }, who);
  ok(r.ok && s1.a.set === 'fer', 'une armure complète, avec son ensemble : ' + r.name);
  const st1 = R.solStats(s1, p1);
  ok(st1.dmg > st0.dmg && st1.hp > st0.hp && Math.abs(st1.armor - (st0.armor + 0.1)) < 1e-9, 'équipé : plus de dégâts, plus de vie, +10 % d’armure (ensemble)');
  r = R.applyV(vs, { type: 'solImprove', sid: s1.id, k: 'w' }, who);
  ok(r.ok && s1.w.up === 1, 'arme améliorée +1');
  for (let i = 0; i < 3; i++) R.applyV(vs, { type: 'solImprove', sid: s1.id, k: 'w' }, who);
  r = R.applyV(R.clone(vs), { type: 'solImprove', sid: s1.id, k: 'w' }, who);
  ok(s1.w.up === 4 && !r.ok && /forge/.test(r.err), 'forge niveau 2 : +4 au plus');
  const fer0 = vs.r.fer; r = R.applyV(vs, { type: 'solForge', sid: s1.id, k: 'w' }, who);
  ok(r.ok && r.back > 0 && s1.w.up === 0, 'une nouvelle arme remplace l’ancienne, fondue (+' + r.back + ' fer)');
  /* orbes */
  R.orbAdd(vs, 'vie1', 4); R.orbAdd(vs, 'esquive0', 1);
  r = R.applyV(vs, { type: 'orbSet', sid: s1.id, s: 0, o: 'vie1' }, who);
  ok(r.ok && s1.o.o0 === 'vie1' && vs.orbs.vie1 === 3, 'une orbe de vie sertie (emplacement du niveau 4)');
  ok(!R.applyV(R.clone(vs), { type: 'orbSet', sid: s1.id, s: 1, o: 'esquive0' }, who).ok, '2e emplacement : au niveau 8');
  const st2 = R.solStats(s1, p1);
  ok(st2.hp > st1.hp, 'l’orbe donne de la vie (' + st1.hp + ' → ' + st2.hp + ')');
  r = R.applyV(vs, { type: 'orbFuse', o: 'vie1' }, who);
  ok(r.ok && !vs.orbs.vie1 && vs.orbs.vie2 === 1, 'trois orbes peu communes → une rare (' + r.name + ')');
  R.applyV(vs, { type: 'orbOff', sid: s1.id, s: 0 }, who);
  ok(!s1.o.o0 && vs.orbs.vie1 === 1, 'l’orbe retirée retourne dans la réserve');
  /* bannières */
  const bid = R.banAdd(vs, 'lion', 2);
  r = R.applyV(vs, { type: 'banSet', id: p1.id, ban: bid }, who);
  ok(r.ok && p1.ban && p1.ban.k === 'lion' && !Object.keys(vs.bans || {}).length, 'une bannière du lion (rare) sur le poste 1 : ' + r.name);
  const st3 = R.solStats(s1, p1), st3b = R.solStats(s1, p2);
  ok(st3.dmg > st3b.dmg, 'la bannière donne des dégâts aux gardes de son poste (' + st3b.dmg + ' → ' + st3.dmg + ')');
  const b2 = R.banAdd(vs, 'ours', 0); r = R.applyV(vs, { type: 'banSet', id: p1.id, ban: b2 }, who);
  ok(r.ok && p1.ban.k === 'ours' && Object.values(vs.bans).some(b => b.k === 'lion'), 'une autre bannière la remplace : l’ancienne retourne dans la réserve');
  const or2 = vs.r.or, lionId = Object.values(vs.bans).find(b => b.k === 'lion').id;
  r = R.applyV(vs, { type: 'banSell', ban: lionId }, who);
  ok(r.ok && vs.r.or === or2 + 60, 'vendre une bannière rare : +60 or');
  /* titres de vétéran */
  const sv0 = R.solStats(s1, p1); s1.vet = 5;
  ok(R.solTitle(s1)[1] === 'Vétéran' && R.solStats(s1, p1).dmg > sv0.dmg * 1.03 && R.solStats(s1, p1).hp > sv0.hp * 1.03, 'après 5 raids sans tomber : Vétéran (+5 % de dégâts et de vie)');
  s1.vet = 10; ok(R.solTitle(s1)[1] === 'Briscard', '10 raids : Briscard');
  s1.vet = 0;

  /* un raid avec la garnison : un portail au nord, les deux postes, dix soldats, pas de héros */
  const mkRaid = withGuards => {
    const vr = R.clone(vs);
    vr.heroes = {}; vr.r.bois = 900; vr.r.pierre = 900; vr.r.or = 300;
    if (!withGuards) vr.sol = {};
    for (const s of R.solList(vr)) { s.lvl = Math.max(s.lvl, 5); s.hurt = 0; }
    p1.gx = 12; p1.gz = 5;
    vr.raid = { n: 4, next: vr.t }; R.simulateVillage(vr, vr.t + 60000);
    vr.raid.p = [[12, 0, 0]]; vr.raid.cl = [0];
    R.simulateVillage(vr, vr.raid.at + 3 * H + 2 * 60000);
    return vr;
  };
  const vr = mkRaid(true), vr0 = mkRaid(false), lr = vr.lastRaid, lr0 = vr0.lastRaid;
  ok(lr && lr.G && lr.G.length === 8 && lr.res.gd && lr.res.gd.length === 8, 'au raid, les 8 soldats sont à leur poste (gardés pour la rediffusion)');
  ok(lr0 && !lr0.G && !lr0.res.gd, 'sans garnison : rien de nouveau dans le raid');
  const sumL = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
  ok(lr.res.k > lr0.res.k && sumL(lr.res.lost) < sumL(lr0.res.lost), 'avec la garnison : ' + lr.res.k + ' vaincus (dont ' + lr.res.gk + ' par les soldats) au lieu de ' + lr0.res.k + ', ' + sumL(lr.res.lost) + ' volés au lieu de ' + sumL(lr0.res.lost));
  const rep = st => { let n = 0; while (!st.over && n++ < 4000) { R.raidStep(st); st.ev.length = 0; } return R.raidResult(st); };
  ok(JSON.stringify(rep(R.raidReplay(JSON.parse(JSON.stringify(lr))))) === JSON.stringify(lr.res), 'la rediffusion rejoue exactement le même raid, soldats compris');
  const kos = lr.res.gd.filter(x => x[2]).map(x => x[0]), alive = lr.res.gd.filter(x => !x[2]).map(x => x[0]);
  ok(alive.every(id => vr.sol[id].xp > vs.sol[id].xp || vr.sol[id].lvl > 5) && alive.every(id => vr.sol[id].vet === (vs.sol[id].vet | 0) + 1), 'ceux qui ont tenu gagnent de l’expérience et un raid de plus dans leur série');
  ok(kos.every(id => R.solHurt(vr.sol[id], vr.t) && vr.sol[id].vet === 0), kos.length + ' soldat(s) tombé(s) : blessé(s) 8 h, série perdue');
  ok(vr.log.some(l => l.k === 'sol' && /La garnison abat/.test(l.m)), 'le journal : ' + vr.log.filter(l => l.k === 'sol' && /garnison abat/.test(l.m)).slice(-1)[0].m);
  /* un soldat seul face aux trolls : il tombe, il est blessé 8 heures et perd son titre */
  {
    const vk = R.clone(vs); vk.heroes = {}; vk.r.bois = 900; vk.r.pierre = 900;
    const keep = R.solList(vk)[0]; for (const s of R.solList(vk)) if (s !== keep) delete vk.sol[s.id];
    Object.assign(keep, { lvl: 1, w: null, a: null, o: {}, vet: 7, hurt: 0, post: p1.id });
    vk.b.find(b => b.type === 'halle').lvl = 4;
    vk.raid = { n: 6, next: vk.t }; R.simulateVillage(vk, vk.t + 60000); vk.raid.p = [[12, 0, 0]]; vk.raid.cl = [0];
    R.simulateVillage(vk, vk.raid.at + 3 * H + 2 * 60000);
    const gk = vk.lastRaid && vk.lastRaid.res.gd && vk.lastRaid.res.gd[0];
    ok(gk && gk[2] === 1 && R.solHurt(vk.sol[keep.id], vk.t) && vk.sol[keep.id].hurt === vk.lastRaid.t + 8 * H && vk.sol[keep.id].vet === 0, 'un soldat seul face aux trolls tombe : blessé pour 8 h, série remise à zéro');
    ok(vk.log.some(l => l.k === 'sol' && /perd son titre : vétéran/.test(l.m)), 'le journal le dit (il perd son titre de vétéran)');
  }
  /* un blessé ne défend pas */
  const vh2 = R.clone(vr), sh = R.solList(vh2)[0]; sh.hurt = vh2.t + 2 * H;
  ok(!R.raidGuards(vh2, vh2.t).some(e => e[0] === sh.id) && R.raidGuards(vh2, vh2.t + 3 * H).some(e => e[0] === sh.id), 'un blessé ne défend pas ; guéri, il revient à son poste');
  /* défense réussie : des orbes pour la garnison */
  const vw = R.clone(vs); vw.heroes = {};
  for (const s of R.solList(vw)) { s.lvl = 15; s.hurt = 0; }
  vw.b.push({ id: vw.nid++, type: 'tour', lvl: 3, gx: 14, gz: 7, up: null });
  vw.raid = { n: 0, next: vw.t }; R.simulateVillage(vw, vw.t + 60000); vw.raid.p = [[12, 0, 0]]; vw.raid.cl = [0];
  const orbs0 = sumL(vw.orbs);
  R.simulateVillage(vw, vw.raid.at + 3 * H + 2 * 60000);
  const lw = vw.lastRaid;
  ok(lw && !Object.keys(lw.res.lost).length && lw.orbs && lw.orbs.length >= 1 && sumL(vw.orbs) === orbs0 + lw.orbs.length, 'défense réussie (rien volé) : ' + (lw && lw.orbs ? lw.orbs.join(', ') : '?') + ' pour la garnison');
  /* butin des donjons pour la garnison */
  const vd2 = R.clone(vs); R.applyV(vd2, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier' }, who);
  const hb = Object.values(vd2.heroes)[0], ob0 = sumL(vd2.orbs);
  vd2.raid = { n: 1, next: vd2.t }; R.simulateVillage(vd2, vd2.t + 60000);
  r = R.applyV(vd2, { type: 'djEnd', hid: hb.id, lvl: 2, win: true, xp: 100, theme: 'portail', pi: 0 }, who);
  ok(r.ok && r.orbs.length === 1 && sumL(vd2.orbs) === ob0 + 1, 'gardien du portail vaincu : une orbe' + (r.ban ? ' et une bannière (' + r.ban.k + ')' : '') + ' pour la garnison');
  const vd3 = R.clone(vd2); r = R.applyV(vd3, { type: 'djEnd', hid: hb.id, lvl: 2, win: true, xp: 100, theme: 'prof', deep: 7, gar: 0 }, who);
  ok(r.ok && !r.orbs.length && !r.ban, 'à deux, l’invitée ne rapporte rien pour la garnison (c’est l’hôte)');
  r = R.applyV(vd2, { type: 'djEnd', hid: hb.id, lvl: 2, win: true, xp: 100, theme: 'prof', deep: 7 }, who);
  ok(r.ok && r.orbs.length === 3 && r.ban, 'Profondeurs, 7 étages : 3 orbes et une bannière');
  /* retirer un poste, renvoyer, démolir la caserne */
  const vx = R.clone(vs), px = vx.b.find(b => b.id === p1.id), nG = R.guardsOf(vx, p1.id).length;
  r = R.applyV(vx, { type: 'demolish', id: px.id }, who);
  ok(r.ok && nG > 0 && R.solList(vx).every(s => s.post !== p1.id) && Object.values(vx.bans || {}).some(b => b.k === 'ours'), 'poste retiré : ses gardes n’ont plus de poste, sa bannière retourne dans la réserve');
  ok(!R.applyV(R.clone(vx), { type: 'demolish', id: cas.id }, who).ok, 'pas de démolition de la caserne tant qu’elle loge des soldats');
  const sx = R.solList(vx)[0]; sx.o = { o0: 'regen2' }; sx.lvl = 4;
  r = R.applyV(vx, { type: 'dismiss', sid: sx.id }, who);
  ok(r.ok && !vx.sol[sx.id] && vx.orbs.regen2 === 1, 'un soldat renvoyé : ses orbes retournent dans la réserve');
  /* la base de données efface les objets vides : on retrouve tout */
  const back = R.normVillage(JSON.parse(JSON.stringify(vr)));
  ok(R.solList(back).length === 8 && back.lastRaid.G.length === 8 && JSON.stringify(rep(R.raidReplay(back.lastRaid))) === JSON.stringify(vr.lastRaid.res), 'après un aller-retour par la base : soldats et rediffusion intacts');
  /* formation : fantassins et lanciers devant (vers le portail), archers et mages derrière */
  const F = R.solFormation({ x: 12.5, y: 8.5, r: 3 }, ['arch', 'fant', 'mage', 'lanc'], 0, -1, () => false);
  ok(F[1][1] < F[0][1] && F[3][1] < F[2][1] && F.every(p => Math.hypot(p[0] - 12.5, p[1] - 8.5) <= 3), 'formation : la ligne de front face au portail, tout le monde dans le cercle');
}

/* 19. L'histoire (lot A) : Lilou, son humeur et ses caprices */
{
  const vl = R.newVillage('vlil', 'Lilouville', '#D27A22', T0, 'u1', 'Téo');
  R.applyV(vl, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', sex: 'm' }, who);
  const hb = Object.values(vl.heroes)[0];
  ok(!R.applyV(R.clone(vl), { type: 'build', b: 'chambre', gx: 3, gz: 3 }, who).ok && R.lilouMul(vl) === 1, 'avant la mission : pas de chambre de Lilou, aucun effet sur les monstres');
  let r = R.applyV(vl, { type: 'djEnd', hid: hb.id, lvl: 1, win: true, xp: 120, theme: 'source' }, who);
  const ch = vl.b.find(b => b.type === 'chambre');
  ok(r.ok && r.lilou && ch && ch.lvl === 1 && vl.lilou && vl.lilou.mood === R.LILOU.start && R.lilouMood(vl.lilou).k === 'contente' && hb.dj === 1 && r.xp > 0, 'mission « La Source du Mal » gagnée : Lilou arrive (contente), sa chambre est posée, la mine ne change pas de niveau');
  ok(vl.lilou.d && R.CAPRICES[vl.lilou.d.k] && vl.lilou.w && R.BIG_CAPRICES[vl.lilou.w.k] && vl.log.some(l => l.k === 'lilou' && /Caprice du jour/.test(l.m)) && vl.log.some(l => /un bébé/.test(l.m)), 'un caprice du jour et un gros caprice de la semaine, annoncés au journal');
  r = R.applyV(vl, { type: 'djEnd', hid: hb.id, lvl: 1, win: true, xp: 120, theme: 'source' }, who);
  ok(r.ok && !r.lilou && vl.b.filter(b => b.type === 'chambre').length === 1, 'une seule Lilou et une seule chambre par village');
  ok(!R.applyV(R.clone(vl), { type: 'demolish', id: ch.id }, who).ok && R.applyV(R.clone(vl), { type: 'move', id: ch.id, gx: 3, gz: 18 }, who).ok, 'la chambre se déplace mais ne se démolit pas');
  const a2 = R.clone(vl), b2 = R.clone(vl); R.simulateVillage(a2, vl.t + 3 * D + 2 * 60000); R.simulateVillage(b2, vl.t + 3 * D + 2 * 60000);
  ok(JSON.stringify(a2.lilou) === JSON.stringify(b2.lilou) && a2.lilou.d.n === 3, 'mêmes caprices sur les deux téléphones, un nouveau chaque jour');
  vl.r = Object.assign(vl.r, { bois: 600, pierre: 600, ble: 300, pain: 300, viande: 300, biere: 60, or: 600 });
  const k = vl.lilou.d.k, c = R.capCost(vl, k), b0 = Object.assign({}, vl.r);
  r = R.applyV(vl, { type: 'lilouCap', w: 0 }, who);
  ok(r.ok && vl.lilou.d.ok === 1 && vl.lilou.mood === R.LILOU.start + R.LILOU.day && Object.keys(c).every(x => Math.abs(b0[x] - c[x] - vl.r[x]) < 1e-6), 'caprice du jour (' + R.CAPRICES[k].name + ') fabriqué : il est payé, Lilou est plus contente');
  ok(!R.applyV(R.clone(vl), { type: 'lilouCap', w: 0 }, who).ok, 'pas deux fois le caprice du jour');
  const mor0 = R.moraleOf(vl, vl.t), wk = vl.lilou.w.k;
  r = R.applyV(vl, { type: 'lilouCap', w: 1 }, who2.uid in vl.members ? who2 : who);
  ok(r.ok && wk !== 'anniv' && vl.lilou.w.ok === 1 && R.lilouMood(vl.lilou).k === 'ravie' && R.moraleOf(vl, vl.t) === Math.min(100, mor0 + R.LILOU.party), 'gros caprice (' + R.BIG_CAPRICES[wk].name + ') offert : Lilou ravie, +10 de moral au village (pas d’anniversaire sans taverne)');
  ok(R.lilouMul(vl) === 0.9 && R.LILOU_MOODS.map(m => m.mul).join(',') === '1.1,1.05,1,0.95,0.9', 'cinq humeurs, de +10 % (en colère) à −10 % de dégâts des monstres (ravie)');
  const vm = R.clone(vl), m0 = vm.lilou.mood, d0 = vm.lilou.d.n;
  R.simulateVillage(vm, vm.lilou.at + (d0 + 1) * D + 60000);
  ok(vm.lilou.d.n === d0 + 1 && vm.lilou.mood === m0 && !vm.lilou.d.ok, 'nouveau jour, nouveau caprice (le précédent était fait : pas de bouderie)');
  R.simulateVillage(vm, vm.lilou.at + (d0 + 2) * D + 60000);
  ok(vm.lilou.mood === m0 - R.LILOU.dayMiss && vm.log.some(l => /Lilou boude/.test(l.m)), 'caprice oublié : ' + vm.log.filter(l => /Lilou boude/.test(l.m)).slice(-1)[0].m);
  const big = R.capCost(Object.assign(R.clone(vl), { b: vl.b.map(b => b.type === 'halle' ? Object.assign({}, b, { lvl: 5 }) : b) }), 'cubes');
  ok(big.bois === 80 && R.capCost(vl, 'cubes').bois === 40, 'les caprices coûtent plus cher quand le village grandit (cubes : 40 → 80 de bois)');
  /* au raid : l'humeur de Lilou change les dégâts des gobelins, et la rediffusion la garde */
  const vx = R.clone(vl); vx.lilou.mood = 5;
  vx.raid = { n: 3, next: vx.t }; R.simulateVillage(vx, vx.t + 60000);
  const inp = R.raidInput(vx, vx.t), s1 = R.raidStart(inp), s0 = R.raidStart(Object.assign({}, inp, { M: undefined }));
  ok(inp.M === 1.1 && Math.abs(s1.foes[0].dmg - Math.round(s0.foes[0].dmg * 1.1 * 10) / 10) < 0.11, 'Lilou en colère : les gobelins frappent 10 % plus fort (' + s0.foes[0].dmg + ' → ' + s1.foes[0].dmg + ')');
  R.simulateVillage(vx, vx.raid.at + 3 * H + 2 * 60000);
  const rep = st => { let n = 0; while (!st.over && n++ < 4000) { R.raidStep(st); st.ev.length = 0; } return R.raidResult(st); };
  ok(vx.lastRaid && vx.lastRaid.M === 1.1 && JSON.stringify(rep(R.raidReplay(JSON.parse(JSON.stringify(vx.lastRaid))))) === JSON.stringify(vx.lastRaid.res), 'raid avec Lilou en colère : la rediffusion rejoue exactement le même combat');
  const back = R.normVillage(JSON.parse(JSON.stringify(vl)));
  ok(JSON.stringify(back.lilou) === JSON.stringify(vl.lilou), 'Lilou intacte après un aller-retour par la base');
}

/* 20. L'histoire (lot B) : la Couronne de la Montagne (cycles), les lettres du Roi Déchu, les raids sur la chambre de Lilou, la chronique */
{
  const vc = R.newVillage('vcour', 'Couronnebourg', '#D27A22', T0, 'u1', 'Téo');
  ok(vc.chron && vc.chron.length === 1 && vc.chron[0][1] === 'found' && /fonde le village/.test(vc.chron[0][2]), 'la chronique commence à la fondation');
  R.applyV(vc, { type: 'hero', name: 'Brokk', race: 'nain', cls: 'guerrier', sex: 'm' }, who);
  const hb = Object.values(vc.heroes)[0];
  ok(vc.chron.some(e => e[1] === 'hero' && /Brokk/.test(e[2])), 'le premier héros entre dans la chronique');
  R.simulateVillage(vc, vc.t + 2 * H);
  ok(!vc.crown && R.crownCan(vc, 'mine', 5, 0, true) === -1, 'pas de quête de la couronne avant Lilou');
  R.applyV(vc, { type: 'djEnd', hid: hb.id, lvl: 1, win: true, xp: 120, theme: 'source' }, who);
  const at = vc.lilou.at;
  R.simulateVillage(vc, at + R.CROWN_DELAY - 2 * 60000);
  ok(!vc.crown, 'juste après l’arrivée de Lilou : pas encore de lettre');
  R.simulateVillage(vc, at + R.CROWN_DELAY + 2 * 60000);
  ok(vc.crown && vc.crown.cy === 1 && vc.crown.got === 0 && vc.crown.rank === 0 && vc.log.some(l => l.k === 'roi' && /Roi Déchu/.test(l.m)), 'dix minutes après : la lettre du Roi Déchu, la quête commence (chapitre 1)');
  ok(vc.chron.filter(e => e[1] === 'lilou').length === 1 && vc.chron.some(e => e[1] === 'roi'), 'chronique : l’arrivée de Lilou (une fois) et la lettre');
  ok(R.crownNeed(1, 0) === 3 && R.crownNeed(1, 1) === 4 && R.crownNeed(1, 3) === 5 && R.crownNeed(2, 0) === 6 && R.crownNeed(2, 1) === 7 && R.crownNeed(2, 3) === 10 && R.crownNeed(3, 3) === 15, 'niveaux demandés : mine 3, 6, 9… ; crypte 4, 7, 10… ; Profondeurs 5, 10, 15…');
  hb.dj = 12;
  const end = (theme, lvl, win, deep) => R.applyV(vc, { type: 'djEnd', hid: hb.id, lvl, win, xp: 50, theme, deep: deep || 0 }, who);
  let r = end('crypte', 6, true);
  ok(r.ok && !r.crown && vc.crown.got === 0, 'chapitre 1 : la crypte ne compte pas encore (les chapitres se suivent)');
  ok(!end('mine', 2, true).crown && !end('mine', 3, false).crown && vc.crown.got === 0, 'mine niveau 2 gagnée ou niveau 3 perdue : rien');
  const or0 = vc.r.or, n0 = Object.keys(R.bagOf(vc, 'u1').it).length;
  r = end('mine', 3, true);
  const gift = Object.values(R.bagOf(vc, 'u1').it).find(it => it.r === 2);
  ok(r.crown && r.crown.k === 0 && r.crown.n === 1 && vc.crown.got === 1 && vc.r.or >= or0 + r.crown.gold && Object.keys(R.bagOf(vc, 'u1').it).length === n0 + 1 && gift, 'chef troll au niveau 3 : le bandeau, ' + r.crown.gold + ' or et un objet rare (' + (gift ? R.itemInfo(gift).name : '?') + ')');
  ok(vc.log.some(l => l.k === 'crown' && /bandeau/.test(l.m)) && vc.chron.some(e => e[1] === 'crown' && /bandeau/.test(e[2])), 'journal et chronique : le bandeau');
  ok(!end('mine', 5, true).crown && !end('portail', 3, true).crown && vc.crown.got === 1, 'pas deux fois le même morceau, et le portail attend son chapitre');
  ok(!R.crownRaidOn(vc), 'chapitres 1 et 2 : les raids ne visent pas encore la chambre de Lilou');
  r = end('crypte', 4, true);
  ok(r.crown && r.crown.k === 1 && vc.crown.got === 3 && R.crownRaidOn(vc), 'roi squelette au niveau 4 : le fleuron ; chapitre 3, les gobelins visent maintenant la chambre de Lilou');
  r = end('portail', 2, true);
  ok(r.crown && r.crown.k === 2 && vc.crown.got === 7, 'un portail refermé : l’arche (chapitre 4)');
  ok(!end('prof', 6, true, 4).crown, 'Profondeurs : 4 étages ne suffisent pas');
  const orbs0 = JSON.stringify(vc.orbs || {}), mor0 = R.moraleOf(vc, vc.t), bag1 = Object.keys(R.bagOf(vc, 'u1').it).length, gold1 = vc.r.or;
  r = end('prof', 6, false, 5);
  ok(r.crown && r.crown.k === 3 && r.crown.done && r.crown.done.rank === 1 && vc.crown.rank === 1 && vc.crown.cy === 2 && vc.crown.got === 0, 'étage 5 des Profondeurs terminé (même en remontant de force) : la pierre de cœur, la couronne est reconstituée (rang 1), le cycle 2 commence');
  ok(JSON.stringify(vc.orbs || {}) !== orbs0 && Object.keys(R.bagOf(vc, 'u1').it).length === bag1 + 2 && vc.r.or >= gold1 + 100 && vc.crown.lc && vc.crown.lc.g === 100, 'le coffre : 100 or, une orbe, un objet épique pour le héros actif (et celui de la pierre de cœur)');
  ok(R.moraleOf(vc, vc.t) === Math.min(100, mor0 + 1) && R.moraleParts(vc, vc.t).some(p => p[0] === 'Couronne de la Montagne' && p[1] === 1), 'rang 1 : +1 de moral pour toujours');
  ok(vc.log.some(l => l.k === 'roi' && /s’éteignent/.test(l.m)) && vc.chron.some(e => /Rois de la Montagne/.test(e[2])), 'la malédiction du Roi Déchu (au journal) ; la chronique garde le couronnement');
  /* cycle 2 : les joyaux, dans l'ordre qu'on veut, plus durs */
  ok(!end('mine', 5, true).crown && !end('prof', 8, true, 9).crown, 'cycle 2 : mine 5 et étage 9 ne suffisent plus');
  r = end('prof', 8, true, 10);
  ok(r.crown && r.crown.k === 3 && /joyau des Profondeurs/.test(r.crown.name) && vc.crown.got === 8, 'cycle 2 : le joyau des Profondeurs d’abord (étage 10)');
  ok(end('crypte', 7, true).crown && end('mine', 6, true).crown && vc.crown.got === 11, 'puis la crypte (7) et la mine (6), dans n’importe quel ordre');
  const g2 = vc.r.or;
  r = end('portail', 4, true);
  ok(r.crown && r.crown.done && vc.crown.rank === 2 && vc.crown.cy === 3 && vc.r.or >= g2 + 200 && R.moraleParts(vc, vc.t).some(p => p[0] === 'Couronne de la Montagne' && p[1] === 2), 'les quatre joyaux : rang 2, coffre de 200 or, +2 de moral ; le cycle 3 commence');
  ok(R.crownNeed(vc.crown.cy, 0) === 9 && R.crownNeed(vc.crown.cy, 3) === 15, 'cycle 3 : mine 9, étage 15…');
  /* les lettres du Roi Déchu, de temps en temps, pareilles sur les deux téléphones */
  const la = R.clone(vc), lb = R.clone(vc), l0 = la.crown.ln;
  R.simulateVillage(la, la.t + 6 * D); R.simulateVillage(lb, lb.t + 6 * D);
  const letters = la.log.filter(l => l.k === 'roi' && /Sukhoï/.test(l.m));
  ok(la.crown.ln - l0 >= 2 && la.crown.ln - l0 <= 4 && letters.length >= 2 && JSON.stringify(la.crown) === JSON.stringify(lb.crown) && JSON.stringify(la.chron) === JSON.stringify(lb.chron), 'en 6 jours : ' + (la.crown.ln - l0) + ' lettres (« ' + letters[0].m.slice(21, 70) + '… »), les mêmes sur les deux téléphones');
  /* les raids sur la chambre de Lilou */
  const vr = R.clone(vc); vr.lilou.mood = 60;
  vr.raid = { n: 3, next: vr.t }; R.simulateVillage(vr, vr.t + 60000);
  const inp = R.raidInput(vr, vr.t), st = R.raidStart(inp), gob = st.foes.filter(u => u.type === 'gobelin');
  ok(inp.C === 1 && st.ch >= 0 && st.S[st.ch].type === 'chambre' && gob.some(u => u.tk === 'c') && gob.some(u => u.tk === 'h'), 'raid : un gobelin sur deux vise la chambre de Lilou, les autres la halle');
  const run = s => { let n = 0; while (!s.over && n++ < 4000) { R.raidStep(s); s.ev.length = 0; } return R.raidResult(s); };
  const alone = run(R.raidStart(Object.assign({}, inp, { H: [], G: undefined })));
  ok(alone.c === 1, 'sans défenseurs, les gobelins atteignent la chambre de Lilou');
  const vf = R.clone(vr), m1 = vf.lilou.mood; R.raidApply(vf, vf.t, inp, alone);
  ok(vf.lilou.mood === m1 - R.CROWN_FEAR && vf.log.some(l => /chambre de Lilou/.test(l.m)) && vf.lastRaid.C === 1, 'chambre fouillée : Lilou a très peur (−' + R.CROWN_FEAR + ' d’humeur), c’est au journal');
  const old = R.raidStart(Object.assign({}, inp, { C: undefined }));
  ok(old.ch === -1 && old.foes.every(u => u.tk === 'h' || u.thief), 'sans la quête (anciens raids) : tous les gobelins vont à la halle, comme avant');
  R.simulateVillage(vr, vr.raid.at + 3 * H + 2 * 60000);
  ok(vr.lastRaid && vr.lastRaid.C === 1 && JSON.stringify(run(R.raidReplay(JSON.parse(JSON.stringify(vr.lastRaid))))) === JSON.stringify(vr.lastRaid.res), 'raid réel (chambre ' + (vr.lastRaid.res.c ? 'fouillée' : 'protégée') + ') : la rediffusion rejoue exactement le même combat');
  /* la chronique : bornée, la fondation toujours en tête ; et pour les villages d'avant */
  const vk = R.clone(vc); for (let i = 0; i < 80; i++) R.applyV(vk, { type: 'djEnd', hid: hb.id, lvl: 1, win: true, xp: 4000, theme: 'mine' }, who);
  ok(vk.chron.length <= 60 && vk.chron[0][1] === 'found' && vk.chron.some(e => e[1] === 'hero' && /niveau 10/.test(e[2])), 'la chronique garde 60 moments au plus, la fondation en tête (et les caps de niveau : ' + vk.chron.filter(e => e[1] === 'hero').length + ')');
  const vo = R.clone(vc); delete vo.chron; R.simulateVillage(vo, vo.t + 2 * 60000);
  ok(vo.chron && vo.chron[0][1] === 'found' && vo.chron.some(e => e[1] === 'lilou'), 'village d’avant la chronique : elle commence avec la fondation et l’arrivée de Lilou');
  const back = R.normVillage(JSON.parse(JSON.stringify(vc)));
  ok(JSON.stringify(back.crown) === JSON.stringify(vc.crown) && JSON.stringify(back.chron) === JSON.stringify(vc.chron), 'couronne et chronique intactes après un aller-retour par la base');
  /* la base temps réel range les listes comme des objets : la chronique doit s'en remettre */
  const asObj = JSON.parse(JSON.stringify(vc)); asObj.chron = Object.assign({}, asObj.chron.map(e => Object.assign({}, e)));
  ok(JSON.stringify(R.normVillage(asObj).chron) === JSON.stringify(vc.chron), 'chronique rangée en objets par la base : remise en listes');
}

/* 14. Rapidité : simuler 3 jours */
const t0 = Date.now(); R.simulateVillage(R.clone(v3), v3.t + 3 * D); const ms = Date.now() - t0;
ok(ms < 1500, 'simulation de 3 jours en ' + ms + ' ms');
console.log(JSON.stringify(v3).length + ' octets pour un village de ' + v3.vil.length + ' villageois');
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
