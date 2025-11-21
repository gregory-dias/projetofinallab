// =========================================================
// - Manter o estado das traduções no front-end
// - Consultar cache + API
// - Inicializar e atualizar os grifos (via TCC.highlighter)
// - Criar/posicionar as popups de adicionar/editar tradução
// - Exibir tooltip com a tradução ao clicar no grifo
// - Ouvir mensagens do background (atalho Alt+Shift+Y)
// =========================================================

window.TCC = window.TCC || {};

(function () {
  // -----------------------------------------
  // Estado de traduções (para tooltip ao clicar)
  // currentTranslations: lista completa
  // translationsMap: map de palavra -> { id, traducao }
  // -----------------------------------------
  let currentTranslations = [];
  // original (lowercase) -> { id, traducao }
  let translationsMap = new Map();

  function setCurrentTranslations(traducoes) {
    currentTranslations = Array.isArray(traducoes) ? traducoes : [];
    translationsMap = new Map();

    for (const t of currentTranslations) {
      if (t && typeof t.original === 'string' && typeof t.traducao === 'string') {
        const key = t.original.toLowerCase();
        if (!translationsMap.has(key)) {
          translationsMap.set(key, {
            id: t.id,
            traducao: t.traducao
          });
        }
      }
    }
  }

  // retorna o objeto completo { id, traducao }
  function getTranslationEntry(word) {
    if (!word) return null;
    const key = String(word).toLowerCase();
    return translationsMap.get(key) || null;
  }

  // mantém compatibilidade para quem só precisa do texto traduzido
  function getTranslationForWord(word) {
    const entry = getTranslationEntry(word);
    return entry ? entry.traducao : null;
  }


  // -----------------------------------------
  // Cache de traduções + inicialização do grifo
  // - aplica grifos com cache antigo
  // - depois busca no backend e atualiza se mudou
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

  // Função de bootstrap chamada ao carregar o content script
  // - tenta aplicar cache
  // - depois revalida com backend e refresh nos grifos
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

  // Recupera texto e posição da seleção atual no documento
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

  // Cria popup de NOVA tradução a partir do texto selecionado
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

    el.appendChild(originalEl);
    el.appendChild(input);
    el.appendChild(actions);

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

  // Cria popup de EDIÇÃO de uma tradução existente
  function showEditPopup(options) {
    const { id, original, traducao, rect } = options;
    removePopup();

    const el = document.createElement('div');
    el.className = 'tcc-translate-popup';

    const titleEl = document.createElement('div');
    titleEl.className = 'tcc-translate-popup-original';
    titleEl.textContent = 'editar tradução';

    const originalField = document.createElement('div');
    originalField.className = 'tcc-translate-popup-field';

    const originalLabel = document.createElement('div');
    originalLabel.className = 'tcc-translate-popup-label';
    originalLabel.textContent = 'original';

    const originalInput = document.createElement('input');
    originalInput.type = 'text';
    originalInput.className = 'tcc-translate-popup-input';
    originalInput.placeholder = original; // cinza com o valor atual

    originalField.appendChild(originalLabel);
    originalField.appendChild(originalInput);

    const tradField = document.createElement('div');
    tradField.className = 'tcc-translate-popup-field';

    const tradLabel = document.createElement('div');
    tradLabel.className = 'tcc-translate-popup-label';
    tradLabel.textContent = 'tradução';

    const tradInput = document.createElement('input');
    tradInput.type = 'text';
    tradInput.className = 'tcc-translate-popup-input';
    tradInput.placeholder = traducao; // cinza com o valor atual

    tradField.appendChild(tradLabel);
    tradField.appendChild(tradInput);

    const actions = document.createElement('div');
    actions.className = 'tcc-translate-popup-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'tcc-translate-popup-save';
    saveBtn.textContent = 'salvar';

    actions.appendChild(saveBtn);

    el.appendChild(titleEl);
    el.appendChild(originalField);
    el.appendChild(tradField);
    el.appendChild(actions);

    document.body.appendChild(el);

    // posiciona a caixa perto do highlight
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

    async function doUpdate() {
      if (saving) return;

      const newOriginal = originalInput.value.trim();
      const newTrad = tradInput.value.trim();

      const hasOriginalChange = newOriginal.length > 0;
      const hasTradChange = newTrad.length > 0;

      // se usuário não digitou nada em nenhum dos campos, não manda update
      if (!hasOriginalChange && !hasTradChange) {
        removePopup();
        return;
      }

      saving = true;
      const originalLabel = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Salvando...';

      try {
        // envia só o que realmente foi digitado
        await window.TCC.api.atualizarTraducao(
          id,
          hasOriginalChange ? newOriginal : undefined,
          hasTradChange ? newTrad : undefined
        );

        // revalida tudo e atualiza grifos
        try {
          const fresh = await window.TCC.api.buscarTraducoes();
          await window.TCC.cache.salvarTraducoesCache(fresh);
          setCurrentTranslations(fresh);
          const freshWords = extractWords(fresh);
          window.TCC.highlighter.refresh(freshWords);
        } catch (e) {
          console.warn('[TCC] Tradução atualizada, mas falhou ao atualizar destaques:', e);
        }

        removePopup();
      } catch (err) {
        console.warn('[TCC] Erro ao atualizar tradução:', err);
        saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = originalLabel;
      }
    }

    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doUpdate();
    });

    function handleKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doUpdate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        removePopup();
      }
    }

    originalInput.addEventListener('keydown', handleKey);
    tradInput.addEventListener('keydown', handleKey);

    outsideClickHandler = function (e) {
      if (popupEl && popupEl.contains(e.target)) {
        // nada
      } else if (popupEl) {
        removePopup();
      }
    };
    document.addEventListener('mousedown', outsideClickHandler, true);

    popupEl = el;

    // foco no campo de tradução (mais usado)
    setTimeout(() => {
      tradInput.focus();
      tradInput.select();
    }, 0);
  }

  // Função chamada ao receber mensagem do background para abrir a caixa de tradução em cima da seleção
  function openTranslatePopupFromSelection() {
    const info = getSelectionInfo();
    if (!info) return;
    showTranslatePopup(info);
  }

  // -----------------------------------------
  // Tooltip da tradução ao clicar no grifo
  // - Título "Tradução"
  // - Chip a palavra original
  // - Box interna com o texto traduzido
  // - Botões "Editar" e "Excluir"
  // -----------------------------------------

  let tooltipEl = null;

  function removeTooltip() {
    if (tooltipEl && tooltipEl.parentNode) {
      tooltipEl.parentNode.removeChild(tooltipEl);
    }
    tooltipEl = null;
  }

  function showTooltipForHighlight(span) {
    const rawWord = span.dataset.tccWord || span.textContent || '';
    const word = rawWord.trim();

    const entry = getTranslationEntry(word);
    if (!entry) {
      removeTooltip();
      return;
    }

    const { id, traducao } = entry;

    removeTooltip();

    // container principal do tooltip
    const tip = document.createElement('div');
    tip.className = 'tcc-translate-tooltip';

    // conteúdo interno
    const content = document.createElement('div');
    content.className = 'tcc-translate-tooltip-content';

    // ---------- HEADER: título "tradução" + chip com a palavra ----------
    const header = document.createElement('div');
    header.className = 'tcc-translate-tooltip-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'tcc-translate-tooltip-title';
    titleEl.textContent = 'tradução';

    const originalChip = document.createElement('div');
    originalChip.className = 'tcc-translate-tooltip-original-chip';
    originalChip.textContent = word;

    header.appendChild(titleEl);
    header.appendChild(originalChip);

    // ---------- TEXTO DA TRADUÇÃO (dentro da box interna) ----------
    const textEl = document.createElement('div');
    textEl.className = 'tcc-translate-tooltip-text';
    textEl.textContent = traducao;

    // ---------- AÇÕES (Editar / Excluir) ----------
    const actions = document.createElement('div');
    actions.className = 'tcc-translate-tooltip-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'tcc-translate-tooltip-btn tcc-translate-tooltip-edit';
    editBtn.textContent = 'editar';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tcc-translate-tooltip-btn tcc-translate-tooltip-delete';
    deleteBtn.textContent = 'excluir';

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    // monta a hierarquia
    content.appendChild(header);
    content.appendChild(textEl);
    content.appendChild(actions);

    tip.appendChild(content);
    document.body.appendChild(tip);

    // ---------- POSICIONAMENTO DO TOOLTIP ----------
    const rect = span.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let top = window.scrollY + rect.top - tipRect.height - 8;
    let left = window.scrollX + rect.left + (rect.width - tipRect.width) / 2;
    let placeBelow = false;

    const viewportRight = window.scrollX + window.innerWidth;

    if (left + tipRect.width > viewportRight - 8) {
      left = Math.max(viewportRight - tipRect.width - 8, window.scrollX + 8);
    }

    // se não couber acima, joga o tooltip para baixo da palavra
    if (top < window.scrollY + 4) {
      top = window.scrollY + rect.bottom + 8;
      placeBelow = true;
    }

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

    if (placeBelow) {
      tip.classList.add('tcc-translate-tooltip--below');
    }

    tooltipEl = tip;

    // ---------- (DELETE + revalidar grifos) ----------
    let deleting = false;
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (deleting) return;
      deleting = true;

      const originalLabel = deleteBtn.textContent;
      deleteBtn.textContent = '...';

      try {
        await window.TCC.api.excluirTraducao(id);

        try {
          const fresh = await window.TCC.api.buscarTraducoes();
          await window.TCC.cache.salvarTraducoesCache(fresh);
          setCurrentTranslations(fresh);
          const freshWords = extractWords(fresh);
          window.TCC.highlighter.refresh(freshWords);
        } catch (err) {
          console.warn('[TCC] Tradução excluída, mas falhou ao atualizar destaques:', err);
        }

        removeTooltip();
      } catch (err) {
        console.warn('[TCC] Erro ao excluir tradução:', err);
        deleting = false;
        deleteBtn.textContent = originalLabel;
      }
    });

    // ---------- (abre popup de edição existente) ----------
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const highlightRect = span.getBoundingClientRect();
      removeTooltip();

      showEditPopup({
        id,
        original: word,
        traducao,
        rect: highlightRect
      });
    });
  }

  // -----------------------------------------
  // Clique no documento:
  // - Se clicar num grifo, abre tooltip
  // - Se clicar fora, fecha tooltip/popup
  // -----------------------------------------
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
  // - refresh-highlights: força recarregar traduções e grifos
  // - open-translation-box: abre popup de nova tradução
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

  // -----------------------------------------
  // Inicialização: assim que o content script carrega, boot() aplica/atualiza os grifos.
  // -----------------------------------------
  boot();
})();
