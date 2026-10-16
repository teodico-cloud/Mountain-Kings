/* ===================== ÉQUIPEMENT : interface (équipement du héros, sac, forge, marchand) =====================
   Ce fichier ne fait que définir des fonctions et des actions (ACT_EQ) : l'application (p4_app) les appelle. */
let bagSel = null, bagFilter = '';
const SLOT_ART = { arme: 'une arme', casque: 'un casque', armure: 'une armure', bottes: 'des bottes', bijou: 'un bijou' };
const SLOT_PLURAL = { arme: 'Armes', casque: 'Casques', armure: 'Armures', bottes: 'Bottes', bijou: 'Bijoux' };
const myBag = () => (me && me.bag && me.bag[uid]) || { it: {}, gm: {}, n: 1 };
const rcls = it => it.set ? 'rcs' : 'rc' + (it.r | 0);
const rarTag = it => `<span class="rtag ${rcls(it)}">${it.set ? 'Ensemble' : RARITY[it.r | 0].name}</span>`;
const slotIco = sl => `<span class="ic sl">${IC['s_' + sl] || ''}</span>`;
/* Cadre enluminé d'un objet : à la couleur de sa rareté (équerres pour épique, légendaire et ensemble, lueur pour le légendaire),
   pastille +N (forge), flèche verte ou rouge (comparé à l'objet porté), pierres serties. */
