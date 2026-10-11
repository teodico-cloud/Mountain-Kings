(() => {
'use strict';
/* ===================== RÉSEAU FIREBASE (nouveau jeu : village commun) ===================== */
const FB_CONFIG = {
  apiKey: 'AIzaSyCk2epufhsolA8Jt8xVKaKtsr8wJtJXs3w',
  authDomain: 'moutain-kings.firebaseapp.com',
  databaseURL: 'https://moutain-kings-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'moutain-kings',
  storageBucket: 'moutain-kings.firebasestorage.app',
  messagingSenderId: '206461415677',
  appId: '1:206461415677:web:9189ed8553e60c7f1e8e94',
};
/* Toutes les données du nouveau jeu vivent sous ce dossier : l'ancien jeu n'est jamais touché. */
const ROOT = 'v2/';

const fbArr = x => Array.isArray(x) ? x.filter(e => e != null) : (x && typeof x === 'object') ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(e => e != null) : [];
const fbObj = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
/* La base temps réel efface les listes vides et les valeurs nulles : on remet la forme attendue. */
function normVillage(v) {
  if (!v || typeof v !== 'object') return v;
  v = JSON.parse(JSON.stringify(v));
  v.b = fbArr(v.b).map(b => Object.assign({ up: null, w: [] }, b, { w: fbArr(b.w) }));
  v.vil = fbArr(v.vil).map(p => Object.assign({ job: null }, p, { st: Object.assign({}, p.st), xp: Object.assign({}, p.xp) }));
  v.cands = fbArr(v.cands).map(p => Object.assign({}, p, { st: Object.assign({}, p.st) }));
  v.log = fbArr(v.log);
  v.goals = fbArr(v.goals);
  v.cnt = Object.assign({ acc: 0, fete: 0, win: 0 }, v.cnt);
  v.members = fbObj(v.members);
  v.heroes = fbObj(v.heroes);
  for (const k of Object.keys(v.heroes)) v.heroes[k] = Object.assign({ lvl: 1, xp: 0, at: null }, v.heroes[k]);
  v.r = Object.assign({ orge: 0, biere: 0 }, v.r);
  return v;
}
const fbFix = (path, v) => path.indexOf(ROOT + 'villages/') === 0 && path.split('/').length === 3 ? normVillage(v) : v;
const fbClean = d => JSON.parse(JSON.stringify(d));
function fbCode(e) { const s = String((e && (e.code || e.message)) || ''); return /permission/i.test(s) ? 'not_granted' : 'unavailable'; }
const fbThrow = e => { throw { code: fbCode(e), message: String(e && e.message) }; };
function fbErr(cb) { return e => { if (cb) cb({ code: fbCode(e), message: String(e && e.message) }); }; }

function fbDb(rdb) {
  const doc = path => ({
    path,
    get: () => rdb.ref(path).once('value').then(s => ({ exists: s.exists(), data: () => fbFix(path, s.val()) }), fbThrow),
    set: data => rdb.ref(path).set(fbClean(data)).catch(fbThrow),
    delete: () => rdb.ref(path).remove().catch(fbThrow),
    onSnapshot(next, err) {
      const r = rdb.ref(path);
      const h = r.on('value', s => next({ exists: s.exists(), data: () => fbFix(path, s.val()) }), fbErr(err));
      return () => r.off('value', h);
    },
    /* Modification sûre à deux : fn reçoit la dernière valeur connue du serveur et renvoie la nouvelle
       (ou undefined pour abandonner). Firebase la rejoue si l'autre joueur a écrit entre-temps. */
    transact(fn) {
      return rdb.ref(path).transaction(cur => {
        const nv = fn(cur == null ? null : fbFix(path, cur));
        return nv === undefined ? undefined : fbClean(nv);
      }).then(r => ({ committed: !!(r && r.committed), data: r && r.snapshot ? fbFix(path, r.snapshot.val()) : null }), fbThrow);
    },
  });
  return { doc };
}

/* Présence dans le village commun : qui est connecté en ce moment. */
function fbPresence(rdb, uid) {
  let ref = null, refPath = '', mine = null, connected = false;
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  function write() {
    if (!ref || !mine) return Promise.resolve();
    ref.onDisconnect().remove();
    return ref.set(Object.assign({}, mine, { t: TS() }));
  }
  rdb.ref('.info/connected').on('value', s => { connected = s.val() === true; if (connected) write().catch(() => {}); });
  return {
    set(vid, data) {
      const p = ROOT + 'presence/' + vid + '/' + uid;
      if (!ref || refPath !== p) { if (ref) ref.remove().catch(() => {}); ref = rdb.ref(p); refPath = p; }
      mine = fbClean(data); return write().catch(() => {});
    },
    watch(vid, cb) {
      const r = rdb.ref(ROOT + 'presence/' + vid);
      const h = r.on('value', s => {
        const val = s.val() || {};
        if (mine && connected && !val[uid]) write().catch(() => {});
        cb(val);
      }, () => cb({}));
      return () => r.off('value', h);
    },
  };
}

const FB = {
  available: () => typeof firebase !== 'undefined' && !!firebase.initializeApp,
  started: false,
  lastError: null,
  offset: 0,
  start() {
    if (!FB.started) { firebase.initializeApp(FB_CONFIG); FB.started = true; }
    const auth = firebase.auth();
    return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {})
      .then(() => auth.getRedirectResult().catch(e => { FB.lastError = e; return null; }))
      .then(() => new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); }));
  },
  login() {
    const p = new firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return firebase.auth().signInWithPopup(p).then(r => r.user).catch(e => {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return firebase.auth().signInWithRedirect(p).then(() => null);
      throw e;
    });
  },
  logout() { return firebase.auth().signOut(); },
  open(user) {
    const rdb = firebase.database();
    /* Même heure pour les deux téléphones : celle du serveur. */
    rdb.ref('.info/serverTimeOffset').on('value', s => { FB.offset = s.val() || 0; });
    return { db: fbDb(rdb), presence: fbPresence(rdb, user.uid), rdb };
  },
};

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
const RACES = {
  humain: { name: 'Humain', fem: 'Humaine', plural: 'Humains', bonus: { constr: 1, agri: 1 }, spec: 'constr', desc: 'Polyvalent : bâtisseur et cultivateur.' },
  nain: { name: 'Nain', fem: 'Naine', plural: 'Nains', bonus: { mine: 2 }, spec: 'mine', desc: 'Né dans la roche : excellent mineur.' },
  elfe: { name: 'Elfe', fem: 'Elfe', plural: 'Elfes', bonus: { chasse: 2 }, spec: 'chasse', desc: 'Œil perçant : chasseur hors pair.' },
};
const RACE_KEYS = ['humain', 'nain', 'elfe'];
const CLASSES = {
  guerrier: { name: 'Guerrier', desc: 'Encaisse les coups et protège ses alliés.' },
  rodeur: { name: 'Rôdeur', desc: 'Arc ou arbalète : il frappe de loin.' },
  mage: { name: 'Mage', desc: 'Feu et glace : il touche des groupes entiers.' },
};
const CLASS_KEYS = ['guerrier', 'rodeur', 'mage'];
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
  maison: { name: 'Maison', size: 2, max: 3, cost: { bois: 60, pierre: 20 }, mul: 1.8, work: 40, house: 3, cat: 'hab', desc: 'Loge 3 villageois, un de plus par niveau. L’hiver, chaque maison brûle du bois.' },
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
  if (v.cold) out.push(['Froid : plus de bois de chauffage', -15]);
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
  { id: 'hiver', name: 'Un hiver au chaud', txt: 'Passer un hiver entier sans faim ni froid.', prog: v => [cntOf(v, 'win'), 1], rew: { pain: 80, bois: 100 } },
  { id: 'fete', name: 'Une grande fête', txt: 'Offrir une fête à la taverne.', prog: v => [cntOf(v, 'fete'), 1], rew: { pierre: 100 } },
  { id: 'deco', name: 'Un village coquet', txt: 'Avoir cinq décorations (bancs, fleurs, fontaine, statue).', prog: v => [v.b.filter(b => BLD[b.type].deco && b.lvl > 0).length, 5], rew: { pierre: 80 } },
  { id: 'entrepot', name: 'De la place', txt: 'Agrandir un entrepôt au niveau 2.', prog: v => [v.b.some(b => b.type === 'entrepot' && b.lvl >= 2) ? 1 : 0, 1], rew: { bois: 120 } },
  { id: 'maitre', name: 'Un maître', txt: 'Un villageois atteint 10/10 dans son métier.', prog: v => [bestInJob(v), 10], rew: { bois: 150, pierre: 150 } },
  { id: 'halle3', name: 'Une vraie bourgade', txt: 'Agrandir la halle du village au niveau 3.', prog: v => [hallLvl(v), 3], rew: { bois: 300, pierre: 200 } },
  { id: 'pop12', name: 'Douze villageois', txt: 'Loger douze villageois.', prog: v => [v.vil.length, 12], rew: { pain: 100, viande: 100 } },
  { id: 'fetes3', name: 'Le village en fête', txt: 'Offrir trois fêtes à la taverne.', prog: v => [cntOf(v, 'fete'), 3], rew: { biere: 60 } },
  { id: 'halle4', name: 'Une petite ville', txt: 'Agrandir la halle du village au niveau 4.', prog: v => [hallLvl(v), 4], rew: { bois: 500, pierre: 350 } },
  { id: 'pop16', name: 'Seize villageois', txt: 'Loger seize villageois.', prog: v => [v.vil.length, 16], rew: { pain: 150, viande: 150 } },
  { id: 'hivers3', name: 'Trois hivers au chaud', txt: 'Passer trois hivers sans faim ni froid.', prog: v => [cntOf(v, 'win'), 3], rew: { bois: 300, pierre: 300 } },
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
    b: [], vil: [], cands: [], log: [], hunger: 0, cold: 0, feast: 0, feastCd: 0, ws: seasonIdx({ born: t }, t),
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
    v.wok = S.cold ? 1 : 0;                        // début de l'hiver : réussi tant que personne n'a faim ni froid
    addLog(v, t, S.name + ' arrive sur la vallée.' + (S.cold ? ' Les champs dorment : pensez aux réserves de nourriture et de bois.' : si === 0 ? ' Les champs repartent.' + (warm ? ' L’hiver s’est passé sans faim ni froid : bravo !' : '') : ''), 'season');
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
  /* Hiver : chaque maison brûle du bois */
  if (S.cold) {
    let wood = 0; for (const b of v.b) if (b.type === 'maison' && b.lvl > 0) wood += 2 * h;
    if ((v.r.bois || 0) >= wood) { v.r.bois -= wood; v.cold = 0; } else { v.r.bois = 0; v.cold = 1; v.wok = 0; }
  } else v.cold = 0;
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
  if (S.cold) out.bois -= 2 * v.b.filter(b => b.type === 'maison' && b.lvl > 0).length;
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
      if (!v.members[who.uid]) return fail('Tu ne fais pas partie de ce village.');
      if (v.heroes[who.uid]) return fail('Ton héros existe déjà.');
      if (!RACES[a.race] || !CLASSES[a.cls]) return fail('Choisis une race et une classe.');
      const name = String(a.name || '').trim().slice(0, 18); if (!name) return fail('Donne un nom à ton héros.');
      v.heroes[who.uid] = { name, race: a.race, cls: a.cls, sex: a.sex === 'f' ? 'f' : 'm', col: COLORS.includes(a.col) ? a.col : COLORS[0], lvl: 1, xp: 0, at: null };
      addLog(v, t, name + ', ' + raceName(a.race, a.sex).toLowerCase() + ' ' + CLASSES[a.cls].name.toLowerCase() + ', arrive au village.', 'hero');
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
      const hh = v.heroes[who.uid]; if (!hh) return fail('Crée d’abord ton héros.');
      if (a.to != null && a.to !== 'bat') {
        const b = v.b.find(x => x.id === a.to);
        if (!b || !BLD[b.type].spec || b.lvl < 1) return fail('Ton héros ne peut pas aider ici.');
      }
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

