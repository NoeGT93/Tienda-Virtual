/* Prevent wide flat garment photos from escaping the mannequin silhouette. */
(() => {
  'use strict';

  const limits = {
    male: { TOP: .50, TOP_WITH_OUTERWEAR: .46, OUTERWEAR: .54 },
    female: { TOP: .44, TOP_WITH_OUTERWEAR: .41, OUTERWEAR: .50 }
  };

  function productFor(node) {
    try { return productById(node.dataset.fitProduct); }
    catch { return null; }
  }

  function hasOuterwear(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    return [...parent.querySelectorAll('[data-fit-product]')].some(layer => {
      const product = productFor(layer);
      return product && product.category === 'OUTERWEAR';
    });
  }

  function centerWidth(node, width) {
    const percent = width * 100;
    node.style.width = `${percent}%`;
    node.style.left = `${(100 - percent) / 2}%`;
  }

  function stabilize(node) {
    if (!(node instanceof HTMLElement) || !node.matches('.fit-layer.fit-ready')) return;
    const product = productFor(node);
    const mannequin = node.dataset.fitMannequin === 'male' ? 'male' : 'female';
    if (!product || !limits[mannequin]) return;

    let cap = null;
    if (product.category === 'TOP') {
      cap = hasOuterwear(node) ? limits[mannequin].TOP_WITH_OUTERWEAR : limits[mannequin].TOP;
    } else if (product.category === 'OUTERWEAR') {
      cap = limits[mannequin].OUTERWEAR;
    }
    if (!cap) return;

    const current = parseFloat(node.style.width) / 100;
    if (!Number.isFinite(current) || current <= cap + .002) return;
    centerWidth(node, cap);
  }

  function scan(root = document) {
    root.querySelectorAll?.('.fit-layer.fit-ready').forEach(stabilize);
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  scan();
})();
