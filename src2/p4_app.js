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
const AWAY_KINDS = new Set(['built', 'cand', 'arrive', 'season', 'leave', 'join', 'hero', 'feast', 'site', 'goal', 'dj', 'merch', 'forge', 'raid', 'portal', 'def', 'sol']);
const TOAST_KINDS = new Set(['built', 'cand', 'season', 'leave', 'join', 'feast', 'goal', 'merch', 'portal']);
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
    return { key: 'm' + b.id, id: b.id, type: b.type, lvl: b.lvl, gx, gz, up: b.up ? { frac: Math.min(1, b.up.done / b.up.need) } : null, col: safeColor(v.c), crop: b.type === 'champ' ? cropOf(b) : undefined, dead: isBroken(b), ban: b.type === 'poste' && banOk(b.ban) ? b.ban.r : undefined };
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
  const ri = raidInfo(v, t);
  if (ri.st !== 'calm') chips += `<button class="glass chipb${ri.st === 'ready' ? ' alert' : ''}" data-act="sheet" data-s="defense">${ico('flame', '')}${ri.st === 'ready' ? 'Portail chargé !' : 'Portail · ' + fmtDur(ri.ready - t)}</button>`;
  const head = `<div class="idrow"><button class="glass me" data-act="sheet" data-s="village"><span class="crest" style="background:${safeColor(v.c)}">${esc(initial(v.name))}</span>
    <span class="idtxt"><b>${esc(v.name)}</b><small>${ico('s' + si, 'c-tro')}${SEASONS[si].name}, jour ${seasonDay(v, t)} sur 2</small></span></button>
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
    <button data-act="sheet" data-s="donjon">${djIco('sword')}Donjon</button>
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
const LOG_ICON = { built: 'hammer', site: 'hammer', cand: 'people', arrive: 'people', leave: 'people', season: 's0', join: 'link', hero: 'crown', feast: 'mug', skill: 'star', found: 'house', demolish: 'hammer', goal: 'star', crop: 'ble', dj: 'crown', merch: 'or', forge: 's_anvil', raid: 'shield', portal: 'flame', def: 'shield', sol: 'shield' };
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
    + sec('Les donjons', ['Menu Donjon : ton héros actif part dans la mine des gobelins. Chaque victoire ouvre le niveau suivant. La crypte des rois s’ouvre après une victoire au niveau 2, les Profondeurs après une victoire au niveau 4.', 'Pose le pouce sur la gauche de l’écran pour bouger (flèches ou ZQSD sur ordinateur). Ton héros attaque tout seul ; à droite, tes compétences et ta potion (touches 1, 2, 3 et 4), et la roulade (barre d’espace ou touche 5) : un bond dans la direction du pouce, intouchable un instant, toutes les 4 secondes.', 'Les grilles d’une salle se ferment jusqu’à la dernière vague. Entre deux salles, on reprend son souffle. Les boss préviennent avant leurs coups : sors des cercles rouges.', 'Au retour : de l’expérience pour le héros, de l’or, de la pierre et du bois pour le village, des objets et des pierres précieuses dans ton sac, parfois un prisonnier délivré qui voudrait s’installer. Défaite ou fuite : la moitié (on garde les meilleurs objets).', 'Les Profondeurs : des étages sans fin, de plus en plus durs, avec un boss tous les 5 étages. À la fin de chaque étage, on choisit : descendre (avec la vie et les potions qui restent) ou remonter avec tout le butin. Si l’on tombe, on ne garde que la moitié de toute la descente.', 'À deux : quand ta partenaire a le jeu ouvert, invite-la depuis le menu Donjon. Les monstres sont plus solides, chacun gagne toute l’expérience, et un héros tombé se relève si l’autre reste 3 secondes à côté de lui.', 'Combos à deux : une compétence marque le monstre touché pendant 3 secondes ; si l’autre héros le frappe, +50 % de dégâts. Pareil sur un monstre étourdi, gelé ou enraciné par l’autre.']);
}
function renderSheet() {
  if (!sheet || !me || mode !== 'home') { els.sheet.hidden = true; return; }
  const titles = { build: 'Construire', people: 'Villageois', job: 'Choisir un métier', workers: 'Ajouter un travailleur', hero: 'Héros', journal: 'Journal du village', village: me.name, stock: 'Réserves', help: 'Aide', goals: 'Objectifs', donjon: 'Donjons', bag: 'Mon sac', forge: 'La forge', merch: 'Le marchand ambulant', defense: 'Défense', caserne: 'La caserne' };
  els.sheet.hidden = false;
  els.sheetTitle.textContent = titles[sheet] || '';
  const f = { build: sheetBuild, people: sheetPeople, job: sheetJob, workers: sheetWorkers, hero: sheetHero, journal: sheetJournal, village: sheetVillage, stock: sheetStock, help: sheetHelp, goals: sheetGoals, donjon: sheetDonjon, bag: sheetBag, forge: sheetForge, merch: sheetMerch, defense: sheetDefense, caserne: sheetCaserne }[sheet];
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
  else if (M && M.kind === 'denied') h = `<h2>Accès refusé</h2><p>Le serveur a refusé l’accès au village. Les règles de la base de données ne sont peut-être pas encore à jour, ou ce village a déjà ses deux habitants.</p><button class="btn primary" data-act="reload">Réessayer</button>`;
  else if (M && M.kind === 'info') h = `<h2>${esc(M.title)}</h2><p>${esc(M.text)}</p><button class="btn primary" data-act="closeModal">Compris</button>`;
  else if (M && M.kind === 'newhero' && me) h = heroHTML(true);
  else if (M && M.kind === 'djres' && dj) h = djResHTML();
  else if (M && M.kind === 'raid' && me) h = raidModalHTML();
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
  ...ACT_EQ,
  ...ACT_RAID,
  ...ACT_GAR,
  ...ACT_TIP,
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
    candCheck(); raidCheck(); tipCheck();
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
