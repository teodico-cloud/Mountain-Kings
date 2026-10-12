/* ===================== GARNISON : interface (caserne, soldats, postes de garde, orbes, bannières) =====================
   Les règles sont dans p2g_garnison.js (et le combat dans p2r_raid.js) ; ici, seulement ce qu'on voit et ce qu'on touche.
   Ce fichier ne fait que définir des fonctions et des actions (ACT_GAR) : l'application (p4_app) les appelle. */
let solSel = null;                               // soldat ouvert dans la fiche de la caserne
const SOL_ICO = { fant: 'shield', arch: 'arrow', lanc: 'sword', mage: 'flame' };
const solIco = type => djIco(SOL_ICO[type] || 'shield');
const orbChip = (key, n) => { const O = orbOf(key); return O ? `<span class="chip gemc"><i class="gdot round" style="background:${O.col}"></i>${n > 1 ? n + ' × ' : ''}${esc(O.name)} <span class="rtag rc${O.r}">${RARITY[O.r].name}</span></span>` : ''; };
const banChip = ban => banOk(ban) ? `<span class="chip"><span class="ic c-tro">${IC.flag}</span>${esc(BANNERS[ban.k].name)} <span class="rtag rc${ban.r}">${RARITY[ban.r].name}</span></span>` : '';
const postName = (v, b) => 'Poste ' + postNum(v, b);
function solStatus(v, s, t) {
  if (solHurt(s, t)) return 'blessé' + (s.sex === 'f' ? 'e' : '') + ' · de retour dans ' + fmtDur(s.hurt - t);
  const b = s.post && v.b.find(x => x.id === s.post);
  return b ? postName(v, b) : 'sans poste';
}
function solStatsTxt(S) {
  const p = ['vie ' + fmtN(S.hp), 'dégâts ' + String(S.dmg).replace('.', ','), 'armure ' + Math.round(S.armor * 100) + ' %'];
  if (S.dodge) p.push('esquive ' + Math.round(S.dodge * 100) + ' %');
  if (S.regen) p.push('récupère ' + String(S.regen).replace('.', ',') + ' % de vie par seconde');
  if (S.thorns) p.push('renvoie ' + Math.round(S.thorns * 100) + ' % des coups');
  return p.join(' · ');
}

/* ---------- la carte « Garnison » du menu Défense ---------- */
function garCardHTML(v) {
  const hl = hallLvl(v), cas = v.b.find(b => b.type === 'caserne'), t = now();
  if (!cas) return `<div class="item"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>${hl < 2 ? 'halle niveau 2' : 'pas encore de caserne'}</small></div>
    <p>Construisez la caserne pour recruter des soldats contre de l’or : pendant les raids, ils gardent chacun le cercle de leur poste de garde.</p>
    ${hl >= 2 ? `<div class="foot"><span class="chips2">${chipsRes(costOf('caserne', 1), v.r)}</span><button class="btn small${missingTxt(v, costOf('caserne', 1)) ? ' off' : ' primary'}" data-act="place" data-type="caserne">Construire la caserne</button></div>` : ''}</div>`;
  if (cas.lvl < 1) return `<div class="item"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>caserne en construction</small></div><p>Dès que la caserne sera finie, vous pourrez y recruter vos premiers soldats et poser un poste de garde.</p></div>`;
  const list = solList(v), hurt = list.filter(s => solHurt(s, t)).length, free = list.filter(s => !s.post).length, posts = postsOf(v), promo = list.filter(solCanPromote).length;
  const warn = [];
  if (!posts.length) warn.push('Posez un poste de garde : sans poste, les soldats restent à la caserne.');
  else if (free) warn.push(free + ' soldat' + (free > 1 ? 's' : '') + ' sans poste.');
  if (promo) warn.push(promo + ' soldat' + (promo > 1 ? 's peuvent' : ' peut') + ' monter de niveau.');
  return `<div class="item feature"><div class="head"><b class="row">${djIco('shield')}Garnison</b><small>${list.length} soldat${list.length > 1 ? 's' : ''} sur ${solCap(v)} · ${posts.length} poste${posts.length > 1 ? 's' : ''} sur ${postCap(v)}${hurt ? ' · ' + hurt + ' blessé' + (hurt > 1 ? 's' : '') : ''}</small></div>
    <p>${list.length ? 'Pendant les raids, chaque soldat garde le cercle de son poste, sans jamais en sortir.' : 'Recrutez vos premiers soldats à la caserne (contre de l’or).'}${warn.length ? ' <b>' + esc(warn.join(' ')) + '</b>' : ''}</p>
    <div class="row"><button class="btn small primary" data-act="sheet" data-s="caserne">${djIco('shield')}La caserne</button>${posts.length < postCap(v) ? `<button class="btn small" data-act="place" data-type="poste">Poser un poste <span class="sub">${chipsRes(costOf('poste', 1))}</span></button>` : ''}${posts.length && list.length ? '<button class="btn small" data-act="solAuto">Répartir</button>' : ''}</div></div>`;
}

