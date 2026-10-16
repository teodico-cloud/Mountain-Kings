/* ===================== L'HISTOIRE (lot A) : interface =====================
   Sukhoï la narratrice (sa bulle et son portrait), la mission « La Source du Mal » (entrée, bulles du donjon guidé, bilan),
   l'arrivée de Lilou, sa chambre (humeur, caprices, berceuse) et ses petits mots. Ce fichier ne fait que définir :
   p4_app et p4d_donjon appellent ces fonctions. */
/* Sukhoï : une chatte grise, la tache blanche sur la poitrine, une vieille cicatrice de guerre au-dessus de l'œil. */
/* Sukhoï, peinte : chatte grise, tache blanche en haut de la poitrine, yeux jaune-vert, une oreille entaillée
   et une cicatrice sur l'œil (souvenirs de la Grande Bataille contre le Monstre de Fer). */
const SUK_SVG = (() => {
  const O = '#2a1d16', P = (d, f, w) => `<path d="${d}" fill="${f}"${w ? ` stroke="${O}" stroke-width="${w}" stroke-linejoin="round"` : ''}/>`;
  const L = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const eye = m => { const X = x => (m ? 48 - x : x).toFixed(1), path = pts => pts.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => X(+x) + ' ' + y);
    return P(path('M13.4,23.8C14.6,21.8 16.4,20.8 18.4,20.8S21.8,21.8 22.4,23.4C21.6,25.6 19.8,27 17.6,27 15.6,27 14.2,25.8 13.4,23.8Z'), '#cfdc5a', 1)
      + P(path('M14.4,23.4C15.6,22 17,21.4 18.4,21.4S21,22 21.6,23.2C20,22.6 18.2,22.6 16.4,22.9Z'), '#e9f19a')
      + P(path('M18.2,21.5C17.5,22.8 17.5,25.4 18.2,26.6 18.9,25.4 18.9,22.8 18.2,21.5Z'), '#1d1a17')
      + `<circle cx="${X(16.9)}" cy="22.9" r=".9" fill="#fff"/>`
      + P(path('M13.1,23.7C14.5,21.5 16.4,20.6 18.4,20.6S21.9,21.6 22.7,23.1L22.4,23.8C21,22.7 19.6,22.2 18.2,22.2 16.4,22.2 14.8,22.8 13.1,23.7Z'), '#6b7179');
  };
  return '<svg viewBox="-3 -3 54 54" aria-hidden="true" focusable="false">'
    + P('M9.6 52c.6-7.6 6-13.4 14.4-13.4S37.8 44.4 38.4 52z', '#7a8088', 1.1)
    + P('M19 40.6c1.5 3 3.2 4.8 5 4.8s3.5-1.8 5-4.8c-1.6.5-3.3.7-5 .7s-3.4-.2-5-.7z', '#f4f0e8')
    + P('M8.6 22 8 15l2.3-1.5L7.7 12 7.3 6.9c-.1-1 1-1.6 1.8-1L20.4 14z', '#858b93', 1.1) + P('M10.7 18.4 10 13.6l.9-.6-1.2-1.4-.1-1.8 6.9 5.1z', '#e7aab0')
    + P('M39.4 22l1.3-15.1c.1-1-1-1.6-1.8-1L27.6 14z', '#858b93', 1.1) + P('M37.4 18.4l.8-8.8-7 5.2z', '#e7aab0') + P('M38.2 9.6l-.8 8.8-2.2-2.3z', '#c98d94')
    + P('M24 11c-9.6 0-17 6.4-17 15.2 0 3.6 1.2 6.6 3.2 9l-2.4 1.6 3.8.2c3.2 2.8 7.6 4.4 12.4 4.4s9.2-1.6 12.4-4.4l3.8-.2-2.4-1.6c2-2.4 3.2-5.4 3.2-9C41 17.4 33.6 11 24 11z', '#8d939b')
    + P('M32.4 15.4c4.2 2.4 7 6.2 7 10.8 0 3.4-1.2 6.2-3 8.4l1.6 1.2-3.2.2c-3 2.6-7.2 4-11.6 4 6.6-2.4 11.2-8.6 11.2-15.6 0-3.6-.8-6.6-2-9z', '#757b83')
    + '<ellipse cx="20" cy="16.8" rx="6" ry="2.6" fill="#b3b9c0" opacity=".85"/>'
    + L('M24 12.4v4.4M20.4 13.2l.9 3.6M27.6 13.2l-.9 3.6', '#5d636b', 1.4)
    + P('M24 11c-9.6 0-17 6.4-17 15.2 0 3.6 1.2 6.6 3.2 9l-2.4 1.6 3.8.2c3.2 2.8 7.6 4.4 12.4 4.4s9.2-1.6 12.4-4.4l3.8-.2-2.4-1.6c2-2.4 3.2-5.4 3.2-9C41 17.4 33.6 11 24 11z', 'none', 1.2)
    + eye(false) + eye(true)
    + L('M27 15.6l7.6 10.6', '#c98587', 1.4) + L('M29.3 18.2l1.5-1M31.1 20.7l1.5-1M32.9 23.2l1.5-1', '#c98587', .9)
    + P('M24 27.4c-2.4 0-4.6 1-5.8 2.8-1.4 2-.8 4.8 1.6 5.8 1.6.7 3 .2 4.2-.6 1.2.8 2.6 1.3 4.2.6 2.4-1 3-3.8 1.6-5.8-1.2-1.8-3.4-2.8-5.8-2.8z', '#f2eee6')
    + P('M22.2 28.4h3.6c.4 0 .6.4.4.7L24.4 31c-.2.3-.6.3-.8 0l-1.8-1.9c-.2-.3 0-.7.4-.7z', '#e58a95', .8)
    + L('M24 31.2v1.4M24 32.6c-.9 1.2-2.6 1.4-3.6.4M24 32.6c.9 1.2 2.6 1.4 3.6.4', O, .9)
    + L('M17.2 31.2 5.8 29.4M17.4 33 6.2 34.8M30.8 31.2l11.4-1.8M30.6 33l11.2 1.8', '#f6f3ec', .8)
    + '</svg>';
})();
const sukFace = cls => `<span class="sukface${cls ? ' ' + cls : ''}">${SUK_SVG}</span>`;
const sukBubble = (txt, extra) => `<div class="sukbub">${sukFace()}<div><b>Sukhoï</b><p>${esc(txt)}</p>${extra || ''}</div></div>`;
/* Lilou, peinte : bébé blond aux yeux bleus ; le visage change avec son humeur */
const LILOU_FACE = {
  colere: { skin: '#f6bcaa', mouth: ['M19.6 36.6c2.6-2.4 6.2-2.4 8.8 0', 1.7], brow: 'M14.6 21.4l5.4 2M33.4 21.4 28 23.4', tear: 1 },
  grognon: { skin: '#f6cbb4', mouth: ['M20.6 36.2c2.2-1.3 4.6-1.3 6.8 0', 1.5], brow: 'M15 22.6h4.8M28.2 22.6H33' },
  calme: { skin: '#f7d5bf', mouth: ['M21.4 35.6h5.2', 1.5], brow: 'M15.4 21.6c1.4-.8 3-.9 4.4-.3M32.6 21.6c-1.4-.8-3-.9-4.4-.3' },
  contente: { skin: '#f7d5bf', mouth: ['M19.6 34.4c2.4 2.8 6.4 2.8 8.8 0', 1.7], brow: 'M15.4 21.2c1.4-.9 3-1 4.4-.4M32.6 21.2c-1.4-.9-3-1-4.4-.4' },
  ravie: { skin: '#f8d2b9', open: 1, brow: 'M15.4 20.8c1.4-.9 3-1 4.4-.4M32.6 20.8c-1.4-.9-3-1-4.4-.4', happy: 1 },
};
function lilouFace(k) {
  const F = LILOU_FACE[k] || LILOU_FACE.calme, O = '#3b2414';
  const P = (d, f, w) => `<path d="${d}" fill="${f}"${w ? ` stroke="${O}" stroke-width="${w}" stroke-linejoin="round"` : ''}/>`;
  const L = (d, c, w) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const eyeO = x => `<ellipse cx="${x}" cy="26.2" rx="2.9" ry="3.3" fill="#2f5fbf" stroke="${O}" stroke-width=".9"/><ellipse cx="${x}" cy="26.8" rx="1.9" ry="2.2" fill="#5a90e6"/><circle cx="${x}" cy="26.6" r="1.1" fill="#1a1410"/><circle cx="${x - 1}" cy="25.1" r=".95" fill="#fff"/><circle cx="${x + .9}" cy="27.6" r=".45" fill="#fff"/>`;
  return `<span class="lilface" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false">`
    + `<circle cx="9.6" cy="27.4" r="3.2" fill="${F.skin}" stroke="${O}" stroke-width="1.1"/><circle cx="38.4" cy="27.4" r="3.2" fill="${F.skin}" stroke="${O}" stroke-width="1.1"/>`
    + `<circle cx="24" cy="27" r="15.4" fill="${F.skin}"/>`
    + P('M33 15.8c3.6 2.8 5.8 6.8 5.8 11.2 0 8.4-6.6 15.2-14.8 15.2-4.4 0-8.2-1.8-11-4.8 2.6 1.4 5.4 2.2 8.4 2.2 8.4 0 15-6.8 15-15.2 0-3.2-1.2-6.2-3.4-8.6z', '#e9b597')
    + `<circle cx="24" cy="27" r="15.4" fill="none" stroke="${O}" stroke-width="1.2"/>`
    + `<ellipse cx="15.4" cy="31.8" rx="3.2" ry="2.2" fill="#f29a95" opacity=".6"/><ellipse cx="32.6" cy="31.8" rx="3.2" ry="2.2" fill="#f29a95" opacity=".6"/>`
    + P('M10.4 23c.2-8 6.2-13.6 13.6-13.6S37.4 15 37.6 23c-1.4-2.6-3.6-4.4-6.2-5 .5 1 .7 2 .6 3.2-2-2.6-5-3.8-8-3.6-3 .2-5.6 1.6-7.2 3.6.1-1.2.5-2.4 1.1-3.2-2.8.8-5.2 2.6-7.5 5z', '#f2d27a', 1)
    + P('M14.6 17.4c2-3.4 5.4-5.4 9.4-5.4 1.4 0 2.8.2 4 .8-4.6-.4-9 1.2-12.4 5.2z', '#fbe7a6')
    + L('M23.4 9.8c-.9-2.8.7-5 3-5 1.9 0 3 1.8 2.2 3.2-.7 1.1-2.3 1-2.6-.2', '#d9ad4a', 1.5)
    + L(F.brow, '#c9974a', 1.3)
    + (F.happy ? L('M15.2 26.8c1.6-2.6 4.2-2.6 5.8 0M27 26.8c1.6-2.6 4.2-2.6 5.8 0', O, 1.7) : eyeO(18.2) + eyeO(29.8))
    + L('M23.2 30.6c.5.4 1.1.4 1.6 0', '#d48f78', .9)
    + (F.open ? P('M19 33.6c1.2 4.6 8.8 4.6 10 0z', '#9a3f32', 1) + P('M21.6 36.6c1.4-1.2 3.4-1.2 4.8 0-1.4.9-3.4.9-4.8 0z', '#f08a8a') : L(F.mouth[0], '#9a3f32', F.mouth[1]))
    + (F.tear ? '<path d="M13.8 29.4c-.8 1.2-1.2 2-1.2 2.6a1.2 1.2 0 0 0 2.4 0c0-.6-.4-1.4-1.2-2.6z" fill="#8fd0f2" stroke="#3b6f9a" stroke-width=".6"/>' : '')
    + '</svg></span>';
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

/* ===================== LE PROLOGUE : pour qui n'a pas encore de village =====================
   Une courte introduction racontée par Sukhoï (qu'on peut passer), la création du héros, puis « La Source du Mal » avec ce héros,
   avant même que le village existe ; ensuite seulement, on nomme le village (ou on rejoint celui de sa partenaire).
   Tant que le village n'existe pas, le héros et la réussite du prologue sont gardés sur le téléphone : mk2.pro.<uid> = { h, won, xp }. */
const proKey = () => 'mk2.pro.' + uid;
const proGet = () => LS.get(proKey());
const proDone = () => { const P = proGet(); return !!(P && P.h && P.won); };
/* Les essais navigateur gardent l'ancien chemin (fonder, puis le héros), sauf avec ?pro=1 */
const PRO_ON = !window.MK_TEST || /[?&]pro=1/.test(location.search);
let introStep = 0, proKind = 'found';
const INTRO = [
  { e: 'Mountain Kings', t: 'Il était une fois…', p: 'Il y a bien longtemps, les Rois de la Montagne régnaient sur cette vallée. Leur couronne commandait aux pierres, aux rivières, et même aux gobelins (enfin, presque).',
    s: 'Moi, c’est Sukhoï. On m’appelait Sukhoï la Terrible, avant la Grande Bataille contre le Monstre de Fer. Laisse-moi te raconter.' },
  { e: 'Mountain Kings', t: 'Le pacte', p: 'Puis le dernier roi a voulu plus. Il a fait un pacte avec un démon des Profondeurs : la couronne s’est brisée, le royaume s’est éteint, et la vallée est tombée dans l’oubli.',
    s: 'Une bien triste histoire. Et les gobelins la racontent très mal.' },
  { e: 'Mountain Kings', t: 'La lueur', p: 'Aujourd’hui, une lueur maléfique monte de la vieille mine, et des cris terribles en sortent chaque nuit. Il faut quelqu’un pour aller voir.',
    s: 'Toi, peut-être ? Je viens avec toi. De loin.' },
];
function introHTML() {
  const I = INTRO[Math.max(0, Math.min(INTRO.length - 1, introStep))], last = introStep >= INTRO.length - 1;
  const join = proKind === 'join' && joinInfo ? `<p class="note">${esc(joinInfo.by)} t’attend au village de ${esc(joinInfo.name)}. Mais d’abord, un petit détour par la mine.</p>` : '';
  return `<p class="eyebrow">${esc(I.e)}</p><h2>${esc(I.t)}</h2><p class="tale">${esc(I.p)}</p>${sukBubble(I.s)}${last ? join : ''}
    <div class="row introdots">${INTRO.map((x, i) => `<i class="${i === introStep ? 'on' : ''}"></i>`).join('')}</div>
    <div class="row">${last ? '' : '<button class="btn grow" data-act="introSkip">Passer</button>'}<button class="btn primary grow" data-act="introNext">${last ? 'Créer mon héros' : 'Suite'}</button></div>`;
}
/* Sans village : le prologue (ou, déjà fait, le nom du village / l'invitation) */
function proStart(kind) {
  proKind = kind; introStep = 0;
  const P = proGet();
  if (!PRO_ON) { setMode(kind === 'join' ? 'join' : 'gate'); return; }
  if (P && P.h && (P.won || P.skip)) { setMode(kind === 'join' ? 'join' : 'gate'); return; }
  setMode(P && P.h ? 'prohero' : 'intro');
}
/* Le héros du prologue entre dans la mine (il n'existe encore que sur ce téléphone) */
function proBegin() {
  const P = proGet(); if (!P || !P.h) { setMode('prohero'); return; }
  if (!gl) { LS.set(proKey(), Object.assign(P, { skip: 1 })); setMode(proKind === 'join' ? 'join' : 'gate'); return; }   // sans 3D, pas de donjon : on passe au village
  const hh = { id: 'hpro', n: 1, own: uid, name: P.h.name, race: P.h.race, cls: P.h.cls, sex: P.h.sex, col: P.h.col, lvl: 1, xp: 0, sp: 0, sk: {}, spec: null, at: null, dj: 1, eq: {} };
  const seed = hash((Math.floor(now()) ^ hashStr(uid + 'prologue')) >>> 0) || 1, d = genDungeon(seed, 1, 'source');
  djRun(djStart(d, [hh], { seed }), 1, seed, hh.id, null);
  if (dj) dj.pro = { kind: proKind };
}
/* Retour du prologue (bouton du bilan) : gagné, on nomme le village (ou on rejoint) ; enfui, on recommence */
function proBack(r) {
  const P = proGet() || {}, kind = dj.pro.kind;
  if (r.win) LS.set(proKey(), Object.assign(P, { won: 1, xp: r.xp | 0 }));
  djLeave();
  if (!r.win) { setMode('prohero'); toast('Sukhoï : « On réessaie ? Je suis restée cachée derrière toi. »'); return; }
  setMode(kind === 'join' ? 'join' : 'gate');
}
/* Le village existe (fondé, ou rejoint) : le héros du prologue y entre, avec son expérience (et Lilou, si c'est la fondation) */
function proApplyTo(v, w) {
  const P = proGet(); if (!P || !P.h) return null;
  const r = applyV(v, { type: 'hero', name: P.h.name, race: P.h.race, cls: P.h.cls, sex: P.h.sex, col: P.h.col }, w);
  if (r.ok && P.won) applyV(v, { type: 'djEnd', hid: r.id, lvl: 1, win: true, xp: P.xp | 0, theme: 'source' }, w);
  return r.ok ? r.id : null;
}
function proJoined() {
  const P = proGet(); if (!P || !P.h) return false;
  const r = act({ type: 'hero', name: P.h.name, race: P.h.race, cls: P.h.cls, sex: P.h.sex, col: P.h.col }, { quiet: true }); if (!r) return false;
  if (P.won) act({ type: 'djEnd', hid: r.id, lvl: 1, win: true, xp: P.xp | 0, theme: 'source' }, { quiet: true });
  try { localStorage.removeItem(proKey()); } catch (e) { /* rien */ }
  return true;
}
const PRO_TXT = {
  found: 'Lilou a besoin d’un toit, et toi d’un village. Donne-lui un nom : ce sera le vôtre, à toi et à ta partenaire.',
  join: (by, name) => 'Lilou est sauvée. Allons rejoindre ' + by + ' au village de ' + name + ' : on nous y attend.',
  foundJoin: (by, name) => 'Par mes moustaches… un bébé ?! Mais… c’est Lilou ! ' + by + ' m’avait prévenue : elle s’est encore sauvée. Bon. On la ramène au village de ' + name + '.',
  welcomeJoin: name => 'Bienvenue à ' + name + ' ! Lilou a retrouvé sa chambre, près de la halle. Moi, je retourne dormir près du berceau. Le village est à vous deux, maintenant.',
};

const ACT_STORY = {
  introNext: () => { if (introStep < INTRO.length - 1) { introStep++; renderAll(); } else setMode('prohero'); },
  introSkip: () => setMode('prohero'),
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
