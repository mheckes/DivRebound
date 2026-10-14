// Schritt-für-Schritt-Anleitungen für das ESTV-ePortal. VORERST PLATZHALTER
// (docs/konzept-schweiz.md §1): Gerüst mit Schritten und Flächen für
// Screenshots; Texte und Bilder folgen.

import { corridors } from "../config/corridors.js";

const GUIDES = {
  account: {
    title: "Anleitung: Zugang zum ePortal",
    steps: [
      ["Konto anlegen", "Auf eportal.admin.ch „Anmelden“ wählen und ein neues Konto erstellen."],
      ["Anmeldung absichern", "Zweiten Faktor einrichten, z.B. mit einer Authenticator-App."],
      ["Im ePortal anmelden", "Mit dem neuen Konto anmelden."],
      ["Service „Verrechnungssteuer“ hinzufügen", "Kachel „Verrechnungssteuer – Rückerstattung für in Deutschland ansässige Personen“ auswählen."],
    ],
  },
  upload: {
    title: "Anleitung: Hochladen im ePortal",
    steps: [
      ["Antragsübersicht öffnen", "Kachel „Verrechnungssteuer“ → Liste Ihrer Anträge."],
      ["Antrag auswählen", "Den Antrag mit Ihrer Antrags-ID öffnen."],
      ["Bestätigten Antrag hochladen", "Das eingescannte PDF hochladen und absenden."],
    ],
  },
};

/** @param {"account" | "upload"} key */
export function openGuideModal(key) {
  const guide = GUIDES[key];
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `
    <div class="dr-modal guide-modal">
      <h2 class="dr-modal-title">${guide.title}</h2>
      <div class="guide-placeholder">🚧 <b>Platzhalter</b> – Texte und Screenshots folgen.</div>
      ${guide.steps
        .map(
          ([title, text], i) => `
        <div class="guide-step">
          <span class="guide-step-num">${i + 1}</span>
          <div>
            <div class="guide-step-title">${title}</div>
            <div class="guide-step-text">${text}</div>
            <div class="guide-step-shot">Screenshot</div>
          </div>
        </div>`
        )
        .join("")}
      <div class="dr-modal-actions">
        <a class="btn-secondary" href="${corridors.CH.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>
        <button class="btn-primary guide-close" type="button">Schließen</button>
      </div>
    </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".guide-close").addEventListener("click", close);
  document.getElementById("divrebound-app").appendChild(overlay);
}
