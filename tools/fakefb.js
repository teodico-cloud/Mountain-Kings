/* Faux Firebase pour les essais locaux : imite la base temps réel (avec un petit serveur relais)
   et la connexion Google (utilisateur choisi par ?u=nom dans l'adresse). */
(function () {
  const cid = Math.random().toString(36).slice(2, 10);
  let tree = {}, ready = false, lastSeq = 0;
  const waiters = [], listeners = [], ondisc = [], seqWait = [];
  const TIMESTAMP = { '.sv': 'timestamp' };
  const parts = p => String(p || '').split('/').filter(Boolean);
  const getAt = p => { let n = tree; for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
  function clean(v) {
    if (v === null || v === undefined) return null;
    if (typeof v !== 'object') return v;
    if (v['.sv'] === 'timestamp') return Date.now();
    const o = {}, ent = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.entries(v);
    for (const [k, x] of ent) { const c = clean(x); if (c !== null) o[k] = c; }
    return Object.keys(o).length ? o : null;
  }
  function prune(n) { if (!n || typeof n !== 'object') return n; for (const k of Object.keys(n)) { const c = prune(n[k]); if (c === null || (typeof c === 'object' && !Object.keys(c).length)) delete n[k]; } return n; }
  function rawSet(p, v) {
    const ks = parts(p);
    if (!ks.length) { tree = v || {}; return; }
    let n = tree;
    for (let i = 0; i < ks.length - 1; i++) { if (n[ks[i]] == null || typeof n[ks[i]] !== 'object') n[ks[i]] = {}; n = n[ks[i]]; }
    if (v === null) delete n[ks[ks.length - 1]]; else n[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
    prune(tree);
  }
  /* La vraie base renvoie une liste quand les clés sont 0, 1, 2… */
  function out(v) {
    if (!v || typeof v !== 'object') return v;
    const ks = Object.keys(v);
    if (ks.length && ks.every(k => /^(0|[1-9]\d*)$/.test(k))) { const max = Math.max(...ks.map(Number)); if (ks.length * 2 > max) { const a = []; for (const k of ks) a[+k] = out(v[k]); return a; } }
    const o = {}; for (const k of ks) o[k] = out(v[k]); return o;
  }
  const snap = (key, v, ref) => ({ key, ref, val: () => out(v == null ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null });
  const valueOf = L => {
    if (L.path === '.info/connected') return true;
    if (L.path === '.info/serverTimeOffset') return 0;
    let v = getAt(L.path);
    if (L.q && v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x && x[L.q.f] === L.q.v) o[k] = x; v = Object.keys(o).length ? o : null; }
    return v;
  };
  function fire(L, first) {
    const v = valueOf(L);
    if (L.type === 'value') {
      const sig = JSON.stringify(v);
      if (!first && sig === L.sig) return;
      L.sig = sig; L.cb(snap(parts(L.path).pop() || null, v, makeRef(L.path)));
    } else if (L.type === 'child_added') {
      const ks = v && typeof v === 'object' ? Object.keys(v).sort() : [];
      for (const k of ks) if (!L.known.has(k)) { L.known.add(k); L.cb(snap(k, v[k], makeRef(L.path + '/' + k))); }
      for (const k of [...L.known]) if (!ks.includes(k)) L.known.delete(k);
    }
  }
  const fireAll = () => { for (const L of listeners.slice()) if (listeners.includes(L)) fire(L); };
  function apply(p, v) { rawSet(p, v); fireAll(); }
  const whenReady = () => ready ? Promise.resolve() : new Promise(r => waiters.push(r));
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  function write(p, v) {
    const c = clean(v);
    return whenReady().then(() => { apply(p, c); return post('/fb/op?cid=' + cid, { path: p, v: c }); }).then(r => { if (!r.ok) throw new Error('write failed'); });
  }
  const waitSeq = n => lastSeq >= n ? Promise.resolve() : new Promise(r => seqWait.push({ n, r }));
  /* Transaction : relit la valeur, applique fn, et réessaie si quelqu'un a écrit entre-temps. */
  async function transaction(path, fn) {
    await whenReady();
    for (let i = 0; i < 40; i++) {
      const cur = getAt(path), base = lastSeq;
      const nv = fn(cur == null ? null : out(JSON.parse(JSON.stringify(cur))));
      if (nv === undefined) return { committed: false, snapshot: snap(parts(path).pop() || null, cur, makeRef(path)) };
      const c = clean(nv);
      const r = await post('/fb/cas?cid=' + cid, { path, v: c, base });
      const j = await r.json();
      await waitSeq(j.seq);
      if (r.ok) return { committed: true, snapshot: snap(parts(path).pop() || null, getAt(path), makeRef(path)) };
      await new Promise(res => setTimeout(res, 20 + Math.random() * 60));
    }
    throw new Error('transaction failed');
  }
  let pushN = 0;
  const pushKey = () => ('0000000000' + Date.now().toString(36)).slice(-10) + ('000' + (pushN++ % 46656).toString(36)).slice(-3) + cid.slice(0, 4);
  function addListener(path, type, cb, q) {
    const L = { path, type, cb, q, known: new Set(), sig: undefined };
    listeners.push(L);
    whenReady().then(() => { if (listeners.includes(L)) fire(L, true); });
    return L;
  }
  function removeListener(path, type, cb) { const i = listeners.findIndex(L => L.path === path && L.type === type && L.cb === cb); if (i >= 0) listeners.splice(i, 1); }
  function makeRef(path) {
    path = parts(path).join('/');
    const r = {
      key: parts(path).pop() || null,
      child: c => makeRef(path + '/' + c),
      push() { return makeRef(path + '/' + pushKey()); },
      set: v => write(path, v),
      remove: () => write(path, null),
      once: () => whenReady().then(() => snap(r.key, getAt(path), r)),
      transaction: fn => transaction(path, fn),
      on(type, cb) { addListener(path, type, cb); return cb; },
      off(type, cb) { removeListener(path, type, cb); },
      orderByChild: f => ({ equalTo: val => ({ on(type, cb) { addListener(path, type, cb, { f, v: val }); return cb; }, off(type, cb) { removeListener(path, type, cb); } }) }),
      onDisconnect: () => ({ remove() { post('/fb/ondisc?cid=' + cid, { path }); return Promise.resolve(); } }),
    };
    return r;
  }
  fetch('/fb/state').then(r => r.json()).then(st => {
    tree = st.tree || {}; lastSeq = st.seq || 0;
    const es = new EventSource('/fb/events?cid=' + cid);
    es.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.from !== cid || m.cas) apply(m.path, m.v);
      if (m.seq > lastSeq) lastSeq = m.seq;
      for (let i = seqWait.length - 1; i >= 0; i--) if (lastSeq >= seqWait[i].n) { seqWait[i].r(); seqWait.splice(i, 1); }
    };
    es.onopen = () => { if (!ready) { ready = true; waiters.splice(0).forEach(f => f()); } };
  });
  window.__fakeDb = { tree: () => tree, cid };

  /* Connexion Google simulée */
  const q = new URLSearchParams(location.search).get('u');
  const mkUser = n => ({ uid: 'uid_' + n, displayName: n.charAt(0).toUpperCase() + n.slice(1) });
  const authObj = {
    setPersistence: () => Promise.resolve(),
    getRedirectResult: () => Promise.resolve(null),
    onAuthStateChanged(cb) { const n = sessionStorage.getItem('fakefb.user'); setTimeout(() => cb(n ? mkUser(n) : null), 50); return () => {}; },
    signInWithPopup() { if (!q) return Promise.reject({ code: 'auth/popup-closed-by-user' }); sessionStorage.setItem('fakefb.user', q); return new Promise(r => setTimeout(() => r({ user: mkUser(q) }), 200)); },
    signInWithRedirect: () => Promise.resolve(),
    signOut() { sessionStorage.removeItem('fakefb.user'); return Promise.resolve(); },
  };
  window.firebase = {
    initializeApp: () => ({}),
    auth: Object.assign(() => authObj, { Auth: { Persistence: { LOCAL: 'local' } }, GoogleAuthProvider: class { setCustomParameters() {} } }),
    database: Object.assign(() => ({ ref: p => makeRef(p) }), { ServerValue: { TIMESTAMP } }),
  };
})();
