/* ===================== RÈGLES DU VILLAGE COMMUN (pur, sans DOM) ===================== */
const VERSION = 1;               // version des données du nouveau jeu (dossier v2/ de la base)
const GRID = 24, EDGE = 2;
const COLORS = ['#D27A22', '#2F8A63', '#4A78C2', '#B24F78', '#8A67C6'];
const MIN = 60000, HOUR = 3600000, DAY = 24 * HOUR;
const SEASON_LEN = 2 * DAY;      // une saison dure 2 jours réels

/* ---------- ressources ---------- */
const RES = ['bois', 'pierre', 'ble', 'farine', 'pain', 'viande', 'orge', 'biere'];
const RES_LABEL = { bois: 'Bois', pierre: 'Pierre', ble: 'Blé', farine: 'Farine', pain: 'Pain', viande: 'Viande', orge: 'Orge', biere: 'Bière' };
const FOOD = ['pain', 'viande'];
const EAT_DAY = 24;              // rations mangées par villageois et par jour (une par heure)
/* Bière : servie à la taverne, chaque villageois en boit 3 par jour ; tant qu'il y en a, le moral monte. */
const BEER = { day: 3, mor: 8 };

/* ---------- saisons ---------- */
const SEASONS = [
  { name: 'Printemps', champ: 1, chasse: 1 },
  { name: 'Été', champ: 1.2, chasse: 1 },
  { name: 'Automne', champ: 1.4, chasse: 1 },
  { name: 'Hiver', champ: 0, chasse: 0.6, cold: true },
];
const seasonIdx = (v, t) => Math.floor(Math.max(0, t - v.born) / SEASON_LEN) % 4;
const seasonDay = (v, t) => Math.floor((Math.max(0, t - v.born) % SEASON_LEN) / DAY) + 1;
const nextSeasonAt = (v, t) => v.born + (Math.floor(Math.max(0, t - v.born) / SEASON_LEN) + 1) * SEASON_LEN;

/* ---------- spécialités des villageois, notées sur 10 ---------- */
const SPEC = ['buch', 'mine', 'agri', 'chasse', 'arti', 'constr'];
const SPEC_LABEL = { buch: 'Bûcheronnage', mine: 'Minage', agri: 'Agriculture', chasse: 'Chasse', arti: 'Artisanat', constr: 'Construction' };
const skillF = s => 0.5 + Math.max(1, Math.min(10, s | 0)) / 10;     // 1 → 60 %, 5 → 100 %, 10 → 150 %
const xpNeed = s => 6 * s;                                           // heures de travail pour passer à la note suivante

/* ---------- races, classes, caractères ---------- */
/* Race : apparence, bonus au village (spec : +25 % là où le héros travaille) et passif en combat.
   Les villageois ne sont que humains, nains ou elfes (VIL_RACES). */
