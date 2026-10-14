// Auswertung von Wertpapierabrechnungen (Kauf/Verkauf) und Tax-Voucher-
// Anschreiben für den Wertpapierbestand Schweiz (docs/konzept-schweiz.md §4).
// Arbeitet auf den Textzeilen aus lib/pdfText.js und ist bewusst frei von
// pdf.js, damit es mit `npm test` direkt geprüft werden kann.
//
// KALIBRIERUNG: Baader Bank / Smartbroker+ (Kaufabrechnungen 09.01.2026 und
// 27.04.2026, Tax-Voucher-Anschreiben 17.07.2026). Verkaufsabrechnungen sind
// noch nicht an einem echten Beleg geprüft - angenommen wird derselbe Aufbau
// mit "Wertpapierabrechnung: Verkauf".
//
// Erkenntnisse aus den Referenzbelegen:
// - Erwerbsdatum ist der HANDELSTAG aus "Details zur Ausführung", nicht das
//   Auftragsdatum (Kauf 27.04.2026: Auftrag 17.04., Valuta 29.04.). Das erste
//   Datum im Dokument ist das Briefdatum - nie verwenden.
// - Ein Auftrag kann in mehreren Ausführungszeilen abgerechnet werden
//   (Teilausführungen, ggf. an verschiedenen Tagen): jede Zeile wird eine
//   eigene Transaktion, die Summe wird gegen "STK n" im Kopf geprüft.
// - Tax Voucher: Das Anschreiben (Seite 1) enthält ISIN, Stückzahl und
//   Vorgangs-Nr. als Text. Der eigentliche Voucher mit dem Dividendentermin
//   (Seite 2) ist eine Grafik ohne Text - der Termin muss deshalb aus der
//   Dividendenabrechnung kommen oder vom Nutzer bestätigt werden.
// - Ein Dividendentermin kann mehrere Voucher mit derselben Vorgangs-Nr. haben
//   (Referenz: 20 + 5 Stück); unterscheiden lassen sie sich über die Referenz-Nr.

const ISIN = /\bISIN:\s*([A-Z]{2}[A-Z0-9]{9}\d)\b/;
const DATE_DE = /\b(\d{2})\.(\d{2})\.(\d{4})\b/;

function toIsoDate(match) {
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** Stückzahlen in deutscher Schreibweise: "3", "1.000", "2,5". */
function parseQuantity(raw) {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function findValue(lines, pattern) {
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function detectBroker(lines) {
  if (lines.some((l) => /Baader Bank/i.test(l))) return "baader";
  return null;
}

function headerSection(lines) {
  const isinIdx = lines.findIndex((l) => ISIN.test(l));
  const isin = isinIdx >= 0 ? lines[isinIdx].match(ISIN)[1] : null;
  // Zeile nach der ISIN: "STK 3 Jungfraubahn Holding AG EUR 300,00"
  let quantity = null;
  let issuerName = "";
  for (let i = isinIdx + 1; isinIdx >= 0 && i < Math.min(lines.length, isinIdx + 4); i++) {
    const m = lines[i].match(/^STK\s+([\d.,]+)\s*(.*)$/);
    if (m) {
      quantity = parseQuantity(m[1]);
      issuerName = m[2].replace(/\s+[A-Z]{3}\s+[\d.,]+$/, "").trim();
      break;
    }
  }
  const vorgang = findValue(lines, /Vorgangs-Nr\.:\s*(\d+)/);
  const referenz = findValue(lines, /Referenz-Nr\.:\s*(\d+)/);
  return {
    isin,
    issuerName,
    quantity,
    depotId: findValue(lines, /Depot-Nr\.:\s*(\d+)/) ?? "",
    vorgangsNr: vorgang,
    documentRef: vorgang && referenz ? `${vorgang}/${referenz}` : vorgang ?? referenz ?? null,
  };
}

function parseExecutions(lines) {
  const start = lines.findIndex((l) => /^Details zur Ausführung/i.test(l));
  if (start < 0) return [];
  const executions = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^(Verwahrart|Lagerstelle|Lagerland|Für die Ausführung)/.test(line)) break;
    const m = line.match(/^STK\s+([\d.,]+)\b/);
    if (!m) continue;
    const date = line.match(DATE_DE);
    executions.push({ quantity: parseQuantity(m[1]), tradeDate: toIsoDate(date) });
  }
  return executions;
}

/**
 * @param {string[]} lines Textzeilen aus lib/pdfText.js
 * @returns {(
 *   { kind: "trade", broker: string|null, type: "buy"|"sell", isin: string|null, issuerName: string, depotId: string, documentRef: string|null,
 *     executions: { quantity: number|null, tradeDate: string|null }[], warnings: string[] }
 * | { kind: "taxVoucher", broker: string|null, isin: string|null, issuerName: string, depotId: string, documentRef: string|null,
 *     vorgangsNr: string|null, quantity: number|null, letterDate: string|null, warnings: string[] }
 * | { kind: "unknown", broker: string|null, warnings: string[] }
 * )}
 */
export function parseStatementLines(lines) {
  const broker = detectBroker(lines);
  const tradeLine = lines.find((l) => /^Wertpapierabrechnung:\s*(Kauf|Verkauf)\b/i.test(l));

  if (tradeLine) {
    const header = headerSection(lines);
    const type = /Verkauf/i.test(tradeLine) ? "sell" : "buy";
    const warnings = [];
    let executions = parseExecutions(lines);

    if (executions.length === 0) {
      warnings.push("Handelstag nicht gefunden – bitte aus der Abrechnung übernehmen (nicht das Auftragsdatum).");
      executions = [{ quantity: header.quantity, tradeDate: null }];
    }
    const sum = executions.reduce((s, e) => s + (e.quantity ?? 0), 0);
    if (header.quantity !== null && sum !== header.quantity) {
      warnings.push(`Summe der Ausführungen (${sum}) passt nicht zur Stückzahl der Abrechnung (${header.quantity}).`);
    }
    if (!header.isin) warnings.push("ISIN nicht gefunden.");

    return {
      kind: "trade",
      broker,
      type,
      isin: header.isin,
      issuerName: header.issuerName,
      depotId: header.depotId,
      documentRef: header.documentRef,
      executions,
      warnings,
    };
  }

  if (lines.some((l) => /^Tax Voucher\b/i.test(l))) {
    const header = headerSection(lines);
    const warnings = [];
    if (!header.isin) warnings.push("ISIN nicht gefunden.");
    if (header.quantity === null) warnings.push("Stückzahl nicht gefunden.");
    // Briefdatum steht oben rechts neben dem Namen ("Max Mustermann 17.07.2026")
    const letterDate = toIsoDate(lines.slice(0, 12).map((l) => l.match(DATE_DE)).find(Boolean) ?? null);
    return {
      kind: "taxVoucher",
      broker,
      isin: header.isin,
      issuerName: header.issuerName,
      depotId: header.depotId,
      documentRef: header.documentRef,
      vorgangsNr: header.vorgangsNr,
      quantity: header.quantity,
      letterDate,
      warnings,
    };
  }

  return { kind: "unknown", broker, warnings: ["Dokument nicht erkannt – keine Wertpapierabrechnung und kein Tax Voucher."] };
}
