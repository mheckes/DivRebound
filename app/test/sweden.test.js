import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDividendLines } from "../src/lib/dividendCertificateParser.js";
import { classifyWithholding, refundFor, totalRefund, formsFor, formTotals, deadlineOf } from "../src/lib/sweden.js";
import { corridors } from "../src/config/corridors.js";
import { thule2022, thule2023May, thule2023Oct } from "./fixtures/swedenStatements.js";

const TODAY = new Date("2026-11-12");

test("DAB-Abrechnung Thule 2023: Werte für SKV 3740", () => {
  const { distribution: d, isinValid, warnings, bankComputedRefundHint, profileHints } = parseDividendLines(thule2023May, corridors.SE);
  assert.equal(isinValid, true);
  assert.deepEqual(warnings, []);
  assert.equal(d.isin, "SE0006422390");
  assert.equal(d.issuerName, "Thule Group AB");
  assert.equal(d.paymentDate, "2023-05-05"); // Zahltag, nicht Ex-Tag
  assert.equal(d.exDate, "2023-04-28");
  assert.equal(d.shares, 57);
  assert.equal(d.dividendPerShare, 4.6);
  assert.equal(d.grossDividend, 262.2); // 57 × 4,60 SEK
  assert.equal(d.withheldTax, 78.66);
  assert.equal(d.withholdingRatePercent, 30);
  assert.equal(d.currency, "SEK");
  assert.deepEqual(bankComputedRefundHint, { currency: "SEK", amount: 39.33 });
  assert.equal(profileHints.city, "München"); // nicht "München Depotinhaber"
  assert.equal(profileHints.address, "Musterstr. 1");
  assert.equal(refundFor(d).refund, 39.33);
});

test("Drei Abrechnungen ergeben das Muster-Formular: 693,40 SEK Brutto, 104,01 SEK Erstattung", () => {
  const ds = [thule2022, thule2023May, thule2023Oct].map((l) => parseDividendLines(l, corridors.SE).distribution);
  assert.deepEqual(ds.map((d) => d.grossDividend), [169, 262.2, 262.2]);
  assert.deepEqual(ds.map((d) => d.withheldTax), [50.7, 78.66, 78.66]);
  assert.equal(totalRefund(ds), 104.01);
  const [form, ...more] = formsFor(ds);
  assert.equal(more.length, 0);
  assert.deepEqual(formTotals(form.rows), { gross: 693.4, tax: 208.02, refund: 104.01 });
});

test("Steuersatz 30 % ok, 15 % nichts zu erstatten", () => {
  const d = { isin: "SE0006422390", paymentDate: "2023-05-05", grossDividend: 100, withheldTax: 30, withholdingRatePercent: 30, extractionConfidence: "user_confirmed" };
  assert.equal(classifyWithholding(d, TODAY).kind, "ok");
  assert.equal(classifyWithholding({ ...d, withheldTax: 15 }, TODAY).kind, "none");
});

test("Frist: fünf Jahre ab Ende des Auszahlungsjahres", () => {
  const d = { grossDividend: 100, withheldTax: 30, paymentDate: "2021-10-11" };
  assert.equal(deadlineOf(d), "2026-12-31");
  assert.equal(classifyWithholding(d, new Date("2026-12-31")).kind, "ok");
  assert.equal(classifyWithholding(d, new Date("2027-01-02")).kind, "expired");
});

test("mehr als 12 Ausschüttungen -> zweites Formular", () => {
  const rows = Array.from({ length: 13 }, (_, i) => ({ isin: "SE0000000001", paymentDate: `2024-01-${String(i + 1).padStart(2, "0")}`, grossDividend: 100, withheldTax: 30 }));
  const forms = formsFor(rows);
  assert.deepEqual(forms.map((f) => f.rows.length), [12, 1]);
  assert.equal(forms[1].part, 2);
  assert.equal(forms[1].of, 2);
});
