// Ablauf eines Antrags je Land - für Seitenleiste, Breadcrumb ("Schritt n von N")
// und die Weiter-Buttons. Alle Länder folgen denselben drei Phasen
// (Vorbereiten -> Bestätigen lassen -> Einreichen), siehe
// Mock Up Ablauf 11-2026/divrebound_ablauf_mockup.html.
//
// Die Reihenfolge im Array ist die Reihenfolge für den Nutzer. `n` ist nur die
// Routen-Nummer (#/<land>/:caseId/:n) und bleibt stabil, damit gespeicherte
// Fälle (stepsDone) weiter passen - sie muss NICHT aufsteigend sein.
//   intro    Überblick "So läuft es ab", ohne Nummer
//   phase    Phase, unter der der Schritt in der Seitenleiste steht
//   parent   zweite Seite desselben Schritts (keine eigene Zeile, keine Nummer)
//   hidden   nicht in der Seitenleiste (Erstattung: Frage auf der Übersicht)

export const REFUND_STEP_TITLE = "Erstattung erhalten";

export const PHASES = {
  prepare: { title: "Vorbereiten", time: "ca. 15 Min." },
  confirm: { title: "Bestätigen lassen", time: "2–3 Wochen" },
  submit: { title: "Einreichen", time: "ca. 10 Min." },
};
export const PHASE_ORDER = ["prepare", "confirm", "submit"];

const INTRO = { n: 1, title: "So läuft es ab", intro: true };

export const DK_STEPS = [
  INTRO,
  { n: 2, title: "Abrechnungen", heading: "Abrechnungen hochladen", phase: "prepare" },
  { n: 3, title: "Deine Angaben", phase: "prepare" },
  { n: 4, title: "Deutsches Finanzamt", heading: "Vom deutschen Finanzamt bestätigen lassen", phase: "confirm" },
  { n: 5, title: "Dänische Steuerbehörde", heading: "Bei der dänischen Steuerbehörde einreichen", phase: "submit" },
  { n: 6, title: "Antrag absenden", heading: "Antrag absenden", phase: "submit", parent: 5 },
  { n: 7, title: REFUND_STEP_TITLE, optional: true, hidden: true },
];

// Schweiz: Das ePortal erzeugt den Antrag, deshalb gehört "ePortal ausfüllen"
// noch zum Vorbereiten. "Deine Angaben" hat die Routen-Nummer 8 (neu, 1-7
// waren vergeben).
export const CH_STEPS = [
  INTRO,
  { n: 2, title: "Wertpapierbestand", heading: "Wertpapierbestand prüfen", phase: "prepare" },
  { n: 3, title: "Dividenden & Tax Voucher", phase: "prepare" },
  { n: 8, title: "Deine Angaben", phase: "prepare" },
  { n: 4, title: "ePortal ausfüllen", phase: "prepare" },
  { n: 5, title: "Deutsches Finanzamt", heading: "Vom deutschen Finanzamt bestätigen lassen", phase: "confirm" },
  { n: 6, title: "Schweizer Steuerverwaltung", heading: "Bei der Schweizer Steuerverwaltung einreichen", phase: "submit" },
  { n: 7, title: REFUND_STEP_TITLE, optional: true, hidden: true },
];

export const IT_STEPS = [
  INTRO,
  { n: 2, title: "Abrechnungen", heading: "Abrechnungen hochladen", phase: "prepare" },
  { n: 3, title: "Deine Angaben", phase: "prepare" },
  { n: 4, title: "Deutsches Finanzamt", heading: "Vom deutschen Finanzamt bestätigen lassen", phase: "confirm" },
  { n: 5, title: "Italienische Steuerbehörde", heading: "Bei der italienischen Steuerbehörde einreichen", phase: "submit" },
  { n: 6, title: REFUND_STEP_TITLE, optional: true, hidden: true },
];

export const SE_STEPS = [
  INTRO,
  { n: 2, title: "Abrechnungen", heading: "Abrechnungen hochladen", phase: "prepare" },
  { n: 3, title: "Deine Angaben", phase: "prepare" },
  { n: 4, title: "Deutsches Finanzamt", heading: "Vom deutschen Finanzamt bestätigen lassen", phase: "confirm" },
  { n: 5, title: "Schwedische Steuerbehörde", heading: "Bei der schwedischen Steuerbehörde einreichen", phase: "submit" },
  { n: 6, title: REFUND_STEP_TITLE, optional: true, hidden: true },
];

export const dkStepRoute = (caseId, n) => `#/dk/${caseId}/${n}`;
export const chStepRoute = (caseId, n) => `#/ch/${caseId}/${n}`;
export const itStepRoute = (caseId, n) => `#/it/${caseId}/${n}`;
export const seStepRoute = (caseId, n) => `#/se/${caseId}/${n}`;

/** Aktueller Schritt aus dem Hash (#/<land>/:caseId/:n), 0 wenn keiner */
export function stepFromHash(hash, country) {
  return Number(hash.match(new RegExp(`^#/${country}/[^/]+/(\\d)$`))?.[1] ?? 0);
}

export const stepOf = (steps, n) => steps.find((s) => s.n === n);

/** Schritte mit eigener Nummer (ohne Überblick, Folgeseiten und Erstattung) */
export const numberedSteps = (steps) => steps.filter((s) => s.phase && !s.parent);

/** Nummer für den Nutzer; Folgeseiten tragen die Nummer ihres Schritts. 0 = ohne Nummer */
export function displayNumber(steps, n) {
  const step = stepOf(steps, n);
  if (!step) return 0;
  return numberedSteps(steps).findIndex((s) => s.n === (step.parent ?? step.n)) + 1;
}

/** "Bestätigen lassen › Schritt 3 von 4" bzw. "" für Überblick und Erstattung */
export function stepPosition(steps, n) {
  const step = stepOf(steps, n);
  const num = displayNumber(steps, n);
  if (!step?.phase || !num) return "";
  return `${PHASES[step.phase].title} › Schritt ${num} von ${numberedSteps(steps).length}`;
}

/** Nachbar in der Reihenfolge für den Nutzer (delta +1 / -1), Erstattung ausgenommen */
export function neighborStep(steps, n, delta) {
  const walk = steps.filter((s) => !s.hidden);
  const i = walk.findIndex((s) => s.n === n);
  return i < 0 ? null : walk[i + delta] ?? null;
}

/** Text für "Schritt x: Titel", z.B. in Verweisen auf einen anderen Schritt */
export function stepRef(steps, n) {
  const step = stepOf(steps, n);
  const num = displayNumber(steps, n);
  return num ? `Schritt ${num}: ${step.title}` : step?.title ?? "";
}
