// =========================================================
// Camada de acesso à API backend (FastAPI)
// - salvarTraducao
// - buscarTraducoes
// - atualizarTraducao
// - excluirTraducao
// =========================================================

window.TCC = window.TCC || {};

(function () {
  // =======================================================
  // URL da API
  // =======================================================
  const BASE_URL = 'http://127.0.0.1:8000';

  // =======================================================
  // POST /salvar
  // =======================================================
  async function salvarTraducao(textoOriginal, textoTraduzido) {
    const response = await fetch(`${BASE_URL}/salvar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original: textoOriginal, traduzido: textoTraduzido })
    });
    if (!response.ok) throw new Error('Erro ao salvar tradução');
    return response.json();
  }

  // =======================================================
  // GET /traduzidas/usuario123
  // =======================================================
  async function buscarTraducoes() {
    const response = await fetch(`${BASE_URL}/traduzidas/usuario123`);
    if (!response.ok) throw new Error('Erro ao buscar traduções');
    const traducoes = await response.json();
    // normaliza para um formato único
    return traducoes.map(t => ({
      id: t.id,
      original: t.original || '',
      traducao: t.traduzido || ''
    }));
  }

  // =======================================================
  // PUT /traducao/{id}
  // =======================================================
  async function atualizarTraducao(idTraducao, novoOriginal, novoTraduzido) {
    const payload = {};
    if (typeof novoOriginal !== 'undefined') payload.original = novoOriginal;
    if (typeof novoTraduzido !== 'undefined') payload.traduzido = novoTraduzido;

    const response = await fetch(`${BASE_URL}/traducao/${idTraducao}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Erro ao atualizar tradução: ${await response.text()}`);
    return response.json();
  }

  // =======================================================
  // DELETE /traducao/{id}
  // =======================================================
  async function excluirTraducao(idTraducao) {
    const response = await fetch(`${BASE_URL}/traducao/${idTraducao}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Erro ao excluir tradução: ${await response.text()}`);
    return response.json();
  }

  // =======================================================
  // Exporta as funções na namespace: window.TCC.api
  // =======================================================
  window.TCC.api = {
    salvarTraducao,
    buscarTraducoes,
    atualizarTraducao,
    excluirTraducao
  };
})();
