// LLM sağlayıcıları. Her ikisi de çıktıyı JSON şemasına kısıtlar; dönen metin
// yine de validate.js tarafından baştan denetlenir (şemaya "güvenmeyiz").
//
//  - anthropic: resmi @anthropic-ai/sdk, output_config.format = json_schema
//  - openai:    OpenAI uyumlu /chat/completions (OpenAI, Qwen/DashScope, DeepSeek,
//               Ollama, yerel mock sunucu…) response_format = json_schema
//
// Analiz çağrısına hiçbir araç (tool) verilmez: model sayfada işlem yapamaz.

import Anthropic from '@anthropic-ai/sdk';
import { REPORT_JSON_SCHEMA } from './schema.js';

export const DEFAULTS = {
  anthropic: { model: 'claude-opus-5-5', baseURL: '' },
  openai: { model: 'gpt-4.1-mini', baseURL: 'https://api.openai.com/v1' },
};

export class LLMError extends Error {
  constructor(message, { retryable = false, kind = 'llm' } = {}) {
    super(message);
    this.retryable = retryable;
    this.kind = kind;
  }
}

async function callAnthropic({ apiKey, model, baseURL }, system, user) {
  const client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    dangerouslyAllowBrowser: true, // anahtar kullanıcının kendi tarayıcısında, kendi anahtarı
    maxRetries: 2,
  });
  let res;
  try {
    res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REPORT_JSON_SCHEMA } },
      // Güvenlik sınıflandırıcısı reddederse istek sunucu tarafında yedek modelle tekrarlanır.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new LLMError('API anahtarı geçersiz.', { kind: 'auth' });
    if (err instanceof Anthropic.RateLimitError) throw new LLMError('Hız sınırına takıldı, biraz sonra tekrar deneyin.', { retryable: true });
    if (err instanceof Anthropic.BadRequestError) throw new LLMError('İstek reddedildi: ' + err.message);
    if (err instanceof Anthropic.APIError) throw new LLMError(`API hatası (${err.status}): ${err.message}`, { retryable: (err.status ?? 0) >= 500 });
    throw new LLMError('Ağ hatası: ' + (err?.message || err), { retryable: true });
  }
  if (res.stop_reason === 'refusal') throw new LLMError('Model isteği yanıtlamayı reddetti.', { kind: 'refusal' });
  if (res.stop_reason === 'max_tokens') throw new LLMError('Yanıt uzunluk sınırında kesildi.', { kind: 'truncated' });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function callOpenAICompatible({ apiKey, model, baseURL }, system, user, { fetchImpl = fetch } = {}) {
  const url = (baseURL || DEFAULTS.openai.baseURL).replace(/\/+$/, '') + '/chat/completions';
  const body = (responseFormat) => JSON.stringify({
    model,
    temperature: 0,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: responseFormat,
  });
  const headers = { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) };
  let res = await fetchImpl(url, { method: 'POST', headers, body: body({ type: 'json_schema', json_schema: { name: 'satir_arasi_rapor', strict: true, schema: REPORT_JSON_SCHEMA } }) });
  if (res.status === 400) {
    // Bazı uyumlu sağlayıcılar json_schema desteklemez; json_object'e düş. Şema yine de
    // deterministik doğrulayıcıda zorunlu.
    res = await fetchImpl(url, { method: 'POST', headers, body: body({ type: 'json_object' }) });
  }
  if (res.status === 401 || res.status === 403) throw new LLMError('API anahtarı geçersiz.', { kind: 'auth' });
  if (!res.ok) throw new LLMError(`API hatası (${res.status}): ${(await res.text()).slice(0, 300)}`, { retryable: res.status === 429 || res.status >= 500 });
  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') throw new LLMError('Yanıt uzunluk sınırında kesildi.', { kind: 'truncated' });
  if (choice?.message?.refusal) throw new LLMError('Model isteği yanıtlamayı reddetti.', { kind: 'refusal' });
  return choice?.message?.content ?? '';
}

/** @param {{provider:'anthropic'|'openai', apiKey:string, model?:string, baseURL?:string}} cfg */
export async function completeJSON(cfg, system, user, opts) {
  const model = cfg.model || DEFAULTS[cfg.provider]?.model;
  if (cfg.provider === 'anthropic') return callAnthropic({ ...cfg, model }, system, user);
  if (cfg.provider === 'openai') return callOpenAICompatible({ ...cfg, model }, system, user, opts);
  throw new LLMError('Bilinmeyen sağlayıcı: ' + cfg.provider);
}