/* ===================== VUE 3D (three.js r128) ===================== */
const V3 = (() => {
  const half = GRID / 2;
  let renderer = null, scene, camera, hemi, sun, ok = false, canvas, aspect = 1;
  const YAW = Math.PI / 4, PITCH = 0.68;
  const cam = { tx: 0, tz: 0, view: 18 };
  const M = {}, G = {};
  let winMat, fireMat, barBg, selMat, ghostOk, ghostBad, zoneTex, zoneMesh, gridMesh, selMesh, ghostMesh, ringMat, ringFill, glowTex, emberMat;
  const bldGroup = new THREE.Group(), unitGroup = new THREE.Group(), fxGroup = new THREE.Group(), rangeGroup = new THREE.Group(), wallGroup = new THREE.Group();
  const decoProc = new THREE.Group(), decoModel = new THREE.Group();
  const blds = new Map();   // key -> {g, sig, item, info, bar, hp, glow}
  const units = new Map();  // id -> {g, lx, lz, model}
  const dying = [], shots = [], puffs = [], embers = [], chunks = [], waves = [], sparks = [];
  let shakeT = 0, shakeA = 0;
  let anims = [];
  let frameHook = null, tapHook = null, mood = '', groundMat = null, outerMat = null;
  const LIB = { ok: false, b: {}, ch: {}, tex: {}, ver: 0, xbow: null, gear: {}, clips: {}, m2: {} };
  /* Modèles générés avec Meshy pour le nouveau jeu (remplacent les modèles provisoires au fur et à mesure). */
  const M2_NAMES = ['taverne'];
  const C = { stone: 0x9a9488, stoneL: 0xb6b2a8, stoneD: 0x7d858b, wood: 0x9b7a54, woodD: 0x5f4127, woodL: 0xc49a63, timber: 0xdac9a6, roof: 0x8e3b2d, roofD: 0x5a3320, roofB: 0x5b4430, door: 0x3e2716, dirt: 0xa88a5c, field: 0x7a5a32, crop: 0x8fbf5a, gold: 0xd9b54c, red: 0x8c3b2d, cream: 0xede3d3, metal: 0xaeb4b8, rock: 0x8b9297, rockL: 0xcfd3d6, canvas: 0xe8dfc8, skin: 0xe6c29c };

  /* ---------- géométries et matériaux ---------- */
  function normGeo(g) {
    g.computeBoundingBox();
    const b = g.boundingBox, sx = (b.max.x - b.min.x) || 1, sy = (b.max.y - b.min.y) || 1, sz = (b.max.z - b.min.z) || 1;
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    g.scale(1 / sx, 1 / sy, 1 / sz);
    return g;
  }
  function geo(k) {
    if (G[k]) return G[k];
    let g;
    switch (k) {
      case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
      case 'cyl6': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6); break;
      case 'cyl8': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); break;
      case 'cyl12': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); break;
      case 'cone4': g = new THREE.ConeGeometry(0.5, 1, 4, 1); g.rotateY(Math.PI / 4); break;
      case 'cone6': g = new THREE.ConeGeometry(0.5, 1, 6, 1); break;
      case 'cone7': g = new THREE.ConeGeometry(0.5, 1, 7, 1); break;
      case 'sph': g = new THREE.SphereGeometry(0.5, 8, 6); break;
      case 'ico': g = new THREE.IcosahedronGeometry(0.5, 0); break;
      case 'dode': g = new THREE.DodecahedronGeometry(0.5, 0); break;
      case 'prism': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 3); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); break;
      case 'plane': g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return (G[k] = g);
      case 'barfg': g = new THREE.PlaneGeometry(1, 1); g.translate(0.5, 0, 0); return (G[k] = g);
      case 'barbg': g = new THREE.PlaneGeometry(1, 1); return (G[k] = g);
    }
    if (g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    return (G[k] = normGeo(g));
  }
  const lin = c => new THREE.Color(c).convertSRGBToLinear();
  const mat = c => M[c] || (M[c] = new THREE.MeshLambertMaterial({ color: lin(c) }));
  const basic = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: lin(c) }, o || {}));
  function P(k, c, sx, sy, sz, x, y, z, ry, noShadow) {
    const m = new THREE.Mesh(geo(k), (typeof c === 'object') ? c : mat(c));
    m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    m.castShadow = !noShadow; m.receiveShadow = true;
    return m;
  }
  function piv(x, y, z, kids, rx, ry, rz) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    if (rx) g.rotation.x = rx; if (ry) g.rotation.y = ry; if (rz) g.rotation.z = rz;
    (kids || []).forEach(k => g.add(k)); return g;
  }
  const logX = (len, d, x, y, z, c) => piv(x, y, z, [P('cyl8', c || 0x8b5e34, d, len, d, 0, -len / 2, 0)], 0, 0, Math.PI / 2);
  const logZ = (len, d, x, y, z, c) => piv(x, y, z, [P('cyl8', c || 0x8b5e34, d, len, d, 0, -len / 2, 0)], Math.PI / 2, 0, 0);
  function flag(x, y, z, col, h) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    g.add(P('cyl6', C.woodD, 0.05, h, 0.05, 0, 0, 0, 0, true));
    const f = piv(0, h, 0, [P('box', col, 0.5, 0.3, 0.03, 0.25, -0.32, 0, 0, true)]);
    g.add(f); anims.push({ k: 'flag', o: f, ph: Math.random() * 6 });
    return g;
  }
  function makeBar(w, color) {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(geo('barbg'), barBg); bg.scale.set(w + 0.06, 0.14, 1);
    const fg = new THREE.Mesh(geo('barfg'), basic(color, { depthTest: false })); fg.scale.set(w, 0.08, 1); fg.position.set(-w / 2, 0, 0.001);
    bg.renderOrder = 10; fg.renderOrder = 11;
    g.add(bg); g.add(fg); g.userData = { fg, w };
    return g;
  }
  function setBar(bar, frac) { const f = Math.max(0.001, Math.min(1, frac)); bar.userData.fg.scale.x = bar.userData.w * f; }

  /* ---------- bâtiments : nains (joueurs) et orques (ennemis) ---------- */
  const DW = { stone: 0x9a9488, stoneL: 0xb8b3a8, stoneD: 0x6f767c, slate: 0x4d5966, slateD: 0x3c4552, wood: 0x8b6a45, woodD: 0x5f4127, woodL: 0xc49a63, gold: 0xc9922e, door: 0x3e2716, metal: 0xaeb4b8 };
  const OR = { wood: 0x4a3424, woodD: 0x34241a, woodL: 0x6b4a2b, hide: 0x8d6e4a, hideD: 0x6e5236, cloth: 0x8e2a1e, bone: 0xe6dcc0, metal: 0x6e5a48, stone: 0x6a6a5e, mud: 0x5b4a36, skin: 0x6f8f3a };
  function spikes(g, s, n, h) {
    const e = s / 2 - 0.08;
    for (let i = 0; i < n; i++) {
      const t = i / n * 4; let x, z;
      if (t < 1) { x = -e + 2 * e * t; z = e; } else if (t < 2) { x = e; z = e - 2 * e * (t - 1); } else if (t < 3) { x = e - 2 * e * (t - 2); z = -e; } else { x = -e; z = -e + 2 * e * (t - 3); }
      g.add(P('cone6', OR.woodL, 0.1, h || 0.5, 0.1, x, 0, z, 0, true));
    }
  }
  function totem(g, x, z, h) {
    g.add(P('cyl6', OR.wood, 0.1, h, 0.1, x, 0, z));
    g.add(P('sph', OR.bone, 0.2, 0.17, 0.2, x, h, z, 0, true));
    g.add(P('box', 0x111111, 0.05, 0.04, 0.02, x - 0.045, h + 0.07, z + 0.095, 0, true));
    g.add(P('box', 0x111111, 0.05, 0.04, 0.02, x + 0.045, h + 0.07, z + 0.095, 0, true));
  }
  function brazier(g, x, z) {
    g.add(P('cyl6', DW.stoneD, 0.22, 0.4, 0.22, x, 0, z));
    const f = P('cone6', fireMat, 0.16, 0.3, 0.16, x, 0.4, z, 0, true); g.add(f); anims.push({ k: 'fire', o: f, base: 0.3 });
  }
  function makeBld(type, lvl, col, orc) {
    const g = new THREE.Group(), info = { top: 1.5, muzzle: 1, emit: [], aim: null, arm: null };
    const add = m => { g.add(m); return m; };
    const K = orc
      ? { wall: OR.wood, wallL: OR.hide, wallD: OR.woodD, roof: OR.hide, roof2: OR.cloth, trim: OR.bone, wood: OR.wood, woodD: OR.woodD, woodL: OR.woodL, metal: OR.metal, door: 0x1d1510, accent: OR.cloth, base: OR.mud }
      : { wall: DW.stoneL, wallL: DW.stone, wallD: DW.stoneD, roof: DW.slate, roof2: DW.slateD, trim: DW.gold, wood: DW.wood, woodD: DW.woodD, woodL: DW.woodL, metal: DW.metal, door: DW.door, accent: col, base: DW.stoneD };
    switch (type) {
      case 'mairie': {
        if (orc) {
          add(P('cyl12', OR.mud, 2.9, 0.1, 2.9));
          add(P('cone6', OR.hide, 2.5, 2.3 + 0.15 * lvl, 2.5, 0, 0.1, 0));
          add(P('cone6', OR.hideD, 1.0, 0.5, 1.0, 0, 1.9 + 0.15 * lvl, 0));
          add(P('box', 0x1d1510, 0.55, 0.75, 0.05, 0, 0.1, 1.02, 0, true));
          for (const x of [-0.35, 0.35]) add(piv(x, 0.95, 1.0, [P('cone6', OR.bone, 0.12, 0.5, 0.12, 0, 0, 0, 0, true)], 0.9));
          totem(g, -1.15, 1.1, 1.3); totem(g, 1.15, 1.1, 1.3);
          add(P('box', OR.cloth, 0.4, 0.7, 0.03, 0.75, 0.6, 0.72, 0.5, true));
          spikes(g, 3, 10 + 2 * lvl, 0.6);
          info.emit.push([0, 2.6 + 0.15 * lvl, 0]); info.top = 3.1 + 0.15 * lvl;
        } else {
          add(P('box', DW.stoneD, 2.8, 0.3, 2.8));
          add(P('box', DW.stoneL, 2.2, 1.5, 1.8, 0, 0.3, -0.05));
          add(P('prism', DW.slate, 2.5, 0.9, 2.1, 0, 1.8, -0.05));
          add(P('box', DW.gold, 0.8, 1.0, 0.05, 0, 0.3, 0.86, 0, true));
          add(P('box', DW.door, 0.62, 0.88, 0.06, 0, 0.3, 0.87, 0, true));
          for (const x of [-0.75, 0.75]) add(P('box', winMat, 0.22, 0.3, 0.05, x, 1.05, 0.86, 0, true));
          brazier(g, -1.1, 1.15); brazier(g, 1.1, 1.15);
          add(P('box', DW.stoneD, 0.3, 0.8, 0.3, 0.7, 1.9, -0.45)); info.emit.push([0.7, 2.8, -0.45]);
          if (lvl >= 2) {
            const th = 2.0 + 0.25 * lvl;
            add(P('box', DW.stone, 0.85, th, 0.85, -1.0, 0.3, -0.85));
            add(P('cone4', DW.slateD, 1.1, 0.85, 1.1, -1.0, 0.3 + th, -0.85));
            add(P('box', winMat, 0.16, 0.26, 0.05, -1.0, 0.3 + th - 0.6, -0.42, 0, true));
            add(flag(-1.0, 0.3 + th + 0.8, -0.85, col, 0.9));
          } else add(flag(0, 2.7, -0.05, col, 0.8));
          if (lvl >= 3) { add(P('box', DW.stone, 0.7, 1.8, 0.7, 1.05, 0.3, -0.9)); add(P('cone4', DW.slateD, 0.9, 0.7, 0.9, 1.05, 2.1, -0.9)); }
          if (lvl >= 4) { add(P('box', DW.gold, 2.24, 0.07, 0.03, 0, 1.6, 0.86, 0, true)); for (const x of [-1.15, 1.15]) add(P('box', col, 0.24, 0.65, 0.03, x, 0.55, 0.87, 0, true)); }
          if (lvl >= 5) add(P('box', DW.gold, 2.5, 0.07, 0.08, 0, 2.68, -0.05, 0, true));
          info.top = 3.5;
        }
        break;
      }
      case 'scierie': {
        add(P('box', orc ? OR.mud : 0x8a6f4a, 1.8, 0.04, 1.8, 0, 0, 0, 0, true));
        add(P('box', K.wood, 1.1, 0.65, 0.8, -0.3, 0.04, -0.35));
        add(P(orc ? 'cone4' : 'prism', K.roof, 1.3, orc ? 0.7 : 0.45, orc ? 1.1 : 1.0, -0.3, 0.69, -0.35));
        const n = Math.min(6, 2 + lvl);
        for (let i = 0; i < n; i++) add(logZ(0.9, 0.2, 0.42 + (i % 3) * 0.2 - 0.05 * Math.floor(i / 3), 0.14 + Math.floor(i / 3) * 0.17, 0.25, orc ? 0x6b4a2b : 0x8b5e34));
        const spin = piv(0, 0, 0, [P('cyl12', K.metal, 0.55, 0.04, 0.55, 0, -0.02, 0, 0, true)]);
        add(piv(-0.3, 0.42, 0.2, [spin], Math.PI / 2, 0, 0)); anims.push({ k: 'spin', o: spin, s: 5 });
        add(P('box', K.woodL, 0.9, 0.18, 0.3, -0.3, 0.04, 0.25));
        if (orc) spikes(g, 2, 7, 0.45);
        info.top = 1.6; break;
      }
      case 'carriere': {
        add(P('box', orc ? OR.mud : 0x8f8a80, 1.9, 0.04, 1.9, 0, 0, 0, 0, true));
        add(P('dode', orc ? OR.stone : 0x8b9297, 1.5, 1.1, 1.2, -0.1, 0, -0.35));
        add(P('dode', orc ? 0x5c5c52 : 0x9aa1a6, 0.6, 0.5, 0.5, 0.6, 0, -0.55));
        if (!orc) {
          add(P('box', 0x1a1612, 0.48, 0.55, 0.06, -0.1, 0, 0.26, 0, true));
          add(P('box', DW.woodD, 0.08, 0.62, 0.08, -0.38, 0, 0.3)); add(P('box', DW.woodD, 0.08, 0.62, 0.08, 0.18, 0, 0.3)); add(P('box', DW.woodD, 0.66, 0.08, 0.1, -0.1, 0.6, 0.3));
          for (const x of [-0.22, 0.02]) add(P('box', DW.metal, 0.03, 0.03, 0.65, x, 0.04, 0.62, 0, true));
          add(P('box', 0x5d646a, 0.3, 0.2, 0.36, -0.1, 0.06, 0.75)); add(P('box', 0xcfd3d6, 0.24, 0.08, 0.3, -0.1, 0.26, 0.75, 0, true));
          if (lvl >= 3) brazier(g, 0.75, 0.75);
        } else {
          add(P('box', OR.woodD, 0.1, 1.3, 0.1, 0.7, 0, 0.6)); add(P('box', OR.woodD, 0.9, 0.08, 0.08, 0.3, 1.25, 0.6));
          spikes(g, 2, 6, 0.45);
        }
        for (let i = 0; i < Math.min(6, lvl + 1); i++) add(P('box', orc ? 0x8a8a7e : 0xcfd3d6, 0.26, 0.2, 0.26, 0.45 + (i % 2) * 0.3, 0.04 + Math.floor(i / 2) * 0.2, 0.15 + (i % 3) * 0.02));
        info.top = 1.5; break;
      }
      case 'ferme': {
        if (orc) {
          add(P('box', OR.mud, 1.85, 0.06, 1.85, 0, 0, 0, 0, true));
          for (let i = 0; i < 4; i++) add(P('box', 0x6b5a3c, 1.6, 0.1, 0.14, 0, 0.06, 0.15 + i * 0.22));
          add(P('cone6', OR.hide, 0.9, 0.9, 0.9, -0.45, 0.06, -0.5));
          for (let i = 0; i < 3; i++) add(P('box', OR.bone, 0.32, 0.05, 0.06, 0.4 + i * 0.12, 0.08, -0.55 + i * 0.1, i, true));
          totem(g, 0.7, -0.75, 0.9); spikes(g, 2, 8, 0.4);
        } else {
          add(P('box', 0x5a4632, 1.85, 0.06, 1.85, 0, 0, 0, 0, true));
          const caps = [0xb84a3a, 0xd9a441, 0x9a6ab0, 0xc85a3a];
          const spots = [[-0.55, -0.5], [0.15, -0.6], [0.6, -0.15], [-0.6, 0.15], [0.05, 0.05], [0.55, 0.55], [-0.2, 0.6], [-0.65, 0.65]];
          for (let i = 0; i < Math.min(8, 3 + lvl); i++) {
            const [x, z] = spots[i], h = 0.25 + ((i * 37) % 10) / 30, w = 0.3 + ((i * 53) % 10) / 40;
            add(P('cyl6', 0xeee3cc, 0.11, h, 0.11, x, 0.06, z));
            add(P('sph', caps[i % caps.length], w, w * 0.45, w, x, 0.06 + h - 0.04, z));
          }
          add(P('cyl6', DW.woodD, 0.05, 0.75, 0.05, 0.75, 0.06, -0.75)); add(P('box', winMat, 0.12, 0.14, 0.12, 0.75, 0.8, -0.75, 0, true));
          if (lvl >= 4) add(flag(-0.8, 0.06, -0.8, col, 0.7));
        }
        info.top = 1.2; break;
      }
      case 'entrepot': {
        if (orc) {
          add(P('cyl12', OR.mud, 1.9, 0.06, 1.9));
          add(P('cone4', OR.hide, 1.7, 1.2, 1.5, 0, 0.06, -0.1));
          for (let i = 0; i < Math.min(5, lvl + 1); i++) add(P('box', i % 2 ? OR.woodL : 0x7d6a4c, 0.3, 0.3, 0.3, -0.7 + i * 0.32, 0.06, 0.72, i * 0.3));
          spikes(g, 2, 8, 0.5);
        } else {
          add(P('box', DW.stoneL, 1.6, 0.9, 1.3, 0, 0, -0.05));
          add(P('prism', DW.slate, 1.75, 0.6, 1.45, 0, 0.9, -0.05));
          add(P('box', DW.wood, 0.55, 0.62, 0.05, 0, 0, 0.61, 0, true));
          add(P('box', DW.gold, 0.6, 0.06, 0.06, 0, 0.62, 0.61, 0, true));
          for (let i = 0; i < Math.min(5, lvl); i++) add(P('cyl8', 0x7a5534, 0.26, 0.32, 0.26, -0.75 + i * 0.3, 0, 0.82));
        }
        info.top = 1.8; break;
      }
      case 'caserne': {
        add(P('box', K.wallD, 1.5, 0.95, 1.4, 0, 0, -0.1));
        if (orc) { add(P('cone4', OR.cloth, 1.9, 0.8, 1.8, 0, 0.95, -0.1)); spikes(g, 2, 9, 0.55); totem(g, 0.8, 0.8, 1.0); }
        else {
          for (const x of [-0.62, 0, 0.62]) for (const z of [-0.7, 0.5]) add(P('box', DW.stoneD, 0.24, 0.22, 0.24, x, 0.95, z));
          add(P('box', DW.gold, 1.52, 0.06, 0.03, 0, 0.8, 0.61, 0, true));
          if (lvl >= 2) add(P('box', DW.stone, 0.85, 0.5, 0.75, 0, 0.95, -0.2));
          add(flag(0.55, lvl >= 2 ? 1.45 : 0.95, -0.55, col, 0.8));
          for (const x of [-0.65, 0.65]) { add(P('cyl6', DW.woodL, 0.1, 0.45, 0.1, x, 0, 0.82)); add(P('sph', 0xd9b54c, 0.18, 0.18, 0.18, x, 0.45, 0.82)); }
          if (lvl >= 3) add(P('box', col, 0.3, 0.55, 0.03, 0, 0.2, 0.63, 0, true));
        }
        add(P('box', K.door, 0.4, 0.6, 0.05, 0, 0, 0.61, 0, true));
        add(P('box', winMat, 0.16, 0.22, 0.05, -0.45, 0.5, 0.61, 0, true));
        add(P('box', winMat, 0.16, 0.22, 0.05, 0.45, 0.5, 0.61, 0, true));
        info.top = 2.0; break;
      }
      case 'camp': {
        add(P('cyl12', orc ? OR.mud : 0xa88a5c, 2.7, 0.04, 2.7, 0, 0, 0, 0, true));
        const spots = [[-0.85, -0.65], [0.85, -0.65], [-0.9, 0.7], [0.9, 0.7], [0, -1.05]];
        for (let i = 0; i < Math.min(5, lvl + 1); i++) add(P('cone4', orc ? (i % 2 ? OR.hide : OR.hideD) : (i % 2 ? 0xe8dfc8 : col), 0.85, 0.8, 0.85, spots[i][0], 0.04, spots[i][1]));
        add(logX(0.5, 0.08, 0, 0.08, 0.15)); add(logZ(0.5, 0.08, 0, 0.08, 0.15));
        const fl = P('cone6', fireMat, 0.24, 0.42, 0.24, 0, 0.06, 0.15, 0, true); add(fl);
        anims.push({ k: 'fire', o: fl }); info.emit.push([0, 0.7, 0.15]);
        if (orc) { spikes(g, 3, 12, 0.55); totem(g, 1.15, 1.15, 1.1); }
        else { add(P('box', DW.woodD, 0.7, 0.35, 0.07, 0, 0.04, 1.15)); for (const x of [-0.2, 0.05, 0.3]) add(P('box', DW.metal, 0.12, 0.08, 0.02, x, 0.38, 1.17, 0, true)); }
        info.top = 1.4; break;
      }
      case 'tour': {
        const H = 1.5 + 0.22 * lvl;
        if (orc) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(P('box', OR.woodD, 0.14, H, 0.14, sx * 0.42, 0, sz * 0.42));
          for (const sz of [-1, 1]) add(P('box', OR.woodD, 0.9, 0.07, 0.07, 0, H * 0.45, sz * 0.42, 0.25 * sz, true));
          add(P('box', OR.wood, 1.0, 0.45, 1.0, 0, H, 0));
          add(P('cone4', OR.cloth, 1.35, 0.85, 1.35, 0, H + 0.45, 0));
          add(P('sph', OR.bone, 0.2, 0.17, 0.2, 0, H + 0.12, 0.52, 0, true));
          spikes(g, 2, 6, 0.4);
        } else {
          add(P('box', DW.stoneD, 1.25, 0.3, 1.25));
          add(P('box', DW.stoneL, 0.95, H, 0.95, 0, 0.3, 0));
          add(P('box', DW.stone, 1.18, 0.3, 1.18, 0, H + 0.3, 0));
          for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) add(P('box', DW.stone, 0.22, 0.2, 0.22, x, H + 0.6, z));
          add(P('box', 0x2e2420, 0.12, 0.35, 0.04, 0, H * 0.55, 0.48, 0, true));
          if (lvl >= 3) add(P('cone4', DW.slateD, 1.2, 0.7, 1.2, 0, H + 0.8, 0));
          if (lvl >= 4) add(P('box', DW.gold, 0.97, 0.07, 0.97, 0, H * 0.75, 0, 0, true));
          if (lvl >= 5) add(flag(0.45, H + 1.4, 0.45, col, 0.7));
        }
        info.top = H + 1.4; info.muzzle = H + 0.45; break;
      }
      case 'baliste': {
        add(P('cyl8', orc ? OR.stone : DW.stoneL, 1.6, 0.4, 1.6));
        const a = piv(0, 0.4, 0, [
          P('box', K.woodD, 0.55, 0.25, 0.55),
          P('box', orc ? OR.wood : 0x7a5534, 0.18, 0.16, 1.1, 0, 0.25, 0.1),
          P('box', orc ? OR.woodL : (lvl >= 3 ? DW.gold : 0x5a3d22), 1.1, 0.09, 0.1, 0, 0.3, 0.55),
          P('box', K.metal, 0.05, 0.05, 0.6, 0, 0.42, 0.3, 0, true),
        ]);
        add(a); info.aim = a;
        if (orc) spikes(g, 2, 8, 0.45);
        info.top = 1.5; info.muzzle = 0.85; break;
      }
      case 'mangonneau': {
        const arm = piv(0, 0.95, 0, [P('box', K.woodL, 0.12, 0.12, 1.5, 0, -0.06, -0.45), P('sph', orc ? OR.stone : DW.stoneD, 0.26, 0.26, 0.26, 0, 0, -1.15)], -0.9);
        const a = piv(0, 0, 0, [
          P('box', orc ? OR.wood : 0x7a5534, 1.2, 0.22, 0.95),
          P('box', K.woodD, 0.12, 0.85, 0.12, -0.42, 0.22, 0), P('box', K.woodD, 0.12, 0.85, 0.12, 0.42, 0.22, 0),
          P('box', orc ? OR.woodD : DW.metal, 0.95, 0.1, 0.1, 0, 0.98, 0),
          logX(0.2, 0.3, 0.6, 0.12, 0.35, 0x3a2a1e), logX(0.2, 0.3, 0.6, 0.12, -0.35, 0x3a2a1e),
          arm,
        ]);
        add(a); info.aim = a; info.arm = arm;
        if (orc) spikes(g, 2, 8, 0.45);
        info.top = 1.7; info.muzzle = 1.3; break;
      }
    }
    return { g, info };
  }
  function makeRubble(s) {
    const g = new THREE.Group();
    g.add(P('box', 0x5c5248, s * 0.85, 0.1, s * 0.85, 0, 0, 0, 0, true));
    const R = mulberry32((s * 977) | 0);
    for (let i = 0; i < 4 + s * 2; i++) g.add(P('dode', i % 2 ? C.stoneD : C.woodD, 0.25 + R() * 0.3, 0.2 + R() * 0.2, 0.25 + R() * 0.3, (R() - 0.5) * s * 0.7, 0.05, (R() - 0.5) * s * 0.7, R() * 3));
    return g;
  }
  function makeScaffold(s, H) {
    const g = new THREE.Group(), e = s / 2 - 0.12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(P('box', C.woodL, 0.06, H, 0.06, sx * e, 0, sz * e, 0, true));
    for (const y of [H * 0.5, H]) for (const sz of [-1, 1]) { g.add(P('box', C.woodL, s - 0.2, 0.05, 0.05, 0, y, sz * e, 0, true)); g.add(P('box', C.woodL, 0.05, 0.05, s - 0.2, sz * e, y, 0, 0, true)); }
    g.add(P('box', C.woodL, 0.6, 0.12, 0.25, -e + 0.3, 0, e + 0.05));
    return g;
  }

  /* ---------- terrain : sol peint par le code, eau, végétation, décor ---------- */
  function radialTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const W_HALF = 20, TEX_N = 2048, TEX_P = TEX_N / (2 * W_HALF);   // 40 unités peintes, ~51 pixels par unité
  const MASK_K = 4, MASK_N = 2 * W_HALF * MASK_K;                     // masque « pas d'herbe » : 4 cases par unité
  let seasonBiome = 'green', cropStage = 1;
  let biome = '', baseCanvas = null, groundCanvas = null, groundTex = null, groundSig = '', groundTimer = null, waterMesh = null, waterNormal = null, outerMesh = null;
  const terrainGroup = new THREE.Group(), decoGroup = new THREE.Group(), forestGroup = new THREE.Group();
  const PAL = {
    green: { base: '#5f8d33', blot: ['#4d7d29', '#76a33e', '#8fa94a', '#3f6c22', '#6f9a37', '#a1b257', '#557f2c'], light: '#94bf55', dark: '#3a6420', spec: ['#f4f1e6', '#f2d24a', '#b58ad9', '#e86a5a', '#f4f1e6'],
      dirt: '#8d6f47', dirtD: '#6d5434', path: '#a07f52', stone: ['#8f8b82', '#a19c92', '#7d7a73', '#b0aa9e'], far: [0.36, 0.55, 0.2], rock: [0.48, 0.47, 0.44] },
    snow: { base: '#c4cfdb', blot: ['#aebccb', '#d8e1e9', '#9fb0c2', '#c9d3dd', '#e6edf3', '#b7c4d0'], light: '#eef3f8', dark: '#91a3b5', spec: ['#5b5149', '#6e655c'],
      dirt: '#54483c', dirtD: '#3b332c', path: '#4a3f35', stone: ['#77746f', '#8a8680', '#64615d', '#9a958d'], far: [0.86, 0.9, 0.94], rock: [0.42, 0.42, 0.44] },
  };
  /* Bruit doux (valeur) pour les reliefs et les couleurs. */
  function hash2(x, z) { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, z) => vnoise(x, z) * 0.5 + vnoise(x * 2.03, z * 2.03) * 0.25 + vnoise(x * 4.1, z * 4.1) * 0.125 + vnoise(x * 8.3, z * 8.3) * 0.0625;
  const toPx = v => (v + W_HALF) * TEX_P;
  const mkCanvas = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
  /* Pinceaux : disques flous pré-dessinés, un par couleur. */
  const brushes = {};
  function brush(color) {
    if (brushes[color]) return brushes[color];
    const c = mkCanvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, color); g.addColorStop(0.55, color + 'aa'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (brushes[color] = c);
  }
  function dab(x, color, wx, wz, r, alpha) { const s = r * TEX_P; x.globalAlpha = alpha; x.drawImage(brush(color), toPx(wx) - s, toPx(wz) - s, 2 * s, 2 * s); }
  /* Le lac du village : hors de la zone constructible, en bas à gauche de l'écran. */
  const LAKE = { x: -3, z: 18.6 };
  const lakeR = a => 4.2 + 1.1 * Math.sin(3 * a + 1) + 0.6 * Math.sin(5 * a + 2) + 0.35 * Math.sin(9 * a);
  function lakePath(x, k) {
    x.beginPath();
    for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = lakeR(a) * k; const px = toPx(LAKE.x + Math.cos(a) * r), pz = toPx(LAKE.z + Math.sin(a) * r); if (i) x.lineTo(px, pz); else x.moveTo(px, pz); }
    x.closePath();
  }
  function inLake(wx, wz, k) { const dx = wx - LAKE.x, dz = wz - LAKE.z, a = Math.atan2(dz, dx); return Math.sqrt(dx * dx + dz * dz) < lakeR(a) * k; }
  const baseCache = {};
  function paintBase(bi) {
    if (baseCache[bi]) { baseCanvas = baseCache[bi]; return; }
    const c = baseCanvas = baseCache[bi] = mkCanvas(TEX_N), x = c.getContext('2d'), pal = PAL[bi], R = mulberry32(bi === 'snow' ? 99 : 7);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.fillStyle = pal.base; x.fillRect(0, 0, TEX_N, TEX_N);
    const rnd = () => (R() * 2 - 1) * W_HALF;
    for (let i = 0; i < 260; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 2.5 + R() * 4.5, 0.18 + R() * 0.2);
    for (let i = 0; i < 900; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 0.8 + R() * 1.8, 0.2 + R() * 0.25);
    for (let i = 0; i < 4200; i++) dab(x, pal.blot[i % pal.blot.length], rnd(), rnd(), 0.12 + R() * 0.4, 0.25 + R() * 0.35);
    x.lineCap = 'round';
    for (const [col, a, w] of [[pal.dark, 0.32, 1.4], [pal.light, 0.3, 1.2], [pal.dark, 0.22, 1], [pal.light, 0.22, 1]]) {
      x.strokeStyle = col; x.globalAlpha = a; x.lineWidth = w; x.beginPath();
      for (let i = 0; i < 9000; i++) { const px = R() * TEX_N, py = R() * TEX_N; x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 2.5, py - 1.5 - R() * 3); }
      x.stroke();
    }
    for (const col of pal.spec) {
      x.fillStyle = col; x.globalAlpha = 0.85; x.beginPath();
      for (let i = 0; i < (bi === 'snow' ? 45 : 110); i++) { const px = R() * TEX_N, py = R() * TEX_N, r = 1 + R() * 1.7; x.moveTo(px + r, py); x.arc(px, py, r, 0, 6.2832); }
      x.fill();
    }
    if (bi === 'green') {
      x.globalAlpha = 1;
      x.fillStyle = '#c9b585'; lakePath(x, 1.28); x.fill();
      x.fillStyle = '#a99366'; lakePath(x, 1.1); x.fill();
      const g = x.createRadialGradient(toPx(LAKE.x), toPx(LAKE.z), 0, toPx(LAKE.x), toPx(LAKE.z), 5.5 * TEX_P);
      g.addColorStop(0, '#1f4a57'); g.addColorStop(0.7, '#3d7064'); g.addColorStop(1, '#6f8f6a');
      x.fillStyle = g; lakePath(x, 1.0); x.fill();
      for (let i = 0; i < 160; i++) { const a = R() * 6.2832, r = lakeR(a) * (1.02 + R() * 0.24); dab(x, R() < 0.5 ? '#8a7a55' : '#d8c79a', LAKE.x + Math.cos(a) * r, LAKE.z + Math.sin(a) * r, 0.2 + R() * 0.3, 0.5); }
    }
    // bords fondus vers la couleur du terrain lointain
    const f = pal.far, rgb = `${Math.round(f[0] * 255)},${Math.round(f[1] * 255)},${Math.round(f[2] * 255)}`;
    x.globalAlpha = 1;
    for (const [x0, y0, x1, y1, w, h, cx, cy] of [[0, 0, 0, 160, 0, 0, TEX_N, 160], [0, TEX_N, 0, TEX_N - 160, 0, TEX_N - 160, TEX_N, 160], [0, 0, 160, 0, 0, 0, 160, TEX_N], [TEX_N, 0, TEX_N - 160, 0, TEX_N - 160, 0, 160, TEX_N]]) {
      const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(w, h, cx, cy);
    }
  }
  /* Masque des zones sans herbe (bâtiments, terre, chemins, champs, eau). */
  let mask = new Uint8Array(MASK_N * MASK_N), fieldTiles = [];
  const mIdx = (wx, wz) => { const i = Math.floor((wx + W_HALF) * MASK_K), j = Math.floor((wz + W_HALF) * MASK_K); return i < 0 || j < 0 || i >= MASK_N || j >= MASK_N ? -1 : j * MASK_N + i; };
  function markRect(x0, z0, x1, z1, v) { for (let z = z0; z < z1; z += 1 / MASK_K) for (let x = x0; x < x1; x += 1 / MASK_K) { const k = mIdx(x, z); if (k >= 0) mask[k] = Math.max(mask[k], v); } }
  let lastGroundItems = [];
  function paintGround(items) {
    if (!groundCanvas) return;
    lastGroundItems = items;
    const x = groundCanvas.getContext('2d'), pal = PAL[biome], snow = biome === 'snow';
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.shadowBlur = 0;
    x.drawImage(baseCanvas, 0, 0);
    mask = new Uint8Array(MASK_N * MASK_N); fieldTiles = [];
    if (biome === 'green') for (let j = 0; j < MASK_N; j++) for (let i = 0; i < MASK_N; i++) { if (inLake(i / MASK_K - W_HALF, j / MASK_K - W_HALF, 1.15)) mask[j * MASK_N + i] = 3; }
    const blds = items.filter(it => it.type !== 'rempart' && it.key !== 'ghost'), walls = items.filter(it => it.type === 'rempart');
    const cen = b => { const s = BLD[b.type].size; return [b.gx + s / 2 - half, b.gz + s / 2 - half, s]; };
    const R = mulberry32(blds.length * 131 + 7);
    // sol tassé autour des bâtiments
    for (const b of blds) { const [cx, cz, s] = cen(b); dab(x, pal.dirt, cx, cz, s * (snow ? 1.7 : 1.25), snow ? 0.55 : 0.24); }
    if (snow) for (let i = 0; i < 40; i++) { const b = blds[i % Math.max(1, blds.length)]; if (!b) break; const [cx, cz, s] = cen(b); dab(x, pal.dirtD, cx + (R() - 0.5) * 6, cz + (R() - 0.5) * 6, 0.4 + R() * 0.9, 0.35); }
    // chemins jusqu'à la halle
    const hall = blds.find(b => b.type === 'halle' || b.type === 'mairie');
    if (hall) {
      const [hx, hz] = cen(hall);
      for (const b of blds) {
        if (b === hall || BLD[b.type].size < 2) continue;
        const [bx, bz] = cen(b), mx = (bx + hx) / 2 + (hash2(b.gx, b.gz) - 0.5) * 2.4, mz = (bz + hz) / 2 + (hash2(b.gz, b.gx) - 0.5) * 2.4;
        for (const [w, a, col] of [[1.5, 0.25, pal.dirt], [1.0, 0.6, pal.path], [0.5, 0.35, pal.dirtD]]) {
          x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = w * TEX_P; x.lineCap = 'round'; x.lineJoin = 'round';
          x.beginPath(); x.moveTo(toPx(bx), toPx(bz)); x.quadraticCurveTo(toPx(mx), toPx(mz), toPx(hx), toPx(hz)); x.stroke();
        }
        for (let t = 0; t <= 1; t += 0.04) {
          const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * hx, pz = (1 - t) * (1 - t) * bz + 2 * (1 - t) * t * mz + t * t * hz;
          markRect(px - 0.6, pz - 0.6, px + 0.6, pz + 0.6, 1);
          if (R() < 0.5) dab(x, pal.stone[Math.floor(R() * pal.stone.length)], px + (R() - 0.5) * 0.6, pz + (R() - 0.5) * 0.6, 0.06 + R() * 0.06, 0.8);
        }
      }
    }
    // champs de blé : leur aspect suit la saison
    for (const b of blds) {
      if (b.type !== 'champ' || b.dead || b.lvl <= 0) continue;
      const s2 = BLD[b.type].size, vert = hash2(b.gz, b.gx * 5) < 0.5, stage = cropStage, barley = b.crop === 'orge';
      for (let i = 0; i < s2; i++) for (let j = 0; j < s2; j++) {
        const gx = b.gx + i, gz = b.gz + j, wx = gx - half, wz = gz - half, X0 = toPx(wx), Y0 = toPx(wz);
        x.globalAlpha = 1; x.fillStyle = snow ? '#cfd6db' : '#7b5b35'; x.fillRect(X0, Y0, TEX_P, TEX_P);
        // l'orge est plus pâle que le blé : vert tendre au printemps, paille claire quand elle est mûre
        const crop = snow ? '#e8edf0' : stage === 2 ? (barley ? '#e2d08e' : '#cfb24e') : (barley ? '#a3bd55' : '#79a83c');
        for (const [col, w, off] of [[snow ? '#9aa4ab' : '#5c4225', 0.07, 0], [crop, 0.09, -0.06]]) {
          x.strokeStyle = col; x.lineWidth = TEX_P * w; x.globalAlpha = 0.85; x.beginPath();
          for (let k = 0; k < 6; k++) { const q = (k + 0.5) / 6 * TEX_P + off * TEX_P; if (vert) { x.moveTo(X0 + q, Y0); x.lineTo(X0 + q, Y0 + TEX_P); } else { x.moveTo(X0, Y0 + q); x.lineTo(X0 + TEX_P, Y0 + q); } }
          x.stroke();
        }
        if (!snow) fieldTiles.push([gx, gz, stage, vert, barley]);
        markRect(wx, wz, wx + 1, wz + 1, 2);
      }
    }
    // parcelles et ombre au pied des bâtiments
    for (const b of blds) {
      if (b.type === 'champ') continue;
      const big = b.type === 'mairie' || b.type === 'halle';
      if (BLD[b.type].size < 2) { const [cx1, cz1] = cen(b); dab(x, pal.dirt, cx1, cz1, 0.7, 0.35); markRect(cx1 - 0.6, cz1 - 0.6, cx1 + 0.6, cz1 + 0.6, 2); continue; }
      const [cx, cz, s] = cen(b), m = big ? 0.9 : 0.32, x0 = toPx(cx - s / 2 - m), y0 = toPx(cz - s / 2 - m), w = (s + 2 * m) * TEX_P;
      x.globalAlpha = 0.95; x.fillStyle = big ? pal.stone[0] : pal.dirt;
      x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, w, TEX_P * 0.35); else x.rect(x0, y0, w, w); x.fill();
      const nSt = big ? 140 : 26;
      for (let k = 0; k < nSt; k++) { x.globalAlpha = 0.75; x.fillStyle = pal.stone[k % pal.stone.length]; const sx = x0 + R() * w, sy = y0 + R() * w, sw = TEX_P * (big ? 0.26 : 0.1) * (0.6 + R() * 0.6); x.fillRect(sx, sy, sw, sw * 0.7); }
      x.globalAlpha = 1; x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = TEX_P * 0.5; x.fillStyle = 'rgba(30,22,14,0.35)';
      x.fillRect(toPx(cx - s / 2), toPx(cz - s / 2), s * TEX_P, s * TEX_P); x.shadowBlur = 0;
      markRect(cx - s / 2 - m - 0.15, cz - s / 2 - m - 0.15, cx + s / 2 + m + 0.15, cz + s / 2 + m + 0.15, 2);
    }
    // remparts : bande de terre et petite ombre
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = TEX_P * 0.25;
    for (const w of walls) { x.globalAlpha = 0.7; x.fillStyle = pal.dirtD; x.fillRect(toPx(w.gx - half) + 3, toPx(w.gz - half) + 3, TEX_P - 6, TEX_P - 6); markRect(w.gx - half - 0.1, w.gz - half - 0.1, w.gx - half + 1.1, w.gz - half + 1.1, 2); }
    x.shadowBlur = 0; x.globalAlpha = 1;
    groundTex.needsUpdate = true;
    buildDeco();
    planVillage(items);
  }
  /* Géométries simples fusionnées (arbres, touffes d'herbe) avec couleurs par sommet. */
  function mergeColored(parts) {
    let n = 0; for (const p of parts) n += p.g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const p of parts) {
      const g = p.g.index ? p.g.toNonIndexed() : p.g; g.computeVertexNormals();
      const P3 = g.attributes.position, N3 = g.attributes.normal;
      for (let i = 0; i < P3.count; i++) {
        pos[(o + i) * 3] = P3.getX(i); pos[(o + i) * 3 + 1] = P3.getY(i); pos[(o + i) * 3 + 2] = P3.getZ(i);
        if (p.n) { const dx = P3.getX(i) - p.n[0], dy = P3.getY(i) - p.n[1], dz = P3.getZ(i) - p.n[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; nor[(o + i) * 3] = dx / l * 0.75 + N3.getX(i) * 0.25; nor[(o + i) * 3 + 1] = dy / l * 0.75 + N3.getY(i) * 0.25; nor[(o + i) * 3 + 2] = dz / l * 0.75 + N3.getZ(i) * 0.25; }
        else { nor[(o + i) * 3] = N3.getX(i); nor[(o + i) * 3 + 1] = N3.getY(i); nor[(o + i) * 3 + 2] = N3.getZ(i); }
        const c = typeof p.c === 'function' ? p.c(P3.getX(i), P3.getY(i), P3.getZ(i)) : p.c;
        col[(o + i) * 3] = c[0]; col[(o + i) * 3 + 1] = c[1]; col[(o + i) * 3 + 2] = c[2];
      }
      o += P3.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  const srgb = (r, g, b) => { const c = new THREE.Color(r, g, b).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
  function bumpy(g, amt, seed) {
    const P3 = g.attributes.position;
    for (let i = 0; i < P3.count; i++) { const x = P3.getX(i), y = P3.getY(i), z = P3.getZ(i), k = 1 + (vnoise(x * 3 + seed, z * 3 + y * 2) - 0.5) * amt; P3.setXYZ(i, x * k, y * (1 + (k - 1) * 0.5), z * k); }
    return g;
  }
  const TREE_GEO = {};
  function treeGeo(kind) {
    if (TREE_GEO[kind]) return TREE_GEO[kind];
    const parts = [], trunk = new THREE.CylinderGeometry(0.07, 0.11, 0.9, 6); trunk.translate(0, 0.45, 0);
    parts.push({ g: trunk, c: srgb(0.36, 0.25, 0.15) });
    if (kind.startsWith('oak')) {
      const v = kind === 'oak2' ? 1 : 0, blobs = [[0, 1.25, 0, 0.62], [0.32, 1.05, 0.1, 0.42], [-0.3, 1.1, -0.12, 0.45], [0.05, 1.6, -0.05, 0.4]];
      blobs.forEach(([bx, by, bz, r], i) => {
        const g = bumpy(new THREE.IcosahedronGeometry(r, 1), 0.3, i * 7 + v * 13); g.translate(bx, by, bz);
        const base = v ? [0.3, 0.48, 0.17] : [0.23, 0.41, 0.15];
        parts.push({ g, n: [bx, by - r * 0.3, bz], c: (x, y, z) => { const k = (0.66 + (y - 0.8) * 0.5) * (0.85 + vnoise(x * 6 + 3, z * 6 + y * 4) * 0.3); return srgb(base[0] * k, base[1] * k, base[2] * k); } });
      });
    } else {
      const snowy = kind === 'pineS';
      for (let i = 0; i < 4; i++) {
        const r = 0.62 - i * 0.13, h = 0.75, g = new THREE.ConeGeometry(r, h, 8, 1); g.translate(0, 0.65 + i * 0.36, 0);
        parts.push({ g, c: (x, y) => { const up = y - (0.4 + i * 0.36); if (snowy && up > 0.18) return srgb(0.9, 0.93, 0.96); const k = 0.6 + up * 0.5; return srgb(0.12 * k, 0.3 * k, 0.17 * k); } });
      }
    }
    return (TREE_GEO[kind] = mergeColored(parts));
  }
  let bushG = null;
  function bushGeo() {
    if (bushG) return bushG;
    const parts = [];
    [[0, 0.32, 0, 0.42], [0.28, 0.24, 0.12, 0.3], [-0.26, 0.22, -0.08, 0.32]].forEach(([bx, by, bz, r], i) => {
      const g = bumpy(new THREE.IcosahedronGeometry(r, 1), 0.3, i * 5 + 2); g.translate(bx, by, bz);
      parts.push({ g, n: [bx, by - r * 0.4, bz], c: (x, y, z) => { const k = (0.7 + y * 0.6) * (0.85 + vnoise(x * 7, z * 7 + y * 3) * 0.3); return srgb(0.22 * k, 0.4 * k, 0.14 * k); } });
    });
    return (bushG = mergeColored(parts));
  }
  let tuftGeo = null;
  function tuftGeometry() {
    if (tuftGeo) return tuftGeo;
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.16, 0.3, 1, 1); g.translate(0, 0.15, 0); g.rotateY(i * Math.PI / 3);
      const P3 = g.attributes.position; for (let k = 0; k < P3.count; k++) if (P3.getY(k) > 0.2) P3.setX(k, P3.getX(k) * 0.25);
      parts.push({ g, c: (x, y) => y > 0.2 ? srgb(0.62, 0.78, 0.33) : srgb(0.25, 0.42, 0.14) });
    }
    return (tuftGeo = mergeColored(parts));
  }
  const vcMat = {};
  const vertexMat = side => vcMat[side] || (vcMat[side] = new THREE.MeshLambertMaterial({ vertexColors: true, side: side ? THREE.DoubleSide : THREE.FrontSide }));
  function instanced(geom, material, list, shadow) {
    const im = new THREE.InstancedMesh(geom, material, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    list.forEach(([x, y, z, s, ry, sy], i) => { q.setFromAxisAngle(up, ry || 0); ps.set(x, y, z); sc.set(s, s * (sy || 1), s); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); });
    im.count = list.length; im.castShadow = !!shadow; im.receiveShadow = true;
    return im;
  }
  function clearGroup(g) { while (g.children.length) { const c = g.children[0]; g.remove(c); if (c.dispose) c.dispose(); } }
  /* Décor qui dépend du village : herbe haute, épis dans les champs, petites caisses et tonneaux. */
  function buildDeco() {
    clearGroup(decoGroup);
    const R = mulberry32(fieldTiles.length * 17 + 3), snow = biome === 'snow', tufts = [], crops = [], rocks = [], props = [];
    if (!snow) {
      for (let c = 0; c < 60; c++) {
        const cx = (R() * 2 - 1) * (W_HALF - 1), cz = (R() * 2 - 1) * (W_HALF - 1), n = 2 + Math.floor(R() * 5);
        for (let i = 0; i < n; i++) {
          const wx = cx + (R() - 0.5) * 1.4, wz = cz + (R() - 0.5) * 1.4, k = mIdx(wx, wz);
          if (k < 0 || mask[k]) continue;
          if (Math.max(Math.abs(wx), Math.abs(wz)) < half - 2 && R() < 0.6) continue;
          tufts.push([wx, 0.02, wz, 0.22 + R() * 0.22, R() * 6.28, 0.7]);
        }
      }
      for (const [gx, gz, stage, vert, barley] of fieldTiles) for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) {
        const u = (a + 0.5) / 6, w = 0.12 + b * 0.25;
        crops.push([gx - half + (vert ? u : w), 0, gz - half + (vert ? w : u), 0.55 + R() * 0.25, R() * 6.28, (stage === 2 ? 1.15 : stage === 1 ? 0.85 : 0.35) * (barley ? 0.85 : 1), stage === 2, !!barley]);
      }
    } else {
      for (let i = 0; i < 260; i++) { const wx = (R() * 2 - 1) * (W_HALF - 0.5), wz = (R() * 2 - 1) * (W_HALF - 0.5), k = mIdx(wx, wz); if (k < 0 || mask[k]) continue; rocks.push([wx, 0, wz, 0.12 + R() * 0.2, R() * 6.28, 0.6]); }
    }
    for (let i = 0; i < 70; i++) { const wx = (R() * 2 - 1) * (W_HALF - 1), wz = (R() * 2 - 1) * (W_HALF - 1); if (Math.max(Math.abs(wx), Math.abs(wz)) < half + 0.5) continue; const k = mIdx(wx, wz); if (k >= 0 && mask[k] === 3) continue; rocks.push([wx, 0, wz, 0.18 + R() * 0.35, R() * 6.28, 0.55]); }
    const PROPS = { bucheron: ['logs', 'logs', 'crate'], carriere: ['block', 'block', 'barrel'], champ: ['hay'], moulin: ['sack', 'sack', 'hay'], boulangerie: ['sack', 'barrel'], brasserie: ['sack', 'crate'], entrepot: ['crate', 'barrel', 'sack'], taverne: ['barrel', 'barrel', 'crate'], halle: ['barrel', 'crate', 'sack'], chasse: ['crate', 'logs'] };
    const propL = { barrel: [], crate: [], sack: [], logs: [], block: [], hay: [] };
    for (const it of lastGroundItems) {
      if (it.dead || it.key === 'ghost' || !PROPS[it.type] || it.lvl <= 0) continue;
      const sz = BLD[it.type].size, list = PROPS[it.type];
      list.forEach((kind, i) => {
        const corner = [[-1, -1], [1, -1], [-1, 1], [1, 1]][(i + it.gx + it.gz) % 4], m = sz / 2 + 0.18;
        const wx = it.gx + sz / 2 - half + corner[0] * m + (R() - 0.5) * 0.2, wz = it.gz + sz / 2 - half + corner[1] * m + (R() - 0.5) * 0.2;
        propL[kind].push([wx, 0, wz, 1, R() * 6.28]);
      });
    }
    const PG = { barrel: ['cyl8', 0x7a5534, 0.26, 0.34], crate: ['box', 0x9b7448, 0.3, 0.28], sack: ['sph', 0xd8c49a, 0.3, 0.24], logs: ['cyl6', 0x6e4a2a, 0.5, 0.2], block: ['box', 0x9a968c, 0.32, 0.24], hay: ['cyl8', 0xd8b65a, 0.34, 0.3] };
    for (const k in propL) if (propL[k].length) { const [gk, col, w, h] = PG[k]; decoGroup.add(instanced(geo(gk), mat(col), propL[k].map(p => [p[0], 0, p[2], 1, p[4]]).map(p => p), true)); const im = decoGroup.children[decoGroup.children.length - 1]; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(w, h, w), up = new THREE.Vector3(0, 1, 0); propL[k].forEach((p, i) => { q.setFromAxisAngle(up, p[4]); if (k === 'logs') q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); ps.set(p[0], k === 'logs' ? 0.1 : 0, p[2]); m4.compose(ps, q, k === 'logs' ? new THREE.Vector3(0.2, 0.5, 0.2) : sc); im.setMatrixAt(i, m4); }); }
    if (tufts.length) decoGroup.add(instanced(bushGeo(), vertexMat(false), tufts, true));
    /* épis : blé mûr, blé vert, orge mûre, orge verte */
    for (const [ripe, barley, col] of [[true, false, 0xd4b45a], [false, false, 0x6f9e37], [true, true, 0xe4d394], [false, true, 0x9dbb50]]) {
      const L = crops.filter(c => c[6] === ripe && c[7] === barley);
      if (L.length) decoGroup.add(instanced(geo('cone4'), mat(col), L.map(c => [c[0], 0, c[2], 0.1, c[4], c[5] * 3]), false));
    }
    if (rocks.length) decoGroup.add(instanced(geo('dode'), mat(snow ? 0x6f6c68 : 0x8a8d8a), rocks, true));
  }
  /* Forêts, collines lointaines : selon le biome (vert au village, neige chez les orques). */
  function buildForest() {
    clearGroup(forestGroup);
    const snow = biome === 'snow', R = mulberry32(snow ? 404 : 202), lists = {}, kinds = snow ? ['pineS', 'pine'] : ['oak', 'oak2', 'pine'];
    for (const k of kinds) lists[k] = [];
    const place = (x, z, s) => { const k = kinds[snow ? (R() < 0.75 ? 0 : 1) : (R() < 0.42 ? 0 : R() < 0.75 ? 1 : 2)]; lists[k].push([x, heightAt(x, z), z, s, R() * 6.28, 0.85 + R() * 0.35]); };
    // bosquets serrés autour du plateau, plus clairsemés au loin
    for (let c = 0; c < 22; c++) {
      const a = R() * 6.2832, d = 15 + R() * 26, cx = Math.cos(a) * d, cz = Math.sin(a) * d, n = 6 + Math.floor(R() * 14);
      for (let i = 0; i < n; i++) {
        const x = cx + (R() - 0.5) * 7, z = cz + (R() - 0.5) * 7;
        if (Math.max(Math.abs(x), Math.abs(z)) < half + 1.2) continue;
        if (!snow && inLake(x, z, 1.3)) continue;
        place(x, z, 1.1 + R() * 0.9);
      }
    }
    for (let i = 0; i < 100; i++) {
      const x = (R() * 2 - 1) * 70, z = (R() * 2 - 1) * 70;
      if (Math.max(Math.abs(x), Math.abs(z)) < half + 2 || (!snow && inLake(x, z, 1.3))) continue;
      place(x, z, 1 + R() * 1.1);
    }
    for (const k of kinds) if (lists[k].length) {
      const near = lists[k].filter(t => Math.abs(t[0]) < 19 && Math.abs(t[2]) < 19), far = lists[k].filter(t => !(Math.abs(t[0]) < 19 && Math.abs(t[2]) < 19));
      if (near.length) forestGroup.add(instanced(treeGeo(k), vertexMat(false), near, true));
      if (far.length) forestGroup.add(instanced(treeGeo(k), vertexMat(false), far, false));
    }
  }
  /* Relief au-delà du plateau peint. */
  function heightAt(x, z) {
    const d = Math.max(Math.abs(x), Math.abs(z)) - W_HALF;
    if (d < 0) return 0;
    const k = Math.min(1, d / 14);
    return k * k * (fbm(x * 0.045 + 3, z * 0.045 + 7) * 11 - 2.5) + d * 0.05;
  }
  function buildOuter() {
    if (outerMesh) { terrainGroup.remove(outerMesh); outerMesh.geometry.dispose(); }
    const g = new THREE.PlaneGeometry(240, 240, 120, 120); g.rotateX(-Math.PI / 2);
    const P3 = g.attributes.position, col = new Float32Array(P3.count * 3), pal = PAL[biome], snow = biome === 'snow';
    for (let i = 0; i < P3.count; i++) {
      const x = P3.getX(i), z = P3.getZ(i), y = heightAt(x, z) - 0.04; P3.setY(i, y);
      const n = fbm(x * 0.12, z * 0.12), hi = Math.max(0, Math.min(1, (y - 3) / 5));
      let c = pal.far.map(v => v * (0.82 + n * 0.36));
      c = c.map((v, j) => v * (1 - hi) + pal.rock[j] * hi);
      if (snow && y > 4) c = [0.9, 0.93, 0.96];
      const s = srgb(c[0], c[1], c[2]); col[i * 3] = s[0]; col[i * 3 + 1] = s[1]; col[i * 3 + 2] = s[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    outerMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    outerMesh.receiveShadow = true; terrainGroup.add(outerMesh);
  }
  function waterNormalMap() {
    const c = mkCanvas(256), x = c.getContext('2d'), img = x.createImageData(256, 256), h = (i, j) => fbm(i / 256 * 6, j / 256 * 6) + 0.5 * fbm(i / 256 * 14 + 9, j / 256 * 14);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const dx = (h((i + 1) & 255, j) - h((i + 255) & 255, j)) * 6, dz = (h(i, (j + 1) & 255) - h(i, (j + 255) & 255)) * 6, l = Math.sqrt(dx * dx + dz * dz + 1), k = (j * 256 + i) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (-dz / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
    return t;
  }
  function buildWater() {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = lakeR(a) * 1.03, px = LAKE.x + Math.cos(a) * r, pz = LAKE.z + Math.sin(a) * r; if (i) shape.lineTo(px, -pz); else shape.moveTo(px, -pz); }
    const g = new THREE.ShapeGeometry(shape, 24); g.rotateX(-Math.PI / 2);
    waterNormal = waterNormalMap();
    waterMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lin(0x2d6f86), roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.78, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.3 }));
    waterMesh.position.y = 0.03; waterMesh.receiveShadow = true; waterMesh.renderOrder = 1;
    terrainGroup.add(waterMesh);
  }
  /* Montagnes à l'horizon. */
  function buildHorizon() {
    for (const c of decoProc.children.slice()) decoProc.remove(c);
    const R = mulberry32(7), snow = biome === 'snow';
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + R() * 0.2, r = 80 + R() * 30, h = 20 + R() * 26, w = 24 + R() * 22;
      decoProc.add(P('cone7', snow ? 0xc9d3dc : (R() < 0.5 ? 0x7b8a92 : 0x6c7c74), w, h, w * (0.8 + R() * 0.4), Math.cos(a) * r, -0.5, Math.sin(a) * r, R() * 3, true));
      decoProc.add(P('cone7', 0xeef3f6, w * 0.38, h * 0.38, w * 0.33, Math.cos(a) * r, h * 0.63 - 0.5, Math.sin(a) * r, R() * 3, true));
    }
  }
  function setBiome(bi) {
    if (bi === biome) return;
    biome = bi;
    paintBase(bi); buildOuter(); buildForest(); buildHorizon();
    if (waterMesh) waterMesh.visible = bi === 'green';
    groundSig = '';
  }
  function buildWorld() {
    groundCanvas = mkCanvas(TEX_N);
    groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.anisotropy = 4; groundTex.encoding = THREE.sRGBEncoding;
    groundMat = new THREE.MeshStandardMaterial({ map: groundTex, bumpMap: groundTex, bumpScale: 0.035, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
    outerMat = groundMat;
    const play = new THREE.Mesh(new THREE.PlaneGeometry(2 * W_HALF, 2 * W_HALF), groundMat);
    play.rotation.x = -Math.PI / 2; play.position.y = -0.005; play.receiveShadow = true; terrainGroup.add(play);
    buildWater();
    scene.add(terrainGroup); scene.add(decoGroup); scene.add(forestGroup); scene.add(decoProc); scene.add(lifeGroup);
    setBiome('green');
    paintGround([]);
  }
  /* Le sol est repeint quand les bâtiments changent de place (pas quand ils sont détruits). */
  function scheduleGround(items) {
    /* repeindre le sol si un bâtiment bouge, se termine (un champ fini) ou change de culture */
    const sig = biome + '|' + items.filter(it => it.key !== 'ghost').map(it => it.type[0] + it.gx + ',' + it.gz + (it.lvl > 0 ? '' : '_') + (it.crop === 'orge' ? 'o' : '')).join(';');
    if (sig === groundSig) return;
    groundSig = sig;
    clearTimeout(groundTimer);
    groundTimer = setTimeout(() => paintGround(items), 60);
  }
  function buildWorldModels() { /* le décor est maintenant entièrement généré (forêts, relief, eau) */ }

  /* ---------- initialisation ---------- */
  function init(cv) {
    canvas = cv;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222233);
    scene.fog = new THREE.Fog(0xe9c27e, 70, 150);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 140 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    winMat = basic(0xffc56b); fireMat = basic(0xffa040);
    barBg = basic(0x1b1b1b, { transparent: true, opacity: 0.7, depthTest: false });
    selMat = basic(0xfff2c0, { transparent: true, opacity: 0.35, depthWrite: false });
    ghostOk = basic(0x6cdc8c, { transparent: true, opacity: 0.45, depthWrite: false });
    ghostBad = basic(0xe86a5a, { transparent: true, opacity: 0.5, depthWrite: false });
    ringMat = basic(0xff6a3c, { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    ringFill = basic(0xff4a2c, { transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    glowTex = radialTexture();
    emberMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a3a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    try { buildWorld(); } catch (e) { console.error('décor', e); }
    scene.add(bldGroup); scene.add(unitGroup); scene.add(fxGroup); scene.add(rangeGroup); scene.add(wallGroup);
    selMesh = new THREE.Mesh(geo('plane'), selMat); selMesh.visible = false; selMesh.renderOrder = 2; scene.add(selMesh);
    ghostMesh = new THREE.Mesh(geo('plane'), ghostOk); ghostMesh.visible = false; ghostMesh.renderOrder = 3; scene.add(ghostMesh);
    const zc = document.createElement('canvas'); zc.width = zc.height = GRID * 4;
    zoneTex = new THREE.CanvasTexture(zc); zoneTex.magFilter = THREE.NearestFilter; zoneTex.minFilter = THREE.NearestFilter;
    zoneMesh = new THREE.Mesh(geo('plane'), new THREE.MeshBasicMaterial({ map: zoneTex, transparent: true, depthWrite: false }));
    zoneMesh.scale.set(GRID, 1, GRID); zoneMesh.position.y = 0.02; zoneMesh.visible = false; zoneMesh.renderOrder = 1; scene.add(zoneMesh);
    gridMesh = new THREE.GridHelper(GRID - 2 * EDGE, GRID - 2 * EDGE, 0xffffff, 0xffffff);
    gridMesh.material.transparent = true; gridMesh.material.opacity = 0.22; gridMesh.position.y = 0.015; gridMesh.visible = false; scene.add(gridMesh);
    setupControls();
    resize(); window.addEventListener('resize', resize);
    setMood('warm');
    ok = true;
    requestAnimationFrame(loop);
    return true;
  }
  function resize() {
    if (!renderer) return;
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    aspect = w / h; frustum();
  }
  function frustum() {
    const v = cam.view;
    camera.left = -v * aspect / 2; camera.right = v * aspect / 2; camera.top = v / 2; camera.bottom = -v / 2;
    camera.updateProjectionMatrix();
  }

  /* ---------- caméra isométrique et gestes ---------- */
  const ptrs = new Map(); let gest = null;
  let mapPt = (cx, cy) => { const r = canvas.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  const defaultMap = mapPt;
  function setPointerMap(f) { mapPt = f || defaultMap; }
  const VMIN = 7, VMAX = 42;
  const clampT = v => Math.max(-half - 2, Math.min(half + 2, v));
  function panBy(dx, dy) {
    const k = cam.view / (canvas.clientHeight || 1), sv = k / Math.sin(PITCH);
    const rx = Math.cos(YAW), rz = -Math.sin(YAW), ux = -Math.sin(YAW), uz = -Math.cos(YAW);
    cam.tx = clampT(cam.tx - rx * dx * k + ux * dy * sv);
    cam.tz = clampT(cam.tz - rz * dx * k + uz * dy * sv);
  }
  function setupControls() {
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      const [x, y] = mapPt(e.clientX, e.clientY);
      ptrs.set(e.pointerId, { x, y });
      if (ptrs.size === 1) gest = { k: 'one', x0: x, y0: y, lx: x, ly: y, t0: performance.now(), moved: false };
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        gest = { k: 'two', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, v0: cam.view, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true };
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const [x, y] = mapPt(e.clientX, e.clientY);
      ptrs.set(e.pointerId, { x, y });
      if (!gest) return;
      if (gest.k === 'one' && ptrs.size === 1) {
        if (!gest.moved && Math.hypot(x - gest.x0, y - gest.y0) > 8) gest.moved = true;
        if (gest.moved) { panBy(x - gest.lx, y - gest.ly); gest.lx = x; gest.ly = y; }
      } else if (gest.k === 'two' && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.view = Math.max(VMIN, Math.min(VMAX, gest.v0 * gest.d0 / d)); frustum();
        panBy(mx - gest.mx, my - gest.my); gest.mx = mx; gest.my = my;
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (gest && gest.k === 'one' && !gest.moved && performance.now() - gest.t0 < 600 && tapHook) tapHook(e.clientX, e.clientY);
      if (ptrs.size === 0) gest = null;
      else if (gest && gest.k === 'two') { const [a] = [...ptrs.values()]; gest = { k: 'one', x0: a.x, y0: a.y, lx: a.x, ly: a.y, t0: 0, moved: true }; }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.view = Math.max(VMIN, Math.min(VMAX, cam.view * (1 + e.deltaY * 0.0012))); frustum(); }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  function updateCamera(dt) {
    const cp = Math.cos(PITCH), D = 70;
    let ox = 0, oz = 0;
    if (shakeT > 0) { shakeT = Math.max(0, shakeT - (dt || 0)); const a = shakeA * shakeT / 0.35; ox = (Math.random() - 0.5) * a; oz = (Math.random() - 0.5) * a; }
    camera.position.set(cam.tx + ox + D * cp * Math.sin(YAW), D * Math.sin(PITCH), cam.tz + oz + D * cp * Math.cos(YAW));
    camera.lookAt(cam.tx + ox, 0, cam.tz + oz);
  }
  function shake(a) { shakeA = Math.max(shakeT > 0 ? shakeA : 0, a); shakeT = 0.35; }
  function resetCamera(view) { cam.tx = 0; cam.tz = 0; cam.view = view || (aspect < 0.8 ? 28 : aspect > 1.6 ? 15 : 19); if (camera) frustum(); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function setRay(cx, cy) { const [lx, ly] = mapPt(cx, cy), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; ndc.set(lx / w * 2 - 1, -(ly / h) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pickGround(cx, cy) { setRay(cx, cy); if (!ray.ray.intersectPlane(plane, hit)) return null; return [hit.x + half, hit.z + half]; }
  function pickBuilding(cx, cy) {
    setRay(cx, cy);
    const hits = ray.intersectObjects(bldGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && o.parent !== bldGroup) o = o.parent; if (o && o.userData.key != null) return o.userData.key; }
    const g = pickGround(cx, cy);
    if (g) { const w = wallAt.get(Math.floor(g[0]) + ',' + Math.floor(g[1])); if (w) return w.key; }
    return null;
  }

  /* ---------- bâtiments affichés ---------- */
  /* Modèles provisoires (en attendant ceux générés avec Meshy) et équivalents dessinés par le code. */
  const B_MODEL = { halle: 'castle', taverne: 'tavern', bucheron: 'lumbermill', carriere: 'mine', moulin: 'windmill', boulangerie: 'market', entrepot: 'barracks' };
  const V1_PROC = { halle: 'mairie', taverne: 'camp', bucheron: 'scierie', carriere: 'carriere', moulin: 'ferme', entrepot: 'entrepot', boulangerie: 'caserne' };
  const SMOKE = ['halle', 'taverne', 'bucheron', 'boulangerie'];
  const TEAM = { '#D27A22': 2, '#2F8A63': 3, '#4A78C2': 0, '#B24F78': 2, '#8A67C6': 0 };
  const MODEL_RY = Math.PI / 4;
  const protos = new Map();
  function remapUV(g, k) {
    const uv = g.attributes.uv; if (!uv) return;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u < 0.125 && v >= 0.75) uv.setX(i, u + 0.125 * k); }
    uv.needsUpdate = true;
  }
  function proto(name, team, orc) {
    const key = name + '|' + team + '|' + (orc ? 1 : 0);
    if (protos.has(key)) return protos.get(key);
    const m2 = name.indexOf('m2:') === 0;
    const src = m2 ? LIB.m2[name.slice(3)] : LIB.b[name]; if (!src) return null;
    if (m2) team = 0;
    const root = src.scene.clone(true);
    const tint = new THREE.Color(0.66, 0.56, 0.52);
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (team) { o.geometry = o.geometry.clone(); remapUV(o.geometry, team); }
      if (orc) { o.material = o.material.clone(); o.material.color.multiply(tint); }
    });
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    const wrap = new THREE.Group(); wrap.add(root); wrap.userData.size = size;
    protos.set(key, wrap);
    return wrap;
  }
  function modelInst(name, team, orc, foot, ry) {
    const p = proto(name, team, orc); if (!p) return null;
    const o = p.clone(true), sz = p.userData.size, k = foot / Math.max(sz.x, sz.z, 0.01);
    o.scale.setScalar(k); o.rotation.y = ry || 0; o.userData.h = sz.y * k;
    return o;
  }
  function sigOf(it) { return [it.type, it.lvl, it.gx, it.gz, it.up ? 1 : 0, it.dead ? 1 : 0, it.col, it.orc ? 1 : 0, it.id || 0, LIB.ver].join('|'); }
  function placeGroup(g, it) { const s = BLD[it.type].size; g.position.set(it.gx + s / 2 - half, 0, it.gz + s / 2 - half); }
  function makeGlow(color, size, y) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    s.scale.set(size, size, 1); s.position.y = y; s.renderOrder = 5;
    return s;
  }
  /* ---------- bâtiments dessinés par le code : maisons, pavillon de chasse, champs, décorations ---------- */
  const ROOFS = [0x8e3b2d, 0x6b4a2e, 0x7a6a4a, 0x5d4a3a, 0x8a5a2a, 0x46576a];
  const rotXZ = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  function houseG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), R = mulberry32((it.id || 1) * 7919 + 3);
    const roofC = ROOFS[Math.floor(R() * ROOFS.length)], wallC = R() < 0.5 ? 0xe8dcc0 : 0xd8c6a0, ry = R() < 0.5 ? 0 : Math.PI / 2;
    const b = new THREE.Group(); b.rotation.y = ry; g.add(b);
    const H = 0.72 + 0.32 * (lv - 1), y0 = 0.14;
    b.add(P('box', 0x8a8378, 1.62, y0, 1.32, 0, 0, 0));
    b.add(P('box', wallC, 1.45, H, 1.15, 0, y0, 0));
    for (const x of [-0.7, 0, 0.7]) b.add(P('box', 0x5f4127, 0.06, H, 0.04, x, y0, 0.585, 0, true));
    b.add(P('box', 0x5f4127, 1.46, 0.06, 0.04, 0, y0 + H * 0.55, 0.585, 0, true));
    b.add(P('prism', roofC, 1.72, 0.78, 1.44, 0, y0 + H, 0));
    b.add(P('box', 0x3e2716, 0.28, 0.46, 0.04, 0.32, y0, 0.6, 0, true));
    b.add(P('box', winMat, 0.2, 0.2, 0.04, -0.36, y0 + H * 0.42, 0.6, 0, true));
    b.add(P('box', winMat, 0.2, 0.2, 0.04, 0.36, y0 + H * 0.42, -0.6, 0, true));
    b.add(P('box', 0x7d858b, 0.2, 0.62, 0.2, -0.45, y0 + H + 0.12, -0.3));
    if (lv >= 2) { b.add(P('box', wallC, 0.62, 0.62, 0.62, 0.9, y0, -0.22)); b.add(P('prism', roofC, 0.76, 0.42, 0.72, 0.9, y0 + 0.62, -0.22)); }
    if (lv >= 3) b.add(P('box', 0x9b7a54, 0.5, 0.08, 0.32, -0.4, y0 + H * 0.55, 0.72, 0, true));
    const [ex, ez] = rotXZ(-0.45, -0.3, ry);
    return { g, info: { top: y0 + H + 0.8, muzzle: 1, emit: [[ex, y0 + H + 0.8, ez]] } };
  }
  function lodgeG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl);
    g.add(P('box', 0x6b5a44, 1.62, 0.12, 1.4, 0, 0, 0));
    for (let i = 0; i < 6; i++) g.add(logX(1.42, 0.16, 0.71, 0.2 + i * 0.15, 0.55, 0x5f4127));
    g.add(P('box', 0x5f4127, 1.3, 0.9, 1.0, 0, 0.12, -0.05));
    g.add(P('prism', 0xb8914a, 1.75, 0.7 + 0.08 * lv, 1.5, 0, 1.02, -0.05));
    g.add(P('box', 0x2e1f12, 0.3, 0.5, 0.04, 0, 0.12, 0.62, 0, true));
    for (const sx of [-1, 1]) { g.add(piv(sx * 0.12, 1.0, 0.64, [P('box', 0xe8dcc0, 0.04, 0.32, 0.04, 0, 0, 0, 0, true), P('box', 0xe8dcc0, 0.03, 0.16, 0.03, sx * 0.06, 0.18, 0, 0, true)], 0, 0, sx * 0.5)); }
    for (const x of [-0.95, -0.35]) g.add(P('box', 0x5f4127, 0.06, 0.9, 0.06, x, 0, 0.95, 0, true));
    g.add(P('box', 0x5f4127, 0.66, 0.05, 0.05, -0.65, 0.88, 0.95, 0, true));
    g.add(P('box', 0x8a5a36, 0.5, 0.55, 0.03, -0.65, 0.32, 0.95, 0, true));
    return { g, info: { top: 1.9, muzzle: 1, emit: [[0.45, 1.75, -0.3]] } };
  }
  function fieldG(it) {
    const g = new THREE.Group(), s = BLD[it.type].size, e = s / 2 - 0.04;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(P('box', 0x7a5c3a, 0.08, 0.38, 0.08, sx * e, 0, sz * e, 0, true));
    for (const sz of [-1, 1]) g.add(P('box', 0x8b6a45, s - 0.1, 0.04, 0.04, 0, 0.26, sz * e, 0, true));
    g.add(P('box', 0x8b6a45, 0.04, 0.04, s - 0.1, -e, 0.26, 0, 0, true));
    g.add(P('box', 0x6b4a2e, 0.05, 0.8, 0.05, e - 0.35, 0, e - 0.35, 0, true));
    g.add(P('box', 0x6b4a2e, 0.5, 0.05, 0.05, e - 0.35, 0.55, e - 0.35, 0.6, true));
    g.add(P('sph', 0xd8c49a, 0.16, 0.16, 0.16, e - 0.35, 0.78, e - 0.35, 0, true));
    g.add(P('cone6', 0x8a6a3a, 0.24, 0.12, 0.24, e - 0.35, 0.86, e - 0.35, 0, true));
    return { g, info: { top: 0.9, muzzle: 0.5, emit: [] } };
  }
  function benchG() {
    const g = new THREE.Group();
    g.add(P('box', 0x9b7a54, 0.7, 0.06, 0.24, 0, 0.24, 0)); g.add(P('box', 0x9b7a54, 0.7, 0.2, 0.05, 0, 0.3, -0.11));
    for (const x of [-0.28, 0.28]) g.add(P('box', 0x5f4127, 0.06, 0.24, 0.2, x, 0, 0, 0, true));
    return { g, info: { top: 0.6, muzzle: 0.4, emit: [] } };
  }
  function flowersG(it) {
    const g = new THREE.Group(), R = mulberry32((it.id || 1) * 131);
    g.add(P('box', 0x6b4a2e, 0.82, 0.12, 0.82, 0, 0, 0)); g.add(P('box', 0x5a4028, 0.7, 0.13, 0.7, 0, 0, 0, 0, true));
    const cols = [0xd8483a, 0xf2c94c, 0x9b6fd0, 0xf4f1ea, 0xe87fb0];
    for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 0.22 + (R() - 0.5) * 0.06, z = (Math.floor(i / 3) - 1) * 0.22 + (R() - 0.5) * 0.06; g.add(P('cyl6', 0x4f7f2e, 0.03, 0.18, 0.03, x, 0.12, z, 0, true)); g.add(P('sph', cols[Math.floor(R() * cols.length)], 0.12, 0.09, 0.12, x, 0.28, z, 0, true)); }
    return { g, info: { top: 0.5, muzzle: 0.3, emit: [] } };
  }
  function fountainG() {
    const g = new THREE.Group();
    g.add(P('cyl12', 0x9a968c, 1.7, 0.36, 1.7, 0, 0, 0)); g.add(P('cyl12', 0x7d858b, 1.5, 0.37, 1.5, 0, 0.01, 0, 0, true));
    const w = P('cyl12', new THREE.MeshStandardMaterial({ color: lin(0x3f8fb4), roughness: 0.15, metalness: 0.05, envMapIntensity: 1.2 }), 1.42, 0.04, 1.42, 0, 0.3, 0, 0, true); g.add(w);
    g.add(P('cyl8', 0xb6b2a8, 0.24, 0.9, 0.24, 0, 0.3, 0)); g.add(P('cyl12', 0xb6b2a8, 0.62, 0.12, 0.62, 0, 1.1, 0)); g.add(P('cyl12', 0x3f8fb4, 0.52, 0.03, 0.52, 0, 1.2, 0, 0, true));
    return { g, info: { top: 1.4, muzzle: 1, emit: [] } };
  }
  function statueG() {
    const g = new THREE.Group(), st = 0xb6b2a8;
    g.add(P('box', 0x8a8378, 0.66, 0.42, 0.66, 0, 0, 0)); g.add(P('box', 0xc9922e, 0.68, 0.05, 0.68, 0, 0.42, 0, 0, true));
    g.add(P('cyl8', st, 0.3, 0.55, 0.26, 0, 0.47, 0)); g.add(P('sph', st, 0.2, 0.2, 0.2, 0, 1.06, 0));
    g.add(piv(0.16, 0.92, 0, [P('box', st, 0.08, 0.45, 0.08, 0, 0, 0)], 0, 0, -0.5));
    g.add(piv(0.36, 1.2, 0, [P('box', 0xc9d0d6, 0.05, 0.5, 0.05, 0, 0, 0, 0, true)], 0, 0, -0.2));
    return { g, info: { top: 1.6, muzzle: 1, emit: [] } };
  }
  /* Brasserie : maison à colombages, cuve de cuivre sous un auvent, tonneaux et enseigne (en attendant son modèle Meshy). */
  function brasserieG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), y0 = 0.14, H = 0.78 + 0.22 * (lv - 1);
    g.add(P('box', 0x8a8378, 1.72, y0, 1.5, 0, 0, 0));
    g.add(P('box', 0xe4d6b4, 1.12, H, 1.06, -0.24, y0, -0.16));
    for (const x of [-0.79, -0.24, 0.31]) g.add(P('box', 0x5f4127, 0.06, H, 0.04, x, y0, 0.38, 0, true));
    g.add(P('box', 0x5f4127, 1.13, 0.06, 0.04, -0.24, y0 + H * 0.55, 0.38, 0, true));
    g.add(P('prism', 0x8e3b2d, 1.34, 0.68, 1.28, -0.24, y0 + H, -0.16));
    g.add(P('box', 0x3e2716, 0.28, 0.46, 0.04, -0.42, y0, 0.4, 0, true));
    g.add(P('box', winMat, 0.2, 0.2, 0.04, 0.02, y0 + H * 0.3, 0.4, 0, true));
    g.add(P('box', 0x8a4a32, 0.22, 0.75, 0.22, -0.6, y0 + H + 0.05, -0.45));
    // auvent et cuve de cuivre
    for (const [x, z] of [[0.36, 0.62], [0.78, 0.62], [0.78, -0.05]]) g.add(P('box', 0x5f4127, 0.06, 0.78, 0.06, x, y0, z, 0, true));
    g.add(P('box', 0x9b6a3a, 0.56, 0.05, 0.82, 0.57, y0 + 0.78, 0.29, 0, true));
    g.add(P('cyl12', 0xb87333, 0.46, 0.36, 0.46, 0.56, y0, 0.3));
    g.add(P('sph', 0xc98a4a, 0.46, 0.26, 0.46, 0.56, y0 + 0.23, 0.3, 0, true));
    g.add(P('cyl8', 0xb87333, 0.06, 0.26, 0.06, 0.56, y0 + 0.44, 0.3, 0, true));
    // tonneaux et enseigne à la chope
    for (const [x, z, ry] of [[0.62, -0.45, 0], [0.32, -0.62, 0.6]]) g.add(P('cyl8', 0x7a5534, 0.3, 0.38, 0.3, x, y0, z, ry));
    g.add(P('box', 0x5f4127, 0.04, 0.04, 0.32, -0.83, y0 + H * 0.8, 0.5, 0, true));
    g.add(P('box', 0x9b7448, 0.04, 0.24, 0.22, -0.84, y0 + H * 0.8 - 0.26, 0.6, 0, true));
    g.add(P('cyl8', 0xd8a23a, 0.05, 0.1, 0.08, -0.87, y0 + H * 0.8 - 0.2, 0.6, 0, true));
    if (lv >= 2) g.add(P('cyl8', 0x7a5534, 0.3, 0.38, 0.3, 0.8, y0, -0.3));
    if (lv >= 3) { g.add(P('box', 0xe4d6b4, 0.5, 0.5, 0.5, -0.55, y0, 0.55)); g.add(P('prism', 0x8e3b2d, 0.62, 0.34, 0.6, -0.55, y0 + 0.5, 0.55)); }
    return { g, info: { top: y0 + H + 0.8, muzzle: 1, emit: [[-0.6, y0 + H + 0.85, -0.45]] } };
  }
  const PROC2 = { maison: houseG, chasse: lodgeG, champ: fieldG, banc: benchG, fleurs: flowersG, fontaine: fountainG, statue: statueG, brasserie: brasserieG };
  function build(it) {
    const s = BLD[it.type].size, g = new THREE.Group();
    let info = { top: 1.2, muzzle: 1, emit: [] };
    let glow = null;
    const team = TEAM[it.col] != null ? TEAM[it.col] : 0, foot = s * 0.98, small = s < 2 || it.type === 'champ';
    if (it.dead) { const m = LIB.ok && modelInst('destroyed', 0, false, foot * 0.92, MODEL_RY); if (m) g.add(m); else g.add(makeRubble(s)); info.top = 0.8; }
    else if (it.lvl <= 0) {
      const m = LIB.ok && s >= 2 && modelInst('scaffolding', 0, false, foot * 0.85, MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h + 0.2; }
      else { g.add(P('box', 0xb39669, s - 0.2, 0.06, s - 0.2, 0, 0, 0, 0, true)); g.add(makeScaffold(s, s < 2 ? 0.5 : 1.0)); info.top = s < 2 ? 0.8 : 1.4; }
    } else if (PROC2[it.type] && !(LIB.ok && LIB.m2[it.type])) {
      const b = PROC2[it.type](it); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    } else if (LIB.ok && (LIB.m2[it.type] || B_MODEL[it.type])) {
      const m = modelInst(LIB.m2[it.type] ? 'm2:' + it.type : B_MODEL[it.type], team, false, foot * (1 + 0.035 * (Math.min(5, it.lvl) - 1)), MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h; info.muzzle = Math.max(0.8, info.top * 0.8); }
      if (SMOKE.includes(it.type)) info.emit.push([0.15, info.top * 0.9, -0.15]);
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.6)));
    } else {
      const b = makeBld(V1_PROC[it.type] || 'entrepot', it.lvl, it.col || COLORS[0], false); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    }
    if (!it.dead && it.lvl > 0 && !small) { glow = makeGlow(0xffc070, s * 1.6, Math.min(1.4, info.top * 0.45)); g.add(glow); }
    g.userData.key = it.key;
    placeGroup(g, it);
    const rec = { g, sig: sigOf(it), item: it, info, bar: null, hp: null, glow, ph: Math.random() * 6, burnT: 0 };
    if (it.up) { rec.bar = makeBar(Math.min(1.2, s * 0.6), 0xf0a548); rec.bar.position.set(0, info.top + 0.5, 0); g.add(rec.bar); }
    return rec;
  }
  function setBuildings(items) {
    const seen = new Set(), walls = [];
    const fresh = blds.size === 0 && wallAt.size === 0;
    for (const it of items) {
      if (it.type === 'rempart') { walls.push(it); continue; }
      seen.add(it.key);
      const old = blds.get(it.key), sig = sigOf(it);
      if (old && old.sig === sig) { old.item = it; continue; }
      if (old) { bldGroup.remove(old.g); pruneAnims(old.g); }
      const rec = build(it); blds.set(it.key, rec); bldGroup.add(rec.g);
      if (!fresh && !it.dead && it.key !== 'ghost' && (!old || old.item.lvl !== it.lvl || old.item.gx !== it.gx || old.item.gz !== it.gz || !!old.item.up !== !!it.up)) {
        anims.push({ k: 'pop', o: rec.g, t: 0 });
        const s = BLD[it.type].size;
        dustRing(it.gx + s / 2, it.gz + s / 2, s * 0.6);
      }
    }
    for (const [k, rec] of blds) if (!seen.has(k)) { bldGroup.remove(rec.g); pruneAnims(rec.g); blds.delete(k); }
    setWalls(walls, fresh);
    scheduleGround(items);
  }

  /* ---------- remparts : dessinés en série (instances), reliés à leurs voisins ---------- */
  const wallAt = new Map(), wallBars = new Map();
  let wallSig = '';
  const WS = {
    d1: { post: ['cyl8', 0x8b6a45, 0.34, 0.95], cap: ['cone6', 0xa98353, 0.36, 0.3], link: [0x7a5c3a, 0.16, 0.74] },
    d2: { post: ['box', 0x8e8a80, 0.56, 0.85], cap: ['box', 0x6f767c, 0.64, 0.1], link: [0x9a958a, 0.42, 0.68] },
    d3: { post: ['box', 0xb8b3a8, 0.6, 1.0], cap: ['box', 0x7d858b, 0.68, 0.12], link: [0xaaa69b, 0.44, 0.82] },
    d4: { post: ['box', 0x6f767c, 0.64, 1.12], cap: ['box', 0x4d5966, 0.72, 0.12], band: [0xc9922e, 0.66, 0.07, 0.78], link: [0x7d858b, 0.46, 0.92] },
    d5: { post: ['box', 0x4d5966, 0.66, 1.25], cap: ['box', 0x3c4552, 0.74, 0.13], band: [0x7fe0ff, 0.68, 0.07, 0.86, true], link: [0x56626f, 0.48, 1.02] },
  };
  for (let l = 1; l <= 5; l++) WS['o' + l] = { post: ['cyl6', 0x4a3424, 0.3, 0.95 + 0.07 * l], cap: ['cone6', l >= 4 ? 0xe6dcc0 : 0x6b4a2b, 0.32, 0.34], band: l >= 3 ? [0x6e5a48, 0.33, 0.07, 0.6] : null, link: [0x34241a, 0.16, 0.72 + 0.06 * l] };
  function setWalls(items, fresh) {
    const live = items.filter(w => !w.dead), dead = items.filter(w => w.dead);
    const sig = items.map(w => w.gx + ',' + w.gz + ',' + w.lvl + (w.orc ? 'o' : '') + (w.dead ? 'x' : '')).join(';');
    const prev = new Set(wallAt.keys());
    wallAt.clear();
    for (const w of items) if (!w.dead) wallAt.set(w.gx + ',' + w.gz, w);
    if (sig === wallSig) return;
    wallSig = sig;
    if (!fresh && prev.size) { let n = 0; for (const w of live) if (!prev.has(w.gx + ',' + w.gz) && n++ < 12) dustRing(w.gx + 0.5, w.gz + 0.5, 0.4); }
    while (wallGroup.children.length) { const c = wallGroup.children[0]; wallGroup.remove(c); if (c.dispose) c.dispose(); }
    for (const [k, bar] of wallBars) { if (!wallAt.has(k.split('|')[1])) { fxGroup.remove(bar); wallBars.delete(k); } }
    const sets = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const push = (key, k, color, basicM, x, y, z, sx, sy, sz, ry) => {
      const id = key + '|' + k + '|' + color;
      if (!sets.has(id)) sets.set(id, { k, color, basicM, mats: [] });
      q.setFromAxisAngle(up, ry || 0); ps.set(x, y, z); sc.set(sx, sy, sz);
      sets.get(id).mats.push(m4.clone().compose(ps, q, sc));
    };
    const styleOf = w => WS[(w.orc ? 'o' : 'd') + Math.max(1, Math.min(5, w.lvl | 0))];
    const isW = (x, z) => wallAt.has(x + ',' + z);
    for (const w of live) {
      const st = styleOf(w), X = w.gx + 0.5 - half, Z = w.gz + 0.5 - half, key = (w.orc ? 'o' : 'd') + w.lvl;
      const [pk, pc, pw, ph] = st.post;
      push(key, pk, pc, false, X, 0, Z, pw, ph, pw);
      const [ck, cc, cw, chh] = st.cap; push(key, ck, cc, false, X, ph, Z, cw, chh, cw);
      if (st.band) { const [bc, bw, bh, by, glow] = st.band; push(key, 'box', bc, !!glow, X, by, Z, bw, bh, bw); }
      const link = (o, cx, cz, len, ry) => { const lw = o.lvl < w.lvl ? o : w, ls = styleOf(lw), [lc, lwid, lh] = ls.link; push((lw.orc ? 'o' : 'd') + lw.lvl, 'box', lc, false, cx, 0, cz, len, lh, lwid, ry); };
      const E = wallAt.get((w.gx + 1) + ',' + w.gz), S = wallAt.get(w.gx + ',' + (w.gz + 1));
      if (E) link(E, X + 0.5, Z, 1, 0);
      if (S) link(S, X, Z + 0.5, 1, Math.PI / 2);
      const SE = wallAt.get((w.gx + 1) + ',' + (w.gz + 1)), SW = wallAt.get((w.gx - 1) + ',' + (w.gz + 1));
      if (SE && !isW(w.gx + 1, w.gz) && !isW(w.gx, w.gz + 1)) link(SE, X + 0.5, Z + 0.5, Math.SQRT2, -Math.PI / 4);
      if (SW && !isW(w.gx - 1, w.gz) && !isW(w.gx, w.gz + 1)) link(SW, X - 0.5, Z + 0.5, Math.SQRT2, Math.PI / 4);
    }
    for (const w of dead) {
      const X = w.gx + 0.5 - half, Z = w.gz + 0.5 - half, c = w.orc ? 0x3a2a1e : 0x6b6258, r = ((w.gx * 7 + w.gz * 13) % 10) / 10;
      push('rb', 'dode', c, false, X - 0.15, 0, Z + 0.1, 0.42, 0.18, 0.36, r * 3);
      push('rb', 'dode', c, false, X + 0.18, 0, Z - 0.12, 0.3, 0.14, 0.3, r * 5);
    }
    for (const [, S] of sets) {
      const im = new THREE.InstancedMesh(geo(S.k), S.basicM ? basic(S.color) : mat(S.color), S.mats.length);
      S.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = !S.basicM; im.receiveShadow = true;
      wallGroup.add(im);
    }
  }
  function wallBar(key, frac) {
    let w = null; for (const it of wallAt.values()) if (it.key === key) { w = it; break; }
    const id = 'b|' + (w ? w.gx + ',' + w.gz : key);
    let bar = wallBars.get(id);
    if (!w || frac >= 0.999 || frac <= 0) { if (bar) { fxGroup.remove(bar); wallBars.delete(id); } return; }
    if (!bar) { bar = makeBar(0.7, 0x5fd17a); bar.position.set(w.gx + 0.5 - half, 1.6, w.gz + 0.5 - half); fxGroup.add(bar); wallBars.set(id, bar); }
    setBar(bar, frac);
  }
  function pruneAnims(g) { anims = anims.filter(a => { let o = a.o; while (o) { if (o === g) return false; o = o.parent; } return true; }); }
  function clearBuildings() { setBuildings([]); }
  function setBldHp(key, frac) {
    const rec = blds.get(key); if (!rec) { wallBar(key, frac); return; }
    rec.burn = frac > 0 && frac < 0.55;
    if (frac >= 0.999 || frac <= 0) { if (rec.hp) rec.hp.visible = false; return; }
    if (!rec.hp) { rec.hp = makeBar(1.1, 0x5fd17a); rec.hp.position.set(0, rec.info.top + 0.3, 0); rec.g.add(rec.hp); }
    rec.hp.visible = true; setBar(rec.hp, frac);
    rec.hp.userData.fg.material.color.copy(lin(frac > 0.5 ? 0x5fd17a : frac > 0.25 ? 0xf0b040 : 0xe8584a));
  }
  function bldInfo(key) { const r = blds.get(key); return r ? r.info : null; }
  function aimAt(key, x, z) {
    const r = blds.get(key); if (!r || !r.info.aim) return;
    const p = r.g.position, ang = Math.atan2(x - half - p.x, z - half - p.z);
    r.info.aim.rotation.y = ang;
    if (r.info.arm) anims.push({ k: 'throw', o: r.info.arm, t: 0 });
  }
  function select(it) {
    if (!it) { selMesh.visible = false; return; }
    const s = BLD[it.type].size; selMesh.visible = true; selMesh.scale.set(s + 0.3, 1, s + 0.3);
    selMesh.position.set(it.gx + s / 2 - half, 0.02, it.gz + s / 2 - half);
  }
  function ghost(type, gx, gz, valid) {
    if (!type) { ghostMesh.visible = false; gridMesh.visible = false; return; }
    const s = BLD[type].size; ghostMesh.visible = true; gridMesh.visible = true;
    ghostMesh.material = valid ? ghostOk : ghostBad;
    ghostMesh.scale.set(s, 1, s); ghostMesh.position.set(gx + s / 2 - half, 0.03, gz + s / 2 - half);
  }
  function focus(gx, gz) { cam.tx = clampT(gx - half); cam.tz = clampT(gz - half); }
  const projV = new THREE.Vector3();
  function panOf(x, z) { if (!camera) return 0; projV.set(x - half, 0.5, z - half).project(camera); return Math.max(-1, Math.min(1, projV.x)); }
  function toScreen(x, z) { projV.set(x - half, 0, z - half).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (projV.x + 1) / 2 * r.width, r.top + (1 - projV.y) / 2 * r.height]; }
  function showZone(B) {
    if (!B) { zoneMesh.visible = false; return; }
    const c = zoneTex.image, x = c.getContext('2d'), k = c.width / GRID;
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = 'rgba(220,60,50,0.32)';
    for (let i = 0; i < c.width; i++) for (let j = 0; j < c.height; j++) { if (!canDeploy(B, (i + 0.5) / k, (j + 0.5) / k)) x.fillRect(i, j, 1, 1); }
    zoneTex.needsUpdate = true; zoneMesh.visible = true;
  }  function showRanges(list) {
    while (rangeGroup.children.length) { const c = rangeGroup.children[0]; rangeGroup.remove(c); c.geometry.dispose(); }
    if (!list) return;
    for (const d of list) {
      const rg = new THREE.RingGeometry(Math.max(0.01, d.r - 0.1), d.r, 56); rg.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(rg, ringMat); ring.position.set(d.x - half, 0.035, d.z - half); ring.renderOrder = 3; rangeGroup.add(ring);
      const fg = new THREE.CircleGeometry(d.r, 56); fg.rotateX(-Math.PI / 2);
      const fill = new THREE.Mesh(fg, ringFill); fill.position.set(d.x - half, 0.03, d.z - half); fill.renderOrder = 2; rangeGroup.add(fill);
    }
  }


  /* ---------- unités : nains et orques ---------- */
  const BEARDS = [0xb5642c, 0x6b4423, 0xa8a8a0, 0xd2b06a, 0x3a2a1e];
  function makeUnit(type, col, orc, id) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    let barY = 1.0;
    if (type === 'belier' && !orc) {
      body.add(P('box', 0x7a5534, 0.5, 0.26, 0.9, 0, 0.12, 0));
      body.add(P('prism', 0x5a3d22, 0.95, 0.3, 0.6, 0, 0.38, 0, Math.PI / 2));
      body.add(P('box', col, 0.52, 0.06, 0.32, 0, 0.36, -0.15, 0, true));
      body.add(logZ(0.55, 0.16, 0, 0.26, 0.42, 0x8b6a45));
      body.add(P('box', DW.metal, 0.22, 0.22, 0.12, 0, 0.15, 0.95));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.add(piv(sx * 0.28, 0.11, sz * 0.3, [P('cyl8', 0x3a2a1e, 0.22, 0.06, 0.22, 0, -0.03, 0, 0, true)], 0, 0, Math.PI / 2));
      barY = 0.95;
    } else if (type === 'belier') {
      body.add(P('cyl8', 0x5c6e4c, 0.16, 0.38, 0.16, -0.17, 0, 0)); body.add(P('cyl8', 0x5c6e4c, 0.16, 0.38, 0.16, 0.17, 0, 0));
      body.add(P('sph', 0x7d8f6a, 0.75, 0.8, 0.6, 0, 0.3, 0));
      body.add(P('box', OR.hideD, 0.62, 0.16, 0.5, 0, 0.36, 0, 0, true));
      body.add(P('sph', 0x7d8f6a, 0.3, 0.28, 0.3, 0, 1.0, 0.12));
      for (const x of [-0.06, 0.06]) body.add(P('box', OR.bone, 0.03, 0.08, 0.03, x, 1.0, 0.26, 0, true));
      body.add(P('cyl8', 0x6c7e5a, 0.15, 0.62, 0.15, -0.42, 0.3, 0.05)); body.add(P('cyl8', 0x6c7e5a, 0.15, 0.62, 0.15, 0.42, 0.3, 0.05));
      body.add(piv(0.45, 0.35, 0.2, [P('cyl8', OR.woodD, 0.16, 0.75, 0.16, 0, 0, 0, 0, true)], 0.9));
      body.scale.setScalar(1.25); barY = 1.75;
    } else if (HEROES[type]) {
      const hc = HERO_GLOW[type];
      body.add(P('box', 0x3a2a20, 0.22, 0.1, 0.15, 0, 0, 0, 0, true));
      body.add(P('cyl8', hc, 0.36, 0.3, 0.36, 0, 0.08, 0));
      body.add(P('sph', C.skin, 0.22, 0.22, 0.22, 0, 0.36, 0, 0, true));
      body.add(piv(0, 0.46, 0.07, [P('cone6', BEARDS[(id || 0) % BEARDS.length], 0.24, 0.3, 0.16, 0, 0, 0, 0, true)], Math.PI));
      body.add(P('cone6', 0xd9b54c, 0.26, 0.16, 0.26, 0, 0.47, 0, 0, true));
      body.scale.setScalar(1.7); barY = 1.25;
    } else if (!orc) {
      body.add(P('box', 0x3a2a20, 0.2, 0.1, 0.13, 0, 0, 0, 0, true));
      body.add(P('cyl8', col, 0.31, 0.26, 0.31, 0, 0.08, 0));
      body.add(P('box', 0x3a2a1e, 0.32, 0.04, 0.32, 0, 0.17, 0, 0, true));
      body.add(P('sph', C.skin, 0.2, 0.2, 0.2, 0, 0.32, 0, 0, true));
      body.add(piv(0, 0.42, 0.06, [P('cone6', BEARDS[(id || 0) % BEARDS.length], 0.21, 0.27, 0.14, 0, 0, 0, 0, true)], Math.PI));
      body.add(P('sph', DW.metal, 0.23, 0.13, 0.23, 0, 0.42, 0, 0, true));
      body.add(P('box', DW.metal, 0.03, 0.09, 0.03, 0, 0.36, 0.11, 0, true));
      if (type === 'fantassin') {
        body.add(P('box', DW.woodD, 0.03, 0.34, 0.03, 0.19, 0.06, 0.06, 0, true));
        body.add(P('box', DW.metal, 0.15, 0.11, 0.03, 0.23, 0.33, 0.06, 0, true));
      } else {
        body.add(P('box', DW.wood, 0.05, 0.05, 0.32, 0.12, 0.2, 0.14, 0, true));
        body.add(P('box', DW.metal, 0.3, 0.03, 0.03, 0.12, 0.22, 0.29, 0, true));
      }
      body.scale.setScalar(1.4);
    } else {
      body.add(P('box', 0x2e241a, 0.16, 0.14, 0.12, 0, 0, 0, 0, true));
      body.add(P('cyl8', 0x5a3d2a, 0.26, 0.34, 0.26, 0, 0.12, 0));
      body.add(P('box', OR.cloth, 0.27, 0.06, 0.27, 0, 0.32, 0, 0, true));
      body.add(P('sph', OR.skin, 0.21, 0.21, 0.21, 0, 0.45, 0, 0, true));
      for (const x of [-0.05, 0.05]) body.add(P('box', OR.bone, 0.025, 0.06, 0.025, x, 0.45, 0.1, 0, true));
      if (type === 'fantassin') body.add(P('box', OR.metal, 0.04, 0.32, 0.12, 0.18, 0.1, 0.08, 0, true));
      else { body.add(P('cone6', 0x3a3a2a, 0.23, 0.2, 0.23, 0, 0.55, 0, 0, true)); body.add(P('box', OR.woodD, 0.03, 0.42, 0.03, 0.17, 0.08, 0.06, 0, true)); }
      body.scale.setScalar(1.4); barY = 1.12;
    }
    const ring = new THREE.Mesh(geo('plane'), basic(orc ? 0xb8402e : col, { transparent: true, opacity: 0.55, depthWrite: false }));
    ring.scale.set(type === 'belier' ? 1.3 : 0.62, 1, type === 'belier' ? 1.3 : 0.62); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
    g.scale.setScalar(1.3);
    const bar = makeBar(0.5, 0x5fd17a); bar.position.y = barY; bar.visible = false; g.add(bar);
    g.userData = { body, bar };
    return g;
  }
  /* ---------- habitants : les villageois vont travailler, les héros se promènent ---------- */
  const people = new Map(), lifeGroup = new THREE.Group();
  let vilBlocked = null, vilSpots = [], bldSpots = new Map(), bldCenters = new Map();
  function planVillage(items) {
    const blds = items.filter(it => it.type !== 'rempart' && it.key !== 'ghost' && !it.dead);
    vilBlocked = new Uint8Array(GRID * GRID); vilSpots = []; bldSpots = new Map(); bldCenters = new Map();
    for (const b of items) { if (b.key === 'ghost') continue; const sz = BLD[b.type].size; for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) { const x = b.gx + i, z = b.gz + j; if (x >= 0 && z >= 0 && x < GRID && z < GRID) vilBlocked[z * GRID + x] = 1; } }
    for (const b of blds) {
      const sz = BLD[b.type].size, seen = new Set(), cands = [];
      for (let i = -1; i <= sz; i++) for (const [x, z] of [[b.gx + i, b.gz + sz], [b.gx + sz, b.gz + i], [b.gx + i, b.gz - 1], [b.gx - 1, b.gz + i]]) {
        const k = x + ',' + z;
        if (x >= 0 && z >= 0 && x < GRID && z < GRID && !vilBlocked[z * GRID + x] && !seen.has(k)) { seen.add(k); cands.push([x, z]); }
      }
      bldSpots.set(b.key, cands); bldCenters.set(b.key, [b.gx + sz / 2, b.gz + sz / 2]);
      if (cands.length && sz >= 2) vilSpots.push(cands[Math.floor(hash2(b.gx * 13, b.gz * 7) * cands.length)]);
    }
    for (const [, r] of people) { r.path = []; if (vilBlocked[Math.floor(r.z) * GRID + Math.floor(r.x)]) { const sp = vilSpots[Math.floor(Math.random() * vilSpots.length)]; if (sp) { r.x = sp[0] + 0.5; r.z = sp[1] + 0.5; } } }
  }
  function findPath(x0, z0, x1, z1) {
    const N = GRID * GRID, prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N), q = [z0 * GRID + x0], goal = z1 * GRID + x1;
    seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h]; if (i === goal) break;
      const x = i % GRID, z = (i / GRID) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz, ni = nz * GRID + nx; if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID || seen[ni] || vilBlocked[ni]) continue; seen[ni] = 1; prev[ni] = i; q.push(ni); }
    }
    if (!seen[goal]) return [];
    const out = []; for (let i = goal; i !== -1 && i !== z0 * GRID + x0; i = prev[i]) out.push([(i % GRID) + 0.5 + (Math.random() - 0.5) * 0.4, ((i / GRID) | 0) + 0.5 + (Math.random() - 0.5) * 0.4]);
    return out.reverse();
  }
  /* Apparence : la race donne le modèle, le métier ou la classe donne l'équipement. */
  const P_DEF = { humain: { m: 'knight', h: 1.06, w: 1.0 }, nain: { m: 'barbarian', h: 0.9, w: 1.3 }, elfe: { m: 'rogue', h: 1.12, w: 0.9 } };
  const JOB_GEAR = { bucheron: ['1H_Axe'], carriere: ['2H_Axe'], champ: [], chasse: ['1H_Crossbow'], moulin: ['Mug'], boulangerie: ['Mug'], brasserie: ['Mug'], bat: ['1H_Axe'] };
  const JOB_WORK = { bucheron: '1H_Melee_Attack_Chop', carriere: '2H_Melee_Attack_Chop', bat: '1H_Melee_Attack_Chop', chasse: '2H_Ranged_Shoot' };
  const HERO_GEAR = {
    guerrier: { humain: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], nain: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat', 'Barbarian_Cape'], elfe: ['1H_Sword', 'Round_Shield', 'Rogue_Cape'] },
    rodeur: { humain: ['2H_Crossbow', 'Knight_Cape'], nain: ['2H_Crossbow', 'Barbarian_Hat'], elfe: ['2H_Crossbow', 'Rogue_Cape'] },
    mage: { humain: ['Throwable', 'Knight_Cape'], nain: ['Throwable', 'Barbarian_Cape'], elfe: ['Throwable', 'Rogue_Cape'] },
  };
  const GEAR_NAMES = new Set(['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Barbarian_Cape', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable', 'Rogue_Cape',
    '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape']);
  function nameTag(text, col) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.font = '700 30px system-ui, sans-serif'; const w = Math.min(244, x.measureText(text).width + 34);
    x.fillStyle = 'rgba(20,16,12,0.62)'; x.beginPath(); if (x.roundRect) x.roundRect((256 - w) / 2, 8, w, 46, 23); else x.rect((256 - w) / 2, 8, w, 46); x.fill();
    x.fillStyle = col || '#ffd27a'; x.beginPath(); x.arc((256 - w) / 2 + 17, 31, 7, 0, 6.2832); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128 + 8, 32);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(2.2, 0.55, 1); sp.renderOrder = 8;
    return sp;
  }
  function makePerson(p) {
    const def = P_DEF[p.race] || P_DEF.humain, src = LIB.ch[def.m];
    if (!src || !THREE.SkeletonUtils) return null;
    const obj = THREE.SkeletonUtils.clone(src.scene);
    const hero = p.kind === 'hero';
    const gear = hero ? ((HERO_GEAR[p.cls] || {})[p.race] || []) : (JOB_GEAR[p.job] || []);
    const have = new Set();
    obj.traverse(o => {
      if (GEAR_NAMES.has(o.name)) { o.visible = gear.includes(o.name); if (o.visible) have.add(o.name); }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
    });
    for (const n of gear) {
      const G = LIB.gear[n]; if (have.has(n) || !G) continue;
      let bone = null; obj.traverse(o => { if (!bone && o.name === G.parent) bone = o; });
      if (bone) { const c = G.obj.clone(); c.visible = true; bone.add(c); }
    }
    const k = def.h / src.h * (hero ? 1.12 : 1); obj.scale.set(k * def.w, k, k * def.w);
    const g = new THREE.Group(), body = new THREE.Group(); body.add(obj); g.add(body);
    const mixer = new THREE.AnimationMixer(obj);
    const act = n => LIB.clips[n] ? mixer.clipAction(LIB.clips[n]) : null;
    const wk = hero ? null : JOB_WORK[p.job];
    const A = { idle: act('Idle'), walk: act('Walking_A'), work: wk ? act(wk) : null, cheer: act('Cheer') };
    g.userData = { body, mixer, A, cur: null, hero };
    if (hero) {
      const ring = new THREE.Mesh(geo('plane'), basic(p.col || COLORS[0], { transparent: true, opacity: 0.75, depthWrite: false }));
      ring.scale.set(0.85, 1, 0.85); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
      const tag = nameTag(p.name || '', p.col); tag.position.y = def.h * 1.12 + 0.8; g.add(tag);
      const halo = makeGlow(p.cls === 'mage' ? 0xb48cff : 0xffd27a, 1.3, 0.5); halo.material.opacity = 0.3; g.add(halo); g.userData.halo = halo;
    }
    play(g, 'idle');
    return g;
  }
  function setPeople(list) {
    if (!LIB.ok || !vilBlocked) return;
    const seen = new Set();
    for (const p of list) {
      seen.add(p.key);
      let r = people.get(p.key);
      const sig = [p.race, p.cls || '', p.job || '', p.col || '', p.name || ''].join('|');
      if (!r || r.sig !== sig) {
        const g = makePerson(p); if (!g) continue;
        let x, z;
        if (r) { x = r.x; z = r.z; lifeGroup.remove(r.g); }
        else { const sps = p.at && bldSpots.get(p.at), sp = (sps && sps.length && sps[Math.floor(Math.random() * sps.length)]) || vilSpots[Math.floor(Math.random() * vilSpots.length)] || [half, half]; x = sp[0] + 0.5; z = sp[1] + 0.5; }
        const nr = { g, x, z, path: [], wait: Math.random() * 2, sig, data: p, working: false };
        g.position.set(x - half, 0, z - half); lifeGroup.add(g); people.set(p.key, nr);
        r = nr;
      }
      if (r.data.at !== p.at) { r.path = []; r.wait = 0; r.working = false; }
      r.data = p;
    }
    for (const [k, r] of people) if (!seen.has(k)) { lifeGroup.remove(r.g); people.delete(k); }
  }
  const cellOf = v => Math.max(0, Math.min(GRID - 1, Math.floor(v)));
  function arrive(r) {
    const p = r.data;
    if (r.goalWork && p.at) { r.working = true; r.face = bldCenters.get(p.at); r.wait = 6 + Math.random() * 9; }
    else r.wait = 2 + Math.random() * 5;
  }
  function stepPeople(dt, tNow) {
    if (!vilBlocked) return;
    for (const [, r] of people) {
      const U = r.g.userData; if (U.mixer) U.mixer.update(dt);
      if (U.halo) U.halo.material.opacity = 0.22 + 0.1 * Math.sin(tNow * 3 + r.x);
      const p = r.data;
      if (r.wait > 0) {
        r.wait -= dt;
        play(r.g, r.working && U.A.work ? 'work' : 'idle', 1);
        if (r.working && r.face) r.g.rotation.y = Math.atan2(r.face[0] - r.x, r.face[1] - r.z);
        continue;
      }
      if (!r.path.length) {
        r.working = false;
        const sps = p.at && bldSpots.get(p.at);
        let dest = null, work = false;
        if (sps && sps.length && (!r.lastWork || Math.random() < 0.8)) { dest = sps[Math.floor(Math.random() * sps.length)]; work = true; }
        else dest = vilSpots[Math.floor(Math.random() * vilSpots.length)];
        r.lastWork = work; r.goalWork = work;
        if (!dest) { r.wait = 2; continue; }
        const x0 = cellOf(r.x), z0 = cellOf(r.z);
        r.path = x0 === dest[0] && z0 === dest[1] ? [] : findPath(x0, z0, dest[0], dest[1]);
        if (!r.path.length) { arrive(r); continue; }
      }
      const [tx, tz] = r.path[0], dx = tx - r.x, dz = tz - r.z, L = Math.sqrt(dx * dx + dz * dz), step = (p.kind === 'hero' ? 0.95 : 0.75) * dt;
      if (L <= step) { r.x = tx; r.z = tz; r.path.shift(); if (!r.path.length) arrive(r); }
      else { r.x += dx / L * step; r.z += dz / L * step; r.g.rotation.y = Math.atan2(dx, dz); }
      r.g.position.set(r.x - half, 0, r.z - half);
      if (r.path.length) play(r.g, 'walk', p.kind === 'hero' ? 0.62 : 0.55);
    }
  }
  /* Habitant le plus proche de l'endroit touché (à l'écran). */
  function pickPerson(cx, cy, maxPx) {
    if (!camera || !people.size) return null;
    const [lx, ly] = mapPt(cx, cy), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, m = maxPx || 30;
    let best = null, bd = m * m;
    for (const [k, r] of people) {
      projV.set(r.x - half, 0.6, r.z - half).project(camera);
      const sx = (projV.x + 1) / 2 * w, sy = (1 - projV.y) / 2 * h, d = (sx - lx) * (sx - lx) + (sy - ly) * (sy - ly);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function setSeason(si) {
    const bi = si === 3 ? 'snow' : 'green';
    if (si === cropStage && bi === seasonBiome) return;
    cropStage = si; seasonBiome = bi;
    if (mood === 'warm') setBiome(bi);
    groundSig = '';
  }
  /* ---------- incendies pendant les raids ---------- */
  const flames = [];
  let flameMats = null;
  function flameTexture() {
    const c = mkCanvas(64), x = c.getContext('2d');
    x.translate(32, 40); x.scale(1, 1.6);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.3, 'rgba(255,220,140,0.9)'); g.addColorStop(0.7, 'rgba(255,140,40,0.35)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 22, 0, 6.2832); x.fill();
    return new THREE.CanvasTexture(c);
  }
  function flame(x, y, z) {
    if (flames.length > 110) return;
    if (!flameMats) { const t = flameTexture(); flameMats = [0xff5a1a, 0xff8a2a, 0xffc060].map(c => new THREE.SpriteMaterial({ map: t, color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); }
    const sp = new THREE.Sprite(flameMats[Math.floor(Math.random() * 3)]), k = 0.55 + Math.random() * 0.55;
    sp.scale.set(k, k * 1.4, 1); sp.position.set(x, y, z); fxGroup.add(sp);
    flames.push({ s: sp, k, age: 0, life: 0.45 + Math.random() * 0.35, vx: (Math.random() - 0.5) * 0.3, vz: (Math.random() - 0.5) * 0.3 });
  }

  /* ---------- unités en modèles animés ---------- */
  const U_DEF = {
    dwarf: {
      fantassin: { m: 'barbarian', show: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat'], atk: '1H_Melee_Attack_Chop', h: 1.0, w: 1.28 },
      archer: { m: 'barbarian', show: ['Barbarian_Hat'], xbow: true, atk: '2H_Ranged_Shoot', h: 1.0, w: 1.28 },
      villager: { m: 'barbarian', show: ['Mug'], atk: 'Cheer', h: 0.92, w: 1.3 },
      bucheron: { m: 'barbarian', show: ['1H_Axe', 'Barbarian_Hat'], atk: '1H_Melee_Attack_Chop', h: 0.92, w: 1.3 },
    },
    hero: {
      roi: { m: 'knight', show: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], atk: '1H_Melee_Attack_Chop', pow: 'Cheer', h: 1.3, w: 1.3 },
      chasseresse: { m: 'rogue', show: ['2H_Crossbow', 'Rogue_Cape'], atk: '2H_Ranged_Shoot', pow: 'Cheer', h: 1.22, w: 1.18 },
      berserker: { m: 'barbarian', show: ['2H_Axe', 'Barbarian_Cape'], atk: '2H_Melee_Attack_Chop', pow: '2H_Melee_Attack_Spin', h: 1.38, w: 1.34 },
    },
    orc: {
      fantassin: { m: 'barbarian', tex: 'orc_barbarian', show: ['1H_Axe', '1H_Axe_Offhand'], atk: '1H_Melee_Attack_Chop', h: 1.28, w: 1.06 },
      archer: { m: 'rogue', tex: 'orc_rogue', show: ['2H_Crossbow'], atk: '2H_Ranged_Shoot', h: 1.22, w: 1.0 },
      belier: { m: 'barbarian', tex: 'troll', show: ['2H_Axe'], atk: '2H_Melee_Attack_Chop', h: 2.4, w: 1.32 },
    },
  };
  const WEAPONS = ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable',
    '1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword', 'Knight_Helmet', 'Knight_Cape', 'Rogue_Cape', 'Barbarian_Cape'];
  const HERO_GLOW = { roi: 0xffd27a, chasseresse: 0x9be37a, berserker: 0xff6a3c };
  const skinMats = new Map();
  function skinMat(orig, texName) {
    const key = orig.uuid + '|' + texName;
    if (!skinMats.has(key)) { const m = orig.clone(); m.map = LIB.tex[texName]; m.needsUpdate = true; skinMats.set(key, m); }
    return skinMats.get(key);
  }
  function makeUnitModel(type, col, orc) {
    const def = HEROES[type] ? U_DEF.hero[type] : (orc ? U_DEF.orc : U_DEF.dwarf)[type];
    if (!def || !LIB.ch[def.m] || !THREE.SkeletonUtils) return null;
    const src = LIB.ch[def.m], obj = THREE.SkeletonUtils.clone(src.scene);
    obj.traverse(o => {
      if (WEAPONS.includes(o.name)) o.visible = def.show.includes(o.name);
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (def.tex && LIB.tex[def.tex]) o.material = skinMat(o.material, def.tex); }
    });
    if (def.xbow && LIB.xbow) {
      let bone = null; obj.traverse(o => { if (!bone && o.name === LIB.xbow.parent) bone = o; });
      if (bone) { const c = LIB.xbow.obj.clone(); c.visible = true; bone.add(c); }
    }
    const k = def.h / src.h; obj.scale.set(k * def.w, k, k * def.w);
    const g = new THREE.Group(), body = new THREE.Group(); body.add(obj); g.add(body);
    const hero = !!HEROES[type];
    const ring = new THREE.Mesh(geo('plane'), basic(orc ? 0xb8402e : hero ? HERO_GLOW[type] : col, { transparent: true, opacity: hero ? 0.75 : 0.55, depthWrite: false }));
    const rs = type === 'belier' ? 1.1 : hero ? 0.95 : 0.6; ring.scale.set(rs, 1, rs); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
    const mixer = new THREE.AnimationMixer(obj);
    const act = n => src.clips[n] ? mixer.clipAction(src.clips[n]) : null;
    const A = { idle: act('Idle'), walk: act('Walking_A'), atk: act(def.atk), death: act('Death_A'), cheer: act('Cheer'), pow: act(def.pow || 'Cheer') };
    if (A.death) { A.death.setLoop(THREE.LoopOnce); A.death.clampWhenFinished = true; }
    if (A.pow) { A.pow.setLoop(THREE.LoopOnce); A.pow.clampWhenFinished = false; }
    const bar = makeBar(hero ? 0.8 : 0.5, hero ? 0xffd27a : 0x5fd17a); bar.position.y = def.h + 0.3; bar.visible = false; g.add(bar);
    g.userData = { body, bar, mixer, A, cur: null, hero, ring };
    if (hero) { const gl = makeGlow(HERO_GLOW[type], 1.6, 0.25); gl.material.opacity = 0.35; g.add(gl); g.userData.halo = gl; }
    play(g, 'idle');
    return g;
  }
  function play(g, name, speed) {
    const u = g.userData; if (!u.A) return;
    const a = u.A[name]; if (!a) return;
    if (speed) a.timeScale = speed;
    if (u.cur === a) return;
    if (u.cur) u.cur.fadeOut(0.15);
    a.reset().fadeIn(0.15).play(); u.cur = a;
  }
  function syncUnits(list, alpha, tNow) {
    const seen = new Set();
    for (const u of list) {
      seen.add(u.id);
      let rec = units.get(u.id);
      if (!rec) {
        const mg = LIB.ok ? makeUnitModel(u.type, u.col, !!u.orc) : null;
        const g = mg || makeUnit(u.type, u.col, !!u.orc, u.id);
        rec = { g, lx: u.x, lz: u.z, model: !!mg }; units.set(u.id, rec); unitGroup.add(g);
      }
      const x = u.px + (u.x - u.px) * alpha, z = u.pz + (u.z - u.pz) * alpha;
      const dx = x - rec.lx, dz = z - rec.lz;
      if (dx * dx + dz * dz > 1e-6) rec.g.rotation.y = Math.atan2(dx, dz);
      else if (u.face) rec.g.rotation.y = Math.atan2(u.face[0] - x, u.face[1] - z);
      rec.lx = x; rec.lz = z;
      if (rec.model) {
        const T = TROOPS[u.type] || TROOPS.fantassin;
        rec.g.position.set(x - half, 0, z - half);
        const U = rec.g.userData;
        if (U.powUntil > tNow) { /* animation du pouvoir en cours */ }
        else if (u.mv) play(rec.g, 'walk', T.speed / 1.4);
        else if (u.atkAge != null && u.atkAge < T.hit * 1.6) { const a = U.A.atk; play(rec.g, 'atk', a ? a.getClip().duration / T.hit : 1); }
        else play(rec.g, 'idle', 1);
      } else {
        const bob = u.mv ? Math.abs(Math.sin(tNow * 12 + u.id)) * 0.06 : 0;
        const lunge = !u.mv && u.atkAge != null && u.atkAge < 0.25 ? Math.sin(u.atkAge / 0.25 * Math.PI) * 0.12 : 0;
        rec.g.position.set(x - half, bob, z - half);
        rec.g.userData.body.position.z = lunge;
      }
      const f = u.hp / u.max, UD = rec.g.userData;
      UD.bar.visible = f < 0.999 || !!UD.hero;
      if (UD.bar.visible) setBar(UD.bar, f);
      if (u.buff && !UD.aura) { UD.aura = makeGlow(u.hero ? HERO_GLOW[u.type] : 0xffc94a, 1.3, 0.6); UD.aura.material.opacity = 0.45; rec.g.add(UD.aura); }
      if (UD.aura) { UD.aura.visible = !!u.buff; if (u.buff) UD.aura.material.opacity = 0.35 + 0.2 * Math.sin(tNow * 9 + u.id); }
      if (UD.halo) UD.halo.material.opacity = 0.28 + 0.1 * Math.sin(tNow * 3);
    }
    for (const [id, rec] of units) if (!seen.has(id)) {
      units.delete(id);
      if (rec.model && rec.g.userData.A.death) { rec.g.userData.bar.visible = false; play(rec.g, 'death', 1.3); dying.push({ g: rec.g, t: 0 }); }
      else { unitGroup.remove(rec.g); burst(rec.lx, rec.lz, 0.3, 0xd8d0c0, 4); }
    }
  }
  function unitPower(id) {
    const rec = units.get(id); if (!rec) return;
    if (rec.model && rec.g.userData.A.pow) { play(rec.g, 'pow', 1.1); rec.g.userData.powUntil = performance.now() / 1000 + 1.1; }
  }
  function clearUnits() {
    for (const [, rec] of units) unitGroup.remove(rec.g); units.clear();
    for (const d of dying) unitGroup.remove(d.g); dying.length = 0;
    for (const s of shots) fxGroup.remove(s.m); shots.length = 0;
    for (const c of chunks) fxGroup.remove(c.m); chunks.length = 0;
  }

  /* ---------- projectiles et effets ---------- */
  function spawnShot(kind, fx, fy, fz, target, dur, arcK) {
    let m;
    if (kind === 'stone') m = P('dode', 0x7d858b, 0.3, 0.3, 0.3, 0, 0, 0, 0, true);
    else if (kind === 'bolt') m = P('box', 0x4b3a2a, 0.07, 0.07, 0.6, 0, 0, 0, 0, true);
    else m = P('box', 0x3a2a1e, 0.035, 0.035, 0.42, 0, 0, 0, 0, true);
    fxGroup.add(m);
    shots.push({ m, kind, fx: fx - half, fy, fz: fz - half, target, age: 0, dur: Math.max(0.12, dur), lx: fx - half, ly: fy, lz: fz - half, arcK: arcK || 0 });
  }
  function burst(x, z, y, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo('sph'), basic(color, { transparent: true, opacity: 0.7, depthWrite: false }));
      const s = 0.25 + Math.random() * 0.3; m.scale.setScalar(s);
      m.position.set(x - half + (Math.random() - 0.5) * 0.6, y, z - half + (Math.random() - 0.5) * 0.6);
      fxGroup.add(m); puffs.push({ m, vy: 0.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, age: 0, life: 0.8 + Math.random() * 0.6, s });
    }
  }
  /* Effets : poussière, débris, ondes, étincelles, pouvoirs des héros. */
  function dustRing(x, z, r) {
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, m = new THREE.Mesh(geo('sph'), basic(0xd8c8a8, { transparent: true, opacity: 0.6, depthWrite: false }));
      const s = 0.22 + Math.random() * 0.12; m.scale.setScalar(s);
      m.position.set(x - half + Math.cos(a) * r, 0.12, z - half + Math.sin(a) * r);
      fxGroup.add(m); puffs.push({ m, vy: 0.35, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9, age: 0, life: 0.7, s });
    }
  }
  const chunkMats = {};
  function debris(x, z, s, orc, n) {
    const cols = orc ? [0x4a3424, 0x6b4a2b, 0x8d6e4a] : [0x9a9488, 0x7d858b, 0x8b6a45];
    for (let i = 0; i < (n || 10); i++) {
      const c = cols[i % cols.length], m = new THREE.Mesh(geo('box'), chunkMats[c] || (chunkMats[c] = mat(c)));
      const k = 0.12 + Math.random() * 0.18; m.scale.set(k, k * 0.8, k * 1.1); m.castShadow = false;
      m.position.set(x - half + (Math.random() - 0.5) * s * 0.6, 0.3 + Math.random() * s * 0.4, z - half + (Math.random() - 0.5) * s * 0.6);
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.5;
      fxGroup.add(m); chunks.push({ m, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 3.5, vz: Math.sin(a) * sp, rx: (Math.random() - 0.5) * 12, rz: (Math.random() - 0.5) * 12, age: 0, life: 1.3 + Math.random() * 0.5, k });
    }
  }
  function wave(x, z, color, r, life) {
    const rg = new THREE.RingGeometry(0.75, 1, 40); rg.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(rg, basic(color, { transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x - half, 0.06, z - half); m.renderOrder = 4; fxGroup.add(m);
    waves.push({ m, r: r || 2, age: 0, life: life || 0.6 });
  }
  function spark(x, y, z, color) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color || 0xfff0b0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    const k = 0.5 + Math.random() * 0.3; sp.scale.set(k, k, 1); sp.position.set(x - half + (Math.random() - 0.5) * 0.3, y, z - half + (Math.random() - 0.5) * 0.3);
    fxGroup.add(sp); sparks.push({ s: sp, age: 0, life: 0.18, k });
  }
  function powerFx(type, x, z) {
    const c = HERO_GLOW[type] || 0xffd27a;
    wave(x, z, c, type === 'roi' ? 5 : 2.2, 0.8); wave(x, z, c, type === 'roi' ? 3.5 : 1.4, 0.55);
    for (let i = 0; i < 6; i++) spark(x + (Math.random() - 0.5), 0.5 + Math.random() * 1.5, z + (Math.random() - 0.5), c);
  }
  function volley(fx, fz, x, z) {
    for (let i = 0; i < 9; i++) {
      const tx = x + (Math.random() - 0.5) * 4, tz = z + (Math.random() - 0.5) * 4;
      spawnShot('arrow', fx + (Math.random() - 0.5), 1.2, fz + (Math.random() - 0.5), () => [tx, 0.1, tz], 0.45 + Math.random() * 0.2, 2.2);
    }
    setTimeout(() => { for (let i = 0; i < 4; i++) spark(x + (Math.random() - 0.5) * 3, 0.3, z + (Math.random() - 0.5) * 3, 0x9be37a); }, 500);
  }
  function smokeAt(wx, wy, wz, dark) {
    const m = new THREE.Mesh(geo('sph'), basic(dark ? 0x4a4440 : 0xeeeeea, { transparent: true, opacity: 0.4, depthWrite: false }));
    m.scale.setScalar(0.2); m.position.set(wx, wy, wz); fxGroup.add(m);
    puffs.push({ m, vy: 0.45, vx: 0.08, vz: 0.03, age: 0, life: 2.6, s: 0.2, grow: 0.35 });
  }

  /* ---------- ambiances : chaude au village, sombre en attaque ---------- */
  const MOODS = {
    warm: { exp: 0.88, bg: 0xb7d0de, fog: 0xc8dae3, near: 75, far: 175, sun: 0xffeccc, sunI: 2.0, sunPos: [-26, 30, 18], hemiS: 0xcfe0f2, hemiG: 0x5e5032, hemiI: 0.55, ground: 0xffffff, win: 0xffd28a, glow: 0.18, embers: false, env: [0xbfd9ef, 0xf3e7cf, 0x6f6a4a], envI: 0.6, bio: 'green' },
    dark: { exp: 0.8, bg: 0x1a2032, fog: 0x1d2437, near: 58, far: 125, sun: 0xa9b8ff, sunI: 1.3, sunPos: [26, 32, -8], hemiS: 0x7d8cc6, hemiG: 0x2b2a36, hemiI: 0.8, ground: 0xe4e9f4, win: 0xffa040, glow: 0.55, embers: true, env: [0x2a3558, 0x3a4566, 0x1c1d26], envI: 0.5, bio: 'snow' },
  };
  let P_MOOD = MOODS.warm;
  const envCache = {};
  function makeEnv(k, cols) {
    if (envCache[k]) return envCache[k];
    const pm = new THREE.PMREMGenerator(renderer), sc = new THREE.Scene(), g = new THREE.SphereGeometry(10, 32, 16), P3 = g.attributes.position, col = new Float32Array(P3.count * 3);
    const [top, hor, bot] = cols.map(c => lin(c));
    for (let i = 0; i < P3.count; i++) { const y = P3.getY(i) / 10, c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.min(1, -y * 2.5)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) })); sunM.position.set(-6, 7, 4); sc.add(sunM);
    const t = pm.fromScene(sc, 0.03).texture; pm.dispose();
    return (envCache[k] = t);
  }
  function setMood(m) {
    if (m === mood || !MOODS[m] || !scene) return;
    mood = m; const Q = P_MOOD = MOODS[m];
    scene.background = lin(Q.bg); scene.fog.color.copy(lin(Q.fog)); scene.fog.near = Q.near; scene.fog.far = Q.far;
    sun.color.copy(lin(Q.sun)); sun.intensity = Q.sunI; sun.position.set(Q.sunPos[0], Q.sunPos[1], Q.sunPos[2]);
    hemi.color.copy(lin(Q.hemiS)); hemi.groundColor.copy(lin(Q.hemiG)); hemi.intensity = Q.hemiI;
    groundMat.color.copy(lin(Q.ground)); winMat.color.copy(lin(Q.win));
    renderer.toneMappingExposure = Q.exp;
    try { scene.environment = makeEnv(m, Q.env); setBiome(m === 'warm' ? seasonBiome : Q.bio); } catch (e) { console.error('ambiance', e); }
    if (!Q.embers) { for (const e of embers) fxGroup.remove(e.s); embers.length = 0; }
  }

  /* ---------- chargement des modèles ---------- */
  const MODEL_NAMES = ['castle', 'lumbermill', 'mine', 'windmill', 'market', 'barracks', 'tavern', 'tower_A', 'tower_B', 'tower_catapult', 'church', 'destroyed', 'scaffolding', 'trees_A_large', 'trees_A_medium', 'trees_B_large', 'tree_A', 'tree_B', 'mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_C', 'rock_A', 'rock_C', 'rock_E'];
  function loadModels(base, onProgress, base2) {
    if (!ok || !THREE.GLTFLoader) return Promise.resolve(false);
    THREE.Cache.enabled = true;
    const loader = new THREE.GLTFLoader(), tl = new THREE.TextureLoader();
    const chars = ['barbarian', 'rogue', 'knight'], texs = ['orc_barbarian', 'orc_rogue', 'troll'];
    const m2 = base2 ? M2_NAMES : [];
    const total = MODEL_NAMES.length + chars.length + texs.length + m2.length;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done, total); };
    const one = n => new Promise(res => loader.load(base + n + '.json', g => { LIB.b[n] = g; tick(); res(); }, undefined, () => { tick(); res(); }));
    const ch = n => new Promise(res => loader.load(base + n + '.json', g => {
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB.ch[n] = { scene: g.scene, clips: Object.fromEntries(g.animations.map(a => [a.name, a])), h: box.getSize(new THREE.Vector3()).y || 2 };
      tick(); res();
    }, undefined, () => { tick(); res(); }));
    const tx = n => new Promise(res => tl.load(base + n + '.png', t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; LIB.tex[n] = t; tick(); res(); }, undefined, () => { tick(); res(); }));
    const one2 = n => new Promise(res => loader.load(base2 + n + '.glb', g => { LIB.m2[n] = g; tick(); res(); }, undefined, () => { tick(); res(); }));
    return Promise.all([...MODEL_NAMES.map(one), ...chars.map(ch), ...texs.map(tx), ...m2.map(one2)]).then(() => {
      if (!LIB.b.castle || !LIB.b.tower_A) return false;
      if (LIB.ch.rogue) LIB.ch.rogue.scene.traverse(o => { if (o.name === '2H_Crossbow' && o.parent && !LIB.xbow) LIB.xbow = { parent: o.parent.name, obj: o }; });
      /* Les personnages KayKit partagent le même squelette : armes et animations passent de l'un à l'autre. */
      for (const n of ['knight', 'barbarian', 'rogue']) {
        const c = LIB.ch[n]; if (!c) continue;
        c.scene.traverse(o => { if (GEAR_NAMES.has(o.name) && o.parent && /handslot/.test(o.parent.name) && !LIB.gear[o.name]) LIB.gear[o.name] = { parent: o.parent.name, obj: o }; });
        for (const k in c.clips) if (!LIB.clips[k]) LIB.clips[k] = c.clips[k];
      }
      const matte = o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.roughness = 0.88; o.material.envMapIntensity = 0.55; } };
      for (const k in LIB.b) LIB.b[k].scene.traverse(matte);
      for (const k in LIB.m2) LIB.m2[k].scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.5; o.material.roughness = Math.max(0.75, o.material.roughness); } });
      for (const k in LIB.ch) LIB.ch[k].scene.traverse(matte);
      for (const k in LIB.tex) if (LIB.tex[k]) LIB.tex[k].anisotropy = 4;
      LIB.ok = true; LIB.ver++; protos.clear(); groundSig = '';
      buildWorldModels();
      return true;
    });
  }

  /* ---------- vignettes des troupes (rendues une fois, à la construction du site) ---------- */
  function renderThumbs(keys, size) {
    size = size || 256;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputEncoding = THREE.sRGBEncoding; r.setClearColor(0x000000, 0);
    const out = {};
    for (const k of keys) {
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(0xfff4e0, 0x4a3a2a, 0.95));
      const key = new THREE.DirectionalLight(0xffe2b8, 1.25); key.position.set(-2, 3, 4); sc.add(key);
      const rim = new THREE.DirectionalLight(0x9ab8ff, 0.7); rim.position.set(3, 2, -3); sc.add(rim);
      const mg = LIB.ok ? makeUnitModel(k, COLORS[2], false) : null;
      const g = mg || makeUnit(k, COLORS[2], false, 3);
      if (g.userData.bar) g.userData.bar.visible = false;
      if (g.userData.ring) g.userData.ring.visible = false;
      if (g.userData.halo) g.userData.halo.visible = false;
      g.children.forEach(c => { if (c.isMesh && c.geometry === geo('plane')) c.visible = false; });
      if (g.userData.mixer) { play(g, 'idle', 1); g.userData.mixer.update(0.6); }
      g.rotation.y = -0.45; sc.add(g);
      g.updateMatrixWorld(true);
      const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
      let h, cx = 0, cz = 0;
      const def = HEROES[k] ? U_DEF.hero[k] : U_DEF.dwarf[k];
      if (mg && def) h = def.h;
      else {
        const box = new THREE.Box3();
        g.traverse(o => { if (o.isMesh && shown(o) && o.geometry !== geo('plane')) box.expandByObject(o); });
        h = box.max.y - box.min.y || 1; cx = (box.min.x + box.max.x) / 2; cz = (box.min.z + box.max.z) / 2;
      }
      const wide = k === 'belier';
      const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
      const ty = wide ? h * 0.42 : h * 0.55, dist = wide ? h * 3.4 : h * 2.2;
      cam.position.set(cx + 0.28 * dist, ty + h * 0.16, cz + dist); cam.lookAt(cx, ty, cz);
      r.render(sc, cam);
      out[k] = cv.toDataURL('image/png');
    }
    r.dispose();
    return out;
  }

  /* ---------- boucle ---------- */
  let lastFrame = 0, emitClock = 0, emberClock = 0;
  const camQ = new THREE.Quaternion();
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden || !ok) return;
    if (ts - lastFrame < 30) return;
    const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000); lastFrame = ts;
    const tNow = ts / 1000;
    if (frameHook) frameHook(dt, tNow);
    updateCamera(dt);
    camQ.copy(camera.quaternion);
    for (const [, bar] of wallBars) bar.quaternion.copy(camQ);
    if (waterNormal && waterMesh.visible) { waterNormal.offset.x = (tNow * 0.012) % 1; waterNormal.offset.y = (tNow * 0.007) % 1; }
    for (const [, r] of blds) {
      if (r.bar) { r.bar.quaternion.copy(camQ); const up = r.item.up; if (up) setBar(r.bar, up.frac != null ? up.frac : (Date.now() - up.t0) / Math.max(1, up.t1 - up.t0)); }
      if (r.hp) r.hp.quaternion.copy(camQ);
      if (r.glow) r.glow.material.opacity = P_MOOD.glow * (0.85 + 0.15 * Math.sin(tNow * 6 + r.ph) + 0.06 * Math.sin(tNow * 17 + r.ph));
    }
    for (const [, r] of units) { r.g.userData.bar.quaternion.copy(camQ); if (r.g.userData.mixer) r.g.userData.mixer.update(dt); }
    for (const d of dying) {
      d.t += dt; d.g.userData.mixer.update(dt);
      if (d.t > 1.6) { const k = Math.max(0, 1 - (d.t - 1.6) / 0.5); d.g.scale.setScalar(k); if (k <= 0) { d.done = true; unitGroup.remove(d.g); } }
    }
    for (let i = dying.length - 1; i >= 0; i--) if (dying[i].done) dying.splice(i, 1);
    for (const a of anims) {
      if (a.k === 'spin') a.o.rotation.y += dt * a.s;
      else if (a.k === 'flag') a.o.rotation.y = Math.sin(tNow * 2.2 + a.ph) * 0.35;
      else if (a.k === 'fire') { const f = 0.85 + Math.sin(tNow * 17) * 0.1 + Math.sin(tNow * 29) * 0.07; a.o.scale.y = (a.base || 0.42) * f; }
      else if (a.k === 'pop') { a.t += dt; const x = Math.min(1, a.t / 0.45), k = x < 0.6 ? 0.6 + 0.48 * (x / 0.6) : 1.08 - 0.08 * ((x - 0.6) / 0.4); a.o.scale.setScalar(k); if (x >= 1) { a.o.scale.setScalar(1); a.done = true; } }
      else if (a.k === 'pulse') { const k = a.base * (0.9 + 0.12 * Math.sin(tNow * 2.4)); a.o.scale.set(k, k, 1); }
      else if (a.k === 'throw') { a.t += dt; const x = a.t / 0.5; a.o.rotation.x = x < 0.3 ? -0.9 + 1.6 * (x / 0.3) : x < 1 ? 0.7 - 1.6 * ((x - 0.3) / 0.7) : -0.9; if (x >= 1) a.done = true; }
    }
    anims = anims.filter(a => !a.done);
    emitClock += dt;
    if (emitClock > 0.55) {
      emitClock = 0;
      for (const [, r] of blds) {
        if (r.item.dead) { if (Math.random() < 0.5) smokeAt(r.g.position.x, 0.4, r.g.position.z, true); continue; }
        for (const e of r.info.emit || []) if (Math.random() < 0.7) smokeAt(r.g.position.x + e[0], e[1], r.g.position.z + e[2], mood === 'dark');
      }
    }
    if (P_MOOD.embers && blds.size) {
      emberClock += dt;
      while (emberClock > 0.09) {
        emberClock -= 0.09;
        const recs = [...blds.values()], r = recs[Math.floor(Math.random() * recs.length)];
        if (!r || r.item.lvl <= 0) continue;
        const s = new THREE.Sprite(emberMat); const k = 0.12 + Math.random() * 0.12; s.scale.set(k, k, 1);
        s.position.set(r.g.position.x + (Math.random() - 0.5) * 1.6, 0.3 + Math.random() * r.info.top, r.g.position.z + (Math.random() - 0.5) * 1.6);
        fxGroup.add(s); embers.push({ s, vy: 0.5 + Math.random() * 0.7, vx: (Math.random() - 0.5) * 0.4, age: 0, life: 1.6 + Math.random() * 1.4 });
      }
    }
    stepPeople(dt, tNow);
    for (const [, r] of blds) {
      if (r.burnT > 0) r.burnT -= dt;
      const on = r.burn || r.burnT > 0;
      if (on && !r.fireGlow) { r.fireGlow = makeGlow(0xff7a2a, BLD[r.item.type].size * 2.2, 0.6); r.fireGlow.material.toneMapped = false; r.g.add(r.fireGlow); }
      if (r.fireGlow) { r.fireGlow.visible = on; if (on) r.fireGlow.material.opacity = 0.55 + 0.25 * Math.sin(tNow * 13 + r.ph) + 0.1 * Math.sin(tNow * 31); }
      if (!on || Math.random() > dt * (r.item.dead ? 9 : 16)) continue;
      const s = BLD[r.item.type].size, top = r.item.dead ? 0.6 : r.info.top * 0.7;
      flame(r.g.position.x + (Math.random() - 0.5) * s * 0.7, 0.2 + Math.random() * top, r.g.position.z + (Math.random() - 0.5) * s * 0.7);
      if (Math.random() < 0.18) smokeAt(r.g.position.x + (Math.random() - 0.5) * s * 0.5, top + 0.4, r.g.position.z + (Math.random() - 0.5) * s * 0.5, true);
    }
    for (const f of flames) { f.age += dt; const k = f.age / f.life; f.s.position.y += dt * 1.1; f.s.position.x += f.vx * dt; f.s.position.z += f.vz * dt; const sc = f.k * (1 - k * 0.8); f.s.scale.set(sc, sc * 1.35, 1); if (k >= 1) { f.done = true; fxGroup.remove(f.s); } }
    for (let i = flames.length - 1; i >= 0; i--) if (flames[i].done) flames.splice(i, 1);
    for (const e of embers) { e.age += dt; e.s.position.y += e.vy * dt; e.s.position.x += e.vx * dt + Math.sin(tNow * 3 + e.life) * 0.004; if (e.age > e.life) { e.done = true; fxGroup.remove(e.s); } }
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].done) embers.splice(i, 1);
    for (const s of shots) {
      s.age += dt;
      const t = Math.min(1, s.age / s.dur), tg = s.target();
      const tx = tg[0] - half, ty = tg[1], tz = tg[2] - half;
      const arc = s.arcK || (s.kind === 'stone' ? 3.5 : s.kind === 'bolt' ? 0.3 : 0.9);
      const x = s.fx + (tx - s.fx) * t, z = s.fz + (tz - s.fz) * t, y = s.fy + (ty - s.fy) * t + Math.sin(Math.PI * t) * arc;
      s.m.position.set(x, y, z);
      if (s.kind !== 'stone') s.m.lookAt(x + (x - s.lx) * 10, y + (y - s.ly) * 10, z + (z - s.lz) * 10);
      else s.m.rotation.x += dt * 6;
      s.lx = x; s.ly = y; s.lz = z;
      if (t >= 1) { s.done = true; fxGroup.remove(s.m); if (s.kind === 'stone') burst(tg[0], tg[2], 0.2, 0xb7a58a, 6); }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].done) shots.splice(i, 1);
    for (const p of puffs) {
      p.age += dt; const k = p.age / p.life;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      p.m.scale.setScalar(p.s * (1 + k * (p.grow ? 6 : 1.5)));
      p.m.material.opacity = 0.55 * (1 - k);
      if (k >= 1) { p.done = true; fxGroup.remove(p.m); p.m.material.dispose(); }
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].done) puffs.splice(i, 1);
    for (const c of chunks) {
      c.age += dt; c.vy -= 12 * dt;
      c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
      if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; c.rx *= 0.5; c.rz *= 0.5; }
      c.m.rotation.x += c.rx * dt; c.m.rotation.z += c.rz * dt;
      if (c.age > c.life) { const k = Math.max(0, 1 - (c.age - c.life) / 0.4); c.m.scale.setScalar(c.k * k); if (k <= 0) { c.done = true; fxGroup.remove(c.m); } }
    }
    for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].done) chunks.splice(i, 1);
    for (const w of waves) {
      w.age += dt; const k = Math.min(1, w.age / w.life);
      w.m.scale.setScalar(0.2 + w.r * k); w.m.material.opacity = 0.8 * (1 - k);
      if (k >= 1) { w.done = true; fxGroup.remove(w.m); w.m.geometry.dispose(); w.m.material.dispose(); }
    }
    for (let i = waves.length - 1; i >= 0; i--) if (waves[i].done) waves.splice(i, 1);
    for (const sp of sparks) {
      sp.age += dt; const k = sp.age / sp.life;
      sp.s.scale.set(sp.k * (1 + k), sp.k * (1 + k), 1); sp.s.material.opacity = 1 - k;
      if (k >= 1) { sp.done = true; fxGroup.remove(sp.s); sp.s.material.dispose(); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].done) sparks.splice(i, 1);
    renderer.render(scene, camera);
  }

  return {
    setPeople, pickPerson, setSeason,
    init, ok: () => ok, resize, resetCamera, setBuildings, clearBuildings, setBldHp, bldInfo, aimAt, select, ghost, showZone, showRanges,
    syncUnits, clearUnits, spawnShot, burst, pickGround, pickBuilding, focus, setPointerMap, setMood, loadModels, modelsReady: () => LIB.ok,
    debris, wave, spark, shake, dustRing, powerFx, volley, unitPower, renderThumbs, panOf, toScreen,
    _ground: () => groundCanvas && groundCanvas.toDataURL('image/jpeg', 0.8),
    _bench: () => { const t0 = performance.now(); paintBase(biome); const t1 = performance.now(); paintGround(lastGroundItems); return { base: Math.round(t1 - t0), ground: Math.round(performance.now() - t1) }; },
    _fx: () => ({ flames: flames.length, burning: [...blds.values()].filter(r => r.burn).length, people: people.size, mood, biome }),
    onFrame: f => { frameHook = f; }, onTap: f => { tapHook = f; },
  };
})();

