(() => {
'use strict';
/* ===================== RÉSEAU FIREBASE (version autonome) ===================== */
const FB_CONFIG = {
  apiKey: 'AIzaSyCk2epufhsolA8Jt8xVKaKtsr8wJtJXs3w',
  authDomain: 'moutain-kings.firebaseapp.com',
  databaseURL: 'https://moutain-kings-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'moutain-kings',
  storageBucket: 'moutain-kings.firebasestorage.app',
  messagingSenderId: '206461415677',
  appId: '1:206461415677:web:9189ed8553e60c7f1e8e94',
};
/* Le village joué sur la version Claude, repris une seule fois par son propriétaire. */
const IMPORT_V = {"army":{"archer":0,"belier":0,"fantassin":0},"b":[{"gx":10,"gz":10,"id":1,"lvl":1,"type":"mairie","up":null},{"gx":14,"gz":10,"id":2,"lvl":1,"type":"tour","up":null},{"gx":6,"gz":8,"id":3,"lvl":1,"type":"scierie","up":null},{"gx":6,"gz":12,"id":4,"lvl":1,"type":"ferme","up":null},{"gx":10,"gz":14,"id":5,"lvl":1,"type":"caserne","up":null},{"gx":14,"gz":14,"id":6,"lvl":2,"type":"camp","up":null}],"born":1791661691044,"buff":0,"c":"#4A78C2","chest":null,"cid":"tlx5zgvla-1","claimed":[],"ep":0,"key":"u_rIhQecubOgFR8X0Xp2FCoA","lastActive":1791663378084,"lastDuo":0,"log":[{"m":"Fondation de Village de Téo.","t":1791661691044},{"m":"Amélioration lancée : camp militaire niveau 2.","t":1791661705762},{"m":"Raid solo sur Fort des Crânes Rouges : 0 sabre, 13 %, butin 63 bois, 61 pierre, 63 vivres.","t":1791661759323},{"m":"Travaux terminés : taverne niveau 2.","t":1791662017762}],"medals":0,"name":"Village de Téo","nextRaid":1791704891044,"nid":7,"played":0,"pname":"Téo","r":{"bois":224.27633333333333,"pierre":231,"vivres":169.2763333333333},"raids":0,"reports":[],"seed":873299962,"shield":0,"t":1791663379334,"train":[{"n":10,"u":"fantassin"}],"trainP":0,"v":2};

const fbArr = x => Array.isArray(x) ? x.filter(e => e != null) : (x && typeof x === 'object') ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(e => e != null) : [];
/* La base temps réel efface les listes vides et les valeurs nulles : on remet la forme attendue. */
function normVillage(v) {
  if (!v || typeof v !== 'object') return v;
  v = JSON.parse(JSON.stringify(v));
  v.b = fbArr(v.b).map(b => Object.assign({ up: null }, b));
  v.train = fbArr(v.train); v.log = fbArr(v.log); v.claimed = fbArr(v.claimed);
  v.reports = fbArr(v.reports).map(r => Object.assign({ lost: {} }, r, { layout: fbArr(r.layout).map(fbArr) }));
  v.army = Object.assign({ fantassin: 0, archer: 0, belier: 0 }, v.army);
  v.r = Object.assign({ bois: 0, pierre: 0, vivres: 0 }, v.r);
  if (v.chest === undefined) v.chest = null;
  return v;
}
const fbFix = (path, v) => path.indexOf('villages/') === 0 ? normVillage(v) : v;
const fbClean = d => JSON.parse(JSON.stringify(d));
function fbCode(e) { const s = String((e && (e.code || e.message)) || ''); return /permission/i.test(s) ? 'not_granted' : 'unavailable'; }
const fbThrow = e => { throw { code: fbCode(e), message: String(e && e.message) }; };
function fbErr(cb) { return e => { if (cb) cb({ code: fbCode(e), message: String(e && e.message) }); }; }

function fbDb(rdb) {
  const docRef = path => ({
    path,
    get: () => rdb.ref(path).once('value').then(s => ({ exists: s.exists(), data: () => fbFix(path, s.val()) }), fbThrow),
    set: data => rdb.ref(path).set(fbClean(data)).catch(fbThrow),
    delete: () => rdb.ref(path).remove().catch(fbThrow),
    onSnapshot(next, err) {
      const r = rdb.ref(path);
      const h = r.on('value', s => next({ exists: s.exists(), data: () => fbFix(path, s.val()) }), fbErr(err));
      return () => r.off('value', h);
    },
  });
  const qs = (s, path) => ({ docs: Object.entries(s.val() || {}).map(([id, v]) => ({ id, exists: true, data: () => fbFix(path + '/' + id, v) })) });
  const coll = path => ({
    doc: id => docRef(path + '/' + id),
    add(data) { const r = rdb.ref(path).push(); return r.set(fbClean(data)).then(() => ({ id: r.key }), fbThrow); },
    where: (field, op, val) => ({
      onSnapshot(next, err) {
        const q = rdb.ref(path).orderByChild(field).equalTo(val);
        const h = q.on('value', s => next(qs(s, path)), fbErr(err));
        return () => q.off('value', h);
      },
    }),
    onSnapshot(next, err) {
      const r = rdb.ref(path);
      const h = r.on('value', s => next(qs(s, path)), fbErr(err));
      return () => r.off('value', h);
    },
  });
  return { doc: docRef, collection: coll };
}

/* Présence et messages du raid à deux.
   Invitations : boîte de réception de chaque joueur. Pendant un raid : un canal par raid,
   l'état du combat écrasé en continu, les autres messages empilés. */
function fbRoom(rdb, uid) {
  const handlers = [];
  let offset = 0, live = null, liveId = null, myPres = null, connected = false;
  rdb.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
  const serverNow = () => Date.now() + offset;
  const TS = () => firebase.database.ServerValue.TIMESTAMP;
  const deliver = d => { if (d && typeof d === 'object') for (const h of handlers) { try { h({ data: d }); } catch (e) { console.error(e); } } };
  const presRef = rdb.ref('presence/' + uid);
  function writePres() {
    if (!myPres) return Promise.resolve();
    presRef.onDisconnect().remove();
    return presRef.set(Object.assign({}, myPres, { t: TS() }));
  }
  /* Après une coupure, le serveur a effacé notre présence : on la remet. */
  rdb.ref('.info/connected').on('value', s => { connected = s.val() === true; if (connected) writePres().catch(() => {}); });
  function watch(id) {
    if (!id || liveId === id) return;
    unwatch();
    liveId = id;
    const base = rdb.ref('duo/live/' + id), ev = base.child('ev'), st = base.child('st'), t0 = serverNow() - 5000;
    const hEv = ev.on('child_added', s => { const d = s.val(); if (d && (d.ts || 0) >= t0) deliver(d); }, () => {});
    const hSt = st.on('value', s => { const d = s.val(); if (d) deliver(d); }, () => {});
    live = { ev, st, hEv, hSt };
  }
  function unwatch() { if (!live) return; live.ev.off('child_added', live.hEv); live.st.off('value', live.hSt); live = null; liveId = null; }
  rdb.ref('duo/inbox/' + uid).on('child_added', s => {
    const d = s.val(); s.ref.remove().catch(() => {});
    if (!d || serverNow() - (d.ts || 0) > 60000) return;
    deliver(d);
  }, () => {});
  return {
    emit(topic, d) {
      const msg = fbClean(d); msg.ts = TS();
      if (d.k === 'inv') { watch(d.id); const r = rdb.ref('duo/inbox/' + d.to).push(); return r.set(msg); }
      if (d.k === 'st') return rdb.ref('duo/live/' + d.id + '/st').set(msg);
      const r = rdb.ref('duo/live/' + d.id + '/ev').push(); return r.set(msg);
    },
    on(topic, h) { handlers.push(h); return () => {}; },
    presence(p) { myPres = fbClean(p); return writePres(); },
    onPeers(cb) {
      let prev = new Map();
      rdb.ref('presence').on('value', s => {
        const val = s.val() || {};
        /* Un autre onglet du même joueur s'est fermé et a effacé la présence commune. */
        if (myPres && connected && !val[uid]) writePres().catch(() => {});
        const peers = Object.entries(val).map(([k, p]) => ({ kind: 'viewer', isMe: k === uid, peer: k, presence: p || {} }));
        const cur = new Map(peers.map(p => [p.peer, p]));
        const left = [...prev.values()].filter(p => !cur.has(p.peer));
        prev = cur;
        cb({ peers, left, joined: [], updated: [] });
      }, () => cb({ peers: [], left: [], joined: [], updated: [] }));
    },
    watch, unwatch,
    cleanup(id) { if (id) setTimeout(() => rdb.ref('duo/live/' + id).remove().catch(() => {}), 8000); },
  };
}

const FB = {
  available: () => typeof firebase !== 'undefined' && !!firebase.initializeApp,
  started: false,
  lastError: null,
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
    return { db: fbDb(rdb), room: fbRoom(rdb, user.uid), rdb };
  },
};

/* ===================== RÈGLES (pur, sans DOM) ===================== */
const VERSION = 2;
const GRID = 24, EDGE = 2;
const RES = ['bois', 'pierre', 'vivres'];
const RES_LABEL = { bois: 'Bois', pierre: 'Pierre', vivres: 'Vivres' };
const COLORS = ['#D27A22', '#2F8A63', '#4A78C2', '#B24F78', '#8A67C6'];
const BOT_COLOR = '#7A2E2E';

const BLD = {
  mairie: { name: 'Halle du clan', size: 3, max: 5, cost: { bois: 250, pierre: 200 }, mul: 2.4, time: 4, tmul: 3, hp: 2700, desc: 'Le cœur du village nain. L’améliorer débloque des bâtiments, des niveaux et des ouvriers.' },
  scierie: { name: 'Scierie', size: 2, max: 5, cost: { bois: 60, pierre: 30 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'bois', base: 120, desc: 'Produit du bois, même quand vous n’êtes pas là.' },
  carriere: { name: 'Mine', size: 2, max: 5, cost: { bois: 90 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'pierre', base: 90, desc: 'Les mineurs creusent la montagne et en tirent de la pierre.' },
  ferme: { name: 'Moulin', size: 2, max: 5, cost: { bois: 70, pierre: 30 }, mul: 2, time: 1, tmul: 2.6, hp: 575, prod: 'vivres', base: 120, desc: 'Moud le grain qui nourrit les troupes.' },
  entrepot: { name: 'Entrepôt', size: 2, max: 5, cost: { bois: 150, pierre: 100 }, mul: 2.2, time: 2, tmul: 2.6, hp: 1080, desc: '+1 000 de stockage par niveau, pour chaque ressource.' },
  caserne: { name: 'Caserne', size: 2, max: 3, cost: { bois: 150, pierre: 80 }, mul: 3, time: 2, tmul: 3, hp: 810, desc: 'Entraîne les guerriers nains. Niveau 2 : arbalétriers. Niveau 3 : béliers.' },
  camp: { name: 'Taverne', size: 3, max: 5, cost: { bois: 180, pierre: 60 }, mul: 2.2, time: 2, tmul: 2.6, hp: 810, desc: 'Les guerriers y logent entre deux raids : 20 places, puis 10 de plus par niveau.' },
  tour: { name: 'Tour d’arbalétriers', size: 2, max: 5, cost: { bois: 200, pierre: 120 }, mul: 2.1, time: 2, tmul: 2.6, hp: 900, def: { range: 6.5, dmg: 28, rate: 1, speed: 14, kind: 'arrow' }, desc: 'Défense rapide qui tire sur tout ce qui approche.' },
  baliste: { name: 'Tour de garde', size: 2, max: 5, cost: { bois: 350, pierre: 350 }, mul: 2.1, time: 6, tmul: 2.6, hp: 1080, def: { range: 5.2, dmg: 110, rate: 2.2, speed: 18, kind: 'bolt' }, desc: 'Grosse arbalète de rempart : gros dégâts, une cible à la fois.' },
  mangonneau: { name: 'Catapulte', size: 2, max: 5, cost: { bois: 700, pierre: 800 }, mul: 2.1, time: 15, tmul: 2.6, hp: 1170, def: { range: 8, min: 2.5, dmg: 60, rate: 3.6, speed: 7, splash: 1.4, kind: 'stone' }, desc: 'Lance des pierres sur les groupes, mais ne peut pas viser au pied des murs.' },
};
const SHOP = ['scierie', 'carriere', 'ferme', 'entrepot', 'caserne', 'camp', 'tour', 'baliste', 'mangonneau'];
const LIMITS = {
  mairie: [1, 1, 1, 1, 1],
  scierie: [1, 2, 2, 3, 3], carriere: [1, 1, 2, 2, 3], ferme: [1, 2, 2, 3, 3], entrepot: [1, 1, 2, 2, 3],
  caserne: [1, 1, 1, 2, 2], camp: [1, 1, 2, 2, 3],
  tour: [1, 2, 2, 3, 4], baliste: [0, 1, 1, 2, 2], mangonneau: [0, 0, 1, 1, 2],
};
const TROOPS = {
  fantassin: { name: 'Guerrier', plural: 'Guerriers', foe: 'Orque', space: 1, cost: 25, time: 12, hp: 80, dmg: 11, hit: 1, range: 0.6, speed: 1.6, pref: 'any', cas: 1, desc: 'Nain à la hache, solide et pas cher. Frappe le bâtiment le plus proche.' },
  archer: { name: 'Arbalétrier', plural: 'Arbalétriers', foe: 'Archer orque', space: 1, cost: 50, time: 18, hp: 36, dmg: 9, hit: 1, range: 3.4, speed: 1.9, pref: 'any', cas: 2, desc: 'Tire de loin à l’arbalète, mais tombe vite.' },
  belier: { name: 'Bélier', plural: 'Béliers', foe: 'Troll', space: 5, cost: 300, time: 80, hp: 700, dmg: 50, hit: 2, range: 0.6, speed: 0.8, pref: 'def', cas: 3, desc: 'Poussé par quatre nains, très résistant. Fonce sur les défenses.' },
};
const TROOP_KEYS = ['fantassin', 'archer', 'belier'];
const LEAGUES = [
  { name: 'Paysans', min: 0, reward: 150, loss: 0 },
  { name: 'Écuyers', min: 60, reward: 350, loss: 5 },
  { name: 'Chevaliers', min: 150, reward: 700, loss: 5 },
  { name: 'Barons', min: 300, reward: 1200, loss: 15 },
  { name: 'Comtes', min: 500, reward: 2000, loss: 25 },
  { name: 'Ducs', min: 750, reward: 3000, loss: 35 },
  { name: 'Rois', min: 1050, reward: 4500, loss: 50 },
];
const EPOCH0 = Date.UTC(2026, 9, 10, 18, 0, 0); // un samedi, 20 h à Paris
const PERIOD = 48 * 3600000;
const epochAt = t => Math.floor((t - EPOCH0) / PERIOD);
const nextEpochTime = t => EPOCH0 + (epochAt(t) + 1) * PERIOD;
const leagueOf = m => { let i = 0; for (let k = 0; k < LEAGUES.length; k++) if ((m || 0) >= LEAGUES[k].min) i = k; return i; };
const chestOf = L => ({ bois: LEAGUES[L].reward, pierre: LEAGUES[L].reward, vivres: Math.round(LEAGUES[L].reward * 0.8) });
const CROWN_MEDALS = [0, 10, 20, 35];
const MARK_BONUS = [0, 0.1, 0.25, 0.5];
const sabresOf = pct => pct >= 0.999 ? 3 : pct >= 0.75 ? 2 : pct >= 0.5 ? 1 : 0;
const crownsOf = B => B.stars;
const LAIRS = ['Camp des Crocs-Noirs', 'Repaire de Gromash', 'Fosse aux Trolls', 'Bivouac des Mâche-Os', 'Tanière du chef Urgluk', 'Palissade des Sans-Oreilles', 'Fort des Crânes Rouges', 'Marais des Trolls Gris', 'Campement des Brise-Haches', 'Antre de Morg le Borgne', 'Butte des Ronge-Pierres', 'Camp de la Dent Cassée'];
const FORTS = ['Citadelle de Grakkhar', 'Forteresse du Roi Troll', 'Bastion des Mille Crocs', 'Donjon d’Ombre-Fer', 'Fort de la Horde Rouge'];

/* ---------- outils ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- bâtiments ---------- */
const hpOf = (type, lvl) => Math.round(BLD[type].hp * (1 + 0.35 * (lvl - 1)));
function defOf(type, lvl) { const d = BLD[type].def; if (!d) return null; return Object.assign({}, d, { dmg: d.dmg * (1 + 0.3 * (lvl - 1)) }); }
function costOf(type, toLvl) { const d = BLD[type], c = {}; for (const k in d.cost) c[k] = Math.round(d.cost[k] * Math.pow(d.mul, toLvl - 1) / 5) * 5; return c; }
function timeOf(type, toLvl) { return Math.round(BLD[type].time * Math.pow(BLD[type].tmul, toLvl - 1) * 60000); }
const maxLvlOf = (type, th) => type === 'mairie' ? 5 : Math.min(BLD[type].max, th + 1);
const limitOf = (type, th) => LIMITS[type][Math.max(1, Math.min(5, th)) - 1];
const prodRate = (type, lvl) => BLD[type].base * (1 + 0.7 * (lvl - 1));
const campCap = lvl => 20 + 10 * (lvl - 1);

/* ---------- village ---------- */
const thOf = v => { const m = v.b.find(b => b.type === 'mairie'); return m ? Math.max(1, m.lvl) : 1; };
const capOf = v => 500 + 500 * thOf(v) + v.b.reduce((a, b) => a + (b.type === 'entrepot' ? b.lvl * 1000 : 0), 0);
const housingOf = v => v.b.reduce((a, b) => a + (b.type === 'camp' && b.lvl > 0 ? campCap(b.lvl) : 0), 0);
const armySpace = v => TROOP_KEYS.reduce((a, k) => a + (v.army[k] || 0) * TROOPS[k].space, 0);
const armyCount = v => TROOP_KEYS.reduce((a, k) => a + (v.army[k] || 0), 0);
const queueSpace = v => v.train.reduce((a, q) => a + q.n * TROOPS[q.u].space, 0);
const casernes = v => v.b.filter(b => b.type === 'caserne' && b.lvl > 0).length;
const casLvl = v => v.b.reduce((a, b) => b.type === 'caserne' ? Math.max(a, b.lvl) : a, 0);
const buildersOf = v => 1 + (thOf(v) >= 2 ? 1 : 0) + (thOf(v) >= 4 ? 1 : 0);
const busyBuilders = v => v.b.filter(b => b.up).length;
const countOf = (v, type) => v.b.filter(b => b.type === type).length;
function prodOf(v, t) {
  const out = { bois: 0, pierre: 0, vivres: 0 }, m = v.buff > t ? 1.25 : 1;
  for (const b of v.b) { const d = BLD[b.type]; if (d.prod && b.lvl > 0) out[d.prod] += prodRate(b.type, b.lvl) * m; }
  return out;
}
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
function addLog(v, t, m) { v.log.push({ t: Math.round(t), m }); if (v.log.length > 30) v.log.splice(0, v.log.length - 30); }
function fmtRes(c) { return RES.filter(k => c[k]).map(k => c[k] + ' ' + RES_LABEL[k].toLowerCase()).join(', '); }
function missingTxt(v, c) {
  const miss = RES.filter(k => (c[k] || 0) > v.r[k]);
  if (!miss.length) return '';
  return 'Il manque ' + miss.map(k => Math.ceil(c[k] - v.r[k]) + ' de ' + RES_LABEL[k].toLowerCase()).join(' et ') + '.';
}
function pay(v, c) { for (const k in c) v.r[k] = Math.max(0, v.r[k] - c[k]); }

function newVillage(key, name, c, t) {
  const v = {
    v: VERSION, key, name, c, t, born: t, seed: (hash(Math.floor(t / 1000) % 2147483647) ^ hashStr(key)) >>> 0,
    r: { bois: 500, pierre: 300, vivres: 300 }, b: [], nid: 1,
    army: { fantassin: 15, archer: 0, belier: 0 }, train: [], trainP: 0,
    medals: 0, ep: epochAt(t), played: 0, chest: null, lastDuo: 0, nextRaid: t + 12 * 3600000, shield: 0, raids: 0, lastActive: t, buff: 0,
    log: [], reports: [], claimed: [],
  };
  const add = (type, gx, gz) => v.b.push({ id: v.nid++, type, lvl: 1, gx, gz, up: null });
  add('mairie', 10, 10); add('tour', 14, 10); add('scierie', 6, 8); add('ferme', 6, 12); add('caserne', 10, 14); add('camp', 14, 14);
  addLog(v, t, 'Fondation de ' + name + '.');
  return v;
}

function stepVillage(v, dt) {
  const t = v.t, h = dt / 3600000, cap = capOf(v), p = prodOf(v, t);
  for (const k of RES) v.r[k] = Math.max(0, Math.min(Math.max(cap, v.r[k]), v.r[k] + p[k] * h));
  for (const b of v.b) {
    if (b.up && b.up.t1 <= t + dt) {
      const at = b.up.t1; b.lvl += 1; b.up = null;
      addLog(v, at, 'Travaux terminés : ' + BLD[b.type].name.toLowerCase() + (b.lvl > 1 ? ' niveau ' + b.lvl : '') + '.');
    }
  }
  const nc = casernes(v);
  if (v.train.length && nc) {
    v.trainP += dt / 1000 * nc;
    while (v.train.length) {
      const q = v.train[0], T = TROOPS[q.u];
      if (v.trainP < T.time) break;
      if (armySpace(v) + T.space > housingOf(v)) { v.trainP = T.time; break; }
      v.trainP -= T.time; v.army[q.u] = (v.army[q.u] || 0) + 1; q.n--;
      if (q.n <= 0) v.train.shift();
    }
    if (!v.train.length) v.trainP = 0;
  }
  const e = epochAt(t + dt);
  while (v.ep < e) {
    v.ep++;
    const at = EPOCH0 + v.ep * PERIOD, L = leagueOf(v.medals);
    if (v.played > 0) {
      const c = chestOf(L), old = v.chest || { bois: 0, pierre: 0, vivres: 0 };
      v.chest = { bois: old.bois + c.bois, pierre: old.pierre + c.pierre, vivres: old.vivres + c.vivres };
      addLog(v, at, 'Récompense de la ligue des ' + LEAGUES[L].name + ' arrivée : elle t’attend dans le menu À deux.');
    } else if (L > 0) {
      v.medals = LEAGUES[L - 1].min;
      addLog(v, at, 'Aucun raid à deux en 2 jours : pas de récompense, retour en ligue des ' + LEAGUES[L - 1].name + '.');
    } else addLog(v, at, 'Aucun raid à deux en 2 jours : pas de récompense de ligue.');
    v.played = 0;
  }
  if (t + dt >= v.nextRaid) {
    if (t + dt - (v.lastActive || 0) < 10 * 60000) v.nextRaid = t + dt + 15 * 60000;
    else runRaid(v, Math.max(v.nextRaid, t));
  }
}
function simulateVillage(v, now) {
  if (now - v.t > 14 * 86400000) v.t = now - 14 * 86400000;
  while (v.t < now) { const dt = Math.min(60000, now - v.t); stepVillage(v, dt); v.t += dt; }
  return v;
}
const RAID_BUDGET = [10, 22, 70, 120, 190];
const raidBudget = th => RAID_BUDGET[Math.max(1, Math.min(5, th)) - 1];
function layoutOf(v) { return v.b.filter(b => b.lvl > 0).map(b => [b.type, b.lvl, b.gx, b.gz]); }
function runRaid(v, t) {
  const layout = layoutOf(v);
  const seed = hash((v.seed ^ Math.imul(v.raids + 1, 2654435761)) >>> 0);
  const budget = raidBudget(thOf(v));
  const res = simulateRaid(layout, seed, budget);
  const lost = {};
  for (const k of RES) { lost[k] = Math.floor(v.r[k] * 0.25 * res.pct); v.r[k] -= lost[k]; }
  v.raids++;
  const shieldH = res.pct >= 0.75 ? 10 : res.pct >= 0.5 ? 7 : 4;
  v.shield = Math.round(t + shieldH * 3600000);
  const R = mulberry32(seed ^ 0x9e37);
  v.nextRaid = Math.round(v.shield + (1 + R() * 4) * 3600000);
  v.reports.push({ t: Math.round(t), seed, budget, layout, pct: Math.round(res.pct * 100), lost });
  if (v.reports.length > 5) v.reports.shift();
  const pct = Math.round(res.pct * 100);
  addLog(v, t, res.pct >= 0.5
    ? 'Des orques ont pillé le village : ' + pct + ' % détruit.'
    : 'Attaque d’orques repoussée (' + pct + ' % de dégâts).');
}

/* Actions sur son propre village. Retourne {ok, err, ...}. */
function applyV(v, a, t) {
  const fail = err => ({ ok: false, err });
  const th = thOf(v);
  let out = { ok: true };
  switch (a.type) {
    case 'build': {
      const d = BLD[a.b]; if (!d || a.b === 'mairie') return fail('Bâtiment inconnu.');
      if (countOf(v, a.b) >= limitOf(a.b, th)) return fail(limitOf(a.b, th) === 0 ? 'Débloqué avec une maison commune plus grande.' : 'Nombre maximum atteint. Améliorez la maison commune pour en construire plus.');
      if (busyBuilders(v) >= buildersOf(v)) return fail('Tous les ouvriers sont occupés.');
      if (!fits(v, a.b, a.gx, a.gz)) return fail('Emplacement occupé ou trop près du bord.');
      const c = costOf(a.b, 1), m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      v.b.push({ id: v.nid++, type: a.b, lvl: 0, gx: a.gx, gz: a.gz, up: { t0: t, t1: t + timeOf(a.b, 1) } });
      addLog(v, t, 'Chantier lancé : ' + d.name.toLowerCase() + '.');
      break;
    }
    case 'upgrade': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (b.up) return fail('Ce bâtiment est déjà en travaux.');
      const to = b.lvl + 1;
      if (to > maxLvlOf(b.type, th)) return fail(to > BLD[b.type].max || b.type === 'mairie' ? 'Niveau maximum atteint.' : 'Améliorez d’abord la maison commune.');
      if (busyBuilders(v) >= buildersOf(v)) return fail('Tous les ouvriers sont occupés.');
      const c = costOf(b.type, to), m = missingTxt(v, c); if (m) return fail(m);
      if (RES.some(k => (c[k] || 0) > capOf(v))) return fail('Vos entrepôts sont trop petits pour réunir ce coût.');
      pay(v, c); b.up = { t0: t, t1: t + timeOf(b.type, to) };
      addLog(v, t, 'Amélioration lancée : ' + BLD[b.type].name.toLowerCase() + ' niveau ' + to + '.');
      break;
    }
    case 'move': {
      const b = v.b.find(x => x.id === a.id); if (!b) return fail('Bâtiment introuvable.');
      if (!fits(v, b.type, a.gx, a.gz, b.id)) return fail('Emplacement occupé ou trop près du bord.');
      b.gx = a.gx; b.gz = a.gz;
      break;
    }
    case 'train': {
      const T = TROOPS[a.u]; if (!T) return fail('Troupe inconnue.');
      if (casLvl(v) < T.cas) return fail('Il faut une caserne de niveau ' + T.cas + '.');
      const n = Math.max(1, Math.min(50, a.n | 0));
      if (armySpace(v) + queueSpace(v) + n * T.space > housingOf(v)) return fail('Plus de place dans les tavernes. Construisez-en ou améliorez-les.');
      const c = { vivres: n * T.cost }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      const last = v.train[v.train.length - 1];
      if (last && last.u === a.u) last.n += n; else v.train.push({ u: a.u, n });
      break;
    }
    case 'untrain': {
      const q = v.train[a.i]; if (!q) return fail('Rien à annuler.');
      q.n--; v.r.vivres = Math.min(Math.max(capOf(v), v.r.vivres), v.r.vivres + TROOPS[q.u].cost);
      if (q.n <= 0) { v.train.splice(a.i, 1); if (a.i === 0) v.trainP = 0; }
      break;
    }
    case 'reroll': {
      const c = { vivres: a.cost | 0 }, m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      break;
    }
    case 'battle': {
      for (const k of TROOP_KEYS) v.army[k] = Math.max(0, (v.army[k] || 0) - ((a.used && a.used[k]) | 0));
      const cap = capOf(v), got = {};
      for (const k of RES) { const g = Math.max(0, (a.loot && a.loot[k]) | 0); got[k] = Math.max(0, Math.min(g, cap - v.r[k])); v.r[k] += got[k]; }
      let dM = 0;
      if (a.kind === 'duo') {
        const L = leagueOf(v.medals), n = Math.max(0, Math.min(3, a.mark | 0));
        dM = n > 0 ? CROWN_MEDALS[n] : -LEAGUES[L].loss;
        v.medals = Math.max(0, v.medals + dM); v.played = (v.played || 0) + 1; v.lastDuo = Math.round(t);
        if (n >= 3) v.buff = Math.round(t + 12 * 3600000);
        addLog(v, t, 'Raid à deux sur ' + a.name + ' : ' + n + ' couronne' + (n > 1 ? 's' : '') + ', ' + a.pct + ' %, ' + (dM >= 0 ? '+' : '−') + Math.abs(dM) + ' médailles' + (fmtRes(got) ? ', butin ' + fmtRes(got) : '') + '.');
      } else if (a.deployed) {
        const n = Math.max(0, Math.min(3, a.mark | 0));
        addLog(v, t, 'Raid solo sur ' + a.name + ' : ' + n + ' sabre' + (n > 1 ? 's' : '') + ', ' + a.pct + ' %' + (fmtRes(got) ? ', butin ' + fmtRes(got) : '') + '.');
      }
      out.got = got; out.dM = dM;
      break;
    }
    case 'giftOut': {
      const c = {}; for (const k of RES) c[k] = Math.max(0, (a.r && a.r[k]) | 0);
      if (!RES.some(k => c[k] > 0)) return fail('Choisis ce que tu veux envoyer.');
      const m = missingTxt(v, c); if (m) return fail(m);
      pay(v, c);
      addLog(v, t, 'Envoyé à ' + a.toName + ' : ' + fmtRes(c) + '.');
      break;
    }
    case 'claim': {
      if (v.claimed.includes(a.gid)) return fail('Cadeau déjà reçu.');
      const cap = capOf(v);
      for (const k of RES) v.r[k] = Math.min(Math.max(cap, v.r[k]), v.r[k] + Math.max(0, (a.r && a.r[k]) | 0));
      v.claimed.push(a.gid); if (v.claimed.length > 30) v.claimed.shift();
      addLog(v, t, 'Cadeau de ' + a.fromName + ' : ' + fmtRes(a.r || {}) + '.');
      break;
    }
    case 'chest': {
      if (!v.chest) return fail('Aucune récompense à récupérer.');
      const cap = capOf(v), got = {};
      for (const k of RES) got[k] = Math.max(0, Math.min(v.chest[k] | 0, Math.floor(cap - v.r[k])));
      if (!RES.some(k => got[k] > 0)) return fail('Stockage plein : améliorez ou construisez un entrepôt.');
      for (const k of RES) { v.r[k] += got[k]; v.chest[k] -= got[k]; }
      if (RES.every(k => v.chest[k] <= 0)) v.chest = null;
      out.got = got; out.left = !!v.chest;
      addLog(v, t, 'Récompense de ligue récupérée : ' + fmtRes(got) + (v.chest ? ' (le reste attend de la place)' : '') + '.');
      break;
    }
    case 'ping': break;
    default: return fail('Action inconnue.');
  }
  v.lastActive = Math.round(t);
  return out;
}

/* ===================== BATAILLE ===================== */
const DT = 0.1;
function makeBattle(layout, limit) {
  const B = { t: 0, tk: 0, units: [], blds: [], proj: [], shots: [], uid: 1, over: false, limit: limit || 180, destroyed: 0, stars: 0, pct: 0, noMore: false, thDown: false, events: [] };
  layout.forEach(([type, lvl, gx, gz], i) => {
    const s = BLD[type].size, d = defOf(type, lvl), hp = hpOf(type, lvl);
    B.blds.push({ i, type, lvl, gx, gz, s, x: gx + s / 2, z: gz + s / 2, h: s / 2, hp, max: hp, def: d, cd: d ? 0.5 : 0, dead: false, tx: 0, tz: 0, fired: -9 });
  });
  B.total = B.blds.length || 1;
  return B;
}
function distRect(x, z, b) { const dx = Math.max(Math.abs(x - b.x) - b.h, 0), dz = Math.max(Math.abs(z - b.z) - b.h, 0); return Math.sqrt(dx * dx + dz * dz); }
function canDeploy(B, x, z) {
  if (x < 0.2 || z < 0.2 || x > GRID - 0.2 || z > GRID - 0.2) return false;
  for (const b of B.blds) if (distRect(x, z, b) < 1) return false;
  return true;
}
function deploy(B, type, x, z, owner, force) {
  if (B.over || !TROOPS[type]) return null;
  if (!force && !canDeploy(B, x, z)) return null;
  const T = TROOPS[type];
  const u = { id: B.uid++, type, x, z, px: x, pz: z, hp: T.hp, max: T.hp, owner: owner || 0, tgt: -1, cd: 0.4, dead: false, mv: 0, atk: -9 };
  B.units.push(u);
  return u;
}
function pickTarget(B, u) {
  const pref = TROOPS[u.type].pref;
  const onlyDef = pref === 'def' && B.blds.some(b => !b.dead && b.def);
  let best = -1, bd = 1e9;
  for (const b of B.blds) {
    if (b.dead || (onlyDef && !b.def)) continue;
    const d = distRect(u.x, u.z, b);
    if (d < bd) { bd = d; best = b.i; }
  }
  return best;
}
function hurt(u, dmg) { u.hp -= dmg; if (u.hp <= 0) { u.hp = 0; u.dead = true; } }
function destroyBld(B, b) {
  b.dead = true; b.hp = 0; B.destroyed++;
  if (b.type === 'mairie') B.thDown = true;
  B.pct = B.destroyed / B.total;
  B.stars = (B.pct >= 0.5 ? 1 : 0) + (B.thDown ? 1 : 0) + (B.destroyed >= B.total ? 1 : 0);
  B.events.push({ k: 'down', i: b.i });
}
function stepBattle(B) {
  if (B.over) return;
  for (const u of B.units) { u.px = u.x; u.pz = u.z; }
  for (const u of B.units) {
    if (u.dead) continue;
    const T = TROOPS[u.type];
    let b = u.tgt >= 0 ? B.blds[u.tgt] : null;
    if (!b || b.dead) { u.tgt = pickTarget(B, u); b = u.tgt >= 0 ? B.blds[u.tgt] : null; }
    if (!b) { u.mv = 0; continue; }
    const d = distRect(u.x, u.z, b);
    if (d > T.range) {
      const px = Math.max(b.x - b.h, Math.min(u.x, b.x + b.h)), pz = Math.max(b.z - b.h, Math.min(u.z, b.z + b.h));
      const dx = px - u.x, dz = pz - u.z, L = Math.sqrt(dx * dx + dz * dz) || 1;
      const len = Math.min(T.speed * DT, d - T.range * 0.85);
      u.x += dx / L * len; u.z += dz / L * len; u.mv = 1;
    } else {
      u.mv = 0; u.cd -= DT;
      if (u.cd <= 0) {
        u.cd += T.hit; u.atk = B.t; b.hp -= T.dmg;
        if (u.type === 'archer') B.shots.push({ k: 'arrowU', fx: u.x, fz: u.z, tx: b.x, tz: b.z, t: B.t });
        if (b.hp <= 0) destroyBld(B, b);
      }
    }
  }
  for (const b of B.blds) {
    if (b.dead || !b.def) continue;
    b.cd -= DT; if (b.cd > 0) continue;
    const D = b.def; let best = null, bd = 1e9;
    for (const u of B.units) {
      if (u.dead) continue;
      const dx = u.x - b.x, dz = u.z - b.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d <= D.range && d >= (D.min || 0) && d < bd) { bd = d; best = u; }
    }
    if (!best) { b.cd = 0.1; continue; }
    b.cd = D.rate; b.tx = best.x; b.tz = best.z; b.fired = B.t;
    const p = { k: D.kind, b: b.i, x0: b.x, z0: b.z, tx: best.x, tz: best.z, uid: best.id, age: 0, dur: Math.max(0.15, bd / D.speed), dmg: D.dmg, splash: D.splash || 0 };
    B.proj.push(p); B.shots.push(Object.assign({ t: B.t }, p));
  }
  for (const p of B.proj) {
    p.age += DT;
    if (p.age + 1e-9 >= p.dur) {
      p.done = true;
      if (p.splash) {
        for (const u of B.units) if (!u.dead) { const dx = u.x - p.tx, dz = u.z - p.tz; if (dx * dx + dz * dz <= p.splash * p.splash) hurt(u, p.dmg); }
        B.events.push({ k: 'boom', x: p.tx, z: p.tz });
      } else {
        const u = B.units.find(q => q.id === p.uid);
        if (u && !u.dead) hurt(u, p.dmg);
      }
    }
  }
  B.proj = B.proj.filter(p => !p.done);
  B.t = Math.round((B.t + DT) * 10) / 10; B.tk++;
  const alive = B.units.some(u => !u.dead);
  if (B.destroyed >= B.total || B.t >= B.limit || (B.noMore && !alive)) B.over = true;
}
function botPlan(seed, budget) {
  const R = mulberry32(seed), plan = [];
  const bel = budget >= 20 ? Math.floor(budget / 20) : 0;
  const rest = budget - bel * 5;
  const arch = Math.floor(rest * (0.25 + R() * 0.2)), fan = rest - arch;
  const sides = R() < 0.6 ? [Math.floor(R() * 4)] : [Math.floor(R() * 4), Math.floor(R() * 4)];
  const centers = sides.map(() => 5 + R() * (GRID - 10));
  const at = (k, spread) => {
    const side = sides[k % sides.length], c = centers[k % sides.length];
    const a = Math.max(0.5, Math.min(GRID - 0.5, c + (R() - 0.5) * spread)), off = 0.5 + R() * 0.5;
    return side === 0 ? [a, off] : side === 1 ? [GRID - off, a] : side === 2 ? [a, GRID - off] : [off, a];
  };
  for (let i = 0; i < bel; i++) { const [x, z] = at(i, 3); plan.push({ t: 1 + i * 0.6, u: 'belier', x, z }); }
  for (let i = 0; i < fan; i++) { const [x, z] = at(i, 5); plan.push({ t: 2.5 + Math.floor(i / 3) * 0.5 + R() * 0.3, u: 'fantassin', x, z }); }
  for (let i = 0; i < arch; i++) { const [x, z] = at(i, 5); plan.push({ t: 5 + i * 0.35, u: 'archer', x, z }); }
  plan.sort((a, b) => a.t - b.t);
  return plan.map(p => ({ t: Math.round(p.t * 10) / 10, u: p.u, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 }));
}
function simulateRaid(layout, seed, budget) {
  const plan = botPlan(seed, budget), B = makeBattle(layout);
  let i = 0;
  while (!B.over) {
    while (i < plan.length && plan[i].t <= B.t + 1e-9) { deploy(B, plan[i].u, plan[i].x, plan[i].z, 1, true); i++; }
    if (i >= plan.length) B.noMore = true;
    stepBattle(B);
  }
  return { stars: B.stars, pct: B.pct };
}

/* ---------- villages de brigands ---------- */
function genBot(seed, th, fortress, league) {
  const lg = fortress ? Math.max(0, Math.min(LEAGUES.length - 1, league | 0)) : 0;
  const R = mulberry32(seed), v = { b: [], nid: 1 };
  th = Math.max(1, Math.min(5, th));
  const lvl = type => Math.max(1, Math.min(Math.min(5, maxLvlOf(type, th) + (lg >= 3 ? 1 : 0)), th - (R() < 0.5 ? 1 : 0) + (R() < 0.25 || fortress ? 1 : 0) + (lg >= 3 ? 1 : 0)));
  const place = (type, l, rMin, rMax) => {
    const s = BLD[type].size;
    for (let k = 0; k < 120; k++) {
      const dx = (R() * 2 - 1) * rMax, dz = (R() * 2 - 1) * rMax;
      if (Math.max(Math.abs(dx), Math.abs(dz)) < rMin) continue;
      const gx = Math.round(GRID / 2 + dx - s / 2), gz = Math.round(GRID / 2 + dz - s / 2);
      if (fits(v, type, gx, gz)) { v.b.push({ id: v.nid++, type, lvl: l, gx, gz }); return true; }
    }
    return false;
  };
  place('mairie', Math.min(5, th + (fortress ? 1 : 0)), 0, 1.5);
  const nT = limitOf('tour', th) + 1 + (fortress ? 1 + Math.floor(lg / 2) : 0), nB = limitOf('baliste', th) + (fortress && th >= 2 ? 1 : 0), nM = limitOf('mangonneau', th) + (fortress && th >= 3 ? 1 : 0);
  for (let i = 0; i < nT; i++) place('tour', lvl('tour'), 2.5, 5.5);
  for (let i = 0; i < nB; i++) place('baliste', lvl('baliste'), 1.5, 4.5);
  for (let i = 0; i < nM; i++) place('mangonneau', lvl('mangonneau'), 0.5, 3.5);
  for (const type of ['scierie', 'carriere', 'ferme', 'entrepot', 'caserne', 'camp']) {
    const n = Math.max(1, limitOf(type, th) - (R() < 0.4 ? 1 : 0)) + (fortress ? 1 : 0);
    for (let i = 0; i < n; i++) place(type, lvl(type), 4, 8.5);
  }
  const names = fortress ? FORTS : LAIRS;
  const name = names[Math.floor(R() * names.length)];
  const loot = {};
  for (const k of RES) loot[k] = Math.round((300 + 260 * th) * (0.75 + R() * 0.5) * (fortress ? 1.8 * (1 + 0.15 * lg) : 1) * (k === 'vivres' ? 0.8 : 1) / 5) * 5;
  return { name, th, fortress: !!fortress, league: lg, layout: v.b.map(b => [b.type, b.lvl, b.gx, b.gz]), loot };
}
function lootFor(bot, pct, mark) { const g = {}; for (const k of RES) g[k] = Math.floor(bot.loot[k] * (pct + MARK_BONUS[Math.max(0, Math.min(3, mark | 0))])); return g; }

/* ===================== VUE 3D (three.js r128) ===================== */
const V3 = (() => {
  const half = GRID / 2;
  let renderer = null, scene, camera, hemi, sun, ok = false, canvas, aspect = 1;
  const YAW = Math.PI / 4, PITCH = 0.68;
  const cam = { tx: 0, tz: 0, view: 18 };
  const M = {}, G = {};
  let winMat, fireMat, barBg, selMat, ghostOk, ghostBad, zoneTex, zoneMesh, gridMesh, selMesh, ghostMesh, ringMat, ringFill, glowTex, emberMat;
  const bldGroup = new THREE.Group(), unitGroup = new THREE.Group(), fxGroup = new THREE.Group(), rangeGroup = new THREE.Group();
  const decoProc = new THREE.Group(), decoModel = new THREE.Group();
  const blds = new Map();   // key -> {g, sig, item, info, bar, hp, glow}
  const units = new Map();  // id -> {g, lx, lz, model}
  const dying = [], shots = [], puffs = [], embers = [];
  let anims = [];
  let frameHook = null, tapHook = null, mood = '', groundMat = null, outerMat = null;
  const LIB = { ok: false, b: {}, ch: {}, tex: {}, ver: 0, xbow: null };
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

  /* ---------- décor ---------- */
  function grassTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), px = 512 / GRID;
    x.fillStyle = '#86ad52'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) if ((i + j) % 2) { x.fillStyle = 'rgba(255,240,200,0.045)'; x.fillRect(i * px, j * px, px, px); }
    x.fillStyle = 'rgba(90,70,30,0.12)';
    x.fillRect(0, 0, 512, EDGE * px); x.fillRect(0, 512 - EDGE * px, 512, EDGE * px); x.fillRect(0, 0, EDGE * px, 512); x.fillRect(512 - EDGE * px, 0, EDGE * px, 512);
    const R = mulberry32(42);
    for (let i = 0; i < 1800; i++) { x.fillStyle = R() < 0.5 ? 'rgba(40,70,20,0.2)' : 'rgba(230,220,140,0.16)'; x.fillRect(R() * 512, R() * 512, 2, 3); }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
  }
  function radialTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function buildWorld() {
    outerMat = new THREE.MeshLambertMaterial({ color: lin(0x7f9a44) });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), outerMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);
    groundMat = new THREE.MeshLambertMaterial({ map: grassTexture() });
    const play = new THREE.Mesh(new THREE.PlaneGeometry(GRID + 0.6, GRID + 0.6), groundMat);
    play.rotation.x = -Math.PI / 2; play.position.y = -0.005; play.receiveShadow = true; scene.add(play);
    const R = mulberry32(7);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + R() * 0.2, r = 60 + R() * 30, h = 18 + R() * 26, w = 22 + R() * 22;
      const m = P('cone7', R() < 0.5 ? 0x6f7d86 : 0x5f6f66, w, h, w * (0.8 + R() * 0.4), Math.cos(a) * r, -0.5, Math.sin(a) * r, R() * 3, true);
      decoProc.add(m);
    }
    const pts = [];
    while (pts.length < 140) {
      const x = (R() * 2 - 1) * 34, z = (R() * 2 - 1) * 34;
      if (Math.abs(x) < half + 1.6 && Math.abs(z) < half + 1.6) continue;
      pts.push([x, z, 0.8 + R() * 0.9]);
    }
    const fol = new THREE.InstancedMesh(geo('cone6'), mat(0x2f5a3a), pts.length), trunk = new THREE.InstancedMesh(geo('cyl6'), mat(0x5a3d22), pts.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    pts.forEach(([x, z, s], i) => {
      ps.set(x, 0, z); sc.set(0.25 * s, 0.7 * s, 0.25 * s); m4.compose(ps, q, sc); trunk.setMatrixAt(i, m4);
      ps.set(x, 0.5 * s, z); sc.set(1.5 * s, 2.6 * s, 1.5 * s); m4.compose(ps, q, sc); fol.setMatrixAt(i, m4);
    });
    fol.castShadow = true; decoProc.add(fol); decoProc.add(trunk);
    scene.add(decoProc);
  }
  function buildWorldModels() {
    while (decoModel.children.length) decoModel.remove(decoModel.children[0]);
    const R = mulberry32(11);
    const put = (name, x, z, s, ry) => {
      const p = LIB.b[name]; if (!p) return;
      const o = p.scene.clone(true); o.scale.setScalar(s); o.position.set(x, -0.02, z); o.rotation.y = ry;
      o.traverse(m => { if (m.isMesh) { m.castShadow = Math.abs(x) < 24 && Math.abs(z) < 24; m.receiveShadow = true; } });
      decoModel.add(o);
    };
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + R() * 0.2, r = 44 + R() * 16; put(['mountain_A', 'mountain_B', 'mountain_C'][i % 3], Math.cos(a) * r, Math.sin(a) * r, 9 + R() * 5, R() * 6.28); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + R() * 0.3, r = 25 + R() * 9; put(R() < 0.5 ? 'hills_A' : 'hills_C', Math.cos(a) * r, Math.sin(a) * r, 4 + R() * 2, R() * 6.28); }
    let n = 0;
    while (n < 80) {
      const x = (R() * 2 - 1) * 24, z = (R() * 2 - 1) * 24;
      if (Math.abs(x) < half + 1.4 && Math.abs(z) < half + 1.4) continue;
      put(['trees_A_large', 'trees_B_large', 'trees_A_medium', 'tree_A', 'tree_B'][n % 5], x, z, 1.4 + R() * 0.9, R() * 6.28); n++;
    }
    for (let i = 0; i < 22; i++) {
      const x = (R() * 2 - 1) * 20, z = (R() * 2 - 1) * 20;
      if (Math.abs(x) < half + 0.6 && Math.abs(z) < half + 0.6) continue;
      put(['rock_A', 'rock_C', 'rock_E'][i % 3], x, z, 1 + R() * 1.4, R() * 6.28);
    }
    decoProc.visible = false;
    if (!decoModel.parent) scene.add(decoModel);
  }

  /* ---------- initialisation ---------- */
  function init(cv) {
    canvas = cv;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
    if (!renderer || !renderer.getContext()) return false;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222233);
    scene.fog = new THREE.Fog(0xe9c27e, 70, 150);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 120 });
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
    buildWorld();
    scene.add(bldGroup); scene.add(unitGroup); scene.add(fxGroup); scene.add(rangeGroup);
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
  function updateCamera() {
    const cp = Math.cos(PITCH), D = 70;
    camera.position.set(cam.tx + D * cp * Math.sin(YAW), D * Math.sin(PITCH), cam.tz + D * cp * Math.cos(YAW));
    camera.lookAt(cam.tx, 0, cam.tz);
  }
  function resetCamera(view) { cam.tx = 0; cam.tz = 0; cam.view = view || (aspect < 0.8 ? 28 : aspect > 1.6 ? 15 : 19); if (camera) frustum(); }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function setRay(cx, cy) { const [lx, ly] = mapPt(cx, cy), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; ndc.set(lx / w * 2 - 1, -(ly / h) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pickGround(cx, cy) { setRay(cx, cy); if (!ray.ray.intersectPlane(plane, hit)) return null; return [hit.x + half, hit.z + half]; }
  function pickBuilding(cx, cy) {
    setRay(cx, cy);
    const hits = ray.intersectObjects(bldGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && o.parent !== bldGroup) o = o.parent; if (o && o.userData.key != null) return o.userData.key; }
    return null;
  }

  /* ---------- bâtiments affichés ---------- */
  const B_MODEL = { mairie: 'castle', scierie: 'lumbermill', carriere: 'mine', ferme: 'windmill', entrepot: 'market', caserne: 'barracks', camp: 'tavern', tour: 'tower_A', baliste: 'tower_B', mangonneau: 'tower_catapult' };
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
    const src = LIB.b[name]; if (!src) return null;
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
  function sigOf(it) { return [it.type, it.lvl, it.gx, it.gz, it.up ? 1 : 0, it.dead ? 1 : 0, it.col, it.orc ? 1 : 0, LIB.ver].join('|'); }
  function placeGroup(g, it) { const s = BLD[it.type].size; g.position.set(it.gx + s / 2 - half, 0, it.gz + s / 2 - half); }
  function makeGlow(color, size, y) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5 }));
    s.scale.set(size, size, 1); s.position.y = y; s.renderOrder = 5;
    return s;
  }
  function build(it) {
    const s = BLD[it.type].size, g = new THREE.Group();
    let info = { top: 1.2, muzzle: 1, emit: [] };
    let glow = null;
    if (LIB.ok) {
      const team = it.orc ? 1 : (TEAM[it.col] != null ? TEAM[it.col] : 0), foot = s * 0.98;
      if (it.dead) { const m = modelInst('destroyed', 0, it.orc, foot * 0.92, MODEL_RY); if (m) g.add(m); info.top = 0.8; }
      else if (it.lvl <= 0) { const m = modelInst('scaffolding', 0, false, foot * 0.85, MODEL_RY); if (m) { g.add(m); info.top = m.userData.h + 0.2; } }
      else {
        const m = modelInst(B_MODEL[it.type], team, it.orc, foot * (1 + 0.035 * (Math.min(5, it.lvl) - 1)), MODEL_RY);
        if (m) { g.add(m); info.top = m.userData.h; info.muzzle = Math.max(0.8, info.top * 0.8); }
        if (['mairie', 'camp', 'scierie', 'caserne'].includes(it.type)) info.emit.push([0.15, info.top * 0.9, -0.15]);
        if (it.orc) { spikes(g, s + 0.25, 6 + 3 * s, 0.5); totem(g, s / 2 - 0.05, s / 2 + 0.05, 1.0); }
        if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.6)));
      }
      if (!it.dead && it.lvl > 0) { glow = makeGlow(it.orc ? 0xff6a2a : 0xffc070, s * 1.6, Math.min(1.4, info.top * 0.45)); g.add(glow); }
    } else {
      if (it.dead) g.add(makeRubble(s));
      else if (it.lvl <= 0) { g.add(P('box', 0xb39669, s - 0.2, 0.08, s - 0.2, 0, 0, 0, 0, true)); g.add(makeScaffold(s, 1.0)); info.top = 1.4; }
      else {
        const b = makeBld(it.type, it.lvl, it.col || COLORS[0], !!it.orc); g.add(b.g); info = b.info;
        if (it.up) g.add(makeScaffold(s, Math.min(2.4, info.top * 0.7)));
      }
    }
    g.userData.key = it.key;
    placeGroup(g, it);
    const rec = { g, sig: sigOf(it), item: it, info, bar: null, hp: null, glow, ph: Math.random() * 6 };
    if (it.up) { rec.bar = makeBar(1.2, 0xf0a548); rec.bar.position.set(0, info.top + 0.5, 0); g.add(rec.bar); }
    return rec;
  }
  function setBuildings(items) {
    const seen = new Set();
    for (const it of items) {
      seen.add(it.key);
      const old = blds.get(it.key), sig = sigOf(it);
      if (old && old.sig === sig) { old.item = it; continue; }
      if (old) { bldGroup.remove(old.g); pruneAnims(old.g); }
      const rec = build(it); blds.set(it.key, rec); bldGroup.add(rec.g);
    }
    for (const [k, rec] of blds) if (!seen.has(k)) { bldGroup.remove(rec.g); pruneAnims(rec.g); blds.delete(k); }
  }
  function pruneAnims(g) { anims = anims.filter(a => { let o = a.o; while (o) { if (o === g) return false; o = o.parent; } return true; }); }
  function clearBuildings() { setBuildings([]); }
  function setBldHp(key, frac) {
    const rec = blds.get(key); if (!rec) return;
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
  /* ---------- unités en modèles animés ---------- */
  const U_DEF = {
    dwarf: {
      fantassin: { m: 'barbarian', show: ['1H_Axe', 'Barbarian_Round_Shield', 'Barbarian_Hat'], atk: '1H_Melee_Attack_Chop', h: 1.0, w: 1.28 },
      archer: { m: 'barbarian', show: ['Barbarian_Hat'], xbow: true, atk: '2H_Ranged_Shoot', h: 1.0, w: 1.28 },
    },
    orc: {
      fantassin: { m: 'barbarian', tex: 'orc_barbarian', show: ['1H_Axe', '1H_Axe_Offhand'], atk: '1H_Melee_Attack_Chop', h: 1.28, w: 1.06 },
      archer: { m: 'rogue', tex: 'orc_rogue', show: ['2H_Crossbow'], atk: '2H_Ranged_Shoot', h: 1.22, w: 1.0 },
      belier: { m: 'barbarian', tex: 'troll', show: ['2H_Axe'], atk: '2H_Melee_Attack_Chop', h: 2.4, w: 1.32 },
    },
  };
  const WEAPONS = ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Hat', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'];
  const skinMats = new Map();
  function skinMat(orig, texName) {
    const key = orig.uuid + '|' + texName;
    if (!skinMats.has(key)) { const m = orig.clone(); m.map = LIB.tex[texName]; m.needsUpdate = true; skinMats.set(key, m); }
    return skinMats.get(key);
  }
  function makeUnitModel(type, col, orc) {
    const def = (orc ? U_DEF.orc : U_DEF.dwarf)[type];
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
    const ring = new THREE.Mesh(geo('plane'), basic(orc ? 0xb8402e : col, { transparent: true, opacity: 0.55, depthWrite: false }));
    const rs = type === 'belier' ? 1.1 : 0.6; ring.scale.set(rs, 1, rs); ring.position.y = 0.02; ring.renderOrder = 2; g.add(ring);
    const mixer = new THREE.AnimationMixer(obj);
    const act = n => src.clips[n] ? mixer.clipAction(src.clips[n]) : null;
    const A = { idle: act('Idle'), walk: act('Walking_A'), atk: act(def.atk), death: act('Death_A'), cheer: act('Cheer') };
    if (A.death) { A.death.setLoop(THREE.LoopOnce); A.death.clampWhenFinished = true; }
    const bar = makeBar(0.5, 0x5fd17a); bar.position.y = def.h + 0.3; bar.visible = false; g.add(bar);
    g.userData = { body, bar, mixer, A, cur: null };
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
        if (u.mv) play(rec.g, 'walk', T.speed / 1.4);
        else if (u.atkAge != null && u.atkAge < T.hit * 1.6) { const a = rec.g.userData.A.atk; play(rec.g, 'atk', a ? a.getClip().duration / T.hit : 1); }
        else play(rec.g, 'idle', 1);
      } else {
        const bob = u.mv ? Math.abs(Math.sin(tNow * 12 + u.id)) * 0.06 : 0;
        const lunge = !u.mv && u.atkAge != null && u.atkAge < 0.25 ? Math.sin(u.atkAge / 0.25 * Math.PI) * 0.12 : 0;
        rec.g.position.set(x - half, bob, z - half);
        rec.g.userData.body.position.z = lunge;
      }
      const f = u.hp / u.max;
      rec.g.userData.bar.visible = f < 0.999;
      if (f < 0.999) setBar(rec.g.userData.bar, f);
    }
    for (const [id, rec] of units) if (!seen.has(id)) {
      units.delete(id);
      if (rec.model && rec.g.userData.A.death) { rec.g.userData.bar.visible = false; play(rec.g, 'death', 1.3); dying.push({ g: rec.g, t: 0 }); }
      else { unitGroup.remove(rec.g); burst(rec.lx, rec.lz, 0.3, 0xd8d0c0, 4); }
    }
  }
  function clearUnits() {
    for (const [, rec] of units) unitGroup.remove(rec.g); units.clear();
    for (const d of dying) unitGroup.remove(d.g); dying.length = 0;
    for (const s of shots) fxGroup.remove(s.m); shots.length = 0;
  }

  /* ---------- projectiles et effets ---------- */
  function spawnShot(kind, fx, fy, fz, target, dur) {
    let m;
    if (kind === 'stone') m = P('dode', 0x7d858b, 0.3, 0.3, 0.3, 0, 0, 0, 0, true);
    else if (kind === 'bolt') m = P('box', 0x4b3a2a, 0.07, 0.07, 0.6, 0, 0, 0, 0, true);
    else m = P('box', 0x3a2a1e, 0.035, 0.035, 0.42, 0, 0, 0, 0, true);
    fxGroup.add(m);
    shots.push({ m, kind, fx: fx - half, fy, fz: fz - half, target, age: 0, dur: Math.max(0.12, dur), lx: fx - half, ly: fy, lz: fz - half });
  }
  function burst(x, z, y, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo('sph'), basic(color, { transparent: true, opacity: 0.7, depthWrite: false }));
      const s = 0.25 + Math.random() * 0.3; m.scale.setScalar(s);
      m.position.set(x - half + (Math.random() - 0.5) * 0.6, y, z - half + (Math.random() - 0.5) * 0.6);
      fxGroup.add(m); puffs.push({ m, vy: 0.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, age: 0, life: 0.8 + Math.random() * 0.6, s });
    }
  }
  function smokeAt(wx, wy, wz, dark) {
    const m = new THREE.Mesh(geo('sph'), basic(dark ? 0x4a4440 : 0xeeeeea, { transparent: true, opacity: 0.4, depthWrite: false }));
    m.scale.setScalar(0.2); m.position.set(wx, wy, wz); fxGroup.add(m);
    puffs.push({ m, vy: 0.45, vx: 0.08, vz: 0.03, age: 0, life: 2.6, s: 0.2, grow: 0.35 });
  }

  /* ---------- ambiances : chaude au village, sombre en attaque ---------- */
  const MOODS = {
    warm: { bg: 0xf0c88a, fog: 0xe9c27e, near: 70, far: 150, sun: 0xffc27a, sunI: 1.35, sunPos: [-24, 26, 20], hemiS: 0xfff0d2, hemiG: 0x7a5e38, hemiI: 0.8, ground: 0xf3efd4, outer: 0x7f9c46, win: 0xffd28a, glow: 0.22, embers: false },
    dark: { bg: 0x1f1b2e, fog: 0x1f1b2e, near: 60, far: 120, sun: 0x9aa0e6, sunI: 1.05, sunPos: [26, 32, -8], hemiS: 0x8282b8, hemiG: 0x2e2420, hemiI: 0.78, ground: 0x8a8a96, outer: 0x3e4628, win: 0xffa040, glow: 0.55, embers: true },
  };
  let P_MOOD = MOODS.warm;
  function setMood(m) {
    if (m === mood || !MOODS[m] || !scene) return;
    mood = m; const Q = P_MOOD = MOODS[m];
    scene.background = lin(Q.bg); scene.fog.color.copy(lin(Q.fog)); scene.fog.near = Q.near; scene.fog.far = Q.far;
    sun.color.copy(lin(Q.sun)); sun.intensity = Q.sunI; sun.position.set(Q.sunPos[0], Q.sunPos[1], Q.sunPos[2]);
    hemi.color.copy(lin(Q.hemiS)); hemi.groundColor.copy(lin(Q.hemiG)); hemi.intensity = Q.hemiI;
    groundMat.color.copy(lin(Q.ground)); outerMat.color.copy(lin(Q.outer)); winMat.color.copy(lin(Q.win));
    if (!Q.embers) { for (const e of embers) fxGroup.remove(e.s); embers.length = 0; }
  }

  /* ---------- chargement des modèles ---------- */
  const MODEL_NAMES = ['castle', 'lumbermill', 'mine', 'windmill', 'market', 'barracks', 'tavern', 'tower_A', 'tower_B', 'tower_catapult', 'destroyed', 'scaffolding', 'trees_A_large', 'trees_A_medium', 'trees_B_large', 'tree_A', 'tree_B', 'mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_C', 'rock_A', 'rock_C', 'rock_E'];
  function loadModels(base, onProgress) {
    if (!ok || !THREE.GLTFLoader) return Promise.resolve(false);
    THREE.Cache.enabled = true;
    const loader = new THREE.GLTFLoader(), tl = new THREE.TextureLoader();
    const chars = ['barbarian', 'rogue'], texs = ['orc_barbarian', 'orc_rogue', 'troll'];
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
    return Promise.all([...MODEL_NAMES.map(one), ...chars.map(ch), ...texs.map(tx)]).then(() => {
      if (!LIB.b.castle || !LIB.b.tower_A) return false;
      if (LIB.ch.rogue) LIB.ch.rogue.scene.traverse(o => { if (o.name === '2H_Crossbow' && o.parent && !LIB.xbow) LIB.xbow = { parent: o.parent.name, obj: o }; });
      LIB.ok = true; LIB.ver++; protos.clear();
      buildWorldModels();
      return true;
    });
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
    updateCamera();
    camQ.copy(camera.quaternion);
    for (const [, r] of blds) {
      if (r.bar) { r.bar.quaternion.copy(camQ); const up = r.item.up; if (up) setBar(r.bar, (Date.now() - up.t0) / Math.max(1, up.t1 - up.t0)); }
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
    for (const e of embers) { e.age += dt; e.s.position.y += e.vy * dt; e.s.position.x += e.vx * dt + Math.sin(tNow * 3 + e.life) * 0.004; if (e.age > e.life) { e.done = true; fxGroup.remove(e.s); } }
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].done) embers.splice(i, 1);
    for (const s of shots) {
      s.age += dt;
      const t = Math.min(1, s.age / s.dur), tg = s.target();
      const tx = tg[0] - half, ty = tg[1], tz = tg[2] - half;
      const arc = s.kind === 'stone' ? 3.5 : s.kind === 'bolt' ? 0.3 : 0.9;
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
    renderer.render(scene, camera);
  }

  return {
    init, ok: () => ok, resize, resetCamera, setBuildings, clearBuildings, setBldHp, bldInfo, aimAt, select, ghost, showZone, showRanges,
    syncUnits, clearUnits, spawnShot, burst, pickGround, pickBuilding, focus, setPointerMap, setMood, loadModels, modelsReady: () => LIB.ok,
    onFrame: f => { frameHook = f; }, onTap: f => { tapHook = f; },
  };
})();

