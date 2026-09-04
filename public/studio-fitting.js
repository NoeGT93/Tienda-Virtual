/* Complete dressed scenes, never flat garment layers. See STUDIO-FITTING.md. */
(() => {
  'use strict';
  const sheetCache = new Map(), sceneCache = new Map(), started = new WeakSet();
  const automaticRealBody = realBody;
  const approved = {
    'top-marfil': ['TOP', 1, '#e6ddc7'], 'top-oliva': ['TOP', 1, '#81846a'],
    'blazer-arena': ['OUTERWEAR', 2, '#b7936a'], 'blazer-pizarra': ['OUTERWEAR', 2, '#696966'],
    'pantalon-grafito': ['BOTTOM', 3, '#454645'], 'pantalon-humo': ['BOTTOM', 3, '#93938e'],
    'falda-cacao': ['BOTTOM', 4, '#574338'], 'falda-perla': ['BOTTOM', 4, '#b8b0a2'],
    'bolso-noche': ['BAG', 5, '#242323']
  };
  const aliases = {
    'blusa-celeste': 'top-marfil', 'top-rosa-arcilla': 'top-marfil',
    'blazer-vino-dama': 'blazer-pizarra', 'blazer-azul-dama': 'blazer-pizarra',
    'pantalon-avena-dama': 'pantalon-grafito', 'falda-oliva': 'falda-cacao', 'falda-negra': 'falda-cacao',
    'blazer-navy-caballero': 'blazer-pizarra', 'blazer-bosque-caballero': 'blazer-pizarra',
    'blazer-camel-caballero': 'blazer-arena', 'blazer-vino-caballero': 'blazer-pizarra',
    'chaqueta-piedra-caballero': 'blazer-arena', 'chaqueta-negra-caballero': 'blazer-pizarra',
    'pantalon-navy-caballero': 'pantalon-grafito', 'pantalon-taupe-caballero': 'pantalon-grafito',
    'pantalon-negro-caballero': 'pantalon-grafito', 'pantalon-oliva-caballero': 'pantalon-grafito',
    'pantalon-arena-caballero': 'pantalon-humo'
  };
  const baseId = product => product ? aliases[product.id] || product.id : '';
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
  function sheetCell(image, col, row) {
    const cellW = image.naturalWidth / 3, cellH = image.naturalHeight / 3;
    const result = makeCanvas(cellW, cellH);
    result.getContext('2d').drawImage(image, col * cellW, row * cellH, cellW, cellH, 0, 0, result.width, result.height);
    return result;
  }
  function recolorFromDifference(output, original, reference, swatch) {
    if (!/^#[0-9a-f]{6}$/i.test(swatch || '')) return;
    const parse = index => parseInt(swatch.slice(index, index + 2), 16);
    const tint = [parse(1), parse(3), parse(5)];
    const outputContext = output.getContext('2d', { willReadFrequently: true });
    const originalData = original.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, original.width, original.height);
    const referenceData = reference.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, reference.width, reference.height);
    const result = outputContext.getImageData(0, 0, output.width, output.height);
    for (let i = 0; i < result.data.length; i += 4) {
      const difference = Math.max(
        Math.abs(originalData.data[i] - referenceData.data[i]),
        Math.abs(originalData.data[i + 1] - referenceData.data[i + 1]),
        Math.abs(originalData.data[i + 2] - referenceData.data[i + 2])
      );
      if (difference < 18 || originalData.data[i + 3] < 24) continue;
      const mask = Math.min(.96, Math.max(0, (difference - 14) / 68));
      const luminance = .2126 * originalData.data[i] + .7152 * originalData.data[i + 1] + .0722 * originalData.data[i + 2];
      const shade = Math.min(1.55, Math.max(.28, luminance / 168));
      for (let channel = 0; channel < 3; channel++) {
        const colored = Math.min(255, tint[channel] * shade);
        result.data[i + channel] = result.data[i + channel] * (1 - mask) + colored * mask;
      }
    }
    outputContext.putImageData(result, 0, 0);
  }
  function selection(items, sex) {
    const list = lookProducts(items), m = boot.mannequins.find(m => m.id === sex);
    const standardBody = m?.image === `/assets/mannequin-${sex}.png`;
    const supported = ['female', 'male'].includes(sex) && standardBody && list.every(p => {
      const id = baseId(p), a = approved[id];
      return a && !p.image && p.category === a[0] && Number(p.cell) === a[1] && /^#[0-9a-f]{6}$/i.test(p.swatch || '')
        && !boot.assets.some(a => a.product_id === p.id && a.mannequin_id === sex)
        && (sex === 'female' || !['TOP'].includes(p.category) && !/falda/.test(id));
    });
    const byCategory = Object.fromEntries(list.map(p => [p.category, p]));
    const top = byCategory.TOP, jacket = byCategory.OUTERWEAR, bottom = byCategory.BOTTOM;
    const olive = baseId(top) === 'top-oliva', slate = baseId(jacket) === 'blazer-pizarra';
    const upper = jacket ? (slate ? (top ? (olive ? 8 : 6) : 4) : (top ? (olive ? 7 : 5) : 3)) : top ? (olive ? 2 : 1) : 0;
    const maleIndex = (bottom ? (baseId(bottom) === 'pantalon-humo' ? 2 : 1) : 0) * 3 + (jacket ? (slate ? 2 : 1) : 0);
    const cell = sex === 'male' ? maleIndex : upper;
    return { list, supported, sex, top, jacket, bottom, bag: byCategory.BAG,
      col: cell % 3, row: Math.floor(cell / 3) };
  }
  function renderKey(s) { return [s.sex, s.top, s.jacket, s.bottom].map(p => typeof p === 'string' ? p : `${p?.id || ''}:${p?.swatch || ''}`).join('|'); }
  async function scene(s) {
    const key = renderKey(s); if (sceneCache.has(key)) return sceneCache.get(key);
    const promise = (async () => {
      const bottoms = { 'pantalon-grafito': 'graphite', 'pantalon-humo': 'smoke', 'falda-cacao': 'cacao', 'falda-perla': 'pearl' };
      const file = s.sex === 'male' ? 'studio-male-all.png' : 'studio-female-' + (bottoms[baseId(s.bottom)] || 'bare') + '.png';
      const image = await readSheet('/assets/' + file);
      const original = sheetCell(image, s.col, s.row), output = makeCanvas(original.width, original.height);
      output.getContext('2d').drawImage(original, 0, 0);
      if (s.sex === 'male') {
        if (s.bottom && s.bottom.swatch?.toLowerCase() !== approved[baseId(s.bottom)][2]) {
          recolorFromDifference(output, original, sheetCell(image, s.col, 0), s.bottom.swatch);
        }
        if (s.jacket && s.jacket.swatch?.toLowerCase() !== approved[baseId(s.jacket)][2]) {
          recolorFromDifference(output, original, sheetCell(image, 0, s.row), s.jacket.swatch);
        }
      } else {
        if (s.bottom && s.bottom.swatch?.toLowerCase() !== approved[baseId(s.bottom)][2]) {
          const bare = await readSheet('/assets/studio-female-bare.png');
          recolorFromDifference(output, original, sheetCell(bare, s.col, s.row), s.bottom.swatch);
        }
        if (s.jacket && s.jacket.swatch?.toLowerCase() !== approved[baseId(s.jacket)][2]) {
          const topOnly = s.top ? (baseId(s.top) === 'top-oliva' ? 2 : 1) : 0;
          recolorFromDifference(output, original, sheetCell(image, topOnly % 3, Math.floor(topOnly / 3)), s.jacket.swatch);
        }
        if (s.top && s.top.swatch?.toLowerCase() !== approved[baseId(s.top)][2]) {
          const jacketOnly = s.jacket ? (baseId(s.jacket) === 'blazer-pizarra' ? 4 : 3) : 0;
          recolorFromDifference(output, original, sheetCell(image, jacketOnly % 3, Math.floor(jacketOnly / 3)), s.top.swatch);
        }
      }
      return output;
    })();
    sceneCache.set(key, promise);
    promise.catch(() => sceneCache.delete(key));
    return promise;
  }
  realBody = (items = state.equipped, interactive = false) => {
    const s = selection(items, liveMannequin), label = `${s.sex === 'male' ? 'Caballero' : 'Dama'} · ${s.list.map(p => p.name).join(', ') || 'Silueta de estudio'}`;
    if (!s.supported) return automaticRealBody(items, interactive);
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
    const automatic = !!document.querySelector('.precision-body[data-fit-engine="automatic"]');
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = lookProducts().length ? (automatic ? 'Motor automático · ajuste frontal' : 'Tu combinación · vista de estudio') : 'Elige una prenda para ver cómo se lleva';
    const status = document.querySelector('.live-dot'); if (status) status.textContent = automatic ? 'Autoajuste activo' : 'Vista de estudio';
    const note = document.querySelector('.fitting-room > .disclaimer');
    if (note) note.textContent = automatic ? 'La imagen se escala y adapta automáticamente. Consulta las medidas para elegir tu talla.' : 'Imagen ilustrativa de la combinación. Consulta las medidas para elegir tu talla.';
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
