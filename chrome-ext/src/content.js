window.TCC = window.TCC || {};

(function () {
  // -----------------------------------------
  // Estado de traduções (para tooltip ao clicar)
  // -----------------------------------------
  let currentTranslations = [];
  let translationsMap = new Map(); // original (lowercase) -> tradução

  function setCurrentTranslations(traducoes) {
    currentTranslations = Array.isArray(traducoes) ? traducoes : [];
    translationsMap = new Map();

    for (const t of currentTranslations) {
      if (t && typeof t.original === 'string' && typeof t.traducao === 'string') {
        const key = t.original.toLowerCase();
        if (!translationsMap.has(key)) {
          translationsMap.set(key, t.traducao);
        }
      }
    }
  }

  function getTranslationForWord(word) {
    if (!word) return null;
    const key = String(word).toLowerCase();
    return translationsMap.get(key) || null;
  }

  // -----------------------------------------
  // Cache de traduções + inicialização do grifo
  // -----------------------------------------

  async function getStaleCache() {
    try {
      return await window.TCC.cache.buscarTraducoesCache({ ttlMs: Number.MAX_SAFE_INTEGER });
    } catch {
      return null;
    }
  }

  // extrai só as palavras originais para grifar
  function extractWords(traducoes) {
    const words = [];
    for (const t of (traducoes || [])) {
      if (t?.original && typeof t.original === 'string') {
        words.push(t.original);
      }
    }
    return words;
  }

  function equals(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  async function boot() {
    // grifa imediatamente com o que houver em cache (stale-while-revalidate)
    let cached = await getStaleCache();
    if (cached && cached.length) {
      setCurrentTranslations(cached);
      const cachedWords = extractWords(cached);
      if (cachedWords.length) {
        window.TCC.highlighter.initHighlight(cachedWords);
      }
    }

    // sempre revalida com o backend. se mudou, atualiza o grifo na hora
    try {
      const fresh = await window.TCC.api.buscarTraducoes();
      const changed = !cached || !equals(fresh, cached);
      setCurrentTranslations(fresh);
      if (changed) {
        await window.TCC.cache.salvarTraducoesCache(fresh);
        const freshWords = extractWords(fresh);
        window.TCC.highlighter.refresh(freshWords);
      }
    } catch (e) {
      console.warn('[TCC] Falha ao revalidar traduções:', e);
    }
  }

  // -----------------------------------------
  // Caixa de tradução (popup em cima da seleção)
  // -----------------------------------------

  let popupEl = null;
  let outsideClickHandler = null;

  function removePopup() {
    if (popupEl && popupEl.parentNode) {
      popupEl.parentNode.removeChild(popupEl);
    }
    popupEl = null;

    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler, true);
      outsideClickHandler = null;
    }
  }

  function getSelectionInfo() {
    const selection = window.getSelection ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0) return null;

    const text = selection.toString().trim();
    if (!text) return null;

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();

    // fallback se o rect vier zerado
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      const node = range.startContainer?.parentElement;
      if (node && node.getBoundingClientRect) {
        rect = node.getBoundingClientRect();
      }
    }

    if (!rect) return null;

    return { text, rect };
  }

  function showTranslatePopup(selectionInfo) {
    const { text, rect } = selectionInfo;
    removePopup();

    const el = document.createElement('div');
    el.className = 'tcc-translate-popup';

    const originalEl = document.createElement('div');
    originalEl.className = 'tcc-translate-popup-original';
    originalEl.textContent = text;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tcc-translate-popup-input';
    input.placeholder = 'Digite a tradução';

    const actions = document.createElement('div');
    actions.className = 'tcc-translate-popup-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'tcc-translate-popup-save';
    saveBtn.textContent = 'Salvar';

    actions.appendChild(saveBtn);

    const hint = document.createElement('div');
    hint.className = 'tcc-translate-popup-hint';
    hint.textContent = 'Enter para salvar, Esc para fechar';

    el.appendChild(originalEl);
    el.appendChild(input);
    el.appendChild(actions);
    el.appendChild(hint);

    document.body.appendChild(el);

    // posiciona a caixa perto da seleção
    const popupRect = el.getBoundingClientRect();
    let top = window.scrollY + rect.bottom + 6;
    let left = window.scrollX + rect.left;

    const viewportRight = window.scrollX + window.innerWidth;
    const viewportBottom = window.scrollY + window.innerHeight;

    if (left + popupRect.width > viewportRight - 8) {
      left = Math.max(viewportRight - popupRect.width - 8, window.scrollX + 8);
    }

    if (top + popupRect.height > viewportBottom - 8) {
      top = window.scrollY + rect.top - popupRect.height - 6;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;

    let saving = false;

    async function doSave() {
      const traducao = input.value.trim();
      if (!traducao || saving) return;

      saving = true;
      const originalLabel = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      try {
        // salva no backend
        await window.TCC.api.salvarTraducao(text, traducao);

        // atualiza cache + destaques para já grifar essa nova palavra
        try {
          const fresh = await window.TCC.api.buscarTraducoes();
          await window.TCC.cache.salvarTraducoesCache(fresh);
          setCurrentTranslations(fresh);
          const freshWords = extractWords(fresh);
          window.TCC.highlighter.refresh(freshWords);
        } catch (e) {
          console.warn('[TCC] Tradução salva, mas falhou ao atualizar destaques:', e);
        }

        removePopup();
      } catch (err) {
        console.warn('[TCC] Erro ao salvar tradução:', err);
        saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
    }

    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doSave();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        removePopup();
      }
    });

    outsideClickHandler = function (e) {
      if (popupEl && !popupEl.contains(e.target)) {
        removePopup();
      }
    };
    document.addEventListener('mousedown', outsideClickHandler, true);

    popupEl = el;

    // foca automaticamente no campo de tradução
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  function openTranslatePopupFromSelection() {
    const info = getSelectionInfo();
    if (!info) return;
    showTranslatePopup(info);
  }

  // -----------------------------------------
  // Tooltip da tradução ao clicar no grifo
  // -----------------------------------------

  let tooltipEl = null;

  function removeTooltip() {
    if (tooltipEl && tooltipEl.parentNode) {
      tooltipEl.parentNode.removeChild(tooltipEl);
    }
    tooltipEl = null;
  }

  function showTooltipForHighlight(span) {
    const word = span.dataset.tccWord || span.textContent || '';
    const translation = getTranslationForWord(word.trim());
    if (!translation) {
      removeTooltip();
      return;
    }

    removeTooltip();

    const tip = document.createElement('div');
    tip.className = 'tcc-translate-tooltip';
    tip.textContent = translation;

    document.body.appendChild(tip);

    const rect = span.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let top = window.scrollY + rect.top - tipRect.height - 6;
    let left = window.scrollX + rect.left + (rect.width - tipRect.width) / 2;

    const viewportRight = window.scrollX + window.innerWidth;

    if (left + tipRect.width > viewportRight - 8) {
      left = Math.max(viewportRight - tipRect.width - 8, window.scrollX + 8);
    }

    if (top < window.scrollY + 4) {
      // se não couber acima, joga abaixo da palavra
      top = window.scrollY + rect.bottom + 6;
    }

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

    tooltipEl = tip;
  }

  function handleDocumentClick(e) {
    const target = e.target;

    // não fechar tooltip se clicar dentro dela
    if (tooltipEl && tooltipEl.contains(target)) return;

    // não interferir no popup de tradução
    if (popupEl && popupEl.contains(target)) return;

    const highlight = target.closest && target.closest('span.tcc-highlight');
    if (highlight) {
      showTooltipForHighlight(highlight);
    } else {
      removeTooltip();
    }
  }

  document.addEventListener('click', handleDocumentClick, false);

  // -----------------------------------------
  // Mensagens do background
  // -----------------------------------------

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'refresh-highlights') {
      (async () => {
        try {
          const fresh = await window.TCC.api.buscarTraducoes();
          await window.TCC.cache.salvarTraducoesCache(fresh);
          setCurrentTranslations(fresh);
          const freshWords = extractWords(fresh);
          window.TCC.highlighter.refresh(freshWords);
        } catch (e) {
          console.warn('[TCC] Falha ao atualizar destaques:', e);
        }
      })();
    } else if (msg.type === 'open-translation-box') {
      // atalho Alt+Shift+Y
      openTranslatePopupFromSelection();
    }
  });

  // inicializa grifo assim que o content script carrega
  boot();
})();
