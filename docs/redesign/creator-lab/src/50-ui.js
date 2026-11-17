
  // =====================================================================
  // The creator: start empty, from a build, or by describing it; then change anything, like building a player in a football game.
  // Chosen Nov 17: the build strip with Next and Back, a guide when you seem stuck, and AI as "Describe it" on the start page and as a tool on the stage.
  // =====================================================================
  var tray = $('tray'), proto = $('proto'), bubble = $('bubble');
  var CATS = [['teeth', 'Teeth'], ['metal', 'Metal'], ['finish', 'Finish'], ['stones', 'Stones'], ['extras', 'Extras']];
  ui.cat = null; ui.build = null; ui.visited = {}; ui.qWhere = 'both';
  ui.t0 = 0; ui.tDone = 0; ui.taps = 0; ui.lastTouch = performance.now(); ui.quietUntil = 0; ui.bub = null; ui.extra = null;
  var ARROW = '';   // no arrows inside buttons (owner, Nov 17)
  var BACK = '';
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
    ui.resume = false; resetAll(); if (id !== 'empty') buildById(id)[3](); ui.build = id; clearPicks();
    G.sync(); if (id !== 'empty') { G.pop(); G.glint(); } meta();
  }

  // ---------- the openings ----------
  // The start page (v12, Nov 17; the owner asked for the best way, "even if it means redesigning the start empty screen"):
  // three equal ways in, then the popular builds, which open the builder in one tap. v11 (chips beside Start empty) stays behind a switch to compare.
  var SPARK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7 2.2l1.3 3.4 3.4 1.3-3.4 1.3L7 11.6 5.7 8.2 2.3 6.9l3.4-1.3zM12.6 10.4l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  var CAMERA = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="12" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 4 6.6 2.4h2.8L10.5 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8.6" r="2.3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  function door(k, icon, title, sub) { return '<button type="button" class="door" data-door="' + k + '"><span class="prev">' + ic(icon) + '</span><b>' + title + '</b><span>' + sub + '</span></button>'; }
  function renderOpenings() {
    if (ui.trial === 'name') { $('openA').innerHTML = sellPanel(); doorExtras(); return; }   // the jeweler's trial starts in the start panel
    var builds = BUILDS.map(function (b) { return '<button type="button" class="build" data-build="' + b[0] + '" aria-pressed="' + (ui.build === b[0]) + '"><span class="pic">' + setSvg(b[2][0], b[2][1], b[2][2]) + '</span><b>' + b[1] + '</b><span>' + priceOf(b[0]) + '</span></button>'; }).join('');
    if (ui.door === 'v11') {
      $('openA').innerHTML = '<div class="head"><h2>Start your build</h2><span>Start empty, or from a build you can change.</span></div>' +
        '<div class="builds" role="group" aria-label="Starting builds"><button type="button" class="build empty" data-build="empty" aria-pressed="' + (ui.build === 'empty') + '"><span class="pic"><i>+</i></span><b>Start empty</b><span>Pick every tooth</span></button>' + builds + '</div>' +
        '<div class="go"><div class="chips" role="group" aria-label="Let AI build it"><button type="button" class="chip" data-ai="describe">' + SPARK + 'Describe it</button><button type="button" class="chip" data-ai="picture">' + CAMERA + 'From a picture</button></div><button type="button" class="cta" id="goA" style="flex:0 1 280px">' + (ui.resume ? 'Continue your build' : ui.build && ui.build !== 'empty' ? 'Customise this build' : 'Start empty') + '</button></div>';
      doorExtras();
      return;
    }
    $('openA').innerHTML = '<div class="head"><h2>' + (ui.resume ? 'Your build is waiting' : 'Start your build') + '</h2><span>' + (ui.resume ? esc(receipt()) : '<span class="wide">Three ways in. Change anything after.</span><span class="narrow">Three ways in, or a popular build below.</span>') + '</span></div>' +
      (ui.resume ? '<button type="button" class="cta" id="goA">Continue your build</button>' : '') +
      '<div class="doors" role="group" aria-label="Ways to start">' + door('describe', 'spark', 'Describe it', 'AI builds it from your words') + door('picture', 'cam', 'From a picture', 'A photo or a screenshot') + door('empty', 'plus', 'Build it yourself', 'Pick every tooth') + '</div>' +
      '<p class="orlab">' + (ui.resume ? 'Or start again from a popular build' : 'Or tap a popular build') + '</p><div class="builds" role="group" aria-label="Popular builds">' + builds + '</div>';
    doorExtras();
  }
  function startCreator() {
    if (!ui.t0) ui.t0 = performance.now(); freshHistory();
    ui.cat = 'teeth'; clearPicks(); ui.visited = { teeth: 1 }; ui.extra = null; ui.navHist = [];
    if (!onList().length) ui.build = 'empty';
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
  function selWord() {
    var pk = picked(); if (!pk.length) return 'Whole set';
    for (var i = 0; i < GROUPS.length; i++) { var tg = groupTeeth(GROUPS[i][0]); if (tg.length && sameSet(pk, tg)) return GROUPS[i][1]; }
    return pk.length + (pk.length === 1 ? ' tooth' : ' teeth');
  }
  function changeBar() {                 // Select teeth: a toggle on the stage; it opens the groups
    var bar = $('changebar'), show = ui.mode === 'build' && onList().length > 0 && ui.cat !== 'teeth';
    bar.hidden = !show; app.toggleAttribute('data-change', show); if (!show) { ui.selOpen = false; return; }
    $('selval').textContent = picked().length ? selWord() : ''; $('selbtn').setAttribute('aria-expanded', !!ui.selOpen);
    var pop = $('selpop'); pop.hidden = !ui.selOpen; if (ui.selOpen) pop.innerHTML = applyRow();
    placeSel();
  }
  function placeSel() {                  // phone: bottom right, in line with the tools; computer: beside Undo, or above the tools when there's no room
    var bar = $('changebar'); if (bar.hidden) return;
    var st = stage.getBoundingClientRect();
    if (st.width < 900) { var t = tray.getBoundingClientRect(); bar.style.left = ''; bar.style.right = ''; bar.style.bottom = Math.round(st.bottom - t.top + 12) + 'px'; $('selpop').style.maxWidth = ''; app.removeAttribute('data-selrow'); return; }
    var tl = $('tools').getBoundingClientRect(), edge = tray.getBoundingClientRect().left, w = $('selbtn').offsetWidth;
    if (tl.right + 6 + w <= edge - 16) { bar.style.left = Math.round(tl.right - st.left + 6) + 'px'; bar.style.bottom = Math.round(st.bottom - tl.bottom) + 'px'; app.setAttribute('data-selrow', ''); }
    else { bar.style.left = Math.round(tl.left - st.left) + 'px'; bar.style.bottom = Math.round(st.bottom - tl.top + 8) + 'px'; app.removeAttribute('data-selrow'); }
    $('selpop').style.maxWidth = Math.max(220, Math.round(edge - bar.getBoundingClientRect().left - 16)) + 'px';   // the groups wrap rather than slide under the panel
  }
  function applyRow() {                  // which teeth the choices go to
    var on = onList(), pk = picked(), mine = pk.length > 0;
    var chips = GROUPS.map(function (g) { var tg = groupTeeth(g[0]); if (!tg.length || tg.length === on.length) return ''; var hit = mine && sameSet(pk, tg); if (hit) mine = false; return chip('pick', g[0], g[1], hit); }).join('');
    return '<div class="chips">' + chip('pick', 'all', 'Whole set', !pk.length) + chips + (mine ? chip('pick', 'mine', pk.length + (pk.length === 1 ? ' tooth' : ' teeth') + ' picked', true) : '') + '</div>';
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
  function doneBtn() { var b = breakdown(); return '<button type="button" class="cta" data-a="done"' + (onList().length ? '' : ' disabled') + '>Done <small>' + money(b.total) + (b.quote ? ' +' : '') + '</small></button>'; }
  function renderTray() {
    var view = ui.mode + '|' + ui.cat + '|' + ui.after + '|' + ui.aiStep, keep = view === renderTray.view ? [].map.call(tray.querySelectorAll('.tbody'), function (e) { return e.scrollTop; }) : null;   // keep the scroll only when redrawing the same screen
    renderTray.view = view;
    if (ui.mode === 'after') { tray.innerHTML = renderAfter(); return; }
    if (ui.mode === 'ai') { tray.innerHTML = renderAI(); if (!keep && ui.aiStep === 'talk' && ui.ai.msgs.length) { var tb = tray.querySelector('.tbody'); if (tb) tb.scrollTop = tb.scrollHeight; } return; }   // keep talking opens on the latest reply
    if (ui.cat === null) { ui.cat = 'teeth'; ui.visited.teeth = 1; }
    tray.innerHTML = stripView();
    if (keep) [].forEach.call(tray.querySelectorAll('.tbody'), function (e, i) { if (keep[i] !== undefined) e.scrollTop = keep[i]; });
  }
  // ---------- the build strip (chosen Nov 17): the five parts pinned on top, the open part below ----------
  function partBody(c) { return '<p class="intro">' + INTRO[c] + '</p>' + options(c); }
  function nextOf(c) { var i = catIndex(c); return i < CATS.length - 1 ? CATS[i + 1] : null; }
  function stripView() {
    var c = ui.cat, nx = nextOf(c), off = onList().length ? '' : ' disabled';
    var strip = '<div class="strip5" role="tablist" aria-label="Your build">' + CATS.map(function (k) {
      var on = c === k[0], fresh = !ui.visited[k[0]];
      return '<button type="button" class="sitem' + (fresh ? ' fresh' : '') + '" role="tab" aria-selected="' + on + '" data-open="' + k[0] + '"' + (fresh ? ' aria-label="' + k[1] + ', not opened yet"' : '') + '><span class="prev">' + preview(k[0]) + '</span><b>' + k[1] + '</b><span class="sv">' + esc(rowValue(k[0])) + '</span></button>';
    }).join('') + '</div>';
    var seen = CATS.filter(function (k) { return ui.visited[k[0]]; }).length;   // the rings show which parts are still new; the count sits by the buttons, where the choice to finish is made
    var foot = '<div class="btns"><button type="button" class="cta ghost second" data-a="sback">Back</button>' + (nx ? '<button type="button" class="cta" data-a="next"' + off + '>Next</button>' : doneBtn()) + '</div><p class="free">' + (seen === CATS.length ? 'Everything explored' : seen + ' of ' + CATS.length + ' explored') + '</p>';
    return strip + '<div class="thead"><h2>' + CATS[catIndex(c)][1] + '</h2></div><div class="tbody">' + partBody(c) + '</div><div class="tfoot col">' + foot + '</div>';
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
    bubble.hidden = false; app.setAttribute('data-bub', ''); placeBubble(); box();
  }
  function snap() { return JSON.stringify({ T: T, D: DEF, S: SET, v: ui.visited, p: ui.picks, s: ui.sel }); }
  function unsnap(s) {
    var o = JSON.parse(s); T = o.T; DEF = o.D; Object.keys(SET).forEach(function (k) { delete SET[k]; }); Object.assign(SET, o.S);
    ui.visited = o.v; ui.picks = o.p || []; ui.sel = o.s; if (window.__vvs) window.__vvs.T = T; G.sync();
  }
  function scopeWords() { var p = picked(); return p.length ? (p.length === 1 ? 'the ' + toothName(p[0]).toLowerCase() : 'the ' + p.length + ' teeth you picked') : 'all ' + onList().length + ' teeth'; }
  function teethWords() { var on = onList(), t = on.filter(function (k) { return k < 16; }).length, b = on.length - t; return (t && b ? t + ' top and ' + b + ' bottom teeth' : t ? t + ' top teeth' : b + ' bottom teeth') + ' picked'; }
  function showUndo(msg, s, kind, who, ms) {
    clearTimeout(ui.undoTimer); ui.bub = 'undo'; ui.undoSnap = s; ui.undoKind = kind;
    bubble.innerHTML = '<div class="who"><i></i>' + (who || 'Changed') + '<button type="button" class="x" data-b="x" aria-label="Close">×</button></div><div class="undo"><p>' + esc(msg) + '</p><button type="button" class="chip" data-b="undo">Undo</button></div>';
    bubble.hidden = false; app.setAttribute('data-bub', ''); placeBubble(); box();
    ui.undoTimer = setTimeout(function () { if (ui.bub === 'undo') { hideBubble(); ui.lastTouch = performance.now(); } }, ui.undoMs || ms || 6000);
  }
  function placeBubble() {               // on a phone the bubble sits just above the controls, never over the piece
    var st = stage.getBoundingClientRect();
    if (st.width >= 900) { bubble.style.bottom = ''; return; }
    var t = tray.getBoundingClientRect(); bubble.style.bottom = Math.round(st.bottom - t.top + 10) + 'px';
  }
  function hideBubble() { var was = !bubble.hidden; bubble.hidden = true; ui.bub = null; app.removeAttribute('data-bub'); if (was) box(); }
  function nextSuggestion() {
    if (!onList().length) return 'where';
    var order = ['metal', 'finish', 'stones', 'extras'];
    for (var k = 0; k < order.length; k++) if (!ui.visited[order[k]]) return order[k];
    return 'happy';
  }
  setInterval(function () {
    if (ui.mode !== 'build') { if (!bubble.hidden) hideBubble(); return; }
    var now = performance.now(); if (!bubble.hidden || now < ui.quietUntil) return;
    if (!onList().length) { showBubble('where'); return; }
    if (now - Math.max(ui.lastTouch, G.touched || 0) > 9000) showBubble(nextSuggestion());
  }, 1000);
  bubble.addEventListener('click', function (e) {
    var b = e.target.closest('[data-b]'); if (!b) return; var v = b.getAttribute('data-b'), kind = ui.bub; buzz(); ui.lastTouch = performance.now();
    if (kind === 'undo') { clearTimeout(ui.undoTimer); hideBubble(); if (v === 'undo') { unsnap(ui.undoSnap); refresh(true); if (ui.undoKind) showBubble(ui.undoKind); } return; }   // undoing an answer brings its question back
    if (v === 'x') { hideBubble(); ui.quietUntil = performance.now() + 20000; return; }
    hideBubble();
    var before = kind === 'many' && ui.qSnap ? ui.qSnap : snap(), msg = '';
    if (kind === 'where') { ui.qSnap = before; ui.qWhere = v; setRange(v === 'bottom' ? 0 : 6, v === 'top' ? 0 : 6); G.pop(); refresh(); showBubble('many'); return; }
    if (kind === 'many') { var n = +v; setRange(ui.qWhere === 'bottom' ? 0 : n, ui.qWhere === 'top' ? 0 : n); ui.visited.teeth = 1; G.pop(); ui.cat = 'teeth'; ui.qSnap = null; refresh(); showUndo(teethWords(), before, 'where'); return; }
    if (v === 'more') { openCat(kind); return; }
    if (kind === 'metal') { msg = METALS[v].name + ' on ' + scopeWords(); paint({ metal: v }); DEF.metal = v; }
    if (kind === 'finish') { msg = STYLES[v][0] + ' on ' + scopeWords(); paint({ style: v, type: 'plain' }); DEF.style = v; DEF.type = 'plain'; }
    if (kind === 'stones') { msg = v === 'none' ? 'No stones on ' + scopeWords() : SETTINGS[v][0] + ' stones on ' + scopeWords(); if (v === 'none') { paint({ type: 'plain' }); DEF.type = 'plain'; } else { paint({ type: 'iced', setting: v, style: 'solid' }); DEF.type = 'iced'; DEF.setting = v; DEF.style = 'solid'; } }
    if (kind === 'extras') { if (v === 'fangs') { SET.fangs = true; msg = 'Fangs added'; } if (v === 'ins') { openCat('extras'); ui.extra = 'ins'; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); refresh(); return; } }
    if (kind === 'happy') { if (v === 'done') { done(); return; } ui.quietUntil = performance.now() + 30000; }
    if (kind !== 'happy') ui.visited[kind] = 1;
    refresh(true);
    if (msg) showUndo(msg, before, kind);
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
    insta: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
    spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/>',
    cam: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>'
  };
  function ic(k) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + IC[k] + '</svg>'; }

  // ---------- after "Done": one screen to send it (the price, the fitting, where to text), the code, then Sent ----------
  ui.after = 0; ui.c = { name: '', phone: '', ig: '', email: '', note: '' }; ui.verified = loadVerified();
  function shopName() { return ui.site === 'shop' ? (ui.shopLabel || 'Your shop') : 'VVS Lab'; }
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
      '</div><div class="tfoot col"><div class="btns"><button type="button" class="cta ghost second" data-x="back2">' + BACK + 'Back</button><button type="button" class="cta" disabled>' + (ui.mode === 'ai' ? (ui.checking ? 'Building…' : 'Build it') : (ui.checking ? 'Sending…' : 'Send to ' + S)) + '</button></div><p class="free">It ' + (ui.mode === 'ai' ? 'builds' : 'sends') + ' as soon as the code is in.</p></div>';
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
      row({ attrs: 'data-x="follow"', title: 'Follow @vvslab.ai', hint: 'Opens Instagram', thumb: ic('insta') }) +
      '<div class="field"><label for="aemail">Email me a copy</label><input id="aemail" type="email" inputmode="email" autocomplete="email" value="' + esc(ui.c.email) + '"></div></section>' +
      '<section class="sect"><h3 class="sec">What happens next</h3><ol class="steps">' + steps.map(function (s, i) { return '<li><span class="n">' + (i + 1) + '</span><span class="txt"><b>' + s[0] + '</b>' + (s[1] ? '<span class="ins">' + s[1] + '</span>' : '') + '</span><span class="prev">' + s[2] + '</span></li>'; }).join('') + '</ol></section>' +
      '<p class="proto-note">Prototype: nothing is sent and no card is charged. The real studio photo is made by AI from this design in about 30 seconds; here the 3D stands in for it.</p></div><div class="tfoot">' + foot + '</div>';
  }

  // ---------- AI: "Describe it", or start from a picture (decided Nov 17) ----------
  // On the start page and as a tool on the stage. A conversation: one box, then keep talking. The phone sign-up comes first and says why,
  // plainly; every phone gets 3 free builds and every reply counts. The AI builds the closest version in the 3D, all editable, says what's
  // different, and offers Undo. In this prototype a simple word matcher stands in for the AI, and the page says so.
  var AI_FREE = 3;
  ui.ai = { msgs: [], text: '', pic: null }; ui.aiStep = 'talk'; ui.aiFrom = 'door'; ui.aiErr = '';
  function aiKey() { return 'vvs-ai-' + (ui.verified ? ui.verified.phone : 'none'); }
  function aiUsed() { try { return +(localStorage.getItem(aiKey()) || 0); } catch (e) { return ui.aiMem || 0; } }
  function aiLeft() { return Math.max(0, AI_FREE - aiUsed()); }
  function aiCount() { var n = aiUsed() + 1; try { localStorage.setItem(aiKey(), n); } catch (e) { ui.aiMem = n; } }
  function openAI(from, wantPic) {
    ui.aiFrom = from; ui.aiStep = 'talk'; ui.aiErr = ''; hideBubble(); ui.selOpen = false;
    setMode('ai'); refresh();
    if (wantPic) { var inp = tray.querySelector('[data-up="ai"]'); if (inp) inp.click(); } else focusId('aitext');
  }
  function leaveAI() { if (ui.aiFrom === 'build') { setMode('build'); refresh(true); } else goDoor(); }
  function freeWords() {
    if (!known()) return AI_FREE + ' free AI builds per phone. Each one costs us money, so we text you a code first.';
    var l = aiLeft(); return l ? l + ' of ' + AI_FREE + ' free builds left on this phone. Every build counts, small changes too.' : 'That was your ' + AI_FREE + ' free builds on this phone.';
  }
  function aiMsg(m) {
    return '<div class="me">' + esc(m.me) + (m.pic ? '<img alt="Your picture" src="' + m.pic + '">' : '') + '</div>' +
      row({ cls: 'lead', title: m.diff.length ? 'Built the closest match' : 'Built it', hint: esc(m.built) + m.diff.map(function (d) { return '<br>' + esc(d); }).join(''), thumb: m.svg });
  }
  function renderAI() {
    if (ui.aiStep === 'contact') return aiContact();
    if (ui.aiStep === 'code') return afterCode();
    var first = !ui.ai.msgs.length, out = known() && !aiLeft();
    var h = '<div class="thead"><h2>' + (first ? 'Describe your grill' : 'Keep talking') + '</h2></div><div class="tbody flow">' +
      (first ? '<p class="intro">Say it the way you\'d say it to a jeweler. AI builds the closest version in the 3D, tells you what\'s different, and you can change anything after.</p>' : '<div class="chat">' + ui.ai.msgs.map(aiMsg).join('') + '</div>');
    if (out) h += row({ cls: 'lead', title: 'Keep going by hand', hint: 'Everything on your grill is still yours to change: tap a part on top, or tap teeth on the 3D.', thumb: ic('check') });
    else h += '<section class="sect"><div class="field"><textarea id="aitext" maxlength="300" placeholder="' + (first ? 'Iced out bottom 8 in white gold, with fangs' : 'Make the front two rose gold') + '" aria-label="Describe your grill">' + esc(ui.ai.text) + '</textarea></div>' +
      '<label class="up">' + (ui.ai.pic ? '<img alt="" src="' + ui.ai.pic + '">' : '') + '<span>' + (ui.ai.pic ? 'Change the picture' : 'Or add a picture: a photo or a screenshot') + '</span><input type="file" accept="image/*" data-up="ai"></label>' +
      '<p class="err" id="aierr" role="alert">' + (ui.aiErr || '') + '</p></section>';
    h += '<p class="proto-note">Prototype: a simple word matcher stands in for the AI. It knows teeth counts, metals, karats, finishes, stones, fangs and letters, and can\'t see pictures yet; the real AI will.</p></div>';
    var main = out ? '<button type="button" class="cta" data-x="hand">Keep editing by hand</button>' : '<button type="button" class="cta" data-x="go">' + (known() ? 'Build it' : 'Text me a code to build it') + '</button>';
    return h + '<div class="tfoot col"><div class="btns"><button type="button" class="cta ghost second" data-x="aiback">Back</button>' + main + '</div><p class="free">' + freeWords() + '</p></div>';
  }
  function aiContact() {
    var S = esc(shopName());
    return '<div class="thead"><h2>Where should we text your code?</h2></div><div class="tbody flow">' +
      '<p class="intro">Every AI build costs us money, so we ask for your phone first. Each phone gets ' + AI_FREE + ' free builds, and it\'s the number ' + S + ' texts about your grill.</p>' +
      '<section class="sect">' + contactHtml() + '</section></div>' +
      '<div class="tfoot col"><div class="btns"><button type="button" class="cta ghost second" data-x="aiback">Back</button><button type="button" class="cta" data-x="go">Text me a code</button></div><p class="free">Free. Nothing to pay.</p></div>';
  }
  function aiAction(x) {
    if (x === 'aiback') { if (ui.aiStep === 'talk') leaveAI(); else { ui.aiStep = 'talk'; renderTray(); focusId('aitext'); } return; }
    if (x === 'hand') { setMode('build'); refresh(true); return; }
    if (x === 'back2' || x === 'wrong') { clearTimeout(ui.smsT); ui.code = ''; ui.sms = null; ui.aiStep = 'contact'; renderTray(); if (x === 'wrong') focusId('aphone'); return; }
    if (x === 'resend') { sendCode(true); return; }
    if (x === 'fill') { ui.code = ui.sms; check(); return; }
    if (x !== 'go') return;
    if (ui.aiStep === 'talk') {
      if (!ui.ai.text.trim() && !ui.ai.pic) { ui.aiErr = 'Say what you want, or add a picture.'; var p = $('aierr'); if (p) p.textContent = ui.aiErr; focusId('aitext'); return; }
      ui.aiErr = '';
      if (known()) { if (aiLeft()) runAI(); else renderTray(); return; }
      ui.aiStep = 'contact'; renderTray(); focusId('aname'); return;
    }
    var e = contactErr(); if (e) { ui.err = e[1]; var q = $('aerr'); if (q) q.textContent = e[1]; focusId(e[0]); return; }
    ui.err = ''; sendCode();
  }
  function runAI() {
    var text = ui.ai.text.trim(), pic = ui.ai.pic, before = snap();
    if (ui.aiFrom !== 'build') { freshHistory(); ui.lastSnap = designSnap(); if (!ui.t0) ui.t0 = performance.now(); }   // so the Undo tool steps back over the build too
    var r = wish(text, pic);
    if (pic) SET.inspo = pic;
    if (text) SET.idea = ((SET.idea ? SET.idea + ' / ' : '') + text).slice(0, 400);   // their words travel to the jeweler as "their idea"
    aiCount();
    var n = counts(); ui.ai.msgs.push({ me: text || 'A picture', pic: pic, built: r.built, diff: r.diff, svg: setSvg(n[0], n[1], same(function (t) { return t.type; }) === 'iced' ? 'iced' : 'gold') });
    ui.ai.text = ''; ui.ai.pic = null; ui.aiStep = 'talk'; ui.aiFrom = 'build'; ui.build = null; ui.navHist = []; ui.cat = 'teeth'; ui.visited.teeth = 1; clearPicks();
    setMode('build'); G.sync(); G.pop(); refresh(true);
    showUndo(r.built + (r.diff.length ? '. ' + r.diff[0] : ''), before, null, 'AI built it', 10000);
  }
  // the stand-in for the AI: a word matcher over the shop's own options. Anything it can't make becomes the closest match, and it says so.
  var NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, sixteen: 16 };
  var JOIN = [[/open ?face/g, 'openface'], [/diamond ?cut/g, 'diamondcut'], [/diamond ?dust/g, 'diamonddust'], [/deep ?cut/g, 'deepcut'], [/(?:two|2) ?tone/g, 'twotone'], [/bust ?down/g, 'bustdown'], [/white ?gold/g, 'whitegold'], [/(?:rose|pink) ?gold/g, 'rosegold'], [/black ?gold/g, 'blackgold'], [/lab ?(?:grown|diamonds?|made)/g, 'labdiamond'], [/(?:natural|real) ?diamonds?/g, 'naturaldiamond'], [/(?:one|1) ?of ?(?:one|1)|one of a kind/g, 'oneofone'], [/full ?set|whole mouth|all (?:my |of my )?teeth|every tooth/g, 'fullset']];
  function wish(text, pic) {
    var s = ' ' + text.toLowerCase().replace(/×/g, ' x ').replace(/[^a-z0-9& ]/g, ' ').replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|sixteen)\b/g, function (w) { return NUMW[w]; }) + ' ';
    JOIN.forEach(function (j) { s = s.replace(j[0], j[1]); }); s = s.replace(/\s+/g, ' ');
    var diff = [], fresh = !onList().length, has = function (re) { return re.test(s); }, m, top = null, bot = null, c0 = counts();
    // which teeth
    if (has(/fullset/)) { top = 16; bot = 16; }
    else if ((m = s.match(/(\d+) ?(?:x|by|and|&|over) ?(\d+)/))) { top = +m[1]; bot = +m[2]; }
    else {
      var mt = s.match(/(\d+) (?:on (?:the )?)?(?:top|upper)/) || s.match(/(?:top|upper) (?:row |teeth )?(?:of )?(\d+)/), mb = s.match(/(\d+) (?:on (?:the )?)?(?:bottom|lower)/) || s.match(/(?:bottom|lower) (?:row |teeth )?(?:of )?(\d+)/);
      if (mt) top = +mt[1]; if (mb) bot = +mb[1];
      if (top === null && bot === null) {
        var n = s.match(/ (\d+) /), k = n ? +n[1] : 6, tw = has(/ (?:top|upper) /), bw = has(/ (?:bottom|lower) /);
        if (has(/ single | 1 tooth /)) { top = 1; bot = 0; }
        else if (has(/ 2 piece /)) { top = 2; bot = 0; }
        else if (bw && !tw) { bot = k; top = fresh ? 0 : c0[0]; }
        else if (tw && !bw) { top = k; bot = fresh ? 0 : c0[1]; }
        else if (n || tw || bw) { top = k; bot = k; }
        else if (fresh && (text || !pic)) { top = 6; bot = 6; diff.push('You didn\'t say which teeth, so it\'s 6 × 6, the most popular set.'); }
      } else { if (top === null) top = fresh ? 0 : c0[0]; if (bot === null) bot = fresh ? 0 : c0[1]; }
    }
    if (top !== null && (top > 16 || bot > 16)) { top = Math.min(16, top); bot = Math.min(16, bot); diff.push('16 teeth per row is the most.'); }
    var fangs = has(/\b(?:fangs?|vampire|canines?)\b/);
    if (fangs && (top === null ? c0[0] : top) < 6) { top = 6; diff.push('Fangs sit on the upper canines, so it\'s 6 on top.'); }
    if (pic && !text) { if (fresh) { top = 6; bot = 6; DEF.type = 'iced'; diff.push('This prototype can\'t read pictures, so here\'s an iced 6 × 6 to start from.'); } else diff.push('This prototype can\'t read pictures, so nothing changed.'); }
    if (pic) diff.push('Your picture goes to the jeweler with your design; the real AI will read it too.');
    if (top !== null) { if (!top && !bot) { top = 6; bot = 6; } setRange(top, bot); ui.visited.teeth = 1; }
    // metal
    var patch = {};
    if (has(/whitegold|\bwhite\b/)) patch.metal = 'white'; else if (has(/rosegold|\brose\b/)) patch.metal = 'rose'; else if (has(/silver|sterling/)) patch.metal = 'silver'; else if (has(/platinum|\bplat\b/)) patch.metal = 'platinum';
    else if (has(/blackgold/)) { patch.metal = 'white'; diff.push('No black gold here; white gold is the closest.'); }
    else if (has(/titanium|steel|tungsten/)) { patch.metal = 'silver'; diff.push('No titanium or steel here; silver is the closest.'); }
    else if (has(/yellow|\bgold\b/)) patch.metal = 'yellow';
    if ((m = s.match(/\b(10|14|18) ?k\b/))) patch.karat = m[1] + 'k'; else if ((m = s.match(/\b(2[0-4]) ?k\b/))) { patch.karat = '18k'; diff.push(m[1] + 'K isn\'t offered; 18K is the highest here.'); } else if (has(/\b9 ?k\b/)) { patch.karat = '10k'; diff.push('10K is the lowest here, close to 9K.'); }
    // finish and stones
    var style = null, iced = has(/\b(?:ice|iced|icy|bustdown|flooded|flood|vvs|bling|pave|diamonds?|stones?|moissanite|moiss|honeycomb|mosaic|prong|labdiamond|naturaldiamond)\b/);
    if (has(/openface|\bopen\b/)) style = 'open';
    if (has(/diamondcut|faceted/)) style = 'cut';
    if (has(/diamonddust|\bdust\b/)) style = 'dust';
    if (has(/engrav|scroll/)) style = 'engr';
    if (has(/opal/)) { style = 'opal'; patch.opal = has(/\bfire\b|\bred\b|orange/) ? 'fire' : has(/\bblue\b/) ? 'blue' : 'white'; }
    if (has(/\bsolid\b|\bplain\b/)) style = 'solid';
    if (iced) {
      patch.type = 'iced';
      if (style && style !== 'open' && style !== 'solid') { diff.push('With stones set, the finish is the frame around them, so ' + STYLES[style][0].toLowerCase() + ' doesn\'t apply.'); style = 'solid'; }
      if (has(/honeycomb/)) patch.setting = 'honeycomb'; else if (has(/mosaic/)) patch.setting = 'mosaic'; else if (has(/prong/)) patch.setting = 'prong';
      if (has(/labdiamond|\blab\b/)) patch.stone = 'lab'; else if (has(/naturaldiamond|\bnatural\b|\breal\b/)) patch.stone = 'natural'; else if (has(/moiss/)) patch.stone = 'moissanite';
      if (style !== 'opal' && has(/\b(?:rub(?:y|ies)|red|emeralds?|green|sapphires?|blue|pink|purple|rainbow|colou?red|black diamonds?)\b/)) diff.push('No coloured stones here, so ' + STONES[patch.stone || cur().stone][0].toLowerCase() + 's, the closest match.');
    } else if (style && style !== 'open' && style !== 'solid') patch.type = 'plain';
    if (style) patch.style = style;
    // extras
    if (fangs) SET.fangs = true;
    if (has(/\bperm\b|permanent|seamless/)) SET.cut = 'permanent'; else if (has(/deepcut|removable/)) SET.cut = 'deep';
    if ((m = s.match(/\b(?:initials?|letters?|spell(?:ing)?|says?|saying|name|word) (?:of |that say |with |in |on it )?(?!on|in|of|the|with|and|my|it|iced|gold|a|an)([a-z0-9&]{1,6})\b/))) { SET.ins.text = m[1].toUpperCase(); SET.ins.style = has(/iced letters|letters iced|letters in stones/) ? 'iced' : has(/diamondcut letters|letters diamondcut|raised letters/) ? 'cut' : 'engraved'; }
    if (has(/charms?|oneofone|crest|crown|cross|custom piece/)) diff.push('Charms are picked by hand in Extras, and the jeweler quotes them.');
    if (has(/cuban|chain|pendant|\bring\b|bracelet|watch/)) diff.push('This builds grillz only.');
    if (has(/enamel|paint/)) diff.push('No enamel here yet.');
    // where it goes: the whole set, or the front teeth when they say so
    var scope = onList();
    if (!fresh && top === null && has(/\bfront\b/)) { var two = has(/front (?:2|two)|(?:2|two) front/); scope = two ? [7, 8, 23, 24].filter(function (k) { return T[k].on; }) : groupTeeth('front'); if (!scope.length) scope = onList(); }
    var whole = scope.length === onList().length;
    scope.forEach(function (k) { var t = T[k]; for (var key in patch) t[key] = patch[key]; if (t.type === 'iced' && t.style !== 'open' && t.style !== 'solid') t.style = 'solid'; });
    if (whole) for (var key in patch) DEF[key] = patch[key];
    if (has(/twotone/)) { var mid = [7, 8, 23, 24].filter(function (k) { return T[k].on; }).slice(0, 2); mid.forEach(function (k) { T[k].metal = T[k].metal === 'white' ? 'yellow' : 'white'; }); }
    if (SET.ins.text && (SET.ins.tooth === null || !T[SET.ins.tooth] || !T[SET.ins.tooth].on)) SET.ins.tooth = firstFront();
    var built = receipt(); if (insOn()) built += ' · "' + SET.ins.text + '"'; if (SET.cut === 'permanent') built += ' · permanent look';
    return { built: built, diff: diff };
  }
  function renderAfter() { return ui.after === 1 ? afterOne() : ui.after === 2 ? afterCode() : afterSent(); }
  function focusId(id) { var el = $(id); if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  function redraw() { var a = document.activeElement, id = a && tray.contains(a) ? a.id : ''; renderTray(); if (id) focusId(id); }   // redraw without losing the field being typed in
  function goAfter(n) { ui.after = n; app.setAttribute('data-after', n); refresh(); var b = tray.querySelector('.tbody'); if (b) b.scrollTop = 0; if (n === 2) focusId('aotp'); }
  function codeOpen() { return (ui.mode === 'after' && ui.after === 2) || (ui.mode === 'ai' && ui.aiStep === 'code'); }
  function smsLater() { clearTimeout(ui.smsT); ui.smsT = setTimeout(function () { if (codeOpen() && !ui.code && !ui.checking) { ui.sms = String(100000 + Math.floor(Math.random() * 900000)); renderTray(); focusId('aotp'); } }, 1800); }
  function sendCode(again) {
    ui.code = ''; ui.sms = null; ui.checking = false; ui.resendAt = performance.now() + 30000;
    if (ui.mode === 'ai') { ui.aiStep = 'code'; renderTray(); var b = tray.querySelector('.tbody'); if (b) b.scrollTop = 0; focusId('aotp'); } else goAfter(2);
    smsLater(); if (again) toast('A new code is on its way.');
  }
  function check() {
    ui.checking = true; renderTray();
    setTimeout(function () { ui.checking = false; ui.verified = { name: ui.c.name.trim(), phone: digits(ui.c.phone) }; saveVerified(ui.verified); ui.changing = false; if (ui.mode === 'ai') runAI(); else sendIt(); }, 900);
  }
  function sendIt() {
    if (known()) { ui.c.name = ui.verified.name; ui.c.phone = ui.verified.phone; }
    ui.sent = true; ui.tSent = performance.now(); ui.photo = G.shot(960, 720) || ''; ui.devAt = performance.now();
    goAfter(3); showPhoto();
  }
  function afterAction(x) {
    if (ui.mode === 'ai') { aiAction(x); return; }
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
    if (x === 'follow') { toast('This opens Instagram on @vvslab.ai.'); return; }
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
    else if (id === 'aitext') { ui.ai.text = v.slice(0, 300); if (ui.aiErr) { ui.aiErr = ''; var q = $('aierr'); if (q) q.textContent = ''; } }
    if ((id === 'aname' || id === 'aphone') && ui.err && !contactErr()) { ui.err = ''; var p = $('aerr'); if (p) p.textContent = ''; }
  }
  tray.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && (e.target.id === 'aname' || e.target.id === 'aphone' || e.target.id === 'aitext')) { e.preventDefault(); afterAction('go'); } });
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
    if (ui.mode !== 'after' && ui.mode !== 'ai') return;
    var n = $('otpnote'); if (n && codeOpen() && !ui.checking) { var w = resendWords(); if (n.getAttribute('data-w') !== w) { n.setAttribute('data-w', w); n.innerHTML = w; } }
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
  function openCat(c, noPush) {
    if (!noPush && ui.cat && ui.cat !== c) (ui.navHist = ui.navHist || []).push(ui.cat);   // Back returns here
    ui.cat = c; ui.visited[c] = 1; ui.extra = null; if (c === 'teeth') clearPicks(); refresh();
  }
  function stepOf() { if (ui.mode === 'after') return 5; if (ui.mode === 'ai') return 0; return ui.cat === null ? 5 : catIndex(ui.cat); }
  var shown = 0, anim = 0;
  function meta() {
    var b = breakdown(), to = b.total, from = shown, t0 = performance.now(); cancelAnimationFrame(anim);
    (function step(t) { var k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (to - from) * e); $('price').textContent = money(shown) + (b.quote ? ' +' : ''); if (k < 1 && !reduce) anim = requestAnimationFrame(step); else { shown = to; $('price').textContent = money(to) + (b.quote ? ' +' : ''); } })(t0);
  }
  function box() {
    var st = stage.getBoundingClientRect(), W = st.width, H = st.height, top = 60;
    if (ui.mode === 'door') {         // the piece sits above the hero on the front door, or above the start panel, and below the trial bar (if any)
      var r = (ui.home ? $('home') : $('openA')).getBoundingClientRect(), kb = $('keepbar'), bot = r.top - st.top - 6, tp = top;
      if (kb && !kb.hidden) tp = Math.max(tp, kb.getBoundingClientRect().bottom - st.top + 8);
      G.box = { top: tp, bottom: Math.max(tp + 140, bot), left: 0, right: W }; return;
    }
    if (ui.mode === 'build' || ui.mode === 'after' || ui.mode === 'ai') {
      var t = tray.getBoundingClientRect(), limit = t.top;
      if (W < 900 && !bubble.hidden) limit = Math.min(limit, bubble.getBoundingClientRect().top);   // on a phone the piece makes room for the guide's question
      var ch = ui.mode === 'build' && !$('changebar').hidden;   // keep the piece clear of Select teeth
      if (ch) { placeSel(); if (W < 900) limit = Math.min(limit, $('selbtn').getBoundingClientRect().top); }
      G.box = W >= 900 ? { top: top, bottom: H - (ch ? 64 : 24), left: 0, right: t.left - st.left - 8 } : { top: top, bottom: Math.max(top + 110, limit - st.top - 6), left: 0, right: W };
      if (ui.mode === 'after' && typeof placePhoto === 'function') placePhoto();
      return;
    }
    G.box = { top: top, bottom: H * .62, left: 0, right: W };
  }
  window.addEventListener('resize', box);
  document.addEventListener('pointerdown', function (e) { if (ui.selOpen && !e.target.closest('#changebar')) { ui.selOpen = false; changeBar(); } });
  function refresh(glint) {
    ui.step = stepOf(); app.toggleAttribute('data-empty', !onList().length);
    if (ui.mode === 'build' || ui.mode === 'after' || ui.mode === 'ai') renderTray();
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
    var bd = t.getAttribute('data-build'); if (bd) { applyBuild(bd); if (ui.door === 'v11') renderOpenings(); else startCreator(); return; }   // v12: a popular build opens the builder in one tap
    var dr = t.getAttribute('data-door'); if (dr) { if (dr === 'empty') { applyBuild('empty'); startCreator(); } else openAI('door', dr === 'picture'); return; }
    var aiv = t.getAttribute('data-ai'); if (aiv) { openAI(ui.mode === 'build' ? 'build' : 'door', aiv === 'picture'); return; }
    if (t.id === 'goA') { if (ui.resume) { ui.resume = false; setMode('build'); if (!ui.cat) ui.cat = 'teeth'; refresh(true); return; } if (!ui.build) applyBuild('empty'); startCreator(); return; }
    if (t.id === 'selbtn') { ui.selOpen = !ui.selOpen; changeBar(); return; }
    if (t.id === 'selchip') { clearPicks(); refresh(); return; }
    var x = t.getAttribute('data-x'); if (x) { afterAction(x); return; }
    var ft = t.getAttribute('data-fit'); if (ft) { SET.mold = ft; redraw(); return; }
    var op = t.getAttribute('data-open'); if (op) { if (!bubble.hidden && ui.bub !== 'where' && ui.bub !== 'many') hideBubble(); openCat(op); return; }
    var a = t.getAttribute('data-a');
    if (a === 'sback') { if (ui.navHist && ui.navHist.length) openCat(ui.navHist.pop(), true); else goDoor(); return; }
    if (a === 'next') { openCat(CATS[catIndex(ui.cat) + 1][0]); return; }
    if (a === 'done') { done(); return; }
    if (!t.closest('#tray') && !t.closest('#changebar')) return;
    var g = t.getAttribute('data-g'), k = t.getAttribute('data-k'); if (!g) return;
    if (!bubble.hidden && ui.bub !== 'where' && ui.bub !== 'many') hideBubble();
    var tg = targets(), all = !hasSel(), n = counts(); buzz();
    function each(f) { tg.forEach(function (x) { f(T[x]); }); if (all) f(DEF); }
    if (g === 'pick') { if (k === 'all') clearPicks(); else if (k !== 'mine') { ui.picks = groupTeeth(k).slice(); ui.sel = ui.picks[ui.picks.length - 1]; } ui.selOpen = false; refresh(); return; }
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
    if (ui.mode === 'after' || ui.mode === 'ai') afterInput(e);
  });
  tray.addEventListener('change', function (e) {
    var kind = e.target.getAttribute && e.target.getAttribute('data-up'); if (!kind) return;
    var f = e.target.files[0]; if (!f) return; var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = Math.min(1, 900 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); var url = c.toDataURL('image/jpeg', .8); if (kind === 'ai') { ui.ai.pic = url; ui.aiErr = ''; renderTray(); focusId('aitext'); return; } if (kind === 'photo') { SET.photo = url; if (G.photo) G.photo(im); } else SET.inspo = url; refresh(true); }; im.src = fr.result; };
    fr.readAsDataURL(f);
  });
  $('jawbtn').addEventListener('click', function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', o); $('jawlabel').textContent = o ? 'Close mouth' : 'Open mouth'; G.jaw(o); });
  $('turnbtn').addEventListener('click', function () { if (G.turn) G.turn(); });
  $('undobtn').addEventListener('click', function () { ui.lastTouch = performance.now(); buzz(); undo(); });

  // ---------- prototype switches (not part of the product) ----------
  var PAIRS = [['site', 'Opened from', [['vvs', 'VVS Lab\'s site'], ['shop', 'A jeweler\'s builder']]], ['door', 'Start page', [['v12', 'Three ways in, one-tap builds (v12)'], ['v11', 'Chips beside Start empty (v11)']]]];
  var protoTimer = 0;
  function renderProto() {
    proto.innerHTML = '<h3>Compare</h3>' + PAIRS.map(function (p) { return '<div class="pair"><p>' + p[1] + '</p><div class="seg">' + p[2].map(function (o) { return '<button type="button" data-p="' + p[0] + '" data-v="' + o[0] + '" aria-pressed="' + (ui[p[0]] === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="stat"><p>This run</p><b id="pclock">' + mmss(elapsed()) + ' · ' + ui.taps + ' taps</b></div>' +
      '<div class="pair"><p>Holder</p><input type="range" id="psolid" min="30" max="100" step="5" value="' + (ui.solid || 70) + '" aria-label="How solid the clear holder is"></div>' +
      '<button type="button" class="sm" data-p="restart">Start again from the opening</button>' + (ui.verified ? '<button type="button" class="sm" data-p="forget">Forget my phone (see the code step again)</button>' : '') + (ui.verified && aiUsed() ? '<button type="button" class="sm" data-p="aireset">Give this phone its ' + AI_FREE + ' free AI builds back</button>' : '') +
      '<p>Chosen so far: bare teeth with a row of builds; the build strip with Next and Back, gold rings on parts not opened yet; a guide when you seem stuck, with Undo. After Done: one screen to send it, the code, then Sent. AI (Nov 17): Describe it on the start page and as a tool on the stage; a conversation; the phone sign-up first, said plainly; ' + AI_FREE + ' free builds per phone, every reply counts; the closest match, saying what\'s different. A word matcher stands in for the AI here.</p>';
  }
  function goDoor() { hideBubble(); ui.selOpen = false; ui.resume = onList().length > 0; setMode('door'); renderOpenings(); G.sync(); G.goal(); meta(); }   // the furthest Back: the start screen, with the build kept
  function setVariant(k, v) { ui[k] = v; app.setAttribute('data-' + k, v); }
  function brand() { var m = document.querySelector('.bar .mark'); if (!m) return; m.querySelector('i').textContent = ui.site === 'shop' ? initials(shopName()) : 'VV'; m.querySelector('span').textContent = shopName(); }
  function restart() { ui.resume = false; ui.navHist = []; hidePhoto(); ui.ai = { msgs: [], text: '', pic: null }; ui.aiStep = 'talk'; ui.after = 0; ui.sent = false; ui.c = { name: '', phone: '', ig: '', email: '', note: '' }; SET.promo = ''; hideBubble(); resetAll(); ui.build = null; ui.t0 = 0; ui.tDone = 0; ui.taps = 0; ui.visited = {}; ui.cat = null; ui.extra = null; ui.quietUntil = 0; setMode('door'); renderOpenings(); G.sync(); G.goal(); meta(); }
  $('protobtn').addEventListener('click', function () { var open = proto.hidden; proto.hidden = !open; this.setAttribute('aria-expanded', open); clearInterval(protoTimer); if (open) { renderProto(); protoTimer = setInterval(function () { var c = $('pclock'); if (c) c.textContent = mmss(elapsed()) + ' · ' + ui.taps + ' taps'; }, 500); } });
  proto.addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return; var p = b.getAttribute('data-p'), v = b.getAttribute('data-v');
    if (p === 'restart') { restart(); renderProto(); return; }
    if (p === 'forget') { ui.verified = null; saveVerified(null); if (ui.mode === 'after' || ui.mode === 'ai') renderTray(); renderProto(); return; }
    if (p === 'aireset') { try { localStorage.removeItem(aiKey()); } catch (e) {} ui.aiMem = 0; if (ui.mode === 'ai') renderTray(); renderProto(); return; }
    setVariant(p, v);
    if (p === 'site') { brand(); if (ui.mode === 'after' || ui.mode === 'ai') renderTray(); }
    if (p === 'door') { renderOpenings(); box(); }
    renderProto();
  });
  proto.addEventListener('input', function (e) { if (e.target.id === 'psolid') { ui.solid = +e.target.value; G.solid(ui.solid); } });

  // ---------- the front door (Nov 17): v6's layout, written for both shoppers and jewelers ----------
  // Home is the hero over the piece and the page below it. "Design your grillz" opens the start page;
  // "Start free as a jeweler" puts the shop's name on the builder before asking for an email.
  ui.home = true; ui.trial = null; ui.shopLabel = ''; ui.kbOpen = false; ui.qtab = 'get'; app.setAttribute('data-home', '');
  function initials(s) { var w = String(s).trim().split(/\s+/).filter(Boolean); return ((w[0] || 'V')[0] + (w[1] ? w[1][0] : (w[0] || 'VV')[1] || '')).toUpperCase(); }
  function laneEvent(name) { (ui.laneLog = ui.laneLog || []).push([name, Math.round(performance.now())]); }   // in the real site: one analytics event per choice, the lane test's first signal
  function sellPanel() {
    return '<div class="head"><h2>What\'s your shop called?</h2></div>' +
      '<div class="field"><label class="sr" for="tname">Shop name</label><input id="tname" type="text" autocomplete="organization" autocapitalize="words" placeholder="Your shop\'s name" maxlength="32" value="' + esc(ui.shopLabel) + '"></div>' +
      '<p class="note">Your builder appears with your name on it. Try it, then keep it.</p>' +
      '<div class="go2"><button type="button" class="cta ghost second" data-t="back">Back</button><button type="button" class="cta" data-t="see">Show me my builder</button></div>';
  }
  function doorExtras() {                // the hero, the trial bar and the page below, around the start panel
    app.toggleAttribute('data-home', !!ui.home && ui.mode === 'door'); app.toggleAttribute('data-trial', !!ui.trial);
    showcase(!!ui.home && ui.mode === 'door'); renderKeep(); renderMore();
  }
  // on the front door the piece shows finished work, the popular builds in turn; the visitor's own build comes back after
  var SHOW = ['oneof', 'iced8', 'fangs', 'tone', 'open', 'gold66'];
  function showcase(on) {
    if (on && !ui.showSnap) { ui.showSnap = designSnap(); ui.showI = 0; showNext(); clearInterval(ui.showT); ui.showT = setInterval(showNext, 3800); }
    else if (!on && ui.showSnap) { clearInterval(ui.showT); var o = JSON.parse(ui.showSnap); ui.showSnap = null; T = o.T; DEF = o.D; SET.fangs = o.S.fangs; SET.cut = o.S.cut; SET.ins = o.S.ins; SET.mold = o.S.mold; SET.idea = o.S.idea; if (window.__vvs) window.__vvs.T = T; G.sync(); meta(); }
  }
  function showNext() {
    if (ui.mode !== 'door' || !ui.showSnap) return; var b = buildById(SHOW[ui.showI++ % SHOW.length]);
    resetAll(); b[3](); G.sync(); if (G.pop) G.pop(); if (G.glint) G.glint();
    var n = $('nowshow'); if (n) n.textContent = b[1] + (b[0] === 'oneof' ? ' · quoted by the shop' : ' · ' + priceOf(b[0]).toLowerCase());
  }
  function renderKeep() {
    var k = $('keepbar'), name = esc(shopName()), show = ui.trial === 'keep' || ui.trial === 'done'; k.hidden = !show; if (!show) return;
    if (ui.trial === 'done') { k.innerHTML = '<div class="kb-row"><p><b>' + name + ' is live.</b> We sent a link to ' + esc(ui.trialEmail) + ' to confirm it.</p><button type="button" class="x" data-t="close" aria-label="Close">×</button></div><p class="fine">Prototype: nothing is sent. Next would be your prices and your link.</p>'; return; }
    k.innerHTML = '<div class="kb-row"><p><b>This is your builder.</b> <span class="kb-sub">Try it as your customer would, then keep it.</span></p>' +
      '<button type="button" class="cta kb-open" data-t="kbopen" aria-expanded="' + !!ui.kbOpen + '">Keep it</button><button type="button" class="x" data-t="cancel" aria-label="Not now, go back to VVS Lab">×</button></div>' +
      '<div class="kb-form"><div class="field"><label class="sr" for="temail">Email</label><input id="temail" type="email" inputmode="email" autocomplete="email" placeholder="Email" value="' + esc(ui.trialEmail || '') + '"></div><button type="button" class="cta" data-t="keep">Start 14 days free</button></div>' +
      '<p class="fine kb-fine">No card. Then $199 a month.</p><p class="err" id="terr" role="alert"></p>';
    k.classList.toggle('open', !!ui.kbOpen);
  }
  function faqHtml(list) { return '<div class="faq">' + list.map(function (q) { return '<details><summary>' + q[0] + '</summary><p>' + q[1] + '</p></details>'; }).join('') + '</div>'; }
  var Q_GET = [
    ['What metals can I choose?', 'Yellow, white or rose gold in 10K, 14K or 18K, sterling silver, or platinum. You pick in the builder and watch the price change.'],
    ['How do you get the shape of my teeth?', 'We post you a mold kit: you bite, then mail it back. Or send your own mold or a scan.'],
    ['Is the price I see final?', 'It\'s an estimate from the real prices. The shop confirms the exact price after your fitting.'],
    ['What does sending my design cost?', 'Nothing. You send it free and the shop texts you.'],
    ['What\'s the deposit?', 'An optional payment that starts your order. You see the amount before you pay, and it counts toward your grill.'],
    ['Do I need an account?', 'No. Designing is free. We only ask for your phone when you send a design or use AI, and we text you a code.']];
  var Q_SELL = [
    ['Do I need a website?', 'No. The builder is its own link, so it works from your Instagram bio, a story or a DM. If you have a site, it can sit there too.'],
    ['Whose prices does it show?', 'Yours. You set your metal, stone and per-tooth prices, so the total a customer sees matches what you would quote.'],
    ['Where does the deposit go?', 'Through your own Stripe account, straight to you. VVS Lab never holds your money.'],
    ['Is the studio photo the finished piece?', 'It is a photo-real picture of the design they built, so they can see it before paying. The 3D build and the spec you receive are what you work from at the bench.'],
    ['Can customers ask for a one-of-one?', 'Yes. They can place charms on any tooth or send their own idea with a photo. Those arrive as a custom request for you to quote.'],
    ['Is there a contract?', 'No. 14 days free with no card, then $199 a month. Cancel any month.']];
  function priceHtml() {
    return '<section class="band"><div class="in"><h2>The price</h2><div class="pcards">' +
      '<div class="pcard"><p class="eyebrow">Designing</p><p class="pbig">Free</p><p>You see your price as you build. Sending is free. A deposit starts your order and counts toward your grill.</p><button type="button" class="btn2 ink" data-h="design">Design your grillz</button></div>' +
      '<div class="pcard"><p class="eyebrow">Shops</p><p class="pbig">$199<span> a month</span></p><p>14 days free, no card. Your builder link, your prices, and requests and deposits sent straight to you.</p><div class="btns2"><button type="button" class="btn2 ink" data-t="start">Start free</button><a class="btn2" href="https://ig.me/m/vvslab.ai" target="_blank" rel="noreferrer">DM “BUILD” for a demo</a></div></div>' +
      '</div></div></section>';
  }
  function renderMore() {
    var m = $('more'); if (!ui.home) { m.innerHTML = ''; return; }
    var lead = ui.leadImg || '';
    m.innerHTML = '' +
      '<section class="band"><div class="in split"><div><h2>What happens when you hit send</h2><p class="lede">Your design reaches the jeweler exactly as you built it. Shops: this is every request.</p><ul class="gets">' +
      [['Who it\'s from', 'Name and phone, checked with a text code.'], ['The exact spec', 'Every tooth, metal and stone, with the price shown.'], ['The studio photo', 'The picture that sold it.'], ['The fit', 'A mailed mold kit, their own mold or scan, or in store.'], ['The deposit', 'Paid to the shop, straight to them.']].map(function (g) { return '<li><b>' + g[0] + '</b><span>' + g[1] + '</span></li>'; }).join('') +
      '</ul></div><div class="phone" aria-label="Example of a new request on a jeweler\'s phone"><div class="scr"><div class="clock">9:41<small>Monday, November 17</small></div><div class="leadcard"><div class="top"><i>VV</i><span>VVS Lab · now</span></div><div class="mid">' + (lead ? '<img alt="The customer\'s design" src="' + lead + '">' : '<span class="lph">' + setSvg(6, 6, 'iced') + '</span>') + '<div><b>New request from Dre</b><p>6 × 6 · 14K yellow gold · iced canines</p></div></div><div class="tags"><span>$3,840 quoted</span><span class="paid">$960 deposit paid</span><span>Mold kit by mail</span></div></div><p class="exl">Example request</p></div></div></div></section>' +
      priceHtml() +
      '<section class="band"><div class="in"><h2>Questions</h2><div class="qtabs" role="tablist" aria-label="Questions for"><button type="button" role="tab" data-q2="get" aria-selected="' + (ui.qtab === 'get') + '">Getting grillz</button><button type="button" role="tab" data-q2="sell" aria-selected="' + (ui.qtab === 'sell') + '">Selling grillz</button></div>' +
      '<div class="qcols" data-tab="' + ui.qtab + '"><div class="qcol get"><h3>Getting grillz</h3>' + faqHtml(Q_GET) + '</div><div class="qcol sell"><h3>Selling grillz</h3>' + faqHtml(Q_SELL) + '</div></div>' +
      '<p class="proto-note">For you, before this goes live: how long it takes, returns and any warranty need your answers.</p></div></section>' +
      '<section class="band final"><div class="in"><h2>Put it in your bio tonight.</h2><p>14 days free, no card needed. Or DM “BUILD” and we\'ll walk you through it.</p><div class="btns2"><button type="button" class="btn2 inv" data-t="start">Start free trial</button><a class="btn2 line" href="https://ig.me/m/vvslab.ai" target="_blank" rel="noreferrer">DM “BUILD” for a demo</a></div></div></section>' +
      '<footer class="foot"><div class="in"><span>VVS Lab</span><a href="https://www.instagram.com/vvslab.ai/" target="_blank" rel="noreferrer">@vvslab.ai</a><span class="fnote">Prices in the builder are the demo shop\'s example prices.</span></div></footer>';
  }
  function goHome() { ui.home = true; ui.selOpen = false; hideBubble(); if (ui.mode !== 'door') { ui.resume = onList().length > 0; setMode('door'); } renderOpenings(); G.sync(); G.goal(); box(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  function openStart() { laneEvent('design_clicked'); ui.home = false; renderOpenings(); box(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  function startTrial() { laneEvent('trial_started'); ui.home = false; ui.trial = 'name'; if (ui.mode !== 'door') goDoor(); renderOpenings(); box(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); setTimeout(function () { var f = $('tname'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }, 350); }
  function seeBuilder() {
    var f = $('tname'), n = (f ? f.value : ui.shopLabel).trim().replace(/\s+/g, ' ');
    if (n.length < 2) { toast('Add your shop\'s name.'); if (f) f.focus(); return; }
    ui.shopLabel = n; setVariant('site', 'shop'); brand(); ui.trial = 'keep'; ui.kbOpen = window.innerWidth >= 900; laneEvent('trial_named');
    renderOpenings(); box(); if (ui.mode === 'after') renderTray();
  }
  function leaveTrial() { ui.trial = null; ui.shopLabel = ''; setVariant('site', 'vvs'); brand(); renderOpenings(); box(); }
  setTimeout(function grabLead() { if (!G.ready || !G.shot) { setTimeout(grabLead, 500); return; } if (!ui.home) return; ui.leadImg = G.shot(240, 240); renderMore(); }, 1600);   // the example request carries a real render of the piece
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-t], [data-h], [data-q2], .bar .mark'); if (!t) return;
    if (t.classList.contains('mark')) { if (ui.mode === 'door' && ui.home) return; goHome(); return; }
    var q2 = t.getAttribute('data-q2'); if (q2) { ui.qtab = q2; renderMore(); return; }
    var h = t.getAttribute('data-h'); if (h === 'design') { openStart(); return; } if (h === 'signin') { toast('Sign in is for shops. Not part of the prototype.'); return; }
    var a = t.getAttribute('data-t'); if (!a) return; e.preventDefault();
    if (a === 'start') startTrial();
    else if (a === 'back') { ui.trial = null; ui.home = true; renderOpenings(); box(); }
    else if (a === 'see') seeBuilder();
    else if (a === 'kbopen') { ui.kbOpen = !ui.kbOpen; renderKeep(); box(); if (ui.kbOpen) { var em = $('temail'); if (em) em.focus(); } }
    else if (a === 'keep') { var v = ($('temail') || {}).value || ''; ui.trialEmail = v.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ui.trialEmail)) { var er = $('terr'); if (er) er.textContent = 'Add the email you\'d like to sign in with.'; return; } ui.trial = 'done'; laneEvent('trial_kept'); renderKeep(); box(); }
    else if (a === 'cancel' || a === 'close') leaveTrial();
  });
  document.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; if (e.target.id === 'tname') { e.preventDefault(); seeBuilder(); } else if (e.target.id === 'temail') { e.preventDefault(); var b = document.querySelector('[data-t="keep"]'); if (b) b.click(); } });
  document.addEventListener('input', function (e) { if (e.target.id === 'tname') ui.shopLabel = e.target.value; if (e.target.id === 'temail') { ui.trialEmail = e.target.value; var er = $('terr'); if (er) er.textContent = ''; } });

  // ---------- start ----------
  setVariant('site', 'vvs'); setVariant('door', 'v12'); brand();
  resetAll(); setMode('door'); renderOpenings(); meta();
  if (G.boot) { G.boot(); setTimeout(function () { renderOpenings(); box(); }, 400); }
  window.__vvs = { T: T, ui: ui, SET: SET, G: G };
})();
