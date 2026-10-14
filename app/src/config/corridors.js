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
};
