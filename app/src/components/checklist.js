// Gemeinsamer Baustein "Unterlagen prüfen" (docs/konzept-schweiz.md §2, §2a)
// für Schweiz und Dänemark. Keine eigene Datenhaltung: Profilfelder werden
// direkt bearbeitet und automatisch gespeichert (util/autosave.js), alle
// anderen Zeilen zeigen nur einen Zustand.

import { getState } from "../store/store.js";
import { PROFILE_FIELDS } from "../util/profileFields.js";
import { confirmedFieldClasses } from "../util/fieldDisplay.js";
import { bindProfileAutosave } from "../util/autosave.js";

// "later" = noch offen, kommt aber erst in einem späteren Schritt: gleiches
// Zeichen wie "missing", aber grau statt rot (siehe .ch-state.later).
const SYMBOL = { ok: "✓", missing: "!", check: "?", later: "!" };

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
  birthPlace: { label: "Geburtsort", fields: [["birthPlace", ""]] },
  tin: { label: "Steuer-ID", fields: [["tin", "z.B. 86095742719", "mono"]] },
  taxNumber: { label: "Steuernummer", fields: [["taxNumber", "z.B. 143/123/45678", "mono"]] },
  taxOffice: { label: "Finanzamt", fields: [["taxOfficeName", "Name des Finanzamts", "wide"], ["taxOfficeStreet", "Straße", "wide"], ["taxOfficePostalCode", "PLZ"], ["taxOfficeCity", "Ort"]] },
  contact: { label: "Kontakt", fields: [["email", "E-Mail"], ["phone", "Telefon inkl. Ländervorwahl"]] },
  bank: { label: "Bankverbindung", fields: [["iban", "IBAN", "mono wide"], ["accountHolderName", "Kontoinhaber"]] },
  bic: { label: "BIC", fields: [["bic", "BIC / SWIFT", "mono"]] },
  bankName: { label: "Name der Bank", fields: [["bankName", "z.B. Commerzbank AG", "wide"]] },
  bankAddress: { label: "Adresse der Bank", fields: [["bankAddress", "z.B. Kaiserplatz, 60311 Frankfurt am Main", "wide"]] },
  email: { label: "E-Mail", fields: [["email", "E-Mail", "wide"]] },
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

/** Direkt bearbeitbare Profilfelder einer Zeile (gespeichert über data-field) */
export function profileInputsHtml(profile, item) {
  // Stand 2.1: feste Spalten statt freier Breiten, damit alle Zeilen
  // untereinander stehen - erstes Feld links, alle weiteren ab derselben
  // zweiten Spalte (PLZ schmal, Ort daneben).
  const inputs = item.fields
    .map(([key, placeholder, extra = ""], i) => {
      const value = PROFILE_FIELDS[key].read(profile);
      const type = extra.includes("date") ? "date" : "text";
      const col = i === 0 ? "col-a" : /postalcode/i.test(key) ? "col-plz" : /city/i.test(key) ? "col-city" : "col-b";
      return `<input class="${confirmedFieldClasses(value).inputClass} ch-inline ${col} ${extra.replace(/date|wide/g, "")}" type="${type}" data-field="${key}" placeholder="${esc(placeholder)}" value="${esc(value)}">`;
    })
    .join("");
  const errors = item.fields.map(([key]) => `<span class="field-error" data-error-for="${key}" hidden></span>`).join("");
  return `<div class="ch-inline-fields">${inputs}</div>${errors}`;
}

/** Zeile mit direkt bearbeitbaren Profilfeldern */
export function profileRow(profile, item) {
  return checklistRow(
    isItemFilled(profile, item) ? "ok" : "missing",
    item.label,
    profileInputsHtml(profile, item),
    "",
    `data-profile-item="${Object.keys(PROFILE_ITEM).find((k) => PROFILE_ITEM[k] === item) ?? ""}"`
  );
}

/** Wie profileRow, aber optional: leer = grau ("later") statt rot */
export function optionalProfileRow(profile, item) {
  return checklistRow(isItemFilled(profile, item) ? "ok" : "later", item.label, profileInputsHtml(profile, item), "", `data-optional-item="${Object.keys(PROFILE_ITEM).find((k) => PROFILE_ITEM[k] === item) ?? ""}"`);
}

export const AUTOSAVE_ROW = `<div class="ch-autosave-row autosave-note">✓ Zum Ändern ins Feld klicken. Änderungen werden automatisch in deinen persönlichen Daten gespeichert.</div>`;

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
      container.querySelectorAll("[data-optional-item]").forEach((row) => {
        const item = PROFILE_ITEM[row.dataset.optionalItem];
        if (item) setRowState(row, isItemFilled(profile, item) ? "ok" : "later");
      });
      updateChecklistSummary(container);
      onSaved?.(profile, key);
    },
  });
}

/**
 * Schritt "Deine Angaben": oben, was für das Formular noch fehlt, darunter
 * alles, was schon im Profil steht - dort direkt änderbar. Die Aufteilung
 * gilt für den Moment des Renderns; danach ändern sich nur die Zustände.
 * @param {object} profile
 * @param {string[]} required - Schlüssel aus PROFILE_ITEM, Pflicht für das Formular
 * @param {string[]} [others] - weitere Angaben, die nur angezeigt werden, wenn sie ausgefüllt sind
 */
export function profileCardsHtml(profile, required, others = []) {
  const missing = required.filter((k) => !isItemFilled(profile, PROFILE_ITEM[k]));
  // Freiwillige Angaben, die noch leer sind: grau statt rot, blockieren nicht
  const optionalOpen = others.filter((k) => !isItemFilled(profile, PROFILE_ITEM[k]));
  const filled = [...required, ...others].filter((k) => isItemFilled(profile, PROFILE_ITEM[k]));
  return `
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Noch offen</span><span class="count-pill">${missing.length ? `${missing.length} ${missing.length === 1 ? "Angabe" : "Angaben"}` : "nichts offen"}</span></div>
      ${missing.length ? missing.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("") : `<div class="card-body"><div class="md-all-done">✓ Alle Pflichtangaben für das Formular sind vollständig.</div></div>`}
      ${optionalOpen.length ? `<div class="ch-check-group">Freiwillig</div>` + optionalOpen.map((k) => optionalProfileRow(profile, PROFILE_ITEM[k])).join("") : ""}
      ${missing.length || optionalOpen.length ? `<div class="ch-autosave-row autosave-note">Wird automatisch in deinem Profil gespeichert.</div>` : ""}
    </div>
    ${
      filled.length
        ? `<div class="card">
            <div class="card-head"><span class="card-title">Aus deinem Profil</span><span class="ch-head-sub">bitte kurz prüfen, zum Ändern ins Feld klicken</span></div>
            ${filled.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("")}
          </div>`
        : ""
    }`;
}
