// Schweiz, Überblick "So läuft es ab" (#/ch/:caseId/1) - gemeinsamer Baustein
// screens/shared/overview.js. Die persönlichen Angaben fragt der Schritt
// "Deine Angaben" ab (stepData.js).

import { getState } from "../../store/store.js";
import { renderOverview } from "../shared/overview.js";
import { corridor, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

export async function mount(container, reclaimCase) {
  renderOverview(container, getState().currentProfile, {
    reclaimCase,
    country: "CH",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Wertpapierbestand" }),
    does: ["Bestand berechnen", "Mit Tax Vouchern abgleichen", "Spickzettel fürs ePortal"],
    youDo: ["Angaben ins ePortal übertragen", "Ans Finanzamt schicken", "Bestätigten Antrag hochladen"],
    prepare: `Kauf- und Verkaufsabrechnungen ab dem ersten Kauf, die Tax Voucher deiner Bank und einen Zugang zum <a href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal ↗</a>.`,
  });
  bindStepNav(container, reclaimCase, 1);
}