const KIND_ICO = { arc: 'bow', arbalete: 'bow', baton: 'staff', sceptre: 'staff', grimoire: 'book' };
const itemIco = it => IC[(it.sl === 'arme' && KIND_ICO[it.k]) || 's_' + it.sl] || '';
function itemFrame(it, cmp, cls) {
  const I = itemInfo(it), gm = I.so ? `<span class="ifg">${I.gems.map(g => `<i${g && gemOf(g) ? ` style="background:${gemOf(g).col}"` : ''}></i>`).join('')}</span>` : '';
  return `<span class="ifr fr${it.set ? 's' : it.r | 0}${cls ? ' ' + cls : ''}">${itemIco(it)}${it.up ? `<span class="ifu">+${it.up}</span>` : ''}${cmp === 1 || cmp === -1 ? `<span class="ifc ${cmp === 1 ? 'up' : 'down'}" role="img" aria-label="${cmp === 1 ? 'mieux que l’objet porté' : 'moins bien que l’objet porté'}"><svg viewBox="0 0 10 10" aria-hidden="true"><path d="${cmp === 1 ? 'M5 1.5 9 8H1z' : 'M5 8.5 9 2H1z'}"/></svg></span>` : ''}${gm}</span>`;
}
const emptyFrame = sl => `<span class="ifr fre" aria-hidden="true">${IC['s_' + sl] || ''}</span>`;
const itemNameH = it => `<b class="iname ${rcls(it)}">${esc(itemInfo(it).name)}</b>`;
const arrowH = c => c === 1 ? '<span class="arr up" aria-label="mieux que l’objet porté">▲</span>' : c === -1 ? '<span class="arr down" aria-label="moins bien que l’objet porté">▼</span>' : c === 0 ? '<span class="arr eq" aria-label="pareil que l’objet porté">=</span>' : '';
const statsTxt = o => Object.keys(o).map(k => STATS[k].t(o[k])).join(' · ');
const gemChip = (key, n) => { const G = gemOf(key); return G ? `<span class="chip gemc"><i class="gdot" style="background:${G.col}"></i>${n > 1 ? n + ' × ' : ''}${esc(G.name)}</span>` : ''; };
/* Ce que l'équipement apporte, en une phrase. */
function gearSummary(G) {
  const parts = Object.keys(STATS).filter(k => G[k] > 0).map(k => STATS[k].t(G[k]));
  return parts.length ? parts.join(', ') : '';
}
/* Une ligne d'objet (dans une liste) : nom coloré selon la rareté, niveau, bonus principaux, flèche de comparaison. */
function itemRow(it, hh, act, data, on) {
  const I = itemInfo(it), cmp = hh ? compareItem(hh, it) : null, cw = hh ? canWear(hh, it) : { ok: true };
  return `<button class="item opt irow${on ? ' on' : ''}" data-act="${act}" ${data}>
    ${itemFrame(it, cmp)}<span class="irb"><span class="head"><span class="row">${itemNameH(it)}${cmp === 0 ? arrowH(0) : ''}</span><small>${rarTag(it)} niv. ${it.il}</small></span>
    <p>${esc(statsTxt(I.main))}${Object.keys(I.af).length ? ' · ' + esc(statsTxt(I.af)) : ''}${hh && !cw.ok ? ' · <span class="why">' + esc(cw.why) + '</span>' : ''}</p></span></button>`;
}
/* Liste courte, sans bouton (bilan de donjon). */
function itemListHTML(list, hh) {
  return list.slice().sort((a, b) => b.r - a.r || b.il - a.il).map(it => { const I = itemInfo(it); return `<div class="irow2"><span class="row">${itemFrame(it, hh ? compareItem(hh, it) : null, 'sm')}${itemNameH(it)}</span><small>${rarTag(it)} ${esc(statsTxt(I.main))}</small></div>`; }).join('');
}
/* Tout sur un objet, avec ce qu'on peut en faire. where : { id } (sac) ou { hid, sl } (porté). */
function itemDetail(it, hh, where) {
  const v = me, I = itemInfo(it), f = forgeLvlOf(v), worn = !!where.hid, loc = worn ? `data-hid="${where.hid}" data-sl="${where.sl}"` : `data-id="${where.id}"`;
  const cw = hh ? canWear(hh, it) : { ok: false };
  let h = `<div class="item idet">`;
  h += `<p><b>${esc(statsTxt(I.main))}</b>${Object.keys(I.af).length ? '<br>' + esc(statsTxt(I.af)) : ''}</p>`;
  if (it.pw && POWERS[it.pw]) h += `<p class="pow"><b>${esc(POWERS[it.pw].title)}</b> : ${esc(POWERS[it.pw].txt)}</p>`;
  if (it.set && SETS[it.set]) { const S = SETS[it.set], n = hh ? gearOf(hh).sets[it.set] || 0 : 0; h += `<p class="setp"><b>${esc(S.name)}</b>${hh ? ' (' + n + ' pièce' + (n > 1 ? 's' : '') + ' sur 4 portée' + (n > 1 ? 's' : '') + ')' : ''} · 2 pièces : ${esc(S.b2t)} · 4 pièces : ${esc(S.b4t)}</p>`; }
  /* Pierres serties */
  if (I.so) {
    const stock = myBag().gm, have = Object.keys(stock).filter(k => stock[k] > 0 && gemOf(k)).sort();
    h += '<div class="sockets">';
    I.gems.forEach((g, s) => {
      if (g) h += `<div class="row split"><span class="row">${gemChip(g)}<small class="note">${esc(STATS[gemOf(g).stat].t(gemOf(g).v))}</small></span>${f ? `<button class="btn small" data-act="unsocket" ${loc} data-s="${s}">Retirer</button>` : ''}</div>`;
      else h += `<div class="row split"><span class="note">Emplacement libre pour une pierre précieuse</span></div>${f && have.length ? `<div class="chips2">${have.map(k => `<button class="btn small" data-act="socket" ${loc} data-s="${s}" data-g="${k}">${gemChip(k, stock[k])}</button>`).join('')}</div>` : ''}`;
    });
    if (!f) h += '<p class="note">Il faut une forge pour sertir une pierre.</p>';
    h += '</div>';
  }
  h += `<p class="note">Niveau requis : ${I.req}${it.sl === 'arme' ? ' · ' + esc(FAMILY_LABEL[I.fam]) : ''}${it.sl === 'bijou' ? ' · se porte au niveau ' + BIJOU_LVL : ''}${it.up ? ' · amélioré +' + it.up : ''}. Se vend ${I.sell} or${f ? ', se fond en ' + I.melt + ' fer' : ''}.</p>`;
  /* Actions */
  const btns = [];
  if (!worn && hh && cw.ok) btns.push(`<button class="btn small primary" data-act="equip" data-hid="${hh.id}" data-id="${where.id}">Équiper sur ${esc(hh.name)}</button>`);
  if (!worn && hh && !cw.ok) h += `<p class="why">${esc(cw.why)}</p>`;
  if (worn) btns.push(`<button class="btn small" data-act="unequip" ${loc}>Retirer</button>`);
  if (f) {
    const mx = maxUpOf(f), up = it.up | 0;
    if (up < 5) { const c = improveCost(it); btns.push(up < mx ? `<button class="btn small${missingTxt(v, c) ? ' off' : ''}" data-act="improve" ${loc}>Améliorer +${up + 1} <span class="sub">${chipsRes(c, v.r)}</span></button>` : `<span class="note">+${up + 1} : forge niveau ${up + 1 >= 5 ? 3 : 2}</span>`); }
  }
  if (!worn) {
    btns.push(`<button class="btn small" data-act="sell" data-id="${where.id}">Vendre <span class="sub">${ico('or')}${I.sell}</span></button>`);
    if (f) btns.push(`<button class="btn small" data-act="melt" data-id="${where.id}">Fondre <span class="sub">${ico('fer')}${I.melt}</span></button>`);
  }
  h += `<div class="row wrap">${btns.join('')}</div></div>`;
  return h;
}