const RACES = {
  humain: { name: 'Humain', fem: 'Humaine', plural: 'Humains', bonus: { constr: 1, agri: 1 }, spec: 'constr', desc: 'Polyvalent : bâtisseur et cultivateur.', passive: 'Apprend vite : +10 % d’expérience.' },
  nain: { name: 'Nain', fem: 'Naine', plural: 'Nains', bonus: { mine: 2 }, spec: 'mine', desc: 'Né dans la roche : excellent mineur.', passive: 'Robuste : +15 % de vie.' },
  elfe: { name: 'Elfe', fem: 'Elfe', plural: 'Elfes', bonus: { chasse: 2 }, spec: 'chasse', desc: 'Œil perçant : chasseur hors pair.', passive: 'Agile : se déplace et esquive mieux (+10 %).' },
  orque: { name: 'Orque', fem: 'Orque', plural: 'Orques', bonus: { buch: 2 }, spec: 'buch', desc: 'Force brute : abat les arbres comme personne.', passive: 'Rage : jusqu’à +25 % de dégâts quand il est blessé.' },
  halfelin: { name: 'Halfelin', fem: 'Halfeline', plural: 'Halfelins', bonus: { agri: 2 }, spec: 'agri', desc: 'Petit et malin : il a la main verte.', passive: 'Chanceux : plus de coups critiques et de meilleurs coffres.' },
  mortvivant: { name: 'Mort-vivant', fem: 'Morte-vivante', plural: 'Morts-vivants', bonus: { arti: 2 }, spec: 'arti', desc: 'Infatigable : un artisan patient (moulin, boulangerie, brasserie).', passive: 'Increvable : se relève une fois par donjon.' },
};
const RACE_KEYS = ['humain', 'nain', 'elfe', 'orque', 'halfelin', 'mortvivant'];
/* Classe : rôle en donjon, 3 compétences (niveaux 1, 3 et 5), 2 passifs (niveaux 4 et 7), 2 spécialisations (niveau 10). */
const CLASSES = {
  guerrier: { name: 'Guerrier', fem: 'Guerrière', role: 'Encaisse', desc: 'Au contact, il encaisse les coups et protège son allié.',
    skills: [['Charge', 'Fonce sur un ennemi et l’étourdit.'], ['Tourbillon', 'Frappe tout autour de lui.'], ['Cri de guerre', 'Attire les monstres sur lui et encaisse mieux.']],
    passives: [['Peau dure', '+10 % d’armure.'], ['Second souffle', 'Récupère un peu de vie à chaque monstre vaincu.']],
    specs: [['Berserker', 'Frappe plus fort, encaisse un peu moins.'], ['Protecteur', 'Encaisse encore mieux et protège son allié.']] },
  paladin: { name: 'Paladin', fem: 'Paladine', role: 'Encaisse et soigne', desc: 'Armure lourde et lumière sacrée : il frappe et se soigne.',
    skills: [['Marteau sacré', 'Frappe un ennemi et l’étourdit.'], ['Bouclier de lumière', 'Protège un allié des coups.'], ['Consécration', 'Une zone qui brûle les monstres et soigne.']],
    passives: [['Foi', '+10 % de soins.'], ['Aura', 'L’allié proche encaisse mieux.']],
    specs: [['Croisé', 'Plus de dégâts sacrés.'], ['Gardien', 'Des soins et des boucliers plus forts.']] },
  rodeur: { name: 'Rôdeur', fem: 'Rôdeuse', role: 'Tire de loin', desc: 'Arc ou arbalète : il frappe de loin.',
    skills: [['Roulade', 'Saute en arrière en tirant.'], ['Pluie de flèches', 'Blesse tout dans une zone.'], ['Tir perçant', 'Une flèche qui traverse une ligne d’ennemis.']],
    passives: [['Œil de faucon', '+10 % de portée.'], ['Pied léger', '+10 % de vitesse.']],
    specs: [['Tireur d’élite', 'Des tirs plus puissants.'], ['Dompteur', 'Un familier bien plus fort.']] },
  mage: { name: 'Mage', fem: 'Mage', role: 'Frappe en zone', desc: 'Feu et glace : il touche des groupes entiers.',
    skills: [['Boule de feu', 'Explose sur un groupe.'], ['Nova de glace', 'Gèle les monstres autour de lui.'], ['Téléportation', 'Se met à l’abri un peu plus loin.']],
    passives: [['Concentration', 'Ses compétences reviennent 10 % plus vite.'], ['Bouclier de mana', 'Encaisse 10 % de dégâts en moins.']],
    specs: [['Pyromancien', 'Le feu brûle plus longtemps.'], ['Cryomancien', 'La glace gèle plus longtemps.']] },
  voleur: { name: 'Voleur', fem: 'Voleuse', role: 'Frappe vite', desc: 'Dagues et ruses : il frappe vite au contact.',
    skills: [['Pas de l’ombre', 'Apparaît derrière un ennemi.'], ['Lames empoisonnées', 'Ses coups empoisonnent.'], ['Bombe fumigène', 'Devient invisible un instant.']],
    passives: [['Coups précis', '+10 % de coups critiques.'], ['Esquive', '+10 % de chances d’esquiver.']],
    specs: [['Assassin', 'Des coups critiques dévastateurs.'], ['Saboteur', 'Des pièges et des bombes.']] },
  pretre: { name: 'Prêtre', fem: 'Prêtresse', role: 'Soigne', desc: 'La lumière qui soigne et qui punit.',
    skills: [['Lumière sacrée', 'Soigne un héros.'], ['Châtiment', 'Frappe un ennemi de lumière.'], ['Prière', 'Soigne les deux héros.']],
    passives: [['Bénédiction', '+10 % de vie pour les deux héros.'], ['Ferveur', 'Soins +15 %.']],
    specs: [['Lumière', 'Des soins puissants.'], ['Ombre', 'Des dégâts d’ombre.']] },
  druide: { name: 'Druide', fem: 'Druidesse', role: 'Change de forme', desc: 'Il prend la forme d’un ours pour encaisser ou d’un loup pour frapper.',
    skills: [['Forme d’ours', 'Encaisse beaucoup mieux.'], ['Forme de loup', 'Frappe très vite.'], ['Racines', 'Immobilise les monstres.']],
    passives: [['Régénération', 'Récupère de la vie peu à peu.'], ['Instinct', '+10 % de dégâts en forme animale.']],
    specs: [['Gardien sauvage', 'L’ours devient un roc.'], ['Fauve', 'Le loup devient redoutable.']] },
  necro: { name: 'Nécromancien', fem: 'Nécromancienne', role: 'Invoque', desc: 'Il fait se battre des squelettes à sa place.',
    skills: [['Squelettes', 'Trois squelettes se battent pour lui.'], ['Drain de vie', 'Vole la vie d’un ennemi.'], ['Explosion de cadavre', 'Fait exploser un monstre vaincu.']],
    passives: [['Armée des morts', 'Squelettes +20 % de vie.'], ['Moisson', 'Chaque monstre vaincu recharge un peu ses compétences.']],
    specs: [['Maître des os', 'Plus de squelettes, plus solides.'], ['Faucheur', 'Drains et malédictions plus forts.']] },
};
const CLASS_KEYS = ['guerrier', 'paladin', 'rodeur', 'mage', 'voleur', 'pretre', 'druide', 'necro'];
const className = (cls, sex) => sex === 'f' && CLASSES[cls].fem ? CLASSES[cls].fem : CLASSES[cls].name;
/* Progression du héros, niveau par niveau (jusqu'au 10 pour l'instant). Chaque niveau : plus de vie et de dégâts, et 1 point de compétence. */
const HERO_MAX_LVL = 10;
const SKILL_LVLS = [1, 3, 5], PASSIVE_LVLS = [4, 7], SPEC_LVL = 10;
const LEVELS = { 1: '1re compétence', 2: '4e potion par donjon', 3: '2e compétence', 4: '1er passif de classe', 5: '3e compétence', 6: 'Le familier', 7: '2e passif de classe', 8: 'Emplacement du bijou', 9: '2 points de compétence d’un coup', 10: 'Spécialisation : 2 voies au choix' };
const heroXpNeed = lvl => Math.round(100 * Math.pow(lvl, 1.6));       // expérience pour passer au niveau suivant
/* Emplacements de héros par joueur : 1, plus 1 par niveau de taverne (4 au plus). */
const heroSlots = v => { const t = v.b.find(b => b.type === 'taverne' && b.lvl > 0); return Math.min(4, 1 + (t ? t.lvl : 0)); };
const heroesOf = (v, uid) => Object.values(v.heroes || {}).filter(h => h && h.own === uid).sort((a, b) => (a.n || 0) - (b.n || 0));
const activeHero = (v, uid) => { const m = v.members && v.members[uid], h = m && m.hero && v.heroes[m.hero]; return h && h.own === uid ? h : heroesOf(v, uid)[0] || null; };
const HERO_CAP = t => t === 'bat' ? 2 : 1;                             // héros au plus par bâtiment (2 sur les chantiers)
const TRAITS = {
  travailleur: { name: 'Travailleur', desc: 'Produit 15 % de plus.', prod: 1.15 },
  paresseux: { name: 'Paresseux', desc: 'Produit 15 % de moins.', prod: 0.85 },
  vif: { name: 'Vif d’esprit', desc: 'Progresse 50 % plus vite dans son métier.', xp: 1.5 },
  gourmand: { name: 'Gourmand', desc: 'Mange moitié plus que les autres.', eat: 1.5 },
  joyeux: { name: 'Joyeux', desc: 'Remonte le moral du village (+2).', mor: 2 },
  raleur: { name: 'Râleur', desc: 'Fait baisser le moral du village (−2).', mor: -2 },
};
const TRAIT_KEYS = Object.keys(TRAITS);
const NAMES = {
  humain: { m: ['Aldric', 'Corentin', 'Edmond', 'Gaspard', 'Jehan', 'Martin', 'Roland', 'Thibault', 'Bastien', 'Gauvain', 'Hugues', 'Mathis'], f: ['Brune', 'Doria', 'Faustine', 'Hélène', 'Isaure', 'Lise', 'Odile', 'Perrine', 'Sibylle', 'Ysabel', 'Mahaut', 'Agnès'] },
  nain: { m: ['Borak', 'Durgan', 'Korrin', 'Torvik', 'Bramdur', 'Hjalmar', 'Grumli', 'Orvik', 'Dorn', 'Baldrik', 'Hrolf', 'Thrugg'], f: ['Dagna', 'Helka', 'Magda', 'Ragna', 'Ulfa', 'Gerda', 'Brunhild', 'Ketta', 'Sigrun', 'Asta', 'Hilde', 'Runa'] },
  elfe: { m: ['Caelan', 'Elarion', 'Ilyas', 'Nimael', 'Thalion', 'Vaelis', 'Aerin', 'Faelor', 'Lorien', 'Saelan', 'Eryndil', 'Myrdin'], f: ['Aelith', 'Faelwen', 'Mirelle', 'Saelis', 'Yrene', 'Elowen', 'Ithil', 'Naeris', 'Sylvara', 'Lyra', 'Aeryn', 'Tirra'] },
};

