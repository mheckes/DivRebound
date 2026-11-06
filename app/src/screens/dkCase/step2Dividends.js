// Dänemark, Schritt 2 "Dividendenabrechnungen" - gemeinsame Seite mit Italien
// (screens/shared/dividendUpload.js), gruppiert nach Steuerjahr. Erstattung
// aus der tatsächlich einbehaltenen Steuer (27 % → 15 %), Beträge in DKK mit
// grober EUR-Näherung.

import { mountDividendUpload } from "../shared/dividendUpload.js";
import { formatNumberDe } from "../../util/format.js";
import { corridor, APPROX_EUR_DKK_RATE, stepHeader, saveCase, markStepDone, goToStep } from "./dkShared.js";

export function mount(container, reclaimCase) {
  mountDividendUpload(container, reclaimCase, {
    corridor,
    headerHtml: stepHeader(reclaimCase, 2),
    lead: "Lade deine Dividendenabrechnungen dänischer Aktien hoch. DivRebound liest die relevanten Informationen aus und bereitet die Erstellung von Formularen vor.",
    countryName: "Dänemark",
    shareAdjective: "dänische",
    groupBy: "year",
    bannerExtra: (total) => `≈ ${formatNumberDe(total / APPROX_EUR_DKK_RATE)} EUR`,
    save: saveCase,
    onNext: async () => {
      await markStepDone(reclaimCase, 2);
      goToStep(reclaimCase, 3);
    },
  });
}