/* ---------- la fiche du héros : son équipement et son familier ---------- */
function heroGearHTML(v, hh, own) {
  const G = gearOf(hh), sum = gearSummary(G), B = myBag(), f = forgeLvlOf(v);
  let h = `<div class="sec"><h4>Équipement de ${esc(hh.name)}</h4><div class="item">`;
  for (const sl of SLOTS) {
    const it = hh.eq && hh.eq[sl], lock = sl === 'bijou' && hh.lvl < BIJOU_LVL, cw = it ? canWear(hh, it) : null;
    const nBetter = own && !lock ? Object.values(B.it).filter(x => x.sl === sl && compareItem(hh, x) === 1).length : 0;
    h += `<button class="slotrow${lock ? ' off' : ''}" data-act="${own && !lock ? 'gearSlot' : 'noop'}" data-id="${hh.id}" data-sl="${sl}"${own && !lock ? '' : ' disabled'}>
      ${it ? itemFrame(it, null, 'sm') : emptyFrame(sl)}<span class="sltxt"><small>${SLOT_LABEL[sl]}</small>${it ? itemNameH(it) : `<span class="note">${lock ? 'au niveau ' + BIJOU_LVL : 'rien'}</span>`}
      ${it ? `<em>${esc(statsTxt(itemInfo(it).main))}${cw && !cw.ok ? ' · ' + esc(cw.why) : ''}</em>` : ''}</span>${nBetter ? `<span class="chip plus">▲ ${nBetter}</span>` : ''}</button>`;
  }
  if (sum) h += `<p class="note">Avec son équipement : ${esc(sum)}.</p>`;
  for (const k in G.sets) { const S = SETS[k], n = G.sets[k]; h += `<p class="setp"><b>${esc(S.name)}</b> : ${n} pièce${n > 1 ? 's' : ''} sur 4${n >= 2 ? ' · ' + esc(S.b2t) : ''}${n >= 4 ? ' · ' + esc(S.b4t) : ''}</p>`; }
  for (const p in G.pw) h += `<p class="pow"><b>${esc(POWERS[p].title)}</b> : ${esc(POWERS[p].txt)}</p>`;
  if (own) h += `<div class="row"><button class="btn small primary" data-act="sheet" data-s="bag" data-k="${hh.id}">${ico('s_bag', '')}Mon sac · ${bagCount(B)} / ${bagMax(v)}</button>${f ? `<button class="btn small" data-act="sheet" data-s="forge" data-k="${hh.id}">${ico('s_anvil', '')}La forge</button>` : ''}</div>`;
  h += '</div>';
  /* Le familier (niveau 6) */
  const pet = PETS[hh.pet] ? hh.pet : 'loup';
  h += `<div class="item"><b class="row">${ico('s_paw', 'c-tro')}Familier${hh.lvl >= PET_LVL ? ' : ' + esc(PETS[pet].name) : ' · niveau ' + PET_LVL}</b>`;
  if (hh.lvl < PET_LVL) h += `<p>Au niveau ${PET_LVL}, un animal accompagne ${esc(hh.name)} en donjon : loup, faucon, sanglier ou chouette, chacun avec son petit bonus.</p>`;
  else if (own) h += `<div class="chips2">${PET_KEYS.map(p => `<button class="btn small${p === pet ? ' primary' : ''}" data-act="pet" data-hid="${hh.id}" data-p="${p}" aria-pressed="${p === pet}">${esc(PETS[p].name)}</button>`).join('')}</div><p class="note">${esc(PETS[pet].txt)}</p>`;
  else h += `<p class="note">${esc(PETS[pet].txt)}</p>`;
  return h + '</div></div>';
}

