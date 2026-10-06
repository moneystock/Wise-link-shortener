/**
 * WiseLinks - Frontend Application (Vanilla JS ES Modules)
 * Plataforma de Acortamiento de Enlaces & Analítica Multi-Workspace
 */

// Estado global de la aplicación
const state = {
  currentWorkspace: 'wise', // 'wise' | 'onclusive' | 'all'
  links: [],
  chartInstance: null,
  activeQrModalLink: null,
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();
  updateWorkspaceUI();
  updateSlugPrefix();
  loadOverviewStats();
  loadLinks();
});

// Función para obtener el workspace seleccionado en el formulario
function getSelectedFormWorkspace() {
  const selectedRadio = document.querySelector('input[name="form-workspace"]:checked');
  if (selectedRadio) return selectedRadio.value;
  return state.currentWorkspace === 'onclusive' ? 'onclusive' : 'wise';
}

// Actualizar el prefijo visual del alias según el workspace / cliente seleccionado
function updateSlugPrefix() {
  const prefixEl = document.getElementById('slug-prefix');
  if (!prefixEl) return;

  const host = window.location.host.toLowerCase();
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    prefixEl.textContent = `${window.location.host}/`;
    return;
  }

  const ws = getSelectedFormWorkspace();
  if (ws === 'onclusive') {
    prefixEl.textContent = 'onclusive.wisemarketing.agency/';
  } else {
    prefixEl.textContent = 'go.wisemarketing.agency/';
  }
}

// ==========================================
// GESTIÓN DE TEMA (CLARO / OSCURO)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('wiselinks_theme') || 'dark';
  applyTheme(savedTheme);

  const themeBtn = document.getElementById('theme-toggle');
  themeBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wiselinks_theme', theme);

  const moonIcon = document.getElementById('moon-icon');
  const sunIcon = document.getElementById('sun-icon');

  if (theme === 'light') {
    moonIcon?.classList.add('hidden');
    sunIcon?.classList.remove('hidden');
  } else {
    moonIcon?.classList.remove('hidden');
    sunIcon?.classList.add('hidden');
  }

  // Refrescar paleta de Chart.js si está activo
  if (state.chartInstance) {
    loadOverviewStats();
  }
}

// ==========================================
// WORKSPACE SWITCHER
// ==========================================
function setWorkspace(ws) {
  state.currentWorkspace = ws;
  updateWorkspaceUI();
  loadLinks();
}

