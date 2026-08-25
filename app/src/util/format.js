/** ISO 8601 (YYYY-MM-DD) -> DD.MM.YYYY, wie in DE/AT/CH üblich. */
export function formatDateDe(isoDateString) {
  if (!isoDateString) return "";
  const [year, month, day] = isoDateString.split("-");
  return `${day}.${month}.${year}`;
}

/** Zahl -> deutsches Format (Punkt als Tausender-, Komma als Dezimaltrenner). */
export function formatNumberDe(value, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCurrency(amount, currency) {
  if (amount === null || amount === undefined) return "";
  return `${formatNumberDe(amount)} ${currency}`;
}

/** Deutsches Zahlenformat ("1.234,56") -> Number. Für Formulareingaben. */
export function parseNumberDe(raw) {
  if (!raw) return null;
  const normalized = String(raw).trim().replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}
