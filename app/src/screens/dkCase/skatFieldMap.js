// Statische Übersetzung der 6 echten SKAT-Formularseiten (siehe
// divrebound_cheatsheet_v3_mockup.html) in eine Datenstruktur. Die Reihenfolge
// der Zeilen entspricht exakt der Reihenfolge im SKAT-Formular ("seitengetreu")
// - hier NICHT umsortieren, auch wenn eine andere Gruppierung eleganter wirken
// würde.
//
// Zeilenform: { id, labelEn, hint, group?, reveals?, assumption?, isDownload?, resolve(profile, reclaimCase, corridor) }
// - labelEn: der englische SKAT-Formulartext (1:1 aus dem Portal übernommen)
// - hint: die deutsche Erläuterung, die im Mockup unter dem Label steht
// - group: gesetzt, wenn diese Zeile nur sichtbar ist, sobald die Zeile mit
//   id === group angehakt wurde (bildet die "Progressive Anzeige" im echten
//   SKAT-Formular nach, z.B. "The shareholder is" -> klappt Namensfelder auf)
// - reveals: true, wenn das Anhaken DIESER Zeile eine Gruppe (group === diese id)
//   aufklappt
// - assumption: true für Zeilen, die wir bewusst leer lassen (visuell
//   abgesetzt, wie .row-value.assumption im Mockup). Ohne Checkbox und
//   Kopier-Button, zählen nicht zum Fortschritt - es gibt nichts zu übertragen.
// - isDownload: true für die einzige Zeile, die statt "kopieren" ein Dokument
//   referenziert (Wohnsitzbescheinigung aus Schritt 1)
// - noCopy: true für reine Handlungsschritte (Sprache umstellen, Datei
//   hochladen, "Create new record" klicken) - nur abhaken, nichts zu kopieren
// - resolve(...) liefert { display, copyValue, assumption } - display ist der
//   Text, der im Cheat Sheet angezeigt wird, copyValue der Text, der tatsächlich
//   in die Zwischenablage kopiert wird (i.d.R. identisch, außer z.B. bei der
//   Telefonnummer, siehe m36)

import { refundFor } from "../../lib/withholding.js";

const RESIDENCE_COUNTRY_NAMES = {
  DE: "Germany",
  AT: "Austria",
  CH: "Switzerland",
};

export function residenceCountryName(code) {
  return RESIDENCE_COUNTRY_NAMES[code] ?? code ?? "";
}

/** ISO 8601 (YYYY-MM-DD) -> DD-MM-YYYY, wie im SKAT-Formular gefordert. */
export function formatDateSkat(isoDateString) {
  if (!isoDateString) return "";
  const [year, month, day] = isoDateString.split("-");
  return `${day}-${month}-${year}`;
}

/**
 * SKAT erwartet die Landesvorwahl als "0049" statt "+49" (siehe Mockup:
 * profile.phone = "0049 171 3735934" als Anzeige, profile.phoneRaw =
 * "00491713735934" als Kopierwert). Wir leiten beides aus einem einzigen
 * profile.residence.phone-Freitextfeld ab.
 */
export function normalizePhoneForSkat(rawPhone) {
  if (!rawPhone) return "";
  return rawPhone.trim().replace(/^\+/, "00").replace(/[^\d]/g, "");
}

function val(display, copyValue = display, assumption = false) {
  return { display: display ?? "", copyValue: copyValue ?? "", assumption };
}

function emptyOnPurpose(displayText) {
  return () => val(displayText, "", true);
}

/**
 * Bankdaten aus dem Case-Snapshot; ist der leer (Case angelegt, bevor die
 * Bankverbindung im Profil stand), aus dem aktuellen Profil.
 */
function bankValue(profile, reclaimCase, snapshotKey, profileKey) {
  return reclaimCase.applicantSnapshot?.bank?.[snapshotKey] || profile.bank?.[profileKey] || "";
}

