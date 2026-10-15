// Sayfa içi rapor paneli (Shadow DOM içinde; sayfa stilleriyle çakışmaz).
// Tüm sayfa/LLM kaynaklı metinler textContent ile basılır — innerHTML yok.

import { showQuote } from './highlight.js';
import { STYLES } from './styles.js';

export const DISCLAIMER = 'Bu araç hukuki tavsiye vermez. Rapor, metnin otomatik bir okumasıdır ve hata içerebilir; bağlayıcı bir karar vermeden önce metnin tamamını okuyun ve gerekirse bir hukukçuya danışın.';

const SEV_LABEL = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
const DOC_LABEL = { terms: 'Kullanım koşulları', privacy: 'Gizlilik politikası', subscription: 'Abonelik şartları', mixed: 'Karma sözleşme metni', not_legal: 'Sözleşme metni değil' };

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * @param {object} o
 * @param {() => Promise<object>} o.analyze   sayfayı çıkarıp raporu döndürür
 * @param {boolean} o.legalDetected           sayfa sözleşme metnine benziyor mu
 * @param {string} o.hostId
 * @param {(cmd:string)=>Promise<string>} [o.agent] page-agent komut çalıştırıcı (isteğe bağlı)
 * @param {() => void} [o.openOptions]
 * @param {boolean} [o.requireTrustedClicks] true: yalnızca gerçek kullanıcı tıklaması
 *        (event.isTrusted) analizi başlatır; sayfa betikleri açık Shadow DOM'daki
 *        düğmeye programatik tıklayıp kullanıcının API kotasını harcayamaz.
 */