/* ===================== SON : musique de taverne et bruitages ===================== */
/* Tout est synthétisé avec WebAudio (aucun fichier) : luth (corde pincée), flûte, bodhrán, tambourin, vielle. */
const SND = (() => {
  let ctx = null, master = null, musBus = null, sfxBus = null, rev = null, noise = null, unlocked = false;
  const S = Object.assign({ music: true, sfx: true, mv: 0.4, sv: 0.8 }, (() => { try { return JSON.parse(localStorage.getItem('mk.sound')) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem('mk.sound', JSON.stringify(S)); } catch (e) { /* réglage non mémorisé */ } };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = s => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); return m ? 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : null; };

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    musBus = ctx.createGain(); musBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(1.8, 3);
    const rg = ctx.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musBus.gain.setTargetAtTime(S.music ? S.mv * 1.0 : 0, t, 0.15);
    sfxBus.gain.setTargetAtTime(S.sfx ? S.sv : 0, t, 0.05);
  }
  /* Le navigateur n'autorise le son qu'après un premier geste du joueur. */
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!unlocked) { unlocked = true; setTimeout(switchTheme, 50); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });

  /* ---------- briques sonores ---------- */
  function nsrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05); return s; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function gainEnv(t, a, peak, d, hold) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + d);
    return g;
  }
  function out(node, dest, pan) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(dest); }
    else node.connect(dest);
  }
  function tone(dest, type, f0, f1, t, a, peak, d, pan) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = gainEnv(t, a, peak, d); o.connect(g); out(g, dest, pan);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function hiss(dest, type, f, q, t, a, peak, d, pan, f2) {
    const s = nsrc(t, a + d), b = filt(type, f, q);
    if (f2) { b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(f2, t + a + d); }
    const g = gainEnv(t, a, peak, d); s.connect(b); b.connect(g); out(g, dest, pan);
  }
  /* Luth : corde pincée (algorithme de Karplus-Strong), calculée une fois par note. */
  const plucks = {};
  function pluckBuf(m) {
    if (plucks[m]) return plucks[m];
    const sr = 22050, N = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * (m < 52 ? 2.4 : 1.7));
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    let last = 0; for (let i = 0; i < N; i++) { last = last * 0.45 + (Math.random() * 2 - 1) * 0.55; ring[i] = last; }
    const damp = 0.9965 - Math.max(0, m - 62) * 0.0005;
    let k = 0, mx = 0;
    for (let i = 0; i < len; i++) { const a = ring[k], c = ring[(k + 1) % N], v = (a + c) * 0.5 * damp; ring[k] = v; d[i] = a; k = (k + 1) % N; mx = Math.max(mx, Math.abs(a)); }
    const g = mx ? 0.8 / mx : 1, fade = Math.floor(len * 0.25);
    for (let i = 0; i < len; i++) d[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    return (plucks[m] = b);
  }
  function lute(dest, m, t, vel, pan) {
    if (m == null) return;
    const s = ctx.createBufferSource(); s.buffer = pluckBuf(m);
    const g = ctx.createGain(); g.gain.value = vel;
    s.connect(g); out(g, dest, pan); s.start(t); s.stop(t + s.buffer.duration);
  }
  function flute(dest, m, t, dur, vel) {
    if (m == null) return;
    const f = mtof(m), o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 2, t);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur * 0.7));
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(), end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.045); g.gain.setValueAtTime(vel * 0.85, Math.max(t + 0.05, end - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.07);
    const g2 = ctx.createGain(); g2.gain.value = 0.1;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    hiss(dest, 'bandpass', 2400, 1.2, t, 0.02, vel * 0.22, 0.09);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.1); }
  }
  function drum(dest, t, vel, kind) {
    const f0 = kind === 'tom' ? 125 : kind === 'low' ? 92 : 190;
    tone(dest, 'sine', f0, f0 * 0.5, t, 0.004, vel, kind === 'tom' ? 0.34 : 0.2);
    hiss(dest, 'lowpass', kind === 'tap' ? 2600 : 900, 0.7, t, 0.002, vel * 0.45, 0.05);
  }
  function tamb(dest, t, vel) {
    hiss(dest, 'highpass', 6800, 0.7, t, 0.002, vel, 0.07);
    hiss(dest, 'bandpass', 9500, 2, t + 0.014, 0.002, vel * 0.6, 0.05);
  }
  function drone(dest, notes, vol) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2.5);
    const lp = filt('lowpass', 750, 0.6), lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.13; lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency);
    lp.connect(g); g.connect(dest);
    const os = [lfo];
    for (const n of notes) for (const det of [-4, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(lp); os.push(o); }
    os.forEach(o => o.start());
    return { stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.2); os.forEach(o => o.stop(t + 1.3)); } };
  }

  /* ---------- airs ---------- */
  function parse(str) {           // « A4 D5 D5:2 . » -> une case par croche ; :n = durée en croches ; . = silence
    const steps = [];
    for (const tok of str.split(/\s+/).filter(x => x && x !== '|')) {
      const [n, l] = tok.split(':'), len = +(l || 1);
      steps.push(n === '.' ? null : { m: midi(n), len });
      for (let i = 1; i < len; i++) steps.push(undefined);
    }
    return steps;
  }
  const CH = { D: ['D3', 'A3', 'D4', 'F#4'], G: ['G2', 'D3', 'G3', 'B3'], C: ['C3', 'G3', 'C4', 'E4'], Dm: ['D3', 'A3', 'D4', 'F4'], Bb: ['Bb2', 'F3', 'Bb3', 'D4'], A: ['A2', 'E3', 'A3', 'C#4'],
    F: ['F2', 'C3', 'F3', 'A3'], Am: ['A2', 'E3', 'A3', 'C4'], Em: ['E2', 'B2', 'E3', 'G3'], Eb: ['Eb3', 'Bb3', 'Eb4', 'G4'] };
  const chordOf = n => CH[n].map(midi);
  /* Village 1 : une gigue en ré, joyeuse (6/8). */
  const JIG_A = parse('A4 D5 D5 F#5 D5 D5 | A4 D5 F#5 E5 D5 B4 | A4 D5 D5 F#5 E5 F#5 | G5 F#5 E5 D5 B4 G4 | A4 D5 D5 F#5 D5 D5 | A4 D5 F#5 A5 F#5 D5 | G5 E5 C5 E5 F#5 E5 | D5:3 D5 A4 F#4');
  const JIG_B = parse('A5 F#5 D5 A5 F#5 D5 | G5 E5 C5 G5 E5 C5 | A5 F#5 D5 F#5 E5 D5 | C5 E5 G5 E5 D5 C5 | A5 F#5 D5 A5 F#5 D5 | G5 E5 C5 E5 F#5 G5 | A5 G5 F#5 E5 D5 C5 | D5:3 D5:3');
  const JIG_CH = ['D', 'D', 'D', 'G', 'D', 'D', 'C', 'D', 'D', 'C', 'D', 'C', 'D', 'C', 'D', 'D'];
  /* Village 2 : un air lent des mines (3/4). */
  const AIR = parse('D5:4 E5:2 | F5:4 E5:2 | D5:2 C5:2 A4:2 | D5:6 | F5:4 G5:2 | A5:4 G5:2 | F5:2 E5:2 C5:2 | D5:6 | A5:4 C6:2 | B5:4 A5:2 | G5:2 F5:2 E5:2 | F5:4 E5:2 | D5:4 E5:2 | F5:2 E5:2 C5:2 | D5:4 A4:2 | D5:6');
  const AIR_CH = ['Dm', 'F', 'C', 'Dm', 'F', 'Am', 'C', 'Dm', 'Am', 'G', 'C', 'F', 'Dm', 'C', 'Am', 'Dm'];
  /* Village 3 : la ritournelle de la halle, au luth seul (6/8 lent). */
  const HALL = parse('D5 F#5 A5 F#5 D5 F#5 | E5 G5 B5 G5 E5 G5 | F#5 A5 D6 A5 F#5 A5 | E5:3 A4:3 | D5 F#5 A5 F#5 D5 F#5 | G5 B5 D6 B5 G5 B5 | A5 F#5 E5 D5 C#5 E5 | D5:6');
  const HALL_CH = ['D', 'Em', 'D', 'A', 'D', 'G', 'A', 'D'];
  /* Raid 1 : un air tendu en ré mineur (4/4). */
  const WAR_1 = parse('D5:4 F5:2 E5:2 | D5:6 A4:2 | Bb4:4 D5:2 F5:2 | E5:6 C5:2 | D5:2 E5:2 F5:2 G5:2 | A5:6 G5:2 | F5:4 D5:2 Bb4:2 | C#5:6 E5:2');
  const WAR_2 = parse('A5:4 G5:2 F5:2 | E5:2 F5:2 D5:4 | F5:4 D5:2 Bb4:2 | C5:2 E5:2 G5:4 | F5:2 E5:2 D5:2 E5:2 | F5:2 G5:2 A5:4 | Bb5:4 A5:2 F5:2 | E5:4 C#5:2 A4:2');
  const WAR_CH = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'];
  /* Raid 2 : les tambours du Nord (ostinato grave, cor lointain). */
  const NORTH = parse('D4:8 | Eb4:8 | D4:6 C4:2 | D4:8 | F4:8 | Eb4:6 D4:2 | C4:4 Eb4:4 | D4:8');
  const PIECES = {
    village: [
      { name: 'gigue', dt: 60 / 96 / 3, len: 192, drone: ['D3', 'A3'], droneVol: 0.012,
        play(th, s, t, V) {
          const half = s < 96 ? 0 : 1, ps = s % 96, bar = Math.floor(ps / 6), b = ps % 6, dest = th.g;
          const mel = (half ? JIG_B : JIG_A)[ps % 48], chord = chordOf(JIG_CH[(half * 8 + bar % 8) % 16]);
          const fluteLead = V.flute ? (half === 0 || V.both) : (half === 1 && V.both);
          if (mel) { if (fluteLead) flute(dest, mel.m + V.tr, t, mel.len * this.dt * 0.95, 0.05); else lute(dest, mel.m + V.tr, t, 0.2, 0.15); }
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.17, -0.2);
          if (b === 3) lute(dest, chord[1] + V.tr, t, 0.1, -0.2);
          if ((b === 2 || b === 5) && bar % 2 === 0) lute(dest, chord[3] + V.tr, t, 0.07, 0.05);
          if (V.drum && b === 0) drum(dest, t, 0.12, 'low');
          if (V.drum && b === 3 && bar % 2 === 1) drum(dest, t, 0.07, 'low');
        } },
      { name: 'air', dt: 60 / 80 / 2, len: 96,
        play(th, s, t, V) {
          const bar = Math.floor(s / 6), b = s % 6, dest = th.g, chord = chordOf(AIR_CH[bar]), mel = AIR[s];
          if (mel) { if (V.flute && bar >= 4) flute(dest, mel.m + V.tr, t, mel.len * this.dt * 0.97, 0.045); else lute(dest, mel.m + V.tr, t, 0.18, 0.1); }
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.15, -0.25);
          if (b === 2) lute(dest, chord[2] + V.tr, t, 0.07, -0.1);
          if (b === 4) lute(dest, chord[3] + V.tr, t, 0.06, 0);
        } },
      { name: 'halle', dt: 60 / 70 / 3, len: 96,
        play(th, s, t, V) {
          const ps = s % 48, bar = Math.floor(ps / 6), b = ps % 6, dest = th.g, chord = chordOf(HALL_CH[bar]), mel = HALL[ps];
          if (mel) lute(dest, mel.m + V.tr - (s >= 48 && V.low ? 12 : 0), t, 0.16, 0.12);
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.15, -0.2);
          if (b === 3) lute(dest, chord[1] + V.tr, t, 0.08, -0.2);
        } },
    ],
    battle: [
      { name: 'guerre', dt: 60 / 128 / 2, len: 128, drone: ['D2', 'A2'], droneVol: 0.018,
        play(th, s, t, V) {
          const bar = Math.floor(s / 8) % 8, b = s % 8, dest = th.g, I = th.intensity;
          const ch = chordOf(WAR_CH[bar]), root = ch[0], fifth = ch[1], third = ch[3] - 12;
          const pat = [root, root, fifth, root, third, root, fifth, root];
          lute(dest, pat[b] + 12, t, b === 0 ? 0.17 : 0.1, -0.15);
          if (I > 0.6 && (s >= 64 || V.flute)) { const mel = (s < 64 ? WAR_1 : WAR_2)[s % 64]; if (mel) flute(dest, mel.m, t, mel.len * this.dt * 0.95, 0.045); }
          if (b === 0 || b === 3 || b === 6) drum(dest, t, (b === 0 ? 0.2 : 0.12) * (0.5 + 0.5 * I), 'tom');
          if (I > 0.6 && b === 4) drum(dest, t, 0.09, 'low');
          if (I > 0.6 && bar % 4 === 3 && b >= 4) drum(dest, t + this.dt / 2, 0.07, 'tom');
        } },
      { name: 'nord', dt: 60 / 112 / 2, len: 128,
        play(th, s, t, V) {
          const ps = s % 64, bar = Math.floor(ps / 8), b = ps % 8, dest = th.g, I = th.intensity, mel = NORTH[ps];
          const os = [50, 50, 51, 50, 53, 50, 51, 48][(bar + b) % 8];
          if (b % 2 === 0) lute(dest, os, t, 0.12, -0.2);
          if (mel && s >= 64 && I > 0.6) horn(dest, [mel.m - 12], t, mel.len * this.dt * 0.6, 0.035);
          if (b === 0 || b === 5) drum(dest, t, 0.18 * (0.5 + 0.5 * I), 'tom');
          if (I > 0.6 && (b === 2 || b === 7)) drum(dest, t, 0.08, 'low');
        } },
    ],
  };
  /* Ambiance entre les morceaux : vent, oiseaux, forge au village ; vent, tambours et cor lointains en raid. */
  function windNode(dest, vol, dark) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const lp = filt('lowpass', dark ? 380 : 620, 0.4), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    g.gain.value = vol; lfo.frequency.value = 0.07; lg.gain.value = vol * 0.6; lfo.connect(lg); lg.connect(g.gain);
    s.connect(lp); lp.connect(g); g.connect(dest); s.start(); lfo.start();
    return { stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.5); s.stop(t + 1.6); lfo.stop(t + 1.6); } };
  }
  function bird(dest, t) {
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) tone(dest, 'sine', base * (1 + Math.random() * 0.2), base * (1.15 + Math.random() * 0.3), t + i * 0.11, 0.01, 0.012, 0.07, pan);
  }
  function ambience(th, ahead) {
    if (th.nextAmb > ahead) return;
    const t = Math.max(th.nextAmb, ctx.currentTime + 0.05);
    if (th.name === 'village') {
      const r = Math.random();
      if (r < 0.75) bird(th.g, t);
      else { for (let i = 0; i < 3; i++) for (const f of [1420, 2880]) tone(th.g, 'sine', f, null, t + i * 0.5, 0.001, 0.008 / (f / 1420), 0.25, 0.6); }
      th.nextAmb = t + 2 + Math.random() * 5;
    } else {
      if (Math.random() < 0.6) { for (let i = 0; i < 3; i++) drum(th.g, t + i * 0.45, 0.06, 'tom'); }
      else horn(th.g, [45, 45], t, 0.9, 0.02);
      th.nextAmb = t + 7 + Math.random() * 9;
    }
  }
  let theme = null, want = null, wantI = 1, timer = null;
  const lastPiece = {};
  function music(name, intensity) {
    want = name || null; if (intensity != null) wantI = intensity;
    if (theme && theme.name === want) theme.intensity = wantI;
    if (ctx && unlocked) switchTheme();
  }
  function startPiece(th, t) {
    const pool = PIECES[th.name];
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastPiece[th.name]) i = (i + 1) % pool.length;
    lastPiece[th.name] = i;
    const def = pool[i];
    th.piece = { def, step: 0, V: { flute: Math.random() < 0.6, both: Math.random() < 0.4, drum: Math.random() < 0.5, low: Math.random() < 0.5, tr: [0, 0, -2, 2][Math.floor(Math.random() * 4)] }, drone: def.drone ? drone(th.g, def.drone.map(midi), def.droneVol) : null };
    th.t = t;
  }
  function switchTheme() {
    if (!ctx || !unlocked) return;
    const target = S.music ? want : null;
    if (theme && theme.name === target) return;
    stopTheme();
    if (!target) return;
    const g = ctx.createGain(), t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + 2);
    g.connect(musBus);
    const send = ctx.createGain(); send.gain.value = 0.55; g.connect(send); send.connect(rev);
    theme = { name: target, g, piece: null, gapEnd: t0 + (target === 'battle' ? 0.3 : 3 + Math.random() * 4), t: t0, intensity: wantI, nextAmb: t0 + 1, wind: windNode(g, target === 'battle' ? 0.02 : 0.012, target === 'battle') };
    if (!timer) timer = setInterval(tick, 40);
  }
  function stopTheme() {
    if (!theme) return;
    const th = theme, t = ctx.currentTime; theme = null;
    th.g.gain.cancelScheduledValues(t); th.g.gain.setValueAtTime(th.g.gain.value, t); th.g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    if (th.piece && th.piece.drone) th.piece.drone.stop();
    th.wind.stop();
    setTimeout(() => th.g.disconnect(), 2800);
  }
  function tick() {
    if (!theme || !ctx || ctx.state !== 'running') return;
    const th = theme, now = ctx.currentTime, ahead = now + 0.3;
    if (th.t < now - 1) th.t = now + 0.05; // retour après une pause
    if (!th.piece && now >= th.gapEnd - 0.35) startPiece(th, Math.max(now + 0.05, th.gapEnd));
    while (th.piece && th.t < ahead) {
      const P = th.piece;
      if (P.step >= P.def.len) {
        if (P.drone) P.drone.stop();
        th.piece = null;
        th.gapEnd = th.t + (th.name === 'battle' ? 4 + Math.random() * 8 : 14 + Math.random() * 26);
        break;
      }
      P.def.play(th, P.step, th.t, P.V); th.t += P.def.dt; P.step++;
    }
    ambience(th, ahead);
  }

  /* ---------- bruitages ---------- */
  const last = {}, GAP = { chop: 0.07, wallhit: 0.08, shoot: 0.05, bolt: 0.06, boom: 0.06, death: 0.07, click: 0.03, collapse: 0.12, wallbreak: 0.08 };
  const chime = (dest, freqs, t, step, vol) => freqs.forEach((f, i) => { tone(dest, 'sine', f, f, t + i * step, 0.004, vol, 0.5); tone(dest, 'sine', f * 2.76, f * 2.76, t + i * step, 0.002, vol * 0.25, 0.18); });
  function knock(dest, t, f, vol, pan) { tone(dest, 'sine', f, f * 0.6, t, 0.002, vol, 0.09, pan); hiss(dest, 'bandpass', 700, 2, t, 0.001, vol * 0.7, 0.05, pan); }
  function clink(dest, t, vol, pan) { for (const f of [1420, 2880, 4310]) tone(dest, 'sine', f * (0.97 + Math.random() * 0.06), null, t, 0.001, vol / (f / 1420), 0.16, pan); }
  function horn(dest, notes, t, len, vol) {
    notes.forEach((n, i) => {
      const f = mtof(n), st = t + i * len, o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, st); o.frequency.linearRampToValueAtTime(f, st + 0.06); o2.frequency.value = f * 1.005;
      const lp = filt('lowpass', 500, 1.2); lp.frequency.setValueAtTime(400, st); lp.frequency.linearRampToValueAtTime(1500, st + 0.08); lp.frequency.linearRampToValueAtTime(900, st + len);
      const g = gainEnv(st, 0.06, vol, i === notes.length - 1 ? 0.7 : len * 0.6, i === notes.length - 1 ? 0.25 : len * 0.3);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
      o.start(st); o2.start(st); o.stop(st + len + 1.2); o2.stop(st + len + 1.2);
    });
  }
  const FX = {
    click: (d, t) => { tone(d, 'sine', 1300, 760, t, 0.002, 0.05, 0.05); hiss(d, 'bandpass', 3000, 3, t, 0.001, 0.025, 0.02); },
    place: (d, t) => { knock(d, t, 210, 0.3); knock(d, t + 0.12, 175, 0.26); },
    upgrade: (d, t) => { clink(d, t, 0.14); knock(d, t, 180, 0.2); clink(d, t + 0.22, 0.12); knock(d, t + 0.22, 170, 0.18); },
    built: (d, t) => { clink(d, t, 0.1); chime(d, [1046, 1318, 1568, 2093], t + 0.08, 0.08, 0.07); },
    coin: (d, t) => chime(d, [1568, 2093, 2637], t, 0.06, 0.06),
    train: (d, t) => { drum(d, t, 0.18, 'tap'); clink(d, t + 0.05, 0.05); },
    deploy: (d, t, p) => { drum(d, t, 0.22, 'low'); hiss(d, 'bandpass', 900, 1, t, 0.01, 0.06, 0.18, p, 300); },
    hero: (d, t) => { drum(d, t, 0.3, 'tom'); horn(d, [50, 57, 62], t + 0.05, 0.16, 0.09); },
    power: (d, t, p) => { hiss(d, 'bandpass', 400, 2, t, 0.35, 0.18, 0.4, p, 3200); chime(d, [880, 1318, 1760], t + 0.3, 0.05, 0.08); tone(d, 'sine', 90, 40, t + 0.32, 0.005, 0.4, 0.5); },
    chop: (d, t, p) => { hiss(d, 'lowpass', 500 + Math.random() * 300, 0.8, t, 0.002, 0.3, 0.08, p); hiss(d, 'bandpass', 1600 + Math.random() * 800, 2, t, 0.001, 0.13, 0.04, p); },
    wallhit: (d, t, p) => { hiss(d, 'bandpass', 950, 3, t, 0.001, 0.14, 0.06, p); tone(d, 'sine', 95, 60, t, 0.002, 0.16, 0.09, p); },
    shoot: (d, t, p) => hiss(d, 'bandpass', 4200, 2.5, t, 0.004, 0.15, 0.09, p, 1500),
    bolt: (d, t, p) => { tone(d, 'triangle', 170, 90, t, 0.002, 0.13, 0.24, p); hiss(d, 'bandpass', 2400, 2, t, 0.002, 0.06, 0.12, p, 900); },
    catapult: (d, t, p) => { knock(d, t, 120, 0.2, p); hiss(d, 'lowpass', 300, 1, t + 0.05, 0.1, 0.08, 0.35, p, 1400); },
    boom: (d, t, p) => { tone(d, 'sine', 85, 34, t, 0.004, 0.45, 0.55, p); hiss(d, 'lowpass', 420, 0.7, t, 0.003, 0.32, 0.42, p); },
    collapse: (d, t, p) => {
      hiss(d, 'lowpass', 320, 0.7, t, 0.03, 0.42, 1.25, p); tone(d, 'sine', 55, 32, t, 0.01, 0.34, 1.0, p);
      for (let i = 0; i < 7; i++) hiss(d, 'bandpass', 1200 + Math.random() * 1600, 3, t + 0.05 + Math.random() * 0.8, 0.001, 0.09, 0.05, p);
    },
    wallbreak: (d, t, p) => { hiss(d, 'bandpass', 1250, 2, t, 0.001, 0.25, 0.12, p); hiss(d, 'lowpass', 260, 0.7, t, 0.01, 0.22, 0.4, p); tone(d, 'sine', 72, 40, t, 0.003, 0.25, 0.3, p); },
    death: (d, t, p) => { tone(d, 'sine', 150, 60, t, 0.003, 0.1, 0.14, p); hiss(d, 'lowpass', 320, 0.7, t, 0.002, 0.08, 0.1, p); },
    star: (d, t, p, i) => chime(d, [1046 * Math.pow(1.26, i || 0)], t, 0, 0.12),
    invite: (d, t) => { horn(d, [57, 62], t, 0.2, 0.08); horn(d, [57, 62], t + 0.55, 0.2, 0.07); },
    alarm: (d, t) => horn(d, [50, 50, 46], t, 0.22, 0.08),
    error: (d, t) => { const o = tone(d, 'square', 170, 150, t, 0.004, 0.035, 0.12); o.detune.value = -10; },
    victory: (d, t) => {
      [62, 66, 69, 74].forEach((n, i) => flute(d, n, t + i * 0.13, i === 3 ? 0.9 : 0.12, 0.09));
      [50, 57, 62, 66].forEach((n, i) => lute(d, n, t + 0.52 + i * 0.015, 0.26));
      for (let i = 0; i < 6; i++) drum(d, t + i * 0.07, 0.08 + i * 0.03, 'tap');
      drum(d, t + 0.52, 0.4, 'tom');
    },
    defeat: (d, t) => { [57, 53, 50].forEach((n, i) => lute(d, n, t + i * 0.42, 0.34)); horn(d, [45, 41], t + 0.1, 0.5, 0.05); drum(d, t + 1.3, 0.25, 'low'); },
  };
  function sfx(name, opts) {
    if (!ctx || !unlocked || !S.sfx || ctx.state !== 'running' || !FX[name]) return;
    const t = ctx.currentTime, g = GAP[name] || 0;
    if (g && last[name] && t - last[name] < g) return;
    last[name] = t;
    try { FX[name](sfxBus, t + 0.01, opts && opts.pan, opts && opts.i); } catch (e) { /* son ignoré */ }
  }
  /* Petit air joué par-dessus la musique (victoire, défaite) : la musique se tait un instant. */
  function jingle(name) {
    if (!ctx || !unlocked || ctx.state !== 'running') return;
    if (theme) { const g = theme.g, t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.15, t + 0.3); g.gain.linearRampToValueAtTime(1, t + 4.5); }
    if (S.sfx || S.music) FX[name] && FX[name](S.sfx ? sfxBus : musBus, ctx.currentTime + 0.05);
  }
  /* Essais : rend quelques secondes d'un air ou d'un bruitage hors ligne et renvoie les niveaux (crête, moyenne). */
  async function _render(kind, name, sec) {
    const save = { ctx, master, musBus, sfxBus, rev, noise, plucks: Object.assign({}, plucks) };
    const off = new OfflineAudioContext(2, Math.floor(44100 * sec), 44100);
    ctx = off; for (const k in plucks) delete plucks[k];
    master = ctx.createGain(); master.connect(ctx.destination);
    musBus = ctx.createGain(); musBus.gain.value = S.mv * 1.0; musBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = S.sv; sfxBus.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(1.8, 3); const rg = ctx.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    try {
      if (kind === 'music') {
        const def = PIECES.village.concat(PIECES.battle).find(p => p.name === name), g = ctx.createGain(); g.connect(musBus);
        const th = { g, intensity: 1, name }, V = { flute: true, both: true, drum: true, low: false, tr: 0 };
        if (def.drone) drone(g, def.drone.map(midi), def.droneVol);
        for (let st = 0, t = 0.05; t < sec - 0.3 && st < def.len; st++, t += def.dt) def.play(th, st, t, V);
      } else FX[name](sfxBus, 0.05);
      const buf = await off.startRendering(), d = buf.getChannelData(0);
      let peak = 0, sum = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
      return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), nan: d.some(x => Number.isNaN(x)) };
    } finally { ctx = save.ctx; master = save.master; musBus = save.musBus; sfxBus = save.sfxBus; rev = save.rev; noise = save.noise; for (const k in plucks) delete plucks[k]; Object.assign(plucks, save.plucks); }
  }
  return {
    unlock, music, sfx, jingle, _render,
    get: () => Object.assign({}, S),
    set(o) { Object.assign(S, o); save(); applyVolumes(); if ('music' in o) switchTheme(); },
  };
})();

