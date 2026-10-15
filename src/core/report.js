// Doğrulanmış maddelerden nihai raporu üretir: deterministik risk skoru +
// raporun ne kadar güvenilir olduğuna dair dürüst bir "kesinlik" değerlendirmesi.
// Skor LLM'in kendi beyanına değil, YALNIZCA doğrulanmış alıntılara dayanır.

import { CATEGORIES } from './schema.js';
import { heuristicClauses } from './heuristics.js';

const SEVERITY_WEIGHT = { low: 0.08, medium: 0.18, high: 0.32 };

export function riskScore(clauses) {
  let keep = 1;
  for (const c of clauses) {
    const w = SEVERITY_WEIGHT[c.severity] * CATEGORIES[c.category].weight * (0.5 + 0.5 * c.confidence);
    keep *= 1 - w;
  }
  return Math.round(100 * (1 - keep));
}

export function riskLevel(score) {
  if (score >= 75) return { key: 'very_high', label: 'Çok yüksek' };
  if (score >= 50) return { key: 'high', label: 'Yüksek' };
  if (score >= 25) return { key: 'medium', label: 'Orta' };
  return { key: 'low', label: 'Düşük' };
}

const CERTAINTY = ['high', 'medium', 'low'];
const CERTAINTY_LABEL = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };

/**
 * @param {object} p
 * @param {ReturnType<import('./validate.js').validateLLMOutput>} p.validation
 * @param {ReturnType<import('./injection.js').assessInjection>} p.injection
 * @param {{visibleText:string, url?:string, title?:string, coverage?:number}} p.page
 * @param {{provider:string, model:string}} p.meta
 */
export function buildReport({ validation, injection, page, meta }) {
  const reasons = [];
  let certainty = 'high';
  const lower = (to, why) => {
    if (CERTAINTY.indexOf(to) > CERTAINTY.indexOf(certainty)) certainty = to;
    reasons.push(why);
  };

  if (!validation.ok) {
    return {
      status: 'invalid_output',
      score: null,
      level: null,
      certainty: 'low',
      certaintyLabel: CERTAINTY_LABEL.low,
      certaintyReasons: ['LLM çıktısı şemaya uymadı; rapor üretilmedi: ' + validation.errors.join('; ')],
      clauses: [],
      rejected: [],
      injection,
      page: { url: page.url, title: page.title, chars: page.visibleText.length },
      meta,
    };
  }

  const clauses = validation.clauses;
  const score = riskScore(clauses);
  const total = clauses.length + validation.rejected.filter((r) => r.reason !== 'duplicate').length;
  const rejectedRatio = total ? (total - clauses.length) / total : 0;

  if (injection.level === 'high') lower('low', `Sayfada kullanıcıya görünmeyen ${injection.hiddenInstructionHits.length} adet yapay zekâya yönelik talimat bulundu. Bu metin analize dahil edilmedi, ancak sayfa manipülatif olabilir.`);
  else if (injection.level === 'medium') lower('medium', 'Görünür metinde yapay zekâya yönelik talimata benzeyen ifade var; model bunları veri olarak ele almak üzere uyarıldı.');
  if (validation.modelInjectionObserved) lower('medium', 'Model de belgede kendisine yönelik talimat gördüğünü bildirdi: ' + (validation.modelInjectionNotes || '(not yok)'));
  if (validation.rejected.some((r) => r.reason === 'quote_from_hidden')) lower('low', 'Model gizli metinden alıntı yapmaya çalıştı — bu maddeler reddedildi.');
  if (rejectedRatio > 0.5) lower('low', `Modelin iddialarının %${Math.round(rejectedRatio * 100)}'i alıntı doğrulamasından geçemedi.`);
  else if (rejectedRatio > 0.25) lower('medium', `Modelin iddialarının %${Math.round(rejectedRatio * 100)}'i alıntı doğrulamasından geçemedi.`);
  if (validation.documentType === 'not_legal') lower('low', 'Model bu sayfanın bir sözleşme/politika metni olmadığını düşünüyor.');
  if (page.visibleText.length < 1500) lower('medium', 'Sayfa metni çok kısa; belgenin tamamı yüklenmemiş olabilir.');
  const hiddenChars = (page.hiddenSegments || []).reduce((n, seg) => n + seg.text.length, 0);
  const hiddenRatio = hiddenChars / Math.max(1, hiddenChars + page.visibleText.length);
  if (hiddenRatio > 0.5) lower('low', `Sayfa metninin %${Math.round(hiddenRatio * 100)}'i kullanıcıya görünmüyor (gizli/katlanmış) ve analiz dışı bırakıldı; rapor sayfanın tamamını yansıtmıyor olabilir.`);
  else if (hiddenRatio > 0.2) lower('medium', `Sayfa metninin %${Math.round(hiddenRatio * 100)}'i görünmüyor (gizli/katlanmış bölümler) ve analiz dışı bırakıldı.`);
  if (page.coverage != null && page.coverage < 1) lower('medium', `Metnin yalnızca %${Math.round(page.coverage * 100)}'i analiz edildi (uzunluk sınırı).`);

  // Kural tabanlı çapraz kontrol: LLM'in hiç değinmediği ama anahtar kelimeyle
  // yakalanan kategoriler "olası kaçırılan" olarak gösterilir (skora katılmaz).
  const llmCats = new Set(clauses.map((c) => c.category));
  const possiblyMissed = [];
  const seen = new Set();
  for (const h of heuristicClauses(page.visibleText)) {
    if (llmCats.has(h.category) || seen.has(h.category)) continue;
    seen.add(h.category);
    possiblyMissed.push({ category: h.category, categoryLabel: CATEGORIES[h.category].label, quote: h.quote });
  }
  if (possiblyMissed.length >= 3) lower('medium', `Anahtar kelime taraması ${possiblyMissed.length} kategoride modelin değinmediği olası madde buldu.`);

  for (const u of validation.modelUncertainties) reasons.push('Model: ' + u);

  return {
    status: 'ok',
    documentType: validation.documentType,
    summary: validation.summary,
    score,
    level: riskLevel(score),
    certainty,
    certaintyLabel: CERTAINTY_LABEL[certainty],
    certaintyReasons: reasons,
    clauses,
    rejected: validation.rejected,
    possiblyMissed,
    injection,
    notes: validation.notes,
    page: { url: page.url, title: page.title, chars: page.visibleText.length, coverage: page.coverage ?? 1 },
    meta,
  };
}
