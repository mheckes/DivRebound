// Aktualisiert src/config/swissShares.js aus der offiziellen Aktienliste der
// SIX Swiss Exchange (Segment Aktien, nur Schweizer ISINs). Aufruf:
//
//   npm run update-swiss-shares
//
// Die App selbst greift nie aufs Internet zu - die Liste wird beim Entwickeln
// geholt und als statische Datei mitgeliefert (lokale Erkennung ISIN -> Name
// bei der manuellen Erfassung im Wertpapierbestand).

import { writeFile } from "node:fs/promises";

const SIX_URL =
  "https://www.six-group.com/fqs/ref.csv" +
  "?select=ShortName,ISIN,IssuerNameFull,SecTypeDesc" +
  "&where=PortalSegment=EQ&orderby=ShortName&page=1&pagesize=99999";

const SEC_TYPE_DE = {
  "Registered Share": "Namenaktie",
  "Bearer Share": "Inhaberaktie",
  "Participation Certificate": "Partizipationsschein",
};

const res = await fetch(SIX_URL);
if (!res.ok) throw new Error(`SIX antwortet mit HTTP ${res.status}`);
// Die SIX liefert die CSV in Windows-1252 (Latin-1), nicht in UTF-8.
const lines = new TextDecoder("windows-1252").decode(await res.arrayBuffer()).trim().split(/\r?\n/);
const header = lines.shift().split(";");
const col = (name) => header.indexOf(name);

const rows = lines
  .map((l) => l.split(";"))
  .map((c) => ({ shortName: c[col("ShortName")], isin: c[col("ISIN")], issuer: c[col("IssuerNameFull")], type: c[col("SecTypeDesc")] }))
  // nur Schweizer Titel, ohne zweite Handelslinien (Aktienrückkauf)
  .filter((r) => r.isin?.startsWith("CH") && !/2\.\s*LINIE/i.test(r.shortName));

// Hat ein Emittent mehrere Titel (z.B. Namen- und Partizipationsschein),
// wird die Gattung an den Namen gehängt.
const perIssuer = {};
for (const r of rows) perIssuer[r.issuer] = (perIssuer[r.issuer] ?? 0) + 1;

const shares = {};
for (const r of rows.sort((a, b) => a.issuer.localeCompare(b.issuer, "de"))) {
  const suffix = perIssuer[r.issuer] > 1 && SEC_TYPE_DE[r.type] ? ` (${SEC_TYPE_DE[r.type]})` : "";
  shares[r.isin] = `${r.issuer}${suffix}`;
}

const today = new Date().toISOString().slice(0, 10);
const body = Object.entries(shares)
  .map(([isin, name]) => `  ${isin}: ${JSON.stringify(name)},`)
  .join("\n");

await writeFile(
  new URL("../src/config/swissShares.js", import.meta.url),
  `// Schweizer Aktien an der SIX Swiss Exchange: ISIN -> Name des Emittenten.
// GENERIERT von scripts/updateSwissShares.mjs am ${today} aus der offiziellen
// Aktienliste der SIX (${Object.keys(shares).length} Titel) - nicht von Hand ändern.

export const SWISS_SHARES = {
${body}
};
`
);
console.log(`${Object.keys(shares).length} Schweizer Aktien geschrieben.`);
