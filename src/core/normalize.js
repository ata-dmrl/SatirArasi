// Alıntı eşleştirmesi için metin normalizasyonu.
// Amaç: modelin tipografik farklar (akıllı tırnak, tire, boşluk, büyük/küçük harf)
// yüzünden haksız yere reddedilmemesi; ama içerik farkı olan hiçbir alıntının
// kabul edilmemesi. Normalize edilmiş her karakterin orijinal metindeki konumu
// tutulur; böylece doğrulanan alıntı sayfada birebir işaretlenebilir.

const DROP = /[­​-‏⁠﻿]/; // soft hyphen, zero-width, BOM
const QUOTES = { '‘': "'", '’': "'", '‚': "'", '‛': "'", '′': "'", '“': '"', '”': '"', '„': '"', '«': '"', '»': '"', '″': '"' };
const DASHES = /[‐-―−]/;

function foldChar(ch) {
  if (QUOTES[ch]) return QUOTES[ch];
  if (DASHES.test(ch)) return '-';
  if (ch === '…') return '...';
  let c = ch.normalize('NFKD').replace(/[̀-ͯ]/g, ''); // aksanları at: ş→s, ü→u, İ→I
  c = c.toLowerCase();
  if (c === 'ı') c = 'i'; // ı → i (TR/EN büyük-küçük harf tuzaklarını nötrler)
  return c;
}

/**
 * @returns {{ norm: string, map: number[] }} map[i] = norm[i]'nin orijinal metindeki indeksi
 */
export function buildIndex(text) {
  let norm = '';
  const map = [];
  let lastWasSpace = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (DROP.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (!lastWasSpace) { norm += ' '; map.push(i); lastWasSpace = true; }
      continue;
    }
    const folded = foldChar(ch);
    for (const f of folded) { norm += f; map.push(i); }
    lastWasSpace = false;
  }
  if (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
  return { norm, map };
}

export function normalize(text) {
  return buildIndex(text).norm;
}

export function tokenize(text) {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Normalize edilmiş alıntıyı kaynakta arar.
 * @returns {{start:number,end:number}|null} orijinal metindeki [start,end)
 */
export function locate(index, quote) {
  const q = normalize(quote).replace(/^["'\s]+|["'\s]+$/g, '');
  if (!q) return null;
  const at = index.norm.indexOf(q);
  if (at === -1) return null;
  return { start: index.map[at], end: index.map[at + q.length - 1] + 1 };
}

/**
 * Tam eşleşme yoksa: alıntı tokenlarının, kaynakta en az 3 tokenlık kesintisiz
 * dizilerle karşılanan oranı (soldan sağa açgözlü). Kabul için KULLANILMAZ;
 * yalnızca "benzer metin var ama birebir değil" teşhisi için raporlanır.
 */
export function bestTokenCoverage(sourceTokens, quote, minRun = 3) {
  const qt = tokenize(quote);
  if (qt.length === 0) return 0;
  const positions = new Map();
  sourceTokens.forEach((t, i) => {
    if (!positions.has(t)) positions.set(t, []);
    positions.get(t).push(i);
  });
  let covered = 0;
  let s = 0;
  while (s < qt.length) {
    let best = 0;
    for (const p of positions.get(qt[s]) || []) {
      let k = 0;
      while (s + k < qt.length && sourceTokens[p + k] === qt[s + k]) k++;
      if (k > best) best = k;
    }
    if (best >= Math.min(minRun, qt.length)) { covered += best; s += best; } else s += 1;
  }
  return covered / qt.length;
}
