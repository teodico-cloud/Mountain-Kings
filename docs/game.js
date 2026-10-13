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
  /* Héros : un dossier par héros (h12…), avec son propriétaire. L'ancien format (un héros par joueur, rangé sous son uid) est converti. */
  const H = {};
  for (const [k, h0] of Object.entries(fbObj(v.heroes))) {
    if (!h0 || typeof h0 !== 'object') continue;
    const old = !h0.own, id = old ? 'h_' + k : (h0.id || k);
    const eq = {}; for (const [sl, x] of Object.entries(fbObj(h0.eq))) { const it = fbItem(x); if (it && it.sl === sl) eq[sl] = it; }
    const h = Object.assign({ lvl: 1, xp: 0, sp: 0, spec: null, at: null, n: 0, dj: 1, deep: 0 }, h0, { id, own: old ? k : h0.own, sk: Object.assign({}, h0.sk), eq });
    H[id] = h;
    if (old && v.members[k] && !v.members[k].hero) v.members[k].hero = id;
  }
  v.heroes = H;
  v.r = Object.assign({ orge: 0, biere: 0, fer: 0, or: 0 }, v.r);
  /* Équipement : le sac de chaque joueur (objets et pierres), le marchand ambulant */
  const B = {};
  for (const [k, b0] of Object.entries(fbObj(v.bag))) {
    if (!b0 || typeof b0 !== 'object') continue;
    const it = {}; for (const [id, x] of Object.entries(fbObj(b0.it))) { const o = fbItem(x); if (o) { o.id = id; it[id] = o; } }
    B[k] = { it, gm: Object.assign({}, fbObj(b0.gm)), n: b0.n || 1 };
  }
  v.bag = B;
  if (v.merch && typeof v.merch === 'object') v.merch = { d: v.merch.d | 0, it: fbArr(v.merch.it).map(fbItem).filter(Boolean), gm: fbArr(v.merch.gm), sold: String(v.merch.sold || '') };
  else delete v.merch;
  /* Raids (étape 4) : portails ouverts, dernier raid (gardé pour la rediffusion) */
  if (v.raid && typeof v.raid === 'object') {
    if (v.raid.p) { v.raid.p = fbArr(v.raid.p).map(fbArr); v.raid.cl = fbArr(v.raid.cl); while (v.raid.cl.length < v.raid.p.length) v.raid.cl.push(0); }
  } else delete v.raid;
  if (v.lastRaid && typeof v.lastRaid === 'object') {
    const L = v.lastRaid;
    for (const k of ['P', 'B', 'H', 'F']) L[k] = fbArr(L[k]).map(fbArr);
    L.R = Object.assign({}, fbObj(L.R));
    L.res = Object.assign({ k: 0, e: 0, f: 0, h: 0, g: 0, xp: 0, br: 0, s: 0 }, fbObj(L.res));
    L.res.lost = Object.assign({}, fbObj(L.res.lost)); L.res.back = Object.assign({}, fbObj(L.res.back));
    L.res.ko = fbArr(L.res.ko); L.res.dmg = fbArr(L.res.dmg).map(fbArr);
    if (L.G) L.G = fbArr(L.G).map(fbArr); else delete L.G;
    if (L.res.gd) L.res.gd = fbArr(L.res.gd).map(fbArr);
    if (L.orbs) L.orbs = fbArr(L.orbs); else delete L.orbs;
  } else delete v.lastRaid;
  /* Garnison (étape 4b) : soldats (communs), orbes et bannières en réserve */
  const S = {};
  for (const [k, s0] of Object.entries(fbObj(v.sol))) {
    if (!s0 || typeof s0 !== 'object' || !s0.type) continue;
    const s = Object.assign({ n: 0, num: 1, lvl: 1, xp: 0, post: 0, hurt: 0, vet: 0, raids: 0, kills: 0, race: 'humain', sex: 'm' }, s0, { id: s0.id || k, o: Object.assign({}, fbObj(s0.o)) });
    for (const it of ['w', 'a']) if (!s[it] || typeof s[it] !== 'object') delete s[it];
    S[s.id] = s;
  }
  if (Object.keys(S).length) v.sol = S; else delete v.sol;
  if (v.orbs && typeof v.orbs === 'object') v.orbs = Object.assign({}, v.orbs); else delete v.orbs;
  const BN = {};
  for (const [k, b0] of Object.entries(fbObj(v.bans))) if (b0 && typeof b0 === 'object' && b0.k) BN[b0.id || k] = Object.assign({}, b0, { id: b0.id || k });
  if (Object.keys(BN).length) v.bans = BN; else delete v.bans;
  /* L'histoire (lot A) : Lilou, son humeur et ses caprices */
  if (v.lilou && typeof v.lilou === 'object') {
    const L = v.lilou, cap = c => c && typeof c === 'object' && c.k ? { n: c.n | 0, k: String(c.k), ok: c.ok ? 1 : 0 } : null;
    v.lilou = { at: +L.at || 0, by: String(L.by || ''), mood: Math.max(0, Math.min(100, L.mood == null ? 60 : +L.mood || 0)), party: +L.party || 0, nd: L.nd | 0, nw: L.nw | 0 };
    if (cap(L.d)) v.lilou.d = cap(L.d);
    if (cap(L.w)) v.lilou.w = cap(L.w);
  } else delete v.lilou;
  /* La Couronne de la Montagne (lot B) et la chronique du village */
  if (v.crown && typeof v.crown === 'object') {
    const C = v.crown;
    v.crown = { cy: Math.max(1, C.cy | 0), got: (C.got | 0) & 15, rank: Math.max(0, C.rank | 0), at: +C.at || 0, nl: +C.nl || 0, ln: Math.max(0, C.ln | 0) };
    if (C.lc && typeof C.lc === 'object') v.crown.lc = { g: C.lc.g | 0, o: String(C.lc.o || ''), r: C.lc.r | 0 };
  } else delete v.crown;
  if (v.chron) { v.chron = fbArr(v.chron).map(fbArr).filter(e => e.length >= 3).map(e => [+e[0] || 0, String(e[1]), String(e[2])]); if (!v.chron.length) delete v.chron; }
  else delete v.chron;
  return v;
}
const fbItem = x => x && typeof x === 'object' && x.sl ? Object.assign({}, x, { gm: Object.assign({}, fbObj(x.gm)) }) : null;
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
    /* Effacé par le serveur si ce téléphone perd la connexion (partie à deux interrompue). */
    onDisconnectRemove: () => { try { rdb.ref(path).onDisconnect().remove(); } catch (e) { /* rien */ } },
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
const RES = ['bois', 'pierre', 'ble', 'farine', 'pain', 'viande', 'orge', 'biere', 'fer', 'or'];
const RES_LABEL = { bois: 'Bois', pierre: 'Pierre', ble: 'Blé', farine: 'Farine', pain: 'Pain', viande: 'Viande', orge: 'Orge', biere: 'Bière', fer: 'Fer', or: 'Or' };
const NO_CAP = new Set(['or']);       // l'or (la bourse commune) n'a pas de limite de place
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
    skills: [['Saut arrière', 'Saute en arrière en tirant.'], ['Pluie de flèches', 'Blesse tout dans une zone.'], ['Tir perçant', 'Une flèche qui traverse une ligne d’ennemis.']],
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
const heroXpNeed = lvl => Math.round(200 * Math.pow(lvl, 1.8));       // expérience pour passer au niveau suivant (niveau 10 : environ 3 semaines de jeu assidu)
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
  halle: { name: 'Halle du village', size: 3, max: 5, cost: { bois: 300, pierre: 200 }, mul: 2, work: 240, cat: 'vie', desc: 'Le cœur du village. L’agrandir débloque des bâtiments, des niveaux et plus de bâtisseurs.' },
  maison: { name: 'Maison', size: 2, max: 3, cost: { bois: 60, pierre: 20 }, mul: 1.8, work: 40, house: 3, cat: 'hab', desc: 'Loge 3 villageois, un de plus par niveau.' },
  bucheron: { name: 'Cabane de bûcheron', size: 2, max: 3, cost: { bois: 40 }, mul: 2, work: 30, spec: 'buch', jobs: 2, out: { bois: 14 }, job: 'Bûcheron', cat: 'prod', desc: 'Les bûcherons y coupent le bois de la forêt.' },
  carriere: { name: 'Carrière', size: 2, max: 3, cost: { bois: 60 }, mul: 2, work: 40, spec: 'mine', jobs: 2, out: { pierre: 10 }, job: 'Carrier', cat: 'prod', desc: 'On y taille la pierre de la montagne.' },
  champ: { name: 'Champ', size: 2, max: 3, cost: { bois: 30 }, mul: 2, work: 20, spec: 'agri', jobs: 2, out: { ble: 16 }, seasonal: 'champ', job: 'Fermier', cat: 'prod', desc: 'Donne du blé ou de l’orge (au choix), surtout en été et en automne. Rien en hiver.' },
  moulin: { name: 'Moulin', size: 2, max: 3, cost: { bois: 80, pierre: 40 }, mul: 2, work: 80, spec: 'arti', jobs: 1, inp: { ble: 12 }, out: { farine: 12 }, job: 'Meunier', hall: 2, cat: 'prod', desc: 'Moud le blé en farine.' },
  boulangerie: { name: 'Boulangerie', size: 2, max: 3, cost: { bois: 80, pierre: 60 }, mul: 2, work: 90, spec: 'arti', jobs: 1, inp: { farine: 10 }, out: { pain: 14 }, job: 'Boulanger', hall: 2, cat: 'prod', desc: 'Cuit la farine en pain, la meilleure nourriture du village.' },
  brasserie: { name: 'Brasserie', size: 2, max: 3, cost: { bois: 90, pierre: 50 }, mul: 2, work: 90, spec: 'arti', jobs: 1, inp: { orge: 8 }, out: { biere: 6 }, job: 'Brasseur', hall: 2, cat: 'prod', desc: 'Brasse l’orge en bière. Servie à la taverne, elle remonte le moral.' },
  chasse: { name: 'Pavillon de chasse', size: 2, max: 3, cost: { bois: 50 }, mul: 2, work: 40, spec: 'chasse', jobs: 2, out: { viande: 7 }, seasonal: 'chasse', job: 'Chasseur', cat: 'prod', desc: 'Les chasseurs rapportent de la viande, un peu moins en hiver.' },
  entrepot: { name: 'Entrepôt', size: 2, max: 3, cost: { bois: 100, pierre: 40 }, mul: 2, work: 60, store: 700, cat: 'stock', desc: '+700 de place par niveau, pour chaque ressource.' },
  mine: { name: 'Mine de fer', size: 2, max: 3, cost: { bois: 80, pierre: 60 }, mul: 2, work: 70, spec: 'mine', jobs: 2, out: { fer: 6 }, job: 'Mineur', hall: 2, cat: 'prod', desc: 'Les mineurs y extraient le fer, pour la forge. Les nains y excellent.' },
  forge: { name: 'Forge', size: 2, max: 3, cost: { bois: 120, pierre: 90 }, mul: 2, work: 100, hall: 2, cat: 'heros', desc: 'Fabrique, améliore et fond l’équipement des héros, et sertit les pierres précieuses. Chaque niveau : de meilleurs objets, des améliorations plus poussées et 10 places de plus dans chaque sac.' },
  taverne: { name: 'Taverne', size: 3, max: 3, cost: { bois: 150, pierre: 80 }, mul: 2.2, work: 120, mor: 10, hall: 2, cat: 'vie', desc: 'Remonte le moral, attire de nouveaux villageois, et c’est là qu’on fait la fête.' },
  banc: { name: 'Banc', size: 1, max: 1, cost: { bois: 20 }, work: 5, deco: 1, cat: 'deco', desc: 'Un peu de confort : +1 de moral.' },
  fleurs: { name: 'Parterre de fleurs', size: 1, max: 1, cost: { bois: 10, pierre: 5 }, work: 5, deco: 1, cat: 'deco', desc: 'Égaie le village : +1 de moral.' },
  fontaine: { name: 'Fontaine', size: 2, max: 1, cost: { pierre: 120 }, work: 60, deco: 4, hall: 2, cat: 'deco', desc: 'La fierté du village : +4 de moral.' },
  statue: { name: 'Statue', size: 1, max: 1, cost: { pierre: 80, bois: 20 }, work: 40, deco: 3, hall: 3, cat: 'deco', desc: 'Statue d’un héros de légende : +3 de moral.' },
  /* Défense (étape 4) : palissades, portes et pièges se posent et s'améliorent tout de suite (inst) ; la tour se construit.
     hps : solidité par niveau (les dégâts des raids restent jusqu'à la réparation ; 0 = détruit, en ruine). */
  rempart: { name: 'Palissade', size: 1, max: 3, costs: [{ bois: 8 }, { pierre: 14 }, { pierre: 20, fer: 5 }], hps: [200, 500, 1000], inst: 1, def: 'wall', lvlNames: ['Palissade de bois', 'Mur de pierre', 'Mur renforcé'], cat: 'def', desc: 'Bloque les ennemis : ils doivent la contourner ou la casser. Se pose en ligne, tout de suite.' },
  porte: { name: 'Porte', size: 1, max: 3, costs: [{ bois: 25 }, { bois: 20, pierre: 25 }, { pierre: 30, fer: 10 }], hps: [150, 380, 760], inst: 1, def: 'gate', lvlNames: ['Porte de bois', 'Porte cloutée', 'Porte de fer'], cat: 'def', desc: 'Dans une palissade : vos héros et vos villageois passent, les ennemis non. Moins solide qu’un mur, alors les ennemis s’y attaquent souvent.' },
  tour: { name: 'Tour d’archers', size: 2, max: 3, cost: { bois: 120, pierre: 90 }, mul: 2, work: 90, hps: [700, 1200, 1900], def: 'tower', tw: { range: [5.5, 6, 6.5], dmg: [14, 22, 34], rate: 1.2 }, cat: 'def', desc: 'Ses archers tirent sur les ennemis à portée pendant les raids.' },
  piege: { name: 'Piège à pointes', size: 1, max: 3, costs: [{ bois: 25, pierre: 10 }, { pierre: 20, fer: 10 }, { pierre: 30, fer: 20 }], inst: 1, def: 'trap', trap: { dmg: [45, 75, 120], uses: [3, 3, 3] }, cat: 'def', desc: 'Caché dans le sol : blesse les ennemis qui marchent dessus (3 fois par raid). On marche dessus sans risque.' },
  filet: { name: 'Filet', size: 1, max: 2, costs: [{ bois: 30 }, { bois: 30, fer: 8 }], inst: 1, def: 'trap', trap: { root: [3, 4.5], uses: [1, 2] }, cat: 'def', desc: 'Caché dans le sol : immobilise quelques secondes l’ennemi qui marche dessus (les trolls s’en défont deux fois plus vite).' },
  /* Garnison (étape 4b, p2g_garnison.js) : la caserne loge les soldats (3 par niveau) ; chaque poste de garde (1 par niveau de caserne)
     garde un cercle (zone : rayon en cases selon son niveau). On marche à travers un poste (ennemis compris). */
  caserne: { name: 'Caserne', size: 2, max: 4, cost: { bois: 140, pierre: 100 }, mul: 2, work: 100, hall: 2, cat: 'def', desc: 'Loge les soldats de la garnison : 3 par niveau (12 au plus), et un poste de garde de plus par niveau. On y recrute des soldats contre de l’or.' },
  /* L'histoire (lot A) : offerte au retour de la mission « La Source du Mal », pas dans la liste des constructions */
  chambre: { name: 'Chambre de Lilou', size: 2, max: 1, cost: {}, work: 1, inst: 1, cat: 'vie', story: 1, desc: 'Le berceau de Lilou, avec Sukhoï qui dort à côté. On y voit son humeur et ses caprices.' },
  poste: { name: 'Poste de garde', size: 1, max: 3, costs: [{ bois: 30, pierre: 10 }, { bois: 30, pierre: 40 }, { pierre: 60, fer: 15 }], inst: 1, def: 'post', zone: [3, 4, 5], lvlNames: ['Poste de garde', 'Poste fortifié', 'Bastion'], cat: 'def', desc: 'Ses soldats (6 au plus) gardent un cercle autour de lui pendant les raids, sans jamais en sortir. L’améliorer agrandit le cercle.' },
  marchand:{ name: 'Marchand ambulant', size: 1, max: 1, cost: {}, work: 0, cat: 'aucun', desc: 'Sa charrette, les jours où il est là.' },   // pas à construire : juste pour l'afficher
};
const SHOP = ['maison', 'bucheron', 'carriere', 'mine', 'champ', 'chasse', 'moulin', 'boulangerie', 'brasserie', 'entrepot', 'taverne', 'forge', 'rempart', 'porte', 'tour', 'piege', 'filet', 'caserne', 'poste', 'banc', 'fleurs', 'fontaine', 'statue'];
const CATS = [['hab', 'Habitations'], ['prod', 'Production'], ['stock', 'Réserves'], ['vie', 'Vie du village'], ['heros', 'Pour les héros'], ['def', 'Défense'], ['deco', 'Décorations']];
const LIMITS = {
  halle: [1, 1, 1, 1, 1],
  maison: [3, 5, 7, 9, 12], bucheron: [1, 2, 2, 3, 3], carriere: [1, 1, 2, 2, 3], champ: [2, 3, 4, 5, 6],
  moulin: [0, 1, 1, 2, 2], boulangerie: [0, 1, 1, 2, 2], brasserie: [0, 1, 1, 1, 2], chasse: [1, 1, 2, 2, 3], entrepot: [1, 1, 2, 2, 3],
  taverne: [0, 1, 1, 1, 1], mine: [0, 1, 1, 2, 2], forge: [0, 1, 1, 1, 1], banc: [2, 4, 6, 8, 10], fleurs: [4, 8, 12, 16, 20], fontaine: [0, 1, 1, 2, 2], statue: [0, 0, 1, 2, 3],
  rempart: [24, 40, 56, 72, 90], porte: [2, 3, 4, 5, 6], tour: [1, 2, 3, 4, 5], piege: [2, 4, 6, 8, 10], filet: [1, 2, 3, 4, 5],
  caserne: [0, 1, 1, 1, 1], poste: [4, 4, 4, 4, 4], chambre: [1, 1, 1, 1, 1],     // postes : en fait 1 par niveau de caserne (limitV)
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
function costOf(type, toLvl) {
  const d = BLD[type], c = {};
  if (d.costs) return Object.assign(c, d.costs[Math.max(1, Math.min(d.costs.length, toLvl | 0)) - 1]);   // défenses : un prix par niveau
  let m = 1; for (let i = 1; i < toLvl; i++) m *= d.mul || 2; for (const k in d.cost) c[k] = Math.round(d.cost[k] * m / 5) * 5; return c;
}
/* Solidité des défenses (palissade, porte, tour) : b.hp absent = intacte, 0 = détruite (en ruine, ne bloque plus rien). */
const hpMaxOf = b => { const d = BLD[b.type]; return d && d.hps ? d.hps[Math.max(1, Math.min(d.hps.length, b.lvl | 0)) - 1] : 0; };
const hpOf = b => b.hp == null ? hpMaxOf(b) : b.hp;
const isBroken = b => !!(BLD[b.type] && BLD[b.type].hps) && b.hp === 0;
/* Réparer coûte une part du prix, selon les dégâts (palissades, portes : 60 % du prix du niveau pour une ruine ; tour : 30 %). */
function repairCostOf(b) {
  const d = BLD[b.type], mx = hpMaxOf(b); if (!mx || b.hp == null || b.hp >= mx || b.lvl < 1) return null;
  const f = (1 - b.hp / mx) * (d.inst ? 0.6 : 0.3), c = costOf(b.type, b.lvl), out = {};
  for (const k in c) { const n = Math.ceil(c[k] * f); if (n > 0) out[k] = n; }
  return out;
}
const lvlName = b => { const d = BLD[b.type]; return d.lvlNames ? d.lvlNames[Math.max(1, Math.min(d.lvlNames.length, b.lvl | 0)) - 1] : d.name; };
function workOf(type, toLvl) { let m = 1; for (let i = 1; i < toLvl; i++) m *= 2; return Math.round(BLD[type].work * m); }
const hallLvl = v => { const h = v.b.find(b => b.type === 'halle'); return h ? Math.max(1, h.lvl) : 1; };
const maxLvlOf = (type, hl) => type === 'halle' ? BLD.halle.max : Math.min(BLD[type].max, hl + 1);
const limitOf = (type, hl) => LIMITS[type][Math.max(1, Math.min(5, hl)) - 1];
const countOf = (v, type) => v.b.filter(b => b.type === type).length;
/* Combien on peut en avoir dans ce village : selon la halle, sauf les postes de garde (un par niveau de caserne). */
const limitV = (v, type) => type === 'poste' ? postCap(v) : limitOf(type, hallLvl(v));
const limitWhy = (v, type) => type === 'poste' ? (caserneLvl(v) ? 'Plus de poste possible : agrandissez la caserne.' : 'Il faut d’abord construire la caserne.') : 'Nombre maximum atteint : agrandissez la halle pour en construire plus.';
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
  /* plus que ce que les réserves peuvent garder : il faut d'abord de la place (un entrepôt) */
  const cap = capOf(v), big = miss.filter(k => !NO_CAP.has(k) && c[k] > cap);
  if (big.length) return 'Réserves trop petites : il faut pouvoir garder ' + big.map(k => c[k] + ' de ' + RES_LABEL[k].toLowerCase()).join(' et ') + ' (construisez ou agrandissez un entrepôt).';
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
  if (v.raidMor > t) out.push(['Halle pillée par les gobelins', -10]);
  if (v.lilou && v.lilou.party > t) out.push(['Fête pour Lilou', LILOU.party]);
  if (v.crown && v.crown.rank) out.push(['Couronne de la Montagne', Math.min(10, v.crown.rank)]);
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
  { id: 'mine', name: 'Le fer', txt: 'Construire une mine de fer.', prog: v => [built(v, 'mine'), 1], rew: { bois: 80, pierre: 60 } },
  { id: 'forge', name: 'La forge', txt: 'Construire la forge, pour équiper vos héros.', prog: v => [built(v, 'forge'), 1], rew: { fer: 60, or: 50 } },
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
const DJ_END_THEMES = ['mine', 'crypte', 'prof', 'portail', 'source'];     // donjons reconnus au retour (portail : fermer un portail démoniaque ; source : la mission d'intro)
/* Expérience gagnée (donjon ou défense du village) : niveaux et points de compétence. Renvoie le nombre de niveaux gagnés. */
function heroAddXp(hh, xp) {
  const lv0 = hh.lvl;
  hh.xp = (hh.xp || 0) + Math.max(0, Math.round(xp));
  while (hh.lvl < HERO_MAX_LVL && hh.xp >= heroXpNeed(hh.lvl)) { hh.xp -= heroXpNeed(hh.lvl); hh.lvl++; hh.sp = (hh.sp || 0) + (hh.lvl === 9 ? 2 : 1); }
  if (hh.lvl >= HERO_MAX_LVL) hh.xp = Math.min(hh.xp, heroXpNeed(hh.lvl));
  return hh.lvl - lv0;
}
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
    r: { bois: 160, pierre: 80, ble: 0, farine: 0, pain: 60, viande: 40, orge: 0, biere: 0, fer: 0, or: 0 },
    b: [], vil: [], cands: [], log: [], hunger: 0, feast: 0, feastCd: 0, ws: seasonIdx({ born: t }, t),
    goals: [], cnt: { acc: 0, fete: 0, win: 0 }, wok: 0,
    here: t, raid: { n: 0, next: t + RAID_FIRST },        // premier portail au début du 3e jour
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
  v.chron = [[t, 'found', pname + ' fonde le village de ' + name + '.']];
  return v;
}

/* ---------- simulation, minute par minute (identique sur les deux téléphones) ---------- */
function stepVillage(v) {
  const t = v.t, h = 1 / 60, cap = capOf(v), si = seasonIdx(v, t), S = SEASONS[si];
  const mor = moraleOf(v, t), mf = moraleF(mor);
  const add = (k, n) => { v.r[k] = NO_CAP.has(k) ? (v.r[k] || 0) + n : Math.min(Math.max(cap, v.r[k] || 0), (v.r[k] || 0) + n); };
  /* Portails démoniaques et raids (p2r_raid.js) : le portail s'ouvre, se charge, puis le raid vient quand les deux joueurs sont absents. */
  raidTick(v);
  /* Lilou (l'histoire, p2s_histoire.js) : un caprice par jour, un gros par semaine ; puis la quête de la couronne et les lettres du Roi Déchu */
  lilouTick(v);
  crownTick(v);
  /* Le marchand ambulant : un jour sur deux, il s'installe sur la place avec quelques objets */
  const md = merchDay(v, t);
  if (md % 2 === 1 && (!v.merch || v.merch.d !== md)) { v.merch = genMerch(v, md); addLog(v, t, 'Un marchand ambulant s’installe sur la place du village, jusqu’à demain.', 'merch'); }
  /* Saison qui change */
  if (si !== v.ws) {
    const prev = v.ws, warm = prev === 3 && si === 0 && v.wok;
    v.ws = si;
    if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 };
    if (warm) { v.cnt.win = (v.cnt.win || 0) + 1; chron(v, t, 'win', v.cnt.win > 1 ? v.cnt.win + 'e hiver passé sans famine.' : 'Premier hiver passé sans famine.'); }
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
        b.lvl = b.up.to; b.up = null; if (BLD[b.type].hps) delete b.hp;   // une tour agrandie est aussi remise à neuf
        addLog(v, t, (b.lvl > 1 ? BLD[b.type].name + ' agrandi(e) au niveau ' + b.lvl : BLD[b.type].name + ' terminé(e)') + '.', 'built');
        if (b.type === 'halle' && b.lvl > 1) chron(v, t, 'hall', 'La halle passe au niveau ' + b.lvl + '.');
        else if (b.lvl === 1 && (b.type === 'taverne' || b.type === 'forge' || b.type === 'caserne')) chron(v, t, 'hall', 'Le village a sa ' + BLD[b.type].name.toLowerCase() + '.');
      }
    }
  }
  /* Repas : moitié pain, moitié viande quand c'est possible (les soldats de la garnison mangent aussi, un peu plus à chaque niveau) */
  let eat = 0; for (const p of v.vil) eat += EAT_DAY * ((TRAITS[p.tr] || {}).eat || 1);
  if (v.sol) eat += solFood(v);
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
  if (v.sol) eat += solFood(v) / 24;
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
  /* Dernière présence d'un joueur (toute action, même la simple mise à jour de l'heure) : les raids attendent 2 h d'absence des deux. */
  if (v.members[who.uid]) v.here = t;
  switch (a.type) {
    case 'sync': return { ok: true };            // simple mise à jour de l'heure du village
    case 'join': {
      /* Le second joueur s'est inscrit lui-même dans members : on l'annonce une seule fois. */
      const m = v.members[who.uid]; if (!m) return fail('Tu ne fais pas partie de ce village.');
      if (m.hi) return { ok: true };
      m.hi = 1;
      addLog(v, t, m.name + ' rejoint le village.', 'join');
      chron(v, t, 'join', m.name + ' rejoint le village.');
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
      if (!mine.length) chron(v, t, 'hero', name + ', ' + raceName(a.race, sex).toLowerCase() + ' ' + className(a.cls, sex).toLowerCase() + ', devient le héros de ' + nm + '.');
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
      if (d.story && !v.lilou) return fail('Lilou n’est pas encore au village.');
      if ((d.hall || 1) > hl) return fail('Il faut une halle du village de niveau ' + d.hall + '.');
      if (countOf(v, a.b) >= limitV(v, a.b)) return fail(limitWhy(v, a.b));
      if (!fits(v, a.b, a.gx, a.gz)) return fail('Emplacement occupé ou trop près du bord.');
      const c = costOf(a.b, 1), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      /* Palissade, porte, piège : posés tout de suite. Le reste : un chantier pour les bâtisseurs. */
      if (d.inst) { const b = { id: v.nid++, type: a.b, lvl: 1, gx: a.gx, gz: a.gz, up: null }; v.b.push(b); return { ok: true, id: b.id, inst: true }; }
      const b = { id: v.nid++, type: a.b, lvl: 0, gx: a.gx, gz: a.gz, up: { to: 1, need: workOf(a.b, 1), done: 0, q: ++v.q } };
      if (a.b === 'champ') b.crop = a.crop === 'orge' ? 'orge' : 'ble';
      v.b.push(b);
      addLog(v, t, nm + ' lance un chantier : ' + d.name.toLowerCase() + '.', 'site');
      return { ok: true, id: b.id };
    }
    case 'walls': {
      /* Une ou plusieurs cases de palissade d'un coup (toute une ligne), posées tout de suite, tant qu'il y a de quoi payer. */
      const tiles = Array.isArray(a.tiles) ? a.tiles.slice(0, 40) : [];
      let n = 0, why = '';
      for (const tl of tiles) {
        const gx = tl && tl[0], gz = tl && tl[1];
        if (countOf(v, 'rempart') >= limitOf('rempart', hl)) { why = why || 'Plus de palissade possible : agrandissez la halle.'; break; }
        if (!fits(v, 'rempart', gx, gz)) { why = why || 'Case occupée ou trop près du bord.'; continue; }
        const c = costOf('rempart', 1), m = missingTxt(v, c); if (m) { why = why || m; break; }
        pay(v, c); v.b.push({ id: v.nid++, type: 'rempart', lvl: 1, gx, gz, up: null }); n++;
      }
      if (!n) return fail(why || 'Aucune palissade posée.');
      return { ok: true, n, why };
    }
    case 'gate': {
      /* Une palissade devient une porte (niveau 1) : les héros et les villageois passent, pas les ennemis. */
      const b = v.b.find(x => x.id === a.id); if (!b || b.type !== 'rempart') return fail('Choisis une palissade.');
      if (countOf(v, 'porte') >= limitOf('porte', hl)) return fail('Plus de porte possible : agrandissez la halle.');
      const c = costOf('porte', 1), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); b.type = 'porte'; b.lvl = 1; delete b.hp;
      return { ok: true };
    }
    case 'upwalls': {
      /* Améliorer d'un coup toutes les défenses d'un type et d'un niveau (palissades, portes, pièges), tant qu'il y a de quoi payer. */
      const type = BLD[a.t] && BLD[a.t].inst ? a.t : 'rempart', L = a.lvl | 0, to = L + 1;
      if (to > maxLvlOf(type, hl)) return fail(to > BLD[type].max ? 'Niveau maximum atteint.' : 'Agrandissez d’abord la halle du village.');
      const c = costOf(type, to); let n = 0;
      for (const b of v.b) {
        if (b.type !== type || b.lvl !== L) continue;
        if (missingTxt(v, c)) break;
        pay(v, c); b.lvl = to; delete b.hp; n++;
      }
      if (!n) return fail(missingTxt(v, c) || 'Rien à améliorer à ce niveau.');
      addLog(v, t, nm + ' renforce les défenses : ' + n + ' × ' + lvlName({ type, lvl: to }).toLowerCase() + '.', 'def');
      return { ok: true, n };
    }
    case 'repair': {
      /* Réparer les défenses abîmées (les ruines d'abord), tant qu'il y a de quoi payer. */
      const list = v.b.filter(b => repairCostOf(b)).sort((x, y) => (x.hp === 0 ? 0 : 1) - (y.hp === 0 ? 0 : 1) || hpOf(x) / hpMaxOf(x) - hpOf(y) / hpMaxOf(y));
      if (!list.length) return fail('Rien à réparer.');
      let n = 0, why = '';
      for (const b of list) { const c = repairCostOf(b), m = missingTxt(v, c); if (m) { why = m; break; } pay(v, c); delete b.hp; n++; }
      if (!n) return fail(why);
      addLog(v, t, nm + ' fait réparer ' + n + ' défense' + (n > 1 ? 's' : '') + '.', 'def');
      return { ok: true, n, left: list.length - n, why };
    }
    case 'upgrade': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (b.up) return fail('Les travaux sont déjà en cours.');
      const to = b.lvl + 1, mx = maxLvlOf(b.type, hl);
      if (to > mx) return fail(to > BLD[b.type].max ? 'Niveau maximum atteint.' : 'Agrandissez d’abord la halle du village.');
      const c = costOf(b.type, to), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      if (BLD[b.type].inst) { b.lvl = to; delete b.hp; return { ok: true, inst: true }; }   // défenses : tout de suite (et réparées)
      b.up = { to, need: workOf(b.type, to), done: 0, q: ++v.q };
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
      if (b.type === 'chambre') return fail('On ne démolit pas la chambre de Lilou (on peut la déplacer).');
      if (houseOf(b) && housingOf(v) - houseOf(b) < v.vil.length) return fail('Des villageois y logent : il n’y aurait plus assez de place.');
      if (b.type === 'caserne' && solList(v).length) return fail('Des soldats y logent : renvoyez-les d’abord.');
      v.b = v.b.filter(x => x !== b);
      for (const p of v.vil) if (p.job === b.id) p.job = null;
      for (const hh of Object.values(v.heroes)) if (hh && hh.at === b.id) hh.at = null;
      /* un poste retiré : ses gardes n'ont plus de poste, sa bannière retourne dans la réserve */
      if (b.type === 'poste') { for (const s of solList(v)) if (s.post === b.id) s.post = 0; if (banOk(b.ban)) banAdd(v, b.ban.k, b.ban.r); }
      if (!BLD[b.type].inst) addLog(v, t, nm + ' démolit : ' + BLD[b.type].name.toLowerCase() + '.', 'demolish');   // une palissade retirée : pas de quoi le noter
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
      const L = Math.max(1, Math.min(99, a.lvl | 0)), win = !!a.win, th = DJ_END_THEMES.includes(a.theme) ? a.theme : 'mine', deep = Math.max(0, Math.min(200, a.deep | 0));
      let xp = Math.max(0, Math.min(DJ_XP_CAP(L) * (th === 'prof' ? 1 + deep : 1), Math.round(+a.xp || 0)));
      if (hh.race === 'humain') xp = Math.round(xp * 1.1);                 // Apprend vite
      const lv0 = hh.lvl, up = heroAddXp(hh, xp);
      if (up) chronLvl(v, t, hh, lv0);
      if (win && (th === 'mine' || th === 'crypte')) hh.dj = Math.max(hh.dj || 1, Math.min(99, L + 1));
      if (th === 'prof') {
        hh.deep = Math.max(hh.deep || 0, deep);
        const rec = cntOf(v, 'deep');                                  // record du village, pour la chronique (tous les 5 étages)
        if (deep >= 5 && Math.floor(deep / 5) > Math.floor(rec / 5)) chron(v, t, 'deep', hh.name + ' atteint l’étage ' + deep + ' des Profondeurs.');
        if (deep > rec) { if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 }; v.cnt.deep = deep; }
      }
      hh.runs = (hh.runs || 0) + 1; if (win) hh.wins = (hh.wins || 0) + 1;
      const cap = capOf(v), got = {};
      for (const k of ['bois', 'pierre', 'viande', 'pain', 'biere']) {
        const n = Math.max(0, Math.min(3000, Math.round(+((a.loot || {})[k]) || 0))); if (!n) continue;
        const before = v.r[k] || 0; v.r[k] = Math.min(Math.max(cap, before), before + n); got[k] = Math.round(v.r[k] - before);
        if (!got[k]) delete got[k];
      }
      const pris = a.pris ? prisonerOf(v, t) : null;
      if (pris) v.cands.push(pris);
      /* L'or va dans la bourse commune (à deux, c'est l'hôte qui le rapporte) ; les objets et les pierres, dans le sac du joueur. */
      const lm = 1 + 0.2 * (L - 1), gold = Math.max(0, Math.min(Math.round(600 * lm * (th === 'prof' ? 1 + deep : 1)), Math.round(+a.or || 0)));
      const bag = bagOf(v, who.uid), maxIl = L + 2 + (th === 'prof' ? Math.ceil(deep / 2) + 1 : 0);
      let nItems = 0, autoSold = 0, autoGold = 0;
      for (const x of (Array.isArray(a.items) ? a.items : []).slice(0, th === 'prof' ? 60 : 20)) {
        const it = cleanItem(x, maxIl); if (!it) continue;
        if (bagCount(bag) >= bagMax(v)) { autoSold++; autoGold += itemInfo(it).sell; continue; }
        bagAdd(v, who.uid, it); nItems++;
        if (it.r === 4) chron(v, t, 'leg', hh.name + ' trouve un objet légendaire : ' + itemInfo(it).name + '.');
      }
      for (const g in (a.gems && typeof a.gems === 'object' ? a.gems : {})) { const G = gemOf(g), n = Math.max(0, Math.min(10, a.gems[g] | 0)); if (G && n) bag.gm[G.key] = (bag.gm[G.key] || 0) + n; }
      if (gold + autoGold) v.r.or = (v.r.or || 0) + gold + autoGold;
      if (gold) got.or = gold;
      const fl = deep ? deep + ' étage' + (deep > 1 ? 's terminés' : ' terminé') : 'aucun étage terminé';
      const what = th === 'source' ? (win ? ' a percé le mystère de la Source du Mal' : ' a dû quitter la Source du Mal') : th === 'prof' ? (win ? ' remonte des Profondeurs (' : ' a dû fuir les Profondeurs (') + fl + ')'
        : th === 'portail' ? (win ? ' a vaincu le gardien du portail démoniaque' : ' a dû fuir le portail démoniaque') + ' (niveau ' + L + ')'
        : win ? ' revient vainqueur ' + (th === 'crypte' ? 'de la crypte des rois' : 'de la mine des gobelins') + ' (niveau ' + L + ')' : ' a dû fuir ' + (th === 'crypte' ? 'la crypte des rois' : 'la mine des gobelins') + ' (niveau ' + L + ')';
      addLog(v, t, hh.name + what + ' : +' + xp + ' d’expérience' + (Object.keys(got).length ? ', ' + rewTxt(got) : '') + (nItems ? ', ' + nItems + ' objet' + (nItems > 1 ? 's' : '') : '') + '.' + (up ? ' ' + hh.name + ' passe au niveau ' + hh.lvl + ' !' : '') + (autoSold ? ' Sac plein : ' + autoSold + ' objet' + (autoSold > 1 ? 's vendus' : ' vendu') + ' pour ' + autoGold + ' or.' : ''), 'dj');
      if (pris) addLog(v, t, pris.name + ' (' + raceName(pris.race, pris.sex).toLowerCase() + '), délivré' + (pris.sex === 'f' ? 'e' : '') + (th === 'crypte' ? ' d’un tombeau de la crypte' : th === 'portail' ? ' d’une cage du gardien du portail' : ' d’un cachot souterrain') + ', voudrait s’installer au village.', 'cand');
      /* Portail démoniaque vaincu : il se referme (s'il est encore ouvert) ; tous refermés = pas de raid cette fois. */
      const closed = th === 'portail' && win ? raidClosePortal(v, t, a.pi | 0, hh.name) : null;
      /* Pour la garnison (réserve commune) : orbes et bannières ; à deux, seulement chez l'hôte (gar: 0 chez l'invitée) */
      const gar = win && a.gar !== 0 && th !== 'source' ? garLoot(v, th, L, deep) : { orbs: [], ban: null };
      /* La mission d'intro gagnée : Lilou arrive au village (une seule fois) */
      const story = th === 'source' && win ? lilouArrive(v, t, hh) : null;
      if (gar.orbs.length || gar.ban) addLog(v, t, 'Pour la garnison : ' + gar.orbs.map(orbLabel).concat(gar.ban ? [banLabel(gar.ban) + (gar.ban.sold ? ' (réserve pleine : vendue)' : '')] : []).join(', ') + '.', 'sol');
      /* La Couronne de la Montagne (l'histoire, lot B) : un morceau ou un joyau rapporté ? */
      const crown = th !== 'source' ? crownFound(v, t, th, L, deep, win, hh, who.uid) : null;
      return { ok: true, xp, up, lvl: hh.lvl, got, pris: pris ? pris.name : null, dj: hh.dj, deep: hh.deep || 0, items: nItems, autoSold, autoGold, closed, orbs: gar.orbs, ban: gar.ban, lilou: story, crown };
    }
    /* ---------- équipement (étape 3) ---------- */
    case 'equip': {
      /* Porter un objet de son sac (l'objet qu'il remplace retourne dans le sac). */
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      const bag = bagOf(v, who.uid), it = bag.it[a.id]; if (!it) return fail('Objet introuvable.');
      const cw = canWear(hh, it); if (!cw.ok) return fail(cw.why);
      if (!hh.eq) hh.eq = {};
      const old = hh.eq[it.sl];
      delete bag.it[a.id]; it.id = a.id; hh.eq[it.sl] = it;
      if (old) { if (!old.id || bag.it[old.id]) old.id = 'i' + (bag.n++); bag.it[old.id] = old; }
      return { ok: true, name: itemInfo(it).name };
    }
    case 'unequip': {
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      const it = hh.eq && hh.eq[a.sl]; if (!it) return { ok: true };
      const bag = bagOf(v, who.uid); if (bagCount(bag) >= bagMax(v)) return fail('Ton sac est plein : vends ou fonds un objet d’abord.');
      delete hh.eq[a.sl]; if (!it.id || bag.it[it.id]) it.id = 'i' + (bag.n++); bag.it[it.id] = it;
      return { ok: true };
    }
    case 'sell': case 'melt': {
      /* Vendre (de l'or pour la bourse commune) ou fondre à la forge (du fer) des objets du sac ; leurs pierres reviennent dans le sac. */
      const melt = a.type === 'melt';
      if (melt && !forgeLvlOf(v)) return fail('Il faut une forge pour fondre un objet.');
      const bag = bagOf(v, who.uid), ids = (Array.isArray(a.ids) ? a.ids : [a.id]).slice(0, 80);
      let gain = 0, n = 0;
      for (const id of ids) { const it = bag.it[id]; if (!it) continue; const I = itemInfo(it); gain += melt ? I.melt : I.sell; gemsBack(bag, it); delete bag.it[id]; n++; }
      if (!n) return fail('Objet introuvable.');
      if (melt) { const cap = capOf(v); v.r.fer = Math.min(Math.max(cap, v.r.fer || 0), (v.r.fer || 0) + gain); }
      else v.r.or = (v.r.or || 0) + gain;
      return { ok: true, gain, n };
    }
    case 'craft': {
      /* Forger un objet pour un de ses héros : la rareté dépend du niveau de la forge, le niveau de l'objet de celui du héros. */
      const f = forgeLvlOf(v); if (!f) return fail('Il faut une forge.');
      if (!SLOTS.includes(a.sl)) return fail('Emplacement inconnu.');
      const hh = a.hid ? v.heroes[a.hid] : activeHero(v, who.uid); if (!hh || hh.own !== who.uid) return fail('Choisis un de tes héros.');
      const bag = bagOf(v, who.uid); if (bagCount(bag) >= bagMax(v)) return fail('Ton sac est plein.');
      const c = craftCost(hh.lvl), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const R = mulberry32(hash((v.seed ^ hashStr(who.uid) ^ Math.imul(bag.n + 1, 2654435761)) >>> 0));
      const it = genItem(R, { il: hh.lvl, src: 'forge' + Math.min(3, f), cls: hh.cls, sl: a.sl });
      const id = bagAdd(v, who.uid, it), I = itemInfo(it);
      if (it.r >= 3) addLog(v, t, nm + ' forge un objet ' + RARITY[it.r].name.toLowerCase() + ' : ' + I.name + ' !', 'forge');
      if (it.r === 4) chron(v, t, 'leg', nm + ' forge un objet légendaire : ' + I.name + '.');
      return { ok: true, id, r: it.r, name: I.name };
    }
    case 'improve': {
      const f = forgeLvlOf(v); if (!f) return fail('Il faut une forge.');
      const at = itemAt(v, who.uid, a); if (!at) return fail('Objet introuvable.');
      const it = at.it; if ((it.up | 0) >= maxUpOf(f)) return fail((it.up | 0) >= 5 ? 'Déjà amélioré au maximum (+5).' : 'Agrandissez la forge pour aller plus loin.');
      const c = improveCost(it), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); it.up = (it.up | 0) + 1;
      return { ok: true, up: it.up };
    }
    case 'socket': case 'unsocket': {
      /* Sertir une pierre dans un objet (celle qui y était revient dans le sac), ou l'en retirer. */
      if (!forgeLvlOf(v)) return fail('Il faut une forge pour sertir une pierre.');
      const at = itemAt(v, who.uid, a); if (!at) return fail('Objet introuvable.');
      const it = at.it, s = a.s | 0, bag = bagOf(v, who.uid); if (s < 0 || s >= socketsOf(it)) return fail('Pas de place pour une pierre ici.');
      if (!it.gm) it.gm = {};
      const old = it.gm['g' + s];
      if (a.type === 'unsocket') { if (gemOf(old)) { bag.gm[old] = (bag.gm[old] || 0) + 1; delete it.gm['g' + s]; } return { ok: true }; }
      const G = gemOf(a.g); if (!G || !(bag.gm[G.key] > 0)) return fail('Tu n’as pas cette pierre.');
      if (gemOf(old)) bag.gm[old] = (bag.gm[old] || 0) + 1;
      bag.gm[G.key]--; if (!bag.gm[G.key]) delete bag.gm[G.key];
      it.gm['g' + s] = G.key;
      return { ok: true };
    }
    case 'fuse': {
      if (forgeLvlOf(v) < 2) return fail('Il faut une forge de niveau 2 pour fusionner les pierres.');
      const G = gemOf(a.g), bag = bagOf(v, who.uid); if (!G) return fail('Pierre inconnue.');
      if (G.n >= 3) return fail('Cette pierre est déjà parfaite.');
      if ((bag.gm[G.key] || 0) < 3) return fail('Il faut trois pierres pareilles.');
      const c = { or: GEM_FUSE_COST[G.n] }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); bag.gm[G.key] -= 3; if (!bag.gm[G.key]) delete bag.gm[G.key];
      const nk = G.type + (G.n + 1); bag.gm[nk] = (bag.gm[nk] || 0) + 1;
      return { ok: true, g: nk, name: gemOf(nk).name };
    }
    case 'buy': {
      /* Acheter au marchand ambulant (avec l'or de la bourse commune) : chaque objet ne se vend qu'une fois. */
      if (!merchHere(v, t)) return fail('Le marchand est reparti.');
      const M = v.merch, sold = String(M.sold || ''), bag = bagOf(v, who.uid);
      if (a.g != null) {
        const i = a.g | 0, key = M.gm && M.gm[i]; if (!gemOf(key) || sold.includes('g' + i + ';')) return fail('Déjà vendu.');
        const c = { or: gemPrice(key) }, m = missingTxt(v, c); if (m) return fail(m);
        pay(v, c); bag.gm[key] = (bag.gm[key] || 0) + 1; M.sold = sold + 'g' + i + ';';
        return { ok: true, name: gemOf(key).name };
      }
      const i = a.i | 0, src = M.it && M.it[i]; if (!src || sold.includes('i' + i + ';')) return fail('Déjà vendu.');
      if (bagCount(bag) >= bagMax(v)) return fail('Ton sac est plein.');
      const c = { or: merchPrice(src) }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c); const it = cleanItem(src), id = bagAdd(v, who.uid, it); M.sold = sold + 'i' + i + ';';
      addLog(v, t, nm + ' achète au marchand : ' + itemInfo(it).name + '.', 'merch');
      if (it.r === 4) chron(v, t, 'leg', nm + ' achète un objet légendaire au marchand : ' + itemInfo(it).name + '.');
      return { ok: true, id, name: itemInfo(it).name };
    }
    case 'pet': {
      const hh = v.heroes[a.hid]; if (!hh || hh.own !== who.uid) return fail('Ce héros n’est pas à toi.');
      if (hh.lvl < PET_LVL) return fail('Le familier arrive au niveau ' + PET_LVL + '.');
      if (!PETS[a.p]) return fail('Familier inconnu.');
      hh.pet = a.p;
      return { ok: true };
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
  /* La garnison (p2g_garnison.js) : recruter, promouvoir, affecter aux postes, équiper, orbes et bannières. */
  const g = applyGar(v, a, nm, t); if (g) return g;
  /* L'histoire (p2s_histoire.js) : les caprices de Lilou. */
  const sy = applyStory(v, a, nm, t); if (sy) return sy;
  return fail('Action inconnue.');
}

/* Restes du rendu des combats de l'ancien jeu (serviront aux donjons, étape 2). */
const HEROES = {}, TROOPS = {};

/* ===================== ÉQUIPEMENT DES HÉROS (pur, sans DOM) =====================
   Un objet ne garde que sa « recette » : emplacement (sl), sorte (k), rareté (r, 0 à 4), niveau (il), graine (sd),
   et s'il y a lieu son ensemble (set), son pouvoir légendaire (pw), son amélioration (up, +1 à +5) et ses pierres serties (gm).
   Ses bonus et son nom sont recalculés à partir de la graine : même objet = mêmes bonus sur les deux téléphones.
   Les valeurs sont en pour cent (12 = +12 %). */

const SLOTS = ['arme', 'casque', 'armure', 'bottes', 'bijou'];
const SLOT_LABEL = { arme: 'Arme', casque: 'Casque', armure: 'Armure', bottes: 'Bottes', bijou: 'Bijou' };
const BIJOU_LVL = 8;                       // le bijou se porte à partir du niveau 8
const IL_MAX = 60;
const RARITY = [
  { name: 'Commun', col: '#a3abb4', af: 0, mul: 1, so: 0, sell: 4, melt: 6 },
  { name: 'Peu commun', col: '#5cc27a', af: 1, mul: 1.1, so: 0, sell: 10, melt: 12 },
  { name: 'Rare', col: '#5b9cf0', af: 2, mul: 1.22, so: 1, sell: 25, melt: 25 },
  { name: 'Épique', col: '#b07ce8', af: 3, mul: 1.36, so: 1, sell: 60, melt: 50 },
  { name: 'Légendaire', col: '#f59a3c', af: 3, mul: 1.5, so: 2, sell: 150, melt: 100 },
];
const SET_COL = '#36c2a8';

/* Armes : trois familles (lames, arcs, bâtons) ; chaque classe manie une famille. */
const WEAPONS = {
  epee: { f: 'lame', name: 'Épée' }, hache: { f: 'lame', name: 'Hache' }, masse: { f: 'lame', name: 'Masse' }, dagues: { f: 'lame', name: 'Dagues' },
  arc: { f: 'arc', name: 'Arc' }, arbalete: { f: 'arc', name: 'Arbalète' },
  baton: { f: 'baton', name: 'Bâton' }, sceptre: { f: 'baton', name: 'Sceptre' }, grimoire: { f: 'baton', name: 'Grimoire' },
};
const FAMILY_LABEL = { lame: 'lames (épées, haches, masses, dagues)', arc: 'arcs et arbalètes', baton: 'bâtons, sceptres et grimoires' };
const CLASS_FAMILY = { guerrier: 'lame', paladin: 'lame', voleur: 'lame', rodeur: 'arc', mage: 'baton', pretre: 'baton', druide: 'baton', necro: 'baton' };
const CLASS_WEAPONS = { guerrier: ['epee', 'hache'], paladin: ['masse', 'epee'], voleur: ['dagues'], rodeur: ['arc', 'arbalete'], mage: ['baton', 'grimoire'], pretre: ['sceptre', 'baton'], druide: ['baton'], necro: ['grimoire', 'baton'] };
const ARMOR_KINDS = {
  casque: [['casque', 'Casque'], ['heaume', 'Heaume'], ['capuche', 'Capuche'], ['couronne', 'Couronne']],
  armure: [['armure', 'Armure'], ['cotte', 'Cotte de mailles'], ['tunique', 'Tunique'], ['robe', 'Robe de mage']],
  bottes: [['bottes', 'Bottes'], ['jambieres', 'Jambières'], ['sandales', 'Sandales']],
  bijou: [['amulette', 'Amulette'], ['anneau', 'Anneau'], ['talisman', 'Talisman']],
};
const SLOT_WEIGHT = { arme: 26, casque: 18, armure: 20, bottes: 18, bijou: 18 };

/* Bonus possibles. Valeur de base selon le niveau L de l'objet. */
const STATS = {
  dmg: { t: v => '+' + v + ' % de dégâts', w: 1 },
  hp: { t: v => '+' + v + ' % de vie', w: 0.8 },
  armor: { t: v => '+' + v + ' % d’armure', w: 1.5 },
  crit: { t: v => '+' + v + ' % de coups critiques', w: 1.5 },
  haste: { t: v => 'attaque ' + v + ' % plus vite', w: 0.7 },
  cdr: { t: v => 'compétences ' + v + ' % plus vite prêtes', w: 0.8 },
  dodge: { t: v => '+' + v + ' % d’esquive', w: 1.2 },
  speed: { t: v => '+' + v + ' % de vitesse', w: 0.3 },
  leech: { t: v => 'vole ' + v + ' % des dégâts infligés', w: 2 },
  regen: { t: v => 'récupère ' + v + ' % de vie par seconde', w: 8 },
  potion: { t: v => 'potions +' + v + ' %', w: 0.2 },
  skill: { t: v => 'compétences +' + v + ' % plus fortes', w: 0.6 },
  gold: { t: v => '+' + v + ' % d’or trouvé', w: 0.1 },
};
const MAIN = {
  arme: { dmg: L => 2 + 0.8 * L },
  casque: { hp: L => 1.5 + 0.5 * L },
  armure: { hp: L => 2.5 + 0.6 * L, armor: L => 1 + 0.2 * L },
  bottes: { hp: L => 1 + 0.3 * L, speed: () => 4 },
  bijou: { skill: L => 2 + 0.6 * L },
};
const AFFIX = { dmg: L => 1 + 0.4 * L, hp: L => 1.5 + 0.5 * L, crit: L => 1 + 0.15 * L, haste: L => 2 + 0.3 * L, cdr: L => 2 + 0.3 * L, dodge: L => 1 + 0.12 * L,
  armor: L => 1 + 0.2 * L, leech: L => 0.5 + 0.1 * L, regen: L => 0.1 + 0.03 * L, speed: L => 2 + 0.2 * L, potion: L => 5 + L, skill: L => 2 + 0.5 * L, gold: L => 5 + L };
const AFFIX_POOL = {
  arme: ['crit', 'haste', 'leech', 'skill', 'cdr'],
  casque: ['armor', 'cdr', 'crit', 'regen', 'skill', 'dmg'],
  armure: ['regen', 'dodge', 'potion', 'dmg', 'crit'],
  bottes: ['dodge', 'armor', 'regen', 'dmg', 'crit'],
  bijou: ['dmg', 'crit', 'cdr', 'leech', 'gold', 'potion', 'hp'],
};
/* Plafonds de ce que l'équipement peut donner au total. */
const GEAR_CAP = { crit: 30, cdr: 40, dodge: 25, armor: 30, leech: 10, regen: 2, speed: 40, haste: 50 };
/* Noms : objets rares d'après leur bonus le plus fort, épiques d'après un titre, légendaires d'après leur pouvoir. */
const NAME_TIER = ['du soldat', 'du vétéran', 'du champion', 'du héros'];
const NAME_BEAST = { dmg: 'du loup', hp: 'de l’ours', crit: 'du faucon', haste: 'du lynx', cdr: 'du hibou', dodge: 'du renard', armor: 'de la tortue', leech: 'de la sangsue',
  regen: 'du troll', speed: 'du cerf', potion: 'de l’alchimiste', skill: 'du sage', gold: 'du marchand' };
const NAME_EPIC = ['des Cimes', 'de la Tempête', 'du Roi des Montagnes', 'de la Forge ancienne', 'de l’Aube', 'du Crépuscule', 'des Anciens Rois', 'du Dragon de pierre', 'du Gardien', 'des Profondeurs'];

/* Pouvoirs légendaires (un par objet légendaire, selon l'emplacement). */
const POWERS = {
  chaine: { sl: 'arme', title: 'Croc-de-Foudre', txt: 'Vos attaques touchent aussi un 2e monstre proche (moitié des dégâts).' },
  brasier: { sl: 'arme', title: 'Brasier', txt: 'Vos attaques enflamment la cible : un quart des dégâts en plus, en 3 secondes.' },
  echo: { sl: 'casque', title: 'Écho des Anciens', txt: '1 chance sur 5 qu’une compétence soit aussitôt prête à nouveau.' },
  epines: { sl: 'armure', title: 'Peau-de-Ronces', txt: 'Renvoie 30 % des coups reçus au corps à corps.' },
  sursis: { sl: 'armure', title: 'Dernier Rempart', txt: 'Une fois par donjon, un coup fatal vous laisse à 1 point de vie, intouchable 2 secondes.' },
  vent: { sl: 'bottes', title: 'Pas-du-Vent', txt: '+15 % de vitesse et +8 % d’esquive.' },
  soif: { sl: 'bijou', title: 'Cœur assoiffé', txt: 'Chaque monstre vaincu vous rend 3 % de vie.' },
  tresor: { sl: 'bijou', title: 'Œil du Dragon', txt: '+50 % d’or, et de meilleures chances de trouver des objets rares.' },
};
const POWER_KEYS = Object.keys(POWERS);
/* Ensembles : une tenue par donjon (arme, casque, armure, bottes), bonus à 2 et 4 pièces. */
const SETS = {
  troll: { name: 'Tenue du chef troll', sfx: 'du Chef troll', b2: { hp: 10 }, b2t: '+10 % de vie', b4t: 'Vos coups ont 1 chance sur 10 d’étourdir (1 seconde).' },
  roi: { name: 'Atours du roi squelette', sfx: 'du Roi squelette', b2: { skill: 12 }, b2t: 'Compétences +12 % plus fortes', b4t: 'Chaque monstre vaincu rapproche vos compétences d’une seconde.' },
  abime: { name: 'Panoplie de l’abîme', sfx: 'de l’Abîme', b2: { dmg: 8, hp: 8 }, b2t: '+8 % de dégâts et de vie', b4t: 'Une potion de plus, et les potions soignent 30 % de plus.' },
};
const SET_SLOTS = ['arme', 'casque', 'armure', 'bottes'];
const SET_OF_THEME = { mine: 'troll', crypte: 'roi', portail: 'abime' };   // le gardien du portail laisse parfois une pièce de l'abîme
/* Pierres précieuses : 3 tailles (éclat, pierre, parfaite) ; trois pareilles se fusionnent en une plus belle. */
const GEMS = {
  rubis: { name: 'Rubis', fem: false, stat: 'hp', v: [2, 4, 7], col: '#e0464e' },
  saphir: { name: 'Saphir', fem: false, stat: 'cdr', v: [2, 4, 6], col: '#4a7fe0' },
  emeraude: { name: 'Émeraude', fem: true, stat: 'crit', v: [1.5, 3, 5], col: '#3fb56b' },
  topaze: { name: 'Topaze', fem: true, stat: 'dmg', v: [2, 4, 7], col: '#e8b23a' },
};
const GEM_KEYS = Object.keys(GEMS);
const GEM_FUSE_COST = [0, 15, 50];         // or pour passer de la taille 1 à 2, de 2 à 3
const gemOf = key => { const m = /^([a-z]+)([123])$/.exec(String(key || '')); if (!m || !GEMS[m[1]]) return null; const G = GEMS[m[1]], n = +m[2]; return { key: m[1] + n, type: m[1], n, stat: G.stat, v: G.v[n - 1], col: G.col, name: gemName(m[1], n) }; };
function gemName(type, n) {
  const G = GEMS[type], low = G.name.toLowerCase();
  return n === 1 ? 'Éclat ' + (/^[aeiouéèêh]/i.test(low) ? 'd’' : 'de ') + low : n === 2 ? G.name : G.name + (G.fem ? ' parfaite' : ' parfait');
}
/* Familiers (niveau 6) : chacun son petit bonus. */
const PETS = {
  loup: { name: 'Loup', txt: 'Il mord fort : +30 % de dégâts pour le familier.' },
  faucon: { name: 'Faucon', txt: '+5 % de coups critiques pour son maître.' },
  sanglier: { name: 'Sanglier', txt: '+8 % de vie pour son maître.' },
  chouette: { name: 'Chouette', txt: 'Compétences 5 % plus vite prêtes.' },
};
const PET_KEYS = Object.keys(PETS);
const PET_LVL = 6;

/* ---------- tirage d'un objet ---------- */
/* Chances de chaque rareté selon la source (en %), avant le bonus du niveau et de la chance. */
const DROP = {
  mob: [62, 28, 8, 1.8, 0.2], chest: [50, 32, 14, 3.5, 0.5], boss: [0, 45, 38, 14, 3],
  forge1: [50, 35, 15, 0, 0], forge2: [20, 40, 30, 10, 0], forge3: [0, 35, 40, 21, 4], merch: [0, 40, 40, 18, 2],
};
const pickOf = (R, a) => a[Math.floor(R() * a.length) % a.length];
function rollRarity(R, table, L, luck) {
  const w = table.slice(), boost = (1 + 0.04 * Math.max(0, (L | 0) - 1)) * (luck || 1);
  for (let i = 2; i < 5; i++) w[i] *= boost;
  w[1] *= Math.sqrt(boost);
  const tot = w.reduce((a, b) => a + b, 0); let x = R() * tot;
  for (let i = 0; i < 5; i++) { x -= w[i]; if (x < 0 && w[i] > 0) return i; }
  return w.findIndex(x2 => x2 > 0);
}
/* o : { il, src (clé de DROP), cls (classe de celui qui le trouve : l'arme sera pour lui), sl, r, set, luck } */
function genItem(R, o) {
  let sl = o.sl;
  if (!sl) {
    const list = o.set ? SET_SLOTS : SLOTS, tot = list.reduce((a, s) => a + SLOT_WEIGHT[s], 0);
    let x = R() * tot; sl = list[list.length - 1];
    for (const s of list) { x -= SLOT_WEIGHT[s]; if (x < 0) { sl = s; break; } }
  }
  const r = o.set ? 3 : o.r != null ? Math.max(0, Math.min(4, o.r | 0)) : rollRarity(R, DROP[o.src] || DROP.chest, o.il, o.luck);
  const k = sl === 'arme' ? pickOf(R, CLASS_WEAPONS[o.cls] || Object.keys(WEAPONS)) : pickOf(R, ARMOR_KINDS[sl].filter((a, i) => i < 3 || r >= 2))[0];
  const it = { sl, k, r, il: Math.max(1, Math.min(IL_MAX, Math.round(o.il) || 1)), sd: (Math.floor(R() * 4294967295) >>> 0) || 1 };
  if (o.set && SET_SLOTS.includes(sl)) it.set = o.set;
  if (it.r === 4) it.pw = pickOf(R, POWER_KEYS.filter(p => POWERS[p].sl === sl));
  return it;
}
/* Objet reçu d'un téléphone (retour de donjon) : on ne garde que ce qui est possible. */
function cleanItem(x, maxIl) {
  if (!x || typeof x !== 'object' || !SLOTS.includes(x.sl)) return null;
  const sl = x.sl, kinds = sl === 'arme' ? Object.keys(WEAPONS) : ARMOR_KINDS[sl].map(a => a[0]);
  const it = { sl, k: kinds.includes(x.k) ? x.k : kinds[0], r: Math.max(0, Math.min(4, x.r | 0)), il: Math.max(1, Math.min(maxIl || IL_MAX, IL_MAX, x.il | 0)), sd: (x.sd >>> 0) || 1 };
  if (x.set && SETS[x.set] && SET_SLOTS.includes(sl)) { it.set = x.set; it.r = 3; }
  if (it.r === 4) it.pw = POWERS[x.pw] && POWERS[x.pw].sl === sl ? x.pw : POWER_KEYS.find(p => POWERS[p].sl === sl);
  return it;
}

/* ---------- ce que vaut un objet (recalculé, mis en cache) ---------- */
const itemCache = new Map();
const r1 = x => Math.round(x * 10) / 10;
const itemKey = it => [it.sl, it.k, it.r, it.il, it.sd, it.set || '', it.pw || '', it.up | 0, gemList(it).join(',')].join('|');
function gemList(it) { const n = socketsOf(it), out = []; for (let i = 0; i < n; i++) { const g = it.gm && it.gm['g' + i]; out.push(gemOf(g) ? g : null); } return out; }
const socketsOf = it => it.set ? 1 : RARITY[Math.max(0, Math.min(4, it.r | 0))].so;
const itemReq = it => Math.min(HERO_MAX_LVL, Math.max(1, (it.il | 0) - 2));
const maxUpOf = forgeLvl => forgeLvl >= 3 ? 5 : forgeLvl >= 2 ? 4 : forgeLvl >= 1 ? 3 : 0;
function itemInfo(it) {
  const key = itemKey(it), hit = itemCache.get(key); if (hit) return hit;
  const R = mulberry32((it.sd ^ 0x5bd1e995) >>> 0), L = it.il, rr = RARITY[it.r] || RARITY[0], up = 1 + 0.1 * Math.max(0, Math.min(5, it.up | 0));
  const main = {}, af = {};
  for (const k in MAIN[it.sl]) main[k] = r1(MAIN[it.sl][k](L) * (k === 'speed' ? 1 : rr.mul * (0.95 + 0.1 * R())) * up);
  const pool = AFFIX_POOL[it.sl].filter(k => !(k in main)), n = it.set ? 2 : rr.af;
  for (let i = 0; i < n && pool.length; i++) { const k = pool.splice(Math.floor(R() * pool.length), 1)[0]; af[k] = r1(AFFIX[k](L) * (0.8 + 0.4 * R()) * (1 + 0.08 * it.r)); }
  const gems = gemList(it);
  /* Nom */
  const base = it.sl === 'arme' ? (WEAPONS[it.k] || WEAPONS.epee).name : ((ARMOR_KINDS[it.sl].find(a => a[0] === it.k) || ARMOR_KINDS[it.sl][0])[1]);
  let name;
  if (it.set && SETS[it.set]) name = base + ' ' + SETS[it.set].sfx;
  else if (it.r === 4 && POWERS[it.pw]) name = base + ' « ' + POWERS[it.pw].title + ' »';
  else if (it.r === 3) name = base + ' ' + NAME_EPIC[it.sd % NAME_EPIC.length];
  else if (it.r === 2) { const best = Object.keys(af).sort((a, b) => af[b] * STATS[b].w - af[a] * STATS[a].w)[0]; name = base + ' ' + (NAME_BEAST[best] || 'du loup'); }
  else name = base + ' ' + NAME_TIER[L >= 20 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0];
  if (it.up > 0) name += ' +' + it.up;
  /* Valeur (pour comparer), prix de vente, fer rendu à la fonte */
  let score = 0;
  for (const k in main) score += main[k] * STATS[k].w;
  for (const k in af) score += af[k] * STATS[k].w;
  for (const g of gems) if (g) { const G = gemOf(g); score += G.v * STATS[G.stat].w; }
  if (it.pw) score += 8; if (it.set) score += 4;
  const lv = 1 + 0.12 * (L - 1), upv = 1 + 0.3 * (it.up | 0);
  const info = { name, base, main, af, gems, so: gems.length, req: itemReq(it), score: r1(score), sell: Math.max(1, Math.round(rr.sell * lv * upv)),
    melt: Math.max(1, Math.round(rr.melt * (1 + 0.1 * (L - 1)) * (1 + 0.5 * (it.up | 0)))), col: it.set ? SET_COL : rr.col, fam: it.sl === 'arme' ? (WEAPONS[it.k] || WEAPONS.epee).f : null };
  if (itemCache.size > 600) itemCache.clear();
  itemCache.set(key, info);
  return info;
}
/* Ce héros peut-il porter cet objet ? */
function canWear(hh, it) {
  if (!hh || !it) return { ok: false, why: 'Objet introuvable.' };
  if (it.sl === 'bijou' && hh.lvl < BIJOU_LVL) return { ok: false, why: 'Un bijou se porte à partir du niveau ' + BIJOU_LVL + '.' };
  if (it.sl === 'arme' && (WEAPONS[it.k] || WEAPONS.epee).f !== CLASS_FAMILY[hh.cls]) return { ok: false, why: className(hh.cls, hh.sex) + ' : seulement les ' + FAMILY_LABEL[CLASS_FAMILY[hh.cls]] + '.' };
  const req = itemReq(it); if (hh.lvl < req) return { ok: false, why: 'Il faut être niveau ' + req + '.' };
  return { ok: true };
}
/* Tout ce que l'équipement porté donne au héros (en %), ensembles et pouvoirs compris. */
function gearOf(hh) {
  const s = { dmg: 0, hp: 0, armor: 0, crit: 0, haste: 0, cdr: 0, dodge: 0, speed: 0, leech: 0, regen: 0, potion: 0, skill: 0, gold: 0, pw: {}, set4: {}, sets: {}, potX: 0 };
  for (const sl of SLOTS) {
    const it = hh && hh.eq && hh.eq[sl]; if (!it || it.sl !== sl || !canWear(hh, it).ok) continue;
    const I = itemInfo(it);
    for (const k in I.main) s[k] += I.main[k];
    for (const k in I.af) s[k] += I.af[k];
    for (const g of I.gems) if (g) { const G = gemOf(g); s[G.stat] += G.v; }
    if (it.pw) s.pw[it.pw] = 1;
    if (it.set) s.sets[it.set] = (s.sets[it.set] || 0) + 1;
  }
  for (const k in s.sets) { const S = SETS[k]; if (!S) continue; if (s.sets[k] >= 2) for (const st in S.b2) s[st] += S.b2[st]; if (s.sets[k] >= 4) s.set4[k] = 1; }
  if (s.pw.vent) { s.speed += 15; s.dodge += 8; }
  if (s.pw.tresor) s.gold += 50;
  if (s.set4.abime) { s.potion += 30; s.potX = 1; }
  for (const k in GEAR_CAP) s[k] = Math.min(s[k], GEAR_CAP[k]);
  for (const k in STATS) s[k] = r1(s[k]);
  return s;
}
/* Comparaison avec l'objet porté au même emplacement : 1 mieux, -1 moins bien, 0 pareil (null si on ne peut pas le porter). */
function compareItem(hh, it) {
  if (!hh || !canWear(hh, it).ok) return null;
  const cur = hh.eq && hh.eq[it.sl], a = itemInfo(it).score, b = cur ? itemInfo(cur).score : 0;
  return a > b * 1.03 + 0.05 ? 1 : a < b * 0.97 - 0.05 ? -1 : 0;
}

/* ---------- le sac (un par joueur) et la forge ---------- */
const BAG_BASE = 30;
const forgeLvlOf = v => { const f = v.b.find(b => b.type === 'forge' && b.lvl > 0); return f ? f.lvl : 0; };
const bagMax = v => BAG_BASE + 10 * forgeLvlOf(v);
function bagOf(v, uid) {
  if (!v.bag) v.bag = {};
  if (!v.bag[uid]) v.bag[uid] = { it: {}, gm: {}, n: 1 };
  const b = v.bag[uid]; if (!b.it) b.it = {}; if (!b.gm) b.gm = {}; if (!b.n) b.n = 1;
  return b;
}
const bagCount = b => Object.keys(b.it).length;
function bagAdd(v, uid, it) { const b = bagOf(v, uid); const id = 'i' + (b.n++); it.id = id; b.it[id] = it; return id; }
/* Les pierres serties d'un objet vendu ou fondu reviennent dans le sac. */
function gemsBack(bag, it) { for (const g of Object.values(it.gm || {})) if (gemOf(g)) bag.gm[g] = (bag.gm[g] || 0) + 1; }
const craftCost = L => ({ fer: 30 + 6 * L, bois: 20 + 4 * L, or: 20 + 5 * L });
const improveCost = (it) => { const k = (it.up | 0) + 1, L = it.il; return { fer: (15 + 3 * L) * k, or: (10 + 2 * L) * k }; };
/* Où est l'objet visé par une action ? a.hid + a.sl : porté par ce héros (à moi) ; sinon a.id dans mon sac. */
function itemAt(v, uid, a) {
  if (a.hid) { const hh = v.heroes[a.hid]; if (!hh || hh.own !== uid || !hh.eq || !hh.eq[a.sl]) return null; return { it: hh.eq[a.sl], hh }; }
  const b = bagOf(v, uid), it = b.it[a.id]; return it ? { it, bag: b } : null;
}

/* ---------- le marchand ambulant : un jour sur deux, il s'installe sur la place ---------- */
const merchDay = (v, t) => Math.floor(Math.max(0, t - v.born) / DAY);
const merchHere = (v, t) => { const d = merchDay(v, t); return d % 2 === 1 && !!v.merch && v.merch.d === d; };
const merchLeaves = (v, t) => v.born + (merchDay(v, t) + 1) * DAY;
const merchPrice = it => Math.round(itemInfo(it).sell * 4);
const gemPrice = key => { const G = gemOf(key); return G ? [0, 40, 130, 400][G.n] : 0; };
function genMerch(v, d) {
  const R = mulberry32(hash((v.seed ^ Math.imul(d + 1, 7919)) >>> 0)), lv = Object.values(v.heroes || {}).reduce((m, h) => Math.max(m, h && h.lvl || 1), 1);
  const classes = [...new Set(Object.values(v.heroes || {}).map(h => h && h.cls).filter(Boolean))];
  const it = [];
  for (let i = 0; i < 4; i++) it.push(genItem(R, { il: lv + Math.floor(R() * 2), src: 'merch', cls: classes.length ? pickOf(R, classes) : null }));
  const gm = [pickOf(R, GEM_KEYS) + 1, pickOf(R, GEM_KEYS) + (R() < 0.35 ? 2 : 1)];
  return { d, it, gm, sold: '' };
}

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

/* ===================== RAIDS : portails démoniaques, gobelins, voleurs et trolls (pur, sans DOM) =====================
   Le calendrier : le premier portail s'ouvre au début du 3e jour du village ; il se charge pendant 3 heures (on voit de quel côté
   viendra le raid), puis le raid part dès que les deux joueurs sont absents depuis 2 heures. Le portail suivant s'ouvre 20 à 28 heures
   après (au plus un raid par jour). Refermer tous les portails avec son héros (le donjon du portail) annule le raid.
   Le combat est simulé d'un coup, de façon déterministe : seulement + − × ÷ et la racine carrée (même résultat sur tous les téléphones),
   10 pas par seconde. La rediffusion rejoue exactement la même simulation à partir de ce qui est gardé dans v.lastRaid.
   Le village fait le donjon : bâtiments et palissades sont des murs, le terrain libre des couloirs. Tout le monde suit les mêmes chemins
   (le plus court, en comptant ce qu'il faudrait casser) ; les trolls cassent les murs et les portes 4 fois plus vite.
   Coordonnées en cases du village : x = colonne (gx), y = ligne (gz) ; le centre d'une case est à +0,5. */
const RAID_FIRST = 2 * DAY, RAID_CHARGE = 3 * HOUR, RAID_AWAY = 2 * HOUR, RAID_GAP = 20 * HOUR, RAID_GAP_RND = 8 * HOUR;
const RAID_DT = 0.1, RAID_LIMIT = 300;                // pas de 1/10 s ; au bout de 5 minutes, ceux qui restent repartent
const RAID_ZONE = 5.5;                                // les héros défendent autour de la halle, dans ce rayon (en cases)
const RAID_PATH_K = 40;                               // casser un mur de 200 de solidité « vaut » un détour de 5 cases
const RAID_BLD_HP = 2500;                             // un bâtiment ordinaire (par case de côté) : on le contourne presque toujours
const RAID_SIDES = ['nord', 'est', 'sud', 'ouest'], RAID_AT = ['au nord', 'à l’est', 'au sud', 'à l’ouest'], RAID_OF = ['du nord', 'de l’est', 'du sud', 'de l’ouest'];
const RAID_LOOT = ['bois', 'pierre', 'pain', 'viande', 'fer'];
/* Ennemis au niveau 1 (vie, dégâts sur les héros, secondes entre deux coups, allonge, vitesse en cases par seconde,
   butin emporté, dégâts sur les murs : sdmg × wall). */
const RAID_FOES = {
  gobelin: { name: 'Gobelin', plural: 'Gobelins', hp: 90, dmg: 8, rate: 1.0, reach: 0.35, speed: 1.6, r: 0.3, carry: 15, sdmg: 8, wall: 1, xp: 6, gold: 3, fight: true },
  voleur: { name: 'Gobelin voleur', plural: 'Gobelins voleurs', hp: 60, dmg: 0, rate: 1.0, reach: 0, speed: 2.3, r: 0.28, carry: 35, sdmg: 3, wall: 1, xp: 8, gold: 5, thief: true },
  troll: { name: 'Troll', plural: 'Trolls', hp: 520, dmg: 26, rate: 1.6, reach: 0.45, speed: 1.0, r: 0.45, carry: 25, sdmg: 26, wall: 4, xp: 25, gold: 12, fight: true },
};
/* Héros en défense, au niveau 1 (attaque simple seulement ; le mage touche aussi autour de sa cible, le prêtre soigne en frappant). */
const RAID_HERO = {
  guerrier: { hp: 340, dmg: 14, armor: 0.25, range: 1.0, cd: 1.0, speed: 2.4 },
  paladin: { hp: 320, dmg: 13, armor: 0.22, range: 1.0, cd: 1.0, speed: 2.3 },
  rodeur: { hp: 230, dmg: 11, armor: 0.05, range: 5.5, cd: 0.9, speed: 2.5 },
  mage: { hp: 200, dmg: 12, armor: 0, range: 5, cd: 1.1, speed: 2.3 },
  voleur: { hp: 260, dmg: 9, armor: 0.15, range: 1.0, cd: 0.6, speed: 2.6 },
  pretre: { hp: 210, dmg: 9, armor: 0.05, range: 4.5, cd: 1.1, speed: 2.3 },
  druide: { hp: 250, dmg: 10, armor: 0.1, range: 4.5, cd: 1.0, speed: 2.3 },
  necro: { hp: 200, dmg: 10, armor: 0.05, range: 5, cd: 1.2, speed: 2.3 },
};
const RAID_NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

/* ---------- outils (déterministes) ---------- */
const raidPow = (b, n) => { let k = 1; for (let i = 0; i < n; i++) k *= b; return k; };
function raidRnd(st) { const a = st.rs = (st.rs + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const raidCell = v => Math.max(0, Math.min(GRID - 1, Math.floor(v)));
const raidLen = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
const raidDist = (a, b) => raidLen(a.x - b.x, a.y - b.y);
const raidAlive = u => u.on && !u.dead && !u.out;
function raidDistRect(x, y, S) { const dx = Math.max(S.x0 - x, 0, x - (S.x0 + S.s)), dy = Math.max(S.y0 - y, 0, y - (S.y0 + S.s)); return raidLen(dx, dy); }
function raidFace(u, t) { const dx = t.x - u.x, dy = t.y - u.y, L = raidLen(dx, dy); if (L > 1e-6) { u.fx = dx / L; u.fy = dy / L; } }

/* ---------- le calendrier ---------- */
/* Niveau des ennemis : la moyenne du meilleur héros de chaque joueur. */
function raidLevel(v) {
  const best = Object.keys(v.members || {}).map(uid => heroesOf(v, uid).reduce((m, h) => Math.max(m, h.lvl | 0), 0)).filter(x => x > 0);
  return best.length ? Math.max(1, Math.round(best.reduce((a, b) => a + b, 0) / best.length)) : 1;
}
/* Appelé à chaque minute de la simulation du village. */
function raidTick(v) {
  const t = v.t;
  if (!v.raid || typeof v.raid !== 'object') v.raid = { n: 0, next: Math.max(v.born + RAID_FIRST, t + 6 * HOUR) };
  const R = v.raid;
  if (!R.p) { if (t >= (R.next || 0)) raidOpen(v, t); return; }
  if (t < (R.at || 0) + RAID_CHARGE) return;
  if (!R.rd) { R.rd = 1; addLog(v, t, (R.p.length > 1 ? 'Les portails sont chargés' : 'Le portail est chargé') + ' : les gobelins attaqueront dès que personne n’aura joué depuis 2 heures.', 'portal'); }
  if (t - (v.here || 0) < RAID_AWAY) return;
  raidResolve(v, t);
}
/* Un (ou plusieurs, selon la halle) portail s'ouvre au bord de la vallée, d'un côté tiré au hasard. */
function raidOpen(v, t) {
  const R = v.raid, rnd = mulberry32(hash((v.seed ^ Math.imul((R.n | 0) + 1 + 7 * (R.closed | 0), 0x2c1b3c6d)) >>> 0));
  const hl = hallLvl(v), n = hl >= 5 ? 3 : hl >= 3 ? 2 : 1, sides = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), s = sides[i]; sides[i] = sides[j]; sides[j] = s; }
  R.p = [];
  for (let i = 0; i < n; i++) { const s = sides[i], k = 4 + Math.floor(rnd() * (GRID - 8)); R.p.push(s === 0 ? [k, 0, 0] : s === 1 ? [GRID - 1, k, 1] : s === 2 ? [k, GRID - 1, 2] : [0, k, 3]); }
  R.cl = R.p.map(() => 0); R.sd = (Math.floor(rnd() * 4294967295) >>> 0) || 1; R.at = t; R.rd = 0;
  const where = R.p.map(p => RAID_AT[p[2]]);
  addLog(v, t, (n > 1 ? n + ' portails démoniaques s’ouvrent au bord de la vallée (' + where.join(', ') + ') : ils seront chargés' : 'Un portail démoniaque s’ouvre ' + where[0] + ' de la vallée : il sera chargé') + ' dans 3 heures. Préparez vos défenses, ou refermez-le avec votre héros !', 'portal');
}
/* Portail refermé par un héros (donjon du portail gagné). Tous refermés : pas de raid cette fois, le suivant viendra plus tard. */
function raidClosePortal(v, t, pi, who) {
  const R = v.raid; if (!R || !R.p || !R.p[pi] || !R.cl || R.cl[pi]) return null;
  R.cl[pi] = 1;
  const left = R.cl.filter(c => !c).length, side = R.p[pi][2];
  if (!left) { const rnd = mulberry32((R.sd ^ 0x51ed27) >>> 0); R.p = null; R.cl = null; R.rd = 0; R.closed = (R.closed | 0) + 1; R.next = t + RAID_GAP + Math.floor(rnd() * (RAID_GAP_RND / MIN)) * MIN; }
  addLog(v, t, who + ' referme le portail ' + RAID_OF[side] + (left ? ' : il en reste ' + left + ' ouvert' + (left > 1 ? 's' : '') + '.' : ' : pas de raid cette fois !'), 'portal');
  return { side, all: !left };
}
/* Pour l'affichage : calme, portail qui se charge, ou portail chargé. */
function raidInfo(v, t) {
  const R = v.raid || {};
  if (!R.p) return { st: 'calm', next: R.next || 0, p: [] };
  const ready = (R.at || 0) + RAID_CHARGE;
  return { st: t < ready ? 'charge' : 'ready', ready, frac: Math.max(0, Math.min(1, (t - (R.at || 0)) / RAID_CHARGE)), p: R.p.map((p, i) => ({ x: p[0], y: p[1], side: p[2], cl: !!(R.cl && R.cl[i]), i })) };
}

/* ---------- le raid : ce qu'on garde pour le simuler (et le rediffuser) ---------- */
function raidHeroStats(h) {
  const C = RAID_HERO[h.cls] || RAID_HERO.guerrier, L = Math.max(1, Math.min(HERO_MAX_LVL, h.lvl | 0)), pw = raidPow(1.1, L - 1), G = gearOf(h);
  const hp = Math.round(C.hp * pw * (h.race === 'nain' ? 1.15 : 1) * (1 + G.hp / 100));
  const dmg = r1(C.dmg * pw * (1 + G.dmg / 100));
  return [h.id, String(h.name || ''), RAID_HERO[h.cls] ? h.cls : 'guerrier', RACES[h.race] ? h.race : 'humain', h.sex === 'f' ? 'f' : 'm', COLORS.includes(h.col) ? h.col : COLORS[0], L, hp, dmg,
    r2(Math.min(0.6, C.armor + G.armor / 100)), C.range, r2(C.cd / (1 + G.haste / 100)), r2(C.speed * (h.race === 'elfe' ? 1.1 : 1))];
}
/* Les assaillants : gobelins, voleurs (1 + halle/2) et trolls (dès la halle 2) ; un peu plus nombreux au fil des raids. Le tout premier raid est doux. */
function raidForce(v, R, open) {
  const hl = hallLvl(v), n = R.n | 0, rnd = mulberry32((R.sd ^ 0x7f4a7c15) >>> 0);
  let gob = 3 + hl + Math.min(3, Math.floor(n / 3)), vol = 1 + Math.floor(hl / 2), tro = Math.floor(hl / 2);
  if (n === 0) { gob = 3; vol = 1; tro = 0; }
  const list = [];
  for (let i = 0; i < tro; i++) list.push('troll');
  for (let i = 0; i < gob; i++) list.push('gobelin');
  for (let i = 0; i < vol; i++) list.push('voleur');
  /* les trolls ouvrent la marche, les gobelins suivent, les voleurs se faufilent un peu après */
  return list.map((type, i) => [type, open[i % open.length], r1((type === 'troll' ? 0 : type === 'gobelin' ? 1.5 : 6) + i * 0.6 + rnd() * 0.8)]);
}
/* La garnison : les soldats affectés à un poste et pas blessés.
   [id, type, race, sexe, niveau, vie, dégâts, armure, allonge, secondes entre deux coups, vitesse, poste, esquive, régénération (% par s), épines, numéro, titre]
   Sans nourriture au village, ils frappent moins fort (−25 %). */
function raidGuards(v, t) {
  const posts = v.b.filter(b => b.type === 'poste' && b.lvl > 0), hungry = (v.hunger || 0) > 0 || foodOf(v) < 1;
  return solList(v).filter(s => s.post && !solHurt(s, t) && posts.some(b => b.id === s.post)).map(s => {
    const S = solStats(s, posts.find(b => b.id === s.post));
    return [s.id, s.type, s.race === 'nain' || s.race === 'elfe' ? s.race : 'humain', s.sex === 'f' ? 'f' : 'm', Math.max(1, s.lvl | 0), S.hp, hungry ? r1(S.dmg * 0.75) : S.dmg, S.armor, S.range, S.cd, S.speed, s.post, S.dodge, S.regen, S.thorns, s.num | 0, solTitle(s) ? 1 : 0];
  });
}
function raidInput(v, t) {
  const R = v.raid, open = R.p.map((p, i) => i).filter(i => !R.cl[i]);
  /* le 6e nombre : la solidité (palissade, porte, tour) ; pour un poste de garde, la rareté de sa bannière + 1 (0 : pas de bannière) */
  const B = v.b.filter(b => BLD[b.type] && b.type !== 'marchand').map(b => [b.id, b.type, b.lvl | 0, b.gx, b.gz, b.type === 'poste' ? (banOk(b.ban) ? 1 + b.ban.r : 0) : BLD[b.type].hps ? Math.round(hpOf(b)) : 0]);
  const H = Object.values(v.heroes || {}).filter(Boolean).sort((a, b) => (a.n || 0) - (b.n || 0)).map(raidHeroStats);
  const stock = {}; for (const k of RAID_LOOT.concat(['or'])) stock[k] = Math.floor(v.r[k] || 0);
  const inp = { t, n: R.n | 0, sd: R.sd, L: raidLevel(v), P: R.p.map((p, i) => [p[0], p[1], p[2], R.cl[i] ? 1 : 0]), B, H, F: raidForce(v, R, open), R: stock };
  const G = raidGuards(v, t); if (G.length) inp.G = G;
  /* L'humeur de Lilou (l'histoire) : les gobelins frappent plus ou moins fort ; dès le chapitre 3, la moitié d'entre eux vise sa chambre */
  const M = lilouMul(v); if (M !== 1) inp.M = M;
  if (crownRaidOn(v)) inp.C = 1;
  return inp;
}

/* ---------- le combat ---------- */
function raidMark(st, S, val) { for (let y = S.y0; y < S.y0 + S.s; y++) for (let x = S.x0; x < S.x0 + S.s; x++) if (x >= 0 && y >= 0 && x < GRID && y < GRID) st.occ[y * GRID + x] = val; }
function raidStart(inp) {
  const N = GRID * GRID, L = Math.max(1, inp.L | 0);
  const st = {
    inp, t: 0, n: 0, rs: (inp.sd ^ 0x2545f491) >>> 0, over: false, ev: [], mood: +inp.M || 1,
    S: [], occ: new Int16Array(N), trapAt: new Int16Array(N), traps: [], towers: [], foes: [], heroes: [], posts: [], guards: [],
    ff: {}, hf: new Map(), gen: 0, hall: -1, stores: [], ch: -1, lil: 0,
    stock: Object.assign({}, inp.R), taken: {}, lost: {}, back: {}, kills: 0, esc: 0, gold: 0, xp: 0, heart: 0, broke: 0,
    L, mul: raidPow(1.12, L - 1), lootMul: 1 + 0.15 * (L - 1),
    defMul: raidPow(1.08, L - 1),        // tours et pièges suivent un peu le niveau des ennemis (moins vite : il faut les améliorer)
  };
  for (const e of inp.B) {
    const id = e[0], type = e[1], lvl = e[2] | 0, gx = e[3], gz = e[4], d = BLD[type]; if (!d) continue;
    /* poste de garde : on passe à travers ; il garde un cercle (bannière : sa rareté + 1) */
    if (d.def === 'post') { if (lvl >= 1) st.posts.push({ id, lvl, gx, gz, x: gx + 0.5, y: gz + 0.5, r: d.zone[Math.min(lvl, d.max) - 1], ban: e[5] | 0 }); continue; }
    if (d.def === 'trap') {
      if (lvl < 1) continue;
      const T = d.trap, k = Math.min(lvl, d.max) - 1;
      st.traps.push({ id, type, lvl, x: gx, y: gz, uses: T.uses[k], cd: 0, dmg: T.dmg ? T.dmg[k] : 0, root: T.root ? T.root[k] : 0, shown: false });
      st.trapAt[gz * GRID + gx] = st.traps.length;
      continue;
    }
    const s = d.size, kind = type === 'halle' ? 'halle' : type === 'rempart' ? 'wall' : type === 'porte' ? 'gate' : type === 'tour' && lvl > 0 ? 'tower' : type === 'entrepot' && lvl > 0 ? 'store'
      : type === 'chambre' && inp.C ? 'chambre' : 'bld';
    const def = kind === 'wall' || kind === 'gate' || kind === 'tower', max = def ? hpMaxOf({ type, lvl }) : RAID_BLD_HP * s, hp = def ? Math.max(0, Math.min(max, e[5])) : max;
    const S = { id, type, kind, lvl, x0: gx, y0: gz, s, x: gx + s / 2, y: gz + s / 2, hp, max, hp0: hp, dead: hp <= 0 };
    st.S.push(S);
    const si = st.S.length - 1;
    if (!S.dead) raidMark(st, S, si + 1);
    if (kind === 'halle' && st.hall < 0) st.hall = si;
    if (kind === 'chambre' && st.ch < 0) st.ch = si;
    if (kind === 'store') st.stores.push(si);
    if (kind === 'tower') { const T = d.tw, k = Math.min(lvl, d.max) - 1; st.towers.push({ si, cd: 0.6, range: T.range[k], dmg: T.dmg[k], rate: T.rate, n: 0 }); }
  }
  if (st.hall < 0) { st.S.push({ id: 0, type: 'halle', kind: 'halle', lvl: 1, x0: 11, y0: 11, s: 2, x: 12, y: 12, hp: 1, max: 1, hp0: 1, dead: false }); st.hall = st.S.length - 1; }
  /* Les héros se postent autour de la halle */
  const spots = raidSpots(st, inp.H.length);
  inp.H.forEach((e, i) => {
    const sp = spots[i] || [st.S[st.hall].x, st.S[st.hall].y + st.S[st.hall].s / 2 + 0.5];
    st.heroes.push({ id: e[0], name: e[1], cls: e[2], race: e[3], sex: e[4], col: e[5], lvl: e[6], kind: 'hero', hp: e[7], hpMax: e[7], dmg: e[8], armor: e[9], range: e[10], cd: e[11], speed: e[12],
      r: 0.3, x: sp[0], y: sp[1], px: sp[0], py: sp[1], home: sp, atkT: 0.2 + 0.1 * i, atkN: 0, mv: false, ko: false, dead: false, fx: 0, fy: 1 });
  });
  /* La garnison : chaque garde à sa place dans la formation de son poste, tournée vers le portail ouvert le plus proche */
  const G = inp.G || [], open = inp.P.filter(p => !p[3]);
  for (const P0 of st.posts) {
    const mine = G.filter(e => e[11] === P0.id); if (!mine.length) continue;
    let dx = 0, dy = -1, bd = 1e18;
    for (const p of open) { const ex = p[0] + 0.5 - P0.x, ey = p[1] + 0.5 - P0.y, d2 = ex * ex + ey * ey; if (d2 < bd && d2 > 1e-6) { bd = d2; const L0 = Math.sqrt(d2); dx = ex / L0; dy = ey / L0; } }
    const spots = solFormation(P0, mine.map(e => e[1]), dx, dy, (cx, cy) => raidBlocked(st, cx, cy));
    mine.forEach((e, i) => {
      const sp = spots[i];
      st.guards.push({ id: e[0], type: SOLDIERS[e[1]] ? e[1] : 'fant', race: e[2], sex: e[3], lvl: e[4], kind: 'guard', hp: e[5], hpMax: e[5], dmg: e[6], armor: e[7], range: e[8], cd: e[9], speed: e[10],
        post: P0, dodge: e[12], regen: e[13], thorns: e[14], num: e[15], title: e[16], r: 0.28, x: sp[0], y: sp[1], px: sp[0], py: sp[1], home: sp,
        atkT: 0.3 + 0.07 * st.guards.length, atkN: 0, mv: false, ko: false, dead: false, fx: dx, fy: dy, kills: 0 });
    });
  }
  inp.F.forEach((f, i) => {
    const type = RAID_FOES[f[0]] ? f[0] : 'gobelin', D = RAID_FOES[type], k = st.mul;
    st.foes.push({ id: 100 + i, type, kind: 'mob', pi: Math.max(0, Math.min(inp.P.length - 1, f[1] | 0)), delay: +f[2] || 0, on: false, dead: false, out: false,
      r: D.r, big: type === 'troll', hp: r1(D.hp * k), hpMax: r1(D.hp * k), dmg: r1(D.dmg * k * st.mood), sdmg: r1(D.sdmg * k * st.mood), rate: D.rate, reach: D.reach, speed: D.speed,
      carry: D.carry, wall: D.wall, fight: !!D.fight, thief: !!D.thief, x: 0, y: 0, px: 0, py: 0, fx: 0, fy: 1, mv: false, atkT: 0.5, atkN: 0, goal: 't',
      tk: st.ch >= 0 && type === 'gobelin' && i % 2 === 0 ? 'c' : 'h', pl: 0, loot: null, root: 0 });     // un gobelin sur deux vise la chambre de Lilou (inp.C)
  });
  return st;
}
/* Places de départ des héros : les cases libres tout autour de la halle (puis un peu plus loin), réparties. */
function raidSpots(st, n) {
  const H = st.S[st.hall], out = [];
  for (let ring = 1; ring <= 3 && out.length < Math.max(n, 1) * 2; ring++) {
    const cells = [];
    for (let y = H.y0 - ring; y < H.y0 + H.s + ring; y++) for (let x = H.x0 - ring; x < H.x0 + H.s + ring; x++) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      const edge = x === H.x0 - ring || y === H.y0 - ring || x === H.x0 + H.s + ring - 1 || y === H.y0 + H.s + ring - 1;
      if (edge && !st.occ[y * GRID + x]) cells.push([x + 0.5, y + 0.5]);
    }
    for (const c of cells) out.push(c);
  }
  if (!n || !out.length) return out;
  const step = Math.max(1, Math.floor(out.length / n)), pick = [];
  for (let i = 0; i < n; i++) pick.push(out[(i * step) % out.length]);
  return pick;
}
/* Une case où un défenseur ne peut pas aller : hors de la vallée, un mur, un bâtiment (pas une porte ni une ruine). */
function raidBlocked(st, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return true;
  const o = st.occ[cy * GRID + cx] - 1; return o >= 0 && st.S[o].kind !== 'gate';
}
/* Formation d'un poste (P0 : { x, y, r }) : fantassins et lanciers devant, vers (dx, dy), archers et mages derrière ; 4 par rang.
   Une place prise par un mur ou hors du cercle : la case libre la plus proche dans le cercle. Même résultat partout (raid et village). */
function solFormation(P0, types, dx, dy, blocked) {
  const px = -dy, py = dx, out = new Array(types.length), taken = [], fr = [], bk = [], rows = [];
  types.forEach((ty, i) => ((SOLDIERS[ty] || SOLDIERS.fant).front ? fr : bk).push(i));
  const lay = (idx, d0) => { for (let k = 0; k < idx.length; k += 4) rows.push([idx.slice(k, k + 4), d0 - 0.9 * (k / 4)]); };
  lay(fr, Math.min(1.5, P0.r * 0.45)); lay(bk, -Math.min(0.6, P0.r * 0.15));
  for (const [list, d] of rows) list.forEach((i, j) => {
    const off = (j - (list.length - 1) / 2) * 0.9;
    let x = P0.x + dx * d + px * off, y = P0.y + dy * d + py * off;
    if (blocked(Math.floor(x), Math.floor(y)) || raidLen(x - P0.x, y - P0.y) > P0.r - 0.2) { const f = solFree(P0, x, y, blocked, taken); x = f[0]; y = f[1]; }
    taken.push([x, y]); out[i] = [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
  });
  return out;
}
function solFree(P0, x, y, blocked, taken) {
  let best = null, bd = 1e18;
  for (let cy = Math.floor(P0.y - P0.r); cy <= Math.floor(P0.y + P0.r); cy++) for (let cx = Math.floor(P0.x - P0.r); cx <= Math.floor(P0.x + P0.r); cx++) {
    if (blocked(cx, cy)) continue;
    const ox = cx + 0.5, oy = cy + 0.5; if (raidLen(ox - P0.x, oy - P0.y) > P0.r - 0.2) continue;
    let used = 0; for (const q of taken) if (raidLen(q[0] - ox, q[1] - oy) < 0.5) used++;
    const d = (ox - x) * (ox - x) + (oy - y) * (oy - y) + used * 4;
    if (d < bd) { bd = d; best = [ox, oy]; }
  }
  return best || [P0.x, P0.y];
}

/* ---------- chemins : une carte des distances par but (halle, réserve, portail), refaite quand un mur tombe ---------- */
function raidCost(st, i, ti) {
  const o = st.occ[i] - 1; if (o < 0) return 1;
  if (o === ti) return 1e7;
  const S = st.S[o]; return S.kind === 'halle' ? 1e7 : 1 + S.hp / RAID_PATH_K;
}
function raidGoals(st, key) {
  const out = [];
  if (key[0] === 'p') {
    const P = st.inp.P[+key.slice(1)] || st.inp.P[0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = P[0] + dx, y = P[1] + dy; if (x >= 0 && y >= 0 && x < GRID && y < GRID) out.push(y * GRID + x); }
    return out;
  }
  const S = st.S[key === 'h' ? st.hall : key === 'c' ? st.ch : st.stores[+key.slice(1)]];
  for (let y = S.y0 - 1; y <= S.y0 + S.s; y++) for (let x = S.x0 - 1; x <= S.x0 + S.s; x++) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    if (x >= S.x0 && x < S.x0 + S.s && y >= S.y0 && y < S.y0 + S.s) continue;
    out.push(y * GRID + x);
  }
  return out;
}
function raidField(st, key) {
  const f0 = st.ff[key]; if (f0 && f0.g === st.gen) return f0;
  const N = GRID * GRID, d = new Float64Array(N).fill(1e9), ti = key === 'h' ? st.hall : key === 'c' ? st.ch : key[0] === 's' ? st.stores[+key.slice(1)] : -1;
  /* tas binaire ; à égalité, la plus petite case d'abord (même ordre partout) */
  const hd = [], hi = [];
  const less = (da, ia, db, ib) => da < db || (da === db && ia < ib);
  const push = (i, x) => { let k = hd.length; hd.push(x); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (!less(x, i, hd[p], hi[p])) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; } hd[k] = x; hi[k] = i; };
  for (const g of raidGoals(st, key)) if (d[g] > 0) { d[g] = 0; push(g, 0); }
  while (hd.length) {
    const i = hi[0], di = hd[0], li = hi.pop(), ld = hd.pop(), n = hd.length;
    if (n > 0) {
      let k = 0;
      for (;;) { const l = 2 * k + 1; if (l >= n) break; const r = l + 1, m = r < n && less(hd[r], hi[r], hd[l], hi[l]) ? r : l; if (!less(hd[m], hi[m], ld, li)) break; hd[k] = hd[m]; hi[k] = hi[m]; k = m; }
      hd[k] = ld; hi[k] = li;
    }
    if (di > d[i]) continue;
    const ec = raidCost(st, i, ti); if (ec >= 1e7) continue;      // on ne traverse ni la halle ni la cible
    const x = i % GRID, y = (i / GRID) | 0;
    for (const nb of RAID_NB) {
      const nx = x + nb[0], ny = y + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (nb[0] && nb[1] && (st.occ[y * GRID + nx] || st.occ[ny * GRID + x])) continue;   // pas de coin coupé entre deux murs
      const ni = ny * GRID + nx, nd = di + ec * nb[2];
      if (nd < d[ni]) { d[ni] = nd; push(ni, nd); }
    }
  }
  return (st.ff[key] = { d, g: st.gen, ti });
}
/* Les héros passent par les cases libres, les portes et les ruines (pas à travers les murs ni les bâtiments). */
const raidHeroPass = (st, i) => { const o = st.occ[i] - 1; return o < 0 || st.S[o].kind === 'gate'; };
function raidHeroField(st, goal) {
  const f0 = st.hf.get(goal); if (f0 && f0.g === st.gen) return f0.d;
  const N = GRID * GRID, d = new Float64Array(N).fill(1e9), q = [goal]; d[goal] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % GRID, y = (i / GRID) | 0;
    for (const nb of RAID_NB) {
      const nx = x + nb[0], ny = y + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = ny * GRID + nx; if (d[ni] < 1e9 || !raidHeroPass(st, ni)) continue;
      if (nb[0] && nb[1] && (!raidHeroPass(st, y * GRID + nx) || !raidHeroPass(st, ny * GRID + x))) continue;
      d[ni] = d[i] + 1; q.push(ni);
    }
  }
  if (st.hf.size > 80) st.hf.clear();
  st.hf.set(goal, { d, g: st.gen });
  return d;
}

/* ---------- dégâts ---------- */
function raidHurtFoe(st, u, v, by) {
  if (!raidAlive(u) || !(v > 0)) return;
  u.hp -= v; st.ev.push({ k: 'hit', id: u.id, v: Math.round(v) });
  if (u.hp <= 0) { raidKill(st, u); if (by && by.kind === 'guard') by.kills++; }
}
/* Un garde touché : il esquive peut-être, son armure encaisse, ses épines renvoient une part du coup ; à 0, il tombe (blessé). */
function raidHurtGuard(st, g, v, u) {
  if (g.ko) return;
  if (g.dodge > 0 && raidRnd(st) < g.dodge) { st.ev.push({ k: 'dodge', id: g.id }); return; }
  const n = v * (1 - g.armor); g.hp -= n; st.ev.push({ k: 'hurt', id: g.id, v: Math.round(n) });
  if (g.thorns > 0 && u) raidHurtFoe(st, u, n * g.thorns, g);
  if (g.hp <= 0) { g.hp = 0; g.ko = true; g.dead = true; st.ev.push({ k: 'ko', id: g.id, x: g.x, y: g.y }); }
}
function raidKill(st, u) {
  const D = RAID_FOES[u.type];
  u.hp = 0; u.dead = true; st.kills++;
  st.gold += D.gold * (1 + 0.1 * (st.L - 1)); st.xp += D.xp * (1 + 0.25 * (st.L - 1));
  if (u.loot) { st.back[u.loot[0]] = (st.back[u.loot[0]] || 0) + u.loot[1]; st.ev.push({ k: 'drop', id: u.id, x: u.x, y: u.y, r: u.loot[0], n: u.loot[1] }); u.loot = null; }
  st.ev.push({ k: 'die', id: u.id, x: u.x, y: u.y, big: u.big });
}
function raidHurtHero(st, h, v) {
  if (h.ko) return;
  const n = v * (1 - h.armor); h.hp -= n; st.ev.push({ k: 'hurt', id: h.id, v: Math.round(n) });
  if (h.hp <= 0) { h.hp = 0; h.ko = true; h.dead = true; st.ev.push({ k: 'ko', id: h.id, x: h.x, y: h.y }); }
}
function raidHurtStruct(st, si, v) {
  const S = st.S[si]; if (S.dead || S.kind === 'halle') return;
  S.hp -= v; S.hitT = st.t;
  if (S.hp <= 0) {
    S.hp = 0; S.dead = true; raidMark(st, S, 0); st.gen++;
    if (S.kind !== 'bld' && S.kind !== 'store' && S.kind !== 'chambre') st.broke++;
    st.ev.push({ k: 'break', si, x: S.x, y: S.y, kind: S.kind });
  }
}

/* ---------- chacun son tour ---------- */
function raidSpawn(st, u) {
  const P = st.inp.P[u.pi] || st.inp.P[0], j = (raidRnd(st) - 0.5) * 0.6, side = P[2];
  u.x = u.px = P[0] + 0.5 + (side === 0 || side === 2 ? j : 0);
  u.y = u.py = P[1] + 0.5 + (side === 1 || side === 3 ? j : 0);
  u.on = true;
  /* le voleur file vers les réserves (l'entrepôt le plus facile à atteindre) ; s'il n'y en a pas, vers la halle */
  if (u.thief && st.stores.length) { const ci = raidCell(u.y) * GRID + raidCell(u.x); let bk = '', bd = 1e18; st.stores.forEach((si, k) => { const dd = raidField(st, 's' + k).d[ci]; if (dd < bd) { bd = dd; bk = 's' + k; } }); u.tk = bk; }
  st.ev.push({ k: 'spawn', id: u.id, x: u.x, y: u.y });
}
function raidMoveTo(u, tx, ty, sp) {
  const dx = tx - u.x, dy = ty - u.y, L = raidLen(dx, dy); if (L < 1e-6) return;
  const k = Math.min(sp, L) / L; u.x += dx * k; u.y += dy * k; u.mv = true; u.fx = dx / L; u.fy = dy / L;
}
/* Pillage : chacun emporte sa part (le voleur prend de l'or s'il y en a) ; à la halle, le cœur du village, la part est plus grosse.
   Jamais plus de 30 % d'une ressource par raid. */
function raidTake(st, u) {
  const T = st.S[raidField(st, u.tk).ti], heart = !!T && T.kind === 'halle', lil = !!T && T.kind === 'chambre';
  if (heart && !st.heart) { st.heart = 1; st.ev.push({ k: 'heart', id: u.id }); }
  if (lil && !st.lil) { st.lil = 1; st.ev.push({ k: 'lilou', id: u.id }); }        // la chambre de Lilou fouillée : elle a très peur
  const want = Math.round(u.carry * st.lootMul * (heart || lil ? 1.5 : 1));
  const avail = k => Math.max(0, Math.min(st.stock[k] || 0, Math.floor((st.inp.R[k] || 0) * 0.3) - (st.taken[k] || 0)));
  let res = null;
  if (u.thief && avail('or') >= 5) res = 'or';
  else for (const k of RAID_LOOT) if (avail(k) > 0 && (!res || avail(k) > avail(res))) res = k;
  const n = res ? Math.min(want, avail(res)) : 0;
  if (n > 0) { st.stock[res] -= n; st.taken[res] = (st.taken[res] || 0) + n; u.loot = [res, n]; st.ev.push({ k: 'loot', id: u.id, r: res, n }); }
  u.goal = 'h';
}
function raidTrapCheck(st, u) {
  const ti = st.trapAt[raidCell(u.y) * GRID + raidCell(u.x)] - 1; if (ti < 0) return;
  const T = st.traps[ti]; if (T.uses <= 0) return;
  if (T.type === 'piege') {
    if (T.cd > 1e-9) return;
    T.uses--; T.cd = 2; T.shown = true;
    st.ev.push({ k: 'trap', i: ti, x: T.x + 0.5, y: T.y + 0.5, t: 'piege' });
    for (const o of st.foes) if (raidAlive(o) && raidCell(o.x) === T.x && raidCell(o.y) === T.y) raidHurtFoe(st, o, T.dmg * st.defMul);
  } else if (u.root <= 0) {
    T.uses--; T.shown = true; u.root = T.root * (u.type === 'troll' ? 0.5 : 1);
    st.ev.push({ k: 'trap', i: ti, x: T.x + 0.5, y: T.y + 0.5, t: 'filet', id: u.id });
  }
}
function raidFoeStep(st, u) {
  if (!raidAlive(u)) return;
  u.mv = false; u.atkT -= RAID_DT; if (u.root > 0) u.root -= RAID_DT;
  /* 1) un héros ou un garde à portée : on se bat (les voleurs, eux, ne se battent jamais) */
  if (u.fight) {
    let h = null, bd = 1e9;
    for (const o of st.heroes) { if (o.ko) continue; const d = raidDist(u, o); if (d <= u.r + o.r + u.reach && d < bd) { bd = d; h = o; } }
    for (const o of st.guards) { if (o.ko) continue; const d = raidDist(u, o); if (d <= u.r + o.r + u.reach && d < bd) { bd = d; h = o; } }
    if (h) { raidFace(u, h); if (u.atkT <= 1e-9) { u.atkT = u.rate; u.atkN++; if (h.kind === 'guard') raidHurtGuard(st, h, u.dmg, u); else raidHurtHero(st, h, u.dmg); } return; }
  }
  if (u.atkT < 0) u.atkT = 0;
  /* 2) en plein pillage */
  if (u.pl > 0) { u.pl -= RAID_DT; if (u.pl <= 0) raidTake(st, u); return; }
  if (u.root > 0) return;
  /* 3) en route : vers sa cible, puis vers son portail avec le butin */
  const f = raidField(st, u.goal === 'h' ? 'p' + u.pi : u.tk), cx = raidCell(u.x), cy = raidCell(u.y), ci = cy * GRID + cx;
  if (f.d[ci] <= 0) {
    if (u.goal === 'h') {
      /* il rentre dans le portail (au bord de la vallée, le terrain est libre) avant de disparaître */
      const P = st.inp.P[u.pi] || st.inp.P[0], px = P[0] + 0.5, py = P[1] + 0.5;
      if (raidLen(u.x - px, u.y - py) > 0.45) { raidMoveTo(u, px, py, u.speed * RAID_DT * (u.loot ? 0.85 : 1)); return; }
      u.out = true; st.esc++;
      if (u.loot) st.lost[u.loot[0]] = (st.lost[u.loot[0]] || 0) + u.loot[1];
      st.ev.push({ k: 'escape', id: u.id, x: u.x, y: u.y, r: u.loot ? u.loot[0] : '', n: u.loot ? u.loot[1] : 0 });
      return;
    }
    u.pl = u.thief ? 1.0 : 1.5;
    const T = st.S[f.ti]; if (T) raidFace(u, T);
    st.ev.push({ k: 'plunder', id: u.id });
    return;
  }
  let best = -1, bv = 1e18;
  for (const nb of RAID_NB) {
    const nx = cx + nb[0], ny = cy + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
    if (nb[0] && nb[1] && (st.occ[cy * GRID + nx] || st.occ[ny * GRID + cx])) continue;
    const ni = ny * GRID + nx, c = raidCost(st, ni, f.ti); if (c >= 1e7) continue;
    const val = f.d[ni] + c * nb[2];
    if (val < bv) { bv = val; best = ni; }
  }
  if (best < 0) return;
  const o = st.occ[best] - 1;
  if (o >= 0) {
    /* le chemin passe par un mur, une porte (ou, faute de mieux, un bâtiment) : on le casse */
    const S = st.S[o];
    if (raidDistRect(u.x, u.y, S) <= u.r + 0.4) { raidFace(u, S); if (u.atkT <= 1e-9) { u.atkT = u.rate; u.atkN++; raidHurtStruct(st, o, u.sdmg * (S.kind === 'wall' || S.kind === 'gate' || S.kind === 'tower' ? u.wall : 1)); } return; }
    const px = Math.max(S.x0, Math.min(u.x, S.x0 + S.s)), py = Math.max(S.y0, Math.min(u.y, S.y0 + S.s)), dx = px - u.x, dy = py - u.y, L = raidLen(dx, dy), want = L - (u.r + 0.3);
    if (want > 0 && L > 1e-6) { const k = Math.min(u.speed * RAID_DT, want) / L; u.x += dx * k; u.y += dy * k; u.mv = true; u.fx = dx / L; u.fy = dy / L; }
    return;
  }
  raidMoveTo(u, best % GRID + 0.5, ((best / GRID) | 0) + 0.5, u.speed * RAID_DT * (u.loot ? 0.85 : 1));
  raidTrapCheck(st, u);
}
function raidHeroStep(st, h) {
  if (h.ko) return;
  h.atkT -= RAID_DT; h.mv = false;
  /* d'abord ceux qui emportent du butin ou qui pillent, puis les voleurs, puis le plus proche */
  const score = u => raidDist(h, u) - (u.loot ? 3 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1 : 0);
  let tgt = null, bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidDist(h, u) > h.range + u.r) continue; const sc = score(u); if (sc < bd) { bd = sc; tgt = u; } }
  if (tgt) {
    raidFace(h, tgt);
    if (h.atkT <= 1e-9) {
      h.atkT = h.cd; h.atkN++;
      st.ev.push({ k: 'hhit', id: h.id, tgt: tgt.id, sh: h.range > 2 ? h.cls : '' });
      raidHurtFoe(st, tgt, h.dmg);
      if (h.cls === 'mage') for (const o of st.foes) if (o !== tgt && raidAlive(o) && raidDist(o, tgt) <= 1.2 + o.r) raidHurtFoe(st, o, h.dmg * 0.5);
      if (h.cls === 'pretre') {
        let w = null; for (const o of st.heroes) if (!o.ko && o.hp < o.hpMax * 0.8 && (!w || o.hp / o.hpMax < w.hp / w.hpMax)) w = o;
        if (w) { const n = Math.min(w.hpMax - w.hp, h.dmg * 1.2); w.hp += n; st.ev.push({ k: 'heal', id: w.id, v: Math.round(n) }); }
      }
    }
    return;
  }
  if (h.atkT < 0) h.atkT = 0;
  /* l'ennemi le plus proche dans la zone de défense, sinon retour à son poste */
  const H = st.S[st.hall]; let ch = null; bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidLen(u.x - H.x, u.y - H.y) > RAID_ZONE + (u.loot ? 2.5 : 0.5)) continue; const sc = score(u); if (sc < bd) { bd = sc; ch = u; } }   // un pillard qui s'enfuit, on le poursuit un peu plus loin
  const gx = ch ? ch.x : h.home[0], gy = ch ? ch.y : h.home[1];
  if (!ch && raidLen(h.x - gx, h.y - gy) < 0.15) return;
  const cx = raidCell(h.x), cy = raidCell(h.y), goal = raidCell(gy) * GRID + raidCell(gx);
  let tx = gx, ty = gy;
  if (cy * GRID + cx !== goal) {
    const d = raidHeroField(st, goal);
    let best = -1, bv = d[cy * GRID + cx];
    for (const nb of RAID_NB) {
      const nx = cx + nb[0], ny = cy + nb[1]; if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const ni = ny * GRID + nx; if (!raidHeroPass(st, ni)) continue;
      if (nb[0] && nb[1] && (!raidHeroPass(st, cy * GRID + nx) || !raidHeroPass(st, ny * GRID + cx))) continue;
      if (d[ni] < bv) { bv = d[ni]; best = ni; }
    }
    if (best < 0) return;
    tx = best % GRID + 0.5; ty = ((best / GRID) | 0) + 0.5;
  }
  const dx = tx - h.x, dy = ty - h.y, L = raidLen(dx, dy); if (L < 1e-6) return;
  const k = Math.min(h.speed * RAID_DT, L) / L, nx = h.x + dx * k, ny = h.y + dy * k;
  const far = raidLen(nx - H.x, ny - H.y);
  if (far > RAID_ZONE + 3 && far > raidLen(h.x - H.x, h.y - H.y)) return;     // on ne s'éloigne pas trop de la halle
  h.x = nx; h.y = ny; h.mv = true; h.fx = dx / L; h.fy = dy / L;
}
/* Un garde de la garnison : il frappe ce qui est à sa portée ; au corps à corps, il va au-devant de ce qui entre dans le cercle
   de son poste, sans jamais en sortir (ni traverser un mur) ; sinon, il reprend sa place dans la formation. */
function raidGuardStep(st, g) {
  if (g.ko) return;
  g.atkT -= RAID_DT; g.mv = false;
  if (g.regen > 0 && g.hp < g.hpMax) g.hp = Math.min(g.hpMax, g.hp + g.hpMax * g.regen / 100 * RAID_DT);
  const P0 = g.post, melee = g.range < 2, lanc = g.type === 'lanc';
  /* d'abord ceux qui emportent du butin ou qui pillent, puis les voleurs ; les lanciers visent les trolls */
  const score = u => raidDist(g, u) - (u.loot ? 3 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1.5 : 0) - (lanc && u.big ? 3 : 0);
  let tgt = null, bd = 1e9;
  for (const u of st.foes) { if (!raidAlive(u) || raidDist(g, u) > g.range + u.r) continue; const sc = score(u); if (sc < bd) { bd = sc; tgt = u; } }
  if (tgt) {
    raidFace(g, tgt);
    if (g.atkT <= 1e-9) {
      g.atkT = g.cd; g.atkN++;
      st.ev.push({ k: 'ghit', id: g.id, tgt: tgt.id, sh: melee ? '' : g.type });
      raidHurtFoe(st, tgt, g.dmg * (lanc && tgt.big ? SOLDIERS.lanc.troll : 1), g);
      if (g.type === 'mage') for (const o of st.foes) if (o !== tgt && raidAlive(o) && raidDist(o, tgt) <= SOLDIERS.mage.splash + o.r) raidHurtFoe(st, o, g.dmg * 0.6, g);
    }
    return;
  }
  if (g.atkT < 0) g.atkT = 0;
  let gx = g.home[0], gy = g.home[1];
  if (melee) {
    let ch = null; bd = 1e9;
    for (const u of st.foes) { if (!raidAlive(u) || raidLen(u.x - P0.x, u.y - P0.y) > P0.r + 0.3) continue; const sc = score(u); if (sc < bd) { bd = sc; ch = u; } }
    if (ch) { gx = ch.x; gy = ch.y; }
  }
  const dx = gx - g.x, dy = gy - g.y, L = raidLen(dx, dy); if (L < 0.12) return;
  const k = Math.min(g.speed * RAID_DT, L) / L;
  let nx = g.x + dx * k, ny = g.y + dy * k;
  const ox = nx - P0.x, oy = ny - P0.y, oL = raidLen(ox, oy);
  if (oL > P0.r) { nx = P0.x + ox / oL * P0.r; ny = P0.y + oy / oL * P0.r; }
  if (raidBlocked(st, raidCell(nx), raidCell(ny))) {
    if (!raidBlocked(st, raidCell(nx), raidCell(g.y))) ny = g.y; else if (!raidBlocked(st, raidCell(g.x), raidCell(ny))) nx = g.x; else return;
  }
  if (raidLen(nx - g.x, ny - g.y) < 1e-6) return;
  g.fx = dx / L; g.fy = dy / L; g.x = nx; g.y = ny; g.mv = true;
}
function raidTowerStep(st, tw, i) {
  const S = st.S[tw.si]; if (S.dead) return;
  tw.cd -= RAID_DT; if (tw.cd > 1e-9) return;
  /* les archers visent d'abord les pillards chargés de butin, puis les voleurs et les blessés ; un troll seulement s'il n'y a rien d'autre */
  let best = null, bs = 1e9;
  for (const u of st.foes) {
    if (!raidAlive(u)) continue;
    const d = raidLen(u.x - S.x, u.y - S.y); if (d > tw.range) continue;
    const sc = d - (u.loot ? 4 : 0) - (u.pl > 0 ? 2 : 0) - (u.thief ? 1.5 : 0) + (u.big ? 2.5 : 0) - 2 * (1 - u.hp / u.hpMax);
    if (sc < bs) { bs = sc; best = u; }
  }
  if (!best) { tw.cd = 0.2; return; }
  tw.cd = tw.rate; tw.n++;
  st.ev.push({ k: 'tshot', i, si: tw.si, tgt: best.id, x: S.x, y: S.y });
  raidHurtFoe(st, best, tw.dmg * st.defMul);
}
/* Les assaillants s'écartent un peu les uns des autres (sans jamais entrer dans un mur). */
function raidNudge(st, u, dx, dy) { if (u.pl > 0) return; const x = u.x + dx, y = u.y + dy; if (x < 0.05 || y < 0.05 || x > GRID - 0.05 || y > GRID - 0.05 || st.occ[raidCell(y) * GRID + raidCell(x)]) return; u.x = x; u.y = y; }
function raidSeparate(st) {
  const L = st.foes.filter(raidAlive);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, m = a.r + b.r;
    if (d2 >= m * m) continue;
    const d = Math.sqrt(d2), nx = d < 1e-4 ? 1 : dx / d, ny = d < 1e-4 ? 0 : dy / d, push = (m - d) * 0.25;
    raidNudge(st, a, -nx * push, -ny * push); raidNudge(st, b, nx * push, ny * push);
  }
}
function raidStep(st) {
  if (st.over) return;
  for (const u of st.foes) { u.px = u.x; u.py = u.y; }
  for (const h of st.heroes) { h.px = h.x; h.py = h.y; }
  for (const g of st.guards) { g.px = g.x; g.py = g.y; }
  for (const u of st.foes) if (!u.on && !u.dead && !u.out && st.t + 1e-9 >= u.delay) raidSpawn(st, u);
  for (const T of st.traps) if (T.cd > 0) T.cd -= RAID_DT;
  st.towers.forEach((tw, i) => raidTowerStep(st, tw, i));
  for (const h of st.heroes) raidHeroStep(st, h);
  for (const g of st.guards) raidGuardStep(st, g);
  for (const u of st.foes) raidFoeStep(st, u);
  raidSeparate(st);
  st.t = Math.round((st.t + RAID_DT) * 10) / 10; st.n++;
  const waiting = st.foes.some(u => !u.on && !u.dead && !u.out), alive = st.foes.some(raidAlive);
  if (!waiting && !alive) st.over = true;
  else if (st.t >= RAID_LIMIT) {
    /* le temps est écoulé : ceux qui restent repartent par le portail (avec ce qu'ils portent) */
    for (const u of st.foes) if (raidAlive(u)) { u.out = true; st.esc++; if (u.loot) st.lost[u.loot[0]] = (st.lost[u.loot[0]] || 0) + u.loot[1]; st.ev.push({ k: 'escape', id: u.id, x: u.x, y: u.y, r: u.loot ? u.loot[0] : '', n: u.loot ? u.loot[1] : 0 }); }
    st.over = true;
  }
  if (st.over) st.ev.push({ k: 'end' });
}
function raidResult(st) {
  const dmg = [];
  for (const S of st.S) if ((S.kind === 'wall' || S.kind === 'gate' || S.kind === 'tower') && S.hp !== S.hp0) dmg.push([S.id, Math.max(0, Math.round(S.hp))]);
  const round = o => { const out = {}; for (const k of RAID_LOOT.concat(['or'])) { const n = Math.round(o[k] || 0); if (n > 0) out[k] = n; } return out; };
  const res = { k: st.kills, e: st.esc, f: st.foes.length, lost: round(st.lost), back: round(st.back), h: st.heart, g: Math.round(st.gold), xp: Math.round(st.xp), br: st.broke,
    ko: st.heroes.filter(h => h.ko).map(h => h.id), dmg, s: Math.round(st.t) };
  /* la garnison : ennemis abattus par chaque garde, et ceux qui sont tombés */
  if (st.guards.length) { res.gd = st.guards.map(g => [g.id, g.kills, g.ko ? 1 : 0]); res.gk = st.guards.reduce((a, g) => a + g.kills, 0); }
  if (st.inp.C) res.c = st.lil | 0;                    // la chambre de Lilou a-t-elle été fouillée ?
  return res;
}
/* Tout le raid d'un coup, à la minute où il part ; le village garde de quoi le rediffuser. */
function raidResolve(v, t) {
  const inp = raidInput(v, t), st = raidStart(inp);
  for (let guard = 0; !st.over && guard < 4000; guard++) { raidStep(st); st.ev.length = 0; }
  raidApply(v, t, inp, raidResult(st));
}
function raidApply(v, t, inp, res) {
  for (const [id, hp] of res.dmg) { const b = v.b.find(x => x.id === id); if (!b || !BLD[b.type].hps) continue; if (hp >= hpMaxOf(b)) delete b.hp; else b.hp = hp; }
  for (const k in res.lost) v.r[k] = Math.max(0, (v.r[k] || 0) - res.lost[k]);
  if (res.g) v.r.or = (v.r.or || 0) + res.g;
  const ups = [];
  if (res.xp) for (const h of Object.values(v.heroes || {}).filter(Boolean).sort((a, b) => (a.n || 0) - (b.n || 0))) { const lv0 = h.lvl; if (heroAddXp(h, h.race === 'humain' ? res.xp * 1.1 : res.xp)) { ups.push(h.name + ' (niveau ' + h.lvl + ')'); chronLvl(v, t, h, lv0); } }
  if (res.h) v.raidMor = t + DAY;
  /* la chambre de Lilou fouillée (dès le chapitre 3 de la couronne) : elle a très peur */
  if (res.c && v.lilou) { lilouAdd(v.lilou, -CROWN_FEAR); }
  /* la garnison : de l'expérience pour ceux qui ont tenu (et un raid de plus dans leur série), 8 heures de repos pour ceux qui sont tombés (série perdue) */
  const gm = 1 + 0.2 * ((inp.L | 0) - 1), hurt = [], titles = [];
  for (const [id, kills, ko] of res.gd || []) {
    const s = v.sol && v.sol[id]; if (!s) continue;
    s.kills = (s.kills | 0) + kills;
    if (ko) { const had = solTitle(s); s.hurt = t + SOL_HURT; s.vet = 0; hurt.push(solName(s) + (had ? ' (perd son titre : ' + had[1].toLowerCase() + ')' : '')); continue; }
    const was = solTitle(s);
    s.vet = (s.vet | 0) + 1; s.raids = (s.raids | 0) + 1;
    s.xp = Math.min(3 * solXpNeed(s.lvl), (s.xp | 0) + Math.round((15 + 5 * kills) * gm));
    const ti = solTitle(s); if (ti && ti !== was) titles.push(solName(s) + ' devient ' + ti[1].toLowerCase());
  }
  const orbs = garRaidOrbs(v, inp, res);
  const lostTxt = Object.keys(res.lost).map(k => res.lost[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', ');
  let m = (lostTxt ? 'Raid des gobelins : ' : 'Raid repoussé ! ') + res.k + ' ennemi' + (res.k > 1 ? 's' : '') + ' vaincu' + (res.k > 1 ? 's' : '') + ' sur ' + res.f;
  if (res.e) m += ', ' + res.e + ' enfui' + (res.e > 1 ? 's' : '') + (lostTxt ? ' avec ' + lostTxt : ' les mains vides');
  m += '.' + (res.g ? ' +' + res.g + ' or.' : '') + (res.br ? ' ' + res.br + ' défense' + (res.br > 1 ? 's détruites' : ' détruite') + ' : à réparer (menu Défense).' : '');
  addLog(v, t, m, 'raid');
  if (res.h) addLog(v, t, 'Les gobelins ont pillé la halle, le cœur du village : le moral baisse pour un jour.', 'raid');
  if (res.c && v.lilou) addLog(v, t, 'Les gobelins ont fouillé la chambre de Lilou : elle a eu très peur. Elle est maintenant ' + lilouMood(v.lilou).name + '.', 'lilou');
  /* la chronique : le tout premier raid, le premier repoussé */
  const lostAny = Object.keys(res.lost).length > 0;
  if (!(inp.n | 0)) chron(v, t, 'raid', lostAny ? 'Premier raid des gobelins : ils repartent avec une partie des réserves.' : 'Premier raid des gobelins, repoussé !');
  else if (!lostAny && !cntOf(v, 'rr')) chron(v, t, 'raid', 'Premier raid repoussé sans rien perdre !');
  if (!lostAny) { if (!v.cnt) v.cnt = { acc: 0, fete: 0, win: 0 }; v.cnt.rr = (v.cnt.rr | 0) + 1; }
  if (ups.length) addLog(v, t, 'En défendant le village : ' + ups.join(', ') + ' !', 'hero');
  if (res.gd) addLog(v, t, 'La garnison abat ' + res.gk + ' ennemi' + (res.gk > 1 ? 's' : '') + '.' + (hurt.length ? ' Blessé' + (hurt.length > 1 ? 's' : '') + ' (8 h de repos à la caserne) : ' + hurt.join(', ') + '.' : '') + (titles.length ? ' ' + titles.join(', ') + ' !' : ''), 'sol');
  if (orbs.length) addLog(v, t, 'Défense réussie : ' + orbs.map(orbLabel).join(', ') + ' pour la garnison.', 'sol');
  v.lastRaid = { t, n: inp.n, sd: inp.sd, L: inp.L, P: inp.P, B: inp.B, H: inp.H, F: inp.F, R: inp.R, res };
  if (inp.G) v.lastRaid.G = inp.G;
  if (inp.M) v.lastRaid.M = inp.M;
  if (inp.C) v.lastRaid.C = inp.C;
  if (orbs.length) v.lastRaid.orbs = orbs;
  const rnd = mulberry32((inp.sd ^ 0x63d83595) >>> 0);
  v.raid = { n: (inp.n | 0) + 1, next: t + RAID_GAP + Math.floor(rnd() * (RAID_GAP_RND / MIN)) * MIN, closed: (v.raid && v.raid.closed) | 0 };
}
/* Rediffusion : le même combat, rejoué à partir de ce que le village a gardé. */
const raidReplay = lr => raidStart({ t: lr.t, n: lr.n, sd: lr.sd, L: lr.L, P: lr.P, B: lr.B, H: lr.H, F: lr.F, R: lr.R, G: lr.G, M: lr.M, C: lr.C });

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

/* ===================== DONJONS : fabrication à partir d'une graine (pur, sans DOM) =====================
   Même graine + même niveau = même donjon, sur les deux téléphones. Une case = 1 unité (≈ un personnage). */
const DJ_TILE = { WALL: 0, FLOOR: 1 };
/* Salles faites main : largeur, hauteur, forme. */
const DJ_ROOMS = [
  { k: 'carree', w: 9, h: 9, shape: 'rect' }, { k: 'longue', w: 12, h: 8, shape: 'rect' }, { k: 'haute', w: 8, h: 12, shape: 'rect' },
  { k: 'piliers', w: 11, h: 11, shape: 'pillars' }, { k: 'grande', w: 13, h: 10, shape: 'pillars' }, { k: 'carrefour', w: 11, h: 11, shape: 'cross' },
  { k: 'enL', w: 11, h: 10, shape: 'L' }, { k: 'couloir', w: 13, h: 7, shape: 'rect' }, { k: 'ronde', w: 11, h: 11, shape: 'round' },
];
const DJ_BOSS = { k: 'arene', w: 14, h: 14, shape: 'arena' };
/* Monstres (statistiques de base au niveau 1). w : fréquence dans le thème. */
const DJ_MONSTERS = {
  /* la mine des gobelins */
  gobelin: { name: 'Gobelin', hp: 40, dmg: 5, speed: 2.8, range: 1.1, rate: 1.7, xp: 4, w: 4 },
  archer: { name: 'Gobelin archer', hp: 28, dmg: 6, speed: 2.4, range: 6, rate: 2.2, xp: 5, w: 2, ranged: true },
  chaman: { name: 'Chaman', hp: 34, dmg: 4, speed: 2.2, range: 5, rate: 2.6, xp: 6, w: 1, heals: true },
  troll: { name: 'Troll', hp: 130, dmg: 14, speed: 1.6, range: 1.4, rate: 2.4, xp: 12, w: 1, big: true },
  /* la crypte des rois */
  squelette: { name: 'Squelette', hp: 44, dmg: 5, speed: 2.5, range: 1.2, rate: 1.8, xp: 4, w: 4 },
  archerSq: { name: 'Squelette archer', hp: 26, dmg: 6, speed: 2.2, range: 6, rate: 2.2, xp: 5, w: 2, ranged: true },
  goule: { name: 'Goule', hp: 30, dmg: 4, speed: 3.7, range: 1.0, rate: 1.0, xp: 4, w: 2 },
  spectre: { name: 'Spectre', hp: 32, dmg: 6, speed: 2.6, range: 5.5, rate: 2.4, xp: 6, w: 1, ranged: true, evade: 0.3, shot: 'ghost' },
  necromant: { name: 'Nécromant', hp: 34, dmg: 4, speed: 2.1, range: 5, rate: 2.8, xp: 7, w: 1, raises: true },
  golem: { name: 'Golem d’os', hp: 140, dmg: 15, speed: 1.5, range: 1.4, rate: 2.5, xp: 13, w: 1, big: true },
  /* le portail démoniaque (étape 4) : des diablotins, et les gobelins et trolls qui attendent d'en sortir */
  diablotin: { name: 'Diablotin', hp: 30, dmg: 5, speed: 3.6, range: 1.0, rate: 1.1, xp: 4, w: 4 },
  lanceflamme: { name: 'Diablotin cracheur de feu', hp: 26, dmg: 7, speed: 2.4, range: 5.5, rate: 2.4, xp: 5, w: 2, ranged: true, shot: 'fire' },
};
const DJ_BOSSES = {
  chefTroll: { name: 'Chef troll', hp: 520, dmg: 16, speed: 1.8, range: 1.6, rate: 2.1, xp: 80, big: true, boss: true },
  roiSquelette: { name: 'Roi squelette', hp: 560, dmg: 15, speed: 1.9, range: 1.7, rate: 2.0, xp: 85, big: true, boss: true },
  gardien: { name: 'Gardien du portail', hp: 540, dmg: 15, speed: 1.9, range: 1.7, rate: 2.0, xp: 85, big: true, boss: true },
  /* l'histoire (lot A) : le gardien de la Source du Mal, un gros troll qui annonce son coup (de quoi apprendre la roulade) */
  gardeSource: { name: 'Gardien de la Source', hp: 230, dmg: 8, speed: 1.6, range: 1.6, rate: 2.2, xp: 40, big: true, boss: true },
};
/* Renforts des boss qui appellent à l'aide (tempête d'os ou pluie de feu) */
const DJ_BOSS_ADDS = { roiSquelette: ['squelette', 'squelette', 'squelette', 'archerSq'], gardien: ['diablotin', 'diablotin', 'diablotin', 'lanceflamme'] };
const DJ_THEMES = {
  mine: { name: 'Mine des gobelins', the: 'la mine des gobelins', monsters: ['gobelin', 'archer', 'chaman', 'troll'], boss: 'chefTroll' },
  crypte: { name: 'Crypte des rois', the: 'la crypte des rois', monsters: ['squelette', 'archerSq', 'goule', 'spectre', 'necromant', 'golem'], boss: 'roiSquelette' },
  portail: { name: 'Portail démoniaque', the: 'le portail démoniaque', monsters: ['diablotin', 'lanceflamme', 'gobelin', 'troll'], boss: 'gardien', rooms: 3 },
  /* la mission d'intro (l'histoire) : un petit donjon fait main, guidé par Sukhoï (genSource) */
  source: { name: 'La Source du Mal', the: 'la Source du Mal', monsters: ['gobelin', 'archer', 'chaman'], boss: 'gardeSource', rooms: 3 },
};
const DJ_PRISONER_CHANCE = lvl => Math.min(0.10, 0.03 + 0.007 * lvl);   // rare : de 4 % (niveau 1) à 10 %

function djCarve(grid, W, x0, y0, w, h, shape) {
  const cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (shape === 'cross' && (i < (w / 3 | 0) || i >= w - (w / 3 | 0)) && (j < (h / 3 | 0) || j >= h - (h / 3 | 0))) continue;
    if (shape === 'L' && i >= (w / 2 | 0) && j < (h / 2 | 0)) continue;
    if (shape === 'round') { const dx = (i + 0.5) / w - 0.5, dy = (j + 0.5) / h - 0.5; if (dx * dx + dy * dy > 0.25) continue; }
    if ((shape === 'pillars' || shape === 'arena') && [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]].some(([a, b]) => a === i && b === j)) continue;
    grid[(y0 + j) * W + x0 + i] = DJ_TILE.FLOOR; cells.push([x0 + i, y0 + j]);
  }
  return cells;
}
function djCorridor(grid, W, a, b) {
  /* Couloir de 3 cases de large, en L : d'abord à l'horizontale, puis à la verticale. */
  const [ax, ay] = a, [bx, by] = b;
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let d = -1; d <= 1; d++) grid[(ay + d) * W + x] = DJ_TILE.FLOOR;
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) for (let d = -1; d <= 1; d++) grid[y * W + bx + d] = DJ_TILE.FLOOR;
}
const djCenter = r => [r.x + (r.w >> 1), r.y + (r.h >> 1)];

/* Fabrique un donjon : 5 à 6 salles de combat (2 ou 3 vagues de monstres chacune) + l'arène du boss, une salle annexe (trésor ou prisonnier).
   opts (étages des Profondeurs) : { rooms: nombre de salles de combat, boss: false pour un étage sans boss }. */
function genDungeon(seed, lvl, theme, opts) {
  if (theme === 'source') return genSource(seed);
  const o = opts || {}, R = mulberry32((seed ^ 0x9e3779b9) >>> 0), pick = a => a[Math.floor(R() * a.length)];
  const T = DJ_THEMES[theme] || DJ_THEMES.mine, coin = R() < 0.5 ? 1 : 0, nFight = o.rooms || T.rooms || 5 + coin, withBoss = o.boss !== false;
  let rooms = null;
  for (let attempt = 0; attempt < 50 && !rooms; attempt++) {
    const list = [{ k: 'entree', w: 8, h: 8, shape: 'rect', kind: 'start', x: 0, y: 0 }];
    let ok = true;
    for (let i = 0; i < nFight + (withBoss ? 1 : 0) && ok; i++) {
      const prev = list[list.length - 1], boss = i === nFight, t = boss ? DJ_BOSS : pick(DJ_ROOMS);
      let placed = null;
      for (let tries = 0; tries < 40 && !placed; tries++) {
        const dir = pick(['E', 'E', 'E', 'N', 'S']), gap = 4 + Math.floor(R() * 4);
        const x = dir === 'E' ? prev.x + prev.w + gap : prev.x + Math.floor(R() * 7) - 3;
        const y = dir === 'E' ? prev.y + Math.floor(R() * 9) - 4 : dir === 'N' ? prev.y - t.h - gap : prev.y + prev.h + gap;
        const c = { k: t.k, w: t.w, h: t.h, shape: t.shape, kind: boss ? 'boss' : 'fight', x, y };
        /* Le donjon reste ramassé (au plus ≈ 92 × 60 cases) : moins de marche, plus de combat. */
        const all = list.concat([c]), bw = Math.max(...all.map(r => r.x + r.w)) - Math.min(...all.map(r => r.x)), bh = Math.max(...all.map(r => r.y + r.h)) - Math.min(...all.map(r => r.y));
        if (bw <= (attempt < 30 ? 88 : 140) && bh <= (attempt < 30 ? 56 : 110) && !list.some(r => c.x < r.x + r.w + 2 && c.x + c.w + 2 > r.x && c.y < r.y + r.h + 2 && c.y + c.h + 2 > r.y)) placed = c;
      }
      if (placed) list.push(placed); else ok = false;
    }
    if (ok) rooms = list;
  }
  /* Salle annexe : accrochée à une salle du milieu (trésor, ou prisonnier, rare). */
  const prisoner = R() < DJ_PRISONER_CHANCE(lvl);
  for (let i = 2; i < rooms.length - 1; i++) {
    const host = rooms[i], w = 7, h = 6, g = 4, opts = [[host.x + (host.w >> 1) - 3, host.y - h - g], [host.x + (host.w >> 1) - 3, host.y + host.h + g], [host.x - w - g, host.y + (host.h >> 1) - 3], [host.x + host.w + g, host.y + (host.h >> 1) - 3]];
    const spot = opts.find(([x, y]) => !rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y));
    if (spot) { rooms.push({ k: prisoner ? 'cachot' : 'tresor', w, h, shape: 'rect', kind: prisoner ? 'prisoner' : 'treasure', x: spot[0], y: spot[1], host: i }); break; }
  }
  /* Grille : on décale tout pour commencer à (2, 2). */
  const minX = Math.min(...rooms.map(r => r.x)) - 2, minY = Math.min(...rooms.map(r => r.y)) - 2;
  for (const r of rooms) { r.x -= minX; r.y -= minY; }
  const W = Math.max(...rooms.map(r => r.x + r.w)) + 2, H = Math.max(...rooms.map(r => r.y + r.h)) + 2;
  const grid = new Uint8Array(W * H);
  for (const r of rooms) r.cells = djCarve(grid, W, r.x, r.y, r.w, r.h, r.shape);
  const chain = rooms.filter(r => r.host == null);
  for (let i = 1; i < chain.length; i++) djCorridor(grid, W, djCenter(chain[i - 1]), djCenter(chain[i]));
  for (const r of rooms) if (r.host != null) djCorridor(grid, W, djCenter(rooms[r.host]), djCenter(r));
  /* Contenu : monstres (3 à 6 par salle de combat), pièges, coffres, autel, boss. */
  const inner = r => r.cells.filter(([x, y]) => x > r.x + 1 && x < r.x + r.w - 2 && y > r.y + 1 && y < r.y + r.h - 2);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const weights = T.monsters.map(k => DJ_MONSTERS[k].w), wsum = weights.reduce((a, b) => a + b, 0);
  const monsterType = () => { let x = R() * wsum; for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return T.monsters[i]; } return T.monsters[0]; };
  let mid = 1;
  const monsters = [], traps = [], chests = [];
  /* Vagues : la 1re attend dans la salle ; les suivantes sortent des galeries quand la précédente est vaincue.
     2 vagues dans les premières salles, 3 dans les dernières. */
  let fi = 0;
  rooms.forEach((r, ri) => {
    const free = shuffle(inner(r).slice());
    if (r.kind === 'fight') {
      const waves = fi < Math.ceil(nFight / 2) ? 2 : 3; fi++;
      const edge = shuffle(r.cells.filter(([x, y]) => x <= r.x + 1 || x >= r.x + r.w - 2 || y <= r.y + 1 || y >= r.y + r.h - 2));
      let used = 0;
      for (let w = 0; w < waves; w++) {
        const n = w === 0 ? 3 + Math.floor(R() * 3) : 3 + Math.floor(R() * 2), pool = w === 0 ? free : edge;
        for (let i = 0; i < n; i++) {
          const c = pool[(w === 0 ? i : used++) % pool.length];
          monsters.push({ id: mid++, room: ri, type: monsterType(), x: c[0] + 0.5, y: c[1] + 0.5, wave: w });
        }
      }
      if (R() < 0.5) for (const c of free.slice(6, 8)) traps.push({ room: ri, x: c[0], y: c[1] });
    } else if (r.kind === 'boss') monsters.push({ id: mid++, room: ri, type: T.boss, boss: true, x: r.x + r.w / 2, y: r.y + r.h / 2, wave: 0 });
    else if (r.kind === 'treasure') for (const c of free.slice(0, 2)) chests.push({ room: ri, x: c[0] + 0.5, y: c[1] + 0.5 });
  });
  const altarRoom = chain.length > 4 ? 2 + Math.floor(R() * (chain.length - 4)) : null;
  const altar = altarRoom != null ? djCenter(chain[altarRoom]) : null;
  const pris = rooms.find(r => r.kind === 'prisoner');
  return { seed, lvl, theme: DJ_THEMES[theme] ? theme : 'mine', W, H, grid, rooms, start: djCenter(rooms[0]), monsters, traps, chests, altar,
    prisoner: pris ? djCenter(pris) : null, exitRoom: rooms.indexOf(chain[chain.length - 1]), floor: o.floor || 0 };
}
/* La Source du Mal (mission d'intro) : toujours le même petit donjon, fait main. Entrée, 3 salles d'une seule vague
   (2 gobelins ; 3 gobelins, un archer et un coffre ; 2 gobelins et un chaman), puis la salle de la Source : le gardien,
   et au fond le berceau (la sortie). Personne n'y meurt : Sukhoï relève le héros (st.noDeath). */
function genSource(seed) {
  const rooms = [
    { k: 'entree', w: 8, h: 8, shape: 'rect', kind: 'start', x: 2, y: 5 },
    { k: 'carree', w: 9, h: 9, shape: 'rect', kind: 'fight', x: 15, y: 4 },
    { k: 'longue', w: 11, h: 9, shape: 'rect', kind: 'fight', x: 30, y: 4 },
    { k: 'carree', w: 9, h: 9, shape: 'pillars', kind: 'fight', x: 47, y: 4 },
    { k: 'source', w: 13, h: 13, shape: 'arena', kind: 'boss', x: 62, y: 2 },
  ];
  const W = 77, H = 17, grid = new Uint8Array(W * H);
  for (const r of rooms) r.cells = djCarve(grid, W, r.x, r.y, r.w, r.h, r.shape);
  for (let i = 1; i < rooms.length; i++) djCorridor(grid, W, djCenter(rooms[i - 1]), djCenter(rooms[i]));
  let mid = 1; const monsters = [];
  const put = (ri, type, dx, dy, boss) => { const r = rooms[ri]; monsters.push({ id: mid++, room: ri, type, x: r.x + dx + 0.5, y: r.y + dy + 0.5, wave: 0, boss: !!boss }); };
  put(1, 'gobelin', 5, 3); put(1, 'gobelin', 6, 6);
  put(2, 'gobelin', 4, 2); put(2, 'gobelin', 6, 6); put(2, 'gobelin', 8, 4); put(2, 'archer', 9, 2);
  put(3, 'gobelin', 4, 3); put(3, 'gobelin', 5, 6); put(3, 'chaman', 7, 4);
  put(4, 'gardeSource', 6, 6, true);
  const B = rooms[4];
  return { seed, lvl: 1, theme: 'source', W, H, grid, rooms, start: djCenter(rooms[0]), monsters, traps: [], chests: [{ room: 2, x: rooms[2].x + 9.5, y: rooms[2].y + 7.5 }], altar: null,
    prisoner: null, exitRoom: 4, floor: 0, cradle: [B.x + B.w - 3, B.y + (B.h >> 1)], tuto: true };
}
/* Cases atteignables depuis l'entrée (pour vérifier qu'aucune salle n'est coupée du reste). */
function djReach(d) {
  const seen = new Uint8Array(d.W * d.H), q = [d.start[1] * d.W + d.start[0]]; seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % d.W, y = (i / d.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * d.W + nx; if (nx >= 0 && ny >= 0 && nx < d.W && ny < d.H && !seen[ni] && d.grid[ni]) { seen[ni] = 1; q.push(ni); } }
  }
  return seen;
}

/* ===================== DONJONS : combat (pur, sans DOM) =====================
   20 pas par seconde. Le hasard vient de la graine : même départ et mêmes commandes = même combat.
   Coordonnées en cases (x vers l'est, y vers le sud) ; une entité = un cercle de rayon r. */
const DJ_DT = 0.05;
/* Roulade (bouton de tout héros) : un bond rapide dans la direction du joystick (ou devant soi), intouchable un instant. */
const DJ_ROLL = { cd: 4, t: 0.3, spd: 9, inv: 0.4 };
const DJ_POTION = 0.4;                                             // une potion rend 40 % de la vie
const djMul = lvl => Math.pow(1.1, Math.max(0, lvl - 1));          // héros : +10 % de vie et de dégâts par niveau
const djMobMul = lvl => Math.pow(1.12, Math.max(0, lvl - 1)) * (lvl <= 1 ? 0.85 : lvl === 2 ? 0.93 : 1);   // monstres : +12 % par niveau (les héros ont aussi leurs compétences) ; les 2 premiers niveaux plus doux
const djXpMul = lvl => 1 + 0.25 * (lvl - 1);                       // expérience selon le niveau du donjon
const djLootMul = lvl => 1 + 0.2 * (lvl - 1);
const DJ_CHEST = { pierre: 30, bois: 20 }, DJ_BOSS_LOOT = { pierre: 80, bois: 50, viande: 30 };
const DJ_BLESS = { force: 'Force : +20 % de dégâts', vigueur: 'Vigueur : +20 % de vie, soins complets', celerite: 'Célérité : plus rapide, compétences plus vite prêtes' };
/* Classes en donjon, au niveau 1 (cd : secondes entre deux attaques ; portée en cases). */
const DJ_CLASS = {
  guerrier: { hp: 340, dmg: 14, armor: 0.25, range: 1.5, cd: 1.0, speed: 4.0 },
  paladin: { hp: 320, dmg: 13, armor: 0.22, range: 1.5, cd: 1.0, speed: 3.9 },
  rodeur: { hp: 230, dmg: 10, armor: 0.05, range: 6.5, cd: 0.85, speed: 4.3, shot: 'arrow' },
  mage: { hp: 200, dmg: 13, armor: 0, range: 6, cd: 1.1, speed: 4.0, shot: 'fire', splash: 1.3 },
  voleur: { hp: 260, dmg: 8, armor: 0.15, range: 1.4, cd: 0.6, speed: 4.4, crit: 0.15, dodge: 0.1 },
  pretre: { hp: 210, dmg: 10, armor: 0.05, range: 5.5, cd: 1.1, speed: 4.0, shot: 'holy' },
  druide: { hp: 250, dmg: 10, armor: 0.1, range: 5, cd: 1.0, speed: 4.0, shot: 'thorn' },
  necro: { hp: 200, dmg: 9, armor: 0.05, range: 6, cd: 1.2, speed: 4.0, shot: 'shadow' },
};
/* Compétences, dans l'ordre de CLASSES[cls].skills. Chaque rang au-dessus du 1er : +15 % de puissance, −5 % de recharge.
   dmg : multiple des dégâts du héros ; rad : rayon ; range : portée (il faut une cible) ; dur : durée. */
const DJ_SKILLS = {
  guerrier: [{ id: 'charge', cd: 7, range: 7, dmg: 1.5, stun: 1.5 }, { id: 'tourbillon', cd: 8, rad: 2.2, dmg: 2 }, { id: 'cri', cd: 14, rad: 7, dur: 5, armor: 0.3, taunt: 4 }],
  paladin: [{ id: 'marteau', cd: 6, range: 6, dmg: 1.6, stun: 1.5 }, { id: 'bouclier', cd: 12, abs: 0.35, dur: 6 }, { id: 'consecration', cd: 14, rad: 2.5, dur: 5, dps: 0.5, hps: 0.03 }],
  rodeur: [{ id: 'roulade', cd: 6, dist: 3.5, dmg: 1, n: 2 }, { id: 'pluie', cd: 10, range: 7, rad: 2.5, dur: 3, dps: 1.2 }, { id: 'percant', cd: 8, range: 9, dmg: 2.5 }],
  mage: [{ id: 'boule', cd: 6, range: 7, rad: 1.8, dmg: 1.8 }, { id: 'nova', cd: 10, rad: 3, dmg: 0.8, frz: 2.5 }, { id: 'tp', cd: 9, dist: 5 }],
  voleur: [{ id: 'ombre', cd: 6, range: 7, dmg: 2.5 }, { id: 'poison', cd: 12, dur: 6, dps: 0.4, pt: 3 }, { id: 'fumee', cd: 14, dur: 3 }],
  pretre: [{ id: 'lumiere', cd: 5, heal: 0.25 }, { id: 'chatiment', cd: 6, range: 7, dmg: 2.4 }, { id: 'priere', cd: 16, heal: 0.35 }],
  druide: [{ id: 'ours', cd: 15, dur: 8 }, { id: 'loup', cd: 15, dur: 8 }, { id: 'racines', cd: 11, rad: 3.5, dmg: 0.6, root: 3 }],
  necro: [{ id: 'squelettes', cd: 18, n: 3, dur: 15, hp: 0.35, dmg: 0.5 }, { id: 'drain', cd: 7, range: 7, dmg: 2 }, { id: 'cadavre', cd: 8, range: 7, rad: 2.2, dmg: 2.5 }],
};
const DJ_D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], DJ_D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/* ---------- outils ---------- */
function djRnd(st) { const a = st.rs = (st.rs + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const djDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function djWalk(st, x, y) { const d = st.d, cx = Math.floor(x), cy = Math.floor(y); if (cx < 0 || cy < 0 || cx >= d.W || cy >= d.H) return false; const k = cy * d.W + cx; return d.grid[k] === 1 && !st.door[k]; }
/* Le cercle tient-il sur des cases libres ? (coins, et milieux des côtés pour les gros) */
function djFree(st, x, y, r) {
  const n = r > 0.45 ? 2 : 1;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { if (i > 0 && i < n && j > 0 && j < n) continue; if (!djWalk(st, x - r + 2 * r * i / n, y - r + 2 * r * j / n)) return false; }
  return true;
}
/* Déplacement qui glisse le long des murs (par petits pas, pour ne jamais en traverser un). */
function djMove(st, e, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.25)); let moved = false;
  for (let i = 0; i < n; i++) {
    const sx = dx / n, sy = dy / n;
    if (sx && djFree(st, e.x + sx, e.y, e.r)) { e.x += sx; moved = true; }
    if (sy && djFree(st, e.x, e.y + sy, e.r)) { e.y += sy; moved = true; }
  }
  return moved;
}
/* Ligne de vue (les grilles fermées n'arrêtent le regard que si doors est vrai). */
function djLos(st, x0, y0, x1, y1, doors) {
  const d = st.d, dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.3);
  for (let i = 1; i < n; i++) { const k = Math.floor(y0 + dy * i / n) * d.W + Math.floor(x0 + dx * i / n); if (!d.grid[k] || (doors && st.door[k])) return false; }
  return true;
}
/* Dégage une entité coincée dans un mur ou une grille : vers la case libre la plus proche (de préférence dans la salle ri). */
function djUnstick(st, e, ri) {
  const cx = Math.floor(e.x), cy = Math.floor(e.y), W = st.d.W;
  for (const strict of ri != null ? [true, false] : [false]) {
    let best = null, bd = 1e9;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx + 0.5, y = cy + dy + 0.5, d = Math.hypot(x - e.x, y - e.y);
      if (d >= bd || (strict && st.roomAt[(cy + dy) * W + cx + dx] !== ri) || !djFree(st, x, y, e.r)) continue;
      bd = d; best = [x, y];
    }
    if (best) { e.x = e.px = best[0]; e.y = e.py = best[1]; if (e.kind === 'hero') e.tp = (e.tp || 0) + 1; return true; }
  }
  return false;
}
/* Une case libre de la salle, loin des héros (pour faire sortir ou replacer un monstre). */
function djRoomSpot(st, ri, r) {
  const cells = st.d.rooms[ri].cells, n = cells.length, k0 = Math.floor(djRnd(st) * n);
  let fallback = null;
  for (let i = 0; i < n; i++) {
    const c = cells[(k0 + i * 7) % n], x = c[0] + 0.5, y = c[1] + 0.5;
    if (!djFree(st, x, y, r)) continue;
    if (!st.heroes.some(h => !h.dead && Math.hypot(h.x - x, h.y - y) < 2.5)) return [x, y];
    fallback = fallback || [x, y];
  }
  return fallback;
}
const djEnt = (st, id) => st.heroes.find(e => e.id === id) || st.mobs.find(e => e.id === id) || st.allies.find(e => e.id === id) || null;
const djLiving = st => st.mobs.filter(m => m.hp > 0 && m.awake);
const djAround = (st, x, y, r) => st.mobs.filter(m => m.hp > 0 && m.awake && Math.hypot(m.x - x, m.y - y) <= r + m.r);
const djFoes = st => st.heroes.filter(h => !h.dead).concat(st.allies.filter(a => a.kind === 'skel' && a.hp > 0));
const djWeakest = st => st.heroes.filter(h => !h.dead).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0] || null;
const djHpMax = (st, h) => h.hpBase * (h.form === 'ours' ? 1.3 : 1) * (st.bless === 'vigueur' ? 1.2 : 1);
function djNearest(st, e, max) {
  let best = null, bd = max;
  for (const m of st.mobs) { if (m.hp <= 0 || !m.awake) continue; const d = djDist(e, m) - m.r; if (d < bd && djLos(st, e.x, e.y, m.x, m.y)) { bd = d; best = m; } }
  return best;
}
/* Un spectre esquive parfois les attaques simples. */
function djEvade(st, m) { if (m.evade && djRnd(st) < m.evade) { st.ev.push({ k: 'miss', id: m.id }); return true; } return false; }
/* Cible d'un héros (attaque automatique et compétences) : d'abord les chamans à portée (sinon ils soignent tout le monde),
   puis la même cible que tout à l'heure, sinon la plus proche (un monstre presque mort passe un peu devant). */
function djTargetFor(st, h, range) {
  const ok = m => m.hp > 0 && m.awake && djDist(h, m) - m.r <= range && djLos(st, h.x, h.y, m.x, m.y);
  const cur = h.tgt && st.mobs.find(m => m.id === h.tgt), healer = st.mobs.some(m => (m.heals || m.raises) && ok(m));
  if (cur && ok(cur) && (cur.heals || cur.raises || !healer)) return cur;
  let best = null, bs = 1e9;
  for (const m of st.mobs) { if (!ok(m)) continue; const sc = djDist(h, m) - m.r - (m.heals || m.raises ? 4 : 0) - (m.hp < m.hpMax * 0.3 ? 1 : 0); if (sc < bs) { bs = sc; best = m; } }
  return best;
}
function djLootAdd(st, base, mul) { const got = {}; for (const k in base) { const n = Math.round(base[k] * mul); st.loot[k] = (st.loot[k] || 0) + n; got[k] = n; } return got; }

/* ---------- départ ---------- */
/* Un héros du village devient un combattant : statistiques selon la classe, le niveau, la race, les passifs et la spécialisation. */
function djHero(h) {
  const C = DJ_CLASS[h.cls] || DJ_CLASS.guerrier, lvl = Math.max(1, Math.min(HERO_MAX_LVL, h.lvl | 0)), pw = djMul(lvl), at = l => lvl >= l;
  const cls = DJ_CLASS[h.cls] ? h.cls : 'guerrier', race = RACES[h.race] ? h.race : 'humain', sk = h.sk || {};
  const sp = lvl >= SPEC_LVL && (h.spec === 0 || h.spec === 1) ? h.spec : null, spec = (c, s) => cls === c && sp === s;
  /* Équipement (en %) et familier (niveau 6) */
  const G = gearOf(h), pet = lvl >= PET_LVL ? (PETS[h.pet] ? h.pet : 'loup') : null;
  const hp = C.hp * pw * (race === 'nain' ? 1.15 : 1) * (1 + G.hp / 100) * (pet === 'sanglier' ? 1.08 : 1);
  let dmg = C.dmg * pw * (1 + G.dmg / 100), armor = C.armor + (cls === 'guerrier' && at(4) ? 0.1 : 0) + G.armor / 100;
  if (spec('guerrier', 0)) { dmg *= 1.2; armor -= 0.05; }
  if (spec('guerrier', 1)) armor += 0.1;
  if (spec('paladin', 0)) dmg *= 1.15;
  if (spec('rodeur', 0)) dmg *= 1.2;
  if (spec('pretre', 1)) dmg *= 1.3;
  return {
    id: h.id, own: h.own || '', name: h.name || '', race, cls, sex: h.sex === 'f' ? 'f' : 'm', col: h.col || COLORS[0], lvl, spec: sp, kind: 'hero',
    x: 0, y: 0, px: 0, py: 0, r: 0.35, fx: 1, fy: 0, hpBase: hp, hpMax: hp, hp, dmg, armor,
    range: C.range * (cls === 'rodeur' && at(4) ? 1.1 : 1), cdAtk: C.cd / (1 + G.haste / 100),
    speed: C.speed * (race === 'elfe' ? 1.1 : 1) * (cls === 'rodeur' && at(7) ? 1.1 : 1) * (1 + G.speed / 100),
    crit: (C.crit || 0.05) + (race === 'halfelin' ? 0.05 : 0) + (cls === 'voleur' && at(4) ? 0.1 : 0) + G.crit / 100 + (pet === 'faucon' ? 0.05 : 0), critMul: spec('voleur', 0) ? 2.5 : 2,
    dodge: Math.min(0.6, (C.dodge || 0) + (race === 'elfe' ? 0.1 : 0) + (cls === 'voleur' && at(7) ? 0.1 : 0) + G.dodge / 100), taken: cls === 'mage' && at(7) ? 0.9 : 1,
    cdMul: (cls === 'mage' && at(4) ? 0.9 : 1) * (1 - G.cdr / 100) * (pet === 'chouette' ? 0.95 : 1),
    leech: G.leech / 100, potMul: 1 + G.potion / 100, skillMul: 1 + G.skill / 100, gold: G.gold / 100, pw: G.pw, set4: G.set4, pet,
    luck: (race === 'halfelin' ? 1.25 : 1) * (G.pw.tresor ? 1.3 : 1), sursis: false,
    heal: (cls === 'paladin' && at(4) ? 1.1 : 1) * (cls === 'pretre' && at(7) ? 1.15 : 1) * (spec('paladin', 1) ? 1.2 : 1) * (spec('pretre', 0) ? 1.25 : 1),
    regen: (cls === 'druide' && at(4) ? 0.01 : 0) + G.regen / 100, instinct: cls === 'druide' && at(7), souffle: cls === 'guerrier' && at(7), moisson: cls === 'necro' && at(7), aura: cls === 'paladin' && at(7),
    rank: [0, 1, 2].map(i => lvl >= SKILL_LVLS[i] ? 1 + Math.max(0, Math.min(4, sk['s' + i] | 0)) : 0),
    cd: [0, 0, 0], cdMax: [1, 1, 1], atkT: 0, tgt: 0, pot: (lvl >= 2 ? 4 : 3) + G.potX, potT: 0, b: {}, criA: 0, shield: 0, form: null,
    dead: false, revived: false, mv: false, atkN: 0, castN: 0, lastCast: '',
    tp: 0, rev: 0, gone: false, remote: false,   // à deux : téléportations (le téléphone de l'autre se recale), relève, départ, héros piloté à distance
  };
}
function djMob(st, type, x, y, room, boss) {
  const D = (boss ? DJ_BOSSES : DJ_MONSTERS)[type], mk = djMobMul(st.lvl), pk = st.pk || 1;
  return { id: st.nid++, type, kind: 'mob', room, x, y, px: x, py: y, r: boss ? 0.75 : D.big ? 0.6 : 0.38,
    hp: D.hp * mk * pk, hpMax: D.hp * mk * pk, dmg: D.dmg * mk, range: D.range, rate: D.rate, speed: D.speed, xp: D.xp,
    ranged: !!D.ranged, heals: !!D.heals, raises: !!D.raises, evade: D.evade || 0, big: !!D.big, boss: !!boss, awake: false, wave: 0, hidden: false,
    shot: D.shot || (D.heals || D.raises ? 'curse' : 'arrow'),
    atkT: 0.4 + djRnd(st) * D.rate, wind: 0, act: null, actTgt: 0, tgt: 0, stun: 0, frz: 0, root: 0, poi: 0, poiD: 0, poiAcc: 0, taunt: 0, tauntBy: 0,
    fx: 0, fy: 1, mv: false, atkN: 0,
    sp: boss ? { slam: 4, charge: 8, phase: 0, enr: false, act: null, actT: 0, dx: 0, dy: 0, hit: [] } : null };
}
/* Début du combat. heroes : héros du village (un en solo, deux à deux). opts : { seed, dmgMul (dégâts des monstres), remote (id du héros piloté par l'autre téléphone) }.
   À deux, les monstres ont 70 % de vie en plus. */
function djStart(d, heroes, opts) {
  const o = opts || {}, W = d.W;
  const st = {
    d, lvl: d.lvl, t: 0, n: 0, rs: ((o.seed != null ? o.seed : d.seed) ^ 0x51ed270b) >>> 0, nid: 1, over: null, endT: 0, fled: false, dmgMul: o.dmgMul || 1,
    heroes: heroes.map(djHero), mobs: [], allies: [], shots: [], zones: [], corpses: [], ev: [],
    rooms: d.rooms.map(r => ({ st: r.kind === 'fight' || r.kind === 'boss' ? 'idle' : 'open', out: 0, wave: 0, waves: 1, waveT: 0 })),
    door: new Uint8Array(W * d.H), roomAt: new Int16Array(W * d.H).fill(-1), doors: [],
    chests: d.chests.map(c => ({ x: c.x, y: c.y, room: c.room, open: false })),
    altar: d.altar ? { x: d.altar[0] + 0.5, y: d.altar[1] + 0.5, used: false } : null,
    pris: d.prisoner ? { x: d.prisoner[0] + 0.5, y: d.prisoner[1] + 0.5, freed: false } : null,
    traps: d.traps.map((t, i) => ({ x: t.x, y: t.y, ph: (i * 0.37) % 2.4, on: false, hit: {} })),
    exit: null, bless: null, xp: 0, loot: {}, kills: 0, flow: null, flowN: -99, boss: 0, calmT: 0, gold: 0, items: {}, gems: {},
    pk: 1 + 0.7 * (heroes.length - 1),
    noDeath: !!d.tuto, tuto: d.tuto ? { on: '', done: {}, x0: d.start[0] + 0.5, y0: d.start[1] + 0.5, pot0: 0, slam: 0 } : null,
  };
  for (const h of st.heroes) if (o.remote && h.id === o.remote) h.remote = true;
  d.rooms.forEach((r, ri) => { for (const [x, y] of r.cells) st.roomAt[y * W + x] = ri; });
  /* Grilles : les cases de couloir qui touchent une salle se ferment quand le combat y commence. */
  st.doors = d.rooms.map(r => { const out = []; for (const [x, y] of r.cells) for (const [dx, dy] of DJ_D4) { const k = (y + dy) * W + x + dx; if (d.grid[k] && st.roomAt[k] < 0 && !out.includes(k)) out.push(k); } return out; });
  for (const m of d.monsters) {
    const mob = djMob(st, m.type, m.x, m.y, m.room, !!m.boss); mob.wave = m.wave || 0; mob.hidden = mob.wave > 0; st.mobs.push(mob);
    if (mob.boss) st.boss = mob.id;
    if (mob.type === 'gardeSource') mob.sp.slam = 2.5;
    st.rooms[m.room].waves = Math.max(st.rooms[m.room].waves, mob.wave + 1);
  }
  if (st.heroes.some(h => h.cls === 'pretre' && h.lvl >= 4)) for (const h of st.heroes) { h.hpBase *= 1.1; h.hpMax = h.hp = h.hpBase; }   // Bénédiction
  /* Profondeurs : ce que chaque héros rapporte de l'étage précédent (vie, potions, relèvement utilisé, partie) */
  for (const h of st.heroes) {
    const c = o.carry && o.carry[h.id]; if (!c) continue;
    h.hp = Math.max(1, Math.min(1, c.hp) * h.hpMax); h.pot = Math.max(0, Math.min(h.pot, c.pot)); h.revived = !!c.revived;
    if (c.gone) { h.gone = true; h.dead = true; h.hp = 0; }
  }
  st.heroes.forEach((h, i) => { h.x = h.px = d.start[0] + 0.5 + (i ? 1.2 : 0); h.y = h.py = d.start[1] + 0.5 + (i ? 0.6 : 0); });
  /* Le familier (niveau 6) : il suit son héros et mord sa cible ; les monstres ne s'en occupent pas. */
  for (const h of st.heroes) if (h.pet) st.allies.push({ id: st.nid++, kind: 'pet', pt: h.pet, own: h.id, x: h.x - 0.8, y: h.y + 0.8, px: h.x - 0.8, py: h.y + 0.8, r: 0.25, hp: 1, hpMax: 1,
    dmg: h.dmg * 0.35 * (h.cls === 'rodeur' && h.spec === 1 ? 3 : 1) * (h.pet === 'loup' ? 1.3 : h.pet === 'faucon' ? 0.8 : 1), range: 1.1, rate: 1.2, speed: 5.5, atkT: 0, t: 1e9, inv: true, tgt: 0, mv: false, atkN: 0 });
  st.goldMul = 1 + st.heroes.reduce((a, h) => a + (h.gold || 0), 0);
  if (st.tuto && st.heroes[0]) st.tuto.pot0 = st.heroes[0].pot;
  return st;
}

/* ---------- dégâts, soins, effets ---------- */
/* kind : 'skill' (compétence), 'basic' (attaque simple), 'dot' (zone, poison : pas de combo). */
function djHurt(st, m, v, src, crit, kind) {
  if (!m || m.hp <= 0 || !(v > 0)) return 0;
  /* Combo à deux : un monstre marqué par une compétence de l'autre héros (ou étourdi, gelé, enraciné par lui) prend 50 % de plus.
     Une compétence marque à son tour le monstre pour l'autre (3 secondes). */
  if (src && src.kind === 'hero' && st.heroes.length > 1 && kind && kind !== 'dot') {
    const mk = m.mark && m.mark.by !== src.id && m.mark.t > st.t, cc = m.ccBy && m.ccBy !== src.id && (m.stun > 0 || m.frz > 0 || m.root > 0);
    if (mk || cc) { v *= 1.5; st.combos = (st.combos || 0) + 1; if (mk) m.mark = null; st.ev.push({ k: 'combo', id: m.id, by: src.id }); }
    if (kind === 'skill') m.mark = { by: src.id, t: st.t + 3 };
  }
  const dealt = Math.min(v, m.hp);
  m.hp -= v; st.ev.push({ k: 'hit', id: m.id, v: Math.round(v), crit: !!crit });
  if (src && src.kind === 'hero' && src.leech > 0 && !src.dead) djHeal(st, src, dealt * src.leech);      // vol de vie (équipement)
  if (m.hp <= 0) djKill(st, m);
  return dealt;
}
function djKill(st, m) {
  m.hp = 0; st.kills++; st.xp += m.xp * djXpMul(st.lvl);
  st.corpses.push({ x: m.x, y: m.y, t: st.t }); if (st.corpses.length > 12) st.corpses.shift();
  st.ev.push({ k: 'die', id: m.id, x: m.x, y: m.y, boss: m.boss });
  for (const h of st.heroes) {
    if (h.dead) continue;
    if (h.souffle) djHeal(st, h, h.hpMax * 0.03);                               // Second souffle
    if (h.moisson) for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, h.cd[i] - 0.5);   // Moisson
    if (h.pw.soif) djHeal(st, h, h.hpMax * 0.03);                                // Cœur assoiffé (légendaire)
    if (h.set4.roi) for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, h.cd[i] - 1);    // Atours du roi squelette (4 pièces)
  }
  /* Butin : de l'or pour le village, et pour chaque héros ses propres objets (à deux, chacun le sien). */
  const lm = djLootMul(st.lvl);
  if (!m.boss) {
    st.gold += Math.round((0.25 + djRnd(st) * 0.5) * lm * (m.big ? 3 : 1) * st.goldMul);
    for (const h of st.heroes) if (!h.gone && djRnd(st) < (m.big ? 0.06 : 0.02) * h.luck) djDrop(st, h, { src: 'mob' }, m);
  } else {
    const g = Math.round(20 * lm * st.goldMul), set = st.d.floor && djRnd(st) < 0.5 ? 'abime' : SET_OF_THEME[st.d.theme] || 'troll';
    st.gold += g;
    const got = djLootAdd(st, DJ_BOSS_LOOT, lm); got.or = g;
    st.ev.push({ k: 'loot', got, x: m.x, y: m.y });
    for (const h of st.heroes) if (!h.gone) {
      djDrop(st, h, djRnd(st) < 0.25 ? { src: 'boss', set } : { src: 'boss' }, m);
      if (djRnd(st) < 0.5) djDrop(st, h, { src: 'boss' }, m);
      if (djRnd(st) < 0.3) djGem(st, h, djRnd(st) < 0.25 ? 2 : 1, m);
    }
  }
}
/* Un objet trouvé par un héros (rangé à son nom : à deux, chacun garde le sien). */
function djDrop(st, h, o, at) {
  const it = genItem(() => djRnd(st), Object.assign({ il: st.lvl, cls: h.cls, luck: h.luck }, o));
  (st.items[h.id] = st.items[h.id] || []).push(it);
  st.ev.push({ k: 'item', id: h.id, r: it.r, sl: it.sl, set: it.set || 0, x: at.x, y: at.y });
}
function djGem(st, h, n, at) {
  const key = GEM_KEYS[Math.floor(djRnd(st) * GEM_KEYS.length)] + n, g = st.gems[h.id] = st.gems[h.id] || {};
  g[key] = (g[key] || 0) + 1;
  st.ev.push({ k: 'gem', id: h.id, g: key, x: at.x, y: at.y });
}
function djHeal(st, h, v) {
  if (!h || h.dead || !(v > 0)) return 0;
  const before = h.hp; h.hp = Math.min(h.hpMax, h.hp + v);
  if (h.hp - before >= 1) st.ev.push({ k: 'heal', id: h.id, v: Math.round(h.hp - before) });
  return h.hp - before;
}
/* Dégâts reçus par un héros, après esquive, armure et bouclier. */
function djHurtHero(st, h, v, src) {
  if (h.dead || h.b.inv > 0 || !(v > 0)) return 0;
  if (djRnd(st) < h.dodge) { st.ev.push({ k: 'miss', id: h.id }); return 0; }
  let ar = h.armor + (h.b.cri > 0 ? h.criA : 0) + (h.form === 'ours' ? 0.4 + (h.cls === 'druide' && h.spec === 0 ? 0.15 : 0) : 0);
  if (st.heroes.some(p => p.aura && !p.dead && djDist(p, h) <= 4)) ar += 0.1;          // Aura du paladin
  v *= (1 - Math.min(0.75, Math.max(0, ar))) * h.taken * st.dmgMul;
  if (src && src.kind === 'mob' && src.hp > 0 && h.pw.epines) djHurt(st, src, v * 0.3, h, false, 'dot');       // Peau-de-Ronces (légendaire)
  if (h.shield > 0) { const a = Math.min(h.shield, v); h.shield -= a; v -= a; if (a >= 1) st.ev.push({ k: 'block', id: h.id, v: Math.round(a) }); }
  return djDamageHero(st, h, v);
}
function djDamageHero(st, h, v) {
  if (h.dead || !(v > 0)) return 0;
  h.hp -= v; st.ev.push({ k: 'hurt', id: h.id, v: Math.round(v) });
  if (h.hp <= 0) {
    if (st.noDeath) { h.hp = Math.max(1, h.hpMax * 0.35); h.b.inv = 2; st.ev.push({ k: 'saved', id: h.id }); }       // la mission d'intro : Sukhoï le relève
    else if (h.pw && h.pw.sursis && !h.sursis) { h.sursis = true; h.hp = 1; h.b.inv = 2; st.ev.push({ k: 'sursis', id: h.id }); }   // Dernier Rempart (légendaire)
    else if (h.race === 'mortvivant' && !h.revived) { h.revived = true; h.hp = h.hpMax * 0.4; h.b.inv = 1.5; st.ev.push({ k: 'revive', id: h.id }); }
    else { h.hp = 0; h.dead = true; h.form = null; h.mv = false; st.ev.push({ k: 'down', id: h.id }); }
  }
  return v;
}
function djRaise(st, h, frac, by) {
  h.dead = false; h.hp = Math.max(1, h.hpMax * frac); h.rev = 0; h.b = { inv: 1.5 };
  st.ev.push({ k: 'raise', id: h.id, by });
}
function djHit(st, t, v, src) {
  if (t.kind === 'hero') return djHurtHero(st, t, v, src);
  if (t.inv || t.hp <= 0) return 0;
  t.hp -= v * st.dmgMul; st.ev.push({ k: 'hit', id: t.id, v: Math.round(v * st.dmgMul), ally: true });
  if (t.hp <= 0) { t.hp = 0; st.ev.push({ k: 'die', id: t.id, x: t.x, y: t.y }); }
  return v;
}
/* Étourdi, gelé (ne fait plus rien) ou enraciné (ne bouge plus). Le boss y résiste en partie ; ça interrompt ses attaques spéciales. */
function djCC(st, m, kind, s, by) {
  if (!m || m.hp <= 0) return;
  if (by) m.ccBy = by;
  m[kind] = Math.max(m[kind], s * (m.boss ? (kind === 'stun' ? 0.3 : 0.5) : 1));
  if (kind !== 'root') { m.wind = 0; if (m.sp && m.sp.act) { m.sp.act = null; m.sp.slam = Math.max(m.sp.slam || 0, 2.5); m.sp.charge = Math.max(m.sp.charge || 0, 3); m.sp.storm = Math.max(m.sp.storm || 0, 2.5); st.ev.push({ k: 'interrupt', id: m.id }); st.ev.push({ k: 'teleCancel', id: m.id }); } }
  st.ev.push({ k: 'cc', id: m.id, c: kind, t: m[kind] });
}
function djPoison(st, h, m) {
  const S = DJ_SKILLS.voleur[1], P = 1 + 0.15 * ((h.rank[1] || 1) - 1);
  if (m.hp > 0) { m.poi = S.pt; m.poiD = Math.max(m.poiD, h.dmg * S.dps * P); }
}
/* Après un coup simple réussi (corps à corps ou projectile) : poison du voleur, pouvoirs légendaires, ensemble du chef troll. */
function djOnBasic(st, h, t, v, crit) {
  if (!h || h.kind !== 'hero' || !t) return;
  if (h.b.poison > 0) djPoison(st, h, t);
  if (h.pw.brasier && t.hp > 0) { t.poi = Math.max(t.poi, 3); t.poiD = Math.max(t.poiD, v * 0.25 / 3); }
  if (h.pw.chaine) {
    let best = null, bd = 2.6;
    for (const m of st.mobs) { if (m === t || m.hp <= 0 || !m.awake) continue; const d = djDist(m, t); if (d < bd) { bd = d; best = m; } }
    if (best) { st.ev.push({ k: 'chain', id: t.id, tgt: best.id, x: t.x, y: t.y, x1: best.x, y1: best.y }); djHurt(st, best, v * 0.5, h, crit, 'dot'); }
  }
  if (h.set4.troll && t.hp > 0 && djRnd(st) < 0.1) djCC(st, t, 'stun', 1, h.id);
}
/* Dégâts d'un coup de héros : passifs, autel, forme animale, coup critique. */
function djRoll(st, h, mult) {
  let k = mult;
  if (h.race === 'orque') k *= 1 + 0.25 * (1 - h.hp / h.hpMax);                     // Rage
  if (st.bless === 'force') k *= 1.2;
  if (h.form === 'ours') k *= 1.15 * (h.instinct ? 1.1 : 1);
  if (h.form === 'loup') k *= (h.spec === 1 ? 1.25 : 1) * (h.instinct ? 1.1 : 1);
  const crit = djRnd(st) < h.crit;
  return { v: h.dmg * k * (crit ? h.critMul : 1), crit };
}
function djSetForm(st, h, f) {
  h.form = f;
  const old = h.hpMax; h.hpMax = djHpMax(st, h);
  if (h.hpMax > old) h.hp += h.hpMax - old; else h.hp = Math.min(h.hp, h.hpMax);
  st.ev.push({ k: 'form', id: h.id, f });
}
function djPotion(st, h) {
  if (h.dead || h.pot <= 0 || h.potT > 0 || h.hp >= h.hpMax - 0.5) return false;
  h.pot--; h.potT = 1; djHeal(st, h, h.hpMax * DJ_POTION * (h.potMul || 1)); st.ev.push({ k: 'potion', id: h.id });
  return true;
}
/* Endroit libre pour se téléporter, en ligne droite (sans traverser de mur ni de grille). */
function djBlinkSpot(st, h, ux, uy, dist) {
  for (let k = dist; k >= 1; k -= 0.25) { const x = h.x + ux * k, y = h.y + uy * k; if (djFree(st, x, y, h.r) && djLos(st, h.x, h.y, x, y, true)) return [x, y]; }
  return null;
}

/* ---------- compétences ---------- */
function djCast(st, h, i) {
  const S = DJ_SKILLS[h.cls] && DJ_SKILLS[h.cls][i];
  if (!S || h.dead || !h.rank[i] || h.cd[i] > 0) return false;
  const r = h.rank[i], P = (1 + 0.15 * (r - 1)) * (h.skillMul || 1), L = 1 + 0.1 * (r - 1), D = mult => djRoll(st, h, mult * P);
  const shoot = (t, d, spd) => st.shots.push({ id: st.nid++, side: 'h', kind: DJ_CLASS[h.cls].shot || 'arrow', from: h.id, tgt: t.id, x: h.x, y: h.y, px: h.x, py: h.y, spd: spd || 14, dmg: d.v, crit: d.crit, life: 2 });
  let ok = true;
  switch (S.id) {
    case 'charge': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const x0 = h.x, y0 = h.y, dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1, go = Math.max(0, len - t.r - h.r - 0.15);
      djMove(st, h, dx / len * go, dy / len * go); h.fx = dx / len; h.fy = dy / len; h.b.inv = 0.25;
      st.ev.push({ k: 'dash', id: h.id, x0, y0, x1: h.x, y1: h.y });
      if (djDist(h, t) <= t.r + h.r + 0.8) { const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); djCC(st, t, 'stun', S.stun, h.id); }
      break;
    }
    case 'tourbillon':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'steel' }); break;
    case 'cri':
      for (const m of djAround(st, h.x, h.y, S.rad)) { m.taunt = S.taunt + (h.spec === 1 ? 2 : 0); m.tauntBy = h.id; }
      h.b.cri = S.dur * L; h.criA = S.armor * P;
      st.ev.push({ k: 'shout', id: h.id, x: h.x, y: h.y, r: S.rad }); break;
    case 'marteau': case 'chatiment': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.ev.push({ k: 'bolt', id: h.id, tgt: t.id, c: S.id });
      const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); if (S.stun) djCC(st, t, 'stun', S.stun, h.id);
      break;
    }
    case 'bouclier': {
      const t = djWeakest(st); if (!t) { ok = false; break; }
      t.shield = Math.max(t.shield, h.hpMax * S.abs * P * h.heal); t.b.shield = S.dur;
      st.ev.push({ k: 'shield', id: t.id, by: h.id }); break;
    }
    case 'consecration':
      st.zones.push({ id: st.nid++, k: 'cons', x: h.x, y: h.y, r: S.rad, t: S.dur, tick: 0, dps: h.dmg * S.dps * P, hps: S.hps * h.heal * P, own: h.id });
      st.ev.push({ k: 'zone', z: 'cons', x: h.x, y: h.y, r: S.rad, t: S.dur }); break;
    case 'roulade': {
      const t = djNearest(st, h, 8), x0 = h.x, y0 = h.y, dx = t ? h.x - t.x : -h.fx, dy = t ? h.y - t.y : -h.fy, len = Math.hypot(dx, dy) || 1;
      djMove(st, h, dx / len * S.dist, dy / len * S.dist); h.b.inv = 0.35;
      st.ev.push({ k: 'dash', id: h.id, x0, y0, x1: h.x, y1: h.y, roll: true });
      if (t) for (let n = 0; n < S.n; n++) shoot(t, D(S.dmg), 15 + n * 3);
      break;
    }
    case 'pluie': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.zones.push({ id: st.nid++, k: 'rain', x: t.x, y: t.y, r: S.rad, t: S.dur, tick: 0, dps: h.dmg * S.dps * P, own: h.id });
      st.ev.push({ k: 'zone', z: 'rain', x: t.x, y: t.y, r: S.rad, t: S.dur, from: h.id }); break;
    }
    case 'percant': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const dx = t.x - h.x, dy = t.y - h.y, len0 = Math.hypot(dx, dy) || 1, ux = dx / len0, uy = dy / len0;
      let len = 0; while (len < S.range && st.d.grid[Math.floor(h.y + uy * (len + 0.3)) * st.d.W + Math.floor(h.x + ux * (len + 0.3))]) len += 0.3;
      for (const m of djLiving(st)) { const ax = m.x - h.x, ay = m.y - h.y, p = ax * ux + ay * uy; if (p >= 0 && p <= len && Math.abs(ax * uy - ay * ux) <= 0.6 + m.r) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); } }
      st.ev.push({ k: 'line', id: h.id, x0: h.x, y0: h.y, x1: h.x + ux * len, y1: h.y + uy * len }); break;
    }
    case 'boule': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const x = t.x, y = t.y;
      for (const m of djAround(st, x, y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); if (h.spec === 0 && m.hp > 0) { m.poi = 3; m.poiD = Math.max(m.poiD, h.dmg * 0.5); } }
      st.ev.push({ k: 'boom', id: h.id, x, y, r: S.rad, c: 'fire' }); break;
    }
    case 'nova':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); djCC(st, m, 'frz', S.frz * (h.spec === 1 ? 1.5 : 1), h.id); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'ice' }); break;
    case 'tp': {
      const t = djNearest(st, h, 10), dx = t ? h.x - t.x : h.fx, dy = t ? h.y - t.y : h.fy, len = Math.hypot(dx, dy) || 1;
      const p = djBlinkSpot(st, h, dx / len, dy / len, S.dist); if (!p) { ok = false; break; }
      st.ev.push({ k: 'blink', id: h.id, x0: h.x, y0: h.y, x1: p[0], y1: p[1] });
      h.x = h.px = p[0]; h.y = h.py = p[1]; break;
    }
    case 'ombre': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1, k = t.r + h.r + 0.2;
      let nx = t.x + dx / len * k, ny = t.y + dy / len * k;
      if (!djFree(st, nx, ny, h.r)) { nx = h.x; ny = h.y; }
      st.ev.push({ k: 'blink', id: h.id, x0: h.x, y0: h.y, x1: nx, y1: ny });
      h.x = h.px = nx; h.y = h.py = ny; h.fx = -dx / len; h.fy = -dy / len;
      const d = D(S.dmg); djHurt(st, t, d.v, h, d.crit, 'skill'); if (h.b.poison > 0) djPoison(st, h, t);
      break;
    }
    case 'poison': h.b.poison = S.dur * L; st.ev.push({ k: 'buff', id: h.id, b: 'poison' }); break;
    case 'fumee':
      h.b.stealth = S.dur * L;
      for (const m of st.mobs) if (m.tgt === h.id || m.actTgt === h.id) { m.tgt = 0; m.wind = 0; }
      if (h.spec === 1) for (const m of djAround(st, h.x, h.y, 2.5)) djCC(st, m, 'stun', 1.5, h.id);
      st.ev.push({ k: 'smoke', id: h.id, x: h.x, y: h.y }); break;
    case 'lumiere': {
      const t = djWeakest(st); if (!t) { ok = false; break; }
      djHeal(st, t, t.hpMax * S.heal * P * h.heal); st.ev.push({ k: 'holy', id: t.id, by: h.id }); break;
    }
    case 'priere':
      for (const t of st.heroes) if (!t.dead) { djHeal(st, t, t.hpMax * S.heal * P * h.heal); st.ev.push({ k: 'holy', id: t.id, by: h.id }); }
      break;
    case 'ours': case 'loup': djSetForm(st, h, S.id); h.b.form = S.dur * L; break;
    case 'racines':
      for (const m of djAround(st, h.x, h.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); djCC(st, m, 'root', S.root * L, h.id); }
      st.ev.push({ k: 'nova', id: h.id, x: h.x, y: h.y, r: S.rad, c: 'root' }); break;
    case 'squelettes': {
      for (const a of st.allies) if (a.kind === 'skel' && a.own === h.id && a.hp > 0) { a.hp = 0; st.ev.push({ k: 'die', id: a.id, x: a.x, y: a.y }); }
      const n = S.n + (h.spec === 0 ? 1 : 0), hp = h.hpMax * S.hp * (h.lvl >= 4 ? 1.2 : 1) * (h.spec === 0 ? 1.3 : 1);
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.2832, x = h.x + Math.cos(a) * 1.1, y = h.y + Math.sin(a) * 1.1, free = djFree(st, x, y, 0.32);
        st.allies.push({ id: st.nid++, kind: 'skel', own: h.id, x: free ? x : h.x, y: free ? y : h.y, px: free ? x : h.x, py: free ? y : h.y, r: 0.32, hp, hpMax: hp,
          dmg: h.dmg * S.dmg * P, range: 1.2, rate: 1.0, speed: 3.8, atkT: 0.3, t: S.dur * L, tgt: 0, mv: false, atkN: 0 });
      }
      st.ev.push({ k: 'summon', id: h.id, x: h.x, y: h.y }); break;
    }
    case 'drain': {
      const t = djTargetFor(st, h, S.range); if (!t) { ok = false; break; }
      st.ev.push({ k: 'drain', id: h.id, tgt: t.id });
      const d = D(S.dmg * (h.spec === 1 ? 1.3 : 1)); djHeal(st, h, djHurt(st, t, d.v, h, d.crit, 'skill')); break;
    }
    case 'cadavre': {
      const ref = djTargetFor(st, h, S.range) || h; let best = null, bd = 1e9;
      for (const c of st.corpses) { const dd = Math.hypot(c.x - ref.x, c.y - ref.y); if (Math.hypot(c.x - h.x, c.y - h.y) <= S.range && dd < bd) { bd = dd; best = c; } }
      if (!best) { ok = false; break; }
      st.corpses.splice(st.corpses.indexOf(best), 1);
      for (const m of djAround(st, best.x, best.y, S.rad)) { const d = D(S.dmg); djHurt(st, m, d.v, h, d.crit, 'skill'); }
      st.ev.push({ k: 'boom', id: h.id, x: best.x, y: best.y, r: S.rad, c: 'bone' }); break;
    }
    default: ok = false;
  }
  if (!ok) { st.ev.push({ k: 'nocast', id: h.id, i }); return false; }
  const cd = S.cd * (1 - 0.05 * (r - 1)) * h.cdMul * (st.bless === 'celerite' ? 0.85 : 1);
  h.cd[i] = cd; h.cdMax[i] = cd; h.castN++; h.lastCast = S.id;
  if (h.pw.echo && djRnd(st) < 0.2) { h.cd[i] = 0.3; st.ev.push({ k: 'echo', id: h.id }); }                  // Écho des Anciens (légendaire)
  if (S.id === 'charge' || S.id === 'roulade' || S.id === 'tp' || S.id === 'ombre') h.tp = (h.tp || 0) + 1;
  st.ev.push({ k: 'cast', id: h.id, i, s: S.id });
  return true;
}

/* ---------- un pas de simulation ---------- */
function djHeroStep(st, h, inp) {
  const dt = DJ_DT;
  for (const k in h.b) { h.b[k] -= dt; if (h.b[k] <= 0) { delete h.b[k]; if (k === 'shield') h.shield = 0; if (k === 'form' && !h.dead) djSetForm(st, h, null); } }
  if (h.dead) return;
  if (!djFree(st, h.x, h.y, h.r)) djUnstick(st, h);
  for (let i = 0; i < 3; i++) if (h.cd[i] > 0) h.cd[i] = Math.max(0, h.cd[i] - dt);
  h.atkT -= dt; h.potT -= dt;
  if (h.regen) h.hp = Math.min(h.hpMax, h.hp + h.hpMax * h.regen * dt);   // Régénération (sans bulle)
  if (st.calmT > 1) h.hp = Math.min(h.hpMax, h.hp + h.hpMax * 0.1 * dt);   // entre deux combats, on reprend son souffle (10 % par seconde)
  if (inp.pot) djPotion(st, h);
  if (inp.sk != null && inp.sk >= 0) djCast(st, h, inp.sk);
  if (h.dead) return;
  let mx = +inp.mx || 0, my = +inp.my || 0; const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  /* Roulade : à deux, l'invitée fait le bond sur son téléphone (sa position arrive comme d'habitude) ; ici, on la rend intouchable. */
  if (h.rollCd > 0) h.rollCd = Math.max(0, h.rollCd - dt);
  if (inp.rl && !(h.rollCd > 0)) djRollStart(st, h, mx, my);
  const rolling = h.roll > 0;
  if (rolling) h.roll = Math.max(0, h.roll - dt);
  const spd = h.speed * (h.form === 'loup' ? 1.25 : 1) * (st.bless === 'celerite' ? 1.15 : 1);
  const reach = h.form ? 1.6 : h.range;
  if (h.remote) {
    /* À deux : l'invitée déplace son héros sur son téléphone et envoie sa position (acceptée si la case est libre
       et si son téléphone a bien vu la dernière téléportation). */
    const p = inp.pos;
    if (p && (inp.tp | 0) === (h.tp | 0) && isFinite(p[0]) && isFinite(p[1]) && djFree(st, +p[0], +p[1], h.r)) { h.x = +p[0]; h.y = +p[1]; }
    if (p) { if (p[2] || p[3]) { h.fx = +p[2]; h.fy = +p[3]; } h.mv = !!p[4]; }
  } else if (rolling) { h.mv = djMove(st, h, h.rdx * DJ_ROLL.spd * dt, h.rdy * DJ_ROLL.spd * dt); h.fx = h.rdx; h.fy = h.rdy; }
  else if (m > 0.2) { h.mv = djMove(st, h, mx * spd * dt, my * spd * dt); h.fx = mx / Math.max(1, m); h.fy = my / Math.max(1, m); }
  else {
    h.mv = false;
    /* Au contact, joystick lâché : le héros s'avance vers le monstre le plus proche. */
    if (reach < 2) {
      const t = djNearest(st, h, 4.5);
      if (t && djDist(h, t) > reach + t.r) { const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy); h.mv = djMove(st, h, dx / len * spd * dt, dy / len * spd * dt); h.fx = dx / len; h.fy = dy / len; }
    }
  }
  /* Attaque automatique (même en marchant), sur la cible la plus proche à portée ; pas pendant une roulade. */
  if (h.atkT <= 0 && !rolling) {
    const t = djTargetFor(st, h, reach);
    if (t) {
      h.tgt = t.id;
      const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy) || 1; if (!h.mv) { h.fx = dx / len; h.fy = dy / len; }
      const d = djRoll(st, h, 1); let v = d.v;
      if (h.b.stealth > 0) { v *= 2; delete h.b.stealth; st.ev.push({ k: 'unstealth', id: h.id }); }
      h.atkT = h.form === 'loup' ? 0.5 : h.form === 'ours' ? 1.1 : h.cdAtk; h.atkN++;
      st.ev.push({ k: 'atk', id: h.id, tgt: t.id });
      if (reach < 2) { if (!djEvade(st, t)) { djHurt(st, t, v, h, d.crit, 'basic'); djOnBasic(st, h, t, v, d.crit); } }
      else st.shots.push({ id: st.nid++, side: 'h', kind: DJ_CLASS[h.cls].shot || 'arrow', from: h.id, tgt: t.id, x: h.x, y: h.y, px: h.x, py: h.y, spd: 14, dmg: v, crit: d.crit, life: 2, splash: DJ_CLASS[h.cls].splash || 0, basic: 1 });
    }
  }
}
function djRollStart(st, h, mx, my) {
  const m = Math.hypot(mx, my);
  let dx = m > 0.2 ? mx / m : h.fx || 0, dy = m > 0.2 ? my / m : h.fy || 0; const L = Math.hypot(dx, dy);
  if (L < 1e-6) { dx = 0; dy = 1; } else { dx /= L; dy /= L; }
  h.roll = DJ_ROLL.t; h.rollCd = DJ_ROLL.cd; h.rdx = dx; h.rdy = dy; h.rollN = (h.rollN | 0) + 1;
  h.b.inv = Math.max(h.b.inv || 0, DJ_ROLL.inv);
  st.ev.push({ k: 'roll', id: h.id, x: h.x, y: h.y });
}
function djAllyStep(st, a) {
  const dt = DJ_DT; if (!a.inv && a.hp <= 0) return;
  a.t -= dt;
  if (a.t <= 0) { a.hp = 0; st.ev.push({ k: 'die', id: a.id, x: a.x, y: a.y }); return; }
  const o = st.heroes.find(h => h.id === a.own); a.atkT -= dt;
  let t = null;
  if (a.kind === 'pet') { const ht = o && !o.dead && o.tgt ? st.mobs.find(m => m.id === o.tgt && m.hp > 0 && m.awake) : null; if (ht && djDist(o, ht) < 7) t = ht; }
  else t = djNearest(st, a, 7);
  const goTo = (x, y) => { const dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1; a.mv = djMove(st, a, dx / len * a.speed * dt, dy / len * a.speed * dt); a.fx = dx / len; a.fy = dy / len; };
  if (t) {
    if (djDist(a, t) > a.range + t.r + a.r) goTo(t.x, t.y);
    else { a.mv = false; a.fx = t.x - a.x; a.fy = t.y - a.y; if (a.atkT <= 0) { a.atkT = a.rate; a.atkN++; st.ev.push({ k: 'atk', id: a.id, tgt: t.id }); djHurt(st, t, a.dmg, a, false); } }
  } else if (o && !o.dead && djDist(a, o) > 1.8) goTo(o.x, o.y);
  else a.mv = false;
}
/* Cible d'un monstre : celui qui l'a provoqué, sinon le plus proche (héros ou squelette ; il ne lâche pas sa cible pour un rien). */
function djMobTarget(st, m) {
  if (m.taunt > 0) { const h = st.heroes.find(x => x.id === m.tauntBy && !x.dead); if (h) return h; }
  let best = null, bd = 1e9;
  for (const e of djFoes(st)) { if (e.b && e.b.stealth > 0) continue; const d = djDist(m, e) - (e.id === m.tgt ? 1.5 : 0); if (d < bd) { bd = d; best = e; } }
  return best;
}
/* Champ de distances vers les héros (recalculé 5 fois par seconde) : les monstres le suivent quand ils ne voient pas leur cible. */
function djFlow(st) {
  const d = st.d, W = d.W, N = W * d.H;
  if (!st.flow || st.flow.length !== N) st.flow = new Float32Array(N);
  const F = st.flow; F.fill(1e9);
  const q = [];
  for (const h of st.heroes) { if (h.dead || h.b.stealth > 0) continue; const k = Math.floor(h.y) * W + Math.floor(h.x); if (F[k]) { F[k] = 0; q.push(k); } }
  const open = k => d.grid[k] && !st.door[k];
  for (let i = 0; i < q.length; i++) {
    const k = q[i], x = k % W, y = (k / W) | 0, nd = F[k] + 1;
    for (const [dx, dy] of DJ_D8) {
      const nx = x + dx, ny = y + dy, nk = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= d.H || F[nk] <= nd || !open(nk)) continue;
      if (dx && dy && (!open(y * W + nx) || !open(ny * W + x))) continue;
      F[nk] = nd; q.push(nk);
    }
  }
  st.flowN = st.n;
}
/* Le passage est-il assez large pour ce monstre, en ligne droite jusqu'à (x, y) ? */
function djFatLos(st, e, x, y) {
  const dx = x - e.x, dy = y - e.y, n = Math.ceil(Math.hypot(dx, dy) / 0.25);
  for (let i = 1; i <= n; i++) if (!djFree(st, e.x + dx * i / n, e.y + dy * i / n, e.r)) return false;
  return true;
}
/* Suit le champ de distances sur quelques cases et vise la plus lointaine qu'on peut atteindre tout droit (contourne bien les piliers). */
function djPathPoint(st, m) {
  const W = st.d.W, F = st.flow; let cx = Math.floor(m.x), cy = Math.floor(m.y); const pts = [];
  for (let s = 0; s < 5; s++) {
    let best = F[cy * W + cx], bx = 0, by = 0;
    for (const [ox, oy] of DJ_D8) { const k = (cy + oy) * W + cx + ox; if (F[k] < best) { best = F[k]; bx = ox; by = oy; } }
    if (!bx && !by) break;
    cx += bx; cy += by; pts.push([cx + 0.5, cy + 0.5]);
  }
  for (let i = pts.length - 1; i > 0; i--) if (djFatLos(st, m, pts[i][0], pts[i][1])) return pts[i];
  return pts[0] || null;
}
function djSteer(st, m, t, away) {
  let dx = t.x - m.x, dy = t.y - m.y;
  if (away) { dx = -dx; dy = -dy; }
  else if (!djLos(st, m.x, m.y, t.x, t.y) || (m.r > 0.45 && !djFatLos(st, m, m.x + dx * Math.min(1, 1.5 / (Math.hypot(dx, dy) || 1)), m.y + dy * Math.min(1, 1.5 / (Math.hypot(dx, dy) || 1))))) {
    const p = djPathPoint(st, m);
    if (!p) { m.mv = false; return; }
    dx = p[0] - m.x; dy = p[1] - m.y;
  }
  if (m.root > 0) { m.mv = false; return; }
  const len = Math.hypot(dx, dy) || 1, sp = m.speed * DJ_DT;
  m.mv = djMove(st, m, dx / len * sp, dy / len * sp); m.fx = dx / len; m.fy = dy / len;
}
function djMobStep(st, m) {
  const dt = DJ_DT;
  if (m.poi > 0) {
    m.poi -= dt; m.poiAcc += m.poiD * dt;
    if (m.poiAcc >= 3 || m.poi <= 0) { const v = m.poiAcc; m.poiAcc = 0; djHurt(st, m, v, null, false); if (m.hp <= 0) return; }
    if (m.poi <= 0) m.poiD = 0;
  }
  if (m.stun > 0) m.stun -= dt; if (m.frz > 0) m.frz -= dt; if (m.root > 0) m.root -= dt; if (m.taunt > 0) m.taunt -= dt;
  if (!m.awake || m.hp <= 0) return;
  m.atkT -= dt;
  /* Sécurité : un monstre hors de sa salle fermée, ou bloqué depuis 5 s, est replacé dans la salle. */
  const R = st.rooms[m.room];
  if (!m.chk) m.chk = { x: m.x, y: m.y, t: st.t, a: m.atkN };
  let stuck = false;
  if (st.t - m.chk.t >= 4) { stuck = Math.hypot(m.x - m.chk.x, m.y - m.chk.y) < 0.6 && m.atkN === m.chk.a && !(m.sp && m.sp.act); m.chk = { x: m.x, y: m.y, t: st.t, a: m.atkN }; }
  if (R && R.st === 'lock' && (stuck || st.roomAt[Math.floor(m.y) * st.d.W + Math.floor(m.x)] !== m.room)) {
    const p = djRoomSpot(st, m.room, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; st.ev.push({ k: 'spawn', id: m.id, x: m.x, y: m.y }); }
  }
  if (m.stun > 0 || m.frz > 0) { m.mv = false; m.wind = 0; return; }
  if (m.boss && djBossStep(st, m)) return;
  /* Coup en préparation : il part à la fin (on peut l'esquiver en s'éloignant). */
  if (m.wind > 0) {
    m.wind -= dt; m.mv = false;
    if (m.wind > 0) return;
    const tt = djEnt(st, m.actTgt);
    if (m.act === 'melee') { if (tt && !tt.dead && tt.hp > 0 && djDist(m, tt) <= m.range + tt.r + m.r + 0.45) djHit(st, tt, m.dmg, m); }
    else if (m.act === 'shot') { if (tt) { const ax = tt.x - m.x, ay = tt.y - m.y, len = Math.hypot(ax, ay) || 1, sp = m.shot === 'arrow' ? 9 : 6; st.shots.push({ id: st.nid++, side: 'm', kind: m.shot, from: m.id, x: m.x, y: m.y, px: m.x, py: m.y, vx: ax / len * sp, vy: ay / len * sp, dmg: m.dmg, life: (m.range + 2) / sp, r: 0.25 }); } }
    else if (m.act === 'heal') { if (tt && tt.hp > 0) { tt.hp = Math.min(tt.hpMax, tt.hp + tt.hpMax * 0.15); st.ev.push({ k: 'mheal', id: tt.id, by: m.id }); } }
    else if (m.act === 'raise' && m.raiseAt) {
      /* le nécromant relève un squelette (plus faible) à la place d'un monstre tombé */
      const n = djMob(st, 'squelette', m.raiseAt[0], m.raiseAt[1], m.room, false);
      n.hp *= 0.6; n.hpMax *= 0.6; n.xp = 1; n.awake = true; n.raisedBy = m.id; n.atkT = 1;
      if (!djFree(st, n.x, n.y, n.r)) { const p = djRoomSpot(st, m.room, n.r); if (p) { n.x = n.px = p[0]; n.y = n.py = p[1]; } }
      st.mobs.push(n); st.ev.push({ k: 'spawn', id: n.id, x: n.x, y: n.y }); st.ev.push({ k: 'raised', id: n.id, by: m.id });
      m.raiseAt = null;
    }
    return;
  }
  const start = (act, tgt, wind, a) => { m.act = act; m.actTgt = tgt; m.wind = wind; m.atkT = m.rate; m.atkN++; st.ev.push({ k: 'matk', id: m.id, a, tgt }); };
  /* Le chaman soigne d'abord les blessés autour de lui. */
  if (m.raises && m.atkT <= 0 && st.mobs.filter(o => o.raisedBy === m.id && o.hp > 0).length < 3) {
    let best = null, bd = 6;
    for (const c of st.corpses) { const dd = Math.hypot(c.x - m.x, c.y - m.y); if (dd < bd && st.roomAt[Math.floor(c.y) * st.d.W + Math.floor(c.x)] === m.room) { bd = dd; best = c; } }
    if (best) { st.corpses.splice(st.corpses.indexOf(best), 1); m.raiseAt = [best.x, best.y]; start('raise', 0, 0.6, 'raise'); return; }
  }
  if (m.heals && m.atkT <= 0) {
    let best = null, bf = 0.7;
    for (const o of st.mobs) if (o !== m && o.hp > 0 && o.awake && o.hp / o.hpMax < bf && djDist(m, o) < 5) { bf = o.hp / o.hpMax; best = o; }
    if (best) { start('heal', best.id, 0.4, 'heal'); return; }
  }
  const t = djMobTarget(st, m);
  if (!t) { m.mv = false; return; }
  m.tgt = t.id;
  const dx = t.x - m.x, dy = t.y - m.y, dd = Math.hypot(dx, dy) || 0.001;
  if (m.ranged || m.heals || m.raises) {
    const los = djLos(st, m.x, m.y, t.x, t.y);
    if (dd < 2.8 && los && m.root <= 0) { djSteer(st, m, t, true); if (m.mv || m.atkT > 0) return; }
    else if (dd > m.range || !los) { djSteer(st, m, t, false); return; }
    m.mv = false; m.fx = dx / dd; m.fy = dy / dd;
    if (m.atkT <= 0) start('shot', t.id, 0.3, 'shot');
    return;
  }
  if (dd > m.range + t.r + m.r) { djSteer(st, m, t, false); return; }
  m.mv = false; m.fx = dx / dd; m.fy = dy / dd;
  if (m.atkT <= 0) start('melee', t.id, m.big ? 0.55 : 0.35, 'melee');
}
function djBossStep(st, m) { return m.type === 'roiSquelette' || m.type === 'gardien' ? djBossRoi(st, m) : djBossTroll(st, m); }
/* Le roi squelette : tempête d'os (des cercles s'allument sous les héros puis explosent), renforts à 70 % et 40 %, rage sous 30 %.
   Le gardien du portail fait de même, avec une pluie de feu et des diablotins. */
function djBossRoi(st, m) {
  const S = m.sp, dt = DJ_DT;
  if (S.storm == null) S.storm = 5;
  S.storm -= dt;
  if ((S.phase === 0 && m.hp < m.hpMax * 0.7) || (S.phase === 1 && m.hp < m.hpMax * 0.4)) {
    S.phase++;
    const c = djCenter(st.d.rooms[m.room]);
    (DJ_BOSS_ADDS[m.type] || DJ_BOSS_ADDS.roiSquelette).forEach((type, k) => {
      const a = k / 4 * 6.2832 + S.phase, x = m.x + Math.cos(a) * 2.6, y = m.y + Math.sin(a) * 2.6, ok = djFree(st, x, y, 0.38);
      const n = djMob(st, type, ok ? x : c[0] + 0.5, ok ? y : c[1] + 0.5, m.room, false); n.awake = true; st.mobs.push(n);
      st.ev.push({ k: 'spawn', id: n.id, x: n.x, y: n.y });
    });
    st.ev.push({ k: 'summon', id: m.id, x: m.x, y: m.y, boss: true });
  }
  if (!S.enr && m.hp < m.hpMax * 0.3) { S.enr = true; m.rate *= 0.7; m.speed *= 1.25; st.ev.push({ k: 'enrage', id: m.id }); }
  if (S.act === 'storm') {
    S.actT -= dt; m.mv = false;
    if (S.actT <= 0) {
      for (const p of S.pts) for (const t of djFoes(st)) if (Math.hypot(t.x - p[0], t.y - p[1]) <= 1.6 + t.r) djHit(st, t, m.dmg * 1.4);
      st.ev.push({ k: 'storm', id: m.id, pts: S.pts, r: 1.6, c: m.type === 'gardien' ? 'fire' : 'bone' }); S.act = null; S.storm = 7.5;
    }
    return true;
  }
  if (m.wind > 0) return false;
  if (S.storm <= 0 && djMobTarget(st, m)) {
    /* un cercle sous chaque héros, et deux de plus autour, au hasard */
    const pts = [];
    for (const h of st.heroes) if (!h.dead) { pts.push([djR2(h.x), djR2(h.y)]); const a = djRnd(st) * 6.2832; pts.push([djR2(h.x + Math.cos(a) * 2.4), djR2(h.y + Math.sin(a) * 2.4)]); }
    S.pts = pts; S.act = 'storm'; S.actT = 1.3;
    st.ev.push({ k: 'tele', id: m.id, a: 'storm', pts, r: 1.6, t: 1.3 });
    return true;
  }
  return false;
}
/* Le chef troll : coup de massue en cercle, charge, renforts à 66 % et 33 % de vie, rage sous 25 %. */
function djBossTroll(st, m) {
  const S = m.sp, dt = DJ_DT, tuto = m.type === 'gardeSource';
  S.slam -= dt; S.charge -= dt;
  if (!tuto && ((S.phase === 0 && m.hp < m.hpMax * 0.66) || (S.phase === 1 && m.hp < m.hpMax * 0.33))) {
    S.phase++;
    const R = st.d.rooms[m.room], c = djCenter(R);
    ['gobelin', 'gobelin', 'archer'].forEach((type, k) => {
      const a = k / 3 * 6.2832 + S.phase, x = m.x + Math.cos(a) * 2.4, y = m.y + Math.sin(a) * 2.4, ok = djFree(st, x, y, 0.38);
      const n = djMob(st, type, ok ? x : c[0] + 0.5, ok ? y : c[1] + 0.5, m.room, false); n.awake = true; st.mobs.push(n);
    });
    st.ev.push({ k: 'summon', id: m.id, x: m.x, y: m.y, boss: true });
  }
  if (!tuto && !S.enr && m.hp < m.hpMax * 0.25) { S.enr = true; m.rate *= 0.7; m.speed *= 1.2; st.ev.push({ k: 'enrage', id: m.id }); }
  if (S.act === 'slam') {
    S.actT -= dt; m.mv = false;
    if (S.actT <= 0) { for (const t of djFoes(st)) if (djDist(m, t) <= 3 + t.r) djHit(st, t, m.dmg * 1.6); st.ev.push({ k: 'slam', id: m.id, x: m.x, y: m.y, r: 3 }); S.act = null; S.slam = tuto ? 6 : 7; }
    return true;
  }
  if (S.act === 'chargeW') { S.actT -= dt; m.mv = false; if (S.actT <= 0) { S.act = 'charge'; S.actT = 0.85; S.hit = []; st.ev.push({ k: 'charge', id: m.id }); } return true; }
  if (S.act === 'charge') {
    S.actT -= dt; const step = 11 * dt, x0 = m.x, y0 = m.y;
    djMove(st, m, S.dx * step, S.dy * step); m.mv = true; m.fx = S.dx; m.fy = S.dy;
    for (const t of djFoes(st)) if (!S.hit.includes(t.id) && djDist(m, t) <= m.r + t.r + 0.25) { S.hit.push(t.id); djHit(st, t, m.dmg * 1.5); if (t.kind === 'hero' && !t.dead) { djMove(st, t, -S.dy * 1.4, S.dx * 1.4); t.tp = (t.tp || 0) + 1; } }
    const moved = Math.hypot(m.x - x0, m.y - y0);
    if (S.actT <= 0 || moved < step * 0.3) {
      S.act = null; S.charge = 11; m.mv = false;
      if (moved < step * 0.3) { m.stun = Math.max(m.stun, 1.2); st.ev.push({ k: 'wall', id: m.id, x: m.x, y: m.y }); }   // il s'assomme contre le mur
    }
    return true;
  }
  if (m.wind > 0) return false;
  const t = djMobTarget(st, m); if (!t) return false;
  const dd = djDist(m, t);
  if (S.slam <= 0 && dd <= 3.5) { const tt = tuto ? 1.4 : 1.0; S.act = 'slam'; S.actT = tt; st.ev.push({ k: 'tele', id: m.id, a: 'slam', x: m.x, y: m.y, r: 3, t: tt }); if (st.tuto) st.tuto.slam = 1; return true; }
  if (!tuto && S.charge <= 0 && dd >= 3 && dd <= 10 && djLos(st, m.x, m.y, t.x, t.y)) {
    S.dx = (t.x - m.x) / dd; S.dy = (t.y - m.y) / dd; S.act = 'chargeW'; S.actT = 0.8;
    st.ev.push({ k: 'tele', id: m.id, a: 'charge', x: m.x, y: m.y, dx: S.dx, dy: S.dy, len: 9, t: 0.8 }); return true;
  }
  return false;
}
/* Les monstres s'écartent les uns des autres, et les héros les poussent (on ne reste pas coincé). */
function djSeparate(st) {
  const L = st.mobs.filter(m => m.hp > 0 && m.awake);
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; let dx = b.x - a.x, dy = b.y - a.y; const R = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    let d = Math.sqrt(d2); if (d < 1e-4) { dx = Math.cos(a.id + b.id); dy = Math.sin(a.id + b.id); d = 1; }
    const push = (R - Math.min(d, R)) / 2, ux = dx / d, uy = dy / d, wa = a.boss ? 0.15 : b.boss ? 1.85 : 1;
    djMove(st, a, -ux * push * wa, -uy * push * wa); djMove(st, b, ux * push * (2 - wa), uy * push * (2 - wa));
  }
  for (const h of st.heroes) {
    if (h.dead) continue;
    for (const m of L) { const dx = m.x - h.x, dy = m.y - h.y, R = m.r + h.r, d = Math.hypot(dx, dy); if (d < R && d > 1e-4 && !m.boss) djMove(st, m, dx / d * (R - d), dy / d * (R - d)); }
  }
}
function djShotStep(st, s) {
  const dt = DJ_DT; s.life -= dt;
  if (s.side === 'h') {
    const t = st.mobs.find(m => m.id === s.tgt && m.hp > 0);
    if (!t || s.life <= 0) { s.dead = true; return; }
    const dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy), step = s.spd * dt;
    if (len <= step + t.r) {
      s.dead = true; s.x = t.x; s.y = t.y; if (djEvade(st, t)) return;
      const from = djEnt(st, s.from); djHurt(st, t, s.dmg, from, s.crit, 'basic'); if (s.basic) djOnBasic(st, from, t, s.dmg, s.crit);
      if (s.splash) for (const m of djAround(st, s.x, s.y, s.splash)) if (m !== t) djHurt(st, m, s.dmg * 0.4, null, false);   // la boule du mage éclabousse
      return;
    }
    s.x += dx / len * step; s.y += dy / len * step;
  } else {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.life <= 0 || !st.d.grid[Math.floor(s.y) * st.d.W + Math.floor(s.x)]) { s.dead = true; return; }
    for (const t of djFoes(st)) if (Math.hypot(t.x - s.x, t.y - s.y) <= t.r + s.r) { s.dead = true; djHit(st, t, s.dmg); return; }
  }
}
function djZoneStep(st, z) {
  z.t -= DJ_DT; z.tick -= DJ_DT;
  if (z.tick <= 0) {
    z.tick += 0.5;
    if (z.dps) for (const m of djAround(st, z.x, z.y, z.r)) djHurt(st, m, z.dps * 0.5, djEnt(st, z.own), false, 'dot');
    if (z.hps) for (const h of st.heroes) if (!h.dead && Math.hypot(h.x - z.x, h.y - z.y) <= z.r + h.r) djHeal(st, h, h.hpMax * z.hps * 0.5);
  }
  if (z.t <= 0) z.dead = true;
}
/* Un héros entre dans une salle : les grilles se ferment, les monstres se réveillent, l'autre héros le rejoint. */
function djLock(st, ri, h) {
  const R = st.rooms[ri], d = st.d;
  if (!st.mobs.some(m => m.room === ri && m.hp > 0)) { R.st = 'clear'; return; }
  R.st = 'lock';
  for (const k of st.doors[ri]) st.door[k] = 1;
  for (const m of st.mobs) if (m.room === ri && !m.hidden) m.awake = true;
  for (const o of st.heroes.concat(st.allies)) {
    if (o === h || o.dead || (o.kind !== 'hero' && !o.inv && o.hp <= 0)) continue;
    if (st.roomAt[Math.floor(o.y) * d.W + Math.floor(o.x)] !== ri) { st.ev.push({ k: 'blink', id: o.id, x0: o.x, y0: o.y, x1: h.x, y1: h.y }); o.x = o.px = h.x; o.y = o.py = h.y; if (o.kind === 'hero') o.tp = (o.tp || 0) + 1; }
  }
  for (const e of st.heroes.concat(st.allies)) if (!djFree(st, e.x, e.y, e.r)) djUnstick(st, e, ri);
  for (const m of st.mobs) if (m.room === ri && !m.hidden && !djFree(st, m.x, m.y, m.r)) { const p = djRoomSpot(st, ri, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; } }
  st.ev.push({ k: 'lock', room: ri, boss: d.rooms[ri].kind === 'boss' });
}
function djWorld(st) {
  const d = st.d, W = d.W, cellRoom = e => st.roomAt[Math.floor(e.y) * W + Math.floor(e.x)];
  for (const h of st.heroes) { if (h.dead) continue; const ri = cellRoom(h); if (ri >= 0 && st.rooms[ri].st === 'idle') djLock(st, ri, h); }
  st.rooms.forEach((R, ri) => {
    if (R.st !== 'lock' && R.st !== 'fight') return;
    if (!st.mobs.some(m => m.room === ri && m.hp > 0)) {
      R.st = 'clear'; for (const k of st.doors[ri]) st.door[k] = 0;
      const boss = d.rooms[ri].kind === 'boss';
      const left = st.rooms.some((R2, i) => (d.rooms[i].kind === 'fight' || d.rooms[i].kind === 'boss') && R2.st !== 'clear');
      if (!left && !st.exit) { const c = d.cradle || djCenter(d.rooms[d.exitRoom != null ? d.exitRoom : ri]); st.exit = { x: c[0] + 0.5, y: c[1] + 0.5 }; }
      st.ev.push({ k: 'clear', room: ri, boss });
      for (const h of st.heroes) if (h.dead && !h.gone) djRaise(st, h, 0.3, 0);      // salle nettoyée : l'allié tombé se relève
      return;
    }
    /* Vague suivante : quand tous les monstres visibles sont vaincus, d'autres sortent des galeries (1,2 s plus tard). */
    if (!st.mobs.some(m => m.room === ri && m.hp > 0 && !m.hidden)) {
      if (!R.waveT) { R.waveT = 1.2; st.ev.push({ k: 'wavecome', room: ri, n: R.wave + 2, of: R.waves }); }
      R.waveT -= DJ_DT;
      if (R.waveT <= 0) {
        R.waveT = 0; R.wave++;
        for (const m of st.mobs) {
          if (m.room !== ri || !m.hidden || m.wave > R.wave) continue;
          /* jamais dans les pattes d'un héros, toujours dans la salle */
          if (st.heroes.some(h => !h.dead && djDist(h, m) < 2.5) || !djFree(st, m.x, m.y, m.r) || st.roomAt[Math.floor(m.y) * d.W + Math.floor(m.x)] !== ri) {
            const p = djRoomSpot(st, ri, m.r); if (p) { m.x = m.px = p[0]; m.y = m.py = p[1]; }
          }
          m.hidden = false; m.awake = true; m.atkT = 0.8 + djRnd(st) * 0.6;
          st.ev.push({ k: 'spawn', id: m.id, x: m.x, y: m.y });
        }
        st.ev.push({ k: 'wave', room: ri, n: R.wave + 1, of: R.waves });
      }
    }
    /* Sécurité : si plus aucun héros vivant n'est dans la salle, les grilles se rouvrent. */
    if (R.st === 'lock') { R.out = st.heroes.some(h => !h.dead && cellRoom(h) === ri) ? 0 : R.out + DJ_DT; if (R.out > 3) { R.st = 'fight'; for (const k of st.doors[ri]) st.door[k] = 0; } }
  });
  for (const h of st.heroes) {
    if (h.dead) continue;
    for (const c of st.chests) if (!c.open && Math.hypot(c.x - h.x, c.y - h.y) < 1.1) {
      c.open = true;
      const got = djLootAdd(st, DJ_CHEST, djLootMul(st.lvl) * (st.heroes.some(p => p.race === 'halfelin') ? 1.5 : 1)), g = Math.round(5 * djLootMul(st.lvl) * st.goldMul);
      st.gold += g; got.or = g;
      st.ev.push({ k: 'chest', x: c.x, y: c.y, got });
      for (const p of st.heroes) if (!p.gone) {
        if (djRnd(st) < 0.6) djDrop(st, p, { src: 'chest', luck: p.luck * (p.race === 'halfelin' ? 1.2 : 1) }, c);
        if (djRnd(st) < 0.08) djGem(st, p, 1, c);
      }
    }
    if (st.altar && !st.altar.used && Math.hypot(st.altar.x - h.x, st.altar.y - h.y) < 1.2) {
      st.altar.used = true; st.bless = ['force', 'vigueur', 'celerite'][Math.floor(djRnd(st) * 3)];
      if (st.bless === 'vigueur') for (const p of st.heroes) { p.hpMax = djHpMax(st, p); if (!p.dead) p.hp = p.hpMax; }
      st.ev.push({ k: 'altar', b: st.bless, x: st.altar.x, y: st.altar.y });
    }
    if (st.pris && !st.pris.freed && Math.hypot(st.pris.x - h.x, st.pris.y - h.y) < 1.3) { st.pris.freed = true; st.ev.push({ k: 'free', x: st.pris.x, y: st.pris.y }); }
    if (st.exit && !st.over && Math.hypot(st.exit.x - h.x, st.exit.y - h.y) < 1.0) { st.over = st.d.floor ? 'floor' : 'win'; st.ev.push({ k: st.over }); }
  }
  /* À deux : rester 3 s près d'un allié tombé le relève (40 % de vie). */
  for (const h of st.heroes) {
    if (!h.dead || h.gone) { h.rev = 0; continue; }
    const helper = st.heroes.find(o => o !== h && !o.dead && djDist(o, h) < 1.6);
    if (helper) { h.rev += DJ_DT; if (h.rev >= 3) djRaise(st, h, 0.4, helper.id); }
    else h.rev = Math.max(0, h.rev - DJ_DT * 2);
  }
  /* Pièges à pointes : sortis 0,6 s toutes les 2,4 s ; 12 % de la vie à chaque fois. */
  for (const tr of st.traps) {
    const u = st.t + tr.ph, cyc = Math.floor(u / 2.4); tr.on = u - cyc * 2.4 < 0.6;
    if (!tr.on) continue;
    for (const h of st.heroes) if (!h.dead && h.b.inv === undefined && Math.floor(h.x) === tr.x && Math.floor(h.y) === tr.y && tr.hit[h.id] !== cyc) {
      tr.hit[h.id] = cyc; st.ev.push({ k: 'trap', id: h.id, x: tr.x + 0.5, y: tr.y + 0.5 }); djDamageHero(st, h, h.hpMax * 0.12);
    }
  }
  if (!st.over && st.heroes.every(h => h.dead)) { st.endT += DJ_DT; if (st.endT >= 1.8) { st.over = 'lose'; st.ev.push({ k: 'lose' }); } }
}
/* Avance d'un pas. inputs : { [id du héros]: { mx, my (joystick, -1 à 1), sk (compétence 0-2 ou -1), pot (potion) } }. */
function djStep(st, inputs) {
  if (st.over) return st;
  st.n++; st.t += DJ_DT;
  for (const L of [st.heroes, st.mobs, st.allies, st.shots]) for (const e of L) { e.px = e.x; e.py = e.y; }
  if (st.n - st.flowN >= 4 || !st.flow) djFlow(st);
  st.calmT = st.mobs.some(m => m.awake && m.hp > 0) ? 0 : st.calmT + DJ_DT;
  for (const h of st.heroes) djHeroStep(st, h, (inputs && inputs[h.id]) || {});
  for (const a of st.allies) djAllyStep(st, a);
  for (const m of st.mobs) djMobStep(st, m);
  djSeparate(st);
  for (const s of st.shots) djShotStep(st, s);
  for (const z of st.zones) djZoneStep(st, z);
  djWorld(st);
  if (st.tuto) djTuto(st);
  st.mobs = st.mobs.filter(m => m.hp > 0);
  st.allies = st.allies.filter(a => a.inv || a.hp > 0);
  st.shots = st.shots.filter(s => !s.dead);
  st.zones = st.zones.filter(z => !z.dead);
  st.corpses = st.corpses.filter(c => st.t - c.t < 10);
  return st;
}
/* La mission d'intro, guidée par Sukhoï : chaque étape s'annonce ({ k: 'tuto', s }) quand elle devient utile et se valide
   ({ k: 'tutoOk', s }) quand le joueur l'a faite ; une seule bulle à la fois (la première étape en cours, dans l'ordre). */
const DJ_TUTO = [
  { s: 'move', on: () => true, ok: (st, h, T) => Math.hypot(h.x - T.x0, h.y - T.y0) > 3 },
  { s: 'fight', on: st => st.mobs.some(m => m.awake && m.hp > 0), ok: st => st.kills > 0 },
  { s: 'roll', on: (st, h, T) => !!T.slam, ok: (st, h) => (h.rollN | 0) > 0, end: st => !!st.exit },
  { s: 'potion', on: (st, h) => h.hp < h.hpMax * 0.6 && h.pot > 0, ok: (st, h, T) => h.pot < T.pot0, end: (st, h) => h.hp >= h.hpMax * 0.95 || h.pot <= 0 },
  { s: 'skill', on: (st, h) => st.kills > 0 && h.rank[0] > 0 && st.mobs.some(m => m.awake && m.hp > 0), ok: (st, h) => h.castN > 0, end: st => !!st.exit },
  { s: 'chest', on: st => st.chests.some(c => !c.open && st.rooms[c.room].st === 'clear'), ok: st => st.chests.every(c => c.open), end: st => st.rooms.some((R, i) => st.d.rooms[i].kind === 'boss' && R.st !== 'idle') },
  { s: 'cradle', on: st => !!st.exit, ok: st => st.over === 'win' },
];
function djTuto(st) {
  const T = st.tuto, h = st.heroes[0]; if (!h) return;
  for (const S of DJ_TUTO) {
    if (T.done[S.s]) continue;
    if (S.ok(st, h, T)) { T.done[S.s] = 1; st.ev.push({ k: 'tutoOk', s: S.s }); if (T.on === S.s) T.on = ''; continue; }
    if (S.end && S.end(st, h, T)) { T.done[S.s] = 1; if (T.on === S.s) T.on = ''; continue; }
  }
  const next = DJ_TUTO.find(S => !T.done[S.s] && S.on(st, h, T));
  if (next && T.on !== next.s) { T.on = next.s; st.ev.push({ k: 'tuto', s: next.s }); }
}
function djFlee(st) { if (!st.over) { st.fled = true; st.over = 'lose'; st.ev.push({ k: 'lose', fled: true }); } }
/* Bilan : victoire = tout ; défaite ou fuite = moitié de l'expérience et du butin. Le prisonnier délivré est sauvé dans tous les cas. */
function djResult(st) {
  const win = st.over === 'win' || st.over === 'floor', L = st.lvl, k = win ? 1 : 0.5, loot = {};
  for (const r in st.loot) { const n = Math.round(st.loot[r] * k); if (n > 0) loot[r] = n; }
  return { win, lvl: L, xp: Math.round((st.xp + (win ? 60 * djXpMul(L) : 0)) * k), loot, pris: !!(st.pris && st.pris.freed), kills: st.kills, secs: Math.round(st.t), fled: !!st.fled, combos: st.combos || 0, theme: st.d.theme,
    gold: Math.round((st.gold || 0) * k), items: djHalfItems(st.items || {}, win), gems: djHalfGems(st.gems || {}, win) };
}
/* Défaite ou fuite : on garde la meilleure moitié des objets (arrondie au-dessus) et la moitié des pierres. */
function djHalfItems(items, win) {
  const out = {};
  for (const hid in items) { const l = items[hid] || []; out[hid] = win ? l.slice() : l.slice().sort((a, b) => b.r - a.r || b.il - a.il).slice(0, Math.ceil(l.length / 2)); }
  return out;
}
function djHalfGems(gems, win) {
  const out = {};
  for (const hid in gems) { const g = {}; for (const k in gems[hid]) { const n = win ? gems[hid][k] : Math.round(gems[hid][k] * 0.5); if (n > 0) g[k] = n; } out[hid] = g; }
  return out;
}
function djAddGems(a, b) { const out = Object.assign({}, a); for (const k in b || {}) out[k] = (out[k] || 0) + b[k]; return out; }
/* Où en est-on ? (pour l'interface) */
function djProgress(st) {
  const fights = st.d.rooms.map((r, i) => [r, i]).filter(([r]) => r.kind === 'fight');
  const boss = st.mobs.find(m => m.boss), bi = st.d.rooms.findIndex(r => r.kind === 'boss');
  const cur = st.rooms.findIndex(R => R.st === 'lock');
  return { done: fights.filter(([, i]) => st.rooms[i].st === 'clear').length, total: fights.length, boss: boss && st.rooms[bi].st === 'lock' ? boss : null,
    bossDead: !st.mobs.some(m => m.boss), fighting: cur >= 0, wave: cur >= 0 ? st.rooms[cur].wave + 1 : 0, waves: cur >= 0 ? st.rooms[cur].waves : 0 };
}

/* ===================== DONJONS À DEUX : l'hôte simule, l'invitée affiche =====================
   Le téléphone de l'hôte fait tourner le combat et envoie l'état ~7 fois par seconde ; celui de l'invitée l'affiche
   (en lissant), déplace lui-même son héros (pour qu'il réponde tout de suite) et envoie sa position et ses boutons. */
const DJ_PV = 6;                       // version du jeu à deux : à augmenter quand le combat ou les messages changent (4 : donjon du portail, 5 : roulade, 6 : humeur de Lilou)
const DJ_PETS = ['loup', 'faucon', 'sanglier', 'chouette'];
const DJ_MT = ['gobelin', 'archer', 'chaman', 'troll', 'chefTroll', 'squelette', 'archerSq', 'goule', 'spectre', 'necromant', 'golem', 'roiSquelette', 'diablotin', 'lanceflamme', 'gardien', 'gardeSource'];
const DJ_ST = { idle: 'i', lock: 'l', clear: 'c', open: 'o', fight: 'f' }, DJ_STR = { i: 'idle', l: 'lock', c: 'clear', o: 'open', f: 'fight' };
const djR1 = x => Math.round(x * 10) / 10, djR2 = x => Math.round(x * 100) / 100;
/* Instantané envoyé par l'hôte (nombres arrondis, listes courtes). evs : événements depuis le précédent (pour les effets). */
function djSnap(st, evs, n, res) {
  return {
    n, t: djR2(st.t), sn: st.n, pv: DJ_PV, sd: st.d.seed, fl: st.d.floor || 0, lv: st.lvl, th: st.d.theme, nr: st.d.rooms.filter(r => r.kind === 'fight').length, bs: st.d.rooms.some(r => r.kind === 'boss') ? 1 : 0,
    h: st.heroes.map(h => [h.id, djR2(h.x), djR2(h.y), djR1(h.hp), djR1(h.hpMax),
      (h.dead ? 1 : 0) | (h.mv ? 2 : 0) | (h.b.stealth > 0 ? 4 : 0) | (h.b.inv > 0 ? 8 : 0) | (h.gone ? 16 : 0),
      djR2(h.fx), djR2(h.fy), djR1(h.cd[0]), djR1(h.cd[1]), djR1(h.cd[2]), djR1(h.cdMax[0]), djR1(h.cdMax[1]), djR1(h.cdMax[2]),
      h.pot, djR1(h.shield), h.form === 'ours' ? 1 : h.form === 'loup' ? 2 : 0, h.tp | 0, djR1(Math.max(0, h.potT)), h.atkN, h.castN, djR1(h.rev), h.tgt | 0, h.rollN | 0]),
    m: st.mobs.filter(m => !m.hidden && m.hp > 0).map(m => [m.id, DJ_MT.indexOf(m.type), djR2(m.x), djR2(m.y), djR1(m.hp), djR1(m.hpMax),
      (m.awake ? 1 : 0) | (m.mv ? 2 : 0) | (m.stun > 0 ? 4 : 0) | (m.frz > 0 ? 8 : 0) | (m.root > 0 ? 16 : 0) | (m.boss ? 32 : 0) | (m.sp && m.sp.enr ? 64 : 0) | (m.big ? 128 : 0),
      djR2(m.fx), djR2(m.fy), m.atkN, m.room, m.r]),
    a: st.allies.filter(a => a.inv || a.hp > 0).map(a => [a.id, a.kind === 'pet' ? 1 : 0, a.own, djR2(a.x), djR2(a.y), djR1(a.hp), djR1(a.hpMax), a.mv ? 1 : 0, a.atkN, djR2(a.fx || 0), djR2(a.fy || 0), Math.max(0, DJ_PETS.indexOf(a.pt))]),
    s: st.shots.map(s => [s.id, s.kind, djR2(s.x), djR2(s.y)]),
    z: st.zones.map(z => [z.id, z.k, djR2(z.x), djR2(z.y), z.r]),
    r: st.rooms.map(R => [DJ_ST[R.st] || 'o', R.wave, R.waves]),
    ch: st.chests.map(c => (c.open ? '1' : '0')).join('') || '0',
    al: st.altar && st.altar.used ? 1 : 0, bl: st.bless || 0, pr: st.pris && st.pris.freed ? 1 : 0,
    ex: st.exit ? [djR2(st.exit.x), djR2(st.exit.y)] : 0,
    ov: st.over || 0, res: res || (st.over && st.over !== 'floor' ? djResult(st) : 0), xp: Math.round(st.xp), k: st.kills, cb: st.combos || 0, gd: Math.round(st.gold || 0),
    ev: evs && evs.length ? evs : 0,
  };
}
/* L'invitée applique un instantané à sa copie de l'état (créée au départ par djStart avec la même graine). me : id de son héros.
   Renvoie les événements à jouer, ou null si l'instantané est ancien. */
function djApplySnap(ms, sn, me) {
  if (!sn || sn.sd !== ms.d.seed || (ms.snapN != null && sn.n <= ms.snapN)) return null;   // un ancien message (autre partie) est ignoré
  ms.snapN = sn.n; ms.t = sn.t; ms.n = sn.sn;
  const H = new Map(ms.heroes.map(h => [h.id, h]));
  for (const a of sn.h || []) {
    const h = H.get(a[0]); if (!h) continue;
    const mine = h.id === me, tp = a[17] | 0;
    if (!mine) { h.px = h.x; h.py = h.y; h.x = a[1]; h.y = a[2]; }
    else if (tp !== (h.tp | 0) || Math.hypot(h.x - a[1], h.y - a[2]) > 4) { h.x = h.px = a[1]; h.y = h.py = a[2]; }   // téléporté par l'hôte (ou trop loin) : on se recale
    h.tp = tp; h.hp = a[3]; h.hpMax = a[4];
    const f = a[5]; h.dead = !!(f & 1); h.gone = !!(f & 16);
    h.b.stealth = f & 4 ? 1 : 0; h.b.inv = f & 8 ? 1 : 0;
    if (!mine) { h.mv = !!(f & 2); h.fx = a[6]; h.fy = a[7]; }
    h.cd = [a[8], a[9], a[10]]; h.cdMax = [a[11] || 1, a[12] || 1, a[13] || 1]; h.pot = a[14]; h.shield = a[15];
    h.form = a[16] === 1 ? 'ours' : a[16] === 2 ? 'loup' : null; h.potT = a[18]; h.atkN = a[19]; h.castN = a[20]; h.rev = a[21]; h.tgt = a[22];
    if (!mine) h.rollN = a[23] | 0;
  }
  const keep = (list, rows, make, upd) => { const old = new Map(list.map(e => [e.id, e])), out = []; for (const a of rows || []) { let e = old.get(a[0]); if (!e) e = make(a); else { e.px = e.x; e.py = e.y; } upd(e, a); out.push(e); } return out; };
  ms.mobs = keep(ms.mobs, sn.m, a => ({ id: a[0], kind: 'mob', type: DJ_MT[a[1]] || 'gobelin', x: a[2], y: a[3], px: a[2], py: a[3], b: {} }), (m, a) => {
    m.x = a[2]; m.y = a[3]; m.hp = a[4]; m.hpMax = a[5];
    const f = a[6]; m.awake = !!(f & 1); m.mv = !!(f & 2); m.stun = f & 4 ? 1 : 0; m.frz = f & 8 ? 1 : 0; m.root = f & 16 ? 1 : 0;
    m.boss = !!(f & 32); m.big = !!(f & 128); m.sp = m.boss ? { enr: !!(f & 64) } : null;
    m.fx = a[7]; m.fy = a[8]; m.atkN = a[9]; m.room = a[10]; m.r = a[11] || 0.38; m.hidden = false;
  });
  ms.allies = keep(ms.allies, sn.a, a => ({ id: a[0], kind: a[1] ? 'pet' : 'skel', pt: a[1] ? DJ_PETS[a[11] | 0] : null, own: a[2], x: a[3], y: a[4], px: a[3], py: a[4], r: a[1] ? 0.25 : 0.32, inv: !!a[1] }), (e, a) => {
    e.x = a[3]; e.y = a[4]; e.hp = a[5]; e.hpMax = a[6]; e.mv = !!a[7]; e.atkN = a[8]; e.fx = a[9]; e.fy = a[10];
  });
  ms.shots = keep(ms.shots, sn.s, a => ({ id: a[0], kind: a[1], x: a[2], y: a[3], px: a[2], py: a[3] }), (e, a) => { e.x = a[2]; e.y = a[3]; });
  ms.zones = keep(ms.zones, sn.z, a => ({ id: a[0], k: a[1], x: a[2], y: a[3], r: a[4] }), () => {});
  (sn.r || []).forEach((a, i) => { const R = ms.rooms[i]; if (!R) return; R.st = DJ_STR[a[0]] || 'open'; R.wave = a[1]; R.waves = a[2]; });
  ms.door.fill(0); ms.rooms.forEach((R, i) => { if (R.st === 'lock') for (const k of ms.doors[i]) ms.door[k] = 1; });
  const ch = String(sn.ch || ''); ms.chests.forEach((c, i) => { c.open = ch[i] === '1'; });
  if (ms.altar) ms.altar.used = !!sn.al;
  ms.bless = sn.bl || null;
  if (ms.pris) ms.pris.freed = !!sn.pr;
  ms.exit = sn.ex ? { x: sn.ex[0], y: sn.ex[1] } : null;
  for (const tr of ms.traps) { const u = ms.t + tr.ph, cyc = Math.floor(u / 2.4); tr.on = u - cyc * 2.4 < 0.6; }
  ms.xp = sn.xp; ms.kills = sn.k; ms.combos = sn.cb || 0; ms.gold = sn.gd || 0;
  if ((sn.ov || null) !== (ms.over || null)) { ms.over = sn.ov || null; ms.res = sn.res || null; }
  return sn.ev || [];
}
/* Sur le téléphone de l'invitée : son héros bouge tout de suite (mêmes murs, même vitesse, même pas en avant au contact). */
function djLocalMove(st, h, mx, my, dt) {
  h.px = h.x; h.py = h.y;
  if (h.dead) { h.mv = false; return; }
  if (h.rollCd > 0) h.rollCd = Math.max(0, h.rollCd - dt);
  if (h.roll > 0) { h.roll = Math.max(0, h.roll - dt); h.mv = djMove(st, h, h.rdx * DJ_ROLL.spd * dt, h.rdy * DJ_ROLL.spd * dt); h.fx = h.rdx; h.fy = h.rdy; return; }
  const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  const spd = h.speed * (h.form === 'loup' ? 1.25 : 1) * (st.bless === 'celerite' ? 1.15 : 1), reach = h.form ? 1.6 : h.range;
  if (m > 0.2) { h.mv = djMove(st, h, mx * spd * dt, my * spd * dt); h.fx = mx / Math.max(1, m); h.fy = my / Math.max(1, m); return; }
  h.mv = false;
  if (reach < 2) {
    const t = djNearest(st, h, 4.5);
    if (t && djDist(h, t) > reach + t.r) { const dx = t.x - h.x, dy = t.y - h.y, len = Math.hypot(dx, dy); h.mv = djMove(st, h, dx / len * spd * dt, dy / len * spd * dt); h.fx = dx / len; h.fy = dy / len; }
  }
}

/* L'invitée lance sa roulade chez elle (l'hôte, prévenu par ses commandes, la rend intouchable). Renvoie true si elle part. */
function djLocalRoll(st, h, mx, my) {
  if (!h || h.dead || h.rollCd > 0) return false;
  const m = Math.hypot(mx, my);
  let dx = m > 0.2 ? mx / m : h.fx || 0, dy = m > 0.2 ? my / m : h.fy || 0; const L = Math.hypot(dx, dy);
  if (L < 1e-6) { dx = 0; dy = 1; } else { dx /= L; dy /= L; }
  h.roll = DJ_ROLL.t; h.rollCd = DJ_ROLL.cd; h.rdx = dx; h.rdy = dy; h.rollN = (h.rollN | 0) + 1;
  return true;
}

/* ===================== LES PROFONDEURS : des étages sans fin =====================
   Étages de 3 ou 4 salles ; un boss tous les 5 étages ; la mine puis la crypte, par tranches de 5 étages ;
   +1 niveau de monstres tous les 2 étages. À la sortie de chaque étage : descendre, ou remonter avec tout le butin. */
function djFloorCfg(floor, start) {
  return { floor, lvl: Math.max(1, start) + Math.floor((floor - 1) / 2), theme: Math.floor((floor - 1) / 5) % 2 ? 'crypte' : 'mine',
    rooms: floor % 5 === 0 ? 3 : 3 + (floor % 2 ? 0 : 1), boss: floor % 5 === 0 };
}
const djFloorSeed = (seed, floor) => (hash((seed ^ Math.imul(floor, 7919)) >>> 0) || 1) >>> 0;
function djFloor(seed, floor, start) {
  const c = djFloorCfg(floor, start), sd = djFloorSeed(seed, floor);
  return genDungeon(sd, c.lvl, c.theme, { rooms: c.rooms, boss: c.boss, floor });
}
/* Ce que les héros emportent à l'étage suivant : leur vie (+25 %), leurs potions, le relèvement déjà utilisé. */
function djCarry(st) {
  const out = {};
  for (const h of st.heroes) out[h.id] = { hp: h.dead ? (h.gone ? 0 : 0.3) : Math.min(1, h.hp / h.hpMax + 0.25), pot: h.pot, revived: h.revived, gone: h.gone };
  return out;
}
/* Cumul d'une descente : chaque étage fini ajoute son bilan ; à la fin, défaite ou fuite = la moitié de tout. */
function djRunAdd(run, r) {
  run.xp += r.xp; run.kills += r.kills; run.secs += r.secs; run.combos += r.combos || 0; if (r.pris) run.pris = true;
  for (const k in r.loot) run.loot[k] = (run.loot[k] || 0) + r.loot[k];
  run.gold = (run.gold || 0) + (r.gold || 0);
  if (!run.items) run.items = {}; if (!run.gems) run.gems = {};
  for (const hid in r.items || {}) run.items[hid] = (run.items[hid] || []).concat(r.items[hid]);
  for (const hid in r.gems || {}) run.gems[hid] = djAddGems(run.gems[hid], r.gems[hid]);
  return run;
}
function djRunResult(run, win, partial) {
  const all = djRunAdd(JSON.parse(JSON.stringify(run)), partial || { xp: 0, kills: 0, secs: 0, loot: {} }), k = win ? 1 : 0.5, loot = {};
  for (const r in all.loot) { const n = Math.round(all.loot[r] * k); if (n > 0) loot[r] = n; }
  return { win, prof: true, lvl: run.start, deep: run.done, xp: Math.round(all.xp * k), loot, pris: !!all.pris, kills: all.kills, secs: all.secs, combos: all.combos, fled: !win && !!(partial && partial.fled), theme: 'prof',
    gold: Math.round((all.gold || 0) * k), items: djHalfItems(all.items || {}, win), gems: djHalfGems(all.gems || {}, win) };
}
/* Objets envoyés à l'invitée dans les instantanés (forme courte). */
const djPack = it => [it.sl, it.k, it.r, it.il, it.sd, it.set || 0, it.pw || 0];
const djUnpack = a => cleanItem({ sl: a[0], k: a[1], r: a[2], il: a[3], sd: a[4], set: a[5] || null, pw: a[6] || null });

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
  const M2_NAMES = ['taverne', 'halle', 'chantier'];   // modèles Meshy de docs/v2/models (chantier = bâtiment en construction)
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
    const wallish = it => it.type === 'rempart' || it.type === 'porte', hidden = it => it.type === 'piege' || it.type === 'filet';
    const blds = items.filter(it => !wallish(it) && !hidden(it) && it.key !== 'ghost'), walls = items.filter(wallish);
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
    const PROPS = { bucheron: ['logs', 'logs', 'crate'], carriere: ['block', 'block', 'barrel'], mine: ['block', 'crate'], forge: ['barrel', 'logs', 'crate'], champ: ['hay'], moulin: ['sack', 'sack', 'hay'], boulangerie: ['sack', 'barrel'], brasserie: ['sack', 'crate'], entrepot: ['crate', 'barrel', 'sack'], taverne: ['barrel', 'barrel', 'crate'], halle: ['barrel', 'crate', 'sack'], chasse: ['crate', 'logs'] };
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
  let light = false, fpsAvg = 30;
  const pixelRatio = () => light ? 1 : Math.min(2, window.devicePixelRatio || 1);
  /* Graphismes légers : une image moins fine (1 pixel par point) et pas d'ombres (le plus coûteux sur un téléphone). */
  function setLight(on) {
    light = !!on; if (!renderer) return;
    renderer.setPixelRatio(pixelRatio()); resize();
    if (sun) sun.castShadow = !light;
  }
  function init(cv, opts) {
    canvas = cv; light = !!(opts && opts.light);
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !light, powerPreference: 'high-performance' }); } catch (e) { return false; }
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(pixelRatio());
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222233);
    scene.fog = new THREE.Fog(0xe9c27e, 70, 150);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.castShadow = !light;
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
    scene.add(bldGroup); scene.add(unitGroup); scene.add(fxGroup); scene.add(rangeGroup); scene.add(wallGroup); scene.add(portalGroup);
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
        if (gest.moved) { if (!DJ) panBy(x - gest.lx, y - gest.ly); gest.lx = x; gest.ly = y; }
      } else if (gest.k === 'two' && ptrs.size >= 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        cam.view = Math.max(VMIN, Math.min(VMAX, gest.v0 * gest.d0 / d)); frustum();
        if (!DJ) panBy(mx - gest.mx, my - gest.my); gest.mx = mx; gest.my = my;
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
    /* un poste de garde (un simple mât) caché derrière un grand bâtiment : toucher sa case suffit */
    const g0 = pickGround(cx, cy);
    if (g0) { const gx = Math.floor(g0[0]), gz = Math.floor(g0[1]); for (const [k, r] of blds) if (r.item.type === 'poste' && r.item.gx === gx && r.item.gz === gz) return k; }
    setRay(cx, cy);
    const hits = ray.intersectObjects(bldGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && o.parent !== bldGroup) o = o.parent; if (o && o.userData.key != null) return o.userData.key; }
    if (portalGroup.visible) { const ph = ray.intersectObjects(portalGroup.children, true); for (const h of ph) { let o = h.object; while (o && o.parent !== portalGroup) o = o.parent; if (o && o.userData.key != null) return o.userData.key; } }
    const g = pickGround(cx, cy);
    if (g) { const w = wallAt.get(Math.floor(g[0]) + ',' + Math.floor(g[1])); if (w) return w.key; }
    return null;
  }

  /* ---------- bâtiments affichés ---------- */
  /* Modèles provisoires (en attendant ceux générés avec Meshy) et équivalents dessinés par le code. */
  const B_MODEL = { halle: 'castle', taverne: 'tavern', bucheron: 'lumbermill', carriere: 'mine', moulin: 'windmill', boulangerie: 'market', entrepot: 'barracks', tour: 'tower_A' };
  const V1_PROC = { halle: 'mairie', taverne: 'camp', bucheron: 'scierie', carriere: 'carriere', moulin: 'ferme', entrepot: 'entrepot', boulangerie: 'caserne', tour: 'tour' };
  const bModelOf = it => it.type === 'tour' && it.lvl >= 3 ? 'tower_B' : B_MODEL[it.type];
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
  function sigOf(it) { return [it.type, it.lvl, it.gx, it.gz, it.up ? 1 : 0, it.dead ? 1 : 0, it.col, it.orc ? 1 : 0, it.id || 0, LIB.ver, it.ban == null ? '' : it.ban, it.crown || ''].join('|'); }
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
  /* Forge : atelier de pierre ouvert, grande cheminée, foyer rougeoyant, enclume (en attendant son modèle Meshy). */
  function forgeG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), y0 = 0.14, ch = 1.7 + 0.2 * lv;
    g.add(P('box', 0x8a8378, 1.72, y0, 1.5, 0, 0, 0));
    g.add(P('box', 0x8f8a80, 1.5, 0.92, 0.3, 0, y0, -0.56));
    g.add(P('box', 0x8f8a80, 0.26, 0.92, 0.86, -0.62, y0, -0.14));
    for (const x of [-0.7, 0.7]) g.add(P('box', 0x5f4127, 0.08, 0.96, 0.08, x, y0, 0.58, 0, true));
    g.add(P('prism', 0x5d4632, 1.82, 0.5, 1.5, 0, y0 + 0.96, -0.04));
    g.add(P('box', 0x7d756a, 0.48, ch, 0.48, 0.48, y0, -0.5));
    g.add(P('box', 0x6a625a, 0.62, 0.46, 0.46, 0.48, y0, -0.2));
    g.add(P('box', fireMat, 0.34, 0.2, 0.05, 0.48, y0 + 0.12, 0.04, 0, true));
    const glow = makeGlow(0xff8a3a, 1.1, y0 + 0.3); glow.position.set(0.48, y0 + 0.3, 0.12); g.add(glow);
    g.add(P('cyl8', 0x6b4a2e, 0.32, 0.3, 0.32, -0.15, y0, 0.28));
    g.add(P('box', 0x3c4148, 0.44, 0.1, 0.18, -0.15, y0 + 0.3, 0.28));
    g.add(P('box', 0x3c4148, 0.18, 0.08, 0.14, -0.15, y0 + 0.4, 0.28, 0, true));
    g.add(P('cyl8', 0x7a5534, 0.28, 0.34, 0.28, -0.58, y0, 0.48));
    if (lv >= 2) { g.add(P('box', 0x5f4127, 0.05, 0.62, 0.46, 0.84, y0, 0.22, 0, true)); for (const z of [0.08, 0.22, 0.36]) g.add(P('box', 0xc9d0d6, 0.03, 0.5, 0.05, 0.8, y0 + 0.08, z, 0, true)); }
    if (lv >= 3) g.add(P('box', 0x8e3b2d, 0.04, 0.5, 0.34, -0.75, y0 + 0.45, 0.3, 0, true));
    return { g, info: { top: y0 + ch + 0.2, muzzle: 1, emit: [[0.48, y0 + ch + 0.1, -0.5]] } };
  }
  /* Mine de fer : entrée dans un tertre rocheux, poutres, wagonnet de minerai sombre, lanterne. */
  function mineG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl);
    g.add(P('dode', 0x6f6a62, 1.75, 1.05 + 0.15 * lv, 1.4, -0.1, 0, -0.25));
    g.add(P('dode', 0x7d776d, 0.9, 0.7, 0.8, 0.58, 0, -0.45));
    g.add(P('box', 0x1b1a19, 0.6, 0.6, 0.1, -0.05, 0.02, 0.43, 0, true));
    for (const x of [-0.39, 0.29]) g.add(P('box', 0x5f4127, 0.1, 0.72, 0.1, x, 0, 0.48));
    g.add(P('box', 0x5f4127, 0.84, 0.1, 0.12, -0.05, 0.7, 0.48));
    for (const x of [-0.17, 0.07]) g.add(P('box', 0x6b6f75, 0.04, 0.03, 0.62, x, 0.01, 0.82, 0, true));
    g.add(P('box', 0x4a4038, 0.36, 0.2, 0.4, -0.05, 0.08, 0.86));
    for (const [x, z, c] of [[-0.12, 0.8, 0x3a3f46], [0.02, 0.92, 0x6a4a3a], [-0.06, 0.95, 0x3a3f46]]) g.add(P('ico', c, 0.15, 0.13, 0.15, x, 0.27, z, 0, true));
    if (lv >= 2) g.add(P('ico', 0x3a3f46, 0.3, 0.22, 0.3, 0.6, 0, 0.45));
    const l = makeGlow(0xffb050, 0.8, 0.62); l.position.set(0.4, 0.62, 0.56); g.add(l);
    return { g, info: { top: 1.25 + 0.15 * lv, muzzle: 1, emit: [] } };
  }
  /* Charrette du marchand ambulant : plateau, roues, bâche rayée, caisses. */
  function cartG() {
    const g = new THREE.Group();
    g.add(P('box', 0x8a6a45, 0.78, 0.07, 0.5, 0, 0.24, 0));
    for (const sx of [-1, 1]) g.add(piv(0, 0.17, sx * 0.27, [P('cyl12', 0x5f4127, 0.32, 0.05, 0.32, 0, -0.025, 0, 0, true)], Math.PI / 2, 0, 0));
    for (const [x, z] of [[-0.36, -0.22], [0.36, -0.22], [-0.36, 0.22], [0.36, 0.22]]) g.add(P('box', 0x5f4127, 0.04, 0.42, 0.04, x, 0.3, z, 0, true));
    g.add(P('box', 0xc8443a, 0.84, 0.05, 0.56, 0, 0.72, 0)); g.add(P('box', 0xf2e6c8, 0.84, 0.051, 0.18, 0, 0.72, 0, 0, true));
    g.add(P('box', 0x9b7448, 0.24, 0.2, 0.22, -0.18, 0.31, 0.02)); g.add(P('cyl8', 0x7a5534, 0.2, 0.26, 0.2, 0.16, 0.31, 0.04));
    g.add(P('box', 0x5f4127, 0.5, 0.03, 0.03, 0.62, 0.24, 0, 0, true));
    return { g, info: { top: 1.0, muzzle: 0.5, emit: [] } };
  }
  /* Pièges : une plaque à pointes, un filet roulé, posés au ras du sol (les ennemis ne les voient pas venir). */
  let netGeo = null;
  function piegeG(it) {
    const g = new THREE.Group(), L = Math.max(1, it.lvl | 0), c = L >= 3 ? 0xd0d4d8 : L >= 2 ? 0xb8bcc0 : 0x9a8f80;
    g.add(P('box', 0x4a4038, 0.78, 0.04, 0.78, 0, 0, 0, 0, true));
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22], [0, 0]]) g.add(P('cone6', c, 0.1, 0.14 + 0.03 * L, 0.1, x, 0.04, z, 0, true));
    return { g, info: { top: 0.5, muzzle: 0.2, emit: [] } };
  }
  function filetG(it) {
    const g = new THREE.Group();
    if (!netGeo) { netGeo = new THREE.TorusGeometry(0.26, 0.05, 5, 14); netGeo.rotateX(Math.PI / 2); }
    g.add(P('cyl8', 0x7a6a4e, 0.7, 0.04, 0.7, 0, 0, 0, 0, true));
    const ring = new THREE.Mesh(netGeo, mat(it.lvl >= 2 ? 0x8f8a80 : 0x9a8660)); ring.position.y = 0.07; g.add(ring);
    for (let i = 0; i < 4; i++) g.add(P('box', 0x8a7856, 0.62, 0.02, 0.025, 0, 0.05, 0, i * Math.PI / 4, true));
    return { g, info: { top: 0.5, muzzle: 0.2, emit: [] } };
  }
  /* Caserne : long bâtiment de pierre au toit d'ardoise, cour d'entraînement (mannequin de paille, râtelier de lances), drapeau du village. */
  function caserneG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl), y0 = 0.14, H = 0.8 + 0.14 * (lv - 1), col = it.col || COLORS[0];
    g.add(P('box', 0x8a8378, 1.76, y0, 1.62, 0, 0, 0));
    g.add(P('box', 0xb7ad9c, 1.52, H, 0.76, 0, y0, -0.4));
    for (const x of [-0.76, 0.76]) g.add(P('box', 0x8f8a80, 0.12, H, 0.8, x, y0, -0.4, 0, true));
    g.add(P('prism', 0x46576a, 1.7, 0.56, 0.96, 0, y0 + H, -0.4));
    g.add(P('box', 0x3e2716, 0.3, 0.52, 0.04, 0, y0, -0.01, 0, true));
    for (const x of [-0.5, 0.5]) g.add(P('box', winMat, 0.18, 0.2, 0.04, x, y0 + H * 0.5, -0.01, 0, true));
    g.add(P('box', col, 1.54, 0.07, 0.03, 0, y0 + H * 0.86, -0.01, 0, true));
    g.add(P('box', 0xb39669, 1.56, 0.02, 0.66, 0, y0, 0.42, 0, true));
    g.add(P('cyl6', 0x6b4a2b, 0.07, 0.62, 0.07, -0.48, y0, 0.44));
    g.add(P('cyl8', 0xd8c07a, 0.24, 0.3, 0.2, -0.48, y0 + 0.34, 0.44));
    g.add(P('sph', 0xd8c07a, 0.18, 0.18, 0.18, -0.48, y0 + 0.64, 0.44));
    g.add(P('box', 0x6b4a2b, 0.44, 0.05, 0.05, -0.48, y0 + 0.52, 0.44, 0, true));
    g.add(P('box', 0x5f4127, 0.56, 0.05, 0.08, 0.42, y0 + 0.4, 0.66, 0, true));
    for (const x of [0.22, 0.36, 0.5, 0.64]) { g.add(P('box', 0x6b4a2b, 0.025, 0.66, 0.025, x, y0, 0.62, 0, true)); g.add(P('cone4', 0xc9d0d6, 0.05, 0.1, 0.05, x, y0 + 0.66, 0.62, 0, true)); }
    if (lv >= 2) { g.add(P('box', 0x9a9488, 0.5, H + 0.5, 0.5, -0.62, y0, -0.55)); g.add(P('cone4', 0x3c4552, 0.66, 0.5, 0.66, -0.62, y0 + H + 0.5, -0.55)); }
    if (lv >= 3) for (const x of [-0.3, 0.3]) g.add(P('cyl12', col, 0.2, 0.03, 0.2, x, y0 + H * 0.45, 0.0, 0, true));
    if (lv >= 4) { g.add(P('box', 0x9a9488, 0.42, H + 0.3, 0.42, 0.64, y0, -0.58)); g.add(P('cone4', 0x3c4552, 0.56, 0.42, 0.56, 0.64, y0 + H + 0.3, -0.58)); }
    g.add(flag(0.78, y0, 0.78, col, 1.15));
    return { g, info: { top: y0 + H + (lv >= 2 ? 1.0 : 0.7), muzzle: 1, emit: [] } };
  }
  /* Poste de garde : un mât et son fanion aux couleurs du village (une grande bannière couleur de sa rareté quand on en pose une), sur un socle qui grandit avec le niveau. */
  const RAR_COL = [0xa3abb4, 0x5cc27a, 0x5b9cf0, 0xb07ce8, 0xf59a3c];
  function posteG(it) {
    const g = new THREE.Group(), lv = Math.max(1, it.lvl | 0), col = it.col || COLORS[0], ban = it.ban != null && it.ban >= 0 ? RAR_COL[Math.min(4, it.ban | 0)] : null;
    if (lv >= 3) g.add(P('cyl8', 0x8f8a80, 0.7, 0.22, 0.7, 0, 0, 0));
    const y = lv >= 3 ? 0.22 : 0, H = 1.45 + 0.15 * lv;
    g.add(P(lv >= 2 ? 'cyl8' : 'cyl6', lv >= 2 ? 0x9a9488 : 0x6b5a44, 0.4, 0.14, 0.4, 0, y, 0));
    g.add(P('cyl6', 0x5f4127, 0.07, H, 0.07, 0, y + 0.14, 0));
    g.add(P('box', 0x5f4127, 0.5, 0.05, 0.05, 0.2, y + 0.14 + H - 0.1, 0, 0, true));
    const cloth = piv(0, y + 0.14 + H - 0.12, 0, [P('box', ban || col, ban ? 0.44 : 0.36, ban ? 0.62 : 0.3, 0.025, ban ? 0.22 : 0.18, ban ? -0.31 : -0.15, 0, 0, true)]);
    g.add(cloth); anims.push({ k: 'flag', o: cloth, ph: Math.random() * 6 });
    if (ban) { const gl2 = makeGlow(ban, 0.9, y + H - 0.3); gl2.position.x = 0.22; gl2.material.opacity = 0.35; g.add(gl2); }
    if (lv >= 2) g.add(P('cone6', 0xc9d0d6, 0.12, 0.18, 0.12, 0, y + 0.14 + H, 0, 0, true));
    return { g, info: { top: y + H + 0.45, muzzle: 1, emit: [] } };
  }
  /* L'histoire (lot A) : le berceau de Lilou et Sukhoï, dessinés par le code en attendant leurs modèles Meshy. */
  function cradleG() {
    const g = new THREE.Group(), wood = 0x9a6a3e;
    for (const x of [-0.3, 0.3]) g.add(P('box', 0x7a5230, 0.06, 0.06, 0.5, x, 0, 0, 0, true));                 // les patins (berceau à bascule)
    g.add(P('box', wood, 0.66, 0.08, 0.42, 0, 0.08, 0));
    for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) for (const z of [-0.19, 0.19]) g.add(P('cyl6', 0xb07a48, 0.03, 0.26, 0.03, x, 0.16, z, 0, true));
    for (const z of [-0.19, 0.19]) g.add(P('box', wood, 0.68, 0.04, 0.04, 0, 0.42, z, 0, true));
    for (const x of [-0.32, 0.32]) g.add(P('box', wood, 0.04, 0.34, 0.42, x, 0.12, 0, 0, true));
    g.add(P('box', 0xf2b8c6, 0.5, 0.1, 0.34, 0.04, 0.16, 0, 0, true));                                           // la couverture rose
    g.add(P('sph', 0xf3d3bd, 0.17, 0.16, 0.17, -0.2, 0.2, 0, 0, true));                                         // Lilou : la tête…
    g.add(P('sph', 0xf2d27a, 0.12, 0.07, 0.12, -0.21, 0.34, 0, 0, true));                                       // … et sa houppette blonde
    for (const z of [-0.035, 0.035]) g.add(P('sph', 0x4a7ad8, 0.03, 0.03, 0.03, -0.12, 0.27, z, 0, true));      // ses yeux bleus
    return g;
  }
  function catG() {
    /* Sukhoï endormie : une chatte grise roulée en boule, la tache blanche sur la poitrine, la queue autour d'elle */
    const g = new THREE.Group(), grey = 0x8b9097, dark = 0x6d7178;
    g.add(P('sph', grey, 0.42, 0.2, 0.3, 0, 0, 0));
    g.add(P('sph', grey, 0.2, 0.17, 0.19, 0.17, 0.04, 0.07));
    g.add(P('sph', 0xf4f1ea, 0.1, 0.08, 0.08, 0.2, 0.02, 0.15, 0, true));
    for (const z of [0.0, 0.12]) g.add(P('cone4', dark, 0.06, 0.08, 0.05, 0.2, 0.18, z, 0, true));
    g.add(piv(-0.16, 0.03, 0.12, [P('cyl6', dark, 0.05, 0.36, 0.05, 0, 0, 0, 0, true)], Math.PI / 2, 0.9, 0));
    return g;
  }
  /* La chambre de Lilou : une petite maison douillette, le berceau devant la porte et Sukhoï qui dort à côté. */
  function chambreG(it) {
    const g = new THREE.Group(), y0 = 0.1, col = it.col || COLORS[0];
    g.add(P('box', 0xa89a84, 1.7, y0, 1.6, 0, 0, 0));
    g.add(P('box', 0xf1e3c8, 1.3, 0.72, 0.8, 0, y0, -0.36));
    g.add(P('prism', 0xd4848e, 1.48, 0.55, 1.0, 0, y0 + 0.72, -0.36));
    g.add(P('box', 0x7a5230, 0.26, 0.46, 0.04, 0.3, y0, 0.05, 0, true));
    g.add(P('cyl12', winMat, 0.22, 0.03, 0.22, -0.32, y0 + 0.46, 0.05, 0, true));
    g.add(P('box', 0x7a5230, 0.36, 0.06, 0.08, -0.32, y0 + 0.22, 0.08, 0, true));
    for (const x of [-0.42, -0.32, -0.22]) g.add(P('sph', [0xf28fb0, 0xf6d36a, 0x9ad0f2][Math.round((x + 0.42) * 10)], 0.07, 0.07, 0.07, x, y0 + 0.28, 0.09, 0, true));
    g.add(P('box', 0xe8d9b8, 1.5, 0.02, 0.62, 0, y0, 0.45, 0, true));
    const c = cradleG(); c.position.set(-0.38, y0, 0.48); c.rotation.y = 0.2; g.add(c);
    const k = catG(); k.position.set(0.32, y0 + 0.02, 0.56); k.rotation.y = -0.5; g.add(k);
    g.add(flag(0.72, y0, -0.7, col, 1.0));
    return { g, info: { top: y0 + 1.35, muzzle: 1, emit: [[-0.4, y0 + 1.2, -0.5]] } };
  }
  /* La Couronne de la Montagne (lot B) : au 1er cycle, elle se reconstitue morceau par morceau (bandeau, fleurons, arches) ;
     ensuite, entière, avec ses quatre joyaux allumés ou éteints (code « r<rang>g<trouvés> »). */
  function crownG(code) {
    const m = /r(\d+)g(\d+)/.exec(code) || [0, '0', '0'], rank = +m[1], got = +m[2], n = rank ? 4 : crownBits(got);
    const g = new THREE.Group(), gold = 0xf2c14e, k = 1.25;
    const add = o => { o.scale.multiplyScalar(k); o.position.multiplyScalar(k); g.add(o); return o; };
    if (n >= 1) { add(P('cyl12', gold, 0.62, 0.16, 0.62, 0, 0, 0, 0, true)); add(P('cyl12', 0x8e2a3e, 0.52, 0.18, 0.52, 0, 0.005, 0, 0, true)); }
    if (n >= 2) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; add(P('cone6', gold, 0.12, 0.2, 0.12, 0.27 * Math.cos(a), 0.16, 0.27 * Math.sin(a), 0, true)); add(P('sph', 0xfff0c0, 0.05, 0.05, 0.05, 0.27 * Math.cos(a), 0.36, 0.27 * Math.sin(a), 0, true)); }
    if (n >= 3) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const p0 = piv(0.27 * Math.cos(a), 0.16, 0.27 * Math.sin(a), [P('box', gold, 0.035, 0.3, 0.035, 0, 0, 0, 0, true)], 0, -a, 0.95); add(p0); }
    if (n >= 4) { add(P('dode', basic(0xff4a6a), 0.1, 0.1, 0.1, 0, 0.33, 0, 0, true)); const gl = makeGlow(0xffd27a, 1.4, 0.36 * k); g.add(gl); }
    if (rank) { const JC = [0x6ad0ff, 0x7dffb0, 0xff5a4a, 0xffd04a]; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, on = !!(got & (1 << i)); add(P('sph', on ? basic(JC[i]) : 0x3a3844, 0.075, 0.075, 0.075, 0.315 * Math.cos(a), 0.05, 0.315 * Math.sin(a), 0, true)); } }
    return g;
  }
  const PROC2 = { maison: houseG, chasse: lodgeG, champ: fieldG, banc: benchG, fleurs: flowersG, fontaine: fountainG, statue: statueG, brasserie: brasserieG, forge: forgeG, mine: mineG, marchand: cartG, piege: piegeG, filet: filetG, caserne: caserneG, poste: posteG, chambre: chambreG };
  function build(it) {
    const s = BLD[it.type].size, g = new THREE.Group();
    let info = { top: 1.2, muzzle: 1, emit: [] };
    let glow = null;
    const team = TEAM[it.col] != null ? TEAM[it.col] : 0, foot = s * 0.98, small = s < 2 || it.type === 'champ';
    if (it.dead) { const m = LIB.ok && modelInst('destroyed', 0, false, foot * 0.92, MODEL_RY); if (m) g.add(m); else g.add(makeRubble(s)); info.top = 0.8; }
    else if (it.lvl <= 0) {
      const m = LIB.ok && s >= 2 && modelInst(LIB.m2.chantier ? 'm2:chantier' : 'scaffolding', 0, false, foot * (LIB.m2.chantier ? 0.95 : 0.85), MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h + 0.2; }
      else { g.add(P('box', 0xb39669, s - 0.2, 0.06, s - 0.2, 0, 0, 0, 0, true)); g.add(makeScaffold(s, s < 2 ? 0.5 : 1.0)); info.top = s < 2 ? 0.8 : 1.4; }
    } else if (PROC2[it.type] && !(LIB.ok && LIB.m2[it.type])) {
      const b = PROC2[it.type](it); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    } else if (LIB.ok && (LIB.m2[it.type] || B_MODEL[it.type])) {
      const m = modelInst(LIB.m2[it.type] ? 'm2:' + it.type : bModelOf(it), team, false, foot * (it.type === 'tour' ? 0.8 : 1 + 0.035 * (Math.min(5, it.lvl) - 1)), MODEL_RY);
      if (m) { g.add(m); info.top = m.userData.h; info.muzzle = Math.max(0.8, info.top * 0.8); }
      if (SMOKE.includes(it.type) && !LIB.m2[it.type]) info.emit.push([0.15, info.top * 0.9, -0.15]);   // les modèles Meshy ont leur propre fumée (ou pas de cheminée)
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.6)));
    } else {
      const b = makeBld(V1_PROC[it.type] || 'entrepot', it.lvl, it.col || COLORS[0], false); g.add(b.g); info = b.info;
      if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
    }
    if (!it.dead && it.lvl > 0 && !small) { glow = makeGlow(0xffc070, s * 1.6, Math.min(1.4, info.top * 0.45)); g.add(glow); }
    /* la Couronne de la Montagne, au-dessus de la halle : elle tourne doucement */
    if (it.crown && !it.dead && it.lvl > 0) { const c = crownG(it.crown); c.position.y = info.top * 0.78 + 0.1; g.add(c); anims.push({ k: 'spin', o: c, s: 0.55 }); }   // posée juste au-dessus du toit
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
      if (it.type === 'rempart' || it.type === 'porte') { walls.push(it); continue; }
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
  /* Portes (dans une palissade) : deux poteaux, une traverse, un vantail ; renforcées de fer aux niveaux 2 et 3. */
  const GS = {
    1: { post: 0x6b4a2b, beam: 0x5a3d22, panel: 0x8b5e34, band: null },
    2: { post: 0x8e8a80, beam: 0x6f767c, panel: 0x7a5230, band: 0x3c3c40 },
    3: { post: 0x6f767c, beam: 0x4d5966, panel: 0x5c636b, band: 0xc9922e },
  };
  function setWalls(items, fresh) {
    const live = items.filter(w => !w.dead), dead = items.filter(w => w.dead);
    const sig = items.map(w => w.gx + ',' + w.gz + ',' + w.lvl + (w.type === 'porte' ? 'g' : '') + (w.orc ? 'o' : '') + (w.dead ? 'x' : '')).join(';');
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
    /* niveau d'aspect : palissade de bois (1), mur de pierre (3), mur renforcé (4) */
    const vl = w => w.type === 'rempart' && !w.orc ? [1, 1, 3, 4][Math.max(1, Math.min(3, w.lvl | 0))] : Math.max(1, Math.min(5, w.lvl | 0));
    const styleOf = w => WS[(w.orc ? 'o' : 'd') + vl(w)];
    const keyOf = w => (w.orc ? 'o' : 'd') + vl(w);
    const isW = (x, z) => wallAt.has(x + ',' + z);
    const gate = w => w.type === 'porte';
    for (const w of live) {
      const X = w.gx + 0.5 - half, Z = w.gz + 0.5 - half;
      if (gate(w)) {
        /* la porte s'aligne sur la palissade qui la porte */
        const G = GS[Math.max(1, Math.min(3, w.lvl | 0))], horiz = isW(w.gx - 1, w.gz) || isW(w.gx + 1, w.gz) || !(isW(w.gx, w.gz - 1) || isW(w.gx, w.gz + 1));
        const ry = horiz ? 0 : Math.PI / 2, ax = horiz ? 1 : 0, az = horiz ? 0 : 1, key = 'g' + w.lvl;
        for (const s of [-1, 1]) push(key, 'box', G.post, false, X + s * 0.4 * ax, 0, Z + s * 0.4 * az, 0.2, 1.15, 0.2);
        push(key, 'box', G.beam, false, X, 1.0, Z, 1.0, 0.16, 0.2, ry);
        push(key, 'box', G.panel, false, X, 0, Z, 0.62, 0.86, 0.1, ry);
        if (G.band) for (const y of [0.18, 0.6]) push(key, 'box', G.band, false, X, y, Z, 0.64, 0.06, 0.12, ry);
      } else {
        const st = styleOf(w), key = keyOf(w);
        const [pk, pc, pw, ph] = st.post;
        push(key, pk, pc, false, X, 0, Z, pw, ph, pw);
        const [ck, cc, cw, chh] = st.cap; push(key, ck, cc, false, X, ph, Z, cw, chh, cw);
        if (st.band) { const [bc, bw, bh, by, glow] = st.band; push(key, 'box', bc, !!glow, X, by, Z, bw, bh, bw); }
      }
      /* liaisons avec les voisins (raccourcies contre une porte : ses poteaux vont jusqu'au bord de la case) */
      const link = (o, dir) => {
        const a = gate(w) ? 0.5 : 0, b = gate(o) ? 0.5 : 0, L = 1 - a - b; if (L <= 0.01) return;
        const lw = gate(w) ? o : gate(o) ? w : vl(o) < vl(w) ? o : w, [lc, lwid, lh] = styleOf(lw).link, c = a + L / 2;
        push(keyOf(lw), 'box', lc, false, dir ? X : X + c, 0, dir ? Z + c : Z, L, lh, lwid, dir ? Math.PI / 2 : 0);
      };
      const E = wallAt.get((w.gx + 1) + ',' + w.gz), S = wallAt.get(w.gx + ',' + (w.gz + 1));
      if (E) link(E, 0);
      if (S) link(S, 1);
      const diag = (o, cx, cz, ry) => { if (gate(w) || gate(o)) return; const lw = vl(o) < vl(w) ? o : w, [lc, lwid, lh] = styleOf(lw).link; push(keyOf(lw), 'box', lc, false, cx, 0, cz, Math.SQRT2, lh, lwid, ry); };
      const SE = wallAt.get((w.gx + 1) + ',' + (w.gz + 1)), SW = wallAt.get((w.gx - 1) + ',' + (w.gz + 1));
      if (SE && !isW(w.gx + 1, w.gz) && !isW(w.gx, w.gz + 1)) diag(SE, X + 0.5, Z + 0.5, -Math.PI / 4);
      if (SW && !isW(w.gx - 1, w.gz) && !isW(w.gx, w.gz + 1)) diag(SW, X - 0.5, Z + 0.5, Math.PI / 4);
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
  function setBldHp(key, frac, noBurn) {
    const rec = blds.get(key); if (!rec) { wallBar(key, frac); return; }
    rec.burn = !noBurn && frac > 0 && frac < 0.55;
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
    const PASS = new Set(['porte', 'piege', 'filet', 'poste']);  // on passe les portes, on marche sur les pièges, on contourne à peine un poste de garde
    const blds = items.filter(it => it.type !== 'rempart' && !PASS.has(it.type) && it.key !== 'ghost' && !it.dead);
    vilBlocked = new Uint8Array(GRID * GRID); vilSpots = []; bldSpots = new Map(); bldCenters = new Map();
    for (const b of items) { if (b.key === 'ghost' || PASS.has(b.type) || (b.dead && BLD[b.type].hps)) continue; const sz = BLD[b.type].size; for (let i = 0; i < sz; i++) for (let j = 0; j < sz; j++) { const x = b.gx + i, z = b.gz + j; if (x >= 0 && z >= 0 && x < GRID && z < GRID) vilBlocked[z * GRID + x] = 1; } }
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
  /* Modèles provisoires (KayKit) en attendant les modèles Meshy de chaque race et classe. */
  const P_DEF = { humain: { m: 'knight', h: 1.06, w: 1.0 }, nain: { m: 'barbarian', h: 0.9, w: 1.3 }, elfe: { m: 'rogue', h: 1.12, w: 0.9 },
    orque: { m: 'barbarian', tex: 'orc_barbarian', h: 1.14, w: 1.18 }, halfelin: { m: 'knight', h: 0.74, w: 1.08 }, mortvivant: { m: 'rogue', tint: 0x9db3a2, h: 1.05, w: 0.86 } };
  const CLASS_GEAR = { guerrier: ['1H_Sword', 'Round_Shield'], paladin: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet'], rodeur: ['2H_Crossbow'], mage: ['Throwable'],
    voleur: ['Knife', 'Knife_Offhand'], pretre: ['Throwable', 'Knight_Cape'], druide: ['Throwable', 'Barbarian_Cape'], necro: ['Throwable', 'Rogue_Cape'] };
  const JOB_GEAR = { bucheron: ['1H_Axe'], carriere: ['2H_Axe'], mine: ['2H_Axe'], champ: [], chasse: ['1H_Crossbow'], moulin: ['Mug'], boulangerie: ['Mug'], brasserie: ['Mug'], bat: ['1H_Axe'] };
  const JOB_WORK = { bucheron: '1H_Melee_Attack_Chop', carriere: '2H_Melee_Attack_Chop', mine: '2H_Melee_Attack_Chop', bat: '1H_Melee_Attack_Chop', chasse: '2H_Ranged_Shoot' };
  const HERO_GEAR = {
    guerrier: { humain: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], nain: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat', 'Barbarian_Cape'], elfe: ['1H_Sword', 'Round_Shield', 'Rogue_Cape'] },
    rodeur: { humain: ['2H_Crossbow', 'Knight_Cape'], nain: ['2H_Crossbow', 'Barbarian_Hat'], elfe: ['2H_Crossbow', 'Rogue_Cape'] },
    mage: { humain: ['Throwable', 'Knight_Cape'], nain: ['Throwable', 'Barbarian_Cape'], elfe: ['Throwable', 'Rogue_Cape'] },
  };
  const SOL_GEAR = {
    fant: { humain: ['1H_Sword', 'Round_Shield', 'Knight_Helmet'], nain: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat'], elfe: ['1H_Sword', 'Round_Shield'] },
    arch: { humain: ['2H_Crossbow', 'Knight_Helmet'], nain: ['2H_Crossbow', 'Barbarian_Hat'], elfe: ['2H_Crossbow', 'Rogue_Cape'] },
    lanc: { humain: ['2H_Sword', 'Knight_Helmet'], nain: ['2H_Axe', 'Barbarian_Hat'], elfe: ['2H_Sword', 'Rogue_Cape'] },
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
    const hero = p.kind === 'hero', sol = p.kind === 'sol';
    const gear = hero ? ((HERO_GEAR[p.cls] || {})[p.race] || CLASS_GEAR[p.cls] || []) : sol ? ((SOL_GEAR[p.type] || SOL_GEAR.fant)[p.race] || SOL_GEAR.fant.humain) : (JOB_GEAR[p.job] || []);
    const have = new Set();
    obj.traverse(o => {
      if (GEAR_NAMES.has(o.name)) { o.visible = gear.includes(o.name); if (o.visible) have.add(o.name); }
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
        if (def.tex && LIB.tex[def.tex] && !GEAR_NAMES.has(o.name)) o.material = skinMat(o.material, def.tex);
        else if (def.tint && !GEAR_NAMES.has(o.name)) o.material = tintMat(o.material, def.tint);
      }
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
    if (sol) { const ring = new THREE.Mesh(geo('plane'), basic(0x9fb4c8, { transparent: true, opacity: 0.55, depthWrite: false })); ring.scale.set(0.62, 1, 0.62); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring); }
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
      const sig = [p.race, p.cls || '', p.job || '', p.col || '', p.name || '', p.type || ''].join('|');
      if (!r || r.sig !== sig) {
        const g = makePerson(p); if (!g) continue;
        let x, z;
        if (r) { x = r.x; z = r.z; lifeGroup.remove(r.g); }
        else if (p.fixed) { x = p.fixed[0]; z = p.fixed[1]; }
        else { const sps = p.at && bldSpots.get(p.at), sp = (sps && sps.length && sps[Math.floor(Math.random() * sps.length)]) || vilSpots[Math.floor(Math.random() * vilSpots.length)] || [half, half]; x = sp[0] + 0.5; z = sp[1] + 0.5; }
        const nr = { g, x, z, path: [], wait: Math.random() * 2, sig, data: p, working: false };
        g.position.set(x - half, 0, z - half); lifeGroup.add(g); people.set(p.key, nr);
        r = nr;
      }
      if (r.data.at !== p.at) { r.path = []; r.wait = 0; r.working = false; }
      if (String(r.data.fixed) !== String(p.fixed)) { r.path = []; r.wait = 0; r.working = false; r.fixKey = null; }
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
      if (p.fixed) { stepFixed(r, p, dt); continue; }
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
  /* Un soldat de la garnison : il rejoint sa place dans la formation de son poste, puis monte la garde, tourné vers le danger. */
  function stepFixed(r, p, dt) {
    const fx = p.fixed[0], fz = p.fixed[1], key = fx + ',' + fz;
    if (r.fixKey !== key) {
      r.fixKey = key;
      const x0 = cellOf(r.x), z0 = cellOf(r.z), x1 = cellOf(fx), z1 = cellOf(fz);
      r.path = x0 === x1 && z0 === z1 ? [] : findPath(x0, z0, x1, z1);
      r.path.push([fx, fz]);
    }
    if (r.path.length) {
      const [tx, tz] = r.path[0], dx = tx - r.x, dz = tz - r.z, L = Math.sqrt(dx * dx + dz * dz), step = 0.85 * dt;
      if (L <= step) { r.x = tx; r.z = tz; r.path.shift(); } else { r.x += dx / L * step; r.z += dz / L * step; r.g.rotation.y = Math.atan2(dx, dz); }
      r.g.position.set(r.x - half, 0, r.z - half);
      play(r.g, 'walk', 0.6);
      return;
    }
    play(r.g, 'idle', 1);
    if (p.face) { const want = Math.atan2(p.face[0], p.face[1]); let d = want - r.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.g.rotation.y += d * Math.min(1, dt * 4); }
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
  const tintMats = new Map();
  function tintMat(orig, color) {
    const key = orig.uuid + '|' + color;
    if (!tintMats.has(key)) { const m = orig.clone(); m.color = m.color.clone().multiply(new THREE.Color(color)); m.needsUpdate = true; tintMats.set(key, m); }
    return tintMats.get(key);
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
    donjon: { exp: 1.0, bg: 0x0a0b0f, fog: 0x0a0b0f, near: 64, far: 104, sun: 0xa9b8ff, sunI: 0.6, sunPos: [-14, 30, 10], hemiS: 0x5a6680, hemiG: 0x1c1814, hemiI: 0.62, ground: 0xffffff, win: 0xffa040, glow: 0.4, embers: false, env: [0x2a3040, 0x2a2826, 0x101010], envI: 0.35, bio: null },
    dark: { exp: 0.8, bg: 0x1a2032, fog: 0x1d2437, near: 58, far: 125, sun: 0xa9b8ff, sunI: 1.3, sunPos: [26, 32, -8], hemiS: 0x7d8cc6, hemiG: 0x2b2a36, hemiI: 0.8, ground: 0xe4e9f4, win: 0xffa040, glow: 0.55, embers: true, env: [0x2a3558, 0x3a4566, 0x1c1d26], envI: 0.5, bio: 'snow' },
    /* rediffusion d'un raid : le village au crépuscule (sans changer la saison du sol) */
    raid: { exp: 0.84, bg: 0x5e4a5c, fog: 0x6c5566, near: 70, far: 165, sun: 0xffb07a, sunI: 1.55, sunPos: [-26, 22, 18], hemiS: 0xc9a2b4, hemiG: 0x4a3a32, hemiI: 0.62, ground: 0xf2e4dc, win: 0xffb060, glow: 0.38, embers: true, env: [0x8a6a80, 0xd8a890, 0x4a3a32], envI: 0.55, bio: null },
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
    try { scene.environment = makeEnv(m, Q.env); if (Q.bio !== null) setBiome(m === 'warm' ? seasonBiome : Q.bio); } catch (e) { console.error('ambiance', e); }
    if (!Q.embers) { for (const e of embers) fxGroup.remove(e.s); embers.length = 0; }
  }

  /* ---------- chargement des modèles ---------- */
  const MODEL_NAMES = ['castle', 'lumbermill', 'mine', 'windmill', 'market', 'barracks', 'tavern', 'tower_A', 'tower_B', 'tower_catapult', 'church', 'destroyed', 'scaffolding', 'trees_A_large', 'trees_A_medium', 'trees_B_large', 'tree_A', 'tree_B', 'mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_C', 'rock_A', 'rock_C', 'rock_E'];
  function loadModels(base, onProgress, base2, onMore) {
    if (!ok || !THREE.GLTFLoader) return Promise.resolve(false);
    THREE.Cache.enabled = true;
    const loader = new THREE.GLTFLoader(), tl = new THREE.TextureLoader();
    const chars = ['barbarian', 'rogue', 'knight'], texs = ['orc_barbarian', 'orc_rogue', 'troll'];
    const total = MODEL_NAMES.length + chars.length + texs.length;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done, total); };
    const one = n => new Promise(res => loader.load(base + n + '.json', g => { LIB.b[n] = g; tick(); res(); }, undefined, () => { tick(); res(); }));
    const ch = n => new Promise(res => loader.load(base + n + '.json', g => {
      const box = new THREE.Box3().setFromObject(g.scene);
      LIB.ch[n] = { scene: g.scene, clips: Object.fromEntries(g.animations.map(a => [a.name, a])), h: box.getSize(new THREE.Vector3()).y || 2 };
      tick(); res();
    }, undefined, () => { tick(); res(); }));
    const tx = n => new Promise(res => tl.load(base + n + '.png', t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; LIB.tex[n] = t; tick(); res(); }, undefined, () => { tick(); res(); }));
    const one2 = n => new Promise(res => loader.load(base2 + n + '.glb', g => res(g), undefined, () => res(null)));
    return Promise.all([...MODEL_NAMES.map(one), ...chars.map(ch), ...texs.map(tx)]).then(() => {
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
      for (const k in LIB.ch) LIB.ch[k].scene.traverse(matte);
      for (const k in LIB.tex) if (LIB.tex[k]) LIB.tex[k].anisotropy = 4;
      LIB.ok = true; LIB.ver++; protos.clear(); groundSig = '';
      buildWorldModels();
      /* Les modèles Meshy (plusieurs Mo chacun) arrivent ensuite, l'un après l'autre (la halle d'abord) : le village s'affiche sans les attendre. */
      if (base2) (async () => {
        for (const n of ['halle', 'chantier'].concat(M2_NAMES).filter((x, i, a) => M2_NAMES.includes(x) && a.indexOf(x) === i)) {
          const g = await one2(n); if (!g) continue;
          g.scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMapIntensity = 0.5; o.material.roughness = Math.max(0.75, o.material.roughness); } });
          LIB.m2[n] = g; LIB.ver++; protos.clear();
          if (onMore) onMore(n);
        }
      })();
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

  /* ---------- donjon : décor simple (sols, murs, grilles), personnages et effets ----------
     Une case du donjon (x, y) est dessinée en (x − half, y − half) : les effets du village (burst, wave, spark…) servent tels quels.
     Visuels provisoires, en attendant les modèles Meshy (murs et sols peints, portes, coffres, torches). */
  const djGroup = new THREE.Group();
  let DJ = null;
  const djHidden = () => [terrainGroup, decoGroup, forestGroup, decoProc, lifeGroup, bldGroup, unitGroup, wallGroup, rangeGroup, portalGroup];
  const DJ_U = {
    gobelin: { m: 'barbarian', tex: 'orc_barbarian', show: ['1H_Axe'], atk: '1H_Melee_Attack_Chop', h: 0.95, w: 1.05 },
    archer: { m: 'rogue', tex: 'orc_rogue', show: ['2H_Crossbow'], atk: '2H_Ranged_Shoot', h: 0.95, w: 0.95 },
    chaman: { m: 'rogue', tex: 'orc_rogue', tint: 0xd2b8ff, show: ['Throwable'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 0.95, w: 0.95 },
    troll: { m: 'barbarian', tex: 'troll', show: ['2H_Axe'], atk: '2H_Melee_Attack_Chop', h: 1.9, w: 1.3 },
    chefTroll: { m: 'barbarian', tex: 'troll', show: ['2H_Axe', 'Barbarian_Hat'], atk: '2H_Melee_Attack_Chop', h: 2.6, w: 1.45 },
    skel: { m: 'knight', tint: 0xf2eee2, show: ['1H_Sword'], atk: '1H_Melee_Attack_Chop', h: 0.95, w: 0.9 },
    /* la crypte des rois (modèles provisoires teintés, en attendant Meshy) */
    squelette: { m: 'knight', tint: 0xd9d2bf, show: ['1H_Sword', 'Round_Shield'], atk: '1H_Melee_Attack_Chop', h: 1.0, w: 0.88 },
    archerSq: { m: 'rogue', tint: 0xd9d2bf, show: ['2H_Crossbow'], atk: '2H_Ranged_Shoot', h: 1.0, w: 0.88 },
    goule: { m: 'barbarian', tint: 0x8fa38a, show: [], atk: '1H_Melee_Attack_Chop', h: 0.85, w: 1.0 },
    spectre: { m: 'rogue', tint: 0x9cc8ff, show: ['Rogue_Cape'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 1.05, w: 0.95, ghost: true },
    necromant: { m: 'rogue', tint: 0x7a6a9a, show: ['Throwable', 'Rogue_Cape'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 1.0, w: 0.95 },
    golem: { m: 'barbarian', tint: 0xe6dcc6, show: [], atk: '2H_Melee_Attack_Chop', h: 1.9, w: 1.35 },
    roiSquelette: { m: 'knight', tint: 0xe0d6bf, show: ['2H_Sword', 'Knight_Helmet', 'Knight_Cape'], atk: '2H_Melee_Attack_Chop', h: 2.4, w: 1.3 },
    /* le portail démoniaque (modèles provisoires teintés de rouge) */
    diablotin: { m: 'rogue', tex: 'orc_rogue', tint: 0xff8a6a, show: ['Knife'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 0.72, w: 0.95 },
    lanceflamme: { m: 'rogue', tex: 'orc_rogue', tint: 0xffb07a, show: ['Throwable'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 0.8, w: 0.95 },
    gardien: { m: 'barbarian', tex: 'troll', tint: 0xff7a5a, show: ['2H_Axe', 'Barbarian_Hat'], atk: '2H_Melee_Attack_Chop', h: 2.5, w: 1.45 },
    /* la Source du Mal (mission d'intro) */
    gardeSource: { m: 'barbarian', tex: 'troll', tint: 0xb89cff, show: ['2H_Axe'], atk: '2H_Melee_Attack_Chop', h: 2.2, w: 1.4 },
  };
  /* Couleurs du décor selon le donjon. */
  const DJ_LOOK = {
    mine: { room: [0x6b645a, 0x625b52, 0x736b5f], hall: [0x4f4a44, 0x57514a], wall: [0x5d564d, 0x534d45], torch: 0xffa040, light: 0xffb066 },
    crypte: { room: [0x5e626b, 0x565a63, 0x666a73], hall: [0x44474e, 0x4b4e55], wall: [0x4d5159, 0x454951], torch: 0x5fe0c8, light: 0xa8d8ff },
    portail: { room: [0x5a4442, 0x52403e, 0x63494a], hall: [0x40302f, 0x473534], wall: [0x4a3634, 0x412f2e], torch: 0xff5a2a, light: 0xff8a5a },
    source: { room: [0x625c66, 0x5a5560, 0x6a636e], hall: [0x4a454f, 0x514b56], wall: [0x57515d, 0x4e4854], torch: 0xb98aff, light: 0xd2b0ff },
  };
  const DJ_HERO_ATK = { guerrier: '1H_Melee_Attack_Chop', paladin: '1H_Melee_Attack_Chop', rodeur: '2H_Ranged_Shoot', voleur: '1H_Melee_Attack_Slice_Diagonal' };
  const DJ_CAST_ANIM = { tourbillon: 'spin', cri: 'cheer', bouclier: 'cheer', consecration: 'cheer', poison: 'cheer', fumee: 'cheer', lumiere: 'cheer', priere: 'cheer', ours: 'cheer', loup: 'cheer', racines: 'cheer', squelettes: 'cheer', nova: 'cheer' };
  const DJ_SHOT = { arrow: 0x3a2a1e, fire: 0xff7a2a, holy: 0xffe08a, thorn: 0x7bd36a, shadow: 0xa070ff, curse: 0xb05cff, ghost: 0x8fd0ff };
  const DJ_FX = { steel: 0xe8e8e8, ice: 0x9fe3ff, root: 0x7bd36a, fire: 0xff7a2a, bone: 0xe8e0c8 };
  function djSimple(color, h) {
    const g = new THREE.Group(), body = new THREE.Group();
    body.add(P('cyl8', color, 0.5 * h, 0.7 * h, 0.5 * h, 0, 0, 0)); body.add(P('sph', color, 0.42 * h, 0.42 * h, 0.42 * h, 0, 0.7 * h, 0));
    g.add(body); g.userData = { body, A: {}, mixer: null };
    return g;
  }
  function djModel(def) {
    const src = LIB.ch[def.m];
    if (!src || !THREE.SkeletonUtils) return djSimple(def.tex === 'troll' ? 0x6f7f9a : 0x6f8f3a, def.h);
    const obj = THREE.SkeletonUtils.clone(src.scene), have = new Set();
    obj.traverse(o => {
      if (GEAR_NAMES.has(o.name)) { o.visible = def.show.includes(o.name); if (o.visible) have.add(o.name); }
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
        if (!GEAR_NAMES.has(o.name)) {
          if (def.tex && LIB.tex[def.tex]) o.material = skinMat(o.material, def.tex);
          if (def.tint) o.material = tintMat(o.material, def.tint);
          if (def.ghost) { const key = o.material.uuid + '|ghost'; if (!tintMats.has(key)) { const gm = o.material.clone(); gm.transparent = true; gm.opacity = 0.55; gm.depthWrite = false; tintMats.set(key, gm); } o.material = tintMats.get(key); }
        }
      }
    });
    for (const n of def.show) { const G2 = LIB.gear[n]; if (have.has(n) || !G2) continue; let bone = null; obj.traverse(o => { if (!bone && o.name === G2.parent) bone = o; }); if (bone) { const c = G2.obj.clone(); c.visible = true; bone.add(c); } }
    const k = def.h / src.h; obj.scale.set(k * def.w, k, k * def.w);
    const g = new THREE.Group(), body = new THREE.Group(); body.add(obj); g.add(body);
    const mixer = new THREE.AnimationMixer(obj), act = n => LIB.clips[n] ? mixer.clipAction(LIB.clips[n]) : null;
    g.userData = { body, mixer, A: { idle: act('Idle'), walk: act('Walking_A'), atk: act(def.atk), death: act('Death_A') }, cur: null };
    return g;
  }
  function djRing(color, s, op) { const m = new THREE.Mesh(geo('plane'), basic(color, { transparent: true, opacity: op || 0.6, depthWrite: false })); m.scale.set(s, 1, s); m.position.y = 0.03; m.renderOrder = 2; return m; }
  function djPrepAnims(g) {
    const A = g.userData.A || {};
    if (A.death) { A.death.setLoop(THREE.LoopOnce); A.death.clampWhenFinished = true; }
    for (const k of ['atk', 'spin', 'cheer']) if (A[k]) { A[k].setLoop(THREE.LoopOnce); A[k].clampWhenFinished = true; }
  }
  function djHeroRec(h) {
    let g = LIB.ok ? makePerson({ kind: 'hero', race: h.race, cls: h.cls, sex: h.sex, col: h.col, name: h.name }) : null;
    if (!g) { g = djSimple(0xd9c7a0, 1.1); g.add(djRing(h.col || COLORS[0], 0.85, 0.75)); }
    const U = g.userData;
    if (U.mixer) { const act = n => LIB.clips[n] ? U.mixer.clipAction(LIB.clips[n]) : null; U.A.atk = act(DJ_HERO_ATK[h.cls] || '1H_Melee_Attack_Slice_Diagonal'); U.A.death = act('Death_A'); U.A.spin = act('2H_Melee_Attack_Spin'); }
    djPrepAnims(g);
    const mats = []; g.traverse(o => { if (o.isMesh && o.material && !o.material.isSpriteMaterial && o.geometry !== geo('plane')) { o.material = o.material.clone(); mats.push(o.material); } });
    const bar = makeBar(0.8, 0x6fd35a); bar.position.y = 1.72; g.add(bar);
    return { g, kind: 'hero', bar, mats, atkN: 0, castN: 0, atkT: -9, castT: -9, cast: '', lx: h.x, ly: h.y, scale: 1, rollN: h.rollN | 0 };
  }
  /* Roulade : une culbute en avant, ramassée en boule (le corps tourne autour de son milieu). */
  function djRollPose(r, h, tNow) {
    if ((h.rollN | 0) !== (r.rollN | 0)) { r.rollN = h.rollN | 0; r.rollT = tNow; }
    const body = r.g.userData.body; if (!body) return;
    const k = r.rollT != null ? (tNow - r.rollT) / 0.32 : 1, s = r.scale || 1;
    if (k >= 0 && k < 1 && !h.dead) {
      const th = k * Math.PI * 2, sq = 1 - 0.4 * Math.sin(k * Math.PI), cs = 0.5 * s * sq;
      body.scale.set(s, s * sq, s); body.rotation.x = th;
      body.position.set(0, 0.5 * s - cs * Math.cos(th), -cs * Math.sin(th));
    } else if (body.rotation.x) { body.rotation.x = 0; body.position.set(0, 0, 0); body.scale.setScalar(s); r.rollT = null; }
  }
  function djMobRec(m) {
    const def = DJ_U[m.type] || DJ_U.gobelin, g = djModel(def);
    djPrepAnims(g);
    g.add(djRing(m.boss ? 0xff3a2a : 0xb8402e, m.r * 2.2, m.boss ? 0.7 : 0.5));
    const bar = makeBar(m.boss ? 1.6 : m.big ? 1.1 : 0.7, m.boss ? 0xff5a3c : 0xd9483b); bar.position.y = def.h + 0.35; bar.visible = false; g.add(bar);
    if (m.boss) { const gl2 = makeGlow(0xff4a2a, 3.2, 0.4); gl2.material.opacity = 0.35; g.add(gl2); g.userData.aura = gl2; }
    return { g, kind: 'mob', bar, atkN: m.atkN, atkT: -9, lx: m.x, ly: m.y, h: def.h };
  }
  function djAllyRec(a) {
    let g;
    if (a.kind === 'skel') { g = djModel(DJ_U.skel); djPrepAnims(g); g.add(djRing(0xa070ff, 0.6, 0.45)); }
    else {
      /* le familier : une petite bête toute simple selon son espèce, en attendant son modèle */
      g = new THREE.Group(); const body = new THREE.Group(), pt = a.pt || 'loup';
      if (pt === 'faucon' || pt === 'chouette') {
        const c = pt === 'faucon' ? 0x7a5a3a : 0xd8cbb0, y = 0.95;
        body.add(P('sph', c, 0.26, 0.24, 0.34, 0, y, 0)); body.add(P('sph', c, 0.2, 0.2, 0.2, 0, y + 0.16, 0.12));
        body.add(P('cone4', 0xe0a020, 0.06, 0.08, 0.06, 0, y + 0.18, 0.24, 0, true));
        for (const sx of [-1, 1]) body.add(piv(sx * 0.12, y + 0.08, 0, [P('box', c, 0.36, 0.03, 0.2, sx * 0.18, 0, 0, 0, true)], 0, 0, sx * 0.3));
      } else {
        const c = pt === 'sanglier' ? 0x5e4434 : 0x8a7a66, k = pt === 'sanglier' ? 1.15 : 1;
        body.add(P('box', c, 0.32 * k, 0.22 * k, 0.5 * k, 0, 0.12, 0)); body.add(P('box', c, 0.24 * k, 0.22 * k, 0.22 * k, 0, 0.26 * k, 0.3 * k));
        if (pt === 'sanglier') for (const sx of [-1, 1]) body.add(P('cone4', 0xf2ead8, 0.04, 0.1, 0.04, sx * 0.08, 0.28, 0.46, 0, true));
        else { body.add(P('cone4', 0x5e5144, 0.08, 0.12, 0.08, -0.07, 0.48, 0.3)); body.add(P('cone4', 0x5e5144, 0.08, 0.12, 0.08, 0.07, 0.48, 0.3)); }
      }
      g.add(body); g.userData = { body, A: {}, mixer: null };
    }
    const bar = makeBar(0.5, 0xb48cff); bar.position.y = 1.3; bar.visible = false; g.add(bar);
    return { g, kind: a.kind, bar, atkN: a.atkN, atkT: -9, lx: a.x, ly: a.y };
  }
  function djPlay(r, name, speed, restart) {
    const U = r.g.userData, a = U.A && U.A[name]; if (!a) return;
    if (speed) a.timeScale = speed;
    if (U.cur === a && !restart) return;
    if (U.cur && U.cur !== a) U.cur.fadeOut(0.12);
    a.reset().fadeIn(0.12).play(); U.cur = a;
  }
  /* Position (entre deux pas de simulation), orientation, animation. */
  function djPose(r, e, alpha, tNow) {
    let x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
    /* héros de l'invitée, vu par l'hôte : sa position arrive par à-coups (10 fois par seconde), on la lisse */
    if (e.remote) { const k = Math.min(1, (DJ.dt || 0.016) * 12); r.sx = r.sx == null ? e.x : r.sx + (e.x - r.sx) * k; r.sy = r.sy == null ? e.y : r.sy + (e.y - r.sy) * k; x = r.sx; y = r.sy; }
    const dx = x - r.lx, dy = y - r.ly;
    r.g.position.set(x - half, 0, y - half);
    /* en attaquant (même en marchant), il se tourne vers sa cible le temps du coup */
    const aim = r.aim != null && tNow - r.aimT < 0.6 && DJ && DJ.st ? djEntPos(DJ.st, r.aim) : null;
    const turn = want => { let d = want - r.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.g.rotation.y += d * 0.45; };
    if (aim && (aim[0] - x) * (aim[0] - x) + (aim[1] - y) * (aim[1] - y) > 1e-4) turn(Math.atan2(aim[0] - x, aim[1] - y));
    else if (dx * dx + dy * dy > 1e-6 && e.mv) r.g.rotation.y = Math.atan2(dx, dy);
    else if (e.fx || e.fy) turn(Math.atan2(e.fx, e.fy));
    r.lx = x; r.ly = y;
    if (e.atkN !== r.atkN) { r.atkN = e.atkN; r.atkT = tNow; if (r.g.userData.A && r.g.userData.A.atk) djPlay(r, 'atk', (r.g.userData.A.atk.getClip().duration / 0.55), true); }
    if (e.dead) { if (!r.down) { r.down = true; djPlay(r, 'death', 1.2, true); } return; }
    if (r.down) { r.down = false; djPlay(r, 'idle', 1, true); }
    if (tNow - r.atkT < 0.55 || (r.castT != null && tNow - r.castT < 0.7)) return;
    if (e.mv) djPlay(r, 'walk', e.kind === 'hero' ? 0.9 : e.big ? 0.55 : 0.75); else djPlay(r, 'idle', 1);
  }
  function djBar(r, f, show) { r.bar.visible = show; if (show) { setBar(r.bar, f); r.bar.quaternion.copy(r.g.quaternion).invert().multiply(camera.quaternion); } }   // face à la caméra malgré la rotation du personnage

  /* Entrée dans le donjon : le village disparaît, le décor du donjon est construit. me = id du héros suivi par la caméra. */
  function djEnter(st, me) {
    if (!ok) return;
    if (DJ) djExit();
    const d = st.d, W = d.W, H = d.H;
    DJ = { st, me, ents: new Map(), shots: new Map(), zones: new Map(), dying: [], nums: [], teles: [], torches: [], frame: 0, doorSig: '', doorCells: [], disp: [], exit: null, t: 0, rain: 0 };
    for (const g of djHidden()) g.visible = false;
    selMesh.visible = false; ghostMesh.visible = false; zoneMesh.visible = false; gridMesh.visible = false;
    if (!djGroup.parent) scene.add(djGroup);
    djGroup.visible = true;
    const keep = o => { DJ.disp.push(o); return o; };
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d.grid[y * W + x] === 1;
    /* Sol : une dalle par case, nuances au hasard (les couloirs un peu plus sombres). */
    const floors = [], tall = [], low = [];
    const roomAt = st.roomAt;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (isFloor(x, y)) { floors.push([x, y, roomAt[y * W + x] >= 0]); continue; }
      let near = false; for (const [ox, oy] of DJ_D8) if (isFloor(x + ox, y + oy)) { near = true; break; }
      if (!near) continue;
      /* Murs côté caméra (au sud et à l'est d'un sol) : bas, pour ne pas cacher les héros. */
      (isFloor(x - 1, y) || isFloor(x, y - 1) || isFloor(x - 1, y - 1) ? low : tall).push([x, y]);
    }
    const m4 = new THREE.Matrix4(), col = new THREE.Color(), q0 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    const inst = (g, material, list, place, colorOf, shadow) => {
      const im = new THREE.InstancedMesh(g, material, list.length);
      list.forEach((it, i) => { place(it, v3, s3); m4.compose(v3, q0, s3); im.setMatrixAt(i, m4); if (colorOf) im.setColorAt(i, colorOf(it, i, col)); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = !!shadow; im.receiveShadow = true; djGroup.add(keep(im)); return im;
    };
    const fMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }));
    const LK = DJ_LOOK[d.theme] || DJ_LOOK.mine; DJ.look = LK;
    inst(geo('box'), fMat, floors, (f, p, s) => { p.set(f[0] + 0.5 - half, -0.2, f[1] + 0.5 - half); s.set(0.98, 0.2, 0.98); },
      (f, i, c) => { const n = hash2(f[0] * 7, f[1] * 13); return c.copy(lin(f[2] ? (n < 0.5 ? LK.room[0] : n < 0.85 ? LK.room[1] : LK.room[2]) : (n < 0.6 ? LK.hall[0] : LK.hall[1]))); });
    const wMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 }));
    const wallCol = (w, i, c) => c.copy(lin(hash2(w[0] * 5, w[1] * 3) < 0.5 ? LK.wall[0] : LK.wall[1]));
    if (tall.length) inst(geo('box'), wMat, tall, (w, p, s) => { p.set(w[0] + 0.5 - half, 0, w[1] + 0.5 - half); s.set(1, 1.5, 1); }, wallCol, true);
    if (low.length) inst(geo('box'), wMat, low, (w, p, s) => { p.set(w[0] + 0.5 - half, 0, w[1] + 0.5 - half); s.set(1, 0.35, 1); }, wallCol, false);
    /* Torches sur les murs du fond (de simples lueurs qui vacillent). */
    tall.forEach(([x, y], i) => {
      if (hash2(x * 31, y * 17) > 0.12) return;
      const fx = isFloor(x + 1, y) ? 0.55 : isFloor(x, y + 1) ? 0 : 0.5, fz = isFloor(x, y + 1) ? 0.55 : 0;
      const t = makeGlow(LK.torch, 1.6, 1.15); t.position.set(x + 0.5 - half + fx, 1.15, y + 0.5 - half + fz); djGroup.add(t);
      const f = P('cone6', fireMat, 0.12, 0.26, 0.12, t.position.x, 1.0, t.position.z, 0, true); djGroup.add(f);
      DJ.torches.push({ s: t, f, ph: i * 1.7 });
    });
    /* Grilles magiques sur les entrées des salles (visibles quand le combat les ferme). */
    const cells = []; st.doors.forEach(list => list.forEach(k => { if (!cells.includes(k)) cells.push(k); }));
    DJ.doorCells = cells;
    if (cells.length) {
      const dm = keep(new THREE.MeshBasicMaterial({ color: lin(0xff8a3a), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      DJ.doorMesh = inst(geo('box'), dm, cells, (k, p, s) => { p.set(k % W + 0.5 - half, 0, Math.floor(k / W) + 0.5 - half); s.set(0, 0, 0); }, null, false);
      DJ.doorMat = dm;
    }
    /* Pièges à pointes. */
    if (st.traps.length) {
      inst(geo('box'), mat(0x3d3934), st.traps, (t, p, s) => { p.set(t.x + 0.5 - half, -0.02, t.y + 0.5 - half); s.set(0.82, 0.05, 0.82); }, null, false);
      const spikes = []; st.traps.forEach((t, i) => { for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2], [0, 0]]) spikes.push([i, t.x + 0.5 + ox, t.y + 0.5 + oz]); });
      DJ.spikes = spikes; DJ.spikeMesh = inst(geo('cone6'), mat(0xb8bcc0), spikes, (sp, p, s) => { p.set(sp[1] - half, -0.5, sp[2] - half); s.set(0.12, 0.45, 0.12); }, null, false);
    }
    /* Coffres, autel, prisonnier. */
    DJ.chests = st.chests.map(c => {
      const g = new THREE.Group(); g.position.set(c.x - half, 0, c.y - half); g.rotation.y = Math.PI / 4;
      g.add(P('box', 0x7a5230, 0.62, 0.38, 0.44, 0, 0, 0)); g.add(P('box', 0xd9b54c, 0.64, 0.06, 0.46, 0, 0.18, 0, 0, true));
      const lid = piv(0, 0.38, -0.22, [P('box', 0x6a4426, 0.64, 0.16, 0.46, 0, 0, 0.22)]); g.add(lid);
      const glow = makeGlow(0xffd27a, 1.3, 0.45); g.add(glow); djGroup.add(g);
      return { g, lid, glow, open: false };
    });
    if (st.altar) {
      const g = new THREE.Group(); g.position.set(st.altar.x - half, 0, st.altar.y - half);
      g.add(P('cyl8', 0x8a857c, 0.7, 0.25, 0.7, 0, 0, 0)); g.add(P('cyl8', 0x9c968c, 0.42, 0.75, 0.42, 0, 0.25, 0));
      const orb = makeGlow(0x7ab8ff, 1.6, 1.25); g.add(orb); const core = P('sph', basic(0xbfe0ff), 0.28, 0.28, 0.28, 0, 1.12, 0, 0, true); g.add(core);
      djGroup.add(g); DJ.altar = { g, orb, core };
    }
    if (st.pris) {
      const g = (LIB.ok && makePerson({ kind: 'vil', race: 'humain', sex: hash2(d.seed, 3) < 0.5 ? 'm' : 'f', job: null, name: '' })) || djSimple(0xc9a27a, 1);
      g.position.set(st.pris.x - half, 0, st.pris.y - half); g.rotation.y = Math.PI / 4;
      const chains = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 16), mat(0x3c3c40)); chains.rotation.x = Math.PI / 2; chains.position.y = 0.55; g.add(chains);
      const mark = makeGlow(0xfff0a0, 0.9, 1.9); g.add(mark);
      djGroup.add(g); DJ.pris = { g, chains, mark, t: 0 };
    }
    /* La Source du Mal : le berceau au fond de la dernière salle, dans une lueur inquiétante */
    if (d.cradle) {
      const g = new THREE.Group(); g.position.set(d.cradle[0] + 0.5 - half, 0, d.cradle[1] + 0.5 - half); g.rotation.y = -Math.PI / 4;
      const c = cradleG(); c.scale.setScalar(1.3); g.add(c);
      const glow = makeGlow(0xb98aff, 2.6, 0.6); g.add(glow); const ring = djRing(0xb98aff, 2.2, 0.45); g.add(ring);
      djGroup.add(g); DJ.cradle = { g, c, glow, ring };
    }
    /* Lumière chaude qui suit le héros. */
    DJ.light = new THREE.PointLight(LK.light, 1.5, 13, 1.6); djGroup.add(DJ.light);
    setMood('donjon');
    cam.view = aspect < 0.8 ? 17 : 12.5; frustum();
    const hh = st.heroes.find(x => x.id === me) || st.heroes[0];
    if (hh) { cam.tx = hh.x - half; cam.tz = hh.y - half; }
  }
  function djExit() {
    if (!DJ) return;
    clearGroup(djGroup);
    for (const o of DJ.disp) { if (o.dispose) o.dispose(); if (o.geometry && o.geometry !== geo('box') && o.geometry !== geo('cone6')) o.geometry.dispose(); }
    for (const s of shots) fxGroup.remove(s.m); shots.length = 0;
    DJ = null; djGroup.visible = false;
    for (const g of djHidden()) g.visible = true;
    sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
    mood = ''; setMood('warm'); resetCamera();
  }
  function djNum(x, y, text, color, big) {
    if (!DJ) return;
    let n = DJ.nums.find(q => !q.on);
    if (!n) {
      if (DJ.nums.length >= 24) n = DJ.nums.reduce((a, b) => (a.t > b.t ? a : b));
      else {
        const c = document.createElement('canvas'); c.width = 128; c.height = 48;
        const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        sp.renderOrder = 12; djGroup.add(sp); n = { sp, c, tex }; DJ.nums.push(n);
      }
    }
    const g2 = n.c.getContext('2d'); g2.clearRect(0, 0, 128, 48);
    g2.font = (big ? '800 34px' : '800 27px') + ' system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.lineWidth = 6; g2.strokeStyle = 'rgba(0,0,0,0.7)'; g2.strokeText(text, 64, 25); g2.fillStyle = color; g2.fillText(text, 64, 25);
    n.tex.needsUpdate = true; n.on = true; n.t = 0;
    const k = big ? 1.5 : 1.1; n.sp.scale.set(k, k * 0.375, 1); n.sp.visible = true; n.sp.material.opacity = 1;
    n.sp.position.set(x - half + (Math.random() - 0.5) * 0.4, 1.7 + (big ? 0.3 : 0), y - half + (Math.random() - 0.5) * 0.4);
  }
  function djTele(e) {
    const red = basic(0xff3020, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    let m;
    if (e.a === 'storm') { for (const p of e.pts || []) djTele({ a: 'slam', x: p[0], y: p[1], r: e.r, t: e.t, id: e.id }); return; }
    if (e.a === 'slam') { const g2 = new THREE.CircleGeometry(e.r, 40); g2.rotateX(-Math.PI / 2); m = new THREE.Mesh(g2, red); m.position.set(e.x - half, 0.04, e.y - half); }
    else { const g2 = new THREE.PlaneGeometry(1.6, e.len); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, e.len / 2); m = new THREE.Mesh(g2, red); m.position.set(e.x - half, 0.04, e.y - half); m.rotation.y = Math.atan2(e.dx, e.dy); }
    m.renderOrder = 3; djGroup.add(m); DJ.teles.push({ m, t: 0, T: e.t, id: e.id });
  }
  const djEntPos = (st, id) => { const e = st.heroes.find(q => q.id === id) || st.mobs.find(q => q.id === id) || st.allies.find(q => q.id === id); if (e) return [e.x, e.y]; const r = DJ && DJ.ents.get(id); return r ? [r.lx, r.ly] : null; };
  /* Effets des événements de la simulation (dégâts, compétences, coffres…). */
  function djFx(e, st) {
    if (!DJ) return;
    const P2 = id => djEntPos(st, id);
    switch (e.k) {
      case 'atk': { const r = DJ.ents.get(e.id); if (r && e.tgt != null) { r.aim = e.tgt; r.aimT = performance.now() / 1000; } break; }     // il regarde sa cible pendant le coup
      case 'hit': { const p = P2(e.id); if (p) { spark(p[0], 0.8, p[1], e.crit ? 0xffd27a : 0xfff0d0); djNum(p[0], p[1], String(e.v), e.ally ? '#c9b3ff' : e.crit ? '#ffd23f' : '#ffffff', e.crit); } break; }
      case 'hurt': { const p = P2(e.id); if (p) djNum(p[0], p[1], String(e.v), '#ff6b5b', false); if (e.id === DJ.me && e.v > 25) shake(0.15); break; }
      case 'heal': { const p = P2(e.id); if (p && e.v >= 2) djNum(p[0], p[1], '+' + e.v, '#7dff8a', false); break; }
      case 'miss': { const p = P2(e.id); if (p) djNum(p[0], p[1], 'esquive', '#e8f4ff', false); break; }
      case 'block': { const p = P2(e.id); if (p) djNum(p[0], p[1], String(e.v), '#8ec8ff', false); break; }
      case 'die': burst(e.x, e.y, 0.4, e.boss ? 0xff7a3a : 0xbfb8a8, e.boss ? 14 : 5); if (e.boss) { shake(0.5); debris(e.x, e.y, 2, true, 16); } break;
      case 'potion': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0x7dff8a, 1.4, 0.5); for (let i = 0; i < 5; i++) spark(p[0], 0.6 + i * 0.25, p[1], 0x9dff9a); } break; }
      case 'nova': wave(e.x, e.y, DJ_FX[e.c] || 0xffffff, e.r, 0.5); wave(e.x, e.y, DJ_FX[e.c] || 0xffffff, e.r * 0.6, 0.35); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; spark(e.x + Math.cos(a) * e.r * 0.7, 0.5, e.y + Math.sin(a) * e.r * 0.7, DJ_FX[e.c]); } break;
      case 'boom': burst(e.x, e.y, 0.5, DJ_FX[e.c] || 0xff7a2a, 9); wave(e.x, e.y, DJ_FX[e.c] || 0xff7a2a, e.r, 0.45); shake(0.18); break;
      case 'dash': for (let i = 0; i <= 4; i++) dustRing(e.x0 + (e.x1 - e.x0) * i / 4, e.y0 + (e.y1 - e.y0) * i / 4, 0.2); break;
      case 'roll': dustRing(e.x, e.y, 0.35); break;
      case 'blink': for (let i = 0; i < 4; i++) { spark(e.x0, 0.4 + i * 0.3, e.y0, 0xc9a0ff); spark(e.x1, 0.4 + i * 0.3, e.y1, 0xc9a0ff); } break;
      case 'bolt': { const a = P2(e.id), b = P2(e.tgt); if (a && b) { const c = e.c === 'marteau' ? 0xffd27a : 0xfff4c0; const s = makeGlow(c, 0.9, 1); s.position.set(a[0] - half, 1, a[1] - half); djGroup.add(s); DJ.teles.push({ m: s, t: 0, T: 0.18, fly: [a[0], a[1], b[0], b[1]] }); setTimeout(() => { if (DJ) { const p = djEntPos(st, e.tgt) || b; burst(p[0], p[1], 0.8, c, 4); } }, 180); } break; }
      case 'line': { const L = Math.hypot(e.x1 - e.x0, e.y1 - e.y0), g2 = new THREE.PlaneGeometry(0.35, L); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, L / 2); const m = new THREE.Mesh(g2, basic(0xfff0b0, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(e.x0 - half, 0.9, e.y0 - half); m.rotation.y = Math.atan2(e.x1 - e.x0, e.y1 - e.y0); djGroup.add(m); DJ.teles.push({ m, t: 0, T: 0.3, fade: true }); break; }
      case 'shout': wave(e.x, e.y, 0xff7a3a, Math.min(e.r, 4), 0.6); break;
      case 'smoke': for (let i = 0; i < 6; i++) smokeAt(e.x - half + (Math.random() - 0.5), 0.4, e.y - half + (Math.random() - 0.5), true); break;
      case 'holy': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xffe08a, 1.2, 0.5); for (let i = 0; i < 5; i++) spark(p[0] + (Math.random() - 0.5) * 0.6, 0.4 + i * 0.3, p[1] + (Math.random() - 0.5) * 0.6, 0xffe08a); } break; }
      case 'drain': { const a = P2(e.tgt), b = P2(e.id); if (a && b) for (let i = 0; i <= 5; i++) spark(a[0] + (b[0] - a[0]) * i / 5, 0.9, a[1] + (b[1] - a[1]) * i / 5, 0xff4a6a); break; }
      case 'summon': wave(e.x, e.y, e.boss ? 0xff3a2a : 0xa070ff, e.boss ? 3 : 2, 0.6); for (let i = 0; i < 6; i++) smokeAt(e.x - half + (Math.random() - 0.5) * 2, 0.3, e.y - half + (Math.random() - 0.5) * 2, true); break;
      case 'form': { const p = P2(e.id); if (p) { burst(p[0], p[1], 0.6, e.f === 'ours' ? 0x8a6a4a : e.f === 'loup' ? 0x9a9a9a : 0x7bd36a, 6); } break; }
      case 'tele': djTele(e); break;
      case 'teleCancel': for (const t of DJ.teles) if (t.id === e.id && !t.fly && !t.fade) { t.t = t.T; } break;
      case 'storm': { const fire = e.c === 'fire'; for (const p of e.pts || []) { burst(p[0], p[1], 0.3, fire ? 0xff7a2a : 0xe8e0c8, 5); wave(p[0], p[1], fire ? 0xff5a2a : 0xd8d0b8, e.r, 0.4); } shake(0.3); break; }
      case 'raised': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xa070ff, 1.2, 0.6); djNum(p[0], p[1], 'relevé…', '#c9a0ff', false); } break; }
      case 'combo': { const p = P2(e.id); if (p) { djNum(p[0], p[1], 'COMBO !', '#ffd23f', true); wave(p[0], p[1], 0xffd23f, 1.3, 0.35); for (let i = 0; i < 4; i++) spark(p[0], 0.7 + i * 0.25, p[1], 0xffe07a); } break; }
      case 'item': {
        /* un objet trouvé : une colonne de lumière de la couleur de sa rareté (seulement pour ses propres objets, et toujours dès « rare ») */
        if (e.id !== DJ.me && e.r < 2 && !e.set) break;
        const c = new THREE.Color(e.set ? SET_COL : RARITY[e.r].col).getHex(), H = 1.2 + 0.5 * e.r;
        const w = 0.11 + 0.02 * e.r, g2 = new THREE.CylinderGeometry(w, w, H, 8, 1, true); g2.translate(0, H / 2, 0);
        const m = new THREE.Mesh(g2, basic(c, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.set(e.x - half, 0, e.y - half);
        djGroup.add(m); DJ.teles.push({ m, t: 0, T: 1.2 + 0.2 * e.r, fade: true });
        for (let i = 0; i < 4 + 2 * e.r; i++) spark(e.x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * H, e.y + (Math.random() - 0.5) * 0.5, c);
        if (e.r >= 2 || e.set) djNum(e.x, e.y, e.set ? 'Ensemble !' : RARITY[e.r].name + ' !', e.set ? SET_COL : RARITY[e.r].col, e.r >= 3);
        break;
      }
      case 'gem': { const G = gemOf(e.g); if (G) { const c = new THREE.Color(G.col).getHex(); for (let i = 0; i < 6; i++) spark(e.x + (Math.random() - 0.5) * 0.4, 0.5 + Math.random(), e.y + (Math.random() - 0.5) * 0.4, c); djNum(e.x, e.y, '◆', G.col, true); } break; }
      case 'chain': { const L = Math.hypot(e.x1 - e.x, e.y1 - e.y); if (L > 0.1) { const g2 = new THREE.PlaneGeometry(0.18, L); g2.rotateX(-Math.PI / 2); g2.translate(0, 0, L / 2); const m = new THREE.Mesh(g2, basic(0x9fe3ff, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(e.x - half, 0.9, e.y - half); m.rotation.y = Math.atan2(e.x1 - e.x, e.y1 - e.y); djGroup.add(m); DJ.teles.push({ m, t: 0, T: 0.18, fade: true }); spark(e.x1, 0.9, e.y1, 0x9fe3ff); } break; }
      case 'echo': { const p = P2(e.id); if (p) { for (let i = 0; i < 4; i++) spark(p[0], 0.8 + i * 0.25, p[1], 0x9fe3ff); djNum(p[0], p[1], 'écho !', '#9fe3ff', false); } break; }
      case 'sursis': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xffd27a, 1.8, 0.7); djNum(p[0], p[1], 'Dernier Rempart !', '#ffd27a', true); } break; }
      case 'slam': wave(e.x, e.y, 0xff6a3a, e.r, 0.5); debris(e.x, e.y, 2.5, true, 12); shake(0.45); break;
      case 'charge': dustRing(P2(e.id) ? P2(e.id)[0] : 0, P2(e.id) ? P2(e.id)[1] : 0, 0.6); break;
      case 'wall': shake(0.4); for (let i = 0; i < 6; i++) spark(e.x + (Math.random() - 0.5), 2.4 + Math.random() * 0.4, e.y + (Math.random() - 0.5), 0xfff07a); break;
      case 'interrupt': { const p = P2(e.id); if (p) djNum(p[0], p[1], 'interrompu !', '#ffd23f', false); break; }
      case 'enrage': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xff2a1a, 3, 0.7); djNum(p[0], p[1], 'enragé !', '#ff5a3c', true); } break; }
      case 'spawn': dustRing(e.x, e.y, 0.4); smokeAt(e.x - half, 0.3, e.y - half, true); break;
      case 'chest': for (let i = 0; i < 10; i++) spark(e.x + (Math.random() - 0.5) * 0.6, 0.5 + Math.random(), e.y + (Math.random() - 0.5) * 0.6, 0xffd27a); break;
      case 'altar': wave(e.x, e.y, 0x7ab8ff, 3, 0.8); for (let i = 0; i < 10; i++) spark(e.x + (Math.random() - 0.5), 0.5 + Math.random() * 1.5, e.y + (Math.random() - 0.5), 0x9fd0ff); break;
      case 'free': for (let i = 0; i < 12; i++) spark(e.x + (Math.random() - 0.5), 0.5 + Math.random() * 1.6, e.y + (Math.random() - 0.5), 0xfff0a0); if (DJ.pris) DJ.pris.t = 0.001; break;
      case 'lock': shake(0.12); break;
      case 'clear': { const c = djCenter(st.d.rooms[e.room]); wave(c[0] + 0.5, c[1] + 0.5, 0xffd27a, 4, 0.9); break; }
      case 'trap': spark(e.x, 0.4, e.y, 0xff5a3c); break;
      case 'revive': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xb8ffcf, 2, 0.8); djNum(p[0], p[1], 'se relève !', '#b8ffcf', true); } break; }
      case 'saved': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xc9b3ff, 2, 0.8); djNum(p[0], p[1], 'Sukhoï te relève !', '#d8c8ff', true); } break; }
      case 'raise': { const p = P2(e.id); if (p) { wave(p[0], p[1], 0xffe08a, 1.8, 0.8); for (let i = 0; i < 8; i++) spark(p[0] + (Math.random() - 0.5) * 0.8, 0.4 + i * 0.25, p[1] + (Math.random() - 0.5) * 0.8, 0xffe08a); djNum(p[0], p[1], 'relevé !', '#ffe08a', true); } break; }
      case 'cast': { const r = DJ.ents.get(e.id); if (r) { r.castT = performance.now() / 1000; const an = DJ_CAST_ANIM[e.s] || 'atk'; if (r.g.userData.A && r.g.userData.A[an]) djPlay(r, an, an === 'spin' ? 1.4 : 1.2, true); } break; }
    }
  }
  /* Mise à jour de l'affichage d'après l'état du combat (appelée à chaque image ; alpha = entre deux pas). */
  function djSync(st, alpha, dt, tNow) {
    if (!DJ) return;
    DJ.frame++; DJ.t += dt; DJ.dt = dt; DJ.st = st;
    const fr = DJ.frame, Q = camera.quaternion;
    const upd = (map, e, make) => { let r = map.get(e.id); if (!r) { r = make(e); map.set(e.id, r); djGroup.add(r.g); } r.seen = fr; return r; };
    for (const h of st.heroes) {
      const r = upd(DJ.ents, h, djHeroRec);
      djPose(r, h, alpha, tNow);
      djBar(r, h.hp / h.hpMax, !h.dead && (st.heroes.length > 1 || h.hp < h.hpMax));
      const sc = h.form === 'ours' ? 1.3 : h.form === 'loup' ? 0.85 : 1; r.scale += (sc - r.scale) * Math.min(1, dt * 8); r.g.userData.body.scale.setScalar(r.scale);
      djRollPose(r, h, tNow);
      const ghost = h.b.stealth > 0, inv = h.b.inv > 0 && !h.dead;
      for (const m of r.mats) { const op = ghost ? 0.35 : inv ? 0.6 + 0.4 * Math.sin(tNow * 30) : 1; if (m.opacity !== op) { m.transparent = op < 1; m.opacity = op; m.needsUpdate = true; } }
      if (h.dead && !h.gone && st.heroes.length > 1 && !r.revRing) { const rg = new THREE.RingGeometry(0.62, 0.78, 32, 1, 0, Math.PI * 2); rg.rotateX(-Math.PI / 2); r.revRing = new THREE.Mesh(rg, basic(0xffe08a, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); r.revRing.position.y = 0.06; r.revRing.renderOrder = 4; r.g.add(r.revRing); }
      if (r.revRing) { r.revRing.visible = h.dead && !h.gone; if (r.revRing.visible) { const k = Math.max(0.05, Math.min(1, (h.rev || 0) / 3)); r.revRing.scale.setScalar(0.6 + 0.6 * k); r.revRing.material.opacity = 0.35 + 0.5 * k + 0.1 * Math.sin(tNow * 6); } }
      if (h.shield > 0 && !r.bubble) { r.bubble = new THREE.Mesh(geo('sph'), basic(0x8ec8ff, { transparent: true, opacity: 0.22, depthWrite: false })); r.bubble.scale.set(1.3, 1.9, 1.3); r.bubble.position.y = -0.1; r.g.add(r.bubble); }
      if (r.bubble) r.bubble.visible = h.shield > 0 && !h.dead;
    }
    for (const m of st.mobs) {
      if (m.hidden) continue;
      const r = upd(DJ.ents, m, djMobRec);
      djPose(r, m, alpha, tNow);
      djBar(r, m.hp / m.hpMax, m.awake && (m.hp < m.hpMax || m.boss));
      if (m.frz > 0 && !r.ice) { r.ice = makeGlow(0x9fe3ff, (r.h || 1) * 1.6, (r.h || 1) * 0.5); r.ice.material.opacity = 0.55; r.g.add(r.ice); }
      if (r.ice) r.ice.visible = m.frz > 0;
      if (m.stun > 0 && !r.stars) { r.stars = makeGlow(0xfff07a, 0.6, (r.h || 1) + 0.25); r.g.add(r.stars); }
      if (r.stars) { r.stars.visible = m.stun > 0; if (m.stun > 0) r.stars.position.x = Math.sin(tNow * 9) * 0.25; }
      if (m.root > 0 && !r.roots) { r.roots = djRing(0x5fbf4a, m.r * 2.8, 0.7); r.g.add(r.roots); }
      if (r.roots) r.roots.visible = m.root > 0;
      if (r.g.userData.aura) r.g.userData.aura.material.opacity = (m.sp && m.sp.enr ? 0.6 : 0.3) + 0.12 * Math.sin(tNow * 6);
      if (r.g.userData.mixer && (m.frz > 0 || m.stun > 0)) r.frozen = true; else r.frozen = false;
    }
    for (const a of st.allies) {
      if (!a.inv && a.hp <= 0) continue;
      const r = upd(DJ.ents, a, djAllyRec);
      djPose(r, a, alpha, tNow);
      djBar(r, a.hp / a.hpMax, !a.inv && a.hp < a.hpMax);
      if (!r.g.userData.mixer) r.g.userData.body.position.y = a.mv ? Math.abs(Math.sin(tNow * 14)) * 0.06 : 0;
    }
    for (const [id, r] of DJ.ents) if (r.seen !== fr) {
      DJ.ents.delete(id);
      if (r.g.userData.A && r.g.userData.A.death) { r.bar.visible = false; djPlay(r, 'death', 1.3, true); DJ.dying.push({ r, t: 0 }); }
      else { djGroup.remove(r.g); burst(r.lx, r.ly, 0.3, 0xd8d0c0, 4); }
    }
    for (const [, r] of DJ.ents) { const U = r.g.userData; if (U.mixer) U.mixer.update(r.frozen ? 0 : dt); }
    /* Projectiles */
    for (const s of st.shots) {
      let r = DJ.shots.get(s.id);
      if (!r) {
        const arrow = s.kind === 'arrow', m = arrow ? P('box', DJ_SHOT.arrow, 0.05, 0.05, 0.5, 0, 0, 0, 0, true) : makeGlow(DJ_SHOT[s.kind] || 0xffffff, s.kind === 'fire' ? 0.9 : 0.7, 0);
        if (!arrow) { const core = P('sph', basic(DJ_SHOT[s.kind] || 0xffffff), 0.16, 0.16, 0.16, 0, -0.08, 0, 0, true); m.add(core); }
        r = { m, arrow }; DJ.shots.set(s.id, r); djGroup.add(m);
      }
      r.seen = fr;
      const x = s.px + (s.x - s.px) * alpha, y = s.py + (s.y - s.py) * alpha;
      r.m.position.set(x - half, 0.95, y - half);
      if (r.arrow) r.m.rotation.y = Math.atan2(s.x - s.px, s.y - s.py);
    }
    for (const [id, r] of DJ.shots) if (r.seen !== fr) { DJ.shots.delete(id); djGroup.remove(r.m); if (!r.arrow) spark(r.m.position.x + half, 0.9, r.m.position.z + half, 0xffd0a0); }
    /* Zones (consécration, pluie de flèches) */
    for (const z of st.zones) {
      let r = DJ.zones.get(z.id);
      if (!r) {
        const c = z.k === 'cons' ? 0xffd27a : 0x9be37a, g2 = new THREE.CircleGeometry(z.r, 40); g2.rotateX(-Math.PI / 2);
        const m = new THREE.Mesh(g2, basic(c, { transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(z.x - half, 0.05, z.y - half); m.renderOrder = 3;
        r = { m, k: z.k }; DJ.zones.set(z.id, r); djGroup.add(m);
      }
      r.seen = fr; r.m.material.opacity = 0.18 + 0.1 * Math.sin(tNow * 8);
      if (z.k === 'rain' && Math.random() < dt * 14) { const tx = z.x + (Math.random() - 0.5) * z.r * 1.6, ty = z.y + (Math.random() - 0.5) * z.r * 1.6; spawnShot('arrow', tx - 0.6, 4, ty - 0.6, () => [tx, 0.1, ty], 0.3, 0.2); }
    }
    for (const [id, r] of DJ.zones) if (r.seen !== fr) { DJ.zones.delete(id); djGroup.remove(r.m); r.m.geometry.dispose(); }
    /* Grilles : affichées seulement quand elles sont fermées. */
    if (DJ.doorMesh) {
      let sig = ''; for (const k of DJ.doorCells) sig += st.door[k] ? '1' : '0';
      if (sig !== DJ.doorSig) {
        DJ.doorSig = sig; const m4 = new THREE.Matrix4(), W = st.d.W;
        DJ.doorCells.forEach((k, i) => { const on = st.door[k]; m4.compose(new THREE.Vector3(k % W + 0.5 - half, 0, Math.floor(k / W) + 0.5 - half), new THREE.Quaternion(), on ? new THREE.Vector3(0.96, 1.1, 0.96) : new THREE.Vector3(0, 0, 0)); DJ.doorMesh.setMatrixAt(i, m4); });
        DJ.doorMesh.instanceMatrix.needsUpdate = true;
      }
      DJ.doorMat.opacity = 0.35 + 0.12 * Math.sin(tNow * 5);
    }
    if (DJ.spikeMesh) {
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.12, 0.45, 0.12), p = new THREE.Vector3();
      DJ.spikes.forEach((sp, i) => { const on = st.traps[sp[0]].on; p.set(sp[1] - half, on ? -0.02 : -0.5, sp[2] - half); m4.compose(p, q, s); DJ.spikeMesh.setMatrixAt(i, m4); });
      DJ.spikeMesh.instanceMatrix.needsUpdate = true;
    }
    st.chests.forEach((c, i) => { const r = DJ.chests[i]; if (!r) return; if (c.open && !r.open) { r.open = true; r.glow.visible = false; } r.lid.rotation.x += ((r.open ? -1.15 : 0) - r.lid.rotation.x) * Math.min(1, dt * 8); if (!r.open) r.glow.material.opacity = 0.3 + 0.15 * Math.sin(tNow * 3 + i); });
    if (DJ.altar) { const used = st.altar.used; DJ.altar.orb.visible = !used; DJ.altar.core.visible = !used; if (!used) DJ.altar.orb.material.opacity = 0.4 + 0.2 * Math.sin(tNow * 2.5); }
    if (DJ.pris) {
      const P3 = DJ.pris, U = P3.g.userData;
      if (U.mixer) U.mixer.update(dt);
      if (st.pris.freed && P3.t > 0) {
        if (!P3.cheer) { P3.cheer = true; P3.chains.visible = false; P3.mark.visible = false; if (U.A && U.A.cheer) { U.A.cheer.reset().play(); if (U.cur && U.cur !== U.A.cheer) U.cur.stop(); U.cur = U.A.cheer; } }
        P3.t += dt; if (P3.t > 2.5) { const k = Math.max(0, 1 - (P3.t - 2.5) / 0.6); P3.g.scale.setScalar(k); if (k <= 0) { djGroup.remove(P3.g); DJ.pris = null; } }
      } else P3.mark.material.opacity = 0.35 + 0.25 * Math.sin(tNow * 4);
    }
    if (st.exit && !DJ.exit) {
      const g = new THREE.Group(); g.position.set(st.exit.x - half, 0, st.exit.y - half);
      const rg = new THREE.RingGeometry(0.55, 0.85, 40); rg.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(rg, basic(0xffd27a, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })));
      const beam = new THREE.Mesh(geo('cyl12'), basic(0xffe9a8, { transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })); beam.scale.set(1.2, 4, 1.2); g.add(beam);
      g.add(makeGlow(0xffd27a, 2.4, 0.6)); djGroup.add(g); DJ.exit = { g, beam };
    }
    if (DJ.exit) { DJ.exit.beam.material.opacity = 0.18 + 0.1 * Math.sin(tNow * 4); DJ.exit.g.rotation.y += dt; }
    /* Caméra et lumière sur le héros suivi */
    const me = st.heroes.find(h => h.id === DJ.me) || st.heroes[0];
    if (me) {
      const r = DJ.ents.get(me.id), x = r ? r.g.position.x : me.x - half, z = r ? r.g.position.z : me.y - half;
      const k = Math.min(1, dt * 6); cam.tx += (x - cam.tx) * k; cam.tz += (z - cam.tz) * k;
      DJ.light.position.set(x, 2.4, z);
    }
  }
  /* Ce qui vit sans la simulation : chiffres qui montent, alertes au sol, morts, torches, soleil qui suit la caméra. */
  function djTick(dt, tNow) {
    for (const n of DJ.nums) if (n.on) { n.t += dt; n.sp.position.y += dt * 1.1; n.sp.material.opacity = Math.max(0, 1 - Math.pow(n.t / 0.9, 2)); if (n.t > 0.9) { n.on = false; n.sp.visible = false; } }
    for (const t of DJ.teles) {
      t.t += dt; const k = Math.min(1, t.t / t.T);
      if (t.fly) t.m.position.set(t.fly[0] + (t.fly[2] - t.fly[0]) * k - half, 1, t.fly[1] + (t.fly[3] - t.fly[1]) * k - half);
      else if (t.fade) t.m.material.opacity = 0.85 * (1 - k);
      else t.m.material.opacity = 0.15 + 0.4 * k;
      if (t.t >= t.T) { t.done = true; djGroup.remove(t.m); if (t.m.geometry && t.m.geometry !== geo('sph')) t.m.geometry.dispose(); }
    }
    DJ.teles = DJ.teles.filter(t => !t.done);
    for (const d of DJ.dying) {
      d.t += dt; const U = d.r.g.userData; if (U.mixer) U.mixer.update(dt);
      if (d.t > 1.5) { const k = Math.max(0, 1 - (d.t - 1.5) / 0.5); d.r.g.scale.setScalar(k); if (k <= 0) { d.done = true; djGroup.remove(d.r.g); } }
    }
    DJ.dying = DJ.dying.filter(d => !d.done);
    for (const t of DJ.torches) { const f = 0.85 + 0.1 * Math.sin(tNow * 13 + t.ph) + 0.06 * Math.sin(tNow * 31 + t.ph); t.s.material.opacity = 0.42 * f; t.f.scale.y = 0.26 * f; }
    /* le berceau de la Source : il se balance tout seul, la lueur bat (et vire au doré quand la voie est libre) */
    if (DJ.cradle) {
      const C = DJ.cradle, free = !!DJ.st.exit;
      C.c.rotation.z = Math.sin(tNow * 2.2) * 0.08;
      C.glow.material.opacity = 0.35 + 0.2 * Math.sin(tNow * 3.1);
      if (free !== C.free) { C.free = free; const col = lin(free ? 0xffd27a : 0xb98aff); C.glow.material.color.copy(col); C.ring.material.color.copy(col); }
    }
    const sp = P_MOOD.sunPos;
    sun.position.set(cam.tx + sp[0], sp[1], cam.tz + sp[2]); sun.target.position.set(cam.tx, 0, cam.tz); sun.target.updateMatrixWorld();
  }

  /* ---------- portails démoniaques, au bord de la vallée ----------
     Deux menhirs sombres et un anneau de feu ; la lueur grandit pendant la charge, et bat quand le portail est prêt. */
  const portalGroup = new THREE.Group();
  const portals = new Map();
  function makePortalRec(p) {
    const g = new THREE.Group(), disp = [];
    g.add(P('cyl8', 0x3a3236, 2.1, 0.16, 1.1, 0, 0, 0));
    for (const s of [-1, 1]) g.add(P('box', 0x2e2629, 0.34, 2.15, 0.42, s * 0.98, 0.1, 0, s * 0.08));
    const rg = new THREE.TorusGeometry(0.82, 0.11, 6, 26); disp.push(rg);
    const ringM = basic(0xff4a2a); disp.push(ringM);
    const ring = new THREE.Mesh(rg, ringM); ring.position.y = 1.18; g.add(ring);
    const dg = new THREE.CircleGeometry(0.76, 26); disp.push(dg);
    const discM = basic(0xa0203f, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); disp.push(discM);
    const disc = new THREE.Mesh(dg, discM); disc.position.y = 1.18; g.add(disc);
    const glow = makeGlow(0xff3a2a, 4, 1.2); g.add(glow);
    const side = p.side | 0, out = 0.35;
    g.position.set(p.x + 0.5 - half + (side === 1 ? out : side === 3 ? -out : 0), 0, p.y + 0.5 - half + (side === 0 ? -out : side === 2 ? out : 0));
    g.rotation.y = side === 1 || side === 3 ? Math.PI / 2 : 0;
    g.userData.key = 'portal' + (p.i | 0);
    return { g, ring, disc, glow, discM, ringM, disp, x: p.x, y: p.y, frac: 0, ready: false, ph: Math.random() * 6 };
  }
  function disposePortal(r) { if (r.g.parent) r.g.parent.remove(r.g); for (const d of r.disp) d.dispose(); r.glow.material.dispose(); }
  function setPortals(list) {
    const seen = new Set();
    for (const p of list || []) {
      if (p.cl) continue;
      const k = p.i | 0; seen.add(k);
      let r = portals.get(k);
      if (!r || r.x !== p.x || r.y !== p.y) { if (r) disposePortal(r); r = makePortalRec(p); portals.set(k, r); portalGroup.add(r.g); }
      r.frac = p.frac == null ? 1 : p.frac; r.ready = !!p.ready;
    }
    for (const [k, r] of portals) if (!seen.has(k)) { disposePortal(r); portals.delete(k); }
  }
  function animPortal(r, dt, tNow) {
    const k = r.ready ? 0.75 + 0.25 * Math.sin(tNow * 5 + r.ph) : 0.25 + 0.55 * r.frac;
    r.disc.rotation.z += dt * (r.ready ? 2.2 : 0.8);
    r.discM.opacity = 0.25 + 0.45 * k; r.glow.material.opacity = 0.12 + 0.5 * k;
    r.ring.scale.setScalar(0.92 + 0.08 * Math.sin(tNow * 3 + r.ph));
    if (Math.random() < dt * (1 + 5 * k)) spark(r.g.position.x + half + (Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 1.6, r.g.position.z + half + (Math.random() - 0.5) * 1.4, 0xff6a3a);
  }

  /* ---------- raids : la rediffusion, dans le village ----------
     Le village tel qu'il était ce jour-là (l'appli passe ses bâtiments), les assaillants, les héros, les tirs des tours.
     Les villageois sont à l'abri dans la halle. Une case du village (x, y) est dessinée en (x − half, y − half). */
  const rdGroup = new THREE.Group();
  let RD = null;
  const RD_U = { gobelin: DJ_U.gobelin, voleur: { m: 'rogue', tex: 'orc_rogue', show: ['Knife', 'Rogue_Cape'], atk: '1H_Melee_Attack_Slice_Diagonal', h: 0.85, w: 0.9 }, troll: DJ_U.troll };
  const RD_SHOT = { mage: 0xff7a2a, pretre: 0xffe08a, druide: 0x7bd36a, necro: 0xa070ff };
  const RD_GUARD_ATK = { fant: '1H_Melee_Attack_Chop', arch: '2H_Ranged_Shoot', lanc: '2H_Melee_Attack_Chop', mage: '1H_Melee_Attack_Slice_Diagonal' };
  function rdGuardRec(e) {
    let g = LIB.ok ? makePerson({ kind: 'sol', race: e.race, sex: e.sex, type: e.type }) : null;
    if (!g) { g = djSimple(0xb8c4d0, 1.0); g.add(djRing(0x9fb4c8, 0.62, 0.55)); }
    const U = g.userData;
    if (U.mixer) { const act = n => LIB.clips[n] ? U.mixer.clipAction(LIB.clips[n]) : null; U.A.atk = act(RD_GUARD_ATK[e.type] || '1H_Melee_Attack_Chop'); U.A.death = act('Death_A'); }
    djPrepAnims(g);
    const bar = makeBar(0.6, 0x7fb8e8); bar.position.y = 1.5; bar.visible = false; g.add(bar);
    return { g, kind: 'guard', bar, atkN: e.atkN, atkT: -9, lx: e.x, ly: e.y };
  }
  function rdFoeRec(u) {
    const def = RD_U[u.type] || RD_U.gobelin, g = djModel(def);
    djPrepAnims(g);
    g.add(djRing(0xb8402e, u.r * 2.4, 0.5));
    const bar = makeBar(u.big ? 1.0 : 0.6, 0xd9483b); bar.position.y = def.h + 0.35; bar.visible = false; g.add(bar);
    const sack = new THREE.Group(); sack.add(P('sph', 0xc9a26a, 0.34, 0.3, 0.34, 0, 0, 0, 0, true)); sack.add(P('cyl6', 0x7a5a3a, 0.09, 0.1, 0.09, 0, 0.28, 0, 0, true));
    sack.position.set(0, def.h * 0.72, -0.24); sack.visible = false; g.add(sack);
    return { g, kind: 'mob', bar, atkN: u.atkN, atkT: -9, lx: u.x, ly: u.y, h: def.h, sack };
  }
  function rdNum(x, y, text, color, big) {
    if (!RD) return;
    let n = RD.nums.find(q => !q.on);
    if (!n) {
      if (RD.nums.length >= 24) n = RD.nums.reduce((a, b) => (a.t > b.t ? a : b));
      else {
        const c = document.createElement('canvas'); c.width = 256; c.height = 48;
        const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        sp.renderOrder = 12; rdGroup.add(sp); n = { sp, c, tex }; RD.nums.push(n);
      }
    }
    const g2 = n.c.getContext('2d'); g2.clearRect(0, 0, 256, 48);
    g2.font = (big ? '800 30px' : '800 27px') + ' system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.lineWidth = 6; g2.strokeStyle = 'rgba(0,0,0,0.7)'; g2.strokeText(text, 128, 25); g2.fillStyle = color; g2.fillText(text, 128, 25);
    n.tex.needsUpdate = true; n.on = true; n.t = 0;
    const k = big ? 2.6 : 2.0; n.sp.scale.set(k, k * 0.1875, 1); n.sp.visible = true; n.sp.material.opacity = 1;
    n.sp.position.set(x - half + (Math.random() - 0.5) * 0.4, 1.8 + (big ? 0.4 : 0), y - half + (Math.random() - 0.5) * 0.4);
  }
  function rdEnter(st) {
    if (!ok) return;
    if (RD) rdExit();
    RD = { st, ents: new Map(), dying: [], nums: [], portals: [], frame: 0 };
    lifeGroup.visible = false; portalGroup.visible = false; selMesh.visible = false; ghostMesh.visible = false; gridMesh.visible = false;
    if (!rdGroup.parent) scene.add(rdGroup);
    rdGroup.visible = true;
    for (const p of st.inp.P) if (!p[3]) { const r = makePortalRec({ x: p[0], y: p[1], side: p[2] }); r.frac = 1; r.ready = true; rdGroup.add(r.g); RD.portals.push(r); }
    setMood('raid');
    showRanges(st.posts && st.posts.length ? st.posts.map(p => ({ x: p.x, z: p.y, r: p.r })) : null);   // les cercles des postes de garde
    /* caméra : sur la halle, un peu tournée vers le portail */
    const H = st.S[st.hall], P0 = st.inp.P.find(p => !p[3]) || st.inp.P[0], k = 0.35;
    cam.tx = clampT(H.x + (P0[0] + 0.5 - H.x) * k - half); cam.tz = clampT(H.y + (P0[1] + 0.5 - H.y) * k - half); cam.view = aspect < 0.8 ? 24 : 15; frustum();
  }
  function rdExit() {
    if (!RD) return;
    for (const r of RD.portals) disposePortal(r);
    clearGroup(rdGroup); RD = null; rdGroup.visible = false;
    lifeGroup.visible = true; portalGroup.visible = true; showRanges(null);
    for (const s of shots) fxGroup.remove(s.m); shots.length = 0;
    mood = ''; setMood('warm');
  }
  function rdSync(st, alpha, dt, tNow) {
    if (!RD) return;
    RD.frame++; const fr = RD.frame;
    const upd = (e, make) => { let r = RD.ents.get(e.id); if (!r) { r = make(e); RD.ents.set(e.id, r); rdGroup.add(r.g); } r.seen = fr; return r; };
    for (const h of st.heroes) { const r = upd(h, djHeroRec); djPose(r, h, alpha, tNow); djBar(r, h.hp / h.hpMax, !h.ko); }
    for (const g of st.guards || []) { const r = upd(g, rdGuardRec); djPose(r, g, alpha, tNow); djBar(r, g.hp / g.hpMax, !g.ko && g.hp < g.hpMax); }
    for (const u of st.foes) {
      if (!u.on || u.out || u.dead) continue;
      const r = upd(u, rdFoeRec);
      djPose(r, u, alpha, tNow); djBar(r, u.hp / u.hpMax, u.hp < u.hpMax);
      r.sack.visible = !!u.loot;
      if (u.root > 0 && !r.net) { r.net = djRing(0xd8c08a, 1.1, 0.85); r.g.add(r.net); }
      if (r.net) r.net.visible = u.root > 0;
      r.frozen = u.root > 0 && !u.mv;
    }
    for (const [id, r] of RD.ents) if (r.seen !== fr) {
      RD.ents.delete(id);
      const u = st.foes.find(q => q.id === id);
      if (u && u.out) { rdGroup.remove(r.g); smokeAt(r.lx - half, 0.4, r.ly - half, true); burst(r.lx, r.ly, 0.5, 0xff5a3a, 4); }
      else if (r.g.userData.A && r.g.userData.A.death) { r.bar.visible = false; if (r.sack) r.sack.visible = false; djPlay(r, 'death', 1.3, true); RD.dying.push({ r, t: 0 }); }
      else { rdGroup.remove(r.g); burst(r.lx, r.ly, 0.3, 0xd8d0c0, 4); }
    }
    for (const [, r] of RD.ents) { const U = r.g.userData; if (U.mixer) U.mixer.update(r.frozen ? 0 : dt); }
    /* solidité des palissades, portes et tours */
    for (const S of st.S) if (S.kind === 'wall' || S.kind === 'gate' || S.kind === 'tower') { const f = S.dead ? 0 : S.hp / S.max; if (S._f !== f) { S._f = f; setBldHp('r' + S.id, f); } }
  }
  function rdFx(e, st) {
    if (!RD) return;
    const pos = id => { const h = st.heroes.find(q => q.id === id) || (st.guards || []).find(q => q.id === id); if (h) return [h.x, h.y]; const u = st.foes.find(q => q.id === id); return u ? [u.x, u.y] : null; };
    const aimAtId = (id, b) => () => { const q = pos(id) || b; return [q[0], 0.8, q[1]]; };
    switch (e.k) {
      case 'hit': { const p = pos(e.id); if (p) { rdNum(p[0], p[1], String(e.v), '#ffffff'); spark(p[0], 0.8, p[1], 0xfff0d0); } break; }
      case 'hurt': { const p = pos(e.id); if (p) rdNum(p[0], p[1], String(e.v), '#ff6b5b'); break; }
      case 'heal': { const p = pos(e.id); if (p && e.v >= 2) rdNum(p[0], p[1], '+' + e.v, '#7dff8a'); break; }
      case 'hhit': {
        if (!e.sh) break;
        const a = pos(e.id), b = pos(e.tgt); if (!a || !b) break;
        if (e.sh === 'rodeur') spawnShot('arrow', a[0], 1.0, a[1], aimAtId(e.tgt, b), 0.25, 0.4);
        else { const c = RD_SHOT[e.sh] || 0xffffff, s = makeGlow(c, 0.9, 1); s.position.set(a[0] - half, 1, a[1] - half); rdGroup.add(s); RD.dying.push({ fly: s, t: 0, T: 0.22, a, b }); }
        break;
      }
      case 'tshot': { const b = pos(e.tgt); if (b) spawnShot('arrow', e.x, 2.4, e.y, aimAtId(e.tgt, b), 0.32, 0.7); break; }
      case 'ghit': {
        if (!e.sh) break;
        const a = pos(e.id), b = pos(e.tgt); if (!a || !b) break;
        if (e.sh === 'arch') spawnShot('arrow', a[0], 1.0, a[1], aimAtId(e.tgt, b), 0.25, 0.4);
        else { const s2 = makeGlow(0xff7a2a, 0.8, 1); s2.position.set(a[0] - half, 1, a[1] - half); rdGroup.add(s2); RD.dying.push({ fly: s2, t: 0, T: 0.24, a, b }); }
        break;
      }
      case 'dodge': { const p = pos(e.id); if (p) rdNum(p[0], p[1], 'esquive', '#9fd8ff'); break; }
      case 'die': burst(e.x, e.y, 0.4, e.big ? 0xff7a3a : 0xbfb8a8, e.big ? 10 : 5); if (e.big) shake(0.25); break;
      case 'loot': { const p = pos(e.id); if (p) rdNum(p[0], p[1], '−' + e.n + ' ' + RES_LABEL[e.r].toLowerCase(), '#ffb347', true); break; }
      case 'drop': rdNum(e.x, e.y, e.n + ' ' + RES_LABEL[e.r].toLowerCase() + ' repris', '#7dff8a', true); for (let i = 0; i < 6; i++) spark(e.x + (Math.random() - 0.5) * 0.6, 0.4 + Math.random(), e.y + (Math.random() - 0.5) * 0.6, 0xffd27a); break;
      case 'escape': if (e.n) rdNum(e.x, e.y, 'enfui avec ' + e.n + ' ' + RES_LABEL[e.r].toLowerCase(), '#ff8a5a', true); break;
      case 'break': debris(e.x, e.y, e.kind === 'tower' ? 2 : 1, false, e.kind === 'tower' ? 18 : 9); dustRing(e.x, e.y, 0.6); shake(0.2); break;
      case 'trap':
        if (e.t === 'piege') { burst(e.x, e.y, 0.2, 0x9a9488, 6); for (let i = 0; i < 5; i++) spark(e.x + (Math.random() - 0.5) * 0.6, 0.3, e.y + (Math.random() - 0.5) * 0.6, 0xff5a3c); rdNum(e.x, e.y, 'piège !', '#ffd23f', true); }
        else { wave(e.x, e.y, 0xd8c08a, 1.1, 0.6); rdNum(e.x, e.y, 'filet !', '#ffd23f', true); }
        break;
      case 'ko': wave(e.x, e.y, 0xffe08a, 1.2, 0.6); rdNum(e.x, e.y, 'à terre', '#ffd27a', true); break;
      case 'heart': { const H = st.S[st.hall]; wave(H.x, H.y, 0xff3a2a, 3.5, 0.9); shake(0.3); rdNum(H.x, H.y, 'La halle est pillée !', '#ff6b5b', true); break; }
      case 'lilou': { const C = st.S[st.ch]; if (C) { wave(C.x, C.y, 0xff7ab8, 2.5, 0.9); rdNum(C.x, C.y, 'Lilou a peur !', '#ff9ad0', true); } break; }
      case 'spawn': smokeAt(e.x - half, 0.3, e.y - half, true); dustRing(e.x, e.y, 0.3); break;
    }
  }
  function rdTick(dt, tNow) {
    for (const n of RD.nums) if (n.on) { n.t += dt; n.sp.position.y += dt * 1.0; n.sp.material.opacity = Math.max(0, 1 - Math.pow(n.t / 1.1, 2)); if (n.t > 1.1) { n.on = false; n.sp.visible = false; } }
    for (const d of RD.dying) {
      d.t += dt;
      if (d.fly) { const k = Math.min(1, d.t / d.T); d.fly.position.set(d.a[0] + (d.b[0] - d.a[0]) * k - half, 1, d.a[1] + (d.b[1] - d.a[1]) * k - half); if (k >= 1) { d.done = true; rdGroup.remove(d.fly); d.fly.material.dispose(); burst(d.b[0], d.b[1], 0.8, 0xffd0a0, 3); } continue; }
      const U = d.r.g.userData; if (U.mixer) U.mixer.update(dt);
      if (d.t > 1.5) { const k = Math.max(0, 1 - (d.t - 1.5) / 0.5); d.r.g.scale.setScalar(k); if (k <= 0) { d.done = true; rdGroup.remove(d.r.g); } }
    }
    RD.dying = RD.dying.filter(d => !d.done);
    for (const r of RD.portals) animPortal(r, dt, tNow);
  }

  /* ---------- boucle ---------- */
  let lastFrame = 0, emitClock = 0, emberClock = 0;
  const camQ = new THREE.Quaternion();
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden || !ok) return;
    if (ts - lastFrame < 30) return;
    const raw = (ts - (lastFrame || ts)) / 1000, dt = Math.min(0.1, raw); lastFrame = ts;
    if (raw > 0 && raw < 1) fpsAvg += (1 / raw - fpsAvg) * 0.03;      // images par seconde (moyenne glissante, pour le conseil « graphismes légers »)
    const tNow = ts / 1000;
    if (frameHook) frameHook(dt, tNow);
    updateCamera(dt);
    camQ.copy(camera.quaternion);
    for (const [, bar] of wallBars) bar.quaternion.copy(camQ);
    if (waterNormal && waterMesh.visible) { waterNormal.offset.x = (tNow * 0.012) % 1; waterNormal.offset.y = (tNow * 0.007) % 1; }
    if (!DJ) for (const [, r] of blds) {
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
    if (emitClock > 0.55 && !DJ) {
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
    if (!DJ) stepPeople(dt, tNow);
    if (!DJ) for (const [, r] of blds) {
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
    if (DJ) djTick(dt, tNow);
    if (RD) rdTick(dt, tNow);
    if (portalGroup.visible) for (const r of portals.values()) animPortal(r, dt, tNow);
    renderer.render(scene, camera);
  }

  return {
    setPeople, pickPerson, setSeason, setLight, fps: () => fpsAvg,
    init, ok: () => ok, resize, resetCamera, setBuildings, clearBuildings, setBldHp, bldInfo, aimAt, select, ghost, showZone, showRanges,
    syncUnits, clearUnits, spawnShot, burst, pickGround, pickBuilding, focus, setPointerMap, setMood, loadModels, modelsReady: () => LIB.ok,
    debris, wave, spark, shake, dustRing, powerFx, volley, unitPower, renderThumbs, panOf, toScreen,
    _ground: () => groundCanvas && groundCanvas.toDataURL('image/jpeg', 0.8),
    _bench: () => { const t0 = performance.now(); paintBase(biome); const t1 = performance.now(); paintGround(lastGroundItems); return { base: Math.round(t1 - t0), ground: Math.round(performance.now() - t1) }; },
    _fx: () => ({ flames: flames.length, burning: [...blds.values()].filter(r => r.burn).length, people: people.size, mood, biome, m2: Object.keys(LIB.m2).length, light, pr: renderer ? renderer.getPixelRatio() : 0, fps: Math.round(fpsAvg) }),
    onFrame: f => { frameHook = f; }, onTap: f => { tapHook = f; },
    dj: { enter: djEnter, exit: djExit, sync: djSync, fx: djFx, active: () => !!DJ },
    setPortals, raid: { enter: rdEnter, exit: rdExit, sync: rdSync, fx: rdFx, active: () => !!RD },
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
    tip: (d, t) => chime(d, [1318, 1760], t, 0.1, 0.045),
    /* l'histoire : la berceuse de Brahms (domaine public) en boîte à musique, le rire de Lilou, le ronron de Sukhoï */
    berceuse: (d, t) => {
      const N = [[76, .5], [76, .5], [79, 2], [76, .5], [76, .5], [79, 2], [76, .5], [79, .5], [84, 1], [83, 1.5], [81, .5], [81, 1], [79, 1], [74, .5], [76, .5], [77, 1], [74, 1], [74, .5], [76, .5], [77, 2]];
      let x = t; for (const [m, b] of N) { const f = mtof(m); tone(d, 'sine', f, f, x, 0.004, 0.04, 0.9); tone(d, 'sine', f * 2.76, f * 2.76, x, 0.002, 0.012, 0.3); x += b * 0.32; }
    },
    giggle: (d, t) => { for (let i = 0; i < 5; i++) { const f = 820 + i * 60 + Math.random() * 80; tone(d, 'triangle', f, f * 1.35, t + i * 0.09, 0.008, 0.05, 0.06); } },
    purr: (d, t) => { for (let i = 0; i < 6; i++) { hiss(d, 'lowpass', 240, 0.8, t + i * 0.2, 0.04, 0.09, 0.14); tone(d, 'sine', 48, 42, t + i * 0.2, 0.03, 0.05, 0.14); } },
    whoosh: (d, t, p) => { hiss(d, 'bandpass', 500, 1.4, t, 0.03, 0.14, 0.24, p, 2200); },
    recruit: (d, t) => { drum(d, t, 0.26, 'tom'); drum(d, t + 0.18, 0.2, 'tap'); horn(d, [55, 62], t + 0.3, 0.18, 0.08); },
    promote: (d, t) => { horn(d, [57, 61, 64], t, 0.12, 0.09); chime(d, [1318, 1760], t + 0.36, 0.06, 0.07); },
    combo: (d, t, p) => { clink(d, t, 0.12, p); tone(d, 'triangle', 392, 784, t, 0.003, 0.07, 0.12, p); chime(d, [1568, 2349], t + 0.05, 0.05, 0.05); },
    storm: (d, t, p) => { tone(d, 'sine', 62, 36, t, 0.04, 0.3, 0.8, p); hiss(d, 'bandpass', 520, 1.3, t, 0.12, 0.2, 0.9, p, 2400); for (let i = 0; i < 5; i++) knock(d, t + 0.1 + i * 0.11, 260 + i * 70, 0.1, p); },
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

/* ===================== DONJONS : interface (entrée, joystick, compétences, bilan) =====================
   En solo, le combat tourne sur le téléphone (20 pas par seconde) ; à deux, sur celui de l'hôte (l'invitée affiche et envoie ses commandes).
   Les Profondeurs : un étage après l'autre, avec à chaque fin d'étage le choix de descendre ou de remonter.
   Le bilan est enregistré au retour au village. Ce fichier ne fait que définir des fonctions : l'application (p4_app) les appelle. */
let dj = null;
const DJ_IC = {
  sword: '<svg viewBox="0 0 24 24"><path d="M14.5 3H21v6.5L10.7 19.8l-2.1-2.1L18.4 8V5.6H16L6.3 15.4l-2.1-2.1z" fill="currentColor"/><path d="m3 17.6 3.4 3.4M6.6 14.6l2.8 2.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" fill="currentColor"/><path d="M12 6v12" stroke="#fff" stroke-opacity=".35" stroke-width="1.6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.6z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/></svg>',
  feather: '<svg viewBox="0 0 24 24"><path d="M20.5 3.5C12 3.5 6 9 5.5 17.5l-2 3 1.4.8 1.8-2.9c8.5-.6 13.8-6.5 13.8-14.9z" fill="currentColor"/><path d="M7.5 16.5 15 9" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M4 20 18 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M13 4.5h6.5V11z" fill="currentColor"/><path d="M4 16v4h4M6.5 14.5 4 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 2.5c1 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.6-5.5.2 1.8 1 2.9 2.2 3.4-.4-3.3.1-6.2.7-8.9z" fill="currentColor"/></svg>',
  snow: '<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9 4.5l3 2.4 3-2.4M9 19.5l3-2.4 3 2.4"/></g></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 2.8c3.6 4.6 6.5 8.3 6.5 12a6.5 6.5 0 0 1-13 0c0-3.7 2.9-7.4 6.5-12z" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="currentColor"/><circle cx="12" cy="12" r="3.2" fill="#fff" opacity=".7"/></svg>',
  heart: '<svg viewBox="0 0 20 20"><path d="M10 17.2S2.5 12.6 2.5 7.4C2.5 5 4.3 3.2 6.6 3.2c1.5 0 2.7.8 3.4 2 .7-1.2 1.9-2 3.4-2 2.3 0 4.1 1.8 4.1 4.2 0 5.2-7.5 9.8-7.5 9.8z" fill="currentColor"/></svg>',
  paw: '<svg viewBox="0 0 24 24"><g fill="currentColor"><ellipse cx="12" cy="16" rx="5" ry="4.2"/><ellipse cx="6" cy="10" rx="2" ry="2.6"/><ellipse cx="18" cy="10" rx="2" ry="2.6"/><ellipse cx="9.3" cy="6.3" rx="2" ry="2.6"/><ellipse cx="14.7" cy="6.3" rx="2" ry="2.6"/></g></svg>',
  leaf: '<svg viewBox="0 0 24 24"><path d="M20 3C9 3 4 8.5 4 15c0 2 .6 3.7 1.4 5L9 16.4C12.3 13 15 11 18 9.6 14.6 12 12 14.4 9.6 18c1 .5 2.1.8 3.4.8C19 18.8 21 12 20 3z" fill="currentColor"/></svg>',
  skull: '<svg viewBox="0 0 24 24"><path d="M12 2.5c4.7 0 8 3.3 8 7.6 0 2.5-1.2 4.4-3 5.5V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19v-3.4c-1.8-1.1-3-3-3-5.5 0-4.3 3.3-7.6 8-7.6z" fill="currentColor"/><circle cx="8.8" cy="11" r="2" fill="#000" opacity=".55"/><circle cx="15.2" cy="11" r="2" fill="#000" opacity=".55"/></svg>',
  roll: '<svg viewBox="0 0 24 24"><path d="M19.6 12.2a7.6 7.6 0 1 1-2.3-5.6" stroke="currentColor" stroke-width="2.7" fill="none" stroke-linecap="round"/><path d="M21 3.2v6.4h-6.4z" fill="currentColor"/></svg>',
  potion: '<svg viewBox="0 0 24 24"><path d="M9.5 2.5h5v2h-1v4.2c3 1 5 3.6 5 6.8a6.5 6.5 0 0 1-13 0c0-3.2 2-5.8 5-6.8V4.5h-1z" fill="currentColor"/><path d="M6.6 14h10.8a5.4 5.4 0 0 1-10.8 0z" fill="#fff" opacity=".35"/></svg>',
};
const djIco = k => `<span class="ic">${DJ_IC[k] || ''}</span>`;
const DJ_SK_ICON = { charge: 'sword', tourbillon: 'sword', cri: 'shield', marteau: 'bolt', bouclier: 'shield', consecration: 'star', roulade: 'feather', pluie: 'arrow', percant: 'arrow', boule: 'flame', nova: 'snow', tp: 'feather', ombre: 'feather', poison: 'drop', fumee: 'eye', lumiere: 'heart', chatiment: 'bolt', priere: 'heart', ours: 'paw', loup: 'paw', racines: 'leaf', squelettes: 'skull', drain: 'drop', cadavre: 'skull' };

/* ---------- le menu Donjon : la mine, la crypte (dès le niveau 3), les Profondeurs (dès le niveau 5) ---------- */
const DJ_OPEN = { mine: 1, crypte: 3, prof: 5 };
const djThemeThe = th => th === 'prof' ? 'les Profondeurs' : (DJ_THEMES[th] || DJ_THEMES.mine).the;
function sheetDonjon() {
  const v = me, hh = activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p><button class="btn primary" data-act="heroForm">Créer mon héros</button>';
  const top = Math.max(1, hh.dj || 1), pick = Math.min(top, Math.max(1, +sheetArg || top));
  const lvls = []; for (let l = Math.max(1, top - 5); l <= top; l++) lvls.push(l);
  const pk = partnerId(v), pname = pk ? v.members[pk].name : '', ph = pk ? activeHero(v, pk) : null, on = pk && isOnline(pk);
  const btns = (th, k, label) => `<div class="row"><button class="btn primary grow" data-act="djGo" data-th="${th}" data-k="${k}">${djIco('sword')}Seul${label}</button>
    ${pk && ph ? `<button class="btn grow${on ? ' primary' : ' off'}" data-act="djInvite" data-th="${th}" data-k="${k}"${on ? '' : ' disabled'}>${djIco('shield')}À deux</button>` : ''}</div>`;
  const locked = th => `<p class="note">${djIco('star')} S’ouvre quand ${esc(hh.name)} aura vaincu la mine au niveau ${DJ_OPEN[th] - 1}.</p>`;
  let h = `<div class="item feature"><div class="head"><b class="row">${ico('crown', 'c-tro')}${esc(hh.name)}</b><small>${esc(heroLine(hh))}</small></div>
    <p>${heroesOf(v, uid).length > 1 ? 'C’est ton héros actif. Pour en envoyer un autre, choisis-le dans le menu Héros.' : 'C’est lui qui part à l’aventure.'}${hh.sp ? ` <b>${hh.sp} point${hh.sp > 1 ? 's' : ''} de compétence à dépenser</b> (menu Héros).` : ''}</p>
    ${pk && ph ? `<p class="note">${on ? 'À deux avec ' + esc(pname) + ' (' + esc(ph.name) + ') : les monstres sont plus solides, chacun gagne toute l’expérience, et vos combos font mal.' : 'Pour partir à deux, ' + esc(pname) + ' doit avoir le jeu ouvert en même temps que toi.'}</p>` : ''}</div>`;
  h += sourceEntryHTML() + crownEntryHTML(hh);
  h += `<div class="sec"><h4>Niveau des donjons</h4><div class="row djlv">${lvls.map(l => `<button class="btn small${l === pick ? ' primary' : ''}" data-act="sheet" data-s="donjon" data-k="${l}" aria-pressed="${l === pick}">Niveau ${l}</button>`).join('')}</div>
    <p class="note">Niveau ${pick} : conseillé pour un héros de niveau ${pick}${hh.lvl < pick ? ' (le tien est plus faible : prudence)' : ''}. Chaque victoire ouvre le niveau suivant.</p></div>`;
  h += `<div class="sec"><h4>La mine des gobelins</h4><div class="item"><p>Gobelins, archers, chamans qui soignent et trolls, avec le chef troll au fond. Récompenses : expérience, or, pierre, bois et objets (le chef troll laisse parfois une pièce de sa tenue).</p>${btns('mine', pick, ' (niveau ' + pick + ')')}</div></div>`;
  h += `<div class="sec"><h4>La crypte des rois</h4><div class="item"><p>Squelettes, goules rapides, spectres qui esquivent, nécromants qui relèvent les morts, golems d’os ; au fond, le roi squelette et sa tempête d’os (et parfois une pièce de ses atours).</p>${top >= DJ_OPEN.crypte ? btns('crypte', pick, ' (niveau ' + pick + ')') : locked('crypte')}</div></div>`;
  h += `<div class="sec"><h4>Les Profondeurs</h4><div class="item"><p>Des étages sans fin, de plus en plus durs : la mine puis la crypte, un boss tous les 5 étages (et la panoplie de l’abîme). À la fin de chaque étage, tu choisis : descendre plus bas, ou remonter avec tout le butin.${hh.deep ? ' Record de ' + esc(hh.name) + ' : <b>' + hh.deep + ' étage' + (hh.deep > 1 ? 's' : '') + '</b>.' : ''}</p>${top >= DJ_OPEN.prof ? btns('prof', hh.lvl, ' (départ niveau ' + hh.lvl + ')') : locked('prof')}</div></div>`;
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>Pose le pouce sur la gauche de l’écran pour te déplacer. Ton héros attaque tout seul le monstre le plus proche (les soigneurs d’abord).</li>
    <li>À droite : tes compétences et ta potion. Une compétence se recharge après usage.</li>
    <li>Le bouton « Roulade » (la flèche qui tourne) : un bond dans la direction de ton pouce, intouchable un instant (parfait pour sortir d’un cercle rouge ou passer un piège). Il revient toutes les 4 secondes.</li>
    <li>En entrant dans une salle, les grilles se ferment jusqu’à la fin des vagues de monstres. Entre deux salles, ton héros reprend son souffle.</li>
    <li>Les boss préviennent avant de frapper : sors des cercles rouges et écarte-toi des charges.</li>
    <li>À deux : une compétence marque le monstre touché ; si l’autre le frappe, c’est un combo (+50 %). Pareil sur un monstre étourdi, gelé ou enraciné par l’autre. Un héros tombé se relève si l’autre reste 3 secondes à côté.</li>
    <li>En chemin : des coffres, l’autel des anciens rois, et parfois un prisonnier à délivrer, qui rejoindra le village.</li>
    <li>Défaite ou fuite : on garde la moitié de l’expérience et du butin.</li></ul></div>`;
  return h;
}

/* ---------- invitation à deux : v2/live/{village}/room ---------- */
let djLive = null, djLobby = null, liveUnsub = null;
const liveRef = k => db.doc(ROOT + 'live/' + vid + (k ? '/' + k : ''));
function djLiveWatch(id) {
  if (liveUnsub) { liveUnsub(); liveUnsub = null; }
  djLive = null;
  liveUnsub = db.doc(ROOT + 'live/' + id + '/room').onSnapshot(s => onLiveRoom(s.exists ? s.data() : null), () => {});
}
function onLiveRoom(r) {
  djLive = r;
  const fresh = r && now() - (r.t || 0) < 120000;
  /* On m'invite */
  if (r && r.st === 'wait' && r.host !== uid && fresh && !dj && !djLobby) {
    if (!(modal && modal.kind === 'djinv')) { modal = { kind: 'djinv' }; SND.sfx('invite'); }
  } else if (modal && modal.kind === 'djinv') { modal = null; if (!dj && !(r && r.st === 'go' && r.guest === uid)) toast('L’invitation au donjon n’est plus valable.'); }
  /* J'ai invité */
  if (djLobby && !dj) {
    if (!r) { djLobby = null; if (modal && modal.kind === 'djwait') modal = null; }
    else if (r.host === uid && r.st === 'go' && r.guest) { djLobby = null; modal = null; djBeginDuo('host', r); }
    else if (r.host === uid && r.st === 'no') { const pk = partnerId(me); djLobby = null; modal = null; liveRef().delete().catch(() => {}); toast(((pk && me.members[pk].name) || 'Ta partenaire') + ' ne peut pas venir pour l’instant.'); }
  }
  /* En pleine partie à deux, en invitée : l'hôte a arrêté (ou a disparu pendant le choix de fin d'étage) */
  if (dj && dj.duo && dj.duo.role === 'guest' && !r && (!dj.st.over || dj.st.over === 'floor')) djLost();
  renderAll();
}
const djTheme = th => th === 'crypte' || th === 'prof' || th === 'portail' || th === 'source' ? th : 'mine';
async function djInvite(lvl, th, pi) {
  if (!me || dj || djLobby) return;
  th = djTheme(th); pi = pi | 0;
  if (th === 'portail' && !djPortalOk(pi)) { toast(pi < 0 ? 'La faille vers l’abîme s’est refermée.' : 'Ce portail est déjà refermé.'); return; }
  const hh = activeHero(me, uid), pk = partnerId(me); if (!hh || !pk) return;
  if (!isOnline(pk)) { toast(me.members[pk].name + ' n’est pas connecté·e en ce moment.'); return; }
  if (!activeHero(me, pk)) { toast(me.members[pk].name + ' n’a pas encore de héros.'); return; }
  lvl = th === 'prof' ? hh.lvl : th === 'portail' ? raidLevel(me) : Math.max(1, Math.min(hh.dj || 1, lvl | 0 || 1));
  const seed = hash((Math.floor(now()) ^ hashStr(hh.id + 'duo')) >>> 0) || 1;
  djLobby = { lvl, seed, th, pi };
  try {
    await Promise.all([liveRef('h2g').delete(), liveRef('g2h').delete()]).catch(() => {});   // rien d'une ancienne partie
    const r = await liveRef('room').transact(cur => {
      if (cur && cur.st === 'wait' && cur.host !== uid && now() - (cur.t || 0) < 120000) return undefined;   // elle m'invite déjà
      return { host: uid, hname: myName(), hhid: hh.id, lvl, seed, th, pi, t: now(), st: 'wait', pv: DJ_PV };
    });
    if (!r.committed) { djLobby = null; onLiveRoom(djLive); return; }
    liveRef().onDisconnectRemove();
    closeSheet(true); modal = { kind: 'djwait' }; renderAll();
  } catch (e) { djLobby = null; toast(e && e.code === 'not_granted' ? 'Le serveur refuse : les règles de la base ne sont pas encore à jour.' : 'L’invitation n’est pas partie. Réessaie.'); }
}
function djCancelInvite() { djLobby = null; modal = null; liveRef().delete().catch(() => {}); renderAll(); }
async function djAnswer(yes) {
  const hh = activeHero(me, uid);
  if (yes && !hh) { toast('Crée d’abord ton héros.'); return; }
  let bad = false;
  try {
    const r = await liveRef('room').transact(cur => {
      if (!cur || cur.st !== 'wait' || cur.host === uid) return undefined;
      if (cur.pv !== DJ_PV) { bad = true; return Object.assign({}, cur, { st: 'no' }); }
      return yes ? Object.assign({}, cur, { st: 'go', guest: uid, ghid: hh.id, gt: now() }) : Object.assign({}, cur, { st: 'no' });
    });
    modal = null;
    if (bad) toast('Vos deux jeux n’ont pas la même version : fermez et rouvrez l’appli tous les deux.');
    else if (yes && r.committed && r.data && r.data.guest === uid) djBeginDuo('guest', r.data);
    else if (yes) toast('L’invitation n’est plus valable.');
    renderAll();
  } catch (e) { modal = null; toast('Ça n’a pas marché. Réessaie.'); renderAll(); }
}
function djInvHTML() {
  const r = djLive; if (!r) return '';
  const hh = activeHero(me, uid), host = me.heroes[r.hhid];
  return `<p class="eyebrow">Donjon à deux</p><h2>${esc(r.hname || 'Ton partenaire')} t’appelle !</h2>
    <p>${esc(host ? host.name : 'Son héros')} part dans ${djThemeThe(r.th)} (${r.th === 'prof' ? 'départ niveau ' + r.lvl : 'niveau ' + r.lvl}) et voudrait que ${esc(hh ? hh.name : 'ton héros')} l’accompagne.</p>
    <div class="row"><button class="btn grow" data-act="djNo">Pas maintenant</button><button class="btn primary grow" data-act="djYes">${djIco('sword')}J’arrive !</button></div>`;
}
function djWaitHTML() {
  const pk = partnerId(me);
  return `<p class="eyebrow">Donjon à deux</p><h2>En attente…</h2><p>${esc(pk ? me.members[pk].name : 'Ta partenaire')} reçoit ton invitation sur son téléphone.</p>
    <button class="btn" data-act="djCancel">Annuler</button>`;
}

/* ---------- entrée et sortie ---------- */
/* Un portail démoniaque encore ouvert ? (on ne referme pas deux fois le même) */
const djPortalOpen = pi => { const R = me && me.raid; return !!(R && R.p && R.p[pi] && R.cl && !R.cl[pi]); };
/* pi < 0 : la faille vers l'abîme (la quête de la couronne, quand le morceau du portail manque encore) */
const djPortalOk = pi => (pi < 0 ? crownRift() : djPortalOpen(pi));
function djBegin(lvl, th, pi) {
  if (!me || dj) return;
  const hh = activeHero(me, uid); if (!hh) { toast('Crée d’abord ton héros.'); return; }
  th = djTheme(th); pi = pi | 0;
  if ((hh.dj || 1) < (DJ_OPEN[th] || 1)) { toast('Pas encore ouvert.'); return; }
  if (th === 'source') {
    if (me.lilou) { toast('Lilou est déjà au village : la Source du Mal est tarie.'); return; }
    const seed = hash((Math.floor(now()) ^ hashStr(hh.id + 'source')) >>> 0) || 1, d = genDungeon(seed, 1, 'source');
    djRun(djStart(d, [hh], { seed }), 1, seed, hh.id, null);
    return;
  }
  const dmgMul = lilouMul(me);         // l'humeur de Lilou : les monstres frappent plus ou moins fort
  if (th === 'portail') {
    if (!djPortalOk(pi)) { toast(pi < 0 ? 'La faille vers l’abîme s’est refermée.' : 'Ce portail est déjà refermé.'); return; }
    const L = raidLevel(me), seed = hash((Math.floor(now()) ^ hashStr(hh.id + 'portail')) >>> 0) || 1, d = genDungeon(seed, L, 'portail');
    djRun(djStart(d, [hh], { seed, dmgMul }), L, seed, hh.id, null);
    dj.pi = pi;
    toast(pi < 0 ? 'La faille vers l’abîme, niveau ' + L + '. Au fond, le gardien du portail et ' + crownName(me.crown.cy, 2) + '.' : 'Le portail démoniaque, niveau ' + L + '. Au fond, son gardien : bats-le et le portail se refermera.');
    return;
  }
  const seed = hash((Math.floor(now()) ^ hashStr(hh.id)) >>> 0) || 1;
  if (th === 'prof') {
    const start = hh.lvl, d = djFloor(seed, 1, start);
    djRun(djStart(d, [hh], { seed: d.seed, dmgMul }), start, seed, hh.id, null, djNewRun(start));
    toast('Les Profondeurs, étage 1. Descends aussi loin que tu l’oses !');
    return;
  }
  lvl = Math.max(1, Math.min(hh.dj || 1, lvl | 0 || 1));
  const d = genDungeon(seed, lvl, th);
  djRun(djStart(d, [hh], { seed, dmgMul }), lvl, seed, hh.id, null);
  toast(DJ_THEMES[th].name + ', niveau ' + lvl + '. ' + (me.lilou ? 'Lilou est ' + lilouMood(me.lilou).name + ' : ' + lilouEffect(lilouMood(me.lilou)) + '.' : 'Pose le pouce à gauche pour bouger : ' + hh.name + ' attaque tout seul.'));
}
const djNewRun = start => ({ start, floor: 1, done: 0, xp: 0, loot: {}, kills: 0, secs: 0, combos: 0, pris: false });
/* À deux : chacun fabrique la même mine (même graine) ; l'hôte fait le combat, l'invitée affiche et envoie ses commandes. */
function djBeginDuo(role, r) {
  if (!me || dj) return;
  const hH = me.heroes[r.hhid], gH = me.heroes[r.ghid];
  if (!hH || !gH) { toast('Héros introuvable : réessayez.'); if (role === 'host') liveRef().delete().catch(() => {}); return; }
  const th = djTheme(r.th), mine = role === 'host' ? r.hhid : r.ghid;
  const d = th === 'prof' ? djFloor(r.seed, 1, r.lvl) : genDungeon(r.seed, r.lvl, th);
  const st = djStart(d, [hH, gH], { seed: d.seed, remote: role === 'host' ? r.ghid : null, dmgMul: lilouMul(me) });
  const duo = { role, mateHid: role === 'host' ? r.ghid : r.hhid, mateName: role === 'host' ? (me.members[r.guest] || {}).name : r.hname, unsub: [],
    snapN: 0, evBuf: [], inLast: null, inAt: performance.now(), done: 0, q: [], qSeq: 0, sendAt: 0, lastSnapAt: performance.now(), snapDt: 150, waitShown: false, gone: false, since: now() - 5000 };
  if (role === 'host') {
    duo.unsub.push(liveRef('g2h').onSnapshot(s => {
      const m = s.exists ? s.data() : null; if (!m || !dj || !dj.duo || (m.t || 0) < dj.duo.since) return;   // pas un message d'une ancienne partie
      if (m.bye) { if (!dj.duo.gone) djMateGone(' est rentré·e au village.'); return; }
      if (m.sd && m.sd !== dj.st.d.seed) return;                                                            // Profondeurs : message de l'étage précédent
      dj.duo.inLast = m; dj.duo.inAt = performance.now();
    }, () => {}));
  } else {
    duo.unsub.push(liveRef('h2g').onSnapshot(s => { const sn = s.exists ? s.data() : null; if (sn && dj && dj.duo && !dj.ended) djGuestSnap(sn); }, () => {}));
    liveRef('g2h').onDisconnectRemove();
  }
  djRun(st, r.lvl, r.seed, mine, duo, th === 'prof' ? djNewRun(r.lvl) : null);
  if (dj && th === 'portail') dj.pi = r.pi | 0;
  toast('À deux dans ' + djThemeThe(th) + ' avec ' + (duo.mateName || 'ton partenaire') + ' ! Restez groupés.');
}
function djRun(st, lvl, seed, hid, duo, run) {
  if (!gl) { toast('Les donjons ont besoin de la 3D, indisponible sur cet appareil.'); return; }
  dj = { st, d: st.d, lvl, seed, hid, duo, run: run || null, acc: 0, inp: { mx: 0, my: 0, sk: -1, pot: false, rl: false }, joy: null, keys: {}, els: {}, ended: false, res: null, nocastT: 0 };
  closeSheet(true); sel = null; selP = null; place = null; modal = null;
  mode = 'donjon';
  V3.dj.enter(st, hid);
  djHudBuild();
  SND.music('battle', 1); SND.sfx('hero');
  renderAll();
}
function djLeave() {
  if (!dj) return;
  if (dj.duo) { for (const u of dj.duo.unsub) u(); if (dj.duo.role === 'host') liveRef().delete().catch(() => {}); }
  V3.dj.exit();
  const el = $('#djHud'); if (el) el.hidden = true;
  dj = null; modal = null; mode = 'home';
  SND.music('village', 1);
  refreshScene(); renderAll();
}
/* Ce que le donjon rapporte à la garnison (orbes, bannière), en une phrase. */
const garGainTxt = res => { const l = (res.orbs || []).map(orbLabel).concat(res.ban ? [banLabel(res.ban) + (res.ban.sold ? ' (réserve pleine : vendue)' : '')] : []); return l.length ? ' Pour la garnison : ' + l.join(', ') + '.' : ''; };
function djBack() {
  if (!dj) return;
  const r = dj.res || djResult(dj.st), hid = dj.hid, name = (me && me.heroes[hid] || {}).name || 'Ton héros';
  const guest = dj.duo && dj.duo.role === 'guest';     // le butin et le prisonnier ne comptent qu'une fois : c'est l'hôte qui les rapporte
  const items = (r.items && r.items[hid]) || [], gems = (r.gems && r.gems[hid]) || {};
  const res = act({ type: 'djEnd', hid, lvl: r.lvl, win: r.win, xp: r.xp, loot: guest ? {} : r.loot, pris: guest ? false : r.pris, theme: r.theme || dj.st.d.theme, deep: r.deep || 0,
    or: guest ? 0 : r.gold || 0, items, gems, pi: dj.pi | 0, gar: guest ? 0 : 1 }, { quiet: true });
  djLeave();
  if (res && res.lilou) { modal = { kind: 'lilou' }; SND.sfx('giggle'); renderAll(); return; }
  /* un morceau de la couronne (ou un joyau) : c'est l'annonce la plus importante ; la scène suivra si un chapitre se termine */
  if (res && res.crown) { SND.sfx('star'); toast(res.crown.done ? (res.crown.cy === 1 ? 'La Couronne de la Montagne est reconstituée !' : 'La couronne brille plus fort : rang ' + res.crown.done.rank + ' !') : cap1(res.crown.name) + (res.crown.cy === 1 ? ' de la couronne' : ' se rallume') + ' (' + res.crown.n + ' sur 4) !'); }
  else if (res && res.up) { toast(name + ' passe au niveau ' + res.lvl + ' ! Point' + (res.up > 1 ? 's' : '') + ' de compétence à dépenser dans le menu Héros.'); SND.sfx('star'); }
  else if (res && res.closed) toast((res.closed.all ? 'Le portail est refermé : pas de raid cette fois !' : 'Le portail est refermé. Il en reste d’autres ouverts (menu Défense).') + garGainTxt(res));
  else if (res && res.pris) toast(res.pris + ' vous attend au village : touchez « Accueillir ».');
  else if (res && ((res.orbs && res.orbs.length) || res.ban)) toast(garGainTxt(res).trim());
  else if (res && res.autoSold) toast('Sac plein : ' + res.autoSold + ' objet' + (res.autoSold > 1 ? 's vendus' : ' vendu') + ' pour ' + res.autoGold + ' or. Fais de la place dans ton sac (menu Héros).');
  else if (res && res.items) toast(res.items + ' objet' + (res.items > 1 ? 's rangés' : ' rangé') + ' dans ton sac (menu Héros).');
  else if (!res) toast('Le retour n’a pas pu être enregistré.');
}
function djEnded() {
  dj.ended = true;
  if (!dj.res) dj.res = (dj.duo && dj.duo.role === 'guest' && dj.st.res) || djFinalRes() || djResult(dj.st);
  const r = dj.res;
  setTimeout(() => { if (!dj) return; SND.sfx(r.win ? 'victory' : 'defeat'); modal = { kind: 'djres' }; renderAll(); }, r.win ? 900 : 1700);
}
/* Bilan final (chez l'hôte ou en solo) : un donjon simple, ou toute la descente des Profondeurs (la victoire, elle, est posée par djAscend). */
function djFinalRes() {
  const st = dj.st;
  if (dj.res || !st.over || st.over === 'floor') return dj.res;
  if (dj.run) djRunLost(); else dj.res = djResult(st);
  return dj.res;
}
/* L'invitée part seule (fuite), ou perd l'hôte : la moitié de ce qui était gagné jusque-là.
   Dans les Profondeurs, si l'étage est terminé, elle garde tout (l'hôte lui envoie le cumul de la descente). */
function djGuestQuit(lost) {
  const st = dj.st, run = dj.run, done = !!run && st.over === 'floor';
  if (run) dj.res = done ? djRunResult(run, true) : djRunResult(run, false, { xp: st.xp || 0, kills: st.kills || 0, secs: Math.round(st.t || 0), loot: {}, combos: st.combos || 0, fled: true });
  else dj.res = { win: false, fled: true, lvl: st.lvl, xp: Math.round((st.xp || 0) * 0.5), loot: {}, kills: st.kills || 0, secs: Math.round(st.t || 0), combos: st.combos || 0, theme: st.d.theme };
  /* ses objets et ses pierres : ceux que l'hôte lui a signalés (toute la descente, dans les Profondeurs) */
  const mine = { [dj.hid]: dj.myItems || [] }, mg = { [dj.hid]: dj.myGems || {} };
  Object.assign(dj.res, { own: true, lost: !!lost, loot: {}, pris: false, gold: 0, items: djHalfItems(mine, done), gems: djHalfGems(mg, done) });
  if (!done) st.over = 'lose';
  if (!lost) liveRef('g2h').set({ bye: 1, t: now() }).catch(() => {});
  for (const u of dj.duo.unsub) u(); dj.duo.unsub = [];
  djEnded();
}
function djLost() { if (dj && !dj.ended) { toast('La connexion avec ' + (dj.duo.mateName || 'ton partenaire') + ' est perdue.'); djGuestQuit(true); } }
function djMateGone(why) {
  const st = dj.st, m = st.heroes.find(h => h.id === dj.duo.mateHid);
  dj.duo.gone = true;
  if (m) { m.gone = true; m.dead = true; m.hp = 0; }
  toast((dj.duo.mateName || 'Ta partenaire') + why + ' Tu continues seul·e.');
  renderAll();
}
const djBossThe = th => 'le ' + ((DJ_BOSSES[(DJ_THEMES[th] || DJ_THEMES.mine).boss] || {}).name || 'boss').toLowerCase();
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
function djResHTML() {
  const r = dj.res || djResult(dj.st), hh = me && me.heroes[dj.hid], duo = dj.duo, mate = duo ? duo.mateName || 'ton partenaire' : '';
  const fromHost = duo && duo.role === 'guest' && !r.own, the = r.prof ? 'les Profondeurs' : djThemeThe(r.theme);
  const title = r.win ? (r.prof ? 'Remontée !' : 'Victoire !') : r.fled ? 'Repli' : 'Défaite…';
  let lead;
  if (r.lost) lead = 'La connexion avec ' + mate + ' est perdue : ' + (r.win ? 'l’étage était fini, tu gardes tout ce qui a été gagné.' : 'tu rentres avec la moitié de l’expérience gagnée.');
  else if (r.win && r.prof) lead = r.own ? 'Tu remontes des Profondeurs : toute l’expérience gagnée est à toi.' : (duo ? 'Vous remontez' : 'Tu remontes') + ' des Profondeurs avec tout le butin.';
  else if (r.win) lead = (duo ? 'Ensemble, vous avez vaincu ' + djBossThe(r.theme) + ' !' : cap1(djBossThe(r.theme)) + ' est vaincu.') + (r.theme === 'portail' ? ' Le portail démoniaque se referme.' : '');
  else if (r.fled) lead = fromHost ? mate + ' a quitté ' + the + ' : vous rentrez avec la moitié de l’expérience.' : 'Tu as quitté ' + the + ' avant la fin : la moitié de l’expérience' + (r.own ? '.' : ' et du butin.');
  else lead = (duo ? 'Vous êtes tombés tous les deux' : 'Ton héros est tombé') + ' : retour au village avec la moitié de l’expérience et du butin.';
  if (r.prof) lead += ' Étages terminés : ' + (r.deep || 0) + '.' + (hh && r.deep > (hh.deep || 0) ? ' Nouveau record !' : '');
  const xpH = hh && hh.race === 'humain' ? Math.round(r.xp * 1.1) : r.xp;
  let up = 0, lv = hh ? hh.lvl : 1, xp = hh ? (hh.xp || 0) + xpH : 0;
  while (hh && lv < HERO_MAX_LVL && xp >= heroXpNeed(lv)) { xp -= heroXpNeed(lv); lv++; up++; }
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0'), loot = r.loot || {}, lootAll = Object.assign({}, loot, r.gold ? { or: r.gold } : {});
  const myItems = (r.items && r.items[dj.hid]) || [], myGems = (r.gems && r.gems[dj.hid]) || {};
  const where = r.prof ? 'Les Profondeurs · départ niveau ' + r.lvl : (DJ_THEMES[r.theme] || DJ_THEMES.mine).name + (r.theme === 'source' ? '' : ' · niveau ' + r.lvl);
  const story = r.theme === 'source' && r.win, word = me && me.lilou && r.theme !== 'source' ? '<p class="lilword">' + lilouFace(lilouMood(me.lilou).k) + '<span><b>Lilou</b> ' + esc(LILOU_WORDS[lilouMood(me.lilou).k]) + '</span></p>' : '';
  return `<p class="eyebrow">${where}${duo ? ' · à deux' : ''}</p><h2>${story ? 'La Source du Mal… ?!' : title}</h2>${story ? sukBubble(SUK.found) : '<p>' + esc(lead) + '</p>'}${word}${crownWinHTML(r)}
    <div class="item"><div class="row split"><b>Expérience</b><span class="chip plus">+${fmtN(xpH)}</span></div>
      ${up ? `<p><b>${esc(hh.name)} passe au niveau ${lv} !</b> ${up > 1 ? up + ' niveaux d’un coup.' : ''} De nouveaux points de compétence l’attendent.</p>` : hh ? `<div class="bar"><i style="width:${Math.min(100, xp / heroXpNeed(lv) * 100).toFixed(0)}%"></i></div>` : ''}
      ${r.own ? '<p class="note">Le butin reste avec ' + esc(mate) + ', qui le rapportera au village.</p>' : `<div class="row split"><b>Butin pour le village</b><span class="chips2">${Object.keys(lootAll).length ? rewChips(lootAll) : '<span class="note">rien</span>'}</span></div>
      ${fromHost && Object.keys(lootAll).length ? '<p class="note">' + esc(mate) + ' le rapporte au village pour vous deux.</p>' : ''}`}
      ${myItems.length ? `<div class="row split"><b>Objets pour ton sac</b><small class="note">${myItems.length}${!r.win ? ' (les meilleurs)' : ''}</small></div>${itemListHTML(myItems, hh)}` : ''}
      ${Object.keys(myGems).length ? `<div class="row split"><b>Pierres précieuses</b><span class="chips2">${Object.keys(myGems).map(k => gemChip(k, myGems[k])).join('')}</span></div>` : ''}
      ${r.pris && !r.own ? '<p><b>Un prisonnier délivré</b> : il vous attendra au village, prêt à s’installer.</p>' : ''}
      <p class="note">${r.kills} ${r.kills > 1 ? 'monstres vaincus' : 'monstre vaincu'}${duo && r.combos ? ' · ' + r.combos + ' combo' + (r.combos > 1 ? 's' : '') : ''} · ${mm} min ${ss}${r.win && (r.theme === 'mine' || r.theme === 'crypte') ? ' · niveau ' + (r.lvl + 1) + ' ouvert' : ''}</p></div>
    <button class="btn primary" data-act="djBack">${story ? 'Ramener Lilou au village' : 'Retour au village'}</button>`;
}
/* ---------- les Profondeurs : fin d'étage, descendre ou remonter ---------- */
/* Chez l'hôte (ou en solo) : l'étage est fini, son bilan rejoint le cumul de la descente, puis on choisit. */
function djFloorDone() {
  const st = dj.st, run = dj.run;
  dj.floorShown = true;
  djRunAdd(run, djResult(st)); run.done = st.d.floor; run.floor = st.d.floor;
  SND.sfx('victory'); modal = { kind: 'djfloor' }; renderAll();
}
/* Chez l'invitée : on attend le choix de l'hôte (le cumul arrive avec ses instantanés). */
function djGuestFloor() {
  dj.floorShown = true;
  SND.sfx('victory'); modal = { kind: 'djfloorwait' }; renderAll();
}
/* Ce qui attend à l'étage suivant, et dans quel état on y arrive (même calcul que djCarry). */
function djNextLine() {
  const st = dj.st, run = dj.run, me2 = st.heroes.find(h => h.id === dj.hid), nx = djFloorCfg(st.d.floor + 1, run.start);
  const hp = me2 ? Math.round((me2.dead ? 0.3 : Math.min(1, me2.hp / me2.hpMax + 0.25)) * 100) : 0, pot = me2 ? me2.pot : 0;
  return `Étage ${st.d.floor + 1} : ${DJ_THEMES[nx.theme].name.toLowerCase()}, monstres de niveau ${nx.lvl}${nx.boss ? ', et ' + djBossThe(nx.theme) + ' au fond' : ''}. Tu y arriveras avec ${hp} % de vie et ${pot} potion${pot > 1 ? 's' : ''}.`;
}
function djFloorHTML() {
  const st = dj.st, run = dj.run;
  return `<p class="eyebrow">Les Profondeurs${dj.duo ? ' · à deux' : ''}</p><h2>Étage ${st.d.floor} terminé !</h2>
    <div class="item"><div class="row split"><b>Gagné jusqu’ici</b><span class="chip plus">+${fmtN(run.xp)} d’expérience</span></div>
      <div class="row split"><b>Butin</b><span class="chips2">${Object.keys(run.loot).length || run.gold ? rewChips(Object.assign({}, run.loot, run.gold ? { or: run.gold } : {})) : '<span class="note">rien encore</span>'}</span></div>
      ${(run.items && run.items[dj.hid] || []).length ? `<div class="row split"><b>Objets trouvés</b><span class="chip">${run.items[dj.hid].length}</span></div>` : ''}
      ${me && crownCan(me, 'prof', run.start, st.d.floor, true) >= 0 ? `<p class="crownnote">${ico('crown', 'c-gold')} ${esc(cap1(crownName(me.crown.cy, 3)))} est à toi : elle rentrera au village, même si tu tombes plus bas.</p>` : ''}
      <p class="note">${djNextLine()} ${dj.duo && !dj.duo.gone ? 'Si vous tombez tous les deux' : 'Si tu tombes'}, ${dj.duo && !dj.duo.gone ? 'vous ne gardez' : 'tu ne gardes'} que la moitié de tout.</p></div>
    <div class="row"><button class="btn grow" data-act="djUp">Remonter (tout garder)</button><button class="btn primary grow" data-act="djDown">${djIco('sword')}Descendre</button></div>`;
}
function djFloorWaitHTML() {
  const run = dj.run;
  return `<p class="eyebrow">Les Profondeurs · à deux</p><h2>Étage ${dj.st.d.floor} terminé !</h2>
    <p>${esc(dj.duo.mateName || 'Ton partenaire')} choisit : descendre plus bas, ou remonter avec tout le butin…</p>
    <div class="item"><div class="row split"><b>Gagné jusqu’ici</b><span class="chip plus">+${fmtN(run.xp)} d’expérience</span></div>${(dj.myItems || []).length ? `<div class="row split"><b>Tes objets</b><span class="chip">${dj.myItems.length}</span></div>` : ''}<p class="note">${djNextLine()}</p></div>
    <button class="btn" data-act="djLeaveFloor">Rentrer au village maintenant (tout garder)</button>`;
}
function djDescend() {
  if (!dj || !dj.run || dj.st.over !== 'floor' || (dj.duo && dj.duo.role === 'guest')) return;
  const st = dj.st, run = dj.run, carry = djCarry(st), n = run.floor + 1;
  let duo = dj.duo;
  if (duo && duo.gone) { for (const u of duo.unsub) u(); liveRef().delete().catch(() => {}); dj.duo = duo = null; }   // l'autre est rentrée : la suite en solo
  const ids = duo ? st.heroes.map(h => h.id) : [dj.hid], heroes = ids.map(id => me.heroes[id]).filter(Boolean);
  if (heroes.length !== ids.length) { toast('Héros introuvable.'); return; }
  const d = djFloor(dj.seed, n, run.start), ns = djStart(d, heroes, { seed: d.seed, remote: duo ? duo.mateHid : null, carry, dmgMul: lilouMul(me) });
  dj.st = ns; dj.d = d; dj.acc = 0; dj.floorShown = false; modal = null; run.floor = n;
  if (duo) { duo.sentFinal = false; duo.inLast = null; duo.inAt = performance.now(); duo.evBuf = []; }
  V3.dj.enter(ns, dj.hid); djHudBuild(); renderAll();
  djFloorToast(d);
}
const djFloorToast = d => toast('Étage ' + d.floor + ' : ' + DJ_THEMES[d.theme].name.toLowerCase() + (d.rooms.some(r => r.kind === 'boss') ? ', et ' + djBossThe(d.theme) + ' vous attend au fond !' : '.'));
function djAscend() {
  if (!dj || !dj.run || dj.st.over !== 'floor' || (dj.duo && dj.duo.role === 'guest')) return;
  dj.res = djRunResult(dj.run, true); dj.st.over = 'win'; modal = null;
  if (dj.duo) dj.duo.sentFinal = false;
  renderAll();
}
/* Fin d'une descente (défaite ou fuite pendant un étage) : la moitié de tout, étage en cours compris. */
function djRunLost() {
  const st = dj.st;
  dj.res = djRunResult(dj.run, false, { xp: st.xp, kills: st.kills, secs: Math.round(st.t), loot: st.loot, combos: st.combos || 0, pris: !!(st.pris && st.pris.freed), fled: !!st.fled, gold: st.gold, items: st.items, gems: st.gems });
}
/* Chez l'invitée : l'hôte est descendu, on fabrique le même étage (même graine), puis l'instantané s'y applique. */
function djGuestFloorGo(sn) {
  const d = djFloor(dj.seed, sn.fl, dj.run.start);
  if (d.seed !== sn.sd) return false;
  const heroes = dj.st.heroes.map(h => me.heroes[h.id]).filter(Boolean);
  if (heroes.length !== dj.st.heroes.length) return false;
  const ns = djStart(d, heroes, { seed: d.seed, dmgMul: lilouMul(me) });
  dj.st = ns; dj.d = d; dj.floorShown = false; dj.run.floor = sn.fl;
  if (modal && modal.kind === 'djfloorwait') modal = null;
  V3.dj.enter(ns, dj.hid); djHudBuild(); renderAll();
  djFloorToast(d);
  return true;
}

/* ---------- l'écran de combat : barre de vie, joystick, boutons ---------- */
function djHudBuild() {
  let el = $('#djHud');
  if (!el) { el = document.createElement('div'); el.id = 'djHud'; el.className = 'djhud'; $('#app').appendChild(el); djBind(el); }
  const h = dj.st.heroes.find(x => x.id === dj.hid), C = CLASSES[h.cls], sk = DJ_SKILLS[h.cls], bt = (dj.st.d.monsters.find(m => m.boss) || {}).type;
  dj.bossN = bt ? DJ_BOSSES[bt].name : '';
  el.innerHTML = `<div class="djtop">
      <div class="glass djme"><span class="crest" style="background:${safeColor(h.col)}">${esc(initial(h.name))}</span>
        <div class="djmet"><b>${esc(h.name)} <small>niv. ${h.lvl}</small></b><div class="djhp"><i id="djHp"></i><em id="djHpT"></em></div></div></div>
      <div class="glass djinfo" id="djInfo"></div>
      <button class="glass chipb djflee" data-act="djFlee">Fuir</button></div>
    ${dj.duo ? '<div class="glass djmate"><b id="djMateN"></b><div class="djhp mate"><i id="djMateHp"></i></div></div>' : ''}
    <div class="glass djboss" id="djBoss" hidden><b>${esc(dj.bossN)}</b><div class="djhp boss"><i id="djBossHp"></i></div></div>
    ${dj.st.d.tuto ? '<div class="djtuto" id="djTuto" hidden></div>' : ''}
    <div class="djjoy" id="djJoy"><p class="djhint" id="djHint">Pose le pouce ici pour te déplacer</p></div>
    <div class="djbase" id="djBase" hidden><div class="djknob" id="djKnob"></div></div>
    <div class="djbtns">${[0, 1, 2].map(i => { const on = h.rank[i] > 0, name = C.skills[i][0]; return `<button class="djsk${on ? '' : ' lock'}" data-djsk="${i}" aria-label="${esc(name)}"${on ? '' : ' disabled'} style="grid-column:${i === 1 ? 3 : 2};grid-row:${i === 2 ? 2 : 1}">
        <span class="djico">${djIco(DJ_SK_ICON[sk[i].id])}</span><span class="djcd" id="djCd${i}"></span><small>${on ? esc(name) : 'niv. ' + SKILL_LVLS[i]}</small></button>`; }).join('')}
      <button class="djsk pot" data-djpot="1" aria-label="Potion" style="grid-column:3;grid-row:2"><span class="djico">${djIco('potion')}</span><span class="djcd" id="djCdP"></span><b class="djn" id="djPot"></b><small>Potion</small></button>
      <button class="djsk roll" data-djroll="1" aria-label="Roulade" style="grid-column:1;grid-row:2"><span class="djico">${djIco('roll')}</span><span class="djcd" id="djCdR"></span><small>Roulade</small></button></div>`;
  dj.els = {};
  el.hidden = false;
}
/* Point touché, dans le repère de l'appli (qui peut être tournée d'un quart de tour). */
function djPt(e) {
  const W = window.innerWidth, H = window.innerHeight, r = applyOrientation.rot || 0;
  return r === 90 ? [e.clientY, W - e.clientX] : r === -90 ? [H - e.clientY, e.clientX] : [e.clientX, e.clientY];
}
/* Joystick (repère de l'écran) → direction dans le donjon (la caméra regarde en biais, à 45°). */
function djJoyVec(jx, jy) { return [0.7071 * (jx - jy), -0.7071 * (jx + jy)]; }
function djBind(el) {
  const R = 52;
  el.addEventListener('pointerdown', e => {
    if (!dj) return;
    const b = e.target.closest('[data-djsk],[data-djpot],[data-djroll]');
    if (b) { e.preventDefault(); if (b.disabled) return; if (b.dataset.djpot) dj.inp.pot = true; else if (b.dataset.djroll) dj.inp.rl = true; else dj.inp.sk = +b.dataset.djsk; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 140); SND.unlock(); return; }
    if (!e.target.closest('#djJoy') || dj.joy) return;
    e.preventDefault(); SND.unlock();
    try { el.setPointerCapture(e.pointerId); } catch (x) { /* rien */ }
    const [x, y] = djPt(e), base = $('#djBase'), hint = $('#djHint');
    dj.joy = { id: e.pointerId, x0: x, y0: y };
    base.hidden = false; base.style.left = x + 'px'; base.style.top = y + 'px'; $('#djKnob').style.transform = '';
    if (hint) hint.hidden = true;
  });
  el.addEventListener('pointermove', e => {
    if (!dj || !dj.joy || e.pointerId !== dj.joy.id) return;
    const [x, y] = djPt(e); let dx = x - dj.joy.x0, dy = y - dj.joy.y0; const L = Math.hypot(dx, dy);
    if (L > R) { dx *= R / L; dy *= R / L; }
    $('#djKnob').style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
    const k = L < 6 ? 0 : 1, [mx, my] = djJoyVec(dx / R * k, -dy / R * k);
    dj.inp.mx = mx; dj.inp.my = my;
  });
  const up = e => { if (!dj || !dj.joy || e.pointerId !== dj.joy.id) return; dj.joy = null; dj.inp.mx = 0; dj.inp.my = 0; const base = $('#djBase'); if (base) base.hidden = true; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
/* Clavier (ordinateur) : flèches ou ZQSD/WASD pour bouger, 1 2 3 pour les compétences, 4 ou P pour la potion, espace ou 5 pour la roulade. */
const DJ_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, 1], w: [0, 1], s: [0, -1], q: [-1, 0], a: [-1, 0], d: [1, 0] };
document.addEventListener('keydown', e => {
  if (!dj || e.target.closest && e.target.closest('input,textarea')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DJ_KEYS[k]) { dj.keys[k] = 1; e.preventDefault(); }
  else if (k === '1' || k === '2' || k === '3') dj.inp.sk = +k - 1;
  else if (k === '4' || k === 'p') dj.inp.pot = true;
  else if (k === ' ' || k === '5') { dj.inp.rl = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => { if (!dj) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; delete dj.keys[k]; });
function djKeyVec() {
  let jx = 0, jy = 0; for (const k in dj.keys) { const v = DJ_KEYS[k]; if (v) { jx += v[0]; jy += v[1]; } }
  const L = Math.hypot(jx, jy); if (!L) return null;
  return djJoyVec(jx / L, jy / L);
}
function djHudUpdate() {
  const st = dj.st, h = st.heroes.find(x => x.id === dj.hid); if (!h) return;
  const E = id => dj.els[id] || (dj.els[id] = document.getElementById(id));
  const set = (id, kind, val) => { const el = E(id); if (!el || el['_' + kind] === val) return; el['_' + kind] = val; if (kind === 'w') el.style.width = val; else if (kind === 'cd') el.style.setProperty('--cd', val); else el.textContent = val; };
  set('djHp', 'w', Math.max(0, h.hp / h.hpMax * 100).toFixed(1) + '%');
  set('djHpT', 't', h.dead ? (dj.duo && !st.over ? (h.rev > 0 ? 'on te relève… ' + Math.round(h.rev / 3 * 100) + ' %' : 'à terre : attends ton allié') : 'à terre') : Math.min(Math.ceil(h.hp), Math.round(h.hpMax)) + ' / ' + Math.round(h.hpMax) + (h.shield > 0 ? ' (+' + Math.round(h.shield) + ')' : ''));
  if (dj.duo) {
    const m = st.heroes.find(x => x.id === dj.duo.mateHid);
    if (m) {
      set('djMateN', 't', (dj.duo.mateName || m.name) + ' · ' + m.name + (m.gone ? ' · partie' : m.dead ? (m.rev > 0 ? ' · relève ' + Math.round(m.rev / 3 * 100) + ' %' : ' · à terre : va la relever !') : ''));
      set('djMateHp', 'w', Math.max(0, m.hp / m.hpMax * 100).toFixed(1) + '%');
    }
  }
  for (let i = 0; i < 3; i++) set('djCd' + i, 'cd', h.rank[i] && h.cd[i] > 0 ? (h.cd[i] / h.cdMax[i] * 360).toFixed(0) + 'deg' : '0deg');
  set('djPot', 't', String(h.pot));
  set('djCdR', 'cd', h.dead ? '360deg' : h.rollCd > 0 ? (h.rollCd / DJ_ROLL.cd * 360).toFixed(0) + 'deg' : '0deg');
  set('djCdP', 'cd', h.pot <= 0 ? '360deg' : h.potT > 0 ? (h.potT * 360).toFixed(0) + 'deg' : '0deg');
  const pr = djProgress(st), fl = st.d.floor ? 'Étage ' + st.d.floor + ' · ' : '', bn = 'le ' + (dj.bossN || 'boss').toLowerCase();
  set('djInfo', 't', fl + (st.exit ? (st.d.floor ? 'Passage ouvert : rejoins la lumière' : 'Sortie ouverte : rejoins la lumière') : pr.boss ? cap1(bn) : pr.fighting ? `Salle ${pr.done + 1} sur ${pr.total} · vague ${pr.wave} sur ${pr.waves}` : pr.done >= pr.total && dj.bossN ? 'Au fond : ' + bn : `Salles nettoyées : ${pr.done} sur ${pr.total}`));
  const bb = E('djBoss'); if (bb && bb.hidden === !!pr.boss) bb.hidden = !pr.boss;
  if (st.d.tuto) djTutoRender();
  if (pr.boss) set('djBossHp', 'w', Math.max(0, pr.boss.hp / pr.boss.hpMax * 100).toFixed(1) + '%');
}
const DJ_SFX_ATK = { rodeur: 'shoot', mage: 'bolt', pretre: 'bolt', druide: 'shoot', necro: 'bolt' };
function djEvents(st) {
  if (dj.duo && dj.duo.role === 'host') { for (const e of st.ev) dj.duo.evBuf.push(e); if (dj.duo.evBuf.length > 120) dj.duo.evBuf.splice(0, dj.duo.evBuf.length - 120); }
  const crypt = st.d.theme === 'crypte', portal = st.d.theme === 'portail', source = st.d.theme === 'source';
  for (const e of st.ev) {
    if (gl) V3.dj.fx(e, st);
    const mine = e.id === dj.hid;
    if (source && (e.k === 'tuto' || e.k === 'tutoOk' || e.k === 'saved')) djTutoEvent(e);
    switch (e.k) {
      case 'atk': if (mine) { const h = st.heroes.find(x => x.id === e.id); SND.sfx(h && DJ_SFX_ATK[h.cls] && !h.form ? DJ_SFX_ATK[h.cls] : 'chop'); } break;
      case 'die': SND.sfx(e.boss ? 'collapse' : 'death'); break;
      case 'cast': if (mine) SND.sfx('power'); break;
      case 'nocast': if (mine && performance.now() - dj.nocastT > 1200) { dj.nocastT = performance.now(); toast('Pas de cible à portée pour cette compétence.'); } break;
      case 'potion': if (mine) SND.sfx('built'); break;
      case 'roll': if (mine && !(dj.duo && dj.duo.role === 'guest')) SND.sfx('whoosh'); break;
      case 'chest': SND.sfx('coin'); toast('Coffre : ' + rewTxt(e.got) + '.'); break;
      case 'loot': toast((crypt ? 'Trésor du roi : ' : portal || source ? 'Trésor du gardien : ' : 'Butin du chef : ') + rewTxt(e.got) + '.'); break;
      case 'altar': SND.sfx('star'); toast('Autel des anciens rois · ' + DJ_BLESS[e.b] + ', jusqu’à la sortie.'); break;
      case 'free': SND.sfx('invite'); toast('Prisonnier délivré ! Il vous attendra au village.'); break;
      case 'lock': SND.sfx(e.boss ? 'alarm' : 'wallhit'); if (e.boss && !source) toast(crypt ? 'Le roi squelette ! Quand des cercles rouges s’allument sous vos pieds, sortez-en vite.' : portal ? 'Le gardien du portail ! Une pluie de feu s’annonce par des cercles rouges : sortez-en vite.' : 'Le chef troll ! Sors du cercle rouge et écarte-toi de sa charge.'); break;
      case 'wavecome': toast((crypt ? 'D’autres morts sortent de leurs tombeaux…' : portal ? 'D’autres diablotins jaillissent des flammes…' : 'D’autres monstres sortent des galeries…') + ' (vague ' + e.n + ' sur ' + e.of + ')'); break;
      case 'clear': SND.sfx('star'); if (e.boss && !source) toast(cap1('le ' + (dj.bossN || 'boss').toLowerCase()) + ' est vaincu ! ' + (st.d.floor ? 'Le passage est ouvert.' : 'La sortie est ouverte.')); break;
      case 'slam': case 'boom': SND.sfx('boom'); break;
      case 'storm': SND.sfx('storm'); break;
      case 'summon': if (e.boss) SND.sfx('alarm'); break;
      case 'combo': if (performance.now() - (dj.comboT || 0) > 250) { dj.comboT = performance.now(); SND.sfx('combo'); } break;
      case 'item': if (mine) { SND.sfx(e.r >= 3 || e.set ? 'star' : 'coin'); if (e.r >= 2 || e.set) toast((e.set ? 'Pièce d’ensemble' : 'Objet ' + RARITY[e.r].name.toLowerCase()) + ' : ' + SLOT_ART[e.sl] + (e.r >= 4 ? ' légendaire !!!' : ' !')); } break;
      case 'gem': if (mine) { SND.sfx('coin'); const G = gemOf(e.g); if (G) toast('Pierre précieuse : ' + G.name.toLowerCase() + ' !'); } break;
      case 'echo': if (mine) SND.sfx('star'); break;
      case 'sursis': if (mine) { SND.sfx('power'); toast('Dernier Rempart : tu tiens bon !'); } break;
      case 'wall': SND.sfx('wallbreak'); break;
      case 'trap': if (mine) SND.sfx('wallhit'); break;
      case 'revive': toast('Increvable : ton héros se relève !'); SND.sfx('power'); break;
      case 'enrage': SND.sfx('alarm'); break;
      case 'raise': { const h = st.heroes.find(x => x.id === e.id); SND.sfx('power'); if (h) toast(h.name + (e.by ? ' est relevé·e par son allié !' : ' se relève : la salle est nettoyée.')); break; }
      case 'down': { const h = st.heroes.find(x => x.id === e.id); if (h && dj.duo && !st.heroes.every(x => x.dead)) toast(h.id === dj.hid ? 'Tu es à terre : ton allié peut te relever en restant 3 s à côté de toi.' : h.name + ' est à terre : reste 3 s à côté pour la relever !'); break; }
    }
  }
  st.ev.length = 0;
}
/* À chaque image : la simulation avance par pas de 1/20 s, puis l'affichage suit.
   À deux, l'hôte envoie l'état toutes les 3 pas (≈ 7 fois par seconde) ; l'invitée a sa propre boucle. */
function djFrame(dt, tNow) {
  if (!dj) return;
  const st = dj.st, duo = dj.duo;
  if (duo && duo.role === 'guest') return djGuestFrame(dt, tNow);
  if (!st.over) {
    const kv = djKeyVec(), mx = kv ? kv[0] : dj.inp.mx, my = kv ? kv[1] : dj.inp.my;
    dj.acc = Math.min(dj.acc + dt, 0.25);
    let n = 0;
    while (dj.acc >= DJ_DT && n < 5 && !st.over) {
      const inputs = { [dj.hid]: { mx, my, sk: dj.inp.sk, pot: dj.inp.pot, rl: dj.inp.rl } };
      if (duo && !duo.gone) inputs[duo.mateHid] = djRemoteInput(duo);
      djStep(st, inputs);
      dj.inp.sk = -1; dj.inp.pot = false; dj.inp.rl = false; dj.acc -= DJ_DT; n++;
      djEvents(st);
      if (st.over === 'floor' && !dj.floorShown) djFloorDone();      // Profondeurs : le cumul est à jour avant l'envoi à l'invitée
      if (duo && (st.n % 3 === 0 || st.over)) djSendSnap();
    }
    if (duo && !duo.gone && performance.now() - duo.inAt > 20000) djMateGone(' ne répond plus.');
  } else if (duo && !duo.sentFinal) djSendSnap();
  V3.dj.sync(st, st.over ? 1 : dj.acc / DJ_DT, dt, tNow);
  djHudUpdate();
  if (st.over === 'floor') { if (dj.floorShown && !modal) { modal = { kind: 'djfloor' }; renderAll(); } }   // le choix reste à l'écran
  else if (st.over && !dj.ended) djEnded();
}
/* Commandes de l'invitée (dernier message reçu) : sa position, et ses boutons, un par pas. */
function djRemoteInput(duo) {
  const m = duo.inLast, gi = { pos: m && m.p, tp: m ? m.tp | 0 : 0 };
  if (m && m.q) for (const it of m.q) { const n = it && it[0], c = it && String(it[1]); if (n > duo.done) { duo.done = n; if (c === 'p') gi.pot = true; else if (c === 'r') gi.rl = true; else gi.sk = +c.slice(1); break; } }
  return gi;
}
/* Instantané pour l'invitée ; dans les Profondeurs, avec le cumul de la descente (ru : étages finis, expérience, monstres, secondes, combos, prisonnier). */
function djSendSnap() {
  const duo = dj.duo, st = dj.st, run = dj.run;
  if (st.over) duo.sentFinal = true;
  const sn = djSnap(st, duo.evBuf.slice(-80), ++duo.snapN, djFinalRes() || 0); duo.evBuf = [];
  if (run) sn.ru = [run.done, Math.round(run.xp), run.kills, run.secs, run.combos, run.pris ? 1 : 0, run.start];
  /* les objets et pierres trouvés par l'invitée (toute la descente dans les Profondeurs), seulement quand ça change */
  const gid = duo.mateHid, cur = (st.items && st.items[gid]) || [], all = run ? ((run.items && run.items[gid]) || []).concat(cur) : cur;
  const gems = run ? djAddGems(run.gems && run.gems[gid], st.gems && st.gems[gid]) : (st.gems && st.gems[gid]) || {}, sig = all.length + JSON.stringify(gems);
  if (sig !== duo.giSig || duo.snapN % 20 === 0) { duo.giSig = sig; sn.gi = all.map(djPack); sn.gg = gems; }
  liveRef('h2g').set(sn).catch(() => {});
}
function djGuestFrame(dt, tNow) {
  const st = dj.st, duo = dj.duo, me2 = st.heroes.find(h => h.id === dj.hid), t = performance.now();
  if (!st.over && me2) {
    const kv = djKeyVec(), mx = kv ? kv[0] : dj.inp.mx, my = kv ? kv[1] : dj.inp.my;
    if (dj.inp.rl) { dj.inp.rl = false; if (djLocalRoll(st, me2, mx, my)) { duo.q.push([++duo.qSeq, 'r']); duo.sendAt = 0; SND.sfx('whoosh'); } }
    djLocalMove(st, me2, mx, my, Math.min(dt, 0.1));
    me2.px = me2.x; me2.py = me2.y;
    if (dj.inp.sk >= 0) { duo.q.push([++duo.qSeq, 'k' + dj.inp.sk]); dj.inp.sk = -1; duo.sendAt = 0; }
    if (dj.inp.pot) { duo.q.push([++duo.qSeq, 'p']); dj.inp.pot = false; duo.sendAt = 0; }
    if (duo.q.length > 6) duo.q.splice(0, duo.q.length - 6);
    if (t - duo.sendAt > 100) { duo.sendAt = t; liveRef('g2h').set({ p: [djR2(me2.x), djR2(me2.y), djR2(me2.fx), djR2(me2.fy), me2.mv ? 1 : 0], tp: me2.tp | 0, q: duo.q, sd: st.d.seed, t: now() }).catch(() => {}); }
    const quiet = t - duo.lastSnapAt;
    if (quiet > 4000 && !duo.waitShown) { duo.waitShown = true; toast('En attente de ' + (duo.mateName || 'ton partenaire') + '…'); }
    if (quiet > 25000) djLost();
  }
  V3.dj.sync(st, Math.min(1, (t - duo.lastSnapAt) / duo.snapDt), dt, tNow);
  djHudUpdate();
  if (st.over === 'floor') { if (dj.ended) { /* rentrée seule */ } else if (!dj.floorShown) djGuestFloor(); else if (!modal) { modal = { kind: 'djfloorwait' }; renderAll(); } }
  else if (st.over && !dj.ended) djEnded();
}
function djGuestSnap(sn) {
  const duo = dj.duo, t = performance.now();
  if (dj.run && sn.fl && sn.sd !== dj.st.d.seed && sn.fl > dj.st.d.floor && !djGuestFloorGo(sn)) return;   // l'hôte est descendu d'un étage
  const evs = djApplySnap(dj.st, sn, dj.hid);
  if (evs === null) return;
  if (dj.run && sn.ru) { const [done, xp, kills, secs, combos, pris] = sn.ru; Object.assign(dj.run, { done, xp, kills, secs, combos, pris: !!pris }); }
  if (sn.gi) dj.myItems = sn.gi.map(djUnpack).filter(Boolean);
  if (sn.gg) dj.myGems = Object.assign({}, sn.gg);
  duo.snapDt = Math.max(80, Math.min(400, duo.snapDt * 0.8 + (t - duo.lastSnapAt) * 0.2)); duo.lastSnapAt = t; duo.waitShown = false;
  dj.st.ev = evs; djEvents(dj.st);
}
V3.onFrame(djFrame);

/* ===================== ÉQUIPEMENT : interface (équipement du héros, sac, forge, marchand) =====================
   Ce fichier ne fait que définir des fonctions et des actions (ACT_EQ) : l'application (p4_app) les appelle. */
let bagSel = null, bagFilter = '';
const SLOT_ART = { arme: 'une arme', casque: 'un casque', armure: 'une armure', bottes: 'des bottes', bijou: 'un bijou' };
const SLOT_PLURAL = { arme: 'Armes', casque: 'Casques', armure: 'Armures', bottes: 'Bottes', bijou: 'Bijoux' };
const myBag = () => (me && me.bag && me.bag[uid]) || { it: {}, gm: {}, n: 1 };
const rcls = it => it.set ? 'rcs' : 'rc' + (it.r | 0);
const rarTag = it => `<span class="rtag ${rcls(it)}">${it.set ? 'Ensemble' : RARITY[it.r | 0].name}</span>`;
const slotIco = sl => `<span class="ic sl">${IC['s_' + sl] || ''}</span>`;
const itemNameH = it => `<b class="iname ${rcls(it)}">${esc(itemInfo(it).name)}</b>`;
const arrowH = c => c === 1 ? '<span class="arr up" aria-label="mieux que l’objet porté">▲</span>' : c === -1 ? '<span class="arr down" aria-label="moins bien que l’objet porté">▼</span>' : c === 0 ? '<span class="arr eq" aria-label="pareil que l’objet porté">=</span>' : '';
const statsTxt = o => Object.keys(o).map(k => STATS[k].t(o[k])).join(' · ');
const gemChip = (key, n) => { const G = gemOf(key); return G ? `<span class="chip gemc"><i class="gdot" style="background:${G.col}"></i>${n > 1 ? n + ' × ' : ''}${esc(G.name)}</span>` : ''; };
/* Ce que l'équipement apporte, en une phrase. */
function gearSummary(G) {
  const parts = Object.keys(STATS).filter(k => G[k] > 0).map(k => STATS[k].t(G[k]));
  return parts.length ? parts.join(', ') : '';
}
/* Une ligne d'objet (dans une liste) : nom coloré selon la rareté, niveau, bonus principaux, flèche de comparaison. */
function itemRow(it, hh, act, data, on) {
  const I = itemInfo(it), cmp = hh ? compareItem(hh, it) : null, cw = hh ? canWear(hh, it) : { ok: true };
  return `<button class="item opt irow${on ? ' on' : ''}" data-act="${act}" ${data}>
    <div class="head"><span class="row">${slotIco(it.sl)}${itemNameH(it)}${arrowH(cmp)}</span><small>${rarTag(it)} niv. ${it.il}</small></div>
    <p>${esc(statsTxt(I.main))}${Object.keys(I.af).length ? ' · ' + esc(statsTxt(I.af)) : ''}${hh && !cw.ok ? ' · <span class="why">' + esc(cw.why) + '</span>' : ''}</p></button>`;
}
/* Liste courte, sans bouton (bilan de donjon). */
function itemListHTML(list, hh) {
  return list.slice().sort((a, b) => b.r - a.r || b.il - a.il).map(it => { const I = itemInfo(it); return `<div class="irow2"><span class="row">${slotIco(it.sl)}${itemNameH(it)}${arrowH(hh ? compareItem(hh, it) : null)}</span><small>${rarTag(it)} ${esc(statsTxt(I.main))}</small></div>`; }).join('');
}
/* Tout sur un objet, avec ce qu'on peut en faire. where : { id } (sac) ou { hid, sl } (porté). */
function itemDetail(it, hh, where) {
  const v = me, I = itemInfo(it), f = forgeLvlOf(v), worn = !!where.hid, loc = worn ? `data-hid="${where.hid}" data-sl="${where.sl}"` : `data-id="${where.id}"`;
  const cw = hh ? canWear(hh, it) : { ok: false };
  let h = `<div class="item idet">`;
  h += `<p><b>${esc(statsTxt(I.main))}</b>${Object.keys(I.af).length ? '<br>' + esc(statsTxt(I.af)) : ''}</p>`;
  if (it.pw && POWERS[it.pw]) h += `<p class="pow"><b>${esc(POWERS[it.pw].title)}</b> : ${esc(POWERS[it.pw].txt)}</p>`;
  if (it.set && SETS[it.set]) { const S = SETS[it.set], n = hh ? gearOf(hh).sets[it.set] || 0 : 0; h += `<p class="setp"><b>${esc(S.name)}</b>${hh ? ' (' + n + ' pièce' + (n > 1 ? 's' : '') + ' sur 4 portée' + (n > 1 ? 's' : '') + ')' : ''} · 2 pièces : ${esc(S.b2t)} · 4 pièces : ${esc(S.b4t)}</p>`; }
  /* Pierres serties */
  if (I.so) {
    const stock = myBag().gm, have = Object.keys(stock).filter(k => stock[k] > 0 && gemOf(k)).sort();
    h += '<div class="sockets">';
    I.gems.forEach((g, s) => {
      if (g) h += `<div class="row split"><span class="row">${gemChip(g)}<small class="note">${esc(STATS[gemOf(g).stat].t(gemOf(g).v))}</small></span>${f ? `<button class="btn small" data-act="unsocket" ${loc} data-s="${s}">Retirer</button>` : ''}</div>`;
      else h += `<div class="row split"><span class="note">Emplacement libre pour une pierre précieuse</span></div>${f && have.length ? `<div class="chips2">${have.map(k => `<button class="btn small" data-act="socket" ${loc} data-s="${s}" data-g="${k}">${gemChip(k, stock[k])}</button>`).join('')}</div>` : ''}`;
    });
    if (!f) h += '<p class="note">Il faut une forge pour sertir une pierre.</p>';
    h += '</div>';
  }
  h += `<p class="note">Niveau requis : ${I.req}${it.sl === 'arme' ? ' · ' + esc(FAMILY_LABEL[I.fam]) : ''}${it.sl === 'bijou' ? ' · se porte au niveau ' + BIJOU_LVL : ''}${it.up ? ' · amélioré +' + it.up : ''}. Se vend ${I.sell} or${f ? ', se fond en ' + I.melt + ' fer' : ''}.</p>`;
  /* Actions */
  const btns = [];
  if (!worn && hh && cw.ok) btns.push(`<button class="btn small primary" data-act="equip" data-hid="${hh.id}" data-id="${where.id}">Équiper sur ${esc(hh.name)}</button>`);
  if (!worn && hh && !cw.ok) h += `<p class="why">${esc(cw.why)}</p>`;
  if (worn) btns.push(`<button class="btn small" data-act="unequip" ${loc}>Retirer</button>`);
  if (f) {
    const mx = maxUpOf(f), up = it.up | 0;
    if (up < 5) { const c = improveCost(it); btns.push(up < mx ? `<button class="btn small${missingTxt(v, c) ? ' off' : ''}" data-act="improve" ${loc}>Améliorer +${up + 1} <span class="sub">${chipsRes(c, v.r)}</span></button>` : `<span class="note">+${up + 1} : forge niveau ${up + 1 >= 5 ? 3 : 2}</span>`); }
  }
  if (!worn) {
    btns.push(`<button class="btn small" data-act="sell" data-id="${where.id}">Vendre <span class="sub">${ico('or')}${I.sell}</span></button>`);
    if (f) btns.push(`<button class="btn small" data-act="melt" data-id="${where.id}">Fondre <span class="sub">${ico('fer')}${I.melt}</span></button>`);
  }
  h += `<div class="row wrap">${btns.join('')}</div></div>`;
  return h;
}

/* ---------- la fiche du héros : son équipement et son familier ---------- */
function heroGearHTML(v, hh, own) {
  const G = gearOf(hh), sum = gearSummary(G), B = myBag(), f = forgeLvlOf(v);
  let h = `<div class="sec"><h4>Équipement de ${esc(hh.name)}</h4><div class="item">`;
  for (const sl of SLOTS) {
    const it = hh.eq && hh.eq[sl], lock = sl === 'bijou' && hh.lvl < BIJOU_LVL, cw = it ? canWear(hh, it) : null;
    const nBetter = own && !lock ? Object.values(B.it).filter(x => x.sl === sl && compareItem(hh, x) === 1).length : 0;
    h += `<button class="slotrow${lock ? ' off' : ''}" data-act="${own && !lock ? 'gearSlot' : 'noop'}" data-id="${hh.id}" data-sl="${sl}"${own && !lock ? '' : ' disabled'}>
      ${slotIco(sl)}<span class="sltxt"><small>${SLOT_LABEL[sl]}</small>${it ? itemNameH(it) : `<span class="note">${lock ? 'au niveau ' + BIJOU_LVL : 'rien'}</span>`}
      ${it ? `<em>${esc(statsTxt(itemInfo(it).main))}${cw && !cw.ok ? ' · ' + esc(cw.why) : ''}</em>` : ''}</span>${nBetter ? `<span class="chip plus">▲ ${nBetter}</span>` : ''}</button>`;
  }
  if (sum) h += `<p class="note">Avec son équipement : ${esc(sum)}.</p>`;
  for (const k in G.sets) { const S = SETS[k], n = G.sets[k]; h += `<p class="setp"><b>${esc(S.name)}</b> : ${n} pièce${n > 1 ? 's' : ''} sur 4${n >= 2 ? ' · ' + esc(S.b2t) : ''}${n >= 4 ? ' · ' + esc(S.b4t) : ''}</p>`; }
  for (const p in G.pw) h += `<p class="pow"><b>${esc(POWERS[p].title)}</b> : ${esc(POWERS[p].txt)}</p>`;
  if (own) h += `<div class="row"><button class="btn small primary" data-act="sheet" data-s="bag" data-k="${hh.id}">${ico('s_bag', '')}Mon sac · ${bagCount(B)} / ${bagMax(v)}</button>${f ? `<button class="btn small" data-act="sheet" data-s="forge" data-k="${hh.id}">${ico('s_anvil', '')}La forge</button>` : ''}</div>`;
  h += '</div>';
  /* Le familier (niveau 6) */
  const pet = PETS[hh.pet] ? hh.pet : 'loup';
  h += `<div class="item"><b class="row">${ico('s_paw', 'c-tro')}Familier${hh.lvl >= PET_LVL ? ' : ' + esc(PETS[pet].name) : ' · niveau ' + PET_LVL}</b>`;
  if (hh.lvl < PET_LVL) h += `<p>Au niveau ${PET_LVL}, un animal accompagne ${esc(hh.name)} en donjon : loup, faucon, sanglier ou chouette, chacun avec son petit bonus.</p>`;
  else if (own) h += `<div class="chips2">${PET_KEYS.map(p => `<button class="btn small${p === pet ? ' primary' : ''}" data-act="pet" data-hid="${hh.id}" data-p="${p}" aria-pressed="${p === pet}">${esc(PETS[p].name)}</button>`).join('')}</div><p class="note">${esc(PETS[pet].txt)}</p>`;
  else h += `<p class="note">${esc(PETS[pet].txt)}</p>`;
  return h + '</div></div>';
}

/* ---------- le sac ---------- */
function sheetBag() {
  const v = me, B = myBag(), [hid, sl0] = String(sheetArg || '').split(':');
  const hh = (hid && v.heroes[hid] && v.heroes[hid].own === uid && v.heroes[hid]) || activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p>';
  const flt = SLOTS.includes(bagFilter) ? bagFilter : '', f = forgeLvlOf(v);
  const mine = heroesOf(v, uid);
  let h = `<p class="note">Ton sac : <b>${bagCount(B)} objet${bagCount(B) > 1 ? 's' : ''} sur ${bagMax(v)}</b>${f ? '' : ' (une forge donne 10 places de plus par niveau)'}. Les flèches comparent avec ce que porte <b>${esc(hh.name)}</b> : ▲ mieux, ▼ moins bien. Bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.</p>`;
  if (mine.length > 1) h += `<div class="chips2">${mine.map(x => `<button class="btn small${x === hh ? ' primary' : ''}" data-act="sheet" data-s="bag" data-k="${x.id}${flt ? ':' + flt : ''}">${esc(x.name)}</button>`).join('')}</div>`;
  h += `<div class="chips2 bagf"><button class="btn small${flt ? '' : ' primary'}" data-act="bagFilter" data-sl="">Tout</button>${SLOTS.map(s => `<button class="btn small${flt === s ? ' primary' : ''}" data-act="bagFilter" data-sl="${s}">${slotIco(s)}${SLOT_PLURAL[s]}</button>`).join('')}</div>`;
  /* L'objet porté à cet emplacement */
  if (flt) {
    const cur = hh.eq && hh.eq[flt];
    h += `<div class="sec"><h4>Porté par ${esc(hh.name)} · ${SLOT_LABEL[flt].toLowerCase()}</h4>`;
    h += cur ? itemRow(cur, null, 'bagSel', `data-id="eq:${flt}"`, bagSel === 'eq:' + flt) + (bagSel === 'eq:' + flt ? itemDetail(cur, hh, { hid: hh.id, sl: flt }) : '') : `<p class="note">Rien pour l’instant.</p>`;
    h += '</div>';
  }
  const wear = it => canWear(hh, it).ok ? 1 : 0;   // d'abord ce que ce héros peut porter, puis du meilleur au moins bon
  const list = Object.values(B.it).filter(it => !flt || it.sl === flt).sort((a, b) => SLOTS.indexOf(a.sl) - SLOTS.indexOf(b.sl) || wear(b) - wear(a) || itemInfo(b).score - itemInfo(a).score);
  h += `<div class="sec"><h4>Dans le sac${flt ? ' · ' + SLOT_PLURAL[flt].toLowerCase() : ''}</h4>`;
  if (!list.length) h += '<p class="note">Rien ici. Les objets se trouvent en donjon (coffres, boss, parfois un monstre), à la forge ou chez le marchand ambulant.</p>';
  for (const it of list) { h += itemRow(it, hh, 'bagSel', `data-id="${it.id}"`, bagSel === it.id); if (bagSel === it.id) h += itemDetail(it, hh, { id: it.id }); }
  const junk = Object.values(B.it).filter(it => it.r === 0 && !it.set);
  if (junk.length > 1) h += `<div class="row"><button class="btn small" data-act="sellJunk">Vendre les ${junk.length} objets communs <span class="sub">${ico('or')}${junk.reduce((a, it) => a + itemInfo(it).sell, 0)}</span></button></div>`;
  h += '</div>';
  /* Les pierres précieuses */
  const gk = Object.keys(B.gm).filter(k => B.gm[k] > 0 && gemOf(k)).sort();
  h += `<div class="sec"><h4>Pierres précieuses</h4>${gk.length ? `<div class="chips2">${gk.map(k => gemChip(k, B.gm[k])).join('')}</div><p class="note">À sertir dans un objet rare ou mieux (touche l’objet, il faut une forge). Trois pierres pareilles se fusionnent en une plus belle à la forge (niveau 2).</p>` : '<p class="note">Aucune pour l’instant : on en trouve dans les coffres et sur les boss.</p>'}</div>`;
  return h;
}

/* ---------- la forge ---------- */
function sheetForge() {
  const v = me, f = forgeLvlOf(v);
  if (!f) return `<p class="note">Il faut d’abord construire la forge (menu Construire, rubrique « Pour les héros »), et une mine de fer pour avoir du fer.</p>`;
  const hh = (sheetArg && v.heroes[sheetArg] && v.heroes[sheetArg].own === uid && v.heroes[sheetArg]) || activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p>';
  const B = myBag(), tbl = DROP['forge' + Math.min(3, f)], c = craftCost(hh.lvl), miss = missingTxt(v, c), full = bagCount(B) >= bagMax(v);
  const mine = heroesOf(v, uid);
  let h = `<p class="note">Forge de niveau ${f} : améliorations jusqu’à +${maxUpOf(f)}${f < 3 ? ' (agrandissez-la pour aller plus loin et forger mieux)' : ''}. Fer : <b>${fmtN(v.r.fer || 0)}</b> · or : <b>${fmtN(v.r.or || 0)}</b>.</p>`;
  if (mine.length > 1) h += `<div class="chips2">${mine.map(x => `<button class="btn small${x === hh ? ' primary' : ''}" data-act="sheet" data-s="forge" data-k="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
  h += `<div class="sec"><h4>Forger pour ${esc(hh.name)} (niveau ${hh.lvl})</h4><div class="item">
    <p>Un objet de niveau ${hh.lvl}, au hasard parmi : ${tbl.map((p, r) => p ? RARITY[r].name.toLowerCase() + ' ' + p + ' %' : '').filter(Boolean).join(', ')}. Les armes sont faites pour sa classe.</p>
    <div class="row split"><span class="chips2">${chipsRes(c, v.r)}</span>${full ? '<span class="why">Sac plein</span>' : ''}</div>
    <div class="chips2">${SLOTS.map(sl => `<button class="btn small${miss || full ? ' off' : ' primary'}" data-act="craft" data-hid="${hh.id}" data-sl="${sl}">${slotIco(sl)}${SLOT_LABEL[sl]}</button>`).join('')}</div></div></div>`;
  /* Améliorer ce qu'il porte */
  const worn = SLOTS.filter(sl => hh.eq && hh.eq[sl]);
  h += `<div class="sec"><h4>Améliorer l’équipement de ${esc(hh.name)}</h4>`;
  if (!worn.length) h += '<p class="note">Il ne porte encore rien. On peut aussi améliorer un objet du sac : touche-le dans le sac.</p>';
  for (const sl of worn) {
    const it = hh.eq[sl], up = it.up | 0, cc = improveCost(it), can = up < maxUpOf(f);
    h += `<div class="item"><div class="head"><span class="row">${slotIco(sl)}${itemNameH(it)}</span><small>${rarTag(it)}</small></div>
      <div class="foot"><span class="chips2">${up >= 5 ? '<span class="note">au maximum</span>' : can ? chipsRes(cc, v.r) : '<span class="note">+' + (up + 1) + ' : forge plus grande</span>'}</span>${up < 5 && can ? `<button class="btn small${missingTxt(v, cc) ? ' off' : ' primary'}" data-act="improve" data-hid="${hh.id}" data-sl="${sl}">+${up + 1}</button>` : ''}</div></div>`;
  }
  h += '<p class="note">Chaque amélioration : +10 % sur les bonus principaux de l’objet.</p></div>';
  /* Pierres : fusion */
  const gk = Object.keys(B.gm).filter(k => B.gm[k] > 0 && gemOf(k)).sort();
  h += `<div class="sec"><h4>Pierres précieuses</h4>${gk.length ? `<div class="chips2">${gk.map(k => gemChip(k, B.gm[k])).join('')}</div>` : '<p class="note">Aucune pour l’instant.</p>'}`;
  const fusable = gk.filter(k => B.gm[k] >= 3 && gemOf(k).n < 3);
  if (fusable.length) h += fusable.map(k => { const G = gemOf(k), to = gemOf(G.type + (G.n + 1)), cc = { or: GEM_FUSE_COST[G.n] }; return `<div class="row split"><span class="note">3 × ${esc(G.name)} → ${esc(to.name)}</span>${f >= 2 ? `<button class="btn small${missingTxt(v, cc) ? ' off' : ' primary'}" data-act="fuse" data-g="${k}">Fusionner <span class="sub">${chipsRes(cc, v.r)}</span></button>` : '<span class="note">forge niveau 2</span>'}</div>`; }).join('');
  h += '<p class="note">Pour sertir une pierre, ou pour fondre un objet (il rend du fer), touche-le dans ton sac.</p>';
  h += `<div class="row"><button class="btn small primary" data-act="sheet" data-s="bag" data-k="${hh.id}">${ico('s_bag', '')}Ouvrir mon sac</button></div></div>`;
  return h;
}

/* ---------- le marchand ambulant ---------- */
function sheetMerch() {
  const v = me, t = now();
  if (!merchHere(v, t)) return '<p class="note">Le marchand ambulant est reparti. Il revient un jour sur deux, avec de nouveaux objets.</p>';
  const M = v.merch, hh = activeHero(v, uid), sold = String(M.sold || ''), full = bagCount(myBag()) >= bagMax(v);
  let h = `<p class="note">Il repart dans <b>${fmtDur(merchLeaves(v, t) - t)}</b>. On paie avec la bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.${hh ? ' Les flèches comparent avec ce que porte ' + esc(hh.name) + '.' : ''}</p>`;
  h += '<div class="sec"><h4>Objets</h4>';
  M.it.forEach((it, i) => {
    const done = sold.includes('i' + i + ';'), price = merchPrice(it), I = itemInfo(it);
    h += `<div class="item${done ? ' off' : ''}"><div class="head"><span class="row">${slotIco(it.sl)}${itemNameH(it)}${done ? '' : arrowH(hh ? compareItem(hh, it) : null)}</span><small>${rarTag(it)} niv. ${it.il}</small></div>
      <p>${esc(statsTxt(I.main))}${Object.keys(I.af).length ? ' · ' + esc(statsTxt(I.af)) : ''}${it.pw ? ' · <b>' + esc(POWERS[it.pw].title) + '</b> : ' + esc(POWERS[it.pw].txt) : ''}${I.so ? ' · ' + I.so + ' emplacement' + (I.so > 1 ? 's' : '') + ' de pierre' : ''}${hh && !done && !canWear(hh, it).ok ? ' · <span class="why">' + esc(canWear(hh, it).why) + '</span>' : ''}</p>
      <div class="foot"><span class="chip${(v.r.or || 0) < price ? ' short' : ''}">${ico('or')}${fmtN(price)}</span>${done ? '<span class="note">vendu</span>' : `<button class="btn small${(v.r.or || 0) < price || full ? ' off' : ' primary'}" data-act="buy" data-i="${i}">Acheter</button>`}</div></div>`;
  });
  h += '</div><div class="sec"><h4>Pierres précieuses</h4>';
  M.gm.forEach((key, i) => {
    const done = sold.includes('g' + i + ';'), price = gemPrice(key), G = gemOf(key); if (!G) return;
    h += `<div class="item${done ? ' off' : ''}"><div class="foot"><span class="row">${gemChip(key)}<small class="note">${esc(STATS[G.stat].t(G.v))}</small></span>
      <span class="row"><span class="chip${(v.r.or || 0) < price ? ' short' : ''}">${ico('or')}${fmtN(price)}</span>${done ? '<span class="note">vendu</span>' : `<button class="btn small${(v.r.or || 0) < price ? ' off' : ' primary'}" data-act="buyGem" data-g="${i}">Acheter</button>`}</span></div></div>`;
  });
  return h + '</div>' + (full ? '<p class="why">Ton sac est plein : vends ou fonds un objet pour acheter.</p>' : '');
}

/* ---------- actions de l'équipement (réunies dans ACT par p4_app) ---------- */
const eqWhere = b => b.dataset.hid ? { hid: b.dataset.hid, sl: b.dataset.sl } : { id: b.dataset.id };
const ACT_EQ = {
  bagSel: b => { bagSel = bagSel === b.dataset.id ? null : b.dataset.id; renderAll(); },
  bagFilter: b => { bagFilter = b.dataset.sl || ''; bagSel = null; renderSheet.scrolled = false; renderAll(); },
  gearSlot: b => { bagFilter = b.dataset.sl; bagSel = null; renderSheet.scrolled = false; openSheet('bag', b.dataset.id + ':' + b.dataset.sl); },
  equip: b => { const r = act({ type: 'equip', hid: b.dataset.hid, id: b.dataset.id }); if (r) { bagSel = null; const hh = me.heroes[b.dataset.hid]; toast((hh ? hh.name : 'Ton héros') + ' porte maintenant : ' + r.name + '.'); renderAll(); } },
  unequip: b => { if (act({ type: 'unequip', hid: b.dataset.hid, sl: b.dataset.sl })) { bagSel = null; renderAll(); } },
  sell: b => {
    const it = myBag().it[b.dataset.id]; if (!it) return;
    if ((it.r >= 2 || it.set) && !confirm('Vendre ' + itemInfo(it).name + ' pour ' + itemInfo(it).sell + ' or ?')) return;
    const r = act({ type: 'sell', ids: [b.dataset.id] }); if (r) { bagSel = null; toast('+' + r.gain + ' or pour la bourse commune.'); renderAll(); }
  },
  sellJunk: () => {
    const ids = Object.values(myBag().it).filter(it => it.r === 0 && !it.set).map(it => it.id); if (!ids.length) return;
    if (!confirm('Vendre les ' + ids.length + ' objets communs du sac ?')) return;
    const r = act({ type: 'sell', ids }); if (r) { bagSel = null; toast(r.n + ' objets vendus : +' + r.gain + ' or.'); renderAll(); }
  },
  melt: b => {
    const it = myBag().it[b.dataset.id]; if (!it) return;
    if ((it.r >= 2 || it.set) && !confirm('Fondre ' + itemInfo(it).name + ' pour ' + itemInfo(it).melt + ' fer ?')) return;
    const r = act({ type: 'melt', ids: [b.dataset.id] }); if (r) { bagSel = null; toast('Fondu : +' + r.gain + ' fer.'); renderAll(); }
  },
  craft: b => { const r = act({ type: 'craft', hid: b.dataset.hid, sl: b.dataset.sl }); if (r) { toast('La forge a fait : ' + r.name + ' (' + RARITY[r.r].name.toLowerCase() + '). Il est dans ton sac.'); if (r.r >= 3) SND.sfx('star'); } },
  improve: b => { const r = act(Object.assign({ type: 'improve' }, eqWhere(b))); if (r) toast('Amélioré : +' + r.up + '.'); },
  socket: b => { if (act(Object.assign({ type: 'socket', s: +b.dataset.s, g: b.dataset.g }, eqWhere(b)))) toast('Pierre sertie.'); },
  unsocket: b => { if (act(Object.assign({ type: 'unsocket', s: +b.dataset.s }, eqWhere(b)))) toast('La pierre retourne dans ton sac.'); },
  fuse: b => { const r = act({ type: 'fuse', g: b.dataset.g }); if (r) toast('Fusion réussie : ' + r.name + ' !'); },
  buy: b => { const r = act({ type: 'buy', i: +b.dataset.i }); if (r) toast('Acheté : ' + r.name + '. Il est dans ton sac.'); },
  buyGem: b => { const r = act({ type: 'buy', g: +b.dataset.g }); if (r) toast('Acheté : ' + r.name + '.'); },
  pet: b => { const p = b.dataset.p; if (act({ type: 'pet', hid: b.dataset.hid, p })) toast(PETS[p].name + ' : ' + PETS[p].txt); },
};

/* ===================== RAIDS : interface (menu Défense, pose des palissades en ligne, bilan, rediffusion) =====================
   Les règles et le combat sont dans p2r_raid.js ; ici, seulement ce qu'on voit et ce qu'on touche.
   Ce fichier ne fait que définir des fonctions et des actions (ACT_RAID) : l'application (p4_app) les appelle. */
let rp = null;                                    // rediffusion en cours : { st, lr, speed, acc, sig, ended }
const DEF_TYPES = ['rempart', 'porte', 'tour', 'piege', 'filet'];
const isDef = b => !!BLD[b.type] && !!BLD[b.type].def;

/* ---------- textes ---------- */
function defLine(b) {
  const d = BLD[b.type], k = Math.max(1, Math.min(d.max, b.lvl | 0)) - 1;
  if (b.type === 'rempart') return 'Les ennemis doivent la contourner ou la casser (les trolls cassent 4 fois plus vite). Améliorez-la ici (ou toutes celles du même niveau), ou faites-en une porte.';
  if (b.type === 'porte') return 'Vos héros et vos villageois passent, pas les ennemis : ils doivent la casser. Moins solide qu’un mur, elle attire leurs coups.';
  if (b.type === 'tour') return b.lvl < 1 ? d.desc : 'Tire sur les ennemis à ' + String(d.tw.range[k]).replace('.', ',') + ' cases : ' + d.tw.dmg[k] + ' de dégâts toutes les 1,2 seconde.';
  if (b.type === 'piege') return 'Caché : ' + d.trap.dmg[k] + ' de dégâts à chaque ennemi qui marche dessus, ' + d.trap.uses[k] + ' fois par raid. Vos héros et vos villageois passent dessus sans risque.';
  if (b.type === 'filet') return 'Caché : immobilise ' + String(d.trap.root[k]).replace('.', ',') + ' secondes l’ennemi qui marche dessus, ' + d.trap.uses[k] + ' fois par raid (les trolls s’en défont deux fois plus vite).';
  return d.desc;
}
const lootTxt = o => Object.keys(o || {}).map(k => o[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', ');
const lootChips = (o, plus) => Object.keys(o || {}).map(k => `<span class="chip${plus ? ' plus' : ' short'}">${ico(k)}${plus ? '+' : '−'}${fmtN(o[k])}</span>`).join('');
function raidTitle(r) { return Object.keys(r.lost || {}).length ? (r.e >= r.f ? 'Les gobelins ont pillé le village' : 'Raid des gobelins') : 'Raid repoussé !'; }
function raidReportHTML(v, lr, btn) {
  const r = lr.res, names = id => { const H = lr.H.find(x => x[0] === id); return H ? H[1] : ''; };
  const heroes = lr.H.map(x => x[1]).filter(Boolean);
  let h = `<div class="sum">
    <div class="row split"><span>Ennemis vaincus</span><b>${r.k} sur ${r.f}</b></div>
    ${r.e ? `<div class="row split"><span>Enfuis par le portail</span><b>${r.e}</b></div>` : ''}
    ${Object.keys(r.lost).length ? `<div class="row split"><span>Volé</span><span class="chips2">${lootChips(r.lost)}</span></div>` : '<div class="row split"><span>Volé</span><b>rien du tout</b></div>'}
    ${Object.keys(r.back).length ? `<div class="row split"><span>Butin repris</span><span class="chips2">${lootChips(r.back, true)}</span></div>` : ''}
    ${r.g ? `<div class="row split"><span>Bourse commune</span><span class="chip plus">${ico('or')}+${fmtN(r.g)}</span></div>` : ''}
    ${r.xp && heroes.length ? `<div class="row split"><span>Expérience des défenseurs</span><b>+${fmtN(r.xp)} chacun</b></div>` : ''}
    ${r.br ? `<div class="row split"><span>Défenses détruites</span><b>${r.br} (à réparer)</b></div>` : ''}
    ${r.ko.length ? `<div class="row split"><span>À terre pendant le combat</span><b>${esc(r.ko.map(names).join(', '))}</b></div>` : ''}
    ${r.gd ? `<div class="row split"><span>Abattus par la garnison</span><b>${r.gk || 0}</b></div>` : ''}
    ${r.gd && r.gd.some(x => x[2]) ? `<div class="row split"><span>Soldats blessés (8 h)</span><b>${esc(r.gd.filter(x => x[2]).map(x => { const G = (lr.G || []).find(e => e[0] === x[0]); return G ? solName({ type: G[1], sex: G[3], num: G[15] }) : '?'; }).join(', '))}</b></div>` : ''}
    ${lr.orbs && lr.orbs.length ? `<div class="row split"><span>Pour la garnison</span><span class="chips2">${lr.orbs.map(k => orbChip(k)).join('')}</span></div>` : ''}
  </div>`;
  if (r.h) h += '<p class="why">Ils ont pillé la halle, le cœur du village : le moral baisse pendant un jour.</p>';
  if (r.c) h += '<p class="why">Ils ont fouillé la chambre de Lilou : elle a eu très peur (−' + CROWN_FEAR + ' d’humeur). Protégez-la : palissades, pièges, poste de garde.</p>';
  if (!heroes.length) h += '<p class="note">Aucun héros pour défendre la halle : créez votre héros, il défendra le village.</p>';
  if (btn) h += `<div class="row"><button class="btn small primary" data-act="raidReplay">${djIco('eye')}Revoir le raid</button></div>`;
  return h;
}

/* ---------- le menu Défense ---------- */
function sheetDefense() {
  const v = me, t = now(), info = raidInfo(v, t), hl = hallLvl(v), lr = v.lastRaid, hh = activeHero(v, uid);
  let h = '';
  if (info.st === 'calm') {
    h += `<div class="item"><div class="head"><b class="row">${djIco('shield')}La vallée est calme</b><small>${info.next > t ? 'prochain portail dans ' + fmtDur(info.next - t) : 'un portail va s’ouvrir'}</small></div>
      <p>Un portail démoniaque s’ouvrira au bord de la vallée. Il se charge pendant 3 heures : vous verrez de quel côté viendront les gobelins.</p></div>`;
  } else {
    const open = info.p.filter(p => !p.cl), pk = partnerId(v), ph = pk ? activeHero(v, pk) : null, on = pk && isOnline(pk), L = raidLevel(v);
    h += `<div class="item feature"><div class="head"><b class="row">${djIco('flame')}${open.length > 1 ? open.length + ' portails démoniaques' : 'Un portail démoniaque'}</b><small>${info.st === 'charge' ? 'chargé dans ' + fmtDur(info.ready - t) : 'chargé !'}</small></div>
      <div class="bar"><i style="width:${(info.frac * 100).toFixed(0)}%"></i></div>
      <p>${info.st === 'charge' ? 'Une fois chargé, le raid partira dès que personne n’aura joué depuis 2 heures.' : 'Les gobelins attaqueront dès que personne n’aura joué depuis 2 heures.'} Préparez vos défenses de ce côté, ou refermez-le avec votre héros (un petit donjon et son gardien, niveau ${L}).</p>
      ${info.p.map(p => `<div class="row split portrow"><b>Portail ${RAID_OF[p.side]}</b>${p.cl ? '<span class="chip plus">refermé</span>' : hh ? `<span class="row"><button class="btn small primary" data-act="djGo" data-th="portail" data-k="${L}" data-pi="${p.i}">${djIco('sword')}Le refermer</button>${pk && ph ? `<button class="btn small${on ? '' : ' off'}" data-act="djInvite" data-th="portail" data-k="${L}" data-pi="${p.i}"${on ? '' : ' disabled'}>À deux</button>` : ''}</span>` : '<span class="note">crée ton héros</span>'}</div>`).join('')}
      <div class="row"><button class="btn small" data-act="portalLook">Voir le portail</button></div></div>`;
  }
  h += garCardHTML(v);
  if (lr) h += `<div class="sec"><h4>Dernier raid · ${fmtAgo(lr.t)}</h4><div class="item"><div class="head"><b>${esc(raidTitle(lr.res))}</b><small>${lr.F.length} assaillants · niveau ${lr.L}</small></div>${raidReportHTML(v, lr, true)}</div></div>`;
  /* les défenses du village */
  const of = type => v.b.filter(b => b.type === type), cnt = type => of(type).length + ' sur ' + limitOf(type, hl);
  const dmg = v.b.filter(b => repairCostOf(b)), rc = {}; for (const b of dmg) { const c = repairCostOf(b); for (const k in c) rc[k] = (rc[k] || 0) + c[k]; }
  h += '<div class="sec"><h4>Défenses</h4>';
  if (dmg.length) h += `<div class="item feature"><div class="head"><b class="row">${ico('hammer', 'c-tro')}${dmg.length} défense${dmg.length > 1 ? 's abîmées' : ' abîmée'}</b><small>${dmg.filter(b => b.hp === 0).length ? dmg.filter(b => b.hp === 0).length + ' en ruine' : 'à réparer'}</small></div>
    <div class="foot"><span class="chips2">${chipsRes(rc, v.r)}</span><button class="btn small primary" data-act="repair">Tout réparer</button></div></div>`;
  const upRows = type => {
    const d = BLD[type], out = [];
    for (let L = 1; L < d.max; L++) {
      const n = of(type).filter(b => b.lvl === L).length; if (!n) continue;
      const to = L + 1, c = costOf(type, to);
      if (to > maxLvlOf(type, hl)) { out.push(`<p class="note">${esc(d.lvlNames ? d.lvlNames[L] : d.name + ' niveau ' + to)} : agrandissez d’abord la halle.</p>`); continue; }
      out.push(`<div class="foot"><span class="note">${n} × ${esc((d.lvlNames ? d.lvlNames[L - 1] : 'niveau ' + L).toLowerCase())} → ${esc(d.lvlNames ? d.lvlNames[L].toLowerCase() : 'niveau ' + to)}</span><span class="row"><span class="chips2">${chipsRes(c, v.r)}<span class="note">chacun</span></span><button class="btn small${missingTxt(v, c) ? ' off' : ''}" data-act="upwalls" data-t="${type}" data-l="${L}">Améliorer</button></span></div>`);
    }
    return out.join('');
  };
  const card = (type, title, body, btn) => `<div class="item"><div class="head"><b>${esc(title)}</b><small>${cnt(type)}</small></div><p>${esc(body)}</p>${btn}${upRows(type)}</div>`;
  const placeBtn = (type, label) => { const full = of(type).length >= limitOf(type, hl), c = costOf(type, 1), miss = missingTxt(v, c);
    return `<div class="foot"><span class="chips2">${chipsRes(c, v.r)}${BLD[type].inst ? '<span class="note">chacun</span>' : ''}</span><button class="btn small${full || miss ? ' off' : ' primary'}" data-act="place" data-type="${type}">${full ? 'Maximum' : label}</button></div>`; };
  h += card('rempart', 'Palissades', 'Elles bloquent les ennemis : ils doivent les contourner ou les casser. Posez-les en ligne (droite ou en diagonale) ; un village bien fermé force les gobelins à casser.', placeBtn('rempart', 'Poser des palissades'));
  h += card('porte', 'Portes', 'Dans une palissade : vos héros et vos villageois passent, pas les ennemis. Moins solides qu’un mur, elles attirent leurs coups. Pour en faire une, touchez une palissade du village.', placeBtn('porte', 'Poser une porte'));
  h += card('tour', 'Tours d’archers', BLD.tour.desc + ' Elles se construisent comme les autres bâtiments.', placeBtn('tour', 'Construire'));
  h += card('piege', 'Pièges à pointes', BLD.piege.desc, placeBtn('piege', 'Poser'));
  h += card('filet', 'Filets', BLD.filet.desc, placeBtn('filet', 'Poser'));
  h += '</div>';
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>À partir du 3e jour, un portail démoniaque s’ouvre au bord de la vallée (au plus un raid par jour ; 2 portails avec la halle niveau 3, 3 au niveau 5). Il se charge pendant 3 heures.</li>
    <li>Le raid ne part que si personne n’a joué depuis 2 heures. Il se joue tout seul ; au retour, vous pouvez le revoir.</li>
    <li>Les gobelins foncent sur la halle pour la piller, les voleurs filent vers l’entrepôt, les trolls cassent ce qui bloque. Tous prennent le chemin le plus court, en comptant ce qu’il faudrait casser : une porte est souvent leur cible.</li>
    <li>Ce qu’ils emportent est perdu s’ils regagnent le portail ; abattus avant, ils lâchent tout. Jamais plus de 30 % d’une ressource par raid.</li>
    <li>Vos héros défendent la halle (et gagnent de l’expérience), les tours tirent sur ce qui passe à portée, les pièges cachés blessent ou immobilisent. Chaque ennemi abattu rapporte de l’or.</li>
    <li>Si la halle est pillée, le moral baisse pendant un jour. Après un raid, réparez ce qui est abîmé.</li>
    <li>Refermer un portail avec son héros (seul ou à deux) : un petit donjon et son gardien. Tous les portails refermés : pas de raid cette fois.</li></ul></div>`;
  return h;
}

/* ---------- panneau d'une défense du village (touchée sur la carte) ---------- */
function defPanel(v, b) {
  if (b.type === 'poste') return postPanel(v, b);
  const d = BLD[b.type], hl = hallLvl(v), mx = hpMaxOf(b), hp = hpOf(b), broken = isBroken(b), t = now();
  let h = `<div class="glass card"><h3><span>${esc(b.type === 'tour' ? d.name : lvlName(b))}</span><span class="row"><small>${b.lvl > 0 ? 'niveau ' + b.lvl : 'chantier'}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>`;
  if (b.up) {
    const f = Math.min(1, b.up.done / b.up.need), sr = siteRate(v, t), open = sr.open.some(x => x.id === b.id);
    const eta = open && sr.perSite > 0 ? fmtDur((b.up.need - b.up.done) / sr.perSite * 3600000) : null;
    h += `<div class="bar"><i style="width:${Math.max(2, f * 100).toFixed(1)}%"></i></div><div class="row split note"><span>${b.lvl > 0 ? 'Agrandissement vers le niveau ' + b.up.to : 'Construction'} · ${Math.floor(f * 100)} %</span><b>${open ? (eta ? 'encore ' + eta : '') : 'en attente d’un bâtisseur libre'}</b></div>`;
  }
  if (mx && b.lvl > 0) {
    const rc = repairCostOf(b);
    h += `<div class="bar hp"><i style="width:${(hp / mx * 100).toFixed(0)}%"></i></div><div class="row split"><span class="note">${broken ? 'En ruine : elle ne bloque plus rien' : 'Solidité ' + fmtN(hp) + ' sur ' + fmtN(mx)}</span>${rc ? `<span class="row"><span class="chips2">${chipsRes(rc, v.r)}</span><button class="btn small primary" data-act="repair">Réparer</button></span>` : ''}</div>`;
  }
  h += `<p class="note">${esc(defLine(b))}</p>`;
  if (!b.up && b.lvl > 0) {
    const to = b.lvl + 1;
    if (to <= d.max) {
      if (to > maxLvlOf(b.type, hl)) h += '<p class="note">Agrandissez d’abord la halle du village pour aller plus loin.</p>';
      else {
        const c = costOf(b.type, to), miss = missingTxt(v, c), same = v.b.filter(x => x.type === b.type && x.lvl === b.lvl).length;
        h += `<div class="row split"><span class="chips2">${chipsRes(c, v.r)}</span><span class="row">${d.inst && same > 1 ? `<button class="btn small" data-act="upwalls" data-t="${b.type}" data-l="${b.lvl}">Les ${same}</button>` : ''}<button class="btn${miss ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">${d.lvlNames ? esc(d.lvlNames[to - 1]) : 'Niveau ' + to}</button></span></div>`;
      }
    } else h += '<p class="note">Niveau maximum atteint.</p>';
  }
  h += `<div class="row">${b.type === 'rempart' ? `<button class="btn small" data-act="gate" data-id="${b.id}">En faire une porte <span class="sub">${chipsRes(costOf('porte', 1))}</span></button>` : ''}<button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button><button class="btn small" data-act="demolish" data-id="${b.id}">${d.inst ? 'Retirer' : 'Démolir'}</button><button class="btn small" data-act="sheet" data-s="defense">${djIco('shield')}Défense</button></div>`;
  return h + '</div>';
}

/* ---------- pose des palissades : une case par toucher, ou toute une ligne ---------- */
function startWallMode() {
  if (!me) return;
  const hl = hallLvl(me);
  if (countOf(me, 'rempart') >= limitOf('rempart', hl)) { toast('Plus de palissade possible : agrandissez la halle.'); return; }
  const m = missingTxt(me, costOf('rempart', 1)); if (m) { toast(m); return; }
  place = { kind: 'wall', type: 'rempart', gx: -99, gz: -99, last: null };
  sel = null; selP = null; closeSheet(true);
  refreshScene(); renderAll();
  toast('Touche une case, puis une autre sur la même ligne : toute la ligne se remplit.');
}
const wallOn = (x, z) => me.b.some(b => (b.type === 'rempart' || b.type === 'porte') && b.gx === x && b.gz === z);
function wallTap(cx, cy) {
  const g = V3.pickGround(cx, cy); if (!g) return;
  const gx = Math.floor(g[0]), gz = Math.floor(g[1]);
  if (gx < EDGE || gz < EDGE || gx >= GRID - EDGE || gz >= GRID - EDGE) { toast('Trop près du bord de la vallée.'); return; }
  if (wallOn(gx, gz)) { place.last = [gx, gz]; place.gx = gx; place.gz = gz; toast('Départ de ligne : touche une autre case sur la même ligne.'); refreshScene(); renderAll(); return; }
  let tiles = [[gx, gz]];
  const L = place.last, dx0 = L ? gx - L[0] : 0, dz0 = L ? gz - L[1] : 0;
  if (L && (dx0 === 0 || dz0 === 0 || Math.abs(dx0) === Math.abs(dz0)) && Math.max(Math.abs(dx0), Math.abs(dz0)) > 1) {
    tiles = []; const dx = Math.sign(dx0), dz = Math.sign(dz0);
    for (let x = L[0] + dx, z = L[1] + dz; ; x += dx, z += dz) { if (!wallOn(x, z)) tiles.push([x, z]); if (x === gx && z === gz) break; }
  }
  place.gx = gx; place.gz = gz;
  const r = act({ type: 'walls', tiles });
  if (r) { place.last = [gx, gz]; if (r.why && r.n < tiles.length) toast(r.n + ' posée' + (r.n > 1 ? 's' : '') + '. ' + r.why); }
  refreshScene(); renderAll();
}
function wallBarHTML() {
  const n = countOf(me, 'rempart'), lim = limitOf('rempart', hallLvl(me));
  return `<div class="glass card"><div class="row split"><b class="row">${djIco('shield')}Palissades · ${n} sur ${lim}</b><span class="chips2">${chipsRes(costOf('rempart', 1), me.r)}<span class="note">chacune</span></span><button class="btn small primary" data-act="placeCancel">Terminé</button></div>
    <p class="note">Touche une case, puis une autre sur la même ligne (droite ou diagonale) : toute la ligne se remplit. Toucher une palissade = départ de ligne.</p></div>`;
}

/* ---------- bilan à l'ouverture (une fois par raid sur ce téléphone) ---------- */
function raidCheck() {
  if (!me || mode !== 'home' || modal || sheet || place) return;
  const lr = me.lastRaid; if (!lr) return;
  const key = 'mk2.raid.' + vid;
  if (LS.get(key) === lr.t) return;
  LS.set(key, lr.t);
  if (now() - lr.t > 3 * DAY) return;            // trop vieux : on ne dérange pas
  modal = { kind: 'raid' }; SND.sfx(Object.keys(lr.res.lost).length ? 'alarm' : 'star');
}
function raidModalHTML() {
  const lr = me.lastRaid; if (!lr) return '';
  return `<p class="eyebrow">Pendant votre absence · ${fmtAgo(lr.t)}</p><h2>${esc(raidTitle(lr.res))}</h2>
    <p>${lr.F.length} assaillants sont sortis ${lr.P.filter(p => !p[3]).length > 1 ? 'des portails' : 'du portail ' + RAID_OF[(lr.P.find(p => !p[3]) || lr.P[0])[2]]}.</p>
    ${raidReportHTML(me, lr, false)}
    <div class="row"><button class="btn grow" data-act="closeModal">Fermer</button><button class="btn primary grow" data-act="raidReplay">${djIco('eye')}Revoir le raid</button></div>`;
}

/* ---------- rediffusion : le même combat, rejoué dans le village de ce jour-là ---------- */
function raidItems(st) {
  const col = safeColor(me ? me.c : COLORS[0]);
  const out = st.S.filter(S => S.id).map(S => ({ key: 'r' + S.id, id: S.id, type: S.type, lvl: S.lvl, gx: S.x0, gz: S.y0, up: S.lvl < 1 ? { frac: 0 } : null, col, dead: S.dead }));
  for (const T of st.traps) out.push({ key: 'rt' + T.id, id: T.id, type: T.type, lvl: T.lvl, gx: T.x, gz: T.y, up: null, col });
  for (const P0 of st.posts) out.push({ key: 'rp' + P0.id, id: P0.id, type: 'poste', lvl: P0.lvl, gx: P0.gx, gz: P0.gz, up: null, col, ban: P0.ban ? P0.ban - 1 : undefined });
  return out;
}
function raidReplayStart() {
  const lr = me && me.lastRaid;
  if (!lr || dj || rp) return;
  if (!gl) { toast('La rediffusion a besoin de la 3D, indisponible sur cet appareil.'); return; }
  const st = raidReplay(lr);
  rp = { st, lr, speed: 1, acc: 0, sig: '', ended: false };
  closeSheet(true); modal = null; sel = null; selP = null; place = null;
  mode = 'raid'; ringSig = '?';
  V3.raid.enter(st); V3.clearBuildings(); V3.setBuildings(raidItems(st));   // repartir de zéro : pas d'animation de construction partout
  rpHudBuild(); SND.music('battle', 1); SND.sfx('alarm');
  renderAll();
}
function raidReplayExit() {
  if (!rp) return;
  V3.raid.exit(); rp = null; V3.clearBuildings(); ringSig = '?';
  const el = $('#rpHud'); if (el) el.hidden = true;
  mode = 'home'; SND.music('village', 1);
  refreshScene(); renderAll();
}
function rpHudBuild() {
  let el = $('#rpHud');
  if (!el) { el = document.createElement('div'); el.id = 'rpHud'; el.className = 'djhud rphud'; $('#app').appendChild(el); }
  el.innerHTML = `<div class="djtop"><div class="glass djinfo" id="rpInfo"></div><button class="glass chipb" data-act="rpSpeed" id="rpSpd">Vitesse ×1</button><button class="glass chipb djflee" data-act="rpQuit">Quitter</button></div>
    <div class="glass rpend" id="rpEnd" hidden></div>`;
  el.hidden = false;
}
function rpHudUpdate() {
  const st = rp.st, info = $('#rpInfo'); if (!info) return;
  const left = st.foes.filter(u => !u.dead && !u.out).length, s = Math.floor(st.t), lost = {};
  for (const k in st.lost) lost[k] = Math.round(st.lost[k]);
  const txt = 'Rediffusion · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' · ' + (st.over ? 'terminé' : left + ' ennemi' + (left > 1 ? 's' : '') + ' en jeu') + (st.kills ? ' · ' + st.kills + ' vaincu' + (st.kills > 1 ? 's' : '') : '') + (Object.keys(lost).length ? ' · volé : ' + lootTxt(lost) : '');
  if (info._t !== txt) { info._t = txt; info.textContent = txt; }
  const sp = $('#rpSpd'); if (sp && sp._s !== rp.speed) { sp._s = rp.speed; sp.textContent = 'Vitesse ×' + rp.speed; }
}
function rpShowEnd() {
  const el = $('#rpEnd'); if (!el || !rp) return;
  el.innerHTML = `<h3>${esc(raidTitle(rp.lr.res))}</h3>${raidReportHTML(me, rp.lr, false)}<div class="row"><button class="btn grow" data-act="rpAgain">Revoir</button><button class="btn primary grow" data-act="rpQuit">Retour au village</button></div>`;
  el.hidden = false;
}
function rpEvents(st) {
  for (const e of st.ev) {
    V3.raid.fx(e, st);
    const pan = e.x != null ? { pan: V3.panOf(e.x, e.y) } : undefined;
    switch (e.k) {
      case 'tshot': SND.sfx('shoot', pan); break;
      case 'hhit': SND.sfx(e.sh === 'rodeur' ? 'shoot' : e.sh ? 'bolt' : 'chop'); break;
      case 'ghit': SND.sfx(e.sh === 'arch' ? 'shoot' : e.sh === 'mage' ? 'bolt' : 'chop', pan); break;
      case 'die': SND.sfx(e.big ? 'collapse' : 'death', pan); break;
      case 'break': SND.sfx('wallbreak', pan); break;
      case 'trap': SND.sfx('wallhit', pan); break;
      case 'loot': SND.sfx('coin'); break;
      case 'drop': SND.sfx('star', pan); break;
      case 'heart': SND.sfx('alarm'); break;
      case 'lilou': SND.sfx('alarm'); break;
      case 'ko': SND.sfx('death'); break;
    }
  }
  st.ev.length = 0;
}
/* À chaque image : la simulation avance par pas de 1/10 s (plus vite en accéléré), puis l'affichage suit. */
function rpFrame(dt, tNow) {
  if (!rp) return;
  const st = rp.st;
  if (!st.over) {
    rp.acc = Math.min(rp.acc + dt * rp.speed, 0.6);
    for (let n = 0; rp.acc >= RAID_DT && !st.over && n < 40; n++) { raidStep(st); rp.acc -= RAID_DT; rpEvents(st); }
  }
  let sig = ''; for (const S of st.S) sig += S.dead ? '1' : '0';
  if (sig !== rp.sig) { rp.sig = sig; V3.setBuildings(raidItems(st)); }
  V3.raid.sync(st, st.over ? 1 : Math.min(1, rp.acc / RAID_DT), dt, tNow);
  rpHudUpdate();
  if (st.over && !rp.ended) { rp.ended = true; setTimeout(() => { if (rp && rp.ended) { SND.sfx(Object.keys(rp.lr.res.lost).length ? 'defeat' : 'victory'); rpShowEnd(); } }, 1400); }
}
V3.onFrame((dt, tNow) => { djFrame(dt, tNow); rpFrame(dt, tNow); });

/* ---------- actions (réunies dans ACT par l'application) ---------- */
const ACT_RAID = {
  repair: () => { const r = act({ type: 'repair' }); if (r) toast(r.n + ' défense' + (r.n > 1 ? 's réparées' : ' réparée') + (r.left ? ' (il en reste ' + r.left + ' : ' + r.why.toLowerCase() + ')' : '.')); },
  upwalls: b => { const r = act({ type: 'upwalls', t: b.dataset.t, lvl: +b.dataset.l }); if (r) toast(r.n + ' amélioré' + (r.n > 1 ? 's' : '') + '.'); },
  gate: b => { if (act({ type: 'gate', id: +b.dataset.id })) toast('La palissade devient une porte : vos héros et vos villageois passent, pas les ennemis.'); },
  raidReplay: () => raidReplayStart(),
  rpQuit: () => raidReplayExit(),
  rpAgain: () => { if (!rp) return; V3.raid.exit(); rp = null; raidReplayStart(); },
  rpSpeed: () => { if (rp) rp.speed = rp.speed >= 4 ? 1 : rp.speed * 2; },
  portalLook: () => { const info = raidInfo(me, now()), p = info.p.find(q => !q.cl); if (!p) return; closeSheet(); if (gl) V3.focus(p.x + 0.5, p.y + 0.5); },
};

/* ===================== GARNISON : interface (caserne, soldats, postes de garde, orbes, bannières) =====================
   Les règles sont dans p2g_garnison.js (et le combat dans p2r_raid.js) ; ici, seulement ce qu'on voit et ce qu'on touche.
   Ce fichier ne fait que définir des fonctions et des actions (ACT_GAR) : l'application (p4_app) les appelle. */
let solSel = null;                               // soldat ouvert dans la fiche de la caserne
const SOL_ICO = { fant: 'shield', arch: 'arrow', lanc: 'sword', mage: 'flame' };
const solIco = type => djIco(SOL_ICO[type] || 'shield');
const orbChip = (key, n) => { const O = orbOf(key); return O ? `<span class="chip gemc"><i class="gdot round" style="background:${O.col}"></i>${n > 1 ? n + ' × ' : ''}${esc(O.name)} <span class="rtag rc${O.r}">${RARITY[O.r].name}</span></span>` : ''; };
const banChip = ban => banOk(ban) ? `<span class="chip"><span class="ic c-tro">${IC.flag}</span>${esc(BANNERS[ban.k].name)} <span class="rtag rc${ban.r}">${RARITY[ban.r].name}</span></span>` : '';
const postName = (v, b) => 'Poste ' + postNum(v, b);
function solStatus(v, s, t) {
  if (solHurt(s, t)) return 'blessé' + (s.sex === 'f' ? 'e' : '') + ' · de retour dans ' + fmtDur(s.hurt - t);
  const b = s.post && v.b.find(x => x.id === s.post);
  return b ? postName(v, b) : 'sans poste';
}
function solStatsTxt(S) {
  const p = ['vie ' + fmtN(S.hp), 'dégâts ' + String(S.dmg).replace('.', ','), 'armure ' + Math.round(S.armor * 100) + ' %'];
  if (S.dodge) p.push('esquive ' + Math.round(S.dodge * 100) + ' %');
  if (S.regen) p.push('récupère ' + String(S.regen).replace('.', ',') + ' % de vie par seconde');
  if (S.thorns) p.push('renvoie ' + Math.round(S.thorns * 100) + ' % des coups');
  return p.join(' · ');
}

/* ---------- la carte « Garnison » du menu Défense ---------- */
function garCardHTML(v) {
  const hl = hallLvl(v), cas = v.b.find(b => b.type === 'caserne'), t = now();
  if (!cas) return `<div class="item"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>${hl < 2 ? 'halle niveau 2' : 'pas encore de caserne'}</small></div>
    <p>Construisez la caserne pour recruter des soldats contre de l’or : pendant les raids, ils gardent chacun le cercle de leur poste de garde.</p>
    ${hl >= 2 ? `<div class="foot"><span class="chips2">${chipsRes(costOf('caserne', 1), v.r)}</span><button class="btn small${missingTxt(v, costOf('caserne', 1)) ? ' off' : ' primary'}" data-act="place" data-type="caserne">Construire la caserne</button></div>` : ''}</div>`;
  if (cas.lvl < 1) return `<div class="item"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>caserne en construction</small></div><p>Dès que la caserne sera finie, vous pourrez y recruter vos premiers soldats et poser un poste de garde.</p></div>`;
  const list = solList(v), hurt = list.filter(s => solHurt(s, t)).length, free = list.filter(s => !s.post).length, posts = postsOf(v), promo = list.filter(solCanPromote).length;
  const warn = [];
  if (!posts.length) warn.push('Posez un poste de garde : sans poste, les soldats restent à la caserne.');
  else if (free) warn.push(free + ' soldat' + (free > 1 ? 's' : '') + ' sans poste.');
  if (promo) warn.push(promo + ' soldat' + (promo > 1 ? 's peuvent' : ' peut') + ' monter de niveau.');
  return `<div class="item feature"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>${list.length} soldat${list.length > 1 ? 's' : ''} sur ${solCap(v)} · ${posts.length} poste${posts.length > 1 ? 's' : ''} sur ${postCap(v)}${hurt ? ' · ' + hurt + ' blessé' + (hurt > 1 ? 's' : '') : ''}</small></div>
    <p>${list.length ? 'Pendant les raids, chaque soldat garde le cercle de son poste, sans jamais en sortir.' : 'Recrutez vos premiers soldats à la caserne (contre de l’or).'}${warn.length ? ' <b>' + esc(warn.join(' ')) + '</b>' : ''}</p>
    <div class="row"><button class="btn small primary" data-act="sheet" data-s="caserne">${djIco('shield')}La caserne</button>${posts.length < postCap(v) ? `<button class="btn small" data-act="place" data-type="poste">Poser un poste <span class="sub">${chipsRes(costOf('poste', 1))}</span></button>` : ''}${posts.length && list.length ? '<button class="btn small" data-act="solAuto">Répartir</button>' : ''}</div></div>`;
}

/* ---------- la fiche de la caserne ---------- */
function solRow(v, s, t, on) {
  const ti = solTitle(s), need = solXpNeed(s.lvl);
  return `<button class="item opt srow${on ? ' on' : ''}" data-act="solSel" data-id="${s.id}">
    <div class="head"><span class="row">${solIco(s.type)}<b>${esc(solName(s))}</b>${ti ? `<span class="chip hero">${esc(ti[1])}</span>` : ''}${solCanPromote(s) ? '<span class="chip plus">▲ niveau</span>' : ''}</span><small>niveau ${s.lvl}</small></div>
    <p>${esc(solStatus(v, s, t))}${s.lvl < SOL_MAX_LVL ? ' · expérience ' + fmtN(Math.min(s.xp | 0, need)) + ' / ' + fmtN(need) : ''}</p></button>`;
}
function solDetail(v, s, t) {
  const post = s.post && v.b.find(x => x.id === s.post), S = solStats(s, post), f = forgeLvlOf(v), need = solXpNeed(s.lvl);
  let h = `<div class="item idet"><p><b>${esc(solStatsTxt(S))}</b>${SOLDIERS[s.type].range > 2 ? ' · tire à ' + String(SOLDIERS[s.type].range).replace('.', ',') + ' cases' : ''}</p>
    <p class="note">${esc(SOLDIERS[s.type].desc)} ${s.raids ? 'Raids tenus : ' + s.raids + ' · ennemis abattus : ' + (s.kills | 0) + '.' : 'Pas encore de raid.'} Repas : ${solEat(s)} rations par jour.</p>`;
  /* niveau */
  if (s.lvl < SOL_MAX_LVL) {
    const c = promoteCost(s.lvl), can = (s.xp | 0) >= need;
    h += `<div class="bar"><i style="width:${Math.min(100, (s.xp | 0) / need * 100).toFixed(0)}%"></i></div>
      <div class="foot"><span class="note">${can ? 'Prêt à monter au niveau ' + (s.lvl + 1) + (ORB_LVLS.includes(s.lvl + 1) ? ' (un emplacement d’orbe s’ouvre)' : '') : 'Expérience : ' + fmtN(s.xp | 0) + ' sur ' + fmtN(need) + '. Elle se gagne en tenant les raids.'}</span>
      ${can ? `<button class="btn small${missingTxt(v, c) ? ' off' : ' primary'}" data-act="promote" data-id="${s.id}">Niveau ${s.lvl + 1} <span class="sub">${chipsRes(c, v.r)}</span></button>` : ''}</div>`;
  } else h += '<p class="note">Niveau maximum atteint.</p>';
  const ti = solTitle(s), nx = SOL_TITLES.slice().reverse().find(x => (s.vet | 0) < x[0]);
  h += `<p class="note">${ti ? '<b>' + esc(ti[1]) + '</b> : +' + ti[2] + ' % de vie et de dégâts. ' : ''}Série : ${s.vet | 0} raid${(s.vet | 0) > 1 ? 's' : ''} sans tomber${nx ? ' (' + esc(nx[1].toLowerCase()) + ' à ' + nx[0] + ')' : ''}. Une chute remet la série à zéro.</p>`;
  /* poste */
  const posts = postsOf(v);
  h += `<div class="chips2"><span class="note">Poste :</span>${posts.map(b => { const n = guardsOf(v, b.id).length, mine = s.post === b.id; return `<button class="btn small${mine ? ' primary' : ''}${!mine && n >= POST_SLOTS ? ' off' : ''}" data-act="solPost" data-id="${s.id}" data-post="${b.id}" aria-pressed="${mine}">${esc(postName(v, b))} · ${n}/${POST_SLOTS}</button>`; }).join('')}<button class="btn small${s.post ? '' : ' primary'}" data-act="solPost" data-id="${s.id}" data-post="0" aria-pressed="${!s.post}">Aucun</button></div>`;
  if (!posts.length) h += '<p class="note">Pas encore de poste de garde : posez-en un depuis le menu Défense.</p>';
  /* équipement */
  h += `<div class="sec"><h4>Équipement</h4>`;
  if (!f) h += '<p class="note">Il faut une forge pour forger l’arme et l’armure des soldats.</p>';
  const w = s.w, a = s.a, mx = maxUpOf(f);
  const upBtn = (k, it) => !f || !it ? '' : (it.up | 0) >= 5 ? '<span class="note">au maximum</span>' : (it.up | 0) >= mx ? `<span class="note">+${(it.up | 0) + 1} : forge plus grande</span>` : `<button class="btn small${missingTxt(v, solImproveCost(it)) ? ' off' : ''}" data-act="solImprove" data-id="${s.id}" data-k="${k}">+${(it.up | 0) + 1} <span class="sub">${chipsRes(solImproveCost(it), v.r)}</span></button>`;
  h += `<div class="row split"><span><b>${w ? esc(solItemName(s, 'w')) : 'Pas d’arme'}</b>${w ? '<br><small class="note">+' + String(solWeaponDmg(w)).replace('.', ',') + ' % de dégâts</small>' : ''}</span><span class="row">${upBtn('w', w)}${f ? `<button class="btn small${missingTxt(v, solForgeCost('w', s.lvl)) ? ' off' : (w ? '' : ' primary')}" data-act="solForge" data-id="${s.id}" data-k="w">${w ? 'Reforger' : 'Forger'} (niv. ${s.lvl}) <span class="sub">${chipsRes(solForgeCost('w', s.lvl), v.r)}</span></button>` : ''}</span></div>`;
  h += `<div class="row split"><span><b>${a ? esc(solItemName(s, 'a')) : 'Pas d’armure'}</b>${a ? '<br><small class="note">+' + String(solArmorHp(a)).replace('.', ',') + ' % de vie · ' + esc(SOL_SETS[a.set].t) + '</small>' : ''}</span><span class="row">${upBtn('a', a)}</span></div>`;
  if (f) h += `<div class="chips2"><span class="note">${a ? 'Reforger' : 'Forger'} une armure (niv. ${s.lvl}, ${chipsRes(solForgeCost('a', s.lvl), v.r)}) :</span>${SOL_SET_KEYS.map(k => `<button class="btn small${missingTxt(v, solForgeCost('a', s.lvl)) ? ' off' : ''}${SOL_SETS[k].fit === s.type ? ' primary' : ''}" data-act="solForge" data-id="${s.id}" data-k="a" data-set="${k}" title="${esc(SOL_SETS[k].t)}">${esc(SOL_SETS[k].name)}<span class="sub">${esc(SOL_SETS[k].t)}</span></button>`).join('')}</div>`;
  if (f && (w || a)) h += '<p class="note">Reforger remplace l’ancienne pièce (fondue : elle rend un peu de fer).</p>';
  h += '</div>';
  /* orbes */
  const pool = Object.keys(v.orbs || {}).filter(k => v.orbs[k] > 0 && orbOf(k)).sort((x, y) => orbOf(y).r - orbOf(x).r || x.localeCompare(y));
  h += `<div class="sec"><h4>Orbes de défense</h4>`;
  ORB_LVLS.forEach((L, i) => {
    const cur = s.o && s.o['o' + i];
    if (s.lvl < L) { h += `<p class="note">Emplacement ${i + 1} : au niveau ${L}.</p>`; return; }
    if (orbOf(cur)) h += `<div class="row split"><span class="row">${orbChip(cur)}<small class="note">${esc(orbOf(cur).txt)}</small></span><button class="btn small" data-act="orbOff" data-id="${s.id}" data-s="${i}">Retirer</button></div>`;
    else h += `<div class="row split"><span class="note">Emplacement ${i + 1} libre</span></div>${pool.length ? `<div class="chips2">${pool.map(k => `<button class="btn small" data-act="orbSet" data-id="${s.id}" data-s="${i}" data-o="${k}" title="${esc(orbOf(k).txt)}">${orbChip(k, v.orbs[k])}</button>`).join('')}</div>` : ''}`;
  });
  if (s.lvl >= ORB_LVLS[0] && !pool.length) h += '<p class="note">Pas d’orbe en réserve : on en gagne en défense réussie et en donjon gagné.</p>';
  h += '</div>';
  h += `<div class="row"><button class="btn small" data-act="dismiss" data-id="${s.id}">Renvoyer</button></div></div>`;
  return h;
}
function sheetCaserne() {
  const v = me, t = now(), cas = caserneOf(v);
  if (!cas) {
    const site = v.b.find(b => b.type === 'caserne');
    return site ? '<p class="note">La caserne est en construction : les bâtisseurs y travaillent.</p>' : `<p class="note">Il faut d’abord construire la caserne (menu Construire, rubrique « Défense », halle niveau 2).</p>${hallLvl(v) >= 2 ? '<button class="btn primary" data-act="place" data-type="caserne">Construire la caserne</button>' : ''}`;
  }
  const list = solList(v), cap = solCap(v), posts = postsOf(v), hungry = (v.hunger || 0) > 0 || foodOf(v) < 1;
  let h = `<p class="note">Caserne de niveau ${cas.lvl} : <b>${list.length} soldat${list.length > 1 ? 's' : ''} sur ${cap}</b> · postes de garde : <b>${posts.length} sur ${postCap(v)}</b>${cas.lvl < 4 ? ' (agrandissez-la pour 3 soldats et un poste de plus)' : ''}. La garnison mange <b>${solFood(v)} rations par jour</b>. Bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.</p>`;
  if (hungry && list.length) h += '<p class="why">Plus rien à manger au village : vos soldats ont faim, ils frappent moins fort.</p>';
  /* recruter */
  if (list.length < cap) {
    const c = recruitCost(v), miss = missingTxt(v, c);
    h += `<div class="sec"><h4>Recruter · ${chipsRes(c, v.r)}</h4>`;
    for (const k of SOL_TYPES) {
      const S = SOLDIERS[k];
      h += `<div class="item"><div class="troop"><span class="tico">${solIco(k)}</span><div style="display:grid;gap:4px"><div class="head"><b>${esc(S.name)}</b><small>vie ${S.hp} · dégâts ${S.dmg}${S.range > 2 ? ' · tire à ' + String(S.range).replace('.', ',') + ' cases' : ''}</small></div><p>${esc(S.desc)}</p></div></div>
        <div class="foot"><span class="note">${list.filter(s => s.type === k).length ? list.filter(s => s.type === k).length + ' dans la garnison' : ''}</span><button class="btn small${miss ? ' off' : ' primary'}" data-act="recruit" data-t="${k}">Recruter</button></div></div>`;
    }
    h += '</div>';
  } else h += `<p class="note">${cap >= 12 ? 'La garnison est complète (12 soldats).' : 'La caserne est pleine : agrandissez-la pour recruter plus.'}</p>`;
  /* les soldats */
  if (list.length) {
    h += `<div class="sec"><h4>Les soldats</h4>`;
    for (const s of list) { h += solRow(v, s, t, solSel === s.id); if (solSel === s.id) h += solDetail(v, s, t); }
    h += '</div>';
  }
  /* les postes */
  h += `<div class="sec"><h4>Postes de garde</h4>`;
  if (!posts.length) h += '<p class="note">Aucun pour l’instant. Un poste garde un cercle autour de lui : placez-le sur le chemin des gobelins (près des portes, de la halle, de l’entrepôt).</p>';
  for (const b of posts) {
    const gs = guardsOf(v, b.id);
    h += `<div class="item"><div class="head"><b class="row"><span class="ic c-tro">${IC.flag}</span>${esc(postName(v, b))} · ${esc(lvlName(b).toLowerCase())}</b><small>cercle de ${postR(b)} cases · ${gs.length}/${POST_SLOTS} gardes</small></div>
      <p>${gs.length ? gs.map(s => esc(solName(s)) + (solHurt(s, t) ? ' (blessé' + (s.sex === 'f' ? 'e' : '') + ')' : '')).join(', ') : 'Personne pour l’instant.'}</p>
      ${banOk(b.ban) ? `<div class="chips2">${banChip(b.ban)}<small class="note">${esc(banTxt(b.ban))}</small></div>` : ''}
      <div class="row"><button class="btn small" data-act="postLook" data-id="${b.id}">Voir sur la carte</button></div></div>`;
  }
  h += `<div class="row">${posts.length && list.length ? '<button class="btn small primary" data-act="solAuto">Répartir tout le monde</button>' : ''}${posts.length < postCap(v) ? `<button class="btn small" data-act="place" data-type="poste">Poser un poste <span class="sub">${chipsRes(costOf('poste', 1))}</span></button>` : ''}</div>`;
  if (posts.length) h += '<p class="note">« Répartir » met un peu de chaque type à chaque poste. Touchez un poste sur la carte pour choisir ses gardes et sa bannière.</p>';
  h += '</div>';
  /* orbes en réserve */
  const ok = Object.keys(v.orbs || {}).filter(k => v.orbs[k] > 0 && orbOf(k)).sort((x, y) => x.localeCompare(y));
  h += `<div class="sec"><h4>Orbes en réserve</h4>${ok.length ? `<div class="chips2">${ok.map(k => orbChip(k, v.orbs[k])).join('')}</div>` : '<p class="note">Aucune pour l’instant : une défense réussie (rien volé) en rapporte, un donjon gagné parfois.</p>'}`;
  const fus = ok.filter(k => v.orbs[k] >= 3 && orbOf(k).r < 4);
  h += fus.map(k => { const O = orbOf(k), c = { or: ORB_FUSE[O.r] }; return `<div class="row split"><span class="note">3 × ${esc(orbLabel(k))} → ${esc(RARITY[O.r + 1].name.toLowerCase())}</span><button class="btn small${missingTxt(v, c) ? ' off' : ' primary'}" data-act="orbFuse" data-o="${k}">Fusionner <span class="sub">${chipsRes(c, v.r)}</span></button></div>`; }).join('');
  if (ok.length) h += '<p class="note">Les orbes se sertissent dans les soldats (emplacements aux niveaux 4, 8 et 12) : touchez un soldat. Trois orbes pareilles se fusionnent en une de la rareté suivante.</p>';
  h += '</div>';
  /* bannières en réserve */
  const bans = Object.values(v.bans || {}).filter(banOk).sort((x, y) => y.r - x.r);
  h += `<div class="sec"><h4>Bannières en réserve</h4>${bans.length ? bans.map(ban => `<div class="row split"><span class="row">${banChip(ban)}<small class="note">${esc(banTxt(ban))}</small></span><button class="btn small" data-act="banSell" data-ban="${ban.id}">Vendre <span class="sub">${ico('or')}${banPrice(ban)}</span></button></div>`).join('') + '<p class="note">Pour poser une bannière, touchez un poste de garde sur la carte.</p>' : '<p class="note">Aucune pour l’instant : le gardien du portail en laisse souvent une, les Profondeurs aussi (5 étages ou plus).</p>'}</div>`;
  /* aide */
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>On recrute contre de l’or : 4 types de soldats. Un soldat ne travaille pas et n’a pas besoin de maison, mais il mange (un peu plus à chaque niveau).</li>
    <li>Pendant un raid, chaque soldat garde le cercle de son poste, sans jamais en sortir : fantassins et lanciers devant, du côté du portail ; archers et mages derrière.</li>
    <li>Ceux qui tiennent gagnent de l’expérience ; c’est vous qui les faites monter de niveau (jusqu’au 15), contre de l’or et de la viande (et du fer à partir du niveau 5).</li>
    <li>Un soldat abattu est blessé : 8 heures de repos à la caserne, sans rien perdre, sauf sa série de raids. 5 raids de suite sans tomber : Vétéran ; 10 : Briscard ; 20 : Héros de la garde.</li>
    <li>À la forge : une arme et une armure complète par soldat (chaque armure a son bonus d’ensemble), améliorables jusqu’à +5.</li>
    <li>Orbes (3 emplacements, aux niveaux 4, 8 et 12) et bannières (une par poste, pour tous ses gardes) se gagnent en défense réussie et en donjon.</li></ul></div>`;
  return h;
}

/* ---------- panneau d'un poste de garde (touché sur la carte) ---------- */
function postPanel(v, b) {
  const t = now(), gs = guardsOf(v, b.id), d = BLD.poste, hl = hallLvl(v);
  let h = `<div class="glass card"><h3><span class="row"><span class="ic c-tro">${IC.flag}</span>${esc(postName(v, b))}</span><span class="row"><small>${esc(lvlName(b).toLowerCase())} · ${postR(b)} cases</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>`;
  h += `<div class="workers">${gs.map(s => `<span class="chip wk">${esc(solName(s))} <b>niv. ${s.lvl}</b>${solHurt(s, t) ? ' <small class="note">blessé' + (s.sex === 'f' ? 'e' : '') + '</small>' : ''}<button class="xs" data-act="solPost" data-id="${s.id}" data-post="0" aria-label="Retirer ${esc(solName(s))}">×</button></span>`).join('')}
    ${gs.length ? '' : '<span class="note">Pas encore de garde.</span>'}</div>`;
  if (gs.length < POST_SLOTS) {
    const cand = solList(v).filter(s => s.post !== b.id).sort((x, y) => (x.post ? 1 : 0) - (y.post ? 1 : 0) || x.n - y.n);
    if (cand.length) h += `<div class="chips2"><span class="note">Ajouter :</span>${cand.slice(0, 6).map(s => `<button class="btn small" data-act="solPost" data-id="${s.id}" data-post="${b.id}" title="${esc(solStatus(v, s, t))}">${solIco(s.type)}${esc(solName(s))}</button>`).join('')}${cand.length > 6 ? '<button class="btn small" data-act="sheet" data-s="caserne">Tous…</button>' : ''}</div>`;
    else if (!solList(v).length) h += `<p class="note">Recrutez des soldats à la caserne.</p>`;
  } else h += `<p class="note">Poste complet (${POST_SLOTS} gardes).</p>`;
  /* bannière */
  const pool = Object.values(v.bans || {}).filter(banOk).sort((x, y) => y.r - x.r);
  if (banOk(b.ban)) h += `<div class="row split"><span class="row">${banChip(b.ban)}<small class="note">${esc(banTxt(b.ban))} (tous ses gardes)</small></span><button class="btn small" data-act="banOff" data-id="${b.id}">Retirer</button></div>`;
  else h += `<p class="note">Pas de bannière.${pool.length ? '' : ' Le gardien du portail en laisse souvent une.'}</p>`;
  if (pool.length) h += `<div class="chips2"><span class="note">${banOk(b.ban) ? 'Changer :' : 'Poser :'}</span>${pool.slice(0, 6).map(ban => `<button class="btn small" data-act="banSet" data-id="${b.id}" data-ban="${ban.id}" title="${esc(banTxt(ban))}">${banChip(ban)}</button>`).join('')}</div>`;
  /* améliorer */
  const to = b.lvl + 1;
  if (to <= d.max) {
    if (to > maxLvlOf('poste', hl)) h += '<p class="note">Agrandissez d’abord la halle du village pour aller plus loin.</p>';
    else { const c = costOf('poste', to), miss = missingTxt(v, c); h += `<div class="row split"><span class="note">${esc(d.lvlNames[to - 1])} : cercle de ${d.zone[to - 1]} cases</span><span class="row"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn small${miss ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">Améliorer</button></span></div>`; }
  } else h += '<p class="note">Niveau maximum atteint.</p>';
  h += `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button><button class="btn small" data-act="demolish" data-id="${b.id}">Retirer</button><button class="btn small" data-act="sheet" data-s="caserne">${djIco('shield')}La caserne</button></div>`;
  return h + '</div>';
}
/* Un soldat touché sur la carte */
function solPersonPanel(v, sid) {
  const s = v.sol && v.sol[sid]; if (!s) return '';
  const t = now(), ti = solTitle(s);
  return `<div class="glass card"><h3><span class="row">${solIco(s.type)}${esc(solName(s))}</span><span class="row"><small>niveau ${s.lvl}${ti ? ' · ' + esc(ti[1].toLowerCase()) : ''}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>
    <p class="note">${esc(solStatus(v, s, t))} · ${esc(solStatsTxt(solStats(s, s.post && v.b.find(x => x.id === s.post))))}</p>
    <div class="row"><button class="btn small primary" data-act="solOpen" data-id="${s.id}">Sa fiche à la caserne</button></div></div>`;
}

/* ---------- au village : les soldats debout à leur poste (même formation qu'au raid), les autres à la caserne ---------- */
function solVillageSpots(v, t) {
  const out = new Map(), posts = postsOf(v); if (!posts.length || !v.sol) return out;
  const occ = new Uint8Array(GRID * GRID);
  for (const b of v.b) {
    const d = BLD[b.type]; if (!d || d.def === 'trap' || d.def === 'post' || b.type === 'porte' || b.type === 'marchand' || isBroken(b)) continue;
    for (let i = 0; i < d.size; i++) for (let j = 0; j < d.size; j++) { const x = b.gx + i, z = b.gz + j; if (x >= 0 && z >= 0 && x < GRID && z < GRID) occ[z * GRID + x] = 1; }
  }
  const blocked = (cx, cy) => cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || !!occ[cy * GRID + cx];
  const open = raidInfo(v, t).p.filter(p => !p.cl), hall = v.b.find(b => b.type === 'halle');
  for (const b of posts) {
    const gs = solList(v).filter(s => s.post === b.id && !solHurt(s, t)); if (!gs.length) continue;
    const P0 = { x: b.gx + 0.5, y: b.gz + 0.5, r: postR(b) };
    let dx = 0, dy = -1, bd = 1e18;
    if (open.length) { for (const p of open) { const ex = p.x + 0.5 - P0.x, ey = p.y + 0.5 - P0.y, d2 = ex * ex + ey * ey; if (d2 < bd && d2 > 1e-6) { bd = d2; const L = Math.sqrt(d2); dx = ex / L; dy = ey / L; } } }
    else if (hall) { const ex = P0.x - (hall.gx + BLD.halle.size / 2), ey = P0.y - (hall.gz + BLD.halle.size / 2), L = Math.sqrt(ex * ex + ey * ey); if (L > 1e-6) { dx = ex / L; dy = ey / L; } }
    const sp = solFormation(P0, gs.map(s => s.type), dx, dy, blocked);
    gs.forEach((s, i) => out.set(s.id, { x: sp[i][0], y: sp[i][1], fx: dx, fy: dy }));
  }
  return out;
}
function solPeople(v) {
  if (!v.sol) return [];
  const t = now(), cas = caserneOf(v), spots = solVillageSpots(v, t), out = [];
  for (const s of solList(v)) {
    const sp = spots.get(s.id);
    out.push({ key: 'g' + s.id, kind: 'sol', race: s.race, sex: s.sex, type: s.type, name: solName(s), at: sp || !cas ? null : 'm' + cas.id, fixed: sp ? [sp.x, sp.y] : null, face: sp ? [sp.fx, sp.fy] : null, hurt: solHurt(s, t) });
  }
  return out;
}
/* Cercles des postes : celui du poste choisi (ou en cours de pose), tous quand la caserne est choisie. */
let ringSig = '';
function postRings(v, editable) {
  const rings = [], selB = editable && sel != null && !place ? v.b.find(x => x.id === sel) : null;
  if (selB && (selB.type === 'poste' || selB.type === 'caserne')) for (const b of postsOf(v)) if (selB.type === 'caserne' || b.id === selB.id) rings.push({ x: b.gx + 0.5, z: b.gz + 0.5, r: postR(b) });
  if (editable && place && place.type === 'poste') { const pb = place.kind === 'move' ? v.b.find(x => x.id === place.id) : null; rings.push({ x: place.gx + 0.5, z: place.gz + 0.5, r: pb ? postR(pb) : BLD.poste.zone[0] }); }
  const sig = rings.map(r => r.x + ',' + r.z + ',' + r.r).join(';');
  if (sig !== ringSig) { ringSig = sig; V3.showRanges(rings.length ? rings : null); }
}

/* ---------- actions (réunies dans ACT par l'application) ---------- */
const ACT_GAR = {
  recruit: b => { const r = act({ type: 'recruit', t: b.dataset.t }); if (r) { solSel = r.id; toast(r.name + ' rejoint la garnison' + (r.post ? ' (' + postName(me, me.b.find(x => x.id === r.post) || { id: 0 }) + ').' : ' : posez un poste de garde pour lui donner un cercle à garder.')); } },
  solSel: b => { solSel = solSel === b.dataset.id ? null : b.dataset.id; renderAll(); },
  solOpen: b => { solSel = b.dataset.id; sel = null; selP = null; refreshScene(); openSheet('caserne'); },
  solPost: b => { const s = me.sol && me.sol[b.dataset.id], to = +b.dataset.post; if (act({ type: 'solPost', sid: b.dataset.id, post: to }) && s) toast(solName(s) + (to ? ' garde le ' + postName(me, me.b.find(x => x.id === to) || { id: to }).toLowerCase() + '.' : ' quitte son poste.')); },
  solAuto: () => { const r = act({ type: 'solAuto' }); if (r) toast(r.n + ' soldat' + (r.n > 1 ? 's répartis' : ' réparti') + ' sur ' + r.p + ' poste' + (r.p > 1 ? 's' : '') + '.'); },
  promote: b => { const s = me.sol && me.sol[b.dataset.id], r = act({ type: 'promote', sid: b.dataset.id }); if (r && s) toast(solName(s) + ' passe au niveau ' + r.lvl + (r.orb ? ' : un emplacement d’orbe s’ouvre !' : '.')); },
  dismiss: b => { const s = me.sol && me.sol[b.dataset.id]; if (!s || !confirm('Renvoyer ' + solName(s) + ' (niveau ' + s.lvl + ') ? Ses orbes retournent dans la réserve, son équipement est fondu.')) return; if (act({ type: 'dismiss', sid: s.id })) { solSel = null; toast(solName(s) + ' quitte la garnison.'); } },
  solForge: b => {
    const s = me.sol && me.sol[b.dataset.id], k = b.dataset.k; if (!s) return;
    if (s[k] && !confirm('Forger une nouvelle pièce ? L’ancienne (' + solItemName(s, k) + ') sera fondue.')) return;
    const r = act({ type: 'solForge', sid: s.id, k, set: b.dataset.set }); if (r) toast('Forgé pour ' + solName(s) + ' : ' + r.name + (r.back ? ' (+' + r.back + ' fer de l’ancienne)' : '') + '.');
  },
  solImprove: b => { const r = act({ type: 'solImprove', sid: b.dataset.id, k: b.dataset.k }); if (r) toast('Amélioré : +' + r.up + '.'); },
  orbSet: b => { const r = act({ type: 'orbSet', sid: b.dataset.id, s: +b.dataset.s, o: b.dataset.o }); if (r) toast(r.name + ' sertie.'); },
  orbOff: b => { if (act({ type: 'orbOff', sid: b.dataset.id, s: +b.dataset.s })) toast('L’orbe retourne dans la réserve.'); },
  orbFuse: b => { const r = act({ type: 'orbFuse', o: b.dataset.o }); if (r) toast('Fusion réussie : ' + r.name + ' !'); },
  banSet: b => { const r = act({ type: 'banSet', id: +b.dataset.id, ban: b.dataset.ban }); if (r) toast(r.name + ' flotte sur le poste.'); },
  banOff: b => { if (act({ type: 'banOff', id: +b.dataset.id })) toast('La bannière retourne dans la réserve.'); },
  banSell: b => { const ban = me.bans && me.bans[b.dataset.ban]; if (!ban || (ban.r >= 2 && !confirm('Vendre ' + banLabel(ban) + ' pour ' + banPrice(ban) + ' or ?'))) return; const r = act({ type: 'banSell', ban: ban.id }); if (r) toast('+' + r.gain + ' or pour la bourse commune.'); },
  postLook: b => { const p = me.b.find(x => x.id === +b.dataset.id); if (!p) return; closeSheet(true); sel = p.id; selP = null; if (gl) V3.focus(p.gx + 0.5, p.gz + 0.5); refreshScene(); renderAll(); },
};

/* ===================== CONSEILS AU BON MOMENT =====================
   Une petite carte en bas de l'écran (à la place d'un panneau, quand rien n'est sélectionné), une seule fois par conseil
   et par téléphone (mémoire locale « mk2.tips »). Un conseil à la fois, jamais pendant un donjon, une fenêtre ou un menu.
   On peut les couper ou les faire revenir (menu Village, Affichage). Ce fichier ne fait que définir : p4_app appelle
   tipCheck() à chaque seconde et tipHTML() dans le bas de l'écran. */
const TIP_GAP = 25000;                                      // au moins 25 s entre deux conseils
const tipStart = Date.now();
let tipCur = null, tipNext = tipStart + 12000;
/* Dans les essais du navigateur, les conseils sont coupés (sauf si l'essai les rallume) : ils cacheraient des boutons. */
const tipOn = () => { const o = LS.get('mk2.tipsOff'); return o == null ? !window.MK_TEST : o !== 1; };
const tipSeen = () => { const s = LS.get('mk2.tips'); return Array.isArray(s) ? s : []; };
function tipMark(id) { const s = tipSeen(); if (!s.includes(id)) { s.push(id); LS.set('mk2.tips', s.slice(-80)); } }
const tipHero = v => activeHero(v, uid);
const tipBag = v => (v.bag && v.bag[uid] && v.bag[uid].it) || {};
const tipAge = v => (v.t || 0) - (v.born || 0);
/* Dans l'ordre : d'abord l'urgent, puis ce qu'il y a à faire, puis les découvertes. go = menu ouvert par le bouton. */
const TIPS = [
  { id: 'source', ic: 'star', go: 'donjon', btn: 'Donjon', when: v => !v.lilou && !!tipHero(v) && Date.now() - tipStart > 20000,
    txt: 'Une lueur maléfique monte de la vieille mine… Allons voir ça : menu Donjon, « La Source du Mal ». C’est court, et je te guide.' },
  { id: 'faim', ic: 'pain', go: 'build', btn: 'Construire', when: v => v.vil.length > 0 && ((v.hunger || 0) > 0 || foodOf(v) < 1),
    txt: 'Le village a faim ! Et un village qui a faim regarde le chat d’un drôle d’air. Champs, chasse, moulin, boulangerie : au travail.' },
  { id: 'portail', ic: 'flame', go: 'defense', btn: 'Défense', when: v => raidInfo(v, now()).p.some(p => !p.cl),
    txt: 'Ça sent le soufre : un portail démoniaque s’ouvre au bord de la vallée ! Une fois chargé, des gobelins passeront dès que personne n’aura joué depuis 2 heures. Prépare tes défenses, ou va le refermer avec ton héros.' },
  { id: 'ruines', ic: 'shield', go: 'defense', btn: 'Défense', when: v => v.b.some(b => isDef(b) && repairCostOf(b)),
    txt: 'Des défenses sont en miettes. Répare-les toutes d’un coup dans le menu Défense, les ruines d’abord.' },
  { id: 'lilouBoude', ic: 'heart', go: 'lilou', btn: 'Sa chambre', when: v => !!v.lilou && lilouMood(v.lilou).mul > 1,
    txt: 'Lilou boude… Un caprice oublié, je parie. Et quand elle boude, les monstres frappent plus fort. Passe dans sa chambre.' },
  { id: 'leger', ic: 'star', go: 'village', btn: 'Réglages', when: () => gl && !gfxLight() && Date.now() - tipStart > 30000 && V3.fps() < 18,
    txt: 'Le jeu rame sur ce téléphone ? Essaie les graphismes légers (menu Village, Affichage) : moins joli, sans ombres, mais bien plus fluide. Comme moi après la sieste.' },
  { id: 'points', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.sp > 0; },
    txt: 'Ton héros a un point de compétence à dépenser (menu Héros, bouton +1). À ta place, je ne le garderais pas sous le coussin.' },
  { id: 'caprice', ic: 'heart', go: 'lilou', btn: 'Sa chambre', when: v => !!(v.lilou && v.lilou.d && !v.lilou.d.ok),
    txt: 'Lilou a un caprice aujourd’hui. On le fabrique dans sa chambre, avec les ressources du village. Contente, les monstres frappent moins fort.' },
  { id: 'chambreRaid', ic: 'shield', go: 'defense', btn: 'Défense', when: v => crownRaidOn(v),
    txt: 'Les gobelins savent où dort Lilou : pendant les raids, la moitié d’entre eux visera sa chambre. Une palissade autour, un piège sur le chemin ou un poste de garde à côté, et ils y réfléchiront à deux fois.' },
  { id: 'faille', ic: 'flame', go: 'donjon', btn: 'Donjon', when: v => crownCan(v, 'portail', 1, 0, true) >= 0 && !raidInfo(v, now()).p.some(p => !p.cl),
    txt: 'Pas de portail démoniaque ouvert ? Il y a une faille vers l’abîme au fond de la vieille mine : menu Donjon, la couronne. Le gardien du portail t’y attend.' },
  { id: 'recrue', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => caserneLvl(v) > 0 && !solList(v).length,
    txt: 'La caserne est prête : recrute tes premiers soldats contre de l’or. Fantassins et lanciers devant, archers et mages derrière. Moi, je garde le coussin.' },
  { id: 'poste', ic: 'flag', go: 'build', btn: 'Construire', when: v => solList(v).length > 0 && !postsOf(v).length,
    txt: 'Tes soldats attendent un poste de garde (Construire, rubrique Défense) : pendant un raid, ils défendent le cercle autour de lui.' },
  { id: 'sansposte', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => postsOf(v).length > 0 && solList(v).some(s => !s.post),
    txt: 'Des soldats se tournent les pouces, sans poste : à la caserne, « Répartir » les place tous d’un coup.' },
  { id: 'promo', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => solList(v).some(solCanPromote),
    txt: 'Un soldat a assez d’expérience pour monter de niveau : promeus-le à la caserne. Il frappera plus fort (et il sera insupportable de fierté).' },
  { id: 'mieux', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => { const h = tipHero(v); return !!h && Object.values(tipBag(v)).some(it => compareItem(h, it) === 1); },
    txt: 'Un objet de ton sac est meilleur que ce que porte ton héros (flèche verte ▲). Équipe-le, voyons !' },
  { id: 'sac', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => Object.keys(tipBag(v)).length >= bagMax(v) - 3,
    txt: 'Ton sac déborde ! Vends ou fonds ce qui ne sert plus : quand il est plein, les nouveaux objets sont vendus d’office.' },
  { id: 'plein', ic: 'bois', go: 'build', btn: 'Construire', when: v => ['bois', 'pierre'].some(k => (v.r[k] || 0) >= capOf(v) - 1),
    txt: 'Les réserves débordent : ce qui est produit en plus est perdu. Il faut un entrepôt, ou en agrandir un.' },
  { id: 'oisifs', ic: 'people', go: 'people', btn: 'Villageois', when: v => tipAge(v) > 20 * 60000 && v.vil.some(p => p.job == null),
    txt: 'Un villageois se tourne les pouces. Touche-le (ou ouvre le menu Villageois) pour lui donner un métier.' },
  { id: 'donjon1', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!v.lilou && !!h && !(h.dj > 1) && (h.wins | 0) === 0 && Date.now() - tipStart > 90000; },
    txt: 'La mine des gobelins t’attend (menu Donjon) : chaque victoire ouvre le niveau suivant. Ton héros attaque tout seul, toi tu le guides.' },
  { id: 'defense', ic: 'shield', go: 'defense', btn: 'Défense', when: v => !(v.raid && v.raid.n) && tipAge(v) > 36 * 3600000,
    txt: 'À partir du 3e jour, des gobelins peuvent attaquer pendant ton absence. Palissades, portes, tours et pièges : tout est dans le menu Défense.' },
  { id: 'forge', ic: 's_anvil', go: 'forge', btn: 'La forge', when: v => forgeLvlOf(v) > 0,
    txt: 'La forge est prête : fabrique de l’équipement, améliore-le jusqu’à +5, sertis des pierres, ou fonds ce qui ne sert plus pour récupérer du fer.' },
  { id: 'marchand', ic: 'or', go: 'merch', btn: 'Voir', when: v => merchHere(v, now()),
    txt: 'Le marchand ambulant est sur la place jusqu’à demain, avec des objets à vendre contre de l’or. Il sent le poisson : je l’aime bien.' },
  { id: 'crypte', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.crypte; },
    txt: 'La crypte des rois est ouverte : squelettes, spectres, nécromants qui relèvent les morts, et le roi squelette au fond. Brrr.' },
  { id: 'prof', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.prof; },
    txt: 'Les Profondeurs sont ouvertes : des étages sans fin, de plus en plus durs. À chaque étage, tu choisis : descendre, ou remonter avec tout le butin.' },
  { id: 'familier', ic: 's_paw', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= PET_LVL && !h.pet; },
    txt: 'Ton héros peut adopter un familier (menu Héros) : loup, faucon, sanglier ou chouette. Pas de chat ? Je suis déjà prise.' },
  { id: 'spec', ic: 'star', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= SPEC_LVL && h.spec == null; },
    txt: 'Niveau 10 ! Choisis la spécialisation de ton héros, une voie sur deux, pour de bon (menu Héros).' },
  { id: 'heros2', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const n = heroesOf(v, uid).length; return n > 0 && n < heroSlots(v); },
    txt: 'La taverne peut loger un héros de plus : recrute-le dans le menu Héros. Pendant que l’un part en donjon, les autres travaillent au village.' },
  { id: 'automne', ic: 's2', go: 'stock', btn: 'Réserves', when: v => seasonIdx(v, now()) === 2,
    txt: 'L’automne est là : dans 2 jours, l’hiver arrêtera les champs. Faites des réserves de pain et de viande.' },
  { id: 'hiver', ic: 's3', when: v => seasonIdx(v, now()) === 3,
    txt: 'L’hiver. Les champs dorment, la chasse rapporte moins, et le village vit sur ses réserves. Moi, je dors aussi.' },
  { id: 'inviter', ic: 'link', go: 'village', btn: 'Inviter', when: v => !partnerId(v) && tipAge(v) > 24 * 3600000,
    txt: 'Envie de jouer à deux ? Envoie le lien d’invitation (menu Village) : ta partenaire arrivera dans ton village, avec tout ce que tu as construit.' },
  { id: 'chronique', ic: 'scroll', go: 'chron', btn: 'La lire', when: v => (v.chron || []).length >= 8,
    txt: 'Le village a sa chronique : tous vos grands moments y sont écrits (menu Village). J’y suis citée au moins trois fois. Au moins.' },
];
function tipTest(T) { try { return !!T.when(me); } catch (e) { return false; } }
function tipClose(seen) { if (tipCur && seen) tipMark(tipCur.id); tipCur = null; tipNext = Date.now() + TIP_GAP; }
/* Appelé à chaque seconde. */
function tipCheck() {
  if (!me || !tipOn()) { tipCur = null; return; }
  if (mode !== 'home' || modal || place || dj) { tipNext = Math.max(tipNext, Date.now() + 6000); return; }
  if (tipCur) { if (!tipTest(tipCur)) { tipCur = null; tipNext = Date.now() + 8000; } return; }   // plus d'actualité : on le garde pour plus tard
  if (sheet || Date.now() < tipNext) return;
  const seen = tipSeen();
  const T = TIPS.find(x => !seen.includes(x.id) && tipTest(x));
  if (T) { tipCur = T; SND.sfx('tip'); }
}
function tipHTML() {
  const T = tipCur; if (!T || !tipOn()) return '';
  return `<div class="glass card tip" role="status" aria-label="Conseil de Sukhoï"><p class="tiptxt">${sukFace()}<span><b>Sukhoï&nbsp;:</b> ${esc(T.txt)}</span></p>
    <div class="row">${T.go ? `<button class="btn small primary grow" data-act="tipGo">${esc(T.btn)}</button>` : ''}<button class="btn small grow" data-act="tipOk">Compris</button></div></div>`;
}
const ACT_TIP = {
  tipOk: () => { tipClose(true); renderAll(); },
  tipGo: () => {
    const T = tipCur; tipClose(true); if (!T || !T.go) { renderAll(); return; }
    const h = activeHero(me, uid);
    openSheet(T.go, T.go === 'hero' && T.id !== 'heros2' && h ? h.id : undefined);
  },
  tipsToggle: () => { const on = !tipOn(); LS.set('mk2.tipsOff', on ? 0 : 1); if (!on) tipCur = null; else tipNext = Date.now() + 4000; renderAll(); },
  tipsReset: () => { LS.set('mk2.tips', []); LS.set('mk2.tipsOff', 0); tipCur = null; tipNext = Date.now() + 4000; toast('Les conseils reviendront, chacun au bon moment.'); renderAll(); },
};

/* ===================== L'HISTOIRE (lot A) : interface =====================
   Sukhoï la narratrice (sa bulle et son portrait), la mission « La Source du Mal » (entrée, bulles du donjon guidé, bilan),
   l'arrivée de Lilou, sa chambre (humeur, caprices, berceuse) et ses petits mots. Ce fichier ne fait que définir :
   p4_app et p4d_donjon appellent ces fonctions. */
/* Sukhoï : une chatte grise, la tache blanche sur la poitrine, une vieille cicatrice de guerre au-dessus de l'œil. */
const SUK_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 21 7 6l12 8M39 21l2-15-12 8" fill="#7d838b"/><path d="M10.5 18 9.6 9.5l6.4 4.4M37.5 18l.9-8.5-6.4 4.4" fill="#e9b7b9"/>'
  + '<ellipse cx="24" cy="25" rx="16" ry="14" fill="#8b9097"/><path d="M15 36c3 7 15 7 18 0-5 2-13 2-18 0z" fill="#f4f1ea"/>'
  + '<ellipse cx="17.5" cy="24" rx="3.2" ry="3.6" fill="#d6e36a"/><ellipse cx="30.5" cy="24" rx="3.2" ry="3.6" fill="#d6e36a"/>'
  + '<ellipse cx="17.5" cy="24.4" rx="1.1" ry="3" fill="#2a2a2a"/><ellipse cx="30.5" cy="24.4" rx="1.1" ry="3" fill="#2a2a2a"/>'
  + '<path d="M26.5 15.5 33 22" stroke="#5c5f64" stroke-width="1.4" stroke-linecap="round"/><path d="M22.4 29.2h3.2L24 31z" fill="#e58a95"/>'
  + '<path d="M24 31v1.6M24 32.6c-1.2 1.4-3 1.4-4 .3M24 32.6c1.2 1.4 3 1.4 4 .3" stroke="#4a4d52" stroke-width="1" fill="none" stroke-linecap="round"/>'
  + '<path d="M13 29.5 4.5 28M13 31.5 5 33M35 29.5l8.5-1.5M35 31.5l8 1.5" stroke="#e8e8e8" stroke-width=".8" stroke-linecap="round"/></svg>';
const sukFace = cls => `<span class="sukface${cls ? ' ' + cls : ''}">${SUK_SVG}</span>`;
const sukBubble = (txt, extra) => `<div class="sukbub">${sukFace()}<div><b>Sukhoï</b><p>${esc(txt)}</p>${extra || ''}</div></div>`;
/* Les visages de Lilou selon son humeur (très simples) */
const LILOU_FACE = { colere: ['#e98a7a', 'M17 31q7-5 14 0', 'M14 19l6 3M34 19l-6 3'], grognon: ['#f0b39a', 'M18 31q6-3 12 0', 'M15 20h5M28 20h5'], calme: ['#f3cdb6', 'M18 30h12', ''], contente: ['#f3cdb6', 'M17 28q7 5 14 0', ''], ravie: ['#f6c9b0', 'M16 27q8 8 16 0z', ''] };
function lilouFace(k) {
  const F = LILOU_FACE[k] || LILOU_FACE.calme;
  return `<span class="lilface" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="16" fill="${F[0]}"/><path d="M14 16c2-9 18-11 21-2-4-3-6-1-8-4-3 3-8 1-13 6z" fill="#f2d27a"/>`
    + `<circle cx="18" cy="24" r="2.2" fill="#3f6fd0"/><circle cx="30" cy="24" r="2.2" fill="#3f6fd0"/><path d="${F[1]}" stroke="#a5523f" stroke-width="2" fill="${k === 'ravie' ? '#a5523f' : 'none'}" stroke-linecap="round"/>`
    + (F[2] ? `<path d="${F[2]}" stroke="#7a5a3a" stroke-width="1.8" stroke-linecap="round"/>` : '') + `</svg></span>`;
}
/* Les répliques de Sukhoï */
const SUK = {
  hello: 'Une lueur maléfique monte de la vieille mine, et des cris terribles en sortent chaque nuit. On m’appelait Sukhoï la Terrible, avant la Grande Bataille contre le Monstre de Fer… Va voir ce que c’est. Je te suis. De loin.',
  start: 'La mine de la Source du Mal. Ça sent le gobelin mouillé. Suis mes conseils et tout ira bien (ou presque).',
  tuto: {
    move: 'Pose le pouce à gauche de l’écran et fais quelques pas. Doucement : il y a des toiles d’araignée partout.',
    fight: 'Un gobelin ! Approche-toi : ton héros frappe tout seul. Moi, je surveille. De loin.',
    roll: 'Le cercle rouge ! Il va frapper : ROULE ! (le bouton Roulade, ou la barre d’espace)',
    potion: 'Ta vie baisse ! Bois une potion, le flacon rouge à droite.',
    skill: 'Touche ta compétence, le gros bouton à droite. Elle se recharge après chaque usage.',
    chest: 'Un coffre ! Marche dessus pour l’ouvrir. Si c’est du poisson, c’est pour moi.',
    cradle: 'Il est vaincu… La lueur vient de ce berceau, au fond. Approche-toi. Doucement.',
  },
  ok: {
    move: 'Voilà. Tu marches. Je suis fière de toi.',
    fight: 'Pas mal, pour un débutant.',
    roll: 'Joli saut ! J’en faisais des pareils, du temps de la Grande Bataille contre le Monstre de Fer.',
    potion: 'Ça va mieux ? Ne prends pas l’habitude.',
    skill: 'Ça, c’est de la magie… ou presque.',
    chest: 'Pas de poisson ? Tant pis.',
  },
  saved: 'Debout ! On ne meurt pas le premier jour. Sukhoï l’interdit.',
  found: 'Par mes moustaches… la Source du Mal… c’est un bébé ?! Elle s’appelle Lilou (c’est brodé sur sa couverture). Bon. On la ramène au village.',
  arrive: 'Lilou a sa chambre près de la halle, et moi ma place près du berceau. Chaque jour, elle aura un caprice ; chaque semaine, un gros. Contente, les monstres tapent moins fort. En colère… je préfère ne pas y penser. Si elle pleure la nuit, c’est toi qui te lèves.',
  mood: {
    colere: ['Elle hurle. J’ai connu des trolls plus calmes.', 'Les gobelins l’entendent de la mine. Ils tapent plus fort, rien que pour se venger.'],
    grognon: ['Elle boude. Un caprice oublié, je parie.', 'Elle me tire la queue. C’est mauvais signe.'],
    calme: ['Elle observe tout, très sérieuse. Comme moi.', 'Elle mâchouille son orteil. Tout va bien.'],
    contente: ['Elle gazouille. Même moi, j’ai envie de ronronner.', 'Elle rit quand je fais semblant de dormir. Je ne fais pas semblant.'],
    ravie: ['Ravie ! Les monstres sentent qu’ils n’ont aucune chance.', 'Elle rit si fort que les gobelins en perdent leurs moyens.'],
  },
  pet: ['Rrrrrr… Là, derrière l’oreille. Oui. Là.', 'Doucement, c’est ma vieille blessure de guerre.', 'Je ne ronronne pas. C’est le vent.', 'Une caresse, c’est bien. Un poisson, c’est mieux.', 'Si tu me grattes, je garde le bébé. Marché conclu.', 'Le Monstre de Fer m’a renversée une fois. Une seule. Il ne recommencera pas.'],
};
/* Le mot de Lilou au bilan d'un donjon, selon son humeur (petit plus c) */
const LILOU_WORDS = { colere: 'OUINNN ! (Elle n’a pas oublié son caprice.)', grognon: 'Mmmh… (Elle te tourne le dos.)', calme: 'Areuh. (Elle te regarde rentrer, très sérieuse.)', contente: 'Areuh ! (Elle te tend les bras.)', ravie: 'Hihihi ! (Elle t’accueille avec un immense sourire.)' };
const lilouLine = v => { const L = v && v.lilou; if (!L) return ''; const m = lilouMood(L), list = SUK.mood[m.k]; return list[Math.floor((now() / 60000) % list.length)]; };
const lilouEffect = m => m.mul === 1 ? 'les monstres frappent normalement' : 'les monstres frappent ' + Math.round(Math.abs(1 - m.mul) * 100) + ' % ' + (m.mul < 1 ? 'moins fort' : 'plus fort');

/* ---------- la mission : entrée dans le menu Donjon ---------- */
function sourceEntryHTML() {
  if (!me || me.lilou) return '';
  return `<div class="item feature story">${sukBubble('La lueur maléfique de la vieille mine… Il faut aller voir. C’est court, et je te guide.')}
    <div class="row split"><b class="row">${djIco('star')}La Source du Mal</b><small class="note">mission · environ 5 min</small></div>
    <button class="btn primary" data-act="djGo" data-th="source" data-k="1">${djIco('sword')}Partir à la Source du Mal</button></div>`;
}

/* ---------- le donjon guidé : la bulle de Sukhoï en bas de l'écran ---------- */
function djTutoEvent(e) {
  if (!dj || dj.st.d.theme !== 'source') return;
  if (e.k === 'tuto') { dj.tuto = { s: e.s, t: performance.now() }; SND.sfx('tip'); }
  else if (e.k === 'tutoOk') { if (SUK.ok[e.s]) dj.tutoOk = { txt: SUK.ok[e.s], t: performance.now() }; if (dj.tuto && dj.tuto.s === e.s) dj.tuto = null; }
  else if (e.k === 'saved' && e.id === dj.hid) { dj.tutoOk = { txt: SUK.saved, t: performance.now() }; SND.sfx('power'); }
  djTutoRender();
}
function djTutoRender() {
  const el = document.getElementById('djTuto'); if (!el || !dj) return;
  const nowT = performance.now(), praise = dj.tutoOk && nowT - dj.tutoOk.t < 2600 ? dj.tutoOk.txt : '';
  const txt = praise || (dj.tuto ? SUK.tuto[dj.tuto.s] : dj.st.t < 6 ? SUK.start : '');
  if (el._t !== txt) { el._t = txt; el.innerHTML = txt ? sukBubble(txt) : ''; el.hidden = !txt; }
  /* le bouton dont parle Sukhoï clignote doucement */
  const want = dj.tuto && !praise ? { skill: '[data-djsk="0"]', potion: '[data-djpot]', roll: '[data-djroll]' }[dj.tuto.s] : null;
  for (const b of document.querySelectorAll('#djHud .djsk.hint')) if (!want || !b.matches(want)) b.classList.remove('hint');
  if (want) { const b = document.querySelector('#djHud ' + want); if (b) b.classList.add('hint'); }
}

/* ---------- l'arrivée de Lilou (fenêtre au retour de la mission) ---------- */
function lilouArriveHTML() {
  const ch = me && me.b.find(b => b.type === 'chambre');
  return `<p class="eyebrow">La Source du Mal</p><div class="lilhead">${lilouFace('contente')}<h2>Lilou arrive au village</h2></div>
    ${sukBubble(SUK.arrive)}
    <div class="row">${ch ? '<button class="btn primary grow" data-act="lilouSee">Voir sa chambre</button>' : ''}<button class="btn grow" data-act="closeModal">${ch ? 'Plus tard' : 'Compris'}</button></div>`;
}
/* ---------- la chambre de Lilou (menu) ---------- */
function capRow(v, big) {
  const L = v.lilou, cap = big ? L.w : L.d; if (!cap) return '';
  const C = (big ? BIG_CAPRICES : CAPRICES)[cap.k]; if (!C) return '';
  const c = capCost(v, cap.k, big), miss = missingTxt(v, c), t = now(), left = (big ? lilouNextWeek(L) : lilouNextDay(L)) - t;
  const blocked = big && C.need && !C.need(v);
  return `<div class="item${cap.ok ? '' : ' feature'}"><div class="head"><b>${big ? 'Gros caprice de la semaine' : 'Caprice du jour'} : ${esc(C.name)}</b><small>${cap.ok ? (big ? 'offert' : 'fait') + ' ✓' : 'encore ' + fmtDur(left)}</small></div>
    <p>${esc(C.txt)}</p>${big && !cap.ok ? '<p class="note">Toute la vallée fera la fête : +' + LILOU.party + ' de moral pendant un jour.</p>' : ''}
    ${cap.ok ? `<p class="note">${big ? 'Prochain gros caprice' : 'Prochain caprice'} dans ${fmtDur(left)}.</p>`
      : `<div class="foot"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn small${miss || blocked ? ' off' : ' primary'}" data-act="lilouCap" data-w="${big ? 1 : 0}">${big ? 'Offrir' : 'Fabriquer'}</button></div>${blocked ? '<p class="why">' + esc(C.needTxt) + '</p>' : ''}`}</div>`;
}
function sheetLilou() {
  const v = me, L = v.lilou;
  if (!L) return `<p class="note">Lilou n’est pas encore au village.</p>${sourceEntryHTML()}`;
  const m = lilouMood(L), ch = v.b.find(b => b.type === 'chambre');
  let h = `<div class="item feature lilmood">${lilouFace(m.k)}<div><b>Lilou est ${esc(m.name)}</b><p class="note">${cap1(lilouEffect(m))}, en donjon comme pendant les raids.</p>
    <div class="bar mood"><i style="width:${L.mood}%"></i></div></div></div>`;
  h += capRow(v, false) + capRow(v, true);
  h += `<div class="sec"><h4>Sukhoï</h4>${sukBubble(lilouLine(v), '<button class="btn small" data-act="sukPet">Gratouiller Sukhoï</button>')}</div>`;
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>Chaque jour, Lilou a un caprice à fabriquer avec les ressources du village ; chaque semaine, un gros caprice, plus cher, qui fait la fête dans toute la vallée.</li>
    <li>Un caprice satisfait la rend plus contente ; oublié, elle boude. Ravie, les monstres frappent 10 % moins fort ; en colère, 10 % plus fort.</li>
    <li>Ses caprices coûtent un peu plus cher quand le village grandit.</li></ul>
    ${ch ? `<button class="btn small" data-act="lilouMove" data-id="${ch.id}">Déplacer sa chambre</button>` : `<button class="btn small primary" data-act="place" data-type="chambre">Placer sa chambre</button>`}</div>`;
  return h;
}
/* La berceuse, une fois à chaque ouverture de la chambre (petit plus b) */
let lilouLull = 0;
function lilouOpened() { if (performance.now() - lilouLull > 20000) { lilouLull = performance.now(); SND.sfx('berceuse'); } }

/* ===================== L'HISTOIRE, lot B : la Couronne de la Montagne (interface) =====================
   L'objectif du moment en tête du menu Donjon, les scènes (une fois par téléphone), la chronique du village, le morceau annoncé au bilan. */
const CROWN_SRC_LABEL = ['Mine', 'Crypte', 'Portail', 'Profondeurs'];
const crownLetterHTML = txt => `<blockquote class="letter"><p>${esc(txt)}</p><cite>Le Roi Déchu, dernier Roi de la Montagne</cite></blockquote>`;
const SUK_CROWN = {
  goal: [
    'Le chef troll de la mine travaille pour le Roi Déchu, j’en mettrais ma queue à couper. Bats-le au niveau 3 ou plus : il porte le premier morceau.',
    'Le deuxième morceau dort dans la crypte des rois. Le roi squelette ne le lâchera pas sans se battre : niveau 4 ou plus.',
    'Le troisième morceau est chez le démon. Referme un portail démoniaque, ou passe par la faille de la vieille mine : son gardien le serre dans sa griffe.',
    'Le dernier morceau est tout au fond des Profondeurs. Termine l’étage 5, et la couronne sera à nous.',
  ],
  joyaux: 'Rallume les quatre joyaux, dans l’ordre que tu veux. Leurs gardiens sont plus forts à chaque cycle.',
  start: 'Le Roi Déchu… Je croyais cette vieille histoire enterrée. Autrefois, les Rois de la Montagne portaient une couronne qui commandait à toute la vallée. Le dernier a vendu son âme à un démon des Profondeurs, et la couronne s’est brisée en quatre morceaux. S’il les retrouve avant nous… Bon. On commence par la mine : ses gobelins travaillent pour lui.',
  p: [
    'Le bandeau de la couronne, sur le chef troll ! Et une lettre dans sa poche : « Ramenez-moi la Source. Et des couches. » Il est mal renseigné : on en manque nous-mêmes. Le deuxième morceau dort dans la crypte des rois, avec ses ancêtres.',
    'Le roi squelette, c’était son père. Il gardait le fleuron par honte de son fils ; avant de tomber en poussière, il a soufflé : « Protégez l’enfant. » Le troisième morceau est chez le démon, de l’autre côté des portails. Et maintenant, ses gobelins savent où dort Lilou : pendant les raids, la moitié d’entre eux visera sa chambre. Barricade-la.',
    'Le gardien serrait l’arche dans sa griffe. Le dernier morceau, la pierre de cœur, est tout au fond des Profondeurs, là où le Roi Déchu a son trône. Descends, termine l’étage 5. Moi, je garde Lilou.',
  ],
  crowned: 'Les quatre morceaux… La couronne est reconstituée ! Elle brille sur la halle, et toute la vallée le sait : vous êtes les nouveaux Rois de la Montagne. Lilou a applaudi. Enfin, elle a tapé sur son hochet, mais c’est pareil.',
  curse: 'Ses quatre joyaux se sont éteints et envolés vers les donjons. Il faudra les rallumer, et leurs gardiens seront plus forts. Ça ne s’arrêtera jamais, hein ? Tant mieux : je m’ennuyais.',
  ranks: [
    'Les quatre joyaux brillent de nouveau. La couronne gagne en éclat, et le Roi Déchu doit en manger sa barbe.',
    'Et un rang de plus ! La vallée n’a jamais eu de rois aussi têtus.',
    'À ce train-là, la couronne va finir par éblouir les gobelins. Tant mieux, ils viseront moins bien.',
    'La couronne brille si fort que Lilou ne veut plus s’endormir sans la regarder.',
  ],
  piece: ['Le bandeau de la couronne !', 'Le fleuron des rois !', 'L’arche de l’abîme !', 'La pierre de cœur ! La couronne est complète !'],
};
const CHAPTER_OF = k => 'Chapitre ' + (k + 1) + ' · ' + CROWN_CHAPTERS[k];
function crownGoalTxt(cy, k) {
  const n = crownNeed(cy, k);
  return k === 0 ? 'battre le chef troll de la mine au niveau ' + n + ' ou plus' : k === 1 ? 'battre le roi squelette de la crypte au niveau ' + n + ' ou plus'
    : k === 2 ? 'refermer un portail démoniaque (ou passer par la faille)' : 'terminer l’étage ' + n + ' des Profondeurs';
}
const crownCycleTxt = cy => 'mine ' + crownNeed(cy, 0) + ', crypte ' + crownNeed(cy, 1) + ', un portail, étage ' + crownNeed(cy, 3) + ' des Profondeurs';
const crownPips = C => `<div class="crownpips">${[0, 1, 2, 3].map(k => `<span class="pip${C.got & (1 << k) ? ' on' : ''}">${ico('crown', '')}<small>${CROWN_SRC_LABEL[k]}</small></span>`).join('')}</div>`;
/* La couronne posée sur la halle (rendu 3D) : « r<rang>g<trouvés> », rien tant qu'aucun morceau n'est trouvé */
const crownCode = C => (!C ? '' : C.rank ? 'r' + Math.min(C.rank, 9) + 'g' + C.got : crownBits(C.got) ? 'r0g' + C.got : '');
/* La faille vers l'abîme : le donjon du portail quand aucun portail n'est ouvert (pour le morceau du portail) */
const crownRift = () => !!me && crownCan(me, 'portail', 1, 0, true) >= 0;
/* Une ligne d'objectif, avec ses boutons (seul, à deux) quand c'est possible */
function crownGoalRow(hh, C, k) {
  const done = !!(C.got & (1 << k)), name = crownName(C.cy, k), n = crownNeed(C.cy, k), top = Math.max(1, hh.dj || 1);
  const pk = partnerId(me), ph = pk ? activeHero(me, pk) : null, on = pk && isOnline(pk);
  const go = (th, lvl, pi, label) => `<div class="row"><button class="btn small primary grow" data-act="djGo" data-th="${th}" data-k="${lvl}"${pi != null ? ' data-pi="' + pi + '"' : ''}>${djIco('sword')}${label}</button>`
    + (pk && ph ? `<button class="btn small grow${on ? '' : ' off'}" data-act="djInvite" data-th="${th}" data-k="${lvl}"${pi != null ? ' data-pi="' + pi + '"' : ''}${on ? '' : ' disabled'}>${djIco('shield')}À deux</button>` : '') + '</div>';
  let act = '';
  if (!done) {
    if (k === 0) act = top >= n ? go('mine', n, null, 'La mine, niveau ' + n) : `<p class="note">D’abord, gagner la mine au niveau ${n - 1}.</p>`;
    else if (k === 1) act = top >= n && top >= DJ_OPEN.crypte ? go('crypte', n, null, 'La crypte, niveau ' + n) : `<p class="note">D’abord, gagner la mine ou la crypte au niveau ${n - 1}.</p>`;
    else if (k === 2) { const ri = raidInfo(me, now()), open = ri.p.filter(p => !p.cl); act = open.length ? go('portail', raidLevel(me), open[0].i, 'Refermer le portail ' + RAID_OF[open[0].side]) : go('portail', raidLevel(me), -1, 'Passer par la faille'); }
    else act = top >= DJ_OPEN.prof ? go('prof', hh.lvl, null, 'Les Profondeurs') : `<p class="note">Les Profondeurs s’ouvrent après une victoire au niveau ${DJ_OPEN.prof - 1}.</p>`;
  }
  return `<div class="crowngoal${done ? ' done' : ''}"><div class="row split"><b class="row">${ico('crown', done ? 'c-gold' : 'muted')}${esc(cap1(name))}</b><small>${done ? (C.cy === 1 ? 'trouvé' : 'rallumé') + ' ✓' : esc(cap1(crownGoalTxt(C.cy, k)))}</small></div>${act}</div>`;
}
/* En tête du menu Donjon : le chapitre (1er cycle) ou les joyaux (cycles suivants) */
function crownEntryHTML(hh) {
  const C = me && me.crown; if (!C || !hh) return '';
  if (C.cy === 1) {
    const k = crownBits(C.got);
    return `<div class="item feature story crown"><div class="row split"><b class="row">${ico('crown', 'c-gold')}${esc(CHAPTER_OF(k))}</b><small class="note">la Couronne de la Montagne</small></div>
      ${crownPips(C)}${sukBubble(SUK_CROWN.goal[k])}${crownGoalRow(hh, C, k)}
      <button class="btn small" data-act="sheet" data-s="chron">${ico('scroll', '')}La chronique du village</button></div>`;
  }
  return `<div class="item feature story crown"><div class="row split"><b class="row">${ico('crown', 'c-gold')}Cycle ${C.cy} · Les joyaux de la couronne</b><span class="chip">rang ${C.rank}</span></div>
    ${crownPips(C)}<p class="note">${esc(SUK_CROWN.joyaux)}</p>${[0, 1, 2, 3].map(k => crownGoalRow(hh, C, k)).join('')}
    <button class="btn small" data-act="sheet" data-s="chron">${ico('scroll', '')}La chronique du village</button></div>`;
}
/* Au bilan d'un donjon : le morceau (ou le joyau) qu'il rapporte */
function crownWinHTML(r) {
  if (!me || !me.crown || !r) return '';
  const C = me.crown, k = crownCan(me, r.theme, r.lvl, r.deep || 0, r.win); if (k < 0) return '';
  return `<div class="item story crownwin"><b class="row">${ico('crown', 'c-gold')}${C.cy === 1 ? esc(SUK_CROWN.piece[k]) : esc(cap1(crownName(C.cy, k))) + ' se rallume !'}</b>
    <p class="note">${C.cy === 1 ? 'Un morceau de la Couronne de la Montagne (' + (crownBits(C.got) + 1) + ' sur 4).' : 'Un joyau de la couronne (' + (crownBits(C.got) + 1) + ' sur 4).'} Avec de l’or pour la bourse et un objet pour ton sac.</p></div>`;
}

/* ---------- les scènes : une fois par téléphone, quand l'histoire avance ---------- */
const crownSceneKey = C => !C ? '' : C.cy === 1 ? 'c1g' + crownBits(C.got) : 'c' + C.cy;
function crownSceneHTML(key) {
  const C = me && me.crown; if (!C) return '';
  const goal = txt => `<div class="item crowngoalbox"><b class="row">${djIco('star')}Objectif</b><p>${esc(txt)}</p></div>`;
  const btns = `<div class="row sceneact"><button class="btn grow" data-act="closeModal">Plus tard</button><button class="btn primary grow" data-act="crownGo">${djIco('sword')}Voir le menu Donjon</button></div>`;
  const chest = C.lc ? `<div class="item"><div class="row split"><b>Le coffre de la couronne</b><span class="chips2"><span class="chip plus">${ico('or')}+${fmtN(C.lc.g)}</span>${orbChip(C.lc.o)}</span></div>
    <p class="note">Et un objet ${C.lc.r % 3 === 0 ? 'légendaire' : 'épique'} dans le sac de chaque héros actif. La couronne au rang ${C.lc.r} : +${Math.min(10, C.lc.r)} de moral pour toujours.</p></div>` : '';
  if (key === 'c1g0') return `<p class="eyebrow">${esc(CHAPTER_OF(0))}</p><h2>Une lettre cachetée de noir</h2>${crownLetterHTML(CROWN_FIRST)}${sukBubble(SUK_CROWN.start)}${goal(cap1(crownGoalTxt(1, 0)) + '.')}${btns}`;
  if (key === 'c1g1' || key === 'c1g2' || key === 'c1g3') {
    const k = +key.slice(3), titles = ['Le bandeau de la couronne', 'Le père du Roi Déchu', 'L’arche de l’abîme'];
    return `<p class="eyebrow">${esc(CHAPTER_OF(k))}</p><h2>${titles[k - 1]}</h2>${crownPips(C)}${sukBubble(SUK_CROWN.p[k - 1])}${goal(cap1(crownGoalTxt(1, k)) + '.')}
      ${k === 2 ? '<p class="why">Dès maintenant, la moitié des gobelins des raids vise la chambre de Lilou : palissades, pièges ou poste de garde autour d’elle.</p>' : ''}${btns}`;
  }
  const n = +key.slice(1); if (!(n >= 2)) return '';
  if (n === 2) return `<p class="eyebrow">La Couronne de la Montagne</p><h2>Les Rois de la Montagne</h2>${sukBubble(SUK_CROWN.crowned)}${chest}${crownLetterHTML(CROWN_CURSES[0])}${sukBubble(SUK_CROWN.curse)}${goal('Cycle 2 : rallumer les quatre joyaux, dans l’ordre que tu veux (' + crownCycleTxt(2) + ').')}${btns}`;
  return `<p class="eyebrow">La Couronne de la Montagne · rang ${C.rank}</p><h2>La couronne brille plus fort</h2>${sukBubble(SUK_CROWN.ranks[(n - 3) % SUK_CROWN.ranks.length])}${chest}
    ${crownLetterHTML(CROWN_CURSES[(n - 2) % CROWN_CURSES.length])}${goal('Cycle ' + n + ' : ' + crownCycleTxt(n) + '.')}${btns}`;
}
/* Appelé par la boucle de l'interface : une nouvelle scène à montrer ? (rien en donjon, dans un menu ou une fenêtre) */
function crownSceneCheck() {
  if (!me || !me.crown || mode !== 'home' || modal || sheet || dj || rp || place) return;
  const key = crownSceneKey(me.crown), lk = 'mk2.crown.' + vid;
  if (!key || LS.get(lk) === key) return;
  LS.set(lk, key);
  modal = { kind: 'crown', key }; SND.sfx(key === 'c1g0' ? 'alarm' : 'star'); renderAll();
}

/* ---------- la chronique du village ---------- */
const CHRON_ICO = { found: ['house', 'c-tro'], join: ['link', 'c-tro'], hero: ['crown', 'c-tro'], lilou: ['heart', 'c-heart'], crown: ['crown', 'c-gold'], roi: ['scroll', 'c-gold'], hall: ['hammer', 'c-tro'], raid: ['star', 'c-tro'], win: ['s3', 'c-tro'], leg: ['star', 'c-gold'], deep: ['star', 'c-tro'] };
function sheetChron() {
  const v = me, list = v.chron || [];
  if (!list.length) return '<p class="note">La chronique est encore vierge.</p>';
  let h = `<p class="note">Les grands moments de ${esc(v.name)}, écrits au fil des jours${v.crown && v.crown.rank ? ' par ses Rois de la Montagne' : ''}.</p><div class="chron">`, day = -1;
  for (const [t, k, m] of list) {
    const d = Math.floor((t - v.born) / DAY) + 1;
    if (d !== day) { day = d; h += `<h5>Jour ${d} · ${SEASONS[seasonIdx(v, t)].name.toLowerCase()}</h5>`; }
    const I = CHRON_ICO[k] || ['star', 'c-tro'];
    h += `<p class="ce ck-${esc(k)}">${ico(I[0], I[1])}<span>${esc(m)}</span></p>`;
  }
  return h + '</div>';
}

const ACT_STORY = {
  lilouCap: b => {
    const big = b.dataset.w === '1', r = act({ type: 'lilouCap', w: big ? 1 : 0 });   // en cas de refus, act dit pourquoi (ressources, taverne…)
    if (!r) return;
    SND.sfx('giggle');
    toast(big ? 'Lilou est aux anges ! Toute la vallée fait la fête.' : 'Lilou gazouille de joie' + (r.up ? ' : elle est maintenant ' + LILOU_MOODS.find(m => m.k === r.mood).name + ' !' : '.'));
  },
  sukPet: () => { SND.sfx('purr'); toast('Sukhoï : « ' + SUK.pet[Math.floor(Math.random() * SUK.pet.length)] + ' »'); },
  lilouSee: () => { modal = null; openSheet('lilou'); },
  lilouMove: b => { closeSheet(true); startMove(+b.dataset.id); },
  sukGo: () => { modal = null; renderAll(); djBegin(1, 'source', 0); },
  crownGo: () => { modal = null; openSheet('donjon'); },
};

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
/* Où sont les modèles 3D : posé par la page (index.html) selon l'adresse du jeu. */
const MK_PATHS = Object.assign({ models: 'models/', m2: 'v2/models/' }, window.MK_PATHS || {});
const gfxLight = () => LS.get('mk2.light') === 1;          // réglage « graphismes légers » (propre à chaque téléphone)
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
/* Équipement : or, fer, emplacements, sac, enclume, patte */
Object.assign(IC, {
  or: '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="13.2" rx="7" ry="3" fill="currentColor" opacity=".7"/><rect x="3" y="9.4" width="14" height="3.8" fill="currentColor" opacity=".7"/><ellipse cx="10" cy="9.4" rx="7" ry="3" fill="currentColor"/><ellipse cx="10" cy="9.4" rx="4" ry="1.4" fill="#fff" opacity=".4"/></svg>',
  fer: '<svg viewBox="0 0 20 20"><path d="M5 7.5h10l2.6 6.5H2.4z" fill="currentColor"/><path d="M5 7.5h10l-1 2.2H6z" fill="#fff" opacity=".35"/></svg>',
  s_arme: '<svg viewBox="0 0 24 24"><path d="M14.5 3H21v6.5L10.7 19.8l-2.1-2.1L18.4 8V5.6H16L6.3 15.4l-2.1-2.1z" fill="currentColor"/><path d="m3 17.6 3.4 3.4M6.6 14.6l2.8 2.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  s_casque: '<svg viewBox="0 0 24 24"><path d="M4 15a8 8 0 0 1 16 0v2H4z" fill="currentColor"/><path d="M12 7v10M4 17h16v3H4z" stroke="currentColor" stroke-width="2"/><path d="M8.5 13h2.5v3H8.5z" fill="#fff" opacity=".45"/></svg>',
  s_armure: '<svg viewBox="0 0 24 24"><path d="M8 3 4 5.5 5.5 11 7 10v10h10V10l1.5 1L20 5.5 16 3l-1.5 2h-5z" fill="currentColor"/><path d="M12 6v13" stroke="#fff" stroke-opacity=".4" stroke-width="1.5"/></svg>',
  s_bottes: '<svg viewBox="0 0 24 24"><path d="M7 2.5h6V14l6.5 2.5c1 .4 1.5 1.3 1.5 2.3V21H4v-3l3-2z" fill="currentColor"/><path d="M7 7h6" stroke="#fff" stroke-opacity=".4" stroke-width="1.5"/></svg>',
  s_bijou: '<svg viewBox="0 0 24 24"><path d="M5 3c0 4 3 7 7 7s7-3 7-7" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 9.5 16.5 14 12 21l-4.5-7z" fill="currentColor"/><path d="M12 9.5 14 14l-2 5" fill="#fff" opacity=".35"/></svg>',
  s_bag: '<svg viewBox="0 0 24 24"><path d="M8 7a4 4 0 0 1 8 0" stroke="currentColor" stroke-width="2" fill="none"/><path d="M5 8h14l1.5 12.5H3.5z" fill="currentColor"/><path d="M9 12h6" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/></svg>',
  s_anvil: '<svg viewBox="0 0 24 24"><path d="M3 7h13c0 3 2 4.5 5 5v1h-6l-1 3h3v3H7v-3h3l-1-3H8C5 13 3 11 3 7z" fill="currentColor"/></svg>',
  s_paw: '<svg viewBox="0 0 24 24"><g fill="currentColor"><ellipse cx="12" cy="16" rx="5" ry="4.2"/><ellipse cx="6" cy="10" rx="2" ry="2.6"/><ellipse cx="18" cy="10" rx="2" ry="2.6"/><ellipse cx="9.3" cy="6.3" rx="2" ry="2.6"/><ellipse cx="14.7" cy="6.3" rx="2" ry="2.6"/></g></svg>',
});
/* Raids : bouclier, flamme (les mêmes que dans les donjons) */
Object.assign(IC, { shield: DJ_IC.shield, flame: DJ_IC.flame, sword: DJ_IC.sword });
/* Garnison : drapeau (postes de garde, bannières) */
IC.flag = '<svg viewBox="0 0 24 24"><path d="M5 2.5v19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-3 4 3 4H6z" fill="currentColor"/></svg>';
const ico = (k, cls) => `<span class="ic ${cls == null ? 'c-' + k : cls}">${IC[k] || ''}</span>`;
const RES_SHOW = ['bois', 'pierre', 'ble', 'farine', 'pain', 'viande', 'orge', 'biere', 'fer', 'or'];
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
  const fx = { build: 'place', move: 'place', upgrade: 'upgrade', accept: 'built', hero: 'hero', feast: 'coin', demolish: 'wallbreak', job: 'click', heroAt: 'click', heroAct: 'click', claim: 'coin', crop: 'click', skill: 'star', spec: 'hero',
    equip: 'upgrade', unequip: 'click', sell: 'coin', melt: 'wallhit', craft: 'upgrade', improve: 'upgrade', socket: 'built', unsocket: 'click', fuse: 'star', buy: 'coin', pet: 'click',
    walls: 'place', gate: 'place', upwalls: 'upgrade', repair: 'built',
    recruit: 'recruit', dismiss: 'click', promote: 'promote', solPost: 'click', solAuto: 'place', solForge: 'upgrade', solImprove: 'upgrade', orbSet: 'built', orbOff: 'click', orbFuse: 'star', banSet: 'built', banOff: 'click', banSell: 'coin' }[a.type];
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
  if (mode === 'loading' || mode === 'join' || mode === 'gate' || mode === 'hero') setMode(me && heroesOf(me, uid).length ? 'home' : 'hero');
  else { renderAll(); refreshScene(); }
}
const AWAY_KINDS = new Set(['built', 'cand', 'arrive', 'season', 'leave', 'join', 'hero', 'feast', 'site', 'goal', 'dj', 'merch', 'forge', 'raid', 'portal', 'def', 'sol', 'lilou', 'roi', 'crown']);
const TOAST_KINDS = new Set(['built', 'cand', 'season', 'leave', 'join', 'feast', 'goal', 'merch', 'portal', 'roi', 'crown']);
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
  if (l.k === 'built') SND.sfx('built'); else if (l.k === 'cand') SND.sfx('invite'); else if (l.k === 'leave') SND.sfx('error'); else if (l.k === 'season') SND.sfx('star'); else if (l.k === 'portal') SND.sfx('alarm');
}

/* ---------- scène 3D ---------- */
function items(v, editable) {
  const out = v.b.map(b => {
    let gx = b.gx, gz = b.gz;
    if (editable && place && place.kind === 'move' && place.id === b.id) { gx = place.gx; gz = place.gz; }
    return { key: 'm' + b.id, id: b.id, type: b.type, lvl: b.lvl, gx, gz, up: b.up ? { frac: Math.min(1, b.up.done / b.up.need) } : null, col: safeColor(v.c), crop: b.type === 'champ' ? cropOf(b) : undefined, dead: isBroken(b), ban: b.type === 'poste' && banOk(b.ban) ? b.ban.r : undefined,
      crown: b.type === 'halle' ? crownCode(v.crown) || undefined : undefined };
  });
  if (editable && place && place.kind === 'new') out.push({ key: 'ghost', id: 0, type: place.type, lvl: 1, gx: place.gx, gz: place.gz, up: null, col: safeColor(v.c) });
  /* Le marchand ambulant : sa charrette, près de la halle, les jours où il est là */
  if (merchHere(v, now())) { const hall = v.b.find(b => b.type === 'halle'), spot = freeSpot(v, 'marchand', hall ? hall.gx + 3 : 12, hall ? hall.gz + 1 : 11); if (spot) out.push({ key: 'merch', id: 0, type: 'marchand', lvl: 1, gx: spot[0], gz: spot[1], up: null, col: safeColor(v.c) }); }
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
  /* les soldats de la garnison : debout à leur poste, ou à la caserne */
  for (const p of solPeople(v)) out.push(p);
  return out;
}
const placeValid = () => place && fits(me, place.type, place.gx, place.gz, place.kind === 'move' ? place.id : undefined);
function refreshScene() {
  if (!gl || mode === 'donjon' || mode === 'raid') return;
  V3.setMood('warm');
  const v = me || demoVillage, editable = !!me && mode === 'home', t = me ? now() : v.born;
  V3.setSeason(seasonIdx(v, t));
  V3.setBuildings(items(v, editable));
  /* solidité des défenses abîmées (une barre au-dessus) */
  for (const b of v.b) if (BLD[b.type].hps && b.lvl > 0) V3.setBldHp('m' + b.id, isBroken(b) ? 0 : hpOf(b) / hpMaxOf(b), true);
  const b = editable && sel != null && !place ? v.b.find(x => x.id === sel) : null;
  V3.select(b || null);
  if (editable && place && place.kind === 'wall') V3.ghost('rempart', place.gx, place.gz, true);
  else if (editable && place) V3.ghost(place.type, place.gx, place.gz, placeValid()); else V3.ghost(null);
  V3.setPeople(peopleOf(v));
  postRings(v, editable);
  /* portails démoniaques : visibles pendant la charge */
  const ri = me ? raidInfo(v, t) : { p: [] };
  V3.setPortals(ri.p.map(p => Object.assign({ frac: ri.frac, ready: ri.st === 'ready' }, p)));
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
  if (place && place.kind === 'wall') { wallTap(cx, cy); return; }
  if (place) {
    const g = V3.pickGround(cx, cy); if (!g) return;
    const s = BLD[place.type].size;
    place.gx = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[0] - s / 2)));
    place.gz = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[1] - s / 2)));
    refreshScene(); renderAll(); return;
  }
  /* Un habitant touché de près passe avant le bâtiment derrière lui. */
  const k = V3.pickBuilding(cx, cy), kb = k && k[0] === 'm' ? me.b.find(b => b.id === +k.slice(1)) : null;
  /* un poste de garde touché passe avant ses gardes (ils se tiennent tout près du mât) */
  const pk = V3.pickPerson(cx, cy, kb && kb.type === 'poste' ? 7 : 16) || (k ? null : V3.pickPerson(cx, cy, 30));
  if (pk) { selP = pk; sel = null; SND.sfx('click'); refreshScene(); renderAll(); return; }
  if (k === 'merch') { sel = null; selP = null; SND.sfx('click'); openSheet('merch'); return; }
  if (kb && kb.type === 'chambre' && !pk) { sel = null; selP = null; SND.sfx('click'); openSheet('lilou'); return; }
  if (k && k.indexOf('portal') === 0) { sel = null; selP = null; SND.sfx('click'); openSheet('defense'); return; }
  sel = k && k[0] === 'm' ? +k.slice(1) : null; selP = null;
  refreshScene(); renderAll();
}
function startPlace(type) {
  if (!me) return;
  if (type === 'rempart') { startWallMode(); return; }
  const d = BLD[type], hl = hallLvl(me);
  if ((d.hall || 1) > hl) { toast('Il faut une halle du village de niveau ' + d.hall + '.'); return; }
  if (countOf(me, type) >= limitV(me, type)) { toast(limitWhy(me, type)); return; }
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
  if (r) { place = null; if (p.kind === 'new') { toast(r.inst ? BLD[p.type].name + ' en place.' : 'Chantier lancé : les bâtisseurs s’y mettent.'); sel = r.inst ? null : r.id || null; } refreshScene(); renderAll(); }
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
  if (merchHere(v, t)) chips += `<button class="glass chipb live" data-act="sheet" data-s="merch">${ico('or')}Marchand · ${fmtDur(merchLeaves(v, t) - t)}</button>`;
  if (v.lilou && v.lilou.d && !v.lilou.d.ok) chips += `<button class="glass chipb" data-act="sheet" data-s="lilou">${lilouFace(lilouMood(v.lilou).k)}Caprice de Lilou</button>`;
  const ri = raidInfo(v, t);
  if (ri.st !== 'calm') chips += `<button class="glass chipb${ri.st === 'ready' ? ' alert' : ''}" data-act="sheet" data-s="defense">${ico('flame', '')}${ri.st === 'ready' ? 'Portail chargé !' : 'Portail · ' + fmtDur(ri.ready - t)}</button>`;
  const head = `<div class="idrow"><button class="glass me" data-act="sheet" data-s="village"><span class="crest" style="background:${safeColor(v.c)}">${esc(initial(v.name))}</span>
    <span class="idtxt"><b>${v.crown && v.crown.rank ? '<span class="kingmark" aria-label="Rois de la Montagne">' + ico('crown', 'c-gold') + '</span>' : ''}${esc(v.name)}</b><small>${ico('s' + si, 'c-tro')}${SEASONS[si].name}, jour ${seasonDay(v, t)} sur 2</small></span></button>
    <div class="chips">${chips}</div></div>`;
  const cap = capOf(v), food = foodOf(v), mor = moraleOf(v, t), pop = v.vil.length, house = housingOf(v);
  const pill = (k, icon, val, sub, frac, cls, act) => `<button class="glass pill c-${icon}${cls ? ' ' + cls : ''}" data-act="sheet" data-s="${act}"><div class="v">${ico(icon)}<span>${val}${sub ? '<small>' + sub + '</small>' : ''}</span></div>${frac == null ? '<div class="fill none"></div>' : `<div class="fill"><i style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(0)}%"></i></div>`}</button>`;
  const stock = `<div class="stock">
    ${pill('bois', 'bois', fmtN(v.r.bois), '', v.r.bois / cap, v.r.bois >= cap ? 'full' : '', 'stock')}
    ${pill('pierre', 'pierre', fmtN(v.r.pierre), '', v.r.pierre / cap, v.r.pierre >= cap ? 'full' : '', 'stock')}
    ${pill('food', 'pain', fmtN(food), '', food / (2 * cap), food < 1 ? 'warn' : '', 'stock')}
    ${pill('pop', 'people', pop, '/' + house, house ? pop / house : 0, '', 'people')}
    ${pill('mor', 'heart', mor, ' %', mor / 100, mor < 35 ? 'warn' : '', 'people')}
    ${pill('or', 'or', fmtN(v.r.or || 0), '', null, '', 'stock')}</div>`;
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
  if (b.type === 'caserne') return 'Caserne de niveau ' + b.lvl + ' : ' + solList(v).length + ' soldat' + (solList(v).length > 1 ? 's' : '') + ' sur ' + solCap(v) + ', ' + postsOf(v).length + ' poste' + (postsOf(v).length > 1 ? 's' : '') + ' de garde sur ' + postCap(v) + '. On y recrute des soldats contre de l’or.';
  if (b.type === 'forge') return 'Forge de niveau ' + b.lvl + ' : objets ' + (b.lvl >= 3 ? 'jusqu’à légendaires' : b.lvl >= 2 ? 'jusqu’à épiques' : 'jusqu’à rares') + ', améliorations jusqu’à +' + maxUpOf(b.lvl) + ', sacs de ' + bagMax(v) + ' places' + (b.lvl >= 2 ? ', fusion des pierres' : '') + '.';
  return d.desc;
}
function bldPanel() {
  const v = me, b = v.b.find(x => x.id === sel); if (!b) return '';
  if (isDef(b)) return defPanel(v, b);
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
  h += `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button>${b.type !== 'halle' ? `<button class="btn small" data-act="demolish" data-id="${b.id}">Démolir</button>` : ''}${b.type === 'taverne' && b.lvl > 0 ? '<button class="btn small" data-act="sheet" data-s="village" data-k="feast">' + ico('mug', '') + 'Fête</button>' : ''}${b.type === 'forge' && b.lvl > 0 ? '<button class="btn small primary" data-act="sheet" data-s="forge">' + ico('s_anvil', '') + 'Ouvrir la forge</button>' : ''}${b.type === 'caserne' && b.lvl > 0 ? '<button class="btn small primary" data-act="sheet" data-s="caserne">' + djIco('shield') + 'Ouvrir la caserne</button>' : ''}</div>`;
  return h + '</div>';
}
function personPanel() {
  const v = me;
  if (selP && selP[0] === 'g') return solPersonPanel(v, selP.slice(1));
  if (selP && selP[0] === 'h') {
    const hh = v.heroes[selP.slice(1)]; if (!hh) return '';
    const mine = hh.own === uid, act = activeHero(v, hh.own) === hh;
    return `<div class="glass card"><h3><span class="row">${ico('crown', 'c-tro')}${esc(hh.name)}</span><span class="row"><small>${esc(heroLine(hh))}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>
      <p class="note">${mine ? (act ? 'Ton héros actif' : 'Un de tes héros') : 'Héros de ' + esc((v.members[hh.own] || {}).name || 'ton allié')} : ${esc(heroJob(v, hh))}.</p>
      <div class="row"><button class="btn small primary" data-act="sheet" data-s="hero" data-k="${hh.id}">${mine ? 'Fiche et travail' : 'Voir la fiche'}</button></div></div>`;
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
  const idle = v.vil.some(p => p.job == null), canBuild = SHOP.some(k => !BLD[k].inst && (BLD[k].hall || 1) <= hallLvl(v) && countOf(v, k) < limitV(v, k) && !missingTxt(v, costOf(k, 1)));
  const unseen = v.log.some(l => l.t > (LS.get('mk2.read.' + vid) || 0) && AWAY_KINDS.has(l.k));
  const myHero = activeHero(v, uid);
  return `<nav class="glass nav" aria-label="Menus">
    <button data-act="sheet" data-s="build">${ico('hammer', '')}Construire${canBuild ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="people">${ico('people', '')}Villageois${v.cands.length || idle ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="hero">${ico('crown', '')}${myHero ? esc(myHero.name) : 'Héros'}${myHero && myHero.sp ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="donjon">${djIco('sword')}Donjon${myHero && !v.lilou ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="defense">${djIco('shield')}Défense${raidInfo(v, now()).st !== 'calm' || v.b.some(b => repairCostOf(b)) || solList(v).some(solCanPromote) ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="journal">${ico('scroll', '')}Journal${unseen ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="village">${ico('house', '')}Village</button></nav>`;
}
function renderBottom() {
  let h = '';
  if (mode === 'home' && me) {
    if (place && place.kind === 'wall') h = wallBarHTML();
    else if (place) {
      const valid = placeValid(), d = BLD[place.type];
      h = `<div class="glass card"><div class="row split"><b>${place.kind === 'new' ? 'Placer' : 'Déplacer'} : ${esc(d.name)}</b><span class="note">Touchez le terrain pour choisir.</span></div>
        ${valid ? '' : '<p class="why">Emplacement occupé ou trop près du bord.</p>'}
        <div class="row"><button class="btn grow" data-act="placeCancel">Annuler</button>
        <button class="btn grow${valid ? ' primary' : ' off'}" data-act="placeOk">${place.kind === 'new' ? 'Construire ici <span class="sub">' + chipsRes(costOf(place.type, 1)) + '</span>' : 'Poser ici'}</button></div></div>`;
    } else {
      if (sel != null) h += bldPanel();
      else if (selP) h += personPanel();
      else h += tipHTML();
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
  if (s === 'lilou') lilouOpened();
  renderAll(); els.sheetBody.scrollTop = s === 'chron' ? els.sheetBody.scrollHeight : 0;     // la chronique s'ouvre sur les derniers moments
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
      const d = BLD[k], n = countOf(v, k), lim = limitV(v, k), c = costOf(k, 1), locked = (d.hall || 1) > hl || (k === 'poste' && !caserneLvl(v));
      const miss = missingTxt(v, c), full = n >= lim;
      h += `<div class="item"><div class="head"><b>${esc(d.name)}</b><small>${locked ? (k === 'poste' ? 'caserne d’abord' : 'halle niveau ' + d.hall) : n + ' sur ' + lim}</small></div><p>${esc(d.desc)}</p>
        <div class="foot"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('hammer', '')}${d.inst ? 'tout de suite' + (k === 'rempart' ? ', en ligne' : '') : fmtDur(workOf(k, 1) / Math.max(1, sr.perSite) * 3600000)}</span></span>
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
/* ---------- héros : plusieurs par joueur, un actif (celui qui part en donjon) ---------- */
const heroLine = hh => raceName(hh.race, hh.sex) + ' ' + className(hh.cls, hh.sex).toLowerCase() + ' · niveau ' + hh.lvl;
function heroJob(v, hh) {
  if (hh.at === 'bat') return 'aide sur les chantiers';
  const b = hh.at != null && v.b.find(x => x.id === hh.at);
  return b ? 'travaille : ' + BLD[b.type].name.toLowerCase() : 'se promène';
}
function heroCard(v, hh, on) {
  const act = activeHero(v, hh.own) === hh;
  return `<button class="item opt${on ? ' on' : ''}" data-act="sheet" data-s="hero" data-k="${hh.id}">
    <div class="head"><b class="row">${ico('crown', act ? 'c-tro' : 'muted')}${esc(hh.name)}${act ? '<span class="chip hero">actif</span>' : ''}</b><small>${esc(heroLine(hh))}</small></div>
    <p>Au village : ${esc(heroJob(v, hh))}.</p></button>`;
}
function heroDetail(v, hh, own) {
  const R = RACES[hh.race], C = CLASSES[hh.cls], act = activeHero(v, hh.own) === hh;
  const need = heroXpNeed(hh.lvl), xp = Math.min(100, (hh.xp || 0) / need * 100);
  const lock = l => hh.lvl >= l ? '' : ' muted';
  let h = `<div class="sec"><h4>Fiche de ${esc(hh.name)}</h4><div class="item feature">
    <div class="head"><b>${esc(heroLine(hh))}</b><small>${esc(C.role)}</small></div>
    <div class="bar"><i style="width:${xp.toFixed(0)}%"></i></div>
    <p class="note">${hh.lvl >= HERO_MAX_LVL ? 'Niveau maximum atteint.' : 'Expérience : ' + fmtN(hh.xp || 0) + ' sur ' + fmtN(need) + '. Elle se gagne en donjon.'}${hh.runs ? ' Donjons : ' + (hh.wins || 0) + ' victoire' + ((hh.wins || 0) > 1 ? 's' : '') + ' sur ' + hh.runs + '.' : ''}${hh.deep ? ' Record dans les Profondeurs : ' + hh.deep + ' étage' + (hh.deep > 1 ? 's' : '') + '.' : ''}</p>
    <p><b>Race :</b> ${esc(R.desc)} Au village : +25 % en ${esc(SPEC_LABEL[R.spec].toLowerCase())}, +10 % ailleurs. En combat : ${esc(R.passive)}</p>
    <p><b>Classe :</b> ${esc(C.desc)}</p>
    ${own && !act ? `<div class="row"><button class="btn small primary" data-act="heroAct" data-id="${hh.id}">Partir en donjon avec ${esc(hh.name)}</button></div>` : act ? `<p class="note">C’est ${own ? 'ton' : 'le'} héros actif : celui qui part en donjon.</p>` : ''}</div>
    <div class="item"><div class="row split"><b>Compétences</b>${own && hh.sp ? `<span class="chip plus">${hh.sp} point${hh.sp > 1 ? 's' : ''} à dépenser</span>` : ''}</div>${C.skills.map((s, i) => { const rk = skillRank(hh, i); return `<div class="row split skrow"><p class="${lock(SKILL_LVLS[i])}"><b>${esc(s[0])}</b>${rk ? ' · rang ' + rk + ' sur 5' : ' · niveau ' + SKILL_LVLS[i]} : ${esc(s[1])}</p>${own && rk && rk < 5 && hh.sp ? `<button class="btn small primary" data-act="skill" data-id="${hh.id}" data-i="${i}" aria-label="Renforcer ${esc(s[0])}">+1</button>` : ''}</div>`; }).join('')}
    ${own && hh.sp ? '<p class="note">Chaque rang : +15 % de puissance et une recharge un peu plus rapide.</p>' : ''}
    <b>Passifs de classe</b>${C.passives.map((s, i) => `<p class="${lock(PASSIVE_LVLS[i])}"><b>${esc(s[0])}</b> · niveau ${PASSIVE_LVLS[i]} : ${esc(s[1])}</p>`).join('')}
    <b>Spécialisation au niveau ${SPEC_LVL}</b>${hh.spec === 0 || hh.spec === 1 ? `<p><b>${esc(C.specs[hh.spec][0])}</b> : ${esc(C.specs[hh.spec][1])}</p>` : own && hh.lvl >= SPEC_LVL ? `<p>Choisis ta voie (pour de bon) :</p><div class="row">${C.specs.map((s, i) => `<button class="btn small primary" data-act="spec" data-id="${hh.id}" data-i="${i}">${esc(s[0])}</button>`).join('')}</div>` : `<p class="${lock(SPEC_LVL)}">${C.specs.map(s => `<b>${esc(s[0])}</b> (${esc(s[1].replace(/\.$/, '').toLowerCase())})`).join(' ou ')}.</p>`}</div>
    <details class="help"><summary>Ce que chaque niveau débloque</summary><ul>${Object.keys(LEVELS).map(l => `<li>Niveau ${l} : ${esc(LEVELS[l])}</li>`).join('')}</ul><p class="note">À chaque niveau : plus de vie et de dégâts, et 1 point pour renforcer la compétence de son choix.</p></details></div>`;
  if (own) {
    const takenBy = to => { const o = heroesAt(v, to).filter(x => x.id !== hh.id); return o.length >= HERO_CAP(to) ? (o.length > 1 ? 'complet' : 'pris : ' + o[0].name) : ''; };
    const opt = (to, label, bonus) => { const tk = to == null ? '' : takenBy(to), on = hh.at === to || (to == null && hh.at == null);
      return `<button class="item opt${on ? ' on' : ''}${tk && !on ? ' off' : ''}" data-act="heroAt" data-id="${hh.id}" data-to="${to == null ? '' : to}"${tk && !on ? ' disabled' : ''}><div class="head"><b>${esc(label)}</b><small>${esc(tk && !on ? tk : bonus)}</small></div></button>`; };
    h += `<div class="sec"><h4>Que fait ${esc(hh.name)} au village ?</h4>`;
    h += opt(null, 'Se promener', 'aucun bonus');
    h += opt('bat', 'Aider sur les chantiers', R.spec === 'constr' ? '+25 %' : '+10 %');
    for (const b of v.b.filter(x => BLD[x.type].spec && x.lvl > 0)) h += opt(b.id, BLD[b.type].name, R.spec === BLD[b.type].spec ? '+25 %' : '+10 %');
    h += '<p class="note">Un héros par bâtiment, deux sur les chantiers.</p></div>';
  }
  return h;
}
function sheetHero() {
  const v = me, mine = heroesOf(v, uid), slots = heroSlots(v);
  if (!mine.length) return '<p class="note">Crée d’abord ton héros.</p><button class="btn primary" data-act="heroForm">Créer mon héros</button>';
  const sel = (sheetArg && v.heroes[sheetArg]) || activeHero(v, uid);
  let h = `<div class="sec"><h4>Tes héros · ${mine.length} sur ${slots}</h4>${mine.map(x => heroCard(v, x, x === sel)).join('')}`;
  if (mine.length < slots) h += `<button class="btn primary" data-act="newHero">${ico('crown', '')}Nouveau héros</button>`;
  else if (mine.length < 4) h += `<p class="note">${hasTavern(v) ? 'Agrandissez la taverne' : 'Construisez la taverne'} pour loger un héros de plus (4 au plus).</p>`;
  h += '</div>' + heroGearHTML(v, sel, sel.own === uid) + heroDetail(v, sel, sel.own === uid);
  const pk = partnerId(v), ph = pk ? heroesOf(v, pk) : [];
  if (ph.length) h += `<div class="sec"><h4>Les héros de ${esc(v.members[pk].name)}</h4>${ph.map(x => heroCard(v, x, x === sel)).join('')}</div>`;
  return h;
}
const LOG_ICON = { built: 'hammer', site: 'hammer', cand: 'people', arrive: 'people', leave: 'people', season: 's0', join: 'link', hero: 'crown', feast: 'mug', skill: 'star', found: 'house', demolish: 'hammer', goal: 'star', crop: 'ble', dj: 'crown', merch: 'or', forge: 's_anvil', raid: 'shield', portal: 'flame', def: 'shield', sol: 'shield', lilou: 'heart', roi: 'scroll', crown: 'crown' };
function sheetJournal() {
  const v = me;
  if (!v.log.length) return '<p class="note">Rien pour l’instant.</p>';
  return '<ol class="log">' + v.log.slice().reverse().map(e => `<li><time>${fmtAgo(e.t)}</time><span class="row">${ico(e.k === 'season' ? 's' + seasonIdx(v, e.t) : LOG_ICON[e.k] || 'scroll', 'c-tro')}${esc(e.m)}</span></li>`).join('') + '</ol>';
}
function inviteLink() { return location.origin + location.pathname + '?join=' + encodeURIComponent(vid); }
function sheetVillage() {
  const v = me, t = now(), si = seasonIdx(v, t), pk = partnerId(v);
  let h = '';
  h += `<div class="sec"><h4>Habitants</h4><div class="item">${Object.entries(v.members).map(([k, m]) => `<div class="row split"><b class="row">${isOnline(k) || k === uid ? '<span class="dotx on"></span>' : '<span class="dotx"></span>'}${esc(m.name)}${k === uid ? ' (toi)' : ''}</b><small class="note">${heroesOf(v, k).length ? esc(heroesOf(v, k).map(x => x.name).join(', ')) : 'pas encore de héros'}</small></div>`).join('')}</div>`;
  if (!pk) h += `<div class="item feature"><b class="row">${ico('link', 'c-tro')}Inviter ta partenaire</b><p>Envoie-lui ce lien : en l’ouvrant, elle rejoindra ce village et créera son héros.</p>
    <input type="text" readonly value="${esc(inviteLink())}" class="linkbox" aria-label="Lien d’invitation">
    <div class="row"><button class="btn small primary" data-act="copyLink">Copier le lien</button>${navigator.share ? '<button class="btn small" data-act="shareLink">Partager</button>' : ''}</div></div>`;
  h += '</div>';
  const C = v.crown;
  h += `<div class="sec"><h4>L’histoire du village</h4><div class="item">${C && C.rank ? `<b class="row">${ico('crown', 'c-gold')}Rois de la Montagne</b><p class="note">La couronne au rang ${C.rank} : +${Math.min(10, C.rank)} de moral pour toujours.</p>` : ''}
    <p>La chronique garde les grands moments du village (${(v.chron || []).length}).</p><button class="btn small primary" data-act="sheet" data-s="chron">${ico('scroll', '')}Lire la chronique</button></div></div>`;
  const next = nextSeasonAt(v, t);
  h += `<div class="sec"><h4>Saison</h4><div class="item"><b class="row">${ico('s' + si, 'c-tro')}${SEASONS[si].name}, jour ${seasonDay(v, t)} sur 2</b><p>${SEASONS[(si + 1) % 4].name} dans <b>${fmtDur(next - t)}</b>. ${si === 2 ? 'L’hiver approche : faites des réserves de nourriture.' : si === 3 ? 'Les champs dorment : le village vit sur ses réserves.' : ''}</p></div></div>`;
  if (v.b.some(b => b.type === 'taverne' && b.lvl > 0)) {
    const ready = v.feastCd <= t, miss = missingTxt(v, FEAST.cost);
    h += `<div class="sec" id="feastSec"><h4>Fête à la taverne</h4><div class="item"><p>+${FEAST.mor} de moral pendant un jour pour tout le village.${ready ? '' : ' Prochaine fête possible dans ' + fmtDur(v.feastCd - t) + '.'}</p>
      <div class="foot"><span class="chips2">${chipsRes(FEAST.cost, v.r)}</span><button class="btn small${!ready || miss ? ' off' : ' primary'}" data-act="feast">${ico('mug', '')}Faire la fête</button></div></div></div>`;
  }
  const ob = (o, l) => `<button class="btn small${orient === o ? ' primary' : ''}" data-act="orient" data-o="${o}">${l}</button>`;
  const onOff = (act, on, a, b) => `<button class="btn small${on ? ' primary' : ''}" data-act="${act}" aria-pressed="${on}">${on ? a : b}</button>`;
  h += `<div class="sec"><h4>Affichage</h4><div class="row">${ob('land', 'Paysage')}${ob('land2', 'Paysage inversé')}${ob('port', 'Portrait')}</div>
    <div class="item"><div class="row split"><b class="row">${ico('star', 'c-tro')}Graphismes légers</b>${onOff('gfxToggle', gfxLight(), 'Activés', 'Coupés')}</div><p class="note">Pour un téléphone qui chauffe ou qui rame : image un peu moins fine, sans ombres, mais plus fluide et moins gourmande en batterie.</p></div>
    <div class="item"><div class="row split"><b class="row">${ico('help', 'c-tro')}Conseils au bon moment</b>${onOff('tipsToggle', tipOn(), 'Activés', 'Coupés')}</div><p class="note">De petits conseils en bas de l’écran, une seule fois chacun, quand ils servent.</p><button class="btn small" data-act="tipsReset">Revoir tous les conseils</button></div></div>`;
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
  h += `<div class="row split stockrow"><b class="row">${ico('people', 'c-tro')}Repas ${v.sol ? '(villageois et soldats)' : 'des villageois'}</b><span><small class="note">${fmtR(rt.food)}/h (pain et viande)</small></span></div></div>`;
  h += '<p class="note">Le blé devient farine au moulin, puis pain à la boulangerie. Le pain et la viande nourrissent le village. L’orge devient bière à la brasserie : servie à la taverne, elle remonte le moral, et il en faut pour les fêtes. Le fer vient de la mine de fer : la forge s’en sert pour les objets des héros. L’or (la bourse commune, sans limite de place) se gagne en donjon et en vendant des objets.</p>';
  return h;
}
function sheetHelp() {
  const sec = (t, list) => `<div class="sec"><h4>${t}</h4><ul class="help">${list.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
  return sec('Objectifs', ['Trois objectifs s’affichent en haut à gauche. Quand l’un est atteint, touchez « Récupérer » pour gagner sa récompense : un nouvel objectif apparaît.'])
    + sec('Le village', ['Un seul village pour vous deux : tout ce que l’un construit ou décide, l’autre le voit.', 'Le village vit même quand vous êtes déconnectés : on y travaille, on y mange, et des voyageurs se présentent.', 'Touchez un bâtiment pour le voir, l’agrandir ou y envoyer des travailleurs. Touchez un habitant pour voir sa fiche.'])
    + sec('Les villageois', ['Chacun a une note sur 10 dans six spécialités. Sa note dans son métier décide de ce qu’il produit : 1 donne 60 %, 5 normal, 10 donne 50 % de plus.', 'Ils progressent en pratiquant, de plus en plus lentement.', 'Leur caractère compte : un travailleur produit plus, un joyeux remonte le moral, un gourmand mange plus.', 'Des voyageurs se présentent s’il y a une place libre dans les maisons, à manger et un bon moral. Vous avez un jour pour les accueillir.'])
    + sec('Nourriture et saisons', ['Chaque villageois mange une ration par heure : du pain ou de la viande. Des repas variés remontent le moral.', 'Une saison dure 2 jours. En hiver, les champs ne donnent rien : faites des réserves en automne.', 'Sans nourriture, le moral s’effondre, et au bout d’un jour quelqu’un quitte le village.', 'Touchez un champ pour choisir sa culture : blé ou orge. L’orge devient bière à la brasserie ; servie à la taverne, la bière remonte le moral, et il en faut pour les fêtes.'])
    + sec('Construire', ['Les bâtisseurs font avancer les chantiers, plus vite s’ils sont doués en construction. Sans bâtisseur, ça avance quand même un peu.', 'Agrandir la halle débloque des bâtiments, plus de bâtisseurs et plus de chantiers à la fois.'])
    + sec('Vos héros', ['Chacun commence avec un héros. Chaque niveau de taverne permet d’en recruter un de plus (4 au plus chacun).', 'Le héros actif part en donjon ; on le choisit dans le menu Héros. Les autres travaillent au village.', 'Un héros affecté à un bâtiment donne +25 % là où sa race excelle (humain : construction, nain : minage, elfe : chasse, orque : bûcheronnage, halfelin : agriculture, mort-vivant : artisanat), +10 % ailleurs. Un héros par bâtiment, deux sur les chantiers.', 'Chaque niveau apporte plus de vie et de dégâts et un point de compétence (menu Héros, bouton +1) ; les compétences s’ouvrent aux niveaux 1, 3 et 5, la spécialisation au niveau 10.'])
    + sec('L’équipement', ['Chaque héros porte une arme, un casque, une armure, des bottes et, dès le niveau 8, un bijou (menu Héros). Chaque classe manie sa famille d’armes : lames, arcs ou bâtons.', 'Les objets ont 5 raretés : commun (gris), peu commun (vert), rare (bleu), épique (violet), légendaire (orange, avec un pouvoir). Les objets d’ensemble (turquoise) donnent un bonus à 2 et à 4 pièces portées.', 'On les trouve en donjon : dans les coffres, sur les boss, parfois sur un monstre ; mieux dans les donjons plus hauts. À deux, chacun trouve ses propres objets.', 'Dans le sac, les flèches comparent avec l’objet porté : ▲ mieux, ▼ moins bien. Vendre un objet rapporte de l’or (la bourse commune) ; le fondre à la forge rend du fer.', 'La forge (avec le fer de la mine) fabrique un objet au choix, l’améliore jusqu’à +5 et sertit les pierres précieuses : trois pierres pareilles se fusionnent en une plus belle.', 'Un jour sur deux, un marchand ambulant s’installe près de la halle avec quelques objets à vendre.', 'Au niveau 6, un familier accompagne le héros : loup, faucon, sanglier ou chouette, chacun avec son petit bonus.'])
    + sec('Les raids et la défense', ['À partir du 3e jour, un portail démoniaque s’ouvre au bord de la vallée (au plus un raid par jour). Il se charge pendant 3 heures : vous voyez de quel côté viendront les gobelins.', 'Le raid ne part que quand personne n’a joué depuis 2 heures. Il se joue tout seul ; au retour, un bilan s’affiche et vous pouvez revoir le combat.', 'Les gobelins foncent piller la halle, les voleurs filent vers l’entrepôt, les trolls cassent ce qui bloque (bien plus fort sur les palissades et les portes). Tous prennent le chemin le plus court, en comptant ce qu’il faudrait casser.', 'Ce qu’ils emportent est perdu s’ils regagnent le portail ; abattus avant, ils lâchent tout. Si la halle est pillée, le moral baisse pendant un jour.', 'Menu Défense : palissades (posées en ligne), portes (vos héros et villageois passent), tours d’archers, pièges à pointes et filets cachés. Vos héros défendent la halle et gagnent de l’expérience ; chaque ennemi abattu rapporte de l’or.', 'Refermez un portail avec votre héros (seul ou à deux) : un petit donjon et son gardien. Tous les portails refermés : pas de raid cette fois.', 'Après un raid, réparez les défenses abîmées (menu Défense).'])
    + sec('La garnison', ['La caserne (halle niveau 2) loge 3 soldats par niveau, 12 au plus, et donne un poste de garde par niveau. On y recrute contre de l’or : fantassin, archer, lancier ou mage de guerre.', 'Pendant un raid, chaque soldat garde le cercle de son poste sans jamais en sortir : fantassins et lanciers devant, du côté du portail, archers et mages derrière. Améliorer un poste agrandit son cercle. « Répartir » met un peu de chaque type partout.', 'Les soldats qui tiennent gagnent de l’expérience ; vous les faites monter de niveau (jusqu’au 15) contre de l’or, de la viande et, plus tard, du fer. Ils mangent, un peu plus à chaque niveau.', 'Un soldat abattu se repose 8 heures à la caserne, sans rien perdre sauf sa série : 5 raids de suite sans tomber font un Vétéran, 10 un Briscard, 20 un Héros de la garde.', 'À la forge, chaque soldat reçoit une arme et une armure complète (avec son bonus d’ensemble). Orbes (3 emplacements, aux niveaux 4, 8 et 12) et bannières (une par poste) se gagnent en défense réussie, en donjon et sur le gardien du portail.'])
    + sec('La Couronne de la Montagne', ['Dix minutes après l’arrivée de Lilou, le Roi Déchu réclame la Source : il faut retrouver les quatre morceaux de la Couronne de la Montagne, chapitre après chapitre (l’objectif est en tête du menu Donjon). Le chef troll de la mine au niveau 3, le roi squelette au niveau 4, le gardien d’un portail (ou celui de la faille, quand aucun portail n’est ouvert), puis l’étage 5 des Profondeurs.', 'Chaque morceau rapporte de l’or et un objet. Les quatre réunis : la couronne brille sur la halle, vous êtes les Rois de la Montagne, et un coffre vous attend (or, orbe, un objet pour le héros actif de chacun).', 'Puis le Roi Déchu maudit la couronne : ses quatre joyaux s’éteignent. Les rallumer (dans l’ordre que vous voulez) fait un nouveau cycle, plus dur à chaque fois : mine 6, crypte 7, un portail, étage 10, puis mine 9, crypte 10, étage 15… Chaque cycle terminé donne un rang à la couronne : +1 de moral pour toujours (10 au plus).', 'Dès le chapitre 3, la moitié des gobelins des raids vise la chambre de Lilou : s’ils l’atteignent, ils volent davantage et Lilou a très peur (−15 d’humeur). Palissades, pièges et postes de garde la protègent.', 'De temps en temps, une lettre du Roi Déchu arrive au journal. La chronique du village (menu Village) garde tous vos grands moments.'])
    + sec('Lilou et Sukhoï', ['Sukhoï, vieille guerrière (et chatte grise), vous guide et vous donne des conseils au bon moment.', 'La mission « La Source du Mal » (menu Donjon) ramène Lilou au village, une fois pour toutes. Elle s’installe dans sa chambre, près de la halle : touchez-la pour la voir.', 'Chaque jour, Lilou a un caprice à fabriquer ; chaque semaine, un gros caprice qui fait la fête dans toute la vallée (+10 de moral pendant un jour). Satisfaite, elle est plus contente ; oubliée, elle boude.', 'Son humeur compte en donjon et pendant les raids : ravie, les monstres frappent 10 % moins fort, contente 5 % ; grognon 5 % plus fort, en colère 10 %.'])
    + sec('Les donjons', ['Menu Donjon : ton héros actif part dans la mine des gobelins. Chaque victoire ouvre le niveau suivant. La crypte des rois s’ouvre après une victoire au niveau 2, les Profondeurs après une victoire au niveau 4.', 'Pose le pouce sur la gauche de l’écran pour bouger (flèches ou ZQSD sur ordinateur). Ton héros attaque tout seul ; à droite, tes compétences et ta potion (touches 1, 2, 3 et 4), et la roulade (barre d’espace ou touche 5) : un bond dans la direction du pouce, intouchable un instant, toutes les 4 secondes.', 'Les grilles d’une salle se ferment jusqu’à la dernière vague. Entre deux salles, on reprend son souffle. Les boss préviennent avant leurs coups : sors des cercles rouges.', 'Au retour : de l’expérience pour le héros, de l’or, de la pierre et du bois pour le village, des objets et des pierres précieuses dans ton sac, parfois un prisonnier délivré qui voudrait s’installer. Défaite ou fuite : la moitié (on garde les meilleurs objets).', 'Les Profondeurs : des étages sans fin, de plus en plus durs, avec un boss tous les 5 étages. À la fin de chaque étage, on choisit : descendre (avec la vie et les potions qui restent) ou remonter avec tout le butin. Si l’on tombe, on ne garde que la moitié de toute la descente.', 'À deux : quand ta partenaire a le jeu ouvert, invite-la depuis le menu Donjon. Les monstres sont plus solides, chacun gagne toute l’expérience, et un héros tombé se relève si l’autre reste 3 secondes à côté de lui.', 'Combos à deux : une compétence marque le monstre touché pendant 3 secondes ; si l’autre héros le frappe, +50 % de dégâts. Pareil sur un monstre étourdi, gelé ou enraciné par l’autre.']);
}
function renderSheet() {
  if (!sheet || !me || mode !== 'home') { els.sheet.hidden = true; return; }
  const titles = { build: 'Construire', people: 'Villageois', job: 'Choisir un métier', workers: 'Ajouter un travailleur', hero: 'Héros', journal: 'Journal du village', village: me.name, stock: 'Réserves', help: 'Aide', goals: 'Objectifs', donjon: 'Donjons', bag: 'Mon sac', forge: 'La forge', merch: 'Le marchand ambulant', defense: 'Défense', caserne: 'La caserne', lilou: 'La chambre de Lilou', chron: 'La chronique du village' };
  els.sheet.hidden = false;
  els.sheetTitle.textContent = titles[sheet] || '';
  const f = { build: sheetBuild, people: sheetPeople, job: sheetJob, workers: sheetWorkers, hero: sheetHero, journal: sheetJournal, village: sheetVillage, stock: sheetStock, help: sheetHelp, goals: sheetGoals, donjon: sheetDonjon, bag: sheetBag, forge: sheetForge, merch: sheetMerch, defense: sheetDefense, caserne: sheetCaserne, lilou: sheetLilou, chron: sheetChron }[sheet];
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
/* Résumé de la race et de la classe choisies, mis à jour à chaque choix. */
function heroSummary(race, cls, sex) {
  const R = RACES[race], C = CLASSES[cls]; if (!R || !C) return '';
  return `<b>${esc(raceName(race, sex))}</b> : ${esc(R.desc)} Au village : +25 % en ${esc(SPEC_LABEL[R.spec].toLowerCase())}. En combat : ${esc(R.passive)}<br>
    <b>${esc(className(cls, sex))}</b> (${esc(C.role.toLowerCase())}) : ${esc(C.desc)} Compétences : ${C.skills.map(s => esc(s[0])).join(', ')}.`;
}
function heroHTML(extra) {
  const used = me ? heroesOf(me, uid).map(h => h.col) : [];
  const pick = COLORS.find(c => !used.includes(c)) || COLORS[1];
  const card = (name, val, title, txt, checked) => `<label class="optc"><input type="radio" name="${name}" value="${val}"${checked ? ' checked' : ''}><span><b>${esc(title)}</b><small>${esc(txt)}</small></span></label>`;
  return `<form id="heroForm" novalidate style="display:grid;gap:12px">
    <p class="eyebrow">${esc(me ? me.name : '')}</p><h2>${extra ? 'Un nouveau héros' : 'Crée ton héros'}</h2>
    <p class="note">${extra ? 'Il rejoint ta compagnie. À la taverne, tu choisis quel héros part en donjon ; les autres travaillent au village.' : 'Ton héros partira en donjon et deviendra plus fort. Au village, il se promène et donne un coup de main. Plus tard, la taverne t’en fera recruter d’autres.'}</p>
    <div class="hf2"><div class="col">
      <label>Nom du héros<input type="text" id="hName" maxlength="18" placeholder="Ex. Brokk" autocomplete="off"></label>
      <fieldset class="fs"><legend>Homme ou femme</legend><div class="optrow">${card('hSex', 'm', 'Homme', '', true)}${card('hSex', 'f', 'Femme', '', false)}</div></fieldset>
      <fieldset class="fs"><legend>Couleur</legend>${swatches('hCol', pick)}</fieldset>
      <p class="note hsum" id="hSum">${heroSummary(RACE_KEYS[0], CLASS_KEYS[0], 'm')}</p>
    </div><div class="col">
      <fieldset class="fs"><legend>Race</legend><div class="optgrid hk">${RACE_KEYS.map((k, i) => card('hRace', k, RACES[k].name, SPEC_LABEL[RACES[k].spec], i === 0)).join('')}</div></fieldset>
      <fieldset class="fs"><legend>Classe</legend><div class="optgrid hk c4">${CLASS_KEYS.map((k, i) => card('hCls', k, CLASSES[k].name, CLASSES[k].role, i === 0)).join('')}</div></fieldset>
    </div></div>
    <p class="err" id="hErr" hidden></p>
    <div class="row">${extra ? '<button class="btn grow" type="button" data-act="closeModal">Annuler</button>' : ''}<button class="btn primary grow" type="submit">${extra ? 'Recruter' : 'Entrer au village'}</button></div></form>`;
}
document.addEventListener('change', e => {
  if (!e.target.closest || !e.target.closest('#heroForm')) return;
  const el = $('#hSum'); if (el) el.innerHTML = heroSummary(radio('hRace'), radio('hCls'), radio('hSex'));
});
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
  else if (M && M.kind === 'rules') h = `<h2>La base refuse l’accès</h2><p>Le serveur répond, mais il refuse d’ouvrir les données du jeu : les <b>règles de la base de données</b> (Firebase, Realtime Database, onglet Règles) ne sont pas encore celles du nouveau jeu. Une fois les nouvelles règles publiées, touche « Réessayer ».</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  else if (M && M.kind === 'denied') h = `<h2>Accès refusé</h2><p>Le serveur a refusé l’accès au village. Les règles de la base de données ne sont peut-être pas encore à jour, ou ce village a déjà ses deux habitants.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  else if (M && M.kind === 'info') h = `<h2>${esc(M.title)}</h2><p>${esc(M.text)}</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  else if (M && M.kind === 'newhero' && me) h = heroHTML(true);
  else if (M && M.kind === 'djres' && dj) h = djResHTML();
  else if (M && M.kind === 'raid' && me) h = raidModalHTML();
  else if (M && M.kind === 'lilou' && me) h = lilouArriveHTML();
  else if (M && M.kind === 'crown' && me) h = crownSceneHTML(M.key);
  else if (M && M.kind === 'djfloor' && dj && dj.run) h = djFloorHTML();
  else if (M && M.kind === 'djfloorwait' && dj && dj.run && dj.duo) h = djFloorWaitHTML();
  else if (M && M.kind === 'djinv' && me) h = djInvHTML();
  else if (M && M.kind === 'djwait' && me) h = djWaitHTML();
  else if (M && M.kind === 'nogl') h = `<h2>La 3D ne s’affiche pas</h2><p>Cet appareil ou ce navigateur ne permet pas l’affichage 3D. Les menus marchent quand même, mais la carte du village reste vide.</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  else if (M && M.kind === 'cand' && me) {
    const c = me.cands.find(x => x.id === M.id);
    if (!c) modal = null;
    else h = `<p class="eyebrow">Un voyageur se présente</p><h2>${esc(c.name)} voudrait s’installer</h2>${candCard(c, true)}<button class="btn" data-act="closeModal">Plus tard</button>`;
  } else if (M && M.kind === 'away' && me) {
    h = `<p class="eyebrow">Pendant votre absence</p><h2>Des nouvelles du village</h2><ol class="log">${M.list.map(e => `<li><time>${fmtAgo(e.t)}</time><span>${esc(e.m)}</span></li>`).join('')}</ol><button class="btn primary" data-act="closeModal">Au travail !</button>`;
  } else if (M && M.kind === 'welcome') {
    h = `<p class="eyebrow">Bienvenue, ${esc(M.name)}</p><h2>Votre village commence ici</h2>
      ${me && !me.lilou ? sukBubble(SUK.hello) : ''}
      <ul class="news">
        <li>${ico('star', 'c-tro')}<span>Suivez les <b>objectifs</b> en haut à gauche : ils rapportent des ressources.</span></li>
        <li>${ico('house', 'c-tro')}<span>Touchez un <b>bâtiment</b> pour le voir, l’agrandir ou y envoyer des travailleurs.</span></li>
        <li>${ico('people', '')}<span>Touchez un <b>villageois</b> pour voir ses notes sur 10 et changer son métier.</span></li>
        <li>${ico('pain', '')}<span>Chacun mange une ration par heure. En <b>hiver</b>, les champs dorment : faites des réserves.</span></li>
        <li>${ico('link', 'c-tro')}<span>Invitez votre partenaire depuis le menu <b>Village</b>.</span></li>
      </ul>${me && !me.lilou ? `<div class="row"><button class="btn grow" data-act="closeModal">Plus tard</button><button class="btn primary grow" data-act="sukGo">${djIco('sword')}Aller voir la Source du Mal</button></div>` : '<button class="btn primary" data-act="closeModal">C’est parti</button>'}`;
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
  els.loading.hidden = mode !== 'loading' || !!(modal && (modal.kind === 'login' || modal.kind === 'dberr' || modal.kind === 'rules'));
  renderTop(); renderBottom(); renderSheet(); renderModal();
}

/* ---------- événements ---------- */
document.addEventListener('pointerdown', e => { pressing = e.target.closest('button, input'); SND.unlock(); }, true);
document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.snd; if (k) SND.set({ [k]: Math.max(0, Math.min(1, e.target.value / 100)) }); });
const release = () => { pressing = null; };
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
const ACT = {
  ...ACT_EQ,
  ...ACT_RAID,
  ...ACT_GAR,
  ...ACT_TIP,
  ...ACT_STORY,
  noop() {},
  gfxToggle: () => { const on = !gfxLight(); LS.set('mk2.light', on ? 1 : 0); if (gl) V3.setLight(on); toast(on ? 'Graphismes légers : image plus simple, jeu plus fluide.' : 'Graphismes complets : ombres et image fine.'); renderAll(); },
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
  heroAt: b => {
    const to = b.dataset.to === '' ? null : b.dataset.to === 'bat' ? 'bat' : +b.dataset.to, hh = me.heroes[b.dataset.id];
    if (act({ type: 'heroAt', hid: b.dataset.id, to })) toast((hh ? hh.name : 'Ton héros') + (to == null ? ' se promène.' : ' se met au travail.'));
  },
  heroAct: b => { const hh = me.heroes[b.dataset.id]; if (act({ type: 'heroAct', hid: b.dataset.id }) && hh) toast(hh.name + ' partira en donjon.'); },
  newHero: () => { closeSheet(true); modal = { kind: 'newhero' }; renderAll(); },
  heroForm: () => { closeSheet(true); setMode('hero'); },
  feast: () => { if (act({ type: 'feast' })) toast('C’est la fête à la taverne !'); },
  claim: b => act({ type: 'claim', id: b.dataset.id }),
  djGo: b => djBegin(+b.dataset.k || 1, b.dataset.th, +b.dataset.pi || 0),
  djBack: () => djBack(),
  djFlee: () => {
    if (!dj || dj.st.over) return;
    const role = dj.duo && !dj.duo.gone && dj.duo.role, mate = dj.duo && (dj.duo.mateName || 'ton partenaire');
    const q = 'Quitter ' + (dj.run ? 'les Profondeurs' : djThemeThe(dj.st.d.theme)) + ' ? ', all = dj.run ? ' de toute la descente' : '';
    if (!confirm(q + (role === 'guest' ? 'Tu gardes la moitié de l’expérience' + all + ' ; ' + mate + ' continue seul·e.' : role === 'host' ? 'La partie s’arrête pour vous deux (moitié de l’expérience et du butin' + all + ').' : 'Tu gardes la moitié de l’expérience et du butin' + all + '.'))) return;
    if (role === 'guest') djGuestQuit(false); else djFlee(dj.st);
  },
  djUp: () => djAscend(),
  djDown: () => djDescend(),
  djLeaveFloor: () => { if (dj && dj.duo && dj.duo.role === 'guest' && dj.st.over === 'floor' && !dj.ended && confirm('Rentrer au village ? Tu gardes toute l’expérience gagnée ; ' + (dj.duo.mateName || 'ton partenaire') + ' pourra continuer seul·e.')) djGuestQuit(false); },
  djInvite: b => djInvite(+b.dataset.k || 1, b.dataset.th, +b.dataset.pi || 0),
  djYes: () => djAnswer(true),
  djNo: () => djAnswer(false),
  djCancel: () => djCancelInvite(),
  skill: b => { const hh = me.heroes[b.dataset.id], i = +b.dataset.i, r = act({ type: 'skill', hid: b.dataset.id, i }); if (r && hh) toast(CLASSES[hh.cls].skills[i][0] + ' passe au rang ' + r.rank + '.'); },
  spec: b => { const hh = me.heroes[b.dataset.id], i = +b.dataset.i; if (!hh || !confirm('Choisir la voie « ' + CLASSES[hh.cls].specs[i][0] + ' » ? C’est pour de bon.')) return; if (act({ type: 'spec', hid: hh.id, s: i })) toast(hh.name + ' devient ' + CLASSES[hh.cls].specs[i][0].toLowerCase() + '.'); },
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
const QUIET = new Set(['noop', 'upgrade', 'placeOk', 'accept', 'feast', 'setjob', 'heroAt', 'heroAct', 'claim', 'crop', 'djGo', 'skill', 'djInvite', 'djYes', 'djDown',
  'equip', 'unequip', 'sell', 'sellJunk', 'melt', 'craft', 'improve', 'socket', 'unsocket', 'fuse', 'buy', 'buyGem', 'pet', 'repair', 'upwalls', 'gate', 'raidReplay',
  'recruit', 'dismiss', 'promote', 'solPost', 'solAuto', 'solForge', 'solImprove', 'orbSet', 'orbOff', 'orbFuse', 'banSet', 'banOff', 'banSell']);
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
    const extra = !!(modal && modal.kind === 'newhero');
    const r = act({ type: 'hero', name, race: radio('hRace'), cls: radio('hCls'), sex: radio('hSex'), col: safeColor(radio('hCol')) });
    if (r && extra) { modal = null; toast(name + ' rejoint ta compagnie !'); openSheet('hero', r.id); }
    else if (r) { setMode('home'); modal = { kind: 'welcome', name }; renderAll(); }
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
    simulateVillage(vsim, now()); recompute(); if (mode !== 'donjon') newsCheck(); goalCheck();
    if (!pending.length && !committing && vraw && now() - Math.max(vraw.t, lastSync) > 20 * 60000) { pending.push({ type: 'sync' }); scheduleCommit(50); }
    candCheck(); raidCheck(); crownSceneCheck(); tipCheck();
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
  } catch (e) { clearTimeout(guard); console.error('démarrage', e); modal = { kind: e && e.code === 'not_granted' ? 'rules' : 'dberr' }; renderAll(); }
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
  djLiveWatch(id);
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
    await db.doc(ROOT + 'seats/' + joinVid).set(uid);          // d'abord la place libre (une seule par village), puis l'inscription
    await db.doc(ROOT + 'villages/' + joinVid + '/members/' + uid).set({ name: pname, t: now() });
    await db.doc(ROOT + 'users/' + uid).set({ vid: joinVid });
    LS.set('mk2.log.' + joinVid, now());
    needJoinLog = true;
    watchVillage(joinVid);
  } catch (e) { formErr('#jErr', e && e.code === 'not_granted' ? 'Impossible de rejoindre : ce village a peut-être déjà ses deux habitants.' : 'Ça n’a pas marché. Réessaie.'); }
  busy = false; renderAll();
}
if (window.MK_TEST) window.__mk = { get me() { return me; }, get mode() { return mode; }, get vid() { return vid; }, toScreen: (x, z) => gl ? V3.toScreen(x, z) : null, act: (a, o) => act(a, o), fx: () => gl ? V3._fx() : null, simAt: T => vraw ? JSON.stringify(simulateVillage(clone(vraw), T)) : null, now: () => now(), get busy() { return pending.length + (committing ? 1 : 0); }, get dj() { return dj; }, djBegin: (l, th, pi) => djBegin(l, th, pi), get rp() { return rp; }, raidReplay: () => raidReplayStart() };
async function boot() {
  const cv = $('#gl');
  gl = typeof THREE !== 'undefined' && V3.init(cv, { light: gfxLight() });
  if (gl) V3.onTap(onTap);
  applyOrientation();
  if (gl) {
    V3.resetCamera();
    modelLoad = { d: 0, n: 1 };
    /* D'abord les modèles du village et des personnages ; les gros modèles Meshy arrivent ensuite, un par un, sans bloquer. */
    V3.loadModels(MK_PATHS.models, (d, n) => { modelLoad = { d, n }; renderTop(); }, MK_PATHS.m2, () => refreshScene())
      .then(okM => { modelLoad = null; if (okM) refreshScene(); else toast('Les modèles 3D n’ont pas pu se charger : affichage simplifié.'); renderAll(); if (window.__mkSW) setTimeout(window.__mkSW, 1500); });
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
