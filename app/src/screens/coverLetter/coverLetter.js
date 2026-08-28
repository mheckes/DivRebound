// Screen "Anschreiben Finanzamt" (#/anschreiben). Eigenständiger Menüpunkt
// (siehe components/sidebar.js, Abschnitt "Nutzer") statt Teil des DivRebound-
// Wizards, weil das Anschreiben - wie schon die Finanzamt-Daten selbst -
// profilweit gilt und nicht an einen einzelnen Fall gebunden ist. Bestätigt/
// ergänzt zunächst die Finanzamt-Daten (Name/Straße/PLZ/Ort, identische Felder
// wie im Profil-Screen), erzeugt darunter per Klick das Anschreiben als PDF
// (analog zum Download-Button für die Wohnsitzbescheinigung in
// summaryDownload.js).
//
// Liest/schreibt wie profile.js ausschließlich das live InvestorProfile, nie
// ReclaimCase.applicantSnapshot (siehe divrebound_data_schema.md §2).

import { getState, setState } from "../../store/store.js";
import * as profileRepo from "../../db/profileRepo.js";
import { buildTaxOfficeLetter, buildLetterFileName } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { confirmedFieldClasses } from "../../util/fieldDisplay.js";

let savedTimeoutId = null;

export function mount(container) {
  render(container);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function downloadBlob(bytes, fileName, mimeType) {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderDownloadStatusHtml(kind, data) {
  if (kind === "loading") return `<div class="download-status loading">⏳ Anschreiben wird erstellt und heruntergeladen …</div>`;
  if (kind === "success") return `<div class="download-status success">✓ „${esc(data.fileName)}" heruntergeladen.</div>`;
  if (kind === "error") return `<div class="download-status error">✕ Herunterladen fehlgeschlagen: ${esc(data.message)}. Bitte erneut versuchen.</div>`;
  return "";
}

function render(container) {
  const profile = getState().currentProfile;
  if (!profile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Anschreiben Finanzamt</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Es ist kein Profil vorhanden. Lege zunächst über den Einstiegs-Dialog ein Profil an.</div></div>
    `;
    return;
  }

  const t = normalizeTaxOffice(profile.residence.taxOffice);
  const hasTaxOffice = Boolean(t.name.trim() && t.street.trim() && t.postalCode.trim() && t.city.trim());
  const taxName = confirmedFieldClasses(t.name);
  const taxStreet = confirmedFieldClasses(t.street);
  const taxPostalCode = confirmedFieldClasses(t.postalCode);
  const taxCity = confirmedFieldClasses(t.city);
  const fileNamePreview = buildLetterFileName(profile);

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Anschreiben Finanzamt</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Zuständiges Finanzamt</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${taxName.labelClass}">Name</label>
            <input class="${taxName.inputClass}" data-field="taxOfficeName" placeholder="z.B. Finanzamt München I" value="${esc(t.name)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${taxStreet.labelClass}">Straße</label>
            <input class="${taxStreet.inputClass}" data-field="taxOfficeStreet" placeholder="z.B. Deroystraße 4" value="${esc(t.street)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${taxPostalCode.labelClass}">Postleitzahl</label>
            <input class="${taxPostalCode.inputClass}" data-field="taxOfficePostalCode" placeholder="z.B. 80335" value="${esc(t.postalCode)}">
          </div>
          <div class="field-row">
            <label class="${taxCity.labelClass}">Ort</label>
            <input class="${taxCity.inputClass}" data-field="taxOfficeCity" placeholder="z.B. München" value="${esc(t.city)}">
          </div>
        </div>
        <div class="save-row">
          <span class="save-status" data-save-status hidden>✓ Gespeichert</span>
          <button class="btn-primary" data-action="save" type="button">Speichern</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Dokument erstellen</span></div>
      <div class="card-body">
        <button class="download-btn" data-action="download" ${hasTaxOffice ? "" : "disabled"}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M12 11v6"/>
            <path d="m9 14 3 3 3-3"/>
          </svg>
          Anschreiben herunterladen (PDF)
        </button>
        ${hasTaxOffice ? "" : `<div class="field-hint" style="text-align:center;margin-top:8px;">Bitte zuerst die vollständigen Finanzamt-Daten oben eintragen.</div>`}
        <div class="filename-preview">${esc(fileNamePreview)}</div>
        <div id="download-status"></div>
      </div>
    </div>
  `;

  attachListeners(container, profile);
}

function attachListeners(container, profile) {
  container.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const value = (field) => container.querySelector(`[data-field="${field}"]`).value.trim();

    const updated = {
      ...profile,
      residence: {
        ...profile.residence,
        taxOffice: {
          name: value("taxOfficeName"),
          street: value("taxOfficeStreet"),
          postalCode: value("taxOfficePostalCode"),
          city: value("taxOfficeCity"),
        },
      },
    };

    await profileRepo.put(updated);
    setState({ currentProfile: updated });
    render(container);
    showSaved(container);
  });

  const downloadBtn = container.querySelector('[data-action="download"]');
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => handleDownload(container, downloadBtn));
  }
}

async function handleDownload(container, btn) {
  const profile = getState().currentProfile;
  if (!profile) return;

  const statusEl = container.querySelector("#download-status");
  btn.disabled = true;
  statusEl.innerHTML = renderDownloadStatusHtml("loading");

  try {
    const bytes = await buildTaxOfficeLetter(profile);
    const fileName = buildLetterFileName(profile);
    downloadBlob(bytes, fileName, "application/pdf");
    statusEl.innerHTML = renderDownloadStatusHtml("success", { fileName });
  } catch (err) {
    console.error("[coverLetter] Anschreiben-Erstellung fehlgeschlagen:", err);
    statusEl.innerHTML = renderDownloadStatusHtml("error", { message: err.message });
  } finally {
    btn.disabled = false;
  }
}

function showSaved(container) {
  const status = container.querySelector("[data-save-status]");
  if (!status) return;
  status.hidden = false;
  status.classList.add("visible");
  clearTimeout(savedTimeoutId);
  savedTimeoutId = setTimeout(() => {
    status.hidden = true;
    status.classList.remove("visible");
  }, 2500);
}
