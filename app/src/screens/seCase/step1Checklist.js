// Schweden, Schritt 1 "Unterlagen prüfen" - gleicher Baustein wie bei den
// anderen Ländern (components/checklist.js). Profilfelder direkt bearbeitbar
// und automatisch gespeichert.

import {
  PROFILE_ITEM, profileRow, optionalProfileRow, textRow, updateChecklistSummary, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { isRefundable } from "../../lib/sweden.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./seShared.js";

// Pflichtangaben für SKV 3740 (lib/fillSkv3740.js) und das Anschreiben ans Finanzamt
export const REQUIRED_ITEMS = ["name", "address", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  const found = reclaimCase.distributions.filter((d) => isRefundable(d)).length;

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 1)}
    <p class="ch-lead">Die Erstattung der schwedischen Quellensteuer läuft komplett auf Papier. DivRebound füllt das Formular „SKV 3740“ von Skatteverket für dich aus. Dein Finanzamt bestätigt darauf deine Ansässigkeit, danach schickst du es nach Schweden.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Checkliste</span><span class="count-pill" data-summary></span></div>

      <div class="ch-check-group">Formular</div>
      ${textRow("ok", "SKV 3740", "DivRebound füllt das Papierformular von Skatteverket für dich aus.")}

      <div class="ch-check-group">Persönliche Daten</div>
      ${REQUIRED_ITEMS.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("")}
      ${optionalProfileRow(profile, PROFILE_ITEM.bankAddress)}
      ${optionalProfileRow(profile, PROFILE_ITEM.contact)}
      ${AUTOSAVE_ROW}

      <div class="ch-check-group">Aus deinen Dividendenabrechnungen</div>
      ${
        found
          ? textRow("ok", "Dividendenabrechnungen", `${found} Ausschüttung${found === 1 ? "" : "en"} erfasst.`, `<span class="badge badge-extracted">Schritt 2</span>`)
          : textRow("later", "Dividendenabrechnungen", "Je eine pro Ausschüttung einer schwedischen Aktie (ISIN beginnt mit SE). Frist: fünf Jahre ab Ende des Kalenderjahres der Auszahlung.", `<span class="badge badge-extracted">Schritt 2</span>`)
      }
    </div>

    <div class="ch-two-col">
      <div class="card"><div class="card-head"><span class="card-title">Das übernimmt DivRebound</span></div><div class="card-body"><ul class="ch-list">
        <li>Abrechnungen auslesen, Steuersatz prüfen</li>
        <li>Formular „SKV 3740“ ausfüllen (alle Unternehmen in einer Tabelle)</li>
        <li>Anschreiben ans Finanzamt</li>
        <li>Begleitschreiben nach Schweden (Englisch)</li>
      </ul></div></div>
      <div class="card"><div class="card-head"><span class="card-title">Das machst du selbst</span></div><div class="card-body"><ul class="ch-list">
        <li>Formular „SKV 3740“ ausdrucken und unterschreiben</li>
        <li>Per Post ans Finanzamt schicken</li>
        <li>Bestätigtes Formular „SKV 3740“ mit Begleitschreiben und Kopien der Abrechnungen nach Schweden senden</li>
      </ul></div></div>
    </div>

    ${stepNavHtml(1)}
    </div>`;

  updateChecklistSummary(container);
  bindStepNav(container, reclaimCase, 1);
  return bindChecklistAutosave(container);
}
