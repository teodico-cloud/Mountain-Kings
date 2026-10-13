/* ===================== L'HISTOIRE (lot A) : interface =====================
   Sukhoï la narratrice (sa bulle et son portrait), la mission « La Source du Mal » (entrée, bulles du donjon guidé, bilan),
   l'arrivée de Lilou, sa chambre (humeur, caprices, berceuse) et ses petits mots. Ce fichier ne fait que définir :
   p4_app et p4d_donjon appellent ces fonctions. */
/* Sukhoï : une chatte grise, la tache blanche sur la poitrine, une vieille cicatrice de guerre au-dessus de l'œil. */
const SUK_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 21 7 6l12 8M39 21l2-15-12 8" fill="#7d838b"/><path d="M10.5 18 9.6 9.5l6.4 4.4M37.5 18l.9-8.5-6.4 4.4" fill="#e9b7b9"/>'
  + '<ellipse cx="24" cy="25" rx="16" ry="14" fill="#8b9097"/><path d="M15 36c3 7 15 7 18 0-5 2-13 2-18 0z" fill="#f4f1ea"/>'
  + '<ellipse cx="17.5" cy="24" rx="3.2" ry="3.6" fill="#d6e36a"/><ellipse cx="30.5" cy="24" rx="3.2" ry="3.6" fill="#d6e36a"/>'
  + '<ellipse cx="17.5" cy="24.4" rx="1.1" ry="3" fill="#2a2a2a"/><ellipse cx="30.5" cy="24.4" rx="1.1" ry="3" fill="#2a2a2a"/>'
  + '<path d="M26.5 15.5 33 22" stroke="#5c5f64" stroke-width="1.4" stroke-linecap="round"/><path d="M22.4 29.2h3.2L24 31z" fill="#e58a95"/>'
  + '<path d="M24 31v1.6M24 32.6c-1.2 1.4-3 1.4-4 .3M24 32.6c1.2 1.4 3 1.4 4 .3" stroke="#4a4d52" stroke-width="1" fill="none" stroke-linecap="round"/>'
  + '<path d="M13 29.5 4.5 28M13 31.5 5 33M35 29.5l8.5-1.5M35 31.5l8 1.5" stroke="#e8e8e8" stroke-width=".8" stroke-linecap="round"/></svg>';