/* ===================== APPLICATION ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const KIDX = ['arrow', 'bolt', 'stone', 'arrowU'];
const safeColor = c => COLORS.includes(c) ? c : COLORS[0];
const cleanName = (s, max) => Array.from(String(s || '')).filter(ch => { const c = ch.codePointAt(0); return c >= 32 && c !== 127 && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2060 && c <= 0x206f); }).join('').trim().slice(0, max);
const initial = n => (Array.from(String(n || '?'))[0] || '?').toUpperCase();
const LS = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage local indisponible */ } },
};
const fmtN = n => Math.floor(n).toLocaleString('fr-FR');
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
const fmtWhen = t => { const d = new Date(t); return d.toLocaleDateString('fr-FR', { weekday: 'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };

const IC = {
  bois: '<svg viewBox="0 0 20 20"><rect x="1.5" y="10" width="14" height="5.4" rx="2.7" fill="currentColor" opacity=".6"/><circle cx="15.3" cy="12.7" r="2.7" fill="currentColor"/><rect x="3.5" y="4.4" width="12" height="5.4" rx="2.7" fill="currentColor" opacity=".8"/><circle cx="15.3" cy="7.1" r="2.7" fill="currentColor"/></svg>',
  pierre: '<svg viewBox="0 0 20 20"><path d="M2.5 15.5 5 8.3l5-3.3 5.2 2.4 2.3 7-4.2 2.6H6.2z" fill="currentColor"/><path d="m5 8.3 4.6 2.6 5.6-3.5M9.6 10.9l-.6 6.7" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/></svg>',
  vivres: '<svg viewBox="0 0 20 20"><path d="M10 18.5V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><g fill="currentColor"><ellipse cx="10" cy="3.6" rx="1.6" ry="2.5"/><ellipse cx="7.5" cy="7.3" rx="1.5" ry="2.6" transform="rotate(-32 7.5 7.3)"/><ellipse cx="12.5" cy="7.3" rx="1.5" ry="2.6" transform="rotate(32 12.5 7.3)"/><ellipse cx="7.5" cy="11.6" rx="1.5" ry="2.6" transform="rotate(-32 7.5 11.6)"/><ellipse cx="12.5" cy="11.6" rx="1.5" ry="2.6" transform="rotate(32 12.5 11.6)"/></g></svg>',
  army: '<svg viewBox="0 0 24 24"><path d="M4 14a8 8 0 0 1 16 0v3H4z" fill="currentColor"/><path d="M11 6h2v12h-2z" fill="#fff" opacity=".3"/><path d="M3 17h18v2.5H3z" fill="currentColor"/></svg>',
  medal: '<svg viewBox="0 0 24 24"><path d="M6.5 2h4l1.5 6-3.5 1zM17.5 2h-4L12 8l3.5 1z" fill="currentColor" opacity=".55"/><circle cx="12" cy="15" r="6.5" fill="currentColor"/><path d="m12 11.4 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="#fff" opacity=".85"/></svg>',
  league: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="currentColor"/><path d="m8 9 2 2 2-3 2 3 2-2-1 5H9z" fill="#fff" opacity=".75"/></svg>',
  sabre: '<svg viewBox="0 0 24 24"><path d="M5.5 19.5 16 7c1.6-1.9 3.6-3.1 5.8-3.8-.6 2.3-1.8 4.3-3.7 5.9L5.9 20.2z" fill="currentColor"/><path d="M3.5 16.5l4.5 4.5M2.5 21.5l2.2-2.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path d="M3 8l4.6 4L12 5l4.4 7L21 8l-2 11H5z" fill="currentColor"/><rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor"/></svg>',
  axe: '<svg viewBox="0 0 24 24"><path d="M13.5 2.5c4.5.2 8 3.6 8 8l-4.2-1.3-2.4 2.4-4.4-4.4 2.4-2.4z" fill="currentColor"/><path d="m10 9.3 4.7 4.7-9.4 9.4-4.7-4.7z" fill="currentColor" opacity=".8"/></svg>',
  duo: '<svg viewBox="0 0 24 24"><path d="M2.5 2.5c3.3 0 6 2.4 6.2 5.6l-2.6-.6-1.4 1.4-2.6-2.6 1.4-1.4zM21.5 2.5c-3.3 0-6 2.4-6.2 5.6l2.6-.6 1.4 1.4 2.6-2.6-1.4-1.4z" fill="currentColor"/><path d="m6.6 8.4 14 14-1.6 1.6-14-14zM17.4 8.4l-14 14L5 24 19 10z" fill="currentColor" opacity=".8"/></svg>',
  hammer: '<svg viewBox="0 0 24 24"><path d="M12.5 2.5h6.5l2.5 2.5-2.5 2.5-1-1-2 2-3.5-3.5 1.5-1.5z" fill="currentColor"/><path d="m11 8.5 3.5 3.5-8.8 8.8a2.47 2.47 0 0 1-3.5-3.5z" fill="currentColor" opacity=".85"/></svg>',
  house: '<svg viewBox="0 0 24 24"><path d="M12 2.5 2 10.5h3V21h5v-6h4v6h5V10.5h3z" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" fill="currentColor"/></svg>',
  chest: '<svg viewBox="0 0 24 24"><path d="M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v1H3z" fill="currentColor" opacity=".7"/><path d="M3 12h18v8H3z" fill="currentColor"/><rect x="10.5" y="10.5" width="3" height="4" rx="1" fill="#fff" opacity=".85"/></svg>',
  clock: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 5.6V10l3 2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7z" fill="currentColor" opacity=".35"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>',
  fantassin: '<svg viewBox="0 0 24 24"><path d="M13.5 2.5c4.5.2 8 3.6 8 8l-4.2-1.3-2.4 2.4-4.4-4.4 2.4-2.4z" fill="currentColor"/><path d="m10 9.3 4.7 4.7-9.4 9.4-4.7-4.7z" fill="currentColor" opacity=".8"/></svg>',
  archer: '<svg viewBox="0 0 24 24"><path d="M3.5 8c5-3.5 12-3.5 17 0" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 5.5v15" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M3.5 8 12 13l8.5-5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
  belier: '<svg viewBox="0 0 24 24"><path d="M2.5 10h14l2.5 2.5-2.5 2.5h-14z" fill="currentColor"/><path d="M4.5 9.5 9 5h5l3.5 4.5z" fill="currentColor" opacity=".6"/><circle cx="6" cy="18" r="2.5" fill="currentColor"/><circle cx="13" cy="18" r="2.5" fill="currentColor"/><rect x="18.5" y="10" width="3.5" height="5" rx="1" fill="currentColor"/></svg>',
};
const ico = (k, cls) => `<span class="ic ${cls == null ? 'c-' + k : cls}">${IC[k]}</span>`;
function marks(kind, n) { let h = '<span class="stars">'; for (let i = 0; i < 3; i++) h += ico(kind, i < n ? 'st-on' : 'st-off'); return h + '</span>'; }
function chipsRes(c, have, cls) { return RES.filter(k => c[k]).map(k => `<span class="chip${have && have[k] < c[k] ? ' short' : ''}${cls ? ' ' + cls : ''}">${ico(k)}${fmtN(c[k])}</span>`).join(''); }

/* ---------- état ---------- */
const els = { top: $('#hudTop'), bottom: $('#hudBottom'), sheet: $('#sheet'), sheetTitle: $('#sheetTitle'), sheetBody: $('#sheetBody'), modal: $('#modal'), mcard: $('#mcard'), toast: $('#toast'), loading: $('#loading') };
let netMode = 'loading', db = null, room = null, myRef = null, myKey = null, readOnly = false, gl = false;
let backend = 'claude', fbUser = null, importState = null, installEvt = null;
let remoteMine = null, simMine = null, me = null;
let pending = [], inflight = null, committing = false, commitTimer = null, retries = 0, cseq = 0;
const others = {};
let peers = [];
let mode = 'loading', sel = null, place = null, sheet = null, sheetArg = null, visitKey = null, scout = null, fight = null, modal = null;
let duo = { phase: 'idle' };
let modelLoad = null;
let pressing = null, presenceSig = '';
const giftDraft = { bois: 0, pierre: 0, vivres: 0 };
const claiming = new Set();
const tabId = 't' + Math.random().toString(36).slice(2, 10);
const demoVillage = (() => { const v = newVillage('demo', 'Démo', COLORS[0], now()); v.b.push({ id: 90, type: 'carriere', lvl: 2, gx: 15, gz: 6, up: null }, { id: 91, type: 'entrepot', lvl: 1, gx: 7, gz: 16, up: null }); v.b.find(b => b.type === 'mairie').lvl = 3; return v; })();

function localKey() {
  let k = LS.get('hameau2.key');
  if (typeof k !== 'string' || !/^d[a-z0-9]{6,20}$/.test(k)) { k = 'd' + Math.random().toString(36).slice(2, 12); LS.set('hameau2.key', k); }
  return k;
}
function setHTML(el, html) {
  if (el._h === html) return;
  if (pressing && el.contains(pressing)) return;
  el.innerHTML = html; el._h = html;
}
let toastTimer = null;
function toast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800); }
function buzz() { try { navigator.vibrate && navigator.vibrate(10); } catch (e) { /* pas de vibreur */ } }
const pname = v => v ? (v.pname || v.name) : 'Ton allié';
function presentKeys() {
  const s = new Set();
  for (const p of peers) if (p && p.kind === 'viewer' && !p.isMe && p.presence && typeof p.presence.key === 'string') s.add(p.presence.key);
  return s;
}
const onlineOthers = () => [...presentKeys()].filter(k => k !== myKey && others[k]);

/* ---------- monde, actions, sauvegarde ---------- */
function applyPending(v, a, t) {
  const at = a.at || t;
  if (a.type === 'found') {
    if (!v) { v = newVillage(myKey, a.vname, a.c, at); v.pname = a.pname; }
    return { v, ok: true };
  }
  if (!v) return { v, ok: false, err: 'Village introuvable.' };
  return Object.assign({ v }, applyV(v, a, at));
}
function recompute() {
  let v = simMine ? clone(simMine) : null;
  const t = now();
  for (const a of pending) v = applyPending(v, a, t).v;
  me = v;
}
function resim() { simMine = remoteMine ? simulateVillage(clone(remoteMine), now()) : null; recompute(); }
function act(a, opts) {
  if (readOnly) { toast('Tu peux regarder la vallée, mais pas y jouer.'); return null; }
  if (!me && a.type !== 'found') return null;
  const t = now(); a.at = t;
  const test = applyPending(me ? clone(me) : null, a, t);
  if (!test.ok) { if (!(opts && opts.quiet)) toast(test.err); return null; }
  if (opts && opts.after) a.after = opts.after;
  pending.push(a); recompute(); renderAll(); refreshScene();
  scheduleCommit(a.type === 'train' || a.type === 'untrain' ? 700 : 150);
  return test;
}
function scheduleCommit(ms) { clearTimeout(commitTimer); commitTimer = setTimeout(commit, ms); }
async function lock(ref) {
  if (typeof ref.acquire !== 'function') return;
  for (let i = 0; i < 10; i++) {
    try { const r = await ref.acquire({ holder: tabId, ttlMs: 3000 }); if (r && r.acquired) return; }
    catch (e) { const c = e && e.code; if (c === 'capability_removed' || c === 'capability_disabled' || c === 'transform_error') return; throw e; }
    await sleep(300 + Math.random() * 600);
  }
}
async function commit() {
  if (committing || inflight || !pending.length) return;
  if (netMode === 'local') {
    let v = simMine ? clone(simMine) : null; const t = now();
    const batch = pending.splice(0), done = [];
    for (const a of batch) { const r = applyPending(v, a, t); v = r.v; if (r.ok) done.push(a); else toast(r.err); }
    remoteMine = v; LS.set('hameau2.local', v); resim(); renderAll(); refreshScene();
    done.forEach(a => a.after && a.after());
    return;
  }
  if (readOnly || !myRef) return;
  committing = true;
  const batch = pending.slice(), cid = tabId + '-' + (++cseq), done = [];
  try {
    await lock(myRef);
    const snap = await myRef.get();
    const d = snap && snap.exists ? snap.data() : null;
    let v = d && d.v === VERSION ? clone(d) : null;
    const t = now();
    if (v) simulateVillage(v, t);
    const fails = [];
    for (const a of batch) { const r = applyPending(v, a, t); v = r.v; if (r.ok) done.push(a); else if (r.err) fails.push(r.err); }
    if (v) {
      v.cid = cid; inflight = { cid, n: batch.length };
      await myRef.set(v);
      if (inflight && inflight.cid === cid) { pending.splice(0, batch.length); inflight = null; }
      remoteMine = v;
    } else pending.splice(0, batch.length);
    if (fails.length) toast('Pas enregistré : ' + fails[fails.length - 1]);
    retries = 0;
    done.forEach(a => { try { a.after && a.after(); } catch (e) { /* suite facultative */ } });
  } catch (e) {
    inflight = null;
    const code = e && e.code;
    if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted') { readOnly = true; pending.length = 0; modal = { kind: 'readonly' }; }
    else if (code === 'quota_exceeded') { pending.length = 0; toast('L’espace de sauvegarde est plein.'); }
    else { retries++; if (retries > 3) { pending.length = 0; retries = 0; toast('Connexion perdue : les dernières actions n’ont pas été enregistrées.'); } }
  }
  committing = false;
  resim(); renderAll(); refreshScene();
  if (pending.length) scheduleCommit(retries ? 2500 : 400);
}
function onMine(data) {
  remoteMine = clone(data);
  if (inflight && data.cid === inflight.cid) { pending.splice(0, inflight.n); inflight = null; }
  resim();
}

/* ---------- scène 3D ---------- */
function homeItems(v, prefix, editable) {
  const items = v.b.map(b => {
    let gx = b.gx, gz = b.gz;
    if (editable && place && place.kind === 'move' && place.id === b.id) { gx = place.gx; gz = place.gz; }
    return { key: prefix + b.id, type: b.type, lvl: b.lvl, gx, gz, up: b.up, col: safeColor(v.c), orc: false };
  });
  if (editable && place && place.kind === 'new') items.push({ key: 'ghost', type: place.type, lvl: 1, gx: place.gx, gz: place.gz, up: null, col: safeColor(v.c), orc: false });
  return items;
}
function battleItems(F) {
  const B = F.kind === 'guest' ? F.zoneB : F.B;
  return B.blds.map(b => ({ key: 'x' + b.i, type: b.type, lvl: b.lvl, gx: b.gx, gz: b.gz, up: null, dead: b.dead, col: F.bldCol, orc: F.orcBld }));
}
const placeValid = () => place && fits(me, place.type, place.gx, place.gz, place.kind === 'move' ? place.id : undefined);
function defenseRanges(layout) {
  return layout.filter(l => BLD[l[0]].def).map(l => { const s = BLD[l[0]].size; return { x: l[2] + s / 2, z: l[3] + s / 2, r: BLD[l[0]].def.range }; });
}
function refreshScene() {
  if (!gl) return;
  V3.setMood(mode === 'scout' || mode === 'fight' ? 'dark' : 'warm');
  V3.showRanges(mode === 'scout' && scout ? defenseRanges(scout.layout) : null);
  if (mode === 'home' && me) {
    V3.setBuildings(homeItems(me, 'm', true));
    const b = sel != null && me.b.find(x => x.id === sel);
    V3.select(b && !place ? b : null);
    if (place) V3.ghost(place.type, place.gx, place.gz, placeValid()); else V3.ghost(null);
  } else if (mode === 'visit' && others[visitKey]) {
    const v = others[visitKey].sim; V3.setBuildings(homeItems(v, 'o', false));
    const b = sel != null && v.b.find(x => x.id === sel); V3.select(b || null); V3.ghost(null);
  } else if (mode === 'scout' && scout) {
    V3.setBuildings(scout.layout.map((l, i) => ({ key: 'x' + i, type: l[0], lvl: l[1], gx: l[2], gz: l[3], col: BOT_COLOR, orc: true }))); V3.select(null); V3.ghost(null);
  } else if (mode === 'fight' && fight) {
    V3.setBuildings(battleItems(fight)); V3.select(null); V3.ghost(null);
  } else {
    V3.setBuildings(homeItems(demoVillage, 'd', false)); V3.select(null); V3.ghost(null);
  }
}
function setMode(m) {
  const prev = mode;
  mode = m;
  if (m !== 'home') { place = null; }
  if (m !== 'home' && m !== 'visit') sel = null;
  if (sheet && m !== 'home' && m !== 'visit') closeSheet(true);
  if (gl && prev !== m && (m === 'fight' || m === 'scout' || prev === 'fight' || prev === 'scout' || m === 'visit' || prev === 'visit')) { V3.clearUnits(); V3.clearBuildings(); V3.showZone(null); V3.resetCamera(); }
  refreshScene(); renderAll(); updatePresence();
}

/* ---------- interactions sur la carte ---------- */
function onTap(cx, cy) {
  if (modal) return;
  if (mode === 'fight') { if (fight && fight.kind !== 'replay') deployTap(cx, cy); return; }
  if (sheet) { closeSheet(); return; }
  if (mode === 'home' && place) {
    const g = V3.pickGround(cx, cy); if (!g) return;
    const s = BLD[place.type].size;
    place.gx = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[0] - s / 2)));
    place.gz = Math.max(EDGE, Math.min(GRID - EDGE - s, Math.round(g[1] - s / 2)));
    refreshScene(); renderAll(); return;
  }
  if (mode === 'home' || mode === 'visit') {
    const k = V3.pickBuilding(cx, cy);
    sel = k && (k[0] === 'm' || k[0] === 'o') ? +k.slice(1) : null;
    refreshScene(); renderAll();
  }
}
function startPlace(type) {
  if (!me) return;
  const th = thOf(me);
  if (countOf(me, type) >= limitOf(type, th)) { toast('Maximum atteint pour cette halle du clan.'); return; }
  if (busyBuilders(me) >= buildersOf(me)) { toast('Tous les ouvriers sont occupés.'); return; }
  const m = missingTxt(me, costOf(type, 1)); if (m) { toast(m); return; }
  const spot = freeSpot(me, type); if (!spot) { toast('Plus de place libre dans le village.'); return; }
  place = { kind: 'new', type, gx: spot[0], gz: spot[1] };
  sel = null; closeSheet(true); if (gl) V3.focus(spot[0] + 1, spot[1] + 1);
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
  if (r) { place = null; if (p.kind === 'new') toast('Chantier lancé.'); refreshScene(); renderAll(); }
}