/* ===================== APPLICATION (village commun) ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Date.now() + (FB.offset || 0);
const safeColor = c => COLORS.includes(c) ? c : COLORS[0];
const cleanName = (s, max) => Array.from(String(s || '')).filter(ch => { const c = ch.codePointAt(0); return c >= 32 && c !== 127 && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2060 && c <= 0x206f); }).join('').trim().slice(0, max);
const initial = n => (Array.from(String(n || '?'))[0] || '?').toUpperCase();
const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage local indisponible */ } },
};
const fmtN = n => Math.floor(n).toLocaleString('fr-FR');
const fmtR = n => (n >= 0 ? '+' : '−') + (Math.abs(n) >= 10 ? Math.round(Math.abs(n)) : (Math.round(Math.abs(n) * 10) / 10).toString().replace('.', ','));
function fmtDur(ms) {
  ms = Math.max(0, ms);
  if (ms < 60000) return Math.max(1, Math.ceil(ms / 1000)) + ' s';
  const m = Math.ceil(ms / 60000);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + ' h' + (mm ? ' ' + String(mm).padStart(2, '0') : '');
  const d = Math.floor(h / 24), hh = h % 24;
  return d + ' j' + (hh ? ' ' + hh + ' h' : '');
}
function fmtAgo(t) {
  const d = now() - t;
  if (d < 60000) return 'à l’instant';
  if (d < 3600000) return 'il y a ' + Math.floor(d / 60000) + ' min';
  if (d < 86400000) return 'il y a ' + Math.floor(d / 3600000) + ' h';
  const days = Math.floor(d / 86400000);
  return days === 1 ? 'hier' : 'il y a ' + days + ' j';
}

