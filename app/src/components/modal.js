// Minimale, promise-basierte Modal-Komponente. Ersetzt die alert()/prompt()-
// Platzhalter aus den Mockups durch echte UI (Passphrase-Eingabe etc.).

import { MIN_PASSPHRASE_LENGTH } from "../crypto/exportImport.js";

function mountOverlay(innerHtml) {
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `<div class="dr-modal">${innerHtml}</div>`;
  document.getElementById("divrebound-app").appendChild(overlay);
  return overlay;
}

/**
 * @param {"export"|"import"} mode
 * @returns {Promise<string|null>} Passphrase, oder null bei Abbruch
 */
export function openPassphraseModal(mode) {
  return new Promise((resolve) => {
    const title =
      mode === "export"
        ? "Bearbeitung sichern"
        : "Bearbeitung laden";
    const hint =
      mode === "export"
        ? `Mit dieser Passphrase wird die Datei verschlüsselt (mind. ${MIN_PASSPHRASE_LENGTH} Zeichen). Ohne sie ist die Datei später nicht mehr entschlüsselbar – gut aufbewahren.`
        : "Gib die Passphrase ein, mit der diese Datei gesichert wurde.";

    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">${title}</h2>
      <p class="dr-modal-hint">${hint}</p>
      <input type="password" class="field-input dr-modal-input" autocomplete="off" />
      <p class="field-error dr-modal-error" hidden></p>
      <div class="dr-modal-actions">
        <button class="btn-secondary dr-modal-cancel">Abbrechen</button>
        <button class="btn-primary dr-modal-confirm">Bestätigen</button>
      </div>
    `);

    const input = overlay.querySelector(".dr-modal-input");
    const error = overlay.querySelector(".dr-modal-error");
    input.focus();

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector(".dr-modal-cancel").addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector(".dr-modal-confirm").addEventListener("click", () => {
      const value = input.value;
      if (mode === "export" && value.length < MIN_PASSPHRASE_LENGTH) {
        error.textContent = `Mindestens ${MIN_PASSPHRASE_LENGTH} Zeichen nötig.`;
        error.hidden = false;
        return;
      }
      if (!value) {
        error.textContent = "Bitte Passphrase eingeben.";
        error.hidden = false;
        return;
      }
      close(value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlay.querySelector(".dr-modal-confirm").click();
      if (e.key === "Escape") close(null);
    });
  });
}

export function openInfoModal(title, message) {
  return new Promise((resolve) => {
    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">${title}</h2>
      <p class="dr-modal-hint">${message}</p>
      <div class="dr-modal-actions">
        <button class="btn-primary dr-modal-ok">OK</button>
      </div>
    `);
    function close() {
      overlay.remove();
      resolve();
    }
    overlay.querySelector(".dr-modal-ok").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  });
}
