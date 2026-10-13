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
