// Schweiz, Überblick "So läuft es ab" (#/ch/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. Die persönlichen Angaben fragt der Schritt
// "Deine Angaben" ab (stepData.js).

import { getState } from "../../store/store.js";
import { renderOverview } from "../shared/overview.js";
import { corridor, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

export async function mount(container, reclaimCase) {
  renderOverview(container, getState().currentProfile, {
    country: "CH",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Wertpapierbestand" }),
    does: [
      "Bestand aus deinen Abrechnungen berechnen",
      "Abgleich mit den Tax Vouchern",
      "Spickzettel für das ePortal der Schweizer Steuerverwaltung",
      "Anschreiben ans Finanzamt",
    ],
    youDo: [
      "Im ePortal anmelden und die Angaben übertragen",
      "Antrag unterschreiben und an dein deutsches Finanzamt schicken, per ELSTER oder Post",
      "Bestätigten Antrag im ePortal hochladen",
    ],
    prepare: [
      "<b>Kauf- und Verkaufsabrechnungen</b> deiner Schweizer Aktien als PDF, lückenlos ab dem ersten Kauf",
      "<b>Tax Voucher</b> deiner Bank, einer pro Dividende. Sie kommen teils erst Wochen nach der Zahlung",
      `<b>Zugang zum ePortal</b> der Schweizer Steuerverwaltung, ein eigenes Konto mit Zwei-Faktor-Anmeldung. <a href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>`,
    ],
  });
  bindStepNav(container, reclaimCase, 1);
}
