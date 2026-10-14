// Gemeinsamer Baustein "Unterlagen prüfen" (docs/konzept-schweiz.md §2, §2a)
// für Schweiz und Dänemark. Keine eigene Datenhaltung: Profilfelder werden
// direkt bearbeitet und automatisch gespeichert (util/autosave.js), alle
// anderen Zeilen zeigen nur einen Zustand.

import { getState } from "../store/store.js";
import { PROFILE_FIELDS } from "../util/profileFields.js";
import { confirmedFieldClasses } from "../util/fieldDisplay.js";
import { bindProfileAutosave } from "../util/autosave.js";

const SYMBOL = { ok: "✓", missing: "!", check: "?", later: "…" };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * @typedef {{ label: string, fields: [string, string, string?][] }} ProfileItem
 *   fields: [Profilfeld-Key, Platzhalter, Zusatzklassen ("wide", "mono", "date")]
 */

export const PROFILE_ITEM = {
  name: { label: "Name", fields: [["firstName", "Vorname"], ["lastName", "Nachname"]] },
  address: { label: "Adresse", fields: [["address", "Straße und Hausnummer", "wide"], ["postalCode", "PLZ"], ["city", "Ort"]] },
  birthDate: { label: "Geburtsdatum", fields: [["birthDate", "", "date"]] },
  birthPlace: { label: "Geburtsort", fields: [["birthPlace", "wie im Reisepass"]] },
  tin: { label: "Steuer-ID", fields: [["tin", "z.B. 86095742719", "mono"]] },
  taxNumber: { label: "Steuernummer", fields: [["taxNumber", "z.B. 143/123/45678", "mono"]] },
  taxOffice: { label: "Finanzamt", fields: [["taxOfficeName", "Name des Finanzamts", "wide"], ["taxOfficeStreet", "Straße", "wide"], ["taxOfficePostalCode", "PLZ"], ["taxOfficeCity", "Ort"]] },
  contact: { label: "Kontakt", fields: [["email", "E-Mail"], ["phone", "Telefon inkl. Ländervorwahl"]] },
  bank: { label: "Bankverbindung", fields: [["iban", "IBAN", "mono wide"], ["accountHolderName", "Kontoinhaber"]] },
  bic: { label: "BIC", fields: [["bic", "BIC / SWIFT", "mono"]] },
};

export const isItemFilled = (profile, item) => item.fields.every(([key]) => PROFILE_FIELDS[key].read(profile).trim() !== "");

export function checklistRow(state, label, valueHtml, actionsHtml = "", attrs = "") {
  return `
    <div class="ch-check-item ${state}" ${attrs}>
      <span class="ch-state ${state}">${SYMBOL[state]}</span>
      <span class="ch-check-label">${esc(label)}</span>
      <div class="ch-check-value">${valueHtml}</div>
      <div class="ch-check-actions">${actionsHtml}</div>
    </div>`;
}

export function textRow(state, label, text, actionsHtml = "", attrs = "") {
  return checklistRow(state, label, `<span class="ch-check-text">${text}</span>`, actionsHtml, attrs);
}

/** Zeile mit direkt bearbeitbaren Profilfeldern */
export function profileRow(profile, item) {
  const inputs = item.fields
    .map(([key, placeholder, extra = ""]) => {
      const value = PROFILE_FIELDS[key].read(profile);
      const type = extra.includes("date") ? "date" : "text";
      return `<input class="${confirmedFieldClasses(value).inputClass} ch-inline ${extra.replace("date", "")}" type="${type}" data-field="${key}" placeholder="${esc(placeholder)}" value="${esc(value)}">`;
    })
    .join("");
  const errors = item.fields.map(([key]) => `<span class="field-error" data-error-for="${key}" hidden></span>`).join("");
  return checklistRow(
    isItemFilled(profile, item) ? "ok" : "missing",
    item.label,
    `<div class="ch-inline-fields">${inputs}</div>${errors}`,
    "",
    `data-profile-item="${Object.keys(PROFILE_ITEM).find((k) => PROFILE_ITEM[k] === item) ?? ""}"`
  );
}

export const AUTOSAVE_ROW = `<div class="ch-autosave-row autosave-note">✓ Zum Ändern ins Feld klicken – Änderungen werden automatisch in Ihren persönlichen Daten gespeichert.</div>`;

export function setRowState(row, state) {
  row.classList.remove("ok", "missing", "check", "later");
  row.classList.add(state);
  const badge = row.querySelector(".ch-state");
  badge.className = `ch-state ${state}`;
  badge.textContent = SYMBOL[state];
}

/** "x von y vorhanden" in das Element mit [data-summary] schreiben */
export function updateChecklistSummary(container) {
  const items = [...container.querySelectorAll(".ch-check-item")];
  const ok = items.filter((i) => i.classList.contains("ok")).length;
  const el = container.querySelector("[data-summary]");
  if (el) el.textContent = `${ok} von ${items.length} vorhanden`;
}

/**
 * Automatisches Speichern der Profilfelder; danach nur Zustände aktualisieren,
 * nicht neu rendern (Fokus bleibt im nächsten Feld).
 * @returns {() => void} Aufräumfunktion
 */
export function bindChecklistAutosave(container, onSaved) {
  return bindProfileAutosave(container, {
    getProfile: () => getState().currentProfile,
    onSaved: (profile, key) => {
      container.querySelectorAll("[data-profile-item]").forEach((row) => {
        const item = PROFILE_ITEM[row.dataset.profileItem];
        if (item) setRowState(row, isItemFilled(profile, item) ? "ok" : "missing");
      });
      updateChecklistSummary(container);
      onSaved?.(profile, key);
    },
  });
}
