window.TCC = window.TCC || {};

(function () {
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
      const cachedWords = extractWords(cached);
      if (cachedWords.length) {
        window.TCC.highlighter.initHighlight(cachedWords);
      }
    }

    // sempre revalida com o backend. se mudou atualiza o grifo na hora
    try {
      const fresh = await window.TCC.api.buscarTraducoes();

      const changed = !cached || !equals(fresh, cached);
      if (changed) {
        await window.TCC.cache.salvarTraducoesCache(fresh);
        const freshWords = extractWords(fresh);
        window.TCC.highlighter.refresh(freshWords);
      }
    } catch (e) {
      console.warn('[TCC] Falha ao revalidar traduções:', e);
    }
  }

  // mensagem do background para "forçar" atualizar (atalho de teclado)
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'refresh-highlights') return;

    try {
      const fresh = await window.TCC.api.buscarTraducoes();
      await window.TCC.cache.salvarTraducoesCache(fresh);
      const freshWords = extractWords(fresh);
      window.TCC.highlighter.refresh(freshWords);
    } catch (e) {
      console.warn('[TCC] Falha ao atualizar destaques:', e);
    }
  });

  boot();
})();