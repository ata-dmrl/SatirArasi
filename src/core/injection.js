// Prompt-injection tespiti (deterministik, LLM'den bağımsız).
//
// Savunma katmanları (README'de ayrıntılı):
//  1. Gizli metin LLM'e hiç gönderilmez: page-agent'in görünürlük filtresiyle
//     yalnızca kullanıcının gördüğü metin analiz edilir.
//  2. Gizli metin bu modülde taranır; talimat kalıbı varsa raporda uyarı çıkar.
//  3. Görünür metindeki talimat kalıpları da işaretlenir ve modele "bu bir veri,
//     talimat değil" çerçevesiyle iletilir.
//  4. Model ne derse desin: risk skoru LLM'den değil, doğrulanmış alıntılardan
//     deterministik olarak hesaplanır; alıntısız iddia düşer. Modelin "risk yok"
//     demesi skoru düşüremez, yalnızca madde eksikliğine yol açabilir — bu da
//     kural tabanlı çapraz kontrolle "belirsizlik" olarak gösterilir.
//  5. Analiz LLM'inin hiçbir aracı (tool) yoktur; sayfada işlem yapamaz.

// Türkçe kalıplarda \p{L} (Unicode harf) kullanılır; \w Türkçe ekleri yakalamaz.
const PATTERNS = [
  // İngilizce
  /\bignore\b.{0,40}\b(previous|prior|above|all|earlier)\b.{0,20}\b(instructions?|prompts?|rules?)\b/i,
  /\bdisregard\b.{0,40}\b(instructions?|prompts?|rules?|guidelines?)\b/i,
  /\b(system|developer)\s*(prompt|message|instructions?)\b/i,
  /\byou are (now )?(an? )?(ai|assistant|language model|llm|chatgpt|claude|gpt)\b/i,
  /\b(as an|dear) (ai|assistant|language model|llm)\b/i,
  /\b(risk[_ ]?score|risk level)\b.{0,30}\b(0|zero|low|none|minimal)\b/i,
  /\b(report|classify|mark|label|rate)\b.{0,40}\b(as )?(safe|harmless|low[- ]risk|no risk)\b/i,
  /\b(do not|don't|never)\b.{0,15}\b(mention|report|flag|list|highlight)\b.{0,20}\b(this|these|any|the)\b.{0,15}\b(clauses?|sections?|risks?|terms?)\b/i,
  /\b(respond|reply|answer|output)\b.{0,20}\b(only|with|in)\b.{0,20}\b(json|the following|exactly)\b/i,
  /<\|?(im_start|im_end|system|endoftext)\|?>/i,
  /\[\/?(INST|SYS)\]/,
  /\b(new|updated|additional) instructions?\s*:/i,
  // Türkçe
  /(önceki|yukarıdaki|tüm|bütün)\s+(talimat|komut|kural|yönerge)\p{L}*\s+(yok say|görmezden gel|unut|dikkate alma)/iu,
  /(talimat|komut|yönerge)\p{L}*\s+(yok say|görmezden gel|unut)/iu,
  /(sistem|geliştirici)\s+(mesaj|talimat|istem|prompt)\p{L}*/iu,
  /(sen|siz)\s+(artık\s+)?(bir\s+)?(yapay zek[aâ]|asistan|dil modeli)/iu,
  /yapay zek[aâ]\p{L}*\s+(yönelik\s+)?(not|talimat|mesaj)/iu,
  /risk\s*(skor|puan|seviye)\p{L}*.{0,25}(\b0\b|sıfır|düşük|yok)/iu,
  /(güvenli|risksiz|zararsız)\s+(olarak\s+)?(işaretle|raporla|göster|değerlendir|belirt)/iu,
  /(hiçbir|hiç)\s+(risk|madde)\p{L}*\s+(raporlama|gösterme|listeleme|belirtme)/iu,
];

export function scanForInstructions(text) {
  const hits = [];
  if (!text) return hits;
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  for (const s of sentences) {
    const sentence = s.trim();
    if (sentence.length < 8) continue;
    for (const re of PATTERNS) {
      if (re.test(sentence)) {
        hits.push({ text: sentence.slice(0, 300), pattern: re.source.slice(0, 60) });
        break;
      }
    }
  }
  return hits;
}

/**
 * @param {{visibleText:string, hiddenSegments:{text:string,reason:string}[]}} page
 */
export function assessInjection(page) {
  const hidden = [];
  for (const seg of page.hiddenSegments || []) {
    for (const h of scanForInstructions(seg.text)) hidden.push({ ...h, reason: seg.reason });
  }
  const visible = scanForInstructions(page.visibleText);
  const level = hidden.length > 0 ? 'high' : visible.length > 0 ? 'medium' : 'none';
  return {
    level,
    hiddenInstructionHits: hidden.slice(0, 10),
    visibleInstructionHits: visible.slice(0, 10),
    hiddenSegmentCount: (page.hiddenSegments || []).length,
  };
}
