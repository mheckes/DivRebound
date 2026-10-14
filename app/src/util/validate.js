// Validierungsregeln aus divrebound_data_schema.md §5.

const TIN_PATTERNS = {
  DE: /^\d{11}$/,
  AT: /^FA-\d{6}-\d$/,
  CH: /^756\.\d{4}\.\d{4}\.\d{2}$/,
};

export function isValidTin(country, tin) {
  const pattern = TIN_PATTERNS[country];
  return pattern ? pattern.test((tin ?? "").trim()) : false;
}

export function tinHint(country) {
  return (
    {
      DE: "11-stellig, rein numerisch",
      AT: "Format FA-NNNNNN-P",
      CH: "Format 756.NNNN.NNNN.NN (AHV-Nummer)",
    }[country] ?? ""
  );
}

/**
 * Deutsche Steuernummer: je nach Bundesland unterschiedlich geschrieben
 * ("143/123/45678", "21/815/08150", 13-stellig im Bundesschema). Geprüft wird
 * deshalb nur grob: Ziffern mit "/" oder Leerzeichen, 10 bis 13 Ziffern.
 */
export function isValidTaxNumber(value) {
  const v = (value ?? "").trim();
  if (!/^[\d/ ]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 13;
}

/**
 * ISIN mit gültiger Prüfziffer (ISO 6166): Buchstaben -> Zahlen (A=10 … Z=35),
 * dann Luhn-Verfahren über alle Ziffern.
 */
export function isValidIsin(value) {
  const isin = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const digits = [...isin].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join("");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function isinMatchesCorridor(isin, isinPrefix) {
  return typeof isin === "string" && isin.startsWith(isinPrefix);
}

/**
 * Duplikat-Erkennung über alle Cases desselben Profils (nicht nur denselben
 * Case): gleiche ISIN + Zahltag + Bruttobetrag (auf 2 Nachkommastellen
 * gerundet). Siehe Plan Abschnitt 8 - im Schema nur qualitativ beschrieben.
 */
export function isDuplicateDistribution(candidate, existingDistributions) {
  const round2 = (n) => Math.round(n * 100) / 100;
  return existingDistributions.some(
    (d) =>
      d.isin === candidate.isin &&
      d.paymentDate === candidate.paymentDate &&
      round2(d.grossDividend) === round2(candidate.grossDividend)
  );
}