/* ---------- le sac ---------- */
function sheetBag() {
  const v = me, B = myBag(), [hid, sl0] = String(sheetArg || '').split(':');
  const hh = (hid && v.heroes[hid] && v.heroes[hid].own === uid && v.heroes[hid]) || activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p>';
  const flt = SLOTS.includes(bagFilter) ? bagFilter : '', f = forgeLvlOf(v);
  const mine = heroesOf(v, uid);
  let h = `<p class="note">Ton sac : <b>${bagCount(B)} objet${bagCount(B) > 1 ? 's' : ''} sur ${bagMax(v)}</b>${f ? '' : ' (une forge donne 10 places de plus par niveau)'}. Les flèches comparent avec ce que porte <b>${esc(hh.name)}</b> : ▲ mieux, ▼ moins bien. Bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.</p>`;
  if (mine.length > 1) h += `<div class="chips2">${mine.map(x => `<button class="btn small${x === hh ? ' primary' : ''}" data-act="sheet" data-s="bag" data-k="${x.id}${flt ? ':' + flt : ''}">${esc(x.name)}</button>`).join('')}</div>`;
  h += `<div class="chips2 bagf"><button class="btn small${flt ? '' : ' primary'}" data-act="bagFilter" data-sl="">Tout</button>${SLOTS.map(s => `<button class="btn small${flt === s ? ' primary' : ''}" data-act="bagFilter" data-sl="${s}">${slotIco(s)}${SLOT_PLURAL[s]}</button>`).join('')}</div>`;
  /* L'objet porté à cet emplacement */
  if (flt) {
    const cur = hh.eq && hh.eq[flt];
    h += `<div class="sec"><h4>Porté par ${esc(hh.name)} · ${SLOT_LABEL[flt].toLowerCase()}</h4>`;
    h += cur ? itemRow(cur, null, 'bagSel', `data-id="eq:${flt}"`, bagSel === 'eq:' + flt) + (bagSel === 'eq:' + flt ? itemDetail(cur, hh, { hid: hh.id, sl: flt }) : '') : `<p class="note">Rien pour l’instant.</p>`;
    h += '</div>';
  }
  const wear = it => canWear(hh, it).ok ? 1 : 0;   // d'abord ce que ce héros peut porter, puis du meilleur au moins bon
  const list = Object.values(B.it).filter(it => !flt || it.sl === flt).sort((a, b) => SLOTS.indexOf(a.sl) - SLOTS.indexOf(b.sl) || wear(b) - wear(a) || itemInfo(b).score - itemInfo(a).score);
  h += `<div class="sec"><h4>Dans le sac${flt ? ' · ' + SLOT_PLURAL[flt].toLowerCase() : ''}</h4>`;
  if (!list.length) h += '<p class="note">Rien ici. Les objets se trouvent en donjon (coffres, boss, parfois un monstre), à la forge ou chez le marchand ambulant.</p>';
  for (const it of list) { h += itemRow(it, hh, 'bagSel', `data-id="${it.id}"`, bagSel === it.id); if (bagSel === it.id) h += itemDetail(it, hh, { id: it.id }); }
  const junk = Object.values(B.it).filter(it => it.r === 0 && !it.set);
  if (junk.length > 1) h += `<div class="row"><button class="btn small" data-act="sellJunk">Vendre les ${junk.length} objets communs <span class="sub">${ico('or')}${junk.reduce((a, it) => a + itemInfo(it).sell, 0)}</span></button></div>`;
  h += '</div>';
  /* Les pierres précieuses */
  const gk = Object.keys(B.gm).filter(k => B.gm[k] > 0 && gemOf(k)).sort();
  h += `<div class="sec"><h4>Pierres précieuses</h4>${gk.length ? `<div class="chips2">${gk.map(k => gemChip(k, B.gm[k])).join('')}</div><p class="note">À sertir dans un objet rare ou mieux (touche l’objet, il faut une forge). Trois pierres pareilles se fusionnent en une plus belle à la forge (niveau 2).</p>` : '<p class="note">Aucune pour l’instant : on en trouve dans les coffres et sur les boss.</p>'}</div>`;
  return h;
}

