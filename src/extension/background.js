// Service worker: ayarları okur, LLM çağrısını yapar ve tam içerik betiğini
// gerektiğinde sekmeye enjekte eder. API anahtarı yalnızca chrome.storage.local ve
// bu bağlamda bulunur; sayfaya veya içerik betiğine verilmez (isteğe bağlı page-agent
// gezinme modu hariç — bkz. README "Güvenlik").

import { analyzePage } from '../core/analyze.js';

const MAX_PAGE_CHARS = 400_000; // aşırı büyük sayfalar maliyet/kota için reddedilir

async function getLLMConfig() {
  const s = await chrome.storage.local.get(['provider', 'apiKey', 'model', 'baseURL']);
  if (!s.provider || (!s.apiKey && s.provider !== 'openai')) return null;
  if (s.provider === 'openai' && !s.apiKey && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(s.baseURL || '')) return null;
  return { provider: s.provider, apiKey: s.apiKey, model: s.model || undefined, baseURL: s.baseURL || undefined };
}

/** Tam içerik betiği (page-agent + panel) sekmede yoksa enjekte eder. */
async function ensureContent(tabId) {
  const [{ result: loaded } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: () => !!window.__satirArasiLoaded });
  if (!loaded) await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await ensureContent(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
});

function isValidPage(p) {
  return p && typeof p.visibleText === 'string' && p.visibleText.length <= MAX_PAGE_CHARS &&
    Array.isArray(p.hiddenSegments) && p.hiddenSegments.every((s) => typeof s?.text === 'string' && typeof s?.reason === 'string');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Yalnızca kendi içerik betiklerimizden (bir sekmeden) gelen mesajlar.
  if (sender.id !== chrome.runtime.id) return false;

  if (msg?.type === 'legalPageDetected' && sender.tab?.id != null) {
    ensureContent(sender.tab.id).catch(() => {});
    return false;
  }
  if (msg?.type === 'analyze') {
    if (!sender.tab || !isValidPage(msg.page)) { sendResponse({ error: 'Geçersiz veya çok büyük sayfa verisi' }); return false; }
    (async () => {
      const cfg = await getLLMConfig();
      const report = await analyzePage(msg.page, cfg);
      return { report };
    })().then(sendResponse, (err) => sendResponse({ error: err?.message || String(err) }));
    return true; // asenkron yanıt
  }
  if (msg?.type === 'agentConfig') {
    chrome.storage.local.get(['agentEnabled', 'agentBaseURL', 'agentModel', 'agentApiKey']).then((s) => {
      sendResponse(s.agentEnabled && s.agentBaseURL && s.agentModel ? { baseURL: s.agentBaseURL, model: s.agentModel, apiKey: s.agentApiKey || '' } : null);
    });
    return true;
  }
  if (msg?.type === 'openOptions') chrome.runtime.openOptionsPage();
  return false;
});
