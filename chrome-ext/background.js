// Escuta o atalho (Alt+Shift+Y) e pede ao content script para abrir a caixa de tradução.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'ativar_caixa_traducao') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // agora a mensagem é para abrir a caixa de tradução
  chrome.tabs.sendMessage(tab.id, { type: 'open-translation-box' });
});