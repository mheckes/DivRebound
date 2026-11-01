// Gemeinsame Helfer der Schritte eines DivRebound Dänemark - gleiche
// Bausteine wie screens/chCase/chShared.js und screens/itCase/itShared.js.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { DK_STEPS, dkStepRoute } from "../../config/caseSteps.js";
import { isEligible, totalRefund } from "../../lib/withholding.js";
import { formatNumberDe } from "../../util/format.js";

export const corridor = corridors.DK;
// Nur zur Anzeige einer groben EUR-Näherung - keine externe FX-Anbindung im MVP
export const APPROX_EUR_DKK_RATE = 7.46;

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export async function saveCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    currentCase: reclaimCase,
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
  });
}

/** Bestätigte, erstattungsfähige Ausschüttungen und ihre Erstattung in DKK */
export function dkRefund(reclaimCase, profile = getState().currentProfile) {
  const residence = profile?.residence?.country;
  const eligible = reclaimCase.distributions.filter((d) => isEligible(d, corridor, { residenceCountry: residence }));
  return { eligible, total: totalRefund(eligible, corridor, residence) };
}

export function formatDkk(amount) {
  return `${formatNumberDe(amount)} DKK`;
}

export function stepHeader(reclaimCase, n) {
  const step = DK_STEPS.find((s) => s.n === n);
  return `
    <div class="content-header">
      <h1 class="content-title">${esc(step.title)}</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${esc(caseLabel(reclaimCase))} <b>›</b> ${n} von ${DK_STEPS.length}</div>
    </div>`;
}

export function stepNavHtml(n, { nextDisabled = false } = {}) {
  const next = DK_STEPS.find((s) => s.n === n + 1);
  return `
    <div class="ch-step-nav">
      ${n > 1 ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button" ${nextDisabled ? "disabled" : ""}>Weiter: ${esc(next.title)} →</button>` : ""}
    </div>`;
}

export async function markStepDone(reclaimCase, n) {
  const done = new Set(reclaimCase.dkStepsDone ?? []);
  if (done.has(n)) return;
  done.add(n);
  reclaimCase.dkStepsDone = [...done].sort();
  await saveCase(reclaimCase);
}

export function goToStep(reclaimCase, n) {
  navigate(dkStepRoute(reclaimCase.caseId, n));
}

export function bindStepNav(container, reclaimCase, n) {
  container.querySelector("[data-step-back]")?.addEventListener("click", () => goToStep(reclaimCase, n - 1));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markStepDone(reclaimCase, n);
    goToStep(reclaimCase, n + 1);
  });
}
