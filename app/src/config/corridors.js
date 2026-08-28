// CorridorConfig-Registry. MVP: nur Dänemark. Ein neues Zielland bedeutet
// laut Briefing: neue CorridorConfig + neuer Extraktions-Parser, der Rest
// der Wizard-Logik bleibt unverändert.

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
  },
};