/* ---------- raids solo ---------- */
function startScout() {
  if (!me) return;
  if (armyCount(me) === 0) { toast('Entraîne des troupes avant de partir en raid.'); openSheet('army'); return; }
  newScout(); setMode('scout');
}
function newScout() { const th = thOf(me), seed = (Math.random() * 2147483647) | 0; scout = Object.assign(genBot(seed, th, false), { seed }); }
function startFight(kind, bot, extra) {
  extra = extra || {};
  const F = {
    kind, bot, B: kind === 'guest' ? null : makeBattle(bot.layout), zoneB: makeBattle(bot.layout), acc: 0,
    avail: kind === 'replay' ? {} : clone(me.army), used: {}, deployed: false, ended: false, batch: 5,
    colors: extra.colors || [safeColor(me.c), safeColor(me.c)], orcUnits: kind === 'replay', orcBld: kind !== 'replay',
    bldCol: kind === 'replay' ? safeColor(me.c) : BOT_COLOR, partnerName: extra.partnerName || '',
    inbox: [], outShots: [], hostOut: false, guestOut: false, units: [], stT: 0, lastSt: performance.now(), t: 0, stars: 0, pct: 0,
    zoneUntil: kind === 'replay' ? 0 : performance.now() + 3500, plan: extra.plan || null, pi: 0, label: extra.label || '',
  };
  F.selType = TROOP_KEYS.find(k => F.avail[k] > 0) || null;
  fight = F;
  setMode('fight');
  if (gl && F.zoneUntil) V3.showZone(F.zoneB);
}
function deployTap(cx, cy) {
  const F = fight; if (!F || F.ended || !gl) return;
  const g = V3.pickGround(cx, cy); if (!g) return;
  const type = F.selType;
  if (!type || !(F.avail[type] > 0)) { toast('Choisis une troupe en bas de l’écran.'); return; }
  const x0 = Math.round(g[0] * 10) / 10, z0 = Math.round(g[1] * 10) / 10;
  if (!canDeploy(F.zoneB, x0, z0)) { V3.showZone(F.zoneB); F.zoneUntil = performance.now() + 2500; toast('Trop près des bâtiments : déploie hors de la zone rouge.'); return; }
  const n = type === 'belier' ? 1 : Math.min(F.batch, F.avail[type]);
  const offs = [[0, 0], [0.45, 0.1], [-0.4, 0.2], [0.15, -0.45], [-0.2, -0.35]];
  for (let i = 0; i < n; i++) {
    let x = Math.round((x0 + offs[i % 5][0]) * 10) / 10, z = Math.round((z0 + offs[i % 5][1]) * 10) / 10;
    if (!canDeploy(F.zoneB, x, z)) { x = x0; z = z0; }
    F.avail[type]--; F.used[type] = (F.used[type] || 0) + 1; F.deployed = true;
    if (F.kind === 'guest') emitDuo({ k: 'dep', id: duo.id, t: TROOP_KEYS.indexOf(type), x, z });
    else deploy(F.B, type, x, z, 0);
  }
  buzz();
  if (!(F.avail[type] > 0)) F.selType = TROOP_KEYS.find(k => F.avail[k] > 0) || null;
  if (!TROOP_KEYS.some(k => F.avail[k] > 0)) {
    if (F.kind === 'solo') F.B.noMore = true;
    else if (F.kind === 'duoHost') F.hostOut = true;
    else emitDuo({ k: 'out', id: duo.id });
  }
  renderBottom();
}
function findUnit(F, uid) { return F.kind === 'guest' ? F.units.find(u => u.id === uid) : F.B.units.find(u => u.id === uid && !u.dead); }
function spawnDefShot(F, bi, kind, uid, tx, tz, dur) {
  const B = F.kind === 'guest' ? F.zoneB : F.B, b = B.blds[bi]; if (!b || !gl) return;
  const info = V3.bldInfo('x' + bi), my = info ? info.muzzle : 1;
  V3.aimAt('x' + bi, tx, tz);
  let last = [tx, 0.35, tz];
  const target = kind === 'stone' ? () => [tx, 0.1, tz] : () => { const u = findUnit(F, uid); if (u) last = [u.x, 0.4, u.z]; return last; };
  V3.spawnShot(kind, b.x, my, b.z, target, dur);
}
function consume(F) {
  const B = F.B;
  for (const s of B.shots) {
    if (s.k === 'arrowU') { if (gl) V3.spawnShot('arrow', s.fx, 0.55, s.fz, () => [s.tx, 0.9, s.tz], 0.3); }
    else spawnDefShot(F, s.b, s.k, s.uid, s.tx, s.tz, s.dur);
    if (F.kind === 'duoHost') F.outShots.push([s.b != null ? s.b : -1, s.uid | 0, KIDX.indexOf(s.k), Math.round((s.dur || 0.3) * 10), Math.round((s.tx || 0) * 10), Math.round((s.tz || 0) * 10), Math.round((s.fx || 0) * 10), Math.round((s.fz || 0) * 10)]);
  }
  B.shots.length = 0;
  let changed = false;
  for (const e of B.events) if (e.k === 'down') { changed = true; const b = B.blds[e.i]; if (gl) V3.burst(b.x, b.z, 0.4, 0x9a8f80, 10); }
  B.events.length = 0;
  if (changed) refreshScene();
}
function drawUnits(F, alpha, tNow) {
  if (!gl) return;
  const list = [];
  for (const u of F.B.units) if (!u.dead) {
    const b = u.tgt >= 0 ? F.B.blds[u.tgt] : null;
    list.push({ id: u.id, type: u.type, x: u.x, z: u.z, px: u.px, pz: u.pz, hp: u.hp, max: u.max, mv: u.mv, col: F.colors[u.owner] || F.colors[0], orc: F.orcUnits, atkAge: F.B.t - u.atk, face: b ? [b.x, b.z] : null });
  }
  V3.syncUnits(list, alpha, tNow);
}
function sendState(F) {
  const B = F.B, u = [];
  for (const x of B.units) { if (x.dead) continue; if (u.length >= 8 * 70) break; u.push(x.id, TROOP_KEYS.indexOf(x.type), x.owner, Math.round(x.x * 10), Math.round(x.z * 10), Math.round(x.hp / x.max * 100), x.mv ? 1 : 0, x.tgt); }
  emitDuo({ k: 'st', id: duo.id, t: B.t, u, b: B.blds.map(x => x.dead ? -1 : Math.round(x.hp / x.max * 100)), s: F.outShots.splice(0).slice(-12), st: B.stars, p: Math.round(B.pct * 100) });
}
function fightFrame(dt, tNow) {
  const F = fight; if (!F || mode !== 'fight') return;
  if (F.zoneUntil && performance.now() > F.zoneUntil) { F.zoneUntil = 0; if (gl) V3.showZone(null); }
  if (F.kind === 'guest') { guestFrame(tNow); return; }
  const B = F.B;
  if (!B.over && !F.ended) {
    F.acc += dt * (F.speed || 1);
    let steps = 0;
    while (F.acc >= DT && !B.over && steps < 5) {
      if (F.plan) {
        while (F.pi < F.plan.length && F.plan[F.pi].t <= B.t + 1e-9) { const p = F.plan[F.pi++]; deploy(B, p.u, p.x, p.z, 1, true); }
        if (F.pi >= F.plan.length) B.noMore = true;
      }
      if (F.kind === 'duoHost') {
        for (const d of F.inbox.splice(0)) { const ty = TROOP_KEYS[d.t | 0]; if (ty) deploy(B, ty, +d.x, +d.z, 1); }
        B.noMore = F.hostOut && F.guestOut;
      }
      stepBattle(B); F.acc -= DT; steps++;
      consume(F);
      if (F.kind === 'duoHost' && B.tk % 2 === 0) sendState(F);
    }
    if (steps >= 5) F.acc = 0;
  }
  drawUnits(F, Math.min(1, F.acc / DT), tNow);
  if (gl) for (const b of B.blds) if (!b.dead) V3.setBldHp('x' + b.i, b.hp / b.max);
  if (B.over && !F.ended) finishFight();
  if (tNow - (F.hudT || 0) > 0.25) { F.hudT = tNow; renderTop(); renderBottom(); }
}
function guestFrame(tNow) {
  const F = fight;
  const alpha = Math.min(1, (performance.now() - (F.stT || 0)) / 200);
  if (gl) V3.syncUnits(F.units.map(u => {
    const b = u.tgt >= 0 ? F.zoneB.blds[u.tgt] : null;
    return { id: u.id, type: u.type, x: u.x, z: u.z, px: u.px, pz: u.pz, hp: u.hp, max: 100, mv: u.mv, col: F.colors[u.owner] || F.colors[0], orc: false, atkAge: u.mv ? 9 : (tNow + u.id * 0.37) % 1, face: b ? [b.x, b.z] : null };
  }), alpha, tNow);
  if (!F.ended && performance.now() - F.lastSt > 9000) guestAbort('La connexion avec ' + F.partnerName + ' a été perdue. Le raid est annulé et tes troupes te sont rendues.');
  if (tNow - (F.hudT || 0) > 0.25) { F.hudT = tNow; renderTop(); renderBottom(); }
}
function finishFight() {
  const F = fight; F.ended = true;
  const B = F.B;
  if (F.kind === 'replay') { modal = { kind: 'replayEnd', pct: B.pct }; renderAll(); return; }
  if (F.kind === 'duoHost') { emitDuo({ k: 'end', id: duo.id, st: B.stars, p: Math.round(B.pct * 100) }); if (room && room.cleanup) room.cleanup(duo.id); }
  applyResult(F.kind === 'solo' ? 'solo' : 'duo', B.stars, B.pct);
}
function applyResult(kind, crowns, pct) {
  const F = fight;
  if (kind === 'solo' && !F.deployed) { leaveFight(); return; }
  const mark = kind === 'solo' ? sabresOf(pct) : crowns;
  const loot = lootFor(F.bot, pct, mark);
  const r = act({ type: 'battle', kind, mark, pct: Math.round(pct * 100), loot, used: F.used, deployed: F.deployed, name: F.bot.name });
  modal = { kind: 'result', mode: kind, mark, pct, got: r ? r.got : {}, dM: r ? r.dM : 0, name: F.bot.name };
  if (kind === 'duo') duo = { phase: 'idle' };
  renderAll();
}
function endFightEarly() {
  const F = fight; if (!F || F.ended) return;
  if (F.kind === 'replay') { leaveFight(); return; }
  if (F.kind === 'solo') { if (!F.deployed) { leaveFight(); return; } F.B.over = true; return; }
  if (F.kind === 'duoHost') { F.hostOut = true; for (const k of TROOP_KEYS) F.avail[k] = 0; F.selType = null; toast('C’est noté : tu ne déploies plus rien.'); }
  else { for (const k of TROOP_KEYS) F.avail[k] = 0; F.selType = null; emitDuo({ k: 'out', id: duo.id }); toast('C’est noté : tu ne déploies plus rien.'); }
  renderBottom();
}
function leaveFight() {
  if (fight && (fight.kind === 'duoHost' || fight.kind === 'guest') && !fight.ended) { emitDuo({ k: 'bye', id: duo.id }); if (room && room.cleanup) room.cleanup(duo.id); }
  fight = null; modal = null;
  if (duo.phase === 'battle') duo = { phase: 'idle' };
  setMode('home');
}
function startReplay(i) {
  const rep = me && me.reports[i]; if (!rep) return;
  closeSheet(true);
  startFight('replay', { name: 'Attaque d’orques', layout: rep.layout, loot: {} }, { plan: botPlan(rep.seed, rep.budget), label: fmtWhen(rep.t) });
}

