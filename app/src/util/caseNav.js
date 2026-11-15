// Schritte und Fortschritt eines Antrags, gleich für alle Länder - für die
// Seitenleiste (components/sidebar.js) und die Antragskarten auf der
// Startseite. Erledigt ist ein Schritt, wenn er mit "Weiter" verlassen wurde
// oder der Antrag eingereicht ist; die Erstattung, wenn sie eingetragen ist.

import { CH_STEPS, chStepRoute, DK_STEPS, dkStepRoute, IT_STEPS, itStepRoute, SE_STEPS, seStepRoute } from "../config/caseSteps.js";
import { isSubmitted, refundReceived } from "./caseProgress.js";

const DK_STATUS_ORDER = ["draft", "residency_form_generated", "awaiting_tax_office", "ready_for_skat_submission", "skat_form_verified", "submitted"];

const NAV = {
  DK: {
    steps: DK_STEPS,
    route: dkStepRoute,
    stepsDone: (c) => c.dkStepsDone ?? [],
    isDone: (c, n) => DK_STATUS_ORDER.indexOf(c.status) >= 2 && n <= 4,
  },
  CH: { steps: CH_STEPS, route: chStepRoute, stepsDone: (c) => c.ch?.stepsDone ?? [] },
  IT: { steps: IT_STEPS, route: itStepRoute, stepsDone: (c) => c.it?.stepsDone ?? [] },
  SE: { steps: SE_STEPS, route: seStepRoute, stepsDone: (c) => c.se?.stepsDone ?? [] },
};

export function stepsFor(reclaimCase) {
  return NAV[reclaimCase.targetCountry].steps;
}

export function stepRoute(reclaimCase, n) {
  return NAV[reclaimCase.targetCountry].route(reclaimCase.caseId, n);
}

export function isStepDone(reclaimCase, step) {
  if (step.optional) return refundReceived(reclaimCase).received;
  const nav = NAV[reclaimCase.targetCountry];
  return isSubmitted(reclaimCase) || nav.stepsDone(reclaimCase).includes(step.n) || Boolean(nav.isDone?.(reclaimCase, step.n));
}

/** Erster noch offener Schritt in der Reihenfolge für den Nutzer; nach der Einreichung die Erstattung */
export function nextStep(reclaimCase) {
  const steps = stepsFor(reclaimCase);
  return steps.find((s) => !s.optional && !isStepDone(reclaimCase, s)) ?? steps[steps.length - 1];
}

/** Phase, in der der Antrag steht: "prepare" | "confirm" | "submit" | "submitted" | "received" */
export function casePhase(reclaimCase) {
  if (refundReceived(reclaimCase).received) return "received";
  if (isSubmitted(reclaimCase)) return "submitted";
  const step = nextStep(reclaimCase);
  return step.phase ?? "prepare";
}
