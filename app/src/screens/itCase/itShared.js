// Gemeinsame Helfer der fünf Schritte eines DivRebound Italien
// (docs/konzept-italien.md §1). Aufbau wie Dänemark, Bausteine (Checkliste,
// Zeitleiste, Schritt-Navigation) wie bei der Schweiz.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { IT_STEPS, itStepRoute } from "../../config/caseSteps.js";
import { statusTimelineHtml, bindStatusTimeline } from "../../components/statusTimeline.js";
import { exportEncrypted, exportPlain, triggerJsonDownload } from "../../crypto/exportImport.js";
import { openExportOptionsModal } from "../../components/modal.js";
import { isEligible, formsFor, yearsOf, totalRefund } from "../../lib/italy.js";

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatEurPlain(value) {
  return (value ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function saveCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    currentCase: reclaimCase,
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
  });
}

/** Bestätigte, erstattungsfähige Ausschüttungen - nur diese kommen ins Formular */
export function eligibleDistributions(reclaimCase) {
  return reclaimCase.distributions.filter((d) => isEligible(d));
}

export function caseForms(reclaimCase) {
  return formsFor(eligibleDistributions(reclaimCase));
}

export function caseSummary(reclaimCase) {
  const eligible = eligibleDistributions(reclaimCase);
  return { eligible, forms: formsFor(eligible), years: eligible.length ? yearsOf(eligible) : [], total: totalRefund(eligible) };
}

export function yearRangeLabel(years) {
  if (!years.length) return String(new Date().getFullYear());
  return years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
}

export function stepHeader(reclaimCase, n) {
  const step = IT_STEPS.find((s) => s.n === n);
  return `
    <div class="content-header">
      <h1 class="content-title">${esc(step.title)}</h1>
      <div class="content-breadcrumb">Italien <b>›</b> ${esc(caseLabel(reclaimCase))} <b>›</b> ${n} von ${IT_STEPS.length}</div>
    </div>`;
}

export function stepNavHtml(n, { nextDisabled = false } = {}) {
  const next = IT_STEPS.find((s) => s.n === n + 1);
  return `
    <div class="ch-step-nav">
      ${n > 1 ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button" ${nextDisabled ? "disabled" : ""}>Weiter: ${esc(next.title)} →</button>` : ""}
    </div>`;
}

export async function markStepDone(reclaimCase, n) {
  const done = new Set(reclaimCase.it.stepsDone ?? []);
  if (done.has(n)) return;
  done.add(n);
  reclaimCase.it.stepsDone = [...done].sort();
  await saveCase(reclaimCase);
}

export function goToStep(reclaimCase, n) {
  navigate(itStepRoute(reclaimCase.caseId, n));
}

export function bindStepNav(container, reclaimCase, n) {
  container.querySelector("[data-step-back]")?.addEventListener("click", () => goToStep(reclaimCase, n - 1));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markStepDone(reclaimCase, n);
    goToStep(reclaimCase, n + 1);
  });
}

// --- Status-Zeitleiste (Schritt 4 und 5) ---

export const IT_TIMELINE = [
  { label: "Formular erstellt", where: "DivRebound" },
  { label: "Unterschrieben & ans Finanzamt", where: "Post" },
  { label: "Vom Finanzamt bestätigt", where: "Finanzamt" },
  { label: "Nach Italien versendet", where: "Post" },
  { label: "Ausgezahlt", where: "Konto" },
];

/** Gespeicherter Fortschritt, mindestens aber aus dem Fall abgeleitet */
export function timelineDone(reclaimCase) {
  let derived = reclaimCase.generatedDocuments.some((d) => d.type === "it_form_a") ? 1 : 0;
  if (reclaimCase.it.mailedAt) derived = 4;
  if (reclaimCase.it.receivedRefund?.date) derived = 5;
  return Math.max(reclaimCase.it.timelineStep ?? 0, derived);
}

export function timelineHtml(reclaimCase) {
  const { forms, total } = caseSummary(reclaimCase);
  const title = `Form A Italien · ${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · ${formatEurPlain(total)} €`;
  return statusTimelineHtml({ title, steps: IT_TIMELINE, doneCount: timelineDone(reclaimCase) });
}

/** @param {() => void} rerender */
export function bindTimeline(container, reclaimCase, rerender) {
  bindStatusTimeline(container, () => timelineDone(reclaimCase), async (n) => {
    reclaimCase.it.timelineStep = n;
    await saveCase(reclaimCase);
    rerender();
  });
}

// --- Dateien ---

export function downloadBlob(bytes, fileName, mimeType = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

let templatePromise = null;
export function loadFormATemplate() {
  templatePromise ??= fetch(import.meta.env.BASE_URL + "forms/it-form-a-template.pdf").then((r) => {
    if (!r.ok) {
      templatePromise = null;
      throw new Error(`Formularvorlage konnte nicht geladen werden (HTTP ${r.status})`);
    }
    return r.arrayBuffer();
  });
  return templatePromise;
}

// --- "Bearbeitung pausiert" (wie Dänemark/Schweiz) ---

export function pausedPanelHtml() {
  return `
    <div class="status-panel">
      <div class="status-panel-title">Bearbeitung pausiert</div>
      <div class="status-panel-text">Die weitere Bearbeitung benötigt die Bestätigung durch das Finanzamt (Wartezeit meist 2–3 Wochen). Bearbeitungsstand jetzt speichern, um später einfach fortfahren zu können.</div>
      <div class="status-actions">
        <button class="status-btn" data-action="save-state" type="button">💾 Bearbeitungsstand speichern</button>
        <button class="status-btn" data-action="reminder" type="button">📅 Erinnerung herunterladen (.ics)</button>
      </div>
    </div>`;
}

export function bindPausedPanel(container, reclaimCase) {
  container.querySelector('[data-action="save-state"]')?.addEventListener("click", async () => {
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const profile = getState().currentProfile;
    const payload = { investorProfiles: [profile], reclaimCases: await caseRepo.getByProfileId(profile.profileId) };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    triggerJsonDownload(fileJson, `DivRebound_Italien_${yearRangeLabel(caseSummary(reclaimCase).years)}.divrebound.json`);
  });
  container.querySelector('[data-action="reminder"]')?.addEventListener("click", () => {
    const due = new Date();
    due.setDate(due.getDate() + 21);
    const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DivRebound//Erinnerung//DE", "BEGIN:VEVENT",
      `UID:${reclaimCase.caseId}-reminder@divrebound`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(due)}`,
      "SUMMARY:DivRebound – Rückmeldung vom Finanzamt prüfen",
      `DESCRIPTION:Prüfen, ob das Finanzamt die Form A für Italien bestätigt hat (${caseLabel(reclaimCase)}).`,
      "END:VEVENT", "END:VCALENDAR", "",
    ].join("\r\n");
    downloadBlob(new TextEncoder().encode(ics), "Erinnerung.ics", "text/calendar");
  });
}