/* ---------- icônes ---------- */
const IC = {
  bois: '<svg viewBox="0 0 20 20"><rect x="1.5" y="10" width="14" height="5.4" rx="2.7" fill="currentColor" opacity=".6"/><circle cx="15.3" cy="12.7" r="2.7" fill="currentColor"/><rect x="3.5" y="4.4" width="12" height="5.4" rx="2.7" fill="currentColor" opacity=".8"/><circle cx="15.3" cy="7.1" r="2.7" fill="currentColor"/></svg>',
  pierre: '<svg viewBox="0 0 20 20"><path d="M2.5 15.5 5 8.3l5-3.3 5.2 2.4 2.3 7-4.2 2.6H6.2z" fill="currentColor"/><path d="m5 8.3 4.6 2.6 5.6-3.5M9.6 10.9l-.6 6.7" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/></svg>',
  ble: '<svg viewBox="0 0 20 20"><path d="M10 18.5V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g fill="currentColor"><ellipse cx="10" cy="3.6" rx="1.6" ry="2.5"/><ellipse cx="7.5" cy="7.3" rx="1.5" ry="2.6" transform="rotate(-32 7.5 7.3)"/><ellipse cx="12.5" cy="7.3" rx="1.5" ry="2.6" transform="rotate(32 12.5 7.3)"/><ellipse cx="7.5" cy="11.6" rx="1.5" ry="2.6" transform="rotate(-32 7.5 11.6)"/><ellipse cx="12.5" cy="11.6" rx="1.5" ry="2.6" transform="rotate(32 12.5 11.6)"/></g></svg>',
  orge: '<svg viewBox="0 0 20 20"><path d="M9 18.5c.4-4 .8-7.5 1.6-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/><g fill="currentColor"><ellipse cx="10.9" cy="6.2" rx="1.3" ry="2.1" transform="rotate(14 10.9 6.2)"/><ellipse cx="9.2" cy="8.6" rx="1.2" ry="2" transform="rotate(-24 9.2 8.6)"/><ellipse cx="11.9" cy="9.4" rx="1.2" ry="2" transform="rotate(34 11.9 9.4)"/><ellipse cx="8.9" cy="12" rx="1.2" ry="2" transform="rotate(-26 8.9 12)"/><ellipse cx="11.4" cy="12.6" rx="1.2" ry="2" transform="rotate(30 11.4 12.6)"/></g><path d="M11.3 4.2 12.6 1M8 7 5.4 4.4M13.3 8 16.2 5.8M7.6 10.6 4.6 8.8M12.8 11.5l3 -1.6" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/></svg>',
  farine: '<svg viewBox="0 0 20 20"><path d="M6 4.5h8l-1 2c2.6 1.5 3.6 4.4 3.2 7.6-.3 2-2 3.4-4 3.4H7.8c-2 0-3.7-1.4-4-3.4C3.4 10.9 4.4 8 7 6.5z" fill="currentColor"/><path d="M6.5 6.6h7" stroke="#fff" stroke-opacity=".5" stroke-width="1.2"/></svg>',
  pain: '<svg viewBox="0 0 20 20"><path d="M2.5 12c0-4 3.4-6.5 7.5-6.5S17.5 8 17.5 12c0 1.6-1.2 2.5-2.6 2.5H5.1C3.7 14.5 2.5 13.6 2.5 12z" fill="currentColor"/><path d="M6.5 8.5l1.4 2.4M10 7.8l1.2 2.6M13.4 8.6l1 2.2" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/></svg>',
  viande: '<svg viewBox="0 0 20 20"><path d="M12.6 2.8c3 0 4.7 2.4 4.4 5.2-.4 3.6-4 6-7.4 5.6l-2.3 2.3a1.9 1.9 0 1 1-2.6-.6 1.9 1.9 0 1 1-.6-2.6L6.4 10.4C6 7 8.5 2.8 12.6 2.8z" fill="currentColor"/><circle cx="12.4" cy="7.4" r="1.6" fill="#fff" opacity=".35"/></svg>',
  people: '<svg viewBox="0 0 20 20"><circle cx="7" cy="6.5" r="3" fill="currentColor"/><path d="M1.5 17c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5z" fill="currentColor"/><circle cx="14" cy="7.5" r="2.4" fill="currentColor" opacity=".65"/><path d="M12.7 12.1c.4-.1.9-.1 1.3-.1 2.6 0 4.5 1.8 4.5 4.6v.4h-4.6c0-2-.4-3.6-1.2-4.9z" fill="currentColor" opacity=".65"/></svg>',
  heart: '<svg viewBox="0 0 20 20"><path d="M10 17.2S2.5 12.6 2.5 7.4C2.5 5 4.3 3.2 6.6 3.2c1.5 0 2.7.8 3.4 2 .7-1.2 1.9-2 3.4-2 2.3 0 4.1 1.8 4.1 4.2 0 5.2-7.5 9.8-7.5 9.8z" fill="currentColor"/></svg>',
  hammer: '<svg viewBox="0 0 24 24"><path d="M12.5 2.5h6.5l2.5 2.5-2.5 2.5-1-1-2 2-3.5-3.5 1.5-1.5z" fill="currentColor"/><path d="m11 8.5 3.5 3.5-8.8 8.8a2.47 2.47 0 0 1-3.5-3.5z" fill="currentColor" opacity=".85"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M12 2.5 2 10.5h3V21h5v-6h4v6h5V10.5h3z" fill="currentColor"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.6 4L12 5l4.4 7L21 8l-2 11H5z" fill="currentColor"/><rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor"/></svg>',
  scroll: '<svg viewBox="0 0 24 24"><path d="M6 3h11a3 3 0 0 1 3 3v1h-3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1h3V6a3 3 0 0 1 1-3z" fill="currentColor"/><path d="M8 8h6M8 11.5h6M8 15h4" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" stroke-linecap="round"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9.3 9.2a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="#fff"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 5.6V10l3 2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.2-1.2" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/></svg>',
  mug: '<svg viewBox="0 0 24 24"><path d="M4 6h11v12a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="currentColor"/><path d="M15 9h2.5a2.5 2.5 0 0 1 0 5H15" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 6c0-2 1.6-3 3.4-2.5C8.2 2 10 1.6 11.6 2.6 13.4 2 15 3.4 15 6z" fill="#fff" opacity=".75"/></svg>',
  s0: '<svg viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="6.5" r="3.2"/><circle cx="17.2" cy="10.3" r="3.2"/><circle cx="15.2" cy="16.4" r="3.2"/><circle cx="8.8" cy="16.4" r="3.2"/><circle cx="6.8" cy="10.3" r="3.2"/></g><circle cx="12" cy="12" r="2.6" fill="#fff" opacity=".8"/></svg>',
  s1: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
  s2: '<svg viewBox="0 0 24 24"><path d="M20 3C9 3 4 8.5 4 15c0 2 .6 3.7 1.4 5L9 16.4C12.3 13 15 11 18 9.6 14.6 12 12 14.4 9.6 18c1 .5 2.1.8 3.4.8C19 18.8 21 12 20 3z" fill="currentColor"/></svg>',
  s3: '<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></g></svg>',
};
IC.biere = IC.mug;
const ico = (k, cls) => `<span class="ic ${cls == null ? 'c-' + k : cls}">${IC[k] || ''}</span>`;
const RES_SHOW = ['bois', 'pierre', 'ble', 'farine', 'pain', 'viande', 'orge', 'biere'];
function chipsRes(c, have, cls) { return RES.filter(k => c[k]).map(k => `<span class="chip${have && (have[k] || 0) < c[k] ? ' short' : ''}${cls ? ' ' + cls : ''}">${ico(k)}${fmtN(c[k])}</span>`).join(''); }
const SPEC_ICON = { buch: 'bois', mine: 'pierre', agri: 'ble', chasse: 'viande', arti: 'pain', constr: 'hammer' };

