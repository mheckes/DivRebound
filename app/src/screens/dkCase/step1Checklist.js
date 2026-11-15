// Dänemark, Überblick "So läuft es ab" (#/dk/:caseId/1) - gemeinsamer
// Baustein screens/shared/overview.js. Früher stand hier die Checkliste
// "Unterlagen prüfen"; die persönlichen Angaben fragt jetzt "Deine Angaben" ab.

import { renderOverview } from "../shared/overview.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./dkShared.js";

export function mount(container, reclaimCase, profile) {
  renderOverview(container, profile, {
    country: "DK",
    headerHtml: stepHeader(reclaimCase, 1),
    navHtml: stepNavHtml(1, { nextLabel: "Los geht's: Abrechnungen hochladen" }),
    does: [
      "Abrechnungen auslesen, Erstattung berechnen",
      "Wohnsitzbescheinigung (Formular „02.050“) und Anschreiben ausfüllen",
      "Spickzettel für das Online-Formular der dänischen Steuerbehörde (SKAT)",
    ],
    youDo: [
      "Bescheinigung unterschreiben und an dein deutsches Finanzamt schicken, per ELSTER oder Post",
      "Werte ins dänische Online-Formular kopieren",
      "Gestempelte Bescheinigung dort hochladen",
    ],
    prepare: ["<b>Dividendenabrechnungen</b> deiner dänischen Aktien als PDF (ISIN beginnt mit DK), höchstens 3 Jahre alt"],
  });
  bindStepNav(container, reclaimCase, 1);
}
