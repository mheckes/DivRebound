// Textzeilen echter comdirect-Geschäftsabrechnungen (Seite 1, gekürzt),
// persönliche Daten, Depot- und Belegnummern anonymisiert.

const head = [
  "Ihren Auftrag haben wir gemäß unseren produktbezogenen",
  "25449 Quickborn",
  "Depotnr.: 1234567 00",
  "BLZ: 200 411 55",
  "Max Mustermann",
];

const tail = [
  "Ihre Wertpapier-Order wurde über das Online Banking erteilt.",
  "Ihre comdirect",
  "Datum: 28.10.2024",
  "Depotnummer: 1234567 00",
  "Steuerliche Behandlung: Wertpapierkauf Nr. 92000002 vom 25.10.2024",
  "Stk. 2 JUNGFRAUB. HLDG NA SF 1,5 , WKN / ISIN: A0CACJ / CH0017875789",
];

/** Live Trading in EUR, kein Teilausführungs-Zusatz */
export const comdirectBuyEur = [
  ...head,
  "GESCHÄFTSABRECHNUNG VOM 11.03.2024",
  "*",
  "Wertpapierkauf",
  "Geschäftsnummer : 92 000001",
  "Ordernummer : 000300000001-001 Rechnungsnummer : 600000000001AA00",
  "Geschäftstag : 11.03.2024 Abwicklung : Live Trading",
  "Wertpapier-Bezeichnung WPKNR/ISIN",
  "Jungfraubahn Holding AG A0CACJ",
  "Nam.-Akt. SF 1,50 CH0017875789",
  "Nennwert Zum Preis von",
  "St. 15 EUR 180,00",
  "Kurswert : EUR 2.700,00",
  "DE00 0000 0000 0000 0000 00 EUR 13.03.2024 EUR 2.711,65",
  ...tail,
];

/** Börse SIX in CHF, Teilausführung ("restliche"), Briefdatum != Geschäftstag */
export const comdirectBuyChfPartial = [
  ...head,
  "GESCHÄFTSABRECHNUNG VOM 28.10.2024",
  "*",
  "Wertpapierkauf restliche",
  "Geschäftsnummer : 92 000002",
  "Ordernummer : 000400000001-002 Rechnungsnummer : 600000000002AA00",
  "Geschäftstag : 25.10.2024 Ausführungsplatz : LND SWX EUROPE",
  "Wertpapier-Bezeichnung WPKNR/ISIN",
  "Jungfraubahn Holding AG A0CACJ",
  "Nam.-Akt. SF 1,50 CH0017875789",
  "Nennwert Zum Kurs von",
  "St. 2 CHF 168,00",
  "Kurswert : CHF 336,00",
  "Umrechn. zum Dev. kurs 0,935400 vom 28.10.2024 : EUR 363,84",
  "DE00 0000 0000 0000 0000 00 EUR 29.10.2024 EUR 376,74",
  "Teilausführung Ihrer Order",
  ...tail,
];