/* ---------- raids à deux (synchro en direct) ---------- */
function emitDuo(d) { if (!room) return; d.from = myKey; room.emit('duo', d).catch(() => { /* message perdu : la partie continue */ }); }
function proposeDuo(k) {
  if (!room) { toast('Le raid à deux n’est pas disponible ici.'); return; }
  if (!presentKeys().has(k)) { toast(pname(others[k] && others[k].sim) + ' n’est pas connecté en ce moment.'); return; }
  if (armyCount(me) === 0) { toast('Entraîne des troupes avant le raid.'); openSheet('army'); return; }
  const p = others[k] && others[k].sim;
  const th = Math.min(5, Math.max(thOf(me), p ? thOf(p) : 1)), lg = Math.max(leagueOf(me.medals), p ? leagueOf(p.medals) : 0);
  duo = { phase: 'inviting', id: 'r' + Math.random().toString(36).slice(2, 9), partner: k, seed: (Math.random() * 2147483647) | 0, th, lg, t0: now() };
  emitDuo({ k: 'inv', id: duo.id, to: k, seed: duo.seed, th, lg });
  closeSheet(true); renderAll();
}
function acceptDuo() {
  if (duo.phase !== 'invited') return;
  if (armyCount(me) === 0) { toast('Tu n’as pas de troupes : entraîne-en d’abord.'); declineDuo(); openSheet('army'); return; }
  emitDuo({ k: 'acc', id: duo.id }); duo.phase = 'accepted'; duo.t0 = now(); renderAll();
}
function declineDuo(why) { if (duo.id) emitDuo({ k: 'dec', id: duo.id, why: why || '' }); duo = { phase: 'idle' }; renderAll(); }
function cancelInvite() { if (duo.id) emitDuo({ k: 'cancel', id: duo.id }); duo = { phase: 'idle' }; renderAll(); }
function startDuo(host) {
  duo.phase = 'battle';
  const bot = genBot(duo.seed, duo.th, true, duo.lg);
  const p = others[duo.partner] && others[duo.partner].sim, pc = p ? safeColor(p.c) : COLORS[1];
  const colors = host ? [safeColor(me.c), pc] : [pc, safeColor(me.c)];
  startFight(host ? 'duoHost' : 'guest', bot, { colors, partnerName: pname(p) });
}
function onDuo(msg) {
  const d = msg && msg.data;
  if (!d || typeof d !== 'object' || d.from === myKey || typeof d.k !== 'string') return;
  switch (d.k) {
    case 'inv':
      if (d.to !== myKey || !me) return;
      if (mode === 'fight' || duo.phase === 'battle') { emitDuo({ k: 'dec', id: d.id, why: 'busy' }); return; }
      duo = { phase: 'invited', id: String(d.id), partner: d.from, seed: d.seed | 0, th: Math.max(1, Math.min(5, d.th | 0)), lg: Math.max(0, Math.min(LEAGUES.length - 1, d.lg | 0)), t0: now() };
      if (room.watch) room.watch(duo.id);
      buzz(); renderAll(); break;
    case 'dec':
      if (duo.phase === 'inviting' && d.id === duo.id) { const n = pname(others[duo.partner] && others[duo.partner].sim); duo = { phase: 'idle' }; toast(d.why === 'busy' ? n + ' est déjà en plein combat.' : n + ' a refusé le raid.'); renderAll(); }
      break;
    case 'cancel':
      if (duo.phase === 'invited' && d.id === duo.id) { duo = { phase: 'idle' }; toast('Invitation annulée.'); renderAll(); }
      break;
    case 'acc':
      if (duo.phase === 'inviting' && d.id === duo.id) { emitDuo({ k: 'go', id: duo.id }); startDuo(true); }
      break;
    case 'go':
      if (duo.phase === 'accepted' && d.id === duo.id) startDuo(false);
      break;
    case 'st': if (fight && fight.kind === 'guest' && d.id === duo.id) guestState(d); break;
    case 'dep': if (fight && fight.kind === 'duoHost' && d.id === duo.id) fight.inbox.push(d); break;
    case 'out': if (fight && fight.kind === 'duoHost' && d.id === duo.id) fight.guestOut = true; break;
    case 'end': if (fight && fight.kind === 'guest' && d.id === duo.id && !fight.ended) { fight.ended = true; applyResult('duo', d.st | 0, Math.max(0, Math.min(1, (d.p | 0) / 100))); } break;
    case 'bye':
      if (fight && d.id === duo.id && !fight.ended) {
        if (fight.kind === 'duoHost') { fight.guestOut = true; toast(fight.partnerName + ' a quitté le raid. Tu continues seul.'); }
        else guestAbort(fight.partnerName + ' a quitté le raid. Il est annulé et tes troupes te sont rendues.');
      }
      break;
  }
}
function guestState(d) {
  const F = fight;
  const prev = new Map(F.units.map(u => [u.id, u])), arr = Array.isArray(d.u) ? d.u : [], units = [];
  for (let i = 0; i + 8 <= arr.length; i += 8) {
    const id = arr[i], x = arr[i + 3] / 10, z = arr[i + 4] / 10, p = prev.get(id);
    units.push({ id, type: TROOP_KEYS[arr[i + 1]] || 'fantassin', owner: arr[i + 2] | 0, x, z, px: p ? p.x : x, pz: p ? p.z : z, hp: arr[i + 5], mv: arr[i + 6], tgt: arr[i + 7] });
  }
  F.units = units; F.stT = F.lastSt = performance.now(); F.t = +d.t || 0; F.stars = d.st | 0; F.pct = (d.p | 0) / 100;
  let changed = false;
  (Array.isArray(d.b) ? d.b : []).forEach((hp, i) => {
    const b = F.zoneB.blds[i]; if (!b) return;
    if (hp < 0) { if (!b.dead) { b.dead = true; changed = true; if (gl) V3.burst(b.x, b.z, 0.4, 0x9a8f80, 10); } }
    else if (gl) V3.setBldHp('x' + i, hp / 100);
  });
  if (changed) refreshScene();
  for (const s of (Array.isArray(d.s) ? d.s : [])) {
    if (!Array.isArray(s)) continue;
    const [bi, uid, ki, dur, tx, tz, fx, fz] = s, k = KIDX[ki];
    if (k === 'arrowU') { if (gl) V3.spawnShot('arrow', fx / 10, 0.55, fz / 10, () => [tx / 10, 0.9, tz / 10], 0.3); }
    else if (k) spawnDefShot(F, bi, k, uid, tx / 10, tz / 10, dur / 10);
  }
}
function guestAbort(msg) { if (!fight) return; fight.ended = true; duo = { phase: 'idle' }; modal = { kind: 'info', title: 'Raid interrompu', text: msg }; renderAll(); }
function updatePresence() {
  if (!room || !me || !myKey) return;
  const busy = mode === 'fight', sig = myKey + '|' + busy;
  if (sig === presenceSig) return;
  presenceSig = sig;
  room.presence({ key: myKey, busy }).catch(() => { presenceSig = ''; });
}

