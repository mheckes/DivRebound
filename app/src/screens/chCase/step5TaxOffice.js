// Schritt 5 "Formular & Finanzamt" (docs/konzept-schweiz.md §1a). Gleicher
// Aufbau wie künftig bei Dänemark: Status-Zeitleiste, Formular, Anschreiben,
// nächste Schritte, "Bearbeitung pausiert", Zusammenfassung. Bei der Schweiz
// erzeugt das ePortal das Formular (Antrag DIP-0085) - DivRebound liefert das
// Anschreiben und merkt sich Antrags-ID und Status.

import { getState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import { buildTaxOfficeLetter } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { exportEncrypted, exportPlain, triggerJsonDownload } from "../../crypto/exportImport.js";
import { openExportOptionsModal } from "../../components/modal.js";
import { statusTimelineHtml, bindStatusTimeline } from "../../components/statusTimeline.js";
import * as caseRepo from "../../db/caseRepo.js";
import { chStepRoute } from "../../config/caseSteps.js";
import {
  esc, saveCase, loadTransactions, entitlementsFor, formatChf, caseLabel,
  stepHeader, stepNavHtml, bindStepNav, toastSaved,
} from "./chShared.js";

export const CH_TIMELINE = [
  { label: "Formular erstellt", where: "ePortal" },
  { label: "Unterschrieben & versendet", where: "Post" },
  { label: "Vom Finanzamt bestätigt", where: "Finanzamt" },
  { label: "Im ePortal hochgeladen", where: "ePortal" },
  { label: "Ausgezahlt", where: "Konto" },
];

export function timelineTitle(reclaimCase, total) {
  return `${reclaimCase.ch.claimId ? `Antrag ${reclaimCase.ch.claimId}` : "Antrag"} · ${formatChf(total)}`;
}

const FORM_CHECKS = [
  ["created", "Im ePortal auf <b>„Erstellen“</b> klicken und den Antrag als PDF speichern bzw. ausdrucken."],
  ["signed", "Auf Seite 1 unter „Rechtsgültige Unterschrift“ Ort und Datum eintragen und unterschreiben."],
];

export async function mount(container, reclaimCase) {
  const transactions = await loadTransactions(getState().currentProfile);
  render(container, reclaimCase, transactions);
}

function downloadBlob(bytes, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function render(container, reclaimCase, transactions) {
  const profile = getState().currentProfile;
  const results = entitlementsFor(reclaimCase, transactions, profile);
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  const years = [...new Set(results.map((r) => Number(r.distribution.paymentDate.slice(0, 4))))].sort();
  const taxOffice = normalizeTaxOffice(profile.residence.taxOffice);
  const taxOfficeComplete = Boolean(taxOffice.name && taxOffice.street && taxOffice.postalCode && taxOffice.city);
  const formChecks = new Set(reclaimCase.ch.formChecks ?? []);
  const yearsLabel = years.length ? (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0])) : "";

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    <p class="ch-lead">Ihr Antrag muss vom deutschen Finanzamt bestätigt werden. Speichern Sie ihn im ePortal als PDF, drucken Sie ihn aus, unterschreiben Sie ihn und senden Sie ihn mit dem Anschreiben an Ihr Finanzamt.</p>

    ${statusTimelineHtml({ title: timelineTitle(reclaimCase, total), steps: CH_TIMELINE, doneCount: reclaimCase.ch.timelineStep })}

    <div class="ch-warning">⚠️ Keine handschriftlichen Korrekturen auf dem ausgedruckten Antrag – die ESTV lehnt solche Anträge ab. Fehler im Portal korrigieren und neu ausdrucken.</div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Formular</span><span class="ch-head-sub">wird im ePortal erzeugt</span></div>
      <div class="card-body">
        ${FORM_CHECKS.map(([id, text]) => `<label class="ch-step-row"><input type="checkbox" data-form-check="${id}" ${formChecks.has(id) ? "checked" : ""}><span>${text}</span></label>`).join("")}
        <div class="ch-claim-id">
          <label for="claim-id">Antrags-ID <span class="field-optional">· oben rechts auf dem Antrag</span></label>
          <input id="claim-id" class="${reclaimCase.ch.claimId ? "confirmed-input" : "field-input"} mono" placeholder="z.B. DE-1407-5964-00" value="${esc(reclaimCase.ch.claimId)}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Anschreiben an das Finanzamt</span><span class="ch-head-sub">${esc(taxOffice.name || "Finanzamt fehlt")}</span></div>
      <div class="card-body">
        <p class="ch-text">Bitte um Bestätigung der Ansässigkeit auf dem beigefügten Antrag${reclaimCase.ch.claimId ? ` <span class="mono">${esc(reclaimCase.ch.claimId)}</span>` : ""}${yearsLabel ? ` (Jahre ${esc(yearsLabel)})` : ""}, mit Steuer-ID und Steuernummer.</p>
        <button class="download-btn" data-action="letter" ${taxOfficeComplete ? "" : "disabled"} type="button">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 11v6"/><path d="m9 14 3 3 3-3"/></svg>
          Anschreiben herunterladen (PDF)
        </button>
        ${taxOfficeComplete ? "" : `<div class="field-hint" style="margin-top:8px;">Bitte zuerst die Anschrift des Finanzamts in <a href="#" data-go-step="1">Schritt 1</a> ergänzen.</div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Nächste Schritte</span></div>
      <div class="card-body">
        <div class="ch-next"><span class="ch-next-num">1</span><span>Antrag und Anschreiben per Post an das Finanzamt senden.</span></div>
        <div class="ch-next"><span class="ch-next-num">2</span><span>Das Finanzamt bestätigt auf Seite 1 (Stempel und Unterschrift) und schickt den Antrag zurück.</span></div>
        <div class="ch-next"><span class="ch-next-num">3</span><span>Danach geht es weiter mit <a href="#" data-go-step="6">Schritt 6: Hochladen &amp; abschließen</a>.</span></div>
      </div>
    </div>

    <div class="status-panel">
      <div class="status-panel-title">Bearbeitung pausiert</div>
      <div class="status-panel-text">Die weitere Bearbeitung benötigt die Bestätigung durch das Finanzamt (Wartezeit meist 2–3 Wochen). Bearbeitungsstand jetzt speichern, um später einfach fortfahren zu können.</div>
      <div class="status-actions">
        <button class="status-btn" data-action="save-state" type="button">💾 Bearbeitungsstand speichern</button>
        <button class="status-btn" data-action="reminder" type="button">📅 Erinnerung herunterladen (.ics)</button>
      </div>
    </div>

    <details class="card ch-summary-card">
      <summary class="card-head"><span class="card-title">Zusammenfassung des Antrags</span><span class="ch-head-sub">${yearsLabel ? `Jahre ${esc(years.join(", "))} · ` : ""}${formatChf(total)}</span></summary>
      <div class="card-body">
        <div class="summary-row"><span class="summary-label">Antragsteller</span><span class="summary-value">${esc(`${profile.residence.firstName} ${profile.residence.lastName}, ${profile.residence.address}, ${profile.residence.postalCode} ${profile.residence.city}`)}</span></div>
        ${years
          .map((y) => {
            const amount = results.filter((r) => Number(r.distribution.paymentDate.slice(0, 4)) === y).reduce((s, r) => s + (r.refund ?? 0), 0);
            return `<div class="summary-row"><span class="summary-label">Erstattung ${y}</span><span class="summary-value mono">${formatChf(amount)}</span></div>`;
          })
          .join("")}
        <div class="summary-row"><span class="summary-label">Überweisung auf</span><span class="summary-value mono">${esc(profile.bank.iban)}</span></div>
      </div>
    </details>

    ${stepNavHtml(5)}
    </div>`;

  bindStepNav(container, reclaimCase, 5);
  bindStatusTimeline(container, () => reclaimCase.ch.timelineStep, async (n) => {
    reclaimCase.ch.timelineStep = n;
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });

  container.querySelectorAll("[data-form-check]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.ch.formChecks ?? []);
      box.checked ? set.add(box.dataset.formCheck) : set.delete(box.dataset.formCheck);
      reclaimCase.ch.formChecks = [...set];
      await saveCase(reclaimCase);
    })
  );

  const claimInput = container.querySelector("#claim-id");
  claimInput.addEventListener("change", async () => {
    reclaimCase.ch.claimId = claimInput.value.trim().toUpperCase();
    // Mit der Antrags-ID ist das Formular erstellt.
    if (reclaimCase.ch.claimId && reclaimCase.ch.timelineStep < 1) reclaimCase.ch.timelineStep = 1;
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
    toastSaved("Antrags-ID");
  });

  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    const reference = reclaimCase.ch.claimId
      ? `Antrag ${reclaimCase.ch.claimId} auf Rückerstattung der schweizerischen Verrechnungssteuer`
      : "Antrag auf Rückerstattung der schweizerischen Verrechnungssteuer";
    const bytes = await buildTaxOfficeLetter(getState().currentProfile, { reference });
    const lastName = profile.residence.lastName || "DivRebound";
    downloadBlob(bytes, `Anschreiben_Finanzamt_${lastName}_Schweiz${yearsLabel ? `_${yearsLabel}` : ""}.pdf`, "application/pdf");
  });

  container.querySelectorAll("[data-go-step]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(chStepRoute(reclaimCase.caseId, Number(a.dataset.goStep)));
    })
  );

  container.querySelector('[data-action="save-state"]').addEventListener("click", async () => {
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const current = getState().currentProfile;
    const payload = {
      investorProfiles: [current],
      reclaimCases: await caseRepo.getByProfileId(current.profileId),
      transactions: await loadTransactions(current),
    };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    triggerJsonDownload(fileJson, `DivRebound_Schweiz${yearsLabel ? `_${yearsLabel}` : ""}.divrebound.json`);
  });

  container.querySelector('[data-action="reminder"]').addEventListener("click", () => {
    const due = new Date();
    due.setDate(due.getDate() + 21);
    const day = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DivRebound//Erinnerung//DE", "BEGIN:VEVENT",
      `UID:${reclaimCase.caseId}-reminder@divrebound`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(due)}`,
      "SUMMARY:DivRebound – Rückmeldung vom Finanzamt prüfen",
      `DESCRIPTION:Prüfen, ob der Schweizer Antrag vom Finanzamt bestätigt wurde (${caseLabel(reclaimCase)}).`,
      "END:VEVENT", "END:VCALENDAR", "",
    ].join("\r\n");
    downloadBlob(new TextEncoder().encode(ics), "Erinnerung.ics", "text/calendar");
  });
}
