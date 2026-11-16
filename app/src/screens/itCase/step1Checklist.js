// Italien, Überblick "So läuft es ab" (#/it/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. REQUIRED_ITEMS: Pflichtangaben für das Formular
// „Form A“, abgefragt im Schritt "Deine Angaben" (step3MissingData.js).

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./itShared.js";

export const REQUIRED_ITEMS = ["name", "address", "birthDate", "birthPlace", "tin", "taxNumber", "taxOffice", "bankName", "bank", "bic"];

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    reclaimCase,
    country: "IT",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: ["Abrechnungen auslesen", "Form A ausfüllen", "Anschreiben und Begleitbrief"],
    youDo: ["Ans Finanzamt schicken", "Formulare unterschreiben", "Per Post nach Italien"],
    prepare: "Dividendenabrechnungen deiner italienischen Aktien als PDF, höchstens 48 Monate alt.",
  });
  bindStepNav(container, reclaimCase, 1);
}
