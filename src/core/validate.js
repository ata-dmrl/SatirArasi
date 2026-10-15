// LLM çıktısının deterministik doğrulayıcısı.
// Aynı girdi → her zaman aynı çıktı. Hiçbir adımda LLM'e tekrar sorulmaz.
//
// Kurallar:
//  - Üst düzey şema bozuksa tüm çıktı reddedilir (fail-closed).
//  - Her madde ayrı denetlenir; kuralı çiğneyen madde düşürülür ve NEDENİ raporlanır.
//  - Alıntı, kullanıcının GÖRDÜĞÜ metinde (normalize edilmiş) birebir geçmiyorsa
//    madde geçersizdir. Gizli metinden alıntı ayrıca injection kanıtı sayılır.

import { CATEGORIES, SEVERITIES, DOCUMENT_TYPES, LIMITS } from './schema.js';
import { buildIndex, locate, tokenize, bestTokenCoverage } from './normalize.js';

export const REJECT_REASONS = {
  schema: 'Şema ihlali',
  quote_length: 'Alıntı çok kısa veya çok uzun',
  quote_not_found: 'Alıntı sayfa metninde bulunamadı (uydurma olabilir)',
  quote_not_verbatim: 'Benzer metin var ama alıntı birebir değil',
  quote_from_hidden: 'Alıntı kullanıcıya görünmeyen (gizli) metinden alınmış',
  empty_explanation: 'Açıklama boş',
  explanation_not_turkish: 'Açıklama Türkçe değil',
  duplicate: 'Aynı metin parçası için yinelenen madde',
  over_limit: 'Madde sayısı sınırı aşıldı',
};

// Açıklamada hukuki tavsiye kalıbı varsa işaretlenir (UI'da gösterilir).
const ADVICE_PATTERNS = [/dava\s+aç(malı|ın)/iu, /avukat\p{L}*\s+(olarak|sıfatıyla)/iu, /(imzalamayın|kabul etmeyin|onaylamayın)/iu, /hukuken\s+(kesin|garanti)/iu, /\byou should (sue|not sign|not accept)\b/i];

// "Sade Türkçe açıklama" isteri için deterministik dil kontrolü: Türkçe'ye özgü harf
// yoksa ve İngilizce işlev kelimeleri Türkçe olanlardan baskınsa açıklama reddedilir.
const TR_STOP = /(?<!\p{L})(ve|bir|bu|için|ile|olarak|veya|ancak|sizin|size|değil|olan|gibi|kadar|her|hiç|daha|çok|ya|da|de)(?!\p{L})/giu;
const EN_STOP = /(?<!\p{L})(the|and|of|to|you|your|is|are|be|for|with|that|this|may|will|not|or|can|if)(?!\p{L})/giu;
export function looksTurkish(text) {
  const trChars = (text.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
  const tr = (text.match(TR_STOP) || []).length;
  const en = (text.match(EN_STOP) || []).length;
  return !(trChars === 0 && en >= 2 && en > tr);
}

export function parseLLMOutput(raw) {
  if (raw && typeof raw === 'object') return { ok: true, value: raw };
  if (typeof raw !== 'string') return { ok: false, error: 'Boş yanıt' };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    // Kod bloğu içinde gelmiş olabilir; bundan fazlasını "kurtarmaya" çalışmayız.
    const m = raw.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
    if (m) {
      try { return { ok: true, value: JSON.parse(m[1]) }; } catch { /* düş */ }
    }
    return { ok: false, error: 'Yanıt geçerli JSON değil' };
  }
}

function topLevelErrors(o) {
  const errs = [];
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ['Kök nesne değil'];
  const allowed = new Set(['document_type', 'summary_tr', 'clauses', 'injection_observed', 'injection_notes', 'uncertainties']);
  for (const k of Object.keys(o)) if (!allowed.has(k)) errs.push(`Beklenmeyen alan: ${k}`);
  if (!DOCUMENT_TYPES.includes(o.document_type)) errs.push('document_type geçersiz');
  if (typeof o.summary_tr !== 'string') errs.push('summary_tr string değil');
  if (!Array.isArray(o.clauses)) errs.push('clauses dizi değil');
  if (typeof o.injection_observed !== 'boolean') errs.push('injection_observed boolean değil');
  if (typeof o.injection_notes !== 'string') errs.push('injection_notes string değil');
  if (!Array.isArray(o.uncertainties) || !o.uncertainties.every((u) => typeof u === 'string')) errs.push('uncertainties string dizisi değil');
  return errs;
}

