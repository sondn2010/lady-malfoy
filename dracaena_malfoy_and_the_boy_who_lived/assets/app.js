/* ==========================================================================
   Dracaena Malfoy & The Boy Who Lived — Main Reader Application
   File: assets/app.js
   - Loads chapter metadata dynamically from chapters.csv via AJAX
   - Loads chapter content dynamically from .md files via AJAX
   - Supports Mobile Drawer, Touch Swipe, Sticky Bottom Bar, Auto-Bookmark,
     3 Reading Themes, Typography Customization, Zen Focus Mode & Shortcuts
   ========================================================================== */
(function () {
  let CHAPTERS = [];
  const mdCache = {};
  let currentLoadedMdText = '';

  let state = {
    currentChapterIndex: 0,
    mode: 'detailed', // 'detailed' | 'condensed'
    activeTab: 'reader', // 'reader' | 'compare' | 'gallery' | 'overview'
    yearFilter: 'all',
    searchQuery: '',
    fontSize: 18,
    lineHeight: 1.85,
    fontFamily: 'sans', // 'sans' | 'serif'
    theme: 'dark', // 'dark' | 'parchment' | 'sepia'
    focusMode: false,
    readChapters: { 1: true },
    bookmarks: {},
    scrollPositions: {} // key: slug + '_' + mode -> scrollY
  };

  try {
    const saved = localStorage.getItem('dracaena_ajax_reader_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      if (!state.readChapters) state.readChapters = { 1: true };
      if (!state.bookmarks) state.bookmarks = {};
      if (!state.scrollPositions) state.scrollPositions = {};
    }
  } catch (e) {}

  function saveState() {
    try {
      localStorage.setItem('dracaena_ajax_reader_state', JSON.stringify(state));
    } catch (e) {}
  }

  let toastTimer = null;
  function showToast(msg) {
    const box = document.getElementById('toastBox');
    if (!box) return;
    box.textContent = msg;
    box.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.add('hidden'), 2600);
  }

  // RFC-4180 compliant CSV parser supporting UTF-8, quotes, commas & multiline fields
  function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < csvText.length; i++) {
      const ch = csvText[i];
      const next = csvText[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          row.push(cur);
          cur = '';
        } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
          if (ch === '\r') i++;
          row.push(cur);
          if (row.length > 1 || row[0] !== '') rows.push(row);
          row = [];
          cur = '';
        } else if (ch !== '\r') {
          cur += ch;
        }
      }
    }
    if (cur !== '' || row.length > 0) {
      row.push(cur);
      if (row.length > 1 || row[0] !== '') rows.push(row);
    }
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map((r, index) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] !== undefined ? r[idx] : '').trim();
      });
      obj.num = parseInt(obj.num, 10) || (index + 1);
      obj.year = parseInt(obj.year, 10) || 1;
      obj.year_title = obj.year_title || `Năm Thứ ${obj.year}`;
      obj.md_codong = obj.md_codong || `01_phien_ban_co_dong/${obj.slug}.md`;
      obj.md_chitiet = obj.md_chitiet || `02_phien_ban_chi_tiet/${obj.slug}.md`;
      obj.html_codong = obj.html_codong || `01_phien_ban_co_dong/${obj.slug}.html`;
      obj.html_chitiet = obj.html_chitiet || `02_phien_ban_chi_tiet/${obj.slug}.html`;
      obj.image = obj.image || `images/${obj.slug}.jpg`;
      return obj;
    });
  }

  let fallbackScriptPromise = null;
  function loadFileProtocolFallback() {
    if (window.OFFLINE_MD_STORE && window.OFFLINE_CSV_TEXT) {
      return Promise.resolve({ mdStore: window.OFFLINE_MD_STORE, csvText: window.OFFLINE_CSV_TEXT });
    }
    if (fallbackScriptPromise) return fallbackScriptPromise;
    fallbackScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'assets/md_fallback.js';
      script.onload = () => resolve({
        mdStore: window.OFFLINE_MD_STORE || {},
        csvText: window.OFFLINE_CSV_TEXT || ''
      });
      script.onerror = () => reject(new Error('Không thể nạp dữ liệu dự phòng từ assets/md_fallback.js'));
      document.body.appendChild(script);
    });
    return fallbackScriptPromise;
  }

  // Load chapters.csv via AJAX (fetch -> XHR -> file:// fallback)
  async function loadChaptersFromCsv() {
    if (window.EMBEDDED_CSV_TEXT) {
      return { chapters: parseCSV(window.EMBEDDED_CSV_TEXT), source: 'CSV Embedded (Canvas)' };
    }
    try {
      const csvUrl = window.CSV_FILE_PATH || ('chapters' + '.csv');
      const res = await fetch(csvUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/csv, text/plain, */*' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const csvText = await res.text();
      return { chapters: parseCSV(csvText), source: '✅ AJAX CSV: chapters.csv' };
    } catch (fetchErr) {
      try {
        const xhrText = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', 'chapters.csv', true);
          xhr.overrideMimeType('text/csv; charset=utf-8');
          xhr.onload = function () {
            if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
              resolve(xhr.responseText);
            } else {
              reject(new Error('XHR CSV status ' + xhr.status));
            }
          };
          xhr.onerror = () => reject(new Error('XHR CSV network error'));
          xhr.send();
        });
        return { chapters: parseCSV(xhrText), source: '✅ AJAX XHR: chapters.csv' };
      } catch (xhrErr) {
        const fb = await loadFileProtocolFallback();
        if (fb && fb.csvText) {
          return { chapters: parseCSV(fb.csvText), source: '📂 Local CSV: chapters.csv' };
        }
        throw fetchErr;
      }
    }
  }

  // Load Markdown file via AJAX
  async function fetchMarkdownViaAjax(mdPath) {
    if (mdCache[mdPath]) {
      return { text: mdCache[mdPath], status: `⚡ AJAX Cache: ${mdPath}` };
    }
    if (window.OFFLINE_MD_STORE && window.OFFLINE_MD_STORE[mdPath] && window.EMBEDDED_CSV_TEXT) {
      mdCache[mdPath] = window.OFFLINE_MD_STORE[mdPath];
      return { text: mdCache[mdPath], status: `✅ Loaded: ${mdPath}` };
    }
    try {
      const response = await fetch(mdPath, {
        method: 'GET',
        headers: { 'Accept': 'text/markdown, text/plain, */*' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      mdCache[mdPath] = text;
      return { text, status: `✅ AJAX GET: ${mdPath}` };
    } catch (fetchErr) {
      try {
        const xhrText = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', mdPath, true);
          xhr.overrideMimeType('text/markdown; charset=utf-8');
          xhr.onload = function () {
            if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
              resolve(xhr.responseText);
            } else {
              reject(new Error('XHR status ' + xhr.status));
            }
          };
          xhr.onerror = () => reject(new Error('XHR network error'));
          xhr.send();
        });
        mdCache[mdPath] = xhrText;
        return { text: xhrText, status: `✅ AJAX XHR: ${mdPath}` };
      } catch (xhrErr) {
        const fb = await loadFileProtocolFallback();
        if (fb.mdStore && fb.mdStore[mdPath]) {
          mdCache[mdPath] = fb.mdStore[mdPath];
          return { text: fb.mdStore[mdPath], status: `📂 Local File: ${mdPath}` };
        }
        throw fetchErr;
      }
    }
  }

  // Parse Markdown (.md) into structured parts + estimate reading time
  function parseMarkdownDocument(mdText) {
    const lines = mdText.replace(/\r\n/g, '\n').split('\n');
    let imgSrc = '';
    let imgCaption = '';
    let quoteText = '';
    const out = [];
    let wordCount = 0;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (
        line.startsWith('# Chương ') ||
        line.startsWith('**Tên gốc:**') ||
        line.startsWith('**Tác giả:**') ||
        line.startsWith('**Phiên bản:**')
      ) {
        continue;
      }
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        imgSrc = imgMatch[2].replace(/^\.\.\//, '');
        continue;
      }
      if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && out.length === 0 && !imgCaption) {
        imgCaption = line.slice(1, -1);
        continue;
      }
      if (line.startsWith('> ') && !quoteText) {
        quoteText = line.slice(2).replace(/^"|"$/g, '');
        continue;
      }

      wordCount += line.split(/\s+/).length;

      if (line.startsWith('### ')) {
        out.push(`<h3>${line.slice(4)}</h3>`);
      } else if (line.startsWith('- ')) {
        let content = line.slice(2)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        out.push(`<li class="ml-5 list-disc mb-2 leading-relaxed">${content}</li>`);
      } else {
        let content = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        out.push(`<p>${content}</p>`);
      }
    }
    const readMinutes = Math.max(1, Math.round(wordCount / 220));
    return { imgSrc, imgCaption, quoteText, wordCount, readMinutes, html: out.join('\n') };
  }

  function resolveImageSrc(relPath) {
    if (window.INLINE_IMAGE_MAP && window.INLINE_IMAGE_MAP[relPath]) {
      return window.INLINE_IMAGE_MAP[relPath];
    }
    return relPath;
  }

  // Dynamically build Year Filter Buttons based on distinct years in chapters.csv
  function renderYearFilterButtons() {
    const container = document.getElementById('yearFilterContainer');
    if (!container) return;
    container.innerHTML = '';

    const yearCounts = {};
    CHAPTERS.forEach(ch => {
      yearCounts[ch.year] = (yearCounts[ch.year] || 0) + 1;
    });
    const years = Object.keys(yearCounts).sort((a, b) => Number(a) - Number(b));

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `px-2.5 py-1.5 rounded-lg font-medium text-xs transition shrink-0 ${
      state.yearFilter === 'all'
        ? 'bg-emerald-700 text-white shadow'
        : 'text-slate-400 hover:text-white bg-slate-900/60'
    }`;
    allBtn.textContent = `Tất cả (${CHAPTERS.length})`;
    allBtn.addEventListener('click', () => {
      state.yearFilter = 'all';
      renderYearFilterButtons();
      renderSidebar();
    });
    container.appendChild(allBtn);

    years.forEach(yr => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = String(state.yearFilter) === String(yr);
      btn.className = `px-2.5 py-1.5 rounded-lg font-medium text-xs transition shrink-0 ${
        isSelected
          ? 'bg-emerald-700 text-white shadow'
          : 'text-slate-400 hover:text-white bg-slate-900/60'
      }`;
      btn.textContent = `Năm ${yr} (${yearCounts[yr]})`;
      btn.addEventListener('click', () => {
        state.yearFilter = String(yr);
        renderYearFilterButtons();
        renderSidebar();
      });
      container.appendChild(btn);
    });

    // Update all dynamic total chapter counters on page
    const total = CHAPTERS.length;
    const maxYear = years.length ? years[years.length - 1] : 1;
    document.querySelectorAll('.js-total-chapters').forEach(el => {
      el.textContent = `${total} Chương (Năm 1–${maxYear})`;
    });
  }

  function renderSidebar() {
    const container = document.getElementById('chapterListContainer');
    if (!container) return;
    container.innerHTML = '';
    const q = (state.searchQuery || '').toLowerCase().trim();

    const yearBadgeColors = {
      1: 'bg-slate-800 text-emerald-400',
      2: 'bg-slate-800 text-amber-400',
      3: 'bg-slate-800 text-sky-400',
      4: 'bg-slate-800 text-purple-400'
    };

    CHAPTERS.forEach((ch, idx) => {
      if (state.yearFilter !== 'all' && String(ch.year) !== String(state.yearFilter)) return;
      if (
        q &&
        !ch.vi_title.toLowerCase().includes(q) &&
        !ch.en_title.toLowerCase().includes(q) &&
        !String(ch.num).includes(q)
      ) {
        return;
      }

      const isSelected = idx === state.currentChapterIndex;
      const isRead = !!state.readChapters[ch.num];
      const isBookmarked = !!state.bookmarks[ch.num];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-ch-idx', idx);
      btn.className = `w-full text-left p-2.5 rounded-xl transition flex items-center gap-2.5 border ${
        isSelected
          ? 'bg-emerald-900/70 border-emerald-500/70 text-white shadow-md'
          : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/70'
      }`;

      const badgeColor = isSelected
        ? 'bg-emerald-400 text-slate-950'
        : (yearBadgeColors[ch.year] || 'bg-slate-800 text-emerald-300');

      const shortViTitle = ch.vi_title.replace(/^Năm\s+[^:]+:\s*/i, '');

      btn.innerHTML = `
        <img src="${resolveImageSrc(ch.image)}" alt="Ch.${ch.num}" class="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" loading="lazy">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor}">#${String(ch.num).padStart(2, '0')}</span>
            <span class="font-medium text-xs sm:text-sm truncate">${shortViTitle}</span>
          </div>
          <div class="text-[11px] text-slate-400 truncate mt-0.5">${ch.en_title}</div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          ${isBookmarked ? '<span class="text-amber-400 text-xs" title="Đã đánh dấu">★</span>' : ''}
          ${isRead ? '<span class="text-emerald-400 text-xs" title="Đã đọc">✓</span>' : ''}
        </div>
      `;
      btn.addEventListener('click', () => {
        selectChapter(idx);
        closeMobileDrawer();
      });
      container.appendChild(btn);
    });

    const readTotal = Object.keys(state.readChapters).length;
    const lblRead = document.getElementById('lblReadCount');
    if (lblRead) lblRead.textContent = `Đã đọc: ${readTotal}/${CHAPTERS.length}`;
  }

  function applyTypographyAndTheme() {
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-parchment', 'theme-sepia');
    body.classList.add('theme-' + (state.theme || 'dark'));

    if (state.focusMode) {
      body.classList.add('focus-mode');
    } else {
      body.classList.remove('focus-mode');
    }

    document.documentElement.style.setProperty('--reader-font-size', `${state.fontSize}px`);
    document.documentElement.style.setProperty('--reader-line-height', String(state.lineHeight || 1.85));

    const contentEl = document.getElementById('chContent');
    if (contentEl) {
      contentEl.classList.remove('font-novel-serif', 'font-novel-sans');
      contentEl.classList.add(state.fontFamily === 'serif' ? 'font-novel-serif' : 'font-novel-sans');
    }

    const lblFont = document.getElementById('lblFontSize');
    if (lblFont) lblFont.textContent = `${state.fontSize}px`;
    const lblMobFont = document.getElementById('lblMobFontSize');
    if (lblMobFont) lblMobFont.textContent = `${state.fontSize}px`;

    const btnTheme = document.getElementById('btnThemeToggle');
    if (btnTheme) {
      const labels = {
        dark: '🌙 Tối Slytherin',
        parchment: '📜 Giấy Cổ',
        sepia: '☕ Sepia Đêm'
      };
      btnTheme.textContent = labels[state.theme] || '🌙 Tối Slytherin';
    }

    const btnFocus = document.getElementById('btnFocusMode');
    if (btnFocus) {
      btnFocus.className = state.focusMode
        ? 'px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 text-white border border-emerald-500 transition'
        : 'px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition';
    }

    const btnFontFamily = document.getElementById('btnFontFamily');
    if (btnFontFamily) {
      btnFontFamily.textContent = state.fontFamily === 'serif' ? 'Chữ: Có chân (Serif)' : 'Chữ: Không chân (Sans)';
    }
  }

  async function renderCurrentChapter(preserveScroll = false) {
    if (!CHAPTERS.length) return;
    if (state.currentChapterIndex < 0 || state.currentChapterIndex >= CHAPTERS.length) {
      state.currentChapterIndex = 0;
    }

    const ch = CHAPTERS[state.currentChapterIndex];
    const total = CHAPTERS.length;
    state.readChapters[ch.num] = true;
    saveState();

    const isDetailed = state.mode === 'detailed';
    const mdRelPath = isDetailed ? ch.md_chitiet : ch.md_codong;
    const htmlRelPath = isDetailed ? ch.html_chitiet : ch.html_codong;

    document.getElementById('chBadgeYear').textContent = `${ch.year_title} • Chương ${String(ch.num).padStart(2, '0')}/${total}`;
    const badgeMode = document.getElementById('chBadgeMode');
    badgeMode.textContent = isDetailed ? '📜 Bản Dịch Chi Tiết' : '⚡ Bản Viết Cô Đọng';
    badgeMode.className = isDetailed
      ? 'px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs'
      : 'px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs';

    document.getElementById('chTitleVi').textContent = `Chương ${String(ch.num).padStart(2, '0')}: ${ch.vi_title}`;
    document.getElementById('chTitleEn').textContent = `Nguyên tác: ${ch.en_title} — Sergio Xalambrí (sergiodxa)`;
    document.getElementById('chFilePath').textContent = mdRelPath;
    document.getElementById('btnOpenRawMd').href = mdRelPath;
    document.getElementById('btnOpenChapterHtml').href = htmlRelPath;
    document.getElementById('chWattpadLink').href = ch.url;

    const btnBookmark = document.getElementById('btnBookmarkChapter');
    if (btnBookmark) {
      const isBm = !!state.bookmarks[ch.num];
      btnBookmark.textContent = isBm ? '★ Đã lưu dấu trang' : '☆ Đánh dấu (B)';
      btnBookmark.className = isBm
        ? 'px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-medium transition'
        : 'px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition';
    }

    // Set chapter image immediately from CSV metadata
    const imgEl = document.getElementById('chImage');
    imgEl.src = resolveImageSrc(ch.image);
    imgEl.alt = ch.vi_title;
    document.getElementById('chImageCaption').textContent = ch.image_caption || '';
    document.getElementById('chQuote').textContent = ch.quote ? `"${ch.quote}"` : '';

    const contentEl = document.getElementById('chContent');
    const statusBadge = document.getElementById('ajaxStatusBadge');
    contentEl.innerHTML = `<div class="py-10 text-center text-emerald-400 animate-pulse text-sm">⏳ Đang gọi AJAX tải file <code>${mdRelPath}</code>...</div>`;
    statusBadge.textContent = '⏳ AJAX Loading...';

    document.getElementById('lblBottomProgress').textContent = `Chương ${ch.num} / ${total} (${isDetailed ? 'Chi Tiết' : 'Cô Đọng'})`;
    const mobChLabel = document.getElementById('mobChapterLabel');
    if (mobChLabel) mobChLabel.textContent = `Ch.${String(ch.num).padStart(2, '0')}/${total}`;

    const isFirst = state.currentChapterIndex === 0;
    const isLast = state.currentChapterIndex === total - 1;
    ['btnPrevChapter', 'btnTopPrevChapter', 'mobBtnPrev'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = isFirst;
    });
    ['btnNextChapter', 'btnTopNextChapter', 'mobBtnNext'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = isLast;
    });

    // Update mode toggle buttons
    const btnDet = document.getElementById('btnModeDetailed');
    const btnCon = document.getElementById('btnModeCondensed');
    const mobBtnMode = document.getElementById('mobBtnMode');
    if (isDetailed) {
      btnDet.className = 'px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-600 text-white shadow transition';
      btnCon.className = 'px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition';
      if (mobBtnMode) mobBtnMode.textContent = '📜 Chi tiết';
    } else {
      btnCon.className = 'px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-600 text-white shadow transition';
      btnDet.className = 'px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition';
      if (mobBtnMode) mobBtnMode.textContent = '⚡ Cô đọng';
    }

    renderSidebar();

    try {
      const result = await fetchMarkdownViaAjax(mdRelPath);
      currentLoadedMdText = result.text;
      const parsed = parseMarkdownDocument(result.text);
      if (parsed.imgSrc) {
        imgEl.src = resolveImageSrc(parsed.imgSrc);
      }
      if (parsed.imgCaption) {
        document.getElementById('chImageCaption').textContent = parsed.imgCaption;
      }
      if (parsed.quoteText) {
        document.getElementById('chQuote').textContent = `"${parsed.quoteText}"`;
      }
      contentEl.innerHTML = parsed.html;
      statusBadge.textContent = result.status;

      const timeBadge = document.getElementById('chReadTimeBadge');
      if (timeBadge) {
        timeBadge.textContent = `⏱️ ~${parsed.readMinutes} phút đọc (${parsed.wordCount.toLocaleString('vi-VN')} từ)`;
      }

      // Restore saved scroll position if user was reading this chapter earlier
      const scrollKey = `${ch.slug}_${state.mode}`;
      if (preserveScroll && state.scrollPositions[scrollKey] > 120) {
        setTimeout(() => {
          window.scrollTo({ top: state.scrollPositions[scrollKey], behavior: 'smooth' });
        }, 80);
      }

      // Pre-fetch next chapter in background for instant switching
      if (state.currentChapterIndex + 1 < total) {
        const nextCh = CHAPTERS[state.currentChapterIndex + 1];
        const nextPath = isDetailed ? nextCh.md_chitiet : nextCh.md_codong;
        if (!mdCache[nextPath]) {
          fetchMarkdownViaAjax(nextPath).catch(() => {});
        }
      }
    } catch (err) {
      contentEl.innerHTML = `<div class="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm">Không thể tải file <code>${mdRelPath}</code>: ${err.message}</div>`;
      statusBadge.textContent = '❌ Lỗi AJAX';
    }

    if (state.activeTab === 'compare') {
      await renderCompareView(ch);
    }
  }

  async function renderCompareView(ch) {
    if (!ch) return;
    document.getElementById('cmpTitle').textContent = `Chương ${String(ch.num).padStart(2, '0')}: ${ch.vi_title} (${ch.en_title})`;
    document.getElementById('cmpPath1').textContent = ch.md_codong;
    document.getElementById('cmpPath2').textContent = ch.md_chitiet;
    const elCon = document.getElementById('cmpContentCondensed');
    const elDet = document.getElementById('cmpContentDetailed');
    elCon.innerHTML = '<div class="text-xs text-amber-300 animate-pulse">⏳ Đang gọi AJAX tải bản cô đọng...</div>';
    elDet.innerHTML = '<div class="text-xs text-emerald-300 animate-pulse">⏳ Đang gọi AJAX tải bản chi tiết...</div>';

    try {
      const [resCon, resDet] = await Promise.all([
        fetchMarkdownViaAjax(ch.md_codong),
        fetchMarkdownViaAjax(ch.md_chitiet)
      ]);
      elCon.innerHTML = parseMarkdownDocument(resCon.text).html;
      elDet.innerHTML = parseMarkdownDocument(resDet.text).html;
    } catch (err) {
      elCon.innerHTML = `<div class="text-red-300 text-xs">Lỗi tải AJAX: ${err.message}</div>`;
    }
  }

  // Dynamically populate Gallery & CSV Table directly from CHAPTERS loaded from chapters.csv
  function renderGalleryAndTable() {
    const gGrid = document.getElementById('galleryGrid');
    if (gGrid) {
      gGrid.innerHTML = '';
      CHAPTERS.forEach((ch, idx) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-emerald-500/40 transition group';
        card.innerHTML = `
          <div class="relative overflow-hidden">
            <img src="${resolveImageSrc(ch.image)}" alt="${ch.vi_title}" class="w-full h-52 object-cover group-hover:scale-105 transition duration-300" loading="lazy">
            <span class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/85 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
              Chương ${String(ch.num).padStart(2, '0')} • Năm ${ch.year}
            </span>
          </div>
          <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <span class="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">${ch.en_title}</span>
              <h3 class="text-base sm:text-lg font-bold font-serif-display text-white mt-0.5">${ch.vi_title}</h3>
              <p class="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">${ch.image_caption}</p>
              <blockquote class="mt-2.5 pl-3 border-l-2 border-emerald-500/50 text-xs italic text-emerald-200/90 line-clamp-2">"${ch.quote}"</blockquote>
            </div>
            <div class="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <code class="text-[11px] text-slate-400 truncate max-w-[60%]">${ch.image}</code>
              <button data-idx="${idx}" class="btn-gallery-read px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition">
                📖 Đọc chương này
              </button>
            </div>
          </div>
        `;
        gGrid.appendChild(card);
      });

      document.querySelectorAll('.btn-gallery-read').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          switchTab('reader');
          selectChapter(idx);
        });
      });
    }

    const tBody = document.getElementById('tableFilesBody');
    if (tBody) {
      tBody.innerHTML = '';
      CHAPTERS.forEach((ch, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition';
        tr.innerHTML = `
          <td class="p-3 font-bold text-emerald-400 whitespace-nowrap">#${String(ch.num).padStart(2, '0')} (Năm ${ch.year})</td>
          <td class="p-3 font-medium text-white">
            <div>${ch.vi_title}</div>
            <div class="text-xs text-slate-400 italic">${ch.en_title}</div>
          </td>
          <td class="p-3 font-mono text-xs text-sky-300">${ch.image}</td>
          <td class="p-3 font-mono text-xs text-amber-300">
            <div>${ch.md_codong}</div>
            <div class="text-emerald-300">${ch.md_chitiet}</div>
          </td>
          <td class="p-3 text-right whitespace-nowrap space-x-1">
            <button data-idx="${idx}" data-mode="condensed" class="btn-jump-chapter px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs">Cô đọng</button>
            <button data-idx="${idx}" data-mode="detailed" class="btn-jump-chapter px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs">Chi tiết</button>
          </td>
        `;
        tBody.appendChild(tr);
      });

      document.querySelectorAll('.btn-jump-chapter').forEach(btn => {
        btn.addEventListener('click', () => {
          state.mode = btn.getAttribute('data-mode');
          state.currentChapterIndex = parseInt(btn.getAttribute('data-idx'), 10);
          switchTab('reader');
          renderCurrentChapter(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }
  }

  function selectChapter(idx) {
    if (idx < 0 || idx >= CHAPTERS.length) return;
    state.currentChapterIndex = idx;
    renderCurrentChapter(false);
    const readerCard = document.getElementById('singleReaderCard');
    if (readerCard) {
      const y = readerCard.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function openMobileDrawer() {
    const sb = document.getElementById('sidebarPanel');
    const bd = document.getElementById('mobileBackdrop');
    if (sb) sb.classList.add('drawer-open');
    if (bd) bd.classList.remove('hidden');
    // Scroll active chapter into view inside drawer
    setTimeout(() => {
      const activeBtn = sb && sb.querySelector(`[data-ch-idx="${state.currentChapterIndex}"]`);
      if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 100);
  }

  function closeMobileDrawer() {
    const sb = document.getElementById('sidebarPanel');
    const bd = document.getElementById('mobileBackdrop');
    if (sb) sb.classList.remove('drawer-open');
    if (bd) bd.classList.add('hidden');
  }

  function toggleShortcutsModal(forceOpen) {
    const modal = document.getElementById('shortcutsModal');
    if (!modal) return;
    if (typeof forceOpen === 'boolean') {
      modal.classList.toggle('hidden', !forceOpen);
    } else {
      modal.classList.toggle('hidden');
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    saveState();

    const vReader = document.getElementById('viewReader');
    const singleCard = document.getElementById('singleReaderCard');
    const compareCard = document.getElementById('compareReaderCard');
    const vGallery = document.getElementById('viewGallery');
    const vOverview = document.getElementById('viewOverview');

    vReader.classList.add('hidden');
    vGallery.classList.add('hidden');
    vOverview.classList.add('hidden');

    ['tabReader', 'tabCompare', 'tabGallery', 'tabOverview'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition text-slate-300 hover:text-white whitespace-nowrap';
    });

    const activeClass = 'px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition bg-emerald-700 text-white shadow whitespace-nowrap';

    if (tab === 'reader') {
      vReader.classList.remove('hidden');
      singleCard.classList.remove('hidden');
      compareCard.classList.add('hidden');
      document.getElementById('tabReader').className = activeClass;
    } else if (tab === 'compare') {
      vReader.classList.remove('hidden');
      singleCard.classList.add('hidden');
      compareCard.classList.remove('hidden');
      document.getElementById('tabCompare').className = activeClass;
      renderCompareView(CHAPTERS[state.currentChapterIndex]);
    } else if (tab === 'gallery') {
      vGallery.classList.remove('hidden');
      document.getElementById('tabGallery').className = activeClass;
    } else if (tab === 'overview') {
      vOverview.classList.remove('hidden');
      document.getElementById('tabOverview').className = activeClass;
    }
  }

  // CSV Row Builder Helper in Overview Tab so user can generate new CSV lines effortlessly
  function setupCsvRowBuilder() {
    const btnGen = document.getElementById('btnGenerateCsvRow');
    const outBox = document.getElementById('csvRowOutput');
    if (!btnGen || !outBox) return;
    btnGen.addEventListener('click', () => {
      const num = document.getElementById('inpNewNum').value.trim() || (CHAPTERS.length + 1);
      const year = document.getElementById('inpNewYear').value.trim() || '4';
      const slug = document.getElementById('inpNewSlug').value.trim() || `chuong_${num}_new_chapter`;
      const vi = document.getElementById('inpNewVi').value.trim() || `Năm Tư: Tên Chương Mới`;
      const en = document.getElementById('inpNewEn').value.trim() || `Fourth Year: New Chapter`;
      const cap = document.getElementById('inpNewCap').value.trim() || `Minh họa chương ${num}.`;
      const quote = document.getElementById('inpNewQuote').value.trim() || `Câu trích dẫn nổi bật của chương ${num}.`;
      const url = 'https://www.wattpad.com/story/416871248-dracaena-malfoy-and-the-boy-who-lived';

      const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const line = [
        num,
        year,
        esc(`Năm Thứ ${year}`),
        slug,
        esc(vi),
        esc(en),
        `01_phien_ban_co_dong/${slug}.md`,
        `02_phien_ban_chi_tiet/${slug}.md`,
        `01_phien_ban_co_dong/${slug}.html`,
        `02_phien_ban_chi_tiet/${slug}.html`,
        `images/${slug}.jpg`,
        esc(cap),
        esc(quote),
        url
      ].join(',');

      outBox.value = line;
      outBox.select();
      try {
        document.execCommand('copy');
        showToast('Đã tạo và sao chép dòng CSV mẫu! Bạn chỉ cần dán vào cuối file chapters.csv.');
      } catch (e) {}
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    applyTypographyAndTheme();

    // 1. Load chapters.csv dynamically
    try {
      const csvRes = await loadChaptersFromCsv();
      CHAPTERS = csvRes.chapters;
      const csvBadge = document.getElementById('csvSourceBadge');
      if (csvBadge) csvBadge.textContent = `${csvRes.source} (${CHAPTERS.length} chương)`;
    } catch (err) {
      showToast('Không thể tải chapters.csv: ' + err.message);
    }

    renderYearFilterButtons();
    renderGalleryAndTable();
    await renderCurrentChapter(true);
    switchTab(state.activeTab || 'reader');
    setupCsvRowBuilder();

    // Navigation Tabs
    document.getElementById('tabReader').addEventListener('click', () => switchTab('reader'));
    document.getElementById('tabCompare').addEventListener('click', () => switchTab('compare'));
    document.getElementById('tabGallery').addEventListener('click', () => switchTab('gallery'));
    document.getElementById('tabOverview').addEventListener('click', () => switchTab('overview'));

    // Mode Switches
    document.getElementById('btnModeDetailed').addEventListener('click', () => {
      state.mode = 'detailed';
      renderCurrentChapter(false);
    });
    document.getElementById('btnModeCondensed').addEventListener('click', () => {
      state.mode = 'condensed';
      renderCurrentChapter(false);
    });
    const mobBtnMode = document.getElementById('mobBtnMode');
    if (mobBtnMode) {
      mobBtnMode.addEventListener('click', () => {
        state.mode = state.mode === 'detailed' ? 'condensed' : 'detailed';
        renderCurrentChapter(false);
        showToast(state.mode === 'detailed' ? '📜 Đã chuyển sang Bản Chi Tiết' : '⚡ Đã chuyển sang Bản Cô Đọng');
      });
    }

    // Chapter Prev / Next buttons (Desktop + Top + Mobile Sticky Bar + Compare)
    ['btnPrevChapter', 'btnTopPrevChapter', 'mobBtnPrev', 'btnCmpPrev'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => selectChapter(state.currentChapterIndex - 1));
    });
    ['btnNextChapter', 'btnTopNextChapter', 'mobBtnNext', 'btnCmpNext'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => selectChapter(state.currentChapterIndex + 1));
    });

    // Search input
    const inpSearch = document.getElementById('inpSearchChapter');
    if (inpSearch) {
      inpSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderSidebar();
      });
    }

    // Font Size, Font Family, Line Height & Theme Controls
    const changeFontSize = (delta) => {
      state.fontSize = Math.min(28, Math.max(14, state.fontSize + delta));
      applyTypographyAndTheme();
      saveState();
    };
    ['btnFontDec', 'mobFontDec'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => changeFontSize(-2));
    });
    ['btnFontInc', 'mobFontInc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => changeFontSize(2));
    });

    const cycleTheme = () => {
      const order = ['dark', 'parchment', 'sepia'];
      state.theme = order[(order.indexOf(state.theme || 'dark') + 1) % order.length];
      applyTypographyAndTheme();
      saveState();
      const names = { dark: '🌙 Nền Tối Slytherin', parchment: '📜 Nền Giấy Cổ Hogwarts', sepia: '☕ Nền Sepia Đọc Đêm' };
      showToast('Đã đổi giao diện: ' + names[state.theme]);
    };
    ['btnThemeToggle', 'mobThemeToggle'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', cycleTheme);
    });

    const btnFontFamily = document.getElementById('btnFontFamily');
    if (btnFontFamily) {
      btnFontFamily.addEventListener('click', () => {
        state.fontFamily = state.fontFamily === 'serif' ? 'sans' : 'serif';
        applyTypographyAndTheme();
        saveState();
        showToast(state.fontFamily === 'serif' ? 'Đã đổi sang phông chữ Có chân (Serif)' : 'Đã đổi sang phông chữ Không chân (Sans)');
      });
    }

    const btnFocus = document.getElementById('btnFocusMode');
    if (btnFocus) {
      btnFocus.addEventListener('click', () => {
        state.focusMode = !state.focusMode;
        applyTypographyAndTheme();
        saveState();
        showToast(state.focusMode ? '🧘 Đã bật Chế độ Tập trung (Nhấn F để thoát)' : 'Đã tắt Chế độ Tập trung');
      });
    }

    // Bookmark button
    const btnBookmark = document.getElementById('btnBookmarkChapter');
    if (btnBookmark) {
      btnBookmark.addEventListener('click', () => {
        const ch = CHAPTERS[state.currentChapterIndex];
        if (!ch) return;
        if (state.bookmarks[ch.num]) {
          delete state.bookmarks[ch.num];
          showToast(`Đã bỏ đánh dấu Chương ${ch.num}`);
        } else {
          state.bookmarks[ch.num] = true;
          showToast(`★ Đã đánh dấu Chương ${ch.num}: ${ch.vi_title}`);
        }
        saveState();
        renderCurrentChapter(true);
      });
    }

    // Mobile Drawer & Settings Sheet toggles
    ['btnToggleSidebar', 'mobBtnToc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', openMobileDrawer);
    });
    ['btnCloseSidebar', 'mobileBackdrop'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', closeMobileDrawer);
    });

    const mobBtnSettings = document.getElementById('mobBtnSettings');
    const mobSettingsSheet = document.getElementById('mobSettingsSheet');
    if (mobBtnSettings && mobSettingsSheet) {
      mobBtnSettings.addEventListener('click', () => {
        mobSettingsSheet.classList.toggle('hidden');
      });
    }

    // Keyboard Shortcuts Modal
    ['btnOpenShortcuts', 'btnCloseShortcuts', 'shortcutsBackdrop'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => toggleShortcutsModal());
    });

    // Copy Markdown button
    const btnCopyMd = document.getElementById('btnCopyMd');
    if (btnCopyMd) {
      btnCopyMd.addEventListener('click', () => {
        if (!currentLoadedMdText) return;
        const ta = document.createElement('textarea');
        ta.value = currentLoadedMdText;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          showToast('📋 Đã sao chép nội dung file Markdown (.md) vào bộ nhớ tạm!');
        } catch (e) {
          showToast('Không thể sao chép tự động.');
        }
        document.body.removeChild(ta);
      });
    }

    // Scroll Progress Bar + Back to Top + Auto-save Scroll Position
    let scrollTimeout = null;
    window.addEventListener('scroll', () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(100, Math.max(0, (window.scrollY / docH) * 100)) : 0;
      const bar = document.getElementById('readingProgressBar');
      if (bar) bar.style.width = `${pct}%`;

      const btnTop = document.getElementById('btnBackToTop');
      if (btnTop) {
        btnTop.classList.toggle('hidden', window.scrollY < 450);
      }

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const ch = CHAPTERS[state.currentChapterIndex];
        if (ch && state.activeTab === 'reader') {
          state.scrollPositions[`${ch.slug}_${state.mode}`] = Math.round(window.scrollY);
          saveState();
        }
      }, 250);
    }, { passive: true });

    const btnTop = document.getElementById('btnBackToTop');
    if (btnTop) {
      btnTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) {
        if (e.key === 'Escape' && e.target && e.target.blur) {
          e.target.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case 'j':
        case 'J':
          e.preventDefault();
          if (state.currentChapterIndex > 0) {
            selectChapter(state.currentChapterIndex - 1);
            showToast(`← Chương ${CHAPTERS[state.currentChapterIndex].num}`);
          }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
        case 'k':
        case 'K':
          e.preventDefault();
          if (state.currentChapterIndex < CHAPTERS.length - 1) {
            selectChapter(state.currentChapterIndex + 1);
            showToast(`Chương ${CHAPTERS[state.currentChapterIndex].num} →`);
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          state.mode = state.mode === 'detailed' ? 'condensed' : 'detailed';
          renderCurrentChapter(false);
          showToast(state.mode === 'detailed' ? '📜 Phiên Bản Dịch Chi Tiết' : '⚡ Phiên Bản Viết Cô Đọng');
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          switchTab(state.activeTab === 'compare' ? 'reader' : 'compare');
          showToast(state.activeTab === 'compare' ? '⚖️ Chế độ Đọc Song Song 2 Bản' : '📖 Chế độ Đọc Đơn');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          state.focusMode = !state.focusMode;
          applyTypographyAndTheme();
          saveState();
          showToast(state.focusMode ? '🧘 Đã bật Chế độ Tập trung (Zen Mode)' : 'Đã tắt Chế độ Tập trung');
          break;
        case 't':
        case 'T':
          e.preventDefault();
          cycleTheme();
          break;
        case 's':
        case 'S':
        case '/':
          e.preventDefault();
          if (window.innerWidth < 1024) openMobileDrawer();
          if (inpSearch) {
            inpSearch.focus();
            inpSearch.select();
          }
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          if (btnBookmark) btnBookmark.click();
          break;
        case '+':
        case '=':
          e.preventDefault();
          changeFontSize(2);
          showToast(`Cỡ chữ: ${state.fontSize}px`);
          break;
        case '-':
        case '_':
          e.preventDefault();
          changeFontSize(-2);
          showToast(`Cỡ chữ: ${state.fontSize}px`);
          break;
        case '?':
        case 'h':
        case 'H':
          e.preventDefault();
          toggleShortcutsModal();
          break;
        case 'Escape':
          closeMobileDrawer();
          toggleShortcutsModal(false);
          break;
      }
    });

    // Mobile Touch Swipe Gesture (Left -> Next Chapter, Right -> Prev Chapter)
    let touchStartX = 0;
    let touchStartY = 0;
    const readerSurface = document.getElementById('singleReaderCard');
    if (readerSurface) {
      readerSurface.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      readerSurface.addEventListener('touchend', (e) => {
        if (!touchStartX) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 2.2) {
          if (dx < 0 && state.currentChapterIndex < CHAPTERS.length - 1) {
            selectChapter(state.currentChapterIndex + 1);
            showToast(`👉 Chuyển sang Chương ${CHAPTERS[state.currentChapterIndex].num}`);
          } else if (dx > 0 && state.currentChapterIndex > 0) {
            selectChapter(state.currentChapterIndex - 1);
            showToast(`👈 Quay lại Chương ${CHAPTERS[state.currentChapterIndex].num}`);
          }
        }
        touchStartX = 0;
      }, { passive: true });
    }
  });
})();
