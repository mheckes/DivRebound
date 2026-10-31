// fillFormA.js
//
// Befüllt das italienische Form A (Agenzia delle Entrate, "Claim for the
// refund ... - dividends") für ein Unternehmen bzw. einen Teil davon
// (lib/italy.js formsFor). Die Vorlage hat KEINE Formularfelder - der Text wird
// mit pdf-lib an feste Koordinaten auf die Originalseiten geschrieben.
//
// Koordinaten: aus dem vom Nutzer ausgefüllten Referenzantrag (FreeText-
// Anmerkungen) bzw. aus den Textpositionen der Vorlage gemessen, PDF-Punkte,
// Ursprung unten links, y = Grundlinie. docs/konzept-italien.md §2.
//
// Bewusst leer: Seite 2 (Vertreter, Mitbegünstigte), Bevollmächtigter auf
// Seite 3, Depotbank, die beiden Unterschriften des Antragstellers (Seite 3
// und 5) sowie Datum, Unterschrift und Stempel des Finanzamts (Seite 5).
// Ort, Steuerjahre, "Germany" und Artikel 10 im Teil des Finanzamts füllt
// DivRebound vor (Abstimmung mit dem Nutzer).
//
// Liest wie fillResidencyCertificate.js nur aus dem LIVEN InvestorProfile.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { corridors } from "../config/corridors.js";
import { refundFor, yearsOf, yearsText, issuerDetails, formatEur } from "./italy.js";

const INK = rgb(0.05, 0.15, 0.45);
const SIZE = 10;

// Tabelle "Description of the dividends received" (Seite 4)
const ROW_BASELINES = [304, 274.5, 245, 215.5];
const COLUMNS = {
  year: { x: 52, width: 42 },
  date: { x: 97, width: 54 },
  shares: { x: 156, width: 44 },
  perShare: { x: 268, width: 46 },
  gross: { x: 318, width: 68 },
  tax: { x: 390, width: 52 },
  due: { x: 446, width: 54 },
  refund: { x: 503, width: 42 },
};

