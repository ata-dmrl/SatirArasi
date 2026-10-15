// Kural tabanlı (LLM'siz) madde dedektörü. Üç görevi var:
//  1. Eval'de taban çizgisi (baseline) — LLM'in kural tabanına göre katkısını ölçmek.
//  2. Çapraz kontrol — LLM'in kaçırdığı olası maddeleri "belirsizlik" olarak göstermek.
//  3. API anahtarı yoksa açıkça etiketlenmiş "yalnızca kural tabanlı" mod.

const RULES = {
  auto_renewal: [/\bautomatic(ally)?\s+renew/i, /\bauto[- ]?renew/i, /\brenews?\s+automatically/i, /\brecurring\s+(billing|charges?|payments?)/i, /otomatik\s*(olarak\s+)?yenilen/iu, /kendiliğinden\s+yenilen/iu],
  cancellation: [/\bcancel(l?ation)?\b.{0,80}\b(before|prior to|at least|notice|end of)\b/i, /\b(you may|to) cancel\b/i, /\bnon[- ]cancell?able\b/i, /iptal\p{L}*.{0,60}(önce|bildirim|süre|gün)/iu, /fesih\p{L}*.{0,60}(bildirim|süre|önce)/iu],
  refund: [/\bno\s+refunds?\b/i, /\bnon[- ]refundable\b/i, /\b(not|no) (be )?(entitled to|eligible for) (a )?refund/i, /\brefunds?\b.{0,60}\b(not|no|except|sole discretion)\b/i, /iade\s+(edilmez|yapılmaz|edilmeyecek)/iu, /ücret\s+iadesi.{0,40}(yapılmaz|bulunmaz|söz konusu değil)/iu],
  fees_price_change: [/\b(change|increase|modify|adjust)\b.{0,40}\b(price|prices|fees?|pricing|subscription fee)\b/i, /\b(price|fees?|pricing)\b.{0,40}\b(change|increase|subject to change)\b/i, /(fiyat|ücret)\p{L}*.{0,40}(değiştir|artır|güncelle)/iu],
  unilateral_changes: [/\b(we )?(may|reserve the right to)\s+(modify|change|update|amend|revise)\b.{0,60}\b(terms|agreement|policy|these)\b/i, /\b(at any time|from time to time)\b.{0,80}\b(modify|change|update|amend)\b/i, /\bcontinued use\b.{0,80}\b(accept|constitutes|agree)/i, /(sözleşme|koşul|şart|politika)\p{L}*.{0,60}(tek taraflı|dilediği zaman|herhangi bir zamanda).{0,40}(değiştir|güncelle)/iu, /(değiştirme|güncelleme)\s+hakkın[ıi]\s+saklı/iu],
  data_sharing: [/\b(share|disclose|transfer|provide)\b.{0,60}\b(third[- ]part(y|ies)|partners?|affiliates?|service providers?|advertis)/i, /üçüncü\s+(taraf|kişi)\p{L}*.{0,60}(paylaş|aktar|ilet)/iu, /(paylaş|aktar)\p{L}*.{0,60}üçüncü\s+(taraf|kişi)/iu],
  data_sale: [/\bsell\b.{0,40}\b(your )?(personal )?(data|information)\b/i, /\b(sale|selling) of (personal )?(data|information)\b/i, /\b(targeted|personalized|interest[- ]based)\s+(advertising|ads)\b/i, /(kişisel\s+)?veri\p{L}*.{0,40}sat/iu, /(hedefli|kişiselleştirilmiş)\s+reklam/iu],
  data_retention: [/\b(retain|store|keep)\b.{0,60}\b(as long as|indefinitely|for (a period|\d+)|after (you )?(delete|close|terminat))/i, /\bretention\b/i, /(sakla|muhafaza)\p{L}*.{0,60}(süre|yıl|silin|sonra)/iu],
  tracking: [/\bcookies?\b.{0,60}\b(track|advertis|analytic|third)/i, /\b(track|tracking|profil(e|ing))\b.{0,40}\b(activity|behaviou?r|across|devices?|websites?)\b/i, /\bprecise (geo)?location\b/i, /çerez\p{L}*.{0,60}(takip|reklam|analiz|üçüncü)/iu, /(konum|davranış)\p{L}*.{0,40}(takip|izle|topla)/iu],
  content_license: [/\b(worldwide|perpetual|irrevocable|royalty[- ]free|sublicensable|transferable)\b.{0,80}\blicen[cs]e\b/i, /\blicen[cs]e\b.{0,80}\b(worldwide|perpetual|irrevocable|royalty[- ]free|sublicensable)\b/i, /(süresiz|dünya çapında|geri alınamaz|bedelsiz).{0,60}lisans/iu],
  account_termination: [/\b(suspend|terminate|disable|close)\b.{0,40}\b(your )?(account|access)\b.{0,80}\b(at any time|without (prior )?notice|sole discretion|for any reason)/i, /\b(at any time|sole discretion|without notice)\b.{0,80}\b(suspend|terminate)\b/i, /hesab\p{L}*.{0,60}(askıya al|kapat|sonlandır|feshed).{0,60}(bildirim|herhangi bir zamanda|sebep göstermeksizin)/iu],
  liability_limitation: [/\b(limitation of liability|not (be )?liable|in no event)\b/i, /\bas is\b.{0,40}\b(as available|without warrant)/i, /\b(disclaim|exclude)\b.{0,40}\b(warrant|liabilit)/i, /sorumlu\s+(tutulamaz|değildir|olmayacak)/iu, /sorumluluk\p{L}*.{0,40}(kabul etmez|sınırl)/iu],
  arbitration_class_waiver: [/\barbitration\b/i, /\bclass[- ]action\b/i, /\bwaive\b.{0,40}\b(right to|jury|class)/i, /\bjury trial\b/i, /tahkim/iu, /toplu\s+dava/iu],
  jurisdiction: [/\bgoverned by (the )?laws? of\b/i, /\b(exclusive )?jurisdiction\b/i, /\bvenue\b.{0,40}\bcourts?\b/i, /(yetkili|münhasır)\s+(mahkeme|icra)/iu, /uygulanacak\s+hukuk/iu],
};