function updateWorkspaceUI() {
  // Botones del switcher
  document.querySelectorAll('.ws-btn').forEach(btn => {
    if (btn.dataset.ws === state.currentWorkspace) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Indicador del formulario
  const formWsIndicator = document.getElementById('form-workspace-name');
  const formWsBadge = document.getElementById('form-workspace-indicator');
  const radioWise = document.querySelector('input[name="form-workspace"][value="wise"]');
  const radioOnclusive = document.querySelector('input[name="form-workspace"][value="onclusive"]');

  if (state.currentWorkspace === 'onclusive') {
    if (formWsIndicator) formWsIndicator.textContent = 'Cliente Onclusive';
    if (radioOnclusive) radioOnclusive.checked = true;
    formWsBadge?.classList.add('onclusive-mode');
  } else {
    if (formWsIndicator) formWsIndicator.textContent = 'Wise Marketing Agency';
    if (radioWise) radioWise.checked = true;
    formWsBadge?.classList.remove('onclusive-mode');
  }
  updateSlugPrefix();
}

// ==========================================
// EVENT LISTENERS & INTERACCIONES
// ==========================================
function setupEventListeners() {
  // Selector de Workspace en cabecera
  document.querySelectorAll('.ws-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setWorkspace(btn.dataset.ws);
    });
  });

  // Radio buttons dentro del formulario de creación
  document.querySelectorAll('input[name="form-workspace"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const formWsIndicator = document.getElementById('form-workspace-name');
      if (formWsIndicator) {
        formWsIndicator.textContent = e.target.value === 'onclusive' 
          ? 'Cliente Onclusive' 
          : 'Wise Marketing Agency';
      }
      updateSlugPrefix();
    });
  });

  // Pegar desde portapapeles
  const pasteBtn = document.getElementById('btn-paste');
  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const input = document.getElementById('original-url');
      if (input && text) {
        input.value = text;
        showToast('URL pegada desde el portapapeles', 'info');
      }
    } catch (err) {
      showToast('No se pudo acceder al portapapeles', 'error');
    }
  });

  // Envío del formulario de acortamiento
  const shortenForm = document.getElementById('shorten-form');
  shortenForm?.addEventListener('submit', handleShortenSubmit);

  // Copiar resultado al portapapeles
  const btnCopyResult = document.getElementById('btn-copy-result');
  btnCopyResult?.addEventListener('click', () => {
    const input = document.getElementById('result-short-url');
    if (input && input.value) {
      copyToClipboard(input.value, btnCopyResult);
    }
  });

  // Descargar QR del resultado
  const btnDownloadQr = document.getElementById('btn-download-qr');
  btnDownloadQr?.addEventListener('click', () => {
    const container = document.getElementById('result-qr-container');
    const slug = document.getElementById('result-short-url').dataset.slug || 'enlace';
    downloadQRCodeFromContainer(container, `wise-qr-${slug}.png`);
  });

  // Búsqueda en vivo en la tabla
  const searchInput = document.getElementById('search-input');
  searchInput?.addEventListener('input', (e) => {
    filterTable(e.target.value);
  });

  // Botón refrescar tabla
  const btnRefresh = document.getElementById('btn-refresh-table');
  btnRefresh?.addEventListener('click', () => {
    loadLinks();
    loadOverviewStats();
    showToast('Datos actualizados', 'info');
  });

  // Toggle de la gráfica
  const btnToggleChart = document.getElementById('btn-toggle-chart');
  btnToggleChart?.addEventListener('click', () => {
    const container = document.getElementById('chart-container');
    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      btnToggleChart.textContent = 'Ocultar Gráfica';
    } else {
      container.classList.add('hidden');
      btnToggleChart.textContent = 'Mostrar Gráfica';
    }
  });

  // Modales - Cerrar botones
  document.getElementById('btn-close-qr-modal')?.addEventListener('click', closeModals);
  document.getElementById('btn-close-stats-modal')?.addEventListener('click', closeModals);

  // Cerrar modal al hacer clic en el fondo o presionar Escape
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModals();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModals();
  });

  // Descargar QR desde el modal
  document.getElementById('btn-download-modal-qr')?.addEventListener('click', () => {
    const container = document.getElementById('modal-qr-container');
    const slug = state.activeQrModalLink?.short_code || 'enlace';
    downloadQRCodeFromContainer(container, `wise-qr-${slug}.png`);
  });
}

function closeModals() {
  document.getElementById('qr-modal')?.classList.add('hidden');
  document.getElementById('stats-modal')?.classList.add('hidden');
}

