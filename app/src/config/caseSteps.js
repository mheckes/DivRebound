// Schritte eines DivRebound je Land - für Sidebar (nummerierte Schritte),
// Breadcrumb ("n von N") und die Weiter-Buttons. docs/konzept-schweiz.md §1a.

export const CH_STEPS = [
  { n: 1, title: "Unterlagen prüfen" },
  { n: 2, title: "Bestand prüfen" },
  { n: 3, title: "Dividenden & Tax Voucher" },
  { n: 4, title: "ePortal ausfüllen" },
  { n: 5, title: "Formular & Finanzamt" },
  { n: 6, title: "Hochladen & abschließen" },
];

export const chStepRoute = (caseId, n) => `#/ch/${caseId}/${n}`;
