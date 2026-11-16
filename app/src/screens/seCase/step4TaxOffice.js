// Schweden, Schritt 4 "Formular & Finanzamt" - gleicher Aufbau wie Italien:
// Zeitleiste, Formular als kompakte Zeile mit Vorschau und PDF, wer wo
// unterschreibt, Anschreiben ans Finanzamt, nächste Schritte, "Bearbeitung
// pausiert". Alle Unternehmen stehen in einer Tabelle (lib/sweden.js formsFor).

import { taxOfficeWaysHtml, bindTaxOfficeWays, elsterMessageText, taxOfficePauseHtml, taxOfficeNavHtml, bindTaxOfficePause } from "../../components/flow.js";
import { getState } from "../../store/store.js";
import { fillSkv3740, fillAllSkv3740, skv3740FileName } from "../../lib/fillSkv3740.js";
import { buildTaxOfficeLetter } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { showToast } from "../../components/toast.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { formTotals, groupByIssuer } from "../../lib/sweden.js";
import {
  esc, saveCase, caseSummary, yearRangeLabel, formatSekDe, approxEur, stepHeader, stepNavHtml, bindStepNav, goToStep,
  timelineHtml, bindTimeline, downloadBlob, loadFormTemplate,
} from "./seShared.js";

const STATUS_ORDER = ["draft", "residency_form_generated", "awaiting_tax_office", "ready_for_mailing", "submitted"];

const allFormsFileName = (profile, years) => `SKV3740_Schweden_${profile.residence.lastName || "DivRebound"}_${yearRangeLabel(years)}.pdf`;

function letterFileName(profile, years) {
  return `Anschreiben_Finanzamt_${profile.residence.lastName || "DivRebound"}_Schweden_${yearRangeLabel(years)}.pdf`;
}

function buildLetter(profile) {
  return buildTaxOfficeLetter(profile, { reference: "Formular „SKV 3740“ zur Erstattung schwedischer Quellensteuer auf Dividenden (Art. 10 DBA Deutschland–Schweden), Bestätigung der Ansässigkeit unten auf Seite 2" });
}

function render(container, reclaimCase) {
  const profile = getState().currentProfile;
  const { forms, eligible, years, total } = caseSummary(reclaimCase);
  const taxOffice = normalizeTaxOffice(profile.residence.taxOffice);
  const taxOfficeComplete = Boolean(taxOffice.name && taxOffice.street && taxOffice.postalCode && taxOffice.city);

  const formRows = forms
    .map((f, i) => {
      const totals = formTotals(f.rows);
      const companies = groupByIssuer(f.rows).map((g) => g.issuerName || g.isin).join(", ");
      return `
        <div class="doc-item">
          <div>
            <div class="doc-title">SKV 3740${f.of > 1 ? ` · Teil ${f.part} von ${f.of}` : ""}</div>
            <div class="doc-sub">${esc(companies)} · ${f.rows.length} ${f.rows.length === 1 ? "Ausschüttung" : "Ausschüttungen"} · Erstattung ${formatSekDe(totals.refund)} (${approxEur(totals.refund)})</div>
            <div class="doc-file">${esc(skv3740FileName(profile, f))}</div>
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
    <p class="ch-lead">Dein Finanzamt bestätigt auf Seite 2 des Formulars „SKV 3740“, dass du in Deutschland wohnst.</p>

    ${
      forms.length
        ? `
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Formular herunterladen</span><span class="ch-head-sub">${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · je 2 Seiten · ${eligible.length} ${eligible.length === 1 ? "Ausschüttung" : "Ausschüttungen"} · ${formatSekDe(total)}</span></div>
      ${formRows}
      ${
        forms.length > 1
          ? `<div class="doc-item se-doc-all">
              <div>
                <div class="doc-title">Alle Formulare in einem PDF</div>
                <div class="doc-sub">zum Ausdrucken · ${forms.length * 2} Seiten</div>
                <div class="doc-file">${esc(allFormsFileName(profile, years))}</div>
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
      signText: "Formular ausdrucken und unten auf Seite 1 unterschreiben (Feld „Sökandens signatur“)",
      confirmText: "Das Finanzamt bestätigt unten auf Seite 2 (Stempel, Unterschrift und Anschrift) und schickt das Formular zurück",
      letterButtonsHtml: `<button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${taxOfficeComplete ? "" : "disabled"}>👁 Vorschau</button><button class="btn-secondary btn-small" data-action="letter" type="button" ${taxOfficeComplete ? "" : "disabled"}>⬇ Herunterladen</button>${taxOfficeComplete ? "" : ` <a href="#" data-go-step="3">Anschrift des Finanzamts ergänzen</a>`}`,
    })}

    ${taxOfficePauseHtml(reclaimCase)}

    ${taxOfficeNavHtml(reclaimCase, "Formular ist zurück")}
    </div>`;

  bindStepNav(container, reclaimCase, 4);
  bindTimeline(container, reclaimCase, () => render(container, reclaimCase));
  bindPausePanel(container, reclaimCase);
  bindTaxOfficeWays(container, () => elsterMessageText(getState().currentProfile, { reference: "Formular „SKV 3740“ zur Erstattung schwedischer Quellensteuer auf Dividenden (Art. 10 DBA Deutschland–Schweden), Bestätigung der Ansässigkeit unten auf Seite 2", originalRequired: true }), reclaimCase);
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
      openPdfPreview(async () => fillSkv3740(await loadFormTemplate(), getState().currentProfile, form));
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
    const template = await loadFormTemplate();
    let bytes;
    let fileName;
    if (which === "all") {
      bytes = await fillAllSkv3740(template, profile, forms);
      fileName = allFormsFileName(profile, years);
    } else {
      const form = forms[Number(which)];
      bytes = await fillSkv3740(template, profile, form);
      fileName = skv3740FileName(profile, form);
    }
    downloadBlob(bytes, fileName);

    reclaimCase.generatedDocuments = [...reclaimCase.generatedDocuments, { type: "se_skv3740", fileName, generatedAt: new Date().toISOString() }];
    if (STATUS_ORDER.indexOf(reclaimCase.status) < STATUS_ORDER.indexOf("awaiting_tax_office")) reclaimCase.status = "awaiting_tax_office";
    await saveCase(reclaimCase);
    render(container, reclaimCase);
    showToast(`✓ „${fileName}“ heruntergeladen`);
  } catch (err) {
    console.error("[seCase] SKV 3740 fehlgeschlagen:", err);
    status.innerHTML = `<div class="download-status error">✕ Herunterladen fehlgeschlagen: ${esc(err.message)}. Bitte erneut versuchen.</div>`;
  }
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
