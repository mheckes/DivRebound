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

/**
 * Bearbeitungsstand sichern: Nutzer entscheidet selbst zwischen Passwortschutz
 * (empfohlen) und einem unverschlüsselten Export ohne Passphrase - manche
 * vergessen ein selbst vergebenes Passwort leicht, und anders als bei einem
 * Online-Konto gibt es hier keine "Passwort vergessen"-Wiederherstellung.
 * @returns {Promise<{ encrypt: true, passphrase: string } | { encrypt: false } | null>} null bei Abbruch
 */
export function openExportOptionsModal() {
  return new Promise((resolve) => {
    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">Bearbeitung sichern</h2>
      <label class="wizard-option selected" style="margin-bottom:14px;">
        <input type="checkbox" id="encrypt-toggle" checked>
        <span>Mit Passwort schützen (empfohlen)</span>
      </label>

      <div id="encrypt-fields">
        <p class="dr-modal-hint">Mit dieser Passphrase wird die Datei verschlüsselt (mind. ${MIN_PASSPHRASE_LENGTH} Zeichen). Ohne sie ist die Datei später nicht mehr entschlüsselbar – gut aufbewahren, z.B. in einem Passwort-Manager.</p>
        <input type="password" class="field-input dr-modal-input" autocomplete="off" placeholder="Passphrase" />
      </div>
      <div id="plain-warning" class="info-banner" style="display:none;margin-top:4px;">
        <span class="icon">⚠</span>
        <div>Ohne Passwort ist die Datei für jeden lesbar, der Zugriff darauf bekommt (z.B. bei Cloud-Sync, als E-Mail-Anhang oder bei Verlust des Geräts). Sie enthält Name, Adresse, Geburtsdatum, Steuer-ID und Bankverbindung im Klartext.</div>
      </div>

      <p class="field-error dr-modal-error" hidden></p>
      <div class="dr-modal-actions">
        <button class="btn-secondary dr-modal-cancel">Abbrechen</button>
        <button class="btn-primary dr-modal-confirm">Herunterladen</button>
      </div>
    `);

    const toggle = overlay.querySelector("#encrypt-toggle");
    const encryptFields = overlay.querySelector("#encrypt-fields");
    const plainWarning = overlay.querySelector("#plain-warning");
    const input = overlay.querySelector(".dr-modal-input");
    const error = overlay.querySelector(".dr-modal-error");
    input.focus();

    toggle.addEventListener("change", () => {
      encryptFields.style.display = toggle.checked ? "" : "none";
      plainWarning.style.display = toggle.checked ? "none" : "";
      error.hidden = true;
      if (toggle.checked) input.focus();
    });

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector(".dr-modal-cancel").addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });
    overlay.querySelector(".dr-modal-confirm").addEventListener("click", () => {
      if (!toggle.checked) {
        close({ encrypt: false });
        return;
      }
      const value = input.value;
      if (value.length < MIN_PASSPHRASE_LENGTH) {
        error.textContent = `Mindestens ${MIN_PASSPHRASE_LENGTH} Zeichen nötig.`;
        error.hidden = false;
        return;
      }
      close({ encrypt: true, passphrase: value });
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") overlay.querySelector(".dr-modal-confirm").click();
      if (e.key === "Escape") close(null);
    });
  });
}

/**
 * @param {string} title
 * @param {string} message
 * @param {{ confirmLabel?: string, cancelLabel?: string, danger?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function openConfirmModal(title, message, options = {}) {
  const { confirmLabel = "Bestätigen", cancelLabel = "Abbrechen", danger = false } = options;
  return new Promise((resolve) => {
    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">${title}</h2>
      <p class="dr-modal-hint">${message}</p>
      <div class="dr-modal-actions">
        <button class="btn-secondary dr-modal-cancel">${cancelLabel}</button>
        <button class="${danger ? "btn-danger" : "btn-primary"} dr-modal-confirm">${confirmLabel}</button>
      </div>
    `);
    function close(result) {
      overlay.remove();
      resolve(result);
    }
    overlay.querySelector(".dr-modal-cancel").addEventListener("click", () => close(false));
    overlay.querySelector(".dr-modal-confirm").addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
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
