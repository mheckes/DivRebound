// Name eines Antrags für den Nutzer: Land und Jahre der erfassten
// Ausschüttungen ("Dänemark 2024–2025"). Solange noch nichts hochgeladen ist,
// gibt es keine Jahre - dann "Dänemark · neu".

export const COUNTRY_NAMES = { DK: "Dänemark", CH: "Schweiz", IT: "Italien", SE: "Schweden" };

/** Jahre der erfassten Ausschüttungen, aufsteigend */
export function caseYears(reclaimCase) {
  const dates =
    reclaimCase.targetCountry === "CH"
      ? (reclaimCase.ch?.distributions ?? []).map((d) => d.paymentDate)
      : (reclaimCase.distributions ?? []).map((d) => d.paymentDate ?? (d.taxYear ? String(d.taxYear) : null));
  return [...new Set(dates.filter(Boolean).map((d) => String(d).slice(0, 4)))].sort();
}

export function caseName(reclaimCase) {
  const country = COUNTRY_NAMES[reclaimCase.targetCountry] ?? reclaimCase.targetCountry;
  const years = caseYears(reclaimCase);
  if (!years.length) return `${country} · neu`;
  return `${country} ${years[0]}${years.length > 1 ? `–${years[years.length - 1]}` : ""}`;
}
