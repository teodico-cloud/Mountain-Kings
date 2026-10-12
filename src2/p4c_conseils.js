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
  { id: 'faim', ic: 'pain', go: 'build', btn: 'Construire', when: v => v.vil.length > 0 && ((v.hunger || 0) > 0 || foodOf(v) < 1),
    txt: 'Le village a faim ! Sans nourriture, le moral s’effondre, et au bout d’un jour quelqu’un s’en va. Champs, chasse, moulin et boulangerie : mettez des villageois au travail.' },
  { id: 'portail', ic: 'flame', go: 'defense', btn: 'Défense', when: v => raidInfo(v, now()).p.some(p => !p.cl),
    txt: 'Un portail démoniaque s’ouvre au bord de la vallée ! Une fois chargé, un raid viendra par là dès que personne n’aura joué depuis 2 heures. Prépare tes défenses, ou referme-le avec ton héros.' },
  { id: 'ruines', ic: 'shield', go: 'defense', btn: 'Défense', when: v => v.b.some(b => isDef(b) && repairCostOf(b)),
    txt: 'Des défenses sont abîmées : répare-les toutes d’un coup dans le menu Défense (les ruines d’abord).' },
  { id: 'leger', ic: 'star', go: 'village', btn: 'Réglages', when: () => gl && !gfxLight() && Date.now() - tipStart > 30000 && V3.fps() < 18,
    txt: 'Le jeu rame un peu sur ce téléphone ? Essaie les graphismes légers (menu Village, Affichage) : une image un peu moins fine et sans ombres, mais bien plus fluide.' },
  { id: 'points', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.sp > 0; },
    txt: 'Ton héros a un point de compétence à dépenser : renforce la compétence de ton choix dans le menu Héros (bouton +1).' },
  { id: 'recrue', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => caserneLvl(v) > 0 && !solList(v).length,
    txt: 'La caserne est prête : recrute tes premiers soldats contre de l’or. Fantassins et lanciers tiennent la ligne, archers et mages tirent de derrière.' },
  { id: 'poste', ic: 'flag', go: 'build', btn: 'Construire', when: v => solList(v).length > 0 && !postsOf(v).length,
    txt: 'Tes soldats attendent un poste de garde (Construire, rubrique Défense) : pendant un raid, ils défendent le cercle autour de lui.' },
  { id: 'sansposte', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => postsOf(v).length > 0 && solList(v).some(s => !s.post),
    txt: 'Des soldats n’ont pas de poste : à la caserne, « Répartir » les place tous d’un coup.' },
  { id: 'promo', ic: 'flag', go: 'caserne', btn: 'Caserne', when: v => solList(v).some(solCanPromote),
    txt: 'Un soldat a assez d’expérience pour monter de niveau : promeus-le à la caserne. Il frappera plus fort et tiendra mieux.' },
  { id: 'mieux', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => { const h = tipHero(v); return !!h && Object.values(tipBag(v)).some(it => compareItem(h, it) === 1); },
    txt: 'Un objet de ton sac est meilleur que celui que porte ton héros (flèche verte ▲) : équipe-le.' },
  { id: 'sac', ic: 's_bag', go: 'bag', btn: 'Mon sac', when: v => Object.keys(tipBag(v)).length >= bagMax(v) - 3,
    txt: 'Ton sac est presque plein : vends ou fonds ce qui ne sert plus. Quand il est plein, les nouveaux objets sont vendus d’office.' },
  { id: 'plein', ic: 'bois', go: 'build', btn: 'Construire', when: v => ['bois', 'pierre'].some(k => (v.r[k] || 0) >= capOf(v) - 1),
    txt: 'Les réserves débordent : ce qui est produit en plus est perdu. Construis ou agrandis un entrepôt.' },
  { id: 'oisifs', ic: 'people', go: 'people', btn: 'Villageois', when: v => tipAge(v) > 20 * 60000 && v.vil.some(p => p.job == null),
    txt: 'Un villageois n’a pas de métier : touche-le (ou ouvre le menu Villageois) pour lui en donner un.' },
  { id: 'donjon1', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && !(h.xp > 0) && (h.lvl | 0) <= 1 && !(h.dj > 1) && Date.now() - tipStart > 90000; },
    txt: 'Ton héros est prêt pour sa première aventure : menu Donjon, la mine des gobelins. Il attaque tout seul, toi tu le guides avec le pouce.' },
  { id: 'defense', ic: 'shield', go: 'defense', btn: 'Défense', when: v => !(v.raid && v.raid.n) && tipAge(v) > 36 * 3600000,
    txt: 'À partir du 3e jour, des gobelins peuvent attaquer pendant ton absence. Palissades, portes, tours et pièges : tout est dans le menu Défense.' },
  { id: 'forge', ic: 's_anvil', go: 'forge', btn: 'La forge', when: v => forgeLvlOf(v) > 0,
    txt: 'La forge est prête : fabrique de l’équipement, améliore-le jusqu’à +5, sertis des pierres, ou fonds ce qui ne sert plus pour récupérer du fer.' },
  { id: 'marchand', ic: 'or', go: 'merch', btn: 'Voir', when: v => merchHere(v, now()),
    txt: 'Le marchand ambulant s’est installé près de la halle jusqu’à demain : quelques objets à vendre contre de l’or.' },
  { id: 'crypte', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.crypte; },
    txt: 'La crypte des rois est ouverte : squelettes, spectres, nécromants qui relèvent les morts, et le roi squelette au fond.' },
  { id: 'prof', ic: 'sword', go: 'donjon', btn: 'Donjon', when: v => { const h = tipHero(v); return !!h && (h.dj || 1) >= DJ_OPEN.prof; },
    txt: 'Les Profondeurs sont ouvertes : des étages sans fin, de plus en plus durs. À la fin de chaque étage, tu choisis : descendre, ou remonter avec tout le butin.' },
  { id: 'familier', ic: 's_paw', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= PET_LVL && !h.pet; },
    txt: 'Ton héros peut maintenant adopter un familier (menu Héros) : loup, faucon, sanglier ou chouette, chacun avec son petit bonus.' },
  { id: 'spec', ic: 'star', go: 'hero', btn: 'Héros', when: v => { const h = tipHero(v); return !!h && h.lvl >= SPEC_LVL && h.spec == null; },
    txt: 'Niveau 10 : choisis la spécialisation de ton héros, une voie sur deux, pour de bon (menu Héros).' },
  { id: 'heros2', ic: 'crown', go: 'hero', btn: 'Héros', when: v => { const n = heroesOf(v, uid).length; return n > 0 && n < heroSlots(v); },
    txt: 'La taverne peut loger un héros de plus : recrute-le dans le menu Héros. Pendant que l’un part en donjon, les autres travaillent au village.' },
  { id: 'automne', ic: 's2', go: 'stock', btn: 'Réserves', when: v => seasonIdx(v, now()) === 2,
    txt: 'L’automne est là : dans 2 jours, l’hiver arrêtera les champs. Faites des réserves de pain et de viande.' },
  { id: 'hiver', ic: 's3', when: v => seasonIdx(v, now()) === 3,
    txt: 'C’est l’hiver : les champs dorment et la chasse rapporte moins. Le village vit sur ses réserves jusqu’au printemps.' },
  { id: 'inviter', ic: 'link', go: 'village', btn: 'Inviter', when: v => !partnerId(v) && tipAge(v) > 24 * 3600000,
    txt: 'Envie de jouer à deux ? Envoie le lien d’invitation (menu Village) : ta partenaire arrivera dans ton village, avec tout ce que tu as construit.' },
];
const tipIco = k => ico(k, ['pain', 'bois', 'or', 'people'].includes(k) ? undefined : 'c-tro');
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
  return `<div class="glass card tip" role="status" aria-label="Conseil"><p class="tiptxt">${tipIco(T.ic)}<span>${esc(T.txt)}</span></p>
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