/* ---------- état ---------- */
const els = { top: $('#hudTop'), bottom: $('#hudBottom'), sheet: $('#sheet'), sheetTitle: $('#sheetTitle'), sheetBody: $('#sheetBody'), modal: $('#modal'), mcard: $('#mcard'), toast: $('#toast'), loading: $('#loading') };
let gl = false, fbUser = null, uid = null, db = null, presence = null;
let vid = null, vref = null, unsubV = null, unsubP = null, vraw = null, vsim = null, me = null;
let pending = [], committing = false, commitTimer = null, retries = 0, lastSync = 0;
let online = {};
let mode = 'loading', sel = null, selP = null, place = null, sheet = null, sheetArg = null, modal = null;
let modelLoad = null, pressing = null, installEvt = null, joinVid = null, joinInfo = null, needJoinLog = false, busy = false;
let lastLogT = 0;
const demoVillage = (() => { const t = Date.UTC(2026, 6, 1, 9); const v = newVillage('demo', 'Démo', COLORS[0], t, 'demo', 'Démo'); return v; })();

function setHTML(el, html) {
  if (el._h === html) return;
  if (pressing && el.contains(pressing)) return;
  el.innerHTML = html; el._h = html;
}
let toastTimer = null;
function toast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200); }
function buzz() { try { navigator.vibrate && navigator.vibrate(10); } catch (e) { /* pas de vibreur */ } }
const myName = () => (vraw && vraw.members && vraw.members[uid] && vraw.members[uid].name) || (fbUser && fbUser.name) || 'Moi';
const who = () => ({ uid, name: myName() });
const partnerId = v => v ? Object.keys(v.members || {}).find(k => k !== uid) || null : null;
const isOnline = k => !!(k && online && online[k]);

/* ---------- village : simulation, actions partagées, sauvegarde ---------- */
function recompute() {
  if (!vsim) { me = null; return; }
  const v = clone(vsim);
  for (const a of pending) applyV(v, a, who());
  me = v;
}
function resim() { vsim = vraw ? simulateVillage(clone(vraw), now()) : null; recompute(); }
function act(a, opts) {
  if (!me) return null;
  const test = applyV(clone(me), a, who());
  if (!test.ok) { if (!(opts && opts.quiet)) { toast(test.err); SND.sfx('error'); } return null; }
  pending.push(a); recompute(); renderAll(); refreshScene();
  scheduleCommit(150);
  const fx = { build: 'place', move: 'place', upgrade: 'upgrade', accept: 'built', hero: 'hero', feast: 'coin', demolish: 'wallbreak', job: 'click', heroAt: 'click', claim: 'coin', crop: 'click' }[a.type];
  if (fx && !(opts && opts.quiet)) SND.sfx(fx);
  return test;
}
function scheduleCommit(ms) { clearTimeout(commitTimer); commitTimer = setTimeout(commit, ms); }
/* Les actions sont rejouées sur la dernière version du serveur : si l'autre joueur a agi entre-temps, rien n'est perdu. */
async function commit() {
  if (committing || !pending.length || !vref) return;
  committing = true;
  const batch = pending.slice(), fails = [];
  try {
    const t = now(), w = who();
    const r = await vref.transact(cur => {
      fails.length = 0;
      if (cur == null) return null;
      if (cur.v !== VERSION) return undefined;
      const v = simulateVillage(cur, t);
      for (const a of batch) { const res = applyV(v, a, w); if (!res.ok && a.type !== 'sync') fails.push(res.err); }
      return v;
    });
    pending.splice(0, batch.length);
    if (r.committed && r.data && r.data.v === VERSION) vraw = r.data;
    if (fails.length) toast('Pas enregistré : ' + fails[fails.length - 1]);
    retries = 0; lastSync = now();
  } catch (e) {
    retries++;
    if (e && e.code === 'not_granted') { pending.length = 0; modal = { kind: 'denied' }; }
    else if (retries > 3) { pending.length = 0; retries = 0; toast('Connexion perdue : les dernières actions n’ont pas été enregistrées.'); }
  }
  committing = false;
  resim(); renderAll(); refreshScene();
  if (pending.length) scheduleCommit(retries ? 2500 : 300);
}
function onVillage(snap) {
  const data = snap && snap.exists ? snap.data() : null;
  if (!data) { vraw = null; resim(); mode = 'gate'; modal = { kind: 'info', title: 'Village introuvable', text: 'Ce village n’existe plus. Tu peux en fonder un nouveau.' }; renderAll(); refreshScene(); return; }
  if (data.v !== VERSION) { modal = { kind: 'info', title: 'Mise à jour nécessaire', text: 'Ce village vient d’une autre version du jeu. Ferme et rouvre l’appli pour la mettre à jour.' }; renderAll(); return; }
  const first = !vraw;
  vraw = data; resim();
  if (first) {
    lastLogT = Math.max(LS.get('mk2.log.' + vid) || 0, 0);
    const away = me.log.filter(l => l.t > lastLogT && AWAY_KINDS.has(l.k));
    if (lastLogT && away.length) modal = { kind: 'away', list: away.slice(-8) };
    lastLogT = me.log.length ? me.log[me.log.length - 1].t : now();
    LS.set('mk2.log.' + vid, lastLogT);
  }
  if (needJoinLog && me && me.members[uid] && !me.members[uid].hi) { needJoinLog = false; act({ type: 'join' }, { quiet: true }); }
  if (mode === 'loading' || mode === 'join' || mode === 'gate' || mode === 'hero') setMode(me && me.heroes[uid] ? 'home' : 'hero');
  else { renderAll(); refreshScene(); }
}
const AWAY_KINDS = new Set(['built', 'cand', 'arrive', 'season', 'leave', 'join', 'hero', 'feast', 'site', 'goal']);
const TOAST_KINDS = new Set(['built', 'cand', 'season', 'leave', 'join', 'feast', 'goal']);
/* Nouvelles du journal pendant qu'on joue : une bulle pour la plus récente. */
function newsCheck() {
  if (!me || !me.log.length) return;
  const fresh = me.log.filter(l => l.t > lastLogT);
  if (!fresh.length) return;
  lastLogT = fresh[fresh.length - 1].t; LS.set('mk2.log.' + vid, lastLogT);
  const show = fresh.filter(l => TOAST_KINDS.has(l.k));
  if (!show.length) return;
  const l = show[show.length - 1];
  toast(l.m);
  if (l.k === 'built') SND.sfx('built'); else if (l.k === 'cand') SND.sfx('invite'); else if (l.k === 'leave') SND.sfx('error'); else if (l.k === 'season') SND.sfx('star');
}

