// Her http(s) sayfasında çalışan KÜÇÜK içerik betiği (page-agent içermez).
// Sözleşme sayfası tanınırsa arka plandan tam betiğin (content.js: page-agent +
// panel) bu sekmeye enjekte edilmesini ister. SPA'larda URL değişimini izler.

import { detectLegal } from './detect.js';

let lastUrl = '';

function check() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  const d = detectLegal();
  if (d.legal) chrome.runtime.sendMessage({ type: 'legalPageDetected', why: d.why }).catch(() => {});
}

check();
// SPA gezinmesi (pushState) içerik betiğinin izole dünyasından yakalanamadığı için basit yoklama.
setInterval(check, 1500);
