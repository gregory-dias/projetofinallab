// =========================================================
// Service Worker
// - Atalho de teclado (Alt+Shift+Y) para abrir a caixa de tradução
// - Menu de contexto (botão direito) em texto selecionado
// - Enviar mensagens para o content script abrir a caixa
// =========================================================

async function openTranslationBoxOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'open-translation-box' });
}

// ---------------------------------------------------------
// ATALHO DE TECLADO (chrome.commands)
// - Definido no manifest como "ativar_caixa_traducao"
// - Atalho: Alt+Shift+Y
// ---------------------------------------------------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'ativar_caixa_traducao') return;

  await openTranslationBoxOnActiveTab();
});

// ---------------------------------------------------------
// MENU DE CONTEXTO (CLICK DIREITO)
// - Só aparece quando há "selection" (texto selecionado)
// ---------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'tcc_add_translation',                  // ID interno do item de menu
    title: 'Adicionar tradução (TCC Tradutor)', // texto que aparece no menu
    contexts: ['selection']                     // só aparece em texto selecionado
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'tcc_add_translation') return;
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'open-translation-box' });
});
