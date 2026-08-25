// Schritt 1, letzter Screen: Zusammenfassung + Wohnsitzbescheinigung (Formular
// 02.050) erzeugen. Ab hier ist Prozess A ("Wohnsitzbescheinigung besorgen")
// aus Nutzersicht abgeschlossen - danach wartet der Fall auf die Bestätigung
// durch das Finanzamt (Medienbruch, siehe status-panel unten).
//
// Anzeige der Personendaten bewusst NICHT aus reclaimCase.applicantSnapshot,
// sondern durchgängig aus dem live InvestorProfile: fillResidencyCertificate.js
// - die tatsächliche PDF-Fill-Logik - liest Name/Adresse/Steuer-ID/Geburtsdatum/
// -ort/Wohnsitzland selbst ausschließlich aus profile.residence (siehe dortiger
// Quellcode), nie aus dem Snapshot. Würde diese Zusammenfassung stattdessen den
// (zum Case-Anlagezeitpunkt oft noch leeren, siehe divrebound_data_schema.md §2)
// Snapshot anzeigen, widerspräche die Anzeige dem tatsächlich erzeugten PDF.
// Der Ansässigkeitszeitraum kommt vollständig aus reclaimCase.residencePeriod
// (case-spezifisch, nicht Teil des Profils).

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { fillResidencyCertificate, buildFileName } from "../../lib/fillResidencyCertificate.js";
import { exportEncrypted, triggerJsonDownload } from "../../crypto/exportImport.js";
import { openPassphraseModal } from "../../components/modal.js";
import { corridors } from "../../config/corridors.js";
import { formatDateDe, formatCurrency, formatNumberDe } from "../../util/format.js";

// Gleiche Reihenfolge wie in components/sidebar.js - dort nicht exportiert,
// daher hier lokal noch einmal definiert.
const STATUS_ORDER = [
  "draft",
  "residency_form_generated",
  "awaiting_tax_office",
  "ready_for_skat_submission",
  "skat_form_verified",
  "submitted",
];

// Nur zur Anzeige einer groben EUR-Näherung neben dem DKK-Erstattungsbetrag,
// wie schon im Schritt-1-Mockup (Positions-/Jahresübersicht) verwendet.
const APPROX_EUR_DKK_RATE = 7.46;

const COUNTRY_NAMES_DE = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function countryNameGerman(code) {
  return COUNTRY_NAMES_DE[code] ?? code ?? "";
}

function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Gleiche Jahres-Ableitung wie buildFileName() in fillResidencyCertificate.js. */
function yearLabel(reclaimCase) {
  const years = [...new Set(reclaimCase.distributions.map((d) => d.taxYear))].sort();
  if (years.length === 0) return String(new Date().getFullYear());
  return years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
}

function formatResidencePeriod(period) {
  const from = formatDateDe(period?.from);
  if (!from) return "–";
  const until = period?.until ? formatDateDe(period.until) : "andauernd";
  return `${from} – ${until}`;
}

