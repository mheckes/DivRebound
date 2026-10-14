// Textzeilen echter Baader/Smartbroker+-Belege, so wie lib/pdfText.js sie
// liefert. ANONYMISIERT: Name, Anschrift, Stamm-/Depot-/Konto-Nr. sowie
// Vorgangs- und Referenz-Nr. sind ersetzt; ISIN, Stückzahlen, Kurse und Daten
// sind original. Der Fußtext der Bank ist gekürzt.

const letterHead = (date) => [
  "Baader Bank AG Weihenstephaner Straße 4 85716 Unterschleißheim Smartbroker AG",
  "T 00800 00 586336* F +49 89 5150 2442 service@baaderbank.de Ritterstraße 11",
  "10969 Berlin",
  "Seite 1/1",
  "Berlin",
  `Max Mustermann ${date}`,
  "Musterstraße 1",
  "Max Mustermann",
  "80331 München Stamm-Nr.: 1234567 Portfolio: 1",
  "Depot-Nr.: 1234567001",
];

const footer = [
  "Dieses Dokument wurde maschinell erstellt und wird nicht unterschrieben.",
  "smartbrokerplus.de",
  "Gesellschaft: Unterschleißheim • StNr. 143/107/04009 • USt-IdNr. DE114123893 • LEI: 529900JFOPPEDUR61H13 • T 00800 00 586336* • service@baaderbank.de",
];

/** Kauf 2 Stück, Auftrag und Handelstag 09.01.2026 */
export const buyJanuary = [
  ...letterHead("09.01.2026"),
  "Vorgangs-Nr.: 600000001",
  "Referenz-Nr.: 900000001",
  "Wertpapierabrechnung: Kauf",
  "Auftragsdatum: 09.01.2026 Ausführungsplatz: GETTEX - MM Munich",
  "Auftragszeit: 11:07:23:00",
  "Nominale ISIN: CH0017875789 WKN: A0CACJ Kurs",
  "STK 2 Jungfraubahn Holding AG EUR 310,00",
  "Nam.-Akt. SF 1,50",
  "Auftraggeber: Depotinhaber",
  "Art der Auftragserteilung: Orderroutingssystem",
  "Kurswert EUR 620,00",
  "Zu Lasten Konto 1234567002 Valuta: 13.01.2026 EUR 620,00",
  "Die Wertpapiere buchen wir zu Gunsten Ihres Depots.",
  "Details zur Ausführung:",
  "Handels- Handels-",
  "Nominale Kurs Ausführungsplatz datum uhrzeit",
  "STK 2 EUR 310,00 GETTEX - MM Munich 09.01.2026 11:19:56:193",
  "Verwahrart: Girosammelverwahrung Zeitzone der Handelsuhrzeit: MEZ/MESZ",
  "Lagerstelle: 100 MIC des Ausführungsplatzes: MUNC",
  "Lagerland: Deutschland",
  ...footer,
];

/** Kauf 3 Stück: Auftrag 17.04.2026, Handelstag 27.04.2026, Valuta 29.04.2026 */
export const buyApril = [
  ...letterHead("27.04.2026"),
  "Vorgangs-Nr.: 600000002",
  "Referenz-Nr.: 900000002",
  "Wertpapierabrechnung: Kauf",
  "Auftragsdatum: 17.04.2026 Ausführungsplatz: GETTEX - MM Munich",
  "Auftragszeit: 16:00:20:00",
  "Nominale ISIN: CH0017875789 WKN: A0CACJ Kurs",
  "STK 3 Jungfraubahn Holding AG EUR 300,00",
  "Nam.-Akt. SF 1,50",
  "Auftraggeber: Depotinhaber",
  "Art der Auftragserteilung: Orderroutingssystem",
  "Kurswert EUR 900,00",
  "Zu Lasten Konto 1234567002 Valuta: 29.04.2026 EUR 900,00",
  "Die Wertpapiere buchen wir zu Gunsten Ihres Depots.",
  "Details zur Ausführung:",
  "Handels- Handels-",
  "Nominale Kurs Ausführungsplatz datum uhrzeit",
  "STK 3 EUR 300,00 GETTEX - MM Munich 27.04.2026 16:57:14:801",
  "Verwahrart: Girosammelverwahrung Zeitzone der Handelsuhrzeit: MEZ/MESZ",
  "Lagerstelle: 100 MIC des Ausführungsplatzes: MUNC",
  "Lagerland: Deutschland",
  ...footer,
];

/**
 * KONSTRUIERT (kein echter Beleg): Verkauf 50 Stück in zwei Teilausführungen
 * an zwei Tagen, im Aufbau der Kaufabrechnungen.
 */
export const sellPartialExecutions = [
  ...letterHead("13.02.2025"),
  "Vorgangs-Nr.: 600000003",
  "Referenz-Nr.: 900000003",
  "Wertpapierabrechnung: Verkauf",
  "Auftragsdatum: 11.02.2025 Ausführungsplatz: GETTEX - MM Munich",
  "Nominale ISIN: CH0012345678 WKN: A1B2C3 Kurs",
  "STK 1.050 Muster Holding AG EUR 98,40",
  "Details zur Ausführung:",
  "Handels- Handels-",
  "Nominale Kurs Ausführungsplatz datum uhrzeit",
  "STK 1.000 EUR 98,40 GETTEX - MM Munich 11.02.2025 15:02:11:120",
  "STK 50 EUR 98,10 GETTEX - MM Munich 12.02.2025 09:14:55:004",
  "Verwahrart: Girosammelverwahrung Zeitzone der Handelsuhrzeit: MEZ/MESZ",
  ...footer,
];

/** Tax-Voucher-Anschreiben, 5 Stück (zweiter Voucher desselben Termins: 20 Stück) */
export const taxVoucher5 = [
  ...letterHead("17.07.2026"),
  "Vorgangs-Nr.: 5000001",
  "Referenz-Nr.: 1000000002",
  "Tax Voucher",
  "Bestand",
  "Nominale ISIN: CH0017875789 WKN: A0CACJ",
  "STK 5 Jungfraubahn Holding AG",
  "Nam.-Akt. SF 1,50",
  "Guten Tag Max Mustermann,",
  "zu Ihrer Dividenden-/Zinsgutschrift senden wir Ihnen beiliegenden „Tax Voucher“ zu.",
  "Diesen benötigen Sie gegebenenfalls für die Rückerstattung der Schweizer Quellensteuer.",
  ...footer,
];
