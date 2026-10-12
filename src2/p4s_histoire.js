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
};
