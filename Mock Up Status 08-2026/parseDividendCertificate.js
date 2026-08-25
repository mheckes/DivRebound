// parseDividendCertificate.js
//
// Extrahiert die relevanten Felder aus einer hochgeladenen Dividendenabrechnung
// (PDF einer deutschen/österreichischen/schweizer Depotbank) für einen Ziel-Corridor.
//
// KALIBRIERUNG: Die Muster in diesem Modul wurden gegen drei echte Abrechnungen
// getestet (comdirect: Calida Holding AG / CH-ISIN; Baader Bank/Smartbroker+:
// Novo-Nordisk AS / DK-ISIN; Trade Republic: McDonald's / US-ISIN). Zentrale
// Erkenntnisse daraus, die die Architektur prägen:
//
//   0. Trade Republic nutzt ENGLISCHE Zahlenschreibweise (Punkt als Dezimal-
//      trennzeichen: "3.72", "2.000000"), comdirect/Baader nutzen DEUTSCHE
//      Schreibweise (Komma: "795,00", "20,000"). Eine global angenommene
//      Formatannahme wäre hier ein STILLER Rechenfehler gewesen (3.72 -> 372),
//      kein Absturz mit Fehlermeldung. Das Zahlenformat wird deshalb pro
//      gefundenem Wert anhand der vorhandenen Trennzeichen erkannt.
//   0b. Namen können mehrteilige Vornamen haben ("Vinzenz Michael Schweizer") -
//      Nachname = letztes Wort der Zeile, alles davor = Vorname(n).
//
//   1. Name/Adresse tragen KEINE Labels ("Vorname:", "Straße:" existieren nicht) –
//      nur ein reiner Adressblock. Deshalb Positions-Heuristik statt Label-Matching.
//   2. Beträge wie "Bruttobetrag" oder "Quellensteuer" stehen oft mehrfach mit
//      unterschiedlichen Währungen in derselben Abrechnung (z.B. DKK-Betrag UND
//      EUR-Gegenwert). Deshalb wird IMMER die dem Corridor entsprechende
//      Zielwährung (CorridorConfig.nativeCurrency) explizit gesucht, nie nur das
//      erste Label-Vorkommen.
//   3. Die tatsächlich einbehaltene Quellensteuer wird nicht auf jeder Abrechnung
//      in der Fremdwährung ausgewiesen (bei Baader nur in EUR) – dafür aber fast
//      immer der Steuersatz in Prozent. Deshalb wird der Betrag in Zielwährung
//      wenn möglich direkt gelesen, sonst aus grossDividend(nativeCurrency) * rate
//      berechnet.
//   4. Manche Banken (hier: Baader/Smartbroker+) weisen den "rückforderbaren
//      Steuerbetrag" bereits selbst aus – als Cross-Check-Hinweis mit übernehmen,
//      NICHT als offizielles Feld ins Distribution-Schema (Währung/Berechnungsbasis
//      variiert je Bank, nicht verlässlich genug für automatische Übernahme).
//
// Nach wie vor gilt: extractionConfidence bleibt immer "extracted" und wird dem
// Nutzer im Bestätigungsschritt vorgelegt – auch kalibrierte Muster sind keine
// Garantie gegen abweichende Layouts anderer Banken.
//
// Abhängigkeit: pdfjs-dist (https://mozilla.github.io/pdf.js/)

import * as pdfjsLib from "pdfjs-dist";

/**
 * @param {ArrayBuffer} pdfBytes
 * @param {CorridorConfig} corridorConfig - liefert isinPrefix + nativeCurrency + standardWithholdingRate
 * @returns {Promise<ParseResult>}
 */
