// Italien, Schritt 4 "Formular & Finanzamt" - gleicher Aufbau wie Dänemark
// (screens/dkCase/step4TaxOffice.js): Zeitleiste, Formulare als kompakte Zeilen mit
// Vorschau und PDF, wer unterschreibt wo, Anschreiben, nächste Schritte,
// "Bearbeitung pausiert". Ein Form A je Unternehmen (lib/italy.js formsFor).

import { taxOfficeWaysHtml, bindTaxOfficeWays, elsterMessageText, taxOfficePauseHtml, taxOfficeNavHtml, bindTaxOfficePause } from "../../components/flow.js";
import { getState } from "../../store/store.js";
import { fillFormA, fillAllFormsA, formAFileName } from "../../lib/fillFormA.js";
import { buildTaxOfficeLetter } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { showToast } from "../../components/toast.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { refundFor } from "../../lib/italy.js";
import {
  esc, saveCase, caseSummary, yearRangeLabel, formatEurPlain, stepHeader, stepNavHtml, bindStepNav, goToStep,
  timelineHtml, bindTimeline, downloadBlob, loadFormATemplate,
} from "./itShared.js";

const STATUS_ORDER = ["draft", "residency_form_generated", "awaiting_tax_office", "ready_for_mailing", "submitted"];

function letterFileName(profile, years) {
  return `Anschreiben_Finanzamt_${profile.residence.lastName || "DivRebound"}_Italien_${yearRangeLabel(years)}.pdf`;
}

function buildLetter(profile) {
  return buildTaxOfficeLetter(profile, { reference: "Formular „Form A“ zur Erstattung italienischer Quellensteuer auf Dividenden (Art. 10 DBA Deutschland–Italien), Bestätigung auf Seite 5" });
}