/* ---------- bâtiments ---------- */
const BLD = {
  halle: { name: 'Halle du village', size: 3, max: 5, cost: { bois: 300, pierre: 200 }, mul: 2.4, work: 240, cat: 'vie', desc: 'Le cœur du village. L’agrandir débloque des bâtiments, des niveaux et plus de bâtisseurs.' },
  maison: { name: 'Maison', size: 2, max: 3, cost: { bois: 60, pierre: 20 }, mul: 1.8, work: 40, house: 3, cat: 'hab', desc: 'Loge 3 villageois, un de plus par niveau.' },
  bucheron: { name: 'Cabane de bûcheron', size: 2, max: 3, cost: { bois: 40 }, mul: 2, work: 30, spec: 'buch', jobs: 2, out: { bois: 14 }, job: 'Bûcheron', cat: 'prod', desc: 'Les bûcherons y coupent le bois de la forêt.' },
  carriere: { name: 'Carrière', size: 2, max: 3, cost: { bois: 60 }, mul: 2, work: 40, spec: 'mine', jobs: 2, out: { pierre: 10 }, job: 'Carrier', cat: 'prod', desc: 'On y taille la pierre de la montagne.' },
  champ: { name: 'Champ', size: 2, max: 3, cost: { bois: 30 }, mul: 2, work: 20, spec: 'agri', jobs: 2, out: { ble: 16 }, seasonal: 'champ', job: 'Fermier', cat: 'prod', desc: 'Donne du blé ou de l’orge (au choix), surtout en été et en automne. Rien en hiver.' },
  moulin: { name: 'Moulin', size: 2, max: 3, cost: { bois: 80, pierre: 40 }, mul: 2, work: 80, spec: 'arti', jobs: 1, inp: { ble: 12 }, out: { farine: 12 }, job: 'Meunier', hall: 2, cat: 'prod', desc: 'Moud le blé en farine.' },
  boulangerie: { name: 'Boulangerie', size: 2, max: 3, cost: { bois: 80, pierre: 60 }, mul: 2, work: 90, spec: 'arti', jobs: 1, inp: { farine: 10 }, out: { pain: 14 }, job: 'Boulanger', hall: 2, cat: 'prod', desc: 'Cuit la farine en pain, la meilleure nourriture du village.' },
  brasserie: { name: 'Brasserie', size: 2, max: 3, cost: { bois: 90, pierre: 50 }, mul: 2, work: 90, spec: 'arti', jobs: 1, inp: { orge: 8 }, out: { biere: 6 }, job: 'Brasseur', hall: 2, cat: 'prod', desc: 'Brasse l’orge en bière. Servie à la taverne, elle remonte le moral.' },
  chasse: { name: 'Pavillon de chasse', size: 2, max: 3, cost: { bois: 50 }, mul: 2, work: 40, spec: 'chasse', jobs: 2, out: { viande: 7 }, seasonal: 'chasse', job: 'Chasseur', cat: 'prod', desc: 'Les chasseurs rapportent de la viande, un peu moins en hiver.' },
  entrepot: { name: 'Entrepôt', size: 2, max: 3, cost: { bois: 100, pierre: 40 }, mul: 2, work: 60, store: 600, cat: 'stock', desc: '+600 de place par niveau, pour chaque ressource.' },
  taverne: { name: 'Taverne', size: 3, max: 3, cost: { bois: 150, pierre: 80 }, mul: 2.2, work: 120, mor: 10, hall: 2, cat: 'vie', desc: 'Remonte le moral, attire de nouveaux villageois, et c’est là qu’on fait la fête.' },
  banc: { name: 'Banc', size: 1, max: 1, cost: { bois: 20 }, work: 5, deco: 1, cat: 'deco', desc: 'Un peu de confort : +1 de moral.' },
  fleurs: { name: 'Parterre de fleurs', size: 1, max: 1, cost: { bois: 10, pierre: 5 }, work: 5, deco: 1, cat: 'deco', desc: 'Égaie le village : +1 de moral.' },
  fontaine: { name: 'Fontaine', size: 2, max: 1, cost: { pierre: 120 }, work: 60, deco: 4, hall: 2, cat: 'deco', desc: 'La fierté du village : +4 de moral.' },
  statue: { name: 'Statue', size: 1, max: 1, cost: { pierre: 80, bois: 20 }, work: 40, deco: 3, hall: 3, cat: 'deco', desc: 'Statue d’un héros de légende : +3 de moral.' },
};
const SHOP = ['maison', 'bucheron', 'carriere', 'champ', 'chasse', 'moulin', 'boulangerie', 'brasserie', 'entrepot', 'taverne', 'banc', 'fleurs', 'fontaine', 'statue'];
const CATS = [['hab', 'Habitations'], ['prod', 'Production'], ['stock', 'Réserves'], ['vie', 'Vie du village'], ['deco', 'Décorations']];
const LIMITS = {
  halle: [1, 1, 1, 1, 1],
  maison: [3, 5, 7, 9, 12], bucheron: [1, 2, 2, 3, 3], carriere: [1, 1, 2, 2, 3], champ: [2, 3, 4, 5, 6],
  moulin: [0, 1, 1, 2, 2], boulangerie: [0, 1, 1, 2, 2], brasserie: [0, 1, 1, 1, 2], chasse: [1, 1, 2, 2, 3], entrepot: [1, 1, 2, 2, 3],
  taverne: [0, 1, 1, 1, 1], banc: [2, 4, 6, 8, 10], fleurs: [4, 8, 12, 16, 20], fontaine: [0, 1, 1, 2, 2], statue: [0, 0, 1, 2, 3],
};
const DECO_MAX = 15;             // le moral apporté par les décorations est plafonné
const FEAST = { cost: { pain: 30, viande: 30, biere: 20 }, mor: 15, len: DAY, cd: 3 * DAY };

/* ---------- outils ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clone = o => JSON.parse(JSON.stringify(o));
const r2 = x => Math.round(x * 100) / 100;

/* ---------- bâtiments : coûts, places, emplois ---------- */
function costOf(type, toLvl) { const d = BLD[type], c = {}; let m = 1; for (let i = 1; i < toLvl; i++) m *= d.mul || 2; for (const k in d.cost) c[k] = Math.round(d.cost[k] * m / 5) * 5; return c; }
function workOf(type, toLvl) { let m = 1; for (let i = 1; i < toLvl; i++) m *= 2; return Math.round(BLD[type].work * m); }
const hallLvl = v => { const h = v.b.find(b => b.type === 'halle'); return h ? Math.max(1, h.lvl) : 1; };
const maxLvlOf = (type, hl) => type === 'halle' ? BLD.halle.max : Math.min(BLD[type].max, hl + 1);
const limitOf = (type, hl) => LIMITS[type][Math.max(1, Math.min(5, hl)) - 1];
const countOf = (v, type) => v.b.filter(b => b.type === type).length;
const jobsOf = b => BLD[b.type].jobs ? BLD[b.type].jobs + (b.lvl - 1) : 0;
/* Ce que produit un bâtiment : un champ donne la culture qu'on y a semée (blé par défaut). */
const cropOf = b => b.crop === 'orge' ? 'orge' : 'ble';
const outOf = b => b.type === 'champ' ? { [cropOf(b)]: BLD.champ.out.ble } : BLD[b.type].out;
const hasTavern = v => v.b.some(b => b.type === 'taverne' && b.lvl > 0);
const lvlMul = lvl => 1 + 0.15 * (Math.max(1, lvl) - 1);
const houseOf = b => BLD[b.type].house && b.lvl > 0 ? BLD[b.type].house + (b.lvl - 1) : 0;
const housingOf = v => v.b.reduce((a, b) => a + houseOf(b), 0);
const capOf = v => 400 + 200 * hallLvl(v) + v.b.reduce((a, b) => a + (BLD[b.type].store && b.lvl > 0 ? BLD[b.type].store * b.lvl : 0), 0);
const buildersMax = v => 2 + hallLvl(v);
const sitesMax = v => 1 + Math.ceil(hallLvl(v) / 2);
const sites = v => v.b.filter(b => b.up).sort((a, b) => a.up.q - b.up.q);
const workersOf = (v, id) => v.vil.filter(p => p.job === id);
const builders = v => v.vil.filter(p => p.job === 'bat');
const foodOf = v => FOOD.reduce((a, k) => a + (v.r[k] || 0), 0);
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
function missingTxt(v, c) {
  const miss = RES.filter(k => (c[k] || 0) > (v.r[k] || 0));
  if (!miss.length) return '';
  return 'Il manque ' + miss.map(k => Math.ceil(c[k] - (v.r[k] || 0)) + ' de ' + RES_LABEL[k].toLowerCase()).join(' et ') + '.';
}
function pay(v, c) { for (const k in c) v.r[k] = Math.max(0, (v.r[k] || 0) - c[k]); }
function addLog(v, t, m, k) { v.log.push({ t: Math.round(t), m, k: k || '' }); if (v.log.length > 60) v.log.splice(0, v.log.length - 60); }

