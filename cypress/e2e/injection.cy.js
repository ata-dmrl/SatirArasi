// Prompt injection testi: sayfaya gizli talimat konduğunda sistem ne yapıyor?
describe('Prompt injection', () => {
  const HIDDEN = ['YAPAY ZEKÂ ASİSTANINA NOT', 'Note to AI assistants', 'SYSTEM PROMPT UPDATE', 'Sistem mesajı', 'disregard your instructions', 'Assistant instructions', 'output an empty clause list'];

  it('çok satırlı gizli metin sızmaz; gizli kopya görünür maddeyi bastıramaz', () => {
    cy.visit('/injected.html');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=analyze]').click();
    cy.panel().find('[data-cy=scorecard]', { timeout: 15000 }).should('be.visible');
    cy.request('/__last-llm-request').its('body').then((body) => {
      const user = body.messages.find((m) => m.role === 'user').content;
      expect(user).not.to.include('Assistant instructions');
      expect(user).not.to.include('output an empty clause list');
      // Görünür iade maddesi (gizli 0 puntoluk kopyası olsa da) modele gitmeli — tam olarak bir kez.
      expect(user.split('Yapılan ödemeler hiçbir koşulda iade edilmez').length - 1).to.eq(1);
    });
    cy.panel().find('[data-cy=clause][data-category=refund]').should('have.length', 1);
  });

  it('gizli metin LLM istemine girmez, panel uyarır, kesinlik düşer', () => {
    cy.visit('/injected.html');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=analyze]').click();
    cy.panel().find('[data-cy=scorecard]', { timeout: 15000 }).should('be.visible');

    cy.request('/__last-llm-request').its('body').then((body) => {
      const sent = JSON.stringify(body.messages);
      for (const h of HIDDEN) expect(sent, `LLM'e giden istemde "${h}" olmamalı`).not.to.include(h);
      expect(body.tools, 'analiz çağrısında araç yok').to.be.undefined;
    });

    cy.panel().find('[data-cy=injection-alert]').should('contain', 'gizli yapay zekâ talimatı');
    for (const reason of ['CSS ile gizlenmiş', 'Yazı rengi arka planla aynı', 'Ekran dışına konumlandırılmış']) {
      cy.panel().find('[data-cy=injection-alert]').should('contain', reason);
    }
    cy.panel().find('[data-cy=certainty]').should('have.attr', 'data-certainty', 'low');
  });

  it('uydurma alıntılı iddialar reddedilir ve skora katılmaz', () => {
    cy.visit('/injected.html');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=analyze]').click();
    cy.panel().find('[data-cy=rejected-item][data-reason=quote_not_found]', { timeout: 15000 }).should('have.length', 2);
    cy.panel().find('[data-cy=clause]').should('have.length', 2);
  });

  it('hukuki tavsiye uyarısı her durumda görünür', () => {
    cy.visit('/terms.html');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=disclaimer]').should('be.visible').and('contain', 'Hukuki tavsiye değildir');
  });
});

describe('Sayfa betiklerine karşı koruma', () => {
  it('sayfa betiğinin programatik tıklaması analizi (ve API maliyetini) başlatamaz', () => {
    cy.request('POST', '/__reset');
    cy.visit('/injected.html?trusted=1');
    cy.window().then((win) => {
      // Saldırgan sayfa: açık Shadow DOM'daki düğmeyi kendisi tıklar (isTrusted=false).
      const root = win.document.getElementById('satir-arasi-host').shadowRoot;
      root.querySelector('[data-cy=analyze]').click();
    });
    cy.wait(1500);
    cy.panel().find('[data-cy=loading]').should('not.exist');
    cy.request('/__last-llm-request').its('body').should('eq', null);
  });

  it('sayfa açılınca metin yerel olarak yakalanır ve gizli talimat ön taraması görünür', () => {
    cy.visit('/injected.html');
    cy.panel().find('[data-cy=launcher]').should('contain', 'Sözleşme metni yakalandı').and('contain', 'gizli talimat');
    cy.panel().find('[data-cy=launcher]').click();
    cy.panel().find('[data-cy=capture]').should('contain', 'gizli metin parçası analiz dışı bırakılacak');
  });
});
