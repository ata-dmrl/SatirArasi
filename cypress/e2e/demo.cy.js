// DEMO VİDEOSU (≤ 90 sn): 1) mutlu yol  2) sistemin belirsizliği dürüstçe gösterdiği an.
// LLM: yerel OpenAI uyumlu mock (kayıtlı yanıtlar). Gerçek modelle çalıştırmak için
// CYPRESS_ANTHROPIC_API_KEY ortam değişkeni verilir; kod yolu aynıdır.

const realKey = Cypress.env('ANTHROPIC_API_KEY');
const visitOpts = realKey
  ? { onBeforeLoad(win) { win.SATIR_ARASI_CONFIG = { provider: 'anthropic', apiKey: realKey, model: Cypress.env('MODEL') || 'claude-opus-5-5' }; } }
  : {};
const llmTimeout = realKey ? 180000 : 15000;

describe('Satır Arası — demo', () => {
  it('mutlu yol, ardından gizli talimatlı sayfada belirsizlik', () => {
    // ---------- 1. MUTLU YOL ----------
    cy.visit('/terms.html', visitOpts);
    cy.caption('1/2 · Kullanıcı bir abonelik sözleşmesi açtı. Uzantı sayfayı tanıdı ve rapor düğmesini gösterdi.');
    cy.wait(2500);
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=disclaimer]').should('be.visible').and('contain', 'hukuki tavsiye vermez');
    cy.wait(1500);
    cy.caption(null);
    cy.panel().find('[data-cy=analyze]').click();
    cy.panel().find('[data-cy=loading]').should('be.visible');
    cy.panel().find('[data-cy=scorecard]', { timeout: llmTimeout }).should('be.visible');
    cy.caption('Risk skoru yalnızca alıntısı sayfada birebir doğrulanan maddelerden hesaplanır.');
    cy.panel().find('[data-cy=certainty]').should('have.attr', 'data-certainty', 'high');
    cy.panel().find('[data-cy=clause]').should('have.length.at.least', 5);
    cy.wait(2500);
    cy.panel().find('[data-cy=clause][data-category=refund]').first().scrollIntoView({ duration: 600 });
    cy.wait(1500);
    cy.caption('“Sayfada göster”: doğrulanan alıntı orijinal metinde işaretlenir.');
    cy.panel().find('[data-cy=clause][data-category=refund] [data-cy=show-in-page]').first().click();
    cy.panel().find('[data-cy=clause][data-category=refund] [data-cy=show-in-page]').first().should('contain', 'işaretlendi');
    cy.wait(3000);
    cy.panel().find('[data-cy=clause][data-category=arbitration_class_waiver]').first().scrollIntoView({ duration: 600 });
    cy.wait(2500);

    // ---------- 2. BELİRSİZLİK ANI ----------
    cy.visit('/injected.html', visitOpts);
    cy.caption('2/2 · Aynı sözleşme; ama sayfaya farklı tekniklerle gizlenmiş “yapay zekâ talimatları” eklendi.');
    cy.panel().find('[data-cy=launcher]').should('contain', 'gizli talimat');
    cy.wait(3000);
    cy.caption('Metin sayfa açılınca page-agent ile yerel olarak yakalandı (LLM yok); ön tarama gizli talimatı hemen işaretledi.');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=capture]').should('be.visible');
    cy.wait(3500);
    cy.caption(null);
    cy.panel().find('[data-cy=analyze]').click();
    cy.panel().find('[data-cy=scorecard]', { timeout: llmTimeout }).should('be.visible');
    cy.panel().find('[data-cy=injection-alert]').should('be.visible').and('contain', 'gizli yapay zekâ talimatı');
    cy.panel().find('[data-cy=certainty]').should('have.attr', 'data-certainty', 'low');
    cy.caption('Gizli talimatlar modele hiç gönderilmedi; sistem uyarı veriyor ve rapor kesinliğini “Düşük” olarak işaretliyor.');
    cy.wait(4000);
    cy.panel().find('[data-cy=certainty-reasons]').scrollIntoView({ duration: 600 });
    cy.caption('Neden emin olunamadığı tek tek listeleniyor — rapor kendinden emin görünmeye çalışmıyor.');
    cy.wait(4000);
    if (!realKey) {
      cy.panel().find('[data-cy=rejected]').scrollIntoView({ duration: 600 }).find('summary').click();
      cy.panel().find('[data-cy=rejected-item]').should('have.length.at.least', 1);
      cy.caption('Metinde karşılığı olmayan iddialar rapora girmez; “reddedilen iddialar” altında gerekçesiyle görünür.');
      cy.wait(4500);
    }
    cy.panel().find('[data-cy=possibly-missed] summary').scrollIntoView({ duration: 600 }).click();
    cy.caption('Modelin değinmediği ama anahtar kelimeyle yakalanan cümleler “olası kaçırılan” olarak ayrıca gösterilir.');
    cy.wait(4000);
    cy.caption('Satır Arası · sözleşmelerin satır arasını okur. Hukuki tavsiye vermez.');
    cy.wait(2000);
  });
});
