// Kopfzeile und "Zurück / Weiter" eines Schritts, gleich für alle Länder.
// Die Reihenfolge kommt aus config/caseSteps.js (nicht aus der Routen-Nummer).

import { stepOf, stepPosition, neighborStep } from "../../config/caseSteps.js";
import { caseName } from "../../util/caseName.js";
import { feedbackLinkHtml } from "../../components/feedbackModal.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function stepHeaderHtml(steps, reclaimCase, n) {
  const step = stepOf(steps, n);
  const position = stepPosition(steps, n);
  return `
    <div class="content-header">
      <h1 class="content-title">${esc(step.heading ?? step.title)}</h1>
      <div class="content-breadcrumb">${esc(caseName(reclaimCase))}${position ? ` <b>›</b> ${esc(position).replace(" › ", " <b>›</b> ")}` : ""}${feedbackLinkHtml()}</div>
    </div>`;
}

/**
 * @param {{ nextDisabled?: boolean, nextLabel?: string }} [options]
 *   nextLabel ersetzt "Weiter: <nächster Schritt>"
 */
export function stepNavHtml(steps, n, { nextDisabled = false, nextLabel } = {}) {
  const back = neighborStep(steps, n, -1);
  const next = neighborStep(steps, n, 1);
  return `
    <div class="ch-step-nav">
      ${back ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button" ${nextDisabled ? "disabled" : ""}>${esc(nextLabel ?? `Weiter: ${next.title}`)} →</button>` : ""}
    </div>`;
}

/**
 * @param {{ go: (n: number) => void, markDone: (n: number) => Promise<void> }} hooks
 */
export function bindStepNav(container, steps, n, { go, markDone }) {
  const back = neighborStep(steps, n, -1);
  const next = neighborStep(steps, n, 1);
  container.querySelector("[data-step-back]")?.addEventListener("click", () => back && go(back.n));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markDone(n);
    if (next) go(next.n);
  });
}
