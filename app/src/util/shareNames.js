// Ein einheitlicher Name pro ISIN, damit dieselbe Aktie überall gleich heißt -
// egal ob aus einer Abrechnung gelesen oder von Hand erfasst.
// Vorrang: 1. offizielle SIX-Liste (config/swissShares.js), 2. der Name, unter
// dem die ISIN zuerst im eigenen Bestand erfasst wurde.

import { SWISS_SHARES } from "../config/swissShares.js";

/**
 * @param {{ isin: string, issuerName?: string, tradeDate?: string|null, source?: { importedAt?: string } }[]} transactions
 * @returns {{ nameFor: (isin: string) => string, sourceFor: (isin: string) => "six" | "bestand" | null, all: () => Record<string, string> }}
 */
export function shareNames(transactions) {
  const fromHoldings = {};
  const ordered = [...transactions].sort((a, b) =>
    (a.source?.importedAt ?? a.tradeDate ?? "").localeCompare(b.source?.importedAt ?? b.tradeDate ?? "")
  );
  for (const t of ordered) {
    if (t.issuerName && !fromHoldings[t.isin]) fromHoldings[t.isin] = t.issuerName;
  }
  return {
    nameFor: (isin) => SWISS_SHARES[isin] ?? fromHoldings[isin] ?? "",
    sourceFor: (isin) => (SWISS_SHARES[isin] ? "six" : fromHoldings[isin] ? "bestand" : null),
    all: () => ({ ...fromHoldings, ...SWISS_SHARES }),
  };
}
