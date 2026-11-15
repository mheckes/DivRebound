// Italien, Überblick "So läuft es ab" (#/it/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. REQUIRED_ITEMS: Pflichtangaben für das Formular
// „Form A“, abgefragt im Schritt "Deine Angaben" (step3MissingData.js).

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./itShared.js";

export const REQUIRED_ITEMS = ["name", "address", "birthDate", "birthPlace", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    country: "IT",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: [
      "Abrechnungen auslesen, Steuersatz prüfen",
      "Formular „Form A“ ausfüllen (eines pro Unternehmen)",
      "Anschreiben ans Finanzamt",
      "Begleitschreiben nach Italien (Englisch)",
    ],
    youDo: [
      "Formular „Form A“ ausdrucken und zweimal unterschreiben",
      "An dein deutsches Finanzamt schicken",
      "Bestätigtes Formular mit Kopien der Abrechnungen per Post nach Italien senden",
    ],
    prepare: ["<b>Dividendenabrechnungen</b> deiner italienischen Aktien als PDF (ISIN beginnt mit IT), Zahltag höchstens 48 Monate zurück"],
  });
  bindStepNav(container, reclaimCase, 1);
}
