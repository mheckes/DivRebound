// Trägt Name/Adresse aus dem Adressblock einer Dividendenabrechnung
// (parseDividendCertificate -> profileHints) ins Profil ein - nur für Felder,
// die dort noch leer sind (nie ein vom Nutzer bereits gesetztes Feld
// überschreiben). Gemeinsam für Dänemark und Italien.

/** @returns {boolean} ob sich das Profil geändert hat */
export function applyProfileHints(profile, hints) {
  if (!hints) return false;
  const map = {
    firstName: hints.firstName,
    lastName: hints.lastName,
    address: hints.address,
    postalCode: hints.postalCode,
    city: hints.city,
  };
  let changed = false;
  for (const [field, value] of Object.entries(map)) {
    if (value && !profile.residence[field]) {
      profile.residence[field] = value;
      changed = true;
    }
  }
  return changed;
}
