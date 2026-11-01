// Dänemark, Schritt 6 "Erstattung erhalten" (optional) - gemeinsamer Baustein
// screens/shared/refundReceived.js.

import { refundReceivedHtml, bindRefundReceived } from "../shared/refundReceived.js";
import { stepHeader, stepNavHtml, bindStepNav, saveCase, dkRefund, formatDkk, APPROX_EUR_DKK_RATE } from "./dkShared.js";
import { formatNumberDe } from "../../util/format.js";

function render(container, reclaimCase) {
  const { total } = dkRefund(reclaimCase);
  container.innerHTML = refundReceivedHtml(reclaimCase, {
    headerHtml: stepHeader(reclaimCase, 6),
    navHtml: stepNavHtml(6),
    // Erstattet wird in DKK; der Euro-Betrag hängt vom Kurs ab, deshalb kein Soll-Ist-Vergleich
    expected: total ? { label: `${formatDkk(total)} (≈ ${formatNumberDe(total / APPROX_EUR_DKK_RATE)} EUR)` } : undefined,
  });
  bindStepNav(container, reclaimCase, 6);
  bindRefundReceived(container, reclaimCase, { save: saveCase, rerender: () => render(container, reclaimCase) });
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
