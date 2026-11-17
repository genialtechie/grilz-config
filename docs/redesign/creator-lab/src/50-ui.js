
  // =====================================================================
  // The creator: start empty or from a build, then change anything, like building a player in a football game.
  // Prototype switches compare two openings, two layouts and two ways of guiding.
  // =====================================================================
  var tray = $('tray'), sheet = $('sheet'), proto = $('proto'), bubble = $('bubble');
  var CATS = [['teeth', 'Teeth'], ['metal', 'Metal'], ['finish', 'Finish'], ['stones', 'Stones'], ['extras', 'Extras']];
  ui.open = 'a'; ui.layout = 'menu'; ui.guide = 'stuck'; ui.cat = null; ui.build = null; ui.visited = {}; ui.q = 0; ui.qWhere = 'both';
  ui.t0 = 0; ui.tDone = 0; ui.taps = 0; ui.lastTouch = performance.now(); ui.quietUntil = 0; ui.bub = null; ui.extra = null;
  var ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M9 4.2 12.8 8 9 11.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var BACK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H3.5M7 4.2 3.2 8 7 11.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.style.opacity = '1'; clearTimeout(toast.t); toast.t = setTimeout(function () { t.style.opacity = '0'; }, 3400); }
  function mmss(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function elapsed() { return ui.t0 ? ((ui.tDone || performance.now()) - ui.t0) / 1000 : 0; }
  function catIndex(c) { for (var k = 0; k < CATS.length; k++) if (CATS[k][0] === c) return k; return -1; }

  // ---------- starting builds ----------
  var BUILDS = [
    ['gold6', 'Gold 6 top', [6, 0, 'gold'], function () { setRange(6, 0); }],
    ['gold66', 'Gold 6 × 6', [6, 6, 'gold'], function () { setRange(6, 6); }],
    ['iced8', 'Iced 8 bottom', [0, 8, 'iced'], function () { DEF.type = 'iced'; setRange(0, 8); }],
    ['fangs', 'Iced fangs', [6, 0, 'fangs'], LOOKS.fangs[1]],
    ['tone', 'Two-tone 6 × 6', [6, 6, 'tone'], LOOKS.tone[1]],
    ['open', 'Open face 6 × 6', [6, 6, 'open'], LOOKS.open[1]],
    ['oneof', 'One-of-one', [6, 6, 'oneof'], LOOKS.oneof[1]]
  ];
  function buildById(id) { return BUILDS.filter(function (b) { return b[0] === id; })[0]; }
  function setSvg(top, bot, kind) {      // a set drawn as two rows of teeth
    var gold = '#d9ad45', white = '#cfd3d6', s = '<svg viewBox="0 0 120 80" aria-hidden="true">';
    [[top, 14], [bot, 44]].forEach(function (rw, r) {
      for (var k = 0; k < 16; k++) {
        var on = k >= (16 - rw[0]) / 2 && k < (16 + rw[0]) / 2, x = 4 + k * 7, y = rw[1], i = k - (16 - rw[0]) / 2;
        if (!on) { s += '<rect x="' + x + '" y="' + y + '" width="6" height="20" rx="2.2" fill="rgba(18,18,17,.09)"/>'; continue; }
        var iced = kind === 'iced' || kind === 'fangs' || (kind === 'oneof' && r === 0 && (i < 2 || i > 3)), fang = kind === 'fangs' && r === 0 && (i === 0 || i === rw[0] - 1), fill = kind === 'tone' && (i === rw[0] / 2 - 1 || i === rw[0] / 2) ? white : gold;
        if (kind === 'open') s += '<rect x="' + (x + .8) + '" y="' + (y + .8) + '" width="4.4" height="18.4" rx="2" fill="none" stroke="' + gold + '" stroke-width="1.6"/>';
        else if (fang) s += '<path d="M' + x + ' ' + y + 'h6v13l-3 9l-3 -9z" fill="#f4f7f9" stroke="' + gold + '" stroke-width="1"/>';
        else s += '<rect x="' + x + '" y="' + y + '" width="6" height="20" rx="2.2" fill="' + (iced ? '#f4f7f9' : fill) + '"' + (iced ? ' stroke="' + gold + '" stroke-width="1"' : '') + '/>';
        if (kind === 'oneof' && !iced) s += '<circle cx="' + (x + 3) + '" cy="' + (y + 10) + '" r="2" fill="' + ['#55101a', '#0c3d27', '#1d49c8', '#3a2212'][(k + r) % 4] + '"/>';
      }
    });
    return s + '</svg>';
  }
  var priceCache = {};
  function priceOf(id) {                 // what a build costs, worked out on the side
    if (priceCache[id]) return priceCache[id];
    var kT = JSON.stringify(T), kD = JSON.stringify(DEF), kS = JSON.stringify({ fangs: SET.fangs, cut: SET.cut, ins: SET.ins }), look = ui.look;
    resetAll(); buildById(id)[3](); var b = breakdown();
    T = JSON.parse(kT); DEF = JSON.parse(kD); var ks = JSON.parse(kS); SET.fangs = ks.fangs; SET.cut = ks.cut; SET.ins = ks.ins; ui.look = look; if (window.__vvs) window.__vvs.T = T;
    return (priceCache[id] = b.quote ? 'Quoted' : 'From ' + money(b.total));
  }
  function applyBuild(id) {
    resetAll(); if (id !== 'empty') buildById(id)[3](); ui.build = id; clearPicks();
    G.sync(); if (id !== 'empty') { G.pop(); G.glint(); } meta();
  }

  // ---------- the openings ----------
  function renderOpenings() {
    var empty = '<button type="button" class="build empty" data-build="empty" aria-pressed="' + (ui.build === 'empty') + '"><span class="pic"><i>+</i></span><b>Start empty</b><span>Pick every tooth</span></button>';
    $('buildsA').innerHTML = empty + BUILDS.map(function (b) { return '<button type="button" class="build" data-build="' + b[0] + '" aria-pressed="' + (ui.build === b[0]) + '"><span class="pic">' + setSvg(b[2][0], b[2][1], b[2][2]) + '</span><b>' + b[1] + '</b><span>' + priceOf(b[0]) + '</span></button>'; }).join('');
    $('goA').innerHTML = ui.build && ui.build !== 'empty' ? 'Customise this build ' + ARROW : 'Start empty ' + ARROW;
    $('buildsB').innerHTML = '<button type="button" class="card empty" data-pick="empty"><span class="pic"><i>+</i></span><b>Start empty</b><span>Pick every tooth yourself</span></button>' +
      BUILDS.map(function (b) { return '<button type="button" class="card" data-pick="' + b[0] + '"><span class="pic">' + setSvg(b[2][0], b[2][1], b[2][2]) + '</span><b>' + b[1] + '</b><em>' + priceOf(b[0]) + '</em></button>'; }).join('');
  }
  function startCreator() {
    if (!ui.t0) ui.t0 = performance.now(); freshHistory();
    ui.cat = null; clearPicks(); ui.visited = {}; ui.extra = null;
    if (!onList().length) {
      ui.build = 'empty';
      if (ui.guide === 'start') { ui.q = 0; setMode('q'); refresh(); return; }
      if (ui.layout === 'steps' || ui.struct === 'strip') { ui.cat = 'teeth'; ui.visited.teeth = 1; }
    } else if (ui.layout === 'steps' || ui.struct === 'strip') { ui.cat = 'teeth'; ui.visited.teeth = 1; }
    setMode('build'); refresh(true);
  }

  // ---------- the creator panel ----------
  function pic(key, t, opt, fallback) { var u = G.ready ? G.thumb(key, t, opt) : ''; return u ? '<img alt="" src="' + u + '">' : '<i style="width:40px;height:40px;border-radius:50%;background:' + (fallback || '#e0a93f') + '"></i>'; }
  function tile(g, k, title, sub, on, picture, off) { return '<button type="button" class="tile" data-g="' + g + '" data-k="' + k + '" aria-pressed="' + !!on + '"' + (off ? ' disabled' : '') + '><span class="pic">' + picture + '</span><b>' + title + '</b><span>' + (sub || '&nbsp;') + '</span></button>'; }
  function chip(g, k, label, on, em, off) { return '<button type="button" class="chip" data-g="' + g + '" data-k="' + k + '" aria-pressed="' + !!on + '"' + (off ? ' disabled' : '') + '>' + label + (em ? ' <em>' + em + '</em>' : '') + '</button>'; }
  var SWATCH = { yellow: '#e0a93f', white: '#dcd9d2', rose: '#dd9274', silver: '#cfd4da', platinum: '#b8c0c8' };
  function clearPicks() { ui.picks = []; ui.sel = null; }
  function distinct(f) { var out = []; targets().forEach(function (k) { var v = f(T[k]); if (out.indexOf(v) < 0) out.push(v); }); return out; }
  function val(f, noun) { var d = distinct(f); return d.length === 1 ? d[0] : d.length + ' ' + noun; }
  function firstWith(f) { var seen = {}, out = []; targets().forEach(function (k) { var v = f(T[k]); if (!seen[v]) { seen[v] = 1; out.push(T[k]); } }); return out; }
  // quick groups of the teeth in the set, to edit together
  var GROUPS = [['top', 'Top row'], ['bottom', 'Bottom row'], ['front', 'Front teeth'], ['canines', 'Canines'], ['alt', 'Every other']];
  function groupTeeth(g) {
    var on = onList();
    if (g === 'top') return on.filter(function (k) { return k < 16; });
    if (g === 'bottom') return on.filter(function (k) { return k >= 16; });
    if (g === 'front') return on.filter(function (k) { return [6, 7, 8, 9, 22, 23, 24, 25].indexOf(k) >= 0; });
    if (g === 'canines') return on.filter(function (k) { return [5, 10, 21, 26].indexOf(k) >= 0; });
    var out = []; [on.filter(function (k) { return k < 16; }), on.filter(function (k) { return k >= 16; })].forEach(function (row) { row.forEach(function (k, i) { if (i % 2 === 0) out.push(k); }); }); return out;
  }
  function sameSet(a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); }
  function changeBar() {                 // on the stage, beside the mouth tools: which teeth the next choice goes to
    var bar = $('changebar'), show = ui.mode === 'build' && onList().length > 0 && ui.cat !== 'teeth' && ui.layout === 'menu';
    bar.hidden = !show; app.toggleAttribute('data-change', show); if (!show) return;
    bar.innerHTML = applyRow();
    var on = bar.querySelector('.chip[aria-pressed="true"]'); if (on && (on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth || on.offsetLeft < bar.scrollLeft)) bar.scrollLeft = Math.max(0, on.offsetLeft - 70);
  }
  function applyRow() {                  // which teeth the choices go to
    var on = onList(), pk = picked(), mine = pk.length > 0;
    var chips = GROUPS.map(function (g) { var tg = groupTeeth(g[0]); if (!tg.length || tg.length === on.length) return ''; var hit = mine && sameSet(pk, tg); if (hit) mine = false; return chip('pick', g[0], g[1], hit); }).join('');
    return '<span class="lab">Select teeth</span><div class="chips">' + chip('pick', 'all', 'Whole set', !pk.length) + chips + (mine ? chip('pick', 'mine', pk.length + (pk.length === 1 ? ' tooth' : ' teeth') + ' picked', true) : '') + '</div>';
  }
  var INTRO = {
    teeth: 'Pick a set, or tap teeth on the 3D to add or remove them one by one.',
    metal: 'The metal for your teeth. To change only some, tap them on the 3D or pick a group.',
    finish: 'How the metal looks. To change only some teeth, tap them on the 3D or pick a group.',
    stones: 'Set stones into the metal: pick a setting, then the stone. Works on a group or single teeth too.',
    extras: 'Optional touches. Turn on the ones you want.'
  };
  var INSIDE = { teeth: SETS.length + ' sets, or any tooth', metal: '5 metals · 10K, 14K, 18K', finish: '6 finishes + photo', stones: '3 settings · 3 stones', extras: 'Fangs · initials · charms · permanent look · your idea' };
  var ICON = {
    teeth: '<path d="M6 4.5c1.2-.8 2.6-.6 4 0 1.4-.6 2.8-.8 4 0 1.8 1.2 1.6 4 .9 6-.6 1.8-.8 4.6-1.8 5.6-1 .9-1.5-1-1.9-2.6-.3-1.1-.6-1.6-1.2-1.6s-.9.5-1.2 1.6c-.4 1.6-.9 3.5-1.9 2.6-1-1-1.2-3.8-1.8-5.6-.7-2-.9-4.8.9-6z"/>',
    metal: '<path d="M3.5 13.5 6 7.5h8l2.5 6z"/><path d="M7.5 7.5 9 4.5h2l1.5 3"/>',
    finish: '<path d="M10 3v3M10 14v3M3 10h3M14 10h3M5.2 5.2l2 2M12.8 12.8l2 2M14.8 5.2l-2 2M7.2 12.8l-2 2"/>',
    stones: '<path d="M5 4h10l3 4-8 9-8-9z"/><path d="M2 8h16M8 4 7 8l3 9 3-9-1-4"/>',
    extras: '<path d="M10 4v12M4 10h12"/>'
  };
  function icon(c) { return '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICON[c] + '</svg>'; }
  function stack(items) { return items.length === 1 ? items[0] : '<span class="stack n' + Math.min(3, items.length) + '">' + items.slice(0, 3).map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</span>'; }
  function preview(c) {
    if (!onList().length && c !== 'teeth') return '<span class="dash">—</span>';
    if (c === 'teeth') { var n = counts(); return setSvg(n[0], n[1], 'gold'); }
    if (c === 'metal') return stack(firstWith(function (t) { return t.metal; }).map(function (t) { return '<i class="swatch" style="background:' + SWATCH[t.metal] + '"></i>'; }));
    if (c === 'finish') return stack(firstWith(function (t) { return t.type === 'photo' ? 'photo' : t.style; }).map(function (t) { return pic('s' + t.style + t.metal + t.type, { metal: t.metal, karat: t.karat, style: t.style, type: t.type, opal: t.opal }, null, SWATCH[t.metal]); }));
    if (c === 'stones') { var st = firstWith(function (t) { return t.type === 'iced' ? t.setting : 'none'; }); if (st.length === 1 && st[0].type !== 'iced') return '<span class="dash">None</span>'; return stack(st.map(function (t) { return t.type === 'iced' ? pic('i' + t.setting + t.metal, { metal: t.metal, karat: t.karat, type: 'iced', setting: t.setting }, null, '#f4f7f9') : '<span class="dash">None</span>'; })); }
    var x = (SET.fangs ? 1 : 0) + (insOn() ? 1 : 0) + (charmCount() ? 1 : 0) + (SET.cut === 'permanent' ? 1 : 0) + (SET.idea || SET.inspo ? 1 : 0);
    return '<span class="dash">' + (x ? '+' + x : '—') + '</span>';
  }
  function rowValue(c) {
    if (c === 'teeth') return onList().length ? lookLabel() : 'Start here: pick your teeth';
    if (!onList().length) return 'Pick teeth first';
    if (c === 'metal') return val(metalWords, 'metals').replace(/^./, function (x) { return x.toUpperCase(); });
    if (c === 'finish') return val(function (t) { return t.type === 'photo' ? 'Photo' : STYLES[t.style][0]; }, 'finishes');
    if (c === 'stones') return val(function (t) { return t.type === 'iced' ? SETTINGS[t.setting][0] + ', ' + STONES[t.stone][0].toLowerCase() : 'None'; }, 'settings');
    var e = []; if (SET.fangs) e.push('Fangs'); if (insOn()) e.push('"' + SET.ins.text + '"'); if (charmCount()) e.push(charmCount() + (charmCount() === 1 ? ' charm' : ' charms')); if (SET.cut === 'permanent') e.push('Permanent look'); if (SET.idea || SET.inspo) e.push('Your idea');
    return e.length ? e.join(', ') : 'None';
  }
  function options(c) {
    var cc = cur(), n = counts(), h = '';
    if (c === 'teeth') {
      h = '<div class="tiles">' + SETS.map(function (x, q) { return tile('set', q, x[0], (x[1] + x[2]) + (x[1] + x[2] === 1 ? ' tooth' : ' teeth'), x[1] === n[0] && x[2] === n[1] && isCentered(), setSvg(x[1], x[2], 'gold')); }).join('') + '</div>' +
        '<div class="counts"><span class="cnt"><span class="lab">Top</span><button type="button" data-g="cnt" data-k="t-" aria-label="One fewer top tooth">−</button><b>' + n[0] + '</b><button type="button" data-g="cnt" data-k="t+" aria-label="One more top tooth">+</button></span><span class="cnt"><span class="lab">Bottom</span><button type="button" data-g="cnt" data-k="b-" aria-label="One fewer bottom tooth">−</button><b>' + n[1] + '</b><button type="button" data-g="cnt" data-k="b+" aria-label="One more bottom tooth">+</button></span></div>';
    } else if (!onList().length) {
      h = '<p class="note">Pick your teeth first, then everything else opens up.</p><button type="button" class="cta ghost" data-open="teeth" style="flex:none">Pick teeth</button>';
    } else if (c === 'metal') {
      h = '<div class="tiles">' + Object.keys(METALS).map(function (k) { return tile('metal', k, METALS[k].name, cc.metal === k ? 'Selected' : delta(function (x) { x.metal = k; }), cc.metal === k, pic('m' + k, { metal: k, karat: '14k' }, null, SWATCH[k])); }).join('') + '</div>' +
        '<p class="lab">Karat</p><div class="chips">' + Object.keys(KARATS).map(function (k) { var g2 = isGold(cc.metal); return chip('karat', k, KARATS[k][0], g2 && cc.karat === k, g2 ? (cc.karat === k ? KARATS[k][1] : delta(function (x) { x.karat = k; })) : '', !g2); }).join('') + '</div>' + (isGold(cc.metal) ? '' : '<p class="locked">Karats are for gold. ' + METALS[cc.metal].name + ' comes in one grade.</p>');
    } else if (c === 'finish') {
      var iced = cc.type === 'iced';
      h = (iced ? '<p class="note">With stones set, the finish is the frame around them: solid or open face.</p>' : '') + '<div class="tiles">' + Object.keys(STYLES).map(function (k) { var off = iced && k !== 'solid' && k !== 'open'; return tile('style', k, STYLES[k][0], cc.type !== 'photo' && cc.style === k ? STYLES[k][1] : delta(function (x) { x.style = k; if (x.type === 'photo') x.type = 'plain'; }) || STYLES[k][1], cc.type !== 'photo' && cc.style === k, pic('s' + k + cc.metal, { metal: cc.metal, karat: cc.karat, style: k, opal: cc.opal, type: iced ? 'iced' : 'plain' }), off); }).join('') +
        tile('photo', 'on', 'Photo', '+$' + PRICE.photo + ' an order', cc.type === 'photo', pic('photo' + cc.metal, { metal: cc.metal, karat: cc.karat, type: 'photo' }), iced) + '</div>';
      var opalOn = cc.type !== 'photo' && cc.style === 'opal' && !iced;
      h += '<p class="lab">Opal colour</p><div class="chips">' + Object.keys(OPALS).map(function (k) { return chip('opal', k, '<i style="width:12px;height:12px;border-radius:50%;background:' + OPALS[k][1] + ';display:inline-block"></i>' + OPALS[k][0], opalOn && cc.opal === k, '', !opalOn); }).join('') + '</div>' + (opalOn ? '' : '<p class="locked">Pick Opals to choose a colour.</p>');
      h += '<p class="lab">Your photo</p>' + (cc.type === 'photo' ? '<label class="up">' + (SET.photo ? '<img alt="" src="' + SET.photo + '">' : '') + '<span>' + (SET.photo ? 'Change the photo' : 'Add your photo') + '</span><input type="file" accept="image/*" data-up="photo"></label>' : '<p class="locked">Pick Photo to put your own image on the teeth.</p>');
    } else if (c === 'stones') {
      var on = cc.type === 'iced';
      h = '<div class="tiles">' + tile('setting', 'none', 'No stones', on ? delta(function (x) { x.type = 'plain'; }) : 'Selected', !on, pic('none' + cc.metal, { metal: cc.metal, karat: cc.karat })) + Object.keys(SETTINGS).map(function (k) { return tile('setting', k, SETTINGS[k][0], on && cc.setting === k ? SETTINGS[k][1] : delta(function (x) { x.type = 'iced'; x.setting = k; if (x.style !== 'open') x.style = 'solid'; }), on && cc.setting === k, pic('i' + k + cc.metal, { metal: cc.metal, karat: cc.karat, type: 'iced', setting: k })); }).join('') + '</div>' +
        '<p class="lab">Stone</p><div class="chips">' + Object.keys(STONES).map(function (k) { return chip('stone', k, STONES[k][0], on && cc.stone === k, on ? (cc.stone === k ? STONES[k][1] : delta(function (x) { x.stone = k; })) : '', !on); }).join('') + '</div>' + (on ? '' : '<p class="locked">Pick a setting first.</p>');
    } else {
      var where = SET.ins.tooth !== null && T[SET.ins.tooth] && T[SET.ins.tooth].on ? 'the ' + toothName(SET.ins.tooth).toLowerCase() : 'a front tooth';
      function xrow(k, title, sub, on, body) { return '<div class="xrow"><div class="top"><div><b>' + title + '</b><br><span>' + sub + '</span></div><button type="button" class="sw" data-g="x" data-k="' + k + '" aria-pressed="' + !!on + '" aria-label="' + title + '"></button></div>' + (on && body ? body : '') + '</div>'; }
      h = xrow('fangs', 'Fangs', SET.fangs ? 'On the upper canines' : '+$' + PRICE.fangs, SET.fangs) +
        xrow('perm', CUTS.permanent[0], SET.cut === 'permanent' ? CUTS.permanent[1] : '+$' + PRICE.permanent + ' · ' + CUTS.permanent[1].toLowerCase(), SET.cut === 'permanent') +
        xrow('ins', 'Initials', insOn() ? 'On ' + where + '. Tap a tooth to move them.' : 'From $' + PRICE.ins.engraved, ui.extra === 'ins' || !!SET.ins.text, '<div class="field"><input type="text" id="instext" maxlength="6" placeholder="Up to 6 letters" value="' + esc(SET.ins.text) + '" autocomplete="off" aria-label="Initials"></div><div class="chips">' + Object.keys(INS).map(function (k) { return chip('ins', k, INS[k][0], SET.ins.style === k, '$' + PRICE.ins[k]); }).join('') + '</div>') +
        xrow('charm', 'One-of-one charm', charmCount() ? charmCount() + ' added, quoted by the jeweler' : 'Quoted by the jeweler', ui.extra === 'charm' || charmCount() > 0, '<div class="strip">' + Object.keys(CHARMS).map(function (k) { return tile('charm', k, CHARMS[k], '', hasSel() && picked().every(function (x) { return T[x].charm === k; }), pic('c' + k, { metal: 'yellow', karat: '18k', charm: k })); }).join('') + '</div><p class="note">' + (hasSel() ? 'Goes on ' + (picked().length === 1 ? 'the ' + toothName(picked()[0]).toLowerCase() : 'the ' + picked().length + ' teeth you picked') + '.' : 'Tap a tooth on the 3D, then a charm.') + '</p>') +
        xrow('idea', 'Your idea', SET.idea || SET.inspo ? 'Added' : 'Describe it, or add a photo', ui.extra === 'idea' || !!(SET.idea || SET.inspo), '<div class="field"><textarea id="idea" placeholder="Describe a piece you have in mind." aria-label="Your idea">' + esc(SET.idea) + '</textarea></div><label class="up">' + (SET.inspo ? '<img alt="" src="' + SET.inspo + '">' : '') + '<span>' + (SET.inspo ? 'Change the photo' : 'Add an inspiration photo') + '</span><input type="file" accept="image/*" data-up="inspo"></label>');
    }
    return h;
  }
  function stages(ci) {                  // every part in a row: where you are, where you've been, tap to jump
    return '<nav class="stages" aria-label="Parts of your build">' + CATS.map(function (c, k) {
      var here = k === ci, been = ui.visited[c[0]] && !here;
      return (k ? '<i aria-hidden="true">·</i>' : '') + '<button type="button" data-open="' + c[0] + '"' + (here ? ' aria-current="step"' : '') + '>' + c[1] + (been ? '<span class="tick" aria-label="visited">✓</span>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function doneBtn() { var b = breakdown(); return '<button type="button" class="cta" data-a="done"' + (onList().length ? '' : ' disabled') + '>Done <small>' + money(b.total) + (b.quote ? ' +' : '') + '</small></button>'; }
  function renderTray() {
    var view = ui.mode + '|' + ui.layout + '|' + ui.struct + '|' + ui.cat + '|' + ui.after, keep = view === renderTray.view ? [].map.call(tray.querySelectorAll('.tbody'), function (e) { return e.scrollTop; }) : null, h = '';   // keep the scroll only when redrawing the same screen
    renderTray.view = view;
    var sheetOpen = ui.mode === 'build' && ui.layout === 'menu' && ui.struct === 'sheet' && ui.cat !== null;
    app.toggleAttribute('data-sheet', sheetOpen); app.toggleAttribute('data-cat', ui.mode === 'build' && ui.cat !== null);
    if (ui.mode === 'q') { tray.innerHTML = renderQuestions(); return; }
    if (ui.mode === 'after') { tray.innerHTML = renderAfter(); return; }
    if (ui.layout === 'menu') {
      if (ui.struct === 'strip') { if (ui.cat === null) { ui.cat = 'teeth'; ui.visited.teeth = 1; } h = stripView(); }
      else h = menuView(ui.struct === 'expand') + (ui.struct === 'sheet' && ui.cat !== null ? sheetView() : '');
    } else {
      var i = catIndex(ui.cat), last = i === CATS.length - 1;
      h = '<nav class="cats" aria-label="Steps">' + CATS.map(function (c, k) { return '<button type="button" data-open="' + c[0] + '"' + (k === i ? ' aria-current="step"' : '') + (ui.visited[c[0]] && k !== i ? ' class="done"' : '') + '>' + c[1] + '</button>'; }).join('') + '</nav>' +
        '<div class="thead"><h2>' + CATS[i][1] + '</h2></div><div class="tbody">' + options(ui.cat) + '</div><div class="tfoot">' + (i > 0 ? '<button type="button" class="back" data-a="prev" aria-label="Back">' + BACK + '</button>' : '') +
        (last ? doneBtn() : '<button type="button" class="cta" data-a="next"' + (onList().length ? '' : ' disabled') + '>Next: ' + CATS[i + 1][1] + ' ' + ARROW + '</button>') + '</div>';
    }
    tray.innerHTML = h;
    if (keep) [].forEach.call(tray.querySelectorAll('.tbody'), function (e, i) { if (keep[i] !== undefined) e.scrollTop = keep[i]; });
    else if (ui.struct === 'expand' && ui.cat) { var op = tray.querySelector('.mrow[aria-expanded="true"]'), tb = tray.querySelector('.tbody'); if (op && tb) tb.scrollTop = Math.max(0, tb.scrollTop + op.getBoundingClientRect().top - tb.getBoundingClientRect().top - 8); }
  }
  // ---------- the builder's structures, to compare: a stacked sheet, expand in place, a build strip ----------
  function upNext() {                    // the next part a first-timer hasn't opened
    if (ui.nextp !== 'upnext') return null; if (!onList().length) return 'teeth';
    for (var k = 0; k < CATS.length; k++) if (!ui.visited[CATS[k][0]] && CATS[k][0] !== ui.cat) return CATS[k][0];
    return null;
  }
  function partBody(c) { return '<p class="intro">' + INTRO[c] + '</p>' + options(c); }
  function nextOf(c) { var i = catIndex(c); return i < CATS.length - 1 ? CATS[i + 1] : null; }
  function menuRows(expand) {
    var nx = upNext();
    return '<div class="rows">' + CATS.map(function (c) {
      var fresh = !ui.visited[c[0]], open = expand && ui.cat === c[0], up = nx === c[0] && !open;
      return row({ cls: (!onList().length && c[0] === 'teeth' ? 'todo' : '') + (up ? ' upnext' : ''), attrs: 'data-open="' + c[0] + '"' + (expand ? ' aria-expanded="' + open + '"' : ''), title: c[1] + (fresh ? '<em class="new" title="Not opened yet"></em>' : '') + (up ? '<em class="up">Up next</em>' : ''), value: esc(rowValue(c[0])), hint: open ? '' : INSIDE[c[0]], thumb: preview(c[0]) }) +
        (open ? '<div class="xpanel">' + partBody(c[0]) + (ui.nextp === 'nextbtn' && nextOf(c[0]) ? '<button type="button" class="cta ghost xnext" data-a="next"' + (onList().length ? '' : ' disabled') + '>Next: ' + nextOf(c[0])[1] + ' ' + ARROW + '</button>' : '') + '</div>' : '');
    }).join('') + '</div>';
  }
  function menuView(expand) {
    var seen = CATS.filter(function (c) { return ui.visited[c[0]]; }).length;
    return '<div class="mhead"><h2>Your build</h2><div class="prog" aria-hidden="true"><i style="width:' + Math.round(seen / CATS.length * 100) + '%"></i></div><p class="prog-l">' + (seen === CATS.length ? 'Everything explored' : seen + ' of ' + CATS.length + ' explored · <b></b>not opened yet') + '</p></div>' +
      '<div class="tbody">' + menuRows(expand) + '<p class="note tip">Tip: tap teeth on the 3D to style them on their own.</p></div><div class="tfoot">' + doneBtn() + '</div>';
  }
  function sheetView() {
    var c = ui.cat, nx = nextOf(c), foot;
    if (ui.nextp === 'nextbtn') foot = '<button type="button" class="cta ghost second" data-a="menu">' + BACK + 'Your build</button>' + (nx ? '<button type="button" class="cta" data-a="next"' + (onList().length ? '' : ' disabled') + '>Next: ' + nx[1] + ' ' + ARROW + '</button>' : '<button type="button" class="cta" data-a="menu">Done</button>');
    else foot = '<button type="button" class="cta" data-a="menu">Done</button>';
    return '<div class="psheet" role="dialog" aria-label="' + CATS[catIndex(c)][1] + '"><div class="shead"><h2>' + CATS[catIndex(c)][1] + '</h2><button type="button" class="x" data-a="menu" aria-label="Close and go back to your build">×</button></div><div class="tbody">' + partBody(c) + '</div><div class="tfoot">' + foot + '</div></div>';
  }
  function stripView() {
    var c = ui.cat, nx = nextOf(c), up = upNext(), foot;
    var strip = '<div class="strip5" role="tablist" aria-label="Your build">' + CATS.map(function (k) {
      var on = c === k[0], fresh = !ui.visited[k[0]];
      return '<button type="button" class="sitem" role="tab" aria-selected="' + on + '" data-open="' + k[0] + '"><span class="prev">' + preview(k[0]) + '</span><b>' + k[1] + (fresh ? '<em class="new" title="Not opened yet"></em>' : '') + '</b><span class="sv">' + (up === k[0] ? '<em class="up">Up next</em>' : esc(rowValue(k[0]))) + '</span></button>';
    }).join('') + '</div>';
    if (ui.nextp === 'nextbtn' && nx) foot = '<button type="button" class="cta ghost second" data-a="done"' + (onList().length ? '' : ' disabled') + '>Done</button><button type="button" class="cta" data-a="next"' + (onList().length ? '' : ' disabled') + '>Next: ' + nx[1] + ' ' + ARROW + '</button>';
    else foot = doneBtn();
    return strip + '<div class="thead"><h2>' + CATS[catIndex(c)][1] + '</h2></div><div class="tbody">' + partBody(c) + '</div><div class="tfoot">' + foot + '</div>';
  }

  // ---------- questions at the start (the other way of guiding) ----------
  var Q = [
    ['Top, bottom or both?', [['top', 'Top', setSvg(6, 0, 'gold')], ['bottom', 'Bottom', setSvg(0, 6, 'gold')], ['both', 'Both', setSvg(6, 6, 'gold')]]],
    ['How many teeth?', [['2', '2'], ['4', '4'], ['6', '6'], ['8', '8'], ['10', '10'], ['16', 'All 16']]],
    ['Which metal?', Object.keys(METALS).map(function (k) { return [k, METALS[k].name, '<i style="background:' + SWATCH[k] + '"></i>']; })]
  ];
  function renderQuestions() {
    var q = Q[ui.q];
    return '<div class="thead"><button type="button" class="bk" data-a="qback" aria-label="Back">' + BACK + '</button><h2 style="font-size:15px;color:var(--s-mut);font-weight:500;letter-spacing:0">Question ' + (ui.q + 1) + ' of ' + Q.length + '</h2></div><div class="tbody"><div class="qs"><h2>' + q[0] + '</h2><div class="answers">' +
      q[1].map(function (a) { return '<button type="button" class="ans" data-q="' + a[0] + '">' + (a[2] || '') + '<span>' + a[1] + '</span></button>'; }).join('') + '</div><button type="button" class="skip" data-a="qskip">Skip, I\'ll build it myself</button></div></div>';
  }
  function answerQ(v) {
    if (ui.q === 0) { ui.qWhere = v; setRange(v === 'bottom' ? 0 : 6, v === 'top' ? 0 : 6); ui.q = 1; G.pop(); }
    else if (ui.q === 1) { var n = +v; setRange(ui.qWhere === 'bottom' ? 0 : n, ui.qWhere === 'top' ? 0 : n); ui.q = 2; G.pop(); }
    else { paint({ metal: v }); DEF.metal = v; ui.visited = { teeth: 1, metal: 1 }; ui.cat = ui.layout === 'steps' ? 'finish' : null; setMode('build'); G.glint(); }
    refresh();
  }

  // ---------- the guide: steps in when someone seems stuck ----------
  var BUB = {
    where: ['Top, bottom or both?', [['top', 'Top'], ['bottom', 'Bottom'], ['both', 'Both']]],
    many: ['How many teeth?', [['2', '2'], ['4', '4'], ['6', '6'], ['8', '8'], ['16', 'All 16']]],
    metal: ['Which metal?', [['yellow', 'Yellow gold'], ['white', 'White gold'], ['rose', 'Rose gold'], ['more', 'More metals']]],
    finish: ['Which finish?', [['solid', 'Solid'], ['cut', 'Diamond cut'], ['dust', 'Diamond dust'], ['more', 'More finishes']]],
    stones: ['Add stones?', [['none', 'No stones'], ['honeycomb', 'Honeycomb'], ['mosaic', 'Mosaic'], ['more', 'More']]],
    extras: ['Anything extra?', [['fangs', 'Fangs'], ['ins', 'Initials'], ['no', 'No extras']]],
    happy: ['Happy with it?', [['done', 'Done'], ['keep', 'Keep editing']]]
  };
  function showBubble(kind) {
    ui.bub = kind; var b = BUB[kind];
    bubble.innerHTML = '<div class="who"><i></i>Quick question<button type="button" class="x" data-b="x" aria-label="Close">×</button></div><p>' + b[0] + '</p><div class="chips">' + b[1].map(function (a) { return '<button type="button" class="chip' + (a[0] === 'more' ? ' more' : '') + '" data-b="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>';
    bubble.hidden = false; placeBubble(); box();
  }
  function snap() { return JSON.stringify({ T: T, D: DEF, S: SET, v: ui.visited, p: ui.picks, s: ui.sel }); }
  function unsnap(s) {
    var o = JSON.parse(s); T = o.T; DEF = o.D; Object.keys(SET).forEach(function (k) { delete SET[k]; }); Object.assign(SET, o.S);
    ui.visited = o.v; ui.picks = o.p || []; ui.sel = o.s; if (window.__vvs) window.__vvs.T = T; G.sync();
  }
  function scopeWords() { var p = picked(); return p.length ? (p.length === 1 ? 'the ' + toothName(p[0]).toLowerCase() : 'the ' + p.length + ' teeth you picked') : 'all ' + onList().length + ' teeth'; }
  function teethWords() { var on = onList(), t = on.filter(function (k) { return k < 16; }).length, b = on.length - t; return (t && b ? t + ' top and ' + b + ' bottom teeth' : t ? t + ' top teeth' : b + ' bottom teeth') + ' picked'; }
  function showUndo(msg, s) {
    clearTimeout(ui.undoTimer); ui.bub = 'undo'; ui.undoSnap = s;
    bubble.innerHTML = '<div class="who"><i></i>Changed<button type="button" class="x" data-b="x" aria-label="Close">×</button></div><div class="undo"><p>' + esc(msg) + '</p><button type="button" class="chip" data-b="undo">Undo</button></div>';
    bubble.hidden = false; placeBubble(); box();
    ui.undoTimer = setTimeout(function () { if (ui.bub === 'undo') { hideBubble(); ui.lastTouch = performance.now(); } }, ui.undoMs || 6000);
  }
  function placeBubble() {               // on a phone the bubble sits just above the controls, never over the piece
    var st = stage.getBoundingClientRect();
    if (st.width >= 900) { bubble.style.bottom = ''; return; }
    var t = tray.getBoundingClientRect(); bubble.style.bottom = Math.round(st.bottom - t.top + 10) + 'px';
  }
  function hideBubble() { var was = !bubble.hidden; bubble.hidden = true; ui.bub = null; if (was) box(); }
  function nextSuggestion() {
    if (!onList().length) return 'where';
    var order = ['metal', 'finish', 'stones', 'extras'];
    for (var k = 0; k < order.length; k++) if (!ui.visited[order[k]]) return order[k];
    return 'happy';
  }
  setInterval(function () {
    if (ui.guide !== 'stuck' || ui.mode !== 'build') { if (!bubble.hidden) hideBubble(); return; }
    var now = performance.now(); if (!bubble.hidden || now < ui.quietUntil) return;
    if (!onList().length) { showBubble('where'); return; }
    if (now - Math.max(ui.lastTouch, G.touched || 0) > 9000) showBubble(nextSuggestion());
  }, 1000);
  bubble.addEventListener('click', function (e) {
    var b = e.target.closest('[data-b]'); if (!b) return; var v = b.getAttribute('data-b'), kind = ui.bub; buzz(); ui.lastTouch = performance.now();
    if (kind === 'undo') { clearTimeout(ui.undoTimer); hideBubble(); if (v === 'undo') { unsnap(ui.undoSnap); ui.quietUntil = performance.now() + 12000; refresh(true); } return; }
    if (v === 'x') { hideBubble(); ui.quietUntil = performance.now() + 20000; return; }
    hideBubble();
    var before = kind === 'many' && ui.qSnap ? ui.qSnap : snap(), msg = '';
    if (kind === 'where') { ui.qSnap = before; ui.qWhere = v; setRange(v === 'bottom' ? 0 : 6, v === 'top' ? 0 : 6); G.pop(); refresh(); showBubble('many'); return; }
    if (kind === 'many') { var n = +v; setRange(ui.qWhere === 'bottom' ? 0 : n, ui.qWhere === 'top' ? 0 : n); ui.visited.teeth = 1; G.pop(); if (ui.layout === 'menu') ui.cat = null; ui.qSnap = null; refresh(); showUndo(teethWords(), before); return; }
    if (v === 'more') { openCat(kind); return; }
    if (kind === 'metal') { msg = METALS[v].name + ' on ' + scopeWords(); paint({ metal: v }); DEF.metal = v; }
    if (kind === 'finish') { msg = STYLES[v][0] + ' on ' + scopeWords(); paint({ style: v, type: 'plain' }); DEF.style = v; DEF.type = 'plain'; }
    if (kind === 'stones') { msg = v === 'none' ? 'No stones on ' + scopeWords() : SETTINGS[v][0] + ' stones on ' + scopeWords(); if (v === 'none') { paint({ type: 'plain' }); DEF.type = 'plain'; } else { paint({ type: 'iced', setting: v, style: 'solid' }); DEF.type = 'iced'; DEF.setting = v; DEF.style = 'solid'; } }
    if (kind === 'extras') { if (v === 'fangs') { SET.fangs = true; msg = 'Fangs added'; } if (v === 'ins') { openCat('extras'); ui.extra = 'ins'; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); refresh(); return; } }
    if (kind === 'happy') { if (v === 'done') { done(); return; } ui.quietUntil = performance.now() + 30000; }
    if (kind !== 'happy') ui.visited[kind] = 1;
    refresh(true);
    if (msg) showUndo(msg, before);
  });

  // ---------- shared pieces: the Row (words on the left, a round picture on the right) and its icons ----------
  // The menu, the fitting choices and the steps after sending are all the same Row, so a new screen reuses it.
  function row(o) {
    var tag = o.attrs ? 'button' : 'div';
    return '<' + tag + (tag === 'button' ? ' type="button"' : '') + ' class="mrow' + (o.cls ? ' ' + o.cls : '') + '"' + (o.attrs ? ' ' + o.attrs : '') + '><span class="txt"><b>' + o.title + '</b>' + (o.value ? '<span class="cur">' + o.value + '</span>' : '') + (o.hint ? '<span class="ins">' + o.hint + '</span>' : '') + '</span><span class="prev">' + o.thumb + '</span></' + tag + '>';
  }
  // line icons, the same set the live builder uses (lucide), drawn in ink inside the round picture
  var IC = {
    kit: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    bubble: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    coin: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    insta: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>'
  };
  function ic(k) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>'; }

  // ---------- after "Done": one screen to send it (the price, the fitting, where to text), the code, then Sent ----------
  ui.after = 0; ui.c = { name: '', phone: '', ig: '', email: '', note: '' }; ui.verified = loadVerified();
  function shopName() { return ui.site === 'shop' ? 'Gold Lab' : 'VVS Lab'; }
  function fits() { return ui.site === 'shop' ? ['kit', 'own', 'store'] : ['kit', 'own']; }          // VVS Lab has no store yet
  var FIT_WORDS = { kit: ['Mold kit by mail', 'They post you a kit. You bite, then mail it back.', 'kit'], own: ['Own mold or scan', 'You already have one.', 'scan'], store: ['In-store fitting', '', 'store'] };
  var DEV = 9000;
  function loadVerified() { try { return JSON.parse(localStorage.getItem('vvs-verified') || 'null'); } catch (e) { return null; } }
  function saveVerified(v) { try { if (v) localStorage.setItem('vvs-verified', JSON.stringify(v)); else localStorage.removeItem('vvs-verified'); } catch (e) {} }
  function digits(s) { var d = String(s || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; }
  function fmtPhone(s) { var d = digits(s).slice(0, 10); if (d.length < 4) return d; if (d.length < 7) return '(' + d.slice(0, 3) + ') ' + d.slice(3); return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6); }
  function contactErr() { return ui.c.name.trim().length < 2 ? ['aname', 'Add your first name.'] : digits(ui.c.phone).length !== 10 ? ['aphone', 'Add your 10-digit phone number.'] : null; }
  function known() { return !!ui.verified && !ui.changing; }
  function sumHtml() {
    var b = breakdown(), S = esc(shopName());
    return '<p class="note">' + (b.quote ? 'Your charm is quoted on top of the estimate. ' : '') + S + ' confirms the exact price after your fitting.</p>' +
      '<details class="why"' + (ui.why ? ' open' : '') + '><summary>What\'s in the price</summary><ul>' + b.lines.map(function (l) { return '<li><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></li>'; }).join('') + (b.quote ? '<li><span>One-of-one charm</span><span>Quoted</span></li>' : '') + '</ul></details>';
  }
  function promoMsg() { var c = (SET.promo || '').toUpperCase(); if (!c) return ''; return PRICE.promo[c] ? c + ': ' + PRICE.promo[c] + '% off' : (c.length >= 4 ? 'That code doesn\'t work.' : ''); }
  function contactHtml() {
    var S = esc(shopName()), v = ui.verified;
    if (known()) return row({ title: esc(v.name) + ' · ' + esc(fmtPhone(v.phone)), hint: 'Verified on this device, so no code this time.', thumb: ic('check') }) + '<button type="button" class="link" data-x="change">Change</button>';
    return '<div class="field"><label for="aname">First name</label><input id="aname" type="text" autocomplete="given-name" autocapitalize="words" value="' + esc(ui.c.name) + '"></div>' +
      '<div class="field"><label for="aphone">Phone</label><input id="aphone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(555) 012-3456" value="' + esc(ui.c.phone) + '"></div>' +
      '<p class="err" id="aerr" role="alert">' + (ui.err || '') + '</p><p class="note">' + S + ' texts you about this grill only. We\'ll send a code first; msg &amp; data rates may apply.</p>';
  }
  function afterOne() {
    var S = esc(shopName()), f = fits(); if (f.indexOf(SET.mold) < 0) SET.mold = f[0];
    return '<div class="thead"><h2>Here are your grillz</h2></div><div class="tbody flow">' +
      '<div class="sum" id="asum">' + sumHtml() + '</div>' +
      '<section class="sect"><h3 class="sec">How will they get the shape of your teeth?</h3><div class="rows" role="radiogroup" aria-label="Fitting">' + f.map(function (k) { var w = FIT_WORDS[k]; return row({ attrs: 'role="radio" aria-checked="' + (SET.mold === k) + '" data-fit="' + k + '"', title: w[0], hint: k === 'store' ? 'Visit ' + S + '.' : w[1], thumb: ic(w[2]) }); }).join('') + '</div></section>' +
      '<section class="sect"><h3 class="sec">Where should ' + S + ' text you?</h3>' + contactHtml() + '</section>' +
      (ui.more ? '<section class="sect"><div class="field"><label for="anote">Note to ' + S + '</label><textarea id="anote" maxlength="200" placeholder="Anything they should know">' + esc(ui.c.note) + '</textarea></div><div class="field"><label for="apromo">Promo code</label><input id="apromo" type="text" autocomplete="off" autocapitalize="characters" value="' + esc(SET.promo || '') + '"></div><p class="note" id="pmsg">' + promoMsg() + '</p></section>'
        : '<button type="button" class="link" data-x="more">+ Add a note or promo code</button>') +
      '</div><div class="tfoot col"><div class="btns"><button type="button" class="cta ghost second" data-x="keep">' + BACK + 'Keep editing</button><button type="button" class="cta" data-x="go">Send to ' + S + '</button></div><p class="free">Free. Nothing to pay yet.</p></div>';
  }
  function resendWords() { var s = Math.ceil((ui.resendAt - performance.now()) / 1000); return s > 0 ? 'Send a new code in ' + mmss(s) : '<button type="button" class="link" data-x="resend">Send a new code</button>'; }
  function otpBoxes() { return [0, 1, 2, 3, 4, 5].map(function (i) { return '<i' + (i === Math.min(ui.code.length, 5) && !ui.checking ? ' class="at"' : '') + '>' + (ui.code[i] || '') + '</i>'; }).join(''); }
  function afterCode() {
    var S = esc(shopName());
    return '<div class="thead"><h2>Enter the 6-digit code</h2></div><div class="tbody flow"><p class="intro">We texted it to <b>' + esc(fmtPhone(ui.c.phone)) + '</b>. <button type="button" class="link" data-x="wrong">Wrong number? Change it</button></p>' +
      '<section class="sect">' + (ui.sms && !ui.code && !ui.checking ? '<button type="button" class="sms" data-x="fill"><span>From Messages</span><b>' + ui.sms + '</b></button>' : '') +
      '<label class="otp"><span class="sr">6-digit code</span><input id="aotp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="' + ui.code + '"' + (ui.checking ? ' disabled' : '') + '><span class="boxes" aria-hidden="true">' + otpBoxes() + '</span></label>' +
      '<p class="note" id="otpnote">' + (ui.checking ? 'Checking…' : resendWords()) + '</p></section><p class="proto-note">Prototype: no text is sent. Tap the code above (your phone offers it the same way) or type any 6 digits.</p>' +
      '</div><div class="tfoot col"><div class="btns"><button type="button" class="cta ghost second" data-x="back2">' + BACK + 'Back</button><button type="button" class="cta" disabled>' + (ui.checking ? 'Sending…' : 'Send to ' + S) + '</button></div><p class="free">It sends as soon as the code is in.</p></div>';
  }
  function afterSent() {
    var S = esc(shopName()), m = money(breakdown().deposit), fit = FIT_WORDS[SET.mold], ready = ui.devAt && performance.now() - ui.devAt >= DEV;
    var steps = [[S + ' texts you', '', ic('bubble')], ['Fitting', fit[0], ic(fit[2])], ['They make it', '', preview('finish')], ['It\'s yours', '', '<img alt="" src="' + ui.photo + '">']];
    var save = '<button type="button" class="cta" data-x="save"' + (ready ? '' : ' disabled') + '>Save my photo</button>';
    var foot = ui.paid ? save : ui.skip ? '<button type="button" class="cta ghost second" data-x="pay"' + (ui.paying ? ' disabled' : '') + '>' + (ui.paying ? 'Opening…' : 'Pay deposit') + '</button>' + save
      : '<button type="button" class="cta ghost second" data-x="skip">Not now</button><button type="button" class="cta" data-x="pay"' + (ui.paying ? ' disabled' : '') + '>' + (ui.paying ? 'Opening secure checkout…' : 'Pay ' + m + ' deposit') + '</button>';
    return '<div class="thead two"><h2>Sent. ' + S + ' will text you.</h2><p class="sub">At ' + esc(fmtPhone(ui.c.phone)) + '.</p></div><div class="tbody flow">' +
      (ui.paid ? row({ cls: 'lead', title: 'Order started', hint: m + ' deposit paid to ' + S + ', counted toward your grill.', thumb: ic('check') }) : row({ cls: 'lead', title: 'Start your order', hint: m + ' now, counted toward your grill. ' + S + ' confirms the rest.', thumb: ic('coin') })) +
      '<section class="sect"><h3 class="sec">While your photo develops</h3><div class="fgroup"><div class="field"><label for="aig">Your Instagram</label><input id="aig" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="@" value="' + esc(ui.c.ig) + '"></div><p class="note">' + S + ' sees it as you typed it.</p></div>' +
      row({ attrs: 'data-x="follow"', title: 'Follow @vvslab', hint: 'Opens Instagram', thumb: ic('insta') }) +
      '<div class="field"><label for="aemail">Email me a copy</label><input id="aemail" type="email" inputmode="email" autocomplete="email" value="' + esc(ui.c.email) + '"></div></section>' +
      '<section class="sect"><h3 class="sec">What happens next</h3><ol class="steps">' + steps.map(function (s, i) { return '<li><span class="n">' + (i + 1) + '</span><span class="txt"><b>' + s[0] + '</b>' + (s[1] ? '<span class="ins">' + s[1] + '</span>' : '') + '</span><span class="prev">' + s[2] + '</span></li>'; }).join('') + '</ol></section>' +
      '<p class="proto-note">Prototype: nothing is sent and no card is charged. The real studio photo is made by AI from this design in about 30 seconds; here the 3D stands in for it.</p></div><div class="tfoot">' + foot + '</div>';
  }
  function renderAfter() { return ui.after === 1 ? afterOne() : ui.after === 2 ? afterCode() : afterSent(); }
  function focusId(id) { var el = $(id); if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  function redraw() { var a = document.activeElement, id = a && tray.contains(a) ? a.id : ''; renderTray(); if (id) focusId(id); }   // redraw without losing the field being typed in
  function goAfter(n) { ui.after = n; app.setAttribute('data-after', n); refresh(); var b = tray.querySelector('.tbody'); if (b) b.scrollTop = 0; if (n === 2) focusId('aotp'); }
  function smsLater() { clearTimeout(ui.smsT); ui.smsT = setTimeout(function () { if (ui.after === 2 && !ui.code && !ui.checking) { ui.sms = String(100000 + Math.floor(Math.random() * 900000)); renderTray(); focusId('aotp'); } }, 1800); }
  function sendCode(again) { ui.code = ''; ui.sms = null; ui.checking = false; ui.resendAt = performance.now() + 30000; goAfter(2); smsLater(); if (again) toast('A new code is on its way.'); }
  function check() {
    ui.checking = true; renderTray();
    setTimeout(function () { ui.checking = false; ui.verified = { name: ui.c.name.trim(), phone: digits(ui.c.phone) }; saveVerified(ui.verified); ui.changing = false; sendIt(); }, 900);
  }
  function sendIt() {
    if (known()) { ui.c.name = ui.verified.name; ui.c.phone = ui.verified.phone; }
    ui.sent = true; ui.tSent = performance.now(); ui.photo = G.shot(960, 720) || ''; ui.devAt = performance.now();
    goAfter(3); showPhoto();
  }
  function afterAction(x) {
    if (x === 'keep') { ui.tDone = 0; hidePhoto(); setMode('build'); ui.cat = null; refresh(true); return; }
    if (x === 'more') { ui.more = true; renderTray(); focusId('anote'); return; }
    if (x === 'go') {
      if (known()) { sendIt(); return; }
      var e = contactErr(); if (e) { ui.err = e[1]; var p = $('aerr'); if (p) p.textContent = e[1]; var el = $(e[0]); if (el) { el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); focusId(e[0]); } return; }
      ui.err = ''; sendCode(); return;
    }
    if (x === 'back2' || x === 'wrong') { clearTimeout(ui.smsT); ui.code = ''; ui.sms = null; goAfter(1); if (x === 'wrong') focusId('aphone'); return; }
    if (x === 'change') { ui.changing = true; ui.c.name = ui.verified.name; ui.c.phone = fmtPhone(ui.verified.phone); renderTray(); focusId('aname'); return; }
    if (x === 'resend') { sendCode(true); return; }
    if (x === 'fill') { ui.code = ui.sms; check(); return; }
    if (x === 'pay') { ui.paying = true; redraw(); setTimeout(function () { ui.paying = false; ui.paid = true; if (ui.after === 3) redraw(); }, 1400); return; }
    if (x === 'skip') { ui.skip = true; redraw(); return; }
    if (x === 'follow') { toast('This opens Instagram on @vvslab.'); return; }
    if (x === 'save') { toast('In the real builder this saves the studio photo to your phone.'); return; }
  }
  function afterInput(e) {
    var el = e.target, id = el.id, v = el.value;
    if (id === 'aname') ui.c.name = v.slice(0, 40);
    else if (id === 'aphone') { var f = fmtPhone(v); if (digits(v).length >= 4 && f !== v && digits(v).length <= 10) el.value = f; ui.c.phone = el.value; }
    else if (id === 'aotp') { var d = v.replace(/\D/g, '').slice(0, 6); el.value = d; ui.code = d; var bx = tray.querySelector('.otp .boxes'); if (bx) bx.innerHTML = otpBoxes(); if (d.length === 6) check(); return; }
    else if (id === 'anote') ui.c.note = v.slice(0, 200);
    else if (id === 'apromo') { SET.promo = v.trim(); meta(); var s = $('asum'); if (s) s.innerHTML = sumHtml(); var m = $('pmsg'); if (m) m.textContent = promoMsg(); }
    else if (id === 'aig') ui.c.ig = v.slice(0, 31);
    else if (id === 'aemail') ui.c.email = v.slice(0, 120);
    if ((id === 'aname' || id === 'aphone') && ui.err && !contactErr()) { ui.err = ''; var p = $('aerr'); if (p) p.textContent = ''; }
  }
  tray.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.target.id === 'aname' || e.target.id === 'aphone')) { e.preventDefault(); afterAction('go'); } });
  tray.addEventListener('toggle', function (e) { if (e.target.classList && e.target.classList.contains('why')) ui.why = e.target.open; }, true);
  // the studio photo: the 3D develops into it, in the space where the piece was
  var photo = $('photo');
  function showPhoto() { $('photoimg').src = ui.photo; photo.hidden = false; app.setAttribute('data-photo', ''); placePhoto(); paintPhoto(); }
  function hidePhoto() { photo.hidden = true; ui.devAt = 0; app.removeAttribute('data-photo'); }
  function placePhoto() {
    if (photo.hidden || !G.box) return; var b = G.box, aw = (b.right - b.left) * .9, ah = (b.bottom - b.top) * .9 - 36, w = Math.max(160, Math.min(aw, ah * 4 / 3, 640)), h = w * 3 / 4;
    photo.style.left = Math.round(b.left + (b.right - b.left - w) / 2) + 'px'; photo.style.top = Math.round(b.top + Math.max(0, (b.bottom - b.top - h - 36) / 2)) + 'px'; photo.style.width = Math.round(w) + 'px';
    $('photoimg').parentNode.style.height = Math.round(h) + 'px';
  }
  function paintPhoto() {
    if (photo.hidden) return; var p = Math.min(1, (performance.now() - ui.devAt) / DEV), e = 1 - Math.pow(1 - p, 2.2), st = photo.style;
    st.setProperty('--b', (16 * (1 - e)).toFixed(2) + 'px'); st.setProperty('--br', (1 + .9 * (1 - e)).toFixed(3)); st.setProperty('--sa', (.15 + .85 * e).toFixed(3)); st.setProperty('--co', (.55 + .45 * e).toFixed(3)); st.setProperty('--in', Math.min(1, p * 6).toFixed(3));
    $('photocap').textContent = p < 1 ? 'Developing your studio photo… ' + mmss(Math.ceil((1 - p) * 30)) : 'Your studio photo · ' + lookLabel();
    photo.classList.toggle('done', p >= 1);
    var sb = tray.querySelector('[data-x="save"]'); if (sb) sb.disabled = p < 1;
  }
  setInterval(function () {
    if (ui.mode !== 'after') return;
    var n = $('otpnote'); if (n && ui.after === 2 && !ui.checking) { var w = resendWords(); if (n.getAttribute('data-w') !== w) { n.setAttribute('data-w', w); n.innerHTML = w; } }
    if (ui.after === 3 && ui.devAt && !photo.hidden) paintPhoto();
  }, 250);

  // ---------- Undo: steps back through any change to the design ----------
  ui.hist = []; ui.lastSnap = null;
  function designSnap() { return JSON.stringify({ T: T, D: DEF, S: { fangs: SET.fangs, cut: SET.cut, ins: SET.ins, mold: SET.mold, idea: SET.idea } }); }
  function track() {
    if (ui.mode === 'build') { var s = designSnap(); if (ui.lastSnap !== null && s !== ui.lastSnap) { ui.hist.push(ui.lastSnap); if (ui.hist.length > 60) ui.hist.shift(); } ui.lastSnap = s; }
    $('undobtn').disabled = !ui.hist.length;
  }
  function undo() {
    if (!ui.hist.length) return; var s = ui.hist.pop(), o = JSON.parse(s);
    T = o.T; DEF = o.D; SET.fangs = o.S.fangs; SET.cut = o.S.cut; SET.ins = o.S.ins; SET.mold = o.S.mold; SET.idea = o.S.idea; if (window.__vvs) window.__vvs.T = T;
    ui.picks = (ui.picks || []).filter(function (k) { return T[k].on; }); ui.sel = ui.picks.length ? ui.picks[ui.picks.length - 1] : null;
    ui.lastSnap = s; ui.build = null; hideBubble(); G.sync(); refresh(true); toast('Undone');
  }
  function freshHistory() { ui.hist = []; ui.lastSnap = null; }

  // ---------- moving around ----------
  function setMode(m) { ui.mode = m; app.setAttribute('data-mode', m); if (m !== 'build') { clearPicks(); hideBubble(); } box(); setTimeout(box, 450); }
  function openCat(c) {
    if (ui.layout === 'menu' && ui.struct === 'expand' && ui.cat === c) { ui.cat = null; ui.extra = null; refresh(); return; }
    ui.cat = c; ui.visited[c] = 1; ui.extra = null; if (c === 'teeth') clearPicks(); refresh();
  }
  function stepOf() { if (ui.mode === 'q') return ui.q === 2 ? 1 : 0; if (ui.mode === 'after') return 5; return ui.cat === null ? 5 : catIndex(ui.cat); }
  var shown = 0, anim = 0;
  function meta() {
    var b = breakdown(), to = b.total, from = shown, t0 = performance.now(); cancelAnimationFrame(anim);
    (function step(t) { var k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (to - from) * e); $('price').textContent = money(shown) + (b.quote ? ' +' : ''); if (k < 1 && !reduce) anim = requestAnimationFrame(step); else { shown = to; $('price').textContent = money(to) + (b.quote ? ' +' : ''); } })(t0);
  }
  function box() {
    var st = stage.getBoundingClientRect(), W = st.width, H = st.height, top = 60;
    if (ui.mode === 'door') { var el = ui.open === 'a' ? $('openA') : null, r = el ? el.getBoundingClientRect() : null; G.box = { top: top, bottom: r ? Math.max(top + 160, r.top - st.top - 6) : H * .55, left: 0, right: W }; return; }
    if (ui.mode === 'build' || ui.mode === 'q' || ui.mode === 'after') {
      var t = tray.getBoundingClientRect(), limit = t.top;
      if (W < 900 && !bubble.hidden) limit = Math.min(limit, bubble.getBoundingClientRect().top);   // on a phone the piece makes room for the guide's question
      var ch = ui.mode === 'build' && !$('changebar').hidden, ps = tray.querySelector('.psheet');   // keep the piece clear of the Select teeth bar and the sheet
      if (ps && W >= 900) t = { left: ps.getBoundingClientRect().left, top: t.top };
      G.box = W >= 900 ? { top: top, bottom: H - (ch ? 112 : 24), left: 0, right: t.left - st.left - 8 } : { top: ch ? 110 : top, bottom: Math.max(top + 110, limit - st.top - 6), left: 0, right: W };
      if (ui.mode === 'after' && typeof placePhoto === 'function') placePhoto();
      return;
    }
    G.box = { top: top, bottom: H * .62, left: 0, right: W };
  }
  window.addEventListener('resize', box);
  function refresh(glint) {
    ui.step = stepOf();
    if (ui.mode === 'build' || ui.mode === 'q' || ui.mode === 'after') renderTray();
    changeBar(); track();
    var sc = $('selchip'), show = ui.mode === 'build' && hasSel() && $('changebar').hidden;
    var pk = picked(); sc.hidden = !show; if (show) sc.innerHTML = (pk.length === 1 ? 'Editing the <b>' + esc(toothName(pk[0]).toLowerCase()) + '</b> only' : 'Editing <b>' + pk.length + ' teeth</b>') + ' <span class="x">Whole set</span>';
    meta(); box(); requestAnimationFrame(box); G.sync(); G.goal(); if (glint) G.glint(); if (!bubble.hidden) placeBubble();
    if (!proto.hidden) renderProto();
  }
  function firstFront() { var p = [7, 8, 6, 9, 23, 24].filter(function (x) { return T[x].on; })[0]; return p === undefined ? (onList()[0] === undefined ? null : onList()[0]) : p; }
  function done() {
    ui.tDone = performance.now(); ui.after = 1; app.setAttribute('data-after', 1); ui.err = ''; ui.sent = false; ui.more = false; ui.why = false; ui.codeSent = false; ui.code = ''; ui.sms = null; ui.checking = false; ui.changing = false; ui.paid = false; ui.skip = false; ui.paying = false;
    setMode('after'); refresh(); var b = tray.querySelector('.tbody'); if (b) b.scrollTop = 0;
  }

  // ---------- taps ----------
  G.tap = function (k) {
    ui.lastTouch = performance.now();
    if (ui.mode !== 'build') return;
    ui.taps++;
    if (ui.cat === 'teeth') { if (k === null) return; T[k].on = !T[k].on; if (T[k].on) KEYS.forEach(function (key) { T[k][key] = DEF[key]; }); else T[k].charm = null; ui.build = null; ui.visited.teeth = 1; G.pop(k); buzz(); if (!bubble.hidden && onList().length) hideBubble(); refresh(); return; }
    if (k === null) { clearPicks(); refresh(); return; }
    if (!T[k].on) { toast('That tooth isn\'t in your build. Add it in Teeth.'); return; }
    if (ui.extra === 'ins' && ui.cat === 'extras') { SET.ins.tooth = k; G.pop(k); refresh(); return; }
    var at = ui.picks.indexOf(k); if (at >= 0) ui.picks.splice(at, 1); else ui.picks.push(k); ui.sel = ui.picks.length ? ui.picks[ui.picks.length - 1] : null; buzz(); refresh();
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, label'); if (!t || t.closest('#proto')) return;
    if (t.closest('.stage')) { ui.taps++; ui.lastTouch = performance.now(); }
    var bd = t.getAttribute('data-build'); if (bd) { applyBuild(bd); renderOpenings(); return; }
    var pk = t.getAttribute('data-pick'); if (pk) { applyBuild(pk); startCreator(); return; }
    if (t.id === 'goA') { if (!ui.build) applyBuild('empty'); startCreator(); return; }
    if (t.id === 'selchip') { clearPicks(); refresh(); return; }
    var x = t.getAttribute('data-x'); if (x) { afterAction(x); return; }
    var ft = t.getAttribute('data-fit'); if (ft) { SET.mold = ft; redraw(); return; }
    var q = t.getAttribute('data-q'); if (q) { answerQ(q); return; }
    var op = t.getAttribute('data-open'); if (op) { if (!bubble.hidden && ui.bub !== 'where' && ui.bub !== 'many') hideBubble(); openCat(op); return; }
    var s = t.getAttribute('data-s'); if (s === 'keep') { sheet.hidden = true; ui.tDone = 0; setMode('build'); refresh(); return; } if (s === 'photo') { toast('Next comes the phone sign-up, the studio photo and sending it. That part is in the flow lab.'); return; }
    var a = t.getAttribute('data-a');
    if (a === 'menu') { ui.cat = null; ui.extra = null; refresh(); return; }
    if (a === 'next') { openCat(CATS[catIndex(ui.cat) + 1][0]); return; }
    if (a === 'prev') { openCat(CATS[catIndex(ui.cat) - 1][0]); return; }
    if (a === 'done') { done(); return; }
    if (a === 'qskip') { ui.cat = 'teeth'; setMode('build'); refresh(); return; }
    if (a === 'qback') { if (ui.q > 0) { ui.q--; refresh(); } else { resetAll(); ui.build = null; setMode('door'); renderOpenings(); G.sync(); G.goal(); } return; }
    if (!t.closest('#tray') && !t.closest('#changebar')) return;
    var g = t.getAttribute('data-g'), k = t.getAttribute('data-k'); if (!g) return;
    if (!bubble.hidden && ui.bub !== 'where' && ui.bub !== 'many') hideBubble();
    var tg = targets(), all = !hasSel(), n = counts(); buzz();
    function each(f) { tg.forEach(function (x) { f(T[x]); }); if (all) f(DEF); }
    if (g === 'pick') { if (k === 'all') clearPicks(); else if (k !== 'mine') { ui.picks = groupTeeth(k).slice(); ui.sel = ui.picks[ui.picks.length - 1]; } refresh(); return; }
    if (g === 'set') { setRange(SETS[k][1], SETS[k][2]); ui.build = null; G.pop(); }
    if (g === 'cnt') { var top = n[0] + (k === 't+' ? 1 : k === 't-' ? -1 : 0), bot = n[1] + (k === 'b+' ? 1 : k === 'b-' ? -1 : 0); setRange(Math.max(0, Math.min(16, top)), Math.max(0, Math.min(16, bot))); ui.build = null; }
    if (g === 'metal') each(function (x) { x.metal = k; });
    if (g === 'karat') each(function (x) { x.karat = k; });
    if (g === 'style') each(function (x) { x.style = k; if (x.type === 'photo') x.type = 'plain'; });
    if (g === 'photo') each(function (x) { x.type = 'photo'; x.style = 'solid'; });
    if (g === 'opal') each(function (x) { x.opal = k; });
    if (g === 'setting') each(function (x) { if (k === 'none') x.type = 'plain'; else { x.type = 'iced'; x.setting = k; if (x.style !== 'open') x.style = 'solid'; } });
    if (g === 'stone') each(function (x) { x.stone = k; });
    if (g === 'x') {
      if (k === 'fangs') { SET.fangs = !SET.fangs; if (SET.fangs && !T[5].on && !T[10].on) toast('Fangs sit on the upper canines. Add 6 top teeth or more to see them.'); }
      if (k === 'perm') SET.cut = SET.cut === 'permanent' ? 'deep' : 'permanent';
      if (k === 'ins') { if (ui.extra === 'ins' || SET.ins.text) { ui.extra = null; SET.ins.text = ''; } else { ui.extra = 'ins'; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); } }
      if (k === 'charm') { if (ui.extra === 'charm' || charmCount()) { ui.extra = null; onList().forEach(function (x) { T[x].charm = null; }); } else ui.extra = 'charm'; }
      if (k === 'idea') { if (ui.extra === 'idea' || SET.idea || SET.inspo) { ui.extra = null; SET.idea = ''; SET.inspo = null; } else ui.extra = 'idea'; }
    }
    if (g === 'ins') { SET.ins.style = k; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); }
    if (g === 'charm') { if (!hasSel()) { var p = [7, 8, 6, 9, 5, 10, 23, 24, 22, 25].filter(function (x) { return T[x].on && !T[x].charm; })[0]; if (p === undefined) p = onList()[0]; if (p !== undefined) { ui.picks = [p]; ui.sel = p; } } picked().forEach(function (x) { T[x].charm = k; }); }
    refresh(g !== 'cnt' && g !== 'set' && g !== 'x');
  });
  tray.addEventListener('input', function (e) {
    ui.lastTouch = performance.now();
    if (e.target.id === 'instext') { SET.ins.text = e.target.value.toUpperCase().replace(/[^A-Z0-9&.\- ]/g, '').slice(0, 6); if (SET.ins.tooth === null || !T[SET.ins.tooth].on) SET.ins.tooth = firstFront(); G.sync(); meta(); }
    if (e.target.id === 'idea') SET.idea = e.target.value.slice(0, 400);
    if (ui.mode === 'after') afterInput(e);
  });
  tray.addEventListener('change', function (e) {
    var kind = e.target.getAttribute && e.target.getAttribute('data-up'); if (!kind) return;
    var f = e.target.files[0]; if (!f) return; var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = Math.min(1, 900 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); var url = c.toDataURL('image/jpeg', .8); if (kind === 'photo') { SET.photo = url; if (G.photo) G.photo(im); } else SET.inspo = url; refresh(true); }; im.src = fr.result; };
    fr.readAsDataURL(f);
  });
  $('jawbtn').addEventListener('click', function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', o); $('jawlabel').textContent = o ? 'Close mouth' : 'Open mouth'; G.jaw(o); });
  $('turnbtn').addEventListener('click', function () { if (G.turn) G.turn(); });
  $('undobtn').addEventListener('click', function () { ui.lastTouch = performance.now(); buzz(); undo(); });

  // ---------- prototype switches (not part of the product) ----------
  var PAIRS = [['struct', 'Structure', [['sheet', 'Stacked sheet'], ['expand', 'Expand in place'], ['strip', 'Build strip']]], ['nextp', 'Finding the next part', [['upnext', 'Up next on Your build'], ['nextbtn', 'Next button']]], ['site', 'Opened from', [['vvs', 'VVS Lab\'s site'], ['shop', 'A jeweler\'s builder']]]];
  var protoTimer = 0;
  function renderProto() {
    proto.innerHTML = '<h3>Compare</h3>' + PAIRS.map(function (p) { return '<div class="pair"><p>' + p[1] + '</p><div class="seg">' + p[2].map(function (o) { return '<button type="button" data-p="' + p[0] + '" data-v="' + o[0] + '" aria-pressed="' + (ui[p[0]] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="stat"><p>This run</p><b id="pclock">' + mmss(elapsed()) + ' · ' + ui.taps + ' taps</b></div>' +
      '<div class="pair"><p>Holder</p><input type="range" id="psolid" min="30" max="100" step="5" value="' + (ui.solid || 70) + '" aria-label="How solid the clear holder is"></div>' +
      '<button type="button" class="sm" data-p="restart">Start again from the opening</button>' + (ui.verified ? '<button type="button" class="sm" data-p="forget">Forget my phone (see the code step again)</button>' : '') + '<p>Chosen so far: bare teeth with a row of builds; the menu in any order with Next through every part; a guide when you seem stuck, with Undo. Compare three structures for the builder with the switches above; each works with either way of finding the next part. After Done: one screen to send it, the code, then Sent. Send a second design to see a returning shopper skip the code.</p>';
  }
  function setVariant(k, v) { ui[k] = v; app.setAttribute('data-' + k, v); }
  function brand() { var m = document.querySelector('.bar .mark'); if (!m) return; m.querySelector('i').textContent = ui.site === 'shop' ? 'GL' : 'VV'; m.querySelector('span').textContent = shopName(); }
  function restart() { sheet.hidden = true; hidePhoto(); ui.after = 0; ui.sent = false; ui.c = { name: '', phone: '', ig: '', email: '', note: '' }; SET.promo = ''; hideBubble(); resetAll(); ui.build = null; ui.t0 = 0; ui.tDone = 0; ui.taps = 0; ui.visited = {}; ui.cat = null; ui.extra = null; ui.quietUntil = 0; setMode('door'); renderOpenings(); G.sync(); G.goal(); meta(); }
  $('protobtn').addEventListener('click', function () { var open = proto.hidden; proto.hidden = !open; this.setAttribute('aria-expanded', open); clearInterval(protoTimer); if (open) { renderProto(); protoTimer = setInterval(function () { var c = $('pclock'); if (c) c.textContent = mmss(elapsed()) + ' · ' + ui.taps + ' taps'; }, 500); } });
  proto.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return; var p = b.getAttribute('data-p'), v = b.getAttribute('data-v');
    if (p === 'restart') { restart(); renderProto(); return; }
    if (p === 'forget') { ui.verified = null; saveVerified(null); if (ui.mode === 'after') renderTray(); renderProto(); return; }
    setVariant(p, v);
    if (p === 'site') { brand(); if (ui.mode === 'after') renderTray(); }
    if ((p === 'struct' || p === 'nextp') && ui.mode === 'build') { if (p === 'struct' && v !== 'strip' && ui.struct !== 'strip') {} refresh(); }
    if (p === 'open') restart();
    if (p === 'layout' && ui.mode === 'build') { if (v === 'steps' && ui.cat === null) ui.cat = 'teeth'; refresh(); }
    if (p === 'guide') { hideBubble(); if (v === 'start') restart(); }
    renderProto();
  });
  proto.addEventListener('input', function (e) { if (e.target.id === 'psolid') { ui.solid = +e.target.value; G.solid(ui.solid); } });

  // ---------- start ----------
  setVariant('open', 'a'); setVariant('layout', 'menu'); setVariant('guide', 'stuck'); setVariant('menu', 'calm'); setVariant('site', 'vvs'); setVariant('struct', 'sheet'); setVariant('nextp', 'upnext'); brand();
  resetAll(); setMode('door'); renderOpenings(); meta();
  if (G.boot) { G.boot(); setTimeout(function () { renderOpenings(); box(); }, 400); }
  window.__vvs = { T: T, ui: ui, SET: SET, G: G };
})();
