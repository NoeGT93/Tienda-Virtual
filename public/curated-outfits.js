/* Curated full-scene outfits. No garment warping or automatic fitting. */
(() => {
  'use strict';

  const outfits = {
    female: [
      { id: 'outfit-female-01', name: 'Esencial grafito', note: 'Punto marfil · pantalón amplio' },
      { id: 'outfit-female-02', name: 'Oliva serena', note: 'Punto oliva · falda perla' },
      { id: 'outfit-female-03', name: 'Sastrería arena', note: 'Blazer camel · pantalón grafito' },
      { id: 'outfit-female-04', name: 'Cacao fluido', note: 'Blusa marfil · falda cacao' },
      { id: 'outfit-female-05', name: 'Contraste claro', note: 'Blazer camel · pantalón perla' },
      { id: 'outfit-female-06', name: 'Oliva cotidiano', note: 'Camisa taupe · pantalón oliva' },
      { id: 'outfit-female-07', name: 'Marfil tonal', note: 'Vestido de punto · cinturón camel' },
      { id: 'outfit-female-08', name: 'Noche editorial', note: 'Cuello alto · falda grafito' },
      { id: 'outfit-female-09', name: 'Arena suave', note: 'Camisa taupe · pantalón marfil' },
      { id: 'outfit-female-10', name: 'Pizarra oliva', note: 'Blazer pizarra · base oliva' }
    ],
    male: [
      { id: 'outfit-male-01', name: 'Oficina esencial', note: 'Camisa marfil · pantalón grafito' },
      { id: 'outfit-male-02', name: 'Polo taupe', note: 'Polo tejido · pantalón navy' },
      { id: 'outfit-male-03', name: 'Sastrería camel', note: 'Blazer camel · camisa blanca' },
      { id: 'outfit-male-04', name: 'Negro y piedra', note: 'Punto negro · pantalón stone' },
      { id: 'outfit-male-05', name: 'Ejecutivo navy', note: 'Blazer navy · camisa celeste' },
      { id: 'outfit-male-06', name: 'Sobrecamisa oliva', note: 'Oliva · camiseta marfil' },
      { id: 'outfit-male-07', name: 'Tejido arena', note: 'Suéter arena · pantalón cacao' },
      { id: 'outfit-male-08', name: 'Noche total', note: 'Cuello alto · sastrería negra' },
      { id: 'outfit-male-09', name: 'Taupe clásico', note: 'Camisa marfil · pantalón taupe' },
      { id: 'outfit-male-10', name: 'Chaqueta stone', note: 'Polo gris · pantalón negro' }
    ]
  };

  let active = null, initialized = false;
  const sex = () => liveMannequin === 'male' ? 'male' : 'female';
  const label = value => value === 'male' ? 'caballero' : 'dama';
  const matchOutfit = id => /^outfit-(female|male)-(\d{2})$/.exec(id || '');
  const cellStyle = (value, index) => {
    const x = (index % 5) * 25, y = Math.floor(index / 5) * 100;
    return `--outfit-sheet:url('/assets/outfits-${value === 'male' ? 'men' : 'women'}-10.png');--outfit-x:${x}%;--outfit-y:${y}%`;
  };

  function ensureLibrary() {
    const controls = document.querySelector('.mannequin-controls');
    if (!controls || document.querySelector('#outfit-library')) return;
    const section = document.createElement('section');
    section.id = 'outfit-library';
    section.className = 'outfit-library';
    section.setAttribute('aria-label', 'Outfits completos');
    controls.insertAdjacentElement('afterend', section);
  }

  function renderLibrary() {
    ensureLibrary();
    const host = document.querySelector('#outfit-library');
    if (!host) return;
    const current = sex(), list = outfits[current];
    host.innerHTML = `<div class="outfit-library-heading"><div><span>LOOKS LISTOS</span><strong>10 outfits para ${label(current)}</strong></div><small>Desliza para ver todos</small></div><div class="outfit-presets" role="list">${list.map((look, index) => `<button type="button" class="outfit-preset ${active?.sex === current && active.index === index ? 'active' : ''}" data-curated-outfit="${index}" role="listitem" aria-pressed="${active?.sex === current && active.index === index}" aria-label="Ver outfit ${index + 1}: ${safeText(look.name)}"><span class="outfit-thumb" style="${cellStyle(current, index)}"></span><b>${String(index + 1).padStart(2, '0')}</b><span>${safeText(look.name)}</span></button>`).join('')}</div>`;
  }

  function renderScene() {
    if (!active || active.sex !== sex()) return;
    const look = outfits[active.sex][active.index], frame = document.querySelector('#body-frame');
    if (!look || !frame) return;
    frame.className = 'body-frame curated-frame';
    frame.innerHTML = `<div class="curated-scene" style="${cellStyle(active.sex, active.index)}" role="img" aria-label="Outfit ${active.index + 1} para ${label(active.sex)}: ${safeText(look.name)}"></div>`;
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = `${look.name} · ${look.note}`;
    const status = document.querySelector('.live-dot');
    if (status) status.textContent = `10 outfits de ${label(active.sex)}`;
  }

  function syncCatalog(current) {
    state.gender = current === 'male' ? 'Caballeros' : 'Damas';
    const control = document.querySelector('#live-gender');
    if (control) control.value = state.gender;
    renderProducts();
  }

  function choose(index, updateItems = true) {
    const current = sex(), look = outfits[current][index];
    if (!look) return;
    active = { sex: current, index };
    if (updateItems) {
      state.history.push({ ...state.equipped });
      if (state.history.length > 20) state.history.shift();
      state.future = [];
      state.equipped = productById(look.id) ? { OUTFIT: look.id } : {};
    }
    syncCatalog(current);
    renderLook();
  }

  const previousEquip = equip;
  equip = (id, origin) => {
    const match = matchOutfit(id);
    if (match) {
      liveMannequin = match[1];
      active = { sex: match[1], index: Number(match[2]) - 1 };
      choose(active.index);
      return;
    }
    active = null;
    if (state.equipped.OUTFIT) delete state.equipped.OUTFIT;
    previousEquip(id, origin);
  };

  const previousRender = renderLook;
  renderLook = () => {
    if (!active && state.equipped.OUTFIT) {
      const match = matchOutfit(state.equipped.OUTFIT);
      if (match) {
        liveMannequin = match[1];
        active = { sex: match[1], index: Number(match[2]) - 1 };
      }
    }
    if (!initialized && typeof liveReady !== 'undefined' && liveReady) {
      initialized = true;
      active = { sex: sex(), index: 0 };
      const first = outfits[active.sex][0];
      state.equipped = productById(first.id) ? { OUTFIT: first.id } : {};
      syncCatalog(active.sex);
    }
    previousRender();
    renderLibrary();
    renderScene();
  };

  document.addEventListener('click', event => {
    if (event.target.closest('[data-try],[data-remove],#clear,#undo,#redo')) active = null;
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-curated-outfit]');
    if (!button) return;
    choose(Number(button.dataset.curatedOutfit));
  });

  window.addEventListener('lulos:mannequin-change', () => {
    choose(0);
    toast(`Ahora ves 10 outfits para ${label(sex())}.`);
  });
})();
