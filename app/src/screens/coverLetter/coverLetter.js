// Screen "Anschreiben Finanzamt" (#/anschreiben). Eigenständiger Menüpunkt
// (siehe components/sidebar.js, Abschnitt "Nutzer") statt Teil des DivRebound-
// Wizards, weil das Anschreiben profilweit gilt und nicht an einen einzelnen
// Fall gebunden ist. Zeigt zur Bestätigung die Anschrift des Finanzamts und
// erzeugt darunter per Klick das Anschreiben als PDF (analog zum Download-Button
// für die Wohnsitzbescheinigung in summaryDownload.js).
//
// Die Anschrift ist KEINE eigene Kopie: dieselben Felder wie in "Persönliche
// Daten" (util/profileFields.js), automatisch ins Profil gespeichert
// (util/autosave.js) - eine Änderung hier ist eine Änderung dort.
//
// Liest/schreibt wie profile.js ausschließlich das live InvestorProfile, nie
// ReclaimCase.applicantSnapshot (siehe divrebound_data_schema.md §2).

import { getState } from "../../store/store.js";
import { buildTaxOfficeLetter, buildLetterFileName } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { confirmedFieldClasses } from "../../util/fieldDisplay.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { bindProfileAutosave } from "../../util/autosave.js";

export function mount(container) {
  render(container);
  if (!getState().currentProfile) return;
  return bindProfileAutosave(container, {
    getProfile: () => getState().currentProfile,
    onSaved: (profile) => updateDownloadState(container, profile),
  });
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

function isTaxOfficeComplete(profile) {
  const t = normalizeTaxOffice(profile.residence.taxOffice);
  return Boolean(t.name.trim() && t.street.trim() && t.postalCode.trim() && t.city.trim());
}

function field(profile, key, label, { wide, placeholder } = {}) {
  const value = PROFILE_FIELDS[key].read(profile);
  const c = confirmedFieldClasses(value);
  return `
    <div class="field-row ${wide ? "field-row-wide" : ""}">
      <label class="${c.labelClass}">${label}</label>
      <input class="${c.inputClass}" data-field="${key}" placeholder="${esc(placeholder ?? "")}" value="${esc(value)}">
      <span class="field-error" data-error-for="${key}" hidden></span>
    </div>`;
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

  const fileNamePreview = buildLetterFileName(profile);

  container.innerHTML = `
    <div class="profile-page">
    <div class="content-header">
      <h1 class="content-title">Anschreiben Finanzamt</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Zuständiges Finanzamt</span></div>
      <div class="card-body">
        <div class="field-grid">
          ${field(profile, "taxOfficeName", "Name", { wide: true, placeholder: "z.B. Finanzamt München I" })}
        </div>
        <div class="field-grid">
          ${field(profile, "taxOfficeStreet", "Straße und Hausnummer", { wide: true, placeholder: "z.B. Deroystraße 4" })}
        </div>
        <div class="field-grid">
          ${field(profile, "taxOfficePostalCode", "Postleitzahl", { placeholder: "z.B. 80335" })}
          ${field(profile, "taxOfficeCity", "Ort", { placeholder: "z.B. München" })}
        </div>
        <div class="field-hint">Bitte prüfen. Aus Ihren persönlichen Daten – Änderungen hier werden automatisch dort gespeichert.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Dokument erstellen</span></div>
      <div class="card-body">
        <button class="download-btn" data-action="download">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M12 11v6"/>
            <path d="m9 14 3 3 3-3"/>
          </svg>
          Anschreiben herunterladen (PDF)
        </button>
        <div class="field-hint" data-incomplete-hint style="text-align:center;margin-top:8px;">Bitte zuerst die vollständige Anschrift des Finanzamts oben eintragen.</div>
        <div class="filename-preview">${esc(fileNamePreview)}</div>
        <div id="download-status"></div>
      </div>
    </div>
    </div>
  `;

  const downloadBtn = container.querySelector('[data-action="download"]');
  downloadBtn.addEventListener("click", () => handleDownload(container, downloadBtn));
  updateDownloadState(container, profile);
}

function updateDownloadState(container, profile) {
  const complete = isTaxOfficeComplete(profile);
  const btn = container.querySelector('[data-action="download"]');
  const hint = container.querySelector("[data-incomplete-hint]");
  if (btn) btn.disabled = !complete;
  if (hint) hint.hidden = complete;
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
    updateDownloadState(container, getState().currentProfile);
  }
}