function render(container, reclaimCase) {
  const profile = getState().currentProfile;
  const { forms, years, total } = caseSummary(reclaimCase);
  const taxOffice = normalizeTaxOffice(profile.residence.taxOffice);
  const taxOfficeComplete = Boolean(taxOffice.name && taxOffice.street && taxOffice.postalCode && taxOffice.city);

  const formRows = forms
    .map((f, i) => {
      const sum = f.rows.reduce((s, d) => s + refundFor(d).refund, 0);
      const formYears = [...new Set(f.rows.map((d) => d.paymentDate.slice(0, 4)))].join(", ");
      return `
        <div class="doc-item">
          <div>
            <div class="doc-title">${esc(f.issuerName || f.isin)}${f.of > 1 ? ` · Teil ${f.part} von ${f.of}` : ""}</div>
            <div class="doc-sub">${f.rows.length} ${f.rows.length === 1 ? "Ausschüttung" : "Ausschüttungen"} · ${f.rows.length === 1 ? "Steuerjahr" : "Steuerjahre"} ${esc(formYears)} · Erstattung ${formatEurPlain(sum)} €</div>
            <div class="doc-file">${esc(formAFileName(profile, f))}</div>
          </div>
          <div class="doc-actions">
            <button class="btn-secondary btn-small" data-form-preview="${i}" type="button">👁 Vorschau</button>
            <button class="btn-primary" data-form-download="${i}" type="button">⬇ Herunterladen</button>
          </div>
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 4)}
    <p class="ch-lead">Dein Finanzamt bestätigt auf Seite 5 jedes Formulars „Form A“, dass du in Deutschland wohnst.</p>

    ${
      forms.length
        ? `
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Formular herunterladen</span><span class="ch-head-sub">${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · je 5 Seiten · ${formatEurPlain(total)} €</span></div>
      ${formRows}
      ${
        forms.length > 1
          ? `<div class="doc-item it-doc-all">
              <div>
                <div class="doc-title">Alle Formulare in einem PDF</div>
                <div class="doc-sub">zum Ausdrucken · ${forms.length * 5} Seiten</div>
                <div class="doc-file">${esc(`FormA_Italien_${profile.residence.lastName || "DivRebound"}_${yearRangeLabel(years)}.pdf`)}</div>
              </div>
              <div class="doc-actions"><button class="btn-primary" data-form-download="all" type="button">⬇ Herunterladen</button></div>
            </div>`
          : ""
      }
      <div class="doc-status" id="download-status"></div>
    </div>`
        : `<div class="info-banner"><span class="icon">ℹ</span><div>Noch keine Ausschüttung ausgewählt. Bitte zuerst <a href="#" data-go-step="2">Abrechnungen hochladen</a>.</div></div>`
    }

    ${taxOfficeWaysHtml(profile, reclaimCase, {
      signText: "Formulare ausdrucken und auf Seite 3 und Seite 5 unterschreiben",
      confirmText: "Das Finanzamt bestätigt auf Seite 5 und schickt die Formulare zurück",
      letterButtonsHtml: `<button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${taxOfficeComplete ? "" : "disabled"}>👁 Vorschau</button><button class="btn-secondary btn-small" data-action="letter" type="button" ${taxOfficeComplete ? "" : "disabled"}>⬇ Herunterladen</button>${taxOfficeComplete ? "" : ` <a href="#" data-go-step="3">Anschrift des Finanzamts ergänzen</a>`}`,
    })}

    ${taxOfficePauseHtml(reclaimCase)}

    ${taxOfficeNavHtml(reclaimCase, "Formulare sind zurück")}
    </div>`;

  bindStepNav(container, reclaimCase, 4);
  bindTimeline(container, reclaimCase, () => render(container, reclaimCase));
  bindPausePanel(container, reclaimCase);
  bindTaxOfficeWays(container, () => elsterMessageText(getState().currentProfile, { reference: "Formular „Form A“ zur Erstattung italienischer Quellensteuer auf Dividenden (Art. 10 DBA Deutschland–Italien), Bestätigung auf Seite 5", originalRequired: true }), reclaimCase);
  bindTaxOfficePause(container, reclaimCase, () => render(container, reclaimCase));
  container.querySelectorAll("[data-go-step]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      goToStep(reclaimCase, Number(a.dataset.goStep));
    })
  );

  container.querySelectorAll("[data-form-preview]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const form = forms[Number(btn.dataset.formPreview)];
      openPdfPreview(async () => fillFormA(await loadFormATemplate(), getState().currentProfile, form));
    })
  );
  container.querySelectorAll("[data-form-download]").forEach((btn) =>
    btn.addEventListener("click", () => handleFormDownload(container, reclaimCase, forms, years, btn.dataset.formDownload))
  );
  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    const current = getState().currentProfile;
    downloadBlob(await buildLetter(current), letterFileName(current, years));
  });
  container.querySelector('[data-action="letter-preview"]').addEventListener("click", () => openPdfPreview(() => buildLetter(getState().currentProfile)));
}

async function handleFormDownload(container, reclaimCase, forms, years, which) {
  const profile = getState().currentProfile;
  const status = container.querySelector("#download-status");
  status.innerHTML = `<div class="download-status loading">⏳ Formular wird ausgefüllt …</div>`;
  try {
    const template = await loadFormATemplate();
    let bytes;
    let fileName;
    if (which === "all") {
      bytes = await fillAllFormsA(template, profile, forms);
      fileName = `FormA_Italien_${profile.residence.lastName || "DivRebound"}_${yearRangeLabel(years)}.pdf`;
    } else {
      const form = forms[Number(which)];
      bytes = await fillFormA(template, profile, form);
      fileName = formAFileName(profile, form);
    }
    downloadBlob(bytes, fileName);

    reclaimCase.generatedDocuments = [...reclaimCase.generatedDocuments, { type: "it_form_a", fileName, generatedAt: new Date().toISOString() }];
    if (STATUS_ORDER.indexOf(reclaimCase.status) < STATUS_ORDER.indexOf("awaiting_tax_office")) reclaimCase.status = "awaiting_tax_office";
    await saveCase(reclaimCase);
    render(container, reclaimCase);
    showToast(`✓ „${fileName}“ heruntergeladen`);
  } catch (err) {
    console.error("[itCase] Form A fehlgeschlagen:", err);
    status.innerHTML = `<div class="download-status error">✕ Herunterladen fehlgeschlagen: ${esc(err.message)}. Bitte erneut versuchen.</div>`;
  }
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