/* ---------- moral (0 à 100) ---------- */
function moraleParts(v, t) {
  const out = [];
  const tav = v.b.find(b => b.type === 'taverne' && b.lvl > 0);
  if (tav) out.push(['Taverne', BLD.taverne.mor + 4 * (tav.lvl - 1)]);
  if (tav && (v.r.biere || 0) >= 1) out.push(['Bière à la taverne', BEER.mor]);
  let deco = 0; for (const b of v.b) if (BLD[b.type].deco && b.lvl > 0) deco += BLD[b.type].deco;
  if (deco) out.push(['Décorations', Math.min(DECO_MAX, deco)]);
  const food = foodOf(v);
  if ((v.r.pain || 0) >= 1 && (v.r.viande || 0) >= 1) out.push(['Repas variés', 10]);
  if (food < 1) out.push(['Plus rien à manger', -25]);
  else if (v.hunger > 0) out.push(['Faim récente', -10]);
  let tr = 0; for (const p of v.vil) tr += TRAITS[p.tr] && TRAITS[p.tr].mor || 0;
  if (tr) out.push(['Caractères', tr]);
  if (v.feast > t) out.push(['Fête à la taverne', FEAST.mor]);
  return out;
}
const moraleOf = (v, t) => Math.max(0, Math.min(100, 50 + moraleParts(v, t).reduce((a, p) => a + p[1], 0)));
const moraleF = m => 0.75 + m / 200;                                  // 0 → 75 %, 50 → 100 %, 100 → 125 %

