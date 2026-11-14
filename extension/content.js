// FTC Live RTX Logo Remover
// The RTX mark is baked into the season logo SVGs as a "PRESENTED BY <sponsor>"
// strip along the bottom (or, on the wide logos, a block on the right). This crops
// that strip off by rewriting the SVG viewBox.
(() => {
  'use strict';

  // Logos that carry a presenting-sponsor strip (hashed names, e.g.
  // /img/logos/biobuzz_season_primary_word-<hash>.svg, /img/logos/ftc/2026/color-<hash>.svg,
  // /img/logos/biobuzz_season_primary_wide-<hash>.svg)
  const TARGET = /\/img\/logos\/(?:[^/]*_primary_(?:word|wide|color)[^/]*|ftc\/\d{4}\/color[^/]*)\.svg$/i;
  // Wide logos put the sponsor block to the right of the wordmark instead of below it.
  const SIDE_STRIP = /_primary_wide[^/]*\.svg$/i;
  const CSS_HIDE =
    'img[src*="/img/logos/"][src*="_primary_word"]:not([data-rtx-clean]),' +
    'img[src*="/img/logos/"][src*="_primary_wide"]:not([data-rtx-clean]),' +
    'img[src*="/img/logos/"][src*="_primary_color"]:not([data-rtx-clean]),' +
    'img[src*="/img/logos/ftc/"][src*="/color"]:not([data-rtx-clean])' +
    '{visibility:hidden !important}';

  const cache = new Map();
  let style;

  function addHideStyle() {
    style = document.createElement('style');
    style.textContent = CSS_HIDE;
    (document.head || document.documentElement).appendChild(style);
  }

  function isFtcLive() {
    return !!document.querySelector('script[src*="/bundle/ftc-local/"], link[href*="/bundle/ftc-local/"]') ||
      /FIRST Tech Challenge Live/i.test(document.title);
  }

  // Render the SVG, find bands of content along one axis (rows for a strip along the
  // bottom, columns for a block on the right), and return the y or x (in viewBox
  // units) to cut at if the last band looks like a sponsor strip. Otherwise null.
  async function findSponsorCut(svgText, vb, side) {
    const W = 600;
    const H = Math.max(1, Math.round(W * vb[3] / vb[2]));
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;

      const rows = side !== 'right';
      const N = rows ? H : W;       // lines along the cut axis
      const filled = rows
        ? (y) => { for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) if (d[i] > 16) return true; return false; }
        : (x) => { for (let y = 0, i = x * 4 + 3; y < H; y++, i += W * 4) if (d[i] > 16) return true; return false; };
      const bands = [];
      let start = -1;
      for (let n = 0; n < N; n++) {
        const f = filled(n);
        if (f && start < 0) start = n;
        if (!f && start >= 0) { bands.push([start, n]); start = -1; }
      }
      if (start >= 0) bands.push([start, N]);
      // The sponsor mark can itself be split into pieces (e.g. RTX icon + "RTX" text a
      // pixel apart), so treat trailing bands that nearly touch as one block.
      let k = bands.length - 1;
      while (k > 0 && bands[k][0] - bands[k - 1][1] < N * 0.01) k--;
      if (k < 1) return null;

      const last = [bands[k][0], bands[bands.length - 1][1]];
      const prev = bands[k - 1];
      const gap = last[0] - prev[1];
      if (last[1] - last[0] > N * 0.35) return null; // too big to be a sponsor strip
      if (gap < N * 0.01) return null;               // not clearly separated

      const cutPx = prev[1] + Math.min(gap / 2, N * 0.02);
      return rows ? vb[1] + cutPx * vb[3] / H : vb[0] + cutPx * vb[2] / W;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function cleanSvg(url) {
    if (cache.has(url)) return cache.get(url);
    const p = (async () => {
      const text = await (await fetch(url, { credentials: 'same-origin' })).text();
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') return url;

      let vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length !== 4 || vb.some(isNaN)) {
        vb = [0, 0, parseFloat(svg.getAttribute('width')), parseFloat(svg.getAttribute('height'))];
        if (vb.some(isNaN)) return url;
      }

      const side = SIDE_STRIP.test(new URL(url).pathname) ? 'right' : 'bottom';
      const cut = await findSponsorCut(text, vb, side);
      if (cut == null) return url;

      const rows = side === 'bottom';
      const size = rows ? cut - vb[1] : cut - vb[0];
      const ratio = size / (rows ? vb[3] : vb[2]);
      svg.setAttribute('viewBox', rows
        ? `${vb[0]} ${vb[1]} ${vb[2]} ${size}`
        : `${vb[0]} ${vb[1]} ${size} ${vb[3]}`);
      const attr = rows ? 'height' : 'width';
      const v = svg.getAttribute(attr);
      if (v && !isNaN(parseFloat(v))) {
        const unit = (v.match(/[a-z%]+$/i) || [''])[0];
        if (unit !== '%') svg.setAttribute(attr, parseFloat(v) * ratio + unit);
      }
      const out = new XMLSerializer().serializeToString(svg);
      return URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
    })().catch(() => url);
    cache.set(url, p);
    return p;
  }

  function processImg(img) {
    const raw = img.getAttribute('src');
    if (!raw || raw.startsWith('blob:') || raw.startsWith('data:')) return;
    let u;
    try { u = new URL(raw, location.href); } catch { return; }
    if (u.origin !== location.origin || !TARGET.test(u.pathname)) return;

    img.removeAttribute('data-rtx-clean');
    cleanSvg(u.href).then((clean) => {
      if (img.getAttribute('src') === raw && clean !== u.href) img.setAttribute('src', clean);
      img.setAttribute('data-rtx-clean', '');
    });
  }

  function scan(root) {
    if (root.nodeName === 'IMG') processImg(root);
    if (root.querySelectorAll) root.querySelectorAll('img').forEach(processImg);
  }

  function start() {
    if (!isFtcLive()) { style && style.remove(); return; }
    scan(document);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes') processImg(m.target);
        else m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['src'],
    });
  }

  addHideStyle();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
