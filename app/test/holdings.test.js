import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLots, computeHoldings, computeEntitlements } from "../src/lib/holdings.js";

const JF = "CH0017875789"; // Jungfraubahn Holding AG
const MU = "CH0012345678"; // fiktive Muster Holding AG
const REFUND_RATE = 0.35 - 0.15;

const buy = (isin, tradeDate, quantity, depotId = "D1") => ({ isin, type: "buy", tradeDate, quantity, depotId });
const sell = (isin, tradeDate, quantity, depotId = "D1") => ({ isin, type: "sell", tradeDate, quantity, depotId });

// Referenzfall: Antrag DE-1407-5964-00 (docs/konzept-schweiz.md)
const jungfrau = [
  buy(JF, "2024-03-11", 15),
  buy(JF, "2024-10-24", 5),
  buy(JF, "2026-01-09", 2),
  buy(JF, "2026-04-27", 3), // Auftrag 17.04., Handelstag 27.04., Valuta 29.04.
];
const jungfrauDividend2026 = { isin: JF, exDate: "2026-05-14", paymentDate: "2026-05-18", grossPerShare: 8.5, voucherQuantities: [20, 5] };

test("Referenzfall Jungfraubahn 2026: vier Einträge, CHF 42.50", () => {
  const [result] = computeEntitlements(jungfrau, [jungfrauDividend2026], { refundRate: REFUND_RATE });
  assert.deepEqual(
    result.entries.map((e) => [e.isin, e.acquisitionDate, e.quantity, e.paymentDate, e.refund]),
    [
      [JF, "2024-03-11", 15, "2026-05-18", 25.5],
      [JF, "2024-10-24", 5, "2026-05-18", 8.5],
      [JF, "2026-01-09", 2, "2026-05-18", 3.4],
      [JF, "2026-04-27", 3, "2026-05-18", 5.1],
    ]
  );
  assert.equal(result.heldQuantity, 25);
  assert.equal(result.refund, 42.5);
  assert.equal(result.voucherQuantity, 25);
  assert.equal(result.voucherMatches, true);
});

test("Fall A und B: ganz verkaufte Tranche entfällt, teilweise verkaufte behält Erwerbsdatum", () => {
  const txs = [buy(MU, "2023-03-15", 40), buy(MU, "2023-11-10", 30), sell(MU, "2025-02-12", 50)];
  const { lots, oversold } = computeLots(txs, { isin: MU, depotId: "D1" });
  assert.equal(oversold, 0);
  assert.deepEqual(lots.map((l) => [l.tradeDate, l.original, l.remaining]), [
    ["2023-03-15", 40, 0],
    ["2023-11-10", 30, 20],
  ]);
  assert.deepEqual(lots[1].sales, [{ tradeDate: "2025-02-12", quantity: 10 }]);

  const [result] = computeEntitlements(txs, [{ isin: MU, exDate: "2025-04-22", paymentDate: "2025-04-24", grossPerShare: 2.1 }], { refundRate: REFUND_RATE });
  assert.deepEqual(result.entries.map((e) => [e.acquisitionDate, e.quantity]), [["2023-11-10", 20]]);
  assert.equal(result.refund, 8.4);
});

test("Verkauf nach dem Ex-Tag ändert den Anspruch nicht", () => {
  const txs = [buy(MU, "2023-03-15", 40), buy(MU, "2023-11-10", 30), sell(MU, "2025-02-12", 50)];
  const [result] = computeEntitlements(txs, [{ isin: MU, exDate: "2024-04-23", paymentDate: "2024-04-25", grossPerShare: 2 }], { refundRate: REFUND_RATE });
  assert.equal(result.heldQuantity, 70);
  assert.equal(result.refund, 28);
});

