// Schritte eines DivRebound je Land - für Sidebar (nummerierte Schritte),
// Breadcrumb ("n von N") und die Weiter-Buttons. docs/konzept-schweiz.md §1a.
// Alle Länder: Routen #/<land>/:caseId/:n und als letzter, optionaler Schritt
// "Erstattung erhalten" (screens/shared/refundReceived.js).

export const REFUND_STEP_TITLE = "Erstattung erhalten";

export const CH_STEPS = [
  { n: 1, title: "Unterlagen prüfen" },
  { n: 2, title: "Bestand prüfen" },
  { n: 3, title: "Dividenden & Tax Voucher" },
  { n: 4, title: "ePortal ausfüllen" },
  { n: 5, title: "Formular & Finanzamt" },
  { n: 6, title: "Hochladen & abschließen" },
  { n: 7, title: REFUND_STEP_TITLE, optional: true },
];

export const chStepRoute = (caseId, n) => `#/ch/${caseId}/${n}`;

// Italien: Ablauf wie Dänemark, statt SKAT-Portal Versand per Post
// (docs/konzept-italien.md §1).
export const IT_STEPS = [
  { n: 1, title: "Unterlagen prüfen" },
  { n: 2, title: "Dividendenabrechnungen" },
  { n: 3, title: "Fehlende Angaben" },
  { n: 4, title: "Formular & Finanzamt" },
  { n: 5, title: "Versand nach Italien" },
  { n: 6, title: REFUND_STEP_TITLE, optional: true },
];

export const itStepRoute = (caseId, n) => `#/it/${caseId}/${n}`;

// Schweden: gleicher Ablauf wie Italien (Papierformular SKV 3740, Finanzamt,
// Versand per Post), docs/konzept-schweden.md.
export const SE_STEPS = [
  { n: 1, title: "Unterlagen prüfen" },
  { n: 2, title: "Dividendenabrechnungen" },
  { n: 3, title: "Fehlende Angaben" },
  { n: 4, title: "Formular & Finanzamt" },
  { n: 5, title: "Versand nach Schweden" },
  { n: 6, title: REFUND_STEP_TITLE, optional: true },
];

export const seStepRoute = (caseId, n) => `#/se/${caseId}/${n}`;

// Dänemark: Schritt 5 ist der Spickzettel fürs SKAT-Formular, Schritt 6 der
// Abschluss (wie "Hochladen & abschließen" bei der Schweiz).
export const DK_STEPS = [
  { n: 1, title: "Unterlagen prüfen" },
  { n: 2, title: "Dividendenabrechnungen" },
  { n: 3, title: "Fehlende Angaben" },
  { n: 4, title: "Formular & Finanzamt" },
  { n: 5, title: "SKAT-Portal ausfüllen" },
  { n: 6, title: "Einreichen & abschließen" },
  { n: 7, title: REFUND_STEP_TITLE, optional: true },
];

export const dkStepRoute = (caseId, n) => `#/dk/${caseId}/${n}`;

/** Aktueller Schritt aus dem Hash (#/<land>/:caseId/:n), 0 wenn keiner */
export function stepFromHash(hash, country) {
  return Number(hash.match(new RegExp(`^#/${country}/[^/]+/(\\d)$`))?.[1] ?? 0);
}
