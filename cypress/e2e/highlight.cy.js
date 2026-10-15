// "Sayfada göster": doğrulanan alıntı orijinal metinde bulunur, işaretlenir ve görünür alana kaydırılır.
it('alıntı sayfada işaretlenir ve görünür alana kaydırılır', () => {
  cy.visit('/terms.html');
  cy.panel().find('[data-cy=launcher]').click();
  cy.panel().find('[data-cy=analyze]').click();
  cy.panel().find('[data-cy=clause][data-category=refund] [data-cy=show-in-page]').click().should('contain', 'işaretlendi');
  cy.window().then((w) => {
    const range = [...w.CSS.highlights.get('satir-arasi')][0];
    expect(range.toString()).to.include('Yapılan ödemeler hiçbir koşulda iade edilmez');
    const top = range.getBoundingClientRect().top;
    expect(top).to.be.within(0, w.innerHeight);
  });
});
