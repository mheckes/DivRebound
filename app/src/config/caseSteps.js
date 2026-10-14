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

// Dänemark: bestehende Routen, neu nummeriert. Schritt 5 umfasst
// "SKAT-Formular öffnen" (step2/verify) und das Cheat Sheet (step2/cheatsheet).
export const DK_STEPS = [
  { n: 1, title: "Unterlagen prüfen", path: "checklist" },
  { n: 2, title: "Dividendenabrechnungen", path: "step1" },
  { n: 3, title: "Fehlende Angaben", path: "step1/missing-data" },
  { n: 4, title: "Formular & Finanzamt", path: "step1/summary" },
  { n: 5, title: "SKAT-Portal ausfüllen", path: "step2/verify" },
];

export const dkStepRoute = (caseId, n) => `#/dk/${caseId}/${DK_STEPS.find((s) => s.n === n).path}`;

/** Aktueller DK-Schritt aus dem Hash, 0 wenn keiner */
export function dkStepFromHash(hash) {
  const path = hash.match(/^#\/dk\/[^/]+\/(.+)$/)?.[1];
  if (!path) return 0;
  if (path.startsWith("step2")) return 5;
  return DK_STEPS.find((s) => s.path === path)?.n ?? 0;
}