/* ---------- objectifs du village : trois à la fois, dans l'ordre, chacun avec sa récompense ---------- */
const built = (v, type) => v.b.filter(b => b.type === type && b.lvl > 0).length;
const cntOf = (v, k) => (v.cnt && v.cnt[k]) || 0;
function bestInJob(v) {
  let m = 0;
  for (const p of v.vil) {
    const b = p.job === 'bat' ? null : p.job != null && v.b.find(x => x.id === p.job);
    const s = p.job === 'bat' ? 'constr' : b ? BLD[b.type].spec : null;
    if (s) m = Math.max(m, p.st[s]);
  }
  return m;
}
const GOALS = [
  { id: 'carriere', name: 'Une carrière', txt: 'Construire une carrière, pour avoir de la pierre.', prog: v => [built(v, 'carriere'), 1], rew: { bois: 60 } },
  { id: 'maisons', name: 'Trois maisons', txt: 'Avoir trois maisons construites.', prog: v => [built(v, 'maison'), 3], rew: { pierre: 40 } },
  { id: 'accueil', name: 'Un nouveau visage', txt: 'Accueillir un voyageur au village.', prog: v => [cntOf(v, 'acc'), 1], rew: { viande: 40 } },
  { id: 'halle2', name: 'La halle grandit', txt: 'Agrandir la halle du village au niveau 2.', prog: v => [hallLvl(v), 2], rew: { bois: 150, pierre: 100 } },
  { id: 'pain', name: 'Du pain pour tous', txt: 'Construire un moulin et une boulangerie.', prog: v => [Math.min(1, built(v, 'moulin')) + Math.min(1, built(v, 'boulangerie')), 2], rew: { pain: 60 } },
  { id: 'taverne', name: 'La taverne', txt: 'Construire la taverne.', prog: v => [built(v, 'taverne'), 1], rew: { bois: 100, pierre: 60 } },
  { id: 'biere', name: 'Santé !', txt: 'Semer de l’orge dans un champ et construire une brasserie.', prog: v => [(v.b.some(b => b.type === 'champ' && b.lvl > 0 && b.crop === 'orge') ? 1 : 0) + Math.min(1, built(v, 'brasserie')), 2], rew: { orge: 40 } },
  { id: 'pop8', name: 'Huit villageois', txt: 'Loger huit villageois.', prog: v => [v.vil.length, 8], rew: { bois: 120, pierre: 60 } },
  { id: 'hiver', name: 'Un hiver sans famine', txt: 'Passer un hiver entier sans que personne n’ait faim.', prog: v => [cntOf(v, 'win'), 1], rew: { pain: 80, bois: 100 } },
  { id: 'fete', name: 'Une grande fête', txt: 'Offrir une fête à la taverne.', prog: v => [cntOf(v, 'fete'), 1], rew: { pierre: 100 } },
  { id: 'deco', name: 'Un village coquet', txt: 'Avoir cinq décorations (bancs, fleurs, fontaine, statue).', prog: v => [v.b.filter(b => BLD[b.type].deco && b.lvl > 0).length, 5], rew: { pierre: 80 } },
  { id: 'entrepot', name: 'De la place', txt: 'Agrandir un entrepôt au niveau 2.', prog: v => [v.b.some(b => b.type === 'entrepot' && b.lvl >= 2) ? 1 : 0, 1], rew: { bois: 120 } },
  { id: 'maitre', name: 'Un maître', txt: 'Un villageois atteint 10/10 dans son métier.', prog: v => [bestInJob(v), 10], rew: { bois: 150, pierre: 150 } },
  { id: 'halle3', name: 'Une vraie bourgade', txt: 'Agrandir la halle du village au niveau 3.', prog: v => [hallLvl(v), 3], rew: { bois: 300, pierre: 200 } },
  { id: 'pop12', name: 'Douze villageois', txt: 'Loger douze villageois.', prog: v => [v.vil.length, 12], rew: { pain: 100, viande: 100 } },
  { id: 'fetes3', name: 'Le village en fête', txt: 'Offrir trois fêtes à la taverne.', prog: v => [cntOf(v, 'fete'), 3], rew: { biere: 60 } },
  { id: 'halle4', name: 'Une petite ville', txt: 'Agrandir la halle du village au niveau 4.', prog: v => [hallLvl(v), 4], rew: { bois: 500, pierre: 350 } },
  { id: 'pop16', name: 'Seize villageois', txt: 'Loger seize villageois.', prog: v => [v.vil.length, 16], rew: { pain: 150, viande: 150 } },
  { id: 'hivers3', name: 'Trois hivers sans famine', txt: 'Passer trois hivers sans que personne n’ait faim.', prog: v => [cntOf(v, 'win'), 3], rew: { bois: 300, pierre: 300 } },
  { id: 'halle5', name: 'La capitale de la vallée', txt: 'Agrandir la halle du village au niveau 5.', prog: v => [hallLvl(v), 5], rew: { bois: 800, pierre: 600 } },
];
const GOAL_BY = Object.fromEntries(GOALS.map(g => [g.id, g]));
const goalsOf = v => GOALS.filter(g => !(v.goals || []).includes(g.id)).slice(0, 3);
const goalProg = (v, g) => { const [c, n] = g.prog(v); return [Math.min(c, n), n]; };
const goalDone = (v, g) => { const [c, n] = g.prog(v); return c >= n; };
const rewTxt = r => Object.keys(r).map(k => '+' + r[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', ');

/* ---------- héros ---------- */
/* Un héros affecté à un bâtiment : +25 % si c'est la spécialité de sa race, sinon +10 %. */
function heroBonus(v, target, spec) {
  let k = 1;
  for (const h of Object.values(v.heroes || {})) {
    if (!h || h.at !== target) continue;
    k += RACES[h.race] && RACES[h.race].spec === spec ? 0.25 : 0.10;
  }
  return k;
}
const heroesAt = (v, target) => Object.values(v.heroes || {}).filter(h => h && h.at === target);
/* Rang d'une compétence (0 = pas encore ouverte, puis 1 à 5) ; points dépensés dans hero.sk = { s0, s1, s2 }. */
const skillRank = (h, i) => h.lvl >= SKILL_LVLS[i] ? 1 + Math.max(0, Math.min(4, (h.sk && h.sk['s' + i]) | 0)) : 0;
const DJ_XP_CAP = lvl => Math.round(1500 * (1 + 0.25 * (lvl - 1)));      // garde-fou : expérience maximale d'un donjon
/* Prisonnier délivré : un villageois expérimenté (9 dans sa spécialité, au moins 5 ailleurs) qui voudrait s'installer. */
function prisonerOf(v, t) {
  const taken = new Set(v.vil.map(x => x.name).concat(v.cands.map(x => x.name)));
  const p = genVillager(hash((v.seed ^ Math.imul(v.nid + 13, 2654435761)) >>> 0), t, v.nid++, taken);
  const fav = bestSpec(p);
  for (const s of SPEC) p.st[s] = Math.max(p.st[s], 5);
  p.st[fav] = Math.max(p.st[fav], 9); p.pris = 1;
  return p;
}

/* ---------- villageois ---------- */
function genVillager(seed, t, id, taken) {
  const R = mulberry32(seed);
  const x = R(), race = x < 0.45 ? 'humain' : x < 0.75 ? 'nain' : 'elfe';
  const sex = R() < 0.5 ? 'm' : 'f';
  const list = NAMES[race][sex];
  let name = list[Math.floor(R() * list.length)];
  for (let i = 0; i < list.length && taken && taken.has(name); i++) name = list[(list.indexOf(name) + 1) % list.length];
  const tr = TRAIT_KEYS[Math.floor(R() * TRAIT_KEYS.length)];
  const st = {};
  for (const s of SPEC) st[s] = 1 + Math.floor(R() * 4);
  const fav = R() < 0.4 && RACES[race].spec ? RACES[race].spec : SPEC[Math.floor(R() * SPEC.length)];
  st[fav] = 5 + Math.floor(R() * 4);
  for (const s in RACES[race].bonus) st[s] = Math.min(10, st[s] + RACES[race].bonus[s]);
  const xp = {}; for (const s of SPEC) xp[s] = 0;
  return { id, name, race, sex, tr, st, xp, job: null, t: Math.round(t), fav };
}
const bestSpec = p => SPEC.reduce((a, s) => (p.st[s] > p.st[a] ? s : a), SPEC[0]);
const raceName = (race, sex) => sex === 'f' ? RACES[race].fem : RACES[race].name;
function jobName(v, p) {
  if (p.job === 'bat') return 'Bâtisseur';
  const b = p.job != null && v.b.find(x => x.id === p.job);
  return b ? BLD[b.type].job : 'Sans emploi';
}
function freeHousing(v) { return housingOf(v) - v.vil.length; }

/* ---------- nouveau village ---------- */
function newVillage(vid, name, col, t, uid, pname) {
  const seed = (hash(Math.floor(t / 1000) % 2147483647) ^ hashStr(vid)) >>> 0;
  const v = {
    v: VERSION, vid, name, c: col, born: t, t, seed, tick: 0, nid: 1, q: 0,
    members: { [uid]: { name: pname, t, hi: 1 } }, heroes: {},
    r: { bois: 160, pierre: 80, ble: 0, farine: 0, pain: 60, viande: 40, orge: 0, biere: 0 },
    b: [], vil: [], cands: [], log: [], hunger: 0, feast: 0, feastCd: 0, ws: seasonIdx({ born: t }, t),
    goals: [], cnt: { acc: 0, fete: 0, win: 0 }, wok: 0,
  };
  const add = (type, gx, gz) => { const b = { id: v.nid++, type, lvl: 1, gx, gz, up: null }; v.b.push(b); return b; };
  add('halle', 10, 10);
  add('maison', 7, 7); add('maison', 14, 7);
  const bu = add('bucheron', 5, 13), ch = add('champ', 15, 14), cs = add('chasse', 6, 17);
  add('entrepot', 14, 11);
  const taken = new Set();
  for (let i = 0; i < 4; i++) { const p = genVillager(hash(seed ^ (i + 1) * 7919), t, v.nid++, taken); taken.add(p.name); v.vil.push(p); }
  /* Chacun prend le métier où il est le meilleur parmi ceux disponibles. */
  const slots = [[bu.id, 'buch'], [ch.id, 'agri'], [cs.id, 'chasse'], ['bat', 'constr']];
  const free = v.vil.slice();
  for (const [job, s] of slots) { free.sort((a, b) => b.st[s] - a.st[s]); const p = free.shift(); if (p) p.job = job; }
  addLog(v, t, pname + ' fonde le village de ' + name + '.', 'found');
  return v;
}

/* ---------- simulation, minute par minute (identique sur les deux téléphones) ---------- */
function stepVillage(v) {
  const t = v.t, h = 1 / 60, cap = capOf(v), si = seasonIdx(v, t), S = SEASONS[si];
  const mor = moraleOf(v, t), mf = moraleF(mor);
  const add = (k, n) => { v.r[k] = Math.min(Math.max(cap, v.r[k] || 0), (v.r[k] || 0) + n); };
  /* Saison qui change */
  if (si !== v.ws) {
    const prev = v.ws, warm = prev === 3 && si === 0 && v.wok;
    v.ws = si;
    if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 };
    if (warm) v.cnt.win = (v.cnt.win || 0) + 1;
    v.wok = S.cold ? 1 : 0;                        // début de l'hiver : réussi tant que personne n'a faim
    addLog(v, t, S.name + ' arrive sur la vallée.' + (S.cold ? ' Les champs dorment : pensez aux réserves de nourriture.' : si === 0 ? ' Les champs repartent.' + (warm ? ' L’hiver s’est passé sans famine : bravo !' : '') : ''), 'season');
  }
  /* Production */
  for (const b of v.b) {
    const d = BLD[b.type]; if (!d.spec || b.lvl < 1) continue;
    const ws = workersOf(v, b.id); if (!ws.length) continue;
    const sf = d.seasonal ? S[d.seasonal] : 1;
    if (sf <= 0) continue;
    const hb = heroBonus(v, b.id, d.spec);
    let k = 0;
    for (const p of ws) {
      const tr = TRAITS[p.tr] || {};
      k += skillF(p.st[d.spec]) * (tr.prod || 1);
      /* Il progresse en pratiquant */
      p.xp[d.spec] = r2((p.xp[d.spec] || 0) + h * (tr.xp || 1));
      if (p.st[d.spec] < 10 && p.xp[d.spec] >= xpNeed(p.st[d.spec])) {
        p.xp[d.spec] = r2(p.xp[d.spec] - xpNeed(p.st[d.spec])); p.st[d.spec] += 1;
        addLog(v, t, p.name + ' progresse : ' + SPEC_LABEL[d.spec].toLowerCase() + ' ' + p.st[d.spec] + '/10.', 'skill');
      }
    }
    let f = k * lvlMul(b.lvl) * mf * sf * hb * h;
    if (d.inp) for (const r in d.inp) { const need = d.inp[r] * f; if (need > 0 && (v.r[r] || 0) < need) f *= (v.r[r] || 0) / need; }
    if (f <= 0) continue;
    for (const r in (d.inp || {})) v.r[r] = Math.max(0, (v.r[r] || 0) - d.inp[r] * f);
    const out = outOf(b);
    for (const r in out) add(r, out[r] * f);
  }
  /* Chantiers : les bâtisseurs se partagent entre les chantiers ouverts */
  const open = sites(v).slice(0, sitesMax(v));
  if (open.length) {
    let work = 15;                                   // sans bâtisseur, ça avance quand même un peu
    for (const p of builders(v)) {
      const tr = TRAITS[p.tr] || {};
      work += 60 * skillF(p.st.constr) * (tr.prod || 1);
      p.xp.constr = r2((p.xp.constr || 0) + h * (tr.xp || 1));
      if (p.st.constr < 10 && p.xp.constr >= xpNeed(p.st.constr)) { p.xp.constr = r2(p.xp.constr - xpNeed(p.st.constr)); p.st.constr += 1; addLog(v, t, p.name + ' progresse : construction ' + p.st.constr + '/10.', 'skill'); }
    }
    work *= mf * heroBonus(v, 'bat', 'constr') * h / open.length;
    for (const b of open) {
      b.up.done = r2(b.up.done + work);
      if (b.up.done >= b.up.need) {
        b.lvl = b.up.to; b.up = null;
        addLog(v, t, (b.lvl > 1 ? BLD[b.type].name + ' agrandi(e) au niveau ' + b.lvl : BLD[b.type].name + ' terminé(e)') + '.', 'built');
      }
    }
  }
  /* Repas : moitié pain, moitié viande quand c'est possible */
  let eat = 0; for (const p of v.vil) eat += EAT_DAY * ((TRAITS[p.tr] || {}).eat || 1);
  eat = eat / 1440;
  if (eat > 0) {
    const half = eat / 2;
    let a = Math.min(v.r.pain || 0, half), c = Math.min(v.r.viande || 0, half);
    let rest = eat - a - c;
    if (rest > 0) { const a2 = Math.min((v.r.pain || 0) - a, rest); a += a2; rest -= a2; }
    if (rest > 0) { const c2 = Math.min((v.r.viande || 0) - c, rest); c += c2; rest -= c2; }
    v.r.pain = Math.max(0, (v.r.pain || 0) - a); v.r.viande = Math.max(0, (v.r.viande || 0) - c);
    if (rest > 1e-9) { v.hunger = Math.min(3 * 1440, (v.hunger || 0) + 1); if (S.cold) v.wok = 0; }
    else if (v.hunger > 0) v.hunger = Math.max(0, v.hunger - 0.5);
  }
  /* Bière : on la boit à la taverne */
  if ((v.r.biere || 0) > 0 && v.vil.length && hasTavern(v)) v.r.biere = Math.max(0, v.r.biere - v.vil.length * BEER.day / 1440);
  /* Famine : au bout d'un jour sans manger, quelqu'un s'en va */
  if (v.hunger >= 1440 && v.vil.length) {
    const p = v.vil.slice().sort((x, y) => SPEC.reduce((a, s) => a + x.st[s], 0) - SPEC.reduce((a, s) => a + y.st[s], 0))[0];
    v.vil = v.vil.filter(x => x !== p); v.hunger = 720;
    addLog(v, t, p.name + ' quitte le village : on n’y mange plus à sa faim.', 'leave');
  }
  /* Arrivées : quelqu'un se présente s'il y a de la place, à manger et un bon moral */
  v.cands = v.cands.filter(c => { if (t - c.t > DAY) { addLog(v, t, c.name + ' n’a pas eu de réponse et repart.', 'cand'); return false; } return true; });
  if (v.cands.length < 3 && freeHousing(v) - v.cands.length > 0 && foodOf(v) >= 10 && mor >= 30) {
    const tav = v.b.some(b => b.type === 'taverne' && b.lvl > 0);
    const p = 0.12 / 60 * (tav ? 1.5 : 1) * (mor / 50);
    const roll = hash((v.seed ^ Math.imul(v.tick + 1, 2654435761)) >>> 0) / 4294967296;
    if (roll < p) {
      const taken = new Set(v.vil.map(x => x.name).concat(v.cands.map(x => x.name)));
      const c = genVillager(hash(v.seed ^ Math.imul(v.tick + 7, 40503)), t, v.nid++, taken);
      v.cands.push(c);
      addLog(v, t, c.name + ' (' + raceName(c.race, c.sex).toLowerCase() + ') voudrait s’installer au village.', 'cand');
    }
  }
}
/* N'avance que par minutes entières : peu importe qui simule et quand, le résultat est le même. */
function simulateVillage(v, now) {
  if (now - v.t > 14 * DAY) { const skip = Math.floor((now - 14 * DAY - v.t) / MIN); v.t += skip * MIN; v.tick += skip; }
  while (v.t + MIN <= now) { stepVillage(v); v.t += MIN; v.tick += 1; }
  return v;
}

