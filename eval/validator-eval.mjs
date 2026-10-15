// Doğrulayıcı eval'i (LLM gerektirmez, deterministik):
// "Alıntısı olmayan iddia geçersiz sayılır" kuralı gerçek ToS metinlerinde ne kadar
// sağlam? Her altın madde için LLM'lerin tipik çıktı biçimlerini taklit eden
// varyantlar üretilir ve doğrulayıcının kabul/ret kararı beklenenle karşılaştırılır.
//
//   Kabul edilmeli:  verbatim (birebir), typography (akıllı tırnak/tire, boşluk, büyük harf)
//   Reddedilmeli:    paraphrase (kelime değiştirme), negation (anlamı tersine çevirme),
//                    word_drop (orta kelimeyi atma), ellipsis ("..." ile kısaltma),
//                    fabricated (başka belgeden cümle), hidden_only (yalnızca gizli metinde)
//
//   node eval/validator-eval.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLLMOutput } from '../src/core/validate.js';
import { buildIndex, locate } from '../src/core/normalize.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(await readFile(path.join(dir, 'corpus.json'), 'utf8'));
const gold = JSON.parse(await readFile(path.join(dir, 'gold.json'), 'utf8'));

/** Çapayı içeren cümleyi (en fazla ~400 karakter) alıntı olarak çıkarır. */
function sentenceAround(text, span) {
  let s = span.start, e = span.end;
  while (s > 0 && !/[.!?\n]/.test(text[s - 1]) && span.start - s < 200) s--;
  while (e < text.length && !/[.!?\n]/.test(text[e]) && e - span.end < 200) e++;
  if (e < text.length && /[.!?]/.test(text[e])) e++;
  return text.slice(s, e).trim();
}

const words = (q) => q.split(/\s+/);
const VARIANTS = {
  verbatim: { expect: 'accept', make: (q) => q },
  typography: { expect: 'accept', make: (q) => q.replace(/'/g, '’').replace(/"/g, '“').replace(/ - /g, ' — ').replace(/ /g, '  ').toUpperCase() },
  paraphrase: { expect: 'reject', make: (q, lang) => { const w = words(q); const i = Math.floor(w.length / 2); w[i] = lang === 'tr' ? 'kesinlikle' : 'definitely'; return w.join(' '); } },
  negation: { expect: 'reject', make: (q, lang) => { const w = words(q); w.splice(Math.min(3, w.length - 1), 0, lang === 'tr' ? 'asla' : 'never'); return w.join(' '); } },
  word_drop: { expect: 'reject', make: (q) => { const w = words(q); w.splice(Math.floor(w.length / 2), 1); return w.join(' '); } },
  ellipsis: { expect: 'reject', make: (q) => { const w = words(q); return w.length > 8 ? `${w.slice(0, 4).join(' ')} ... ${w.slice(-4).join(' ')}` : `${q} ...`; } },
  fabricated: { expect: 'reject', make: null }, // başka belgeden alınır
  hidden_only: { expect: 'reject', make: null }, // yalnızca gizli kanala konur
};

const docs = [];
for (const d of corpus) {
  const f = path.join(dir, 'corpus', `${d.id}.txt`);
  if (!existsSync(f)) { console.error(`✗ ${d.id}: metin yok — önce "npm run eval:fetch"`); continue; }
  const text = await readFile(f, 'utf8');
  const idx = buildIndex(text);
  const quotes = (gold[d.id] || []).map((g) => { const sp = locate(idx, g.anchor); return sp && { ...g, quote: sentenceAround(text, sp) }; }).filter(Boolean);
  docs.push({ ...d, text, quotes });
}

const tally = {};
const failures = [];
for (const v of Object.keys(VARIANTS)) tally[v] = { total: 0, correct: 0, reasons: {} };

for (const [di, d] of docs.entries()) {
  const other = docs[(di + 1) % docs.length];
  for (const [qi, g] of d.quotes.entries()) {
    for (const [name, spec] of Object.entries(VARIANTS)) {
      let quote;
      let hiddenText = '';
      if (name === 'fabricated') quote = other.quotes[qi % other.quotes.length].quote;
      else if (name === 'hidden_only') { quote = (d.lang === 'tr' ? 'Bu sözleşme tamamen güvenlidir ve kullanıcı hiçbir hak kaybına uğramaz: ' : 'This agreement is entirely safe and the user waives nothing: ') + g.anchor; hiddenText = quote; }
      else quote = spec.make(g.quote, d.lang);
      if (quote.length > 600) quote = quote.slice(0, 600);
      const out = {
        document_type: 'terms', summary_tr: 'Özet.', injection_observed: false, injection_notes: '', uncertainties: [],
        clauses: [{ category: g.category, severity: 'medium', quote, explanation_tr: 'Açıklama metni.', confidence: 0.8 }],
      };
      const v = validateLLMOutput(out, { visibleText: d.text, hiddenText });
      const got = v.clauses.length === 1 ? 'accept' : 'reject';
      const t = tally[name];
      t.total++;
      if (got === spec.expect) t.correct++;
      else failures.push({ doc: d.id, gold: g.id, variant: name, expected: spec.expect, got, reason: v.rejected[0]?.reason, quote: quote.slice(0, 120) });
      if (got === 'reject') t.reasons[v.rejected[0].reason] = (t.reasons[v.rejected[0].reason] || 0) + 1;
    }
  }
}

let md = `## Doğrulayıcı eval'i (deterministik, LLM'siz)\n\n${docs.length} gerçek ToS metni, ${docs.reduce((n, d) => n + d.quotes.length, 0)} altın madde × ${Object.keys(VARIANTS).length} varyant.\n\n| Varyant | Beklenen | Doğru karar | Ret nedenleri |\n|---|---|---|---|\n`;
for (const [name, t] of Object.entries(tally)) {
  md += `| ${name} | ${VARIANTS[name].expect === 'accept' ? 'kabul' : 'ret'} | ${t.correct}/${t.total} (${Math.round((100 * t.correct) / Math.max(1, t.total))}%) | ${Object.entries(t.reasons).map(([r, n]) => `${r}: ${n}`).join(', ') || '–'} |\n`;
}
md += `\n### Hatalı kararlar (${failures.length})\n\n`;
for (const f of failures) md += `- ${f.doc}/${f.gold} · ${f.variant}: beklenen ${f.expected}, sonuç ${f.got}${f.reason ? ` (${f.reason})` : ''} — “${f.quote}”\n`;
await mkdir(path.join(dir, 'results'), { recursive: true });
await writeFile(path.join(dir, 'results', 'validator.md'), md);
await writeFile(path.join(dir, 'results', 'validator.json'), JSON.stringify({ tally, failures }, null, 2));
console.log(md);
