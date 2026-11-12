import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidIban } from "../src/util/validate.js";
import { lookupGermanBank, deriveBankFields } from "../src/util/bankLookup.js";
import { GERMAN_BANKS } from "../src/config/germanBanks.js";

test("IBAN-Prüfziffer: gültige und ungültige IBANs", () => {
  assert.equal(isValidIban("DE89370400440532013000"), true); // Beispiel-IBAN Commerzbank Köln
  assert.equal(isValidIban("de89 3704 0044 0532 0130 00"), true); // Leerzeichen, Kleinbuchstaben
  assert.equal(isValidIban("CH9300762011623852957"), true);
  assert.equal(isValidIban("AT611904300234573201"), true);
  assert.equal(isValidIban("DE89370400440532013001"), false); // Prüfziffer falsch
  assert.equal(isValidIban("DE8937040044053201300"), false); // eine Stelle zu kurz
  assert.equal(isValidIban(""), false);
});

test("Bundesbank-Liste: 8-stellige BLZ, Name und BIC vorhanden", () => {
  const entries = Object.entries(GERMAN_BANKS);
  assert.ok(entries.length > 2000);
  for (const [blz, [name, postalCode]] of entries) {
    assert.match(blz, /^\d{8}$/);
    assert.ok(name, blz);
    assert.match(postalCode, /^\d{5}$/, blz);
  }
});

test("Bank aus deutscher IBAN erkennen", async () => {
  const bank = await lookupGermanBank("DE89 3704 0044 0532 0130 00");
  assert.equal(bank.bic, "COBADEFFXXX");
  assert.match(bank.name, /Commerzbank/);
  assert.equal(bank.city, "Köln");
  assert.equal(await lookupGermanBank("DE89370400440532013001"), null); // ungültig
  assert.equal(await lookupGermanBank("CH9300762011623852957"), null); // nicht deutsch
});

test("Bankfelder: leere füllen, eigenen Namen derselben Bank behalten, bei Bankwechsel ersetzen", async () => {
  const iban = "DE89370400440532013000";
  const empty = await deriveBankFields({ bank: { iban, bankName: "", bic: "", address: "" } });
  assert.deepEqual(Object.keys(empty.values).sort(), ["bankAddress", "bankName", "bic"]);
  assert.match(empty.values.bankAddress, /^\d{5} Köln$/);

  const sameBank = await deriveBankFields({ bank: { iban, bankName: "Meine Commerzbank", bic: "COBADEFFXXX", address: "Unter Sachsenhausen 21, 50667 Köln" } });
  assert.deepEqual(sameBank.values, {});

  const otherBank = await deriveBankFields({ bank: { iban, bankName: "Sparkasse", bic: "COLSDE33XXX", address: "Irgendwo 1" } });
  assert.equal(otherBank.values.bic, "COBADEFFXXX");
  assert.match(otherBank.values.bankName, /Commerzbank/);
});
