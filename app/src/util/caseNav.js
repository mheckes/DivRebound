// Schritte und Fortschritt eines Falls, gleich für alle Länder - für die
// Seitenleiste (components/sidebar.js) und "Letzte Bearbeitung fortsetzen"
// auf der Startseite. Erledigt ist ein Schritt, wenn er mit "Weiter" verlassen
// wurde, sich aus dem Fall ergibt (z.B. eingereicht) bzw. - beim optionalen
// letzten Schritt "Erstattung erhalten" - die Erstattung eingetragen ist.

import { CH_STEPS, chStepRoute, DK_STEPS, dkStepRoute, IT_STEPS, itStepRoute } from "../config/caseSteps.js";
import { isSubmitted, refundReceived } from "./caseProgress.js";

const DK_STATUS_ORDER = ["draft", "residency_form_generated", "awaiting_tax_office", "ready_for_skat_submission", "skat_form_verified", "submitted"];

const NAV = {
  DK: {
    steps: DK_STEPS,
    route: dkStepRoute,
    isDone: (c, n) => (c.dkStepsDone ?? []).includes(n) || (DK_STATUS_ORDER.indexOf(c.status) >= 2 && n <= 4) || (isSubmitted(c) && n <= 5),
  },
  CH: { steps: CH_STEPS, route: chStepRoute, isDone: (c, n) => (c.ch?.stepsDone ?? []).includes(n) || (isSubmitted(c) && n <= 6) },
  IT: { steps: IT_STEPS, route: itStepRoute, isDone: (c, n) => (c.it?.stepsDone ?? []).includes(n) || (isSubmitted(c) && n <= 5) },
};

export function stepsFor(reclaimCase) {
  return NAV[reclaimCase.targetCountry].steps;
}

export function stepRoute(reclaimCase, n) {
  return NAV[reclaimCase.targetCountry].route(reclaimCase.caseId, n);
}

export function isStepDone(reclaimCase, step) {
  return step.optional ? refundReceived(reclaimCase).received : NAV[reclaimCase.targetCountry].isDone(reclaimCase, step.n);
}

/** Erster noch offener Pflichtschritt, nach der Einreichung der optionale letzte Schritt */
export function nextStep(reclaimCase) {
  const steps = stepsFor(reclaimCase);
  return steps.find((s) => !s.optional && !isStepDone(reclaimCase, s)) ?? steps[steps.length - 1];
}
