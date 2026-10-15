// page-agent PageController çıktısını ("simplified HTML") düz metne çevirir.
// Ayrı modül: Node testlerinde page-agent'i (window gerektirir) yüklemeden kullanılabilsin.

export function simplifiedHtmlToText(content) {
  const out = [];
  let inInteractive = false;
  for (const rawLine of content.split('\n')) {
    let line = rawLine.replace(/^\t+/, '');
    if (inInteractive) {
      const end = line.endsWith(' />');
      if (end) { line = line.slice(0, -3); inInteractive = false; }
      if (line.trim()) out.push(line.trim());
      continue;
    }
    if (/^\*?\[\d+\]<[^>]*\/>$/.test(line)) continue; // metinsiz etkileşimli öğe: "[3]<button />"
    const m = /^\*?\[\d+\]<[^>]*>(.*)$/.exec(line);
    if (m) {
      let text = m[1];
      if (text.endsWith(' />')) text = text.slice(0, -3);
      else inInteractive = true;
      if (text.trim()) out.push(text.trim());
      continue;
    }
    if (/^<\/?[a-z]+>$/.test(line.trim())) continue; // semantik etiket işaretleri
    if (line.trim()) out.push(line.trim());
  }
  return out.join('\n');
}