const sukFace = cls => `<span class="sukface${cls ? ' ' + cls : ''}">${SUK_SVG}</span>`;
const sukBubble = (txt, extra) => `<div class="sukbub">${sukFace()}<div><b>Sukhoï</b><p>${esc(txt)}</p>${extra || ''}</div></div>`;
/* Les visages de Lilou selon son humeur (très simples) */
const LILOU_FACE = { colere: ['#e98a7a', 'M17 31q7-5 14 0', 'M14 19l6 3M34 19l-6 3'], grognon: ['#f0b39a', 'M18 31q6-3 12 0', 'M15 20h5M28 20h5'], calme: ['#f3cdb6', 'M18 30h12', ''], contente: ['#f3cdb6', 'M17 28q7 5 14 0', ''], ravie: ['#f6c9b0', 'M16 27q8 8 16 0z', ''] };
function lilouFace(k) {
  const F = LILOU_FACE[k] || LILOU_FACE.calme;
  return `<span class="lilface" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="26" r="16" fill="${F[0]}"/><path d="M14 16c2-9 18-11 21-2-4-3-6-1-8-4-3 3-8 1-13 6z" fill="#f2d27a"/>`
    + `<circle cx="18" cy="24" r="2.2" fill="#3f6fd0"/><circle cx="30" cy="24" r="2.2" fill="#3f6fd0"/><path d="${F[1]}" stroke="#a5523f" stroke-width="2" fill="${k === 'ravie' ? '#a5523f' : 'none'}" stroke-linecap="round"/>`
    + (F[2] ? `<path d="${F[2]}" stroke="#7a5a3a" stroke-width="1.8" stroke-linecap="round"/>` : '') + `</svg></span>`;
}
/* Les répliques de Sukhoï */
const SUK = {
  hello: 'Une lueur maléfique monte de la vieille mine, et des cris terribles en sortent chaque nuit. On m’appelait Sukhoï la Terrible, avant la Grande Bataille contre le Monstre de Fer… Va voir ce que c’est. Je te suis. De loin.',
  start: 'La mine de la Source du Mal. Ça sent le gobelin mouillé. Suis mes conseils et tout ira bien (ou presque).',
  tuto: {
    move: 'Pose le pouce à gauche de l’écran et fais quelques pas. Doucement : il y a des toiles d’araignée partout.',
    fight: 'Un gobelin ! Approche-toi : ton héros frappe tout seul. Moi, je surveille. De loin.',
    roll: 'Le cercle rouge ! Il va frapper : ROULE ! (le bouton Roulade, ou la barre d’espace)',
    potion: 'Ta vie baisse ! Bois une potion, le flacon rouge à droite.',
    skill: 'Touche ta compétence, le gros bouton à droite. Elle se recharge après chaque usage.',
    chest: 'Un coffre ! Marche dessus pour l’ouvrir. Si c’est du poisson, c’est pour moi.',
    cradle: 'Il est vaincu… La lueur vient de ce berceau, au fond. Approche-toi. Doucement.',
  },
  ok: {
    move: 'Voilà. Tu marches. Je suis fière de toi.',
    fight: 'Pas mal, pour un débutant.',
    roll: 'Joli saut ! J’en faisais des pareils, du temps de la Grande Bataille contre le Monstre de Fer.',
    potion: 'Ça va mieux ? Ne prends pas l’habitude.',
    skill: 'Ça, c’est de la magie… ou presque.',
    chest: 'Pas de poisson ? Tant pis.',
  },
  saved: 'Debout ! On ne meurt pas le premier jour. Sukhoï l’interdit.',
  found: 'Par mes moustaches… la Source du Mal… c’est un bébé ?! Elle s’appelle Lilou (c’est brodé sur sa couverture). Bon. On la ramène au village.',
  arrive: 'Lilou a sa chambre près de la halle, et moi ma place près du berceau. Chaque jour, elle aura un caprice ; chaque semaine, un gros. Contente, les monstres tapent moins fort. En colère… je préfère ne pas y penser. Si elle pleure la nuit, c’est toi qui te lèves.',
  mood: {
    colere: ['Elle hurle. J’ai connu des trolls plus calmes.', 'Les gobelins l’entendent de la mine. Ils tapent plus fort, rien que pour se venger.'],
    grognon: ['Elle boude. Un caprice oublié, je parie.', 'Elle me tire la queue. C’est mauvais signe.'],
    calme: ['Elle observe tout, très sérieuse. Comme moi.', 'Elle mâchouille son orteil. Tout va bien.'],
    contente: ['Elle gazouille. Même moi, j’ai envie de ronronner.', 'Elle rit quand je fais semblant de dormir. Je ne fais pas semblant.'],
    ravie: ['Ravie ! Les monstres sentent qu’ils n’ont aucune chance.', 'Elle rit si fort que les gobelins en perdent leurs moyens.'],
  },
  pet: ['Rrrrrr… Là, derrière l’oreille. Oui. Là.', 'Doucement, c’est ma vieille blessure de guerre.', 'Je ne ronronne pas. C’est le vent.', 'Une caresse, c’est bien. Un poisson, c’est mieux.', 'Si tu me grattes, je garde le bébé. Marché conclu.', 'Le Monstre de Fer m’a renversée une fois. Une seule. Il ne recommencera pas.'],
};
/* Le mot de Lilou au bilan d'un donjon, selon son humeur (petit plus c) */
const LILOU_WORDS = { colere: 'OUINNN ! (Elle n’a pas oublié son caprice.)', grognon: 'Mmmh… (Elle te tourne le dos.)', calme: 'Areuh. (Elle te regarde rentrer, très sérieuse.)', contente: 'Areuh ! (Elle te tend les bras.)', ravie: 'Hihihi ! (Elle t’accueille avec un immense sourire.)' };
const lilouLine = v => { const L = v && v.lilou; if (!L) return ''; const m = lilouMood(L), list = SUK.mood[m.k]; return list[Math.floor((now() / 60000) % list.length)]; };
const lilouEffect = m => m.mul === 1 ? 'les monstres frappent normalement' : 'les monstres frappent ' + Math.round(Math.abs(1 - m.mul) * 100) + ' % ' + (m.mul < 1 ? 'moins fort' : 'plus fort');

