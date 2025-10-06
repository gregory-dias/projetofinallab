window.TCC = window.TCC || {};

(function () {
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'AUDIO', 'VIDEO', 'OBJECT', 'EMBED', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SVG']);
  let words = [];
  let regex = null;
  let observer = null;

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

  function shouldSkip(node) {
    if (!node || !node.parentNode) return true;
    const parent = node.parentNode;
    // não processa dentro de tags proibidas
    if (SKIP_TAGS.has(parent.nodeName)) return true;
    // não reprocessa dentro de highlights
    if (parent.closest && parent.closest('.tcc-highlight')) return true;
    return false;
  }

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

  window.TCC.highlighter = {
    initHighlight,
    refresh,
    clearHighlights
  };
})();
