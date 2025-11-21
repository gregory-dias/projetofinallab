// =========================================================
// Camada de cache de tradução no chrome.storage.local
// - Salvar as traduções no chrome.storage.local
// - Aplicar TTL (tempo de expiração) para o cache
// - Fornecer funções para buscar, salvar e limpar o cache
// =========================================================

// chrome.storage.local com TTL
window.TCC = window.TCC || {};

(function () {
  // -------------------------------------------------------
  // CONFIGURAÇÃO DO CACHE
  // KEY: chave única usada no chrome.storage.local
  // DEFAULT_TTL_MS: tempo padrão de validade do cache (5 minutos)
  // -------------------------------------------------------
  const KEY = 'tcc_traducoes_cache'; // chave única do cache
  const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

  // -------------------------------------------------------
  // FUNÇÃO INTERNA: obterCache
  // Lê do chrome.storage.local a entrada salva na chave KEY.
  // Retorna:
  //   - objeto { data, fetchedAt } ou
  //   - null caso não exista nada salvo.
  // -------------------------------------------------------
  async function obterCache() {
    const { [KEY]: value } = await chrome.storage.local.get(KEY);
    return value || null;
  }

  // -------------------------------------------------------
  // FUNÇÃO INTERNA: defineCache
  // Salva no chrome.storage.local, com o formato:
  //   {
  //     data: <dados das traduções>,
  //     fetchedAt: <timestamp em ms>
  //   }
  // -------------------------------------------------------
  async function defineCache(data) {
    const payload = { data, fetchedAt: Date.now() };
    await chrome.storage.local.set({ [KEY]: payload });
    return payload;
  }

  // -------------------------------------------------------
  // buscarTraducoesCache
  // Tenta retornar o cache se:
  //   - existir algo salvo; e
  //   - o tempo desde fetchedAt for menor que o TTL informado.
  //
  // Parâmetros:
  //   - { ttlMs = DEFAULT_TTL_MS }: tempo máximo de validade em ms.
  //
  // Retorno:
  //   - cached.data (lista de traduções) se ainda estiver válido; ou
  //   - null se não houver cache ou se estiver expirado.
  // -------------------------------------------------------
  async function buscarTraducoesCache({ ttlMs = DEFAULT_TTL_MS } = {}) {
    const cached = await obterCache();
    if (cached && (Date.now() - cached.fetchedAt) < ttlMs) { // se houver cache válido e dentro do TTL
      return cached.data;
    }
    return null; // retorna null
  }

  // -------------------------------------------------------
  // salvarTraducoesCache
  // Recebe a lista de traduções (traducoes) e sobrescreve o cache
  // chamando defineCache.
  // -------------------------------------------------------
  async function salvarTraducoesCache(traducoes) {
    return defineCache(traducoes);
  }

  // -------------------------------------------------------
  // limparTraducoes
  // Não utilizado, mas já deixo pronto
  // Remove completamente a entrada de cache do chrome.storage.local
  // -------------------------------------------------------
  async function limparTraducoes() {
    await chrome.storage.local.remove(KEY);
  }

  // -------------------------------------------------------
  // Exporta as funções na namespace: window.TCC.cache
  // -------------------------------------------------------
  window.TCC.cache = {
    buscarTraducoesCache,
    salvarTraducoesCache,
    limparTraducoes
  };
})();