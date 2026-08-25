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
