// CREATE
async function salvarTraducao(textoOriginal, textoTraduzido) {
  try {
    const response = await fetch('http://127.0.0.1:8000/salvar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        original: textoOriginal,
        traduzido: textoTraduzido
      })
    });

    if (!response.ok) {
      throw new Error('Erro ao salvar tradução');
    }

    const data = await response.json();
    console.log('Tradução salva:', data);

    await buscarTraducoes();

  } catch (error) {
    console.error(error);
  }
}

// GET
async function buscarTraducoes() {
  try {
    const response = await fetch('http://127.0.0.1:8000/traduzidas/usuario123');

    if (!response.ok) {
      throw new Error('Erro ao buscar traduções');
    }

    const traducoes = await response.json();
    console.log('Traduções encontradas:', traducoes);

    palavrasComTraducao = traducoes.map(traducao => ({
      id: traducao.id,
      original: traducao.original,
      traducao: traducao.traduzido
    }));

  } catch (error) {
    console.error(error);
  }
}

// UPDATE
async function atualizarTraducao(idTraducao, novoOriginal, novoTraduzido) {
  try {
    const payload = {};
    if (typeof novoOriginal !== 'undefined') payload.original = novoOriginal;
    if (typeof novoTraduzido !== 'undefined') payload.traduzido = novoTraduzido;

    const response = await fetch(`http://127.0.0.1:8000/traducao/${idTraducao}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao atualizar tradução: ${errText}`);
    }

    const data = await response.json();
    console.log('Tradução atualizada:', data);

    await buscarTraducoes();
  } catch (error) {
    console.error(error);
  }
}

// DELETE
async function excluirTraducao(idTraducao) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/traducao/${idTraducao}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao excluir tradução: ${errText}`);
    }

    const data = await response.json();
    console.log('Tradução excluída:', data);

    await buscarTraducoes();
  } catch (error) {
    console.error(error);
  }
}