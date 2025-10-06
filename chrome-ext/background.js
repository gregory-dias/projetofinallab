// Escuta o atalho (Ctrl+Y / Cmd+Y) e pede ao content script para atualizar o grifo.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'ativar_caixa_traducao') return;

  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {type: 'refresh-highlights'});
});