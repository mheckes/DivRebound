// Gemeinsame Helfer der Schritte eines DivRebound Dänemark - gleiche
// Bausteine wie screens/chCase/chShared.js und screens/itCase/itShared.js.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { DK_STEPS, dkStepRoute } from "../../config/caseSteps.js";
import { isEligible, totalRefund } from "../../lib/withholding.js";
import { formatNumberDe } from "../../util/format.js";
import { caseName } from "../../util/caseName.js";
import * as frame from "../shared/stepFrame.js";

export const corridor = corridors.DK;
// Nur zur Anzeige einer groben EUR-Näherung - keine externe FX-Anbindung im MVP
export const APPROX_EUR_DKK_RATE = 7.46;

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const caseLabel = caseName;

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
  return frame.stepHeaderHtml(DK_STEPS, reclaimCase, n);
}

/** @param {{ nextDisabled?: boolean, nextLabel?: string }} [options] */
export function stepNavHtml(n, options) {
  return frame.stepNavHtml(DK_STEPS, n, options);
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
  frame.bindStepNav(container, DK_STEPS, n, {
    go: (target) => navigate(dkStepRoute(reclaimCase.caseId, target)),
    markDone: (step) => markStepDone(reclaimCase, step),
  });
}
