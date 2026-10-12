/* ===================== DONJONS : interface (entrée, joystick, compétences, bilan) =====================
   Solo pour l'instant : le combat tourne sur le téléphone (20 pas par seconde) ; le bilan est enregistré au retour au village.
   Ce fichier ne fait que définir des fonctions : l'application (p4_app) les appelle. */
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
  potion: '<svg viewBox="0 0 24 24"><path d="M9.5 2.5h5v2h-1v4.2c3 1 5 3.6 5 6.8a6.5 6.5 0 0 1-13 0c0-3.2 2-5.8 5-6.8V4.5h-1z" fill="currentColor"/><path d="M6.6 14h10.8a5.4 5.4 0 0 1-10.8 0z" fill="#fff" opacity=".35"/></svg>',
};
const djIco = k => `<span class="ic">${DJ_IC[k] || ''}</span>`;
const DJ_SK_ICON = { charge: 'sword', tourbillon: 'sword', cri: 'shield', marteau: 'bolt', bouclier: 'shield', consecration: 'star', roulade: 'feather', pluie: 'arrow', percant: 'arrow', boule: 'flame', nova: 'snow', tp: 'feather', ombre: 'feather', poison: 'drop', fumee: 'eye', lumiere: 'heart', chatiment: 'bolt', priere: 'heart', ours: 'paw', loup: 'paw', racines: 'leaf', squelettes: 'skull', drain: 'drop', cadavre: 'skull' };

