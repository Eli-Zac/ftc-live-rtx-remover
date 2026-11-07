// FTC Live RTX Logo Remover
// The RTX mark is baked into the season logo SVGs as a "PRESENTED BY <sponsor>"
// strip along the bottom. This crops that strip off by rewriting the SVG viewBox.
(() => {
  'use strict';

  // Logos that carry a presenting-sponsor strip (hashed names, e.g.
  // /img/logos/biobuzz_season_primary_word-<hash>.svg, /img/logos/ftc/2026/color-<hash>.svg)
  const TARGET = /\/img\/logos\/(?:[^/]*_primary_word[^/]*|ftc\/\d{4}\/color[^/]*)\.svg$/i;
  const CSS_HIDE =
    'img[src*="/img/logos/"][src*="_primary_word"]:not([data-rtx-clean]),' +
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

  // Render the SVG, find horizontal bands of content, and return the y (in viewBox
  // units) to cut at if the last band looks like a sponsor strip. Otherwise null.
  async function findSponsorCut(svgText, vb) {
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

      const filled = (y) => {
        for (let x = 0, i = y * W * 4 + 3; x < W; x++, i += 4) if (d[i] > 16) return true;
        return false;
      };
      const bands = [];
      let start = -1;
      for (let y = 0; y < H; y++) {
        const f = filled(y);
        if (f && start < 0) start = y;
        if (!f && start >= 0) { bands.push([start, y]); start = -1; }
      }
      if (start >= 0) bands.push([start, H]);
      if (bands.length < 2) return null;

      const last = bands[bands.length - 1];
      const prev = bands[bands.length - 2];
      const gap = last[0] - prev[1];
      if (last[1] - last[0] > H * 0.35) return null; // too tall to be a sponsor strip
      if (gap < H * 0.01) return null;               // not clearly separated

      const cutPx = prev[1] + Math.min(gap / 2, H * 0.02);
      return vb[1] + cutPx * vb[3] / H;
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

      const cutY = await findSponsorCut(text, vb);
      if (cutY == null) return url;

      const newH = cutY - vb[1];
      const ratio = newH / vb[3];
      svg.setAttribute('viewBox', `${vb[0]} ${vb[1]} ${vb[2]} ${newH}`);
      const h = svg.getAttribute('height');
      if (h && !isNaN(parseFloat(h))) {
        const unit = (h.match(/[a-z%]+$/i) || [''])[0];
        if (unit !== '%') svg.setAttribute('height', parseFloat(h) * ratio + unit);
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
