/* Final safety layer for the automatic 2D fitting room. */
(() => {
  'use strict';

  const LIMITS = {
    male: {
      TOP: { maxWidth: .47, minTop: .145, maxTop: .205, maxHeight: .34 },
      TOP_WITH_OUTERWEAR: { maxWidth: .43, minTop: .145, maxTop: .205, maxHeight: .34 },
      OUTERWEAR: { maxWidth: .50, minTop: .125, maxTop: .185, maxHeight: .43 },
      BOTTOM: { maxWidth: .46, minTop: .385, maxTop: .465, maxHeight: .57 }
    },
    female: {
      TOP: { maxWidth: .42, minTop: .155, maxTop: .215, maxHeight: .33 },
      TOP_WITH_OUTERWEAR: { maxWidth: .39, minTop: .155, maxTop: .215, maxHeight: .33 },
      OUTERWEAR: { maxWidth: .46, minTop: .135, maxTop: .195, maxHeight: .42 },
      BOTTOM: { maxWidth: .43, minTop: .375, maxTop: .455, maxHeight: .58 }
    }
  };

  const LAYER_Z = Object.freeze({ BOTTOM: 10, TOP: 20, DRESS: 20, SHOES: 20, OUTERWEAR: 30, BAG: 40, ACCESSORY: 40, ACCESSORY_HEAD: 40 });

  const style = document.createElement('style');
  style.id = 'lulos-fitting-guard-style';
  style.textContent = `
    #stage .precision-body{position:relative;isolation:isolate;overflow:visible!important}
    #stage .precision-body>.silhouette-image{position:relative;z-index:0;pointer-events:none;user-select:none;-webkit-user-drag:none}
    #stage .fit-layer{transform-origin:50% 50%;background:transparent!important;touch-action:manipulation}
    #stage .fit-layer canvas{display:block;width:100%;height:100%;object-fit:fill;pointer-events:none}
    #stage .fit-layer[data-under-outerwear="true"]{clip-path:inset(0 8% 0 8% round 2%)}
    #stage .fit-layer[type="button"]{border:0!important;outline:0;background:transparent!important}
    #stage .fit-layer[type="button"]:focus-visible{outline:1px solid #747a63!important;outline-offset:3px}
    #stage .fit-layer[type="button"]:hover{filter:brightness(1.02) drop-shadow(0 1px 1px rgba(40,35,28,.08))}
    .saved-body .precision-body{overflow:hidden!important}
    @media(max-width:720px){.fitting-room{min-width:0}.fitting-room .stage{min-width:0;width:100%}.stage .body-frame{min-width:0}#stage .precision-body{max-width:100%}.mannequin-controls select{min-width:0}}
    @media(prefers-reduced-motion:reduce){#stage .fit-layer{transition:none!important}}
  `;
  document.head.append(style);

  function productFor(node) {
    try { return productById(node.dataset.fitProduct); }
    catch { return null; }
  }

  function mannequinFor(node) { return node.dataset.fitMannequin === 'male' ? 'male' : 'female'; }

  function savedAsset(product, mannequin) {
    try { return Boolean(boot?.assets?.some(asset => asset.product_id === product.id && asset.mannequin_id === mannequin)); }
    catch { return false; }
  }

  function siblingHasCategory(node, category) {
    const parent = node.parentElement;
    if (!parent) return false;
    return [...parent.querySelectorAll('[data-fit-product]')].some(layer => layer !== node && productFor(layer)?.category === category);
  }

  function percent(node, property) {
    const value = Number.parseFloat(node.style[property]);
    return Number.isFinite(value) ? value / 100 : null;
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const setPercent = (node, property, value) => { node.style[property] = `${value * 100}%`; };

  function clampToCanvas(node) {
    let x = percent(node, 'left'), y = percent(node, 'top'), width = percent(node, 'width'), height = percent(node, 'height');
    if (![x, y, width, height].every(Number.isFinite)) return;
    width = clamp(width, .08, .82); height = clamp(height, .05, .88);
    x = clamp(x, 0, 1 - width); y = clamp(y, 0, 1 - height);
    setPercent(node, 'left', x); setPercent(node, 'top', y); setPercent(node, 'width', width); setPercent(node, 'height', height);
  }

  function centerWidth(node, width) { setPercent(node, 'width', width); setPercent(node, 'left', (1 - width) / 2); }

  function stabilizeAutomaticGeometry(node, product, mannequin) {
    const underOuterwear = product.category === 'TOP' && siblingHasCategory(node, 'OUTERWEAR');
    const key = underOuterwear ? 'TOP_WITH_OUTERWEAR' : product.category;
    const limit = LIMITS[mannequin]?.[key];
    if (!limit || savedAsset(product, mannequin)) return;
    const currentWidth = percent(node, 'width');
    if (Number.isFinite(currentWidth) && currentWidth > limit.maxWidth) centerWidth(node, limit.maxWidth);
    const currentTop = percent(node, 'top');
    if (Number.isFinite(currentTop)) setPercent(node, 'top', clamp(currentTop, limit.minTop, limit.maxTop));
    const currentHeight = percent(node, 'height');
    if (Number.isFinite(currentHeight) && currentHeight > limit.maxHeight) setPercent(node, 'height', limit.maxHeight);
  }

  function stabilize(node) {
    if (!(node instanceof HTMLElement) || !node.matches('.fit-layer.fit-ready')) return;
    const product = productFor(node);
    if (!product) return;
    const mannequin = mannequinFor(node);
    const underOuterwear = product.category === 'TOP' && siblingHasCategory(node, 'OUTERWEAR');
    node.dataset.underOuterwear = String(underOuterwear);
    node.dataset.fitCategory = product.category;
    if (LAYER_Z[product.category] != null && !savedAsset(product, mannequin)) node.style.zIndex = String(LAYER_Z[product.category]);
    stabilizeAutomaticGeometry(node, product, mannequin);
    clampToCanvas(node);
  }

  function updateStageState() {
    const stage = document.querySelector('#stage');
    if (!stage) return;
    const readyLayers = [...stage.querySelectorAll('.fit-layer.fit-ready')];
    stage.dataset.fitReady = String(readyLayers.length > 0);
    stage.dataset.hasOuterwear = String(readyLayers.some(node => productFor(node)?.category === 'OUTERWEAR'));
  }

  function scan(root = document) { root.querySelectorAll?.('.fit-layer.fit-ready').forEach(stabilize); updateStageState(); }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', schedule, { passive: true });
  scan();
})();