/* ---------- cadeaux ---------- */
function sendGift(k) {
  const p = others[k] && others[k].sim; if (!p || !db) return;
  const r = { bois: giftDraft.bois, pierre: giftDraft.pierre, vivres: giftDraft.vivres };
  const ok = act({ type: 'giftOut', r, toName: pname(p) }, { after: () => db.collection('dons').add({ to: k, from: myKey, fromName: pname(me), r, t: now() }).catch(() => toast('Le cadeau n’a pas pu partir.')) });
  if (ok) { giftDraft.bois = giftDraft.pierre = giftDraft.vivres = 0; toast('Envoyé à ' + pname(p) + '.'); closeSheet(); }
}
function onGifts(qs) {
  for (const d of qs.docs) {
    if (claiming.has(d.id)) continue;
    const g = d.data(); if (!g || g.to !== myKey) continue;
    if (!me) continue;
    claiming.add(d.id);
    const ref = db.doc('dons/' + d.id);
    if (me.claimed.includes(d.id)) { ref.delete().catch(() => {}); continue; }
    const r = {}; for (const k of RES) r[k] = Math.max(0, (g.r && g.r[k]) | 0);
    const from = cleanName(g.fromName, 24) || 'Ton allié';
    if (act({ type: 'claim', gid: d.id, r, fromName: from }, { quiet: true, after: () => ref.delete().catch(() => {}) })) toast('Cadeau reçu de ' + from + ' : ' + fmtRes(r) + '.');
  }
}

