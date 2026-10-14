import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatementLines } from "../src/lib/brokerStatementParser.js";
import { buyJanuary, buyApril, sellPartialExecutions, taxVoucher5 } from "./fixtures/baaderStatements.js";

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

test("Unbekanntes Dokument", () => {
  const r = parseStatementLines(["Irgendein Brief", "ohne Abrechnung"]);
  assert.equal(r.kind, "unknown");
  assert.equal(r.broker, null);
});
