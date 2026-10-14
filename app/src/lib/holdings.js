// Wertpapierbestand nach FIFO und daraus die Einträge fürs ESTV-ePortal
// (docs/konzept-schweiz.md §0, §3). Reine Funktionen ohne Browser-/DB-Bezug,
// damit sie mit `npm test` (node --test) direkt geprüft werden können.
//
// Regeln:
// - FIFO getrennt pro Depot und ISIN: Verkäufe verbrauchen zuerst die älteste
//   Kauf-Tranche. Ganz verkaufte Tranchen entfallen (Fall A), teilweise
//   verkaufte behalten ihr Erwerbsdatum mit reduzierter Stückzahl (Fall B).
// - Stichtag einer Ausschüttung: Bestand am Ende des Handelstags VOR dem
//   Ex-Tag. Transaktionen mit Handelstag < Ex-Tag zählen; ein Kauf am Ex-Tag
//   gibt keinen Anspruch mehr, ein Verkauf am Ex-Tag nimmt ihn nicht mehr weg.
// - Erwerbsdatum = Handelstag der Abrechnung (nicht Auftragsdatum, nicht Valuta).

/**
 * @typedef {object} Transaction
 * @property {string} [transactionId]
 * @property {string} [depotId]
 * @property {string} isin
 * @property {string} [issuerName]
 * @property {"buy" | "sell"} type
 * @property {string} tradeDate  ISO "YYYY-MM-DD"
 * @property {number} quantity   immer positiv
 */

/**
 * @typedef {object} Lot
 * @property {string} tradeDate     Erwerbsdatum der Tranche
 * @property {number} original      gekaufte Stückzahl
 * @property {number} remaining     davon noch im Bestand
 * @property {{ tradeDate: string, quantity: number }[]} sales  welche Verkäufe die Tranche reduziert haben
 * @property {string} [transactionId]
 */

/**
 * @typedef {object} Distribution
 * @property {string} isin
 * @property {string} [depotId]          ohne Angabe: alle Depots
 * @property {string} [issuerName]
 * @property {string} exDate             ISO
 * @property {string} paymentDate        ISO, im Portal "Fälligkeit"
 * @property {number} [grossPerShare]    Bruttodividende je Aktie in CHF
 * @property {number[]} [voucherQuantities] Stückzahlen der zugeordneten Tax Voucher
 */

const depotKey = (t) => t.depotId ?? "";

/** Gleicher Tag: Käufe vor Verkäufen (ein am selben Tag gekauftes Stück kann verkauft werden). */
function compareTransactions(a, b) {
  if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1;
  if (a.type !== b.type) return a.type === "buy" ? -1 : 1;
  return 0;
}

/**
 * FIFO-Tranchen einer ISIN in einem Depot.
 * @param {Transaction[]} transactions
 * @param {{ isin: string, depotId?: string, cutoffExclusive?: string }} filter
 *   cutoffExclusive: nur Transaktionen mit Handelstag < diesem Datum (Ex-Tag)
 * @returns {{ lots: Lot[], oversold: number }}
 *   oversold > 0: es wurde mehr verkauft als gekauft - Kaufabrechnungen fehlen
 */
export function computeLots(transactions, { isin, depotId, cutoffExclusive }) {
  const relevant = transactions
    .filter((t) => t.isin === isin)
    .filter((t) => depotId === undefined || depotKey(t) === depotId)
    .filter((t) => !cutoffExclusive || t.tradeDate < cutoffExclusive)
    .sort(compareTransactions);

  /** @type {Lot[]} */
  const lots = [];
  let oversold = 0;
  for (const t of relevant) {
    if (t.type === "buy") {
      lots.push({ tradeDate: t.tradeDate, original: t.quantity, remaining: t.quantity, sales: [], transactionId: t.transactionId });
      continue;
    }
    let toSell = t.quantity;
    for (const lot of lots) {
      if (toSell === 0) break;
      const take = Math.min(lot.remaining, toSell);
      if (take === 0) continue;
      lot.remaining -= take;
      toSell -= take;
      lot.sales.push({ tradeDate: t.tradeDate, quantity: take });
    }
    oversold += toSell;
  }
  return { lots, oversold };
}

/**
 * Aktueller Bestand, gruppiert nach Depot und ISIN.
 * @param {Transaction[]} transactions
 * @returns {{ depotId: string, isin: string, issuerName: string, lots: Lot[], total: number, oversold: number, lastTradeDate: string }[]}
 */
export function computeHoldings(transactions) {
  const groups = new Map();
  for (const t of transactions) {
    const key = `${depotKey(t)}|${t.isin}`;
    if (!groups.has(key)) groups.set(key, { depotId: depotKey(t), isin: t.isin, issuerName: t.issuerName ?? "", lastTradeDate: t.tradeDate });
    const g = groups.get(key);
    if (!g.issuerName && t.issuerName) g.issuerName = t.issuerName;
    if (t.tradeDate > g.lastTradeDate) g.lastTradeDate = t.tradeDate;
  }
  return [...groups.values()]
    .map((g) => {
      const { lots, oversold } = computeLots(transactions, { isin: g.isin, depotId: g.depotId });
      return { ...g, lots, total: lots.reduce((s, l) => s + l.remaining, 0), oversold };
    })
    .sort((a, b) => a.depotId.localeCompare(b.depotId) || a.issuerName.localeCompare(b.issuerName) || a.isin.localeCompare(b.isin));
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Einträge fürs ePortal: pro Ausschüttung eine Zeile je noch gehaltener Tranche.
 * @param {Transaction[]} transactions
 * @param {Distribution[]} distributions
 * @param {{ refundRate: number }} options  z. B. 0.35 - 0.15 = 0.20 für DE-Ansässige
 */
export function computeEntitlements(transactions, distributions, { refundRate }) {
  return distributions.map((distribution) => {
    const depotIds =
      distribution.depotId !== undefined
        ? [distribution.depotId]
        : [...new Set(transactions.filter((t) => t.isin === distribution.isin).map(depotKey))].sort();

    const entries = [];
    let oversold = 0;
    for (const depotId of depotIds) {
      const result = computeLots(transactions, { isin: distribution.isin, depotId, cutoffExclusive: distribution.exDate });
      oversold += result.oversold;
      for (const lot of result.lots) {
        if (lot.remaining === 0) continue;
        entries.push({
          isin: distribution.isin,
          depotId,
          acquisitionDate: lot.tradeDate,
          quantity: lot.remaining,
          paymentDate: distribution.paymentDate,
          year: Number(distribution.paymentDate.slice(0, 4)),
          refund: distribution.grossPerShare === undefined ? null : round2(lot.remaining * distribution.grossPerShare * refundRate),
        });
      }
    }
    entries.sort((a, b) => (a.acquisitionDate < b.acquisitionDate ? -1 : a.acquisitionDate > b.acquisitionDate ? 1 : 0));

    const heldQuantity = entries.reduce((s, e) => s + e.quantity, 0);
    const voucherQuantity = distribution.voucherQuantities?.reduce((s, q) => s + q, 0) ?? null;
    const refunds = entries.map((e) => e.refund);
    return {
      distribution,
      entries,
      heldQuantity,
      oversold,
      voucherQuantity,
      // null = noch kein Voucher zugeordnet
      voucherMatches: voucherQuantity === null ? null : voucherQuantity === heldQuantity,
      refund: refunds.includes(null) ? null : round2(refunds.reduce((s, r) => s + r, 0)),
    };
  });
}
