/* ===================== CONSEILS AU BON MOMENT =====================
   Une petite carte en bas de l'écran (à la place d'un panneau, quand rien n'est sélectionné), une seule fois par conseil
   et par téléphone (mémoire locale « mk2.tips »). Un conseil à la fois, jamais pendant un donjon, une fenêtre ou un menu.
   On peut les couper ou les faire revenir (menu Village, Affichage). Ce fichier ne fait que définir : p4_app appelle
   tipCheck() à chaque seconde et tipHTML() dans le bas de l'écran. */
const TIP_GAP = 25000;                                      // au moins 25 s entre deux conseils
const tipStart = Date.now();
let tipCur = null, tipNext = tipStart + 12000;
/* Dans les essais du navigateur, les conseils sont coupés (sauf si l'essai les rallume) : ils cacheraient des boutons. */
const tipOn = () => { const o = LS.get('mk2.tipsOff'); return o == null ? !window.MK_TEST : o !== 1; };
const tipSeen = () => { const s = LS.get('mk2.tips'); return Array.isArray(s) ? s : []; };
function tipMark(id) { const s = tipSeen(); if (!s.includes(id)) { s.push(id); LS.set('mk2.tips', s.slice(-80)); } }
const tipHero = v => activeHero(v, uid);
const tipBag = v => (v.bag && v.bag[uid] && v.bag[uid].it) || {};
const tipAge = v => (v.t || 0) - (v.born || 0);
/* Dans l'ordre : d'abord l'urgent, puis ce qu'il y a à faire, puis les découvertes. go = menu ouvert par le bouton. */
const TIPS = [
  { id: 'source', ic: 'star', go: 'donjon', btn: 'Donjon', when: v => !v.lilou && !!tipHero(v) && Date.now() - tipStart > 20000,
    txt: 'Une lueur maléfique monte de la vieille mine… Allons voir ça : menu Donjon, « La Source du Mal ». C’est court, et je te guide.' },
  { id: 'faim', ic: 'pain', go: 'build', btn: 'Construire', when: v => v.vil.length > 0 && ((v.hunger || 0) > 0 || foodOf(v) < 1),
    txt: 'Le village a faim ! Et un village qui a faim regarde le chat d’un drôle d’air. Champs, chasse, moulin, boulangerie : au travail.' },
  { id: 'portail', ic: 'flame', go: 'defense', btn: 'Défense', when: v => raidInfo(v, now()).p.some(p => !p.cl),
    txt: 'Ça sent le soufre : un portail démoniaque s’ouvre au bord de la vallée ! Une fois chargé, des gobelins passeront dès que personne n’aura joué depuis 2 heures. Prépare tes défenses, ou va le refermer avec ton héros.' },
  { id: 'ruines', ic: 'shield', go: 'defense', btn: 'Défense', when: v => v.b.some(b => isDef(b) && repairCostOf(b)),
    txt: 'Des défenses sont en miettes. Répare-les toutes d’un coup dans le menu Défense, les ruines d’abord.' },
  { id: 'lilouBoude', ic: 'heart', go: 'lilou', btn: 'Sa chambre', when: v => !!v.lilou && lilouMood(v.lilou).mul > 1,
    txt: 'Lilou boude… Un caprice oublié, je parie. Et quand elle boude, les monstres frappent plus fort. Passe dans sa chambre.' },
  { id: 'leger', ic: 'star', go: 'village', btn: 'Réglages', when: () => gl && !gfxLight() && Date.now() - tipStart > 30000 && V3.fps() < 18,
    txt: 'Le jeu rame sur ce téléphone ? Essaie les graphismes légers (menu Village, Affichage) : moins joli, sans ombres, mais bien plus fluide. Comme moi après la sieste.' },
  { id: 'points', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.sp > 0; },
    txt: 'Ton héros a un point de compétence à dépenser (menu Héros, bouton +1). À ta place, je ne le garderais pas sous le coussin.' },
  { id: 'caprice', ic: 'heart', go: 'lilou', btn: 'Sa chambre', when: v => !!(v.lilou && v.lilou.d && !v.lilou.d.ok),
    txt: 'Lilou a un caprice aujourd’hui. On le fabrique dans sa chambre, avec les ressources du village. Contente, les monstres frappent moins fort.' },
  { id: 'chambreRaid', ic: 'shield', go: 'defense', btn: 'Défense', when: v => crownRaidOn(v),
    txt: 'Les gobelins savent où dort Lilou : pendant les raids, la moitié d’entre eux visera sa chambre. Une palissade autour, un piège sur le chemin ou un poste de garde à côté, et ils y réfléchiront à deux fois.' },
  { id: 'faille', ic: 'flame', go: 'donjon', btn: 'Donjon', when: v => crownCan(v, 'portail', 1, 0, true) >= 0 && !raidInfo(v, now()).p.some(p => !p.cl),
    txt: 'Pas de portail démoniaque ouvert ? Il y a une faille vers l’abîme au fond de la vieille mine : menu Donjon, la couronne. Le gardien du portail t’y attend.' },
  { id: 'recrue', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => caserneLvl(v) > 0 && !solList(v).length,
    txt: 'La caserne est prête : recrute tes premiers soldats contre de l’or. Fantassins et lanciers devant, archers et mages derrière. Moi, je garde le coussin.' },
  { id: 'poste', ic: 'flag', go: 'build', btn: 'Construire', when: v => solList(v).length > 0 && !postsOf(v).length,
    txt: 'Tes soldats attendent un poste de garde (Construire, rubrique Défense) : pendant un raid, ils défendent le cercle autour de lui.' },
  { id: 'sansposte', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => postsOf(v).length > 0 && solList(v).some(s => !s.post),
    txt: 'Des soldats se tournent les pouces, sans poste : à la caserne, « Répartir » les place tous d’un coup.' },
  { id: 'promo', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => solList(v).some(solCanPromote),
    txt: 'Un soldat a assez d’expérience pour monter de niveau : promeus-le à la caserne. Il frappera plus fort (et il sera insupportable de fierté).' },
  { id: 'mieux', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => { const h = tipHero(v); return !!h && Object.values(tipBag(v)).some(it => compareItem(h, it) === 1); },
    txt: 'Un objet de ton sac est meilleur que ce que porte ton héros (flèche verte ▲). Équipe-le, voyons !' },
  { id: 'sac', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => Object.keys(tipBag(v)).length >= bagMax(v) - 3,
    txt: 'Ton sac déborde ! Vends ou fonds ce qui ne sert plus : quand il est plein, les nouveaux objets sont vendus d’office.' },
  { id: 'plein', ic: 'bois', go: 'build', btn: 'Construire', when: v => ['bois', 'pierre'].some(k => (v.r[k] || 0) >= capOf(v) - 1),
    txt: 'Les réserves débordent : ce qui est produit en plus est perdu. Il faut un entrepôt, ou en agrandir un.' },
  { id: 'oisifs', ic: 'people', go: 'people', btn: 'Villageois', when: v => tipAge(v) > 20 * 60000 && v.vil.some(p => p.job == null),
    txt: 'Un villageois se tourne les pouces. Touche-le (ou ouvre le menu Villageois) pour lui donner un métier.' },
  { id: 'donjon1', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!v.lilou && !!h && !(h.dj > 1) && (h.wins | 0) === 0 && Date.now() - tipStart > 90000; },
    txt: 'La mine des gobelins t’attend (menu Donjon) : chaque victoire ouvre le niveau suivant. Ton héros attaque tout seul, toi tu le guides.' },
  { id: 'defense', ic: 'shield', go: 'defense', btn: 'Défense', when: v => !(v.raid && v.raid.n) && tipAge(v) > 36 * 3600000,
    txt: 'À partir du 3e jour, des gobelins peuvent attaquer pendant ton absence. Palissades, portes, tours et pièges : tout est dans le menu Défense.' },
  { id: 'forge', ic: 's_anvil', go: 'forge', btn: 'La forge', when: v => forgeLvlOf(v) > 0,
    txt: 'La forge est prête : fabrique de l’équipement, améliore-le jusqu’à +5, sertis des pierres, ou fonds ce qui ne sert plus pour récupérer du fer.' },
  { id: 'marchand', ic: 'or', go: 'merch', btn: 'Voir', when: v => merchHere(v, now()),
    txt: 'Le marchand ambulant est sur la place jusqu’à demain, avec des objets à vendre contre de l’or. Il sent le poisson : je l’aime bien.' },
  { id: 'crypte', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.crypte; },
    txt: 'La crypte des rois est ouverte : squelettes, spectres, nécromants qui relèvent les morts, et le roi squelette au fond. Brrr.' },
  { id: 'prof', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.prof; },
    txt: 'Les Profondeurs sont ouvertes : des étages sans fin, de plus en plus durs. À chaque étage, tu choisis : descendre, ou remonter avec tout le butin.' },
  { id: 'familier', ic: 's_paw', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= PET_LVL && !h.pet; },
    txt: 'Ton héros peut adopter un familier (menu Héros) : loup, faucon, sanglier ou chouette. Pas de chat ? Je suis déjà prise.' },
  { id: 'spec', ic: 'star', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= SPEC_LVL && h.spec == null; },
    txt: 'Niveau 10 ! Choisis la spécialisation de ton héros, une voie sur deux, pour de bon (menu Héros).' },
  { id: 'heros2', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const n = heroesOf(v, uid).length; return n > 0 && n < heroSlots(v); },
    txt: 'La taverne peut loger un héros de plus : recrute-le dans le menu Héros. Pendant que l’un part en donjon, les autres travaillent au village.' },
  { id: 'automne', ic: 's2', go: 'stock', btn: 'Réserves', when: v => seasonIdx(v, now()) === 2,
    txt: 'L’automne est là : dans 2 jours, l’hiver arrêtera les champs. Faites des réserves de pain et de viande.' },
  { id: 'hiver', ic: 's3', when: v => seasonIdx(v, now()) === 3,
    txt: 'L’hiver. Les champs dorment, la chasse rapporte moins, et le village vit sur ses réserves. Moi, je dors aussi.' },
  { id: 'inviter', ic: 'link', go: 'village', btn: 'Inviter', when: v => !partnerId(v) && tipAge(v) > 24 * 3600000,
    txt: 'Envie de jouer à deux ? Envoie le lien d’invitation (menu Village) : ta partenaire arrivera dans ton village, avec tout ce que tu as construit.' },
  { id: 'chronique', ic: 'scroll', go: 'chron', btn: 'La lire', when: v => (v.chron || []).length >= 8,
    txt: 'Le village a sa chronique : tous vos grands moments y sont écrits (menu Village). J’y suis citée au moins trois fois. Au moins.' },
];
function tipTest(T) { try { return !!T.when(me); } catch (e) { return false; } }
function tipClose(seen) { if (tipCur && seen) tipMark(tipCur.id); tipCur = null; tipNext = Date.now() + TIP_GAP; }
/* Appelé à chaque seconde. */
function tipCheck() {
  if (!me || !tipOn()) { tipCur = null; return; }
  if (mode !== 'home' || modal || place || dj) { tipNext = Math.max(tipNext, Date.now() + 6000); return; }
  if (tipCur) { if (!tipTest(tipCur)) { tipCur = null; tipNext = Date.now() + 8000; } return; }   // plus d'actualité : on le garde pour plus tard
  if (sheet || Date.now() < tipNext) return;
  const seen = tipSeen();
  const T = TIPS.find(x => !seen.includes(x.id) && tipTest(x));
  if (T) { tipCur = T; SND.sfx('tip'); }
}
function tipHTML() {
  const T = tipCur; if (!T || !tipOn()) return '';
  return `<div class="glass card tip" role="status" aria-label="Conseil de Sukhoï"><p class="tiptxt">${sukFace()}<span><b>Sukhoï&nbsp;:</b> ${esc(T.txt)}</span></p>
    <div class="row">${T.go ? `<button class="btn small primary grow" data-act="tipGo">${esc(T.btn)}</button>` : ''}<button class="btn small grow" data-act="tipOk">Compris</button></div></div>`;
}
const ACT_TIP = {
  tipOk: () => { tipClose(true); renderAll(); },
  tipGo: () => {
    const T = tipCur; tipClose(true); if (!T || !T.go) { renderAll(); return; }
    const h = activeHero(me, uid);
    openSheet(T.go, T.go === 'hero' && T.id !== 'heros2' && h ? h.id : undefined);
  },
  tipsToggle: () => { const on = !tipOn(); LS.set('mk2.tipsOff', on ? 0 : 1); if (!on) tipCur = null; else tipNext = Date.now() + 4000; renderAll(); },
  tipsReset: () => { LS.set('mk2.tips', []); LS.set('mk2.tipsOff', 0); tipCur = null; tipNext = Date.now() + 4000; toast('Les conseils reviendront, chacun au bon moment.'); renderAll(); },
};