/* ---------- la mission : entrée dans le menu Donjon ---------- */
function sourceEntryHTML() {
  if (!me || me.lilou) return '';
  return `<div class="item feature story">${sukBubble('La lueur maléfique de la vieille mine… Il faut aller voir. C’est court, et je te guide.')}
    <div class="row split"><b class="row">${djIco('star')}La Source du Mal</b><small class="note">mission · environ 5 min</small></div>
    <button class="btn primary" data-act="djGo" data-th="source" data-k="1">${djIco('sword')}Partir à la Source du Mal</button></div>`;
}

/* ---------- le donjon guidé : la bulle de Sukhoï en bas de l'écran ---------- */
function djTutoEvent(e) {
  if (!dj || dj.st.d.theme !== 'source') return;
  if (e.k === 'tuto') { dj.tuto = { s: e.s, t: performance.now() }; SND.sfx('tip'); }
  else if (e.k === 'tutoOk') { if (SUK.ok[e.s]) dj.tutoOk = { txt: SUK.ok[e.s], t: performance.now() }; if (dj.tuto && dj.tuto.s === e.s) dj.tuto = null; }
  else if (e.k === 'saved' && e.id === dj.hid) { dj.tutoOk = { txt: SUK.saved, t: performance.now() }; SND.sfx('power'); }
  djTutoRender();
}
function djTutoRender() {
  const el = document.getElementById('djTuto'); if (!el || !dj) return;
  const nowT = performance.now(), praise = dj.tutoOk && nowT - dj.tutoOk.t < 2600 ? dj.tutoOk.txt : '';
  const txt = praise || (dj.tuto ? SUK.tuto[dj.tuto.s] : dj.st.t < 6 ? SUK.start : '');
  if (el._t !== txt) { el._t = txt; el.innerHTML = txt ? sukBubble(txt) : ''; el.hidden = !txt; }
  /* le bouton dont parle Sukhoï clignote doucement */
  const want = dj.tuto && !praise ? { skill: '[data-djsk="0"]', potion: '[data-djpot]', roll: '[data-djroll]' }[dj.tuto.s] : null;
  for (const b of document.querySelectorAll('#djHud .djsk.hint')) if (!want || !b.matches(want)) b.classList.remove('hint');
  if (want) { const b = document.querySelector('#djHud ' + want); if (b) b.classList.add('hint'); }
}

