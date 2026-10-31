import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDividendLines } from "../src/lib/dividendCertificateParser.js";
import {
  classifyWithholding, refundFor, isEligible, formsFor, yearsText, totalRefund, issuerDetails,
} from "../src/lib/italy.js";
import { corridors } from "../src/config/corridors.js";
import { ITALIAN_SHARES } from "../src/config/italianShares.js";
import { isValidIsin } from "../src/util/validate.js";
import { italmobiliare2026 } from "./fixtures/italyStatements.js";

const TODAY = new Date("2026-10-31");
const dist = (over) => ({
  isin: "IT0005253205", issuerName: "Italmobiliare S.p.A.", paymentDate: "2026-05-06",
  grossDividend: 300, withheldTax: 78, withholdingRatePercent: 26, extractionConfidence: "user_confirmed", ...over,
});

test("Baader-Abrechnung Italmobiliare: alle Werte für Form A", () => {
  const { distribution: d, isinValid, warnings, bankComputedRefundHint } = parseDividendLines(italmobiliare2026, corridors.IT);
  assert.equal(isinValid, true);
  assert.deepEqual(warnings, []);
  assert.equal(d.isin, "IT0005253205");
  assert.equal(d.issuerName, "Italmobiliare S.p.A.");
  assert.equal(d.paymentDate, "2026-05-06");
  assert.equal(d.taxYear, 2026); // Jahr des Zahltags, nicht der Zahlungszeitraum 2025
  assert.equal(d.shares, 260);
  assert.equal(d.dividendPerShare, 1.1);
  assert.equal(d.grossDividend, 286);
  assert.equal(d.withheldTax, 74.36);
  assert.equal(d.withholdingRatePercent, 26);
  assert.equal(d.currency, "EUR");
  assert.deepEqual(bankComputedRefundHint, { currency: "EUR", amount: 31.46 });
  assert.equal(refundFor(d).refund, 31.46);
});

test("Referenzantrag: Erstattung 33,00 + 23,76 = 56,76 €", () => {
  const a = dist({ paymentDate: "2024-05-08", grossDividend: 300, withheldTax: 78 });
  const b = dist({ paymentDate: "2025-05-07", grossDividend: 216, withheldTax: 56.16 });
  assert.deepEqual(refundFor(a), { taxDue: 45, refund: 33 });
  assert.deepEqual(refundFor(b), { taxDue: 32.4, refund: 23.76 });
  assert.equal(totalRefund([a, b]), 56.76);
});

test("Steuersatz: 26 % Regelfall, abweichend, nichts zu erstatten, unplausibel", () => {
  assert.equal(classifyWithholding(dist({}), TODAY).kind, "ok");
  assert.equal(classifyWithholding(dist({ withheldTax: 60, withholdingRatePercent: 20 }), TODAY).kind, "partial");
  assert.equal(classifyWithholding(dist({ withheldTax: 45, withholdingRatePercent: 15 }), TODAY).kind, "none");
  assert.equal(classifyWithholding(dist({ withheldTax: 0, withholdingRatePercent: null }), TODAY).kind, "none");
  assert.equal(classifyWithholding(dist({ withheldTax: 90 }), TODAY).kind, "high");
  assert.equal(classifyWithholding(dist({ grossDividend: null }), TODAY).kind, "invalid");
  // ausgewiesener Satz passt nicht zum Betrag -> Warnung, Betrag gilt
  const mismatch = classifyWithholding(dist({ withheldTax: 60, withholdingRatePercent: 26 }), TODAY);
  assert.equal(mismatch.kind, "partial");
  assert.equal(mismatch.rateMismatch, true);
  // abweichender Satz: nur der tatsächliche Abzug über 15 %
  assert.equal(refundFor(dist({ withheldTax: 60 })).refund, 15);
});

test("Frist: 48 Monate ab Zahltag", () => {
  assert.equal(classifyWithholding(dist({ paymentDate: "2022-11-01" }), TODAY).kind, "ok");
  assert.equal(classifyWithholding(dist({ paymentDate: "2022-10-30" }), TODAY).kind, "expired");
});

test("Nur bestätigte, erstattungsfähige Ausschüttungen kommen ins Formular", () => {
  assert.equal(isEligible(dist({}), TODAY), true);
  assert.equal(isEligible(dist({ extractionConfidence: "extracted" }), TODAY), false);
  assert.equal(isEligible(dist({ withheldTax: 0 }), TODAY), false);
});

test("Ein Form A je Unternehmen, höchstens 4 Zeilen, sortiert nach Zahltag", () => {
  const enel = ["2023-01-25", "2023-07-26", "2024-01-24", "2024-07-24", "2025-01-22"].map((p) =>
    dist({ isin: "IT0003128367", issuerName: "Enel S.p.A.", paymentDate: p })
  );
  const forms = formsFor([dist({ paymentDate: "2025-05-07" }), ...enel.reverse(), dist({ paymentDate: "2024-05-08" })]);
  assert.deepEqual(forms.map((f) => [f.issuerName, f.part, f.of, f.rows.length]), [
    ["Enel S.p.A.", 1, 2, 4],
    ["Enel S.p.A.", 2, 2, 1],
    ["Italmobiliare S.p.A.", 1, 1, 2],
  ]);
  assert.equal(forms[0].rows[0].paymentDate, "2023-01-25");
  assert.equal(forms[2].rows[0].paymentDate, "2024-05-08");
});

test("Jahresangaben wie im Referenzantrag", () => {
  assert.equal(yearsText([2025]), "2025");
  assert.equal(yearsText([2024, 2025]), "2024 and 2025");
  assert.equal(yearsText([2024, 2025], "&"), "2024 & 2025");
  assert.equal(yearsText([2023, 2024, 2025]), "2023-2025");
  assert.equal(yearsText([2022, 2024, 2025]), "2022, 2024 and 2025");
});

test("Angaben zum Zahler: eigene Eingabe > Liste > nur Name", () => {
  assert.equal(issuerDetails("IT0005253205", "Italmobiliare S.p.A.", {}).taxCode, "00796400158");
  assert.equal(issuerDetails("IT0005253205", "Italmobiliare S.p.A.", {}).source, "list");
  const own = issuerDetails("IT0005253205", "X", { issuers: { IT0005253205: { taxCode: "123" } } });
  assert.equal(own.taxCode, "123");
  assert.equal(own.source, "user");
  assert.deepEqual(issuerDetails("IT0000000000", "Unbekannt S.p.A.", {}), { name: "Unbekannt S.p.A.", taxCode: "", address: "", source: "none" });
});

test("Unternehmensliste: gültige IT-ISINs, Codice fiscale mit 11 Ziffern", () => {
  for (const [isin, s] of Object.entries(ITALIAN_SHARES)) {
    assert.ok(isin.startsWith("IT") && isValidIsin(isin), isin);
    assert.match(s.taxCode, /^\d{11}$/, isin);
  }
});
