// Textzeilen (wie lib/pdfText.js sie liefert) echter DAB BNP Paribas /
// Smartbroker-Dividendenabrechnungen für Thule Group AB. Beträge, Zahltage und
// Stückzahlen echt, Name, Adresse, Depot- und Steuernummern fiktiv.

const head = (abr, date, period, name2 = "Max Mustermann") => [
  "Erträgnisgutschrift aus Wertpapieren",
  "Dividende für",
  period,
  "Depot-Nr. Abrechnungs-Nr.",
  `1234567890 ${abr} / ${date}`,
  "Herr",
  "Max Mustermann",
  "Musterstr. 1",
  `80331 München Depotinhaber`,
  name2,
  `München, ${date}`,
  "Dividendengutschrift",
  "Gattungsbezeichnung ISIN",
  "Thule Group AB (publ) Namn-Aktier o.N. SE0006422390",
  "Nominal Ex-Tag Zahltag Dividenden-Betrag pro Stück",
];

export const thule2022 = [
  ...head("43832574", "10.10.2022", "01.01.2021 - 31.12.2021"),
  "STK 26,000 05.10.2022 11.10.2022 SEK 6,500000",
  "Wert Konto-Nr. Devisenkurs Betrag zu Ihren Gunsten",
  "11.10.2022 1234567890 EUR/SEK 10,9504 EUR 9,16",
  "Hinweise zur steuerlichen Verrechnung: vorher aktuell",
  "ausländische Dividende EUR 15,43",
  "ausländische Quellensteuer 30% SEK 50,70",
  "erstattungsfähige Quellensteuer 15% SEK 25,35",
  "anrechenbare Quellensteuer 15% EUR 2,31",
  "Steuerlicher Stichtag: 11.10.2022",
  "Verwahrart: Wertpapierrechnung Lagerland: Schweden",
];

export const thule2023May = [
  ...head("25222728", "04.05.2023", "01.01.2022 - 31.12.2022"),
  "STK 57,000 28.04.2023 05.05.2023 SEK 4,600000",
  "Wert Konto-Nr. Devisenkurs Betrag zu Ihren Gunsten",
  "05.05.2023 1234567890 EUR/SEK 11,3694 EUR 16,14",
  "Hinweise zur steuerlichen Verrechnung: vorher aktuell",
  "ausländische Dividende EUR 23,06",
  "ausländische Quellensteuer 30% SEK 78,66",
  "erstattungsfähige Quellensteuer 15% SEK 39,33",
  "anrechenbare Quellensteuer 15% EUR 3,46",
  "Steuerlicher Stichtag: 05.05.2023",
];

export const thule2023Oct = [
  ...head("40947611", "10.10.2023", "01.01.2022 - 31.12.2022"),
  "STK 57,000 04.10.2023 10.10.2023 SEK 4,600000",
  "Wert Konto-Nr. Devisenkurs Betrag zu Ihren Gunsten",
  "10.10.2023 1234567890 EUR/SEK 11,6345 EUR 13,40",
  "Hinweise zur steuerlichen Verrechnung: vorher aktuell",
  "ausländische Dividende EUR 22,54",
  "ausländische Quellensteuer 30% SEK 78,66",
  "erstattungsfähige Quellensteuer 15% SEK 39,33",
  "anrechenbare Quellensteuer 15% EUR 3,38",
  "Steuerlicher Stichtag: 10.10.2023",
];
