// Fachlogik Schweden (docs/konzept-schweden.md) ohne DOM und ohne PDF:
// Aufteilung der Ausschüttungen auf Formulare SKV 3740 und Jahresangaben.
// Einstufung des Steuersatzes und Erstattung kommen aus lib/withholding.js
// (gemeinsam mit Dänemark und Italien), hier mit dem Corridor Schweden vorbelegt.
// Alle Beträge in SEK - so verlangt es das Formular.

import { corridors } from "../config/corridors.js";
import * as withholding from "./withholding.js";

export const corridor = corridors.SE;

/** 30 % Regelfall, 15 % DBA, 5 Jahre ab Ende des Auszahlungsjahres - siehe lib/withholding.js */
export const classifyWithholding = (distribution, today) => withholding.classifyWithholding(distribution, corridor, { today });
export const refundFor = (distribution) => withholding.refundFor(distribution, corridor);
export const isRefundable = (distribution, today) => withholding.isRefundable(distribution, corridor, { today });
/** Bestätigt (Häkchen oder korrigiert) und erstattungsfähig -> kommt ins Formular */
export const isEligible = (distribution, today) => withholding.isEligible(distribution, corridor, { today });
export const totalRefund = (distributions) => withholding.totalRefund(distributions, corridor);

const round2 = (v) => Math.round(v * 100) / 100;

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
 * Das Formular listet alle Unternehmen in einer Tabelle (je Zeile ein Unternehmen
 * und Zahltag), höchstens 12 Zeilen. Bei mehr Ausschüttungen kommt ein weiteres
 * Formular dazu. Reihenfolge: je Unternehmen nach Zahltag.
 * @returns {{ rows: object[], part: number, of: number }[]}
 */
export function formsFor(eligibleDistributions) {
  const size = corridor.maxDistributionsPerForm;
  const ordered = groupByIssuer(eligibleDistributions).flatMap((g) => g.distributions);
  const forms = [];
  for (let i = 0; i < ordered.length; i += size) forms.push(ordered.slice(i, i + size));
  return forms.map((rows, i) => ({ rows, part: i + 1, of: forms.length }));
}

/** Summen eines Formulars in SEK */
export function formTotals(rows) {
  return {
    gross: round2(rows.reduce((s, d) => s + (d.grossDividend ?? 0), 0)),
    tax: round2(rows.reduce((s, d) => s + (d.withheldTax ?? 0), 0)),
    refund: round2(rows.reduce((s, d) => s + refundFor(d).refund, 0)),
  };
}

/** Zahlungsjahre, aufsteigend */
export function yearsOf(distributions) {
  return [...new Set(distributions.map((d) => Number(d.paymentDate.slice(0, 4))))].sort();
}

/** Letzter Tag, an dem die Dividende noch beantragt werden kann (31.12. des fünften Folgejahres) */
export function deadlineOf(distribution) {
  return `${Number(distribution.paymentDate.slice(0, 4)) + corridor.limitationPeriodYears}-12-31`;
}

/** Zahl mit Punkt als Dezimaltrenner wie im ausgefüllten Muster des Formulars ("262.20") */
export function formatSek(value, { minDigits = 2, maxDigits = 2 } = {}) {
  return Number(value ?? 0).toLocaleString("en-US", { useGrouping: false, minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
}
