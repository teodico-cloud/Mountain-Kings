/* ===================== DONJONS : interface (entrée, joystick, compétences, bilan) =====================
   En solo, le combat tourne sur le téléphone (20 pas par seconde) ; à deux, sur celui de l'hôte (l'invitée affiche et envoie ses commandes).
   Les Profondeurs : un étage après l'autre, avec à chaque fin d'étage le choix de descendre ou de remonter.
   Le bilan est enregistré au retour au village. Ce fichier ne fait que définir des fonctions : l'application (p4_app) les appelle. */
let dj = null;
/* icônes du donjon : DJ_IC (p4i_icones.js) */
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
  if (dj.pro) { proBack(r); return; }                 // le prologue : pas encore de village, on va le fonder (ou le rejoindre)
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
  return `<p class="eyebrow">${where}${duo ? ' · à deux' : ''}</p><h2>${story ? 'La Source du Mal… ?!' : title}</h2>${story ? sukBubble(dj.pro && dj.pro.kind === 'join' && joinInfo ? PRO_TXT.foundJoin(joinInfo.by, joinInfo.name) : SUK.found) : '<p>' + esc(lead) + '</p>'}${word}${crownWinHTML(r)}
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