// -------------------------------------------------------------------------
// Seite 1 - About the claimant
// -------------------------------------------------------------------------
const page1Rows = [
  {
    id: "m0",
    labelEn: "Language",
    hint: "Ganz oben im Header neben dem skat.dk-Logo: zuerst auf English umstellen, dann stimmen alle Feldnamen mit diesem Spickzettel überein",
    noCopy: true,
    resolve: () => val("English"),
  },
  {
    id: "m1",
    labelEn: "I claim refund of Danish dividend tax as",
    hint: "Deine Rolle beim Antrag",
    resolve: () => val("Shareholder"),
  },
];

// -------------------------------------------------------------------------
// Seite 2 - About the shareholder
// -------------------------------------------------------------------------
const page2Rows = [
  {
    id: "m2",
    labelEn: "The shareholder is",
    hint: 'Bist du Privatperson oder ein Unternehmen? Als Privatanleger: "a person" wählen.',
    reveals: true,
    resolve: () => val("a person"),
  },
  {
    id: "m3",
    labelEn: "Select the relevant identification and complete the field",
    hint:
      'Womit weist du dich aus? Als deutscher Steuerzahler ohne dänische CPR-Nr.: "Tax identification number (TIN)" wählen.',
    group: "m2",
    reveals: true,
    resolve: () => val("Tax identification number (TIN)"),
  },
  {
    id: "m9",
    labelEn: "Tax identification number (TIN)",
    hint: "Steuer-ID",
    group: "m3",
    // Bewusst aus dem LIVEN Profil, nicht aus applicantSnapshot: die Steuer-ID
    // ist an die Person gebunden, nicht an den einzelnen Fall (anders als
    // Name/Adresse, die im Case gezielt überschreibbar sind, siehe
    // missingData.js) - applicantSnapshot.tin wird dort nur einmalig als
    // Fallback kopiert und bliebe sonst dauerhaft veraltet, sobald die
    // Steuer-ID erst nachträglich im Profil ergänzt/geändert wird.
    resolve: (profile) => val(profile.residence.tin),
  },
  {
    id: "m4",
    labelEn: "Where does the shareholder live (country)?",
    hint: "Wohnsitzland",
    group: "m2",
    resolve: (profile) => val(residenceCountryName(profile.residence.country)),
  },
  {
    id: "m5",
    labelEn: "First name(s)",
    hint: "Vorname(n)",
    group: "m2",
    resolve: (profile, reclaimCase) => val(reclaimCase.applicantSnapshot.firstName),
  },
  {
    id: "m6",
    labelEn: "Surname",
    hint: "Nachname",
    group: "m2",
    resolve: (profile, reclaimCase) => val(reclaimCase.applicantSnapshot.lastName),
  },
  {
    id: "m37",
    labelEn: "c/o name (optional field)",
    hint: "z.B. bei c/o-Adressen – bei uns leer",
    group: "m2",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
  {
    id: "m7",
    labelEn: "Address (street, no., letter, floor, left/right)",
    hint: "Straße, Hausnummer",
    group: "m2",
    resolve: (profile, reclaimCase) => val(reclaimCase.applicantSnapshot.address),
  },
  {
    id: "m38",
    labelEn: "Premises (optional field)",
    hint: "z.B. Gebäudeteil/Etage – bei uns leer",
    group: "m2",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
  {
    id: "m8",
    labelEn: "Postal code and postal district",
    hint: "Postleitzahl",
    group: "m2",
    resolve: (profile, reclaimCase) => val(reclaimCase.applicantSnapshot.postalCode),
  },
  {
    id: "m34",
    labelEn: "Town (optional field)",
    hint: "Ort – eigenes Feld, nicht mit PLZ kombiniert",
    group: "m2",
    resolve: (profile, reclaimCase) => val(reclaimCase.applicantSnapshot.city),
  },
  {
    id: "m39",
    labelEn: "PO box (optional field)",
    hint: "Postfach – bei uns leer",
    group: "m2",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
  {
    id: "m35",
    labelEn: "Email (optional field)",
    hint: "E-Mail",
    group: "m2",
    resolve: (profile) => val(profile.residence.email ?? ""),
  },
  {
    id: "m36",
    labelEn: "Phone number (preferably mobile) (optional field)",
    hint: "Telefonnummer inkl. Ländervorwahl",
    group: "m2",
    resolve: (profile) => {
      const raw = profile.residence.phone ?? "";
      return val(raw, normalizePhoneForSkat(raw));
    },
  },
];

// -------------------------------------------------------------------------
// Seite 3 - Refund information: siehe buildSharePages() unten, keine
// statische Zeilenliste (wiederholt sich pro Distribution).
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Seite 4 - Other documentation
// -------------------------------------------------------------------------
const page4Rows = [
  {
    id: "m26",
    labelEn: "Documentation that the shareholder is liable to pay tax in another country",
    hint: "Wohnsitznachweis (Ansässigkeitsbescheinigung, Formular „02.050“, vom Finanzamt bestätigt)",
    isDownload: true,
    resolve: (profile, reclaimCase) => {
      const doc = (reclaimCase.generatedDocuments ?? []).find((d) => d.type === "residency_certificate");
      return doc
        ? val(doc.fileName, doc.fileName)
        : val("Noch nicht erzeugt – siehe Schritt 4", "", true);
    },
  },
  {
    id: "m27",
    labelEn: "Other documentation",
    hint: "Checkbox, bei uns nicht relevant",
    assumption: true,
    resolve: emptyOnPurpose("nein / leer lassen"),
  },
  {
    id: "m28",
    labelEn: "Comments (optional field)",
    hint: "Kommentar – bei uns leer",
    assumption: true,
    resolve: emptyOnPurpose("leer lassen"),
  },
];

// -------------------------------------------------------------------------
// Seite 5 - Payment information
// -------------------------------------------------------------------------
const page5Rows = [
  {
    id: "m29",
    labelEn: "Would you like your refund transferred to a Danish account?",
    hint: 'Auszahlung auf dänisches Konto? Bei "No" erscheint die Feldergruppe darunter erst',
    reveals: true,
    resolve: () => val("No"),
  },
  {
    id: "m30",
    labelEn: "Name of bank",
    hint: "Kriterium: Kann das Konto normale SEPA-Überweisungen empfangen? Muss kein separates Girokonto sein.",
    group: "m29",
    resolve: (profile, reclaimCase) => val(bankValue(profile, reclaimCase, "name", "bankName")),
  },
  {
    id: "m31",
    labelEn: "Name of account holder",
    hint: "Kontoinhaber",
    group: "m29",
    resolve: (profile, reclaimCase) => val(bankValue(profile, reclaimCase, "holder", "accountHolderName")),
  },
  {
    id: "m70",
    labelEn: "Address of account holder (optional field)",
    hint: "Adresse des Kontoinhabers – bei uns leer",
    group: "m29",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
  {
    id: "m32",
    labelEn: "BIC/SWIFT",
    hint: "BIC",
    group: "m29",
    resolve: (profile, reclaimCase) => val(bankValue(profile, reclaimCase, "bic", "bic")),
  },
  {
    id: "m33",
    labelEn: "IBAN no.",
    hint: "IBAN",
    group: "m29",
    resolve: (profile, reclaimCase) => val(bankValue(profile, reclaimCase, "iban", "iban")),
  },
  {
    id: "m71",
    labelEn: "Routing no./FEDWIRE/ABA (optional field)",
    hint: "nur für US-Konten relevant – bei uns leer",
    group: "m29",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
  {
    id: "m72",
    labelEn: "Reference (optional field)",
    hint: "Verwendungszweck – bei uns leer",
    group: "m29",
    assumption: true,
    resolve: emptyOnPurpose("— leer lassen —"),
  },
];

// -------------------------------------------------------------------------
// Seite 6 - Summary: keine Eingabezeilen, nur Prüfliste + Abschluss (siehe
// cheatSheet.js). rows bleibt bewusst leer.
// -------------------------------------------------------------------------

export const skatTabs = [
  {
    id: "p1",
    label: "1 · About the claimant",
    title: "Seite 1 · About the claimant",
    rows: page1Rows,
  },
  {
    id: "p2",
    label: "2 · About the shareholder",
    title: "Seite 2 · About the shareholder",
    rows: page2Rows,
  },
  {
    id: "p3",
    label: "3 · Refund information",
    title: "Seite 3 · Refund information",
    dynamic: true,
    rows: [],
  },
  {
    id: "p4",
    label: "4 · Other documentation",
    title: "Seite 4 · Other documentation",
    rows: page4Rows,
  },
  {
    id: "p5",
    label: "5 · Payment information",
    title: "Seite 5 · Payment information",
    rows: page5Rows,
    helpNote: {
      title: "Warum diese Werte so gewählt sind",
      items: ['"Name of bank" ist dein persönliches Verrechnungskonto, nicht zwingend das Broker-Konto.'],
    },
  },
  {
    id: "p6",
    label: "6 · Summary",
    title: "Seite 6 · Summary",
    rows: [],
    summary: true,
  },
];

const SHARE_HELP_NOTE = {
  title: "Warum diese Werte so gewählt sind",
  items: [
    '"Distribution approved" = Ex-Datum, fällt meist mit der Hauptversammlung zusammen.',
    '"Danish tax rate withheld" und "Tax rate payable to Denmark" füllt SKAT selbst vor – nur mit unseren Werten vergleichen.',
    'Wertpapierleihe-Fragen: "No" ist der Standardfall ohne Wertpapierleihe.',
    '"Amount of refund" berechnet SKAT automatisch — unsere Zahl ist nur ein Plausibilitäts-Check.',
  ],
};

const REFUND_REASON_TEXT =
  "Double taxation agreement or other agreement between Denmark and the country specified by the shareholder.";

/** Prozentsatz wie im SKAT-Formular: eine Nachkommastelle, Punkt als Trenner ("27.0"). */
function formatRateSkat(rate) {
  return (Math.round(rate * 1000) / 10).toFixed(1);
}

/**
 * Erzeugt Seite 3 ("Refund information") - wiederholt sich pro Distribution
 * im aktiven Chunk (SKAT: "Create new record" pro Ausschüttung, max. 20
 * Distributions je Claim, siehe corridors.DK.maxDistributionsPerClaim).
 *
 * @param {Distribution[]} distributions bereits auf den aktiven Chunk gefiltert
 * @param {object} corridor CorridorConfig (z.B. corridors.DK)
 * @param {string} residenceCountryCode profile.residence.country ("DE"|"AT"|"CH")
 * @returns {Array<{ distributionId: string, shareIndex: number, shareCount: number, headLabel: string, rows: Array, plausibilityEstimate: number }>}
 */
export function buildSharePages(distributions, corridor, residenceCountryCode) {
  const treaty = corridor.treatyRateByResidence[residenceCountryCode] ?? corridor.treatyRateByResidence.DE;
  return distributions.map((d, i) => {
    const n = i + 1;
    const id = `d${d.distributionId}`;
    // gezahlte Steuer − DBA-Satz × Brutto, wie in Schritt 2 (lib/withholding.js)
    const plausibilityEstimate = refundFor(d, corridor, residenceCountryCode).refund;
    const grossWhole = Math.round(d.grossDividend);
    // Tatsächlich einbehaltener Satz (bei Teil-Einbehalt unter 27 %), höchstens Regelsatz
    const effectiveRate =
      d.grossDividend && d.withheldTax != null ? d.withheldTax / d.grossDividend : corridor.standardWithholdingRate;
    const withheldRate = formatRateSkat(Math.min(effectiveRate, corridor.standardWithholdingRate));
    const statementName = d.sourceFile ?? "Dividendenabrechnung";

    // Reihenfolge exakt wie im SKAT-Formular; "Amount of refund" sitzt
    // zwischen "-payable" und "-doc" (Plausibilitäts-Check, siehe step5Skat.js)
    const rows = [
      {
        id: `${id}-reason`,
        labelEn: "State the reason the shareholder is entitled to a refund of dividend tax",
        hint: "Grund für die Erstattung",
        resolve: () => val(REFUND_REASON_TEXT),
      },
      {
        id: `${id}-idtype`,
        labelEn: "Select how you want to identify the share",
        hint: "Identifikation der Aktie",
        resolve: () => val("ISIN code"),
      },
      {
        id: `${id}-isin`,
        labelEn: "ISIN-code",
        hint: "ISIN eintragen, danach „Draw company information“ klicken",
        resolve: () => val(d.isin),
      },
      {
        id: `${id}-issuer`,
        labelEn: "Name of distributing company (optional field)",
        hint: "Füllt SKAT über „Draw company information“ selbst aus – nur prüfen",
        resolve: () => val(d.issuerName),
      },
      {
        id: `${id}-date`,
        labelEn: "Select date for when the dividend distribution was approved",
        hint: "Ex-Datum – fällt meist mit der Hauptversammlung zusammen",
        resolve: () => val(formatDateSkat(d.paymentDate)),
      },
      {
        id: `${id}-gross`,
        labelEn: "Dividend received before tax (in whole DKK)",
        hint: "Bruttodividende vor Steuern, ganze Kronen",
        resolve: () => val(String(grossWhole)),
      },
      {
        id: `${id}-withheld`,
        labelEn: "Danish tax rate withheld",
        hint: "Einbehaltener Steuersatz in % – von SKAT vorausgefüllt, nur bestätigen",
        resolve: () => val(withheldRate),
      },
      {
        id: `${id}-payable`,
        labelEn: "Tax rate payable to Denmark, e.g. according to double taxation agreement.",
        hint: "Steuersatz laut DBA in % – von SKAT vorausgefüllt, nur bestätigen",
        resolve: () => val(formatRateSkat(treaty)),
      },
      {
        id: `${id}-doc`,
        labelEn: "Documentation for dividend received and tax withheld",
        hint: "Hier die Dividendenabrechnung dieser Ausschüttung hochladen (dieselbe Datei wie in Schritt 2)",
        noCopy: true,
        resolve: () => val(statementName),
      },
      {
        id: `${id}-borrowed`,
        labelEn:
          "Are you applying for a dividend tax refund on shares you borrowed from others at the time when the dividend was adopted?",
        hint: "Aktien geliehen? Für Privatanleger i.d.R. Nein",
        resolve: () => val("No"),
      },
      {
        id: `${id}-lent`,
        labelEn:
          "Are you applying for a dividend tax refund on shares that were lent to others at the time when the dividend was adopted?",
        hint: "Aktien verliehen? Für Privatanleger i.d.R. Nein",
        resolve: () => val("No"),
      },
    ];

    if (n < distributions.length) {
      rows.push({
        id: `${id}-newrecord`,
        labelEn: "Create new record",
        hint: `Button unter dem Aktien-Block klicken – öffnet „Share number ${n + 1}“ für die nächste Ausschüttung`,
        noCopy: true,
        resolve: () => val("klicken"),
      });
    }

    return {
      distributionId: d.distributionId,
      shareIndex: n,
      shareCount: distributions.length,
      headLabel: `Share number ${n} of ${distributions.length}`,
      rows,
      plausibilityAfterRowId: `${id}-payable`,
      plausibilityEstimate,
    };
  });
}

export const shareHelpNote = SHARE_HELP_NOTE;
