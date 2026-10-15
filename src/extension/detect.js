// Sözleşme sayfası tanıma. Bağımlılıksız: her sayfada çalışan küçük dedektör
// betiğinin parçasıdır; page-agent yalnızca bu test olumluysa yüklenir.

const URL_RE = /(terms|tos|conditions|privacy|legal|subscription|eula|user[-_ ]?agreement|policy|policies|kullanim|kosul|sartlar|gizlilik|kvkk|aydinlatma|sozlesme|abonelik|cerez|uyelik)/i;
const TEXT_RE = /(terms of (use|service)|terms (&|and) conditions|privacy (policy|notice|statement)|user agreement|subscription terms|end[- ]user (license )?agreement|cookie policy|kullan[ıi]m (ko[şs]ullar[ıi]|[şs]artlar[ıi])|gizlilik (politikas[ıi]|s[öo]zle[şs]mesi|bildirimi)|kvkk|ayd[ıi]nlatma metni|[üu]yelik s[öo]zle[şs]mesi|abonelik (s[öo]zle[şs]mesi|ko[şs]ullar[ıi]|[şs]artlar[ıi])|[çc]erez politikas[ıi]|mesafeli sat[ıi][şs] s[öo]zle[şs]mesi)/i;

/** @returns {{ legal: boolean, why: string }} */
export function detectLegal(doc = document, loc = location) {
  const path = decodeURIComponent(loc.pathname).toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u');
  if (URL_RE.test(path)) return { legal: true, why: 'url' };
  const heads = doc.title + ' ' + [...doc.querySelectorAll('h1,h2')].slice(0, 6).map((h) => h.textContent).join(' ');
  if (TEXT_RE.test(heads)) return { legal: true, why: 'heading' };
  return { legal: false, why: '' };
}

export function detectLegalPage(doc = document, loc = location) {
  return detectLegal(doc, loc).legal;
}