/* Production et consommation par heure, pour l'affichage. */
function ratesOf(v, t) {
  const out = {}; for (const k of RES) out[k] = 0;
  const S = SEASONS[seasonIdx(v, t)], mf = moraleF(moraleOf(v, t));
  for (const b of v.b) {
    const d = BLD[b.type]; if (!d.spec || b.lvl < 1) continue;
    const ws = workersOf(v, b.id); if (!ws.length) continue;
    const sf = d.seasonal ? S[d.seasonal] : 1;
    let k = 0; for (const p of ws) k += skillF(p.st[d.spec]) * ((TRAITS[p.tr] || {}).prod || 1);
    const f = k * lvlMul(b.lvl) * mf * sf * heroBonus(v, b.id, d.spec), o = outOf(b);
    for (const r in (d.inp || {})) out[r] -= d.inp[r] * f;
    for (const r in o) out[r] += o[r] * f;
  }
  let eat = 0; for (const p of v.vil) eat += EAT_DAY * ((TRAITS[p.tr] || {}).eat || 1) / 24;
  out.food = -eat;
  if (hasTavern(v)) out.biere -= v.vil.length * BEER.day / 24;
  return out;
}
/* Travail des bâtisseurs par heure et par chantier ouvert (pour estimer la fin des travaux). */
function siteRate(v, t) {
  const open = sites(v).slice(0, sitesMax(v));
  let work = 15;
  for (const p of builders(v)) work += 60 * skillF(p.st.constr) * ((TRAITS[p.tr] || {}).prod || 1);
  work *= moraleF(moraleOf(v, t)) * heroBonus(v, 'bat', 'constr');
  return { open, perSite: open.length ? work / open.length : work };
}
/* Rendement d'un bâtiment par heure (pour son panneau). */
function bldRate(v, b, t) {
  const d = BLD[b.type]; if (!d.spec || b.lvl < 1) return null;
  const S = SEASONS[seasonIdx(v, t)], mf = moraleF(moraleOf(v, t)), sf = d.seasonal ? S[d.seasonal] : 1;
  let k = 0; for (const p of workersOf(v, b.id)) k += skillF(p.st[d.spec]) * ((TRAITS[p.tr] || {}).prod || 1);
  const f = k * lvlMul(b.lvl) * mf * sf * heroBonus(v, b.id, d.spec), o = {}, base = outOf(b);
  for (const r in base) o[r] = base[r] * f;
  return o;
}