// ==========================================
// ENVÍO DE FORMULARIO (POST /api/links)
// ==========================================
async function handleShortenSubmit(e) {
  e.preventDefault();

  const originalUrlInput = document.getElementById('original-url');
  const customSlugInput = document.getElementById('custom-slug');
  const workspaceInput = document.querySelector('input[name="form-workspace"]:checked');
  const expiresAtInput = document.getElementById('expires-at');
  const submitBtn = document.getElementById('btn-submit');
  const spinner = document.getElementById('submit-spinner');

  const originalUrl = originalUrlInput.value.trim();
  const shortCode = customSlugInput.value.trim();
  const workspace = workspaceInput ? workspaceInput.value : 'wise';
  const expiresAt = expiresAtInput.value || null;

  if (!originalUrl) {
    showToast('Por favor ingrese una URL válida.', 'error');
    originalUrlInput.focus();
    return;
  }

  // Estado de carga
  submitBtn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    const response = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_url: originalUrl,
        short_code: shortCode || undefined,
        workspace,
        expires_at: expiresAt
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Ocurrió un error al procesar el enlace.');
    }

    // Éxito: Mostrar resultado y generar QR
    displayResult(data.data);
    showToast('¡Enlace acortado y código QR listos!', 'success');

    // Limpiar formulario excepto workspace
    originalUrlInput.value = '';
    customSlugInput.value = '';
    expiresAtInput.value = '';

    // Recargar tabla y métricas
    loadLinks();
    loadOverviewStats();

  } catch (error) {
    console.error('Error al acortar URL:', error);
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ==========================================
// RESULTADO INMEDIATO & CÓDIGO QR
// ==========================================
function displayResult(link) {
  const resultCard = document.getElementById('result-card');
  const shortUrlInput = document.getElementById('result-short-url');
  const originalUrlSpan = document.getElementById('result-original-url');
  const visitBtn = document.getElementById('btn-visit-result');
  const tagSpan = document.getElementById('result-workspace-tag');
  const qrContainer = document.getElementById('result-qr-container');

  shortUrlInput.value = link.short_url;
  shortUrlInput.dataset.slug = link.short_code;
  originalUrlSpan.textContent = link.original_url;
  originalUrlSpan.title = link.original_url;
  visitBtn.href = link.short_url;

  tagSpan.textContent = link.workspace.toUpperCase();
  if (link.workspace === 'onclusive') {
    tagSpan.className = 'result-tag onclusive';
  } else {
    tagSpan.className = 'result-tag';
  }

  // Generar código QR dinámico
  renderQRCode(qrContainer, link.short_url, 130);

  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Función para renderizar código QR usando QRCode.js con respaldo seguro
function renderQRCode(container, text, size = 140) {
  if (!container) return;
  container.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(container, {
        text: text,
        width: size,
        height: size,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      return;
    } catch (e) {
      console.warn('QRCode library error, using fallback:', e);
    }
  }

  // Fallback visual si el CDN aún no ha cargado o está offline
  const fallbackImg = document.createElement('img');
  fallbackImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
  fallbackImg.alt = 'Código QR';
  fallbackImg.width = size;
  fallbackImg.height = size;
  container.appendChild(fallbackImg);
}

// Descargar QR como archivo PNG
function downloadQRCodeFromContainer(container, filename = 'qr-code.png') {
  if (!container) return;

  const canvas = container.querySelector('canvas');
  if (canvas) {
    const dataUrl = canvas.toDataURL('image/png');
    triggerDownload(dataUrl, filename);
    showToast('Código QR descargado', 'success');
    return;
  }

  const img = container.querySelector('img');
  if (img && img.src) {
    // Si es un SVG o imagen en base64
    if (img.src.startsWith('data:')) {
      triggerDownload(img.src, filename);
      showToast('Código QR descargado', 'success');
    } else {
      // Descarga remota
      fetch(img.src)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename);
          URL.revokeObjectURL(url);
          showToast('Código QR descargado', 'success');
        })
        .catch(() => showToast('Error al descargar el código QR', 'error'));
    }
  }
}

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==========================================
// GESTIÓN DE LA TABLA DE ENLACES
// ==========================================
async function loadLinks() {
  const tbody = document.getElementById('links-table-body');
  const countBadge = document.getElementById('table-count-badge');

  try {
    let url = '/api/links';
    if (state.currentWorkspace !== 'all') {
      url += `?workspace=${state.currentWorkspace}`;
    }

    const res = await fetch(url);
    const result = await res.json();

    if (!res.ok || !result.success) {
      throw new Error(result.error || 'No se pudieron cargar los enlaces.');
    }

    state.links = result.data;
    renderLinksTable(state.links);

    if (countBadge) {
      countBadge.textContent = `${state.links.length} ${state.links.length === 1 ? 'enlace' : 'enlaces'}`;
    }

  } catch (error) {
    console.error('Error al cargar enlaces:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          Error al conectar con la base de datos local. Verifique que el servidor esté activo.
        </td>
      </tr>
    `;
  }
}

function renderLinksTable(links) {
  const tbody = document.getElementById('links-table-body');
  if (!tbody) return;

  if (links.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No hay enlaces registrados para este espacio de trabajo. ¡Crea el primero arriba!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = links.map(link => {
    const formattedDate = formatDate(link.created_at);
    const wsClass = link.workspace === 'onclusive' ? 'onclusive' : 'wise';
    const wsLabel = link.workspace === 'onclusive' ? 'Onclusive' : 'Wise Agency';
    const hasClicksClass = link.clicks_count > 0 ? 'has-clicks' : '';

    return `
      <tr data-id="${link.id}">
        <td>
          <div class="short-link-cell">
            <a href="${escapeHtml(link.short_url)}" target="_blank" class="short-link-anchor" title="Abrir enlace">
              /${escapeHtml(link.short_code)}
            </a>
            <button type="button" class="btn-table-copy" data-url="${escapeHtml(link.short_url)}" title="Copiar enlace">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </td>
        <td>
          <div class="dest-url-cell" title="${escapeHtml(link.original_url)}">
            ${escapeHtml(link.original_url)}
          </div>
        </td>
        <td>
          <span class="ws-badge ${wsClass}">
            <span class="ws-indicator ws-${wsClass}-dot"></span>
            ${wsLabel}
          </span>
        </td>
        <td>
          <span class="clicks-pill ${hasClicksClass}" title="Total de redirecciones">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            ${link.clicks_count}
          </span>
        </td>
        <td>
          <span class="mono-text" style="font-size:0.75rem;">${formattedDate}</span>
        </td>
        <td class="th-actions">
          <div class="table-actions">
            <button class="action-btn btn-view-qr" data-id="${link.id}" title="Ver Código QR">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button class="action-btn btn-view-stats" data-id="${link.id}" title="Ver Analítica y Registro de Clics">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20V10"></path>
                <path d="M18 20V4"></path>
                <path d="M6 20v-4"></path>
              </svg>
            </button>
            <button class="action-btn delete-btn btn-delete-link" data-id="${link.id}" data-slug="${escapeHtml(link.short_code)}" title="Eliminar enlace">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Asociar eventos a los botones de la tabla
  attachTableEvents();
}

function attachTableEvents() {
  // Botones de copiar dentro de cada fila
  document.querySelectorAll('.btn-table-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      copyToClipboard(url, btn);
    });
  });

  // Botón Ver QR
  document.querySelectorAll('.btn-view-qr').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const link = state.links.find(l => l.id === id);
      if (link) openQrModal(link);
    });
  });

  // Botón Ver Analítica
  document.querySelectorAll('.btn-view-stats').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      openStatsModal(id);
    });
  });

  // Botón Eliminar
  document.querySelectorAll('.btn-delete-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const slug = btn.dataset.slug;
      confirmDeleteLink(id, slug);
    });
  });
}

