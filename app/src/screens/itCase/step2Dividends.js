// Italien, Schritt 2 "Dividendenabrechnungen" - gemeinsame Seite mit Dänemark
// (screens/shared/dividendUpload.js), gruppiert nach Unternehmen: ein Form A
// je Unternehmen (docs/konzept-italien.md §1, §5).

import { corridors } from "../../config/corridors.js";
import { mountDividendUpload } from "../shared/dividendUpload.js";
import { formsFor } from "../../lib/italy.js";
import { stepHeader, saveCase, markStepDone, goToStep } from "./itShared.js";

export function mount(container, reclaimCase) {
  mountDividendUpload(container, reclaimCase, {
    corridor: corridors.IT,
    headerHtml: stepHeader(reclaimCase, 2),
    lead: "Lade deine Dividendenabrechnungen italienischer Aktien hoch. DivRebound liest die relevanten Informationen aus und bereitet die Erstellung von Formularen vor.",
    countryName: "Italien",
    shareAdjective: "italienische",
    groupBy: "issuer",
    groupBadge: (group, eligible) => {
      const n = formsFor(eligible).length;
      return n ? `<span class="du-form-pill">${n === 1 ? "1 Formular" : `${n} Formulare`}</span>` : "";
    },
    save: saveCase,
    onNext: async () => {
      await markStepDone(reclaimCase, 2);
      goToStep(reclaimCase, 3);
    },
  });
}
