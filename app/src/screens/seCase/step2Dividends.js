// Schweden, Schritt 2 "Dividendenabrechnungen" - gemeinsame Seite mit Dänemark
// und Italien (screens/shared/dividendUpload.js), gruppiert nach Unternehmen.
// Beträge in SEK (so verlangt es das Formular) mit grober EUR-Näherung.

import { mountDividendUpload } from "../shared/dividendUpload.js";
import { corridor, approxEur, stepHeader, saveCase, markStepDone, goToStep } from "./seShared.js";

export function mount(container, reclaimCase) {
  mountDividendUpload(container, reclaimCase, {
    corridor,
    headerHtml: stepHeader(reclaimCase, 2),
    lead: "Lade die Dividendenabrechnungen deiner schwedischen Aktien hoch. DivRebound liest sie aus.",
    countryName: "Schweden",
    shareAdjective: "schwedische",
    groupBy: "issuer",
    bannerExtra: approxEur,
    save: saveCase,
    onNext: async () => {
      await markStepDone(reclaimCase, 2);
      goToStep(reclaimCase, 3);
    },
  });
}
