// "Bearbeitung pausiert" - dezenter Hinweis mit "Bearbeitungsstand speichern"
// an allen Stellen, an denen der Ablauf in der Praxis eine Pause hat:
//  - "taxOffice": Warten auf die Bestätigung durch das Finanzamt
//    (DK Schritt 4, CH Schritt 5, IT Schritt 4)
//  - "payout": Warten auf die Auszahlung nach dem Einreichen
//    (DK Schritt 6/7, CH Schritt 6/7, IT Schritt 5/6)
//  - "done": letzter Schritt, Erstattung eingetragen (Endstand sichern)
// Gespeichert wird wie mit dem Button in der Seitenleiste: Profil, alle Fälle
// und der Wertpapierbestand (Schweiz).

import { getState } from "../store/store.js";
import * as caseRepo from "../db/caseRepo.js";
import * as transactionRepo from "../db/transactionRepo.js";
import { exportEncrypted, exportPlain, triggerJsonDownload } from "../crypto/exportImport.js";
import { openExportOptionsModal } from "./modal.js";
import { pauseHtml } from "./flow.js";

const COUNTRY_FILE = { DK: "Daenemark", CH: "Schweiz", IT: "Italien", SE: "Schweden" };
const AUTHORITY = { DK: "SKAT", CH: "die Eidgenössische Steuerverwaltung", IT: "die Agenzia delle Entrate", SE: "Skatteverket" };

const NOTES = {
  taxOffice: { label: "Bearbeitung pausiert", text: () => "Wartet auf die Bestätigung durch das Finanzamt (meist 2–3 Wochen)." },
  payout: {
    label: "Bearbeitung pausiert",
    text: (c) =>
      c.targetCountry === "CH"
        ? "Jetzt ist die Eidgenössische Steuerverwaltung am Zug. Die Auszahlung dauert meist mehrere Wochen in der Schweiz."
        : `Jetzt ist ${AUTHORITY[c.targetCountry]} am Zug – die Auszahlung dauert meist mehrere Monate.`,
  },
  // letzter Schritt, Erstattung eingetragen: Endstand aufbewahren
  done: { label: "Abgeschlossen", text: () => "Erstattung erhalten. Sichere den Endstand, um alles aufzubewahren." },
};

/** @param {"taxOffice"|"payout"|"done"} kind - gleiche Pause-Komponente wie im Finanzamt-Schritt */
export function pausePanelHtml(reclaimCase, kind) {
  const note = NOTES[kind];
  return pauseHtml({
    icon: kind === "done" ? "✓" : "❚❚",
    title: `${note.label}.`,
    text: note.text(reclaimCase),
    actionsHtml: `<button class="btn-secondary btn-small" data-action="save-state" type="button">💾 Sicherung speichern</button>`,
  });
}

/**
 * Ende eines Einreichen-Schritts (Stand 2.1, gleich in allen Ländern):
 * vorher Pause-Komponente mit "✓ Ist abgeschickt" ([data-action="mark-mailed"]),
 * danach "Antrag eingereicht" und die Pause bis zur Auszahlung.
 * @param {{ submittedAt?: string, doneSub: string, question?: string, actionLabel?: string }} options
 */
export function submitEndHtml(reclaimCase, { submittedAt, doneSub, question = "Abgeschickt? Dann ist dein Antrag eingereicht.", actionLabel = "✓ Ist abgeschickt" }) {
  if (!submittedAt) {
    return pauseHtml({
      title: question,
      text: "Auf der Übersicht siehst du danach, wie lange es schon dauert.",
      actionsHtml: `<button class="btn-primary btn-small" data-action="mark-mailed" type="button">${actionLabel}</button>`,
    });
  }
  return `
    <div class="done-banner ch-done-banner">
      <div class="done-icon">✓</div>
      <div>
        <div class="done-title">Antrag eingereicht</div>
        <div class="done-sub">${doneSub}</div>
      </div>
    </div>
    ${pausePanelHtml(reclaimCase, "payout")}`;
}

/** Navigation am Ende des Einreichens: Zurück, und "Zur Übersicht" (primär, sobald eingereicht) */
export function submitNavHtml(submitted) {
  return `
    <div class="ch-step-nav">
      <button class="btn-secondary" data-step-back type="button">← Zurück</button>
      <a class="${submitted ? "btn-primary" : "btn-secondary"}" href="#/home">Zur Übersicht</a>
    </div>`;
}

export function bindPausePanel(container, reclaimCase) {
  container.querySelector('[data-action="save-state"]')?.addEventListener("click", async () => {
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const profile = getState().currentProfile;
    const payload = {
      investorProfiles: [profile],
      reclaimCases: await caseRepo.getByProfileId(profile.profileId),
      transactions: await transactionRepo.getByProfileId(profile.profileId),
    };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    const date = new Date().toISOString().slice(0, 10);
    triggerJsonDownload(fileJson, `DivRebound_${COUNTRY_FILE[reclaimCase.targetCountry] ?? reclaimCase.targetCountry}_${date}.divrebound.json`);
  });
}
