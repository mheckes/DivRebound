// Italien, Schritt 6 "Erstattung erhalten" (optional) - gemeinsamer Baustein
// screens/shared/refundReceived.js. Erstattet wird in EUR, deshalb zeigt die
// Seite auch, ob mehr kam als erwartet (z.B. durch Zinsen).

import { refundReceivedHtml, bindRefundReceived } from "../shared/refundReceived.js";
import { saveCase, caseSummary, formatEurPlain, stepHeader, stepNavHtml, bindStepNav } from "./itShared.js";

function render(container, reclaimCase) {
  const { total } = caseSummary(reclaimCase);
  container.innerHTML = refundReceivedHtml(reclaimCase, {
    headerHtml: stepHeader(reclaimCase, 6),
    navHtml: stepNavHtml(6),
    expected: total ? { label: `${formatEurPlain(total)} €`, eur: total } : undefined,
  });
  bindStepNav(container, reclaimCase, 6);
  bindRefundReceived(container, reclaimCase, { save: saveCase, rerender: () => render(container, reclaimCase) });
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