/* ---------- rendu du HUD ---------- */
function unseenRaid() { if (!me || !me.reports.length) return false; return me.reports[me.reports.length - 1].t > (LS.get('hameau2.seen.' + myKey) || 0); }
function topIdentity(v, mine) {
  const L = leagueOf(v.medals), t = now();
  let chips = '';
  if (modelLoad && modelLoad.d < modelLoad.n) chips += `<span class="glass chipb">Modèles 3D ${Math.round(modelLoad.d / modelLoad.n * 100)} %</span>`;
  if (mine) {
    if (unseenRaid()) chips += `<button class="glass chipb alert" data-act="sheet" data-s="village">Attaqué !</button>`;
    if (installEvt) chips += `<button class="glass chipb" data-act="install">Installer l’appli</button>`;
    if (v.chest) chips += `<button class="glass chipb" data-act="sheet" data-s="duo">${ico('chest', 'c-tro')}Récompense</button>`;
    for (const k of onlineOthers()) chips += `<button class="glass chipb live" data-act="sheet" data-s="duo"><span class="dot"></span>${esc(pname(others[k].sim))}</button>`;
    if (v.shield > t) chips += `<button class="glass chipb" data-act="sheet" data-s="village">${ico('shield', 'c-tro')}${fmtDur(v.shield - t)}</button>`;
    if (v.buff > t) chips += `<span class="glass chipb">+25 % · ${fmtDur(v.buff - t)}</span>`;
  }
  return `<div class="idrow">
    <button class="glass me" data-act="${mine ? 'sheet' : 'noop'}" data-s="village"><span class="crest" style="background:${safeColor(v.c)}">${esc(initial(v.pname || v.name))}</span>
    <span class="idtxt"><b>${esc(v.name)}</b><small>Halle niv. ${thOf(v)} · ${ico('medal', 'c-tro')}${v.medals || 0} · ${LEAGUES[L].name}</small></span></button>
    <div class="chips">${chips}</div></div>`;
}
function stockRow(v) {
  const cap = capOf(v); let h = '<div class="stock">';
  for (const k of RES) { const val = v.r[k], f = Math.min(100, val / cap * 100); h += `<div class="glass pill c-${k}${val >= cap ? ' full' : ''}"><div class="v">${ico(k)}<span>${fmtN(val)}</span></div><div class="fill"><i style="width:${f.toFixed(0)}%"></i></div></div>`; }
  const hs = housingOf(v), as = armySpace(v);
  h += `<div class="glass pill c-army"><div class="v">${ico('army')}<span>${as}<small>/${hs}</small></span></div><div class="fill"><i style="width:${hs ? Math.min(100, as / hs * 100).toFixed(0) : 0}%"></i></div></div>`;
  return h + '</div>';
}
function inviteCard() {
  const p = others[duo.partner] && others[duo.partner].sim;
  return `<div class="glass invite"><b>${esc(pname(p))} te propose un raid à deux</b><p class="note">Contre ${duo.lg >= 3 ? 'une forteresse renforcée' : 'une forteresse orque'}. Vous combattez ensemble, en direct.</p>
    <div class="row"><button class="btn grow" data-act="duoDecline">Refuser</button><button class="btn primary grow" data-act="duoAccept">Accepter</button></div></div>`;
}
function waitingCard() {
  const p = others[duo.partner] && others[duo.partner].sim;
  const txt = duo.phase === 'inviting' ? 'Invitation envoyée à ' + pname(p) + '…' : 'Le raid se prépare…';
  return `<div class="glass invite"><b>${esc(txt)}</b><div class="row end"><button class="btn small" data-act="duoCancel">Annuler</button></div></div>`;
}
function fightTop() {
  const F = fight, B = F.kind === 'guest' ? null : F.B;
  const t = F.kind === 'guest' ? F.t : B.t, pct = F.kind === 'guest' ? F.pct : B.pct, stars = F.kind === 'guest' ? F.stars : B.stars;
  const left = Math.max(0, 180 - t), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  let markHtml, sub;
  if (F.kind === 'replay') { markHtml = ''; sub = 'Rediffusion · ' + esc(F.label); }
  else if (F.kind === 'solo') { markHtml = marks('sabre', sabresOf(pct)); sub = 'Raid solo · butin jusqu’à ' + fmtN(RES.reduce((a, k) => a + F.bot.loot[k], 0) * 1.5); }
  else { markHtml = marks('crown', stars); sub = 'Raid à deux avec ' + esc(F.partnerName); }
  return `<div class="glass bt-top"><div class="nm"><b>${esc(F.bot.name)}</b><small>${sub}</small></div>
    <div class="score">${markHtml}<span class="pct">${Math.floor(pct * 100)} %</span><span class="time">${mm}:${String(ss).padStart(2, '0')}</span></div></div>`;
}
function renderTop() {
  let h = '';
  if (mode === 'home' && me) h = topIdentity(me, true) + stockRow(me);
  else if (mode === 'visit' && others[visitKey]) h = topIdentity(others[visitKey].sim, false);
  else if (mode === 'scout' && scout) {
    const FOE_DEF = { tour: ['tour d’archers', 'tours d’archers'], baliste: ['tour de garde', 'tours de garde'], mangonneau: ['catapulte', 'catapultes'] };
    const cnt = {}; scout.layout.forEach(l => { if (BLD[l[0]].def) cnt[l[0]] = (cnt[l[0]] || 0) + 1; });
    const defTxt = Object.keys(cnt).map(k => cnt[k] + ' ' + FOE_DEF[k][cnt[k] > 1 ? 1 : 0]).join(', ');
    h = `<div class="glass bt-top"><div class="nm"><b>${esc(scout.name)}</b><small>Camp orque · chef niv. ${scout.th} · ${esc(defTxt)}</small></div></div>
      <div class="glass card"><div class="row split"><b>Butin à 100 %</b><span class="chips2">${chipsRes(lootFor(scout, 1, 0))}</span></div>
      <p class="note">Les cercles rouges montrent la portée des défenses. ${ico('sabre', 'c-tro')} 1 sabre à 50 %, 2 à 75 %, 3 à 100 % : chaque sabre ajoute un bonus au butin.</p></div>`;
  } else if (mode === 'fight' && fight) h = fightTop();
  if (me && mode !== 'fight') {
    if (duo.phase === 'invited') h += inviteCard();
    else if (duo.phase === 'inviting' || duo.phase === 'accepted') h += waitingCard();
  }
  setHTML(els.top, h);
}
function bldStats(type, lvl) {
  const d = BLD[type];
  if (d.prod) return '+' + fmtN(prodRate(type, lvl)) + ' ' + RES_LABEL[d.prod].toLowerCase() + ' par heure';
  if (type === 'entrepot') return '+' + fmtN(lvl * 1000) + ' de stockage par ressource';
  if (type === 'camp') return campCap(lvl) + ' places pour l’armée';
  if (type === 'caserne') return 'Débloque : ' + TROOP_KEYS.filter(k => TROOPS[k].cas <= lvl).map(k => TROOPS[k].plural.toLowerCase()).join(', ');
  if (type === 'mairie') return buildersOf({ b: [{ type: 'mairie', lvl }] }) + ' ouvrier' + (lvl >= 2 ? 's' : '') + ' · bâtiments jusqu’au niveau ' + Math.min(5, lvl + 1);
  const D = defOf(type, lvl);
  if (D) return 'Portée ' + String(D.range).replace('.', ',') + ' · ' + Math.round(D.dmg / D.rate) + ' dégâts/s' + (D.splash ? ' sur une zone' : '') + ' · ' + fmtN(hpOf(type, lvl)) + ' PV';
  return '';
}
function bldPanel() {
  const v = mode === 'visit' ? others[visitKey] && others[visitKey].sim : me;
  const b = v && v.b.find(x => x.id === sel); if (!b) return '';
  const d = BLD[b.type], th = thOf(v), mine = mode === 'home';
  let h = `<div class="glass card"><h3><span>${esc(d.name)}</span><span class="row"><small>${b.lvl > 0 ? 'niveau ' + b.lvl : 'en construction'}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>`;
  h += `<p class="note">${esc(b.lvl > 0 ? bldStats(b.type, b.lvl) : d.desc)}</p>`;
  if (b.up) h += `<div class="bar"><i data-p0="${b.up.t0}" data-p1="${b.up.t1}"></i></div><div class="row split note"><span>${b.lvl > 0 ? 'Amélioration vers le niveau ' + (b.lvl + 1) : 'Construction'}</span><b data-until="${b.up.t1}"></b></div>`;
  if (mine) {
    let up = '';
    if (!b.up) {
      const to = b.lvl + 1;
      if (to > BLD[b.type].max || (b.type === 'mairie' && to > 5)) up = '<p class="note">Niveau maximum atteint.</p>';
      else if (to > maxLvlOf(b.type, th)) up = '<p class="note">Améliorez d’abord la halle du clan pour aller plus loin.</p>';
      else {
        const c = costOf(b.type, to), miss = missingTxt(v, c), busy = busyBuilders(v) >= buildersOf(v);
        up = `<div class="row split"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('clock', '')}${fmtDur(timeOf(b.type, to))}</span></span>
          <button class="btn${miss || busy ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">Niveau ${to}</button></div>${busy ? '<p class="why">Tous les ouvriers sont occupés.</p>' : ''}`;
      }
    }
    h += up + `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button></div>`;
  }
  return h + '</div>';
}
function navBar() {
  const v = me, t = now();
  const canBuild = busyBuilders(v) < buildersOf(v) && SHOP.some(k => countOf(v, k) < limitOf(k, thOf(v)) && !missingTxt(v, costOf(k, 1)));
  const duoDot = !!v.chest || onlineOthers().length > 0;
  return `<nav class="glass nav" aria-label="Actions">
    <button class="hot" data-act="attack">${ico('axe', '')}Raid solo</button>
    <button data-act="sheet" data-s="duo">${ico('duo', '')}À deux${duoDot ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="build">${ico('hammer', '')}Construire${canBuild ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="army">${ico('army', '')}Armée${v.train.length ? '<span class="dot"></span>' : ''}</button>
    <button data-act="sheet" data-s="village">${ico('house', '')}Village${unseenRaid() ? '<span class="dot"></span>' : ''}</button></nav>`;
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
    } else { if (sel != null) h += bldPanel(); h += navBar(); }
  } else if (mode === 'visit') {
    const v = others[visitKey] && others[visitKey].sim, online = presentKeys().has(visitKey);
    if (sel != null) h += bldPanel();
    h += `<div class="glass card"><div class="row"><button class="btn grow" data-act="visitBack">Retour</button><button class="btn grow" data-act="gift" data-k="${esc(visitKey)}">${ico('chest', '')}Envoyer</button>
      ${online ? `<button class="btn primary grow" data-act="duoInvite" data-k="${esc(visitKey)}">Raid à deux</button>` : ''}</div>
      ${v ? `<p class="note">Village de ${esc(pname(v))}. Touchez un bâtiment pour le voir de plus près.</p>` : ''}</div>`;
  } else if (mode === 'scout' && scout) {
    const cost = 10 * scout.th;
    h = `<div class="glass card"><div class="row"><button class="btn" data-act="scoutBack">Retour</button><button class="btn grow" data-act="scoutNext">Autre camp <span class="sub">${ico('vivres')}${cost}</span></button>
      <button class="btn primary grow" data-act="scoutGo">${ico('axe', '')}Attaquer</button></div></div>`;
  } else if (mode === 'fight' && fight) {
    const F = fight;
    if (F.kind === 'replay') h = `<div class="glass card"><div class="row split"><span class="note">Les orques attaquent ton village. Regarde ce qui a tenu, et ce qui a cédé.</span><button class="btn" data-act="endFight">Quitter</button></div></div>`;
    else {
      let tb = '';
      for (const k of TROOP_KEYS) { const n = F.avail[k] || 0; if (!n && !(F.used[k] > 0)) continue; tb += `<button class="tbtn${F.selType === k ? ' on' : ''}${n ? '' : ' empty'}" data-act="troop" data-u="${k}">${ico(k, '')}<span class="n">${n}</span><span>${TROOPS[k].plural}</span></button>`; }
      const left = TROOP_KEYS.some(k => F.avail[k] > 0);
      h = `<div class="glass fightbar">${left ? `<p class="tip">Touchez le terrain, hors de la zone rouge, pour déployer${F.selType && F.selType !== 'belier' ? ' (par ' + F.batch + ')' : ''}.</p>` : '<p class="tip">Toutes tes troupes sont sur le terrain.</p>'}
        <div class="troopbar">${tb || '<span class="tip">Aucune troupe.</span>'}${left ? `<button class="tbtn" data-act="batch"><span class="n">×${F.batch}</span><span>Groupe</span></button>` : ''}</div>
        <div class="row" style="padding:0 6px 6px"><button class="btn grow" data-act="endFight">${F.kind === 'solo' ? (F.deployed ? 'Terminer le raid' : 'Renoncer') : (left ? 'J’ai fini de déployer' : 'En attente de la fin')}</button></div></div>`;
    }
  }
  setHTML(els.bottom, h);
}

