// dist/          → Chrome'a "Paketlenmemiş öğe yükle" ile yüklenecek uzantı
// dist-harness/  → Cypress demo/test harness'i
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(root, ...p);

await rm(r('dist'), { recursive: true, force: true });
await rm(r('dist-harness'), { recursive: true, force: true });
await mkdir(r('dist/icons'), { recursive: true });

const common = { bundle: true, target: 'chrome120', logLevel: 'info', legalComments: 'none', charset: 'utf8' };
await build({ ...common, entryPoints: [r('src/extension/detector.js')], outfile: r('dist/detector.js'), format: 'iife' });
await build({ ...common, entryPoints: [r('src/extension/content.js')], outfile: r('dist/content.js'), format: 'iife' });
await build({ ...common, entryPoints: [r('src/extension/background.js')], outfile: r('dist/background.js'), format: 'esm' });
await build({ ...common, entryPoints: [r('src/harness/harness.js')], outfile: r('dist-harness/harness.js'), format: 'iife' });
await cp(r('src/extension/manifest.json'), r('dist/manifest.json'));
await cp(r('src/extension/options.html'), r('dist/options.html'));
await cp(r('src/extension/options.js'), r('dist/options.js'));

// Basit simge: mor zemin üzerinde beyaz terazi kolu (bağımlılıksız PNG üretimi).
function png(size) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    px[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const u = x / size, v = y / size;
      const inCircle = (u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.24;
      const mark = (Math.abs(u - 0.5) < 0.05 && v > 0.22 && v < 0.78) || (Math.abs(v - 0.3) < 0.04 && u > 0.2 && u < 0.8) || (Math.abs(v - 0.76) < 0.04 && u > 0.32 && u < 0.68);
      const [cr, cg, cb] = mark ? [255, 255, 255] : [122, 46, 140];
      px[i] = cr; px[i + 1] = cg; px[i + 2] = cb; px[i + 3] = inCircle ? 255 : 0;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]);
}
for (const s of [16, 48, 128]) await writeFile(r(`dist/icons/${s}.png`), png(s));
console.log('Derleme tamam: dist/ (uzantı), dist-harness/ (demo)');