/* ---------- la forge ---------- */
function sheetForge() {
  const v = me, f = forgeLvlOf(v);
  if (!f) return `<p class="note">Il faut d’abord construire la forge (menu Construire, rubrique « Pour les héros »), et une mine de fer pour avoir du fer.</p>`;
  const hh = (sheetArg && v.heroes[sheetArg] && v.heroes[sheetArg].own === uid && v.heroes[sheetArg]) || activeHero(v, uid);
  if (!hh) return '<p class="note">Crée d’abord ton héros.</p>';
  const B = myBag(), tbl = DROP['forge' + Math.min(3, f)], c = craftCost(hh.lvl), miss = missingTxt(v, c), full = bagCount(B) >= bagMax(v);
  const mine = heroesOf(v, uid);
  let h = `<p class="note">Forge de niveau ${f} : améliorations jusqu’à +${maxUpOf(f)}${f < 3 ? ' (agrandissez-la pour aller plus loin et forger mieux)' : ''}. Fer : <b>${fmtN(v.r.fer || 0)}</b> · or : <b>${fmtN(v.r.or || 0)}</b>.</p>`;
  if (mine.length > 1) h += `<div class="chips2">${mine.map(x => `<button class="btn small${x === hh ? ' primary' : ''}" data-act="sheet" data-s="forge" data-k="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
  h += `<div class="sec"><h4>Forger pour ${esc(hh.name)} (niveau ${hh.lvl})</h4><div class="item">
    <p>Un objet de niveau ${hh.lvl}, au hasard parmi : ${tbl.map((p, r) => p ? RARITY[r].name.toLowerCase() + ' ' + p + ' %' : '').filter(Boolean).join(', ')}. Les armes sont faites pour sa classe.</p>
    <div class="row split"><span class="chips2">${chipsRes(c, v.r)}</span>${full ? '<span class="why">Sac plein</span>' : ''}</div>
    <div class="chips2">${SLOTS.map(sl => `<button class="btn small${miss || full ? ' off' : ' primary'}" data-act="craft" data-hid="${hh.id}" data-sl="${sl}">${slotIco(sl)}${SLOT_LABEL[sl]}</button>`).join('')}</div></div></div>`;
  /* Améliorer ce qu'il porte */
  const worn = SLOTS.filter(sl => hh.eq && hh.eq[sl]);
  h += `<div class="sec"><h4>Améliorer l’équipement de ${esc(hh.name)}</h4>`;
  if (!worn.length) h += '<p class="note">Il ne porte encore rien. On peut aussi améliorer un objet du sac : touche-le dans le sac.</p>';
  for (const sl of worn) {
    const it = hh.eq[sl], up = it.up | 0, cc = improveCost(it), can = up < maxUpOf(f);
    h += `<div class="item"><div class="head"><span class="row">${itemFrame(it, null, 'sm')}${itemNameH(it)}</span><small>${rarTag(it)}</small></div>
      <div class="foot"><span class="chips2">${up >= 5 ? '<span class="note">au maximum</span>' : can ? chipsRes(cc, v.r) : '<span class="note">+' + (up + 1) + ' : forge plus grande</span>'}</span>${up < 5 && can ? `<button class="btn small${missingTxt(v, cc) ? ' off' : ' primary'}" data-act="improve" data-hid="${hh.id}" data-sl="${sl}">+${up + 1}</button>` : ''}</div></div>`;
  }
  h += '<p class="note">Chaque amélioration : +10 % sur les bonus principaux de l’objet.</p></div>';
  /* Pierres : fusion */
  const gk = Object.keys(B.gm).filter(k => B.gm[k] > 0 && gemOf(k)).sort();
  h += `<div class="sec"><h4>Pierres précieuses</h4>${gk.length ? `<div class="chips2">${gk.map(k => gemChip(k, B.gm[k])).join('')}</div>` : '<p class="note">Aucune pour l’instant.</p>'}`;
  const fusable = gk.filter(k => B.gm[k] >= 3 && gemOf(k).n < 3);
  if (fusable.length) h += fusable.map(k => { const G = gemOf(k), to = gemOf(G.type + (G.n + 1)), cc = { or: GEM_FUSE_COST[G.n] }; return `<div class="row split"><span class="note">3 × ${esc(G.name)} → ${esc(to.name)}</span>${f >= 2 ? `<button class="btn small${missingTxt(v, cc) ? ' off' : ' primary'}" data-act="fuse" data-g="${k}">Fusionner <span class="sub">${chipsRes(cc, v.r)}</span></button>` : '<span class="note">forge niveau 2</span>'}</div>`; }).join('');
  h += '<p class="note">Pour sertir une pierre, ou pour fondre un objet (il rend du fer), touche-le dans ton sac.</p>';
  h += `<div class="row"><button class="btn small primary" data-act="sheet" data-s="bag" data-k="${hh.id}">${ico('s_bag', '')}Ouvrir mon sac</button></div></div>`;
  return h;
}

