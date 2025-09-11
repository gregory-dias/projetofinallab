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


async function buscarTraducoes() {
  try {
    const response = await fetch('http://127.0.0.1:8000/traduzidas/usuario123');

    if (!response.ok) {
      throw new Error('Erro ao buscar traduções');
    }

    const traducoes = await response.json();
    console.log('Traduções encontradas:', traducoes);

    palavrasComTraducao = traducoes.map(traducao => ({
      original: traducao.original,
      traducao: traducao.traduzido
    }));

  } catch (error) {
    console.error(error);
  }
}