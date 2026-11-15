// Schweden, Überblick "So läuft es ab" (#/se/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. REQUIRED_ITEMS: Pflichtangaben für das Formular
// „SKV 3740“, abgefragt im Schritt "Deine Angaben" (step3MissingData.js).

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./seShared.js";

export const REQUIRED_ITEMS = ["name", "address", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    country: "SE",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: [
      "Abrechnungen auslesen, Steuersatz prüfen",
      "Formular „SKV 3740“ ausfüllen",
      "Anschreiben ans Finanzamt",
      "Begleitschreiben nach Schweden (Englisch)",
    ],
    youDo: [
      "Formular „SKV 3740“ ausdrucken und unterschreiben",
      "An dein deutsches Finanzamt schicken",
      "Bestätigtes Formular mit Kopien der Abrechnungen an die schwedische Steuerbehörde senden",
    ],
    prepare: ["<b>Dividendenabrechnungen</b> deiner schwedischen Aktien als PDF (ISIN beginnt mit SE). Frist: fünf Jahre ab Ende des Kalenderjahres der Auszahlung"],
  });
  bindStepNav(container, reclaimCase, 1);
}