/* ---------- la fiche de la caserne ---------- */
function solRow(v, s, t, on) {
  const ti = solTitle(s), need = solXpNeed(s.lvl);
  return `<button class="item opt srow${on ? ' on' : ''}" data-act="solSel" data-id="${s.id}">
    <div class="head"><span class="row">${solIco(s.type)}<b>${esc(solName(s))}</b>${ti ? `<span class="chip hero">${esc(ti[1])}</span>` : ''}${solCanPromote(s) ? '<span class="chip plus">▲ niveau</span>' : ''}</span><small>niveau ${s.lvl}</small></div>
    <p>${esc(solStatus(v, s, t))}${s.lvl < SOL_MAX_LVL ? ' · expérience ' + fmtN(Math.min(s.xp | 0, need)) + ' / ' + fmtN(need) : ''}</p></button>`;
}
function solDetail(v, s, t) {
  const post = s.post && v.b.find(x => x.id === s.post), S = solStats(s, post), f = forgeLvlOf(v), need = solXpNeed(s.lvl);
  let h = `<div class="item idet"><p><b>${esc(solStatsTxt(S))}</b>${SOLDIERS[s.type].range > 2 ? ' · tire à ' + String(SOLDIERS[s.type].range).replace('.', ',') + ' cases' : ''}</p>
    <p class="note">${esc(SOLDIERS[s.type].desc)} ${s.raids ? 'Raids tenus : ' + s.raids + ' · ennemis abattus : ' + (s.kills | 0) + '.' : 'Pas encore de raid.'} Repas : ${solEat(s)} rations par jour.</p>`;
  /* niveau */
  if (s.lvl < SOL_MAX_LVL) {
    const c = promoteCost(s.lvl), can = (s.xp | 0) >= need;
    h += `<div class="bar"><i style="width:${Math.min(100, (s.xp | 0) / need * 100).toFixed(0)}%"></i></div>
      <div class="foot"><span class="note">${can ? 'Prêt à monter au niveau ' + (s.lvl + 1) + (ORB_LVLS.includes(s.lvl + 1) ? ' (un emplacement d’orbe s’ouvre)' : '') : 'Expérience : ' + fmtN(s.xp | 0) + ' sur ' + fmtN(need) + '. Elle se gagne en tenant les raids.'}</span>
      ${can ? `<button class="btn small${missingTxt(v, c) ? ' off' : ' primary'}" data-act="promote" data-id="${s.id}">Niveau ${s.lvl + 1} <span class="sub">${chipsRes(c, v.r)}</span></button>` : ''}</div>`;
  } else h += '<p class="note">Niveau maximum atteint.</p>';
  const ti = solTitle(s), nx = SOL_TITLES.slice().reverse().find(x => (s.vet | 0) < x[0]);
  h += `<p class="note">${ti ? '<b>' + esc(ti[1]) + '</b> : +' + ti[2] + ' % de vie et de dégâts. ' : ''}Série : ${s.vet | 0} raid${(s.vet | 0) > 1 ? 's' : ''} sans tomber${nx ? ' (' + esc(nx[1].toLowerCase()) + ' à ' + nx[0] + ')' : ''}. Une chute remet la série à zéro.</p>`;
  /* poste */
  const posts = postsOf(v);
  h += `<div class="chips2"><span class="note">Poste :</span>${posts.map(b => { const n = guardsOf(v, b.id).length, mine = s.post === b.id; return `<button class="btn small${mine ? ' primary' : ''}${!mine && n >= POST_SLOTS ? ' off' : ''}" data-act="solPost" data-id="${s.id}" data-post="${b.id}" aria-pressed="${mine}">${esc(postName(v, b))} · ${n}/${POST_SLOTS}</button>`; }).join('')}<button class="btn small${s.post ? '' : ' primary'}" data-act="solPost" data-id="${s.id}" data-post="0" aria-pressed="${!s.post}">Aucun</button></div>`;
  if (!posts.length) h += '<p class="note">Pas encore de poste de garde : posez-en un depuis le menu Défense.</p>';
  /* équipement */
  h += `<div class="sec"><h4>Équipement</h4>`;
  if (!f) h += '<p class="note">Il faut une forge pour forger l’arme et l’armure des soldats.</p>';
  const w = s.w, a = s.a, mx = maxUpOf(f);
  const upBtn = (k, it) => !f || !it ? '' : (it.up | 0) >= 5 ? '<span class="note">au maximum</span>' : (it.up | 0) >= mx ? `<span class="note">+${(it.up | 0) + 1} : forge plus grande</span>` : `<button class="btn small${missingTxt(v, solImproveCost(it)) ? ' off' : ''}" data-act="solImprove" data-id="${s.id}" data-k="${k}">+${(it.up | 0) + 1} <span class="sub">${chipsRes(solImproveCost(it), v.r)}</span></button>`;
  h += `<div class="row split"><span><b>${w ? esc(solItemName(s, 'w')) : 'Pas d’arme'}</b>${w ? '<br><small class="note">+' + String(solWeaponDmg(w)).replace('.', ',') + ' % de dégâts</small>' : ''}</span><span class="row">${upBtn('w', w)}${f ? `<button class="btn small${missingTxt(v, solForgeCost('w', s.lvl)) ? ' off' : (w ? '' : ' primary')}" data-act="solForge" data-id="${s.id}" data-k="w">${w ? 'Reforger' : 'Forger'} (niv. ${s.lvl}) <span class="sub">${chipsRes(solForgeCost('w', s.lvl), v.r)}</span></button>` : ''}</span></div>`;
  h += `<div class="row split"><span><b>${a ? esc(solItemName(s, 'a')) : 'Pas d’armure'}</b>${a ? '<br><small class="note">+' + String(solArmorHp(a)).replace('.', ',') + ' % de vie · ' + esc(SOL_SETS[a.set].t) + '</small>' : ''}</span><span class="row">${upBtn('a', a)}</span></div>`;
  if (f) h += `<div class="chips2"><span class="note">${a ? 'Reforger' : 'Forger'} une armure (niv. ${s.lvl}, ${chipsRes(solForgeCost('a', s.lvl), v.r)}) :</span>${SOL_SET_KEYS.map(k => `<button class="btn small${missingTxt(v, solForgeCost('a', s.lvl)) ? ' off' : ''}${SOL_SETS[k].fit === s.type ? ' primary' : ''}" data-act="solForge" data-id="${s.id}" data-k="a" data-set="${k}" title="${esc(SOL_SETS[k].t)}">${esc(SOL_SETS[k].name)}<span class="sub">${esc(SOL_SETS[k].t)}</span></button>`).join('')}</div>`;
  if (f && (w || a)) h += '<p class="note">Reforger remplace l’ancienne pièce (fondue : elle rend un peu de fer).</p>';
  h += '</div>';
  /* orbes */
  const pool = Object.keys(v.orbs || {}).filter(k => v.orbs[k] > 0 && orbOf(k)).sort((x, y) => orbOf(y).r - orbOf(x).r || x.localeCompare(y));
  h += `<div class="sec"><h4>Orbes de défense</h4>`;
  ORB_LVLS.forEach((L, i) => {
    const cur = s.o && s.o['o' + i];
    if (s.lvl < L) { h += `<p class="note">Emplacement ${i + 1} : au niveau ${L}.</p>`; return; }
    if (orbOf(cur)) h += `<div class="row split"><span class="row">${orbChip(cur)}<small class="note">${esc(orbOf(cur).txt)}</small></span><button class="btn small" data-act="orbOff" data-id="${s.id}" data-s="${i}">Retirer</button></div>`;
    else h += `<div class="row split"><span class="note">Emplacement ${i + 1} libre</span></div>${pool.length ? `<div class="chips2">${pool.map(k => `<button class="btn small" data-act="orbSet" data-id="${s.id}" data-s="${i}" data-o="${k}" title="${esc(orbOf(k).txt)}">${orbChip(k, v.orbs[k])}</button>`).join('')}</div>` : ''}`;
  });
  if (s.lvl >= ORB_LVLS[0] && !pool.length) h += '<p class="note">Pas d’orbe en réserve : on en gagne en défense réussie et en donjon gagné.</p>';
  h += '</div>';
  h += `<div class="row"><button class="btn small" data-act="dismiss" data-id="${s.id}">Renvoyer</button></div></div>`;
  return h;
}
function sheetCaserne() {
  const v = me, t = now(), cas = caserneOf(v);
  if (!cas) {
    const site = v.b.find(b => b.type === 'caserne');
    return site ? '<p class="note">La caserne est en construction : les bâtisseurs y travaillent.</p>' : `<p class="note">Il faut d’abord construire la caserne (menu Construire, rubrique « Défense », halle niveau 2).</p>${hallLvl(v) >= 2 ? '<button class="btn primary" data-act="place" data-type="caserne">Construire la caserne</button>' : ''}`;
  }
  const list = solList(v), cap = solCap(v), posts = postsOf(v), hungry = (v.hunger || 0) > 0 || foodOf(v) < 1;
  let h = `<p class="note">Caserne de niveau ${cas.lvl} : <b>${list.length} soldat${list.length > 1 ? 's' : ''} sur ${cap}</b> · postes de garde : <b>${posts.length} sur ${postCap(v)}</b>${cas.lvl < 4 ? ' (agrandissez-la pour 3 soldats et un poste de plus)' : ''}. La garnison mange <b>${solFood(v)} rations par jour</b>. Bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.</p>`;
  if (hungry && list.length) h += '<p class="why">Plus rien à manger au village : vos soldats ont faim, ils frappent moins fort.</p>';
  /* recruter */
  if (list.length < cap) {
    const c = recruitCost(v), miss = missingTxt(v, c);
    h += `<div class="sec"><h4>Recruter · ${chipsRes(c, v.r)}</h4>`;
    for (const k of SOL_TYPES) {
      const S = SOLDIERS[k];
      h += `<div class="item"><div class="troop"><span class="tico">${solIco(k)}</span><div style="display:grid;gap:4px"><div class="head"><b>${esc(S.name)}</b><small>vie ${S.hp} · dégâts ${S.dmg}${S.range > 2 ? ' · tire à ' + String(S.range).replace('.', ',') + ' cases' : ''}</small></div><p>${esc(S.desc)}</p></div></div>
        <div class="foot"><span class="note">${list.filter(s => s.type === k).length ? list.filter(s => s.type === k).length + ' dans la garnison' : ''}</span><button class="btn small${miss ? ' off' : ' primary'}" data-act="recruit" data-t="${k}">Recruter</button></div></div>`;
    }
    h += '</div>';
  } else h += `<p class="note">${cap >= 12 ? 'La garnison est complète (12 soldats).' : 'La caserne est pleine : agrandissez-la pour recruter plus.'}</p>`;
  /* les soldats */
  if (list.length) {
    h += `<div class="sec"><h4>Les soldats</h4>`;
    for (const s of list) { h += solRow(v, s, t, solSel === s.id); if (solSel === s.id) h += solDetail(v, s, t); }
    h += '</div>';
  }
  /* les postes */
  h += `<div class="sec"><h4>Postes de garde</h4>`;
  if (!posts.length) h += '<p class="note">Aucun pour l’instant. Un poste garde un cercle autour de lui : placez-le sur le chemin des gobelins (près des portes, de la halle, de l’entrepôt).</p>';
  for (const b of posts) {
    const gs = guardsOf(v, b.id);
    h += `<div class="item"><div class="head"><b class="row"><span class="ic c-tro">${IC.flag}</span>${esc(postName(v, b))} · ${esc(lvlName(b).toLowerCase())}</b><small>cercle de ${postR(b)} cases · ${gs.length}/${POST_SLOTS} gardes</small></div>
      <p>${gs.length ? gs.map(s => esc(solName(s)) + (solHurt(s, t) ? ' (blessé' + (s.sex === 'f' ? 'e' : '') + ')' : '')).join(', ') : 'Personne pour l’instant.'}</p>
      ${banOk(b.ban) ? `<div class="chips2">${banChip(b.ban)}<small class="note">${esc(banTxt(b.ban))}</small></div>` : ''}
      <div class="row"><button class="btn small" data-act="postLook" data-id="${b.id}">Voir sur la carte</button></div></div>`;
  }
  h += `<div class="row">${posts.length && list.length ? '<button class="btn small primary" data-act="solAuto">Répartir tout le monde</button>' : ''}${posts.length < postCap(v) ? `<button class="btn small" data-act="place" data-type="poste">Poser un poste <span class="sub">${chipsRes(costOf('poste', 1))}</span></button>` : ''}</div>`;
  if (posts.length) h += '<p class="note">« Répartir » met un peu de chaque type à chaque poste. Touchez un poste sur la carte pour choisir ses gardes et sa bannière.</p>';
  h += '</div>';
  /* orbes en réserve */
  const ok = Object.keys(v.orbs || {}).filter(k => v.orbs[k] > 0 && orbOf(k)).sort((x, y) => x.localeCompare(y));
  h += `<div class="sec"><h4>Orbes en réserve</h4>${ok.length ? `<div class="chips2">${ok.map(k => orbChip(k, v.orbs[k])).join('')}</div>` : '<p class="note">Aucune pour l’instant : une défense réussie (rien volé) en rapporte, un donjon gagné parfois.</p>'}`;
  const fus = ok.filter(k => v.orbs[k] >= 3 && orbOf(k).r < 4);
  h += fus.map(k => { const O = orbOf(k), c = { or: ORB_FUSE[O.r] }; return `<div class="row split"><span class="note">3 × ${esc(orbLabel(k))} → ${esc(RARITY[O.r + 1].name.toLowerCase())}</span><button class="btn small${missingTxt(v, c) ? ' off' : ' primary'}" data-act="orbFuse" data-o="${k}">Fusionner <span class="sub">${chipsRes(c, v.r)}</span></button></div>`; }).join('');
  if (ok.length) h += '<p class="note">Les orbes se sertissent dans les soldats (emplacements aux niveaux 4, 8 et 12) : touchez un soldat. Trois orbes pareilles se fusionnent en une de la rareté suivante.</p>';
  h += '</div>';
  /* bannières en réserve */
  const bans = Object.values(v.bans || {}).filter(banOk).sort((x, y) => y.r - x.r);
  h += `<div class="sec"><h4>Bannières en réserve</h4>${bans.length ? bans.map(ban => `<div class="row split"><span class="row">${banChip(ban)}<small class="note">${esc(banTxt(ban))}</small></span><button class="btn small" data-act="banSell" data-ban="${ban.id}">Vendre <span class="sub">${ico('or')}${banPrice(ban)}</span></button></div>`).join('') + '<p class="note">Pour poser une bannière, touchez un poste de garde sur la carte.</p>' : '<p class="note">Aucune pour l’instant : le gardien du portail en laisse souvent une, les Profondeurs aussi (5 étages ou plus).</p>'}</div>`;
  /* aide */
  h += `<div class="sec"><h4>Comment ça marche</h4><ul class="help">
    <li>On recrute contre de l’or : 4 types de soldats. Un soldat ne travaille pas et n’a pas besoin de maison, mais il mange (un peu plus à chaque niveau).</li>
    <li>Pendant un raid, chaque soldat garde le cercle de son poste, sans jamais en sortir : fantassins et lanciers devant, du côté du portail ; archers et mages derrière.</li>
    <li>Ceux qui tiennent gagnent de l’expérience ; c’est vous qui les faites monter de niveau (jusqu’au 15), contre de l’or et de la viande (et du fer à partir du niveau 5).</li>
    <li>Un soldat abattu est blessé : 8 heures de repos à la caserne, sans rien perdre, sauf sa série de raids. 5 raids de suite sans tomber : Vétéran ; 10 : Briscard ; 20 : Héros de la garde.</li>
    <li>À la forge : une arme et une armure complète par soldat (chaque armure a son bonus d’ensemble), améliorables jusqu’à +5.</li>
    <li>Orbes (3 emplacements, aux niveaux 4, 8 et 12) et bannières (une par poste, pour tous ses gardes) se gagnent en défense réussie et en donjon.</li></ul></div>`;
  return h;
}

