// DivRebound Schweiz (#/ch/:caseId/:step) - lädt den jeweiligen Schritt 1-6.
// Ablauf und Inhalte: docs/konzept-schweiz.md, Mockup:
// Mock Up Schweiz 10-2026/divrebound_ch_mockup.html.

import { getState } from "../../store/store.js";
import { createSwissCaseData } from "../../db/caseRepo.js";
import * as step1 from "./step1Checklist.js";
import * as holdings from "../holdings/holdings.js";
import * as step3 from "./step3Dividends.js";
import * as step4 from "./step4Portal.js";
import * as step5 from "./step5TaxOffice.js";
import * as step6 from "./step6Finish.js";

const STEP_MODULES = {
  1: (container, reclaimCase) => step1.mount(container, reclaimCase),
  2: (container, reclaimCase) => holdings.mount(container, { reclaimCase }),
  3: (container, reclaimCase) => step3.mount(container, reclaimCase),
  4: (container, reclaimCase) => step4.mount(container, reclaimCase),
  5: (container, reclaimCase) => step5.mount(container, reclaimCase),
  6: (container, reclaimCase) => step6.mount(container, reclaimCase),
};

/**
 * @param {HTMLElement} container
 * @param {{ caseId: string, step: string }} params
 * @returns {Promise<(() => void) | void>} Aufräumfunktion des Schritts (z.B. autosave)
 */
export function mount(container, params) {
  const reclaimCase = getState().currentCase;
  const { currentProfile } = getState();
  if (!reclaimCase || reclaimCase.targetCountry !== "CH" || !currentProfile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">DivRebound Schweiz</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Dieser Fall wurde nicht gefunden.</div></div>`;
    return;
  }
  // Fälle aus älteren Exporten bzw. vor Einführung einzelner Felder ergänzen.
  reclaimCase.ch = { ...createSwissCaseData(), ...reclaimCase.ch };

  const step = STEP_MODULES[Number(params.step)] ? Number(params.step) : 1;
  let cleanup = null;
  let unmounted = false;
  Promise.resolve(STEP_MODULES[step](container, reclaimCase)).then((fn) => {
    if (typeof fn !== "function") return;
    if (unmounted) fn();
    else cleanup = fn;
  });
  return () => {
    unmounted = true;
    cleanup?.();
  };
}
