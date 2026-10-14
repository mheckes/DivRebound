// Gemeinsame Helfer der sechs Schritte eines DivRebound Schweiz.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import * as transactionRepo from "../../db/transactionRepo.js";
import { computeEntitlements } from "../../lib/holdings.js";
import { corridors } from "../../config/corridors.js";
import { CH_STEPS, chStepRoute } from "../../config/caseSteps.js";
import { showToast } from "../../components/toast.js";

export const corridor = corridors.CH;

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

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
  const step = CH_STEPS.find((s) => s.n === n);
  return `
    <div class="content-header">
      <h1 class="content-title">${esc(step.title)}</h1>
      <div class="content-breadcrumb">Schweiz <b>›</b> ${esc(caseLabel(reclaimCase))} <b>›</b> ${n} von ${CH_STEPS.length}</div>
    </div>`;
}

export function stepNavHtml(n) {
  const next = CH_STEPS.find((s) => s.n === n + 1);
  return `
    <div class="ch-step-nav">
      ${n > 1 ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button">Weiter: ${esc(next.title)} →</button>` : ""}
    </div>`;
}

export async function markStepDone(reclaimCase, n) {
  const done = new Set(reclaimCase.ch.stepsDone ?? []);
  if (done.has(n)) return;
  done.add(n);
  reclaimCase.ch.stepsDone = [...done].sort();
  await saveCase(reclaimCase);
}

export function bindStepNav(container, reclaimCase, n) {
  container.querySelector("[data-step-back]")?.addEventListener("click", () => navigate(chStepRoute(reclaimCase.caseId, n - 1)));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markStepDone(reclaimCase, n);
    navigate(chStepRoute(reclaimCase.caseId, n + 1));
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

export function toastSaved(label) {
  showToast(`✓ ${label} gespeichert`);
}
