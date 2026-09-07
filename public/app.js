// State
const state = {
  newsList: [],
  selectedNews: null,
  ratio: '4:5',
  handle: '@ANIREPORT',
  badge: 'OFFICIAL ANNOUNCEMENT',
  badgeColor: '#E50914',
  title: 'Solo Leveling: Arise from the Shadow Season 2 Finale Shatters Global Streaming Records',
  excerpt: 'A-1 Pictures and Aniplex report monumental global viewership as the latest season concludes with groundbreaking action sequences.',
  source: 'Crunchyroll',
  imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&q=80',
  currentLoadedImage: null
};

// DOM Elements
const canvas = document.getElementById('postCanvas');
const ctx = canvas.getContext('2d');

const newsListEl = document.getElementById('newsList');
const searchInput = document.getElementById('searchInput');
const sourceFilter = document.getElementById('sourceFilter');
const newsCountBadge = document.getElementById('newsCountBadge');
const btnRefreshNews = document.getElementById('btnRefreshNews');

const ratioBtns = document.querySelectorAll('.ratio-btn');
const handleInput = document.getElementById('handleInput');
const badgeTextInput = document.getElementById('badgeTextInput');
const colorChips = document.querySelectorAll('.color-chip');
const titleInput = document.getElementById('titleInput');
const excerptInput = document.getElementById('excerptInput');
const sourceInput = document.getElementById('sourceInput');
const imageUrlInput = document.getElementById('imageUrlInput');
const fileUpload = document.getElementById('fileUpload');

const btnDownload = document.getElementById('btnDownload');
const btnCopyCaption = document.getElementById('btnCopyCaption');
const btnResetDefault = document.getElementById('btnResetDefault');
const toastEl = document.getElementById('toast');

const btnOpenApiDocs = document.getElementById('btnOpenApiDocs');
const btnCloseApiDocs = document.getElementById('btnCloseApiDocs');
const apiModal = document.getElementById('apiModal');

/**
 * Initialize Application
 */
async function init() {
  setupEventListeners();
  syncFormWithState();
  await loadNews();
  await updateCanvasImage(state.imageUrl);
  renderCanvas();
}

/**
 * Event Listeners
 */
function setupEventListeners() {
  // Ratio switch
  ratioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ratio = btn.dataset.ratio;
      updateCanvasDimensions();
      renderCanvas();
    });
  });

  // Form Inputs
  handleInput.addEventListener('input', (e) => {
    state.handle = e.target.value.trim() || '@ANIREPORT';
    renderCanvas();
  });

  badgeTextInput.addEventListener('input', (e) => {
    state.badge = e.target.value.trim() || 'NEWS';
    renderCanvas();
  });

  titleInput.addEventListener('input', (e) => {
    state.title = e.target.value || '';
    renderCanvas();
  });

  excerptInput.addEventListener('input', (e) => {
    state.excerpt = e.target.value || '';
    renderCanvas();
  });

  sourceInput.addEventListener('input', (e) => {
    state.source = e.target.value.trim() || 'ANIME NEWS';
    renderCanvas();
  });

  imageUrlInput.addEventListener('change', async (e) => {
    const url = e.target.value.trim();
    if (url) {
      state.imageUrl = url;
      await updateCanvasImage(url);
      renderCanvas();
    }
  });

  // File Upload
  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          state.currentLoadedImage = img;
          renderCanvas();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Color chips
  colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      colorChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.badgeColor = chip.dataset.color;
      renderCanvas();
    });
  });

  // Search & Filter
  searchInput.addEventListener('input', debounce(filterNews, 300));
  sourceFilter.addEventListener('change', filterNews);

  // Buttons
  btnRefreshNews.addEventListener('click', () => loadNews(true));
  btnDownload.addEventListener('click', downloadCanvas);
  btnCopyCaption.addEventListener('click', copyInstagramCaption);
  btnResetDefault.addEventListener('click', resetToDefault);

  // API Docs Modal
  if (btnOpenApiDocs && apiModal) {
    btnOpenApiDocs.addEventListener('click', () => apiModal.classList.add('open'));
  }
  if (btnCloseApiDocs && apiModal) {
    btnCloseApiDocs.addEventListener('click', () => apiModal.classList.remove('open'));
  }
  if (apiModal) {
    apiModal.addEventListener('click', (e) => {
      if (e.target === apiModal) apiModal.classList.remove('open');
    });
  }
}

