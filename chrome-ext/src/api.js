window.TCC = window.TCC || {};

(function () {
  const BASE_URL = 'http://127.0.0.1:8000';

  // CREATE
  async function salvarTraducao(textoOriginal, textoTraduzido) {
    const response = await fetch(`${BASE_URL}/salvar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original: textoOriginal, traduzido: textoTraduzido })
    });
    if (!response.ok) throw new Error('Erro ao salvar tradução');
    return response.json();
  }

  // GET
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

  // UPDATE
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

  // DELETE
  async function excluirTraducao(idTraducao) {
    const response = await fetch(`${BASE_URL}/traducao/${idTraducao}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(`Erro ao excluir tradução: ${await response.text()}`);
    return response.json();
  }

  window.TCC.api = {
    salvarTraducao,
    buscarTraducoes,
    atualizarTraducao,
    excluirTraducao
  };
})();