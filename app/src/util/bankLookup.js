// Erkennt aus einer deutschen IBAN die Bank (Name, BIC, PLZ und Ort) über die
// mitgelieferte Bankleitzahlendatei der Bundesbank (config/germanBanks.js,
// erzeugt von scripts/updateGermanBanks.mjs). Alles lokal - die IBAN verlässt
// das Gerät nicht. Die Bundesbank-Datei enthält keine Straße; die Adresse der
// Bank wird deshalb nur mit "PLZ Ort" vorbelegt.
//
// Die Liste (~280 KB) wird erst beim ersten Nachschlagen geladen, damit sie
// nicht im Start-Bundle der App landet.

import { isValidIban, normalizeIban } from "./validate.js";

let banksPromise = null;

function loadBanks() {
  banksPromise ??= import("../config/germanBanks.js").then((m) => m.GERMAN_BANKS);
  return banksPromise;
}

/**
 * @param {string} iban
 * @returns {Promise<{ name: string, postalCode: string, city: string, bic: string } | null>}
 */
export async function lookupGermanBank(iban) {
  const normalized = normalizeIban(iban);
  if (!normalized.startsWith("DE") || !isValidIban(normalized)) return null;
  const entry = (await loadBanks())[normalized.slice(4, 12)];
  if (!entry) return null;
  const [name, postalCode, city, bic] = entry;
  return { name, postalCode, city, bic };
}

/**
 * Welche Bankfelder sich aus einer neu eingegebenen IBAN ergeben (Keys aus
 * util/profileFields.js). Überschrieben wird nur, was leer ist - oder alles,
 * wenn die IBAN zu einer anderen Bank gehört als die bisher eingetragene BIC
 * (Kontowechsel). Ein selbst gewählter Bankname zur selben Bank bleibt stehen.
 *
 * @param {InvestorProfile} profile Profil mit der bereits gespeicherten IBAN
 * @returns {Promise<{ values: Record<string, string>, message: string } | null>}
 */
export async function deriveBankFields(profile) {
  const bank = await lookupGermanBank(profile.bank?.iban);
  if (!bank) return null;
  const current = profile.bank ?? {};
  const bankChanged = Boolean(current.bic) && bank.bic && current.bic !== bank.bic;
  const fill = (key, now, next) => (next && (bankChanged || !String(now ?? "").trim()) ? { [key]: next } : {});
  const values = {
    ...fill("bankName", current.bankName, bank.name),
    ...fill("bic", current.bic, bank.bic),
    ...fill("bankAddress", current.address, [bank.postalCode, bank.city].filter(Boolean).join(" ")),
  };
  return { values, message: `✓ IBAN gespeichert · Bank erkannt: ${bank.name}` };
}