export function mountApp({ analyze, legalDetected, hostId, agent, openOptions, requireTrustedClicks = false }) {
  let host = document.getElementById(hostId);
  if (host) host.remove();
  host = h('div', { id: hostId });
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(h('style', {}, STYLES));
  document.documentElement.append(host);

  const body = h('div', { class: 'body', 'data-cy': 'panel-body' });
  const panel = h('aside', { class: 'panel', hidden: true, 'data-cy': 'panel', role: 'dialog', 'aria-label': 'Sözleşme risk raporu' },
    h('header', {},
      h('div', { class: 'brand' }, h('span', { class: 'logo' }, '⚖'), ' Satır Arası', h('div', { class: 'tagline' }, 'sözleşmelerin satır arasını okur')),
      h('div', { class: 'hdr-actions' },
        openOptions && h('button', { class: 'icon', title: 'Ayarlar', onclick: openOptions }, '⚙'),
        h('button', { class: 'icon', title: 'Kapat', 'data-cy': 'close', onclick: () => toggle(false) }, '✕'))),
    h('div', { class: 'disclaimer', role: 'note', 'data-cy': 'disclaimer' }, h('strong', {}, 'Hukuki tavsiye değildir. '), DISCLAIMER),
    body);
  const launcher = h('button', { class: 'launcher', 'data-cy': 'launcher', title: 'Satır Arası — hukuki tavsiye değildir', onclick: () => toggle() },
    '⚖ ', legalDetected ? 'Bu bir sözleşme metni gibi görünüyor — risk raporu' : 'Risk raporu');
  if (!legalDetected) launcher.classList.add('subtle');
  shadow.append(launcher, panel);

  let lastReport = null;
  let capture = null;
  let running = false;
  let state = 'idle';
  renderIdle();

  // Kullanıcı eylemi: isTrusted denetimi + eşzamanlı ikinci analizi engelle.
  function userRun(e) {
    if (requireTrustedClicks && !e?.isTrusted) return;
    run();
  }

  /** Sayfa açılışında yerel (LLM'siz) yakalamanın özeti. */
  function setCapture(c) {
    capture = c;
    if (legalDetected) {
      launcher.replaceChildren('⚖ ', `Sözleşme metni yakalandı (${c.chars.toLocaleString('tr-TR')} karakter) — risk raporu`,
        c.injectionLevel === 'high' ? ' · ⚠ gizli talimat' : '');
      launcher.dataset.capturedChars = String(c.chars);
    }
    if (state === 'idle') renderIdle();
  }

  function toggle(force) {
    const show = force ?? panel.hidden;
    panel.hidden = !show;
    launcher.hidden = show;
  }

  function renderIdle() {
    state = 'idle';
    body.replaceChildren(
      capture && h('p', { class: 'small capture', 'data-cy': 'capture' },
        `Sayfa açılırken page-agent ile ${capture.chars.toLocaleString('tr-TR')} karakter görünür metin yakalandı`,
        capture.hiddenSegments ? `; ${capture.hiddenSegments} gizli metin parçası analiz dışı bırakılacak` : '',
        capture.injectionLevel === 'high' ? ' (içlerinde yapay zekâya yönelik talimat var).' : '.'),
      h('p', { class: 'muted' }, legalDetected
        ? 'Sayfa bir kullanım koşulları / gizlilik / abonelik metnine benziyor. Analiz, yalnızca ekranda gördüğünüz metni okur.'
        : 'Bu sayfa sözleşme metnine benzemiyor; yine de analiz edebilirsiniz.'),
      h('button', { class: 'primary', 'data-cy': 'analyze', onclick: userRun }, 'Riskleri analiz et'));
  }

  async function run() {
    if (running) return;
    running = true;
    state = 'running';
    body.replaceChildren(h('div', { class: 'loading', 'data-cy': 'loading' }, h('span', { class: 'spinner' }), 'Metin okunuyor ve analiz ediliyor…'));
    try {
      lastReport = await analyze();
      state = 'report';
      renderReport(lastReport);
    } catch (err) {
      state = 'error';
      body.replaceChildren(
        h('div', { class: 'error', 'data-cy': 'error' }, 'Analiz yapılamadı: ', err?.message || String(err)),
        h('button', { class: 'primary', onclick: userRun }, 'Tekrar dene'));
    } finally {
      running = false;
    }
  }

  function renderReport(r) {
    const parts = [];
    if (r.status === 'invalid_output') {
      parts.push(h('div', { class: 'error', 'data-cy': 'invalid' }, h('strong', {}, 'Rapor üretilmedi. '), r.certaintyReasons.join(' ')));
      parts.push(h('p', { class: 'muted' }, 'Model çıktısı doğrulanamadığında sistem tahmin yürütmek yerine raporu bilerek boş bırakır.'));
      body.replaceChildren(...parts, rerunBtn());
      return;
    }

    parts.push(h('section', { class: 'scorecard', 'data-cy': 'scorecard', 'data-level': r.level.key },
      h('div', { class: 'gauge' }, h('div', { class: 'score', 'data-cy': 'score' }, String(r.score)), h('div', { class: 'of' }, '/100')),
      h('div', { class: 'scoremeta' },
        h('div', { class: 'level' }, 'Risk düzeyi: ', h('strong', {}, r.level.label)),
        h('div', { class: `certainty c-${r.certainty}`, 'data-cy': 'certainty', 'data-certainty': r.certainty }, 'Rapor kesinliği: ', h('strong', {}, r.certaintyLabel)),
        h('div', { class: 'muted small' }, DOC_LABEL[r.documentType] || r.documentType, ' · ', `${r.clauses.length} doğrulanmış madde`))));

    if (r.injection.level !== 'none') {
      const hits = [...r.injection.hiddenInstructionHits.map((x) => ({ ...x, where: 'Gizli: ' + x.reason })), ...r.injection.visibleInstructionHits.map((x) => ({ ...x, where: 'Görünür metin' }))];
      parts.push(h('section', { class: `alert a-${r.injection.level}`, 'data-cy': 'injection-alert' },
        h('strong', {}, r.injection.level === 'high' ? '⚠ Sayfada gizli yapay zekâ talimatı bulundu' : '⚠ Metinde yapay zekâya yönelik talimat benzeri ifade var'),
        h('p', {}, 'Bu ifadeler analiz talimatı olarak uygulanmadı. Gizli metin modele hiç gönderilmedi; skor yalnızca doğrulanmış alıntılardan hesaplandı.'),
        h('ul', {}, hits.slice(0, 5).map((x) => h('li', {}, h('em', {}, x.where, ': '), '“', x.text.slice(0, 180), '”')))));
    }

    if (r.certaintyReasons.length) {
      parts.push(h('details', { class: 'reasons', open: r.certainty !== 'high', 'data-cy': 'certainty-reasons' },
        h('summary', {}, 'Bu rapordan ne kadar emin olabilirsiniz?'),
        h('ul', {}, r.certaintyReasons.map((x) => h('li', {}, x)))));
    }

    if (r.summary) parts.push(h('section', { class: 'summary' }, h('h3', {}, 'Özet'), h('p', { 'data-cy': 'summary' }, r.summary)));

    parts.push(h('h3', {}, 'Riskli maddeler'));
    if (!r.clauses.length) parts.push(h('p', { class: 'muted', 'data-cy': 'no-clauses' }, 'Alıntıyla doğrulanabilen riskli madde bulunamadı. Bu, metnin risksiz olduğu anlamına gelmez.'));
    const list = h('ol', { class: 'clauses', 'data-cy': 'clauses' });
    for (const c of r.clauses) {
      list.append(h('li', { class: `clause s-${c.severity}`, 'data-cy': 'clause', 'data-category': c.category },
        h('div', { class: 'chead' }, h('span', { class: `sev s-${c.severity}` }, SEV_LABEL[c.severity]), h('span', { class: 'cat' }, c.categoryLabel)),
        h('p', { class: 'expl' }, c.explanation_tr),
        c.adviceLanguage && h('p', { class: 'small warn' }, 'Not: açıklama tavsiye niteliğinde ifade içeriyor; yalnızca bilgilendirme olarak okuyun.'),
        h('blockquote', { 'data-cy': 'quote' }, c.quote),
        h('div', { class: 'cfoot' },
          h('span', { class: 'verified', title: 'Alıntı sayfa metninde birebir bulundu' }, '✓ alıntı doğrulandı'),
          h('span', { class: 'muted small' }, ` · model güveni %${Math.round(c.confidence * 100)}`),
          h('button', { class: 'link', 'data-cy': 'show-in-page', onclick: (e) => { e.target.textContent = showQuote(c.quote, { hostId }) ? 'Sayfada işaretlendi' : 'Sayfada bulunamadı'; } }, 'Sayfada göster'))));
    }
    parts.push(list);

    if (r.possiblyMissed?.length) {
      parts.push(h('details', { class: 'missed', 'data-cy': 'possibly-missed' },
        h('summary', {}, `Olası kaçırılanlar (${r.possiblyMissed.length}) — doğrulanmamış anahtar kelime eşleşmesi`),
        h('p', { class: 'small muted' }, 'Model bu kategorilere değinmedi; basit kelime taraması ise ilgili cümleler buldu. Yanlış alarm olabilir, skora katılmadı.'),
        h('ul', {}, r.possiblyMissed.map((m) => h('li', {}, h('strong', {}, m.categoryLabel, ': '), '“', m.quote.slice(0, 220), m.quote.length > 220 ? '…' : '', '”')))));
    }

    const shownRejected = r.rejected.filter((x) => x.reason !== 'duplicate');
    if (shownRejected.length) {
      parts.push(h('details', { class: 'rejected', 'data-cy': 'rejected' },
        h('summary', {}, `Reddedilen iddialar (${shownRejected.length}) — alıntı doğrulamasından geçemedi`),
        h('ul', {}, shownRejected.map((x) => h('li', { 'data-cy': 'rejected-item', 'data-reason': x.reason },
          h('strong', {}, x.reasonText), x.coverage != null ? ` (benzerlik %${Math.round(x.coverage * 100)})` : '', ': “', String(x.clause?.quote ?? '').slice(0, 200), '”')))));
    }

    if (agent && r.injection.level === 'none') parts.push(agentBox());
    else if (agent) parts.push(h('p', { class: 'small muted' }, 'Sayfada injection şüphesi olduğu için page-agent ile sayfa üzerinde işlem yapma kapatıldı.'));

    parts.push(h('footer', { class: 'meta small muted' },
      `Model: ${r.meta.provider}/${r.meta.model || '-'} · ${r.page.chars.toLocaleString('tr-TR')} karakter`,
      r.page.coverage < 1 ? ` · kapsam %${Math.round(r.page.coverage * 100)}` : '',
      ' · ', h('button', { class: 'link', onclick: exportJSON }, 'JSON indir')));
    parts.push(rerunBtn());
    body.replaceChildren(...parts);
  }

  function rerunBtn() {
    return h('button', { class: 'secondary', onclick: userRun, 'data-cy': 'rerun' }, 'Yeniden analiz et');
  }

  function agentBox() {
    const input = h('input', { type: 'text', placeholder: 'ör. "İptal koşulları bölümüne kaydır"', 'aria-label': 'page-agent komutu' });
    const out = h('div', { class: 'small muted' });
    return h('section', { class: 'agent' },
      h('h3', {}, 'page-agent ile sayfada gezin'),
      h('form', { onsubmit: async (e) => { e.preventDefault(); out.textContent = 'Çalışıyor…'; try { out.textContent = await agent(input.value); } catch (err) { out.textContent = 'Hata: ' + err.message; } } },
        input, h('button', { class: 'secondary', type: 'submit' }, 'Çalıştır')),
      out);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ disclaimer: DISCLAIMER, ...lastReport }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'satir-arasi-rapor.json' });
    shadow.append(a);
    a.click();
    a.remove();
  }

  return { toggle, run, setCapture, host };
}