/* ---------- actions partagées : appliquées dans une transaction, sur l'état le plus récent ---------- */
function applyV(v, a, who) {
  const fail = err => ({ ok: false, err });
  const t = v.t, hl = hallLvl(v), nm = (v.members[who.uid] && v.members[who.uid].name) || who.name || 'Quelqu’un';
  switch (a.type) {
    case 'sync': return { ok: true };            // simple mise à jour de l'heure du village
    case 'join': {
      /* Le second joueur s'est inscrit lui-même dans members : on l'annonce une seule fois. */
      const m = v.members[who.uid]; if (!m) return fail('Tu ne fais pas partie de ce village.');
      if (m.hi) return { ok: true };
      m.hi = 1;
      addLog(v, t, m.name + ' rejoint le village.', 'join');
      return { ok: true };
    }
    case 'hero': {
      /* Nouveau héros : 1 emplacement au départ, puis 1 de plus par niveau de taverne (4 au plus). */
      if (!v.members[who.uid]) return fail('Tu ne fais pas partie de ce village.');
      const mine = heroesOf(v, who.uid);
      if (mine.length >= heroSlots(v)) return fail(mine.length >= 4 ? 'Tu as déjà 4 héros, le maximum.' : 'Plus de place : agrandissez la taverne pour loger un héros de plus.');
      if (!RACES[a.race] || !CLASSES[a.cls]) return fail('Choisis une race et une classe.');
      const name = String(a.name || '').trim().slice(0, 18); if (!name) return fail('Donne un nom à ton héros.');
      const n = v.nid++, id = 'h' + n, sex = a.sex === 'f' ? 'f' : 'm';
      v.heroes[id] = { id, n, own: who.uid, name, race: a.race, cls: a.cls, sex, col: COLORS.includes(a.col) ? a.col : COLORS[0], lvl: 1, xp: 0, sp: 0, sk: {}, spec: null, at: null, dj: 1 };
      if (!activeHero(v, who.uid) || !v.members[who.uid].hero) v.members[who.uid].hero = id;
      addLog(v, t, name + ', ' + raceName(a.race, sex).toLowerCase() + ' ' + className(a.cls, sex).toLowerCase() + ', ' + (mine.length ? 'rejoint la compagnie de ' + nm : 'arrive au village') + '.', 'hero');
      return { ok: true, id };
    }
    case 'heroAct': {
      /* Le héros qui part en donjon (on le choisit à la taverne). */
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      v.members[who.uid].hero = hh.id;
      return { ok: true };
    }
    case 'build': {
      const d = BLD[a.b]; if (!d || a.b === 'halle') return fail('Bâtiment inconnu.');
      if ((d.hall || 1) > hl) return fail('Il faut une halle du village de niveau ' + d.hall + '.');
      if (countOf(v, a.b) >= limitOf(a.b, hl)) return fail('Nombre maximum atteint : agrandissez la halle pour en construire plus.');
      if (!fits(v, a.b, a.gx, a.gz)) return fail('Emplacement occupé ou trop près du bord.');
      const c = costOf(a.b, 1), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const b = { id: v.nid++, type: a.b, lvl: 0, gx: a.gx, gz: a.gz, up: { to: 1, need: workOf(a.b, 1), done: 0, q: ++v.q } };
      if (a.b === 'champ') b.crop = a.crop === 'orge' ? 'orge' : 'ble';
      v.b.push(b);
      addLog(v, t, nm + ' lance un chantier : ' + d.name.toLowerCase() + '.', 'site');
      return { ok: true, id: b.id };
    }
    case 'upgrade': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (b.up) return fail('Les travaux sont déjà en cours.');
      const to = b.lvl + 1, mx = maxLvlOf(b.type, hl);
      if (to > mx) return fail(to > BLD[b.type].max ? 'Niveau maximum atteint.' : 'Agrandissez d’abord la halle du village.');
      const c = costOf(b.type, to), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); b.up = { to, need: workOf(b.type, to), done: 0, q: ++v.q };
      addLog(v, t, nm + ' lance l’agrandissement : ' + BLD[b.type].name.toLowerCase() + ' niveau ' + to + '.', 'site');
      return { ok: true };
    }
    case 'move': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (!fits(v, b.type, a.gx, a.gz, b.id)) return fail('Emplacement occupé ou trop près du bord.');
      b.gx = a.gx; b.gz = a.gz;
      return { ok: true };
    }
    case 'demolish': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (b.type === 'halle') return fail('On ne démolit pas la halle.');
      if (houseOf(b) && housingOf(v) - houseOf(b) < v.vil.length) return fail('Des villageois y logent : il n’y aurait plus assez de place.');
      v.b = v.b.filter(x => x !== b);
      for (const p of v.vil) if (p.job === b.id) p.job = null;
      for (const hh of Object.values(v.heroes)) if (hh && hh.at === b.id) hh.at = null;
      addLog(v, t, nm + ' démolit : ' + BLD[b.type].name.toLowerCase() + '.', 'demolish');
      return { ok: true };
    }
    case 'job': {
      const p = v.vil.find(x => x.id === a.vid); if (!p) return fail('Villageois introuvable.');
      if (a.to === p.job) return { ok: true };
      if (a.to === 'bat') {
        if (builders(v).length >= buildersMax(v)) return fail('Pas plus de ' + buildersMax(v) + ' bâtisseurs avec cette halle.');
      } else if (a.to != null) {
        const b = v.b.find(x => x.id === a.to);
        if (!b || !BLD[b.type].spec) return fail('Ce bâtiment n’offre pas de travail.');
        if (b.lvl < 1) return fail('Le bâtiment n’est pas encore construit.');
        if (workersOf(v, b.id).length >= jobsOf(b)) return fail('Plus de place : agrandissez le bâtiment.');
      }
      p.job = a.to == null ? null : a.to;
      return { ok: true };
    }
    case 'accept': {
      const i = v.cands.findIndex(c => c.id === a.id); if (i < 0) return fail('Cette personne est déjà repartie.');
      if (freeHousing(v) <= 0) return fail('Plus de place dans les maisons : construisez-en une.');
      const c = v.cands.splice(i, 1)[0];
      c.t = t; c.xp = {}; for (const s of SPEC) c.xp[s] = 0; c.job = null;
      v.vil.push(c);
      if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 };
      v.cnt.acc = (v.cnt.acc || 0) + 1;
      addLog(v, t, nm + ' accueille ' + c.name + ' au village.', 'arrive');
      return { ok: true, name: c.name };
    }
    case 'refuse': {
      const i = v.cands.findIndex(c => c.id === a.id); if (i < 0) return { ok: true };
      const c = v.cands.splice(i, 1)[0];
      addLog(v, t, c.name + ' reprend la route.', 'cand');
      return { ok: true };
    }
    case 'heroAt': {
      /* Affecter un de ses héros (le héros actif si aucun n'est précisé) : 1 héros par bâtiment, 2 sur les chantiers. */
      const hh = a.hid ? v.heroes[a.hid] : activeHero(v, who.uid);
      if (!hh) return fail('Crée d’abord ton héros.');
      if (hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      if (a.to != null && a.to !== 'bat') {
        const b = v.b.find(x => x.id === a.to);
        if (!b || !BLD[b.type].spec || b.lvl < 1) return fail('Ton héros ne peut pas aider ici.');
      }
      if (a.to != null && a.to !== hh.at && heroesAt(v, a.to).filter(x => x.id !== hh.id).length >= HERO_CAP(a.to)) return fail(a.to === 'bat' ? 'Déjà deux héros sur les chantiers.' : 'Un héros travaille déjà ici.');
      hh.at = a.to == null ? null : a.to;
      return { ok: true };
    }
    case 'feast': {
      if (!v.b.some(b => b.type === 'taverne' && b.lvl > 0)) return fail('Il faut une taverne pour faire la fête.');
      if (v.feastCd > t) return fail('Prochaine fête possible dans quelques temps.');
      const m = missingTxt(v, FEAST.cost); if (m) return fail(m);
      pay(v, FEAST.cost); v.feast = t + FEAST.len; v.feastCd = t + FEAST.cd;
      if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 };
      v.cnt.fete = (v.cnt.fete || 0) + 1;
      addLog(v, t, nm + ' offre une fête à la taverne : tout le village est de bonne humeur !', 'feast');
      return { ok: true };
    }
    case 'crop': {
      const b = v.b.find(x => x.id === a.id); if (!b || b.type !== 'champ') return fail('Ce n’est pas un champ.');
      if (a.c !== 'ble' && a.c !== 'orge') return fail('Culture inconnue.');
      if (cropOf(b) === a.c) return { ok: true };
      b.crop = a.c;
      addLog(v, t, nm + ' sème ' + (a.c === 'orge' ? 'de l’orge' : 'du blé') + ' dans un champ.', 'crop');
      return { ok: true };
    }
    case 'djEnd': {
      /* Retour de donjon : expérience (et niveaux) pour le héros, butin pour le village, niveau suivant ouvert, prisonnier délivré. */
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      const L = Math.max(1, Math.min(99, a.lvl | 0)), win = !!a.win, th = a.theme === 'crypte' || a.theme === 'prof' ? a.theme : 'mine', deep = Math.max(0, Math.min(200, a.deep | 0));
      let xp = Math.max(0, Math.min(DJ_XP_CAP(L) * (th === 'prof' ? 1 + deep : 1), Math.round(+a.xp || 0)));
      if (hh.race === 'humain') xp = Math.round(xp * 1.1);                 // Apprend vite
      const lv0 = hh.lvl;
      hh.xp = (hh.xp || 0) + xp;
      while (hh.lvl < HERO_MAX_LVL && hh.xp >= heroXpNeed(hh.lvl)) { hh.xp -= heroXpNeed(hh.lvl); hh.lvl++; hh.sp = (hh.sp || 0) + (hh.lvl === 9 ? 2 : 1); }
      if (hh.lvl >= HERO_MAX_LVL) hh.xp = Math.min(hh.xp, heroXpNeed(hh.lvl));
      if (win && th !== 'prof') hh.dj = Math.max(hh.dj || 1, Math.min(99, L + 1));
      if (th === 'prof') hh.deep = Math.max(hh.deep || 0, deep);
      hh.runs = (hh.runs || 0) + 1; if (win) hh.wins = (hh.wins || 0) + 1;
      const cap = capOf(v), got = {};
      for (const k of ['bois', 'pierre', 'viande', 'pain', 'biere']) {
        const n = Math.max(0, Math.min(3000, Math.round(+((a.loot || {})[k]) || 0))); if (!n) continue;
        const before = v.r[k] || 0; v.r[k] = Math.min(Math.max(cap, before), before + n); got[k] = Math.round(v.r[k] - before);
        if (!got[k]) delete got[k];
      }
      const pris = a.pris ? prisonerOf(v, t) : null;
      if (pris) v.cands.push(pris);
      const up = hh.lvl - lv0;
      const fl = deep ? deep + ' étage' + (deep > 1 ? 's terminés' : ' terminé') : 'aucun étage terminé';
      const what = th === 'prof' ? (win ? ' remonte des Profondeurs (' : ' a dû fuir les Profondeurs (') + fl + ')'
        : win ? ' revient vainqueur ' + (th === 'crypte' ? 'de la crypte des rois' : 'de la mine des gobelins') + ' (niveau ' + L + ')' : ' a dû fuir ' + (th === 'crypte' ? 'la crypte des rois' : 'la mine des gobelins') + ' (niveau ' + L + ')';
      addLog(v, t, hh.name + what + ' : +' + xp + ' d’expérience' + (Object.keys(got).length ? ', ' + rewTxt(got) : '') + '.' + (up ? ' ' + hh.name + ' passe au niveau ' + hh.lvl + ' !' : ''), 'dj');
      if (pris) addLog(v, t, pris.name + ' (' + raceName(pris.race, pris.sex).toLowerCase() + '), délivré' + (pris.sex === 'f' ? 'e' : '') + (th === 'crypte' ? ' d’un tombeau de la crypte' : ' d’un cachot souterrain') + ', voudrait s’installer au village.', 'cand');
      return { ok: true, xp, up, lvl: hh.lvl, got, pris: pris ? pris.name : null, dj: hh.dj, deep: hh.deep || 0 };
    }
    case 'skill': {
      /* Un point de compétence : +1 rang (5 au plus) à une compétence déjà ouverte. */
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      const i = a.i | 0; if (i < 0 || i > 2) return fail('Compétence inconnue.');
      if (hh.lvl < SKILL_LVLS[i]) return fail('Cette compétence s’ouvre au niveau ' + SKILL_LVLS[i] + '.');
      if ((hh.sp || 0) < 1) return fail('Plus de point de compétence : il faut gagner un niveau.');
      const k = 's' + i, cur = (hh.sk && hh.sk[k]) || 0; if (cur >= 4) return fail('Cette compétence est déjà au rang maximum (5).');
      hh.sk = Object.assign({}, hh.sk, { [k]: cur + 1 }); hh.sp -= 1;
      return { ok: true, rank: cur + 2 };
    }
    case 'spec': {
      /* Spécialisation, au niveau 10 : une des deux voies de la classe, pour de bon. */
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      if (hh.lvl < SPEC_LVL) return fail('La spécialisation s’ouvre au niveau ' + SPEC_LVL + '.');
      if (hh.spec === 0 || hh.spec === 1) return fail('Spécialisation déjà choisie.');
      const sIdx = a.s === 1 ? 1 : 0; hh.spec = sIdx;
      addLog(v, t, hh.name + ' choisit sa voie : ' + CLASSES[hh.cls].specs[sIdx][0].toLowerCase() + '.', 'hero');
      return { ok: true };
    }
    case 'claim': {
      /* Récompense d'un objectif atteint (si l'autre joueur l'a déjà prise, il n'y a rien à faire). */
      if (!v.goals) v.goals = [];
      if (v.goals.includes(a.id)) return { ok: true, already: true };
      const g = goalsOf(v).find(x => x.id === a.id); if (!g) return fail('Cet objectif n’est pas encore disponible.');
      if (!goalDone(v, g)) return fail('Objectif pas encore atteint.');
      for (const k in g.rew) v.r[k] = (v.r[k] || 0) + g.rew[k];
      v.goals.push(g.id);
      addLog(v, t, nm + ' récupère la récompense « ' + g.name + ' » : ' + rewTxt(g.rew) + '.', 'goal');
      return { ok: true, g: g.id };
    }
  }
  return fail('Action inconnue.');
}

/* Restes du rendu des combats de l'ancien jeu (serviront aux donjons, étape 2). */
const HEROES = {}, TROOPS = {};
