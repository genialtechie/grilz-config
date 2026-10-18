/*
 * VVS Lab builder embed.
 *
 *   <script src="https://vvslab.magpollo.com/embed.js" data-shop="your-shop" async></script>
 *
 * Puts the shop's 3D builder on its own website, where the tag sits. Site
 * builders that only allow scripts in the page head can use a placeholder
 * instead, anywhere in the page:  <div data-vvslab-shop="your-shop"></div>
 *
 * Options (on the script tag or the placeholder):
 *   data-mode="auto" | "inline" | "button"   auto (default): the builder inline on
 *       wide screens, a button that opens it full screen on phones, where a 3D
 *       builder inside a page is too cramped to use.
 *   data-height="860"   the tallest the inline builder gets, in pixels.
 *
 * Leads from the embed are tagged with the website's hostname. Nothing about the
 * visitor is sent to the page that embeds it.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var origin = (function () {
    try {
      return new URL(script && script.src ? script.src : 'https://vvslab.magpollo.com/embed.js').origin;
    } catch (e) {
      return 'https://vvslab.magpollo.com';
    }
  })();
  var SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

  // The website's hostname. Inside a site builder's sandboxed frame (Wix's HTML
  // embed) the frame has no hostname of its own, so use the page around it.
  function siteHost() {
    if (location.hostname) return location.hostname;
    try {
      if (location.ancestorOrigins && location.ancestorOrigins.length) return new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname;
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch (e) {
      // fall through
    }
    return 'unknown';
  }

  function builderUrl(slug, embedded) {
    var params = 'utm_source=embed&utm_medium=website&embed=' + encodeURIComponent(siteHost());
    return origin + '/b/' + slug + '?' + params + (embedded ? '' : '&utm_content=button');
  }

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    for (var key in styles) node.style[key] = styles[key];
    if (text) node.textContent = text;
    return node;
  }

  function button(slug) {
    var card = el('div', { boxSizing: 'border-box', width: '100%', padding: '28px 20px', borderRadius: '16px', background: '#0b0b0b', color: '#f3eee4', textAlign: 'center', fontFamily: '-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' });
    card.appendChild(el('div', { fontSize: '20px', fontWeight: '700', marginBottom: '6px' }, 'Design your grillz in 3D'));
    card.appendChild(el('div', { fontSize: '14px', opacity: '0.75', marginBottom: '18px' }, 'Pick your teeth, metal and style, see the price, and get a photo of your set.'));
    var link = el('a', { display: 'inline-block', padding: '13px 22px', borderRadius: '999px', background: '#e6c97f', color: '#0b0b0b', fontWeight: '700', fontSize: '15px', textDecoration: 'none' }, 'Start designing');
    link.href = builderUrl(slug, false);
    link.target = '_blank';
    link.rel = 'noopener';
    card.appendChild(link);
    return card;
  }

  function inline(slug, maxHeight) {
    var wrap = el('div', { width: '100%' });
    var frame = document.createElement('iframe');
    frame.src = builderUrl(slug, true);
    frame.title = 'Design your grillz';
    frame.loading = 'lazy';
    frame.allow = 'clipboard-write; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.style.cssText = 'display:block;width:100%;border:0;border-radius:16px;background:#f6f4f0;';
    // The builder fills its frame like an app, so the frame follows the visitor's
    // screen height (within limits) instead of the page's content.
    function size() {
      var target = Math.round(Math.min(maxHeight, Math.max(600, window.innerHeight * 0.9)));
      frame.style.height = target + 'px';
    }
    size();
    window.addEventListener('resize', size);
    wrap.appendChild(frame);
    var full = el('a', { display: 'inline-block', marginTop: '8px', fontSize: '13px', color: 'inherit', opacity: '0.7', fontFamily: 'inherit' }, 'Open the builder full screen ↗');
    full.href = builderUrl(slug, false);
    full.target = '_blank';
    full.rel = 'noopener';
    wrap.appendChild(full);
    return wrap;
  }

  function mount(host, options) {
    if (!host || host.getAttribute('data-vvslab-mounted')) return;
    var slug = String(options.shop || '').toLowerCase();
    if (!SLUG.test(slug)) {
      if (window.console) console.warn('VVS Lab embed: add data-shop="your-shop" to the tag.');
      return;
    }
    host.setAttribute('data-vvslab-mounted', '1');
    var mode = options.mode || 'auto';
    var maxHeight = Math.max(600, Math.min(1400, parseInt(options.height, 10) || 860));
    var narrow = (host.parentElement ? host.parentElement.clientWidth : window.innerWidth) < 640;
    host.appendChild(mode === 'button' || (mode === 'auto' && narrow) ? button(slug) : inline(slug, maxHeight));
  }

  // In the page head (some site builders only allow that) the builder can't go
  // where the tag is, so it waits for a placeholder instead.
  if (script && script.getAttribute('data-shop') && !(script.parentNode && script.parentNode.nodeName === 'HEAD')) {
    var spot = document.createElement('div');
    spot.className = 'vvslab-embed';
    script.parentNode.insertBefore(spot, script);
    mount(spot, { shop: script.getAttribute('data-shop'), mode: script.getAttribute('data-mode'), height: script.getAttribute('data-height') });
  }

  function placeholders() {
    var nodes = document.querySelectorAll('[data-vvslab-shop]');
    for (var i = 0; i < nodes.length; i += 1) {
      mount(nodes[i], { shop: nodes[i].getAttribute('data-vvslab-shop'), mode: nodes[i].getAttribute('data-mode'), height: nodes[i].getAttribute('data-height') });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeholders);
  else placeholders();
})();