function clauseSchemaOk(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const keys = Object.keys(c).sort().join(',');
  if (keys !== 'category,confidence,explanation_tr,quote,severity') return false;
  return (
    Object.hasOwn(CATEGORIES, c.category) &&
    SEVERITIES.includes(c.severity) &&
    typeof c.quote === 'string' &&
    typeof c.explanation_tr === 'string' &&
    typeof c.confidence === 'number' && Number.isFinite(c.confidence)
  );
}

/**
 * @param {unknown} raw LLM yanıtı (string veya nesne)
 * @param {{visibleText:string, hiddenText?:string}} source
 */
export function validateLLMOutput(raw, source) {
  const parsed = parseLLMOutput(raw);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const o = parsed.value;
  const errs = topLevelErrors(o);
  if (errs.length) return { ok: false, errors: errs };

  const visIndex = buildIndex(source.visibleText);
  const hidIndex = source.hiddenText ? buildIndex(source.hiddenText) : null;
  const visTokens = tokenize(source.visibleText);

  const accepted = [];
  const rejected = [];
  const notes = [];
  const reject = (c, reason, extra = {}) => rejected.push({ clause: c, reason, reasonText: REJECT_REASONS[reason], ...extra });

  for (const c of o.clauses) {
    if (!clauseSchemaOk(c)) { reject(c, 'schema'); continue; }
    const quote = c.quote.trim();
    if (quote.length < LIMITS.quoteMinChars || quote.length > LIMITS.quoteMaxChars) { reject(c, 'quote_length'); continue; }
    if (!c.explanation_tr.trim()) { reject(c, 'empty_explanation'); continue; }
    if (!looksTurkish(c.explanation_tr)) { reject(c, 'explanation_not_turkish'); continue; }

    const span = locate(visIndex, quote);
    if (!span) {
      if (hidIndex && locate(hidIndex, quote)) { reject(c, 'quote_from_hidden'); continue; }
      const coverage = bestTokenCoverage(visTokens, quote);
      if (coverage >= 0.6) reject(c, 'quote_not_verbatim', { coverage: Math.round(coverage * 100) / 100 });
      else reject(c, 'quote_not_found', { coverage: Math.round(coverage * 100) / 100 });
      continue;
    }

    let explanation = c.explanation_tr.trim();
    if (explanation.length > LIMITS.explanationMaxChars) explanation = explanation.slice(0, LIMITS.explanationMaxChars) + '…';
    const confidence = Math.min(1, Math.max(0, c.confidence));
    if (confidence !== c.confidence) notes.push('Bir maddenin güven değeri 0-1 aralığına kırpıldı.');

    accepted.push({
      category: c.category,
      categoryLabel: CATEGORIES[c.category].label,
      severity: c.severity,
      quote: source.visibleText.slice(span.start, span.end), // sayfadaki ORİJİNAL metin
      span,
      explanation_tr: explanation,
      adviceLanguage: ADVICE_PATTERNS.some((re) => re.test(explanation)),
      confidence,
    });
  }

  // Tekilleştirme: örtüşen alıntılardan daha ağır olanı kalır.
  const sevRank = { high: 3, medium: 2, low: 1 };
  accepted.sort((a, b) => sevRank[b.severity] - sevRank[a.severity] || b.confidence - a.confidence || a.span.start - b.span.start);
  const kept = [];
  for (const c of accepted) {
    const dup = kept.find((k) => {
      const overlap = Math.min(k.span.end, c.span.end) - Math.max(k.span.start, c.span.start);
      return overlap > 0.5 * Math.min(k.span.end - k.span.start, c.span.end - c.span.start);
    });
    if (dup) { reject(c, 'duplicate'); continue; }
    if (kept.length >= LIMITS.maxClauses) { reject(c, 'over_limit'); continue; }
    kept.push(c);
  }
  kept.sort((a, b) => a.span.start - b.span.start);

  let summary = o.summary_tr.trim();
  if (summary && !looksTurkish(summary)) { notes.push('Model özeti Türkçe yazmadı; özet gösterilmiyor.'); summary = ''; }
  if (summary.length > LIMITS.summaryMaxChars) summary = summary.slice(0, LIMITS.summaryMaxChars) + '…';

  return {
    ok: true,
    documentType: o.document_type,
    summary,
    clauses: kept,
    rejected,
    modelInjectionObserved: o.injection_observed,
    modelInjectionNotes: o.injection_notes.trim().slice(0, 500),
    modelUncertainties: o.uncertainties.map((u) => u.trim()).filter(Boolean).slice(0, LIMITS.maxUncertainties),
    notes: [...new Set(notes)],
  };
}
