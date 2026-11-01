// Länderübergreifend: wann wurde ein DivRebound eingereicht, und ist die
// Erstattung angekommen (optionaler letzter Schritt "Erstattung erhalten",
// screens/shared/refundReceived.js). Liest auch ältere Fälle, die das noch
// länderspezifisch gespeichert haben (ch.completedAt / ch.receivedRefund,
// it.mailedAt / it.receivedRefund).

/** ISO-Zeitpunkt der Einreichung (DK: bei SKAT, CH: im ePortal, IT: Post) oder null */
export function submittedAt(reclaimCase) {
  return reclaimCase.submittedAt ?? reclaimCase.ch?.completedAt ?? reclaimCase.it?.mailedAt ?? null;
}

export function isSubmitted(reclaimCase) {
  return Boolean(submittedAt(reclaimCase)) || reclaimCase.status === "submitted";
}

/** @returns {{ received: boolean, date: string, amountEur: string }} */
export function refundReceived(reclaimCase) {
  if (reclaimCase.refundReceived) return { received: false, date: "", amountEur: "", ...reclaimCase.refundReceived };
  const legacy = reclaimCase.ch?.receivedRefund ?? reclaimCase.it?.receivedRefund;
  if (legacy && (legacy.date || legacy.amountEur)) return { received: true, date: legacy.date ?? "", amountEur: legacy.amountEur ?? "" };
  return { received: false, date: "", amountEur: "" };
}

/** "1.234,56" / "1234.56" -> 1234.56; leer/ungültig -> null */
export function parseAmount(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Ganze Monate zwischen zwei Datumsangaben (ISO), gerundet */
export function monthsBetween(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const days = (new Date(toIso) - new Date(fromIso)) / 86_400_000;
  return days < 0 ? null : Math.round(days / 30.44);
}