/* ---------- l'arrivée de Lilou (fenêtre au retour de la mission) ---------- */
function lilouArriveHTML() {
  const ch = me && me.b.find(b => b.type === 'chambre');
  return `<p class="eyebrow">La Source du Mal</p><div class="lilhead">${lilouFace('contente')}<h2>Lilou arrive au village</h2></div>
    ${sukBubble(SUK.arrive)}
    <div class="row">${ch ? '<button class="btn primary grow" data-act="lilouSee">Voir sa chambre</button>' : ''}<button class="btn grow" data-act="closeModal">${ch ? 'Plus tard' : 'Compris'}</button></div>`;
}
/* ---------- la chambre de Lilou (menu) ---------- */
function capRow(v, big) {
  const L = v.lilou, cap = big ? L.w : L.d; if (!cap) return '';
  const C = (big ? BIG_CAPRICES : CAPRICES)[cap.k]; if (!C) return '';
  const c = capCost(v, cap.k, big), miss = missingTxt(v, c), t = now(), left = (big ? lilouNextWeek(L) : lilouNextDay(L)) - t;
  const blocked = big && C.need && !C.need(v);
  return `<div class="item${cap.ok ? '' : ' feature'}"><div class="head"><b>${big ? 'Gros caprice de la semaine' : 'Caprice du jour'} : ${esc(C.name)}</b><small>${cap.ok ? (big ? 'offert' : 'fait') + ' ✓' : 'encore ' + fmtDur(left)}</small></div>
    <p>${esc(C.txt)}</p>${big && !cap.ok ? '<p class="note">Toute la vallée fera la fête : +' + LILOU.party + ' de moral pendant un jour.</p>' : ''}
    ${cap.ok ? `<p class="note">${big ? 'Prochain gros caprice' : 'Prochain caprice'} dans ${fmtDur(left)}.</p>`
      : `<div class="foot"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn small${miss || blocked ? ' off' : ' primary'}" data-act="lilouCap" data-w="${big ? 1 : 0}">${big ? 'Offrir' : 'Fabriquer'}</button></div>${blocked ? '<p class="why">' + esc(C.needTxt) + '</p>' : ''}`}</div>`;
}
function sheetLilou() {
  const v = me, L = v.lilou;
  if (!L) return `<p class="note">Lilou n’est pas encore au village.</p>${sourceEntryHTML()}`;
  const m = lilouMood(L), ch = v.b.find(b => b.type === 'chambre');
  let h = `<div class="item feature lilmood">${lilouFace(m.k)}<div><b>Lilou est ${esc(m.name)}</b><p class="note">${cap1(lilouEffect(m))}, en donjon comme pendant les raids.</p>
    <div class="bar mood"><i style="width:${L.mood}%"></i></div></div></div>`;
  h += capRow(v, false) + capRow(v, true);
  h += `<div class="sec"><h4>Sukhoï</h4>${sukBubble(lilouLine(v), '<button class="btn small" data-act="sukPet">Gratouiller Sukhoï</button>')}</div>`;
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>Chaque jour, Lilou a un caprice à fabriquer avec les ressources du village ; chaque semaine, un gros caprice, plus cher, qui fait la fête dans toute la vallée.</li>
    <li>Un caprice satisfait la rend plus contente ; oublié, elle boude. Ravie, les monstres frappent 10 % moins fort ; en colère, 10 % plus fort.</li>
    <li>Ses caprices coûtent un peu plus cher quand le village grandit.</li></ul>
    ${ch ? `<button class="btn small" data-act="lilouMove" data-id="${ch.id}">Déplacer sa chambre</button>` : `<button class="btn small primary" data-act="place" data-type="chambre">Placer sa chambre</button>`}</div>`;
  return h;
}
/* La berceuse, une fois à chaque ouverture de la chambre (petit plus b) */
let lilouLull = 0;
function lilouOpened() { if (performance.now() - lilouLull > 20000) { lilouLull = performance.now(); SND.sfx('berceuse'); } }

/* ===================== L'HISTOIRE, lot B : la Couronne de la Montagne (interface) =====================
   L'objectif du moment en tête du menu Donjon, les scènes (une fois par téléphone), la chronique du village, le morceau annoncé au bilan. */
const CROWN_SRC_LABEL = ['Mine', 'Crypte', 'Portail', 'Profondeurs'];
const crownLetterHTML = txt => `<blockquote class="letter"><p>${esc(txt)}</p><cite>Le Roi Déchu, dernier Roi de la Montagne</cite></blockquote>`;
const SUK_CROWN = {
  goal: [
    'Le chef troll de la mine travaille pour le Roi Déchu, j’en mettrais ma queue à couper. Bats-le au niveau 3 ou plus : il porte le premier morceau.',
    'Le deuxième morceau dort dans la crypte des rois. Le roi squelette ne le lâchera pas sans se battre : niveau 4 ou plus.',
    'Le troisième morceau est chez le démon. Referme un portail démoniaque, ou passe par la faille de la vieille mine : son gardien le serre dans sa griffe.',
    'Le dernier morceau est tout au fond des Profondeurs. Termine l’étage 5, et la couronne sera à nous.',
  ],
  joyaux: 'Rallume les quatre joyaux, dans l’ordre que tu veux. Leurs gardiens sont plus forts à chaque cycle.',
  start: 'Le Roi Déchu… Je croyais cette vieille histoire enterrée. Autrefois, les Rois de la Montagne portaient une couronne qui commandait à toute la vallée. Le dernier a vendu son âme à un démon des Profondeurs, et la couronne s’est brisée en quatre morceaux. S’il les retrouve avant nous… Bon. On commence par la mine : ses gobelins travaillent pour lui.',
  p: [
    'Le bandeau de la couronne, sur le chef troll ! Et une lettre dans sa poche : « Ramenez-moi la Source. Et des couches. » Il est mal renseigné : on en manque nous-mêmes. Le deuxième morceau dort dans la crypte des rois, avec ses ancêtres.',
    'Le roi squelette, c’était son père. Il gardait le fleuron par honte de son fils ; avant de tomber en poussière, il a soufflé : « Protégez l’enfant. » Le troisième morceau est chez le démon, de l’autre côté des portails. Et maintenant, ses gobelins savent où dort Lilou : pendant les raids, la moitié d’entre eux visera sa chambre. Barricade-la.',
    'Le gardien serrait l’arche dans sa griffe. Le dernier morceau, la pierre de cœur, est tout au fond des Profondeurs, là où le Roi Déchu a son trône. Descends, termine l’étage 5. Moi, je garde Lilou.',
  ],
  crowned: 'Les quatre morceaux… La couronne est reconstituée ! Elle brille sur la halle, et toute la vallée le sait : vous êtes les nouveaux Rois de la Montagne. Lilou a applaudi. Enfin, elle a tapé sur son hochet, mais c’est pareil.',
  curse: 'Ses quatre joyaux se sont éteints et envolés vers les donjons. Il faudra les rallumer, et leurs gardiens seront plus forts. Ça ne s’arrêtera jamais, hein ? Tant mieux : je m’ennuyais.',
  ranks: [
    'Les quatre joyaux brillent de nouveau. La couronne gagne en éclat, et le Roi Déchu doit en manger sa barbe.',
    'Et un rang de plus ! La vallée n’a jamais eu de rois aussi têtus.',
    'À ce train-là, la couronne va finir par éblouir les gobelins. Tant mieux, ils viseront moins bien.',
    'La couronne brille si fort que Lilou ne veut plus s’endormir sans la regarder.',
  ],
  piece: ['Le bandeau de la couronne !', 'Le fleuron des rois !', 'L’arche de l’abîme !', 'La pierre de cœur ! La couronne est complète !'],
};
const CHAPTER_OF = k => 'Chapitre ' + (k + 1) + ' · ' + CROWN_CHAPTERS[k];
function crownGoalTxt(cy, k) {
  const n = crownNeed(cy, k);
  return k === 0 ? 'battre le chef troll de la mine au niveau ' + n + ' ou plus' : k === 1 ? 'battre le roi squelette de la crypte au niveau ' + n + ' ou plus'
    : k === 2 ? 'refermer un portail démoniaque (ou passer par la faille)' : 'terminer l’étage ' + n + ' des Profondeurs';
}
const crownCycleTxt = cy => 'mine ' + crownNeed(cy, 0) + ', crypte ' + crownNeed(cy, 1) + ', un portail, étage ' + crownNeed(cy, 3) + ' des Profondeurs';
const crownPips = C => `<div class="crownpips">${[0, 1, 2, 3].map(k => `<span class="pip${C.got & (1 << k) ? ' on' : ''}">${ico('crown', '')}<small>${CROWN_SRC_LABEL[k]}</small></span>`).join('')}</div>`;
/* La couronne posée sur la halle (rendu 3D) : « r<rang>g<trouvés> », rien tant qu'aucun morceau n'est trouvé */
const crownCode = C => (!C ? '' : C.rank ? 'r' + Math.min(C.rank, 9) + 'g' + C.got : crownBits(C.got) ? 'r0g' + C.got : '');
/* La faille vers l'abîme : le donjon du portail quand aucun portail n'est ouvert (pour le morceau du portail) */
const crownRift = () => !!me && crownCan(me, 'portail', 1, 0, true) >= 0;
/* Une ligne d'objectif, avec ses boutons (seul, à deux) quand c'est possible */
function crownGoalRow(hh, C, k) {
  const done = !!(C.got & (1 << k)), name = crownName(C.cy, k), n = crownNeed(C.cy, k), top = Math.max(1, hh.dj || 1);
  const pk = partnerId(me), ph = pk ? activeHero(me, pk) : null, on = pk && isOnline(pk);
  const go = (th, lvl, pi, label) => `<div class="row"><button class="btn small primary grow" data-act="djGo" data-th="${th}" data-k="${lvl}"${pi != null ? ' data-pi="' + pi + '"' : ''}>${djIco('sword')}${label}</button>`
    + (pk && ph ? `<button class="btn small grow${on ? '' : ' off'}" data-act="djInvite" data-th="${th}" data-k="${lvl}"${pi != null ? ' data-pi="' + pi + '"' : ''}${on ? '' : ' disabled'}>${djIco('shield')}À deux</button>` : '') + '</div>';
  let act = '';
  if (!done) {
    if (k === 0) act = top >= n ? go('mine', n, null, 'La mine, niveau ' + n) : `<p class="note">D’abord, gagner la mine au niveau ${n - 1}.</p>`;
    else if (k === 1) act = top >= n && top >= DJ_OPEN.crypte ? go('crypte', n, null, 'La crypte, niveau ' + n) : `<p class="note">D’abord, gagner la mine ou la crypte au niveau ${n - 1}.</p>`;
    else if (k === 2) { const ri = raidInfo(me, now()), open = ri.p.filter(p => !p.cl); act = open.length ? go('portail', raidLevel(me), open[0].i, 'Refermer le portail ' + RAID_OF[open[0].side]) : go('portail', raidLevel(me), -1, 'Passer par la faille'); }
    else act = top >= DJ_OPEN.prof ? go('prof', hh.lvl, null, 'Les Profondeurs') : `<p class="note">Les Profondeurs s’ouvrent après une victoire au niveau ${DJ_OPEN.prof - 1}.</p>`;
  }
  return `<div class="crowngoal${done ? ' done' : ''}"><div class="row split"><b class="row">${ico('crown', done ? 'c-gold' : 'muted')}${esc(cap1(name))}</b><small>${done ? (C.cy === 1 ? 'trouvé' : 'rallumé') + ' ✓' : esc(cap1(crownGoalTxt(C.cy, k)))}</small></div>${act}</div>`;
}
/* En tête du menu Donjon : le chapitre (1er cycle) ou les joyaux (cycles suivants) */
function crownEntryHTML(hh) {
  const C = me && me.crown; if (!C || !hh) return '';
  if (C.cy === 1) {
    const k = crownBits(C.got);
    return `<div class="item feature story crown"><div class="row split"><b class="row">${ico('crown', 'c-gold')}${esc(CHAPTER_OF(k))}</b><small class="note">la Couronne de la Montagne</small></div>
      ${crownPips(C)}${sukBubble(SUK_CROWN.goal[k])}${crownGoalRow(hh, C, k)}
      <button class="btn small" data-act="sheet" data-s="chron">${ico('scroll', '')}La chronique du village</button></div>`;
  }
  return `<div class="item feature story crown"><div class="row split"><b class="row">${ico('crown', 'c-gold')}Cycle ${C.cy} · Les joyaux de la couronne</b><span class="chip">rang ${C.rank}</span></div>
    ${crownPips(C)}<p class="note">${esc(SUK_CROWN.joyaux)}</p>${[0, 1, 2, 3].map(k => crownGoalRow(hh, C, k)).join('')}
    <button class="btn small" data-act="sheet" data-s="chron">${ico('scroll', '')}La chronique du village</button></div>`;
}
/* Au bilan d'un donjon : le morceau (ou le joyau) qu'il rapporte */
function crownWinHTML(r) {
  if (!me || !me.crown || !r) return '';
  const C = me.crown, k = crownCan(me, r.theme, r.lvl, r.deep || 0, r.win); if (k < 0) return '';
  return `<div class="item story crownwin"><b class="row">${ico('crown', 'c-gold')}${C.cy === 1 ? esc(SUK_CROWN.piece[k]) : esc(cap1(crownName(C.cy, k))) + ' se rallume !'}</b>
    <p class="note">${C.cy === 1 ? 'Un morceau de la Couronne de la Montagne (' + (crownBits(C.got) + 1) + ' sur 4).' : 'Un joyau de la couronne (' + (crownBits(C.got) + 1) + ' sur 4).'} Avec de l’or pour la bourse et un objet pour ton sac.</p></div>`;
}

/* ---------- les scènes : une fois par téléphone, quand l'histoire avance ---------- */
const crownSceneKey = C => !C ? '' : C.cy === 1 ? 'c1g' + crownBits(C.got) : 'c' + C.cy;
function crownSceneHTML(key) {
  const C = me && me.crown; if (!C) return '';
  const goal = txt => `<div class="item crowngoalbox"><b class="row">${djIco('star')}Objectif</b><p>${esc(txt)}</p></div>`;
  const btns = `<div class="row sceneact"><button class="btn grow" data-act="closeModal">Plus tard</button><button class="btn primary grow" data-act="crownGo">${djIco('sword')}Voir le menu Donjon</button></div>`;
  const chest = C.lc ? `<div class="item"><div class="row split"><b>Le coffre de la couronne</b><span class="chips2"><span class="chip plus">${ico('or')}+${fmtN(C.lc.g)}</span>${orbChip(C.lc.o)}</span></div>
    <p class="note">Et un objet ${C.lc.r % 3 === 0 ? 'légendaire' : 'épique'} dans le sac de chaque héros actif. La couronne au rang ${C.lc.r} : +${Math.min(10, C.lc.r)} de moral pour toujours.</p></div>` : '';
  if (key === 'c1g0') return `<p class="eyebrow">${esc(CHAPTER_OF(0))}</p><h2>Une lettre cachetée de noir</h2>${crownLetterHTML(CROWN_FIRST)}${sukBubble(SUK_CROWN.start)}${goal(cap1(crownGoalTxt(1, 0)) + '.')}${btns}`;
  if (key === 'c1g1' || key === 'c1g2' || key === 'c1g3') {
    const k = +key.slice(3), titles = ['Le bandeau de la couronne', 'Le père du Roi Déchu', 'L’arche de l’abîme'];
    return `<p class="eyebrow">${esc(CHAPTER_OF(k))}</p><h2>${titles[k - 1]}</h2>${crownPips(C)}${sukBubble(SUK_CROWN.p[k - 1])}${goal(cap1(crownGoalTxt(1, k)) + '.')}
      ${k === 2 ? '<p class="why">Dès maintenant, la moitié des gobelins des raids vise la chambre de Lilou : palissades, pièges ou poste de garde autour d’elle.</p>' : ''}${btns}`;
  }
  const n = +key.slice(1); if (!(n >= 2)) return '';
  if (n === 2) return `<p class="eyebrow">La Couronne de la Montagne</p><h2>Les Rois de la Montagne</h2>${sukBubble(SUK_CROWN.crowned)}${chest}${crownLetterHTML(CROWN_CURSES[0])}${sukBubble(SUK_CROWN.curse)}${goal('Cycle 2 : rallumer les quatre joyaux, dans l’ordre que tu veux (' + crownCycleTxt(2) + ').')}${btns}`;
  return `<p class="eyebrow">La Couronne de la Montagne · rang ${C.rank}</p><h2>La couronne brille plus fort</h2>${sukBubble(SUK_CROWN.ranks[(n - 3) % SUK_CROWN.ranks.length])}${chest}
    ${crownLetterHTML(CROWN_CURSES[(n - 2) % CROWN_CURSES.length])}${goal('Cycle ' + n + ' : ' + crownCycleTxt(n) + '.')}${btns}`;
}
/* Appelé par la boucle de l'interface : une nouvelle scène à montrer ? (rien en donjon, dans un menu ou une fenêtre) */
function crownSceneCheck() {
  if (!me || !me.crown || mode !== 'home' || modal || sheet || dj || rp || place) return;
  const key = crownSceneKey(me.crown), lk = 'mk2.crown.' + vid;
  if (!key || LS.get(lk) === key) return;
  LS.set(lk, key);
  modal = { kind: 'crown', key }; SND.sfx(key === 'c1g0' ? 'alarm' : 'star'); renderAll();
}

/* ---------- la chronique du village ---------- */
const CHRON_ICO = { found: ['house', 'c-tro'], join: ['link', 'c-tro'], hero: ['crown', 'c-tro'], lilou: ['heart', 'c-heart'], crown: ['crown', 'c-gold'], roi: ['scroll', 'c-gold'], hall: ['hammer', 'c-tro'], raid: ['star', 'c-tro'], win: ['s3', 'c-tro'], leg: ['star', 'c-gold'], deep: ['star', 'c-tro'] };
function sheetChron() {
  const v = me, list = v.chron || [];
  if (!list.length) return '<p class="note">La chronique est encore vierge.</p>';
  let h = `<p class="note">Les grands moments de ${esc(v.name)}, écrits au fil des jours${v.crown && v.crown.rank ? ' par ses Rois de la Montagne' : ''}.</p><div class="chron">`, day = -1;
  for (const [t, k, m] of list) {
    const d = Math.floor((t - v.born) / DAY) + 1;
    if (d !== day) { day = d; h += `<h5>Jour ${d} · ${SEASONS[seasonIdx(v, t)].name.toLowerCase()}</h5>`; }
    const I = CHRON_ICO[k] || ['star', 'c-tro'];
    h += `<p class="ce ck-${esc(k)}">${ico(I[0], I[1])}<span>${esc(m)}</span></p>`;
  }
  return h + '</div>';
}

const ACT_STORY = {
  lilouCap: b => {
    const big = b.dataset.w === '1', r = act({ type: 'lilouCap', w: big ? 1 : 0 });   // en cas de refus, act dit pourquoi (ressources, taverne…)
    if (!r) return;
    SND.sfx('giggle');
    toast(big ? 'Lilou est aux anges ! Toute la vallée fait la fête.' : 'Lilou gazouille de joie' + (r.up ? ' : elle est maintenant ' + LILOU_MOODS.find(m => m.k === r.mood).name + ' !' : '.'));
  },
  sukPet: () => { SND.sfx('purr'); toast('Sukhoï : « ' + SUK.pet[Math.floor(Math.random() * SUK.pet.length)] + ' »'); },
  lilouSee: () => { modal = null; openSheet('lilou'); },
  lilouMove: b => { closeSheet(true); startMove(+b.dataset.id); },
  sukGo: () => { modal = null; renderAll(); djBegin(1, 'source', 0); },
  crownGo: () => { modal = null; openSheet('donjon'); },
};