/* ---------- feuilles ---------- */
function openSheet(s, arg) {
  if (!me) return;
  sheet = s; sheetArg = arg || null; place = null;
  if (s === 'village' && me.reports.length) LS.set('hameau2.seen.' + myKey, me.reports[me.reports.length - 1].t);
  renderAll(); els.sheetBody.scrollTop = 0;
}
function closeSheet(silent) { sheet = null; sheetArg = null; if (!silent) renderAll(); }
function sheetBuild() {
  const v = me, th = thOf(v), free = buildersOf(v) - busyBuilders(v), m = v.b.find(b => b.type === 'mairie');
  let h = `<p class="note">Ouvriers libres : <b>${free} sur ${buildersOf(v)}</b>. Touchez un bâtiment du village pour l’améliorer ou le déplacer.</p>`;
  if (m) {
    let foot;
    if (m.up) foot = `<div class="bar"><i data-p0="${m.up.t0}" data-p1="${m.up.t1}"></i></div><div class="row split note"><span>Agrandissement en cours</span><b data-until="${m.up.t1}"></b></div>`;
    else if (m.lvl >= 5) foot = '<p class="note">Niveau maximum atteint.</p>';
    else {
      const to = m.lvl + 1, c = costOf('mairie', to), miss = missingTxt(v, c);
      const gains = SHOP.filter(k => limitOf(k, to) > limitOf(k, th)).map(k => '+' + (limitOf(k, to) - limitOf(k, th)) + ' ' + BLD[k].name.toLowerCase());
      if (buildersOf({ b: [{ type: 'mairie', lvl: to }] }) > buildersOf(v)) gains.push('1 ouvrier de plus');
      gains.push('bâtiments jusqu’au niveau ' + Math.min(5, to + 1));
      foot = `<p>Niveau ${to} : ${esc(gains.join(', '))}.</p><div class="foot"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('clock', '')}${fmtDur(timeOf('mairie', to))}</span></span>
        <button class="btn${miss || !free ? ' off' : ' primary'}" data-act="upgrade" data-id="${m.id}">Agrandir</button></div>${!free ? '<p class="why">Tous les ouvriers sont occupés.</p>' : miss ? `<p class="why">${esc(miss)}</p>` : ''}`;
    }
    h += `<div class="item feature"><div class="head"><b>${BLD.mairie.name}</b><small>niveau ${m.lvl}</small></div>${foot}</div>`;
  }
  h += '<div class="sec"><h4>Nouveaux bâtiments</h4>';
  for (const k of SHOP) {
    const d = BLD[k], n = countOf(v, k), lim = limitOf(k, th), c = costOf(k, 1), miss = missingTxt(v, c);
    let why = '';
    if (lim === 0) { let need = th; while (need < 5 && limitOf(k, need) === 0) need++; why = 'Débloqué avec la halle du clan niveau ' + need + '.'; }
    else if (n >= lim) why = th < 5 ? 'Maximum atteint : agrandissez la halle pour en bâtir plus.' : 'Maximum atteint.';
    else if (!free) why = 'Aucun ouvrier libre.';
    else if (miss) why = miss;
    h += `<div class="item"><div class="head"><b>${esc(d.name)}</b><small>${n} sur ${lim}</small></div><p>${esc(d.desc)}</p>
      <div class="foot"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('clock', '')}${fmtDur(timeOf(k, 1))}</span></span>
      <button class="btn${why ? ' off' : ' primary'}" data-act="place" data-type="${k}">Placer</button></div>${why ? `<p class="why">${esc(why)}</p>` : ''}</div>`;
  }
  return h + '</div>';
}
function sheetArmy() {
  const v = me, hs = housingOf(v), as = armySpace(v), qs = queueSpace(v), cl = casLvl(v);
  let h = `<div class="item"><div class="head"><b>Armée</b><small>${as} / ${hs} places${qs ? ' · ' + qs + ' en formation' : ''}</small></div>
    <div class="bar"><i style="width:${hs ? Math.min(100, as / hs * 100) : 0}%;transition:none"></i></div>
    <div class="chips2">${TROOP_KEYS.filter(k => v.army[k]).map(k => `<span class="chip">${ico(k, '')}${v.army[k]} ${TROOPS[k].plural.toLowerCase()}</span>`).join('') || '<span class="note">Aucune troupe pour l’instant.</span>'}</div></div>`;
  if (v.train.length) {
    const first = v.train[0], T = TROOPS[first.u], nc = casernes(v);
    const left = nc ? Math.max(0, (T.time - v.trainP) / nc) * 1000 : 0;
    h += '<div class="sec"><h4>En formation</h4>';
    v.train.forEach((q, i) => {
      h += `<div class="item"><div class="row split"><span class="row">${ico(q.u, '')}<b>${q.n} ${q.n > 1 ? TROOPS[q.u].plural.toLowerCase() : TROOPS[q.u].name.toLowerCase()}</b></span>
        <button class="btn small" data-act="untrain" data-i="${i}" aria-label="Annuler une unité">−1</button></div>
        ${i === 0 ? (as + T.space > hs ? '<p class="why">Les tavernes sont pleines : la formation est en pause.</p>' : `<p class="note">Prochain${T.name.endsWith('e') ? 'e' : ''} prêt dans <b data-until="${now() + left}"></b></p>`) : ''}</div>`;
    });
    h += '</div>';
  }
  h += '<div class="sec"><h4>Entraîner</h4>';
  if (!cl) h += '<p class="note">Construisez une caserne pour entraîner des troupes.</p>';
  for (const k of TROOP_KEYS) {
    const T = TROOPS[k], locked = cl < T.cas, roomLeft = hs - as - qs;
    const btn = n => { const off = locked || roomLeft < n * T.space || v.r.vivres < n * T.cost; return `<button class="btn small${off ? ' off' : ''}" data-act="train" data-u="${k}" data-n="${n}">+${n}</button>`; };
    h += `<div class="item troop"><div class="tico">${ico(k, '')}</div><div style="display:grid;gap:6px;min-width:0">
      <div class="head"><b>${T.name}</b><small>${ico('vivres')} ${T.cost} · ${T.time} s · ${T.space} place${T.space > 1 ? 's' : ''}</small></div>
      <p>${esc(T.desc)}</p><p class="stats">${T.hp} PV · ${Math.round(T.dmg / T.hit)} dégâts/s · portée ${String(T.range).replace('.', ',')}</p>
      ${locked ? `<p class="why">Il faut une caserne de niveau ${T.cas}.</p>` : `<div class="row">${btn(1)}${btn(5)}${k !== 'belier' ? btn(10) : ''}</div>`}</div></div>`;
  }
  return h + '</div>';
}
function sheetDuo() {
  const v = me, t = now(), L = leagueOf(v.medals), next = LEAGUES[L + 1];
  const prog = next ? (v.medals - LEAGUES[L].min) / (next.min - LEAGUES[L].min) * 100 : 100;
  let h = `<div class="item feature"><div class="head"><b class="row">${ico('league', 'c-tro')}Ligue des ${LEAGUES[L].name}</b><small>${ico('medal', 'c-tro')} ${v.medals} médailles</small></div>
    <div class="bar"><i style="width:${prog.toFixed(0)}%;transition:none"></i></div>
    <p>${next ? 'Encore ' + (next.min - v.medals) + ' médailles pour la ligue des ' + next.name + '.' : 'Ligue la plus haute : tenez votre rang.'}</p>
    <div class="row split"><span class="note">Prochaine récompense ${esc(fmtWhen(nextEpochTime(t)))}</span><span class="chips2">${chipsRes(chestOf(L))}</span></div>
    ${v.played > 0 ? `<p class="note"><b>${v.played} raid${v.played > 1 ? 's' : ''} à deux</b> depuis la dernière récompense : elle est assurée.</p>` : `<p class="why">Aucun raid à deux depuis la dernière récompense. Sans raid d’ici là : pas de récompense${L > 0 ? ' et retour en ligue des ' + LEAGUES[L - 1].name : ''}.</p>`}</div>`;
  if (v.chest) h += `<div class="item"><div class="head"><b class="row">${ico('chest', 'c-tro')}Récompense de ligue</b></div><div class="chips2">${chipsRes(v.chest)}</div><button class="btn primary" data-act="chest">Récupérer</button></div>`;
  const ks = Object.keys(others);
  h += '<div class="sec"><h4>Dans la vallée</h4>';
  if (!ks.length) h += backend === 'firebase'
    ? '<p class="note">Personne d’autre n’a encore de village. Envoie le lien du jeu à ta partenaire : elle se connecte avec son compte Google et fonde son village à côté du tien.</p>'
    : '<p class="note">Personne d’autre n’a encore de village. Partage ce jeu avec ta partenaire depuis le menu de partage, avec le droit de modifier : elle fondera son village à côté du tien.</p>';
  for (const k of ks) {
    const p = others[k].sim, on = presentKeys().has(k);
    h += `<div class="item"><div class="row split"><span class="row"><span class="crest" style="background:${safeColor(p.c)};width:30px;height:30px;font-size:14px">${esc(initial(p.pname || p.name))}</span>
      <span style="display:grid"><b>${esc(pname(p))}</b><small class="note">${esc(p.name)} · halle niv. ${thOf(p)} · ligue des ${LEAGUES[leagueOf(p.medals)].name}</small></span></span>
      <span class="chip${on ? ' plus' : ''}">${on ? 'en ligne' : 'hors ligne'}</span></div>
      <div class="row"><button class="btn${on ? ' primary' : ' off'} grow" data-act="duoInvite" data-k="${esc(k)}">${ico('duo', '')}Raid à deux</button>
      <button class="btn" data-act="visit" data-k="${esc(k)}">${ico('eye', '')}Visiter</button><button class="btn" data-act="gift" data-k="${esc(k)}">${ico('chest', '')}Envoyer</button></div>
      ${on ? '' : '<p class="note">Le raid à deux se joue quand vous êtes connectés tous les deux en même temps.</p>'}</div>`;
  }
  h += '</div>';
  const rank = [{ k: myKey, v }].concat(ks.map(k => ({ k, v: others[k].sim }))).sort((a, b) => (b.v.medals || 0) - (a.v.medals || 0));
  h += `<div class="sec"><h4>Classement</h4><ol class="log">${rank.map((r, i) => `<li><time>${i + 1}<sup>${i ? 'e' : 'er'}</sup></time><span class="row split"><b>${esc(pname(r.v))}${r.k === myKey ? ' (toi)' : ''}</b><span class="chip">${ico('medal', 'c-tro')}${r.v.medals || 0} · ${LEAGUES[leagueOf(r.v.medals)].name}</span></span></li>`).join('')}</ol></div>`;
  h += `<details class="help"><summary>Les règles des raids à deux</summary><ul>
    <li>Vous attaquez ensemble une forteresse orque, en direct. Chacun déploie ses propres troupes.</li>
    <li>${ico('crown', 'st-on')} 1 couronne à 50 % de destruction, 1 de plus si le donjon tombe, 1 de plus à 100 %.</li>
    <li>Médailles : +10, +20 ou +35 selon les couronnes. Sans couronne, on en perd, et de plus en plus en montant : ${LEAGUES.filter(l => l.loss).map(l => l.name + ' −' + l.loss).join(', ')}.</li>
    <li>Le butin grimpe avec la destruction et les couronnes. À 3 couronnes : +25 % de production pendant 12 h.</li>
    <li>Tous les 2 jours à 20 h, chaque ligue donne sa récompense, à condition d’avoir fait au moins un raid à deux. Sinon, rien, et on descend d’une ligue.</li>
    <li>Plus la ligue est haute, plus les forteresses sont solides, et plus elles rapportent.</li></ul></details>
    <details class="help"><summary>Les ligues</summary><ol class="log">${LEAGUES.map((l, i) => `<li><time>${l.min}+</time><span class="row split"><b>${l.name}</b><span class="chips2">${chipsRes(chestOf(i))}</span></span></li>`).join('')}</ol></details>`;
  return h;
}
function sheetGift() {
  const k = sheetArg, p = others[k] && others[k].sim;
  if (!p) return '<p class="note">Ce village n’existe plus.</p>';
  let h = `<p class="note">Ce que tu envoies part de tes réserves et arrive chez ${esc(pname(p))} dès que son jeu s’ouvre.</p>`;
  for (const r of RES) {
    giftDraft[r] = Math.max(0, Math.min(giftDraft[r], Math.floor(me.r[r] / 50) * 50));
    h += `<div class="item"><div class="row split"><span class="row">${ico(r)}<b>${RES_LABEL[r]}</b><small class="note">(${fmtN(me.r[r])})</small></span>
      <span class="stepper"><button class="btn" data-act="giftAdj" data-r="${r}" data-d="-100" aria-label="Moins">−</button><span class="n">${giftDraft[r]}</span><button class="btn" data-act="giftAdj" data-r="${r}" data-d="100" aria-label="Plus">+</button></span></div></div>`;
  }
  const any = RES.some(r => giftDraft[r] > 0);
  return h + `<button class="btn${any ? ' primary' : ' off'}" data-act="giftSend" data-k="${esc(k)}">Envoyer à ${esc(pname(p))}</button>`;
}
function sheetVillage() {
  const v = me, t = now();
  let status;
  if (v.shield > t) status = `Bouclier actif encore <b>${fmtDur(v.shield - t)}</b> : aucune attaque possible.`;
  else if (v.nextRaid > t) status = `Les orques peuvent attaquer à partir de <b>${esc(fmtWhen(v.nextRaid))}</b>. Ils n’attaquent jamais pendant que tu joues.`;
  else status = 'Les orques rôdent. Ils n’attaquent jamais pendant que tu joues.';
  let h = `<div class="item"><div class="head"><b class="row">${ico('shield', 'c-tro')}Défense du village</b></div><p>${status}</p></div>`;
  const ob = (o, l) => `<button class="btn small${orient === o ? ' primary' : ''}" data-act="orient" data-o="${o}">${l}</button>`;
  h += `<div class="sec"><h4>Affichage</h4><div class="row">${ob('land', 'Paysage')}${ob('land2', 'Paysage inversé')}${ob('port', 'Portrait')}</div>
    <p class="note">En paysage, tiens ton téléphone à l’horizontale. Si l’image est à l’envers, choisis « Paysage inversé ».</p></div>`;
  if (backend === 'firebase') {
    h += `<div class="sec"><h4>Compte</h4><p class="note">Connecté${fbUser && fbUser.name ? ' : <b>' + esc(fbUser.name) + '</b>' : ''}. Ton village est sauvegardé en ligne.</p>
      <div class="row">${installEvt ? '<button class="btn small primary" data-act="install">Installer l’appli</button>' : ''}<button class="btn small" data-act="logout">Se déconnecter</button></div></div>`;
  }
  h += '<div class="sec"><h4>Attaques subies</h4>';
  if (!v.reports.length) h += '<p class="note">Aucune attaque pour l’instant.</p>';
  for (let i = v.reports.length - 1; i >= 0; i--) {
    const r = v.reports[i];
    h += `<div class="item"><div class="head"><b>${r.pct >= 50 ? 'Village pillé' : 'Attaque repoussée'}</b><small>${esc(fmtWhen(r.t))}</small></div>
      <div class="row split"><span class="chips2"><span class="chip">${r.pct} % détruit</span>${chipsRes(r.lost, null, 'short')}</span><button class="btn small" data-act="replay" data-i="${i}">${ico('eye', '')}Revoir</button></div></div>`;
  }
  h += '</div><div class="sec"><h4>Journal</h4><ol class="log">' + v.log.slice().reverse().map(e => `<li><time>${fmtAgo(e.t)}</time><span>${esc(e.m)}</span></li>`).join('') + '</ol></div>';
  h += `<details class="help"><summary>Comment jouer</summary><ul>
    <li>Ton village vit en continu : scieries, mines et champignonnières produisent même appli fermée.</li>
    <li>Agrandis la halle du clan pour débloquer des bâtiments, des ouvriers et des niveaux.</li>
    <li>Entraîne des troupes à la caserne, puis pars en raid solo contre les camps orques pour piller leurs ressources. Chaque raid solo est noté sur 3 sabres.</li>
    <li>Place tes défenses avec soin : les orques attaquent parfois ton village quand tu n’es pas là. Tu peux revoir chaque attaque.</li>
    <li>Les médailles et la ligue se gagnent uniquement en raid à deux.</li>
    <li>Pour déplacer la carte : fais-la glisser avec un doigt. Pour zoomer : écarte ou rapproche deux doigts.</li></ul></details>`;
  return h;
}
function renderSheet() {
  if (!sheet || !me) { els.sheet.hidden = true; return; }
  const titles = { build: 'Construire', army: 'Armée', duo: 'À deux', village: me.name, gift: 'Envoyer des ressources' };
  els.sheet.hidden = false;
  els.sheetTitle.textContent = titles[sheet] || '';
  const body = sheet === 'build' ? sheetBuild() : sheet === 'army' ? sheetArmy() : sheet === 'duo' ? sheetDuo() : sheet === 'gift' ? sheetGift() : sheetVillage();
  setHTML(els.sheetBody, body);
}

