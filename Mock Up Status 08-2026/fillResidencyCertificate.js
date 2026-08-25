// fillResidencyCertificate.js
//
// Befüllt das dänische Formular 02.050 ("Attestation om skattemæssigt hjemsted
// til refusion af dansk udbytteskat") auf Basis von InvestorProfile + ReclaimCase.
//
// Feld-Mapping wurde durch Inspektion des Original-AcroForms verifiziert (19 Textfelder).
// Nur der obere Block ("Udfyldes af privatpersonen") wird befüllt. Der untere Block
// ("Udfyldes af den lokale skattemyndighed": hjemsted, Date, underskriverens navn,
// Telephone number) bleibt bewusst leer – das ist Sache des Finanzamts.
//
// Voraussetzung: Deutschland/Österreich/Schweiz haben alle ein DBA mit Dänemark,
// daher wird immer nur der "land1"-Zweig (DBA vorhanden) befüllt, nie "land2"
// (kein DBA / OECD-Musterabkommen).

import { PDFDocument } from "pdf-lib";

/**
 * @param {ArrayBuffer} templateBytes - Rohdaten der Formularvorlage (02.050)
 * @param {InvestorProfile} profile
 * @param {ReclaimCase} reclaimCase - wird für den Zeitraum "seit wann ansässig" genutzt
 * @returns {Promise<Uint8Array>} - befülltes PDF, bereit zum Download
 */
export async function fillResidencyCertificate(templateBytes, profile, reclaimCase) {
  const { residence } = profile;

  if (reclaimCase.targetCountry !== "DK") {
    throw new Error(
      `fillResidencyCertificate unterstützt aktuell nur targetCountry "DK", erhalten: "${reclaimCase.targetCountry}"`
    );
  }

  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // --- Kleine Helper, damit ein fehlendes/leeres Feld nicht den ganzen Fill abbricht,
  //     sondern eine sprechende Warnung erzeugt (wichtig, falls SKAT die Formularversion
  //     mal aktualisiert und ein Feldname sich ändert). ---
  function setText(fieldName, value) {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value ?? "");
    } catch (err) {
      console.warn(
        `[fillResidencyCertificate] Feld "${fieldName}" nicht gefunden ` +
          `(hat sich die Formularvorlage geändert?): ${err.message}`
      );
    }
  }

  // --- Persönliche Angaben (Antragsteller) ---
  setText("fornavne", residence.firstName);
  setText("efternavn", residence.lastName);
  setText("cprnr", ""); // dänische CPR-Nr. – für DE/AT/CH-Ansässige immer leer
  setText("tin nr", residence.tin);
  setText("Fødselsdato", formatDate(residence.birthDate));
  setText("adresse", residence.address);
  setText("fødested", residence.birthPlace);
  setText("postnr", `${residence.postalCode} ${residence.city}`);
  setText("land", countryNameEnglish(residence.country));

  // --- Ansässigkeits-/DBA-Block ---
  // Alle unterstützten Wohnsitzländer (DE, AT, CH) haben ein DBA mit Dänemark
  // → immer der "land1"-Zweig, "land2"-Zweig bleibt leer.
  const residencePeriod = getResidencePeriod(reclaimCase);

  setText("Fra dato", formatDate(residencePeriod.from));
  setText("Til dato hvis kendt", residencePeriod.until ? formatDate(residencePeriod.until) : "");
  setText("land1", countryNameEnglish(residence.country));

  // Zweiter (Nicht-DBA-)Block bleibt für alle drei unterstützten Länder immer leer:
  setText("Fra datoa", "");
  setText("Til dato hvis kendtb", "");
  setText("land2", "");

  // --- Unterer Block: bewusst NICHT befüllt ---
  // "hjemsted", "Date", "underskriverens navn", "Telephone number" gehören dem Finanzamt.
  // Kein setText()-Aufruf hier - das Formular wird ausgedruckt und dort von Hand ergänzt.

  // NeedAppearances sicherstellen, damit alle PDF-Viewer (nicht nur der, der es erzeugt hat)
  // den eingetragenen Text auch tatsächlich anzeigen.
  form.updateFieldAppearances();

  return pdfDoc.save();
}

/**
 * Liefert den anzugebenden Ansässigkeitszeitraum.
 * MVP-Vereinfachung: "von" = residence-Startdatum falls im Profil vorhanden,
 * sonst leer lassen und Nutzer im Wizard danach fragen (siehe Wizard-Schritt 7).
 */
function getResidencePeriod(reclaimCase) {
  return {
    from: reclaimCase.residencePeriod?.from ?? null,
    until: reclaimCase.residencePeriod?.until ?? null,
  };
}

function formatDate(isoDateString) {
  if (!isoDateString) return "";
  const [year, month, day] = isoDateString.split("-");
  return `${day}.${month}.${year}`; // DD.MM.YYYY, üblich in DE/AT/CH
}

function countryNameEnglish(countryCode) {
  const names = { DE: "Germany", AT: "Austria", CH: "Switzerland" };
  const name = names[countryCode];
  if (!name) {
    throw new Error(`Nicht unterstütztes Wohnsitzland: "${countryCode}"`);
  }
  return name;
}

/**
 * Erzeugt einen sprechenden Dateinamen für den Download-Button,
 * berücksichtigt mehrere Steuerjahre in einem Case.
 */
export function buildFileName(profile, reclaimCase) {
  const years = [...new Set(reclaimCase.distributions.map((d) => d.taxYear))].sort();
  const yearLabel = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
  return `Ansaessigkeitsbescheinigung_DK_${profile.residence.lastName}_${yearLabel}.pdf`;
}
