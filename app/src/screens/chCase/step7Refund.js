// Schweiz, Schritt 7 "Erstattung erhalten" (optional) - gemeinsamer Baustein
// screens/shared/refundReceived.js.

import { getState } from "../../store/store.js";
import { refundReceivedHtml, bindRefundReceived } from "../shared/refundReceived.js";
import { saveCase, loadTransactions, entitlementsFor, formatChf, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

function render(container, reclaimCase, transactions) {
  const total = entitlementsFor(reclaimCase, transactions, getState().currentProfile).reduce((s, r) => s + (r.refund ?? 0), 0);
  container.innerHTML = refundReceivedHtml(reclaimCase, {
    headerHtml: stepHeader(reclaimCase, 7),
    navHtml: stepNavHtml(7),
    // Erstattet wird in CHF; der Euro-Betrag hängt vom Kurs ab, deshalb kein Soll-Ist-Vergleich
    expected: total ? { label: formatChf(total) } : undefined,
  });
  bindStepNav(container, reclaimCase, 7);
  bindRefundReceived(container, reclaimCase, { save: saveCase, rerender: () => render(container, reclaimCase, transactions) });
}

export async function mount(container, reclaimCase) {
  render(container, reclaimCase, await loadTransactions(getState().currentProfile));
}
