// Gerçek ToS metinlerini indirir → eval/corpus/<id>.txt (git'e girmez; telif sahiplerine ait).
// Metinler zamanla değişir: manifest'te indirme tarihi ve sha256 tutulur; altın etiket
// çapası bulunamazsa run-eval bunu açıkça raporlar.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText } from './html-to-text.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(await readFile(path.join(dir, 'corpus.json'), 'utf8'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
await mkdir(path.join(dir, 'corpus'), { recursive: true });

const manifest = {};
for (const doc of corpus) {
  const res = await fetch(doc.url, { headers: { 'user-agent': UA, ...(doc.headers || {}) }, redirect: 'follow' });
  if (!res.ok) { console.error(`✗ ${doc.id}: HTTP ${res.status}`); continue; }
  let text = htmlToText(await res.text());
  if (doc.crop) {
    const s = text.indexOf(doc.crop.start);
    const e = text.indexOf(doc.crop.end, s);
    if (s === -1 || e === -1) console.warn(`! ${doc.id}: kırpma çapası bulunamadı, tüm metin kullanılıyor`);
    else text = text.slice(s, e + doc.crop.end.length);
  }
  await writeFile(path.join(dir, 'corpus', `${doc.id}.txt`), text);
  manifest[doc.id] = { url: doc.url, fetchedAt: new Date().toISOString(), chars: text.length, sha256: createHash('sha256').update(text).digest('hex') };
  console.log(`✓ ${doc.id}: ${text.length} karakter`);
}
await writeFile(path.join(dir, 'corpus', 'manifest.json'), JSON.stringify(manifest, null, 2));
