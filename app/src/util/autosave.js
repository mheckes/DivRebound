// Automatisches Speichern von Profilfeldern (docs/konzept-schweiz.md §2c):
// - beim Verlassen eines Felds ("change") mit Meldung "✓ … gespeichert · Rückgängig"
// - zusätzlich still während des Tippens (verzögert), damit beim Schließen des
//   Tabs nichts verloren geht
// - ungültige Werte werden nicht gespeichert; das Feld zeigt den Fehler, und
//   die App warnt beim Verlassen der Seite (siehe hasInvalidInput / main.js)
// - der bearbeitete Bereich wird danach NICHT neu gerendert (sonst springt der
//   Fokus weg), nur Optik von Feld und Beschriftung wird angepasst.
//
// Eingabefelder brauchen nur data-field="<key aus PROFILE_FIELDS>" und
// optional ein <span class="field-error" data-error-for="<key>"> daneben.

import { setState } from "../store/store.js";
import * as profileRepo from "../db/profileRepo.js";
import { PROFILE_FIELDS } from "./profileFields.js";
import { confirmedFieldClasses } from "./fieldDisplay.js";
import { showToast } from "../components/toast.js";

const TYPING_DELAY_MS = 800;

/** key -> Bezeichnung aller Felder mit ungültiger, nicht gespeicherter Eingabe */
const invalidFields = new Map();

export function hasInvalidInput() {
  return invalidFields.size > 0;
}

export function invalidFieldLabels() {
  return [...invalidFields.values()];
}

export function clearInvalidInput() {
  invalidFields.clear();
}

function fieldKey(target) {
  const key = target?.dataset?.field;
  return key && PROFILE_FIELDS[key] ? key : null;
}

function errorElement(container, input, key) {
  return (
    input.closest(".field-row")?.querySelector(`[data-error-for="${key}"]`) ??
    container.querySelector(`[data-error-for="${key}"]`)
  );
}

/** Gefülltes Feld wirkt wie Text, leeres wie Eingabefeld (util/fieldDisplay.js). */
function refreshFieldLook(input, value) {
  const { labelClass, inputClass } = confirmedFieldClasses(value);
  input.classList.remove("field-input", "confirmed-input");
  input.classList.add(inputClass);
  const label = input.closest(".field-row")?.querySelector("label");
  if (label) {
    label.classList.remove("field-label", "confirmed-label");
    label.classList.add(labelClass);
  }
}

/**
 * @param {HTMLElement} container
 * @param {{ getProfile: () => InvestorProfile, onSaved?: (profile: InvestorProfile, key: string) => void }} options
 * @returns {() => void} Aufräumfunktion (speichert noch ausstehende Eingaben)
 */
export function bindProfileAutosave(container, { getProfile, onSaved }) {
  const valueAtFocus = new WeakMap();
  const typingTimers = new Map();
  let queue = Promise.resolve();

  function showError(input, key, message) {
    input.classList.add("is-invalid");
    const el = errorElement(container, input, key);
    if (el) {
      el.textContent = `${message} – nicht gespeichert.`;
      el.hidden = false;
    }
  }

  function clearError(input, key) {
    input.classList.remove("is-invalid");
    const el = errorElement(container, input, key);
    if (el) {
      el.textContent = "";
      el.hidden = true;
    }
  }

  async function persist(key, value) {
    const updated = structuredClone(getProfile());
    PROFILE_FIELDS[key].write(updated, value);
    await profileRepo.put(updated);
    setState({ currentProfile: updated });
    onSaved?.(updated, key);
  }

  async function doSave(input, key, { silent }) {
    const spec = PROFILE_FIELDS[key];
    const value = input.value.trim();
    const verdict = value && spec.validate ? spec.validate(value, getProfile()) : true;
    if (verdict !== true) {
      invalidFields.set(key, spec.label);
      // Während des Tippens noch nicht rot markieren - erst beim Verlassen.
      if (!silent) showError(input, key, verdict);
      return;
    }
    invalidFields.delete(key);
    clearError(input, key);

    const before = spec.read(getProfile());
    if (value !== before) await persist(key, value);
    refreshFieldLook(input, value);

    if (silent) return;
    const original = valueAtFocus.has(input) ? valueAtFocus.get(input) : before;
    valueAtFocus.set(input, value);
    if (original !== value) {
      showToast(`✓ ${spec.label} gespeichert`, {
        actionLabel: "Rückgängig",
        onAction: () => undo(input, key, original),
      });
    }
  }

  function save(input, key, options) {
    queue = queue.then(() => doSave(input, key, options)).catch((err) => {
      console.error("[autosave] Speichern fehlgeschlagen:", err);
      showToast(`✕ ${PROFILE_FIELDS[key].label} konnte nicht gespeichert werden`);
    });
    return queue;
  }

  function undo(input, key, original) {
    queue = queue.then(async () => {
      await persist(key, original);
      invalidFields.delete(key);
      if (input.isConnected) {
        input.value = original;
        clearError(input, key);
        refreshFieldLook(input, original);
      }
      valueAtFocus.set(input, original);
      showToast(`${PROFILE_FIELDS[key].label} zurückgesetzt`);
    });
  }

  function onFocusIn(e) {
    const key = fieldKey(e.target);
    if (key) valueAtFocus.set(e.target, PROFILE_FIELDS[key].read(getProfile()));
  }

  function onInput(e) {
    const key = fieldKey(e.target);
    if (!key) return;
    clearTimeout(typingTimers.get(e.target));
    typingTimers.set(
      e.target,
      setTimeout(() => {
        typingTimers.delete(e.target);
        save(e.target, key, { silent: true });
      }, TYPING_DELAY_MS)
    );
  }

  function onChange(e) {
    const key = fieldKey(e.target);
    if (!key) return;
    clearTimeout(typingTimers.get(e.target));
    typingTimers.delete(e.target);
    save(e.target, key, { silent: false });
  }

  container.addEventListener("focusin", onFocusIn);
  container.addEventListener("input", onInput);
  container.addEventListener("change", onChange);

  return () => {
    container.removeEventListener("focusin", onFocusIn);
    container.removeEventListener("input", onInput);
    container.removeEventListener("change", onChange);
    for (const [input, timer] of typingTimers) {
      clearTimeout(timer);
      const key = fieldKey(input);
      if (key) save(input, key, { silent: true });
    }
    typingTimers.clear();
  };
}