test("Stichtag: Kauf am Ex-Tag zählt nicht, Verkauf am Ex-Tag nimmt den Anspruch nicht weg", () => {
  const dividend = { isin: JF, exDate: "2026-05-14", paymentDate: "2026-05-18" };
  const boughtOnExDate = [buy(JF, "2026-05-13", 10), buy(JF, "2026-05-14", 5)];
  assert.equal(computeEntitlements(boughtOnExDate, [dividend], { refundRate: REFUND_RATE })[0].heldQuantity, 10);

  const soldOnExDate = [buy(JF, "2026-01-02", 10), sell(JF, "2026-05-14", 10)];
  assert.equal(computeEntitlements(soldOnExDate, [dividend], { refundRate: REFUND_RATE })[0].heldQuantity, 10);

  const soldBeforeExDate = [buy(JF, "2026-01-02", 10), sell(JF, "2026-05-13", 4)];
  assert.equal(computeEntitlements(soldBeforeExDate, [dividend], { refundRate: REFUND_RATE })[0].heldQuantity, 6);
});

test("Kauf und Verkauf am selben Tag: erst Kauf, dann Verkauf", () => {
  const txs = [buy(MU, "2025-01-10", 10), sell(MU, "2025-01-10", 4)];
  const { lots, oversold } = computeLots(txs, { isin: MU, depotId: "D1" });
  assert.equal(oversold, 0);
  assert.equal(lots[0].remaining, 6);
});

test("Zwei Ausschüttungen im selben Jahr ergeben zwei getrennte Blöcke", () => {
  const txs = [buy(MU, "2025-01-10", 10), buy(MU, "2025-07-01", 5)];
  const results = computeEntitlements(
    txs,
    [
      { isin: MU, exDate: "2025-04-22", paymentDate: "2025-04-24", grossPerShare: 1 },
      { isin: MU, exDate: "2025-10-20", paymentDate: "2025-10-22", grossPerShare: 1 },
    ],
    { refundRate: REFUND_RATE }
  );
  assert.deepEqual(results.map((r) => r.entries.length), [1, 2]);
  assert.deepEqual(results.map((r) => r.heldQuantity), [10, 15]);
  assert.deepEqual(results.map((r) => r.entries[0].year), [2025, 2025]);
});

test("FIFO getrennt pro Depot: Verkauf in Depot 2 verbraucht nicht die ältere Tranche in Depot 1", () => {
  const txs = [buy(JF, "2023-01-05", 10, "D1"), buy(JF, "2024-01-05", 10, "D2"), sell(JF, "2025-01-05", 4, "D2")];
  const [result] = computeEntitlements(txs, [{ isin: JF, exDate: "2025-05-14", paymentDate: "2025-05-18" }], { refundRate: REFUND_RATE });
  assert.deepEqual(result.entries.map((e) => [e.depotId, e.acquisitionDate, e.quantity]), [
    ["D1", "2023-01-05", 10],
    ["D2", "2024-01-05", 6],
  ]);
  assert.equal(result.refund, null); // ohne Bruttodividende keine Erstattungsschätzung
});

test("Mehr verkauft als gekauft wird als fehlende Käufe gemeldet", () => {
  const txs = [buy(MU, "2024-01-10", 5), sell(MU, "2025-01-10", 8)];
  assert.equal(computeLots(txs, { isin: MU, depotId: "D1" }).oversold, 3);
  const [holding] = computeHoldings(txs);
  assert.equal(holding.total, 0);
  assert.equal(holding.oversold, 3);
});

test("Voucher-Summe passt nicht zum Bestand: z. B. wenn Kaufabrechnungen fehlen", () => {
  const onlyPurchases2026 = jungfrau.slice(2);
  const [result] = computeEntitlements(onlyPurchases2026, [jungfrauDividend2026], { refundRate: REFUND_RATE });
  assert.equal(result.heldQuantity, 5);
  assert.equal(result.voucherQuantity, 25);
  assert.equal(result.voucherMatches, false);
});

test("Bestandsübersicht: pro Depot und ISIN mit letzter Transaktion", () => {
  const holdings = computeHoldings([...jungfrau, buy(MU, "2023-03-15", 40), sell(MU, "2025-02-12", 10)]);
  assert.deepEqual(holdings.map((h) => [h.isin, h.total, h.lastTradeDate]), [
    [MU, 30, "2025-02-12"],
    [JF, 25, "2026-04-27"],
  ]);
});