/* ---------- panneau d'un poste de garde (touché sur la carte) ---------- */
function postPanel(v, b) {
  const t = now(), gs = guardsOf(v, b.id), d = BLD.poste, hl = hallLvl(v);
  let h = `<div class="glass card"><h3><span class="row"><span class="ic c-tro">${IC.flag}</span>${esc(postName(v, b))}</span><span class="row"><small>${esc(lvlName(b).toLowerCase())} · ${postR(b)} cases</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>`;
  h += `<div class="workers">${gs.map(s => `<span class="chip wk">${esc(solName(s))} <b>niv. ${s.lvl}</b>${solHurt(s, t) ? ' <small class="note">blessé' + (s.sex === 'f' ? 'e' : '') + '</small>' : ''}<button class="xs" data-act="solPost" data-id="${s.id}" data-post="0" aria-label="Retirer ${esc(solName(s))}">×</button></span>`).join('')}
    ${gs.length ? '' : '<span class="note">Pas encore de garde.</span>'}</div>`;
  if (gs.length < POST_SLOTS) {
    const cand = solList(v).filter(s => s.post !== b.id).sort((x, y) => (x.post ? 1 : 0) - (y.post ? 1 : 0) || x.n - y.n);
    if (cand.length) h += `<div class="chips2"><span class="note">Ajouter :</span>${cand.slice(0, 6).map(s => `<button class="btn small" data-act="solPost" data-id="${s.id}" data-post="${b.id}" title="${esc(solStatus(v, s, t))}">${solIco(s.type)}${esc(solName(s))}</button>`).join('')}${cand.length > 6 ? '<button class="btn small" data-act="sheet" data-s="caserne">Tous…</button>' : ''}</div>`;
    else if (!solList(v).length) h += `<p class="note">Recrutez des soldats à la caserne.</p>`;
  } else h += `<p class="note">Poste complet (${POST_SLOTS} gardes).</p>`;
  /* bannière */
  const pool = Object.values(v.bans || {}).filter(banOk).sort((x, y) => y.r - x.r);
  if (banOk(b.ban)) h += `<div class="row split"><span class="row">${banChip(b.ban)}<small class="note">${esc(banTxt(b.ban))} (tous ses gardes)</small></span><button class="btn small" data-act="banOff" data-id="${b.id}">Retirer</button></div>`;
  else h += `<p class="note">Pas de bannière.${pool.length ? '' : ' Le gardien du portail en laisse souvent une.'}</p>`;
  if (pool.length) h += `<div class="chips2"><span class="note">${banOk(b.ban) ? 'Changer :' : 'Poser :'}</span>${pool.slice(0, 6).map(ban => `<button class="btn small" data-act="banSet" data-id="${b.id}" data-ban="${ban.id}" title="${esc(banTxt(ban))}">${banChip(ban)}</button>`).join('')}</div>`;
  /* améliorer */
  const to = b.lvl + 1;
  if (to <= d.max) {
    if (to > maxLvlOf('poste', hl)) h += '<p class="note">Agrandissez d’abord la halle du village pour aller plus loin.</p>';
    else { const c = costOf('poste', to), miss = missingTxt(v, c); h += `<div class="row split"><span class="note">${esc(d.lvlNames[to - 1])} : cercle de ${d.zone[to - 1]} cases</span><span class="row"><span class="chips2">${chipsRes(c, v.r)}</span><button class="btn small${miss ? ' off' : ' primary'}" data-act="upgrade" data-id="${b.id}">Améliorer</button></span></div>`; }
  } else h += '<p class="note">Niveau maximum atteint.</p>';
  h += `<div class="row"><button class="btn small" data-act="move" data-id="${b.id}">Déplacer</button><button class="btn small" data-act="demolish" data-id="${b.id}">Retirer</button><button class="btn small" data-act="sheet" data-s="caserne">${djIco('shield')}La caserne</button></div>`;
  return h + '</div>';
}
/* Un soldat touché sur la carte */
function solPersonPanel(v, sid) {
  const s = v.sol && v.sol[sid]; if (!s) return '';
  const t = now(), ti = solTitle(s);
  return `<div class="glass card"><h3><span class="row">${solIco(s.type)}${esc(solName(s))}</span><span class="row"><small>niveau ${s.lvl}${ti ? ' · ' + esc(ti[1].toLowerCase()) : ''}</small><button class="x" data-act="desel" aria-label="Fermer">×</button></span></h3>
    <p class="note">${esc(solStatus(v, s, t))} · ${esc(solStatsTxt(solStats(s, s.post && v.b.find(x => x.id === s.post))))}</p>
    <div class="row"><button class="btn small primary" data-act="solOpen" data-id="${s.id}">Sa fiche à la caserne</button></div></div>`;
}

