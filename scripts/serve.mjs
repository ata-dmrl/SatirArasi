// Demo/test sunucusu (bağımlılıksız):
//   GET  /terms.html, /injected.html   kurgusal sözleşme sayfaları (injected = gizli talimatlı)
//   GET  /harness.js                    dist-harness/harness.js
//   POST /v1/chat/completions           OpenAI uyumlu MOCK LLM (kayıtlı fixture yanıtları)
//   GET  /__last-llm-request            mock'a giden son isteğin gövdesi (injection testi için)
//   POST /__reset                       son istek kaydını siler
//
// Mock yalnızca demo/test içindir; gerçek analiz uzantıda kullanıcının kendi anahtarıyla yapılır.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const MOCK_DELAY = Number(process.env.MOCK_DELAY_MS ?? 1500);
let lastLLMRequest = null;

async function page(name) {
  let html = await readFile(path.join(root, 'demo-site', 'terms.html'), 'utf8');
  if (name === 'injected') {
    const payload = await readFile(path.join(root, 'demo-site', 'injection-payload.html'), 'utf8');
    html = html
      .replace('<!--HIDDEN_INJECTION_SLOT-->', payload)
      .replace('<title>Akış+ Abonelik ve Kullanım Koşulları</title>', '<title>Akış+ Abonelik Koşulları (gizli talimatlı sürüm)</title>');
  }
  return html;
}

async function mockCompletion(body) {
  lastLLMRequest = body;
  const user = body.messages?.find((m) => m.role === 'user')?.content || '';
  const fixture = /gizli talimatlı/.test(user) ? 'akis-injected.json' : /Akış\+/.test(user) ? 'akis-terms.json' : null;
  const content = fixture
    ? await readFile(path.join(root, 'scripts', 'fixtures', fixture), 'utf8')
    : JSON.stringify({ document_type: 'not_legal', summary_tr: 'Mock: bu sayfa için kayıtlı yanıt yok.', clauses: [], injection_observed: false, injection_notes: '', uncertainties: ['Mock sunucuda bu sayfa için fixture yok.'] });
  await new Promise((r) => setTimeout(r, MOCK_DELAY));
  return { id: 'mock', object: 'chat.completion', model: body.model, choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content } }] };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET' });
      return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const out = await mockCompletion(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      return res.end(JSON.stringify(out));
    }
    if (url.pathname === '/__reset') {
      lastLLMRequest = null;
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === '/__last-llm-request') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(lastLLMRequest));
    }
    if (url.pathname === '/' || url.pathname === '/terms.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(await page('terms'));
    }
    if (url.pathname === '/injected.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(await page('injected'));
    }
    if (url.pathname === '/harness.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return res.end(await readFile(path.join(root, 'dist-harness', 'harness.js')));
    }
    res.writeHead(404).end('not found');
  } catch (err) {
    res.writeHead(500).end(String(err?.stack || err));
  }
});

server.listen(PORT, () => console.log(`Demo sunucusu: http://localhost:${PORT}/terms.html  |  /injected.html`));
