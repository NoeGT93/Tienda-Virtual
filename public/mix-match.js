/* Dynamic mix-and-match studio: individual garments drive complete, stable scenes. */
(() => {
  'use strict';

  const matcher = /^mix-(female|male)-(upper|bottom)-(\d{2})$/;
  let initialized = false;

  const parse = product => {
    const match = matcher.exec(product?.id || '');
    return match ? { sex: match[1], slot: match[2], index: Number(match[3]) - 1 } : null;
  };
  const collection = sex => sex === 'male' ? 'Caballeros' : 'Damas';
  const collectionLabel = sex => sex === 'male' ? 'caballero' : 'dama';
  const mixProducts = (sex, slot) => products.filter(product => {
    const meta = parse(product);
    return meta?.sex === sex && meta.slot === slot;
  }).sort((a, b) => parse(a).index - parse(b).index);
  const mixSelection = (items = state.equipped) => {
    const selected = lookProducts(items).map(product => ({ product, meta: parse(product) })).filter(item => item.meta);
    return {
      upper: selected.find(item => item.meta.slot === 'upper'),
      bottom: selected.find(item => item.meta.slot === 'bottom')
    };
  };
  const selectedMix = () => mixSelection();
  const sceneData = items => {
    const chosen = mixSelection(items), upper = chosen.upper, bottom = chosen.bottom;
    if (!upper || !bottom || upper.meta.sex !== bottom.meta.sex) return null;
    const cell = bottom.meta.index * 5 + upper.meta.index;
    return { upper, bottom, x: (cell % 5) * 25, y: Math.floor(cell / 5) * 50 };
  };

  function syncCatalog(sex) {
    state.gender = collection(sex);
    const control = document.querySelector('#live-gender');
    if (control) control.value = state.gender;
    document.querySelectorAll('[data-gender]').forEach(button => button.classList.toggle('active', button.dataset.gender === state.gender));
    renderProducts();
  }

  function animateChoice(product, origin) {
    if (!origin || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const source = origin.closest('.product-image, .mix-option') || origin;
    const stage = document.querySelector('#stage');
    const start = source.getBoundingClientRect();
    if (!stage || !start.width || !start.height) return;
    const end = stage.getBoundingClientRect(), meta = parse(product);
    const targetX = end.left + end.width / 2;
    const targetY = end.top + end.height * (meta?.slot === 'bottom' ? .67 : .37);
    const dx = targetX - (start.left + start.width / 2);
    const dy = targetY - (start.top + start.height / 2);
    const scale = Math.max(.22, Math.min(.58, end.width * .24 / start.width));
    const flyer = document.createElement('div');
    flyer.className = 'sprite mix-flyer';
    flyer.setAttribute('aria-hidden', 'true');
    flyer.style.cssText = `${spriteStyle(product)};left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px`;
    document.body.append(flyer);
    stage.classList.remove('mix-stage-active');
    void stage.offsetWidth;
    stage.classList.add('mix-stage-active');
    const turn = meta?.slot === 'bottom' ? 4 : -6;
    const motion = flyer.animate([
      { transform: 'translate3d(0,0,0) scale(1) rotate(0)', opacity: .96, filter: 'blur(0)' },
      { transform: `translate3d(${dx * .48}px,${dy * .32 - 58}px,0) scale(${Math.max(scale, .56)}) rotate(${turn}deg)`, opacity: .92, offset: .52 },
      { transform: `translate3d(${dx}px,${dy}px,0) scale(${scale}) rotate(0)`, opacity: .04, filter: 'blur(.8px)' }
    ], { duration: 780, easing: 'cubic-bezier(.22,1,.36,1)' });
    motion.finished.finally(() => flyer.remove());
    setTimeout(() => stage.classList.remove('mix-stage-active'), 900);
  }

  function buildLook(product, announce = true, origin = null) {
    const meta = parse(product);
    if (!meta) return;
    animateChoice(product, origin);
    liveMannequin = meta.sex;
    const upper = mixProducts(meta.sex, 'upper');
    const bottoms = mixProducts(meta.sex, 'bottom');
    const current = selectedMix();
    const nextUpper = meta.slot === 'upper' ? product : current.upper?.meta.sex === meta.sex ? current.upper.product : upper[0];
    const nextBottom = meta.slot === 'bottom' ? product : current.bottom?.meta.sex === meta.sex ? current.bottom.product : bottoms[0];
    const next = {};
    if (nextUpper) next[nextUpper.category] = nextUpper.id;
    if (nextBottom) next.BOTTOM = nextBottom.id;
    commitLook(next);
    syncCatalog(meta.sex);
    if (announce) toast(`${product.name} · combinación actualizada`);
    if (typeof request === 'function' && csrf) request('/events', 'POST', { type: 'garment_tried', productId: product.id }).catch(() => {});
  }

  function chooseDefault(sex, announce = false) {
    const upper = mixProducts(sex, 'upper')[0], bottom = mixProducts(sex, 'bottom')[0];
    if (!upper || !bottom) return;
    liveMannequin = sex;
    const next = { [upper.category]: upper.id, BOTTOM: bottom.id };
    commitLook(next);
    syncCatalog(sex);
    if (announce) toast(`Crea hasta 15 combinaciones para ${collectionLabel(sex)}.`);
  }

  function ensureBuilder() {
    const controls = document.querySelector('.mannequin-controls');
    if (!controls || document.querySelector('#mix-builder')) return;
    controls.insertAdjacentHTML('afterend', '<section id="mix-builder" class="mix-builder" aria-label="Creador de combinaciones"></section>');
  }

  function renderBuilder() {
    ensureBuilder();
    const host = document.querySelector('#mix-builder');
    if (!host) return;
    const sex = liveMannequin === 'male' ? 'male' : 'female', current = selectedMix();
    const strip = (slot, title) => { const list = mixProducts(sex, slot), position = (current[slot]?.meta.index ?? 0) + 1; return `<div class="mix-row"><div class="mix-row-title"><span>${title}</span><small>${position} de ${list.length}</small></div><div class="mix-options">${list.map(product => `<button type="button" data-mix-choice="${product.id}" class="mix-option ${current[slot]?.product.id === product.id ? 'active' : ''}" aria-pressed="${current[slot]?.product.id === product.id}" aria-label="Combinar ${safeText(product.name)}" title="${safeText(product.name)}">${imageMarkup(product)}<span>${safeText(product.name)}</span></button>`).join('')}</div></div>`; };
    host.innerHTML = `<div class="mix-heading"><div><span>CREA TU LOOK</span><strong>Elige una pieza de cada fila</strong></div><b>5 × 3 = 15</b></div>${strip('upper', 'Parte superior')}${strip('bottom', 'Parte inferior')}<p>La vista cambia al instante. El maniquí y la pose permanecen iguales.</p>`;
  }

  function renderScene() {
    const chosen = selectedMix(), frame = document.querySelector('#body-frame');
    if (!frame) return;
    const upper = chosen.upper, bottom = chosen.bottom;
    if (!upper || !bottom || upper.meta.sex !== bottom.meta.sex) {
      const sex = upper?.meta.sex || bottom?.meta.sex || (liveMannequin === 'male' ? 'male' : 'female');
      frame.className = 'body-frame mix-incomplete-frame';
      frame.innerHTML = `<div class="mix-incomplete"><img src="/assets/mannequin-${sex}.png" alt="Maniquí fijo para ${collectionLabel(sex)}"></div>`;
      const caption = document.querySelector('#stage-caption');
      if (caption) caption.textContent = `Elige ${upper ? 'una parte inferior' : 'una parte superior'} para completar tu look`;
      return;
    }
    const data = sceneData(state.equipped);
    frame.className = 'body-frame mix-scene-frame';
    frame.innerHTML = `<div class="mix-scene" style="--mix-sheet:url('/assets/mix-${upper.meta.sex}-scenes.png');--mix-x:${data.x}%;--mix-y:${data.y}%" role="img" aria-label="${safeText(upper.product.name)} con ${safeText(bottom.product.name)}"></div>`;
    const caption = document.querySelector('#stage-caption');
    if (caption) caption.textContent = `${upper.product.name} · ${bottom.product.name}`;
    const status = document.querySelector('.live-dot');
    if (status) status.textContent = 'Combinación en vivo';
  }

  const previousEquip = equip;
  equip = (id, origin) => {
    const product = productById(id);
    if (parse(product)) return buildLook(product, true, origin);
    previousEquip(id, origin);
  };

  const previousOutfitVisual = outfitVisual;
  outfitVisual = (items = state.equipped) => {
    const data = sceneData(items);
    if (!data) return previousOutfitVisual(items);
    return `<div class="real-body mix-static"><div class="mix-scene" style="--mix-sheet:url('/assets/mix-${data.upper.meta.sex}-scenes.png');--mix-x:${data.x}%;--mix-y:${data.y}%" role="img" aria-label="${safeText(data.upper.product.name)} con ${safeText(data.bottom.product.name)}"></div></div>`;
  };

  const previousRender = renderLook;
  renderLook = () => {
    if (!initialized && typeof liveReady !== 'undefined' && liveReady) {
      initialized = true;
      const initialSex = liveMannequin === 'male' ? 'male' : 'female';
      const upper = mixProducts(initialSex, 'upper')[0], bottom = mixProducts(initialSex, 'bottom')[0];
      state.equipped = upper && bottom ? { [upper.category]: upper.id, BOTTOM: bottom.id } : {};
      syncCatalog(initialSex);
    }
    const restored = selectedMix().upper || selectedMix().bottom;
    if (restored && restored.meta.sex !== liveMannequin) {
      liveMannequin = restored.meta.sex;
      syncCatalog(restored.meta.sex);
    }
    previousRender();
    renderBuilder();
    renderScene();
  };

  document.addEventListener('click', event => {
    const choice = event.target.closest('[data-mix-choice]');
    if (choice) {
      event.preventDefault();
      buildLook(productById(choice.dataset.mixChoice), true, choice);
      return;
    }
    const gender = event.target.closest('[data-gender]');
    if (gender && ['Damas', 'Caballeros'].includes(gender.dataset.gender)) {
      chooseDefault(gender.dataset.gender === 'Caballeros' ? 'male' : 'female');
    }
  });

  window.addEventListener('lulos:mannequin-change', event => {
    chooseDefault(event.detail?.id === 'male' ? 'male' : 'female', true);
  });

  document.addEventListener('change', event => {
    if (event.target.id !== 'live-gender' || !['Damas', 'Caballeros'].includes(event.target.value)) return;
    const sex = event.target.value === 'Caballeros' ? 'male' : 'female';
    if (sex !== liveMannequin) chooseDefault(sex, true);
  });
})();
