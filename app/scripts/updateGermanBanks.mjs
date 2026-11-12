// Aktualisiert src/config/germanBanks.js aus der Bankleitzahlendatei der
// Deutschen Bundesbank (erscheint quartalsweise: März, Juni, September,
// Dezember). Aufruf:
//
//   npm run update-german-banks
//
// Die App selbst greift nie aufs Internet zu - die Liste wird beim Entwickeln
// geholt und als statische Datei mitgeliefert. So bleibt die IBAN des Nutzers
// auf seinem Gerät (lokale Erkennung IBAN -> BLZ -> Bank in "Persönliche Daten").

import { writeFile } from "node:fs/promises";

const BASE = "https://www.bundesbank.de";
const PAGE = `${BASE}/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592`;

// Der Download-Link enthält eine Prüfsumme und ändert sich mit jeder neuen
// Datei - deshalb wird er jedes Mal von der Download-Seite gelesen.
const page = await fetch(PAGE);
if (!page.ok) throw new Error(`Bundesbank-Seite antwortet mit HTTP ${page.status}`);
const csvPath = (await page.text()).match(/href="([^"]*blz-aktuell-csv-data\.csv)"/)?.[1];
if (!csvPath) throw new Error("Link auf blz-aktuell-csv-data.csv nicht gefunden - Seite umgebaut?");

const res = await fetch(new URL(csvPath, BASE));
if (!res.ok) throw new Error(`Bankleitzahlendatei antwortet mit HTTP ${res.status}`);
// Die Bundesbank liefert die CSV in ISO-8859-1, nicht in UTF-8.
const lines = new TextDecoder("windows-1252").decode(await res.arrayBuffer()).trim().split(/\r?\n/);
const header = lines.shift().split(";");
const col = (name) => header.indexOf(name);
const unquote = (s) => s.replace(/^"|"$/g, "");

const rows = lines
  .map((l) => l.split(";").map(unquote))
  .map((c) => ({
    blz: c[col("Bankleitzahl")],
    feature: c[col("Merkmal")],
    name: c[col("Bezeichnung")],
    postalCode: c[col("PLZ")],
    city: c[col("Ort")],
    bic: c[col("BIC")],
    deleted: c[col("Bankleitzahllöschung")] === "1",
    successor: c[col("Nachfolge-Bankleitzahl")],
  }))
  // Merkmal 1 = die Bank selbst, 2 = Filialen mit derselben BLZ
  .filter((r) => r.feature === "1");

if (rows.length < 2000) throw new Error(`Nur ${rows.length} Banken gelesen - Format geändert?`);

const byBlz = new Map(rows.map((r) => [r.blz, r]));

// Zur Löschung vorgemerkte BLZ (Fusionen) zeigen auf die Daten der
// Nachfolgebank - die alten IBANs bleiben ja noch eine Weile in Gebrauch.
function resolve(r) {
  for (let i = 0; i < 5 && r.deleted && byBlz.has(r.successor); i++) r = byBlz.get(r.successor);
  return r;
}

const banks = {};
for (const r of rows) {
  const t = resolve(r);
  banks[r.blz] = [t.name, t.postalCode, t.city, t.bic];
}

const today = new Date().toISOString().slice(0, 10);
const body = Object.entries(banks)
  .map(([blz, data]) => `  "${blz}": ${JSON.stringify(data)},`)
  .join("\n");

await writeFile(
  new URL("../src/config/germanBanks.js", import.meta.url),
  `// Deutsche Banken: Bankleitzahl -> [Name, PLZ, Ort, BIC].
// GENERIERT von scripts/updateGermanBanks.mjs am ${today} aus der
// Bankleitzahlendatei der Deutschen Bundesbank (${Object.keys(banks).length} Bankleitzahlen) -
// nicht von Hand ändern. Die Bundesbank-Datei enthält keine Straße.

export const GERMAN_BANKS = {
${body}
};
`
);

console.log(`src/config/germanBanks.js geschrieben: ${Object.keys(banks).length} Bankleitzahlen.`);
