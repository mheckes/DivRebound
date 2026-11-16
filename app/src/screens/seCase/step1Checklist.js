// Schweden, Überblick "So läuft es ab" (#/se/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. REQUIRED_ITEMS: Pflichtangaben für das Formular
// „SKV 3740“, abgefragt im Schritt "Deine Angaben" (step3MissingData.js).

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./seShared.js";

export const REQUIRED_ITEMS = ["name", "address", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    reclaimCase,
    country: "SE",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: ["Abrechnungen auslesen", "SKV 3740 ausfüllen", "Anschreiben und Begleitbrief"],
    youDo: ["Ans Finanzamt schicken", "Formular unterschreiben", "Nach Schweden schicken"],
    prepare: "Dividendenabrechnungen deiner schwedischen Aktien als PDF, aus den letzten fünf Jahren.",
  });
  bindStepNav(container, reclaimCase, 1);
}