/* ---------- scène 3D ---------- */
function items(v, editable) {
  const out = v.b.map(b => {
    let gx = b.gx, gz = b.gz;
    if (editable && place && place.kind === 'move' && place.id === b.id) { gx = place.gx; gz = place.gz; }
    return { key: 'm' + b.id, id: b.id, type: b.type, lvl: b.lvl, gx, gz, up: b.up ? { frac: Math.min(1, b.up.done / b.up.need) } : null, col: safeColor(v.c), crop: b.type === 'champ' ? cropOf(b) : undefined };
  });
  if (editable && place && place.kind === 'new') out.push({ key: 'ghost', id: 0, type: place.type, lvl: 1, gx: place.gx, gz: place.gz, up: null, col: safeColor(v.c) });
  return out;
}
function peopleOf(v) {
  const open = sites(v).slice(0, sitesMax(v)), out = [];
  const hang = (v.b.find(b => b.type === 'taverne' && b.lvl > 0) || v.b.find(b => b.type === 'halle') || {}).id;
  v.vil.forEach((p, i) => {
    let job = null, at = null;
    if (p.job === 'bat') { job = 'bat'; at = open.length ? 'm' + open[i % open.length].id : null; }
    else if (p.job != null) { const b = v.b.find(x => x.id === p.job); if (b) { job = b.type; at = 'm' + b.id; } }
    out.push({ key: 'v' + p.id, kind: 'vil', race: p.race, sex: p.sex, job, at, name: p.name });
  });
  for (const [k, h] of Object.entries(v.heroes || {})) {
    if (!h) continue;
    const at = h.at === 'bat' ? (open[0] ? 'm' + open[0].id : null) : h.at != null ? 'm' + h.at : hang != null ? 'm' + hang : null;
    out.push({ key: 'h' + k, kind: 'hero', race: h.race, cls: h.cls, sex: h.sex, col: safeColor(h.col), name: h.name, at });
  }
  return out;
}
const placeValid = () => place && fits(me, place.type, place.gx, place.gz, place.kind === 'move' ? place.id : undefined);
function refreshScene() {
  if (!gl) return;
  V3.setMood('warm');
  const v = me || demoVillage, editable = !!me && mode === 'home';
  V3.setSeason(seasonIdx(v, me ? now() : v.born));
  V3.setBuildings(items(v, editable));
  const b = editable && sel != null && !place ? v.b.find(x => x.id === sel) : null;
  V3.select(b || null);
  if (editable && place) V3.ghost(place.type, place.gx, place.gz, placeValid()); else V3.ghost(null);
  V3.setPeople(peopleOf(v));
}
function setMode(m) {
  mode = m;
  if (m !== 'home') { place = null; sel = null; selP = null; if (sheet) closeSheet(true); }
  SND.music('village', 1);
  renderAll(); refreshScene();
}

/* ---------- interactions sur la carte ---------- */
function onTap(cx, cy) {
  if (modal || mode !== 'home' || !me) return;
  if (sheet) { closeSheet(); return; }
  if (place) {
    const g = V3.pickGround(cx, cy); if (!g) return;
    const s = BLD[place.type].size;
    place.gx = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[0] - s / 2)));
    place.gz = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[1] - s / 2)));
    refreshScene(); renderAll(); return;
  }
  /* Un habitant touché de près passe avant le bâtiment derrière lui. */
  const k = V3.pickBuilding(cx, cy);
  const pk = V3.pickPerson(cx, cy, 16) || (k ? null : V3.pickPerson(cx, cy, 30));
  if (pk) { selP = pk; sel = null; SND.sfx('click'); refreshScene(); renderAll(); return; }
  sel = k && k[0] === 'm' ? +k.slice(1) : null; selP = null;
  refreshScene(); renderAll();
}
function startPlace(type) {
  if (!me) return;
  const d = BLD[type], hl = hallLvl(me);
  if ((d.hall || 1) > hl) { toast('Il faut une halle du village de niveau ' + d.hall + '.'); return; }
  if (countOf(me, type) >= limitOf(type, hl)) { toast('Nombre maximum atteint : agrandissez la halle.'); return; }
  const m = missingTxt(me, costOf(type, 1)); if (m) { toast(m); return; }
  const spot = freeSpot(me, type); if (!spot) { toast('Plus de place libre dans le village.'); return; }
  place = { kind: 'new', type, gx: spot[0], gz: spot[1] };
  sel = null; selP = null; closeSheet(true); if (gl) V3.focus(spot[0] + 1, spot[1] + 1);
  refreshScene(); renderAll();
}
function startMove(id) {
  const b = me && me.b.find(x => x.id === id); if (!b) return;
  place = { kind: 'move', id, type: b.type, gx: b.gx, gz: b.gz };
  refreshScene(); renderAll();
}
function confirmPlace() {
  if (!place) return;
  if (!placeValid()) { toast('Emplacement occupé ou trop près du bord.'); return; }
  const p = place;
  const r = p.kind === 'new' ? act({ type: 'build', b: p.type, gx: p.gx, gz: p.gz }) : act({ type: 'move', id: p.id, gx: p.gx, gz: p.gz });
  if (r) { place = null; if (p.kind === 'new') { toast('Chantier lancé : les bâtisseurs s’y mettent.'); sel = r.id || null; } refreshScene(); renderAll(); }
}

/* ---------- HUD du haut ---------- */
function topHTML() {
  const v = me, t = now(), si = seasonIdx(v, t), pk = partnerId(v);
  let chips = '';
  if (modelLoad && modelLoad.d < modelLoad.n) chips += `<span class="glass chipb">Modèles 3D ${Math.round(modelLoad.d / modelLoad.n * 100)} %</span>`;
  chips += `<button class="glass chipb helpb" data-act="sheet" data-s="help" aria-label="Aide">${ico('help', 'c-tro')}</button>`;
  if (window.__mkUpdate) chips += `<button class="glass chipb alert" data-act="reload">Nouvelle version : toucher ici</button>`;
  if (installEvt) chips += `<button class="glass chipb" data-act="install">Installer l’appli</button>`;
  if (v.cands.length) chips += `<button class="glass chipb alert" data-act="sheet" data-s="people">${ico('people', '')}${v.cands.length === 1 ? 'Une arrivée' : v.cands.length + ' arrivées'}</button>`;
  if (pk) chips += `<button class="glass chipb${isOnline(pk) ? ' live' : ''}" data-act="sheet" data-s="village">${isOnline(pk) ? '<span class="dot"></span>' : ''}${esc(v.members[pk].name)}${isOnline(pk) ? '' : ' (absent·e)'}</button>`;
  else chips += `<button class="glass chipb" data-act="sheet" data-s="village">${ico('link', 'c-tro')}Inviter</button>`;
  if (v.feast > t) chips += `<span class="glass chipb">${ico('mug', 'c-tro')}Fête · ${fmtDur(v.feast - t)}</span>`;
  const head = `<div class="idrow"><button class="glass me" data-act="sheet" data-s="village"><span class="crest" style="background:${safeColor(v.c)}">${esc(initial(v.name))}</span>
    <span class="idtxt"><b>${esc(v.name)}</b><small>${ico('s' + si, 'c-tro')}${SEASONS[si].name}, jour ${seasonDay(v, t)} sur 2</small></span></button>
    <div class="chips">${chips}</div></div>`;
  const cap = capOf(v), food = foodOf(v), mor = moraleOf(v, t), pop = v.vil.length, house = housingOf(v);
  const pill = (k, icon, val, sub, frac, cls, act) => `<button class="glass pill c-${icon}${cls ? ' ' + cls : ''}" data-act="sheet" data-s="${act}"><div class="v">${ico(icon)}<span>${val}${sub ? '<small>' + sub + '</small>' : ''}</span></div><div class="fill"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(0)}%"></i></div></button>`;
  const stock = `<div class="stock">
    ${pill('bois', 'bois', fmtN(v.r.bois), '', v.r.bois / cap, v.r.bois >= cap ? 'full' : '', 'stock')}
    ${pill('pierre', 'pierre', fmtN(v.r.pierre), '', v.r.pierre / cap, v.r.pierre >= cap ? 'full' : '', 'stock')}
    ${pill('food', 'pain', fmtN(food), '', food / (2 * cap), food < 1 ? 'warn' : '', 'stock')}
    ${pill('pop', 'people', pop, '/' + house, house ? pop / house : 0, '', 'people')}
    ${pill('mor', 'heart', mor, ' %', mor / 100, mor < 35 ? 'warn' : '', 'people')}</div>`;
  return head + stock + goalsHTML();
}
/* Objectifs : trois à la fois, sous la barre du haut. Repliés quand un panneau est ouvert en bas. */
const rewChips = r => Object.keys(r).map(k => `<span class="chip plus">${ico(k)}+${fmtN(r[k])}</span>`).join('');
const goalsForcedMin = () => sel != null || !!selP || !!place;
function goalsHTML() {
  const v = me, list = goalsOf(v); if (!list.length) return '';
  const ready = list.filter(g => goalDone(v, g)).length, min = !!LS.get('mk2.goalsMin') || goalsForcedMin();
  let h = `<div class="goalrow"><div class="glass goals${min ? ' min' : ''}">
    <button class="ghead" data-act="goalsToggle" aria-expanded="${!min}">${ico('star', 'c-tro')}<b>Objectifs</b>${ready ? `<span class="gready">${ready === 1 ? '1 à récupérer' : ready + ' à récupérer'}</span>` : ''}<span class="chev" aria-hidden="true">${min ? '▸' : '▾'}</span></button>`;
  if (!min) h += list.map(g => {
    const [c, n] = goalProg(v, g), done = c >= n;
    return `<div class="grow2${done ? ' done' : ''}"><button class="gtxt" data-act="sheet" data-s="goals"><span>${esc(g.name)}</span><small>${done ? 'Atteint !' : fmtN(c) + ' / ' + fmtN(n)}</small><i class="gbar"><b style="width:${(c / n * 100).toFixed(0)}%"></b></i></button>${done ? `<button class="btn small primary gclaim" data-act="claim" data-id="${g.id}">Récupérer</button>` : ''}</div>`;
  }).join('');
  return h + '</div></div>';
}
function renderTop() {
  if (mode === 'home' && me) setHTML(els.top, topHTML());
  else setHTML(els.top, modelLoad && modelLoad.d < modelLoad.n ? `<div class="idrow"><span></span><div class="chips"><span class="glass chipb">Modèles 3D ${Math.round(modelLoad.d / modelLoad.n * 100)} %</span></div></div>` : '');
}

/* ---------- panneaux du bas ---------- */
function statBars(p, hi) {
  return `<div class="statbars">${SPEC.map(s => `<div class="sbr${s === hi ? ' hi' : ''}"><span>${ico(SPEC_ICON[s], '')}${SPEC_LABEL[s]}</span><i><b style="width:${p.st[s] * 10}%"></b></i><em>${p.st[s]}</em></div>`).join('')}</div>`;
}
function specOfJob(v, p) {
  if (p.job === 'bat') return 'constr';
  const b = p.job != null && v.b.find(x => x.id === p.job);
  return b ? BLD[b.type].spec : null;
}
function bldLine(v, b, t) {
  const d = BLD[b.type];
  if (b.lvl < 1) return d.desc;
  if (d.spec) {
    const r = bldRate(v, b, t), ws = workersOf(v, b.id).length, out = Object.keys(outOf(b))[0];
    let s = ws ? 'Produit ' + fmtN(r[out]) + ' ' + RES_LABEL[out].toLowerCase() + ' par heure.' : 'Personne n’y travaille : ajoutez un villageois.';
    if (d.inp) s += ' Utilise ' + Object.keys(d.inp).map(k => RES_LABEL[k].toLowerCase()).join(', ') + '.';
    if (d.seasonal === 'champ') s += ' ' + (seasonIdx(v, t) === 3 ? 'Rien en hiver.' : 'Plus en été et en automne, rien en hiver.');
    return s;
  }
  if (d.house) return 'Loge ' + houseOf(b) + ' villageois.';
  if (d.store) return '+' + fmtN(d.store * b.lvl) + ' de place pour chaque ressource.';
  if (b.type === 'taverne') return '+' + (BLD.taverne.mor + 4 * (b.lvl - 1)) + ' de moral, et +' + BEER.mor + ' de plus quand on y sert de la bière. Attire de nouveaux villageois ; on peut y offrir une fête.';
  if (d.deco) return '+' + d.deco + ' de moral (les décorations comptent jusqu’à +' + DECO_MAX + ').';
  if (b.type === 'halle') return buildersMax(v) + ' bâtisseurs au plus · ' + sitesMax(v) + ' chantiers à la fois · bâtiments jusqu’au niveau ' + Math.min(3, hallLvl(v) + 1) + '.';
  return d.desc;
}
function bldPanel() {
  const v = me, b = v.b.find(x => x.id === sel); if (!b) return '';
  const d = BLD[b.type], t = now(), hl = hallLvl(v);
  let h = `<div class="glass card"><h3><span>${esc(d.name)}</span><span class="row"><small>${b.lvl > 0 ? 'niveau ' + b.lvl : 'chantier'}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>`;
  if (b.up) {
    const f = Math.min(1, b.up.done / b.up.need), sr = siteRate(v, t), open = sr.open.some(x => x.id === b.id);
    const eta = open && sr.perSite > 0 ? fmtDur((b.up.need - b.up.done) / sr.perSite * 3600000) : null;
    h += `<div class="bar"><i style="width:${Math.max(2, f * 100).toFixed(1)}%"></i></div><div class="row split note"><span>${b.lvl > 0 ? 'Agrandissement vers le niveau ' + b.up.to : 'Construction'} · ${Math.floor(f * 100)} %</span><b>${open ? (eta ? 'encore ' + eta : '') : 'en attente d’un bâtisseur libre'}</b></div>`;
  }
  h += `<p class="note">${esc(bldLine(v, b, t))}</p>`;
  if (b.type === 'champ') {
    const c = cropOf(b);
    h += `<div class="row"><span class="note">Culture :</span>${['ble', 'orge'].map(k => `<button class="btn small${c === k ? ' primary' : ''}" data-act="crop" data-id="${b.id}" data-c="${k}" aria-pressed="${c === k}">${ico(k, '')}${RES_LABEL[k]}</button>`).join('')}</div>`;
  }
  if (d.spec && b.lvl > 0) {
    const ws = workersOf(v, b.id), n = jobsOf(b), hs = heroesAt(v, b.id);
    h += `<div class="workers">${ws.map(p => `<span class="chip wk">${esc(p.name)} <b>${p.st[d.spec]}/10</b><button class="xs" data-act="unjob" data-id="${p.id}" aria-label="Retirer ${esc(p.name)}">×</button></span>`).join('')}
      ${ws.length < n ? `<button class="btn small" data-act="sheet" data-s="workers" data-k="${b.id}">+ Ajouter (${ws.length}/${n})</button>` : `<span class="note">${n}/${n} postes occupés</span>`}
      ${hs.map(x => `<span class="chip hero">${ico('crown', '')}${esc(x.name)}</span>`).join('')}</div>`;
  }
  if (!b.up) {
    const to = b.lvl + 1, mx = maxLvlOf(b.type, hl);
    if (b.lvl > 0 && to <= BLD[b.type].max) {
      if (to > mx) h += '<p class="note">Agrandissez d’abord la halle du village pour aller plus loin.</p>';
      else { const c = costOf(b.type, to), miss = missingTxt(v, c); h += `<div class="row split"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn${miss ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">Niveau ${to}</button></div>`; }
    } else if (b.lvl > 0) h += '<p class="note">Niveau maximum atteint.</p>';
  }
  h += `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button>${b.type !== 'halle' ? `<button class="btn small" data-act="demolish" data-id="${b.id}">Démolir</button>` : ''}${b.type === 'taverne' && b.lvl > 0 ? '<button class="btn small" data-act="sheet" data-s="village" data-k="feast">' + ico('mug', '') + 'Fête</button>' : ''}</div>`;
  return h + '</div>';
}
function personPanel() {
  const v = me;
  if (selP && selP[0] === 'h') {
    const k = selP.slice(1), hh = v.heroes[k]; if (!hh) return '';
    const mine = k === uid, atB = hh.at != null && hh.at !== 'bat' ? v.b.find(x => x.id === hh.at) : null;
    return `<div class="glass card"><h3><span class="row">${ico('crown', 'c-tro')}${esc(hh.name)}</span><span class="row"><small>${esc(raceName(hh.race, hh.sex))} ${esc(CLASSES[hh.cls].name.toLowerCase())} · niveau ${hh.lvl}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>
      <p class="note">${mine ? 'Ton héros' : 'Le héros de ' + esc((v.members[k] || {}).name || 'ton allié')} ${hh.at === 'bat' ? 'aide sur les chantiers.' : atB ? 'travaille : ' + esc(BLD[atB.type].name.toLowerCase()) + '.' : 'se promène dans le village.'}</p>
      ${mine ? '<div class="row"><button class="btn small primary" data-act="sheet" data-s="hero">Affecter mon héros</button></div>' : ''}</div>`;
  }
  const id = selP ? +selP.slice(1) : null, p = v.vil.find(x => x.id === id); if (!p) return '';
  const sp = specOfJob(v, p), tr = TRAITS[p.tr];
  return `<div class="glass card"><h3><span>${esc(p.name)}</span><span class="row"><small>${esc(raceName(p.race, p.sex))} · ${esc(jobName(v, p))}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>
    <p class="note"><b>${esc(tr.name)}</b> : ${esc(tr.desc)}</p>
    ${statBars(p, sp)}
    <div class="row"><button class="btn small primary" data-act="sheet" data-s="job" data-k="${p.id}">Changer de métier</button></div></div>`;
}
function navBar() {
  const v = me;
  const idle = v.vil.some(p => p.job == null), canBuild = SHOP.some(k => (BLD[k].hall || 1) <= hallLvl(v) && countOf(v, k) < limitOf(k, hallLvl(v)) && !missingTxt(v, costOf(k, 1)));
  const unseen = v.log.some(l => l.t > (LS.get('mk2.read.' + vid) || 0) && AWAY_KINDS.has(l.k));
  const myHero = v.heroes[uid];
  return `<nav class="glass nav" aria-label="Menus">
    <button data-act="sheet" data-s="build">${ico('hammer', '')}Construire${canBuild ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="people">${ico('people', '')}Villageois${v.cands.length || idle ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="hero">${ico('crown', '')}${myHero ? esc(myHero.name) : 'Héros'}</button>
    <button data-act="sheet" data-s="journal">${ico('scroll', '')}Journal${unseen ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="village">${ico('house', '')}Village</button></nav>`;
}
function renderBottom() {
  let h = '';
  if (mode === 'home' && me) {
    if (place) {
      const valid = placeValid(), d = BLD[place.type];
      h = `<div class="glass card"><div class="row split"><b>${place.kind === 'new' ? 'Placer' : 'Déplacer'} : ${esc(d.name)}</b><span class="note">Touchez le terrain pour choisir.</span></div>
        ${valid ? '' : '<p class="why">Emplacement occupé ou trop près du bord.</p>'}
        <div class="row"><button class="btn grow" data-act="placeCancel">Annuler</button>
        <button class="btn grow${valid ? ' primary' : ' off'}" data-act="placeOk">${place.kind === 'new' ? 'Construire ici <span class="sub">' + chipsRes(costOf(place.type, 1)) + '</span>' : 'Poser ici'}</button></div></div>`;
    } else {
      if (sel != null) h += bldPanel();
      else if (selP) h += personPanel();
      h += navBar();
    }
  }
  setHTML(els.bottom, h);
}

