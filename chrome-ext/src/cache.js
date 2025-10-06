// chrome.storage.local com TTL
window.TCC = window.TCC || {};

(function () {
  const KEY = 'tcc_traducoes_cache'; // chave única do cache
  const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

  async function obterCache() {
    const {[KEY]: value} = await chrome.storage.local.get(KEY);
    return value || null;
  }

  async function defineCache(data) {
    const payload = {data, fetchedAt: Date.now()};
    await chrome.storage.local.set({[KEY]: payload});
    return payload;
  }

  async function buscarTraducoesCache({ttlMs = DEFAULT_TTL_MS} = {}) {
    const cached = await obterCache();
    if (cached && (Date.now() - cached.fetchedAt) < ttlMs) { // se houver cache válido e dentro do TTL
      return cached.data;
    }
    return null; // retorna null
  }

  async function salvarTraducoesCache(traducoes) {
    return defineCache(traducoes);
  }

  // não sei se vai ser útil mas já deixo pronto
  async function limparTraducoes() {
    await chrome.storage.local.remove(KEY);
  }

  window.TCC.cache = {
    buscarTraducoesCache,
    salvarTraducoesCache,
    limparTraducoes
  };
})();