export async function parseDividendCertificate(pdfBytes, corridorConfig) {
  const lines = await extractTextLines(pdfBytes);
  const fullText = lines.join("\n");
  const { isinPrefix, nativeCurrency, standardWithholdingRate } = corridorConfig;

  const warnings = [];

  const isin = extractField(lines, ISIN_EXTRACTORS);
  const issuerName = extractIssuerName(lines);
  const paymentDate = extractField(lines, PAYMENT_DATE_EXTRACTORS, parseDateFlexible);
  const shares = extractField(lines, SHARES_EXTRACTORS, parseNumberFlexible);

  const grossDividend = extractAmountForCurrency(lines, GROSS_LABELS, nativeCurrency);
  const withholdingRatePercent = extractWithholdingRatePercent(lines);
  let withheldTax = extractAmountForCurrency(lines, WITHHOLDING_LABELS, nativeCurrency);

  if (withheldTax === null && grossDividend !== null && withholdingRatePercent !== null) {
    // Fallback: Betrag in Zielwährung nicht direkt ausgewiesen (z.B. Baader zeigt
    // Quellensteuer nur in EUR) → aus Bruttobetrag(nativeCurrency) * Satz ableiten.
    withheldTax = round2(grossDividend * (withholdingRatePercent / 100));
    warnings.push(
      `Einbehaltene Steuer wurde nicht direkt in ${nativeCurrency} gefunden und stattdessen ` +
        `aus Bruttobetrag × ${withholdingRatePercent}% berechnet. Bitte gegen die Original-Abrechnung prüfen.`
    );
  }

  if (
    withholdingRatePercent !== null &&
    Math.abs(withholdingRatePercent / 100 - standardWithholdingRate) > 0.001
  ) {
    warnings.push(
      `Ausgewiesener Quellensteuersatz (${withholdingRatePercent}%) weicht vom erwarteten ` +
        `Standardsatz (${standardWithholdingRate * 100}%) für diesen Corridor ab. Bitte prüfen.`
    );
  }

  // Bonus-Hinweis, falls die Bank den Erstattungsbetrag schon selbst berechnet hat
  // (z.B. Baader/Smartbroker+: "rückforderbarer Steuerbetrag"). Nur als Cross-Check,
  // nicht als verbindlicher Wert – Währung/Berechnungsgrundlage nicht garantiert
  // mit dem tatsächlichen SKAT-Erstattungsbetrag identisch.
  const bankComputedRefundHint = extractBankComputedRefundHint(lines);

  const addressBlock = extractAddressBlock(lines);
  const profileHints = {
    firstName: addressBlock?.firstName ?? null,
    lastName: addressBlock?.lastName ?? null,
    address: addressBlock?.street ?? null,
    postalCode: addressBlock?.postalCode ?? null,
    city: addressBlock?.city ?? null,
  };

  // --- ISIN-Präfix-Validierung (siehe Schema: nur Aktien des Zielkorridors) ---
  let isinValid = false;
  if (!isin) {
    warnings.push("Keine ISIN gefunden. Bitte manuell eintragen und prüfen.");
  } else if (!isin.startsWith(isinPrefix)) {
    warnings.push(
      `ISIN "${isin}" beginnt nicht mit "${isinPrefix}". Diese Abrechnung betrifft ein ` +
        `Wertpapier außerhalb des gewählten Korridors und wird nicht übernommen.`
    );
  } else {
    isinValid = true;
  }

  if (isinValid && !paymentDate) {
    warnings.push("Zahltag konnte nicht erkannt werden. Bitte manuell ergänzen.");
  }
  if (isinValid && (grossDividend === null || withheldTax === null)) {
    warnings.push(`Beträge in ${nativeCurrency} konnten nicht vollständig erkannt werden.`);
  }

  const distribution = isinValid
    ? {
        sourceFile: null, // wird vom Aufrufer mit dem tatsächlichen Dateinamen befüllt
        isin,
        securityType: "share",
        issuerName: issuerName ?? "",
        // Hinweis: taxYear bewusst aus dem Zahltag abgeleitet, NICHT aus dem
        // "Zahlungszeitraum"/Geschäftsjahr – beide können auseinanderfallen
        // (z.B. Geschäftsjahr 2025, Zahltag erst 31.03.2026). Für die
        // Verjährungsfrist zählt der tatsächliche Erhalt, also der Zahltag.
        taxYear: paymentDate ? Number(paymentDate.slice(0, 4)) : null,
        paymentDate,
        shares,
        grossDividend,
        withheldTax,
        currency: nativeCurrency,
        extractionConfidence: "extracted",
        withinLimitationPeriod: paymentDate
          ? isWithinLimitationPeriod(paymentDate, corridorConfig.limitationPeriodYears)
          : null,
      }
    : null;

  return { distribution, profileHints, isinValid, bankComputedRefundHint, warnings, rawText: fullText };
}

