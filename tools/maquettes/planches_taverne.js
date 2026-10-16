/* Fabrique les planches de la piste A allégée (node gen.js [--local] ) */
const fs = require('fs'), path = require('path');
const { picSVG } = require('../icons/ic_taverne.js');
const LOCAL = process.argv.includes('--local');
const OUT = path.join(__dirname, LOCAL ? 'local' : 'project');
fs.mkdirSync(OUT, { recursive: true });
let uid = 0;
const ic = (k, px) => { const n = 'i' + (uid++); return picSVG(k).replace(/#N#/g, n).replace('<svg ', `<svg width="${px}" height="${px}" style="display:block;flex:none" `); };
const BG_VIL = '/_blob/c1f131fa39fe94fcf9a5337aaabbe6fe', BG_AVANT = '/_blob/7f86b08db4794870924a0a32ca91a8d1';
const FT = "'IM Fell English SC', Georgia, serif", FB = "'Alegreya Sans', 'Trebuchet MS', sans-serif";
const FD = '/tmp/claude-0/-home-claude/be95f51b-a61c-5ea0-96a1-2fc7b921ca15/scratchpad/fonts/gf/ofl';
const fontsHead = LOCAL
  ? `<style>@font-face{font-family:'IM Fell English SC';src:url(file://${FD}/imfellenglishsc/IMFeENsc28P.ttf)}@font-face{font-family:'Alegreya Sans';font-weight:400;src:url(file://${FD}/alegreyasans/AlegreyaSans-Regular.ttf)}@font-face{font-family:'Alegreya Sans';font-weight:700;src:url(file://${FD}/alegreyasans/AlegreyaSans-Bold.ttf)}@font-face{font-family:'Alegreya Sans';font-weight:800;src:url(file://${FD}/alegreyasans/AlegreyaSans-ExtraBold.ttf)}</style>`
  : `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@400;700;800&amp;family=IM+Fell+English+SC&amp;display=swap">`;
const bg = u => LOCAL ? (u === BG_VIL ? 'village_nu.jpg' : 'avant_village.jpg') : u;
function page(title, w, h, inner, rootStyle) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
${fontsHead}
<style>
body{margin:0}
</style>
</helmet>
<div style="width: ${w}px; height: ${h}px; position: relative; overflow: hidden; font-family: ${FB}; color: #3b2a18; ${rootStyle || ''}">
${inner}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`;
}

/* ---------- pièces de l'interface ---------- */
const PANEL = 'background: #efe2c4; border: 2px solid #5a3a22; border-radius: 7px; box-shadow: inset 0 0 10px rgba(120, 80, 30, 0.22), 0 2px 0 #3e2716';
const crest = `<svg width="22" height="26" viewBox="0 0 26 30" style="display:block;flex:none" aria-hidden="true"><path d="M2 2h22v12c0 7-5 11.5-11 14C7 25.5 2 21 2 14z" fill="#c46b1e" stroke="#3e2716" stroke-width="2.2"/><path d="M4.5 4.5h8.5v20.6C8 23 4.5 19.4 4.5 14z" fill="#d98a3a" opacity=".55"/><text x="13" y="19" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="15" fill="#f4e2c6">V</text></svg>`;
const plaque = `<div style="position: absolute; left: 10px; top: 8px; width: 172px; height: 38px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 7px; ${PANEL}">
  ${crest}
  <div style="display: flex; flex-direction: column; gap: 2px; line-height: 1; min-width: 0">
    <span style="font-family: ${FT}; font-size: 18px; white-space: nowrap">Val-Brume</span>
    <span style="display: flex; align-items: center; gap: 3px; font-size: 11px; color: #6b4a2b; white-space: nowrap">${ic('s0', 12)}Printemps · jour 2</span>
  </div>
</div>`;
const cell = (k, val, sub, frac, first, color) => `<div style="position: relative; display: flex; align-items: center; gap: 4px; padding: 0 9px; ${first ? '' : 'border-left: 1px solid #d3bd92;'} font-weight: 800; font-size: 15px; line-height: 1">${ic(k, 19)}<span>${val}${sub ? `<small style="font-size: 10.5px; font-weight: 700; color: #6b4a2b">${sub}</small>` : ''}</span>${frac == null ? '' : `<i style="position: absolute; left: 9px; right: 9px; bottom: 4px; height: 2px; background: #dccaa0; border-radius: 1px"><b style="display: block; height: 100%; width: ${Math.round(frac * 100)}%; background: ${color || '#8a5a2b'}; border-radius: 1px"></b></i>`}</div>`;
const stock = `<div style="position: absolute; left: 190px; top: 8px; height: 38px; box-sizing: border-box; display: flex; ${PANEL}; overflow: hidden">
  ${cell('bois', '160', '', .2, true)}${cell('pierre', '80', '', .1)}${cell('pain', '100', '', .06)}${cell('people', '4', '/6', .67)}${cell('heart', '77', ' %', .77, false, '#b8323d')}${cell('or', '0', '', null)}
</div>`;
const medal = (inner, tag, ring, dot) => `<div style="position: relative; width: 34px; height: 34px; flex: none; box-sizing: border-box; display: grid; place-items: center; border-radius: 50%; background: #efe2c4; border: 2px solid ${ring || '#5a3a22'}; box-shadow: 0 2px 0 #3e2716${ring ? ', 0 0 0 3px rgba(214, 80, 40, 0.35)' : ''}">${inner}${tag ? `<span style="position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%); padding: 0 5px; height: 14px; line-height: 14px; border-radius: 7px; background: ${ring || '#5a3a22'}; color: #f4e2c6; font-size: 10px; font-weight: 800; white-space: nowrap">${tag}</span>` : ''}${dot ? '<span style="position: absolute; right: -2px; top: -2px; width: 10px; height: 10px; border-radius: 50%; background: #8e2a3e; border: 2px solid #efe2c4"></span>' : ''}</div>`;
const lilou = `<svg width="24" height="24" viewBox="0 0 48 48" style="display:block" aria-hidden="true"><circle cx="24" cy="26" r="16" fill="#f3cdb6" stroke="#3b2414" stroke-width="2.4"/><path d="M14 16c2-9 18-11 21-2-4-3-6-1-8-4-3 3-8 1-13 6z" fill="#f2d27a" stroke="#3b2414" stroke-width="2"/><circle cx="18" cy="24" r="2.4" fill="#3f6fd0"/><circle cx="30" cy="24" r="2.4" fill="#3f6fd0"/><path d="M17 29q7 5 14 0" stroke="#a5523f" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
const medals = `<div style="position: absolute; right: 10px; top: 9px; display: flex; gap: 8px">
  ${medal(ic('link', 20))}${medal(ic('biere', 21), '2 h')}${medal(ic('or', 21), '14 h')}${medal(ic('flame', 21), '2 h', '#a32b2b')}${medal(lilou, '', '', true)}
</div>`;
const ribbon = `<div style="position: absolute; left: 10px; top: 53px; width: 172px; height: 28px; box-sizing: border-box; display: flex; align-items: center; gap: 6px; padding: 0 8px 0 6px; ${PANEL}">
  ${ic('star', 17)}<span style="flex: 1; min-width: 0; font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">Trois maisons</span><span style="font-size: 12.5px; font-weight: 800; color: #6b4a2b">2/3</span>
  <i style="position: absolute; left: 29px; right: 8px; bottom: 4px; height: 2px; background: #dccaa0; border-radius: 1px"><b style="display: block; height: 100%; width: 67%; background: #c9922e"></b></i>
</div>`;
const navBtn = (k, label, dot) => `<div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; color: #f4e2c6; font-size: 11px; font-weight: 700; line-height: 1.05">${ic(k, 22)}<span>${label}</span>${dot ? '<span style="position: absolute; top: 2px; left: calc(50% + 8px); width: 8px; height: 8px; border-radius: 50%; background: #e0602a; border: 1.5px solid #3e2716"></span>' : ''}</div>`;
const nav = `<nav aria-label="Menus" style="position: absolute; left: 170px; bottom: 6px; width: 504px; height: 46px; box-sizing: border-box; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 3px 4px; background: #5a3a22; border: 2px solid #3e2716; border-radius: 9px; box-shadow: inset 0 2px 0 #7a5230, 0 3px 0 rgba(0, 0, 0, 0.25)">
  ${navBtn('hammer', 'Construire', 1)}${navBtn('people', 'Villageois')}${navBtn('crown', 'Brokk')}${navBtn('sword', 'Donjon')}${navBtn('shield', 'Défense', 1)}${navBtn('scroll', 'Journal', 1)}${navBtn('house', 'Village')}
</nav>`;
const btn = (label, kind, icon, extra) => {
  const st = kind === 'primary' ? 'background: #8e2a3e; color: #f4e2c6; border: 2px solid #4a1520; box-shadow: 0 3px 0 #4a1520'
    : kind === 'off' ? 'background: #e3d5b4; color: #8a7458; border: 2px solid #b9a27a; box-shadow: 0 3px 0 #b9a27a'
      : 'background: #6b4426; color: #f4e2c6; border: 2px solid #3e2716; box-shadow: 0 3px 0 #3e2716';
  return `<div style="height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border-radius: 5px; font-weight: 800; font-size: 13.5px; ${st}; ${extra || ''}">${icon || ''}${label}</div>`;
};
const chip = (k, v, short) => `<span style="display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px 0 5px; border-radius: 13px; background: ${short ? '#f3d6cf' : '#e8d8b2'}; border: 1px solid ${short ? '#b65a4a' : '#b9a27a'}; font-weight: 800; font-size: 13px; color: ${short ? '#8e2a2a' : '#3b2a18'}">${ic(k, 17)}${v}</span>`;
const panel = `<section style="position: absolute; left: 10px; top: 54px; width: 256px; box-sizing: border-box; display: flex; flex-direction: column; ${PANEL}; overflow: hidden">
  <header style="height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 5px 0 11px; background: #5a3a22; color: #f4e2c6">
    <span style="display: flex; align-items: baseline; gap: 7px"><b style="font-family: ${FT}; font-weight: 400; font-size: 19px">Halle du village</b><small style="font-size: 11.5px; color: #e3cfa0">niveau 1</small></span>
    <span style="width: 26px; height: 26px; display: grid; place-items: center; background: #3e2716; border: 1px solid #c9922e; border-radius: 4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f4e2c6" stroke-width="3" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></span>
  </header>
  <div style="display: flex; flex-direction: column; gap: 9px; padding: 9px 11px 11px">
    <p style="margin: 0; font-size: 13px; line-height: 1.3">3 bâtisseurs au plus · 2 chantiers à la fois · bâtiments jusqu’au niveau 2.</p>
    <div style="display: flex; align-items: center; gap: 6px">${chip('bois', '600', true)}${chip('pierre', '400', true)}<span style="flex: 1"></span>${btn('Niveau 2', 'off')}</div>
    <div style="display: flex; gap: 6px">${btn('Déplacer', '', '', 'height: 28px; font-size: 12.5px')}</div>
  </div>
</section>`;
const village = `<img src="${bg(BG_VIL)}" alt="Le village, sans interface" style="position: absolute; inset: 0; width: 844px; height: 390px; object-fit: cover">`;

fs.writeFileSync(path.join(OUT, 'Avant.dc.html'), page('Avant', 844, 390, `<img src="${bg(BG_AVANT)}" alt="L’interface actuelle dans un moment chargé : deux rangées en haut, les objectifs ouverts, la barre du bas" style="position: absolute; inset: 0; width: 844px; height: 390px; object-fit: cover">`, 'background: #1b241f'));
fs.writeFileSync(path.join(OUT, 'Allegee.dc.html'), page('Après, allégée', 844, 390, [village, plaque, stock, medals, ribbon, nav].join('\n'), 'background: #6b8a4a'));
fs.writeFileSync(path.join(OUT, 'Batiment.dc.html'), page('Après, un bâtiment touché', 844, 390, [village, plaque, stock, medals, panel, nav].join('\n'), 'background: #6b8a4a'));

/* ---------- cadres enluminés ---------- */
const RAR = [['Commun', '#80878f', '#ebe5d8'], ['Peu commun', '#3d8a47', '#e2ebd3'], ['Rare', '#2f63b8', '#dbe4f1'], ['Épique', '#7d3fb8', '#e9def3'], ['Légendaire', '#c47a10', '#f8e7bf']];
const corners = c => ['left: 3px; top: 3px; border-width: 2px 0 0 2px', 'right: 3px; top: 3px; border-width: 2px 2px 0 0', 'left: 3px; bottom: 3px; border-width: 0 0 2px 2px', 'right: 3px; bottom: 3px; border-width: 0 2px 2px 0'].map(p => `<i style="position: absolute; ${p}; width: 8px; height: 8px; border-style: solid; border-color: ${c}"></i>`).join('');
const frame = (k, r, sz, up, cmp, gem) => {
  const [, c, b] = RAR[r];
  return `<div style="position: relative; width: ${sz}px; height: ${sz}px; flex: none; box-sizing: border-box; display: grid; place-items: center; border-radius: 7px; background: radial-gradient(circle at 50% 42%, #fffaf0 0%, ${b} 70%); border: 3px solid ${c}; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6), 0 2px 0 rgba(59, 36, 20, 0.35)${r === 4 ? ', 0 0 12px 3px rgba(240, 170, 40, 0.65)' : ''}">${r >= 3 ? corners(r === 4 ? '#e9b43c' : '#b48ad8') : ''}${ic(k, Math.round(sz * 0.62))}${up ? `<span style="position: absolute; right: -6px; top: -7px; min-width: ${sz > 50 ? 22 : 18}px; height: ${sz > 50 ? 18 : 16}px; padding: 0 3px; box-sizing: border-box; border-radius: 9px; background: ${c}; border: 1.5px solid #3b2414; color: #fff8e6; font-size: ${sz > 50 ? 11.5 : 10.5}px; font-weight: 800; line-height: ${sz > 50 ? 15 : 13}px; text-align: center">+${up}</span>` : ''}${cmp ? `<span style="position: absolute; left: -6px; bottom: -6px; width: 18px; height: 18px; box-sizing: border-box; display: grid; place-items: center; border-radius: 50%; background: ${cmp === 1 ? '#2f8a45' : '#b24130'}; border: 1.5px solid #3b2414"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="${cmp === 1 ? 'M5 1.5 9 8H1z' : 'M5 8.5 9 2H1z'}" fill="#fff8e6"/></svg></span>` : ''}${gem ? `<span style="position: absolute; left: 50%; bottom: 3px; transform: translateX(-50%); display: flex; gap: 3px">${gem.map(g => `<i style="width: 7px; height: 7px; border-radius: 50%; border: 1px solid #3b2414; background: ${g || 'transparent'}"></i>`).join('')}</span>` : ''}</div>`;
};
const big = [['sword', 0], ['s_casque', 1, 0, 0, ['#3a7ad8']], ['s_armure', 2, 2], ['s_bijou', 3, 0, 0, ['#c0303a', '']], ['sword', 4, 5, 0, ['#c0303a', '#3a7ad8', '#3d9a4a']]]
  .map(([k, r, up, cmp, gem]) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 7px">${frame(k, r, 78, up, cmp, gem)}<span style="font-family: ${FT}; font-size: 16px; color: ${RAR[r][1]}">${RAR[r][0]}</span></div>`).join('');
const bag = [['sword', 2, 0, 1], ['s_bottes', 0, 0, -1], ['s_casque', 3, 1, 1], ['s_armure', 1], ['s_bijou', 2, 0, 1], ['sword', 4, 0, 1], ['s_bottes', 1, 3], ['s_casque', 0, 0, -1], ['s_armure', 3, 2, 1], ['s_bijou', 1]]
  .map(([k, r, up, cmp]) => frame(k, r, 52, up, cmp)).join('');
fs.writeFileSync(path.join(OUT, 'Cadres.dc.html'), page('Cadres enluminés', 844, 390, `
<div style="position: absolute; inset: 0; background: #efe2c4; box-shadow: inset 0 0 40px rgba(120, 80, 30, 0.3)"></div>
<div style="position: absolute; left: 0; right: 0; top: 22px; display: flex; justify-content: center; gap: 44px">${big}</div>
<div style="position: absolute; left: 40px; right: 40px; top: 176px; height: 2px; background: linear-gradient(90deg, transparent, #c9922e, transparent)"></div>
<div style="position: absolute; left: 0; right: 0; top: 196px; text-align: center; font-family: ${FT}; font-size: 19px">Le sac, à la vraie taille</div>
<div style="position: absolute; left: 0; right: 0; top: 232px; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; padding: 0 60px">${bag}</div>
<div style="position: absolute; left: 0; right: 0; bottom: 18px; text-align: center; font-size: 13px; color: #6b4a2b">flèche verte ou rouge : mieux ou moins bien que l’objet porté · +2 : amélioration à la forge · petits ronds : pierres serties</div>`, 'background: #efe2c4'));

/* ---------- la feuille d'icônes ---------- */
const G = [
  ['Ressources', [['bois', 'Bois'], ['pierre', 'Pierre'], ['ble', 'Blé'], ['orge', 'Orge'], ['farine', 'Farine'], ['pain', 'Pain'], ['viande', 'Viande'], ['biere', 'Bière'], ['fer', 'Fer'], ['or', 'Or']]],
  ['Saisons', [['s0', 'Printemps'], ['s1', 'Été'], ['s2', 'Automne'], ['s3', 'Hiver']]],
  ['Village et menus', [['hammer', 'Construire'], ['people', 'Villageois'], ['crown', 'Héros'], ['sword', 'Donjon'], ['shield', 'Défense'], ['scroll', 'Journal'], ['house', 'Village'], ['heart', 'Moral'], ['star', 'Objectifs'], ['link', 'Inviter'], ['flame', 'Portail'], ['flag', 'Poste de garde'], ['clock', 'Durée'], ['sound', 'Son'], ['help', 'Aide']]],
  ['Équipement', [['s_arme', 'Arme'], ['s_casque', 'Casque'], ['s_armure', 'Armure'], ['s_bottes', 'Bottes'], ['s_bijou', 'Bijou'], ['s_bag', 'Sac'], ['s_anvil', 'Forge'], ['s_paw', 'Familier']]],
  ['Donjon', [['bolt', 'Foudre'], ['feather', 'Plume'], ['arrow', 'Flèche'], ['drop', 'Sang'], ['eye', 'Œil'], ['leaf', 'Nature'], ['skull', 'Mort'], ['roll', 'Roulade'], ['potion', 'Potion']]],
];
const tile = ([k, n]) => `<div style="width: 82px; display: flex; flex-direction: column; align-items: center; gap: 5px">${ic(k, 50)}<span style="font-size: 13px; font-weight: 700; text-align: center; line-height: 1.1">${n}</span></div>`;
const sec = ([t, list]) => `<section style="display: flex; flex-direction: column; gap: 10px"><h3 style="margin: 0; font-family: ${FT}; font-weight: 400; font-size: 22px; color: #5a3a22; border-bottom: 2px solid #c9922e; padding-bottom: 3px">${t}</h3><div style="display: flex; gap: 6px">${list.map(tile).join('')}</div></section>`;
const all = G.flatMap(g => g[1]);
const strip = (bgc, px) => `<div style="display: flex; flex-wrap: wrap; gap: 9px; padding: 9px 12px; border-radius: 7px; background: ${bgc}">${all.map(x => ic(x[0], px)).join('')}</div>`;
fs.writeFileSync(path.join(OUT, 'Icones.dc.html'), page('Icônes peintes', 1768, 620, `
<div style="position: absolute; inset: 0; background: #efe2c4; box-shadow: inset 0 0 60px rgba(120, 80, 30, 0.3)"></div>
<div style="position: absolute; left: 40px; right: 40px; top: 26px; display: flex; flex-direction: column; gap: 22px">
  <div style="display: flex; gap: 56px">${sec(G[0])}${sec(G[1])}</div>
  <div style="display: flex; gap: 56px">${sec(G[2])}</div>
  <div style="display: flex; gap: 56px">${sec(G[3])}${sec(G[4])}</div>
  <div style="display: flex; flex-direction: column; gap: 8px"><h3 style="margin: 0; font-family: ${FT}; font-weight: 400; font-size: 22px; color: #5a3a22">À la vraie taille, sur parchemin et sur bois</h3>${strip('#e6d4ab', 20)}${strip('#5a3a22', 22)}</div>
</div>`, 'background: #efe2c4'));
console.log('ok', OUT);
