// Liefert die CSS-Klassen für ein Eingabefeld, das bei bereits vorhandenem
// Wert wie reiner Text wirkt (kein Rahmen/Hintergrund, siehe .confirmed-label/
// .confirmed-input in style/base.css) statt wie ein noch auszufüllendes leeres
// Feld, aber weiterhin anklickbar/editierbar bleibt (Rahmen erscheint bei
// Hover/Fokus). Bei leerem Wert stattdessen die normale .field-label/-input-
// Optik, die zum Ausfüllen einlädt.
//
// An mehreren Stellen für dieselben Felder verwendet (z.B. Finanzamt-Daten in
// screens/profile/profile.js UND screens/coverLetter/coverLetter.js), damit
// sie überall gleich aussehen statt pro Screen leicht abzuweichen.

/** @param {string | null | undefined} value */
export function confirmedFieldClasses(value) {
  const hasValue = String(value ?? "").trim() !== "";
  return {
    labelClass: hasValue ? "confirmed-label" : "field-label",
    inputClass: hasValue ? "confirmed-input" : "field-input",
  };
}