/* ---------- au village : les soldats debout à leur poste (même formation qu'au raid), les autres à la caserne ---------- */
function solVillageSpots(v, t) {
  const out = new Map(), posts = postsOf(v); if (!posts.length || !v.sol) return out;
  const occ = new Uint8Array(GRID * GRID);
  for (const b of v.b) {
    const d = BLD[b.type]; if (!d || d.def === 'trap' || d.def === 'post' || b.type === 'porte' || b.type === 'marchand' || isBroken(b)) continue;
    for (let i = 0; i < d.size; i++) for (let j = 0; j < d.size; j++) { const x = b.gx + i, z = b.gz + j; if (x >= 0 && z >= 0 && x < GRID && z < GRID) occ[z * GRID + x] = 1; }
  }
  const blocked = (cx, cy) => cx < 0 || cy < 0 || cx >= GRID || cy >= GRID || !!occ[cy * GRID + cx];
  const open = raidInfo(v, t).p.filter(p => !p.cl), hall = v.b.find(b => b.type === 'halle');
  for (const b of posts) {
    const gs = solList(v).filter(s => s.post === b.id && !solHurt(s, t)); if (!gs.length) continue;
    const P0 = { x: b.gx + 0.5, y: b.gz + 0.5, r: postR(b) };
    let dx = 0, dy = -1, bd = 1e18;
    if (open.length) { for (const p of open) { const ex = p.x + 0.5 - P0.x, ey = p.y + 0.5 - P0.y, d2 = ex * ex + ey * ey; if (d2 < bd && d2 > 1e-6) { bd = d2; const L = Math.sqrt(d2); dx = ex / L; dy = ey / L; } } }
    else if (hall) { const ex = P0.x - (hall.gx + BLD.halle.size / 2), ey = P0.y - (hall.gz + BLD.halle.size / 2), L = Math.sqrt(ex * ex + ey * ey); if (L > 1e-6) { dx = ex / L; dy = ey / L; } }
    const sp = solFormation(P0, gs.map(s => s.type), dx, dy, blocked);
    gs.forEach((s, i) => out.set(s.id, { x: sp[i][0], y: sp[i][1], fx: dx, fy: dy }));
  }
  return out;
}
function solPeople(v) {
  if (!v.sol) return [];
  const t = now(), cas = caserneOf(v), spots = solVillageSpots(v, t), out = [];
  for (const s of solList(v)) {
    const sp = spots.get(s.id);
    out.push({ key: 'g' + s.id, kind: 'sol', race: s.race, sex: s.sex, type: s.type, name: solName(s), at: sp || !cas ? null : 'm' + cas.id, fixed: sp ? [sp.x, sp.y] : null, face: sp ? [sp.fx, sp.fy] : null, hurt: solHurt(s, t) });
  }
  return out;
}
/* Cercles des postes : celui du poste choisi (ou en cours de pose), tous quand la caserne est choisie. */
let ringSig = '';
function postRings(v, editable) {
  const rings = [], selB = editable && sel != null && !place ? v.b.find(x => x.id === sel) : null;
  if (selB && (selB.type === 'poste' || selB.type === 'caserne')) for (const b of postsOf(v)) if (selB.type === 'caserne' || b.id === selB.id) rings.push({ x: b.gx + 0.5, z: b.gz + 0.5, r: postR(b) });
  if (editable && place && place.type === 'poste') { const pb = place.kind === 'move' ? v.b.find(x => x.id === place.id) : null; rings.push({ x: place.gx + 0.5, z: place.gz + 0.5, r: pb ? postR(pb) : BLD.poste.zone[0] }); }
  const sig = rings.map(r => r.x + ',' + r.z + ',' + r.r).join(';');
  if (sig !== ringSig) { ringSig = sig; V3.showRanges(rings.length ? rings : null); }
}

