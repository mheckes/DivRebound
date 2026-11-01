// Fachlogik Italien (docs/konzept-italien.md §2, §5) ohne DOM und ohne PDF:
// Aufteilung in Form A (eines pro Unternehmen, höchstens 4 Zeilen),
// Jahresangaben, Angaben zum Zahler. Einstufung des Steuersatzes und
// Erstattung kommen aus lib/withholding.js (gemeinsam mit Dänemark), hier mit
// dem Corridor Italien vorbelegt.

import { corridors } from "../config/corridors.js";
import { ITALIAN_SHARES } from "../config/italianShares.js";
import * as withholding from "./withholding.js";

const corridor = corridors.IT;

/** 26 % Regelfall, 15 % DBA, 48 Monate - siehe lib/withholding.js */
export const classifyWithholding = (distribution, today) => withholding.classifyWithholding(distribution, corridor, { today });
export const refundFor = (distribution) => withholding.refundFor(distribution, corridor);
export const isRefundable = (distribution, today) => withholding.isRefundable(distribution, corridor, { today });
/** Bestätigt (Häkchen oder korrigiert) und erstattungsfähig -> kommt ins Formular */
export const isEligible = (distribution, today) => withholding.isEligible(distribution, corridor, { today });
export const totalRefund = (distributions) => withholding.totalRefund(distributions, corridor);

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
