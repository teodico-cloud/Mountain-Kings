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
  </div>`;
  if (r.h) h += '<p class="why">Ils ont pillé la halle, le cœur du village : le moral baisse pendant un jour.</p>';
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
      <p>${info.st === 'charge' ? 'Une fois chargé, le raid partira dès que vous serez absents tous les deux depuis 2 heures.' : 'Les gobelins attaqueront dès que vous serez absents tous les deux depuis 2 heures.'} Préparez vos défenses de ce côté, ou refermez-le avec votre héros (un petit donjon et son gardien, niveau ${L}).</p>
      ${info.p.map(p => `<div class="row split portrow"><b>Portail ${RAID_OF[p.side]}</b>${p.cl ? '<span class="chip plus">refermé</span>' : hh ? `<span class="row"><button class="btn small primary" data-act="djGo" data-th="portail" data-k="${L}" data-pi="${p.i}">${djIco('sword')}Le refermer</button>${pk && ph ? `<button class="btn small${on ? '' : ' off'}" data-act="djInvite" data-th="portail" data-k="${L}" data-pi="${p.i}"${on ? '' : ' disabled'}>À deux</button>` : ''}</span>` : '<span class="note">crée ton héros</span>'}</div>`).join('')}
      <div class="row"><button class="btn small" data-act="portalLook">Voir le portail</button></div></div>`;
  }
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
    <li>Le raid ne part que si vous êtes absents tous les deux depuis 2 heures. Il se joue tout seul ; à votre retour, vous pouvez le revoir.</li>
    <li>Les gobelins foncent sur la halle pour la piller, les voleurs filent vers l’entrepôt, les trolls cassent ce qui bloque. Tous prennent le chemin le plus court, en comptant ce qu’il faudrait casser : une porte est souvent leur cible.</li>
    <li>Ce qu’ils emportent est perdu s’ils regagnent le portail ; abattus avant, ils lâchent tout. Jamais plus de 30 % d’une ressource par raid.</li>
    <li>Vos héros défendent la halle (et gagnent de l’expérience), les tours tirent sur ce qui passe à portée, les pièges cachés blessent ou immobilisent. Chaque ennemi abattu rapporte de l’or.</li>
    <li>Si la halle est pillée, le moral baisse pendant un jour. Après un raid, réparez ce qui est abîmé.</li>
    <li>Refermer un portail avec son héros (seul ou à deux) : un petit donjon et son gardien. Tous les portails refermés : pas de raid cette fois.</li></ul></div>`;
  return h;
}

/* ---------- panneau d'une défense du village (touchée sur la carte) ---------- */
function defPanel(v, b) {
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
  return out;
}
function raidReplayStart() {
  const lr = me && me.lastRaid;
  if (!lr || dj || rp) return;
  if (!gl) { toast('La rediffusion a besoin de la 3D, indisponible sur cet appareil.'); return; }
  const st = raidReplay(lr);
  rp = { st, lr, speed: 1, acc: 0, sig: '', ended: false };
  closeSheet(true); modal = null; sel = null; selP = null; place = null;
  mode = 'raid';
  V3.raid.enter(st); V3.clearBuildings(); V3.setBuildings(raidItems(st));   // repartir de zéro : pas d'animation de construction partout
  rpHudBuild(); SND.music('battle', 1); SND.sfx('alarm');
  renderAll();
}
function raidReplayExit() {
  if (!rp) return;
  V3.raid.exit(); rp = null; V3.clearBuildings();
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
      case 'die': SND.sfx(e.big ? 'collapse' : 'death', pan); break;
      case 'break': SND.sfx('wallbreak', pan); break;
      case 'trap': SND.sfx('wallhit', pan); break;
      case 'loot': SND.sfx('coin'); break;
      case 'drop': SND.sfx('star', pan); break;
      case 'heart': SND.sfx('alarm'); break;
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
