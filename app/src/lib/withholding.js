// Quellensteuer je Ausschüttung, länderübergreifend für Dänemark und Italien
// (docs/konzept-italien.md §5): Einstufung des tatsächlich einbehaltenen
// Satzes und Erstattung = gezahlte Steuer − DBA-Satz × Brutto (nie pauschal
// Brutto × Differenz der Sätze). Die Schweiz rechnet anders (Ansprüche aus dem
// Bestand, lib/holdings.js).

const TOLERANCE = 0.005; // 0,5 Prozentpunkte

const round2 = (v) => Math.round(v * 100) / 100;

function treatyRate(corridor, residenceCountry = "DE") {
  return corridor.treatyRateByResidence[residenceCountry] ?? corridor.treatyRateByResidence.DE;
}

/** Frist ab dem Steuerabzug (= Zahltag), in Monaten gerechnet */
export function isTimeBarred(paymentDate, corridor, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - corridor.limitationPeriodYears * 12);
  return new Date(paymentDate) < cutoff;
}

/**
 * Einstufung nach dem tatsächlich einbehaltenen Satz (Steuer ÷ Brutto). Der
 * auf der Abrechnung ausgewiesene Satz dient nur zur Kontrolle.
 *  - "invalid": Brutto oder Steuer fehlt - Werte ergänzen
 *  - "expired": Frist abgelaufen
 *  - "none":    höchstens DBA-Satz einbehalten - nichts zu erstatten
 *  - "partial": zwischen DBA-Satz und Regelsatz - nur der tatsächliche Abzug zählt
 *  - "high":    über dem Regelsatz - unplausibel, prüfen
 *  - "ok":      Regelsatz
 * @returns {{ kind: string, effectiveRate: number|null, rateMismatch: boolean }}
 */
export function classifyWithholding(distribution, corridor, { residenceCountry, today = new Date() } = {}) {
  const { grossDividend: gross, withheldTax: tax, withholdingRatePercent: printed, paymentDate } = distribution;
  if (!gross || tax === null || tax === undefined) return { kind: "invalid", effectiveRate: null, rateMismatch: false };
  const effectiveRate = tax / gross;
  const rateMismatch = printed !== null && printed !== undefined && Math.abs(printed / 100 - effectiveRate) > TOLERANCE;
  const base = { effectiveRate, rateMismatch };
  if (paymentDate && isTimeBarred(paymentDate, corridor, today)) return { kind: "expired", ...base };
  const standard = corridor.standardWithholdingRate;
  if (effectiveRate <= treatyRate(corridor, residenceCountry) + 0.0001) return { kind: "none", ...base };
  if (Math.abs(effectiveRate - standard) <= TOLERANCE) return { kind: "ok", ...base };
  if (effectiveRate > standard) return { kind: "high", ...base };
  return { kind: "partial", ...base };
}

/**
 * Erstattung = tatsächlich gezahlte Steuer − DBA-Satz × Brutto, höchstens
 * (Regelsatz − DBA-Satz) × Brutto (DK 12 %, IT 11 %): Mehr als den Regelsatz
 * behält das Land nicht ein - ein höherer Betrag ist ein Lese- oder Tippfehler
 * und darf die Erstattung nicht erhöhen.
 */
export function refundFor(distribution, corridor, residenceCountry) {
  const gross = distribution.grossDividend ?? 0;
  const treaty = treatyRate(corridor, residenceCountry);
  const taxDue = round2(gross * treaty);
  const max = round2(gross * (corridor.standardWithholdingRate - treaty));
  return { taxDue, refund: Math.min(max, Math.max(0, round2((distribution.withheldTax ?? 0) - taxDue))) };
}

/** Kann überhaupt erstattet werden (unabhängig von der Bestätigung)? */
export function isRefundable(distribution, corridor, options) {
  return ["ok", "partial", "high"].includes(classifyWithholding(distribution, corridor, options).kind);
}

/** Bestätigt (Häkchen oder korrigiert) und erstattungsfähig */
export function isEligible(distribution, corridor, options) {
  return distribution.extractionConfidence !== "extracted" && isRefundable(distribution, corridor, options);
}

export function totalRefund(distributions, corridor, residenceCountry) {
  return round2(distributions.reduce((s, d) => s + refundFor(d, corridor, residenceCountry).refund, 0));
}
