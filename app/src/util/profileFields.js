// Zentrale Beschreibung aller Profilfelder, die irgendwo in der App direkt
// bearbeitet werden ("Persönliche Daten", "Anschreiben Finanzamt", später die
// Checklisten "Unterlagen prüfen"). Jedes Eingabefeld trägt nur noch
// data-field="<key>" - Lesen, Schreiben, Validieren und die Bezeichnung in der
// Speichern-Meldung kommen von hier, damit dasselbe Feld an jeder Stelle gleich
// funktioniert (siehe docs/konzept-schweiz.md §2a-2c).

import { isValidTin, tinHint, isValidTaxNumber } from "./validate.js";
import { normalizeTaxOffice } from "./taxOffice.js";

function residenceField(key, label, extra = {}) {
  return {
    label,
    read: (p) => p.residence[key] ?? "",
    write: (p, v) => {
      p.residence[key] = v;
    },
    ...extra,
  };
}

function bankField(key, label, extra = {}) {
  return {
    label,
    read: (p) => p.bank[key] ?? "",
    write: (p, v) => {
      p.bank[key] = v;
    },
    ...extra,
  };
}

function taxOfficeField(key, label, extra = {}) {
  return {
    label,
    read: (p) => normalizeTaxOffice(p.residence.taxOffice)[key],
    // Beim ersten Schreiben wird ein evtl. noch altes { address }-Objekt
    // gleich in die neue Form überführt (siehe util/taxOffice.js).
    write: (p, v) => {
      p.residence.taxOffice = { ...normalizeTaxOffice(p.residence.taxOffice), [key]: v };
    },
    ...extra,
  };
}

const POSTAL_CODE = (v) => /^\d{5}$/.test(v) || "Postleitzahl hat 5 Ziffern";

/** @type {Record<string, { label: string, read(p: InvestorProfile): string, write(p: InvestorProfile, v: string): void, validate?(v: string, p: InvestorProfile): true | string }>} */
export const PROFILE_FIELDS = {
  firstName: residenceField("firstName", "Vorname"),
  lastName: residenceField("lastName", "Nachname"),
  birthDate: residenceField("birthDate", "Geburtsdatum"),
  birthPlace: residenceField("birthPlace", "Geburtsort"),
  country: residenceField("country", "Wohnsitzland"),
  address: residenceField("address", "Straße und Hausnummer"),
  postalCode: residenceField("postalCode", "Postleitzahl", { validate: POSTAL_CODE }),
  city: residenceField("city", "Ort"),
  email: residenceField("email", "E-Mail", {
    validate: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || "Bitte eine gültige E-Mail-Adresse eingeben",
  }),
  phone: residenceField("phone", "Telefon"),
  tin: residenceField("tin", "Steuer-ID", {
    validate: (v, p) => isValidTin(p.residence.country, v) || `Ungültiges Format. Erwartet: ${tinHint(p.residence.country)}`,
  }),
  taxNumber: residenceField("taxNumber", "Steuernummer", {
    validate: (v) => isValidTaxNumber(v) || "Ungültiges Format, z. B. 143/123/45678",
  }),
  taxOfficeName: taxOfficeField("name", "Finanzamt"),
  taxOfficeStreet: taxOfficeField("street", "Straße des Finanzamts"),
  taxOfficePostalCode: taxOfficeField("postalCode", "PLZ des Finanzamts", { validate: POSTAL_CODE }),
  taxOfficeCity: taxOfficeField("city", "Ort des Finanzamts"),
  bankName: bankField("bankName", "Name der Bank"),
  accountHolderName: bankField("accountHolderName", "Kontoinhaber"),
  bic: bankField("bic", "BIC"),
  iban: bankField("iban", "IBAN", {
    validate: (v) => /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}$/i.test(v) || "IBAN beginnt mit Länderkürzel und Prüfziffer, z. B. DE89 …",
  }),
};
