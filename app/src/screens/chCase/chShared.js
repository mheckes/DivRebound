// Gemeinsame Helfer der sechs Schritte eines DivRebound Schweiz.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import * as transactionRepo from "../../db/transactionRepo.js";
import { computeEntitlements } from "../../lib/holdings.js";
import { corridors } from "../../config/corridors.js";
import { CH_STEPS, chStepRoute } from "../../config/caseSteps.js";
import { caseName } from "../../util/caseName.js";
import * as frame from "../shared/stepFrame.js";

export const corridor = corridors.CH;

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export const caseLabel = caseName;

/** Erstattungssatz: Verrechnungssteuer minus DBA-Satz (DE: 35 % - 15 % = 20 %). */
export function refundRate(profile) {
  return corridor.standardWithholdingRate - (corridor.treatyRateByResidence[profile?.residence?.country ?? "DE"] ?? 0.15);
}

export function formatChf(amount) {
  if (amount === null || amount === undefined) return "–";
  return `CHF ${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** ISO -> TT.MM.JJJJ, wie im ePortal verlangt */
export function formatDatePortal(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function saveCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    currentCase: reclaimCase,
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
  });
}

export async function loadTransactions(profile) {
  if (!profile) return [];
  return transactionRepo.getByProfileId(profile.profileId);
}

/** Ausschüttungen, für die alle Angaben zur Berechnung vorhanden sind */
export function completeDistributions(reclaimCase) {
  return reclaimCase.ch.distributions.filter((d) => d.isin && d.paymentDate && d.exDate);
}

/** Verjährung: 3 Jahre ab Ende des Zahlungsjahres */
export function isTimeBarred(paymentDate, today = new Date()) {
  return Number(paymentDate.slice(0, 4)) + corridor.limitationPeriodYears < today.getFullYear();
}

/**
 * Einträge fürs ePortal je Ausschüttung (lib/holdings.js), verjährte
 * Ausschüttungen ausgenommen.
 */
export function entitlementsFor(reclaimCase, transactions, profile) {
  const dists = completeDistributions(reclaimCase)
    .filter((d) => !isTimeBarred(d.paymentDate))
    .map((d) => ({
      ...d,
      grossPerShare: d.grossPerShare ?? undefined,
      voucherQuantities: d.vouchers.length ? d.vouchers.map((v) => v.quantity ?? 0) : undefined,
    }));
  return computeEntitlements(
    // Depots werden nicht unterschieden (Vereinfachung): ein Bestand je Aktie.
    transactions.filter((t) => t.tradeDate).map((t) => ({ ...t, depotId: "" })),
    dists,
    { refundRate: refundRate(profile) }
  );
}

export function stepHeader(reclaimCase, n) {
  return frame.stepHeaderHtml(CH_STEPS, reclaimCase, n);
}

/** @param {{ nextDisabled?: boolean, nextLabel?: string }} [options] */
export function stepNavHtml(n, options) {
  return frame.stepNavHtml(CH_STEPS, n, options);
}

export async function markStepDone(reclaimCase, n) {
  const done = new Set(reclaimCase.ch.stepsDone ?? []);
  if (done.has(n)) return;
  done.add(n);
  reclaimCase.ch.stepsDone = [...done].sort();
  await saveCase(reclaimCase);
}

export function bindStepNav(container, reclaimCase, n) {
  frame.bindStepNav(container, CH_STEPS, n, {
    go: (target) => navigate(chStepRoute(reclaimCase.caseId, target)),
    markDone: (step) => markStepDone(reclaimCase, step),
  });
}

export function copyToClipboard(btn, value) {
  if (navigator.clipboard) navigator.clipboard.writeText(String(value ?? "")).catch(() => {});
  const original = btn.textContent;
  btn.textContent = "✓";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1200);
}
