// Eval için bağımlılıksız HTML → görünür metin dönüştürücü.
// Tarayıcıdaki page-agent çıkarıcısının yaklaşık bir karşılığıdır: script/style/
// gizli öğeleri atar, blok öğeleri satıra çevirir, ana içerik bölgesini tercih eder.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™' };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html, { mainSelectorHint } = {}) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|head|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<([a-z0-9]+)\b[^>]*\b(hidden|aria-hidden="true"|style="[^"]*display:\s*none[^"]*")[^>]*>[\s\S]*?<\/\1>/gi, '');
  const pick = (re) => { const m = re.exec(h); return m ? m[0] : null; };
  const main = (mainSelectorHint && pick(mainSelectorHint)) || pick(/<main\b[\s\S]*<\/main>/i) || pick(/<article\b[\s\S]*<\/article>/i);
  if (main) h = main;
  h = h
    .replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|section|article|li|ul|ol|h[1-6]|tr|table|blockquote|dd|dt|dl|main)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decode(h)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
