// CorridorConfig-Registry. Ein neues Zielland bedeutet laut Briefing: neue
// CorridorConfig + neuer Extraktions-Parser. Die Schweiz weicht davon ab
// (docs/konzept-schweiz.md §3.3): anderer Ablauf (flow: "portal" statt
// "form+portal"), Erfassung über Kauf-Tranchen statt einzelner Ausschüttungen,
// ein Antrag für mehrere Jahre.

export const corridors = {
  DK: {
    targetCountry: "DK",
    residencyCountries: ["DE", "AT", "CH"],
    residencyFormId: "02.050",
    // Bewusst NICHT die allgemeine SKAT-Login-Seite (die verlangt MitID, das
    // Nicht-Dänen nicht haben) - dieser Direktlink führt zum Formular ohne
    // MitID-Zwang, siehe skat.dk (Companies/Foundations > Claiming refund of
    // Danish dividend tax > "How to claim").
    onlinePortalUrl: "https://udbytterefusion.skat.dk/SelfService/submission/submit/Skattestyrelsen",
    requiresLogin: false,
    maxDistributionsPerClaim: 20,
    limitationPeriodYears: 3,
    standardWithholdingRate: 0.27,
    treatyRateByResidence: { DE: 0.15, AT: 0.15, CH: 0.15 },
    isinPrefix: "DK",
    nativeCurrency: "DKK",
    flow: "form+portal",
  },
  CH: {
    targetCountry: "CH",
    // Vorerst nur deutsche Ansässige (DBA DE-CH, Formular DIP-0085).
    residencyCountries: ["DE"],
    flow: "portal",
    // Einstieg über das ePortal des Bundes, dort Kachel "Verrechnungssteuer"
    // (Anwendung VST-DE). Eigenes Konto mit Zwei-Faktor-Anmeldung nötig.
    onlinePortalUrl: "https://eportal.admin.ch",
    requiresLogin: true,
    // Ein Antrag im Portal umfasst beliebig viele Jahre (Mehrfachauswahl).
    claimGranularity: "multiYear",
    limitationPeriodYears: 3,
    standardWithholdingRate: 0.35,
    treatyRateByResidence: { DE: 0.15 },
    isinPrefix: "CH",
    nativeCurrency: "CHF",
  },
  IT: {
    targetCountry: "IT",
    // Vorerst nur deutsche Ansässige (DBA DE-IT, Art. 10). docs/konzept-italien.md
    residencyCountries: ["DE"],
    // Nur Papier: Form A ausfüllen, Finanzamt bestätigt, per Post nach Pescara.
    flow: "form+mail",
    formId: "FORM_A",
    // Zeilen der Tabelle auf Seite 4; mehr Ausschüttungen -> weiteres Form A
    maxDistributionsPerForm: 4,
    // 48 Monate ab Steuerabzug
    limitationPeriodYears: 4,
    standardWithholdingRate: 0.26,
    treatyRateByResidence: { DE: 0.15 },
    treatyArticle: 10,
    isinPrefix: "IT",
    nativeCurrency: "EUR",
    mailingAddress: ["Agenzia delle Entrate", "Centro Operativo di Pescara", "Via Rio Sparto 21", "65129 Pescara", "Italy"],
  },
  SE: {
    targetCountry: "SE",
    // Vorerst nur deutsche Ansässige (DBA DE-SE, Art. 10). docs/konzept-schweden.md
    residencyCountries: ["DE"],
    // Wie Italien nur Papier: SKV 3740 ausfüllen, Finanzamt bestätigt die
    // Ansässigkeit auf Seite 2, per Post (oder E-Mail) an Skatteverket.
    flow: "form+mail",
    formId: "SKV3740",
    // Datenzeilen der Tabelle IV auf Seite 2; mehr Ausschüttungen -> weiteres Formular
    maxDistributionsPerForm: 12,
    // Frist: fünf Jahre ab dem ENDE des Kalenderjahres, in dem die Dividende
    // ausgezahlt wurde (nicht ab dem Zahltag) - siehe lib/withholding.js
    limitationPeriodYears: 5,
    limitationRule: "calendarYearEnd",
    standardWithholdingRate: 0.3,
    treatyRateByResidence: { DE: 0.15 },
    treatyArticle: 10,
    isinPrefix: "SE",
    // Das Formular rechnet in SEK; ausgezahlt wird auf Wunsch in EUR.
    nativeCurrency: "SEK",
    payoutCurrency: "EUR",
    mailingAddress: ["Skatteverket", "Box 6037", "171 06 Solna", "Sweden"],
    mailingEmail: "skatteverket@skatteverket.se",
  },
};
