
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
    if (!ui.t0) ui.t0 = performance.now();
    ui.cat = null; clearPicks(); ui.visited = {}; ui.extra = null;
    if (!onList().length) {
      ui.build = 'empty';
      if (ui.guide === 'start') { ui.q = 0; setMode('q'); refresh(); return; }
      ui.cat = 'teeth'; ui.visited.teeth = 1;
    } else if (ui.layout === 'steps') { ui.cat = 'teeth'; ui.visited.teeth = 1; }
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
  function applyRow() {                  // which teeth the choices below go to
    var on = onList(), pk = picked(), mine = pk.length > 0;
    var chips = GROUPS.map(function (g) { var tg = groupTeeth(g[0]); if (!tg.length || tg.length === on.length) return ''; var hit = mine && sameSet(pk, tg); if (hit) mine = false; return chip('pick', g[0], g[1], hit); }).join('');
    return '<div class="apply"><p class="lab">Change</p><div class="chips">' + chip('pick', 'all', 'Whole set', !pk.length) + chips + (mine ? chip('pick', 'mine', pk.length + (pk.length === 1 ? ' tooth' : ' teeth') + ' picked', true) : '') + '</div></div>';
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
    if (c === 'teeth') return onList().length ? lookLabel() : 'None yet';
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
  function doneBtn() { var b = breakdown(); return '<button type="button" class="cta" data-a="done"' + (onList().length ? '' : ' disabled') + '>Done <small>' + money(b.total) + (b.quote ? ' +' : '') + '</small></button>'; }
  function renderTray() {
    var view = ui.mode + '|' + ui.layout + '|' + ui.cat, keep = view === renderTray.view ? tray.querySelector('.tbody') : null, top = keep ? keep.scrollTop : 0, h = '';   // keep the scroll only when redrawing the same screen
    renderTray.view = view;
    if (ui.mode === 'q') { tray.innerHTML = renderQuestions(); return; }
    if (ui.layout === 'menu') {
      if (ui.cat === null) {
        var seen = CATS.filter(function (c) { return ui.visited[c[0]]; }).length;
        h = '<div class="mhead"><h2>Your build</h2><div class="prog" aria-hidden="true"><i style="width:' + Math.round(seen / CATS.length * 100) + '%"></i></div><p class="prog-l">' + (seen === CATS.length ? 'Everything explored' : seen + ' of ' + CATS.length + ' explored · <b></b>not opened yet') + '</p></div>' +
          '<div class="tbody"><div class="rows">' + CATS.map(function (c) { var v = rowValue(c[0]), fresh = !ui.visited[c[0]]; return '<button type="button" class="mrow' + (!onList().length && c[0] === 'teeth' ? ' todo' : '') + '" data-open="' + c[0] + '"><span class="prev">' + preview(c[0]) + '</span><span class="txt"><b>' + c[1] + (fresh ? '<em class="new" title="Not opened yet"></em>' : '') + '</b><span class="cur">' + esc(v) + '</span><span class="ins">' + INSIDE[c[0]] + '</span></span></button>'; }).join('') +
          '</div><p class="note tip">Tip: tap teeth on the 3D to style them on their own.</p></div><div class="tfoot">' + doneBtn() + '</div>';
      } else {
        h = '<div class="thead"><button type="button" class="bk" data-a="menu" aria-label="Back to your build">' + BACK + '</button><h2>' + CATS[catIndex(ui.cat)][1] + '</h2></div><div class="tbody"><p class="intro">' + INTRO[ui.cat] + '</p>' + (onList().length && ['metal', 'finish', 'stones'].indexOf(ui.cat) >= 0 ? applyRow() : '') + options(ui.cat) + '</div><div class="tfoot">' + doneBtn() + '</div>';
      }
    } else {
      var i = catIndex(ui.cat), last = i === CATS.length - 1;
      h = '<nav class="cats" aria-label="Steps">' + CATS.map(function (c, k) { return '<button type="button" data-open="' + c[0] + '"' + (k === i ? ' aria-current="step"' : '') + (ui.visited[c[0]] && k !== i ? ' class="done"' : '') + '>' + c[1] + '</button>'; }).join('') + '</nav>' +
        '<div class="thead"><h2>' + CATS[i][1] + '</h2></div><div class="tbody">' + options(ui.cat) + '</div><div class="tfoot">' + (i > 0 ? '<button type="button" class="back" data-a="prev" aria-label="Back">' + BACK + '</button>' : '') +
        (last ? doneBtn() : '<button type="button" class="cta" data-a="next"' + (onList().length ? '' : ' disabled') + '>Next: ' + CATS[i + 1][1] + ' ' + ARROW + '</button>') + '</div>';
    }
    tray.innerHTML = h;
    var nb = tray.querySelector('.tbody'); if (nb && keep) nb.scrollTop = top;
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
    if (v === 'x') { hideBubble(); ui.quietUntil = performance.now() + 20000; return; }
    hideBubble();
    if (kind === 'where') { ui.qWhere = v; setRange(v === 'bottom' ? 0 : 6, v === 'top' ? 0 : 6); G.pop(); refresh(); showBubble('many'); return; }
    if (kind === 'many') { var n = +v; setRange(ui.qWhere === 'bottom' ? 0 : n, ui.qWhere === 'top' ? 0 : n); ui.visited.teeth = 1; G.pop(); if (ui.layout === 'menu') ui.cat = null; refresh(); return; }
    if (v === 'more') { openCat(kind); return; }
    if (kind === 'metal') { paint({ metal: v }); DEF.metal = v; }
    if (kind === 'finish') { paint({ style: v, type: 'plain' }); DEF.style = v; DEF.type = 'plain'; }
    if (kind === 'stones') { if (v === 'none') { paint({ type: 'plain' }); DEF.type = 'plain'; } else { paint({ type: 'iced', setting: v, style: 'solid' }); DEF.type = 'iced'; DEF.setting = v; DEF.style = 'solid'; } }
    if (kind === 'extras') { if (v === 'fangs') SET.fangs = true; if (v === 'ins') { openCat('extras'); ui.extra = 'ins'; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); refresh(); return; } }
    if (kind === 'happy') { if (v === 'done') { done(); return; } ui.quietUntil = performance.now() + 30000; }
    if (kind !== 'happy') ui.visited[kind] = 1;
    refresh(true);
  });

  // ---------- moving around ----------
  function setMode(m) { ui.mode = m; app.setAttribute('data-mode', m); if (m !== 'build') { clearPicks(); hideBubble(); } box(); setTimeout(box, 450); }
  function openCat(c) { ui.cat = c; ui.visited[c] = 1; ui.extra = null; if (c === 'teeth') clearPicks(); refresh(); }
  function stepOf() { if (ui.mode === 'q') return ui.q === 2 ? 1 : 0; return ui.cat === null ? 5 : catIndex(ui.cat); }
  var shown = 0, anim = 0;
  function meta() {
    var b = breakdown(), to = b.total, from = shown, t0 = performance.now(); cancelAnimationFrame(anim);
    (function step(t) { var k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (to - from) * e); $('price').textContent = money(shown) + (b.quote ? ' +' : ''); if (k < 1 && !reduce) anim = requestAnimationFrame(step); else { shown = to; $('price').textContent = money(to) + (b.quote ? ' +' : ''); } })(t0);
  }
  function box() {
    var st = stage.getBoundingClientRect(), W = st.width, H = st.height, top = 60;
    if (ui.mode === 'door') { var el = ui.open === 'a' ? $('openA') : null, r = el ? el.getBoundingClientRect() : null; G.box = { top: top, bottom: r ? Math.max(top + 160, r.top - st.top - 6) : H * .55, left: 0, right: W }; return; }
    if (ui.mode === 'build' || ui.mode === 'q') {
      var t = tray.getBoundingClientRect(), limit = t.top;
      if (W < 900 && !bubble.hidden) limit = Math.min(limit, bubble.getBoundingClientRect().top);   // on a phone the piece makes room for the guide's question
      G.box = W >= 900 ? { top: top, bottom: H - 24, left: 0, right: t.left - st.left - 8 } : { top: top, bottom: Math.max(top + 110, limit - st.top - 6), left: 0, right: W };
      return;
    }
    G.box = { top: top, bottom: H * .62, left: 0, right: W };
  }
  window.addEventListener('resize', box);
  function refresh(glint) {
    ui.step = stepOf();
    if (ui.mode === 'build' || ui.mode === 'q') renderTray();
    var sc = $('selchip'), show = ui.mode === 'build' && hasSel();
    var pk = picked(); sc.hidden = !show; if (show) sc.innerHTML = (pk.length === 1 ? 'Editing the <b>' + esc(toothName(pk[0]).toLowerCase()) + '</b> only' : 'Editing <b>' + pk.length + ' teeth</b>') + ' <span class="x">Whole set</span>';
    meta(); box(); requestAnimationFrame(box); G.sync(); G.goal(); if (glint) G.glint(); if (!bubble.hidden) placeBubble();
    if (!proto.hidden) renderProto();
  }
  function firstFront() { var p = [7, 8, 6, 9, 23, 24].filter(function (x) { return T[x].on; })[0]; return p === undefined ? (onList()[0] === undefined ? null : onList()[0]) : p; }
  function done() {
    ui.tDone = performance.now(); setMode('done'); G.goal(true);
    var shot = G.shot(960, 720) || '', b = breakdown();
    sheet.innerHTML = '<div class="sheet-in"><div class="print"><img alt="Your build" src="' + shot + '"><div class="cap"><span>' + esc(lookLabel()) + '</span><span>' + money(b.total) + (b.quote ? ' + quote' : '') + '</span></div></div><div class="side"><h2>Your build.</h2>' +
      '<div class="box"><h3>What you made</h3><ul>' + specLines().filter(function (l) { return l.indexOf('Fit:') !== 0; }).map(function (l) { return l.replace(/^(\d+ teeth) \(\d+ teeth\)$/, '$1'); }).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="box"><div class="tot"><span>Estimated total</span><span>' + money(b.total) + '</span></div><p class="note">Built in ' + mmss(elapsed()) + ' with ' + ui.taps + ' taps.</p></div>' +
      '<button type="button" class="cta" data-s="photo">See it as a studio photo ' + ARROW + '</button><button type="button" class="cta ghost" data-s="keep">Keep editing</button></div></div>';
    sheet.hidden = false; sheet.scrollTop = 0;
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
    if (!t.closest('#tray')) return;
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
  });
  tray.addEventListener('change', function (e) {
    var kind = e.target.getAttribute && e.target.getAttribute('data-up'); if (!kind) return;
    var f = e.target.files[0]; if (!f) return; var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = Math.min(1, 900 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); var url = c.toDataURL('image/jpeg', .8); if (kind === 'photo') { SET.photo = url; if (G.photo) G.photo(im); } else SET.inspo = url; refresh(true); }; im.src = fr.result; };
    fr.readAsDataURL(f);
  });
  $('jawbtn').addEventListener('click', function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', o); $('jawlabel').textContent = o ? 'Close mouth' : 'Open mouth'; G.jaw(o); });
  $('turnbtn').addEventListener('click', function () { if (G.turn) G.turn(); });

  // ---------- prototype switches (not part of the product) ----------
  var PAIRS = [];
  var protoTimer = 0;
  function renderProto() {
    proto.innerHTML = '<h3>Compare</h3>' + PAIRS.map(function (p) { return '<div class="pair"><p>' + p[1] + '</p><div class="seg">' + p[2].map(function (o) { return '<button type="button" data-p="' + p[0] + '" data-v="' + o[0] + '" aria-pressed="' + (ui[p[0]] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="stat"><p>This run</p><b id="pclock">' + mmss(elapsed()) + ' · ' + ui.taps + ' taps</b></div>' +
      '<div class="pair"><p>Holder</p><input type="range" id="psolid" min="30" max="100" step="5" value="' + (ui.solid || 70) + '" aria-label="How solid the clear holder is"></div>' +
      '<button type="button" class="sm" data-p="restart">Start again from the opening</button><p>Chosen so far: bare teeth with a row of builds; the EA FC-style menu, leaning jeweler; a guide when you seem stuck. Tap teeth on the 3D to pick several; leave it alone for 9 seconds to meet the guide.</p>';
  }
  function setVariant(k, v) { ui[k] = v; app.setAttribute('data-' + k, v); }
  function restart() { sheet.hidden = true; hideBubble(); resetAll(); ui.build = null; ui.t0 = 0; ui.tDone = 0; ui.taps = 0; ui.visited = {}; ui.cat = null; ui.extra = null; ui.quietUntil = 0; setMode('door'); renderOpenings(); G.sync(); G.goal(); meta(); }
  $('protobtn').addEventListener('click', function () { var open = proto.hidden; proto.hidden = !open; this.setAttribute('aria-expanded', open); clearInterval(protoTimer); if (open) { renderProto(); protoTimer = setInterval(function () { var c = $('pclock'); if (c) c.textContent = mmss(elapsed()) + ' · ' + ui.taps + ' taps'; }, 500); } });
  proto.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return; var p = b.getAttribute('data-p'), v = b.getAttribute('data-v');
    if (p === 'restart') { restart(); renderProto(); return; }
    setVariant(p, v);
    if (p === 'open') restart();
    if (p === 'layout' && ui.mode === 'build') { if (v === 'steps' && ui.cat === null) ui.cat = 'teeth'; refresh(); }
    if (p === 'guide') { hideBubble(); if (v === 'start') restart(); }
    renderProto();
  });
  proto.addEventListener('input', function (e) { if (e.target.id === 'psolid') { ui.solid = +e.target.value; G.solid(ui.solid); } });

  // ---------- start ----------
  setVariant('open', 'a'); setVariant('layout', 'menu'); setVariant('guide', 'stuck'); setVariant('menu', 'calm');
  resetAll(); setMode('door'); renderOpenings(); meta();
  if (G.boot) { G.boot(); setTimeout(function () { renderOpenings(); box(); }, 400); }
  window.__vvs = { T: T, ui: ui, SET: SET, G: G };
})();
