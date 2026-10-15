// Doğrulanmış alıntıyı sayfada bulur ve CSS Custom Highlight API ile işaretler
// (sayfa DOM'u değiştirilmez). Eşleştirme validate.js ile aynı normalizasyonu kullanır.

import { buildIndex, locate } from '../core/normalize.js';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

function collectTextNodes(root, hostId) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === 1) return n.id === hostId || SKIP.has(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return n.parentElement?.checkVisibility?.() === false ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  return nodes;
}

export function findQuoteRange(quote, { root = document.body, hostId } = {}) {
  const nodes = collectTextNodes(root, hostId);
  let combined = '';
  const starts = [];
  for (const n of nodes) {
    starts.push(combined.length);
    combined += n.nodeValue + ' ';
  }
  const span = locate(buildIndex(combined), quote);
  if (!span) return null;
  const at = (offset) => {
    let i = starts.length - 1;
    while (i > 0 && starts[i] > offset) i--;
    return { node: nodes[i], offset: Math.min(offset - starts[i], nodes[i].nodeValue.length) };
  };
  const a = at(span.start);
  const b = at(span.end);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  return range;
}

export function showQuote(quote, opts) {
  const range = findQuoteRange(quote, opts);
  if (!range) return false;
  if (globalThis.CSS?.highlights && globalThis.Highlight) {
    CSS.highlights.set('satir-arasi', new Highlight(range));
    if (!document.getElementById('satir-arasi-hl-style')) {
      const st = document.createElement('style');
      st.id = 'satir-arasi-hl-style';
      st.textContent = '::highlight(satir-arasi){background:#ffd54a;color:#111;}';
      document.head.appendChild(st);
    }
  }
  // Konum doğrudan hesaplanıp anında kaydırılır: tıklama işleyicisi içinde başlatılan
  // "smooth" kaydırma, odak değişimiyle iptal olabiliyordu (Cypress'te ölçüldü).
  const rect = range.getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - window.innerHeight / 3), behavior: 'auto' });
  return true;
}