/**
 * Fetch Anime News from Backend API
 */
async function loadNews(forceRefresh = false) {
  newsListEl.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Fetching real-time news from anime sources...</p>
    </div>
  `;

  try {
    const url = `/api/news?limit=40${forceRefresh ? '&refresh=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'success' && data.data.length > 0) {
      state.newsList = data.data;
      newsCountBadge.textContent = `${data.total} Articles`;
      renderNewsList(state.newsList);

      // Auto-select first news item if state is default
      if (!state.selectedNews && state.newsList.length > 0) {
        selectNewsItem(state.newsList[0]);
      }
    } else {
      newsListEl.innerHTML = `<div class="loading-state"><p>No news articles found.</p></div>`;
    }
  } catch (err) {
    console.error('Failed to load news:', err);
    newsListEl.innerHTML = `<div class="loading-state"><p>Error connecting to news server.</p></div>`;
  }
}

/**
 * Render news list items in sidebar
 */
function renderNewsList(items) {
  if (items.length === 0) {
    newsListEl.innerHTML = `<div class="loading-state"><p>No matching news found.</p></div>`;
    return;
  }

  newsListEl.innerHTML = items.map((item, idx) => `
    <div class="news-item ${state.selectedNews && state.selectedNews.id === item.id ? 'active' : ''}" data-idx="${idx}">
      <img src="${item.image}" alt="thumb" class="news-item-img" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&q=80'">
      <div class="news-item-info">
        <h3 class="news-item-title">${escapeHtml(item.title)}</h3>
        <div class="news-item-meta">
          <span class="source-tag-small">${escapeHtml(item.source)}</span>
          <span>${formatDate(item.date)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Add click listeners to cards
  newsListEl.querySelectorAll('.news-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = el.dataset.idx;
      selectNewsItem(items[idx]);
    });
  });
}

/**
 * Handle selection of a news item
 */
async function selectNewsItem(item) {
  state.selectedNews = item;
  state.title = item.title;
  state.excerpt = item.excerpt || item.title;
  state.source = item.source;
  state.imageUrl = item.image;

  // Auto detect badge from title
  const t = item.title.toLowerCase();
  if (t.includes('trailer') || t.includes('teaser') || t.includes('pv')) {
    state.badge = 'OFFICIAL TRAILER';
    state.badgeColor = '#FF4757';
  } else if (t.includes('release date') || t.includes('premiere')) {
    state.badge = 'RELEASE DATE';
    state.badgeColor = '#FFA502';
  } else if (t.includes('movie') || t.includes('film')) {
    state.badge = 'ANIME MOVIE';
    state.badgeColor = '#9B59B6';
  } else if (t.includes('season') || t.includes('sequel') || t.includes('renewal')) {
    state.badge = 'SEASON ANNOUNCEMENT';
    state.badgeColor = '#2ED573';
  } else {
    state.badge = 'OFFICIAL ANNOUNCEMENT';
    state.badgeColor = '#E50914';
  }

  // Update color chip UI
  colorChips.forEach(chip => {
    if (chip.dataset.color.toLowerCase() === state.badgeColor.toLowerCase()) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  syncFormWithState();
  renderNewsList(state.newsList);

  await updateCanvasImage(item.image);
  renderCanvas();
}

/**
 * Load image for canvas through proxy (to prevent CORS tainting)
 */
async function updateCanvasImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      state.currentLoadedImage = img;
      resolve(img);
    };
    img.onerror = () => {
      // Fallback proxy
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
      const proxyImg = new Image();
      proxyImg.crossOrigin = 'anonymous';
      proxyImg.onload = () => {
        state.currentLoadedImage = proxyImg;
        resolve(proxyImg);
      };
      proxyImg.onerror = () => {
        // Ultimate fallback placeholder
        const fallback = new Image();
        fallback.onload = () => {
          state.currentLoadedImage = fallback;
          resolve(fallback);
        };
        fallback.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&q=80';
      };
      proxyImg.src = proxyUrl;
    };
    img.src = url;
  });
}

/**
 * Update Canvas dimensions based on aspect ratio
 */
function updateCanvasDimensions() {
  if (state.ratio === '1:1') {
    canvas.width = 1080;
    canvas.height = 1080;
  } else if (state.ratio === '9:16') {
    canvas.width = 1080;
    canvas.height = 1920;
  } else {
    // 4:5 default
    canvas.width = 1080;
    canvas.height = 1350;
  }
}

/**
 * Render Instagram Post onto HTML5 Canvas
 */
function renderCanvas() {
  const width = canvas.width;
  const height = canvas.height;

  // Clear
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, width, height);

  // 1. Draw Background Image
  if (state.currentLoadedImage) {
    const img = state.currentLoadedImage;
    const imgAspect = img.width / img.height;
    const targetAspect = width / height;

    let drawW, drawH, offsetX, offsetY;

    if (imgAspect > targetAspect) {
      drawH = height;
      drawW = height * imgAspect;
      offsetX = (width - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = width;
      drawH = width / imgAspect;
      offsetX = 0;
      offsetY = 0;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }

  // 2. Cinematic Gradient Overlay
  // Top Header Gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
  topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  topGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.4)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 180);

  // Bottom Content Gradient
  const gradStartY = height * 0.32;
  const bottomGrad = ctx.createLinearGradient(0, gradStartY, 0, height);
  bottomGrad.addColorStop(0, 'rgba(5, 5, 8, 0)');
  bottomGrad.addColorStop(0.35, 'rgba(5, 5, 8, 0.75)');
  bottomGrad.addColorStop(0.7, 'rgba(5, 5, 8, 0.96)');
  bottomGrad.addColorStop(1, '#050508');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, gradStartY, width, height - gradStartY);

  // 3. Top Header Bar (@todayanimenews branding)
  const headerY = 60;

  ctx.save();
  // Brand Red Square Icon
  ctx.fillStyle = '#E50914';
  roundRect(ctx, 50, headerY - 24, 42, 42, 10);
  ctx.fill();

  // Play arrow inside icon
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(65, headerY - 14);
  ctx.lineTo(80, headerY - 3);
  ctx.lineTo(65, headerY + 8);
  ctx.closePath();
  ctx.fill();

  // Brand Name
  ctx.font = 'bold 28px "Outfit", "Arial", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(state.handle.replace('@', '').toUpperCase(), 106, headerY + 6);

  // "DAILY UPDATES" pill on right
  const rightPillText = 'DAILY UPDATES';
  ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
  const pillW = ctx.measureText(rightPillText).width + 24;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, width - 50 - pillW, headerY - 20, pillW, 34, 17);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(rightPillText, width - 50 - pillW + 12, headerY + 3);
  ctx.restore();

  // 4. Category Badge Pill (Glowing)
  const contentStartY = height - 480;
  const badgeText = (state.badge || 'NEWS').toUpperCase();
  const badgeColor = state.badgeColor || '#E50914';

  ctx.save();
  ctx.font = 'bold 20px "Outfit", sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 36;
  const badgeHeight = 42;
  const badgeX = 50;
  const badgeY = contentStartY;

  // Glowing shadow
  ctx.shadowColor = badgeColor;
  ctx.shadowBlur = 18;
  ctx.fillStyle = badgeColor;
  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, badgeX + 18, badgeY + 28);
  ctx.restore();

  // 5. Headline (Title)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;

  let fontSize = 46;
  if (state.title.length > 90) fontSize = 38;
  if (state.title.length > 130) fontSize = 34;

  ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
  const maxTextWidth = width - 100;
  const titleLines = wrapText(ctx, state.title, maxTextWidth).slice(0, 3);

  let textY = badgeY + badgeHeight + 46;
  for (const line of titleLines) {
    ctx.fillText(line, 50, textY);
    textY += fontSize + 12;
  }
  ctx.restore();

  // 6. Excerpt / Summary
  if (state.excerpt && state.ratio !== '1:1') {
    ctx.save();
    ctx.font = '22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(230, 230, 240, 0.88)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;

    const excerptLines = wrapText(ctx, state.excerpt, maxTextWidth).slice(0, 2);
    textY += 10;
    for (const line of excerptLines) {
      ctx.fillText(line, 50, textY);
      textY += 32;
    }
    ctx.restore();
  }

  // 7. Footer Divider & Source + Social Call to Action
  const footerY = height - 60;

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, footerY - 30);
  ctx.lineTo(width - 50, footerY - 30);
  ctx.stroke();

  // Left: Source
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#a0a5b5';
  ctx.fillText(`SOURCE: ${state.source.toUpperCase()}`, 50, footerY);

  // Right: Follow CTA
  ctx.font = 'bold 18px "Outfit", sans-serif';
  ctx.fillStyle = '#E50914';
  const ctaText = `FOLLOW ${state.handle.toUpperCase()}`;
  const ctaWidth = ctx.measureText(ctaText).width;
  ctx.fillText(ctaText, width - 50 - ctaWidth, footerY);
}

/**
 * Helpers
 */
function wrapText(context, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + ' ' + word;
    const width = context.measureText(testLine).width;
    if (width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function filterNews() {
  const q = searchInput.value.toLowerCase().trim();
  const source = sourceFilter.value.toLowerCase().trim();

  let filtered = state.newsList;

  if (source) {
    filtered = filtered.filter(item => item.sourceKey === source || item.source.toLowerCase().includes(source));
  }

  if (q) {
    filtered = filtered.filter(item => item.title.toLowerCase().includes(q) || item.excerpt.toLowerCase().includes(q));
  }

  renderNewsList(filtered);
}

function syncFormWithState() {
  handleInput.value = state.handle;
  badgeTextInput.value = state.badge;
  titleInput.value = state.title;
  excerptInput.value = state.excerpt;
  sourceInput.value = state.source;
  imageUrlInput.value = state.imageUrl;
}

function resetToDefault() {
  state.handle = '@ANIREPORT';
  state.badge = 'OFFICIAL ANNOUNCEMENT';
  state.badgeColor = '#E50914';
  state.ratio = '4:5';
  updateCanvasDimensions();
  syncFormWithState();
  renderCanvas();
}

/**
 * 1-Click Download High-Res PNG
 */
function downloadCanvas() {
  const link = document.createElement('a');
  const cleanTitle = state.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
  link.download = `anime_news_${cleanTitle}_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
  showToast('📥 High-Res Instagram Post Downloaded!');
}

/**
 * Copy Ready-to-use Instagram Caption & Hashtags
 */
function copyInstagramCaption() {
  const caption = `🔥 BREAKING: ${state.title}

📖 Details:
${state.excerpt}

📌 Source: ${state.source}

👉 Follow ${state.handle} for more daily anime updates, release dates, and trailers!
.
.
.
#animenews #anime #otaku #manga #${state.source.toLowerCase().replace(/[^a-z0-9]/g, '')} #animeupdate #animelover #animecommunity #anireport #weeb`;

  navigator.clipboard.writeText(caption).then(() => {
    showToast('📋 Instagram Caption & Hashtags Copied!');
  });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function debounce(fn, ms) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return 'Recently';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

// Start
window.addEventListener('DOMContentLoaded', init);
