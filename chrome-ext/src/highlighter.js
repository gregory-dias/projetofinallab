// =========================================================
// Lógica para grifar palavras na página
// - Montar a regex com as palavras salvas
// - Percorrer o DOM e envolver matches em <span.tcc-highlight>
// - Observar mudanças no DOM (MutationObserver) para grifar conteúdo carregado depois (scroll, lazy-load, etc)
// - Limpar e recriar os destaques quando necessário
// =========================================================

window.TCC = window.TCC || {};

(function () {
  // -------------------------------------------------------
  // CONFIGURAÇÃO INICIAL
  // SKIP_TAGS: tags onde não queremos grifar (script, style, etc).
  // words: lista de palavras
  // regex: expressão regular montada com as palavras
  // observer: MutationObserver para escutar mudanças no DOM
  // -------------------------------------------------------
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'AUDIO', 'VIDEO', 'OBJECT', 'EMBED', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SVG']);
  let words = [];
  let regex = null;
  let observer = null;

  // -------------------------------------------------------
  // FUNÇÕES UTILITÁRIAS (regex)
  // -------------------------------------------------------
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildRegexFromWords(list) {
    const unique = Array.from(new Set(list.filter(Boolean).map(s => s.trim()).filter(s => s.length > 0)));
    if (unique.length === 0) return null;

    const pattern = '\\b(' + unique.map(escapeRegExp).join('|') + ')\\b';
    try {
      return new RegExp(pattern, 'giu'); // g: global, i: case-insensitive, u: unicode
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------
  // FILTRO DE NÓS: decide se um nó de texto deve ser ignorado
  // - tags proibidas;
  // - já dentro de highlight;
  // - dentro das caixas da extensão (popup/tooltip).
  // -------------------------------------------------------
  function shouldSkip(node) {
    if (!node || !node.parentNode) return true;

    const parent = node.parentNode;

    // não processa dentro de tags proibidas
    if (SKIP_TAGS.has(parent.nodeName)) return true;

    // não reprocessa dentro de outros highlights
    if (parent.closest && parent.closest('.tcc-highlight')) return true;

    // não grifa dentro das caixas de tradução
    if (
      parent.closest &&
      parent.closest('.tcc-translate-tooltip, .tcc-translate-popup')
    ) {
      return true;
    }

    return false;
  }

  // -------------------------------------------------------
  // FUNÇÃO PRINCIPAL PARA DESTACAR UM NÓ DE TEXTO
  // - Envolve cada match da regex em <span class="tcc-highlight">
  //   e guarda a palavra original no dataset (data-tcc-word).
  // -------------------------------------------------------
  function highlightTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !regex) return;

    const matches = text.match(regex);
    if (!matches) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    regex.lastIndex = 0;
    let m;

    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = regex.lastIndex;

      // texto antes
      if (start > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
      }

      // match destacado
      const span = document.createElement('span');
      span.className = 'tcc-highlight';
      span.textContent = text.slice(start, end);
      span.dataset.tccWord = m[1] || span.textContent;
      frag.appendChild(span);

      lastIndex = end;
    }

    // pedaço final
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(frag);
  }

  // -------------------------------------------------------
  // PERCORRE A ÁRVORE A PARTIR DE UM ROOT E DESTACA TEXTOS
  // Usado:
  // - na inicialização (root = document.body)
  // - quando novos elementos são adicionados ao DOM.
  // -------------------------------------------------------
  function walkAndHighlight(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const toProcess = [];
    let node;

    while ((node = walker.nextNode())) {
      toProcess.push(node);
    }

    for (const textNode of toProcess) {
      highlightTextNode(textNode);
    }
  }

  // -------------------------------------------------------
  // MUTATION OBSERVER
  // Observa novos nós adicionados ao DOM e aplica highlight.
  // -------------------------------------------------------
  function onMutations(mutations) {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType === Node.TEXT_NODE) {
          if (!shouldSkip(added)) highlightTextNode(added);
        } else if (added.nodeType === Node.ELEMENT_NODE) {
          walkAndHighlight(added);
        }
      }
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
  }

  // -------------------------------------------------------
  // FUNÇÕES PARA LIMPAR E REINICIALIZAR OS HIGHLIGHTS
  // clearHighlights: remove spans de highlight
  // initHighlight: inicializa regex + aplica nos conteúdos
  // refresh: limpa tudo e recria com nova lista de palavras
  // -------------------------------------------------------
  function clearHighlights() {
    // volta spans para texto puro (simples: substitui cada span por texto interno)
    const spans = document.querySelectorAll('span.tcc-highlight');
    for (const span of spans) {
      span.replaceWith(document.createTextNode(span.textContent || ''));
    }
  }

  function initHighlight(wordList) {
    words = Array.isArray(wordList) ? wordList : [];
    regex = buildRegexFromWords(words);
    if (!regex) return;

    // 1) grifa o conteúdo atual
    walkAndHighlight(document.body);

    // 2) observa novos nós adicionados (scroll/lazy load)
    startObserver();
  }

  function refresh(wordList) {
    stopObserver();
    clearHighlights();
    initHighlight(wordList);
  }

  // -------------------------------------------------------
  // Exporta as funções na namespace: window.TCC.highlighter
  // -------------------------------------------------------
  window.TCC.highlighter = {
    initHighlight,
    refresh,
    clearHighlights
  };
})();
