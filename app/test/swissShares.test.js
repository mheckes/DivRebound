import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidIsin } from "../src/util/validate.js";
import { SWISS_SHARES } from "../src/config/swissShares.js";

test("ISIN-Prüfziffer: gültige und ungültige ISINs", () => {
  assert.equal(isValidIsin("CH0017875789"), true); // Jungfraubahn
  assert.equal(isValidIsin("CH0038863350"), true); // Nestlé
  assert.equal(isValidIsin("DK0062498333"), true); // Novo Nordisk
  assert.equal(isValidIsin("US0378331005"), true); // Apple
  assert.equal(isValidIsin("CH0017875788"), false); // Prüfziffer falsch
  assert.equal(isValidIsin("CH0017875"), false);
  assert.equal(isValidIsin(""), false);
});

test("SIX-Liste: nur Schweizer ISINs mit gültiger Prüfziffer, Referenzfall enthalten", () => {
  const entries = Object.entries(SWISS_SHARES);
  assert.ok(entries.length > 150);
  for (const [isin, name] of entries) {
    assert.ok(isin.startsWith("CH"), isin);
    assert.ok(isValidIsin(isin), `ungültige Prüfziffer: ${isin}`);
    assert.ok(name.trim().length > 0, isin);
  }
  assert.equal(SWISS_SHARES.CH0017875789, "Jungfraubahn Holding AG");
});

test("Einheitlicher Name je ISIN: SIX-Liste vor Bestand, sonst erster erfasster Name", async () => {
  const { shareNames } = await import("../src/util/shareNames.js");
  const names = shareNames([
    { isin: "CH0017875789", issuerName: "Jungfraubahn (selbst getippt)", source: { importedAt: "2026-01-01" } },
    { isin: "CH1234567890", issuerName: "Erster Name", source: { importedAt: "2026-01-01" } },
    { isin: "CH1234567890", issuerName: "Zweiter Name", source: { importedAt: "2026-02-01" } },
  ]);
  assert.equal(names.nameFor("CH0017875789"), "Jungfraubahn Holding AG");
  assert.equal(names.sourceFor("CH0017875789"), "six");
  assert.equal(names.nameFor("CH1234567890"), "Erster Name");
  assert.equal(names.sourceFor("CH1234567890"), "bestand");
  assert.equal(names.nameFor("CH9999999999"), "");
});
