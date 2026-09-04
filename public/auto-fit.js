/* Local garment analysis for uploads. No external AI service or customer photo is used. */
(() => {
  'use strict';
  const categoryLabels = {
    TOP: 'Camisa / top', BOTTOM: 'Pantalón / falda', OUTERWEAR: 'Chaqueta / blazer',
    DRESS: 'Vestido', BAG: 'Bolso', SHOES: 'Calzado', ACCESSORY: 'Accesorio'
  };
  const nameRules = [
    ['DRESS', /vestido|dress/],
    ['OUTERWEAR', /blazer|chaqueta|abrigo|saco|cazadora|cardigan|sobrecamisa/],
    ['BOTTOM', /pantalon|jean|vaquero|falda|short|bermuda|jogger|legging/],
    ['TOP', /camisa|camiseta|blusa|top|sueter|sweater|jersey|polo/],
    ['BAG', /bolso|cartera|mochila|bag/],
    ['SHOES', /zapato|tenis|bota|sandalia|calzado|shoe/]
  ];
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function classifyName(filename) {
    const name = normalize(filename);
    const category = nameRules.find(([, rule]) => rule.test(name))?.[0] || '';
    const gender = /(?:^|[^a-z])(?:dama|mujer|femenina|woman|women)(?:[^a-z]|$)/.test(name) ? 'Damas'
      : /(?:^|[^a-z])(?:caballero|hombre|masculino|man|men)(?:[^a-z]|$)/.test(name) ? 'Caballeros' : '';
    return { category, gender, confidence: category ? 99 : 0, source: category ? 'nombre del archivo' : '' };
  }
  async function loadBitmap(file) {
    if ('createImageBitmap' in window) return createImageBitmap(file);
    return new Promise((resolve, reject) => {
      const image = new Image(), url = URL.createObjectURL(file);
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(Error('No se pudo leer la fotografía')); };
      image.src = url;
    });
  }
  function hex(rgb) { return '#' + rgb.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join(''); }
  async function analyzeGarment(file, productName = '') {
    const named = classifyName(`${productName} ${file.name}`), bitmap = await loadBitmap(file);
    const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(bitmap.width * scale)), height: Math.max(1, Math.round(bitmap.height * scale)) });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    const image = context.getImageData(0, 0, canvas.width, canvas.height), data = image.data, width = canvas.width, height = canvas.height;
    const corner = Math.max(2, Math.round(Math.min(width, height) * .035));
    const background = [0, 0, 0, 0], cornerPixels = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if ((x < corner || x >= width - corner) && (y < corner || y >= height - corner)) cornerPixels.push((y * width + x) * 4);
    }
    for (const index of cornerPixels) for (let channel = 0; channel < 4; channel++) background[channel] += data[index + channel];
    for (let channel = 0; channel < 4; channel++) background[channel] /= Math.max(1, cornerPixels.length);
    const isForeground = index => {
      const alpha = data[index + 3]; if (alpha < 24) return false;
      if (background[3] < 80) return alpha > 45;
      const distance = Math.hypot(data[index] - background[0], data[index + 1] - background[1], data[index + 2] - background[2]);
      return distance > 48 || Math.abs(alpha - background[3]) > 45;
    };
    let left = width, right = 0, top = height, bottom = 0, count = 0, red = 0, green = 0, blue = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4; if (!isForeground(index)) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++;
    }
    if (!count || right <= left || bottom <= top) return { ...named, swatch: '', warning: 'Usa un fondo transparente o liso con margen alrededor de la prenda.' };
    const boxWidth = right - left + 1, boxHeight = bottom - top + 1, aspect = boxHeight / boxWidth;
    let gapPixels = 0, gapForeground = 0;
    const gapLeft = Math.round(left + boxWidth * .43), gapRight = Math.round(left + boxWidth * .57), gapTop = Math.round(top + boxHeight * .52);
    for (let y = gapTop; y <= bottom; y++) for (let x = gapLeft; x <= gapRight; x++) {
      gapPixels++; if (isForeground((y * width + x) * 4)) gapForeground++;
    }
    const centerFill = gapForeground / Math.max(1, gapPixels), fill = count / (boxWidth * boxHeight);
    let category = named.category, confidence = named.confidence, source = named.source;
    if (!category) {
      if (aspect > 1.08 && centerFill < .24) { category = 'BOTTOM'; confidence = 84; }
      else if (aspect > 1.48) { category = 'DRESS'; confidence = 72; }
      else if (aspect < .72 && fill < .72) { category = 'BAG'; confidence = 64; }
      else { category = 'TOP'; confidence = 58; }
      source = 'silueta de la prenda';
    }
    return { category, gender: named.gender, confidence, source, swatch: hex([red / count, green / count, blue / count]), warning: confidence < 70 ? 'Revisa la categoría sugerida antes de guardar.' : '' };
  }
  function addUploadGuide() {
    const form = document.querySelector('[data-live="product"]'); if (!form || form.querySelector('.auto-fit-guide')) return;
    const upload = form.querySelector('[data-live-upload="image"]'); if (!upload) return;
    upload.closest('label')?.classList.add('field-wide', 'auto-fit-upload');
    const guide = document.createElement('div'); guide.className = 'auto-fit-guide field-wide';
    guide.innerHTML = '<div><strong>Motor de autoajuste</strong><p>Sube una vista frontal completa. PNG o WebP transparente ofrece el mejor resultado; también acepta JPG con fondo liso.</p></div><ol><li><b>10</b>Pantalón / falda</li><li><b>20</b>Camisa / vestido</li><li><b>30</b>Chaqueta / blazer</li><li><b>40</b>Bolso / accesorio</li></ol><p class="auto-fit-file">Nombre recomendado: <code>camisa-dama-lino-marfil.png</code></p><output class="auto-fit-status" aria-live="polite">Selecciona una fotografía para analizarla.</output>';
    upload.closest('label').after(guide);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-live-product]')) setTimeout(addUploadGuide);
  }, true);
  new MutationObserver(addUploadGuide).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', async event => {
    const input = event.target.closest('[data-live-upload="image"]'), form = input?.closest('[data-live="product"]');
    if (!input || !form || !input.files?.[0]) return;
    const file = input.files[0], status = form.querySelector('.auto-fit-status');
    if (status) status.textContent = 'Analizando fondo, forma y proporciones…';
    try {
      const result = await analyzeGarment(file, form.elements.name?.value);
      if (result.category) form.elements.category.value = result.category;
      if (result.gender) form.elements.gender.value = result.gender;
      if (result.swatch) form.elements.swatch.value = result.swatch;
      if (status) status.textContent = `Detectado: ${categoryLabels[result.category] || result.category}${result.gender ? ` · ${result.gender}` : ''} · confianza ${result.confidence}% (${result.source}). ${result.warning}`.trim();
      form.dataset.autoFit = result.category || '';
    } catch (error) {
      if (status) status.textContent = `No se pudo analizar automáticamente. Elige la categoría manualmente. ${error.message}`;
    }
  }, true);
  document.documentElement.dataset.fitEngine = '1.0';
  window.LulosFitEngine = Object.freeze({ version: '1.0', classifyName, analyzeGarment, layerOrder: Object.freeze({ BOTTOM: 10, TOP: 20, DRESS: 20, SHOES: 20, OUTERWEAR: 30, BAG: 40, ACCESSORY: 40 }) });
})();
