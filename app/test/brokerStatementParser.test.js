import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatementLines } from "../src/lib/brokerStatementParser.js";
import { buyJanuary, buyApril, sellPartialExecutions, taxVoucher5 } from "./fixtures/baaderStatements.js";
import { comdirectBuyEur, comdirectBuyChfPartial } from "./fixtures/comdirectStatements.js";

test("Baader-Kauf: ISIN, Name, Depot, Belegnummer, Handelstag", () => {
  const r = parseStatementLines(buyJanuary);
  assert.equal(r.kind, "trade");
  assert.equal(r.broker, "baader");
  assert.equal(r.type, "buy");
  assert.equal(r.isin, "CH0017875789");
  assert.equal(r.issuerName, "Jungfraubahn Holding AG");
  assert.equal(r.depotId, "1234567001");
  assert.equal(r.documentRef, "600000001/900000001");
  assert.deepEqual(r.executions, [{ quantity: 2, tradeDate: "2026-01-09" }]);
  assert.deepEqual(r.warnings, []);
});

test("Erwerbsdatum ist der Handelstag, nicht Auftragsdatum oder Valuta", () => {
  const r = parseStatementLines(buyApril);
  assert.deepEqual(r.executions, [{ quantity: 3, tradeDate: "2026-04-27" }]);
});

test("Verkauf mit Teilausführungen an zwei Tagen ergibt zwei Transaktionen", () => {
  const r = parseStatementLines(sellPartialExecutions);
  assert.equal(r.type, "sell");
  assert.equal(r.isin, "CH0012345678");
  assert.equal(r.issuerName, "Muster Holding AG");
  assert.deepEqual(r.executions, [
    { quantity: 1000, tradeDate: "2025-02-11" },
    { quantity: 50, tradeDate: "2025-02-12" },
  ]);
  assert.deepEqual(r.warnings, []);
});

test("Ausführungen passen nicht zur Stückzahl: Warnung", () => {
  const lines = sellPartialExecutions.filter((l) => !l.startsWith("STK 50 "));
  const r = parseStatementLines(lines);
  assert.equal(r.executions.length, 1);
  assert.match(r.warnings[0], /Summe der Ausführungen \(1000\).*\(1050\)/);
});

test("Ohne Ausführungsblock: Warnung statt Auftragsdatum", () => {
  const lines = buyApril.filter((l) => !/^(Details zur Ausführung|STK 3 EUR)/.test(l));
  const r = parseStatementLines(lines);
  assert.deepEqual(r.executions, [{ quantity: 3, tradeDate: null }]);
  assert.match(r.warnings[0], /Handelstag nicht gefunden/);
});

test("Tax-Voucher-Anschreiben: ISIN, Stückzahl, Vorgangs-Nr., Briefdatum", () => {
  const r = parseStatementLines(taxVoucher5);
  assert.equal(r.kind, "taxVoucher");
  assert.equal(r.isin, "CH0017875789");
  assert.equal(r.issuerName, "Jungfraubahn Holding AG");
  assert.equal(r.quantity, 5);
  assert.equal(r.vorgangsNr, "5000001");
  assert.equal(r.documentRef, "5000001/1000000002");
  assert.equal(r.letterDate, "2026-07-17");
  assert.deepEqual(r.warnings, []);
});

test("comdirect-Kauf in EUR: ISIN, Name, Depot, Geschäftsnummer, Geschäftstag", () => {
  const r = parseStatementLines(comdirectBuyEur);
  assert.equal(r.kind, "trade");
  assert.equal(r.broker, "comdirect");
  assert.equal(r.type, "buy");
  assert.equal(r.isin, "CH0017875789");
  assert.equal(r.issuerName, "Jungfraubahn Holding AG");
  assert.equal(r.depotId, "123456700");
  assert.equal(r.documentRef, "92000001");
  assert.deepEqual(r.executions, [{ quantity: 15, tradeDate: "2024-03-11" }]);
  assert.deepEqual(r.warnings, []);
});

test("comdirect-Teilausführung in CHF: Geschäftstag statt Briefdatum", () => {
  const r = parseStatementLines(comdirectBuyChfPartial);
  assert.equal(r.kind, "trade");
  assert.equal(r.documentRef, "92000002");
  assert.deepEqual(r.executions, [{ quantity: 2, tradeDate: "2024-10-25" }]);
  assert.deepEqual(r.warnings, []);
});

test("comdirect-Verkauf", () => {
  const lines = comdirectBuyEur.map((l) => (l === "Wertpapierkauf" ? "Wertpapierverkauf" : l));
  assert.equal(parseStatementLines(lines).type, "sell");
});

test("Unbekanntes Dokument", () => {
  const r = parseStatementLines(["Irgendein Brief", "ohne Abrechnung"]);
  assert.equal(r.kind, "unknown");
  assert.equal(r.broker, null);
});
