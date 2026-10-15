// Test/demo harness: uzantının içerik betiğiyle AYNI modülleri (page-agent
// çıkarıcı, injection ön taraması, analiz hattı, panel) normal bir sayfada çalıştırır.
// Cypress Chrome uzantı arayüzünü süremediği için demo videosu bu harness ile kaydedilir.
// LLM: varsayılan olarak yerel mock sunucu (OpenAI uyumlu); window.SATIR_ARASI_CONFIG
// ile gerçek sağlayıcı verilebilir, null verilirse kural tabanlı moda düşer.
// ?trusted=1 → uzantıdaki gibi yalnızca gerçek kullanıcı tıklaması analizi başlatır.

import { extractPage, detectLegalPage, HOST_ID } from '../extension/extractor.js';
import { assessInjection } from '../core/injection.js';
import { mountApp } from '../ui/app.js';
import { analyzePage } from '../core/analyze.js';

const cfg = window.SATIR_ARASI_CONFIG !== undefined
  ? window.SATIR_ARASI_CONFIG
  : { provider: 'openai', baseURL: location.origin + '/v1', model: 'mock-fixture', apiKey: '' };

const legalDetected = detectLegalPage();
const app = mountApp({
  hostId: HOST_ID,
  legalDetected,
  requireTrustedClicks: new URLSearchParams(location.search).has('trusted'),
  analyze: async () => analyzePage(await extractPage(), cfg),
});
window.__satirArasi = app;

// İçerik betiğiyle aynı: sayfa açılınca yerel yakalama (LLM yok).
if (legalDetected) {
  extractPage().then((page) => {
    app.setCapture({ chars: page.visibleText.length, hiddenSegments: page.hiddenSegments.length, injectionLevel: assessInjection(page).level });
  });
}
