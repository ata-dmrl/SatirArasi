// Uçtan uca analiz hattı (tarayıcıda ve Node'da aynı kod çalışır):
//   sayfa metni → injection ön taraması → (parçalara böl) → LLM (JSON şema)
//   → deterministik doğrulama → deterministik skor + kesinlik → rapor

import { assessInjection } from './injection.js';
import { SYSTEM_PROMPT, buildUserMessage, chunkText } from './prompt.js';
import { completeJSON, LLMError } from './llm.js';
import { parseLLMOutput, validateLLMOutput } from './validate.js';
import { buildReport } from './report.js';
import { heuristicClauses } from './heuristics.js';
import { DOCUMENT_TYPES } from './schema.js';

function mergeChunkOutputs(outputs) {
  const legal = outputs.find((o) => o.document_type !== 'not_legal');
  return {
    document_type: legal ? legal.document_type : 'not_legal',
    summary_tr: outputs.map((o) => o.summary_tr).filter(Boolean)[0] || '',
    clauses: outputs.flatMap((o) => o.clauses),
    injection_observed: outputs.some((o) => o.injection_observed),
    injection_notes: outputs.map((o) => o.injection_notes).filter(Boolean).join(' | '),
    uncertainties: outputs.flatMap((o) => o.uncertainties),
  };
}

function looksLikeReport(o) {
  return o && typeof o === 'object' && DOCUMENT_TYPES.includes(o.document_type) && Array.isArray(o.clauses) &&
    typeof o.summary_tr === 'string' && typeof o.injection_observed === 'boolean' &&
    typeof o.injection_notes === 'string' && Array.isArray(o.uncertainties);
}

/**
 * @param {{visibleText:string, hiddenSegments?:{text:string,reason:string}[], url?:string, title?:string}} page
 * @param {{provider:string, apiKey?:string, model?:string, baseURL?:string}|null} cfg null → yalnızca kural tabanlı
 */
export async function analyzePage(page, cfg, { complete = completeJSON, maxChars = 60000, maxChunks = 4, onProgress = () => {} } = {}) {
  const hiddenSegments = page.hiddenSegments || [];
  const injection = assessInjection({ visibleText: page.visibleText, hiddenSegments });
  const hiddenText = hiddenSegments.map((s) => s.text).join('\n');
  const source = { visibleText: page.visibleText, hiddenText };

  if (!cfg) {
    const raw = {
      document_type: 'mixed',
      summary_tr: 'LLM yapılandırılmadığı için yalnızca anahtar kelime taraması yapıldı. Açıklamalar ve şiddet dereceleri otomatik varsayılandır.',
      clauses: heuristicClauses(page.visibleText).map(({ source: _s, ...c }) => c),
      injection_observed: false,
      injection_notes: '',
      uncertainties: ['Bu rapor bir dil modeli tarafından değerlendirilmedi; yanlış alarm oranı yüksektir.'],
    };
    const validation = validateLLMOutput(raw, source);
    const report = buildReport({ validation, injection, page, meta: { provider: 'heuristic', model: 'rules-v1', mode: 'heuristic' } });
    report.certainty = 'low';
    report.certaintyLabel = 'Düşük';
    report.certaintyReasons.unshift('LLM anahtarı girilmedi: yalnızca kural tabanlı tarama.');
    return report;
  }

  const allChunks = chunkText(page.visibleText, maxChars);
  const chunks = allChunks.slice(0, maxChunks);
  const coveredChars = chunks.reduce((n, c) => n + c.length, 0) - Math.max(0, chunks.length - 1) * 800;
  const coverage = Math.min(1, coveredChars / Math.max(1, page.visibleText.length));
  const suspiciousLines = injection.visibleInstructionHits.map((h) => h.text);

  const outputs = [];
  const retries = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgress({ step: 'llm', chunk: i + 1, totalChunks: chunks.length });
    const user = buildUserMessage({ text: chunks[i], url: page.url, title: page.title, chunk: i + 1, totalChunks: chunks.length, suspiciousLines });
    let raw = await complete(cfg, SYSTEM_PROMPT, user);
    let parsed = parseLLMOutput(raw);
    if (!parsed.ok || !looksLikeReport(parsed.value)) {
      // Tek bir düzeltme denemesi; ikinci başarısızlıkta fail-closed.
      retries.push(i + 1);
      raw = await complete(cfg, SYSTEM_PROMPT, user + '\n\nÖNCEKİ YANITIN ŞEMAYA UYMADIĞI İÇİN REDDEDİLDİ. Yalnızca şemaya birebir uyan JSON döndür.');
      parsed = parseLLMOutput(raw);
    }
    if (!parsed.ok || !looksLikeReport(parsed.value)) {
      const validation = validateLLMOutput(parsed.ok ? parsed.value : raw, source);
      return buildReport({ validation: validation.ok ? { ok: false, errors: ['Parça ' + (i + 1) + ' şemaya uymadı'] } : validation, injection, page, meta: { provider: cfg.provider, model: cfg.model, mode: 'llm' } });
    }
    outputs.push(parsed.value);
  }

  onProgress({ step: 'validate' });
  const validation = validateLLMOutput(mergeChunkOutputs(outputs), source);
  const report = buildReport({
    validation,
    injection,
    page: { ...page, coverage },
    meta: { provider: cfg.provider, model: cfg.model, mode: 'llm', chunks: chunks.length, totalChunks: allChunks.length, retries },
  });
  return report;
}

export { LLMError };
