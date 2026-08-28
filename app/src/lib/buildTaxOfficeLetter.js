// buildTaxOfficeLetter.js
//
// Erzeugt das "Anschreiben Finanzamt" - ein formales Begleitschreiben, das der
// Nutzer zusammen mit einer oder mehreren (separat über
// fillResidencyCertificate.js erzeugten) Wohnsitzbescheinigungen per Post ans
// zuständige Finanzamt schickt, mit der Bitte um Ausfüllen/Stempeln/
// Unterschreiben des jeweils vorgesehenen Formularabschnitts.
//
// Bewusst länder-/formularneutral formuliert (kein Verweis auf ein konkretes
// Formular oder eine bestimmte ausländische Steuerbehörde wie z.B. das
// dänische SKAT): das Anschreiben soll unverändert wiederverwendbar bleiben,
// auch wenn künftig weitere Zielländer (Schweiz, Italien, ...) dazukommen,
// und auch wenn ein Nutzer mit einem einzigen Anschreiben gleich mehrere
// Ansässigkeitsbescheinigungen auf einmal anfragt.
//
// Anders als fillResidencyCertificate.js gibt es hierfür keine amtliche
// Formularvorlage zum Befüllen - das Schreiben wird komplett neu mit pdf-lib
// aufgebaut (Layout/Text angelehnt an eine vom Nutzer bereitgestellte
// Beispielvorlage, hier aber generisch für beliebige Nutzer/Finanzämter
// formuliert statt fest verdrahtet).
//
// Liest bewusst ausschließlich aus dem LIVEN InvestorProfile (nie aus einem
// ReclaimCase.applicantSnapshot) - gleiches Prinzip wie in
// fillResidencyCertificate.js, siehe dortiger Kommentar.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { normalizeTaxOffice } from "../util/taxOffice.js";

const PAGE_WIDTH = 595.28; // A4 in pt
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 62;
const MARGIN_RIGHT = 62;
const MARGIN_TOP = 62;
const BODY_SIZE = 10.5;
const LINE_GAP = 14.5;

function wrapLines(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {InvestorProfile} profile
 * @returns {Promise<Uint8Array>}
 */
export async function buildTaxOfficeLetter(profile) {
  const { residence } = profile;
  const taxOffice = normalizeTaxOffice(residence.taxOffice);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function right(text, size, useFont) {
    const width = useFont.widthOfTextAtSize(text, size);
    page.drawText(text, { x: PAGE_WIDTH - MARGIN_RIGHT - width, y, size, font: useFont, color: rgb(0.1, 0.1, 0.12) });
    y -= LINE_GAP;
  }
  function left(text, size, useFont) {
    page.drawText(text, { x: MARGIN_LEFT, y, size, font: useFont, color: rgb(0.1, 0.1, 0.12) });
    y -= LINE_GAP;
  }

  // --- Absenderblock (rechtsbündig) ---
  const fullName = `${residence.firstName ?? ""} ${residence.lastName ?? ""}`.trim();
  right(fullName, 12, bold);
  if (residence.address) right(residence.address, BODY_SIZE, font);
  const cityLine = `${residence.postalCode ?? ""} ${residence.city ?? ""}`.trim();
  if (cityLine) right(cityLine, BODY_SIZE, font);
  if (residence.phone) right(residence.phone, BODY_SIZE, font);
  if (residence.email) right(residence.email, BODY_SIZE, font);

  y -= 6;
  page.drawLine({
    start: { x: PAGE_WIDTH - MARGIN_RIGHT - 190, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.6,
    color: rgb(0.75, 0.75, 0.75),
  });
  y -= 22;

  const dateStr = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dateLabel = residence.city ? `${residence.city}, ${dateStr}` : dateStr;
  right(dateLabel, BODY_SIZE, font);

  y -= 22;

  // --- Empfängerblock (linksbündig) ---
  left(taxOffice.name || "Zuständiges Finanzamt", BODY_SIZE, bold);
  if (taxOffice.street) left(taxOffice.street, BODY_SIZE, font);
  const taxOfficeCityLine = `${taxOffice.postalCode} ${taxOffice.city}`.trim();
  if (taxOfficeCityLine) left(taxOfficeCityLine, BODY_SIZE, font);

  y -= 26;

  // --- Betreff ---
  const subject = "Antrag auf Ausstellung einer Wohnsitzbescheinigung zur Rückerstattung ausländischer Quellensteuer";
  for (const line of wrapLines(subject, bold, BODY_SIZE, contentWidth)) {
    left(line, BODY_SIZE, bold);
  }

  y -= 16;
  left("Sehr geehrte Damen und Herren,", BODY_SIZE, font);
  y -= 10;

  const paragraphs = [
    "hiermit beantrage ich die Ausstellung einer Wohnsitzbescheinigung, die ich zur Rückerstattung ausländischer Quellensteuer auf Kapitalerträge benötige.",
    "Anbei erhalten Sie die entsprechenden amtlichen Formulare. Ich bitte Sie höflich, den jeweils vorgesehenen Abschnitt für das Finanzamt auszufüllen, zu stempeln und zu unterschreiben.",
    residence.tin ? `Meine Steuer-Identifikationsnummer lautet: ${residence.tin}.` : null,
    "Ich bitte um Rücksendung der Formulare an meine oben genannte Adresse.",
    "Für Rückfragen stehe ich Ihnen gerne zur Verfügung.",
  ].filter(Boolean);

  for (const paragraph of paragraphs) {
    for (const line of wrapLines(paragraph, font, BODY_SIZE, contentWidth)) {
      left(line, BODY_SIZE, font);
    }
    y -= 10;
  }

  y -= 6;
  left("Mit freundlichen Grüßen", BODY_SIZE, font);
  y -= 30;
  left(fullName, BODY_SIZE, font);

  return pdfDoc.save();
}

/** @param {InvestorProfile} profile */
export function buildLetterFileName(profile) {
  const lastName = profile.residence.lastName || "DivRebound";
  return `Anschreiben_Finanzamt_${lastName}.pdf`;
}
