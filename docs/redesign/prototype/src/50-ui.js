
  // =====================================================================
  // The bench: the builder's controls, the review and the send flow.
  // =====================================================================
  var dbody = $('dbody'), sheet = $('sheet'), toastEl = null, resume = null, shop = { name: 'Your Shop', mono: 'YS', slug: 'yourshop', mine: false };
  function mono(n) { var w = n.trim().split(/\s+/).filter(Boolean); return ((w[0] || 'Y').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || 'YS').charAt(1) || '')).toUpperCase(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'pill'; toastEl.style.cssText = 'position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:9;transition:opacity .3s ease;max-width:calc(100% - 32px);white-space:normal;text-align:center;line-height:1.3'; stage.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.style.opacity = '1'; clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.style.opacity = '0'; }, 3200);
  }
  // pictures for the tiles: the real tooth, photographed live; a plain swatch until the 3D is up
  var SW = { yellow: '#e0a93f', white: '#dcd9d2', rose: '#dd9274', silver: '#cfd4da', platinum: '#b8c0c8' };
  function pic(key, t, opt, fallback) { var u = G.ready ? G.thumb(key, t, opt) : ''; return u ? '<img alt="" src="' + u + '">' : '<i style="width:44px;height:44px;border-radius:50%;background:' + (fallback || '#e0a93f') + ';box-shadow:inset 0 -8px 12px rgba(0,0,0,.18),inset 0 5px 8px rgba(255,255,255,.55)"></i>'; }
  function tile(g, k, title, sub, pressed, picture, wide) { return '<button type="button" class="tile' + (wide ? ' wide' : '') + '" data-g="' + g + '" data-k="' + k + '" aria-pressed="' + !!pressed + '"><span class="pic">' + picture + '</span><b>' + title + '</b><span>' + (sub || '&nbsp;') + '</span></button>'; }
  function chip(g, k, label, pressed, extra) { return '<button type="button" class="chip" data-g="' + g + '" data-k="' + k + '" aria-pressed="' + !!pressed + '">' + label + (extra ? ' <em>' + extra + '</em>' : '') + '</button>'; }
  // a small drawing of a set, for the starting looks
  function lookSvg(id) {
    var gold = '#d9ad45', white = '#cfd3d6', s = '<svg viewBox="0 0 120 84" aria-hidden="true">', rows = id === 'iced' ? [8, 8] : id === 'fangs' ? [6, 0] : [6, 6];
    rows.forEach(function (n, r) {
      for (var k = 0; k < n; k++) {
        var w = 96 / Math.max(n, 6), x = 60 - n * w / 2 + k * w + 1, y = r ? 45 : 14, h = 25, fang = id === 'fangs' && (k === 0 || k === n - 1), iced = id === 'iced' || id === 'fangs' || (id === 'oneof' && r === 0 && (k < 2 || k > 3)), fill = id === 'tone' && r === 0 && (k === 2 || k === 3) ? white : gold;
        if (id === 'open') s += '<rect x="' + (x + 1.2) + '" y="' + (y + 1.2) + '" width="' + (w - 4.4) + '" height="' + (h - 2.4) + '" rx="4" fill="none" stroke="' + gold + '" stroke-width="2.6"/>';
        else if (fang) s += '<path d="M' + x + ' ' + (y + 4) + 'q0 -4 4 -4h' + (w - 10) + 'q4 0 4 4v10l-' + ((w - 2) / 2) + ' 20l-' + ((w - 2) / 2) + ' -20z" fill="' + (iced ? '#f4f7f9' : fill) + '" stroke="' + gold + '" stroke-width="1.6"/>';
        else s += '<rect x="' + x + '" y="' + y + '" width="' + (w - 2) + '" height="' + h + '" rx="4.5" fill="' + (iced ? '#f4f7f9' : fill) + '"' + (iced ? ' stroke="' + gold + '" stroke-width="1.6"' : '') + '/>';
        if (iced && !fang) for (var d = 0; d < 6; d++) s += '<circle cx="' + (x + (w - 2) * (.3 + .4 * (d % 2))) + '" cy="' + (y + 5 + d / 2 * 6 - (d % 2) * 0) + '" r="1.5" fill="#9fb4bf"/>';
        if (id === 'oneof' && !(r === 0 && (k < 2 || k > 3))) s += '<circle cx="' + (x + (w - 2) / 2) + '" cy="' + (y + h / 2) + '" r="3.4" fill="' + ['#55101a', '#0c3d27', '#1d49c8', '#3a2212'][(k + r) % 4] + '"/>';
      }
    });
    return s + '</svg>';
  }
  function selNote() { return hasSel() ? '<b>Changing ' + toothName(ui.sel).toLowerCase() + '.</b> Tap empty space for all teeth.' : 'Tap a tooth on the piece to change just that one.'; }
  function head(title, right) { return '<div class="q"><h2>' + title + '</h2><span>' + (right || '') + '</span></div>'; }
  function grp(label, inner) { return '<div class="grp">' + (label ? '<p class="lab">' + label + '</p>' : '') + inner + '</div>'; }
  function upload(kind, label, img) { return '<label class="up">' + (img ? '<img alt="" src="' + img + '">' : '') + '<span>' + label + '</span><input type="file" accept="image/*" data-up="' + kind + '"></label>'; }

  function renderDock() {
    var s = ui.step, c = cur(), h = '', n = counts(), keep = {};
    Array.prototype.forEach.call(dbody.querySelectorAll('.row'), function (r) { keep[r.getAttribute('data-row')] = r.scrollLeft; });
    if (s === 0) {
      h = head('Which teeth?', 'Tap them on the piece, or start from a set.') +
        grp('Start from a look', '<div class="row" data-row="looks">' + Object.keys(LOOKS).map(function (k) { return tile('look', k, LOOKS[k][0], k === 'oneof' ? 'Premium' : '', ui.look === k, lookSvg(k), true); }).join('') + '</div>') +
        grp('Sets', '<div class="chips">' + SETS.map(function (x, q) { return chip('set', q, x[0], x[1] === n[0] && x[2] === n[1] && isCentered()); }).join('') + chip('set', 'clear', 'Clear', false) + chip('set', 'over', 'Start over', false) + '</div>') +
        '<div class="step2"><span class="cnt"><span class="lab">Top</span><button type="button" data-g="cnt" data-k="t-" aria-label="One fewer top tooth">−</button><b>' + n[0] + '</b><button type="button" data-g="cnt" data-k="t+" aria-label="One more top tooth">+</button></span>' +
        '<span class="cnt"><span class="lab">Bottom</span><button type="button" data-g="cnt" data-k="b-" aria-label="One fewer bottom tooth">−</button><b>' + n[1] + '</b><button type="button" data-g="cnt" data-k="b+" aria-label="One more bottom tooth">+</button></span>' +
        chip('fangs', 'on', 'Fangs', SET.fangs, SET.fangs ? '' : '+$' + PRICE.fangs) + '</div>';
    } else if (s === 1) {
      h = head('Choose the metal.', selNote()) +
        '<div class="row" data-row="metal">' + Object.keys(METALS).map(function (k) { return tile('metal', k, METALS[k].name, c.metal === k ? 'Selected' : delta(function (x) { x.metal = k; }), c.metal === k, pic('m' + k, { metal: k, karat: '14k' }, null, SW[k])); }).join('') + '</div>' +
        (isGold(c.metal) ? grp('Karat', '<div class="chips">' + Object.keys(KARATS).map(function (k) { return chip('karat', k, KARATS[k][0] + ' · ' + KARATS[k][1], c.karat === k, c.karat === k ? '' : delta(function (x) { x.karat = k; })); }).join('') + '</div>') : '<p class="note">' + METALS[c.metal].name + ' has one grade, so there is no karat to choose.</p>');
    } else if (s === 2) {
      h = head('Choose the finish.', selNote()) + '<div><div class="seg" role="group" aria-label="Type">' + Object.keys(TYPES).map(function (k) { return '<button type="button" data-g="type" data-k="' + k + '" aria-pressed="' + (c.type === k) + '">' + TYPES[k] + '</button>'; }).join('') + '</div></div>';
      if (c.type === 'plain') {
        h += '<div class="row" data-row="style">' + Object.keys(STYLES).map(function (k) { return tile('style', k, STYLES[k][0], c.style === k ? STYLES[k][1] : delta(function (x) { x.style = k; }) || STYLES[k][1], c.style === k, pic('s' + k + c.metal, { metal: c.metal, karat: c.karat, style: k, opal: c.opal })); }).join('') + '</div>';
        if (c.style === 'opal') h += grp('Opal colour', '<div class="chips">' + Object.keys(OPALS).map(function (k) { return chip('opal', k, '<i style="width:12px;height:12px;border-radius:50%;background:' + OPALS[k][1] + ';display:inline-block"></i>' + OPALS[k][0], c.opal === k); }).join('') + '</div>');
      } else if (c.type === 'iced') {
        h += grp('Setting', '<div class="row" data-row="setting">' + Object.keys(SETTINGS).map(function (k) { return tile('setting', k, SETTINGS[k][0], c.setting === k ? SETTINGS[k][1] : delta(function (x) { x.setting = k; }) || SETTINGS[k][1], c.setting === k, pic('i' + k + c.metal, { metal: c.metal, karat: c.karat, type: 'iced', setting: k })); }).join('') +
          tile('openface', 'on', 'Open face', c.style === 'open' ? 'On' : '+$' + PRICE.style.open + ' a tooth', c.style === 'open', pic('io' + c.metal, { metal: c.metal, karat: c.karat, type: 'iced', style: 'open' })) + '</div>') +
          grp('Stones', '<div class="chips">' + Object.keys(STONES).map(function (k) { return chip('stone', k, STONES[k][0], c.stone === k, c.stone === k ? STONES[k][1] : delta(function (x) { x.stone = k; })); }).join('') + '</div>');
      } else {
        h += '<div class="two"><div class="grp"><p class="lab">Your image</p>' + upload('photo', SET.photo ? 'Change the photo' : 'Add your photo', SET.photo) + '<p class="note">The image runs across every tooth set to Photo, left to right. Until you add one, a sample stands in.</p></div><div class="grp"><p class="lab">Price</p><p class="note">Photo artwork is $' + PRICE.photo + ' per order, on top of the metal.</p></div></div>';
      }
    } else if (s === 3) {
      var where = SET.ins.tooth !== null && T[SET.ins.tooth].on ? toothName(SET.ins.tooth).toLowerCase() : 'the tooth you tap';
      h = head('Make it yours.', 'All optional. Skip any of it.') +
        '<div class="two">' +
        grp('Fit style', '<div class="chips">' + Object.keys(CUTS).map(function (k) { return chip('cut', k, CUTS[k][0], SET.cut === k, k === 'permanent' && SET.cut !== k ? '+$' + PRICE.permanent : ''); }).join('') + '</div><p class="note">' + CUTS[SET.cut][1] + '.</p>') +
        grp('Initials or a word', '<div class="field"><input type="text" id="instext" maxlength="6" placeholder="Up to 6 letters" value="' + esc(SET.ins.text) + '" autocomplete="off"></div><div class="chips">' + Object.keys(INS).map(function (k) { return chip('ins', k, INS[k][0], SET.ins.style === k, '$' + PRICE.ins[k]); }).join('') + '</div><p class="note" id="insnote">Goes on ' + where + '.</p>') +
        '</div>' +
        grp('One-of-one charms · premium, quoted by the shop', '<div class="row" data-row="charm">' + tile('charm', 'none', 'None', '', !(hasSel() && T[ui.sel].charm), '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" fill="none" stroke="#8d8b84" stroke-width="2"/><path d="M12.5 27.5 27.5 12.5" stroke="#8d8b84" stroke-width="2"/></svg>') +
          Object.keys(CHARMS).map(function (k) { return tile('charm', k, CHARMS[k], 'Quote', hasSel() && T[ui.sel].charm === k, pic('c' + k, { metal: 'yellow', karat: '18k', charm: k })); }).join('') + '</div><p class="note">' + (hasSel() ? 'Goes on the ' + toothName(ui.sel).toLowerCase() + '.' : 'Tap a tooth, then a charm.') + '</p>') +
        '<div class="two">' + grp('Your own idea', '<div class="field"><textarea id="idea" placeholder="Describe a piece you have in mind. The shop quotes it.">' + esc(SET.idea) + '</textarea></div>') + grp('Inspiration photo', upload('inspo', SET.inspo ? 'Change the photo' : 'Add a photo', SET.inspo) + '<p class="note">Sent to the shop with your request.</p>') + '</div>';
    } else {
      var b = breakdown();
      h = head('Ready for the photo?', receipt()) + '<p class="note">Next you see your piece as a photo with the full price, choose how you get fitted, and send it to the shop. Estimated total ' + money(b.total) + (b.quote ? ', plus a quote for the one-of-one work' : '') + '.</p>';
    }
    dbody.innerHTML = h;
    Array.prototype.forEach.call(dbody.querySelectorAll('.row'), function (r) { var k = r.getAttribute('data-row'); if (keep[k]) r.scrollLeft = keep[k]; });
    Array.prototype.forEach.call($('rail').children, function (bt, k) { bt.classList.toggle('done', k < s); if (k === s) bt.setAttribute('aria-current', 'step'); else bt.removeAttribute('aria-current'); });
    $('nextlabel').textContent = s < 3 ? STEPS[s + 1] : s === 3 ? 'Review & send' : 'Take the photo';
    $('back').style.visibility = s === 0 ? 'hidden' : 'visible';
    meta();
  }
  var shown = 0, anim = 0;
  function meta() {
    $('rcpt').textContent = receipt();
    var b = breakdown(), to = b.total, from = shown, t0 = performance.now(); cancelAnimationFrame(anim);
    (function step(t) { var k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3); shown = Math.round(from + (to - from) * e); $('price').textContent = money(shown) + (b.quote && metalOn() ? ' + quote' : ''); if (k < 1 && !reduce) anim = requestAnimationFrame(step); else { shown = to; $('price').textContent = money(to) + (b.quote && metalOn() ? ' + quote' : ''); } })(t0);
  }
  function box() {                     // the free area above the controls, which the camera frames the piece in
    var st = stage.getBoundingClientRect(), el = ui.mode === 'door' ? $('door') : ui.mode === 'build' ? $('dock') : null, top = 62;
    G.box = { top: top, bottom: Math.max(top + 160, el ? el.getBoundingClientRect().top - st.top - 10 : st.height * .62) };
  }
  window.addEventListener('resize', box);
  function refresh(glint) { renderDock(); box(); G.sync(); G.goal(); if (glint) G.glint(); if (ui.mode === 'build') save(); }
  function setMode(m) {
    ui.mode = m; app.setAttribute('data-mode', m);
    $('mark').innerHTML = m === 'door' ? '<i>VV</i><span>VVS Lab</span>' : '<i>' + esc(shop.mono) + '</i><span>' + esc(shop.name) + '</span><small>built with VVS Lab</small>';
    if (m !== 'build') ui.sel = null;
    box(); setTimeout(box, 480);
  }
  function setStep(s) {
    s = Math.max(0, Math.min(4, s)); if (s === 4) { if (!onList().length) { toast('Pick at least one tooth first.'); return; } ui.step = 4; openReview(); return; }
    ui.step = s; if (s === 0) ui.sel = null; refresh();
  }
  function enterBuilder() {
    if (resume) { try { var r = JSON.parse(resume); T = r.T; DEF = r.DEF; SET.fangs = r.SET.fangs; SET.cut = r.SET.cut; SET.ins = r.SET.ins; SET.mold = r.SET.mold; SET.idea = r.SET.idea; ui.look = null; } catch (e) { applyLook('gold'); } } else applyLook('gold');
    ui.step = 0; ui.sent = false; ui.deposit = false; setMode('build'); refresh(); G.pop(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }
  function exitBuilder() { resume = JSON.stringify({ T: T, DEF: DEF, SET: { fangs: SET.fangs, cut: SET.cut, ins: SET.ins, mold: SET.mold, idea: SET.idea } }); sheet.hidden = true; $('sheetx').hidden = true; setMode('door'); showLook(ui.show); }

  // what a tap on the piece does
  G.tap = function (k) {
    if (ui.mode === 'door') { if (k !== null) enterBuilder(); return; }
    if (ui.mode !== 'build') return;
    if (ui.step === 0) { if (k === null) return; T[k].on = !T[k].on; if (T[k].on) KEYS.forEach(function (key) { T[k][key] = DEF[key]; }); else T[k].charm = null; ui.look = null; G.pop(k); buzz(); }
    else { if (k !== null && T[k].on) { ui.sel = ui.sel === k ? null : k; teeth_pop(k); buzz(); if (ui.step === 3 && ui.sel !== null) SET.ins.tooth = ui.sel; } else if (k !== null) { toast('That tooth is not in your set. Add it on the Teeth step.'); return; } else ui.sel = null; }
    refresh();
  };
  function teeth_pop(k) { G.pop(k); }

  dbody.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    var g = b.getAttribute('data-g'), k = b.getAttribute('data-k'), tg = targets(), all = !hasSel(), n = counts(); buzz();
    function each(f) { tg.forEach(function (x) { f(T[x]); }); if (all) f(DEF); }
    if (g === 'look') { applyLook(k); G.pop(); }
    if (g === 'set') { ui.look = null; if (k === 'clear') setRange(0, 0); else if (k === 'over') { applyLook('gold'); G.pop(); toast('Back to the plain set.'); } else { setRange(SETS[k][1], SETS[k][2]); G.pop(); } }
    if (g === 'cnt') { ui.look = null; var top = n[0] + (k === 't+' ? 1 : k === 't-' ? -1 : 0), bot = n[1] + (k === 'b+' ? 1 : k === 'b-' ? -1 : 0); setRange(Math.max(0, Math.min(16, top)), Math.max(0, Math.min(16, bot))); }
    if (g === 'fangs') { SET.fangs = !SET.fangs; if (SET.fangs && !T[5].on && !T[10].on) toast('Fangs sit on the upper canines. Add 6 top or more to see them.'); }
    if (g === 'metal') each(function (t) { t.metal = k; });
    if (g === 'karat') each(function (t) { t.karat = k; });
    if (g === 'type') each(function (t) { t.type = k; if (k === 'photo') t.style = 'solid'; });
    if (g === 'style') each(function (t) { t.style = k; });
    if (g === 'opal') each(function (t) { t.opal = k; });
    if (g === 'setting') each(function (t) { t.setting = k; });
    if (g === 'openface') each(function (t) { t.style = t.style === 'open' ? 'solid' : 'open'; });
    if (g === 'stone') each(function (t) { t.stone = k; });
    if (g === 'cut') SET.cut = k;
    if (g === 'ins') { SET.ins.style = k; if (SET.ins.tooth === null) SET.ins.tooth = firstFront(); }
    if (g === 'charm') {
      if (!hasSel() && k !== 'none') { var p = [7, 8, 6, 9, 5, 10, 23, 24, 22, 25].filter(function (x) { return T[x].on && !T[x].charm; })[0]; if (p === undefined) p = onList()[0]; if (p !== undefined) ui.sel = p; }
      if (k === 'none') targets().forEach(function (x) { T[x].charm = null; }); else if (hasSel()) T[ui.sel].charm = k;
    }
    refresh(g !== 'cnt' && g !== 'set');
  });
  function firstFront() { var p = [7, 8, 6, 9, 23, 24].filter(function (x) { return T[x].on; })[0]; return p === undefined ? (onList()[0] === undefined ? null : onList()[0]) : p; }
  dbody.addEventListener('input', function (e) {
    if (e.target.id === 'instext') { SET.ins.text = e.target.value.toUpperCase().replace(/[^A-Z0-9&.\- ]/g, '').slice(0, 6); if (SET.ins.tooth === null || !T[SET.ins.tooth].on) SET.ins.tooth = hasSel() ? ui.sel : firstFront(); G.sync(); meta(); save(); var nn = $('insnote'); if (nn && SET.ins.tooth !== null) nn.textContent = 'Goes on the ' + toothName(SET.ins.tooth).toLowerCase() + '.'; }
    if (e.target.id === 'idea') { SET.idea = e.target.value.slice(0, 400); save(); }
  });
  function readImage(file, done) { if (!file) return; var fr = new FileReader(); fr.onload = function () { var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), s = Math.min(1, 900 / Math.max(im.width, im.height)); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); done(im, c.toDataURL('image/jpeg', .8)); }; im.src = fr.result; }; fr.readAsDataURL(file); }
  dbody.addEventListener('change', function (e) {
    var kind = e.target.getAttribute && e.target.getAttribute('data-up'); if (!kind) return;
    readImage(e.target.files[0], function (im, url) { if (kind === 'photo') { SET.photo = url; if (G.photo) G.photo(im); } else SET.inspo = url; refresh(kind === 'photo'); });
  });
  $('rail').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setStep(+b.getAttribute('data-step')); });
  $('next').addEventListener('click', function () { buzz(); setStep(ui.step + 1); });
  $('back').addEventListener('click', function () { setStep(ui.step - 1); });
  $('exit').addEventListener('click', exitBuilder);
  ['tryit', 'tryit2'].forEach(function (id) { $(id).addEventListener('click', enterBuilder); });
  ['startfree', 'startfree2', 'startfree3'].forEach(function (id) { $(id).addEventListener('click', openJoin); });
  $('signin').addEventListener('click', function () { toast('Sign-in sends a code to your email. It is not part of this prototype.'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) { b.addEventListener('click', function () { if (G.view) G.view(+b.getAttribute('data-view')); }); });

  // ---------- starting a shop: three fields, and the builder already wears the shop's name ----------
  var join = { name: '', ig: '', email: '', done: false };
  function openJoin() { ui.sheet = 'join'; join.done = false; renderJoin(); sheet.hidden = false; $('sheetx').hidden = false; $('sheetx').textContent = 'Close'; sheet.scrollTop = 0; window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }
  function slugOf(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop'; }
  function renderJoin() {
    var nm = join.name || 'Your Shop';
    if (!join.done) sheet.innerHTML = '<div class="join"><p class="fine">14 days free · no card</p><h2>Put your name on it.</h2><p class="lede2">Three fields and your builder is live. You set your prices next; until then it shows starting prices.</p>' +
      '<div class="box"><h3>Shop name</h3><div class="field"><input type="text" id="jname" placeholder="King\'s Grillz" value="' + esc(join.name) + '" autocomplete="organization" maxlength="40"></div><div class="preview" id="jprev"><i>' + esc(mono(nm)) + '</i><span>' + esc(nm) + '</span><small>built with VVS Lab</small></div><p class="note">This is how your customers see it at the top of the builder.</p></div>' +
      '<div class="box"><h3>Where customers find you</h3><div class="field"><input type="text" id="jig" placeholder="Instagram handle" value="' + esc(join.ig) + '" autocomplete="off"></div><div class="field"><input type="text" id="jemail" placeholder="Email for requests" value="' + esc(join.email) + '" autocomplete="email" inputmode="email"></div><p class="err" id="jerr" hidden></p><button type="button" class="next send" data-r="create">Create my builder</button><p class="note">$199 a month after the trial. Month to month.</p></div></div>';
    else sheet.innerHTML = '<div class="join"><div class="ok"><div class="tick"><svg viewBox="0 0 16 16"><path d="M3.6 8.4l3 3 5.8-6.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2>' + esc(shop.name) + ' is live.</h2><p class="lede2">Put this link in your Instagram bio. Every design a customer sends arrives at ' + esc(join.email) + '.</p></div>' +
      '<div class="box"><h3>Your builder link</h3><p class="url">' + esc(shop.slug) + '.vvslab.com</p><p class="note">This is a prototype, so no shop was created and the link is an example.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ink" data-r="mine">Open my builder</button><button type="button" class="btn" data-r="closejoin">Back to the front door</button></div></div>';
  }
  sheet.addEventListener('input', function (e) {
    if (e.target.id === 'jname') { join.name = e.target.value; var nm = join.name.trim() || 'Your Shop', p = $('jprev'); if (p) { p.querySelector('i').textContent = mono(nm); p.querySelector('span').textContent = nm; } }
    if (e.target.id === 'jig') join.ig = e.target.value; if (e.target.id === 'jemail') join.email = e.target.value;
  });
  $('jawbtn').addEventListener('click', function () { var o = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', o); this.textContent = o ? 'Close mouth' : 'Open mouth'; G.jaw(o); });
  $('solid').addEventListener('input', function () { $('solidval').textContent = 'Holder ' + this.value + '%'; G.solid(+this.value); });

  // ---------- review, send, deposit ----------
  var shotUrl = '';
  function openReview() {
    var f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    ui.sel = null; ui.sheet = 'review'; setMode('review'); G.sync(); shotUrl = G.shot(960, 720) || ''; ui.sent = false; ui.deposit = false;
    renderSheet(); sheet.hidden = false; $('sheetx').hidden = false; sheet.scrollTop = 0;
  }
  function closeReview() { sheet.hidden = true; $('sheetx').hidden = true; ui.step = 3; setMode('build'); refresh(); }
  function priceBox(b) {
    return '<div class="box"><h3>Price</h3><div class="lines">' + b.lines.map(function (l) { return '<div' + (l[1] < 0 ? ' class="neg"' : '') + '><span>' + esc(l[0]) + '</span><span>' + money(l[1]) + '</span></div>'; }).join('') +
      (b.quote ? '<div><span>One-of-one work</span><span>Quoted by the shop</span></div>' : '') + '<div class="tot"><span>Estimated total</span><span>' + money(b.total) + '</span></div><div><span>Deposit to start</span><span>' + money(b.deposit) + '</span></div></div></div>';
  }
  function renderSheet() {
    var b = breakdown(), spec = specLines(), right;
    var print = '<div class="print"><img alt="A photo of your design" src="' + shotUrl + '"><div class="cap"><b>' + esc(lookLabel()) + ' · ' + esc(same(metalWords) || 'mixed metals') + '</b><b>' + money(b.total) + '</b></div><div class="cap"><span>Design ' + ui.code + '</span><span>' + esc(shop.name) + '</span></div></div>';
    if (!ui.sent) {
      right = '<h2>Your piece.</h2>' +
        '<div class="box"><h3>What you built</h3><ul class="speclist">' + spec.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' + (SET.inspo ? '<p class="note" style="display:flex;gap:10px;align-items:center"><img alt="" src="' + SET.inspo + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover">Your inspiration photo goes with it.</p>' : '') + '</div>' +
        priceBox(b) +
        '<div class="box"><h3>How you get fitted</h3><div class="opt3">' + Object.keys(MOLDS).map(function (k) { return '<button type="button" data-r="mold" data-k="' + k + '" aria-pressed="' + (SET.mold === k) + '"><b>' + MOLDS[k][0] + '</b><span>' + MOLDS[k][1] + '</span></button>'; }).join('') + '</div></div>' +
        '<div class="box"><h3>Promo code</h3><div class="promo"><input type="text" id="promo" placeholder="Code" value="' + esc(SET.promo) + '" autocomplete="off" style="text-transform:uppercase"><button type="button" data-r="promo">Apply</button></div><p class="note" id="promonote">' + (PRICE.promo[(SET.promo || '').toUpperCase()] ? 'Code applied.' : 'The demo shop accepts VVS10.') + '</p></div>' +
        '<div class="box"><h3>Send it to ' + esc(shop.name) + '</h3><div class="field"><input type="text" id="cname" placeholder="Your name" value="' + esc(SET.name) + '" autocomplete="name"></div><div class="field"><input type="text" id="chandle" placeholder="Instagram or phone" value="' + esc(SET.handle) + '" autocomplete="off"></div><p class="err" id="cerr" hidden></p>' +
        '<button type="button" class="next send" data-r="send">Send my design</button><p class="note">' + esc(shop.name) + ' replies on Instagram or by phone to confirm the design and the next step. Nothing is charged now.</p></div>';
    } else {
      right = '<div class="ok"><div class="tick"><svg viewBox="0 0 16 16"><path d="M3.6 8.4l3 3 5.8-6.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2>Sent to ' + esc(shop.name) + '.</h2><p>They will reach out to ' + esc(SET.handle) + ' to confirm the design. Your design code is ' + ui.code + '.</p></div>' +
        '<div class="box"><h3>Lock your spot</h3>' + (ui.deposit ? '<p><b>Deposit of ' + money(b.deposit) + ' paid.</b> This is the demo, so no card was charged.</p>' : '<p>A ' + money(b.deposit) + ' deposit starts the work. It comes off the total.</p><button type="button" class="next send" data-r="deposit">Pay ' + money(b.deposit) + ' deposit</button><p class="note">In the real builder this opens the shop\'s own Stripe checkout.</p>') + '</div>' +
        '<div class="box"><h3>Share it</h3><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><img class="share" id="sharecard" alt="A card of your design to share"><p class="note" style="flex:1;min-width:160px">A story-sized card of your piece with the shop\'s name on it. Press and hold to save it.</p></div></div>' +
        '<div class="box" style="background:transparent;box-shadow:none;padding:0"><h3 style="margin-bottom:10px">Meanwhile, on the jeweler\'s phone</h3><div class="leadcard"><div class="top"><i>VV</i><span>VVS Lab · now</span></div><div class="mid"><img alt="" src="' + shotUrl + '"><div><b>New request from ' + esc(SET.handle) + '</b><p>' + esc(SET.name) + ' · ' + esc(receipt()) + '</p></div></div><div class="tags"><span>' + money(b.total) + (b.quote ? ' + quote' : '') + '</span>' + (ui.deposit ? '<span class="paid">' + money(b.deposit) + ' deposit paid</span>' : '<span>Deposit pending</span>') + '<span>' + MOLDS[SET.mold][0] + '</span></div></div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ink" data-r="again">Build another</button><button type="button" class="btn" data-r="door">Back to the front door</button></div>';
    }
    sheet.innerHTML = '<div class="sheet-in">' + print + '<div class="rev">' + right + '</div></div>';
    if (ui.sent) shareCard();
  }
  function shareCard() {
    var c = document.createElement('canvas'); c.width = 540; c.height = 960; var x = c.getContext('2d'), im = new Image(), b = breakdown();
    im.onload = function () {
      var g = x.createRadialGradient(270, 330, 40, 270, 330, 760); g.addColorStop(0, '#f6f5f2'); g.addColorStop(.6, '#e3e2dd'); g.addColorStop(1, '#cfcec8'); x.fillStyle = g; x.fillRect(0, 0, 540, 960);
      x.drawImage(im, im.width * .125, 0, im.width * .75, im.height, 0, 150, 540, 540);
      x.fillStyle = '#121211'; x.font = '600 26px Geist, Arial, sans-serif'; x.fillText(shop.name, 40, 76); x.font = '500 15px "Geist Mono", monospace'; x.fillStyle = '#66645e'; x.fillText('DESIGN ' + ui.code, 40, 104);
      x.fillStyle = '#121211'; x.font = '600 54px Geist, Arial, sans-serif'; x.fillText('I built this.', 40, 770);
      x.font = '500 20px Geist, Arial, sans-serif'; x.fillStyle = '#3c3b38'; x.fillText(lookLabel() + ' · ' + (same(metalWords) || 'mixed metals'), 40, 810); x.fillText(same(finishWords) || 'mixed finishes', 40, 840);
      x.font = '500 15px "Geist Mono", monospace'; x.fillStyle = '#66645e'; x.fillText('BUILD YOURS AT ' + shop.slug.toUpperCase() + '.VVSLAB.COM', 40, 900);
      var el = $('sharecard'); if (el) el.src = c.toDataURL('image/jpeg', .88);
    };
    im.src = shotUrl;
  }
  sheet.addEventListener('click', function (e) {
    var b = e.target.closest('[data-r]'); if (!b) return; var r = b.getAttribute('data-r'); buzz();
    if (r === 'create') { var je = $('jerr'); if (join.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(join.email.trim())) { je.hidden = false; je.textContent = 'Add your shop name and an email address for requests.'; return; } shop = { name: join.name.trim(), mono: mono(join.name), slug: slugOf(join.name), mine: true }; join.done = true; renderJoin(); sheet.scrollTop = 0; }
    if (r === 'mine') { sheet.hidden = true; $('sheetx').hidden = true; ui.sheet = null; enterBuilder(); toast('This is ' + shop.name + '\'s builder, as your customers see it.'); }
    if (r === 'closejoin') { sheet.hidden = true; $('sheetx').hidden = true; ui.sheet = null; }
    if (r === 'mold') { SET.mold = b.getAttribute('data-k'); keepFields(); renderSheet(); save(); }
    if (r === 'promo') { keepFields(); SET.promo = ($('promo').value || '').trim(); renderSheet(); if (!PRICE.promo[SET.promo.toUpperCase()] && SET.promo) $('promonote').textContent = 'That code is not valid here. The demo shop accepts VVS10.'; }
    if (r === 'send') { keepFields(); var er = $('cerr'); if (SET.name.length < 2 || SET.handle.length < 3) { er.hidden = false; er.textContent = 'Add your name and an Instagram handle or phone number so the shop can reply.'; return; } ui.sent = true; renderSheet(); sheet.scrollTop = 0; $('sheetx').textContent = 'Close'; }
    if (r === 'deposit') { ui.deposit = true; renderSheet(); }
    if (r === 'again') { resume = null; ui.code = 'VVS-' + Math.random().toString(36).slice(2, 6).toUpperCase(); $('sheetx').textContent = 'Keep editing'; sheet.hidden = true; $('sheetx').hidden = true; enterBuilder(); }
    if (r === 'door') { $('sheetx').textContent = 'Keep editing'; exitBuilder(); }
  });
  function keepFields() { if ($('cname')) SET.name = $('cname').value.trim(); if ($('chandle')) SET.handle = $('chandle').value.trim(); }
  $('sheetx').addEventListener('click', function () { if (ui.sheet === 'join') { sheet.hidden = true; this.hidden = true; ui.sheet = null; this.textContent = 'Keep editing'; return; } if (ui.sent) { this.textContent = 'Keep editing'; exitBuilder(); } else { keepFields(); closeReview(); } });

  // ---------- the front door: the piece cycles through what the builder can make ----------
  var SHOW = ['oneof', 'gold', 'iced', 'tone', 'open'], lastShow = 0;
  function showLook(n) {
    ui.show = n % SHOW.length; applyLook(SHOW[ui.show]); G.sync(); G.goal(); G.glint(); meta();
    var b = breakdown(); $('nowshow').textContent = LOOKS[SHOW[ui.show]][0] + ' · ' + (b.quote ? 'quoted by the shop' : lookLabel() + ' · ' + money(b.total));
    lastShow = performance.now();
  }
  G.tick = function (t) { if (ui.mode !== 'door' || reduce || !G.ready) return; if (t - lastShow > 5200 && t - (G.touched || 0) > 7000) showLook(ui.show + 1); };

  // ---------- start ----------
  if (restore()) resume = JSON.stringify({ T: T, DEF: DEF, SET: { fangs: SET.fangs, cut: SET.cut, ins: SET.ins, mold: SET.mold, idea: SET.idea } });
  applyLook(SHOW[0]); setMode('door'); renderDock(); box();
  if (G.boot) {
    G.boot(); showLook(0);
    setTimeout(function () {             // the example request on the phone below shows a real picture of a real design
      if (ui.mode !== 'door') return;
      var keepT = JSON.stringify(T), keepD = JSON.stringify(DEF), keepF = SET.fangs, look = ui.look;
      resetAll(); DEF.karat = '14k'; setRange(6, 6); paint({ type: 'iced' }, [5, 10]); G.sync();
      var b = breakdown(), im = $('doorleadimg'); if (im) im.src = G.shot(240, 240); var card = $('doorlead');
      if (card) { card.querySelector('p').textContent = '6 × 6 · 14K yellow gold · iced canines'; var tg = card.querySelectorAll('.tags span'); tg[0].textContent = money(b.total) + ' quoted'; tg[1].textContent = money(b.deposit) + ' deposit paid'; }
      T = JSON.parse(keepT); DEF = JSON.parse(keepD); SET.fangs = keepF; ui.look = look; G.sync(); meta();
    }, 900);
  } else { $('nowshow').textContent = 'Plain gold · 6 × 6 · $2,000'; }
  window.__vvs = { T: T, ui: ui, SET: SET, G: G };
})();