/* ---------- le marchand ambulant ---------- */
function sheetMerch() {
  const v = me, t = now();
  if (!merchHere(v, t)) return '<p class="note">Le marchand ambulant est reparti. Il revient un jour sur deux, avec de nouveaux objets.</p>';
  const M = v.merch, hh = activeHero(v, uid), sold = String(M.sold || ''), full = bagCount(myBag()) >= bagMax(v);
  let h = `<p class="note">Il repart dans <b>${fmtDur(merchLeaves(v, t) - t)}</b>. On paie avec la bourse commune : <b>${fmtN(v.r.or || 0)} or</b>.${hh ? ' Les flèches comparent avec ce que porte ' + esc(hh.name) + '.' : ''}</p>`;
  h += '<div class="sec"><h4>Objets</h4>';
  M.it.forEach((it, i) => {
    const done = sold.includes('i' + i + ';'), price = merchPrice(it), I = itemInfo(it);
    h += `<div class="item${done ? ' off' : ''}"><div class="head"><span class="row">${itemFrame(it, done || !hh ? null : compareItem(hh, it), 'sm')}${itemNameH(it)}</span><small>${rarTag(it)} niv. ${it.il}</small></div>
      <p>${esc(statsTxt(I.main))}${Object.keys(I.af).length ? ' · ' + esc(statsTxt(I.af)) : ''}${it.pw ? ' · <b>' + esc(POWERS[it.pw].title) + '</b> : ' + esc(POWERS[it.pw].txt) : ''}${I.so ? ' · ' + I.so + ' emplacement' + (I.so > 1 ? 's' : '') + ' de pierre' : ''}${hh && !done && !canWear(hh, it).ok ? ' · <span class="why">' + esc(canWear(hh, it).why) + '</span>' : ''}</p>
      <div class="foot"><span class="chip${(v.r.or || 0) < price ? ' short' : ''}">${ico('or')}${fmtN(price)}</span>${done ? '<span class="note">vendu</span>' : `<button class="btn small${(v.r.or || 0) < price || full ? ' off' : ' primary'}" data-act="buy" data-i="${i}">Acheter</button>`}</div></div>`;
  });
  h += '</div><div class="sec"><h4>Pierres précieuses</h4>';
  M.gm.forEach((key, i) => {
    const done = sold.includes('g' + i + ';'), price = gemPrice(key), G = gemOf(key); if (!G) return;
    h += `<div class="item${done ? ' off' : ''}"><div class="foot"><span class="row">${gemChip(key)}<small class="note">${esc(STATS[G.stat].t(G.v))}</small></span>
      <span class="row"><span class="chip${(v.r.or || 0) < price ? ' short' : ''}">${ico('or')}${fmtN(price)}</span>${done ? '<span class="note">vendu</span>' : `<button class="btn small${(v.r.or || 0) < price ? ' off' : ' primary'}" data-act="buyGem" data-g="${i}">Acheter</button>`}</span></div></div>`;
  });
  return h + '</div>' + (full ? '<p class="why">Ton sac est plein : vends ou fonds un objet pour acheter.</p>' : '');
}

