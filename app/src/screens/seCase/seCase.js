// DivRebound Schweden (#/se/:caseId/:step) - lädt den jeweiligen Schritt 1-6.
// Ablauf wie Italien: docs/konzept-schweden.md.

import { getState } from "../../store/store.js";
import { createSwedishCaseData } from "../../db/caseRepo.js";
import * as step1 from "./step1Checklist.js";
import * as step2 from "./step2Dividends.js";
import * as step3 from "./step3MissingData.js";
import * as step4 from "./step4TaxOffice.js";
import * as step5 from "./step5Mailing.js";
import * as step6 from "./step6Refund.js";

const STEP_MODULES = { 1: step1, 2: step2, 3: step3, 4: step4, 5: step5, 6: step6 };

/**
 * @param {HTMLElement} container
 * @param {{ caseId: string, step: string }} params
 * @returns {(() => void) | void} Aufräumfunktion des Schritts (z.B. autosave)
 */
export function mount(container, params) {
  const { currentCase: reclaimCase, currentProfile: profile } = getState();
  if (!reclaimCase || reclaimCase.targetCountry !== "SE" || !profile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">DivRebound Schweden</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Dieser Fall wurde nicht gefunden.</div></div>`;
    return;
  }
  reclaimCase.se = { ...createSwedishCaseData(), ...reclaimCase.se };

  const step = STEP_MODULES[Number(params.step)] ? Number(params.step) : 1;
  return STEP_MODULES[step].mount(container, reclaimCase, profile);
}