const DEFAULT_SEVERITY = {
  auto_renewal: 'medium', cancellation: 'medium', refund: 'medium', fees_price_change: 'medium',
  unilateral_changes: 'medium', data_sharing: 'medium', data_sale: 'high', data_retention: 'low',
  tracking: 'low', content_license: 'medium', account_termination: 'medium', liability_limitation: 'low',
  arbitration_class_waiver: 'high', jurisdiction: 'low',
};

export function splitSentences(text) {
  return text
    .split(/(?<=[.!?;:])\s+(?=[A-ZÇĞİÖŞÜ0-9("“])|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 1200);
}

export function heuristicClauses(text, { maxPerCategory = 3 } = {}) {
  const out = [];
  const perCat = {};
  for (const sentence of splitSentences(text)) {
    for (const [category, patterns] of Object.entries(RULES)) {
      if ((perCat[category] || 0) >= maxPerCategory) continue;
      if (patterns.some((re) => re.test(sentence))) {
        perCat[category] = (perCat[category] || 0) + 1;
        out.push({
          category,
          severity: DEFAULT_SEVERITY[category],
          quote: sentence.length > 600 ? sentence.slice(0, 600) : sentence,
          explanation_tr: 'Kural tabanlı eşleşme (LLM değerlendirmesi değil).',
          confidence: 0.5,
          source: 'heuristic',
        });
        break; // bir cümle tek kategoriye
      }
    }
  }
  return out;
}

export function heuristicCategories(text) {
  return new Set(heuristicClauses(text).map((c) => c.category));
}
