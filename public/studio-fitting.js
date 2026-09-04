/* Complete dressed scenes, never flat garment layers. See STUDIO-FITTING.md. */
(() => {
  'use strict';
  const sheetCache = new Map(), sceneCache = new Map(), started = new WeakSet();
  const approved = {
    'top-marfil': ['TOP', 1, '#e6ddc7'], 'top-oliva': ['TOP', 1, '#81846a'],
    'blazer-arena': ['OUTERWEAR', 2, '#b7936a'], 'blazer-pizarra': ['OUTERWEAR', 2, '#696966'],
    'pantalon-grafito': ['BOTTOM', 3, '#454645'], 'pantalon-humo': ['BOTTOM', 3, '#93938e'],
    'falda-cacao': ['BOTTOM', 4, '#574338'], 'falda-perla': ['BOTTOM', 4, '#b8b0a2'],
    'bolso-noche': ['BAG', 5, '#242323']
  };
  const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.round(w), height: Math.round(h) });
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'studio-fitting.css?v=1'; document.head.append(style);
  function readSheet(url) {
    if (!sheetCache.has(url)) sheetCache.set(url, new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => { sheetCache.delete(url); reject(new Error('Imagen no disponible')); }; image.src = url;
    }));
    return sheetCache.get(url);
  }
  function selection(items, sex) {
    const list = lookProducts(items), m = boot.mannequins.find(m => m.id === sex);
    const standardBody = m?.image === `/assets/mannequin-${sex}.png`;
    const supported = ['female', 'male'].includes(sex) && standardBody && list.every(p => {
      const a = approved[p.id];
      return a && !p.image && p.category === a[0] && Number(p.cell) === a[1] && p.swatch?.toLowerCase() === a[2]
        && !boot.assets.some(a => a.product_id === p.id && a.mannequin_id === sex)
        && (sex === 'female' || !['TOP'].includes(p.category) && !/falda/.test(p.id));
    });
    const byCategory = Object.fromEntries(list.map(p => [p.category, p]));
    const top = byCategory.TOP, jacket = byCategory.OUTERWEAR, bottom = byCategory.BOTTOM;
    const olive = top?.id === 'top-oliva', slate = jacket?.id === 'blazer-pizarra';
    const upper = jacket ? (slate ? (top ? (olive ? 8 : 6) : 4) : (top ? (olive ? 7 : 5) : 3)) : top ? (olive ? 2 : 1) : 0;
    const maleIndex = (bottom ? (bottom.id === 'pantalon-humo' ? 2 : 1) : 0) * 3 + (jacket ? (slate ? 2 : 1) : 0);
    const cell = sex === 'male' ? maleIndex : upper;
    return { list, supported, sex, top, jacket, bottom, bag: byCategory.BAG,
      col: cell % 3, row: Math.floor(cell / 3) };
  }
  function renderKey(s) { return [s.sex, s.top?.id, s.jacket?.id, s.bottom?.id].join('|'); }
  async function scene(s) {
    const key = renderKey(s); if (sceneCache.has(key)) return sceneCache.get(key);
    const promise = (async () => {
      const bottoms = { 'pantalon-grafito': 'graphite', 'pantalon-humo': 'smoke', 'falda-cacao': 'cacao', 'falda-perla': 'pearl' };
      const file = s.sex === 'male' ? 'studio-male-all.png' : 'studio-female-' + (bottoms[s.bottom?.id] || 'bare') + '.png';
      const image = await readSheet('/assets/' + file);
      const cellW = image.naturalWidth / 3, cellH = image.naturalHeight / 3;
      const source = makeCanvas(cellW, cellH);
      source.getContext('2d').drawImage(image, s.col * cellW, s.row * cellH, cellW, cellH, 0, 0, source.width, source.height);
      return source;
    })();
    sceneCache.set(key, promise);
    promise.catch(() => sceneCache.delete(key));
    return promise;
  }
  realBody = (items = state.equipped, interactive = false) => {
    const s = selection(items, liveMannequin), label = `${s.sex === 'male' ? 'Caballero' : 'Dama'} · ${s.list.map(p => p.name).join(', ') || 'Silueta de estudio'}`;
    return `<div class="real-body studio-body" data-studio-sex="${esc(s.sex)}" data-studio-items="${esc(JSON.stringify(items))}" data-studio-supported="${s.supported}" aria-busy="true"><canvas class="studio-photograph" role="img" aria-label="${esc(label)}"></canvas><span class="studio-loading">Preparando tu look…</span>${interactive && s.supported ? '<button class="studio-zoom" type="button" data-studio-zoom aria-label="Ampliar vista del look">⤢</button>' : ''}${s.bag && s.supported ? `<div class="studio-accessory"><span>COMPLETA EL LOOK</span>${imageMarkup(s.bag)}<small>${esc(s.bag.name)}</small></div>` : ''}</div>`;
  };
  async function paint(node) {
    if (started.has(node)) return; started.add(node);
    const s = selection(JSON.parse(node.dataset.studioItems), node.dataset.studioSex);
    if (!s.supported) {
      node.classList.add('studio-unavailable'); node.querySelector('canvas').hidden = true;
      node.querySelector('.studio-loading').textContent = 'Esta combinación todavía no tiene una vista de estudio. Puedes consultar las prendas en Tu selección.';
      node.setAttribute('aria-busy', 'false'); return;
    }
    try {
      const source = await scene(s); if (!node.isConnected) return;
      const c = node.querySelector('canvas'); c.width = source.width; c.height = source.height; c.getContext('2d').drawImage(source, 0, 0);
      node.classList.add('studio-ready'); node.setAttribute('aria-busy', 'false');
    } catch {
      if (!node.isConnected) return;
      node.querySelector('.studio-loading').innerHTML = 'No se pudo cargar la vista. <button type="button" data-studio-retry>Reintentar</button>';
      node.setAttribute('aria-busy', 'false');
    }
  }
  let queued = false;
  function schedule() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; document.querySelectorAll('[data-studio-items]').forEach(paint); });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  const previousRender = renderLook;
  renderLook = () => {
    previousRender();
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = lookProducts().length ? 'Tu combinación · vista de estudio' : 'Elige una prenda para ver cómo se lleva';
    const status = document.querySelector('.live-dot'); if (status) status.textContent = 'Vista de estudio';
    const note = document.querySelector('.fitting-room > .disclaimer');
    if (note) note.textContent = 'Imagen ilustrativa de la combinación. Consulta las medidas para elegir tu talla.';
    schedule();
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-studio-retry]')) { const node = event.target.closest('[data-studio-items]'); started.delete(node); paint(node); }
    const zoom = event.target.closest('[data-studio-zoom]'); if (!zoom) return;
    const node = zoom.closest('[data-studio-items]'); if (!node.classList.contains('studio-ready')) return;
    const dialog = document.createElement('dialog'); dialog.className = 'studio-dialog';
    dialog.setAttribute('aria-label', 'Vista ampliada del look');
    dialog.innerHTML = '<form method="dialog"><button aria-label="Cerrar vista ampliada">×</button></form><h2>Tu look, de cerca.</h2><canvas></canvas><p>Vista ilustrativa. Los accesorios se muestran por separado.</p>';
    const c = dialog.querySelector('canvas'), original = node.querySelector('canvas'); c.width = original.width; c.height = original.height; c.getContext('2d').drawImage(original, 0, 0);
    dialog.addEventListener('close', () => { dialog.remove(); zoom.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal();
  });
  schedule();
})();
