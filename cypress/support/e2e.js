// Videoda adımları açıklayan altyazı. Analiz sırasında sayfada BULUNMAZ (çıkarıcı
// görünür metni okurken altyazıyı da okumasın diye analizden önce kaldırılır).
Cypress.Commands.add('caption', (text) => {
  cy.document().then((doc) => {
    doc.getElementById('demo-caption')?.remove();
    if (!text) return;
    const el = doc.createElement('div');
    el.id = 'demo-caption';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'fixed', left: '16px', top: '44px', zIndex: 2147483647, maxWidth: 'calc(100vw - 480px)',
      background: 'rgba(20,20,28,.92)', color: '#fff', font: '600 18px/1.4 system-ui, sans-serif',
      padding: '12px 16px', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,.35)',
    });
    doc.body.appendChild(el);
  });
});

Cypress.Commands.add('panel', () => cy.get('#satir-arasi-host').shadow());