function filterTable(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderLinksTable(state.links);
    return;
  }

  const filtered = state.links.filter(l => 
    l.short_code.toLowerCase().includes(q) ||
    l.original_url.toLowerCase().includes(q) ||
    l.workspace.toLowerCase().includes(q)
  );

  renderLinksTable(filtered);
}

// Eliminar un enlace
async function confirmDeleteLink(id, slug) {
  const confirmed = window.confirm(`¿Está seguro de que desea eliminar el enlace /${slug}? Esta acción es irreversible.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'No se pudo eliminar el enlace.');
    }

    showToast(`Enlace /${slug} eliminado exitosamente`, 'info');
    loadLinks();
    loadOverviewStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// MODALES: QR & AUDITORÍA DE CLICS
// ==========================================
function openQrModal(link) {
  state.activeQrModalLink = link;
  const modal = document.getElementById('qr-modal');
  const title = document.getElementById('qr-modal-title');
  const urlEl = document.getElementById('qr-modal-url');
  const qrBox = document.getElementById('modal-qr-container');

  title.textContent = `Código QR (/${link.short_code})`;
  urlEl.textContent = link.short_url;

  renderQRCode(qrBox, link.short_url, 220);
  modal.classList.remove('hidden');
}

async function openStatsModal(id) {
  const modal = document.getElementById('stats-modal');
  const title = document.getElementById('stats-modal-title');
  const subtitle = document.getElementById('stats-modal-subtitle');
  const clicksCount = document.getElementById('modal-clicks-count');
  const clicksWs = document.getElementById('modal-clicks-ws');
  const logTbody = document.getElementById('clicks-log-body');

  modal.classList.remove('hidden');
  logTbody.innerHTML = `<tr><td colspan="3" class="loading-state">Consultando base de datos SQLite...</td></tr>`;

  try {
    const res = await fetch(`/api/links/${id}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'No se pudo obtener el detalle del enlace.');
    }

    const link = data.data;
    title.textContent = `Auditoría de Clics: /${link.short_code}`;
    subtitle.textContent = link.original_url;
    clicksCount.textContent = link.clicks_count;
    clicksWs.textContent = link.workspace === 'onclusive' ? 'Onclusive' : 'Wise Marketing Agency';

    if (!link.recent_clicks || link.recent_clicks.length === 0) {
      logTbody.innerHTML = `<tr><td colspan="3" class="empty-state">Este enlace aún no ha recibido visitas.</td></tr>`;
      return;
    }

    logTbody.innerHTML = link.recent_clicks.map(click => `
      <tr>
        <td class="mono-text">${formatDate(click.clicked_at)}</td>
        <td class="mono-text">${escapeHtml(click.ip_address || '127.0.0.1')}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(click.user_agent)}">
          ${escapeHtml(click.user_agent || 'N/A')}
        </td>
      </tr>
    `).join('');

  } catch (error) {
    logTbody.innerHTML = `<tr><td colspan="3" class="empty-state">${error.message}</td></tr>`;
  }
}

