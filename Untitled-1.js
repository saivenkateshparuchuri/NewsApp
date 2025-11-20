// js/app.js
const API_BASE = '/.netlify/functions/news-proxy'; // Netlify path. For Vercel use /api/news or adjust.
const articlesEl = document.getElementById('articles');
const statusEl = document.getElementById('status');
const countryEl = document.getElementById('country');
const categoryEl = document.getElementById('category');
const pageSizeEl = document.getElementById('pageSize');
const qEl = document.getElementById('q');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageNumEl = document.getElementById('pageNum');
const refreshSelect = document.getElementById('refresh-interval');

let page = 1;
let autoRefreshTimer = null;
let lastFetchKey = null;
const clientCache = new Map(); // simple in-memory cache per session

function makeFetchKey(params) {
  return JSON.stringify(params);
}

function showStatus(text) {
  statusEl.textContent = text;
}

function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    articlesEl.innerHTML = `<div class="p-4 bg-white rounded shadow">No articles found.</div>`;
    return;
  }
  articlesEl.innerHTML = articles.map(a => {
    const img = a.urlToImage ? `<img src="${a.urlToImage}" alt="" class="w-full h-40 object-cover rounded">` : '';
    const author = a.author ? `<div class="text-xs text-gray-500">By ${a.author}</div>` : '';
    const published = a.publishedAt ? new Date(a.publishedAt).toLocaleString() : '';
    return `
      <article class="bg-white p-4 rounded shadow">
        ${img}
        <h3 class="mt-2 font-semibold text-lg"><a href="${a.url}" target="_blank" rel="noopener noreferrer">${a.title}</a></h3>
        <p class="text-sm text-gray-700 mt-1">${a.description || ''}</p>
        <div class="mt-3 text-xs text-gray-500 flex justify-between">
          <div>${author}</div>
          <div>${published}</div>
        </div>
      </article>
    `;
  }).join('');
}

async function fetchNews({country, category, page, pageSize, q}) {
  showStatus('Loading...');
  const params = { country, category, page, pageSize, q };

  const key = makeFetchKey(params);
  lastFetchKey = key;

  // Serve from client cache if fresh (30s)
  const cached = clientCache.get(key);
  const now = Date.now();
  if (cached && (now - cached.t) < 30000) {
    renderArticles(cached.data.articles);
    showStatus(`Showing cached results (updated ${Math.round((now - cached.t)/1000)}s ago)`);
    return cached.data;
  }

  const qs = new URLSearchParams();
  if (country) qs.append('country', country);
  if (category) qs.append('category', category);
  if (q) qs.append('q', q);
  qs.append('page', page);
  qs.append('pageSize', pageSize);

  try {
    const res = await fetch(`${API_BASE}?${qs.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(()=>({message:'Unknown error'}));
      showStatus(`Error: ${err.message || res.statusText}`);
      return null;
    }
    const data = await res.json();
    if (lastFetchKey !== key) {
      // a later fetch superseded this one
      return null;
    }
    clientCache.set(key, { t: Date.now(), data });
    renderArticles(data.articles);
    showStatus(`Showing ${data.articles.length} articles (totalResults: ${data.totalResults})`);
    return data;
  } catch (err) {
    showStatus(`Fetch error: ${err.message}`);
    return null;
  }
}

function readControls() {
  return {
    country: countryEl.value,
    category: categoryEl.value,
    pageSize: parseInt(pageSizeEl.value, 10),
    q: qEl.value.trim()
  };
}

async function loadPage(newPage = page) {
  page = Math.max(1, newPage);
  pageNumEl.textContent = page;
  const ctrl = readControls();
  await fetchNews({ ...ctrl, page, pageSize: ctrl.pageSize });
}

prevBtn.addEventListener('click', ()=> {
  if (page > 1) loadPage(page - 1);
});
nextBtn.addEventListener('click', ()=> {
  loadPage(page + 1);
});

// debounced control change
let debounceTimer = null;
function scheduleReload() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page = 1;
    loadPage(1);
  }, 300);
}

[countryEl, categoryEl, pageSizeEl, qEl].forEach(el => el.addEventListener('input', scheduleReload));

// auto-refresh control
refreshSelect.addEventListener('change', () => {
  const v = parseInt(refreshSelect.value, 10);
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  if (v > 0) {
    autoRefreshTimer = setInterval(() => {
      // Re-fetch current page and highlight if new articles appeared
      const ctrl = readControls();
      fetchNews({ ...ctrl, page, pageSize: ctrl.pageSize }).then(data => {
        // Could compare data.articles[0].publishedAt to previous to show "new" badge
      });
    }, v * 1000);
  }
});

// initial load
document.addEventListener('DOMContentLoaded', () => {
  loadPage(1);
});
