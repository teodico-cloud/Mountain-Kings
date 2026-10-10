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
IC.roi = '<svg viewBox="0 0 24 24"><path d="M3 8l4.6 4L12 5l4.4 7L21 8l-2 11H5z" fill="currentColor"/><rect x="5" y="19.5" width="14" height="2" rx="1" fill="currentColor"/></svg>';
IC.chasseresse = IC.archer; IC.berserker = IC.axe;
IC.wall = '<svg viewBox="0 0 24 24"><path d="M2 9h4V6h3v3h6V6h3v3h4v11H2z" fill="currentColor"/><path d="M2 14h20M8 9v5M16 9v5M12 14v6" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/></svg>';
IC.help = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9.3 9.2a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.2" fill="#fff"/></svg>';
IC.sound = '<svg viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
const ico = (k, cls) => `<span class="ic ${cls == null ? 'c-' + k : cls}">${IC[k] || ''}</span>`;
/* Vignette d'une troupe ou d'un héros (image rendue depuis le modèle 3D, icône en secours). */
const thumb = (k, cls) => `<span class="thumb${HEROES[k] ? ' hero' : ''}${cls ? ' ' + cls : ''}">${ico(k, '')}<img src="thumbs/${k}.png" alt="" draggable="false" onerror="this.remove()"></span>`;
const unitName = (k, plural) => HEROES[k] ? HEROES[k].name : plural ? TROOPS[k].plural : TROOPS[k].name;
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
function partnerAv(k) { for (const p of peers) if (p && !p.isMe && p.presence && p.presence.key === k) return p.presence.av | 0; return 0; }

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
  if (!test.ok) { if (!(opts && opts.quiet)) { toast(test.err); SND.sfx('error'); } return null; }
  if (opts && opts.after) a.after = opts.after;
  pending.push(a); recompute(); renderAll(); refreshScene();
  scheduleCommit(a.type === 'train' || a.type === 'untrain' ? 700 : 150);
  const fx = { build: 'place', walls: 'place', move: 'place', upgrade: 'upgrade', upwalls: 'upgrade', heroUp: 'upgrade', train: 'train', chest: 'coin', claim: 'coin', found: 'built', heroBuy: 'hero', remove: 'wallbreak' }[a.type];
  if (fx) SND.sfx(fx);
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
    if (place) V3.ghost(place.type, place.gx, place.gz, place.kind === 'wall' ? fits(me, 'rempart', place.gx, place.gz) || me.b.some(b => b.type === 'rempart' && b.gx === place.gx && b.gz === place.gz) : placeValid()); else V3.ghost(null);
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
  SND.music(m === 'fight' || m === 'scout' ? 'battle' : 'village', m === 'scout' ? 0.45 : m === 'fight' && fight && fight.kind === 'replay' ? 0.7 : 1);
  if (m === 'home' && me && !modal && LS.get('mk.news') !== NEWS_V) { LS.set('mk.news', NEWS_V); if (prev !== 'gate') modal = { kind: 'news' }; }
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
  if (mode === 'home' && place && place.kind === 'wall') { wallTap(cx, cy); return; }
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
  if (BLD[type].wall) {
    const m = missingTxt(me, costOf(type, 1)); if (m) { toast(m); return; }
    const spot = freeSpot(me, type); if (!spot) { toast('Plus de place libre dans le village.'); return; }
    place = { kind: 'wall', type, gx: spot[0], gz: spot[1], last: null };
    sel = null; closeSheet(true);
    refreshScene(); renderAll(); return;
  }
  if (busyBuilders(me) >= buildersOf(me)) { toast('Tous les ouvriers sont occupés.'); return; }
  const m = missingTxt(me, costOf(type, 1)); if (m) { toast(m); return; }
  const spot = freeSpot(me, type); if (!spot) { toast('Plus de place libre dans le village.'); return; }
  place = { kind: 'new', type, gx: spot[0], gz: spot[1] };
  sel = null; closeSheet(true); if (gl) V3.focus(spot[0] + 1, spot[1] + 1);
  refreshScene(); renderAll();
}
/* Remparts : une case par toucher, ou toute une ligne quand on touche une case alignée avec la précédente. */
function wallTap(cx, cy) {
  const g = V3.pickGround(cx, cy); if (!g) return;
  const gx = Math.floor(g[0]), gz = Math.floor(g[1]);
  if (gx < EDGE || gz < EDGE || gx >= GRID - EDGE || gz >= GRID - EDGE) { toast('Trop près du bord.'); return; }
  if (me.b.some(b => b.type === 'rempart' && b.gx === gx && b.gz === gz)) {
    place.last = [gx, gz]; place.gx = gx; place.gz = gz;
    toast('Départ de ligne choisi : touche une autre case sur la même ligne.'); refreshScene(); renderAll(); return;
  }
  let tiles = [[gx, gz]];
  const L = place.last;
  if (L && (L[0] === gx || L[1] === gz) && Math.abs(L[0] - gx) + Math.abs(L[1] - gz) > 1) {
    tiles = []; const dx = Math.sign(gx - L[0]), dz = Math.sign(gz - L[1]);
    for (let x = L[0] + dx, z = L[1] + dz; ; x += dx, z += dz) { if (!me.b.some(b => b.type === 'rempart' && b.gx === x && b.gz === z)) tiles.push([x, z]); if (x === gx && z === gz) break; }
  }
  place.gx = gx; place.gz = gz;
  const r = act({ type: 'walls', tiles });
  if (r) { place.last = [gx, gz]; if (r.why && r.n < tiles.length) toast(r.n + ' posé' + (r.n > 1 ? 's' : '') + '. ' + r.why); }
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
    heroes: kind === 'replay' ? [] : HERO_KEYS.filter(k => heroReady(me, k, now())), hero: null, powQ: false, outEvents: [], alive: 0,
  };
  F.selType = TROOP_KEYS.find(k => F.avail[k] > 0) || (F.heroes.length ? 'h:' + F.heroes[0] : null);
  fight = F;
  setMode('fight');
  if (gl && F.zoneUntil) V3.showZone(F.zoneB);
}
function deployTap(cx, cy) {
  const F = fight; if (!F || F.ended || !gl) return;
  const g = V3.pickGround(cx, cy); if (!g) return;
  const type = F.selType;
  const heroK = type && type.startsWith('h:') ? type.slice(2) : null;
  if (!type || (heroK ? (F.hero || !F.heroes.includes(heroK)) : !(F.avail[type] > 0))) { toast('Choisis une troupe en bas de l’écran.'); return; }
  const x0 = Math.round(g[0] * 10) / 10, z0 = Math.round(g[1] * 10) / 10;
  if (!canDeploy(F.zoneB, x0, z0)) { V3.showZone(F.zoneB); F.zoneUntil = performance.now() + 2500; toast(F.zoneB.inside && F.zoneB.inside[Math.floor(z0) * GRID + Math.floor(x0)] ? 'Impossible de déployer à l’intérieur des remparts.' : 'Trop près des bâtiments : déploie hors de la zone rouge.'); SND.sfx('error'); return; }
  if (heroK) {
    const lvl = (me.heroes[heroK] || {}).lvl || 1;
    if (F.kind === 'guest') emitDuo({ k: 'dep', id: duo.id, t: UNIT_KEYS.indexOf(heroK), x: x0, z: z0, l: lvl });
    else if (!deploy(F.B, heroK, x0, z0, 0, false, lvl)) return;
    F.hero = { k: heroK, lvl, uid: F.kind === 'guest' ? null : F.B.units[F.B.units.length - 1].id, pw: false };
    F.deployed = true;
    F.selType = TROOP_KEYS.find(k => F.avail[k] > 0) || null;
    SND.sfx('hero'); if (gl) { V3.wave(x0, z0, 0xffd27a, 1.6, 0.6); V3.dustRing(x0, z0, 0.5); }
    buzz(); checkOut(F); renderBottom(); return;
  }
  const n = type === 'belier' ? 1 : Math.min(F.batch, F.avail[type]);
  const offs = [[0, 0], [0.45, 0.1], [-0.4, 0.2], [0.15, -0.45], [-0.2, -0.35]];
  for (let i = 0; i < n; i++) {
    let x = Math.round((x0 + offs[i % 5][0]) * 10) / 10, z = Math.round((z0 + offs[i % 5][1]) * 10) / 10;
    if (!canDeploy(F.zoneB, x, z)) { x = x0; z = z0; }
    F.avail[type]--; F.used[type] = (F.used[type] || 0) + 1; F.deployed = true;
    if (F.kind === 'guest') emitDuo({ k: 'dep', id: duo.id, t: UNIT_KEYS.indexOf(type), x, z });
    else deploy(F.B, type, x, z, 0);
  }
  buzz(); SND.sfx('deploy', { pan: gl ? V3.panOf(x0, z0) : 0 }); if (gl) V3.dustRing(x0, z0, 0.35);
  if (!(F.avail[type] > 0)) F.selType = TROOP_KEYS.find(k => F.avail[k] > 0) || (F.heroes.length && !F.hero ? 'h:' + F.heroes[0] : null);
  checkOut(F);
  renderBottom();
}
/* Il ne reste rien à déployer (troupes, et héros s'il y en a un) : on prévient le moteur ou l'hôte. */
const leftToDeploy = F => TROOP_KEYS.some(k => F.avail[k] > 0) || (F.heroes.length > 0 && !F.hero);
function checkOut(F) {
  if (leftToDeploy(F)) return;
  if (F.kind === 'solo') F.B.noMore = true;
  else if (F.kind === 'duoHost') F.hostOut = true;
  else if (!F.outSent) { F.outSent = true; emitDuo({ k: 'out', id: duo.id }); }
}
function usePower() {
  const F = fight; if (!F || !F.hero || F.hero.pw || F.ended) return;
  if (F.kind === 'guest') { if (!heroAlive(F)) return; emitDuo({ k: 'pow', id: duo.id }); F.hero.pw = true; SND.sfx('power'); }
  else if (heroPower(F.B, 0)) F.hero.pw = true;
  renderBottom();
}
function heroAlive(F) {
  if (!F.hero) return false;
  if (F.kind === 'guest') return F.units.some(u => u.type === F.hero.k && u.owner === 1);
  const u = F.B.units.find(q => q.id === F.hero.uid); return !!u && !u.dead;
}
function shotSound(k, x, z) { SND.sfx(k === 'stone' ? 'catapult' : k === 'bolt' ? 'bolt' : 'shoot', { pan: gl && x != null ? V3.panOf(x, z) : 0 }); }
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
    if (s.k === 'arrowU') { if (gl) V3.spawnShot('arrow', s.fx, 0.55, s.fz, () => [s.tx, 0.9, s.tz], 0.3); SND.sfx('shoot', { pan: gl ? V3.panOf(s.fx, s.fz) : 0 }); }
    else { spawnDefShot(F, s.b, s.k, s.uid, s.tx, s.tz, s.dur); shotSound(s.k, s.x0, s.z0); }
    if (F.kind === 'duoHost') F.outShots.push([s.b != null ? s.b : -1, s.uid | 0, KIDX.indexOf(s.k), Math.round((s.dur || 0.3) * 10), Math.round((s.tx || 0) * 10), Math.round((s.tz || 0) * 10), Math.round((s.fx || 0) * 10), Math.round((s.fz || 0) * 10)]);
  }
  B.shots.length = 0;
  let changed = false, hits = 0;
  for (const e of B.events) {
    if (e.k === 'down' || e.k === 'wall') { changed = true; bldDownFx(F, B.blds[e.i]); }
    else if (e.k === 'hit') { if (hits++ < 3) hitFx(e.x, e.z, e.w); if (F.kind === 'duoHost' && hits <= 2) F.outEvents.push([3, Math.round(e.x * 10), Math.round(e.z * 10), e.w]); }
    else if (e.k === 'power') { powerFx(e.type, e.x, e.z, e.uid); if (F.kind === 'duoHost') F.outEvents.push([0, Math.round(e.x * 10), Math.round(e.z * 10), UNIT_KEYS.indexOf(e.type), e.uid]); }
    else if (e.k === 'volley') { volleyFx(e); if (F.kind === 'duoHost') F.outEvents.push([1, Math.round(e.x * 10), Math.round(e.z * 10), Math.round(e.fx * 10), Math.round(e.fz * 10)]); }
    else if (e.k === 'boom') SND.sfx('boom', { pan: gl ? V3.panOf(e.x, e.z) : 0 });
  }
  B.events.length = 0;
  const alive = B.units.reduce((a, u) => a + (u.dead ? 0 : 1), 0);
  if (alive < F.alive) SND.sfx('death');
  F.alive = alive;
  if (changed) refreshScene();
}
function bldDownFx(F, b) {
  if (!b) return;
  const orc = F.orcBld, pan = gl ? V3.panOf(b.x, b.z) : 0;
  if (b.wall) { SND.sfx('wallbreak', { pan }); if (gl) { V3.debris(b.x, b.z, 1, orc, 5); V3.burst(b.x, b.z, 0.3, 0x9a8f80, 4); } return; }
  SND.sfx('collapse', { pan });
  if (gl) { V3.burst(b.x, b.z, 0.4, 0x9a8f80, 10); V3.debris(b.x, b.z, b.s, orc, 6 + b.s * 4); V3.shake(b.type === 'mairie' ? 0.5 : 0.22); }
}
function hitFx(x, z, w) { SND.sfx(w ? 'wallhit' : 'chop', { pan: gl ? V3.panOf(x, z) : 0 }); if (gl && Math.random() < 0.5) V3.spark(x, 0.6, z, w ? 0xd8d0c0 : 0xffe0a0); }
function powerFx(type, x, z, uid) { SND.sfx('power', { pan: gl ? V3.panOf(x, z) : 0 }); if (gl) { V3.powerFx(type, x, z); if (uid != null) V3.unitPower(uid); } }
function volleyFx(e) { SND.sfx('shoot'); setTimeout(() => SND.sfx('chop'), 450); if (gl) V3.volley(e.fx, e.fz, e.x, e.z); }
function drawUnits(F, alpha, tNow) {
  if (!gl) return;
  const list = [];
  for (const u of F.B.units) if (!u.dead) {
    const fi = u.hit >= 0 ? u.hit : u.tgt, b = fi >= 0 ? F.B.blds[fi] : null;
    list.push({ id: u.id, type: u.type, x: u.x, z: u.z, px: u.px, pz: u.pz, hp: u.hp, max: u.max, mv: u.mv, col: F.colors[u.owner] || F.colors[0], orc: F.orcUnits, atkAge: F.B.t - u.atk, face: b ? [b.x, b.z] : null, hero: u.hero, buff: u.bT > 0 });
  }
  V3.syncUnits(list, alpha, tNow);
}
function sendState(F) {
  const B = F.B, u = [];
  for (const x of B.units) { if (x.dead) continue; if (u.length >= 8 * 70) break; u.push(x.id, UNIT_KEYS.indexOf(x.type), x.owner, Math.round(x.x * 10), Math.round(x.z * 10), Math.max(1, Math.round(x.hp / x.max * 100)), (x.mv ? 1 : 0) | (x.bT > 0 ? 2 : 0), x.hit >= 0 ? x.hit : x.tgt); }
  emitDuo({ k: 'st', id: duo.id, t: B.t, u, b: B.blds.map(x => x.dead ? -1 : Math.round(x.hp / x.max * 100)), s: F.outShots.splice(0).slice(-12), e: F.outEvents.splice(0).slice(-10), st: B.stars, p: Math.round(B.pct * 100) });
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
        for (const d of F.inbox.splice(0)) { const ty = UNIT_KEYS[d.t | 0]; if (ty) deploy(B, ty, +d.x, +d.z, 1, false, Math.max(1, Math.min(5, d.l | 0))); }
        if (F.powQ) { F.powQ = false; heroPower(B, 1); }
        B.noMore = F.hostOut && F.guestOut;
      }
      stepBattle(B); F.acc -= DT; steps++;
      consume(F);
      if (F.kind === 'duoHost' && B.tk % 2 === 0) sendState(F);
    }
    if (steps >= 5) F.acc = 0;
  }
  drawUnits(F, Math.min(1, F.acc / DT), tNow);
  if (gl) for (const b of B.blds) if (!b.dead && b.hp < b.max) V3.setBldHp('x' + b.i, b.hp / b.max);
  if (B.over && !F.ended) finishFight();
  if (tNow - (F.hudT || 0) > 0.25) { F.hudT = tNow; renderTop(); renderBottom(); }
}
function guestFrame(tNow) {
  const F = fight;
  const alpha = Math.min(1, (performance.now() - (F.stT || 0)) / 200);
  if (gl) V3.syncUnits(F.units.map(u => {
    const b = u.tgt >= 0 ? F.zoneB.blds[u.tgt] : null;
    return { id: u.id, type: u.type, x: u.x, z: u.z, px: u.px, pz: u.pz, hp: u.hp, max: 100, mv: u.mv, col: F.colors[u.owner] || F.colors[0], orc: false, atkAge: u.mv ? 9 : (tNow + u.id * 0.37) % 1, face: b ? [b.x, b.z] : null, hero: u.hero, buff: u.buff };
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
  let hero = null;
  if (F.hero) {
    if (F.kind === 'guest') { const u = F.units.find(q => q.type === F.hero.k && q.owner === 1); hero = { k: F.hero.k, frac: u ? u.hp / 100 : 0, dead: !u }; }
    else { const u = F.B.units.find(q => q.id === F.hero.uid); hero = { k: F.hero.k, frac: u && !u.dead ? u.hp / u.max : 0, dead: !u || u.dead }; }
  }
  const r = act({ type: 'battle', kind, mark, pct: Math.round(pct * 100), loot, used: F.used, deployed: F.deployed, name: F.bot.name, hero });
  modal = { kind: 'result', mode: kind, mark, pct, got: r ? r.got : {}, dM: r ? r.dM : 0, name: F.bot.name, hero };
  SND.jingle(mark > 0 ? 'victory' : 'defeat');
  for (let i = 0; i < mark; i++) setTimeout(() => SND.sfx('star', { i }), 700 + i * 380);
  if (kind === 'duo') duo = { phase: 'idle' };
  renderAll();
}
function endFightEarly() {
  const F = fight; if (!F || F.ended) return;
  if (F.kind === 'replay') { leaveFight(); return; }
  if (F.kind === 'solo') { if (!F.deployed) { leaveFight(); return; } F.B.over = true; return; }
  if (F.kind === 'duoHost') { F.hostOut = true; for (const k of TROOP_KEYS) F.avail[k] = 0; F.heroes = F.hero ? F.heroes : []; F.selType = null; toast('C’est noté : tu ne déploies plus rien.'); }
  else { for (const k of TROOP_KEYS) F.avail[k] = 0; F.heroes = F.hero ? F.heroes : []; F.selType = null; if (!F.outSent) { F.outSent = true; emitDuo({ k: 'out', id: duo.id }); } toast('C’est noté : tu ne déploies plus rien.'); }
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
  if (partnerAv(k) !== APP_PV) { toast(pname(others[k] && others[k].sim) + ' n’a pas encore la nouvelle version : il faut fermer puis rouvrir le jeu.'); return; }
  if (armyCount(me) === 0) { toast('Entraîne des troupes avant le raid.'); openSheet('army'); return; }
  const p = others[k] && others[k].sim;
  const th = Math.min(5, Math.max(thOf(me), p ? thOf(p) : 1)), lg = Math.max(leagueOf(me.medals), p ? leagueOf(p.medals) : 0);
  duo = { phase: 'inviting', id: 'r' + Math.random().toString(36).slice(2, 9), partner: k, seed: (Math.random() * 2147483647) | 0, th, lg, t0: now() };
  emitDuo({ k: 'inv', id: duo.id, to: k, seed: duo.seed, th, lg, pv: APP_PV });
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
      if ((d.pv | 0) !== APP_PV) { emitDuo({ k: 'dec', id: d.id, why: 'version' }); toast(pname(others[d.from] && others[d.from].sim) + ' t’invite, mais vos versions du jeu diffèrent : fermez puis rouvrez l’appli tous les deux.'); return; }
      duo = { phase: 'invited', id: String(d.id), partner: d.from, seed: d.seed | 0, th: Math.max(1, Math.min(5, d.th | 0)), lg: Math.max(0, Math.min(LEAGUES.length - 1, d.lg | 0)), t0: now() };
      if (room.watch) room.watch(duo.id);
      buzz(); SND.sfx('invite'); renderAll(); break;
    case 'dec':
      if (duo.phase === 'inviting' && d.id === duo.id) { const n = pname(others[duo.partner] && others[duo.partner].sim); duo = { phase: 'idle' }; toast(d.why === 'busy' ? n + ' est déjà en plein combat.' : d.why === 'version' ? 'Vos versions du jeu diffèrent : fermez puis rouvrez l’appli tous les deux.' : n + ' a refusé le raid.'); renderAll(); }
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
    case 'pow': if (fight && fight.kind === 'duoHost' && d.id === duo.id) fight.powQ = true; break;
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
    const ty = UNIT_KEYS[arr[i + 1]] || 'fantassin';
    units.push({ id, type: ty, owner: arr[i + 2] | 0, x, z, px: p ? p.x : x, pz: p ? p.z : z, hp: arr[i + 5], mv: arr[i + 6] & 1, buff: !!(arr[i + 6] & 2), hero: !!HEROES[ty], tgt: arr[i + 7] });
  }
  if (units.length < F.units.length) SND.sfx('death');
  F.units = units; F.stT = F.lastSt = performance.now(); F.t = +d.t || 0; F.stars = d.st | 0; F.pct = (d.p | 0) / 100;
  let changed = false;
  (Array.isArray(d.b) ? d.b : []).forEach((hp, i) => {
    const b = F.zoneB.blds[i]; if (!b) return;
    if (hp < 0) { if (!b.dead) { b.dead = true; changed = true; bldDownFx(F, b); } }
    else if (gl && hp < 100) V3.setBldHp('x' + i, hp / 100);
  });
  if (changed) { for (const b of F.zoneB.blds) markOcc(F.zoneB, b, b.dead ? 0 : b.i + 1); computeInside(F.zoneB); refreshScene(); }
  for (const s of (Array.isArray(d.s) ? d.s : [])) {
    if (!Array.isArray(s)) continue;
    const [bi, uid, ki, dur, tx, tz, fx, fz] = s, k = KIDX[ki];
    if (k === 'arrowU') { if (gl) V3.spawnShot('arrow', fx / 10, 0.55, fz / 10, () => [tx / 10, 0.9, tz / 10], 0.3); SND.sfx('shoot'); }
    else if (k) { spawnDefShot(F, bi, k, uid, tx / 10, tz / 10, dur / 10); const b = F.zoneB.blds[bi]; shotSound(k, b && b.x, b && b.z); }
  }
  for (const e of (Array.isArray(d.e) ? d.e : [])) {
    if (!Array.isArray(e)) continue;
    const x = e[1] / 10, z = e[2] / 10;
    if (e[0] === 0) powerFx(UNIT_KEYS[e[3]], x, z, e[4]);
    else if (e[0] === 1) volleyFx({ x, z, fx: e[3] / 10, fz: e[4] / 10 });
    else if (e[0] === 3) hitFx(x, z, e[3]);
  }
}
function guestAbort(msg) { if (!fight) return; fight.ended = true; duo = { phase: 'idle' }; modal = { kind: 'info', title: 'Raid interrompu', text: msg }; renderAll(); }
function updatePresence() {
  if (!room || !me || !myKey) return;
  const busy = mode === 'fight', sig = myKey + '|' + busy + '|' + APP_PV;
  if (sig === presenceSig) return;
  presenceSig = sig;
  room.presence({ key: myKey, busy, av: APP_PV }).catch(() => { presenceSig = ''; });
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
    chips += `<button class="glass chipb helpb" data-act="help" aria-label="Aide">${ico('help', 'c-tro')}</button>`;
    if (window.__mkUpdate) chips += `<button class="glass chipb alert" data-act="reload">Nouvelle version : toucher ici</button>`;
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
    const nW = scout.layout.filter(l => l[0] === 'rempart').length;
    const defTxt = Object.keys(cnt).map(k => cnt[k] + ' ' + FOE_DEF[k][cnt[k] > 1 ? 1 : 0]).join(', ') + (nW ? ', une palissade' : '');
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
  if (type === 'rempart') return fmtN(hpOf(type, lvl)) + ' PV · les ennemis doivent le casser ou le contourner';
  if (type === 'heros') return 'Héros jusqu’au niveau ' + lvl + ' · ' + HERO_KEYS.filter(k => HEROES[k].hall <= lvl).length + ' héros disponibles sur 3';
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
  if (mine && b.type === 'rempart') {
    const to = b.lvl + 1, same = v.b.filter(x => x.type === 'rempart' && x.lvl === b.lvl).length;
    if (to > BLD.rempart.max) h += '<p class="note">Niveau maximum atteint.</p>';
    else if (to > maxLvlOf('rempart', th)) h += '<p class="note">Agrandis la halle du clan pour renforcer les remparts.</p>';
    else {
      const c = costOf('rempart', to), miss = missingTxt(v, c);
      h += `<div class="row split"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn${miss ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">Niveau ${to}</button></div>`;
      if (same > 1) h += `<div class="row split"><span class="note">Les ${same} remparts de niveau ${b.lvl} (tant que tu peux payer)</span><button class="btn small" data-act="upwalls" data-l="${b.lvl}">Tous au niveau ${to}</button></div>`;
    }
    h += `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button><button class="btn small" data-act="removeWall" data-id="${b.id}">Retirer</button></div>`;
    return h + '</div>';
  }
  if (mine && b.type === 'heros' && b.lvl > 0) h += `<div class="row"><button class="btn small primary" data-act="sheet" data-s="army" data-k="heroes">${ico('roi', '')}Voir les héros</button></div>`;
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
  const canBuild = busyBuilders(v) < buildersOf(v) && SHOP.some(k => !BLD[k].wall && countOf(v, k) < limitOf(k, thOf(v)) && !missingTxt(v, costOf(k, 1)));
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
    if (place && place.kind === 'wall') {
      const n = countOf(me, 'rempart'), lim = limitOf('rempart', thOf(me));
      h = `<div class="glass card"><div class="row split"><b class="row">${ico('wall', 'c-pierre')}Remparts · ${n} sur ${lim}</b><span class="chips2">${chipsRes(costOf('rempart', 1), me.r)}<span class="note">chacun</span></span><button class="btn small primary" data-act="placeCancel">Terminé</button></div>
        <p class="note">Touche une case, puis une autre sur la même ligne : toute la ligne se remplit.</p></div>`;
    } else if (place) {
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
      for (const k of TROOP_KEYS) { const n = F.avail[k] || 0; if (!n && !(F.used[k] > 0)) continue; tb += `<button class="tbtn${F.selType === k ? ' on' : ''}${n ? '' : ' empty'}" data-act="troop" data-u="${k}">${thumb(k, 'sm')}<span class="n">${n}</span><span class="nm">${TROOPS[k].plural}</span></button>`; }
      if (F.hero) {
        const alive = heroAlive(F), H = HEROES[F.hero.k];
        tb += `<button class="tbtn hero${!F.hero.pw && alive ? ' power' : ' empty'}" data-act="power">${thumb(F.hero.k, 'sm')}<span class="n">${!alive ? 'K.O.' : F.hero.pw ? 'Utilisé' : 'Pouvoir'}</span><span class="nm">${esc(H.power)}</span></button>`;
      } else for (const k of F.heroes) tb += `<button class="tbtn hero${F.selType === 'h:' + k ? ' on' : ''}" data-act="troop" data-u="h:${k}">${thumb(k, 'sm')}<span class="n">Héros</span><span class="nm">${esc(HEROES[k].name)}</span></button>`;
      const left = leftToDeploy(F), heroSel = F.selType && F.selType.startsWith('h:');
      const tip = !left ? (F.hero && !F.hero.pw && heroAlive(F) ? 'Touche le héros en bas pour lancer son pouvoir.' : 'Toutes tes troupes sont sur le terrain.')
        : heroSel ? 'Touche le terrain pour faire entrer ' + esc(HEROES[F.selType.slice(2)].name) + ' (un seul héros par raid).'
        : 'Touchez le terrain, hors de la zone rouge, pour déployer' + (F.selType && F.selType !== 'belier' ? ' (par ' + F.batch + ')' : '') + '.';
      h = `<div class="glass fightbar"><p class="tip">${tip}</p>
        <div class="troopbar">${tb || '<span class="tip">Aucune troupe.</span>'}${TROOP_KEYS.some(k => F.avail[k] > 0) ? `<button class="tbtn" data-act="batch"><span class="n">×${F.batch}</span><span class="nm">Groupe</span></button>` : ''}</div>
        <div class="row" style="padding:0 6px 6px"><button class="btn grow" data-act="endFight">${F.kind === 'solo' ? (F.deployed ? 'Terminer le raid' : 'Renoncer') : (left ? 'J’ai fini de déployer' : 'En attente de la fin')}</button></div></div>`;
    }
  }
  setHTML(els.bottom, h);
}

/* ---------- feuilles ---------- */
function openSheet(s, arg) {
  if (!me) return;
  sheet = s; sheetArg = arg || null; place = null; renderSheet.scrolled = false;
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
      const gains = SHOP.filter(k => limitOf(k, to) > limitOf(k, th)).map(k => { const n = limitOf(k, to) - limitOf(k, th); return '+' + n + ' ' + (BLD[k].wall ? 'remparts' : BLD[k].name.toLowerCase()); });
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
    else if (!free && !d.wall) why = 'Aucun ouvrier libre.';
    else if (miss) why = miss;
    if (k === 'rempart') h += '</div><div class="sec"><h4>Remparts</h4>';
    h += `<div class="item${d.wall ? ' feature' : ''}"><div class="head"><b class="row">${d.wall ? ico('wall', 'c-pierre') : ''}${esc(d.name)}</b><small>${n} sur ${lim}</small></div><p>${esc(d.desc)}${d.wall ? ' Touche une case, puis une autre sur la même ligne pour remplir toute la ligne.' : ''}</p>
      <div class="foot"><span class="chips2">${chipsRes(c, v.r)}${d.wall ? '<span class="note">chacun</span>' : `<span class="dur">${ico('clock', '')}${fmtDur(timeOf(k, 1))}</span>`}</span>
      <button class="btn${why ? ' off' : ' primary'}" data-act="place" data-type="${k}">Placer</button></div>${why ? `<p class="why">${esc(why)}</p>` : ''}</div>`;
  }
  return h + '</div>';
}
function sheetArmy() {
  const v = me, hs = housingOf(v), as = armySpace(v), qs = queueSpace(v), cl = casLvl(v);
  let h = `<div class="item"><div class="head"><b>Armée</b><small>${as} / ${hs} places${qs ? ' · ' + qs + ' en formation' : ''}</small></div>
    <div class="bar"><i style="width:${hs ? Math.min(100, as / hs * 100) : 0}%;transition:none"></i></div>
    <div class="chips2">${TROOP_KEYS.filter(k => v.army[k]).map(k => `<span class="chip">${ico(k, '')}${v.army[k]} ${TROOPS[k].plural.toLowerCase()}</span>`).join('') || '<span class="note">Aucune troupe pour l’instant.</span>'}</div>
    ${HERO_KEYS.some(k => (v.heroes || {})[k]) ? `<div class="chips2">${HERO_KEYS.filter(k => (v.heroes || {})[k]).map(k => `<span class="chip${heroReady(v, k, now()) ? ' plus' : ''}">${ico('roi', '')}${esc(HEROES[k].name)} niv. ${v.heroes[k].lvl}</span>`).join('')}</div>` : ''}</div>`;
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
    h += `<div class="item troop">${thumb(k)}<div style="display:grid;gap:6px;min-width:0">
      <div class="head"><b>${T.name}</b><small>${ico('vivres')} ${T.cost} · ${T.time} s · ${T.space} place${T.space > 1 ? 's' : ''}</small></div>
      <p>${esc(T.desc)}</p><p class="stats">${T.hp} PV · ${Math.round(T.dmg / T.hit)} dégâts/s · portée ${String(T.range).replace('.', ',')}</p>
      ${locked ? `<p class="why">Il faut une caserne de niveau ${T.cas}.</p>` : `<div class="row">${btn(1)}${btn(5)}${k !== 'belier' ? btn(10) : ''}</div>`}</div></div>`;
  }
  h += '</div><div class="sec" id="heroSec"><h4>Héros</h4>';
  const hall = hallLvl(v);
  if (!hall) h += `<p class="note">${v.b.some(b => b.type === 'heros') ? 'La Salle des Héros est en construction.' : 'Construis la Salle des Héros (menu Construire, dès la halle du clan niveau 2) pour recruter des héros.'} Un seul héros combat par raid.</p>`;
  else h += '<p class="note">Un seul héros combat par raid. Après un combat, il se repose un moment avant de repartir.</p>';
  for (const k of HERO_KEYS) h += heroCard(k);
  return h + '</div>';
}
function heroCard(k) {
  const H = HEROES[k], v = me, h = (v.heroes || {})[k], hall = hallLvl(v), t = now(), lvl = h ? h.lvl : 1, sc = heroScale(lvl);
  let status, foot;
  if (!h) {
    const lock = hall < H.hall ? (hall ? 'Il faut une Salle des Héros de niveau ' + H.hall + '.' : 'Construis d’abord la Salle des Héros.') : '';
    const miss = missingTxt(v, { vivres: H.cost }), big = H.cost > capOf(v);
    status = `<span class="chip">${lock ? 'Verrouillé' : 'À recruter'}</span>`;
    foot = `<div class="foot"><span class="chips2">${chipsRes({ vivres: H.cost }, v.r)}</span><button class="btn${lock || miss || big ? ' off' : ' primary'}" data-act="heroBuy" data-k="${k}">Recruter</button></div>${lock ? `<p class="why">${esc(lock)}</p>` : big ? '<p class="why">Tes entrepôts sont trop petits pour réunir ce coût.</p>' : miss ? `<p class="why">${esc(miss)}</p>` : ''}`;
  } else {
    status = h.up ? `<span class="chip">Entraînement · <b data-until="${h.up.t1}"></b></span>` : h.rest > t ? `<span class="chip">Se repose · <b data-until="${h.rest}"></b></span>` : '<span class="chip plus">Prêt au combat</span>';
    if (h.up) foot = `<div class="bar"><i data-p0="${h.up.t0}" data-p1="${h.up.t1}"></i></div>`;
    else {
      const to = h.lvl + 1;
      if (to > 5) foot = '<p class="note">Niveau maximum atteint.</p>';
      else if (to > hall) foot = `<p class="note">Améliore la Salle des Héros au niveau ${to} pour aller plus loin.</p>`;
      else { const c = heroUpCost(k, to), miss = missingTxt(v, c); foot = `<div class="foot"><span class="chips2">${chipsRes(c, v.r)}<span class="dur">${ico('clock', '')}${fmtDur(heroUpTime(to))}</span></span><button class="btn${miss ? ' off' : ' primary'}" data-act="heroUp" data-k="${k}">Niveau ${to}</button></div>${miss ? `<p class="why">${esc(miss)}</p>` : ''}`; }
    }
  }
  return `<div class="item hero-card"><div class="troop">${thumb(k)}<div style="display:grid;gap:5px;min-width:0">
    <div class="head"><b>${esc(H.name)}, ${esc(H.title)}</b><small>${h ? 'niveau ' + h.lvl : 'salle niv. ' + H.hall}</small></div>
    <div class="row">${status}</div>
    <p class="stats">${fmtN(H.hp * sc)} PV · ${Math.round(H.dmg * sc / H.hit)} dégâts/s · portée ${String(H.range).replace('.', ',')}${H.pref === 'def' ? ' · vise les défenses' : ''}</p>
    <p class="pm"><b class="plus">+</b> ${esc(H.plus)}</p><p class="pm"><b class="minus">−</b> ${esc(H.minus)}</p>
    <p class="pw">${ico('roi', 'c-tro')}<span><b>${esc(H.power)}</b> : ${esc(H.pdesc)}</span></p></div></div>${foot}</div>`;
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
      ${on ? (partnerAv(k) !== APP_PV ? `<p class="why">${esc(pname(p))} n’a pas encore la nouvelle version du jeu : il faut le fermer complètement puis le rouvrir.</p>` : '') : '<p class="note">Le raid à deux se joue quand vous êtes connectés tous les deux en même temps.</p>'}</div>`;
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
/* ---------- aide ---------- */
function sheetHelp() {
  const sec = (t, body, open) => `<details class="help"${open ? ' open' : ''}><summary>${t}</summary>${body}</details>`;
  const ul = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';
  let h = '<p class="note">Tout ce qu’il faut savoir pour mener ton clan. Touche un titre pour l’ouvrir.</p>';
  h += sec('Ton village', ul([
    'Ton village vit en continu : les scieries, mines et moulins produisent même quand l’appli est fermée.',
    'Chaque ressource a un plafond de stockage : la halle du clan et les entrepôts l’augmentent.',
    'Les ouvriers construisent et améliorent les bâtiments, un chantier chacun. La halle du clan en débloque d’autres.',
    'Agrandir la halle du clan débloque de nouveaux bâtiments, plus de remparts et des niveaux plus élevés.',
    'Touche un bâtiment pour voir ses infos, l’améliorer ou le déplacer.']), true);
  h += sec('Remparts', ul([
    'Les remparts se posent et s’améliorent tout de suite, sans ouvrier. Ils se paient en pierre.',
    'Pour poser une ligne : touche une case, puis une autre case sur la même ligne. Toute la ligne se remplit.',
    'Les ennemis doivent casser un rempart ou faire le tour. Une brèche suffit pour qu’ils passent par là.',
    'Les béliers font 4 fois plus de dégâts aux remparts. Le Berserker les brise aussi très vite.',
    'On ne peut pas déployer de troupes à l’intérieur d’une enceinte fermée.',
    'Les remparts ne comptent pas dans le pourcentage de destruction.']));
  h += sec('Armée', TROOP_KEYS.map(k => { const T = TROOPS[k]; return `<div class="item troop">${thumb(k)}<div style="display:grid;gap:4px"><b>${T.name}</b><p>${esc(T.desc)}</p><p class="stats">${T.hp} PV · ${Math.round(T.dmg / T.hit)} dégâts/s · portée ${String(T.range).replace('.', ',')} · ${T.cost} vivres · ${T.space} place${T.space > 1 ? 's' : ''}</p></div></div>`; }).join('') +
    ul(['Les troupes s’entraînent à la caserne, une à la fois par caserne, et logent dans les tavernes.', 'Une troupe utilisée en raid est perdue, qu’elle survive ou non.']));
  h += sec('Héros', HERO_KEYS.map(k => { const H = HEROES[k]; return `<div class="item troop">${thumb(k)}<div style="display:grid;gap:4px"><b>${esc(H.name)}, ${esc(H.title)}</b><p class="pm"><b class="plus">+</b> ${esc(H.plus)}</p><p class="pm"><b class="minus">−</b> ${esc(H.minus)}</p><p class="pw">${ico('roi', 'c-tro')}<span><b>${esc(H.power)}</b> : ${esc(H.pdesc)}</span></p></div></div>`; }).join('') +
    ul(['Construis la Salle des Héros (halle du clan niveau 2), puis recrute les héros avec des vivres.', 'Le niveau de la salle fixe le niveau maximum des héros. L’entraînement prend du temps : le héros ne peut pas combattre pendant ce temps.',
      'Un seul héros par raid. En bataille, touche sa vignette puis le terrain pour le faire entrer, puis touche-la encore pour lancer son pouvoir (une fois par raid).',
      'Un héros ne meurt jamais pour de bon : après un combat, il se repose, d’autant plus longtemps qu’il a été blessé.']));
  h += sec('Raids solo', ul([
    'Choisis un camp orque : les cercles rouges montrent la portée de ses défenses. « Autre camp » en propose un nouveau contre quelques vivres.',
    'En bataille, choisis une troupe en bas puis touche le terrain, hors de la zone rouge. Le bouton ×5 déploie par groupes.',
    `${ico('sabre', 'st-on')} Les sabres notent ta réussite : 1 à 50 % de destruction, 2 à 75 %, 3 à 100 %. Chaque sabre augmente le butin.`,
    'Tu peux terminer le raid à tout moment : tu gardes le butin déjà gagné.']));
  h += sec('Raids à deux', ul([
    'Vous attaquez ensemble une forteresse orque, en direct. Il faut être connectés tous les deux en même temps, avec la même version du jeu.',
    `${ico('crown', 'st-on')} 1 couronne à 50 % de destruction, 1 de plus si le donjon tombe, 1 de plus à 100 %.`,
    'Les couronnes rapportent des médailles. Sans couronne, on en perd, et de plus en plus dans les ligues hautes.',
    'Tous les 2 jours à 20 h, chaque ligue donne une récompense, à condition d’avoir fait au moins un raid à deux. Sinon, rien, et on descend d’une ligue.',
    'À 3 couronnes : +25 % de production pendant 12 h.']));
  h += sec('Défendre ton village', ul([
    'Quand tu n’es pas là, des orques attaquent parfois ton village. Ils n’attaquent jamais pendant que tu joues.',
    'Après une attaque, un bouclier te protège quelques heures. Tu peux revoir chaque attaque dans le menu Village.',
    'Place les tours pour couvrir les bâtiments du bord, et protège le centre avec des remparts.']));
  h += sec('Commandes et réglages', ul([
    'Fais glisser la carte avec un doigt. Écarte ou rapproche deux doigts pour zoomer.',
    'Menu Village : orientation de l’écran, musique et bruitages, compte.',
    'Pour installer le jeu comme une appli : bouton « Installer l’appli », ou menu du navigateur puis « Ajouter à l’écran d’accueil ». Les mises à jour arrivent toutes seules.']));
  return h + '<button class="btn" data-act="tuto">Revoir le tutoriel</button>';
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
  const S = SND.get(), tg = (k, on) => `<button class="btn small${on ? ' primary' : ''}" data-act="snd" data-k="${k}" aria-pressed="${on}">${on ? 'Activée' : 'Coupée'}</button>`;
  h += `<div class="sec"><h4>Son</h4>
    <div class="item"><div class="row split"><b class="row">${ico('sound', 'c-tro')}Musique</b>${tg('music', S.music)}</div><input class="range" type="range" min="0" max="100" value="${Math.round(S.mv * 100)}" data-snd="mv" aria-label="Volume de la musique"></div>
    <div class="item"><div class="row split"><b class="row">${ico('axe', 'c-tro')}Bruitages</b>${tg('sfx', S.sfx)}</div><input class="range" type="range" min="0" max="100" value="${Math.round(S.sv * 100)}" data-snd="sv" aria-label="Volume des bruitages"></div></div>`;
  h += '<div class="sec"><h4>Attaques subies</h4>';
  if (!v.reports.length) h += '<p class="note">Aucune attaque pour l’instant.</p>';
  for (let i = v.reports.length - 1; i >= 0; i--) {
    const r = v.reports[i];
    h += `<div class="item"><div class="head"><b>${r.pct >= 50 ? 'Village pillé' : 'Attaque repoussée'}</b><small>${esc(fmtWhen(r.t))}</small></div>
      <div class="row split"><span class="chips2"><span class="chip">${r.pct} % détruit</span>${chipsRes(r.lost, null, 'short')}</span><button class="btn small" data-act="replay" data-i="${i}">${ico('eye', '')}Revoir</button></div></div>`;
  }
  h += '</div><div class="sec"><h4>Journal</h4><ol class="log">' + v.log.slice().reverse().map(e => `<li><time>${fmtAgo(e.t)}</time><span>${esc(e.m)}</span></li>`).join('') + '</ol></div>';
  h += `<div class="row"><button class="btn grow" data-act="help">${ico('help', 'c-tro')}Aide et règles du jeu</button><button class="btn grow" data-act="tuto">Revoir le tutoriel</button></div>`;
  return h;
}
function renderSheet() {
  if (!sheet || !me) { els.sheet.hidden = true; return; }
  const titles = { build: 'Construire', army: 'Armée et héros', duo: 'À deux', village: me.name, gift: 'Envoyer des ressources', help: 'Aide' };
  els.sheet.hidden = false;
  els.sheetTitle.textContent = titles[sheet] || '';
  const body = sheet === 'build' ? sheetBuild() : sheet === 'army' ? sheetArmy() : sheet === 'duo' ? sheetDuo() : sheet === 'gift' ? sheetGift() : sheet === 'help' ? sheetHelp() : sheetVillage();
  setHTML(els.sheetBody, body);
  if (sheetArg === 'heroes' && !renderSheet.scrolled) { renderSheet.scrolled = true; const el = $('#heroSec'); if (el) els.sheetBody.scrollTop = el.offsetTop - 8; }
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
      <div class="bigstars">${[0, 1, 2].map(i => `<span class="${i < M.mark ? 'pop' : ''}" style="animation-delay:${0.7 + i * 0.38}s">${ico(solo ? 'sabre' : 'crown', i < M.mark ? 'st-on' : 'st-off')}</span>`).join('')}</div>
      <p class="result-pct">${Math.floor(M.pct * 100)} % du camp détruit</p>
      <div class="chips2" style="justify-content:center">${chipsRes(M.got || {}, null, 'plus') || '<span class="note">Pas de butin cette fois.</span>'}</div>
      ${solo ? '' : `<p style="text-align:center"><b class="row" style="justify-content:center">${ico('medal', 'c-tro')}${M.dM >= 0 ? '+' : '−'}${Math.abs(M.dM)} médailles</b><span class="note">Ligue des ${LEAGUES[L].name} · ${me ? me.medals : 0} médailles</span></p>`}
      ${M.hero ? (() => { const rt = heroRestTime((me.heroes[M.hero.k] || {}).lvl || 1, M.hero.frac, M.hero.dead), n = esc(HEROES[M.hero.k].name);
        return `<p class="note" style="text-align:center">${M.hero.dead ? n + ' est tombé au combat : il se repose ' + fmtDur(rt) + '.' : rt < 60000 ? n + ' rentre en pleine forme.' : n + ' rentre blessé : il se repose ' + fmtDur(rt) + '.'}</p>`; })() : ''}
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
  } else if (modal && modal.kind === 'news') {
    h = `<p class="eyebrow">Mise à jour</p><h2>Du nouveau dans la vallée</h2>
      <ul class="news">
        <li>${ico('wall', 'c-pierre')}<span><b>Remparts</b> : protège ton village. Ils se posent en ligne, tout de suite, et les camps orques en ont aussi.</span></li>
        <li>${ico('roi', 'c-tro')}<span><b>Salle des Héros</b> : trois héros puissants, chacun avec son pouvoir. Un seul par raid.</span></li>
        <li>${ico('sound', 'c-tro')}<span><b>Musique et bruitages</b> d’ambiance taverne, réglables dans le menu Village.</span></li>
        <li>${ico('help', 'c-tro')}<span><b>Aide</b> complète (bouton ? en haut) et nouvelles vignettes des troupes.</span></li>
      </ul>
      <div class="row"><button class="btn grow" data-act="tuto">Voir le tutoriel</button><button class="btn primary grow" data-act="closeModal">C’est parti</button></div>`;
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
  renderTop(); renderBottom(); renderSheet(); renderModal(); tickLive(); renderTuto();
}

/* ---------- tutoriel ---------- */
const NEWS_V = 3;
const TUTO = [
  { t: 'Bienvenue, chef !', x: 'Voici ton village nain. Il vit même quand l’appli est fermée : il produit, il entraîne tes troupes et il se défend contre les orques.' },
  { sel: '#hudTop .stock', t: 'Tes réserves', x: 'Bois, pierre et vivres, puis la place dans tes tavernes. Les scieries, mines et moulins les remplissent toutes les heures.' },
  { sel: '.nav [data-s="build"]', t: 'Construire', x: 'Ajoute des bâtiments, des défenses et des remparts. Touche un bâtiment du village pour l’améliorer ou le déplacer.' },
  { sel: '.nav [data-s="army"]', t: 'Armée et héros', x: 'Entraîne guerriers, arbalétriers et béliers. Plus tard, recrute des héros à la Salle des Héros.' },
  { sel: '.nav [data-act="attack"]', t: 'Raid solo', x: 'Attaque un camp orque pour piller ses ressources : choisis une troupe en bas de l’écran, puis touche le terrain pour la déployer.' },
  { sel: '.nav [data-s="duo"]', t: 'À deux', x: 'Le cœur du jeu : des raids en direct avec ta partenaire. Les couronnes rapportent des médailles et font monter votre ligue.' },
  { sel: '#hudTop [data-act="help"]', t: 'Besoin d’aide ?', x: 'Toutes les règles sont ici, à tout moment. Le menu Village règle la musique et l’affichage. Bonne chance, chef !' },
];
let tuto = null;
function startTuto() { if (mode !== 'home' || !me) return; tuto = 0; sel = null; place = null; modal = null; closeSheet(true); LS.set('mk.tuto', 1); renderAll(); }
function localRect(el) {
  const r = el.getBoundingClientRect(), rot = applyOrientation.rot || 0, W = window.innerWidth, H = window.innerHeight;
  const map = rot === 90 ? (x, y) => [y, W - x] : rot === -90 ? (x, y) => [H - y, x] : (x, y) => [x, y];
  const a = map(r.left, r.top), b = map(r.right, r.bottom);
  return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
}
function renderTuto() {
  const el = $('#tuto'); if (!el) return;
  if (tuto == null || mode !== 'home' || modal || sheet) { el.hidden = true; return; }
  const st = TUTO[tuto], card = el.querySelector('.tuto-card'), hole = el.querySelector('.tuto-hole');
  el.hidden = false;
  if (card._step !== tuto) {
    card._step = tuto;
    card.innerHTML = `<p class="eyebrow">Tutoriel · ${tuto + 1} sur ${TUTO.length}</p><h3>${esc(st.t)}</h3><p>${esc(st.x)}</p>
      <div class="row"><button class="btn small" data-act="tutoSkip">Passer</button><button class="btn primary grow" data-act="tutoNext">${tuto === TUTO.length - 1 ? 'C’est parti !' : 'Suivant'}</button></div>`;
  }
  const app = $('#app'), AW = app.clientWidth || window.innerWidth, AH = app.clientHeight || window.innerHeight, cw = Math.min(340, AW - 24);
  card.style.width = cw + 'px';
  const target = st.sel ? document.querySelector(st.sel) : null;
  if (target && target.offsetParent !== null) {
    const r = localRect(target), pad = 6, ch = card.offsetHeight;
    el.classList.remove('dim');
    Object.assign(hole.style, { display: 'block', left: (r.x - pad) + 'px', top: (r.y - pad) + 'px', width: (r.w + 2 * pad) + 'px', height: (r.h + 2 * pad) + 'px' });
    let cy = r.y + r.h + 16; if (cy + ch > AH - 8) cy = Math.max(8, r.y - ch - 16);
    Object.assign(card.style, { left: Math.max(12, Math.min(AW - cw - 12, r.x + r.w / 2 - cw / 2)) + 'px', top: cy + 'px' });
  } else {
    el.classList.add('dim'); hole.style.display = 'none';
    Object.assign(card.style, { left: (AW - cw) / 2 + 'px', top: Math.max(12, (AH - card.offsetHeight) / 2) + 'px' });
  }
}

/* ---------- événements ---------- */
document.addEventListener('pointerdown', e => { pressing = e.target.closest('button, input'); SND.unlock(); }, true);
document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.snd; if (k) SND.set({ [k]: Math.max(0, Math.min(1, e.target.value / 100)) }); });
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
  upwalls: b => { const r = act({ type: 'upwalls', lvl: +b.dataset.l }); if (r) toast(r.n + ' rempart' + (r.n > 1 ? 's renforcés' : ' renforcé') + '.'); },
  removeWall: b => { if (!window.confirm('Retirer ce rempart ? La pierre ne sera pas rendue.')) return; if (act({ type: 'remove', id: +b.dataset.id })) { sel = null; refreshScene(); renderAll(); } },
  heroBuy: b => { const k = b.dataset.k; if (act({ type: 'heroBuy', k })) toast(HEROES[k].name + ' rejoint ton clan !'); },
  heroUp: b => { const k = b.dataset.k; if (act({ type: 'heroUp', k })) toast(HEROES[k].name + ' part s’entraîner.'); },
  power: () => usePower(),
  snd: b => { const k = b.dataset.k, S = SND.get(); SND.set({ [k]: !S[k] }); renderAll(); },
  help: () => { if (mode === 'home' && me) openSheet('help'); },
  tuto: () => { modal = null; closeSheet(true); if (mode === 'home') startTuto(); else renderAll(); },
  tutoNext: () => { tuto = tuto != null && tuto < TUTO.length - 1 ? tuto + 1 : null; renderAll(); },
  tutoSkip: () => { tuto = null; renderAll(); },
  login: () => doLogin(),
  logout: () => { if (!confirm('Se déconnecter de Mountain Kings sur cet appareil ?')) return; FB.logout().finally(() => location.reload()); },
  reload: () => location.reload(),
  install: () => { const e = installEvt; if (!e) return; installEvt = null; e.prompt(); (e.userChoice || Promise.resolve()).finally(() => renderAll()); },
  importOld: () => importOld(),
};
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderAll(); });
const QUIET = new Set(['troop', 'power', 'batch', 'noop', 'heroBuy', 'upgrade', 'upwalls', 'chest', 'train', 'placeOk']);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (!QUIET.has(b.dataset.act)) SND.sfx('click');
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
  if (act({ type: 'found', vname, pname: pn, c: safeColor(c) })) { LS.set('hameau2.seen.' + myKey, now()); LS.set('mk.news', NEWS_V); setMode('home'); setTimeout(startTuto, 900); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { resim(); renderAll(); refreshScene(); } });

let lastRaids = null, lastUp = null;
function tick() {
  const t = now();
  if (simMine) {
    simulateVillage(simMine, t);
    if (lastRaids != null && simMine.raids > lastRaids && mode !== 'loading') { toast('Des orques ont attaqué ton village ! Tout est dans le menu Village.'); buzz(); SND.sfx('alarm'); }
    lastRaids = simMine.raids;
    const upN = simMine.b.filter(b => b.up).length + Object.values(simMine.heroes || {}).filter(h => h && h.up).length;
    if (lastUp != null && upN < lastUp && mode === 'home') SND.sfx('built');
    lastUp = upN;
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
if (window.MK_TEST) window.__mk = { get me() { return me; }, get mode() { return mode; }, get fight() { return fight; }, toScreen: (x, z) => gl ? V3.toScreen(x, z) : null, canDeploy: (x, z) => !!fight && canDeploy(fight.zoneB, x, z), snd: SND };
async function boot() {
  const cv = $('#gl');
  gl = typeof THREE !== 'undefined' && V3.init(cv);
  if (/[?&]thumbs=1/.test(location.search)) { if (gl) V3.loadModels('models/').then(() => { window.__thumbs = V3.renderThumbs(UNIT_KEYS); }); return; }
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