function formatDateTimeDe(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function refundForDistribution(distribution, treatyRate) {
  return distribution.withheldTax - distribution.grossDividend * treatyRate;
}

function renderDistributionsCard(reclaimCase, profile) {
  const confirmed = reclaimCase.distributions.filter((d) => d.extractionConfidence !== "extracted");
  const corridor = corridors[reclaimCase.targetCountry] ?? corridors.DK;
  const treatyRate = corridor.treatyRateByResidence?.[profile.residence.country] ?? 0.15;
  const nativeCurrency = corridor.nativeCurrency ?? "DKK";

  if (confirmed.length === 0) {
    return `
      <div class="card">
        <div class="card-head head-navy">
          <span class="card-title">Bestätigte Ausschüttungen</span>
          <span class="count-pill">0 von ${reclaimCase.distributions.length}</span>
        </div>
        <div class="card-body">
          <p class="empty-hint">Noch keine bestätigten Ausschüttungen. Bitte in Schritt 1 zuerst mindestens eine Ausschüttung bestätigen.</p>
        </div>
      </div>`;
  }

  let totalGross = 0;
  let totalWithheld = 0;
  let totalRefund = 0;
  const rows = confirmed
    .map((d) => {
      const refund = refundForDistribution(d, treatyRate);
      totalGross += d.grossDividend;
      totalWithheld += d.withheldTax;
      totalRefund += refund;
      return `
        <tr>
          <td>
            <div style="font-weight:600;">${esc(d.issuerName)}</div>
            <div class="mono" style="font-size:10.5px;color:var(--muted);">${esc(d.isin)}</div>
          </td>
          <td class="mono">${esc(formatDateDe(d.paymentDate))}</td>
          <td class="mono">${esc(formatCurrency(d.grossDividend, d.currency))}</td>
          <td class="mono">${esc(formatCurrency(d.withheldTax, d.currency))}</td>
          <td class="mono">${esc(formatCurrency(refund, d.currency))}</td>
        </tr>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Bestätigte Ausschüttungen</span>
        <span class="count-pill">${confirmed.length} von ${reclaimCase.distributions.length}</span>
      </div>
      <div class="card-body">
        <div style="overflow-x:auto;">
          <table class="dist-table">
            <thead>
              <tr>
                <th>ISIN / Emittent</th>
                <th>Zahltag</th>
                <th>Brutto</th>
                <th>Quellensteuer</th>
                <th>Erstattbar</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="dist-total-row">
                <td colspan="2">Gesamt</td>
                <td class="mono">${esc(formatCurrency(totalGross, nativeCurrency))}</td>
                <td class="mono">${esc(formatCurrency(totalWithheld, nativeCurrency))}</td>
                <td class="mono">${esc(formatCurrency(totalRefund, nativeCurrency))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="refund-summary">
          <span class="refund-summary-label">Voraussichtliche Erstattung (Schätzung)</span>
          <span class="refund-summary-value">
            ${esc(formatCurrency(totalRefund, nativeCurrency))}
            <span class="refund-summary-eur">≈ ${esc(formatNumberDe(totalRefund / APPROX_EUR_DKK_RATE))} EUR</span>
          </span>
        </div>
      </div>
    </div>`;
}

function renderDownloadStatusHtml(kind, data) {
  if (kind === "loading") {
    return `<div class="download-status loading">⏳ Formular wird befüllt und heruntergeladen …</div>`;
  }
  if (kind === "success") {
    return `<div class="download-status success">✓ „${esc(data.fileName)}" heruntergeladen (${esc(formatDateTimeDe(data.generatedAt))} Uhr).</div>`;
  }
  if (kind === "prior") {
    return `<div class="download-status success">✓ Zuletzt erzeugt: „${esc(data.fileName)}" am ${esc(formatDateTimeDe(data.generatedAt))} Uhr.</div>`;
  }
  if (kind === "error") {
    return `<div class="download-status error">✕ Herunterladen fehlgeschlagen: ${esc(data.message)}. Bitte erneut versuchen.</div>`;
  }
  return "";
}

function lastGeneratedCertificate(reclaimCase) {
  const docs = reclaimCase.generatedDocuments.filter((doc) => doc.type === "residency_certificate");
  if (docs.length === 0) return null;
  return docs.reduce((latest, doc) => (doc.generatedAt > latest.generatedAt ? doc : latest));
}

function render(container) {
  const { currentCase: reclaimCase, currentProfile: profile } = getState();

  if (!reclaimCase || !profile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Zusammenfassung & Download</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Kein Fall ausgewählt.</div></div>`;
    return;
  }

  const residence = profile.residence;
  const fullName = `${residence.firstName} ${residence.lastName}`.trim();
  const fullAddress = `${residence.address}, ${residence.postalCode} ${residence.city}`;

  let fileNamePreview = "";
  try {
    fileNamePreview = buildFileName(profile, reclaimCase);
  } catch (err) {
    fileNamePreview = "";
  }

  const priorDoc = lastGeneratedCertificate(reclaimCase);
  const initialStatusHtml = priorDoc ? renderDownloadStatusHtml("prior", priorDoc) : "";

  container.innerHTML = `
    <div class="content-header">
      <div class="content-breadcrumb">Dänemark <b>›</b> ${esc(caseLabel(reclaimCase))} <b>›</b> Schritt 1</div>
      <h1 class="content-title">Zusammenfassung & Download</h1>
    </div>

    <a class="back-link" data-action="back">← Zurück</a>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Angaben für die Wohnsitzbescheinigung</span>
      </div>
      <div class="card-body">
        <div class="summary-row"><span class="summary-label">Name</span><span class="summary-value">${esc(fullName)}</span></div>
        <div class="summary-row"><span class="summary-label">Adresse</span><span class="summary-value">${esc(fullAddress)}</span></div>
        <div class="summary-row"><span class="summary-label">Geburtsdatum</span><span class="summary-value">${esc(formatDateDe(profile.residence.birthDate))}</span></div>
        <div class="summary-row"><span class="summary-label">Geburtsort</span><span class="summary-value">${esc(profile.residence.birthPlace)}</span></div>
        <div class="summary-row"><span class="summary-label">Steuer-ID</span><span class="summary-value">${esc(residence.tin)}</span></div>
        <div class="summary-row"><span class="summary-label">Wohnsitzland (DBA)</span><span class="summary-value">${esc(countryNameGerman(profile.residence.country))}</span></div>
        <div class="summary-row"><span class="summary-label">Ansässig seit</span><span class="summary-value">${esc(formatResidencePeriod(reclaimCase.residencePeriod))}</span></div>
      </div>
    </div>

    ${renderDistributionsCard(reclaimCase, profile)}

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Dokument erstellen</span>
      </div>
      <div class="card-body">
        <button class="download-btn" data-action="download">
          ⬇ Wohnsitzbescheinigung herunterladen (PDF)
        </button>
        <div class="filename-preview">${esc(fileNamePreview)}</div>
        <div id="download-status">${initialStatusHtml}</div>

        <div class="warning-box">
          <span>⚠</span>
          <span><b>Wichtig:</b> Diese Bescheinigung wird nicht direkt bei SKAT eingereicht. Ausdrucken, unterschreiben und vom zuständigen ${esc(countryNameGerman(profile.residence.country))}er Finanzamt bestätigen lassen – erst danach folgt in Schritt 2 die Einreichung im SKAT-Portal.</span>
        </div>

        <label class="toggle-row" style="margin-top:18px;">
          <input type="checkbox" id="cover-letter">
          Anschreiben ans Finanzamt zusätzlich erstellen
        </label>

        <div class="field disabled-look" id="taxoffice-field">
          <label for="taxoffice">Name &amp; Adresse des Finanzamts</label>
          <input type="text" id="taxoffice" placeholder="z.B. Finanzamt München I, Deroystraße 4, 80335 München" disabled value="${esc(residence.taxOffice?.name ? `${residence.taxOffice.name}, ${residence.taxOffice.address}` : "")}">
          <div class="hint">Zu finden z.B. auf Ihrem letzten Einkommensteuerbescheid.</div>
        </div>
      </div>
    </div>

    <div class="status-panel">
      <div class="status-panel-title">Nächste Schritte</div>
      <div class="step-row"><span class="step-num">1</span><span>Ausdrucken, unterschreiben und an das zuständige Finanzamt per Post senden.</span></div>
      <div class="step-row"><span class="step-num">2</span><span>Nach der Bestätigung durch das Finanzamt geht es in Schritt 2 weiter.</span></div>
    </div>

    <div class="status-panel">
      <div class="status-panel-title">Bearbeitung pausiert</div>
      <div class="status-panel-text">
        Die weitere Bearbeitung benötigt die Bestätigung durch das Finanzamt (Wartezeit meist 2–3 Wochen). Bearbeitungsstand jetzt speichern, um später einfach fortfahren zu können.
      </div>
      <div class="status-actions">
        <button class="status-btn" data-action="save-state">💾 Bearbeitungsstand speichern</button>
        <button class="status-btn" data-action="reminder">📅 Erinnerung herunterladen (.ics)</button>
      </div>
    </div>
  `;

  attachListeners(container, reclaimCase);
}

function attachListeners(container, reclaimCase) {
  container.querySelector('[data-action="back"]').addEventListener("click", () => {
    navigate(`#/dk/${reclaimCase.caseId}/step1/missing-data`);
  });

  container.querySelector('[data-action="download"]').addEventListener("click", (e) => {
    handleDownload(container, e.currentTarget);
  });

  container.querySelector('[data-action="save-state"]').addEventListener("click", () => {
    handleSaveState();
  });

  container.querySelector('[data-action="reminder"]').addEventListener("click", () => {
    handleDownloadReminder();
  });

  const coverLetterCheckbox = container.querySelector("#cover-letter");
  coverLetterCheckbox.addEventListener("change", () => toggleTaxOfficeField(container));
}

function toggleTaxOfficeField(container) {
  const checked = container.querySelector("#cover-letter").checked;
  const input = container.querySelector("#taxoffice");
  const wrapper = container.querySelector("#taxoffice-field");
  input.disabled = !checked;
  wrapper.classList.toggle("disabled-look", !checked);
  if (checked) input.focus();
}

async function handleDownload(container, btn) {
  const { currentCase: reclaimCase, currentProfile: profile } = getState();
  if (!reclaimCase || !profile) return;

  const statusEl = container.querySelector("#download-status");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  statusEl.innerHTML = renderDownloadStatusHtml("loading");

  try {
    const templateBytes = await fetch(import.meta.env.BASE_URL + "forms/dk-02.050-template.pdf").then((r) => {
      if (!r.ok) throw new Error(`Formularvorlage konnte nicht geladen werden (HTTP ${r.status})`);
      return r.arrayBuffer();
    });

    const filledBytes = await fillResidencyCertificate(templateBytes, profile, reclaimCase);
    const fileName = buildFileName(profile, reclaimCase);
    downloadBlob(filledBytes, fileName, "application/pdf");

    const generatedAt = new Date().toISOString();
    reclaimCase.generatedDocuments = [
      ...reclaimCase.generatedDocuments,
      { type: "residency_certificate", fileName, generatedAt },
    ];
    if (STATUS_ORDER.indexOf(reclaimCase.status) < STATUS_ORDER.indexOf("awaiting_tax_office")) {
      reclaimCase.status = "awaiting_tax_office";
    }
    await caseRepo.put(reclaimCase);

    const cases = getState().cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c));
    setState({ currentCase: reclaimCase, cases });

    statusEl.innerHTML = renderDownloadStatusHtml("success", { fileName, generatedAt });
  } catch (err) {
    console.error("[summaryDownload] Formularerstellung fehlgeschlagen:", err);
    statusEl.innerHTML = renderDownloadStatusHtml("error", { message: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function handleSaveState() {
  const { currentProfile: profile, currentCase: reclaimCase } = getState();
  if (!profile || !reclaimCase) return;

  const passphrase = await openPassphraseModal("export");
  if (!passphrase) return;

  const fileJson = await exportEncrypted(
    { investorProfiles: [profile], reclaimCases: [reclaimCase] },
    passphrase
  );
  const fileName = `DivRebound_Daenemark_${yearLabel(reclaimCase)}.divrebound.json`;
  triggerJsonDownload(fileJson, fileName);
}

function toIcsDateOnly(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function toIcsTimestamp(d) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function handleDownloadReminder() {
  const { currentCase: reclaimCase } = getState();
  if (!reclaimCase) return;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 21); // Übliche Wartezeit lt. status-panel: 2-3 Wochen

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DivRebound//Erinnerung//DE",
    "BEGIN:VEVENT",
    `UID:${reclaimCase.caseId}-reminder@divrebound`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART;VALUE=DATE:${toIcsDateOnly(dueDate)}`,
    "SUMMARY:DivRebound – Rückmeldung vom Finanzamt prüfen",
    `DESCRIPTION:Prüfen, ob die Wohnsitzbescheinigung vom Finanzamt bestätigt wurde (Fall ${caseLabel(reclaimCase)}).`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  downloadBlob(new TextEncoder().encode(ics), "Erinnerung.ics", "text/calendar");
}

/** @param {HTMLElement} container @param {{ caseId: string }} params */
export function mount(container, params) {
  // params.caseId wird nicht direkt gebraucht: der Router hat vor dem Mount
  // bereits ensureCaseSelected(params.caseId) aufgerufen, currentCase/currentProfile
  // im Store sind zu diesem Zeitpunkt schon konsistent gesetzt.
  render(container);
}