/* ---------- actions (réunies dans ACT par l'application) ---------- */
const ACT_GAR = {
  recruit: b => { const r = act({ type: 'recruit', t: b.dataset.t }); if (r) { solSel = r.id; toast(r.name + ' rejoint la garnison' + (r.post ? ' (' + postName(me, me.b.find(x => x.id === r.post) || { id: 0 }) + ').' : ' : posez un poste de garde pour lui donner un cercle à garder.')); } },
  solSel: b => { solSel = solSel === b.dataset.id ? null : b.dataset.id; renderAll(); },
  solOpen: b => { solSel = b.dataset.id; sel = null; selP = null; refreshScene(); openSheet('caserne'); },
  solPost: b => { const s = me.sol && me.sol[b.dataset.id], to = +b.dataset.post; if (act({ type: 'solPost', sid: b.dataset.id, post: to }) && s) toast(solName(s) + (to ? ' garde le ' + postName(me, me.b.find(x => x.id === to) || { id: to }).toLowerCase() + '.' : ' quitte son poste.')); },
  solAuto: () => { const r = act({ type: 'solAuto' }); if (r) toast(r.n + ' soldat' + (r.n > 1 ? 's répartis' : ' réparti') + ' sur ' + r.p + ' poste' + (r.p > 1 ? 's' : '') + '.'); },
  promote: b => { const s = me.sol && me.sol[b.dataset.id], r = act({ type: 'promote', sid: b.dataset.id }); if (r && s) toast(solName(s) + ' passe au niveau ' + r.lvl + (r.orb ? ' : un emplacement d’orbe s’ouvre !' : '.')); },
  dismiss: b => { const s = me.sol && me.sol[b.dataset.id]; if (!s || !confirm('Renvoyer ' + solName(s) + ' (niveau ' + s.lvl + ') ? Ses orbes retournent dans la réserve, son équipement est fondu.')) return; if (act({ type: 'dismiss', sid: s.id })) { solSel = null; toast(solName(s) + ' quitte la garnison.'); } },
  solForge: b => {
    const s = me.sol && me.sol[b.dataset.id], k = b.dataset.k; if (!s) return;
    if (s[k] && !confirm('Forger une nouvelle pièce ? L’ancienne (' + solItemName(s, k) + ') sera fondue.')) return;
    const r = act({ type: 'solForge', sid: s.id, k, set: b.dataset.set }); if (r) toast('Forgé pour ' + solName(s) + ' : ' + r.name + (r.back ? ' (+' + r.back + ' fer de l’ancienne)' : '') + '.');
  },
  solImprove: b => { const r = act({ type: 'solImprove', sid: b.dataset.id, k: b.dataset.k }); if (r) toast('Amélioré : +' + r.up + '.'); },
  orbSet: b => { const r = act({ type: 'orbSet', sid: b.dataset.id, s: +b.dataset.s, o: b.dataset.o }); if (r) toast(r.name + ' sertie.'); },
  orbOff: b => { if (act({ type: 'orbOff', sid: b.dataset.id, s: +b.dataset.s })) toast('L’orbe retourne dans la réserve.'); },
  orbFuse: b => { const r = act({ type: 'orbFuse', o: b.dataset.o }); if (r) toast('Fusion réussie : ' + r.name + ' !'); },
  banSet: b => { const r = act({ type: 'banSet', id: +b.dataset.id, ban: b.dataset.ban }); if (r) toast(r.name + ' flotte sur le poste.'); },
  banOff: b => { if (act({ type: 'banOff', id: +b.dataset.id })) toast('La bannière retourne dans la réserve.'); },
  banSell: b => { const ban = me.bans && me.bans[b.dataset.ban]; if (!ban || (ban.r >= 2 && !confirm('Vendre ' + banLabel(ban) + ' pour ' + banPrice(ban) + ' or ?'))) return; const r = act({ type: 'banSell', ban: ban.id }); if (r) toast('+' + r.gain + ' or pour la bourse commune.'); },
  postLook: b => { const p = me.b.find(x => x.id === +b.dataset.id); if (!p) return; closeSheet(true); sel = p.id; selP = null; if (gl) V3.focus(p.gx + 0.5, p.gz + 0.5); refreshScene(); renderAll(); },
};