/* ---------- actions de l'équipement (réunies dans ACT par p4_app) ---------- */
const eqWhere = b => b.dataset.hid ? { hid: b.dataset.hid, sl: b.dataset.sl } : { id: b.dataset.id };
const ACT_EQ = {
  bagSel: b => { bagSel = bagSel === b.dataset.id ? null : b.dataset.id; renderAll(); },
  bagFilter: b => { bagFilter = b.dataset.sl || ''; bagSel = null; renderSheet.scrolled = false; renderAll(); },
  gearSlot: b => { bagFilter = b.dataset.sl; bagSel = null; renderSheet.scrolled = false; openSheet('bag', b.dataset.id + ':' + b.dataset.sl); },
  equip: b => { const r = act({ type: 'equip', hid: b.dataset.hid, id: b.dataset.id }); if (r) { bagSel = null; const hh = me.heroes[b.dataset.hid]; toast((hh ? hh.name : 'Ton héros') + ' porte maintenant : ' + r.name + '.'); renderAll(); } },
  unequip: b => { if (act({ type: 'unequip', hid: b.dataset.hid, sl: b.dataset.sl })) { bagSel = null; renderAll(); } },
  sell: b => {
    const it = myBag().it[b.dataset.id]; if (!it) return;
    if ((it.r >= 2 || it.set) && !confirm('Vendre ' + itemInfo(it).name + ' pour ' + itemInfo(it).sell + ' or ?')) return;
    const r = act({ type: 'sell', ids: [b.dataset.id] }); if (r) { bagSel = null; toast('+' + r.gain + ' or pour la bourse commune.'); renderAll(); }
  },
  sellJunk: () => {
    const ids = Object.values(myBag().it).filter(it => it.r === 0 && !it.set).map(it => it.id); if (!ids.length) return;
    if (!confirm('Vendre les ' + ids.length + ' objets communs du sac ?')) return;
    const r = act({ type: 'sell', ids }); if (r) { bagSel = null; toast(r.n + ' objets vendus : +' + r.gain + ' or.'); renderAll(); }
  },
  melt: b => {
    const it = myBag().it[b.dataset.id]; if (!it) return;
    if ((it.r >= 2 || it.set) && !confirm('Fondre ' + itemInfo(it).name + ' pour ' + itemInfo(it).melt + ' fer ?')) return;
    const r = act({ type: 'melt', ids: [b.dataset.id] }); if (r) { bagSel = null; toast('Fondu : +' + r.gain + ' fer.'); renderAll(); }
  },
  craft: b => { const r = act({ type: 'craft', hid: b.dataset.hid, sl: b.dataset.sl }); if (r) { toast('La forge a fait : ' + r.name + ' (' + RARITY[r.r].name.toLowerCase() + '). Il est dans ton sac.'); if (r.r >= 3) SND.sfx('star'); } },
  improve: b => { const r = act(Object.assign({ type: 'improve' }, eqWhere(b))); if (r) toast('Amélioré : +' + r.up + '.'); },
  socket: b => { if (act(Object.assign({ type: 'socket', s: +b.dataset.s, g: b.dataset.g }, eqWhere(b)))) toast('Pierre sertie.'); },
  unsocket: b => { if (act(Object.assign({ type: 'unsocket', s: +b.dataset.s }, eqWhere(b)))) toast('La pierre retourne dans ton sac.'); },
  fuse: b => { const r = act({ type: 'fuse', g: b.dataset.g }); if (r) toast('Fusion réussie : ' + r.name + ' !'); },
  buy: b => { const r = act({ type: 'buy', i: +b.dataset.i }); if (r) toast('Acheté : ' + r.name + '. Il est dans ton sac.'); },
  buyGem: b => { const r = act({ type: 'buy', g: +b.dataset.g }); if (r) toast('Acheté : ' + r.name + '.'); },
  pet: b => { const p = b.dataset.p; if (act({ type: 'pet', hid: b.dataset.hid, p })) toast(PETS[p].name + ' : ' + PETS[p].txt); },
};
