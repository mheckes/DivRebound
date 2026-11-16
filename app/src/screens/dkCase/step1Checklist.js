// Dänemark, Überblick "So läuft es ab" (#/dk/:caseId/1) - gemeinsamer
// Baustein screens/shared/overview.js. Früher stand hier die Checkliste
// "Unterlagen prüfen"; die persönlichen Angaben fragt jetzt "Deine Angaben" ab.

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./dkShared.js";

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    reclaimCase,
    country: "DK",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: ["Abrechnungen auslesen", "Bescheinigung 02.050 ausfüllen", "Spickzettel für SKAT"],
    youDo: ["Ans Finanzamt schicken", "Werte zu SKAT kopieren", "Bescheinigung hochladen"],
    prepare: "Dividendenabrechnungen deiner dänischen Aktien als PDF, höchstens 3 Jahre alt.",
  });
  bindStepNav(container, reclaimCase, 1);
}
