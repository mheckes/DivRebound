// Fachlogik Italien (docs/konzept-italien.md §2, §5) ohne DOM und ohne PDF:
// Einstufung des Quellensteuersatzes, Erstattung je Ausschüttung, Aufteilung
// in Form A (eines pro Unternehmen, höchstens 4 Zeilen), Jahresangaben.

import { corridors } from "../config/corridors.js";
import { ITALIAN_SHARES } from "../config/italianShares.js";

const corridor = corridors.IT;
const TOLERANCE = 0.005; // 0,5 Prozentpunkte

const round2 = (v) => Math.round(v * 100) / 100;

/**
 * Einstufung nach dem tatsächlich einbehaltenen Satz (Steuer ÷ Brutto). Der
 * auf der Abrechnung ausgewiesene Satz dient nur zur Kontrolle.
 *  - "invalid": Brutto oder Steuer fehlt - Werte ergänzen
 *  - "expired": Zahltag älter als 48 Monate
 *  - "none":    höchstens 15 % einbehalten - nichts zu erstatten
 *  - "partial": zwischen 15 % und 26 % - nur der tatsächliche Abzug zählt, Nutzer bestätigt
 *  - "high":    über 26 % - unplausibel, prüfen
 *  - "ok":      26 % (Regelfall)
 * @returns {{ kind: string, effectiveRate: number|null, rateMismatch: boolean }}
 */
export function classifyWithholding(distribution, today = new Date()) {
  const { grossDividend: gross, withheldTax: tax, withholdingRatePercent: printed, paymentDate } = distribution;
  if (!gross || tax === null || tax === undefined) return { kind: "invalid", effectiveRate: null, rateMismatch: false };
  const effectiveRate = tax / gross;
  const rateMismatch = printed !== null && printed !== undefined && Math.abs(printed / 100 - effectiveRate) > TOLERANCE;
  const base = { effectiveRate, rateMismatch };
  if (paymentDate && isTimeBarred(paymentDate, today)) return { kind: "expired", ...base };
  const treaty = corridor.treatyRateByResidence.DE;
  const standard = corridor.standardWithholdingRate;
  if (effectiveRate <= treaty + 0.0001) return { kind: "none", ...base };
  if (Math.abs(effectiveRate - standard) <= TOLERANCE) return { kind: "ok", ...base };
  if (effectiveRate > standard) return { kind: "high", ...base };
  return { kind: "partial", ...base };
}

/** 48 Monate ab dem Steuerabzug (= Zahltag) */
export function isTimeBarred(paymentDate, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - corridor.limitationPeriodYears * 12);
  return new Date(paymentDate) < cutoff;
}

/** Erstattung = tatsächlich gezahlte Steuer − 15 % vom Brutto (nie pauschal 11 %) */
export function refundFor(distribution) {
  const taxDue = round2(distribution.grossDividend * corridor.treatyRateByResidence.DE);
  return { taxDue, refund: Math.max(0, round2(distribution.withheldTax - taxDue)) };
}

/** Kann überhaupt erstattet werden (unabhängig von der Bestätigung)? */
export function isRefundable(distribution, today) {
  return ["ok", "partial", "high"].includes(classifyWithholding(distribution, today).kind);
}

/** Bestätigt (Häkchen oder korrigiert) und erstattungsfähig -> kommt ins Formular */
export function isEligible(distribution, today) {
  return distribution.extractionConfidence !== "extracted" && isRefundable(distribution, today);
}

export function totalRefund(distributions) {
  return round2(distributions.reduce((s, d) => s + refundFor(d).refund, 0));
}

/** Ausschüttungen je Unternehmen (ISIN), in Reihenfolge des ersten Zahltags */
export function groupByIssuer(distributions) {
  const groups = new Map();
  for (const d of [...distributions].sort((a, b) => (a.paymentDate ?? "").localeCompare(b.paymentDate ?? ""))) {
    if (!groups.has(d.isin)) groups.set(d.isin, { isin: d.isin, issuerName: d.issuerName, distributions: [] });
    const g = groups.get(d.isin);
    if (!g.issuerName && d.issuerName) g.issuerName = d.issuerName;
    g.distributions.push(d);
  }
  return [...groups.values()];
}

/**
 * Ein Form A je Unternehmen, bei mehr als 4 Ausschüttungen weitere Teile.
 * @returns {{ isin: string, issuerName: string, rows: object[], part: number, of: number }[]}
 */
export function formsFor(eligibleDistributions) {
  const size = corridor.maxDistributionsPerForm;
  return groupByIssuer(eligibleDistributions).flatMap((g) => {
    const parts = [];
    for (let i = 0; i < g.distributions.length; i += size) parts.push(g.distributions.slice(i, i + size));
    return parts.map((rows, i) => ({ isin: g.isin, issuerName: g.issuerName, rows, part: i + 1, of: parts.length }));
  });
}

/** Steuerjahre (= Jahr des Zahltags), aufsteigend */
export function yearsOf(distributions) {
  return [...new Set(distributions.map((d) => Number(d.paymentDate.slice(0, 4))))].sort();
}

/** "2024", "2024 and 2025", "2023, 2024 and 2026"; lückenlose Folgen ab 3 Jahren als "2024-2026" */
export function yearsText(years, conjunction = "and") {
  if (years.length <= 1) return years.map(String).join("");
  const consecutive = years.every((y, i) => i === 0 || y === years[i - 1] + 1);
  if (years.length > 2 && consecutive) return `${years[0]}-${years[years.length - 1]}`;
  return `${years.slice(0, -1).join(", ")} ${conjunction} ${years[years.length - 1]}`;
}

/**
 * Angaben zum italienischen Zahler (Form A Seite 4). Reihenfolge: eigene
 * Eingabe im Profil > DivRebound-Liste > nur Name aus der Abrechnung.
 * Alles optional - fehlende Angaben blockieren nie.
 */
export function issuerDetails(isin, issuerName, profile) {
  const listed = ITALIAN_SHARES[isin];
  const own = profile?.issuers?.[isin] ?? {};
  return {
    name: issuerName || listed?.name || "",
    taxCode: own.taxCode || listed?.taxCode || "",
    address: own.address || listed?.address || "",
    source: own.taxCode || own.address ? "user" : listed ? "list" : "none",
  };
}

/** Zahl im deutschen Format mit Euro, wie im Referenzantrag ("300,00 €") */
export function formatEur(value, { minDigits = 2, maxDigits = 2 } = {}) {
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits })} €`;
}
