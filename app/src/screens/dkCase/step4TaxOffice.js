// Dänemark, Schritt 4 "Formular & Finanzamt" (vormals "Zusammenfassung &
// Download"): Wohnsitzbescheinigung (Formular „02.050“) und Anschreiben erzeugen.
// Gleicher Aufbau wie bei der Schweiz (docs/konzept-schweiz.md §1a):
// Status-Zeitleiste, Formular (kompakte Zeile mit Vorschau und PDF, wie bei
// Italien), Anschreiben, nächste Schritte, "Bearbeitung pausiert". Die frühere
// Zusammenfassung und die Liste der bestätigten Ausschüttungen sind entfallen
// (wiederholten nur Schritt 2 und 3). Danach wartet der Fall auf die
// Bestätigung durch das Finanzamt (Medienbruch).

import { getState, setState } from "../../store/store.js";
import { goToStep, markStepDone, stepHeader } from "./dkShared.js";
import * as caseRepo from "../../db/caseRepo.js";
import { fillResidencyCertificate, buildFileName } from "../../lib/fillResidencyCertificate.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { formatDateDe } from "../../util/format.js";
import { buildTaxOfficeLetter } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { dkTimelineHtml, bindDkTimeline } from "./dkTimeline.js";

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

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** Gleiche Jahres-Ableitung wie buildFileName() in fillResidencyCertificate.js. */
function yearLabel(reclaimCase) {
  const years = [...new Set(reclaimCase.distributions.map((d) => d.taxYear))].sort();
  if (years.length === 0) return String(new Date().getFullYear());
  return years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
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

/** Unterzeile der Formular-Zeile; Jahre wie im Dateinamen (buildFileName). */
function documentSubline(reclaimCase) {
  const years = [...new Set(reclaimCase.distributions.map((d) => d.taxYear))].sort();
  const parts = [];
  if (years.length) parts.push(`${years.length === 1 ? "Steuerjahr" : "Steuerjahre"} ${years.join(", ")}`);
  const from = formatDateDe(reclaimCase.residencePeriod?.from);
  if (from) parts.push(`ansässig seit ${from}`);
  return parts.join(" · ");
}

function buildLetter(profile) {
  return buildTaxOfficeLetter(profile, { reference: "Wohnsitzbescheinigung (Formular „02.050“) zur Erstattung dänischer Quellensteuer" });
}

function letterFileName(profile, reclaimCase) {
  return `Anschreiben_Finanzamt_${profile.residence.lastName || "DivRebound"}_Daenemark_${yearLabel(reclaimCase)}.pdf`;
}

async function buildCertificate(profile, reclaimCase) {
  const templateBytes = await fetch(import.meta.env.BASE_URL + "forms/dk-02.050-template.pdf").then((r) => {
    if (!r.ok) throw new Error(`Formularvorlage konnte nicht geladen werden (HTTP ${r.status})`);
    return r.arrayBuffer();
  });
  return fillResidencyCertificate(templateBytes, profile, reclaimCase);
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
      <div class="content-header"><h1 class="content-title">Formular &amp; Finanzamt</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Kein Fall ausgewählt.</div></div>`;
    return;
  }

  const residence = profile.residence;

  let fileNamePreview = "";
  try {
    fileNamePreview = buildFileName(profile, reclaimCase);
  } catch (err) {
    fileNamePreview = "";
  }

  const priorDoc = lastGeneratedCertificate(reclaimCase);
  const initialStatusHtml = priorDoc ? renderDownloadStatusHtml("prior", priorDoc) : "";
  const taxOffice = normalizeTaxOffice(residence.taxOffice);
  const taxOfficeComplete = Boolean(taxOffice.name && taxOffice.street && taxOffice.postalCode && taxOffice.city);

  container.innerHTML = `
    ${stepHeader(reclaimCase, 4)}

    <p class="ch-lead">Die Wohnsitzbescheinigung (Formular „02.050“) muss vom deutschen Finanzamt bestätigt werden. DivRebound hat das Formular für dich ausgefüllt.</p>

    ${dkTimelineHtml(reclaimCase)}

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Formular</span>
        <span class="ch-head-sub">von DivRebound erzeugt</span>
      </div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Wohnsitzbescheinigung (Formular „02.050“)</div>
          <div class="doc-sub">${esc(documentSubline(reclaimCase))}</div>
          <div class="doc-file">${esc(fileNamePreview)}</div>
        </div>
        <div class="doc-actions">
          <button class="btn-secondary btn-small" data-action="preview" type="button">👁 Vorschau</button>
          <button class="btn-accent btn-small" data-action="download" type="button">⬇ PDF</button>
        </div>
      </div>
      <div class="doc-status" id="download-status">${initialStatusHtml}</div>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Anschreiben an das Finanzamt</span>
        <span class="ch-head-sub">${esc(normalizeTaxOffice(residence.taxOffice).name || "Finanzamt fehlt")}</span>
      </div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Anschreiben an das Finanzamt</div>
          <div class="doc-sub">Bitte um Bestätigung der Ansässigkeit auf der beigefügten Wohnsitzbescheinigung, mit Steuer-ID.</div>
          <div class="doc-file">${esc(letterFileName(profile, reclaimCase))}</div>
        </div>
        <div class="doc-actions">
          <button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${taxOfficeComplete ? "" : "disabled"}>👁 Vorschau</button>
          <button class="btn-accent btn-small" data-action="letter" type="button" ${taxOfficeComplete ? "" : "disabled"}>⬇ PDF</button>
        </div>
      </div>
      ${taxOfficeComplete ? "" : `<div class="doc-status field-hint">Bitte zuerst die Anschrift des Finanzamts in <a href="#" data-go-step="1">Schritt 1</a> ergänzen.</div>`}
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Nächste Schritte</span>
      </div>
      <div class="card-body">
        <div class="step-row"><span class="step-num">1</span><span>Wohnsitzbescheinigung ausdrucken, unterschreiben und mit dem Anschreiben per Post an das Finanzamt senden.</span></div>
        <div class="step-row"><span class="step-num">2</span><span>Das Finanzamt bestätigt (Stempel und Unterschrift) und schickt die Bescheinigung zurück.</span></div>
        <div class="step-row"><span class="step-num">3</span><span>Danach geht es weiter mit <a href="#" data-go-step="5">Schritt 5: SKAT-Portal ausfüllen</a> – dort lädst du die bestätigte Bescheinigung hoch.</span></div>
      </div>
    </div>

    ${pausePanelHtml(reclaimCase, "taxOffice")}

    <div class="ch-step-nav">
      <button class="btn-secondary" data-action="back" type="button">← Zurück</button>
      <button class="btn-primary" data-action="next" type="button">Weiter: SKAT-Portal ausfüllen →</button>
    </div>
  `;

  attachListeners(container, reclaimCase);
}

function attachListeners(container, reclaimCase) {
  container.querySelector('[data-action="back"]').addEventListener("click", () => goToStep(reclaimCase, 3));
  container.querySelector('[data-action="next"]').addEventListener("click", async () => {
    await markStepDone(reclaimCase, 4);
    goToStep(reclaimCase, 5);
  });
  container.querySelectorAll("[data-go-step]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      goToStep(reclaimCase, Number(a.dataset.goStep));
    })
  );

  bindDkTimeline(container, reclaimCase, () => render(container));

  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    const profile = getState().currentProfile;
    downloadBlob(await buildLetter(profile), letterFileName(profile, reclaimCase), "application/pdf");
  });

  container.querySelector('[data-action="download"]').addEventListener("click", (e) => {
    handleDownload(container, e.currentTarget);
  });

  // Vorschau = befülltes PDF in neuem Tab, ohne es als "erzeugt" zu vermerken.
  container.querySelector('[data-action="preview"]').addEventListener("click", () => {
    const { currentProfile: profile } = getState();
    openPdfPreview(() => buildCertificate(profile, reclaimCase));
  });

  container.querySelector('[data-action="letter-preview"]').addEventListener("click", () => {
    openPdfPreview(() => buildLetter(getState().currentProfile));
  });

  bindPausePanel(container, reclaimCase);
}

async function handleDownload(container, btn) {
  const { currentCase: reclaimCase, currentProfile: profile } = getState();
  if (!reclaimCase || !profile) return;

  const statusEl = container.querySelector("#download-status");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  statusEl.innerHTML = renderDownloadStatusHtml("loading");

  try {
    const filledBytes = await buildCertificate(profile, reclaimCase);
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

    // Neu rendern, damit die Zeitleiste "Formular erstellt" zeigt.
    render(container);
    container.querySelector("#download-status").innerHTML = renderDownloadStatusHtml("success", { fileName, generatedAt });
  } catch (err) {
    console.error("[dkCase] Formularerstellung fehlgeschlagen:", err);
    statusEl.innerHTML = renderDownloadStatusHtml("error", { message: err.message });
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

/** @param {HTMLElement} container @param {{ caseId: string }} params */
export function mount(container, params) {
  // params.caseId wird nicht direkt gebraucht: der Router hat vor dem Mount
  // bereits ensureCaseSelected(params.caseId) aufgerufen, currentCase/currentProfile
  // im Store sind zu diesem Zeitpunkt schon konsistent gesetzt.
  render(container);
}