/* ---------- le menu Donjon ---------- */
function sheetDonjon() {
  const v = me, hh = activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p><button class="btn primary" data-act="heroForm">Créer mon héros</button>';
  const top = Math.max(1, hh.dj || 1), pick = Math.min(top, Math.max(1, +sheetArg || top));
  const lvls = []; for (let l = Math.max(1, top - 5); l <= top; l++) lvls.push(l);
  let h = `<div class="item feature"><div class="head"><b class="row">${ico('crown', 'c-tro')}${esc(hh.name)}</b><small>${esc(heroLine(hh))}</small></div>
    <p>${heroesOf(v, uid).length > 1 ? 'C’est ton héros actif. Pour en envoyer un autre, choisis-le dans le menu Héros.' : 'C’est lui qui part. Les donjons à deux arrivent bientôt.'}${hh.sp ? ` <b>${hh.sp} point${hh.sp > 1 ? 's' : ''} de compétence à dépenser</b> (menu Héros).` : ''}</p></div>`;
  h += `<div class="sec"><h4>La mine des gobelins</h4><div class="item">
    <p>Des galeries pleines de gobelins, d’archers, de chamans et de trolls, avec leur chef au fond. Chaque victoire ouvre le niveau suivant.</p>
    <div class="row djlv">${lvls.map(l => `<button class="btn small${l === pick ? ' primary' : ''}" data-act="sheet" data-s="donjon" data-k="${l}" aria-pressed="${l === pick}">Niveau ${l}</button>`).join('')}</div>
    <p class="note">Niveau ${pick} : conseillé pour un héros de niveau ${pick}${hh.lvl < pick ? ' (le tien est plus faible : prudence)' : ''}. Récompenses : de l’expérience pour ${esc(hh.name)}, de la pierre et du bois pour le village.</p>
    <button class="btn primary" data-act="djGo" data-k="${pick}">${djIco('sword')}Entrer dans la mine (niveau ${pick})</button></div></div>`;
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>Pose le pouce sur la gauche de l’écran pour te déplacer. Ton héros attaque tout seul le monstre le plus proche (les chamans d’abord, sinon ils soignent les autres).</li>
    <li>À droite : tes compétences et ta potion. Une compétence se recharge après usage.</li>
    <li>En entrant dans une salle, les grilles se ferment jusqu’à la fin des vagues de monstres. Entre deux salles, ton héros reprend son souffle.</li>
    <li>Le chef troll prévient avant de frapper : sors du cercle rouge et écarte-toi de sa charge (s’il percute un mur, il est sonné).</li>
    <li>En chemin : des coffres, l’autel des anciens rois, et parfois un prisonnier à délivrer, qui rejoindra le village.</li>
    <li>Défaite ou fuite : on garde la moitié de l’expérience et du butin.</li></ul></div>`;
  return h;
}

/* ---------- entrée et sortie ---------- */
function djBegin(lvl) {
  if (!me || dj) return;
  const hh = activeHero(me, uid); if (!hh) { toast('Crée d’abord ton héros.'); return; }
  if (!gl) { toast('Les donjons ont besoin de la 3D, indisponible sur cet appareil.'); return; }
  lvl = Math.max(1, Math.min(hh.dj || 1, lvl | 0 || 1));
  const seed = hash((Math.floor(now()) ^ hashStr(hh.id)) >>> 0) || 1;
  const d = genDungeon(seed, lvl, 'mine'), st = djStart(d, [hh], { seed });
  dj = { st, d, lvl, seed, hid: hh.id, acc: 0, inp: { mx: 0, my: 0, sk: -1, pot: false }, joy: null, keys: {}, els: {}, ended: false, res: null, nocastT: 0 };
  closeSheet(true); sel = null; selP = null; place = null; modal = null;
  mode = 'donjon';
  V3.dj.enter(st, hh.id);
  djHudBuild();
  SND.music('battle', 1); SND.sfx('hero');
  renderAll();
  toast('La mine des gobelins, niveau ' + lvl + '. Pose le pouce à gauche pour bouger : ' + hh.name + ' attaque tout seul.');
}
function djLeave() {
  if (!dj) return;
  V3.dj.exit();
  const el = $('#djHud'); if (el) el.hidden = true;
  dj = null; modal = null; mode = 'home';
  SND.music('village', 1);
  refreshScene(); renderAll();
}
function djBack() {
  if (!dj) return;
  const r = dj.res || djResult(dj.st), hid = dj.hid, name = (me && me.heroes[hid] || {}).name || 'Ton héros';
  const res = act({ type: 'djEnd', hid, lvl: r.lvl, win: r.win, xp: r.xp, loot: r.loot, pris: r.pris }, { quiet: true });
  djLeave();
  if (res && res.up) { toast(name + ' passe au niveau ' + res.lvl + ' ! Point' + (res.up > 1 ? 's' : '') + ' de compétence à dépenser dans le menu Héros.'); SND.sfx('star'); }
  else if (res && res.pris) toast(res.pris + ' vous attend au village : touchez « Accueillir ».');
  else if (!res) toast('Le retour n’a pas pu être enregistré.');
}
function djEnded() {
  dj.ended = true; dj.res = djResult(dj.st);
  const r = dj.res;
  setTimeout(() => { if (!dj) return; SND.sfx(r.win ? 'victory' : 'defeat'); modal = { kind: 'djres' }; renderAll(); }, r.win ? 900 : 1700);
}
function djResHTML() {
  const r = dj.res || djResult(dj.st), hh = me && me.heroes[dj.hid];
  const title = r.win ? 'Victoire !' : r.fled ? 'Repli' : 'Défaite…';
  const lead = r.win ? 'Le chef troll est vaincu et la mine est nettoyée.' : r.fled ? 'Tu as quitté la mine avant la fin : la moitié de l’expérience et du butin.' : 'Ton héros est tombé : il rentre au village avec la moitié de l’expérience et du butin.';
  const xpH = hh && hh.race === 'humain' ? Math.round(r.xp * 1.1) : r.xp;
  let up = 0, lv = hh ? hh.lvl : 1, xp = hh ? (hh.xp || 0) + xpH : 0;
  while (hh && lv < HERO_MAX_LVL && xp >= heroXpNeed(lv)) { xp -= heroXpNeed(lv); lv++; up++; }
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0');
  return `<p class="eyebrow">La mine des gobelins · niveau ${r.lvl}</p><h2>${title}</h2><p>${lead}</p>
    <div class="item"><div class="row split"><b>Expérience</b><span class="chip plus">+${fmtN(xpH)}</span></div>
      ${up ? `<p><b>${esc(hh.name)} passe au niveau ${lv} !</b> ${up > 1 ? up + ' niveaux d’un coup.' : ''} De nouveaux points de compétence l’attendent.</p>` : hh ? `<div class="bar"><i style="width:${Math.min(100, xp / heroXpNeed(lv) * 100).toFixed(0)}%"></i></div>` : ''}
      <div class="row split"><b>Butin pour le village</b><span class="chips2">${Object.keys(r.loot).length ? rewChips(r.loot) : '<span class="note">rien</span>'}</span></div>
      ${r.pris ? '<p><b>Un prisonnier délivré</b> : il vous attendra au village, prêt à s’installer.</p>' : ''}
      <p class="note">${r.kills} monstres vaincus · ${mm} min ${ss}${r.win ? ' · niveau ' + (r.lvl + 1) + ' ouvert' : ''}</p></div>
    <button class="btn primary" data-act="djBack">Retour au village</button>`;
}

/* ---------- l'écran de combat : barre de vie, joystick, boutons ---------- */
function djHudBuild() {
  let el = $('#djHud');
  if (!el) { el = document.createElement('div'); el.id = 'djHud'; el.className = 'djhud'; $('#app').appendChild(el); djBind(el); }
  const h = dj.st.heroes.find(x => x.id === dj.hid), C = CLASSES[h.cls], sk = DJ_SKILLS[h.cls];
  el.innerHTML = `<div class="djtop">
      <div class="glass djme"><span class="crest" style="background:${safeColor(h.col)}">${esc(initial(h.name))}</span>
        <div class="djmet"><b>${esc(h.name)} <small>niv. ${h.lvl}</small></b><div class="djhp"><i id="djHp"></i><em id="djHpT"></em></div></div></div>
      <div class="glass djinfo" id="djInfo"></div>
      <button class="glass chipb djflee" data-act="djFlee">Fuir</button></div>
    <div class="glass djboss" id="djBoss" hidden><b>Chef troll</b><div class="djhp boss"><i id="djBossHp"></i></div></div>
    <div class="djjoy" id="djJoy"><p class="djhint" id="djHint">Pose le pouce ici pour te déplacer</p></div>
    <div class="djbase" id="djBase" hidden><div class="djknob" id="djKnob"></div></div>
    <div class="djbtns">${[0, 1, 2].map(i => { const on = h.rank[i] > 0, name = C.skills[i][0]; return `<button class="djsk${on ? '' : ' lock'}" data-djsk="${i}" aria-label="${esc(name)}"${on ? '' : ' disabled'}>
        <span class="djico">${djIco(DJ_SK_ICON[sk[i].id])}</span><span class="djcd" id="djCd${i}"></span><small>${on ? esc(name) : 'niv. ' + SKILL_LVLS[i]}</small></button>`; }).join('')}
      <button class="djsk pot" data-djpot="1" aria-label="Potion"><span class="djico">${djIco('potion')}</span><span class="djcd" id="djCdP"></span><b class="djn" id="djPot"></b><small>Potion</small></button></div>`;
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
    const b = e.target.closest('[data-djsk],[data-djpot]');
    if (b) { e.preventDefault(); if (b.disabled) return; if (b.dataset.djpot) dj.inp.pot = true; else dj.inp.sk = +b.dataset.djsk; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 140); SND.unlock(); return; }
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
/* Clavier (ordinateur) : flèches ou ZQSD/WASD pour bouger, 1 2 3 pour les compétences, 4 ou P pour la potion. */
const DJ_KEYS = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], z: [0, 1], w: [0, 1], s: [0, -1], q: [-1, 0], a: [-1, 0], d: [1, 0] };
document.addEventListener('keydown', e => {
  if (!dj || e.target.closest && e.target.closest('input,textarea')) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DJ_KEYS[k]) { dj.keys[k] = 1; e.preventDefault(); }
  else if (k === '1' || k === '2' || k === '3') dj.inp.sk = +k - 1;
  else if (k === '4' || k === 'p') dj.inp.pot = true;
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
  set('djHpT', 't', h.dead ? 'à terre' : Math.ceil(h.hp) + ' / ' + Math.round(h.hpMax) + (h.shield > 0 ? ' (+' + Math.round(h.shield) + ')' : ''));
  for (let i = 0; i < 3; i++) set('djCd' + i, 'cd', h.rank[i] && h.cd[i] > 0 ? (h.cd[i] / h.cdMax[i] * 360).toFixed(0) + 'deg' : '0deg');
  set('djPot', 't', String(h.pot));
  set('djCdP', 'cd', h.pot <= 0 ? '360deg' : h.potT > 0 ? (h.potT * 360).toFixed(0) + 'deg' : '0deg');
  const pr = djProgress(st);
  set('djInfo', 't', st.exit ? 'Sortie ouverte : rejoins la lumière' : pr.boss ? 'Le chef troll' : pr.fighting ? `Salle ${pr.done + 1} sur ${pr.total} · vague ${pr.wave} sur ${pr.waves}` : pr.done >= pr.total ? 'Au fond : le chef troll' : `Salles nettoyées : ${pr.done} sur ${pr.total}`);
  const bb = E('djBoss'); if (bb && bb.hidden === !!pr.boss) bb.hidden = !pr.boss;
  if (pr.boss) set('djBossHp', 'w', Math.max(0, pr.boss.hp / pr.boss.hpMax * 100).toFixed(1) + '%');
}
const DJ_SFX_ATK = { rodeur: 'shoot', mage: 'bolt', pretre: 'bolt', druide: 'shoot', necro: 'bolt' };
function djEvents(st) {
  for (const e of st.ev) {
    if (gl) V3.dj.fx(e, st);
    const mine = e.id === dj.hid;
    switch (e.k) {
      case 'atk': if (mine) { const h = st.heroes.find(x => x.id === e.id); SND.sfx(h && DJ_SFX_ATK[h.cls] && !h.form ? DJ_SFX_ATK[h.cls] : 'chop'); } break;
      case 'die': SND.sfx(e.boss ? 'collapse' : 'death'); break;
      case 'cast': if (mine) SND.sfx('power'); break;
      case 'nocast': if (mine && performance.now() - dj.nocastT > 1200) { dj.nocastT = performance.now(); toast('Pas de cible à portée pour cette compétence.'); } break;
      case 'potion': if (mine) SND.sfx('built'); break;
      case 'chest': SND.sfx('coin'); toast('Coffre : ' + rewTxt(e.got) + '.'); break;
      case 'loot': toast('Butin du chef : ' + rewTxt(e.got) + '.'); break;
      case 'altar': SND.sfx('star'); toast('Autel des anciens rois · ' + DJ_BLESS[e.b] + ', jusqu’à la sortie.'); break;
      case 'free': SND.sfx('invite'); toast('Prisonnier délivré ! Il vous attendra au village.'); break;
      case 'lock': SND.sfx(e.boss ? 'alarm' : 'wallhit'); if (e.boss) toast('Le chef troll ! Sors du cercle rouge et écarte-toi de sa charge.'); break;
      case 'wavecome': toast('D’autres monstres sortent des galeries… (vague ' + e.n + ' sur ' + e.of + ')'); break;
      case 'clear': SND.sfx('star'); if (e.boss) toast('Le chef troll est vaincu ! La sortie est ouverte.'); break;
      case 'slam': case 'boom': SND.sfx('boom'); break;
      case 'wall': SND.sfx('wallbreak'); break;
      case 'trap': if (mine) SND.sfx('wallhit'); break;
      case 'revive': toast('Increvable : ton héros se relève !'); SND.sfx('power'); break;
      case 'enrage': SND.sfx('alarm'); break;
    }
  }
  st.ev.length = 0;
}
/* À chaque image : la simulation avance par pas de 1/20 s, puis l'affichage suit. */
function djFrame(dt, tNow) {
  if (!dj) return;
  const st = dj.st;
  if (!st.over) {
    const kv = djKeyVec(), mx = kv ? kv[0] : dj.inp.mx, my = kv ? kv[1] : dj.inp.my;
    dj.acc = Math.min(dj.acc + dt, 0.25);
    let n = 0;
    while (dj.acc >= DJ_DT && n < 5 && !st.over) {
      djStep(st, { [dj.hid]: { mx, my, sk: dj.inp.sk, pot: dj.inp.pot } });
      dj.inp.sk = -1; dj.inp.pot = false; dj.acc -= DJ_DT; n++;
      djEvents(st);
    }
  }
  V3.dj.sync(st, st.over ? 1 : dj.acc / DJ_DT, dt, tNow);
  djHudUpdate();
  if (st.over && !dj.ended) djEnded();
}
V3.onFrame(djFrame);