/* ---------- menus ---------- */
function openSheet(s, arg) {
  if (!me) return;
  sheet = s; sheetArg = arg == null ? null : arg; place = null;
  if (s === 'journal') LS.set('mk2.read.' + vid, now());
  renderAll(); els.sheetBody.scrollTop = 0;
}
function closeSheet(silent) { sheet = null; sheetArg = null; if (!silent) renderAll(); }
function sheetBuild() {
  const v = me, hl = hallLvl(v), sr = siteRate(v, now());
  let h = `<p class="note">Bâtisseurs : <b>${builders(v).length} sur ${buildersMax(v)}</b> · chantiers ouverts : <b>${sr.open.length} sur ${sitesMax(v)}</b>. Les bâtisseurs se partagent entre les chantiers. Touchez un bâtiment du village pour l’agrandir.</p>`;
  const hall = v.b.find(b => b.type === 'halle');
  if (hall) {
    const to = hall.lvl + 1, c = to <= 5 ? costOf('halle', to) : null;
    h += `<div class="item feature"><div class="head"><b>Halle du village · niveau ${hall.lvl}</b><small>${hall.up ? 'agrandissement en cours' : to > 5 ? 'niveau maximum' : 'prochain : niveau ' + to}</small></div>
      <p>Débloque de nouveaux bâtiments, plus de bâtisseurs et de chantiers à la fois.</p>
      ${!hall.up && c ? `<div class="foot"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn small${missingTxt(v, c) ? ' off' : ' primary'}" data-act="upgrade" data-id="${hall.id}">Agrandir</button></div>` : ''}</div>`;
  }
  for (const [cat, label] of CATS) {
    const list = SHOP.filter(k => BLD[k].cat === cat); if (!list.length) continue;
    h += `<div class="sec"><h4>${label}</h4>`;
    for (const k of list) {
      const d = BLD[k], n = countOf(v, k), lim = limitOf(k, hl), c = costOf(k, 1), locked = (d.hall || 1) > hl;
      const miss = missingTxt(v, c), full = n >= lim;
      h += `<div class="item"><div class="head"><b>${esc(d.name)}</b><small>${locked ? 'halle niveau ' + d.hall : n + ' sur ' + lim}</small></div><p>${esc(d.desc)}</p>
        <div class="foot"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('hammer', '')}${fmtDur(workOf(k, 1) / Math.max(1, sr.perSite) * 3600000)}</span></span>
        <button class="btn small${locked || full || miss ? ' off' : ' primary'}" data-act="place" data-type="${k}">${locked ? 'Verrouillé' : full ? 'Maximum' : 'Construire'}</button></div></div>`;
    }
    h += '</div>';
  }
  return h;
}
function sheetGoals() {
  const v = me, list = goalsOf(v), doneN = (v.goals || []).length;
  let h = `<p class="note">Atteignez ces objectifs pour faire grandir le village : chacun rapporte une récompense, puis un nouvel objectif apparaît. Objectifs accomplis : <b>${doneN} sur ${GOALS.length}</b>.</p>`;
  if (!list.length) return h + '<div class="item feature"><b>Tous les objectifs sont accomplis : bravo !</b></div>';
  for (const g of list) {
    const [c, n] = goalProg(v, g), done = c >= n;
    h += `<div class="item${done ? ' feature' : ''}"><div class="head"><b class="row">${ico('star', done ? 'c-tro' : 'muted')}${esc(g.name)}</b><small>${done ? 'atteint' : fmtN(c) + ' sur ' + fmtN(n)}</small></div><p>${esc(g.txt)}</p>
      <div class="bar"><i style="width:${(c / n * 100).toFixed(0)}%"></i></div>
      <div class="foot"><span class="chips2">${rewChips(g.rew)}</span><button class="btn small${done ? ' primary' : ' off'}" data-act="claim" data-id="${g.id}"${done ? '' : ' disabled'}>Récupérer</button></div></div>`;
  }
  return h;
}
function candCard(c, big) {
  const tr = TRAITS[c.tr];
  return `<div class="item cand"><div class="head"><b>${esc(c.name)}</b><small>${esc(raceName(c.race, c.sex))} · ${esc(tr.name.toLowerCase())}</small></div>
    <p>${esc(tr.desc)} Doué pour : <b>${esc(SPEC_LABEL[bestSpec(c)].toLowerCase())}</b>.${big ? '' : ' Repart dans ' + fmtDur(c.t + DAY - (me ? me.t : now())) + ' sans réponse.'}</p>
    ${statBars(c, bestSpec(c))}
    <div class="row"><button class="btn grow" data-act="refuse" data-id="${c.id}">Refuser</button><button class="btn primary grow" data-act="accept" data-id="${c.id}">Accueillir</button></div></div>`;
}
function sheetPeople() {
  const v = me, t = now(), rt = ratesOf(v, t), food = foodOf(v), foodNet = rt.pain + rt.viande + rt.food;
  const parts = moraleParts(v, t), mor = moraleOf(v, t);
  let h = `<div class="item"><div class="row split"><b class="row">${ico('people', 'c-tro')}${v.vil.length} villageois · ${housingOf(v)} places</b><span class="chip${freeHousing(v) <= 0 ? ' short' : ''}">${Math.max(0, freeHousing(v))} libre${freeHousing(v) > 1 ? 's' : ''}</span></div>
    <p>Nourriture : <b>${fmtN(food)}</b> (${fmtR(foodNet)} par heure)${foodNet < 0 && food > 0 ? ' · il en reste pour <b>' + fmtDur(food / -foodNet * 3600000) + '</b>' : ''}. Chacun mange une ration par heure.</p>
    <p>Moral : <b>${mor} %</b> ${parts.length ? '(' + parts.map(p => esc(p[0].toLowerCase()) + ' ' + (p[1] > 0 ? '+' : '−') + Math.abs(p[1])).join(', ') + ')' : ''}. Un bon moral fait mieux travailler et attire du monde.</p></div>`;
  if (v.cands.length) h += `<div class="sec"><h4>Ils voudraient s’installer</h4>${v.cands.map(c => candCard(c)).join('')}</div>`;
  const groups = {};
  for (const p of v.vil) { const k = jobName(v, p); (groups[k] = groups[k] || []).push(p); }
  const order = Object.keys(groups).sort((a, b) => (a === 'Sans emploi') - (b === 'Sans emploi') || a.localeCompare(b));
  for (const g of order) {
    h += `<div class="sec"><h4>${esc(g)}${g === 'Sans emploi' ? ' : donnez-leur un métier' : ''}</h4>`;
    for (const p of groups[g]) {
      const sp = specOfJob(v, p), tr = TRAITS[p.tr], xp = sp ? Math.min(100, (p.xp[sp] || 0) / xpNeed(p.st[sp]) * 100) : 0;
      h += `<div class="item person"><div class="head"><b>${esc(p.name)}</b><small>${esc(raceName(p.race, p.sex))} · ${esc(tr.name.toLowerCase())}</small></div>
        ${statBars(p, sp)}
        <div class="foot"><span class="note">${sp && p.st[sp] < 10 ? 'Progrès en ' + esc(SPEC_LABEL[sp].toLowerCase()) + ' : ' + Math.floor(xp) + ' %' : sp ? 'Maître dans son métier' : 'Le meilleur métier pour lui : ' + esc(SPEC_LABEL[bestSpec(p)].toLowerCase())}</span>
        <button class="btn small" data-act="sheet" data-s="job" data-k="${p.id}">Métier</button></div></div>`;
    }
    h += '</div>';
  }
  return h;
}
function sheetJob() {
  const v = me, p = v.vil.find(x => x.id === +sheetArg); if (!p) return '<p class="note">Ce villageois n’est plus là.</p>';
  const opt = (to, label, sub, spec, ok) => `<button class="item opt${p.job === to ? ' on' : ''}${ok ? '' : ' off'}" data-act="setjob" data-id="${p.id}" data-to="${to == null ? '' : to}"${ok ? '' : ' disabled'}>
    <div class="head"><b>${esc(label)}</b><small>${sub}</small></div>${spec ? `<p>${ico(SPEC_ICON[spec], '')} ${esc(SPEC_LABEL[spec])} : <b>${p.st[spec]}/10</b></p>` : ''}</button>`;
  let h = `<p class="note">Choisissez le métier de <b>${esc(p.name)}</b>. Sa note dans la spécialité décide de ce qu’il produit (1 : 60 %, 5 : normal, 10 : +50 %), et il progresse en pratiquant.</p>`;
  const prod = v.b.filter(b => BLD[b.type].spec && b.lvl > 0).sort((a, b) => p.st[BLD[b.type].spec] - p.st[BLD[a.type].spec]);
  for (const b of prod) { const n = workersOf(v, b.id).length, m = jobsOf(b); h += opt(b.id, BLD[b.type].job + ' · ' + BLD[b.type].name + (b.lvl > 1 ? ' niv. ' + b.lvl : ''), n + ' sur ' + m, BLD[b.type].spec, n < m || p.job === b.id); }
  const nb = builders(v).length;
  h += opt('bat', 'Bâtisseur', nb + ' sur ' + buildersMax(v), 'constr', nb < buildersMax(v) || p.job === 'bat');
  h += opt(null, 'Sans emploi', 'se repose', null, true);
  return h;
}
function sheetWorkers() {
  const v = me, b = v.b.find(x => x.id === +sheetArg); if (!b || !BLD[b.type].spec) return '<p class="note">Bâtiment introuvable.</p>';
  const s = BLD[b.type].spec, list = v.vil.filter(p => p.job !== b.id).sort((x, y) => y.st[s] - x.st[s]);
  let h = `<p class="note">Qui envoyer travailler ici ? Classés par note en ${esc(SPEC_LABEL[s].toLowerCase())}.</p>`;
  for (const p of list) h += `<button class="item opt" data-act="setjob" data-id="${p.id}" data-to="${b.id}" data-back="1"><div class="head"><b>${esc(p.name)}</b><small>${esc(jobName(v, p))}</small></div><p>${ico(SPEC_ICON[s], '')} ${esc(SPEC_LABEL[s])} : <b>${p.st[s]}/10</b> · ${esc(TRAITS[p.tr].name.toLowerCase())}</p></button>`;
  return h || '<p class="note">Personne de disponible.</p>';
}
function heroCard(k, hh, mine) {
  const R = RACES[hh.race], C = CLASSES[hh.cls];
  return `<div class="item hero-card"><div class="head"><b class="row">${ico('crown', 'c-tro')}${esc(hh.name)}</b><small>${esc(raceName(hh.race, hh.sex))} ${esc(C.name.toLowerCase())} · niveau ${hh.lvl}</small></div>
    <p>${esc(R.desc)} ${esc(C.desc)}</p><p class="note">Au village : +25 % là où sa race excelle (${esc(SPEC_LABEL[R.spec].toLowerCase())}), +10 % ailleurs. Combats et compétences arrivent à l’étape suivante.</p>${mine ? '' : `<p class="note">Héros de ${esc((me.members[k] || {}).name || 'ton allié')}.</p>`}</div>`;
}
function sheetHero() {
  const v = me, hh = v.heroes[uid];
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p><button class="btn primary" data-act="heroForm">Créer mon héros</button>';
  let h = heroCard(uid, hh, true);
  const R = RACES[hh.race];
  const opt = (to, label, bonus) => `<button class="item opt${hh.at === to || (to == null && hh.at == null) ? ' on' : ''}" data-act="heroAt" data-to="${to == null ? '' : to}"><div class="head"><b>${esc(label)}</b><small>${bonus}</small></div></button>`;
  h += `<div class="sec"><h4>Que fait ${esc(hh.name)} au village ?</h4>`;
  h += opt(null, 'Se promener', 'aucun bonus');
  h += opt('bat', 'Aider sur les chantiers', R.spec === 'constr' ? '+25 %' : '+10 %');
  for (const b of v.b.filter(x => BLD[x.type].spec && x.lvl > 0)) h += opt(b.id, BLD[b.type].name, R.spec === BLD[b.type].spec ? '+25 %' : '+10 %');
  h += '</div>';
  const pk = partnerId(v);
  if (pk && v.heroes[pk]) h += `<div class="sec"><h4>Le héros de ${esc(v.members[pk].name)}</h4>${heroCard(pk, v.heroes[pk], false)}</div>`;
  return h;
}
const LOG_ICON = { built: 'hammer', site: 'hammer', cand: 'people', arrive: 'people', leave: 'people', season: 's0', join: 'link', hero: 'crown', feast: 'mug', skill: 'star', found: 'house', demolish: 'hammer', goal: 'star', crop: 'ble' };
function sheetJournal() {
  const v = me;
  if (!v.log.length) return '<p class="note">Rien pour l’instant.</p>';
  return '<ol class="log">' + v.log.slice().reverse().map(e => `<li><time>${fmtAgo(e.t)}</time><span class="row">${ico(e.k === 'season' ? 's' + seasonIdx(v, e.t) : LOG_ICON[e.k] || 'scroll', 'c-tro')}${esc(e.m)}</span></li>`).join('') + '</ol>';
}
function inviteLink() { return location.origin + location.pathname + '?join=' + encodeURIComponent(vid); }
function sheetVillage() {
  const v = me, t = now(), si = seasonIdx(v, t), pk = partnerId(v);
  let h = '';
  h += `<div class="sec"><h4>Habitants</h4><div class="item">${Object.entries(v.members).map(([k, m]) => `<div class="row split"><b class="row">${isOnline(k) || k === uid ? '<span class="dotx on"></span>' : '<span class="dotx"></span>'}${esc(m.name)}${k === uid ? ' (toi)' : ''}</b><small class="note">${v.heroes[k] ? esc(v.heroes[k].name) : 'pas encore de héros'}</small></div>`).join('')}</div>`;
  if (!pk) h += `<div class="item feature"><b class="row">${ico('link', 'c-tro')}Inviter ta partenaire</b><p>Envoie-lui ce lien : en l’ouvrant, elle rejoindra ce village et créera son héros.</p>
    <input type="text" readonly value="${esc(inviteLink())}" class="linkbox" aria-label="Lien d’invitation">
    <div class="row"><button class="btn small primary" data-act="copyLink">Copier le lien</button>${navigator.share ? '<button class="btn small" data-act="shareLink">Partager</button>' : ''}</div></div>`;
  h += '</div>';
  const next = nextSeasonAt(v, t);
  h += `<div class="sec"><h4>Saison</h4><div class="item"><b class="row">${ico('s' + si, 'c-tro')}${SEASONS[si].name}, jour ${seasonDay(v, t)} sur 2</b><p>${SEASONS[(si + 1) % 4].name} dans <b>${fmtDur(next - t)}</b>. ${si === 2 ? 'L’hiver approche : faites des réserves de nourriture et de bois.' : si === 3 ? 'Les champs dorment, et chaque maison brûle du bois.' : ''}</p></div></div>`;
  if (v.b.some(b => b.type === 'taverne' && b.lvl > 0)) {
    const ready = v.feastCd <= t, miss = missingTxt(v, FEAST.cost);
    h += `<div class="sec" id="feastSec"><h4>Fête à la taverne</h4><div class="item"><p>+${FEAST.mor} de moral pendant un jour pour tout le village.${ready ? '' : ' Prochaine fête possible dans ' + fmtDur(v.feastCd - t) + '.'}</p>
      <div class="foot"><span class="chips2">${chipsRes(FEAST.cost, v.r)}</span><button class="btn small${!ready || miss ? ' off' : ' primary'}" data-act="feast">${ico('mug', '')}Faire la fête</button></div></div></div>`;
  }
  const ob = (o, l) => `<button class="btn small${orient === o ? ' primary' : ''}" data-act="orient" data-o="${o}">${l}</button>`;
  h += `<div class="sec"><h4>Affichage</h4><div class="row">${ob('land', 'Paysage')}${ob('land2', 'Paysage inversé')}${ob('port', 'Portrait')}</div></div>`;
  const S = SND.get(), tg = (k, on) => `<button class="btn small${on ? ' primary' : ''}" data-act="snd" data-k="${k}" aria-pressed="${on}">${on ? 'Activée' : 'Coupée'}</button>`;
  h += `<div class="sec"><h4>Son</h4>
    <div class="item"><div class="row split"><b class="row">${ico('sound', 'c-tro')}Musique</b>${tg('music', S.music)}</div><input class="range" type="range" min="0" max="100" value="${Math.round(S.mv * 100)}" data-snd="mv" aria-label="Volume de la musique"></div>
    <div class="item"><div class="row split"><b class="row">${ico('hammer', 'c-tro')}Bruitages</b>${tg('sfx', S.sfx)}</div><input class="range" type="range" min="0" max="100" value="${Math.round(S.sv * 100)}" data-snd="sv" aria-label="Volume des bruitages"></div></div>`;
  h += `<div class="sec"><h4>Compte</h4><p class="note">Connecté${fbUser && fbUser.name ? ' : <b>' + esc(fbUser.name) + '</b>' : ''}. Le village est sauvegardé en ligne, pour vous deux.</p>
    <div class="row">${installEvt ? '<button class="btn small primary" data-act="install">Installer l’appli</button>' : ''}<button class="btn small" data-act="sheet" data-s="help">${ico('help', '')}Aide</button><button class="btn small" data-act="logout">Se déconnecter</button></div></div>`;
  return h;
}
function sheetStock() {
  const v = me, t = now(), rt = ratesOf(v, t), cap = capOf(v);
  let h = `<p class="note">Chaque ressource peut monter jusqu’à <b>${fmtN(cap)}</b> : construisez des entrepôts pour en garder plus.</p><div class="item">`;
  for (const k of RES_SHOW) h += `<div class="row split stockrow"><b class="row">${ico(k)}${RES_LABEL[k]}</b><span><b>${fmtN(v.r[k] || 0)}</b> <small class="note">${fmtR(rt[k] || 0)}/h</small></span></div>`;
  h += `<div class="row split stockrow"><b class="row">${ico('people', 'c-tro')}Repas des villageois</b><span><small class="note">${fmtR(rt.food)}/h (pain et viande)</small></span></div></div>`;
  h += '<p class="note">Le blé devient farine au moulin, puis pain à la boulangerie. Le pain et la viande nourrissent le village. L’orge devient bière à la brasserie : servie à la taverne, elle remonte le moral, et il en faut pour les fêtes.</p>';
  return h;
}
function sheetHelp() {
  const sec = (t, list) => `<div class="sec"><h4>${t}</h4><ul class="help">${list.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
  return sec('Objectifs', ['Trois objectifs s’affichent en haut à gauche. Quand l’un est atteint, touchez « Récupérer » pour gagner sa récompense : un nouvel objectif apparaît.'])
    + sec('Le village', ['Un seul village pour vous deux : tout ce que l’un construit ou décide, l’autre le voit.', 'Le village vit même quand vous êtes déconnectés : on y travaille, on y mange, et des voyageurs se présentent.', 'Touchez un bâtiment pour le voir, l’agrandir ou y envoyer des travailleurs. Touchez un habitant pour voir sa fiche.'])
    + sec('Les villageois', ['Chacun a une note sur 10 dans six spécialités. Sa note dans son métier décide de ce qu’il produit : 1 donne 60 %, 5 normal, 10 donne 50 % de plus.', 'Ils progressent en pratiquant, de plus en plus lentement.', 'Leur caractère compte : un travailleur produit plus, un joyeux remonte le moral, un gourmand mange plus.', 'Des voyageurs se présentent s’il y a une place libre dans les maisons, à manger et un bon moral. Vous avez un jour pour les accueillir.'])
    + sec('Nourriture et saisons', ['Chaque villageois mange une ration par heure : du pain ou de la viande. Des repas variés remontent le moral.', 'Une saison dure 2 jours. En hiver, les champs ne donnent rien et chaque maison brûle du bois : faites des réserves en automne.', 'Sans nourriture, le moral s’effondre, et au bout d’un jour quelqu’un quitte le village.', 'Touchez un champ pour choisir sa culture : blé ou orge. L’orge devient bière à la brasserie ; servie à la taverne, la bière remonte le moral, et il en faut pour les fêtes.'])
    + sec('Construire', ['Les bâtisseurs font avancer les chantiers, plus vite s’ils sont doués en construction. Sans bâtisseur, ça avance quand même un peu.', 'Agrandir la halle débloque des bâtiments, plus de bâtisseurs et plus de chantiers à la fois.'])
    + sec('Vos héros', ['Au village, votre héros se promène. Affectez-le à un bâtiment : +25 % là où sa race excelle (nain : minage, elfe : chasse, humain : construction), +10 % ailleurs.', 'Les donjons, les combats et l’équipement arrivent aux prochaines étapes.']);
}
function renderSheet() {
  if (!sheet || !me || mode !== 'home') { els.sheet.hidden = true; return; }
  const titles = { build: 'Construire', people: 'Villageois', job: 'Choisir un métier', workers: 'Ajouter un travailleur', hero: 'Héros', journal: 'Journal du village', village: me.name, stock: 'Réserves', help: 'Aide', goals: 'Objectifs' };
  els.sheet.hidden = false;
  els.sheetTitle.textContent = titles[sheet] || '';
  const f = { build: sheetBuild, people: sheetPeople, job: sheetJob, workers: sheetWorkers, hero: sheetHero, journal: sheetJournal, village: sheetVillage, stock: sheetStock, help: sheetHelp, goals: sheetGoals }[sheet];
  setHTML(els.sheetBody, f ? f() : '');
  if (sheet === 'village' && sheetArg === 'feast' && !renderSheet.scrolled) { renderSheet.scrolled = true; const el = $('#feastSec'); if (el) els.sheetBody.scrollTop = el.offsetTop - 8; }
}

/* ---------- fenêtres ---------- */
function swatches(name, pick) {
  return `<div class="swatches">${COLORS.map((c, i) => `<label><input type="radio" name="${name}" value="${c}"${c === pick ? ' checked' : ''} aria-label="Couleur ${i + 1}"><span style="background:${c}"></span></label>`).join('')}</div>`;
}
function gateHTML() {
  const saved = LS.get('mk2.me') || {};
  return `<form id="foundForm" novalidate style="display:grid;gap:12px">
    <p class="eyebrow">Nouvelle partie</p><h2>Fondez votre village</h2>
    <p>Un seul village pour vous deux, des villageois à loger et à nourrir, et chacun son héros. Ta partenaire te rejoindra avec un lien d’invitation, à retrouver dans le menu Village.</p>
    <label>Nom du village<input type="text" id="fVname" maxlength="24" value="${esc(saved.vname || '')}" placeholder="Ex. Val-Brume" autocomplete="off"></label>
    <label>Ton prénom<input type="text" id="fPname" maxlength="20" value="${esc(saved.pname || (fbUser && fbUser.name ? fbUser.name.split(' ')[0] : ''))}" placeholder="Ton prénom" autocomplete="given-name"></label>
    <fieldset class="fs"><legend>Couleur du village</legend>${swatches('fColor', saved.c || COLORS[0])}</fieldset>
    <p class="err" id="fErr" hidden></p>
    <button class="btn primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Fondation…' : 'Fonder le village'}</button>
    <p class="note">Ta partenaire a déjà fondé le village ? Demande-lui le lien d’invitation et ouvre-le sur ce téléphone.</p></form>`;
}
function joinHTML() {
  const saved = LS.get('mk2.me') || {};
  return `<form id="joinForm" novalidate style="display:grid;gap:12px">
    <p class="eyebrow">Invitation</p><h2>Rejoindre ${esc(joinInfo.name)}</h2>
    <p>${esc(joinInfo.by)} t’invite à vivre dans son village. Vous le gérerez ensemble, et chacun aura son héros.</p>
    <label>Ton prénom<input type="text" id="jPname" maxlength="20" value="${esc(saved.pname || (fbUser && fbUser.name ? fbUser.name.split(' ')[0] : ''))}" placeholder="Ton prénom" autocomplete="given-name"></label>
    <p class="err" id="jErr" hidden></p>
    <button class="btn primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Arrivée…' : 'Rejoindre le village'}</button></form>`;
}
function heroHTML() {
  const used = me ? Object.values(me.heroes).map(h => h && h.col) : [];
  const pick = COLORS.find(c => !used.includes(c)) || COLORS[1];
  const card = (name, val, title, txt, checked) => `<label class="optc"><input type="radio" name="${name}" value="${val}"${checked ? ' checked' : ''}><span><b>${esc(title)}</b><small>${esc(txt)}</small></span></label>`;
  return `<form id="heroForm" novalidate style="display:grid;gap:12px">
    <p class="eyebrow">${esc(me ? me.name : '')}</p><h2>Crée ton héros</h2>
    <p class="note">Tu ne joues qu’un héros : il partira en donjon et deviendra plus fort. Au village, il se promène et donne un coup de main.</p>
    <div class="hf2"><div class="col">
      <label>Nom du héros<input type="text" id="hName" maxlength="18" placeholder="Ex. Brokk" autocomplete="off"></label>
      <fieldset class="fs"><legend>Homme ou femme</legend><div class="optrow">${card('hSex', 'm', 'Homme', '', true)}${card('hSex', 'f', 'Femme', '', false)}</div></fieldset>
      <fieldset class="fs"><legend>Couleur</legend>${swatches('hCol', pick)}</fieldset>
      <p class="note">D’autres races et classes arriveront plus tard.</p>
    </div><div class="col">
      <fieldset class="fs"><legend>Race</legend><div class="optgrid">${RACE_KEYS.map((k, i) => card('hRace', k, RACES[k].name, RACES[k].desc + ' Bonus : ' + SPEC_LABEL[RACES[k].spec].toLowerCase() + '.', i === 0)).join('')}</div></fieldset>
      <fieldset class="fs"><legend>Classe</legend><div class="optgrid">${CLASS_KEYS.map((k, i) => card('hCls', k, CLASSES[k].name, CLASSES[k].desc, i === 0)).join('')}</div></fieldset>
    </div></div>
    <p class="err" id="hErr" hidden></p>
    <button class="btn primary" type="submit">Entrer au village</button></form>`;
}
function renderModal() {
  let h = '';
  const M = modal;
  if (M && M.kind === 'login') {
    h = `<p class="eyebrow">Bienvenue dans la vallée</p><h2 class="title">Mountain Kings</h2>
      <p>Connecte-toi avec ton compte Google. Votre village est sauvegardé en ligne : vous le retrouvez sur tous vos appareils.</p>
      <button class="btn primary" data-act="login"${M.busy ? ' disabled' : ''}>${M.busy ? 'Connexion…' : 'Se connecter avec Google'}</button>
      ${M.err ? `<p class="err">${esc(M.err)}</p>` : ''}
      <p class="note" style="font-size:12.5px">La fenêtre Google ne s’ouvre pas ? Ouvre le lien du jeu directement dans Chrome ou Safari.</p>`;
  } else if (M && M.kind === 'dberr') h = `<h2>La vallée ne répond pas</h2><p>Impossible de joindre le serveur du jeu. Vérifie ta connexion internet, puis réessaie.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  else if (M && M.kind === 'denied') h = `<h2>Accès refusé</h2><p>Le serveur a refusé l’accès au village. Les règles de la base de données ne sont peut-être pas encore à jour, ou ce village a déjà ses deux habitants.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  else if (M && M.kind === 'info') h = `<h2>${esc(M.title)}</h2><p>${esc(M.text)}</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  else if (M && M.kind === 'nogl') h = `<h2>La 3D ne s’affiche pas</h2><p>Cet appareil ou ce navigateur ne permet pas l’affichage 3D. Les menus marchent quand même, mais la carte du village reste vide.</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  else if (M && M.kind === 'cand' && me) {
    const c = me.cands.find(x => x.id === M.id);
    if (!c) modal = null;
    else h = `<p class="eyebrow">Un voyageur se présente</p><h2>${esc(c.name)} voudrait s’installer</h2>${candCard(c, true)}<button class="btn" data-act="closeModal">Plus tard</button>`;
  } else if (M && M.kind === 'away' && me) {
    h = `<p class="eyebrow">Pendant votre absence</p><h2>Des nouvelles du village</h2><ol class="log">${M.list.map(e => `<li><time>${fmtAgo(e.t)}</time><span>${esc(e.m)}</span></li>`).join('')}</ol><button class="btn primary" data-act="closeModal">Au travail !</button>`;
  } else if (M && M.kind === 'welcome') {
    h = `<p class="eyebrow">Bienvenue, ${esc(M.name)}</p><h2>Votre village commence ici</h2>
      <ul class="news">
        <li>${ico('star', 'c-tro')}<span>Suivez les <b>objectifs</b> en haut à gauche : ils rapportent des ressources.</span></li>
        <li>${ico('house', 'c-tro')}<span>Touchez un <b>bâtiment</b> pour le voir, l’agrandir ou y envoyer des travailleurs.</span></li>
        <li>${ico('people', '')}<span>Touchez un <b>villageois</b> pour voir ses notes sur 10 et changer son métier.</span></li>
        <li>${ico('pain', '')}<span>Chacun mange une ration par heure. En <b>hiver</b>, les champs dorment : faites des réserves.</span></li>
        <li>${ico('link', 'c-tro')}<span>Invitez votre partenaire depuis le menu <b>Village</b>.</span></li>
      </ul><button class="btn primary" data-act="closeModal">C’est parti</button>`;
  } else if (!M && mode === 'gate') h = gateHTML();
  else if (!M && mode === 'join' && joinInfo) h = joinHTML();
  else if (!M && mode === 'hero' && me) h = heroHTML();
  els.modal.hidden = !h;
  if (h) {
    setHTML(els.mcard, h);
    /* Nouvelle fenêtre : on repart du haut (sinon elle garde le défilement de la précédente). */
    const k = M ? M.kind + (M.id || '') : mode;
    if (els.mcard._k !== k) { els.mcard._k = k; els.mcard.scrollTop = 0; }
  } else { els.mcard._h = ''; els.mcard._k = ''; }
}
/* Un voyageur arrive : sa fiche s'ouvre une fois, ensuite il attend dans le menu Villageois. */
function candCheck() {
  if (!me || mode !== 'home' || modal || sheet || place || !me.cands.length) return;
  const seen = LS.get('mk2.cands.' + vid) || [];
  const c = me.cands.find(x => !seen.includes(x.id)); if (!c) return;
  /* Une seule fiche à la fois : les autres voyageurs attendent dans le menu Villageois (bouton « N arrivées »). */
  for (const x of me.cands) if (!seen.includes(x.id)) seen.push(x.id);
  LS.set('mk2.cands.' + vid, seen.slice(-40));
  modal = { kind: 'cand', id: c.id }; SND.sfx('invite');
}
function renderAll() {
  els.loading.hidden = mode !== 'loading' || !!(modal && (modal.kind === 'login' || modal.kind === 'dberr'));
  renderTop(); renderBottom(); renderSheet(); renderModal();
}

/* ---------- événements ---------- */
document.addEventListener('pointerdown', e => { pressing = e.target.closest('button, input'); SND.unlock(); }, true);
document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.snd; if (k) SND.set({ [k]: Math.max(0, Math.min(1, e.target.value / 100)) }); });
const release = () => { pressing = null; };
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
const ACT = {
  noop() {},
  orient: b => { orient = b.dataset.o; LS.set('mk2.orient', orient); applyOrientation(); renderAll(); },
  sheet: b => { renderSheet.scrolled = false; openSheet(b.dataset.s, b.dataset.k); },
  closeSheet: () => closeSheet(),
  closeModal: () => { modal = null; renderAll(); },
  place: b => startPlace(b.dataset.type),
  placeOk: () => confirmPlace(),
  placeCancel: () => { place = null; refreshScene(); renderAll(); },
  upgrade: b => { if (act({ type: 'upgrade', id: +b.dataset.id })) toast('Agrandissement lancé : les bâtisseurs s’y mettent.'); },
  move: b => startMove(+b.dataset.id),
  demolish: b => { const x = me.b.find(q => q.id === +b.dataset.id); if (!x || !confirm('Démolir : ' + BLD[x.type].name.toLowerCase() + ' ? Rien ne sera rendu.')) return; if (act({ type: 'demolish', id: x.id })) { sel = null; refreshScene(); renderAll(); } },
  desel: () => { sel = null; selP = null; refreshScene(); renderAll(); },
  setjob: b => { const to = b.dataset.to === '' ? null : b.dataset.to === 'bat' ? 'bat' : +b.dataset.to; if (act({ type: 'job', vid: +b.dataset.id, to })) { if (b.dataset.back || selP) closeSheet(); else openSheet('people'); } },
  unjob: b => act({ type: 'job', vid: +b.dataset.id, to: null }),
  accept: b => { const r = act({ type: 'accept', id: +b.dataset.id }); if (r) { toast('Bienvenue à ' + r.name + ' ! Donnez-lui un métier.'); if (modal && modal.kind === 'cand') modal = null; renderAll(); } },
  refuse: b => { if (act({ type: 'refuse', id: +b.dataset.id })) { if (modal && modal.kind === 'cand') modal = null; renderAll(); } },
  heroAt: b => { const to = b.dataset.to === '' ? null : b.dataset.to === 'bat' ? 'bat' : +b.dataset.to; if (act({ type: 'heroAt', to })) toast(to == null ? 'Ton héros se promène.' : 'Ton héros se met au travail.'); },
  heroForm: () => { closeSheet(true); setMode('hero'); },
  feast: () => { if (act({ type: 'feast' })) toast('C’est la fête à la taverne !'); },
  claim: b => act({ type: 'claim', id: b.dataset.id }),
  crop: b => { if (act({ type: 'crop', id: +b.dataset.id, c: b.dataset.c })) toast(b.dataset.c === 'orge' ? 'On sème de l’orge : pour la bière de la brasserie.' : 'On sème du blé : pour la farine et le pain.'); },
  goalsToggle: () => { if (goalsForcedMin()) { sel = null; selP = null; place = null; LS.set('mk2.goalsMin', 0); refreshScene(); } else LS.set('mk2.goalsMin', LS.get('mk2.goalsMin') ? 0 : 1); renderAll(); },
  copyLink: () => { const l = inviteLink(); (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(() => toast('Lien copié : envoie-le à ta partenaire.')).catch(() => { const i = $('.linkbox'); if (i) { i.select(); try { document.execCommand('copy'); toast('Lien copié.'); } catch (e) { toast('Sélectionne le lien et copie-le.'); } } }); },
  shareLink: () => { navigator.share({ title: 'Mountain Kings', text: 'Rejoins notre village dans Mountain Kings !', url: inviteLink() }).catch(() => {}); },
  snd: b => { const k = b.dataset.k, S = SND.get(); SND.set({ [k]: !S[k] }); renderAll(); },
  login: () => doLogin(),
  logout: () => { if (!confirm('Se déconnecter de Mountain Kings sur cet appareil ?')) return; FB.logout().finally(() => location.reload()); },
  reload: () => location.reload(),
  install: () => { const e = installEvt; if (!e) return; installEvt = null; e.prompt(); (e.userChoice || Promise.resolve()).finally(() => renderAll()); },
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderAll(); });
const QUIET = new Set(['noop', 'upgrade', 'placeOk', 'accept', 'feast', 'setjob', 'heroAt', 'claim', 'crop']);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  if (!QUIET.has(b.dataset.act)) SND.sfx('click');
  const f = ACT[b.dataset.act]; if (f) f(b);
});
const formErr = (id, msg) => { const el = $(id); if (el) { el.textContent = msg; el.hidden = !msg; } };
const radio = n => (document.querySelector('input[name="' + n + '"]:checked') || {}).value;
document.addEventListener('submit', e => {
  const id = e.target.id; if (!['foundForm', 'joinForm', 'heroForm'].includes(id)) return;
  e.preventDefault();
  if (id === 'foundForm') {
    const vname = cleanName($('#fVname').value, 24), pn = cleanName($('#fPname').value, 20), c = safeColor(radio('fColor'));
    if (!vname || !pn) { formErr('#fErr', !vname ? 'Donne un nom au village.' : 'Écris ton prénom.'); return; }
    LS.set('mk2.me', { vname, pname: pn, c });
    foundVillage(vname, c, pn);
  } else if (id === 'joinForm') {
    const pn = cleanName($('#jPname').value, 20);
    if (!pn) { formErr('#jErr', 'Écris ton prénom.'); return; }
    LS.set('mk2.me', Object.assign(LS.get('mk2.me') || {}, { pname: pn }));
    joinVillage(pn);
  } else {
    const name = cleanName($('#hName').value, 18);
    if (!name) { formErr('#hErr', 'Donne un nom à ton héros.'); return; }
    const r = act({ type: 'hero', name, race: radio('hRace'), cls: radio('hCls'), sex: radio('hSex'), col: safeColor(radio('hCol')) });
    if (r) { setMode('home'); modal = { kind: 'welcome', name }; renderAll(); }
  }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { resim(); renderAll(); refreshScene(); } });

let goalsReady = null;
function goalCheck() {
  if (!me || mode !== 'home') return;
  const ready = goalsOf(me).filter(g => goalDone(me, g)).map(g => g.id);
  if (goalsReady) { const fresh = ready.filter(id => !goalsReady.includes(id)); if (fresh.length) { toast('Objectif atteint : ' + GOAL_BY[fresh[0]].name + ' ! Touchez « Récupérer ».'); SND.sfx('star'); } }
  goalsReady = ready;
}
function tick() {
  if (vsim) {
    simulateVillage(vsim, now()); recompute(); newsCheck(); goalCheck();
    if (!pending.length && !committing && vraw && now() - Math.max(vraw.t, lastSync) > 20 * 60000) { pending.push({ type: 'sync' }); scheduleCommit(50); }
    candCheck();
  }
  renderAll(); refreshScene();
}

/* ---------- orientation : paysage par défaut ---------- */
let orient = ['land', 'land2', 'port'].includes(LS.get('mk2.orient')) ? LS.get('mk2.orient') : 'land';
function applyOrientation() {
  const W = window.innerWidth, H = window.innerHeight, app = $('#app');
  let rot = 0;
  if (H > W && orient !== 'port') rot = orient === 'land2' ? -90 : 90;
  document.documentElement.classList.toggle('land', W >= H || rot !== 0);
  if (rot) {
    Object.assign(app.style, { width: H + 'px', height: W + 'px', transformOrigin: 'top left', transform: rot === 90 ? 'rotate(90deg) translateY(-100%)' : 'rotate(-90deg) translateX(-100%)' });
    if (gl) V3.setPointerMap(rot === 90 ? (cx, cy) => [cy, W - cx] : (cx, cy) => [H - cy, cx]);
  } else {
    Object.assign(app.style, { width: '', height: '', transform: '', transformOrigin: '' });
    if (gl) V3.setPointerMap(null);
  }
  if (gl) { V3.resize(); if (applyOrientation.rot !== rot) V3.resetCamera(); }
  applyOrientation.rot = rot;
  if (rot && !LS.get('mk2.orientHint')) { LS.set('mk2.orientHint', 1); setTimeout(() => toast('Tourne ton téléphone à l’horizontale. Image à l’envers ? Menu Village, Affichage.'), 600); }
}
window.addEventListener('resize', applyOrientation);
window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 200));

/* ---------- démarrage : connexion, village commun ---------- */
const LOGIN_ERR = {
  'auth/unauthorized-domain': 'Ce site n’est pas encore autorisé dans Firebase (Authentication, Paramètres, Domaines autorisés).',
  'auth/operation-not-allowed': 'La connexion Google n’est pas encore activée dans Firebase.',
  'auth/network-request-failed': 'Pas de connexion internet. Réessaie dans un instant.',
  'auth/popup-closed-by-user': '', 'auth/cancelled-popup-request': '', 'auth/user-cancelled': '',
};
const loginMsg = e => { const c = e && e.code; return c in LOGIN_ERR ? LOGIN_ERR[c] : 'La connexion a échoué' + (c ? ' (' + c + ')' : '') + '. Réessaie.'; };
const newId = () => 'v' + Array.from({ length: 18 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
async function doLogin() {
  if (!modal || modal.kind !== 'login' || modal.busy) return;
  modal.busy = true; modal.err = ''; renderAll();
  try {
    const user = await FB.login();
    if (!user) return; /* redirection vers Google en cours */
    modal = null; start(user);
  } catch (e) { modal = { kind: 'login', err: loginMsg(e) }; renderAll(); }
}
async function start(user) {
  fbUser = { uid: user.uid, name: user.displayName || '' }; uid = user.uid;
  const o = FB.open(user); db = o.db; presence = o.presence;
  mode = 'loading'; renderAll();
  const guard = setTimeout(() => { if (mode === 'loading' && !modal) { modal = { kind: 'dberr' }; renderAll(); } }, 20000);
  try {
    const s = await db.doc(ROOT + 'users/' + uid).get();
    const u = s.exists ? s.data() : null;
    if (u && u.vid && (!joinVid || joinVid === u.vid)) { watchVillage(u.vid); clearTimeout(guard); return; }
    if (u && u.vid && joinVid && joinVid !== u.vid) toast('Tu as déjà un village : le lien d’invitation est ignoré.');
    if (u && u.vid) { watchVillage(u.vid); clearTimeout(guard); return; }
    clearTimeout(guard);
    if (joinVid) {
      const sj = await db.doc(ROOT + 'invites/' + joinVid).get();
      joinInfo = sj.exists ? sj.data() : null;
      if (joinInfo) { setMode('join'); return; }
      toast('Ce lien d’invitation ne marche pas : demande-en un nouveau.');
    }
    setMode('gate');
  } catch (e) { clearTimeout(guard); modal = { kind: 'dberr' }; renderAll(); }
}
function watchVillage(id) {
  vid = id; vref = db.doc(ROOT + 'villages/' + id);
  if (unsubV) unsubV(); if (unsubP) unsubP();
  unsubV = vref.onSnapshot(onVillage, err => {
    if (err && err.code === 'not_granted') { modal = { kind: 'denied' }; renderAll(); }
    else setTimeout(() => { if (vid === id) watchVillage(id); }, 3000);
  });
  presence.set(id, { name: myName() });
  unsubP = presence.watch(id, val => { online = val || {}; renderAll(); });
  if (/[?&]join=/.test(location.search)) history.replaceState(null, '', location.pathname);
}
async function foundVillage(vname, col, pname) {
  if (busy) return;
  busy = true; renderAll();
  try {
    const id = newId(), t = now();
    const v = newVillage(id, vname, col, t, uid, pname);
    await db.doc(ROOT + 'villages/' + id).set(v);
    await db.doc(ROOT + 'invites/' + id).set({ name: vname, by: pname, t });
    await db.doc(ROOT + 'users/' + uid).set({ vid: id });
    LS.set('mk2.log.' + id, t);
    watchVillage(id);
  } catch (e) { formErr('#fErr', e && e.code === 'not_granted' ? 'Le serveur refuse : les règles de la base ne sont pas encore à jour.' : 'La fondation a échoué. Réessaie.'); }
  busy = false; renderAll();
}
async function joinVillage(pname) {
  if (busy || !joinVid) return;
  busy = true; renderAll();
  try {
    await db.doc(ROOT + 'villages/' + joinVid + '/members/' + uid).set({ name: pname, t: now() });
    await db.doc(ROOT + 'users/' + uid).set({ vid: joinVid });
    LS.set('mk2.log.' + joinVid, now());
    needJoinLog = true;
    watchVillage(joinVid);
  } catch (e) { formErr('#jErr', e && e.code === 'not_granted' ? 'Impossible de rejoindre : ce village a peut-être déjà ses deux habitants.' : 'Ça n’a pas marché. Réessaie.'); }
  busy = false; renderAll();
}
if (window.MK_TEST) window.__mk = { get me() { return me; }, get mode() { return mode; }, get vid() { return vid; }, toScreen: (x, z) => gl ? V3.toScreen(x, z) : null, act: (a, o) => act(a, o), fx: () => gl ? V3._fx() : null, simAt: T => vraw ? JSON.stringify(simulateVillage(clone(vraw), T)) : null, now: () => now(), get busy() { return pending.length + (committing ? 1 : 0); } };
async function boot() {
  const cv = $('#gl');
  gl = typeof THREE !== 'undefined' && V3.init(cv);
  if (gl) V3.onTap(onTap);
  applyOrientation();
  if (gl) {
    V3.resetCamera();
    modelLoad = { d: 0, n: 1 };
    V3.loadModels('../models/', (d, n) => { modelLoad = { d, n }; renderTop(); }, 'models/')
      .then(okM => { modelLoad = null; if (okM) refreshScene(); else toast('Les modèles 3D n’ont pas pu se charger : affichage simplifié.'); renderAll(); });
  }
  refreshScene(); renderAll();
  if (!gl) { modal = { kind: 'nogl' }; renderAll(); }
  setInterval(tick, 1000);
  joinVid = new URLSearchParams(location.search).get('join');
  if (!FB.available()) { modal = { kind: 'dberr' }; renderAll(); return; }
  let user = null;
  try { user = await FB.start(); } catch (e) { FB.lastError = e; }
  if (user) { start(user); return; }
  mode = 'login'; modal = { kind: 'login', err: FB.lastError ? loginMsg(FB.lastError) : '' }; renderAll();
}
boot();

})();