/* ---------- fenêtres ---------- */
function gateHTML() {
  const ks = Object.keys(others), used = ks.map(k => others[k].sim.c);
  const saved = LS.get('hameau2.me') || {};
  const pick = saved.c && !used.includes(saved.c) ? saved.c : (COLORS.find(c => !used.includes(c)) || COLORS[0]);
  const neigh = ks.map(k => 'le village de ' + pname(others[k].sim)).join(' et ');
  return `<form id="foundForm" novalidate style="display:grid;gap:14px">
    <p class="eyebrow">${ks.length ? 'La vallée t’attend' : 'Nouvelle partie'}</p>
    <h2>Fonde ton village nain</h2>
    ${importHTML()}
    <p>${ks.length ? 'Dans la vallée, il y a déjà ' + esc(neigh) + '. Ton village s’installera à côté.' : 'Une halle, quelques guerriers et des orques qui rôdent dans les montagnes.'} Ton village produit et se défend même quand tu n’es pas là.</p>
    <label>Nom du village<input type="text" id="fVname" maxlength="24" value="${esc(saved.vname || '')}" placeholder="Ex. Forge-Haute" autocomplete="off"></label>
    <label>Ton prénom<input type="text" id="fPname" maxlength="20" value="${esc(saved.pname || '')}" placeholder="Ton prénom" autocomplete="given-name"></label>
    <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px"><legend style="font-weight:800;font-size:13.5px;padding:0;margin-bottom:6px">Couleur du clan</legend>
    <div class="swatches">${COLORS.map((c, i) => `<label><input type="radio" name="fColor" id="fColor${i}" value="${c}"${c === pick ? ' checked' : ''} aria-label="Couleur ${i + 1}"><span style="background:${c}"></span></label>`).join('')}</div></fieldset>
    <p class="err" id="fErr" hidden></p>
    ${netMode === 'local' ? '<p class="note"><b>Mode essai :</b> sauvegardé seulement sur cet appareil, sans jeu à deux.</p>' : ''}
    <button class="btn primary" type="submit">Fonder le village</button></form>`;
}
function renderModal() {
  let h = '';
  if (mode === 'gate' && !modal) h = gateHTML();
  else if (modal && modal.kind === 'result') {
    const M = modal, solo = M.mode === 'solo', win = M.mark > 0;
    const L = me ? leagueOf(me.medals) : 0;
    h = `<p class="eyebrow">${solo ? 'Raid solo' : 'Raid à deux'} · ${esc(M.name)}</p>
      <h2>${win ? (M.mark === 3 ? 'Victoire totale !' : 'Victoire !') : 'Raid repoussé'}</h2>
      <div class="bigstars">${[0, 1, 2].map(i => ico(solo ? 'sabre' : 'crown', i < M.mark ? 'st-on' : 'st-off')).join('')}</div>
      <p class="result-pct">${Math.floor(M.pct * 100)} % du camp détruit</p>
      <div class="chips2" style="justify-content:center">${chipsRes(M.got || {}, null, 'plus') || '<span class="note">Pas de butin cette fois.</span>'}</div>
      ${solo ? '' : `<p style="text-align:center"><b class="row" style="justify-content:center">${ico('medal', 'c-tro')}${M.dM >= 0 ? '+' : '−'}${Math.abs(M.dM)} médailles</b><span class="note">Ligue des ${LEAGUES[L].name} · ${me ? me.medals : 0} médailles</span></p>`}
      <button class="btn primary" data-act="resultOk">Retour au village</button>`;
  } else if (modal && modal.kind === 'replayEnd') {
    h = `<p class="eyebrow">Rediffusion</p><h2>${modal.pct >= 0.5 ? 'Le village a été pillé' : 'Le village a tenu bon'}</h2><p class="result-pct">${Math.floor(modal.pct * 100)} % détruit</p>
      <p>Pour mieux te défendre : améliore tes tours, et place-les de façon à couvrir les bâtiments du bord.</p><button class="btn primary" data-act="resultOk">Retour au village</button>`;
  } else if (modal && modal.kind === 'info') {
    h = `<h2>${esc(modal.title)}</h2><p>${esc(modal.text)}</p><button class="btn primary" data-act="resultOk">Retour au village</button>`;
  } else if (modal && modal.kind === 'readonly' && backend === 'firebase') {
    h = `<h2>Accès refusé</h2><p>Le serveur du jeu a refusé l’accès à la vallée. Les règles de sécurité de la base de données ne sont sans doute pas encore en place.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  } else if (modal && modal.kind === 'readonly') {
    h = `<h2>Lecture seule</h2><p>Tu peux regarder la vallée, mais pas y jouer. Pour jouer, demande à la personne qui a créé le jeu de te le partager avec le droit de modifier, par ton adresse e-mail.</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  } else if (modal && modal.kind === 'login') {
    h = `<p class="eyebrow">Bienvenue dans la vallée</p><h2 class="title">Mountain Kings</h2>
      <p>Connecte-toi avec ton compte Google. Ton village est sauvegardé en ligne : tu le retrouves sur tous tes appareils, et ta partenaire peut s’installer à côté.</p>
      <button class="btn primary" data-act="login"${modal.busy ? ' disabled' : ''}>${modal.busy ? 'Connexion…' : 'Se connecter avec Google'}</button>
      ${modal.err ? `<p class="err">${esc(modal.err)}</p>` : ''}
      <p class="note" style="font-size:12.5px">La fenêtre Google ne s’ouvre pas ? Ouvre le lien du jeu directement dans Chrome ou Safari.</p>`;
  } else if (modal && modal.kind === 'dberr') {
    h = `<h2>La vallée ne répond pas</h2><p>Impossible de joindre le serveur du jeu. Vérifie ta connexion internet, puis réessaie.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  } else if (modal && modal.kind === 'nogl') {
    h = `<h2>La 3D ne s’affiche pas</h2><p>Cet appareil ou ce navigateur ne permet pas l’affichage 3D. Les menus marchent quand même, mais la carte du village reste vide.</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  }
  els.modal.hidden = !h;
  if (h) setHTML(els.mcard, h); else els.mcard._h = '';
}
function tickLive() {
  const t = now();
  document.querySelectorAll('[data-until]').forEach(el => { const left = +el.dataset.until - t; el.textContent = left > 0 ? fmtDur(left) : 'presque fini'; });
  document.querySelectorAll('[data-p0]').forEach(el => { const a = +el.dataset.p0, b = +el.dataset.p1; el.style.width = Math.max(2, Math.min(100, (t - a) / Math.max(1, b - a) * 100)) + '%'; });
}
function renderAll() {
  els.loading.hidden = mode !== 'loading' || !!(modal && (modal.kind === 'login' || modal.kind === 'dberr'));
  renderTop(); renderBottom(); renderSheet(); renderModal(); tickLive();
}

/* ---------- événements ---------- */
document.addEventListener('pointerdown', e => { pressing = e.target.closest('button'); }, true);
const release = () => { pressing = null; };
document.addEventListener('pointerup', release, true);
document.addEventListener('pointercancel', release, true);
const ACT = {
  noop() {},
  orient: b => { orient = b.dataset.o; LS.set('hameau2.orient', orient); applyOrientation(); renderAll(); },
  sheet: b => openSheet(b.dataset.s, b.dataset.k),
  closeSheet: () => closeSheet(),
  closeModal: () => { modal = null; renderAll(); },
  attack: () => startScout(),
  scoutBack: () => { scout = null; setMode('home'); },
  scoutNext: () => { if (act({ type: 'reroll', cost: 10 * scout.th })) { newScout(); refreshScene(); renderAll(); } },
  scoutGo: () => { if (armyCount(me) === 0) { toast('Plus de troupes.'); return; } startFight('solo', scout); },
  place: b => startPlace(b.dataset.type),
  placeOk: () => confirmPlace(),
  placeCancel: () => { place = null; refreshScene(); renderAll(); },
  upgrade: b => { if (act({ type: 'upgrade', id: +b.dataset.id })) toast('Travaux lancés.'); },
  move: b => startMove(+b.dataset.id),
  desel: () => { sel = null; refreshScene(); renderAll(); },
  train: b => act({ type: 'train', u: b.dataset.u, n: +b.dataset.n }),
  untrain: b => act({ type: 'untrain', i: +b.dataset.i }),
  troop: b => { if (fight) { fight.selType = b.dataset.u; renderBottom(); } },
  batch: () => { if (fight) { fight.batch = fight.batch === 5 ? 1 : 5; renderBottom(); } },
  endFight: () => endFightEarly(),
  replay: b => startReplay(+b.dataset.i),
  resultOk: () => leaveFight(),
  chest: () => { const r = act({ type: 'chest' }); if (r) toast('Récompense rangée : ' + (fmtRes(r.got) || 'rien') + (r.left ? '. Le reste attend de la place.' : '.')); },
  visit: b => { if (!others[b.dataset.k]) return; visitKey = b.dataset.k; sel = null; closeSheet(true); setMode('visit'); },
  visitBack: () => { visitKey = null; setMode('home'); },
  gift: b => { if (mode === 'visit') setMode('home'); openSheet('gift', b.dataset.k); },
  giftAdj: b => { const r = b.dataset.r; giftDraft[r] = Math.max(0, Math.min(Math.floor(me.r[r] / 50) * 50, giftDraft[r] + +b.dataset.d)); renderAll(); },
  giftSend: b => sendGift(b.dataset.k),
  duoInvite: b => { if (mode === 'visit') setMode('home'); proposeDuo(b.dataset.k); },
  duoCancel: () => cancelInvite(),
  duoAccept: () => acceptDuo(),
  duoDecline: () => declineDuo(),
  login: () => doLogin(),
  logout: () => { if (!confirm('Se déconnecter de Mountain Kings sur cet appareil ?')) return; FB.logout().finally(() => location.reload()); },
  reload: () => location.reload(),
  install: () => { const e = installEvt; if (!e) return; installEvt = null; e.prompt(); (e.userChoice || Promise.resolve()).finally(() => renderAll()); },
  importOld: () => importOld(),
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderAll(); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = ACT[b.dataset.act]; if (f) f(b);
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'foundForm') return;
  e.preventDefault();
  const vname = cleanName($('#fVname').value, 24), pn = cleanName($('#fPname').value, 20);
  const c = (document.querySelector('input[name="fColor"]:checked') || {}).value || COLORS[0];
  const err = $('#fErr');
  if (!vname || !pn) { err.textContent = !vname ? 'Donne un nom à ton village.' : 'Écris ton prénom.'; err.hidden = false; return; }
  LS.set('hameau2.me', { vname, pname: pn, c });
  if (act({ type: 'found', vname, pname: pn, c: safeColor(c) })) { LS.set('hameau2.seen.' + myKey, now()); setMode('home'); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { resim(); renderAll(); refreshScene(); } });

let lastRaids = null;
function tick() {
  const t = now();
  if (simMine) {
    simulateVillage(simMine, t);
    if (lastRaids != null && simMine.raids > lastRaids && mode !== 'loading') { toast('Des orques ont attaqué ton village ! Tout est dans le menu Village.'); buzz(); }
    lastRaids = simMine.raids;
    recompute();
  }
  for (const k in others) simulateVillage(others[k].sim, t);
  if ((duo.phase === 'inviting' && t - duo.t0 > 40000) || (duo.phase === 'accepted' && t - duo.t0 > 15000)) { if (duo.phase === 'inviting') cancelInvite(); else duo = { phase: 'idle' }; toast('Pas de réponse : invitation annulée.'); }
  if (duo.phase === 'invited' && t - duo.t0 > 45000) duo = { phase: 'idle' };
  if (duo.phase === 'idle' && room && room.unwatch) room.unwatch();
  if (mode !== 'fight') { renderAll(); refreshScene(); }
}

/* ---------- orientation : paysage par défaut ---------- */
let orient = ['land', 'land2', 'port'].includes(LS.get('hameau2.orient')) ? LS.get('hameau2.orient') : 'land';
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
  if (rot && !LS.get('hameau2.orientHint')) { LS.set('hameau2.orientHint', 1); setTimeout(() => toast('Tourne ton téléphone à l’horizontale. Image à l’envers ? Menu Village, Affichage.'), 600); }
}
window.addEventListener('resize', applyOrientation);
window.addEventListener('orientationchange', () => setTimeout(applyOrientation, 200));

/* ---------- démarrage ---------- */
async function boot() {
  const cv = $('#gl');
  gl = typeof THREE !== 'undefined' && V3.init(cv);
  if (gl) { V3.onTap(onTap); V3.onFrame(fightFrame); }
  applyOrientation();
  if (gl) {
    V3.resetCamera();
    modelLoad = { d: 0, n: 1 };
    V3.loadModels('models/', (d, n) => { modelLoad = { d, n }; if (mode !== 'fight') renderTop(); })
      .then(okM => { modelLoad = null; if (okM) refreshScene(); else toast('Les modèles 3D n’ont pas pu se charger : affichage simplifié.'); renderAll(); });
  }
  refreshScene(); renderAll();
  if (!gl) { modal = { kind: 'nogl' }; renderAll(); }
  setInterval(tick, 1000);
  const hasClaude = !!(window.claude && typeof window.claude.use === 'function');
  if (!hasClaude && typeof FB !== 'undefined' && (FB.available() || window.MK_SITE)) {
    if (FB.available()) bootFirebase(); else { backend = 'firebase'; modal = { kind: 'dberr' }; renderAll(); }
    return;
  }
  const use = n => hasClaude ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
  const [dbNs, userNs, roomNs] = await Promise.all([use('db'), use('user'), use('room')]);
  let uid = null, canWrite = null;
  if (userNs) {
    try { uid = await userNs.id(); } catch (e) { uid = null; }
    try { canWrite = await userNs.can('data.write'); } catch (e) { canWrite = null; }
  }
  myKey = uid || localKey();
  if (!dbNs) {
    netMode = 'local';
    const saved = LS.get('hameau2.local');
    remoteMine = saved && saved.v === VERSION ? saved : null;
    resim(); setMode(me ? 'home' : 'gate');
    return;
  }
  if (canWrite === false) { readOnly = true; modal = { kind: 'readonly' }; }
  startOnline(dbNs, roomNs);
}
function startOnline(dbNs, roomNs) {
  db = dbNs; netMode = 'online';
  myRef = db.doc('villages/' + myKey);
  const subVillages = () => db.collection('villages').onSnapshot(qs => {
    const seen = new Set();
    if (modal && modal.kind === 'dberr') modal = null;
    for (const d of qs.docs) {
      const data = d.data(); if (!data || data.v !== VERSION) continue;
      seen.add(d.id);
      if (d.id === myKey) onMine(data);
      else { const o = others[d.id]; if (!o || o.raw !== data) others[d.id] = { raw: data, sim: simulateVillage(clone(data), now()) }; }
    }
    for (const k of Object.keys(others)) if (!seen.has(k)) delete others[k];
    if (!seen.has(myKey) && remoteMine) { remoteMine = null; resim(); }
    if (mode === 'loading') setMode(me ? 'home' : 'gate'); else { renderAll(); refreshScene(); }
    if (me && db) { if (!subVillages.gifts) { subVillages.gifts = true; db.collection('dons').where('to', '==', myKey).onSnapshot(onGifts, () => { subVillages.gifts = false; }); } }
    updatePresence();
  }, err => { if (err && err.code === 'unavailable') setTimeout(subVillages, 3000); else if (err && (err.code === 'revoked' || err.code === 'not_granted')) { readOnly = true; modal = { kind: 'readonly' }; renderAll(); } });
  subVillages();
  if (roomNs) {
    room = roomNs;
    room.onPeers(ch => { peers = ch.peers || []; if (fight && fight.kind === 'duoHost' && (ch.left || []).some(p => p.presence && p.presence.key === duo.partner)) { fight.guestOut = true; } renderAll(); }, () => { peers = []; renderAll(); });
    room.on('duo', onDuo, () => { /* canal à deux indisponible */ });
  }
}
/* ---------- version autonome : connexion Google et serveur Firebase ---------- */
const LOGIN_ERR = {
  'auth/unauthorized-domain': 'Ce site n’est pas encore autorisé dans Firebase (Authentication, Paramètres, Domaines autorisés).',
  'auth/operation-not-allowed': 'La connexion Google n’est pas encore activée dans Firebase (Authentication, Sign-in method).',
  'auth/network-request-failed': 'Pas de connexion internet. Réessaie dans un instant.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/user-cancelled': '',
};
const loginMsg = e => { const c = e && e.code; return c in LOGIN_ERR ? LOGIN_ERR[c] : 'La connexion a échoué' + (c ? ' (' + c + ')' : '') + '. Réessaie.'; };
async function bootFirebase() {
  backend = 'firebase';
  let user = null;
  try { user = await FB.start(); } catch (e) { FB.lastError = e; }
  if (user) { startFirebase(user); return; }
  modal = { kind: 'login', err: FB.lastError ? loginMsg(FB.lastError) : '' };
  renderAll();
}
async function doLogin() {
  if (!modal || modal.kind !== 'login' || modal.busy) return;
  modal.busy = true; modal.err = ''; renderAll();
  try {
    const user = await FB.login();
    if (!user) return; /* redirection vers Google en cours */
    modal = null; startFirebase(user);
  } catch (e) { modal = { kind: 'login', err: loginMsg(e) }; renderAll(); }
}
function startFirebase(user) {
  fbUser = { name: user.displayName || '' };
  myKey = user.uid;
  const o = FB.open(user);
  setTimeout(() => { if (mode === 'loading' && !modal) { modal = { kind: 'dberr' }; renderAll(); } }, 20000);
  startOnline(o.db, o.room);
  if (IMPORT_V && IMPORT_V.key) {
    importState = 'checking';
    o.db.doc('imported/' + IMPORT_V.key).get().then(s => {
      const by = s.exists ? s.data() : null;
      importState = !by || by === myKey ? 'avail' : 'taken';
      renderAll();
    }).catch(() => { importState = null; renderAll(); });
  }
}
function importHTML() {
  if (backend !== 'firebase' || !IMPORT_V || (importState !== 'avail' && importState !== 'busy')) return '';
  return `<div class="item feature"><b>Tu jouais déjà sur la première version ?</b>
    <p class="note">Le village « ${esc(IMPORT_V.name)} » de ${esc(IMPORT_V.pname)} peut être repris ici, une seule fois, avec ses bâtiments et ses ressources. Ne le prends que si c’est le tien.</p>
    <button class="btn primary" type="button" data-act="importOld"${importState === 'busy' ? ' disabled' : ''}>${importState === 'busy' ? 'Reprise…' : 'Reprendre « ' + esc(IMPORT_V.name) + ' »'}</button></div>`;
}
async function importOld() {
  if (importState !== 'avail' || !db || !myRef || me) return;
  importState = 'busy'; renderAll();
  try {
    await db.doc('imported/' + IMPORT_V.key).set(myKey);
    const v = simulateVillage(clone(IMPORT_V), now()); v.key = myKey; v.cid = tabId + '-import';
    addLog(v, now(), 'Le village a déménagé dans la nouvelle version de Mountain Kings.');
    await myRef.set(v);
    remoteMine = v; LS.set('hameau2.seen.' + myKey, now()); importState = 'taken';
    resim(); setMode('home'); toast('Bon retour, ' + pname(v) + ' !');
  } catch (e) {
    importState = 'avail'; renderAll();
    toast(e && e.code === 'not_granted' ? 'Ce village a déjà été repris.' : 'La reprise a échoué. Réessaie.');
  }
}

boot();

})();
