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
    const h = Object.assign({ lvl: 1, xp: 0, sp: 0, spec: null, at: null, n: 0, dj: 1 }, h0, { id, own: old ? k : h0.own, sk: Object.assign({}, h0.sk) });
    H[id] = h;
    if (old && v.members[k] && !v.members[k].hero) v.members[k].hero = id;
  }
  v.heroes = H;
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
