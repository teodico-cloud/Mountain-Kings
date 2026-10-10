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
const IMPORT_V = /*IMPORT*/null;

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
  v.heroes = v.heroes && typeof v.heroes === 'object' && !Array.isArray(v.heroes) ? v.heroes : {};
  for (const k of Object.keys(v.heroes)) v.heroes[k] = Object.assign({ lvl: 1, rest: 0, up: null }, v.heroes[k]);
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
