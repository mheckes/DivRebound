// Normalisiert InvestorProfile.residence.taxOffice auf das aktuelle Schema
// { name, street, postalCode, city } - getrennt wie die Adresse des
// Antragstellers selbst, statt einem einzelnen Freitextfeld "address" (frühere
// Form). Bereits gespeicherte alte Profile mit nur "address" werden beim
// Anzeigen einmalig best-effort aufgesplittet; persistiert wird die neue Form
// erst, wenn der Nutzer den jeweiligen Screen tatsächlich speichert - kein
// destruktiver Datenverlust, falls das Muster "Straße, PLZ Ort" nicht passt
// (dann landet der komplette alte Wert unverändert in "street").

const LEGACY_ADDRESS_PATTERN = /^(.*),\s*(\d{4,5})\s+(.+)$/;

/** @param {{ name?: string, street?: string, postalCode?: string, city?: string, address?: string }} [taxOffice] */
export function normalizeTaxOffice(taxOffice) {
  const t = taxOffice ?? {};
  if (t.street || t.postalCode || t.city) {
    return { name: t.name ?? "", street: t.street ?? "", postalCode: t.postalCode ?? "", city: t.city ?? "" };
  }
  const legacy = String(t.address ?? "").trim();
  if (!legacy) return { name: t.name ?? "", street: "", postalCode: "", city: "" };

  const match = legacy.match(LEGACY_ADDRESS_PATTERN);
  if (match) {
    return { name: t.name ?? "", street: match[1].trim(), postalCode: match[2].trim(), city: match[3].trim() };
  }
  return { name: t.name ?? "", street: legacy, postalCode: "", city: "" };
}
