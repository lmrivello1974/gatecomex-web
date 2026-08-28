// Lee products.csv y arma el catálogo de la categoría indicada.
// Uso: en cada página de categoría, llamar a initCatalog('pisos-ceramicos') / initCatalog('revestimientos') / initCatalog('flotantes')

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length === headers.length).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (r[idx] || '').trim());
    return obj;
  });
}

function waLink(nombre) {
  const msg = encodeURIComponent('Hola, quiero consultar por ' + nombre);
  return 'https://api.whatsapp.com/send/?phone=5492914768778&text=' + msg;
}

function productCard(p) {
  const fotos = [p.foto1, p.foto2, p.foto3].filter(Boolean);
  const specs = (p.especificaciones || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const dots = fotos.map((f, i) => `<button class="dot ${i === 0 ? 'active' : ''}" data-idx="${i}" aria-label="Foto ${i+1}"></button>`).join('');
  const imgs = fotos.map((f, i) => `<img src="images/productos/${f}" data-file="${f}" alt="${p.nombre}" class="${i === 0 ? 'active' : ''}" loading="lazy">`).join('');

  return `
  <div class="prod-card" data-tipologia="${p['tipología'] || ''}" data-formato="${p.formato || ''}" data-subcategoria="${p.subcategoria || ''}">
    ${p.subcategoria ? `<span class="prod-subcat">${p.subcategoria}</span>` : ''}
    <div class="prod-photo">
      ${imgs}
      ${fotos.length > 1 ? `<div class="prod-dots">${dots}</div>` : ''}
    </div>
    <div class="prod-info">
      <h3>${p.nombre}</h3>
      <div class="spec-plate"><span>${p.formato}</span><span>${p.terminacion}</span><span>${p.uso}</span></div>
      ${specs.length ? `<ul class="spec-list">${specs.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
      <a class="prod-cta" href="${waLink(p.nombre)}" target="_blank">Consultar por WhatsApp →</a>
    </div>
  </div>`;
}

// LIGHTBOX: ampliar fotos al hacer clic
let lightboxState = { fotos: [], idx: 0 };

function ensureLightbox() {
  if (document.getElementById('lightbox')) return;
  const div = document.createElement('div');
  div.id = 'lightbox';
  div.className = 'lightbox';
  div.innerHTML = `
    <button class="lb-close" aria-label="Cerrar">&times;</button>
    <button class="lb-prev" aria-label="Anterior">&#8249;</button>
    <img class="lb-img" src="" alt="">
    <button class="lb-next" aria-label="Siguiente">&#8250;</button>
  `;
  document.body.appendChild(div);

  div.querySelector('.lb-close').addEventListener('click', closeLightbox);
  div.addEventListener('click', (e) => { if (e.target === div) closeLightbox(); });
  div.querySelector('.lb-prev').addEventListener('click', () => moveLightbox(-1));
  div.querySelector('.lb-next').addEventListener('click', () => moveLightbox(1));
  document.addEventListener('keydown', (e) => {
    if (!div.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') moveLightbox(-1);
    if (e.key === 'ArrowRight') moveLightbox(1);
  });
}

function openLightbox(fotos, startIdx) {
  ensureLightbox();
  lightboxState = { fotos, idx: startIdx };
  updateLightboxImg();
  const div = document.getElementById('lightbox');
  div.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const div = document.getElementById('lightbox');
  if (div) div.classList.remove('open');
  document.body.style.overflow = '';
}

function moveLightbox(delta) {
  const { fotos } = lightboxState;
  lightboxState.idx = (lightboxState.idx + delta + fotos.length) % fotos.length;
  updateLightboxImg();
}

function updateLightboxImg() {
  const { fotos, idx } = lightboxState;
  const img = document.querySelector('#lightbox .lb-img');
  img.src = 'images/productos/' + fotos[idx];
  const nav = document.querySelectorAll('#lightbox .lb-prev, #lightbox .lb-next');
  nav.forEach(b => b.style.display = fotos.length > 1 ? 'flex' : 'none');
}

async function initCatalog(categoria) {
  const grid = document.getElementById('catalogGrid');
  const filterBar = document.getElementById('filterBar'); // filtro por tipología/estilo
  const formatoBar = document.getElementById('formatoFilterBar'); // filtro por medida
  const subFilterBar = document.getElementById('subFilterBar'); // puede no existir en categorías sin subcategoría
  const empty = document.getElementById('catalogEmpty');
  if (!grid) return;

  let all;
  try {
    const res = await fetch('products.csv?v=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    all = parseCSV(text).filter(p => p.categoria === categoria);
  } catch (e) {
    grid.innerHTML = '<p class="catalog-empty" style="display:block;">No se pudo cargar el catálogo. Reintentá recargando la página.</p>';
    return;
  }

  if (!all.length) {
    grid.innerHTML = '';
    if (subFilterBar) subFilterBar.innerHTML = '';
    filterBar.innerHTML = '';
    if (formatoBar) formatoBar.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  const state = { sub: 'todas', tipologia: 'todos', formato: 'todos' };

  // Subcategoría (ej: Porcelanatos / Gres Cerámicos) — solo si hay más de un valor distinto
  const subValores = [...new Set(all.map(p => p.subcategoria).filter(Boolean))];
  if (subFilterBar) {
    if (subValores.length > 1) {
      subFilterBar.innerHTML = '<button class="filter-chip active" data-sub="todas">Todas</button>' +
        subValores.map(v => `<button class="filter-chip" data-sub="${v}">${v}</button>`).join('');
    } else {
      subFilterBar.innerHTML = '';
    }
  }

  grid.innerHTML = all.map(productCard).join('');
  const cards = grid.querySelectorAll('.prod-card');

  function renderFacetBars() {
    const visibles = state.sub === 'todas' ? all : all.filter(p => p.subcategoria === state.sub);

    const tipValores = [...new Set(visibles.map(p => p['tipología']).filter(Boolean))];
    filterBar.innerHTML = '<button class="filter-chip active" data-tip="todos">Todos</button>' +
      tipValores.map(v => `<button class="filter-chip" data-tip="${v}">${v}</button>`).join('');
    state.tipologia = 'todos';
    bindFacetChips(filterBar, 'tip', 'tipologia');

    if (formatoBar) {
      const formValores = [...new Set(visibles.map(p => p.formato).filter(Boolean))];
      formatoBar.innerHTML = '<button class="filter-chip active" data-form="todos">Todas las medidas</button>' +
        formValores.map(v => `<button class="filter-chip" data-form="${v}">${v}</button>`).join('');
      state.formato = 'todos';
      bindFacetChips(formatoBar, 'form', 'formato');
    }
  }

  function applyFilters() {
    let visible = 0;
    cards.forEach(card => {
      const matchSub = state.sub === 'todas' || card.dataset.subcategoria === state.sub;
      const matchTip = state.tipologia === 'todos' || card.dataset.tipologia === state.tipologia;
      const matchForm = state.formato === 'todos' || card.dataset.formato === state.formato;
      const match = matchSub && matchTip && matchForm;
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });
    empty.style.display = visible === 0 ? 'block' : 'none';
  }

  function bindFacetChips(bar, dataKey, stateKey) {
    bar.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        bar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state[stateKey] = chip.dataset[dataKey];
        applyFilters();
      });
    });
  }

  if (subFilterBar) {
    subFilterBar.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        subFilterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.sub = chip.dataset.sub;
        renderFacetBars();
        applyFilters();
      });
    });
  }

  renderFacetBars();
  applyFilters();

  // Carruseles: click en los puntitos cambia la foto activa
  grid.querySelectorAll('.prod-photo').forEach(photoBox => {
    const imgs = photoBox.querySelectorAll('img');
    const fotos = [...imgs].map(im => im.dataset.file);
    photoBox.querySelectorAll('.dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = +dot.dataset.idx;
        imgs.forEach((im, i) => im.classList.toggle('active', i === idx));
        photoBox.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      });
    });
    photoBox.addEventListener('click', () => {
      const activeIdx = [...imgs].findIndex(im => im.classList.contains('active'));
      openLightbox(fotos, activeIdx < 0 ? 0 : activeIdx);
    });
  });
}
