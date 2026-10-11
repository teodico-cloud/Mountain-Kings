/* Essais de la fabrication des donjons. Usage : node tools/test_donjon.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src2/p2_rules.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../src2/p2d_donjon.js'), 'utf8');
const D = new Function(src + '\nreturn { genDungeon, djReach, DJ_MONSTERS, DJ_BOSSES };')();
let fails = 0;
const ok = (c, m) => { if (c) console.log('ok : ' + m); else { fails++; console.log('ÉCHEC : ' + m); } };

const a = D.genDungeon(12345, 1), b = D.genDungeon(12345, 1);
ok(JSON.stringify({ ...a, grid: [...a.grid] }) === JSON.stringify({ ...b, grid: [...b.grid] }), 'même graine, même donjon');
ok(JSON.stringify(D.genDungeon(12346, 1).rooms) !== JSON.stringify(a.rooms), 'autre graine, autre donjon');

let n = 0, maxW = 0, maxH = 0, minFight = 99, maxFight = 0, prisoners = 0, unreachable = 0, monsters = [], t0 = Date.now();
for (let s = 1; s <= 400; s++) {
  const d = D.genDungeon(s * 7919, 1 + (s % 10));
  n++; maxW = Math.max(maxW, d.W); maxH = Math.max(maxH, d.H);
  const fights = d.rooms.filter(r => r.kind === 'fight').length; minFight = Math.min(minFight, fights); maxFight = Math.max(maxFight, fights);
  if (d.prisoner) prisoners++;
  const seen = D.djReach(d);
  for (const r of d.rooms) if (!r.cells.some(([x, y]) => seen[y * d.W + x])) unreachable++;
  if (!d.rooms.some(r => r.kind === 'boss') || !d.monsters.some(m => m.boss)) unreachable += 100;
  monsters.push(d.monsters.length);
}
const ms = Date.now() - t0;
ok(unreachable === 0, 'toutes les salles sont reliées à l’entrée, chaque donjon a son boss (400 donjons)');
ok(minFight >= 5 && maxFight <= 6, 'de 5 à 6 salles de combat (' + minFight + ' à ' + maxFight + ')');
ok(maxW <= 110 && maxH <= 90, 'taille maximale ' + maxW + ' × ' + maxH + ' cases');
const avg = monsters.reduce((x, y) => x + y, 0) / monsters.length;
ok(avg >= 20 && avg <= 40, 'en moyenne ' + avg.toFixed(1) + ' monstres par donjon');
ok(prisoners > 0 && prisoners < 80, 'prisonnier rare : ' + prisoners + ' donjons sur 400');
ok(ms < 2000, '400 donjons fabriqués en ' + ms + ' ms');
console.log(fails ? fails + ' échec(s).' : 'Tout est bon.');
process.exit(fails ? 1 : 0);