/** "Musterstraße 1 ; 80331 München ; Germany" wie im Referenzantrag */
function fullAddress(residence) {
  return [residence.address, `${residence.postalCode ?? ""} ${residence.city ?? ""}`.trim(), "Germany"].filter(Boolean).join(" ; ");
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * @param {ArrayBuffer | Uint8Array} templateBytes - app/public/forms/it-form-a-template.pdf
 * @param {InvestorProfile} profile
 * @param {{ isin: string, issuerName: string, rows: object[], part: number, of: number }} form
 * @param {{ attachmentsCount?: number, today?: Date }} [options]
 * @returns {Promise<PDFDocument>}
 */
export async function buildFormADocument(templateBytes, profile, form, { attachmentsCount, today = new Date() } = {}) {
  const corridor = corridors.IT;
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const { residence, bank } = profile;

  /** Text, bei Bedarf verkleinert, damit er in maxWidth passt */
  function text(pageIndex, value, x, y, { maxWidth = 545 - x, size = SIZE } = {}) {
    const str = String(value ?? "").trim();
    if (!str) return;
    let s = size;
    while (s > 6 && font.widthOfTextAtSize(str, s) > maxWidth) s -= 0.5;
    pages[pageIndex].drawText(str, { x, y, size: s, font, color: INK });
  }
  /** Kreuz in ein Kästchen der Vorlage (x/y = Position des Kästchen-Zeichens; Seite 4 hat größere Kästchen) */
  function cross(pageIndex, x, y, { large = false } = {}) {
    const [dx, dy, size] = large ? [3.4, 1.2, 11] : [1.6, 0.6, 9];
    pages[pageIndex].drawText("X", { x: x + dx, y: y + dy, size, font: bold, color: INK });
  }

  const fullName = `${residence.firstName} ${residence.lastName}`.trim();
  const undersigned = `${residence.firstName} ${(residence.lastName ?? "").toUpperCase()}`.trim();
  const years = yearsOf(form.rows);

  // --- Seite 1: Deckblatt, Begünstigter ---
  cross(0, 144, 657); // dividends (FORM A)
  cross(0, 50, 495); // DETAILS OF THE BENEFICIAL OWNER
  text(0, residence.lastName, 155, 461, { maxWidth: 95 });
  text(0, residence.firstName, 259, 461, { maxWidth: 85 });
  text(0, residence.birthPlace, 349, 461, { maxWidth: 98 });
  text(0, residence.birthDate ? formatDate(residence.birthDate) : "", 453, 461, { maxWidth: 90 });
  text(0, "---", 156, 422);
  const tins = [residence.taxNumber && `Tax Number: ${residence.taxNumber}`, residence.tin && `Tax ID: ${residence.tin}`].filter(Boolean);
  text(0, tins.join("  ;  "), 199, 398, { maxWidth: 345 });
  text(0, "---", 157, 337);
  text(0, "Germany", 155, 298, { maxWidth: 80 });
  text(0, fullAddress(residence), 242, 297, { maxWidth: 300 });
  text(0, "---", 155, 259);
  text(0, "---", 241, 260);
  text(0, residence.email, 155, 207, { maxWidth: 390 });

  // --- Seite 3: Zahlungsweg ---
  text(2, bank.bankName, 172, 394, { maxWidth: 370 });
  text(2, bank.accountHolderName || undersigned, 172, 375, { maxWidth: 370 });
  text(2, bank.bic, 245, 354, { maxWidth: 70 });
  text(2, bank.iban, 380, 354, { maxWidth: 165 });
  text(2, bank.address, 242, 300, { maxWidth: 300 });
  const attachments = attachmentsCount ?? form.rows.length;
  text(2, `Dividend statements (${attachments})`, 141, 204, { maxWidth: 116 });

  // --- Seite 4: Form A, Dividenden ---
  cross(3, 50, 725, { large: true }); // REFUND
  text(3, String(corridor.treatyArticle), 88, 694, { maxWidth: 14 });
  text(3, "Germany", 480, 694, { maxWidth: 62 });
  const payer = issuerDetails(form.isin, form.issuerName, profile);
  text(3, payer.name, 232, 634, { maxWidth: 310 });
  text(3, payer.taxCode, 156, 596, { maxWidth: 380 });
  text(3, payer.address, 216, 577, { maxWidth: 325 });

  let total = 0;
  form.rows.forEach((d, i) => {
    const y = ROW_BASELINES[i];
    const { taxDue, refund } = refundFor(d);
    total += refund;
    const cell = (col, value) => text(3, value, COLUMNS[col].x, y, { maxWidth: COLUMNS[col].width });
    cell("year", d.paymentDate.slice(0, 4));
    cell("date", formatDate(d.paymentDate));
    cell("shares", String(d.shares ?? "").replace(".", ","));
    if (d.dividendPerShare) cell("perShare", formatEur(d.dividendPerShare, { maxDigits: 4 }));
    cell("gross", formatEur(d.grossDividend));
    cell("tax", formatEur(d.withheldTax));
    cell("due", formatEur(taxDue));
    cell("refund", formatEur(refund));
  });
  text(3, formatEur(Math.round(total * 100) / 100), COLUMNS.refund.x, 186, { maxWidth: COLUMNS.refund.width });

  // --- Seite 5: Erklärung, Teil des Finanzamts ---
  text(4, undersigned, 129, 723, { maxWidth: 135 });
  text(4, "beneficial owner", 311, 723, { maxWidth: 230 });
  text(4, undersigned, 179, 672, { maxWidth: 150 });
  text(4, "Germany", 397, 672, { maxWidth: 80 });
  text(4, "Germany", 144, 659, { maxWidth: 110 });
  text(4, yearsText(years, "and"), 384, 659, { maxWidth: 66 });
  cross(4, 50, 570); // subject to tax in the country of residence
  cross(4, 50, 368); // refund of taxes
  const dateStr = today.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  text(4, `${residence.city ?? ""} ${dateStr}`.trim(), 121, 318, { maxWidth: 85 });
  const taxOfficeCity = residence.taxOffice?.city ?? "";
  text(4, taxOfficeCity, 161, 242, { maxWidth: 90 });
  text(4, yearsText(years, "&"), 417, 242, { maxWidth: 54 });
  text(4, "Germany", 196, 229, { maxWidth: 95 });
  text(4, String(corridor.treatyArticle), 398, 229, { maxWidth: 16 });

  pdfDoc.setTitle(`Form A – ${payer.name || form.isin} – ${fullName}`);
  return pdfDoc;
}

/** Ein Form A als PDF */
export async function fillFormA(templateBytes, profile, form, options) {
  return (await buildFormADocument(templateBytes, profile, form, options)).save();
}

/** Alle Formulare eines Falls in einem PDF (zum Ausdrucken) */
export async function fillAllFormsA(templateBytes, profile, forms, options) {
  const merged = await PDFDocument.create();
  for (const form of forms) {
    const doc = await buildFormADocument(templateBytes, profile, form, options);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/** Dateiname: FormA_Italmobiliare_Mustermann_2024-2026[_Teil1].pdf */
export function formAFileName(profile, form) {
  const company = (form.issuerName || form.isin).replace(/\bS\.p\.A\.?/i, "").trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const years = yearsOf(form.rows);
  const yearLabel = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
  const part = form.of > 1 ? `_Teil${form.part}` : "";
  return `FormA_${company}_${profile.residence.lastName || "DivRebound"}_${yearLabel}${part}.pdf`;
}
