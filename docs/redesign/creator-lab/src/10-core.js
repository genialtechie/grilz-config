(function () {
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), stage = $('stage'), canvas = $('gl'), load = $('load');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- catalogue and prices: the live demo shop's own options and numbers ----------
  var METALS = {
    yellow: { name: 'Yellow gold', gold: true, rgb: { '10k': [1, .775, .40], '14k': [1, .725, .315], '18k': [1, .665, .23] } },
    white: { name: 'White gold', gold: true, rgb: { '10k': [.90, .90, .89], '14k': [.93, .92, .90], '18k': [.95, .93, .89] } },
    rose: { name: 'Rose gold', gold: true, rgb: { '10k': [.96, .66, .55], '14k': [.97, .60, .47], '18k': [.98, .55, .40] } },
    silver: { name: 'Sterling silver', gold: false, rgb: [.96, .97, .98] },
    platinum: { name: 'Platinum', gold: false, rgb: [.80, .83, .87] }
  };
  var KARATS = { '10k': ['10K', 'Most durable'], '14k': ['14K', 'Richer colour'], '18k': ['18K', 'Premium'] };
  var TYPES = { plain: 'Plain', iced: 'Iced out', photo: 'Photo' };
  var STYLES = { solid: ['Solid', 'Mirror polish'], open: ['Open face', 'Frame, tooth shows'], cut: ['Diamond cut', 'Faceted'], dust: ['Diamond dust', 'Sparkle texture'], engr: ['Engraving', 'Scroll pattern'], opal: ['Opals', 'Inlaid panel'] };
  var OPALS = { white: ['White', '#e9eef2'], fire: ['Fire', '#e2552b'], blue: ['Blue', '#2f6fd0'] };
  var SETTINGS = { honeycomb: ['Honeycomb', 'Tight pavé'], mosaic: ['Mosaic', 'Mixed sizes'], prong: ['Prong', 'Even rows'] };
  var STONES = { moissanite: ['Moissanite', 'VVS'], lab: ['Lab diamond', 'Lab-grown'], natural: ['Natural diamond', 'VS clarity'] };
  var CUTS = { deep: ['Deep cut', 'Natural tooth lines, removable'], permanent: ['Permanent look', 'Seamless, custom-fit cap'] };
  var MOLDS = { kit: ['Mold kit by mail', 'We ship a kit, you send it back'], own: ['I have a mold or scan', 'Dentist mold or STL file'], store: ['In-store fitting', 'Book a visit'] };
  var INS = { engraved: ['Engraved', 'Cut into the metal'], cut: ['Diamond-cut', 'Raised faceted letters'], iced: ['Iced', 'Letters set with stones'] };
  var CHARMS = { crest: 'Crest', tri: 'Emblem', orb: 'Winged orb', crown: 'Crown', hat: 'Hat', broom: 'Broom', owl: 'Owl', potr: 'Ruby potion', pote: 'Emerald potion', sapphire: 'Sapphire' };
  var SETS = [['6 × 6', 6, 6], ['8 × 8', 8, 8], ['6 top', 6, 0], ['8 top', 8, 0], ['6 bottom', 0, 6], ['8 bottom', 0, 8], ['2 piece', 2, 0], ['Single', 1, 0], ['10 × 10', 10, 10], ['Full set', 16, 16]];
  var PRICE = {
    base: 200, metal: { yellow: 150, white: 150, rose: 150, silver: 85, platinum: 320 }, karat: { '10k': 1, '14k': 1.4, '18k': 1.85 },
    style: { solid: 0, open: 40, cut: 35, dust: 30, engr: 45, opal: 90 }, stone: { moissanite: 75, lab: 160, natural: 320 }, setting: { honeycomb: 0, mosaic: 25, prong: 0 },
    fangs: 150, permanent: 100, photo: 250, ins: { cut: 75, iced: 150, engraved: 50 }, deposit: { pct: 25, min: 100, round: 10 }, promo: { VVS10: 10 }
  };
  var STEPS = ['Look', 'Teeth', 'Metal', 'Finish', 'Extras'];
  var FANG_TEETH = [5, 10];

  // ---------- state: every tooth carries its own design; the set carries the rest ----------
  function blank() { return { on: false, metal: 'yellow', karat: '10k', type: 'plain', style: 'solid', opal: 'white', setting: 'honeycomb', stone: 'moissanite', charm: null }; }
  var T = [], i; for (i = 0; i < 32; i++) T.push(blank());
  var DEF = blank();
  var SET = { fangs: false, cut: 'deep', ins: { text: '', style: 'engraved', tooth: null }, mold: 'kit', idea: '', inspo: null, photo: null, promo: '', name: '', handle: '' };
  var ui = { mode: 'door', step: 0, sel: null, sent: false, deposit: false, show: 0, extra: null, layout: 'a', seller: 'direct', lane: null, t0: 0, tSend: 0, log: [], code: 'VVS-' + Math.random().toString(36).slice(2, 6).toUpperCase() };
  var KEYS = ['metal', 'karat', 'type', 'style', 'opal', 'setting', 'stone'];

  function metalOn() { return true; }   // version 7 starts from a finished look, so the piece shows real metal from the first tap
  function onList() { var a = []; for (var k = 0; k < 32; k++) if (T[k].on) a.push(k); return a; }
  function picked() { return (ui.picks || []).filter(function (k) { return T[k] && T[k].on; }); }   // the teeth tapped to edit on their own
  function hasSel() { return picked().length > 0; }
  function targets() { return hasSel() ? picked() : onList(); }
  function cur() { var p = picked(); return p.length ? T[p[p.length - 1]] : DEF; }
  function isGold(m) { return METALS[m].gold; }
  function money(n) { return (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }
  function counts() { var t = 0, b = 0; onList().forEach(function (k) { if (k < 16) t++; else b++; }); return [t, b]; }
  function setRange(top, bottom) {
    var st = Math.floor((16 - top) / 2), sb = Math.floor((16 - bottom) / 2), k;
    for (k = 0; k < 32; k++) { var was = T[k].on; T[k].on = k < 16 ? (k >= st && k < st + top) : (k - 16 >= sb && k - 16 < sb + bottom); if (T[k].on && !was) KEYS.forEach(function (key) { T[k][key] = DEF[key]; }); }
    ui.picks = picked(); ui.sel = ui.picks.length ? ui.picks[ui.picks.length - 1] : null;
  }
  function isCentered() {
    var c = counts(), st = Math.floor((16 - c[0]) / 2), sb = Math.floor((16 - c[1]) / 2), k;
    for (k = 0; k < c[0]; k++) if (!T[st + k].on) return false;
    for (k = 0; k < c[1]; k++) if (!T[16 + sb + k].on) return false;
    return true;
  }
  function paint(patch, list) { (list || onList()).forEach(function (k) { for (var key in patch) T[k][key] = patch[key]; }); }
  function resetAll() { for (var k = 0; k < 32; k++) T[k] = blank(); DEF = blank(); SET.fangs = false; SET.cut = 'deep'; SET.ins = { text: '', style: 'engraved', tooth: null }; ui.sel = null; ui.picks = []; }
  // one-tap starting points, as in the live builder, plus the one-of-one showpiece
  var LOOKS = {
    gold: ['Plain gold', function () { setRange(6, 6); }],
    iced: ['Fully iced', function () { DEF.type = 'iced'; setRange(8, 8); }],
    open: ['Open face', function () { DEF.style = 'open'; setRange(6, 6); }],
    fangs: ['Iced fangs', function () { DEF.type = 'iced'; setRange(6, 0); SET.fangs = true; }],
    tone: ['Two-tone', function () { setRange(6, 6); paint({ metal: 'white' }, [7, 8]); }],
    oneof: ['One-of-one', function () {
      DEF.karat = '18k'; setRange(6, 6);
      var map = { 5: { type: 'iced', charm: 'crest' }, 6: { type: 'iced', charm: 'tri' }, 7: { charm: 'orb' }, 8: { charm: 'crown' }, 9: { type: 'iced', charm: 'tri' }, 10: { type: 'iced', charm: 'crest' }, 21: { charm: 'potr' }, 22: { charm: 'pote' }, 23: { charm: 'hat' }, 24: { charm: 'broom' }, 25: { charm: 'owl' }, 26: { type: 'iced', charm: 'sapphire' } };
      Object.keys(map).forEach(function (k) { paint(map[k], [+k]); });
    }]
  };
  function applyLook(id) { resetAll(); LOOKS[id][1](); ui.look = id; }
  function lookLabel() {
    var c = counts(), n = c[0] + c[1]; if (!n) return 'No teeth yet';
    var s = SETS.filter(function (x) { return x[1] === c[0] && x[2] === c[1]; })[0];
    return (s && isCentered() ? s[0] : n + (n === 1 ? ' tooth' : ' teeth'));
  }

  // ---------- price: the live builder's own rules ----------
  function metalPrice(t) { return Math.round(PRICE.metal[t.metal] * (isGold(t.metal) ? PRICE.karat[t.karat] : 1)); }
  function toothPrice(t) {
    var p = metalPrice(t);
    if (t.type === 'iced') p += PRICE.stone[t.stone] + PRICE.setting[t.setting] + (t.style === 'open' ? PRICE.style.open : 0); else p += PRICE.style[t.style];
    return p;
  }
  function fangCount() { return SET.fangs ? FANG_TEETH.filter(function (k) { return T[k].on; }).length : 0; }
  function charmCount() { return onList().filter(function (k) { return T[k].charm; }).length; }
  function insOn() { return SET.ins.text && SET.ins.tooth !== null && T[SET.ins.tooth] && T[SET.ins.tooth].on; }
  function breakdown() {
    var on = onList().map(function (k) { return T[k]; }), lines = [['Service fee', PRICE.base]], sum = function (f) { return on.reduce(function (s, t) { return s + f(t); }, 0); };
    function add(label, amount) { if (amount) lines.push([label, amount]); }
    if (on.length) {
      add('Metal · ' + on.length + (on.length === 1 ? ' tooth' : ' teeth'), sum(metalPrice));
      add('Style & finish', sum(function (t) { return t.type === 'iced' ? (t.style === 'open' ? PRICE.style.open : 0) : PRICE.style[t.style]; }));
      add('Stones', sum(function (t) { return t.type === 'iced' ? PRICE.stone[t.stone] : 0; }));
      add('Mosaic setting', sum(function (t) { return t.type === 'iced' ? PRICE.setting[t.setting] : 0; }));
      if (on.some(function (t) { return t.type === 'photo'; })) add('Photo artwork', PRICE.photo);
      if (fangCount()) add('Fangs', PRICE.fangs);
      if (SET.cut === 'permanent') add('Permanent look', PRICE.permanent);
      if (insOn()) add('Inscription "' + SET.ins.text + '"', PRICE.ins[SET.ins.style]);
    }
    var sub = lines.reduce(function (s, l) { return s + l[1]; }, 0), pct = PRICE.promo[(SET.promo || '').toUpperCase()], off = pct ? Math.round(sub * pct / 100) : 0;
    if (off) lines.push(['Promo ' + SET.promo.toUpperCase() + ' · ' + pct + '% off', -off]);
    var total = sub - off, d = PRICE.deposit, dep = Math.min(total, Math.max(d.min, Math.round(total * d.pct / 100 / d.round) * d.round));
    return { lines: lines, total: total, deposit: dep, quote: charmCount() > 0 };
  }
  function delta(change) {
    var d = 0; targets().forEach(function (k) { var c = {}; for (var key in T[k]) c[key] = T[k][key]; var b = toothPrice(c); change(c); d += toothPrice(c) - b; });
    return d ? (d > 0 ? '+' : '−') + '$' + Math.abs(d).toLocaleString('en-US') : '';
  }

  // ---------- words: the same summary the shop receives ----------
  function metalWords(t) { return (isGold(t.metal) ? KARATS[t.karat][0] + ' ' : '') + METALS[t.metal].name.toLowerCase(); }
  function finishWords(t) {
    if (t.type === 'iced') return 'iced' + (t.style === 'open' ? ' open face' : '') + ' · ' + SETTINGS[t.setting][0].toLowerCase() + ' · ' + STONES[t.stone][0].toLowerCase();
    if (t.type === 'photo') return 'photo';
    return t.style === 'opal' ? OPALS[t.opal][0].toLowerCase() + ' opals' : STYLES[t.style][0].toLowerCase();
  }
  function same(f) { var on = onList(), v = on.length ? f(T[on[0]]) : null; return on.every(function (k) { return f(T[k]) === v; }) ? v : null; }
  function receipt() {
    var n = onList().length; if (!n) return 'No teeth yet';
    var s = lookLabel(); if (!metalOn()) return s;
    s += ' · ' + (same(metalWords) || 'mixed metals') + ' · ' + (same(finishWords) || 'mixed finishes');
    if (fangCount()) s += ' · fangs'; var c = charmCount(); if (c) s += ' · ' + c + (c === 1 ? ' charm' : ' charms');
    return s;
  }
  function toothName(k) { var n = k % 16, side = n < 8 ? 'left' : 'right', d = n < 8 ? 7 - n : n - 8; return (k < 16 ? 'Upper ' : 'Lower ') + side + ' ' + ['central', 'lateral', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'third molar'][d]; }
  function specLines() {
    var out = [], on = onList(), groups = {}, order = [];
    on.forEach(function (k) { var key = metalWords(T[k]) + ', ' + finishWords(T[k]); if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(k); });
    out.push(lookLabel() + ' (' + on.length + (on.length === 1 ? ' tooth' : ' teeth') + ')');
    order.forEach(function (key) { out.push((order.length > 1 ? groups[key].length + ' × ' : '') + key); });
    if (fangCount()) out.push('Fangs on the upper canines');
    out.push(CUTS[SET.cut][0]);
    if (insOn()) out.push('"' + SET.ins.text + '" ' + INS[SET.ins.style][0].toLowerCase() + ' on the ' + toothName(SET.ins.tooth).toLowerCase());
    on.forEach(function (k) { if (T[k].charm) out.push(CHARMS[T[k].charm] + ' charm on the ' + toothName(k).toLowerCase() + ' (one-of-one, quoted)'); });
    if (SET.idea) out.push('Their idea: ' + SET.idea);
    out.push('Fit: ' + MOLDS[SET.mold][0].toLowerCase());
    return out;
  }

  // ---------- keep the design between visits ----------
  function save() { try { localStorage.setItem('vvs-design-7', JSON.stringify({ T: T, DEF: DEF, SET: { fangs: SET.fangs, cut: SET.cut, ins: SET.ins, mold: SET.mold, idea: SET.idea } })); } catch (e) {} }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem('vvs-design-7') || 'null'); if (!s || !s.T || s.T.length !== 32) return false;
      s.T.forEach(function (t, k) { var b = blank(); for (var key in b) if (t[key] !== undefined) b[key] = t[key]; if (!METALS[b.metal] || !STYLES[b.style] || (b.charm && !CHARMS[b.charm])) b = blank(); T[k] = b; });
      for (var key in DEF) if (s.DEF && s.DEF[key] !== undefined && key !== 'on') DEF[key] = s.DEF[key];
      if (s.SET) { SET.fangs = !!s.SET.fangs; SET.cut = CUTS[s.SET.cut] ? s.SET.cut : 'deep'; if (s.SET.ins) SET.ins = s.SET.ins; if (MOLDS[s.SET.mold]) SET.mold = s.SET.mold; SET.idea = s.SET.idea || ''; }
      return onList().length > 0;
    } catch (e) { return false; }
  }

  // hooks the 3D fills in; the page still works as a form without them
  var G = { sync: function () {}, goal: function () {}, pop: function () {}, glint: function () {}, shot: function () { return ''; }, solid: function () {}, jaw: function () {}, thumb: function () { return ''; }, ready: false };
