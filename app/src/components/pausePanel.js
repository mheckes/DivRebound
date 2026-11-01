// "Bearbeitung pausiert" - dezenter Hinweis mit "Bearbeitungsstand speichern"
// an allen Stellen, an denen der Ablauf in der Praxis eine Pause hat:
//  - "taxOffice": Warten auf die Bestätigung durch das Finanzamt
//    (DK Schritt 4, CH Schritt 5, IT Schritt 4)
//  - "payout": Warten auf die Auszahlung nach dem Einreichen
//    (DK Schritt 5/6, CH Schritt 6/7, IT Schritt 5/6)
//  - "done": letzter Schritt, Erstattung eingetragen (Endstand sichern)
// Gespeichert wird wie mit dem Button in der Seitenleiste: Profil, alle Fälle
// und der Wertpapierbestand (Schweiz).

import { getState } from "../store/store.js";
import * as caseRepo from "../db/caseRepo.js";
import * as transactionRepo from "../db/transactionRepo.js";
import { exportEncrypted, exportPlain, triggerJsonDownload } from "../crypto/exportImport.js";
import { openExportOptionsModal } from "./modal.js";

const COUNTRY_FILE = { DK: "Daenemark", CH: "Schweiz", IT: "Italien" };
const AUTHORITY = { DK: "SKAT", CH: "die Eidgenössische Steuerverwaltung", IT: "die Agenzia delle Entrate" };

const NOTES = {
  taxOffice: { label: "Bearbeitung pausiert", text: () => "Wartet auf die Bestätigung durch das Finanzamt (meist 2–3 Wochen)." },
  payout: { label: "Bearbeitung pausiert", text: (c) => `Jetzt ist ${AUTHORITY[c.targetCountry]} am Zug – die Auszahlung dauert meist mehrere Monate.` },
  // letzter Schritt, Erstattung eingetragen: Endstand aufbewahren
  done: { label: "Abgeschlossen", text: () => "Erstattung erhalten. Bearbeitungsstand speichern, um alles aufzubewahren." },
};

/** @param {"taxOffice"|"payout"|"done"} kind */
export function pausePanelHtml(reclaimCase, kind) {
  const note = NOTES[kind];
  return `
    <div class="pause-note">
      <span class="pause-note-text"><b>${note.label}:</b> ${note.text(reclaimCase)}</span>
      <button class="btn-secondary btn-small" data-action="save-state" type="button">💾 Bearbeitungsstand speichern</button>
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
