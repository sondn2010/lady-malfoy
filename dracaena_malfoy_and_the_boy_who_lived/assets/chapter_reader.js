/* ==========================================================================
   Standalone Chapter HTML Reader Script (Dynamic CSV + AJAX Markdown + Keys)
   File: assets/chapter_reader.js
   ========================================================================== */
(function () {
  const bodyEl = document.body;
  const currentSlug = bodyEl.getAttribute('data-slug') || '';
  const currentMode = bodyEl.getAttribute('data-mode') || 'detailed';
  const mdFilename = currentSlug + '.md';
  const folderName = currentMode === 'detailed' ? '02_phien_ban_chi_tiet' : '01_phien_ban_co_dong';
  const otherFolder = currentMode === 'detailed' ? '01_phien_ban_co_dong' : '02_phien_ban_chi_tiet';
  const relMdKey = folderName + '/' + mdFilename;

  let settings = {
    fontSize: 18,
    theme: 'dark' // 'dark' | 'parchment' | 'sepia'
  };

  try {
    const saved = localStorage.getItem('dracaena_ajax_reader_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.fontSize) settings.fontSize = parsed.fontSize;
      if (parsed.theme) settings.theme = parsed.theme;
    }
  } catch (e) {}

  function applySettings() {
    bodyEl.classList.remove('theme-dark', 'theme-parchment', 'theme-sepia');
    bodyEl.classList.add('theme-' + (settings.theme || 'dark'));
    document.documentElement.style.setProperty('--reader-font-size', settings.fontSize + 'px');
    try {
      const saved = JSON.parse(localStorage.getItem('dracaena_ajax_reader_state') || '{}');
      saved.fontSize = settings.fontSize;
      saved.theme = settings.theme;
      localStorage.setItem('dracaena_ajax_reader_state', JSON.stringify(saved));
    } catch (e) {}
  }

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
    return rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] !== undefined ? r[idx] : '').trim();
      });
      obj.num = parseInt(obj.num, 10) || 0;
      obj.year = parseInt(obj.year, 10) || 1;
      return obj;
    });
  }

  function renderMarkdown(mdText) {
    const lines = mdText.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('# Chương ') || line.startsWith('**Tên gốc:**') || line.startsWith('**Tác giả:**') || line.startsWith('**Phiên bản:**')) {
        continue;
      }
      const imgMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        out.push(`<figure class="my-6 rounded-2xl overflow-hidden border border-slate-700/50 shadow-lg bg-slate-950/40"><img src="${imgMatch[2]}" alt="${imgMatch[1]}" class="w-full h-auto object-cover max-h-[420px]"></figure>`);
        continue;
      }
      if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && out.length > 0 && out[out.length - 1].includes('<figure')) {
        const cap = line.slice(1, -1);
        out[out.length - 1] = out[out.length - 1].replace('</figure>', `<figcaption class="p-3 text-xs sm:text-sm text-center opacity-80 italic">${cap}</figcaption></figure>`);
        continue;
      }
      if (line.startsWith('> ')) {
        const q = line.slice(2).replace(/^"|"$/g, '');
        out.push(`<blockquote class="reader-quote my-6 p-4 sm:p-5 border-l-4 rounded-r-xl italic font-serif-display text-base sm:text-lg">"${q}"</blockquote>`);
        continue;
      }
      if (line.startsWith('### ')) {
        out.push(`<h3>${line.slice(4)}</h3>`);
        continue;
      }
      if (line.startsWith('- ')) {
        let c = line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
        out.push(`<li class="ml-5 list-disc mb-2 leading-relaxed">${c}</li>`);
        continue;
      }
      let c = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
      out.push(`<p>${c}</p>`);
    }
    return out.join('\n');
  }

  function loadFallbackBundle() {
    if (window.OFFLINE_MD_STORE && window.OFFLINE_CSV_TEXT) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '../assets/md_fallback.js';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.body.appendChild(s);
    });
  }

  let prevUrl = null;
  let nextUrl = null;
  let switchModeUrl = `../${otherFolder}/${currentSlug}.html`;

  async function initChapterPage() {
    applySettings();
    const statusEl = document.getElementById('ajaxStatus');
    const contentEl = document.getElementById('mdContent');
    const switchBtn = document.getElementById('btnSwitchVersion');
    if (switchBtn) {
      switchBtn.href = switchModeUrl;
      switchBtn.textContent = currentMode === 'detailed' ? '⚡ Xem Bản Cô Đọng (Phím M)' : '📜 Xem Bản Chi Tiết (Phím M)';
    }

    // 1. Load ../chapters.csv to dynamically wire Prev / Next links & total chapters
    try {
      let csvText = '';
      try {
        const resCsv = await fetch('../chapters.csv');
        if (!resCsv.ok) throw new Error('HTTP ' + resCsv.status);
        csvText = await resCsv.text();
      } catch (e) {
        await loadFallbackBundle();
        csvText = window.OFFLINE_CSV_TEXT || '';
      }
      if (csvText) {
        const chapters = parseCSV(csvText);
        const idx = chapters.findIndex(c => c.slug === currentSlug);
        if (idx !== -1) {
          const ch = chapters[idx];
          const metaYear = document.getElementById('chMetaYear');
          if (metaYear) metaYear.textContent = `${ch.year_title || ('Năm thứ ' + ch.year)} • Chương ${String(ch.num).padStart(2, '0')}/${chapters.length}`;
          const prevCh = idx > 0 ? chapters[idx - 1] : null;
          const nextCh = idx < chapters.length - 1 ? chapters[idx + 1] : null;
          const btnPrev = document.getElementById('btnPrevCh');
          const btnNext = document.getElementById('btnNextCh');
          const mobPrev = document.getElementById('mobPrevCh');
          const mobNext = document.getElementById('mobNextCh');

          if (prevCh) {
            prevUrl = `${prevCh.slug}.html`;
            if (btnPrev) btnPrev.href = prevUrl;
            if (mobPrev) mobPrev.href = prevUrl;
          } else {
            if (btnPrev) btnPrev.classList.add('opacity-40', 'pointer-events-none');
            if (mobPrev) mobPrev.classList.add('opacity-40', 'pointer-events-none');
          }
          if (nextCh) {
            nextUrl = `${nextCh.slug}.html`;
            if (btnNext) btnNext.href = nextUrl;
            if (mobNext) mobNext.href = nextUrl;
          } else {
            if (btnNext) btnNext.classList.add('opacity-40', 'pointer-events-none');
            if (mobNext) mobNext.classList.add('opacity-40', 'pointer-events-none');
          }
        }
      }
    } catch (e) {}

    // 2. Load Markdown via AJAX
    try {
      const res = await fetch(mdFilename, { headers: { 'Accept': 'text/markdown, text/plain, */*' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const mdText = await res.text();
      contentEl.innerHTML = renderMarkdown(mdText);
      statusEl.innerHTML = `✅ Đã tải <code>./${mdFilename}</code> &amp; đồng bộ mục lục từ <code>../chapters.csv</code> qua AJAX. (Phím tắt: <kbd class="shortcut-key">←</kbd> <kbd class="shortcut-key">→</kbd> chuyển chương, <kbd class="shortcut-key">M</kbd> đổi bản đọc, <kbd class="shortcut-key">T</kbd> đổi nền)`;
    } catch (err) {
      await loadFallbackBundle();
      if (window.OFFLINE_MD_STORE && window.OFFLINE_MD_STORE[relMdKey]) {
        contentEl.innerHTML = renderMarkdown(window.OFFLINE_MD_STORE[relMdKey]);
        statusEl.innerHTML = `📂 Đang mở qua <code>file://</code> — đã nạp nội dung <code>${mdFilename}</code> và danh sách chương từ <code>chapters.csv</code>.`;
      }
    }
  }

  // Controls & Keyboard Shortcuts
  window.addEventListener('DOMContentLoaded', () => {
    initChapterPage();

    const btnDec = document.getElementById('btnChFontDec');
    const btnInc = document.getElementById('btnChFontInc');
    const btnTheme = document.getElementById('btnChTheme');

    if (btnDec) btnDec.addEventListener('click', () => {
      settings.fontSize = Math.max(14, settings.fontSize - 2);
      applySettings();
    });
    if (btnInc) btnInc.addEventListener('click', () => {
      settings.fontSize = Math.min(28, settings.fontSize + 2);
      applySettings();
    });
    if (btnTheme) btnTheme.addEventListener('click', () => {
      const order = ['dark', 'parchment', 'sepia'];
      settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
      applySettings();
    });

    window.addEventListener('scroll', () => {
      const bar = document.getElementById('readingProgressBar');
      if (!bar) return;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(100, Math.max(0, (window.scrollY / docH) * 100)) : 0;
      bar.style.width = pct + '%';
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'j' || e.key === 'J') {
        if (prevUrl) window.location.href = prevUrl;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'k' || e.key === 'K') {
        if (nextUrl) window.location.href = nextUrl;
      } else if (e.key === 'm' || e.key === 'M') {
        window.location.href = switchModeUrl;
      } else if (e.key === 't' || e.key === 'T') {
        const order = ['dark', 'parchment', 'sepia'];
        settings.theme = order[(order.indexOf(settings.theme) + 1) % order.length];
        applySettings();
      }
    });

    // Touch swipe left/right on mobile
    let touchStartX = 0;
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!touchStartX) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 85 && Math.abs(dx) > Math.abs(dy) * 2.2) {
        if (dx < 0 && nextUrl) window.location.href = nextUrl;
        if (dx > 0 && prevUrl) window.location.href = prevUrl;
      }
      touchStartX = 0;
    }, { passive: true });
  });
})();
