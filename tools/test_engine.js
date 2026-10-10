/* Essais du moteur de combat (remparts, chemins, héros) sans navigateur : node tools/test_engine.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/p2_rules.js'), 'utf8');
const E = new Function(src + '\nreturn { BLD, HEROES, GRID, newVillage, simulateRaid, makeBattle, stepBattle, deploy, botPlan, genBot, heroPower, canDeploy, applyV, layoutOf, raidBudget, thOf, fits, simulateVillage, hpOf };')();
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('ÉCHEC :', m); } else console.log('ok :', m); };

// 1. Village de départ, avec et sans enceinte
function village(withWalls, wl) {
  const v = E.newVillage('test', 'Test', '#4A78C2', Date.UTC(2026, 9, 11));
  v.b.find(b => b.type === 'mairie').lvl = 2;
  if (withWalls) {
    let x0 = 4, z0 = 6, x1 = 17, z1 = 17; // autour des bâtiments de départ
    const ring = [];
    for (let x = x0; x <= x1; x++) { ring.push([x, z0]); ring.push([x, z1]); }
    for (let z = z0 + 1; z < z1; z++) { ring.push([x0, z]); ring.push([x1, z]); }
    for (const [x, z] of ring) if (E.fits(v, 'rempart', x, z)) v.b.push({ id: v.nid++, type: 'rempart', lvl: wl || 1, gx: x, gz: z, up: null });
  }
  return v;
}
const v0 = village(false), v1 = village(true, 1), v3 = village(true, 3);
console.log('remparts posés :', v1.b.filter(b => b.type === 'rempart').length);
let sum0 = 0, sum1 = 0, sum3 = 0, t0 = Date.now();
const N = 30;
for (let s = 1; s <= N; s++) {
  sum0 += E.simulateRaid(E.layoutOf(v0), s * 7919, 22).pct;
  sum1 += E.simulateRaid(E.layoutOf(v1), s * 7919, 22).pct;
  sum3 += E.simulateRaid(E.layoutOf(v3), s * 7919, 22).pct;
}
const ms = (Date.now() - t0) / (3 * N);
console.log('destruction moyenne par les orques  sans remparts : ' + (sum0 / N * 100).toFixed(0) + ' %   remparts niv.1 : ' + (sum1 / N * 100).toFixed(0) + ' %   niv.3 : ' + (sum3 / N * 100).toFixed(0) + ' %');
console.log('temps moyen d’une attaque simulée : ' + ms.toFixed(1) + ' ms');
ok(sum1 <= sum0 + 0.01 * N, 'les remparts protègent (ou au moins ne nuisent pas)');
ok(ms < 150, 'simulation assez rapide');

// 2. Les unités cassent un rempart quand il n'y a pas d'autre chemin
{
  const lay = [['mairie', 1, 10, 10]];
  for (let x = 8; x <= 14; x++) { lay.push(['rempart', 1, x, 8]); lay.push(['rempart', 1, x, 14]); }
  for (let z = 9; z <= 13; z++) { lay.push(['rempart', 1, 8, z]); lay.push(['rempart', 1, 14, z]); }
  const B = E.makeBattle(lay);
  ok(!E.canDeploy(B, 11.5, 11.5) && !E.canDeploy(B, 9.5, 9.5), 'impossible de déployer à l’intérieur de l’enceinte');
  ok(E.canDeploy(B, 2, 2), 'déploiement possible dehors');
  for (let i = 0; i < 6; i++) E.deploy(B, 'fantassin', 3 + i * 0.3, 11, 0);
  let wallDown = -1;
  while (!B.over) { E.stepBattle(B); if (wallDown < 0 && B.blds.some(b => b.wall && b.dead)) wallDown = B.t; B.events.length = 0; B.shots.length = 0; if (B.t > 170) break; }
  console.log('  rempart cassé à ' + wallDown + ' s, halle détruite : ' + B.thDown + ' à ' + B.t + ' s');
  ok(wallDown > 0 && B.thDown, 'les guerriers cassent le rempart puis la halle');
}
// 3. Avec une brèche, ils passent par la brèche sans casser
{
  const lay = [['mairie', 1, 10, 10]];
  for (let x = 8; x <= 14; x++) { lay.push(['rempart', 3, x, 8]); if (x !== 11) lay.push(['rempart', 3, x, 14]); }
  for (let z = 9; z <= 13; z++) { lay.push(['rempart', 3, 8, z]); lay.push(['rempart', 3, 14, z]); }
  const B = E.makeBattle(lay);
  for (let i = 0; i < 4; i++) E.deploy(B, 'fantassin', 4 + i * 0.3, 4, 0, true);
  while (!B.over && B.t < 170) { E.stepBattle(B); B.events.length = 0; B.shots.length = 0; }
  const broken = B.blds.filter(b => b.wall && b.dead).length;
  console.log('  remparts cassés : ' + broken + ', halle détruite : ' + B.thDown + ' à ' + B.t + ' s');
  ok(B.thDown && broken === 0, 'les guerriers font le tour par la brèche');
}
// 4. Le bélier enfonce les remparts bien plus vite
{
  const mk = () => { const lay = [['tour', 1, 11, 11]]; for (let x = 6; x <= 17; x++) lay.push(['rempart', 2, x, 8]); for (let z = 9; z <= 17; z++) { lay.push(['rempart', 2, 6, z]); lay.push(['rempart', 2, 17, z]); } for (let x = 7; x <= 16; x++) lay.push(['rempart', 2, x, 17]); return E.makeBattle(lay); };
  const tw = type => { const B = mk(); E.deploy(B, type, 11.5, 3, 0, true); let t = -1; while (!B.over && B.t < 120) { E.stepBattle(B); if (B.blds.some(b => b.wall && b.dead)) { t = B.t; break; } B.events.length = 0; B.shots.length = 0; } return t; };
  const tf = tw('fantassin'), tb = tw('belier');
  console.log('  temps pour percer : guerrier ' + tf + ' s, bélier ' + tb + ' s');
  ok(tb > 0 && (tf < 0 || tb < tf), 'le bélier perce plus vite');
}
// 5. Camps orques avec enceinte
{
  let walls = 0, forts = 0;
  for (let s = 1; s <= 20; s++) { const bot = E.genBot(s * 1013, 3, false); walls += bot.layout.filter(l => l[0] === 'rempart').length; }
  for (let s = 1; s <= 10; s++) { const bot = E.genBot(s * 1013, 3, true, 2); forts += bot.layout.filter(l => l[0] === 'rempart').length; }
  console.log('  remparts moyens : camp niv.3 ' + (walls / 20).toFixed(1) + ', forteresse ' + (forts / 10).toFixed(1));
  const b1 = E.genBot(99, 1, false);
  ok(b1.layout.every(l => l[0] !== 'rempart'), 'pas de remparts dans les camps débutants');
  ok(walls > 0 && forts > 0, 'les camps plus forts ont une enceinte');
}
// 6. Héros : stats, un seul par joueur, pouvoir
{
  const bot = E.genBot(4242, 2, false);
  const fight = (hero, power) => {
    const B = E.makeBattle(bot.layout);
    for (let i = 0; i < 20; i++) E.deploy(B, 'fantassin', 1 + (i % 10) * 0.4, 11 + Math.floor(i / 10) * 0.4, 0, true);
    for (let i = 0; i < 10; i++) E.deploy(B, 'archer', 1 + i * 0.4, 12.5, 0, true);
    if (hero) { const h = E.deploy(B, hero, 1.5, 11.5, 0, true, 2); if (!h) throw new Error('héros non déployé'); }
    let used = false;
    while (!B.over) { if (hero && power && !used && B.t > 25) used = E.heroPower(B, 0); E.stepBattle(B); B.events.length = 0; B.shots.length = 0; }
    return B.pct;
  };
  const base = fight(null), r = {};
  for (const k of ['roi', 'chasseresse', 'berserker']) r[k] = [fight(k, false), fight(k, true)];
  console.log('  20 guerriers seuls : ' + (base * 100).toFixed(0) + ' %   ' + Object.keys(r).map(k => k + ' : ' + (r[k][0] * 100).toFixed(0) + ' % / avec pouvoir ' + (r[k][1] * 100).toFixed(0) + ' %').join('   '));
  ok(Object.values(r).every(x => x[0] >= base), 'chaque héros aide');
  const B = E.makeBattle(bot.layout);
  ok(!!E.deploy(B, 'roi', 1, 1, 0, true, 1) && !E.deploy(B, 'berserker', 1, 2, 0, true, 1) && !!E.deploy(B, 'berserker', 1, 3, 1, true, 1), 'un seul héros par joueur');
}
// 7. Actions : poser une ligne, améliorer, héros
{
  const t = Date.UTC(2026, 9, 11);
  const v = E.newVillage('k', 'V', '#4A78C2', t);
  v.r.pierre = 5000; v.r.vivres = 9000; v.r.bois = 5000;
  let r = E.applyV(v, { type: 'walls', tiles: [[3, 3], [4, 3], [5, 3], [6, 3]] }, t);
  ok(r.ok && r.n === 4 && v.b.filter(b => b.type === 'rempart').length === 4, 'pose de 4 remparts en ligne');
  r = E.applyV(v, { type: 'upwalls', lvl: 1 }, t);
  ok(r.ok && r.n === 4 && v.b.filter(b => b.type === 'rempart' && b.lvl === 2).length === 4, 'amélioration de tous les remparts');
  r = E.applyV(v, { type: 'heroBuy', k: 'roi' }, t);
  ok(!r.ok, 'pas de héros sans Salle des Héros');
  v.b.find(b => b.type === 'mairie').lvl = 2;
  v.b.push({ id: v.nid++, type: 'heros', lvl: 1, gx: 15, gz: 3, up: null });
  v.b.push({ id: v.nid++, type: 'entrepot', lvl: 1, gx: 15, gz: 18, up: null });
  r = E.applyV(v, { type: 'heroBuy', k: 'roi' }, t);
  ok(r.ok && v.heroes.roi && v.heroes.roi.lvl === 1, 'recrutement du roi');
  r = E.applyV(v, { type: 'heroUp', k: 'roi' }, t);
  ok(!r.ok, 'niveau 2 bloqué par la Salle niveau 1');
  r = E.applyV(v, { type: 'battle', kind: 'solo', mark: 1, pct: 50, loot: {}, used: {}, deployed: true, name: 'X', hero: { k: 'roi', frac: 0.5, dead: false } }, t);
  ok(r.ok && v.heroes.roi.rest > t, 'le héros se repose après un combat');
  E.simulateVillage(v, t + 3 * 3600000);
  ok(v.heroes.roi.rest <= t + 3 * 3600000, 'le repos se termine');
}
console.log(fails ? fails + ' échec(s)' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
