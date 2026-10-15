// Service worker'ın mesaj sınırı: gönderen denetimi, sayfa verisi doğrulaması,
// anahtarsız modda kural tabanlı rapor. chrome API'leri taklit edilir.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let onMessage;
const store = {};
before(async () => {
  globalThis.chrome = {
    runtime: { id: 'ext-id', onMessage: { addListener: (fn) => { onMessage = fn; } }, openOptionsPage() {} },
    action: { onClicked: { addListener() {} } },
    storage: { local: { get: async (keys) => Object.fromEntries([].concat(keys).map((k) => [k, store[k]])) } },
    scripting: { executeScript: async () => [{ result: true }] },
    tabs: { sendMessage: async () => {} },
  };
  await import('../src/extension/background.js');
});

const send = (msg, sender) => new Promise((resolve) => {
  const async = onMessage(msg, sender, resolve);
  if (!async) setTimeout(() => resolve('__sync__'), 10);
});
const page = (visibleText) => ({ visibleText, hiddenSegments: [], url: 'https://x/terms', title: 'Terms' });
const TAB = { id: 'ext-id', tab: { id: 1 } };

test('başka bir uzantıdan gelen mesaj yok sayılır', async () => {
  assert.equal(await send({ type: 'analyze', page: page('x') }, { id: 'other', tab: { id: 1 } }), '__sync__');
});

test('sekme dışından veya bozuk/çok büyük sayfa verisi reddedilir', async () => {
  assert.match((await send({ type: 'analyze', page: page('x') }, { id: 'ext-id' })).error, /Geçersiz/);
  assert.match((await send({ type: 'analyze', page: { visibleText: 1 } }, TAB)).error, /Geçersiz/);
  assert.match((await send({ type: 'analyze', page: page('a'.repeat(400_001)) }, TAB)).error, /çok büyük/);
});

test('anahtar yoksa açıkça etiketli kural tabanlı rapor döner (kesinlik düşük)', async () => {
  const r = await send({ type: 'analyze', page: page('Payments are non-refundable and there will be no refunds for partial months of service.') }, TAB);
  assert.equal(r.report.meta.mode, 'heuristic');
  assert.equal(r.report.certainty, 'low');
});