// ---------------------------------------------------------------------------
// Textrekonstruktion (unverändert gegenüber v1): PDF.js liefert Text-Items mit
// x/y-Koordinaten, keine fertigen Zeilen. Gruppierung nach ähnlicher y-Position.
// ---------------------------------------------------------------------------
async function extractTextLines(pdfBytes) {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const rows = new Map();
    const Y_TOLERANCE = 2;

    for (const item of content.items) {
      const y = item.transform[5];
      const rowKey = [...rows.keys()].find((k) => Math.abs(k - y) <= Y_TOLERANCE);
      const key = rowKey ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(item);
    }

    const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of sortedRows) {
      const lineText = items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (lineText) lines.push(lineText);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Adressblock: KEINE Labels vorhanden (weder comdirect noch Baader/Smartbroker+
// nutzen "Vorname:"/"Straße:"). Heuristik: PLZ+Ort-Zeile finden, davon ausgehend
// rückwärts eine Straßenzeile suchen, und UM DIE STRASSENZEILE HERUM (davor UND
// danach) nach einer sauberen Namenszeile suchen.
//
// Der zweite Teil ("davor UND danach") ist kein Sicherheits-Overkill, sondern
// wurde nötig, weil Baader/Smartbroker+ ein zweispaltiges Seitenlayout nutzt:
// bei reiner Y-Positions-Rekonstruktion landet dort eine zweite, aus einem
// Referenzblock stammende Namenszeile NACH der Straßenzeile, während die
// eigentliche Namenszeile davor mit einem Datum verschmolzen ist und deshalb
// nicht als sauberer NAME_LINE-Treffer erkannt wird. Nur mit reinem
// "vor der Straße suchen" hätte dieses reale Beispiel `null` geliefert.
// ---------------------------------------------------------------------------
const STREET_LINE = /^[A-ZÄÖÜa-zäöüß.\- ]+\s\d+[a-z]?$/;
const POSTAL_CITY_LINE = /^(\d{4,5})\s+([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜ][a-zäöüß]+)*)$/;
const SALUTATION_LINE = /^(Herrn|Frau)$/i;
// Nachname = letztes Wort der Zeile, alles davor = Vorname(n). Wichtig, weil
// "Vinzenz Michael Schweizer" (zwei Vornamen) sonst gar nicht als Name erkannt
// worden wäre - die ursprüngliche Fassung erlaubte nur genau zwei Wörter.
const NAME_LINE = /^([A-ZÄÖÜ][a-zäöüß]+(?:[\s-][A-ZÄÖÜ][a-zäöüß]+)*)\s+([A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?)$/;
const ADDRESS_SEARCH_WINDOW = 3;

function extractAddressBlock(lines) {
  for (let i = 0; i < lines.length; i++) {
    const postalMatch = lines[i].match(POSTAL_CITY_LINE);
    if (!postalMatch) continue;

    let streetIdx = null;
    for (let j = i - 1; j >= Math.max(i - 1 - ADDRESS_SEARCH_WINDOW, 0); j--) {
      if (STREET_LINE.test(lines[j])) {
        streetIdx = j;
        break;
      }
    }
    if (streetIdx === null) continue;

    const candidateIndices = [];
    for (let j = streetIdx - 1; j >= Math.max(streetIdx - 1 - ADDRESS_SEARCH_WINDOW, 0); j--) {
      candidateIndices.push(j);
    }
    for (let j = streetIdx + 1; j < Math.min(streetIdx + 1 + ADDRESS_SEARCH_WINDOW, i); j++) {
      candidateIndices.push(j);
    }

    let nameIdx = null;
    for (const j of candidateIndices) {
      if (SALUTATION_LINE.test(lines[j])) continue;
      if (NAME_LINE.test(lines[j])) {
        nameIdx = j;
        break;
      }
    }
    if (nameIdx === null) continue;

    const nameMatch = lines[nameIdx].match(NAME_LINE);
    return {
      firstName: nameMatch[1],
      lastName: nameMatch[2],
      street: lines[streetIdx],
      postalCode: postalMatch[1],
      city: postalMatch[2],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Emittentenname: zwei bekannte Tabellen-Layouts, je nach Bank.
//   Baader/Smartbroker+ :  "STK 100 Novo-Nordisk AS DKK 7,95 p.STK"
//   comdirect           :  "per 20.04.2026 Calida Holding AG A1JJES"
// ---------------------------------------------------------------------------
const ISSUER_PATTERNS = [
  /STK\s+[\d.,]+\s+(.+?)\s+(?:DKK|CHF|EUR|USD|SEK|NOK)\s+[\d.,]+\s*p\.?\s*STK/i,
  /per\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+(.+?)\s+[A-Z0-9]{4,6}$/,
];

function extractIssuerName(lines) {
  for (const line of lines) {
    for (const pattern of ISSUER_PATTERNS) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }
  }

  // Fallback für Layouts wie Trade Republic, bei denen der Name in einer eigenen
  // Zeile direkt VOR der Zeile mit ISIN/Stückzahl/Betrag steht, z.B.:
  //   "McDonald's"
  //   "US5801351017 2.000000 Stücke 1.86 USD 3.72 USD"
  for (let i = 1; i < lines.length; i++) {
    const isinMatch = lines[i].match(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/);
    if (!isinMatch) continue;
    const prevLine = lines[i - 1]?.trim();
    if (prevLine && prevLine.length < 40 && !/\d/.test(prevLine)) {
      return prevLine;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Währungsbewusste Betragsextraktion: sucht Zeilen, die eines der Labels
// UND die geforderte Zielwährung enthalten – verhindert, dass versehentlich
// der EUR-Gegenwert statt des nativen Betrags gezogen wird.
//
// "GESAMT" wurde als Gross-Label ergänzt, nachdem sich zeigte, dass Trade
// Republic keine "Bruttobetrag"-Zeile nutzt, sondern den Gesamtbetrag pro
// Position als "GESAMT <Betrag> <Währung>" ausweist. Da GESAMT bei Trade
// Republic auch für die Nettosumme in der Abrechnungssektion auftaucht
// (andere Währung), verhindert der Währungs-Filter hier eine Verwechslung -
// "GESAMT 477.00 DKK" vs. "GESAMT 39.89 EUR" im selben Dokument.
//
// Die Regex wurde außerdem erweitert: Baader schreibt die Währung VOR dem
// Betrag ("DKK 795,00"), Trade Republic NACH dem Betrag ("477.00 DKK") -
// beide Reihenfolgen werden jetzt erkannt.
// ---------------------------------------------------------------------------
const GROSS_LABELS = ["Bruttobetrag", "Bruttodividende", "GESAMT"];
const WITHHOLDING_LABELS = ["Quellensteuer"]; // bewusst NICHT "Quellensteuer-Anrechnung" (andere Bedeutung, siehe unten)

function extractAmountForCurrency(lines, labels, currency) {
  for (const line of lines) {
    if (/Quellensteuer-Anrechnung/i.test(line)) continue; // andere Kennzahl, keine Ist-Steuer
    for (const label of labels) {
      if (!line.includes(label)) continue;
      const pattern = new RegExp(`${currency}\\s*(-?[\\d.,]+)|(-?[\\d.,]+)\\s*${currency}\\b`, "i");
      const match = line.match(pattern);
      if (match) {
        const parsed = parseNumberFlexible(match[1] ?? match[2]);
        return parsed === null ? null : Math.abs(parsed); // Vorzeichen (z.B. Trade-Republic-Minus) nicht ins Schema übernehmen
      }
    }
  }
  return null;
}

function extractWithholdingRatePercent(lines) {
  for (const line of lines) {
    if (/Quellensteuer-Anrechnung/i.test(line)) continue;
    const match = line.match(/([\d]+,\d+)\s*%\s*Quellensteuer|Quellensteuer\s*(\d+,\d+)\s*%/i);
    if (match) return parseNumberFlexible(match[1] ?? match[2]);
  }
  return null;
}

function extractBankComputedRefundHint(lines) {
  for (const line of lines) {
    const match = line.match(/rückforderbare[rn]?\s*Steuerbetrag\s*([A-Z]{3})?\s*([\d.,]+)/i);
    if (match) {
      return { currency: match[1] ?? null, amount: parseNumberFlexible(match[2]) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ISIN / Zahltag / Stückzahl
// ---------------------------------------------------------------------------
const ISIN_EXTRACTORS = [/ISIN[:\s]*([A-Z]{2}[A-Z0-9]{9}\d)/i, /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/];

const PAYMENT_DATE_EXTRACTORS = [
  /Zahltag[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i,
  /zahlbar\s+ab\s+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i,
  /Valuta[:\s]+(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/i,
  // Trade Republic nennt keinen "Zahltag" explizit, sondern nur eine Buchungszeile
  // "<IBAN> <Datum> <Betrag>" unter "DATUM DER ZAHLUNG" – Datum direkt hinter der IBAN.
  /[A-Z]{2}\d{2}[\dA-Z]{10,30}\s+(\d{1,2}\.\d{1,2}\.\d{4})/,
];

const SHARES_EXTRACTORS = [
  /STK\s+([\d.,]+)/i, // comdirect/Baader: "STK 100"
  /([\d.,]+)\s*St(?:ü|u)cke/i, // Trade Republic: "2.000000 Stücke" (Zahl VOR der Einheit)
];

function extractField(lines, extractors, transform = (v) => v?.trim() ?? null) {
  for (const line of lines) {
    for (const pattern of extractors) {
      const match = line.match(pattern);
      if (match) return transform(match[1]);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zahlen-/Datumsparsing (unverändert): deutsches Format (1.234,56) ist Standard
// auf DE/AT/CH-Depotauszügen, auch für Fremdwährungsbeträge.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Zahlenparsing: NICHT mehr "deutsches Format" annehmen. Trade Republic nutzt
// englische Schreibweise (Punkt = Dezimaltrennzeichen: "3.72", "2.000000"),
// während comdirect/Baader deutsche Schreibweise nutzen (Komma = Dezimaltrenn-
// zeichen: "795,00", "20,000"). Eine falsche Annahme hier ist kein Absturz,
// sondern ein STILLER Zahlenfehler (z.B. "3.72" USD würde zu 372 werden) –
// deshalb wird das Format pro Zahl anhand vorhandener Trennzeichen erkannt,
// nicht global für das ganze Dokument angenommen.
// ---------------------------------------------------------------------------
function parseNumberFlexible(raw) {
  if (!raw) return null;
  const value = raw.trim();
  const hasComma = value.includes(",");
  const hasDot = value.includes(".");

  let normalized;
  if (hasComma && hasDot) {
    // Beide vorhanden: das letzte Vorkommen ist der Dezimaltrenner, das davor
    // liegende ist eine Tausendergruppierung. Z.B. "1.234,56" (DE) oder
    // "1,234.56" (EN).
    normalized =
      value.lastIndexOf(",") > value.lastIndexOf(".")
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/,/g, "");
  } else if (hasComma) {
    normalized = value.replace(",", "."); // nur Komma -> deutsches Dezimalformat
  } else {
    normalized = value; // nur Punkt (oder nichts) -> englisches/Standard-Dezimalformat
    // Bekannte Grenze: ein reiner Tausender-Punkt ohne Nachkommastellen
    // (z.B. "1.234" als "1234" gemeint) wird hier fälschlich als 1.234 gelesen.
    // In der Praxis kommen in diesen Abrechnungen aber keine so großen
    // Stückzahlen/Beträge ohne Dezimalstellen vor - dokumentierte Annahme,
    // kein stillschweigend gelöstes Problem.
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function parseDateFlexible(raw) {
  if (!raw) return null;
  const match = raw.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (!match) return null;
  let [, day, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isWithinLimitationPeriod(paymentDateIso, limitationYears) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - limitationYears);
  return new Date(paymentDateIso) >= cutoff;
}
