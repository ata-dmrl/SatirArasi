// Sayfa metnini yakalar. İki kanal:
//  1. page-agent PageController → DOM'un LLM için metinleştirilmiş, görünürlük
//     filtresinden geçmiş hali (display/visibility/opacity gizli metin elenir).
//  2. Kendi "sinsi gizleme" dedektörümüz → page-agent'in görünür saydığı ama
//     insanın göremediği metinler (0 punto, ekran dışı, arka planla aynı renk,
//     kırpılmış kutu) + HTML yorumları + aria-label/title öznitelikleri.
// (2)'deki düğümler page-agent okumadan önce geçici olarak boşaltılır; LLM'e yalnızca
// görünür metin gider. (2) ayrıca injection taramasına girer.

import { PageController } from '@page-agent/page-controller';
import { simplifiedHtmlToText } from './page-agent-text.js';
import { detectLegalPage } from './detect.js';

export { simplifiedHtmlToText, detectLegalPage };

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME']);
export const HOST_ID = 'satir-arasi-host';

function parseRGB(c) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c || '');
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

function effectiveBackground(el) {
  for (let e = el; e; e = e.parentElement) {
    const bg = parseRGB(getComputedStyle(e).backgroundColor);
    if (bg && bg.a > 0.9) return bg;
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function stealthReason(el) {
  if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return 'CSS ile gizlenmiş (display/visibility/opacity)';
  const st = getComputedStyle(el);
  if (parseFloat(st.fontSize) < 4) return 'Okunamayacak kadar küçük yazı';
  // Geometrik kontroller yalnızca anlamlı bir görünüm alanında yapılır; aksi halde
  // (ör. 0×0 gizli pencere) her öğe "sıfır boyutlu" görünür ve görünür metin maskelenirdi.
  if (innerWidth > 100 && innerHeight > 100) {
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return 'Sıfır boyutlu / kırpılmış kutu';
    if (r.right + scrollX < 0 || r.bottom + scrollY < 0 || r.left + scrollX > document.documentElement.scrollWidth + 500) return 'Ekran dışına konumlandırılmış';
  }
  if (/rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)|inset\(50%\)/.test(st.clip + ' ' + st.clipPath)) return 'CSS clip ile gizlenmiş';
  const fg = parseRGB(st.color);
  if (fg) {
    if (fg.a < 0.1) return 'Saydam yazı rengi';
    const bg = effectiveBackground(el);
    if (Math.abs(fg.r - bg.r) + Math.abs(fg.g - bg.g) + Math.abs(fg.b - bg.b) < 24) return 'Yazı rengi arka planla aynı';
  }
  return null;
}

/**
 * Kullanıcının göremediği metin düğümlerini bulur.
 * @returns {{ nodes: Text[], segments: {text:string, reason:string}[] }}
 *   nodes: çıkarım sırasında geçici olarak boşaltılacak düğümler (uzunluk sınırı yok;
 *          kelime kelime bölünmüş gizli talimat da sızmasın diye)
 *   segments: injection taraması ve rapor için, aynı öğe altında birleştirilmiş metinler
 */
export function findHidden(root = document.body) {
  const nodes = [];
  const groups = new Map(); // parentElement → { texts, reason }
  const segments = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) {
      if (n.nodeType === 1) {
        if (n.id === HOST_ID || SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (n.nodeType === Node.COMMENT_NODE) {
      if (text.length >= 15) segments.push({ text, reason: 'HTML yorumu' });
      continue;
    }
    const parent = n.parentElement;
    const reason = parent && stealthReason(parent);
    if (!reason) continue;
    nodes.push(n);
    if (!groups.has(parent)) groups.set(parent, { texts: [], reason });
    groups.get(parent).texts.push(text);
  }
  for (const { texts, reason } of groups.values()) {
    const text = texts.join(' ');
    if (text.length >= 15) segments.push({ text, reason });
  }
  for (const el of root.querySelectorAll('[aria-label],[title],[alt]')) {
    for (const attr of ['aria-label', 'title', 'alt']) {
      const v = el.getAttribute(attr);
      if (v && v.length >= 40) segments.push({ text: v.trim(), reason: `${attr} özniteliği` });
    }
  }
  return { nodes, segments };
}

export function findHiddenSegments(root) {
  return findHidden(root).segments;
}

export async function extractPage() {
  const host = document.getElementById(HOST_ID);
  const prevDisplay = host?.style.display;
  if (host) host.style.display = 'none'; // kendi panelimizi okumayalım
  const { nodes, segments } = findHidden();
  // Gizli metin düğümleri page-agent okurken GEÇİCİ olarak boşaltılır; böylece
  // (a) gizli metin modele hiç ulaşmaz, (b) gizli bir kopya, aynı metnin görünür
  // halini çıktıdan sildiremez (satır eşleştirmeyle filtrelemenin açığı buydu).
  const saved = nodes.map((n) => n.nodeValue);
  nodes.forEach((n) => { n.nodeValue = ''; });
  try {
    const pc = new PageController({ viewportExpansion: -1, highlightOpacity: 0, highlightLabelOpacity: 0 });
    const state = await pc.getBrowserState();
    await pc.cleanUpHighlights();
    pc.dispose();
    return {
      url: location.href,
      title: document.title,
      visibleText: simplifiedHtmlToText(state.content),
      hiddenSegments: segments,
      extractor: 'page-agent PageController + gizli düğüm maskesi',
    };
  } finally {
    nodes.forEach((n, i) => { n.nodeValue = saved[i]; });
    if (host) host.style.display = prevDisplay || '';
  }
}
