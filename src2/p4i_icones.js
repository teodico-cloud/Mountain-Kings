/* ===================== ICÔNES PEINTES (style « Taverne ») =====================
   2 ou 3 tons par objet, contour brun foncé, un reflet ; dessinées par le code (rien à télécharger).
   Chaque icône = une liste d'objets dessinés dans l'ordre (le dernier devant) : la forme (d), sa couleur (f), ses ombres et
   reflets (s : découpés à la forme), puis son contour ; ['L', d, couleur, épaisseur] = trait cerné (tige, chaîne, flocon).
   Les découpes sont posées une seule fois dans la page (picDefs) : chaque icône est une chaîne fixe, l'écran ne se redessine pas pour rien.
   Maquettes et planches : tools/maquettes/. */
const PI_OUT = '#3b2414';
const pC = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const pE = (x, y, rx, ry) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const pR = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const pStar = (cx, cy, n, ro, ri, a0) => { let d = ''; for (let i = 0; i < 2 * n; i++) { const a = (a0 || -90) * Math.PI / 180 + i * Math.PI / n, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2); } return d + 'Z'; };
const S = (d, f, o) => `<path d="${d}" fill="${f}"${o != null ? ` opacity="${o}"` : ''}/>`;
const Ln = (d, c, w, o) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o != null ? ` opacity="${o}"` : ''}/>`;
const HI = '#fffbe9';

/* couleurs */
const K = {
  wood: ['#a8683a', '#7a4523', '#d49a5c'], end: ['#e8c48e', '#b07a44'],
  stone: ['#a7abaa', '#737a7c', '#d6d9d5'],
  wheat: ['#e2b53e', '#b5852a', '#f7dd88'], straw: '#c99a3a',
  barley: ['#d6bb62', '#a3843a', '#f0dc9c'],
  sack: ['#efe2c6', '#c8b189', '#fffaf0'], tie: '#8a5a2b',
  bread: ['#d4893a', '#9f5b23', '#f2c27a'],
  meat: ['#c64a4b', '#8c2c33', '#ee9086'], bone: ['#f3e8d0', '#c8b694'],
  foam: ['#fff6e2', '#e2d1ad'], band: ['#7c858d', '#565e66'],
  iron: ['#8d99a5', '#5d6873', '#c7d1da'], dark: ['#5b6670', '#3c444c', '#8f9aa5'],
  gold: ['#ecb73e', '#b97f1b', '#fde595'],
  steel: ['#b9c4ce', '#7f8b97', '#e6edf2'],
  red: ['#c23a42', '#8a2230', '#f19a96'], blue: ['#3768a6', '#244b7c', '#79a6dc'],
  green: ['#5d9f43', '#3d7a2e', '#9ad27a'], skin: ['#edc7a0', '#c99a72'],
  leather: ['#9a6234', '#6e4020', '#c58a52'], parch: ['#efe2c4', '#cdb68a', '#fffaf0'],
  orange: ['#e8661f', '#b9441a', '#f8a24a'], flame2: '#f7b22f', flame3: '#fde49a',
  glass: ['#d9eaf0', '#a9c4cf'], bonew: ['#efe6d2', '#c4b796'],
};

/* une icône = liste d'objets { d, f, s: [ombres, reflets], o: false (pas de contour) } ou [ 'L', d, couleur, épaisseur ] */
const PIC_DEF = {
  bois: [
    { d: pR(2.4, 12.6, 15.4, 6.6, 3.3), f: K.wood[0], s: [S('M0 16.6h24V24H0z', K.wood[1]), S(pR(4, 13.6, 11, 1.4, .7), K.wood[2], .8), Ln('M5.5 15.4h4M8.5 17.4h5', K.wood[1], .8)] },
    { d: pE(17.6, 15.9, 3.1, 3.3), f: K.end[0], s: [Ln(pC(17.6, 15.9, 1.7), K.end[1], .8), S(pC(17.6, 15.9, .55), K.end[1])] },
    { d: pR(5, 5.6, 14.6, 6.6, 3.3), f: K.wood[0], s: [S('M0 9.6h24V24H0z', K.wood[1]), S(pR(6.6, 6.6, 10, 1.4, .7), K.wood[2], .8), Ln('M8 8.4h4M10.5 10.4h5', K.wood[1], .8)] },
    { d: pE(19.4, 8.9, 3.1, 3.3), f: K.end[0], s: [Ln(pC(19.4, 8.9, 1.7), K.end[1], .8), S(pC(19.4, 8.9, .55), K.end[1])] },
  ],
  pierre: [
    { d: 'M2.8 17.6 5 9.6l5.4-4 6 1.8 4.6 5.8-2.2 5.6-9.8 1.2z', f: K.stone[0], s: [S('M5 9.6l5.4-4 2.2 5.2-5.8 2.2z', K.stone[2]), S('M12.6 10.8l3.8-3.4 4.6 5.8-2.2 5.6-5-3.2z', K.stone[1]), S('M2.8 17.6l4-4.8 5.8-2 1.2 4.8 5 3.2-9.8 1.2z', '#8b9192'), S('M6.4 10.4l2.6-1.8.8 1.6-2.4 1z', HI, .7)] },
  ],
  ble: [
    { d: 'M8.9 11.2 6.4 20.8h3.1l1.5-6.1.9 6.1h2.2l.9-6.1 1.5 6.1h3.1l-2.5-9.6z', f: K.straw, s: [S('M12 10h8v12h-8z', K.wheat[1], .7)] },
    { d: 'M6 9.6C4.4 6 6.6 2.7 9 3.2c1.2-1.6 4.8-1.6 6 0 2.4-.5 4.6 2.8 3 6.4-2.6 1.8-9.4 1.8-12 0z', f: K.wheat[0], s: [S('M12 0h12v12H12z', K.wheat[1], .55), S(pE(8.4, 6.2, 1, 1.7), K.wheat[2]), S(pE(10.6, 5, 1, 1.7), K.wheat[2]), S(pE(13.4, 5, 1, 1.7), K.wheat[1]), S(pE(15.6, 6.2, 1, 1.7), K.wheat[1]), S(pE(12, 8.2, 1, 1.6), K.wheat[2], .9)] },
    { d: pR(7.9, 9.8, 8.2, 2.8, 1.2), f: K.tie, s: [S(pR(8.6, 10.2, 3, .9, .45), '#b98450')] },
  ],
  orge: [
    ['L', 'M7.4 21.4c.6-2.6 1.8-4.8 3.4-6.6', '#a08a3c', 1.6],
    { d: 'M8.4 18.4c.4-2.2 1.8-3.6 3.8-4-.4 2.2-1.8 3.6-3.8 4z', f: K.green[0], s: [S('M10 14h4v6h-4z', K.green[1], .6)] },
    { t: 'rotate(28 12 12)', pre: [Ln('M10 5.6 7.6 1.4M9.3 8.4 6.2 4.6M9.1 11.2 5.8 8M14 5.6l2.4-4.2M14.7 8.4l3.1-3.8M14.9 11.2l3.3-3.2', '#9c7f34', .8)],
      d: 'M12 2.4c2.4 1.6 3.4 4.4 3.2 7.2-.2 2.4-1.4 4.4-3.2 5.6-1.8-1.2-3-3.2-3.2-5.6-.2-2.8.8-5.6 3.2-7.2z', f: K.barley[0],
      s: [S('M12 0h6v20h-6z', K.barley[1], .5), Ln('M9 6.4l3 1.6 3-1.6M8.8 9.2l3.2 1.8 3.2-1.8M9.4 12 12 13.6l2.6-1.6', K.barley[1], .9), S(pE(10.4, 7.6, .8, 2), K.barley[2], .9)] },
  ],
  farine: [
    { d: 'M7 6.6 6 4.7c-.2-.6.3-1.1.9-1h10.2c.6-.1 1.1.4.9 1L17 6.6c2.8 1.8 3.8 5 3.4 8.6-.3 2.8-2.4 4.9-5.4 4.9H9c-3 0-5.1-2.1-5.4-4.9C3.2 11.6 4.2 8.4 7 6.6z', f: K.sack[0], s: [S('M14.5 0H24v24h-9.5z', K.sack[1], .8), S(pE(8.4, 11, 1.6, 3), K.sack[2], .9), Ln('M12 11v6', K.tie, .9), S(pE(10.9, 12.6, .75, 1.15) + pE(13.1, 12.6, .75, 1.15) + pE(10.9, 14.8, .75, 1.15) + pE(13.1, 14.8, .75, 1.15) + pE(12, 10.6, .75, 1.15), K.tie)] },
    { d: pR(6.6, 5.6, 10.8, 2, 1), f: K.tie },
  ],
  pain: [
    { d: 'M2.8 14.4c0-4.6 4-7.8 9.2-7.8s9.2 3.2 9.2 7.8c0 2-1.4 3.4-3.4 3.4H6.2c-2 0-3.4-1.4-3.4-3.4z', f: K.bread[0], s: [S('M0 14.2h24V24H0z', K.bread[1]), S(pE(8, 9.6, 3.4, 1.6), K.bread[2], .9), Ln('M6.8 13.2l1.8-3.2M10.8 12.6l1.6-3.4M14.8 12.8l1.4-3', '#8a4a1a', 1.4), Ln('M7.3 13.2l1.8-3.2M11.3 12.6l1.6-3.4M15.3 12.8l1.4-3', '#f6d39a', .7)] },
  ],
  viande: [
    { d: 'M9.4 13.4 5.6 17.2a1.9 1.9 0 1 0-1.3 3 1.9 1.9 0 1 0 3-1.3l3.8-3.8z', f: K.bone[0], s: [S('M6 19l6-6 3 3-6 6z', K.bone[1])] },
    { d: 'M14.2 2.8c3.6 0 6.2 2.8 6 6.2-.2 4.4-4.4 7.6-8.6 6.6-1.8-.4-3.2-1.6-3.8-3.2-1.4-4.2 1.8-9.6 6.4-9.6z', f: K.meat[0], s: [S('M8 11.6c4 3.6 9.6 1.8 12.4-3.2V24H8z', K.meat[1]), S(pE(13.4, 6.4, 2.6, 1.6), K.meat[2], .9), S(pE(12.4, 5.8, .9, .5), HI, .8)] },
  ],
  biere: [
    { d: 'M15.2 9.6h2.2a3.4 3.4 0 0 1 3.4 3.4v1.4a3.4 3.4 0 0 1-3.4 3.4h-2.2v-2.4h2.2a1 1 0 0 0 1-1V13a1 1 0 0 0-1-1h-2.2z', f: K.wood[1] },
    { d: pR(4, 7, 11.6, 14, 2), f: K.wood[0], s: [S('M11 0h13v24H11z', K.wood[1], .8), S(pR(5.4, 8, 1.6, 11, .8), K.wood[2], .7), S('M0 9.6h24v1.8H0zM0 16.6h24v1.8H0z', K.band[0]), S('M11 9.6h13v1.8H11zM11 16.6h13v1.8H11z', K.band[1])] },
    { d: 'M3.4 7.8c-.6-1.8.8-3.4 2.6-3 .6-1.6 2.6-2.2 4-1.2 1.2-1 3.2-.8 4 .6 1.6-.2 2.8 1.4 2.2 3.1-.3.8-1 1.3-1.8 1.3H5.2c-.8 0-1.5-.3-1.8-.8z', f: K.foam[0], s: [S('M0 7.2h24V12H0z', K.foam[1], .9)] },
  ],
  fer: [
    { d: 'M3.6 13.4h16.8l-1.6 5H5.2z', f: K.iron[1], s: [S('M14 13h10v6H14z', K.dark[1], .6)] },
    { d: 'M7.2 7.4h9.6l3.6 6H3.6z', f: K.iron[0], s: [S('M8.2 8.4h4l-1 2H6.8z', K.iron[2], .9), S('M14 7h8v7h-8z', K.iron[1], .5)] },
  ],
  or: [
    { d: pE(17.2, 13.6, 4.2, 4.6), f: K.gold[0], s: [S('M17.4 8h6v12h-6z', K.gold[1], .8), Ln(pE(17.2, 13.6, 2.4, 2.8), K.gold[1], .8), S(pE(15.6, 11.6, .9, 1.4), K.gold[2])] },
    { d: 'M3 17.4v1.6c0 1.3 3 2.4 6.6 2.4s6.6-1.1 6.6-2.4v-1.6z', f: K.gold[1] },
    { d: pE(9.6, 17.4, 6.6, 2.4), f: K.gold[0], s: [S(pE(8, 16.9, 2.4, .7), K.gold[2])] },
    { d: 'M3 14v1.6c0 1.3 3 2.4 6.6 2.4s6.6-1.1 6.6-2.4V14z', f: K.gold[1] },
    { d: pE(9.6, 14, 6.6, 2.4), f: K.gold[0], s: [S(pE(8, 13.5, 2.4, .7), K.gold[2])] },
    { d: 'M3 10.6v1.6c0 1.3 3 2.4 6.6 2.4s6.6-1.1 6.6-2.4v-1.6z', f: K.gold[1] },
    { d: pE(9.6, 10.6, 6.6, 2.4), f: K.gold[0], s: [S(pE(8, 10.1, 2.4, .7), K.gold[2]), S(pE(10.8, 10.9, 1.4, .5), K.gold[1], .7)] },
  ],
  people: [
    { d: 'M12.4 19.4c.3-3.6 1.9-5.8 4.4-5.8 2.6 0 4.6 2.2 4.6 5.8z', f: K.leather[0], s: [S('M17 12h8v9h-8z', K.leather[1], .8)] },
    { d: pC(16.6, 8.8, 2.7), f: K.skin[0], s: [S('M13.6 8.4c.2-2.6 2.2-3.6 3.6-3.4 1.6.2 2.6 1.4 2.4 2.8-1.6-.8-3.8-.6-6 .6z', '#7a4a22'), S('M17.6 5h4v8h-4z', K.skin[1], .5)] },
    { d: 'M2.6 21c0-4.6 2.8-7.4 6.4-7.4s6.4 2.8 6.4 7.4z', f: K.blue[0], s: [S('M9.6 12h7v10h-7z', K.blue[1], .8), S(pR(4.6, 15.6, 1.4, 4, .7), K.blue[2], .7)] },
    { d: pC(9, 7.8, 3.4), f: K.skin[0], s: [S('M5.4 7.6c.2-3.2 2.6-4.6 4.4-4.4 2 .2 3.4 1.8 3 3.6-2-1-4.8-.8-7.4.8z', '#a8622c'), S('M10 3h4v10h-4z', K.skin[1], .5)] },
  ],
  heart: [
    { d: 'M12 20.6S3.2 15.2 3.2 9C3.2 6.1 5.4 3.9 8.1 3.9c1.6 0 3 .8 3.9 2.1.9-1.3 2.3-2.1 3.9-2.1 2.7 0 4.9 2.2 4.9 5.1 0 6.2-8.8 11.6-8.8 11.6z', f: K.red[0], s: [S('M12.6 6c3 3.6 3.4 9.4-.6 15H24V0H12.6z', K.red[1], .75), S(pE(7.6, 8, 2.2, 1.6), K.red[2], .9), S(pE(7, 7.4, .8, .5), HI)] },
  ],
  hammer: [
    { d: 'M2.7 19.5l10.6-10.6 1.8 1.8L4.5 21.3a1.3 1.3 0 0 1-1.8-1.8z', f: K.wood[0], s: [S('M4 22l11-11 2 2L6 24z', K.wood[1])] },
    { d: 'M13.8 3.2 20.8 10.2 17.4 13.6 10.4 6.6z', f: K.iron[0], s: [S('M12.1 4.9l7 7-1.7 1.7-7-7z', K.iron[1]), S('M13.8 3.6l5.4 5.4-.7.7-5.4-5.4z', K.iron[2], .9)] },
  ],
  house: [
    { d: 'M5.2 11.4h13.6v9.2H5.2z', f: '#efe0c0', s: [S('M13 10h7v12h-7z', '#cdb98f', .8), S('M6 12.6h1.2v8H6zM16.8 12.6H18v8h-1.2z', '#6b4426')] },
    { d: pR(10, 14.6, 4, 6, 1.6), f: '#7a4a24', s: [S('M12 14h3v7h-3z', '#5a3418')] },
    { d: 'M15.6 4.4h2.6v5h-2.6z', f: '#9c5a3a' },
    { d: 'M2.4 12.2 12 3.4l9.6 8.8-1.4 1.6L12 6.4l-8.2 7.4z', f: '#b84a30', s: [S('M12 0h12v14H12z', '#8a3422', .8), S('M5 10.6l6.6-6 .4.5-6.6 6z', '#e07a5a', .8)] },
  ],
  crown: [
    { d: 'M3.6 17.2 2.6 7.6l5 3.8L12 3.8l4.4 7.6 5-3.8-1 9.6z', f: K.gold[0], s: [S('M12 0h12v24H12z', K.gold[1], .6), S('M4.4 9.8l2.6 2 .6 3.4-2.6-.8z', K.gold[2], .9)] },
    { d: pR(3.4, 16.4, 17.2, 3.6, 1.2), f: K.gold[1], s: [S('M3 16.4h18v1.2H3z', K.gold[0])] },
    { d: pE(12, 18.2, 1.6, 1.3), f: K.red[0], s: [S(pE(11.5, 17.8, .5, .35), HI)] },
    { d: pE(6.8, 18.2, 1.2, 1), f: K.blue[0] }, { d: pE(17.2, 18.2, 1.2, 1), f: K.blue[0] },
    { d: pC(12, 3.6, 1.3), f: K.gold[0] }, { d: pC(2.6, 7.4, 1.1), f: K.gold[0] }, { d: pC(21.4, 7.4, 1.1), f: K.gold[0] },
  ],
  scroll: [
    { d: 'M6 5.4h12v13.4H6z', f: K.parch[0], s: [S('M14 4h6v16h-6z', K.parch[1], .6), Ln('M8.4 9.2h7.2M8.4 11.8h7.2M8.4 14.4h4.4', '#a07a50', 1)] },
    { d: pR(4.2, 2.8, 15.6, 4, 2), f: '#e3cfa0', s: [S('M4 5h17v3H4z', K.parch[1])] },
    { d: pR(4.2, 17.4, 15.6, 4, 2), f: '#e3cfa0', s: [S('M4 19.6h17v3H4z', K.parch[1])] },
    { d: pC(16.6, 15.8, 2.3), f: K.red[0], s: [S('M16.6 13h3v6h-3z', K.red[1], .7), S(pE(15.9, 15.1, .7, .5), K.red[2])] },
  ],
  help: [
    { d: pC(12, 12, 9.2), f: K.parch[0], s: [S('M12.4 0H24v24H12.4z', K.parch[1], .6)] },
    ['L', 'M9 9.2c0-1.8 1.4-3 3.1-3s3 1.2 3 2.8c0 2.4-3 2.4-3 4.8', '#6b3a1c', 2.6, true],
    { d: pC(12.1, 17.2, 1.5), f: '#6b3a1c', o: false },
  ],
  sound: [
    { d: 'M2.8 10.2h3l11.4-6.4v16.4L5.8 13.8h-3z', f: K.gold[0], s: [S('M0 12h24v12H0z', K.gold[1], .7), S('M6 10.6l9.8-5.4v1.4L6 11.8z', K.gold[2], .9)] },
    { d: pE(17.4, 12, 2, 8.4), f: K.gold[1], s: [S(pE(17.6, 12, 1, 6.6), '#7a5212')] },
    { d: pR(8.6, 7.2, 2, 9.6, .8), f: K.leather[1] },
  ],
  clock: [
    { d: pR(5.6, 4, 1.4, 15.6, .6), f: K.wood[1] }, { d: pR(17, 4, 1.4, 15.6, .6), f: K.wood[1] },
    { d: 'M7.4 5.2h9.2c0 3.6-2.8 5.2-3.2 6.8.4 1.6 3.2 3.2 3.2 6.8H7.4c0-3.6 2.8-5.2 3.2-6.8-.4-1.6-3.2-3.2-3.2-6.8z', f: K.glass[0], s: [S('M8.6 18.8c.4-2.4 2.2-3.4 3.4-3.6 1.2.2 3 1.2 3.4 3.6z', K.wheat[0]), S('M9.4 7.6h5.2c-.6 1.4-1.8 2.2-2.6 3-.8-.8-2-1.6-2.6-3z', K.wheat[0]), S('M8.6 6h1.2c.2 1.8 1 2.8 1.6 3.4l-.6.6c-1.2-1-2-2.2-2.2-4z', HI, .8)] },
    { d: pR(4.6, 2.4, 14.8, 2.8, 1.2), f: K.wood[0], s: [S('M0 4h24v2H0z', K.wood[1])] },
    { d: pR(4.6, 18.8, 14.8, 2.8, 1.2), f: K.wood[0], s: [S('M0 20.4h24v2H0z', K.wood[1])] },
  ],
  link: [
    { d: pR(2.8, 6, 18.4, 13, 1.6), f: K.parch[0], s: [S('M0 14h24v8H0z', K.parch[1], .7), Ln('M3.4 6.8 12 13.4l8.6-6.6', '#a07a50', 1.2)] },
    { d: pC(12, 13.4, 2.8), f: K.red[0], s: [S('M12.6 10h4v8h-4z', K.red[1], .7), S(pE(11.2, 12.6, .9, .6), K.red[2])] },
  ],
  star: [
    { d: pStar(12, 12.4, 5, 9.6, 4.4), f: K.gold[0], s: [S('M12 0h12v24H12z', K.gold[1], .55), S(pStar(10.6, 10.6, 5, 2.4, 1.2), K.gold[2], .9)] },
  ],
  flag: [
    { d: pR(4.2, 3, 2, 18.6, 1), f: K.wood[0], s: [S('M5.4 0h2v24h-2z', K.wood[1])] },
    { d: 'M6.2 4.2h13l-2.8 4 2.8 4h-13z', f: K.red[0], s: [S('M0 9h24v6H0z', K.red[1], .7), S('M6.2 6h11.4l-.4.6H6.2z', K.gold[0])] },
    { d: pC(5.2, 3, 1.5), f: K.gold[0] },
  ],
  shield: [
    { d: 'M12 2.4 20.2 5.3v6.1c0 5.3-3.5 9-8.2 10.4-4.7-1.4-8.2-5.1-8.2-10.4V5.3z', f: K.gold[0], s: [S('M12 0h12v24H12z', K.gold[1], .7)] },
    { d: 'M12 4.8l5.9 2.1v4.7c0 3.9-2.4 6.8-5.9 8-3.5-1.2-5.9-4.1-5.9-8V6.9z', f: K.blue[0], s: [S('M12 0h12v24H12z', K.blue[1]), S('M11 4h2v17h-2z', K.gold[0]), S(pE(8.6, 9.4, 1, 2), K.blue[2], .7)] },
  ],
  sword: [
    { d: 'M20.8 3.2 19.9 7.4 10.8 16.5 7.5 13.2 16.6 4.1z', f: K.steel[0], s: [S('M20.8 3.2 9.2 14.8l1.6 1.7 9.1-9.1z', K.steel[1]), Ln('M18.6 5.4 10 14', K.steel[2], .8)] },
    { d: 'M7.09 15.49 8.51 16.91 5.31 20.11 3.89 18.69z', f: K.leather[1], s: [Ln('M6.2 16.8l1.2 1.2M5.2 17.8l1.2 1.2', K.leather[2], .6)] },
    { d: 'M6.62 11.72 12.28 17.38 10.58 19.08 4.92 13.42z', f: K.gold[0], s: [S('M4 14l8 8 2-2-8-8z', K.gold[1], .7)] },
    { d: pC(3.9, 20.1, 1.7), f: K.gold[0], s: [S(pE(3.4, 19.6, .5, .4), K.gold[2])] },
  ],
  flame: [
    { d: 'M12 21.6c-4.4 0-7.2-3-7.2-6.8 0-3.4 2.2-5.4 3.6-7.4.4 1.8 1.3 2.8 2.4 3.2-.4-3.4 1-6.6 3.8-8.5-.2 3 1.4 4.8 3 6.8 1.4 1.8 2.6 3.6 2.6 6 0 3.8-3.2 6.7-8.2 6.7z', f: K.orange[0], s: [S('M13 0h11v24H13z', K.orange[1], .45)] },
    { d: 'M12 21c-2.3 0-3.8-1.6-3.8-3.6 0-2 1.4-3.2 2.4-4.6.3 1.2 1 1.7 1.7 1.9 0-1.8.8-3.4 2.2-4.4 0 1.7.8 2.8 1.6 3.9.6.9 1.2 1.9 1.2 3.2 0 2-1.6 3.6-5.3 3.6z', f: K.flame2, o: false, s: [S(pE(12.2, 18.4, 1.6, 2), K.flame3)] },
  ],
  s0: [
    ['L', 'M12 14v7.4', K.green[1], 1.6],
    { d: 'M12.2 19.4c1.4-2.4 3.6-3.2 5.6-2.6-1.2 2-3.4 3-5.6 2.6z', f: K.green[0] },
    ...[[12, 6.6], [16.2, 9.6], [14.6, 14.6], [9.4, 14.6], [7.8, 9.6]].map(([x, y]) => ({ d: pC(x, y, 3.2), f: '#f08aa8', s: [S(pE(x - .8, y - .9, 1.2, .8), '#fcd0dd')] })),
    { d: pC(12, 10.8, 2.5), f: '#f5c542', s: [S('M12.6 8h3v6h-3z', '#d89a22', .7)] },
  ],
  s1: [
    { d: pStar(12, 12, 8, 10.8, 6.6, -90), f: K.orange[2], s: [S('M12 0h12v24H12z', K.orange[0], .5)] },
    { d: pC(12, 12, 5.4), f: '#f7c93c', s: [S('M13 6h7v13h-7z', '#e39a26', .6), S(pE(10.2, 10.2, 1.6, 1.1), '#fdeaa0')] },
  ],
  s2: [
    ['L', 'M4 20.4l3-3', '#7a3a14', 1.6],
    { d: 'M20 3.4C10 3 4 8 4.8 15.6c.2 1 .8 1.6 1.8 1.8C14.2 18.2 20.6 12 20 3.4z', f: '#e0782e', s: [S('M20.4 3 6 18H24V3z', '#b24d1e', .75), Ln('M6.6 17.4 17 7M10.4 13.4l-1-3.4M13.6 10.4l2.8.6', '#8a3a14', .9)] },
  ],
  s3: [
    ['L', 'M12 2.8v18.4M4 7.4l16 9.2M4 16.6l16-9.2M9.6 3.8 12 6l2.4-2.2M9.6 20.2 12 18l2.4 2.2M3.6 10.6l3-.8-.8-3M20.4 13.4l-3 .8.8 3M3.6 13.4l3 .8-.8 3M20.4 10.6l-3-.8.8-3', '#bfe3f4', 1.7],
    { d: pC(12, 12, 1.8), f: '#e9f6fc' },
  ],
  s_casque: [
    { d: 'M12 3.4c2.6-1.6 5.6-1 6.4 1.4-2-.4-3.8 0-5 1.2z', f: K.red[0] },
    { d: 'M4.4 15.6a7.6 7.6 0 0 1 15.2 0v3.6H4.4z', f: K.steel[0], s: [S('M12.6 6h8v14h-8z', K.steel[1], .8), S(pE(8.6, 10.4, 1.4, 2.2), K.steel[2], .9)] },
    { d: pR(10.9, 10.2, 2.2, 9.6, .9), f: K.iron[1] },
    { d: pR(3.4, 14.8, 17.2, 2.8, 1.2), f: K.iron[0], s: [S('M12 14h9v4h-9z', K.iron[1], .7), S(pC(6.4, 16.2, .6) + pC(17.6, 16.2, .6), K.iron[2])] },
  ],
  s_armure: [
    { d: 'M8 3 4 5.6l1.6 5.6L7 10.4v10.2h10V10.4l1.4.8L20 5.6 16 3l-1.6 2H9.6z', f: K.steel[0], s: [S('M12 0h12v24H12z', K.steel[1], .75), S(pE(9.4, 9.8, 1.2, 2.4), K.steel[2], .9), Ln('M12 5.6v10', K.iron[1], .9)] },
    { d: pR(6.8, 15.8, 10.4, 2.2, .6), f: K.leather[0], s: [S('M12 15h6v4h-6z', K.leather[1], .7)] },
    { d: pR(10.8, 15.4, 2.4, 3, .5), f: K.gold[0] },
  ],
  s_bottes: [
    { d: 'M7 3h6.4v10.8l6.2 2.4c1.1.4 1.6 1.4 1.6 2.4v1.8H4.4v-3.2L7 15.6z', f: K.leather[0], s: [S('M10.6 0H24v24H10.6z', K.leather[1], .55), S(pR(8, 6.6, 1.4, 6, .7), K.leather[2], .8)] },
    { d: pR(6.4, 2.6, 7.6, 3.2, 1), f: K.leather[2], s: [S('M10.4 2h4v4h-4z', K.leather[0], .7)] },
    { d: pR(4.2, 19.2, 17.2, 2.2, .8), f: '#4a2e18' },
  ],
  s_bijou: [
    ['L', 'M5.6 3.2c0 4 3 6.8 6.4 6.8s6.4-2.8 6.4-6.8', K.gold[0], 1.5],
    { d: 'M12 9.2 16.6 14 12 21.2 7.4 14z', f: K.gold[0], s: [S('M12 0h12v24H12z', K.gold[1], .6)] },
    { d: 'M12 11.2 14.6 14 12 18.6 9.4 14z', f: K.red[0], o: false, s: [S('M12 11h3v8h-3z', K.red[1], .7), S('M11.2 12.6l.8-1 .6.8-.8 1.4z', HI, .9)] },
  ],
  s_bag: [
    ['L', 'M8.4 9.2V7a3.6 3.6 0 0 1 7.2 0v2.2', K.leather[1], 1.8],
    { d: 'M5.2 9h13.6l1.6 11.4c.1.6-.4 1.1-1 1.1H4.6c-.6 0-1.1-.5-1-1.1z', f: K.leather[0], s: [S('M13.4 0H24v24H13.4z', K.leather[1], .6), S(pE(7.6, 16.4, 1, 2.6), K.leather[2], .7)] },
    { d: 'M5.2 9h13.6v3.6c0 .8-.6 1.4-1.4 1.4H6.6c-.8 0-1.4-.6-1.4-1.4z', f: K.leather[1] },
    { d: pR(10.7, 12, 2.6, 3.2, .6), f: K.gold[0] },
  ],
  s_anvil: [
    { d: 'M2.8 7h13.4c0 3 2 4.6 5 5v1.2h-6.2l-1 3h3v3.2H6.8v-3.2h3l-1-3H8C5 13.2 2.8 11 2.8 7z', f: K.dark[0], s: [S('M0 7h24v1.8H0z', K.dark[2]), S('M12 12h12v12H12z', K.dark[1], .7)] },
  ],
  s_paw: [
    { d: pE(12, 16, 5, 4.2), f: K.leather[0], s: [S('M12.4 10h7v11h-7z', K.leather[1], .6), S(pE(10.4, 14.6, 1.6, 1), K.leather[2], .8)] },
    ...[[6, 10.2], [9.4, 6.4], [14.6, 6.4], [18, 10.2]].map(([x, y]) => ({ d: pE(x, y, 2, 2.6), f: K.leather[0], s: [S(pE(x - .5, y - .8, .7, .9), K.leather[2], .8)] })),
  ],
  bolt: [
    { d: 'M13.8 1.8 4.8 13.4h5.6l-1.2 8.8 10-12.6h-5.8z', f: '#f6c430', s: [S('M13 0h11v24H13z', '#d8901e', .6), S('M12 4.2 7.4 11.4h1.4z', '#fdeaa0')] },
  ],
  feather: [
    { d: 'M19.8 3.2C12 3.6 6.2 9.6 5.6 16.8l-1.8 3.4 1 .6 2-3.4C14.4 16.8 19.4 10.6 19.8 3.2z', f: '#eef3f6', s: [S('M20 3 6 18H24V3z', '#b9cad6', .9), Ln('M9.6 10.6l1 3.2M12.6 7.8l.8 3M15.4 5.6l.6 2.6', '#9fb2be', .8)] },
    ['L', 'M4.4 20.4 17.6 5.8', '#7a8a96', 1],
  ],
  arrow: [
    ['L', 'M4.6 19.4 17.6 6.4', K.wood[0], 1.8],
    { d: 'M21.2 2.8l-6.6 2.4 4.2 4.2z', f: K.steel[0], s: [S('M21.2 2.8 16.8 7.4l2 2z', K.steel[1])] },
    { d: 'M7.6 15.4 4.4 14.6 2.6 17l2.8.8z', f: K.red[0] },
    { d: 'M8.6 16.4l.8 3.2-2.4 1.8-.8-2.8z', f: K.red[1] },
  ],
  drop: [
    { d: 'M12 2.8c3.4 4.6 6.4 8.2 6.4 11.6a6.4 6.4 0 0 1-12.8 0c0-3.4 3-7 6.4-11.6z', f: K.red[0], s: [S('M12.6 0H24v24H12.6z', K.red[1], .7), S(pE(9.4, 13.6, 1.2, 2.2), K.red[2], .9)] },
  ],
  eye: [
    { d: 'M2.6 12C5 7.6 8.4 5.4 12 5.4s7 2.2 9.4 6.6c-2.4 4.4-5.8 6.6-9.4 6.6S5 16.4 2.6 12z', f: '#f6f1e6', s: [S('M0 12h24v8H0z', '#d9cfbc', .8)] },
    { d: pC(12, 12, 3.7), f: '#3f8f5a', s: [S('M12 8h4v8h-4z', '#2c6a40', .7)] },
    { d: pC(12, 12, 1.6), f: '#1c1410', o: false },
    { d: pC(10.8, 10.8, .9), f: HI, o: false },
  ],
  leaf: [
    ['L', 'M4 20.4l3-3', K.green[1], 1.6],
    { d: 'M20 3.4C10 3 4 8 4.8 15.6c.2 1 .8 1.6 1.8 1.8C14.2 18.2 20.6 12 20 3.4z', f: K.green[0], s: [S('M20.4 3 6 18H24V3z', K.green[1], .75), S(pE(9.6, 10, 1.4, 2.6), K.green[2], .6), Ln('M6.6 17.4 17 7', '#2c5a20', .9)] },
  ],
  skull: [
    { d: 'M12 3c-4.6 0-7.6 3.2-7.6 7.2 0 2.4 1 4 2.6 5v3.2c0 .8.6 1.4 1.4 1.4h7.2c.8 0 1.4-.6 1.4-1.4v-3.2c1.6-1 2.6-2.6 2.6-5C19.6 6.2 16.6 3 12 3z', f: K.bonew[0], s: [S('M12.4 0H24v24H12.4z', K.bonew[1], .7), S(pE(9, 7.4, 1.6, 1), HI, .8), Ln('M10.4 17v2.6M13.6 17v2.6', '#8a7a5a', .8)] },
    { d: pE(9.2, 11.4, 1.9, 2), f: '#2a1a10', o: false }, { d: pE(14.8, 11.4, 1.9, 2), f: '#2a1a10', o: false },
    { d: 'M12 13.6l1 1.8h-2z', f: '#2a1a10', o: false },
  ],
  roll: [
    ['L', 'M18.8 13.6a7 7 0 1 1-2.2-7.4', '#e8a33a', 2.6],
    { d: 'M19.6 2.6v6.2h-6.2z', f: '#e8a33a' },
  ],
  potion: [
    { d: pR(9.6, 1.8, 4.8, 2.8, .9), f: K.leather[0] },
    { d: 'M10 4.4h4v3.4c2.8 1 4.6 3.4 4.6 6.2 0 3.6-3 6.2-6.6 6.2s-6.6-2.6-6.6-6.2c0-2.8 1.8-5.2 4.6-6.2z', f: K.glass[0], s: [S('M4 14.2c2.6-1 5-.2 8 .4s5.4.6 8-.4V24H4z', K.red[0]), S('M12.6 0H24v24H12.6z', '#000', .14), S(pE(8.6, 12.4, .9, 1.8), HI, .8)] },
  ],
};
/* armes selon leur famille (cadres des objets) : arc, bâton, grimoire */
PIC_DEF.bow = [
  ['L', 'M5.6 3.2c7.8 1.2 13.6 7 15 15', K.wood[0], 2.4],
  ['L', 'M5.6 3.2 20.6 18.2', '#f3e8cc', .8, true],
  ['L', 'M14 7.6l2.4 2.4', K.leather[1], 3.4],
  ['L', 'M3.6 20.4 16.4 7.6', K.wood[1], 1.3],
  { d: 'M17.8 5l2.9-1.4-1.4 2.9z', f: K.steel[0] },
  { d: 'M5.2 16.6 3 17.2l-.6 3.2 3-.6z', f: K.red[0] },
];
PIC_DEF.staff = [
  ['L', 'M4.6 20.8 15.2 8.4', K.wood[0], 2.4],
  { d: pC(15.6, 8.6, 1.7), f: K.gold[0] },
  { d: pC(17.6, 6, 3.3), f: '#5a9fe6', s: [S('M18 2h6v8h-6z', '#2f6fb8', .7), S(pE(16.6, 4.9, 1, .7), HI, .9)] },
];
PIC_DEF.book = [
  { d: pR(18, 4.4, 2.8, 15.6, .8), f: K.parch[0], s: [Ln('M18.8 6v12.4M19.8 6v12.4', K.parch[1], .5)] },
  { d: pR(3.6, 3.6, 15.4, 17, 1.6), f: '#7a2a3a', s: [S('M12 0h12v24H12z', '#5a1c2a', .55), S(pR(5, 5, 1.6, 14, .8), '#a8475a', .8)] },
  { d: pStar(11.4, 12, 4, 3.6, 1.4, -90), f: K.gold[0] },
  { d: 'M3.6 6.4V5.2c0-.9.7-1.6 1.6-1.6h1.2z', f: K.gold[0] }, { d: 'M19 18.8V20c0 .9-.7 1.6-1.6 1.6h-1.2z', f: K.gold[0] },
];
PIC_DEF.s_arme = PIC_DEF.sword; PIC_DEF.snow = PIC_DEF.s3; PIC_DEF.paw = PIC_DEF.s_paw; PIC_DEF.mug = PIC_DEF.biere;


/* la chaîne SVG d'une icône (découpes : #pk_<clé>_<n>, posées par picDefs) */
function picSVG(k) {
  const def = PIC_DEF[k]; if (!def) return '';
  let body = '', n = 0;
  for (const o of def) {
    if (Array.isArray(o)) { const [, d, c, w, noOut] = o; body += (noOut ? '' : Ln(d, PI_OUT, w + 2)) + Ln(d, c, w); continue; }
    if (o.t) body += `<g transform="${o.t}">`;
    if (o.pre) body += o.pre.join('');
    body += `<path d="${o.d}" fill="${o.f}"/>`;
    if (o.s && o.s.length) body += `<g clip-path="url(#pk_${k}_${n++})">${o.s.join('')}</g>`;
    if (o.o !== false) body += `<path d="${o.d}" fill="none" stroke="${PI_OUT}" stroke-width="1.3" stroke-linejoin="round"/>`;
    if (o.t) body += '</g>';
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}
/* toutes les découpes, une fois pour toutes, dans un SVG invisible mais rendu (pas display:none, sinon certains navigateurs les ignorent) */
function picDefs() {
  if (typeof document === 'undefined' || document.getElementById('picdefs')) return;
  let d = '';
  for (const k in PIC_DEF) { let n = 0; for (const o of PIC_DEF[k]) if (!Array.isArray(o) && o.s && o.s.length) d += `<clipPath id="pk_${k}_${n++}"><path d="${o.d}"/></clipPath>`; }
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.id = 'picdefs'; s.setAttribute('aria-hidden', 'true'); s.setAttribute('width', '0'); s.setAttribute('height', '0');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  s.innerHTML = '<defs>' + d + '</defs>';
  document.body.insertBefore(s, document.body.firstChild);
}
/* les icônes du jeu (village, équipement, donjon) : une seule table */
const IC = {};
for (const k in PIC_DEF) IC[k] = picSVG(k);
const DJ_IC = IC;
picDefs();
