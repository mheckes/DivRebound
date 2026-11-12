// Gemeinsame Helfer der Schritte eines DivRebound Schweden
// (docs/konzept-schweden.md). Aufbau wie screens/itCase/itShared.js.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { SE_STEPS, seStepRoute } from "../../config/caseSteps.js";
import { statusTimelineHtml, bindStatusTimeline, timelineTitle } from "../../components/statusTimeline.js";
import { refundReceived } from "../../util/caseProgress.js";
import { formatNumberDe } from "../../util/format.js";
import { isEligible, formsFor, yearsOf, totalRefund, corridor } from "../../lib/sweden.js";
import { feedbackLinkHtml } from "../../components/feedbackModal.js";

export { corridor };
// Nur zur Anzeige einer groben EUR-Näherung - keine externe FX-Anbindung im MVP
export const APPROX_EUR_SEK_RATE = 11.0;

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export const formatSekDe = (value) => `${formatNumberDe(value ?? 0)} SEK`;
export const approxEur = (sek) => `≈ ${formatNumberDe(sek / APPROX_EUR_SEK_RATE)} EUR`;

export async function saveCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    currentCase: reclaimCase,
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
  });
}

/** Bestätigte, erstattungsfähige Ausschüttungen - nur diese kommen ins Formular */
export function eligibleDistributions(reclaimCase) {
  return reclaimCase.distributions.filter((d) => isEligible(d));
}

export function caseSummary(reclaimCase) {
  const eligible = eligibleDistributions(reclaimCase);
  return { eligible, forms: formsFor(eligible), years: eligible.length ? yearsOf(eligible) : [], total: totalRefund(eligible) };
}

export function yearRangeLabel(years) {
  if (!years.length) return String(new Date().getFullYear());
  return years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
}

export function stepHeader(reclaimCase, n) {
  const step = SE_STEPS.find((s) => s.n === n);
  return `
    <div class="content-header">
      <h1 class="content-title">${esc(step.title)}</h1>
      <div class="content-breadcrumb">Schweden <b>›</b> ${esc(caseLabel(reclaimCase))} <b>›</b> ${n} von ${SE_STEPS.length}${feedbackLinkHtml()}</div>
    </div>`;
}

export function stepNavHtml(n, { nextDisabled = false } = {}) {
  const next = SE_STEPS.find((s) => s.n === n + 1);
  return `
    <div class="ch-step-nav">
      ${n > 1 ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button" ${nextDisabled ? "disabled" : ""}>Weiter: ${esc(next.title)} →</button>` : ""}
    </div>`;
}

export async function markStepDone(reclaimCase, n) {
  const done = new Set(reclaimCase.se.stepsDone ?? []);
  if (done.has(n)) return;
  done.add(n);
  reclaimCase.se.stepsDone = [...done].sort();
  await saveCase(reclaimCase);
}

export function goToStep(reclaimCase, n) {
  navigate(seStepRoute(reclaimCase.caseId, n));
}

export function bindStepNav(container, reclaimCase, n) {
  container.querySelector("[data-step-back]")?.addEventListener("click", () => goToStep(reclaimCase, n - 1));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markStepDone(reclaimCase, n);
    goToStep(reclaimCase, n + 1);
  });
}

// --- Status-Zeitleiste (Schritt 4 und 5) ---

export const SE_TIMELINE = [
  { label: "Formular erstellt", where: "DivRebound" },
  { label: "Unterschrieben & ans Finanzamt", where: "Post" },
  { label: "Vom Finanzamt bestätigt", where: "Finanzamt" },
  { label: "Nach Schweden versendet", where: "Post / E-Mail" },
  { label: "Ausgezahlt", where: "Konto" },
];

/** Gespeicherter Fortschritt, mindestens aber aus dem Fall abgeleitet */
export function timelineDone(reclaimCase) {
  let derived = reclaimCase.generatedDocuments.some((d) => d.type === "se_skv3740") ? 1 : 0;
  if (reclaimCase.se.mailedAt) derived = 4;
  if (refundReceived(reclaimCase).received) derived = 5;
  return Math.max(reclaimCase.se.timelineStep ?? 0, derived);
}

export function timelineHtml(reclaimCase) {
  const { forms, total } = caseSummary(reclaimCase);
  const title = timelineTitle("SKV 3740", forms.length, formatSekDe(total));
  return statusTimelineHtml({ title, steps: SE_TIMELINE, doneCount: timelineDone(reclaimCase) });
}

/** @param {() => void} rerender */
export function bindTimeline(container, reclaimCase, rerender) {
  bindStatusTimeline(container, () => timelineDone(reclaimCase), async (n) => {
    reclaimCase.se.timelineStep = n;
    await saveCase(reclaimCase);
    rerender();
  });
}

// --- Dateien ---

export function downloadBlob(bytes, fileName, mimeType = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

let templatePromise = null;
export function loadFormTemplate() {
  templatePromise ??= fetch(import.meta.env.BASE_URL + "forms/se-skv3740-template.pdf").then((r) => {
    if (!r.ok) {
      templatePromise = null;
      throw new Error(`Formularvorlage konnte nicht geladen werden (HTTP ${r.status})`);
    }
    return r.arrayBuffer();
  });
  return templatePromise;
}
