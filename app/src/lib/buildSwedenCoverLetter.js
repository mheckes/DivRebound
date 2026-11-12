// buildSwedenCoverLetter.js
//
// Englisches Begleitschreiben an Skatteverket, das mit dem vom Finanzamt
// bestätigten Formular SKV 3740 und Kopien der Dividendenabrechnungen per Post
// nach Schweden geht. Aufbau und Layout wie lib/buildItalyCoverLetter.js.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { wrapLines } from "./buildTaxOfficeLetter.js";
import { corridors } from "../config/corridors.js";

const PAGE_WIDTH = 595.28; // A4 in pt
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 62;
const MARGIN_RIGHT = 62;
const MARGIN_TOP = 62;
const BODY_SIZE = 10.5;
const LINE_GAP = 14.5;
const INK = rgb(0.1, 0.1, 0.12);

const SE = corridors.SE;

/**
 * @param {InvestorProfile} profile
 * @param {{ companies: { name: string, isin: string }[], years: number[], formsCount: number, today?: Date }} details
 * @returns {Promise<Uint8Array>}
 */
export async function buildSwedenCoverLetter(profile, { companies, years, formsCount, today = new Date() }) {
  const { residence, bank } = profile;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function right(text, useFont = font, size = BODY_SIZE) {
    page.drawText(text, { x: PAGE_WIDTH - MARGIN_RIGHT - useFont.widthOfTextAtSize(text, size), y, size, font: useFont, color: INK });
    y -= LINE_GAP;
  }
  function left(text, useFont = font, x = MARGIN_LEFT) {
    page.drawText(text, { x, y, size: BODY_SIZE, font: useFont, color: INK });
    y -= LINE_GAP;
  }
  function paragraph(text) {
    for (const line of wrapLines(text, font, BODY_SIZE, contentWidth)) left(line);
    y -= 8;
  }
  function bullets(items) {
    for (const item of items) {
      const lines = wrapLines(item, font, BODY_SIZE, contentWidth - 16);
      page.drawText("•", { x: MARGIN_LEFT + 2, y, size: BODY_SIZE, font, color: INK });
      lines.forEach((line) => left(line, font, MARGIN_LEFT + 16));
    }
    y -= 8;
  }

  // --- Absender (rechts) ---
  const fullName = `${residence.firstName ?? ""} ${residence.lastName ?? ""}`.trim();
  right(fullName, bold, 12);
  if (residence.address) right(residence.address);
  right(`${residence.postalCode ?? ""} ${residence.city ?? ""}`.trim() + ", Germany");
  if (residence.phone) right(residence.phone);
  if (residence.email) right(residence.email);
  y -= 10;
  right(today.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  y -= 16;

  // --- Empfänger ---
  SE.mailingAddress.forEach((line, i) => left(line, i === 0 ? bold : font));
  y -= 24;

  left("Subject: Request for Refund of Swedish Withholding Tax on Dividends", bold);
  y -= 12;
  left("Dear Sir or Madam,");
  y -= 8;

  const companyLabel = (c) => `“${c.name}” (${c.isin})`;
  if (companies.length === 1) {
    paragraph(`I am writing to formally request a refund of the Swedish withholding tax levied on dividends from shares of the Swedish company ${companyLabel(companies[0])}.`);
  } else {
    paragraph("I am writing to formally request a refund of the Swedish withholding tax levied on dividends from shares of the following Swedish companies:");
    y += 8;
    bullets(companies.map(companyLabel));
  }
  paragraph(
    `As a resident of Germany, I am seeking a refund of the tax withheld in excess of the treaty rate of ${Math.round((SE.treatyRateByResidence?.DE ?? 0.15) * 100)}% in accordance with Article ${SE.treatyArticle} of the Double Taxation Agreement (DTA) between Sweden and Germany.`
  );

  const yearList = years.length > 1 ? `${years.slice(0, -1).join(", ")} and ${years[years.length - 1]}` : String(years[0] ?? "");
  paragraph("Please find the following documents enclosed for your review:");
  y += 8;
  bullets([
    `The completed application form${formsCount > 1 ? "s" : ""} (SKV 3740${formsCount > 1 ? `, ${formsCount} forms` : ""}), with the certificate of residence completed by the German tax office.`,
    `Dividend statements for the year${years.length > 1 ? "s" : ""} ${yearList}, confirming the amount of withholding tax paid.`,
  ]);

  paragraph("I kindly request that you process this application and transfer the refund in euros to my bank account, as stated in the form.");
  y += 8;
  left(`(IBAN: ${bank.iban ?? ""} | BIC: ${bank.bic ?? ""})`);
  y -= 8;
  paragraph("Thank you for your time and assistance.");
  left("Sincerely,");
  y -= 36;
  left(fullName);

  pdfDoc.setTitle(`Refund request – ${fullName}`);
  return pdfDoc.save();
}

export function swedenCoverLetterFileName(profile, years) {
  const yearLabel = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0] ?? ""}`;
  return `Cover_Letter_Skatteverket_${profile.residence.lastName || "DivRebound"}_${yearLabel}.pdf`;
}
