// Italien, Schritt 1 "Unterlagen prüfen" - gleicher Baustein wie Dänemark und
// Schweiz (components/checklist.js). Profilfelder direkt bearbeitbar und
// automatisch gespeichert.

import {
  PROFILE_ITEM, profileRow, optionalProfileRow, textRow, updateChecklistSummary, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { isRefundable } from "../../lib/italy.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./itShared.js";

// Pflichtangaben für Form A (lib/fillFormA.js)
export const REQUIRED_ITEMS = ["name", "address", "birthDate", "birthPlace", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  const found = reclaimCase.distributions.filter((d) => isRefundable(d)).length;

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 1)}
    <p class="ch-lead">Die Erstattung der italienischen Quellensteuer läuft komplett auf Papier. DivRebound füllt für jedes italienische Unternehmen das offizielle Formular „Form A“ aus. Dein Finanzamt bestätigt es, danach schickst du es per Post nach Italien.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Checkliste</span><span class="count-pill" data-summary></span></div>

      <div class="ch-check-group">Formular</div>
      ${textRow("ok", "Form A", "DivRebound füllt das Papierformular der „Agenzia delle Entrate“ für dich aus.")}

      <div class="ch-check-group">Persönliche Daten</div>
      ${REQUIRED_ITEMS.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("")}
      ${optionalProfileRow(profile, PROFILE_ITEM.bankAddress)}
      ${AUTOSAVE_ROW}

      <div class="ch-check-group">Aus deinen Dividendenabrechnungen</div>
      ${
        found
          ? textRow("ok", "Dividendenabrechnungen", `${found} Ausschüttung${found === 1 ? "" : "en"} erfasst.`, `<span class="badge badge-extracted">Schritt 2</span>`)
          : textRow("later", "Dividendenabrechnungen", "Je eine pro Ausschüttung einer italienischen Aktie (ISIN beginnt mit IT), Zahltag höchstens 48 Monate zurück.", `<span class="badge badge-extracted">Schritt 2</span>`)
      }
    </div>

    <div class="ch-two-col">
      <div class="card"><div class="card-head"><span class="card-title">Das übernimmt DivRebound</span></div><div class="card-body"><ul class="ch-list">
        <li>Abrechnungen auslesen, Steuersatz prüfen</li>
        <li>Formular „Form A“ ausfüllen (eines pro Unternehmen)</li>
        <li>Anschreiben ans Finanzamt</li>
        <li>Begleitschreiben nach Italien (Englisch)</li>
      </ul></div></div>
      <div class="card"><div class="card-head"><span class="card-title">Das machst du selbst</span></div><div class="card-body"><ul class="ch-list">
        <li>Formular „Form A“ ausdrucken und zweimal unterschreiben</li>
        <li>Per Post ans Finanzamt schicken</li>
        <li>Bestätigtes Formular „Form A“ mit Kopien der Abrechnungen nach Italien senden</li>
      </ul></div></div>
    </div>

    ${stepNavHtml(1)}
    </div>`;

  updateChecklistSummary(container);
  bindStepNav(container, reclaimCase, 1);
  return bindChecklistAutosave(container);
}