// ==========================================
// MÉTRICAS Y CHART.JS
// ==========================================
async function loadOverviewStats() {
  try {
    const res = await fetch('/api/stats/overview');
    const data = await res.json();

    if (!res.ok || !data.success) return;

    const { stats } = data;

    // Actualizar métricas visuales del dashboard
    document.getElementById('stat-total-links').textContent = stats.totalLinks;
    document.getElementById('stat-total-clicks').textContent = stats.totalClicks;

    document.getElementById('stat-wise-clicks').textContent = `${stats.workspaces.wise.clicks} clics`;
    document.getElementById('stat-wise-links').textContent = `${stats.workspaces.wise.links} enlaces`;

    document.getElementById('stat-onclusive-clicks').textContent = `${stats.workspaces.onclusive.clicks} clics`;
    document.getElementById('stat-onclusive-links').textContent = `${stats.workspaces.onclusive.links} enlaces`;

    // Renderizar gráfico
    renderChart(stats);

  } catch (err) {
    console.warn('Error al cargar analítica global:', err);
  }
}

function renderChart(stats) {
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('clicksChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';

  // Preparar datos de timeline o distribución por espacio
  let labels = [];
  let values = [];

  if (stats.timeline && stats.timeline.length > 0) {
    labels = stats.timeline.map(t => t.date);
    values = stats.timeline.map(t => t.count);
  } else {
    // Si aún no hay clics en timeline, mostrar distribución por workspace
    labels = ['Wise Marketing', 'Cliente Onclusive'];
    values = [stats.workspaces.wise.clicks, stats.workspaces.onclusive.clicks];
  }

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin datos'],
      datasets: [{
        label: 'Clics registrados',
        data: values.length ? values : [0],
        backgroundColor: isDark ? 'rgba(255, 106, 0, 0.75)' : 'rgba(255, 106, 0, 0.85)',
        borderColor: '#ff6a00',
        borderWidth: 1.5,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#0f172a',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc',
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            stepSize: 1,
            font: { family: 'Plus Jakarta Sans', size: 11 }
          }
        }
      }
    }
  });
}

// ==========================================
// UTILIDADES: COPIAR, FORMATOS, TOASTS
// ==========================================
async function copyToClipboard(text, triggerBtn) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Enlace copiado al portapapeles', 'success');

    if (triggerBtn) {
      const originalHTML = triggerBtn.innerHTML;
      triggerBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style="color:#10b981; font-weight:700;">¡Copiado!</span>
      `;
      setTimeout(() => {
        triggerBtn.innerHTML = originalHTML;
      }, 2200);
    }
  } catch (err) {
    // Fallback con execCommand
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('Enlace copiado al portapapeles', 'success');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  if (type === 'success') {
    icon = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
  } else if (type === 'error') {
    icon = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  }

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
