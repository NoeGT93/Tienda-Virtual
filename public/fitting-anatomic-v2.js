/* Anatomical pass for the Lulos 2D fitting room.
   It runs after the legacy auto-fit/guard layers and intentionally replaces
   old persisted body coordinates that made garments look pasted on. */
(() => {
  'use strict';

  const BODY = new Set(['TOP', 'OUTERWEAR', 'BOTTOM', 'DRESS']);
  const Z = { BOTTOM: 10, DRESS: 18, TOP: 20, SHOES: 24, OUTERWEAR: 30, BAG: 40, ACCESSORY: 40, ACCESSORY_HEAD: 45 };

  // Coordinates are relative to the complete mannequin artwork, not the stage.
  // They were calibrated against the current 2:3 female/male mannequin assets.
  const FIT = {
    male: {
      TOP:        { x: .325, y: .155, w: .350, h: .292 },
      TOP_UNDER:  { x: .340, y: .158, w: .320, h: .288 },
      OUTERWEAR:  { x: .285, y: .137, w: .430, h: .402 },
      BOTTOM:     { x: .325, y: .410, w: .350, h: .525 },
      DRESS:      { x: .285, y: .155, w: .430, h: .690 }
    },
    female: {
      TOP:        { x: .345, y: .166, w: .310, h: .282 },
      TOP_UNDER:  { x: .360, y: .168, w: .280, h: .278 },
      OUTERWEAR:  { x: .310, y: .146, w: .380, h: .392 },
      BOTTOM:     { x: .330, y: .402, w: .340, h: .535 },
      DRESS:      { x: .300, y: .162, w: .400, h: .680 }
    }
  };

  const css = document.createElement('style');
  css.id = 'lulos-anatomic-fit-v2';
  css.textContent = `
    .precision-body{position:relative!important;isolation:isolate!important}
    .precision-body>.silhouette-image{position:relative!important;z-index:0!important}
    .precision-body .fit-layer[data-anatomic-fit="true"]{transform-origin:50% 50%!important;overflow:visible!important}
    .precision-body .fit-layer[data-anatomic-fit="true"] canvas{width:100%!important;height:100%!important;display:block!important}
    .precision-body .fit-layer[data-fit-category="TOP"][data-under-outerwear="true"]{clip-path:inset(0 10% 0 10% round 2%)}
    .precision-body>.fit-foreground{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;-webkit-user-drag:none}
    .precision-body>.fit-hand-left,.precision-body>.fit-hand-right{z-index:35}
    .precision-body>.fit-feet-left,.precision-body>.fit-feet-right{z-index:15}
    .precision-body[data-silhouette="male"]>.fit-hand-left{clip-path:polygon(17% 49%,30% 49%,30% 70%,19% 70%)}
    .precision-body[data-silhouette="male"]>.fit-hand-right{clip-path:polygon(70% 49%,83% 49%,81% 70%,70% 70%)}
    .precision-body[data-silhouette="male"]>.fit-feet-left{clip-path:polygon(31% 88%,49% 88%,48% 100%,29% 100%)}
    .precision-body[data-silhouette="male"]>.fit-feet-right{clip-path:polygon(51% 88%,69% 88%,71% 100%,52% 100%)}
    .precision-body[data-silhouette="female"]>.fit-hand-left{clip-path:polygon(19% 48%,32% 48%,31% 70%,20% 70%)}
    .precision-body[data-silhouette="female"]>.fit-hand-right{clip-path:polygon(68% 48%,81% 48%,80% 70%,69% 70%)}
    .precision-body[data-silhouette="female"]>.fit-feet-left{clip-path:polygon(33% 88%,49% 88%,48% 100%,31% 100%)}
    .precision-body[data-silhouette="female"]>.fit-feet-right{clip-path:polygon(51% 88%,67% 88%,69% 100%,52% 100%)}
  `;
  document.head.append(css);

  const productFor = node => {
    try { return productById(node.dataset.fitProduct); }
    catch { return null; }
  };

  function mannequin(node) {
    return node.dataset.fitMannequin === 'male' ? 'male' : 'female';
  }

  function hasOuterwear(node) {
    return [...(node.parentElement?.querySelectorAll('[data-fit-product]') || [])]
      .some(other => other !== node && productFor(other)?.category === 'OUTERWEAR');
  }

  function place(node, box, category) {
    node.style.left = `${box.x * 100}%`;
    node.style.top = `${box.y * 100}%`;
    node.style.width = `${box.w * 100}%`;
    node.style.height = `${box.h * 100}%`;
    node.style.zIndex = String(Z[category] ?? 20);
    node.style.transform = 'rotate(0deg)';
    node.dataset.anatomicFit = 'true';
  }

  // A light row-by-row warp removes the rectangular/pasted look without
  // destroying garment texture. It works on the already-cleaned canvas.
  function warpCanvas(node, category, sex) {
    if (node.dataset.anatomicWarped === 'true') return;
    const canvas = node.querySelector('canvas');
    if (!canvas || !canvas.width || !canvas.height) return;
    const source = document.createElement('canvas');
    source.width = canvas.width; source.height = canvas.height;
    source.getContext('2d').drawImage(canvas, 0, 0);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {
      const t = y / Math.max(1, canvas.height - 1);
      let scale = 1;
      if (category === 'TOP') {
        scale = 1 - (sex === 'male' ? .10 : .16) * Math.sin(Math.PI * t);
      } else if (category === 'OUTERWEAR') {
        scale = 1 - (sex === 'male' ? .07 : .11) * Math.sin(Math.PI * t);
      } else if (category === 'BOTTOM') {
        scale = t < .22 ? .88 + .12 * (t / .22) : 1;
      } else if (category === 'DRESS') {
        scale = t < .45 ? 1 - .12 * Math.sin(Math.PI * t / .9) : .90 + .10 * ((t - .45) / .55);
      }
      const width = canvas.width * scale;
      const x = (canvas.width - width) / 2;
      ctx.drawImage(source, 0, y, source.width, 1, x, y, width, 1);
    }
    node.dataset.anatomicWarped = 'true';
  }

  function addForeground(body) {
    const base = body.querySelector(':scope > .silhouette-image');
    if (!base || body.querySelector(':scope > .fit-foreground')) return;
    for (const cls of ['fit-hand-left','fit-hand-right','fit-feet-left','fit-feet-right']) {
      const img = base.cloneNode(false);
      img.removeAttribute('alt');
      img.setAttribute('aria-hidden', 'true');
      img.className = `fit-foreground ${cls}`;
      body.append(img);
    }
  }

  function fitLayer(node) {
    if (!(node instanceof HTMLElement) || !node.classList.contains('fit-ready')) return;
    const product = productFor(node);
    if (!product) return;
    node.dataset.fitCategory = product.category;

    // Accessories keep their own coordinates. The body garments use one
    // anatomical coordinate system so old DB values cannot re-break the fit.
    if (!BODY.has(product.category)) {
      if (Z[product.category] != null) node.style.zIndex = String(Z[product.category]);
      return;
    }

    const sex = mannequin(node);
    const under = product.category === 'TOP' && hasOuterwear(node);
    node.dataset.underOuterwear = String(under);
    const box = FIT[sex][under ? 'TOP_UNDER' : product.category];
    if (!box) return;
    warpCanvas(node, product.category, sex);
    place(node, box, product.category);
  }

  function apply() {
    document.querySelectorAll('.precision-body').forEach(addForeground);
    document.querySelectorAll('.fit-layer.fit-ready').forEach(fitLayer);
    const stage = document.querySelector('#stage');
    if (stage) stage.dataset.fitVersion = 'anatomic-v2';
    const status = document.querySelector('.live-dot');
    if (status && /Autoajuste|Interactivo/i.test(status.textContent || '')) status.textContent = 'Ajuste anatómico';
    const caption = document.querySelector('#stage-caption');
    if (caption && document.querySelector('#stage .fit-layer.fit-ready')) caption.textContent = 'Ajuste anatómico · vista frontal';
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  window.addEventListener('resize', schedule, { passive: true });
  schedule();
})();
