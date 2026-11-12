// Schweden, Schritt 6 "Erstattung erhalten" (optional) - gemeinsamer Baustein
// screens/shared/refundReceived.js. Berechnet wird in SEK, ausgezahlt in EUR;
// der Euro-Betrag hängt vom Kurs ab, deshalb kein Soll-Ist-Vergleich.

import { refundReceivedHtml, bindRefundReceived } from "../shared/refundReceived.js";
import { saveCase, caseSummary, formatSekDe, approxEur, stepHeader, stepNavHtml, bindStepNav } from "./seShared.js";

function render(container, reclaimCase) {
  const { total } = caseSummary(reclaimCase);
  container.innerHTML = refundReceivedHtml(reclaimCase, {
    headerHtml: stepHeader(reclaimCase, 6),
    navHtml: stepNavHtml(6),
    expected: total ? { label: `${formatSekDe(total)} (${approxEur(total)})` } : undefined,
  });
  bindStepNav(container, reclaimCase, 6);
  bindRefundReceived(container, reclaimCase, { save: saveCase, rerender: () => render(container, reclaimCase) });
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
