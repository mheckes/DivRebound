// fillSkv3740.js
//
// Befüllt das schwedische Formular SKV 3740 ("Ansökan om återbetalning av
// svensk skatt på utdelning" / Claim for repayment of Swedish tax on
// dividends, Skatteverket, Ausgabe 2026) - ein Formular je bis zu 12
// Ausschüttungen (lib/sweden.js formsFor). Wie das italienische Form A hat die
// Vorlage KEINE Formularfelder: der Text wird mit pdf-lib an feste Koordinaten
// geschrieben (PDF-Punkte, Ursprung unten links, y = Grundlinie), gemessen an
// den Linien und Kästchen der Vorlage. Das Ergebnis folgt dem ausgefüllten
// Muster des Nutzers (Beträge mit Punkt als Dezimaltrenner, Auszahlung in EUR).
//
// Bewusst leer: Person-/Organisationsnr (Swedish TIN - Ausländer haben keine),
// Ombud, "Ansökan avser", Plusgiro, Unterschrift des Antragstellers und der
// Stempel des Finanzamts im Feld "Intyg om hemvist". Die Vorlage hat drei
// Seiten; die dritte (Hinweise) wird nicht mitgedruckt.
//
// Liest wie fillFormA.js nur aus dem LIVEN InvestorProfile.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { refundFor, formTotals, formatSek, yearsOf } from "./sweden.js";

const INK = rgb(0.1, 0.1, 0.12);
const SIZE = 10.5;

// Tabelle IV auf Seite 2: 12 Datenzeilen à 15,58 pt, Unterkante der ersten Zeile bei y = 551,0
const ROW_BOTTOM = 551.0;
const ROW_STEP = 15.58;
const MAX_ROWS = 12;
const COLUMNS = {
  name: { x: 46, width: 93 },
  shares: { right: 198 },
  date: { x: 206, width: 56 },
  perShare: { right: 320 },
  gross: { right: 391 },
  tax: { right: 470 },
  refund: { right: 549 },
};

const formatDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

/** "DE03 2004 1155 0205 5291 00" */
const groupIban = (iban) => String(iban ?? "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

/**
 * @param {ArrayBuffer | Uint8Array} templateBytes - app/public/forms/se-skv3740-template.pdf
 * @param {InvestorProfile} profile
 * @param {{ rows: object[], part: number, of: number }} form
 * @param {{ today?: Date }} [options]
 * @returns {Promise<PDFDocument>}
 */
export async function buildSkv3740Document(templateBytes, profile, form, { today = new Date() } = {}) {
  if (form.rows.length > MAX_ROWS) throw new Error(`SKV 3740 hat nur ${MAX_ROWS} Zeilen`);
  const pdfDoc = await PDFDocument.load(templateBytes);
  if (pdfDoc.getPageCount() > 2) pdfDoc.removePage(2); // Seite 3 = Hinweise
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const [p1, p2] = pdfDoc.getPages();
  const { residence, bank } = profile;

  /** Text, bei Bedarf verkleinert; noLink: wie beim Form A, damit Viewer die E-Mail nicht als Link erkennen */
  function text(page, value, x, y, { maxWidth = 500, size = SIZE, right = false, noLink = false } = {}) {
    const str = String(value ?? "").trim();
    if (!str) return;
    let s = size;
    while (s > 6 && font.widthOfTextAtSize(str, s) > maxWidth) s -= 0.5;
    const draw = (part, px) => page.drawText(`${part} `, { x: px, y, size: s, font, color: INK });
    const startX = right ? x - font.widthOfTextAtSize(str, s) : x;
    const at = noLink ? str.indexOf("@") : -1;
    if (at > 0) {
      draw(str.slice(at), startX + font.widthOfTextAtSize(str.slice(0, at), s));
      draw(str.slice(0, at), startX);
    } else {
      draw(str, startX);
    }
  }
  /** Kreuz (zwei Diagonalen) in ein Kästchen der Vorlage; x/y = linke untere Ecke, Kästchen ca. 10 pt */
  function cross(page, x, y) {
    const o = 2.2;
    const opts = { thickness: 1.2, color: INK };
    page.drawLine({ start: { x: x + o, y: y + o }, end: { x: x + 10 - o, y: y + 10 - o }, ...opts });
    page.drawLine({ start: { x: x + o, y: y + 10 - o }, end: { x: x + 10 - o, y: y + o }, ...opts });
  }

  const fullName = `${residence.firstName ?? ""} ${residence.lastName ?? ""}`.trim();

  // --- Seite 1: Antragsteller ---
  text(p1, `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`, 306, 749, { maxWidth: 120 });
  text(p1, fullName, 46, 708.5, { size: 11, maxWidth: 370 });
  text(p1, [residence.address, `${residence.postalCode ?? ""} ${residence.city ?? ""}`.trim(), "Germany"].filter(Boolean).join(", "), 46, 686.5, { size: 11, maxWidth: 500 });
  text(p1, residence.email, 46, 664.5, { size: 11, maxWidth: 370, noLink: true });
  text(p1, residence.phone, 427, 664.5, { size: 11, maxWidth: 122 });

  // II.1 Wohnsitz unter der Adresse (Ja) - Ja-Kästchen jeweils in der schwedischen und englischen Zeile, wie im Muster
  cross(p1, 432.1, 552.1);
  cross(p1, 432.1, 529.0);
  // III.1 wirtschaftlicher Eigentümer der Aktien (Ja)
  cross(p1, 432.1, 408.7);
  cross(p1, 432.1, 392.5);
  // III.2 keine Betriebsstätte in Schweden (Nej), III.2a nicht damit verbunden (Nej)
  cross(p1, 488.8, 324.1);
  cross(p1, 488.8, 299.5);
  cross(p1, 488.8, 277.3);
  cross(p1, 488.8, 255.5);

  const totals = formTotals(form.rows);
  text(p1, formatSek(totals.refund), 514, 81.5, { right: true, size: 11, maxWidth: 120 });

  // --- Seite 2: Auszahlung ---
  cross(p2, 121.8, 783.1); // Auszahlung in EUR
  text(p2, [bank.bankName, bank.address].filter(Boolean).join(", "), 175, 764, { maxWidth: 370 });
  text(p2, bank.bic, 175, 742.5, { maxWidth: 120 });
  text(p2, groupIban(bank.iban), 175, 720.5, { size: 11, maxWidth: 370 });
  text(p2, bank.accountHolderName || fullName, 175, 698.5, { size: 11, maxWidth: 370 });

  // --- Seite 2: Tabelle IV ---
  form.rows.forEach((d, i) => {
    const y = ROW_BOTTOM - ROW_STEP * i + 4.8;
    const { refund } = refundFor(d);
    text(p2, d.issuerName || d.isin, COLUMNS.name.x, y, { maxWidth: COLUMNS.name.width });
    text(p2, String(d.shares ?? "").replace(",", "."), COLUMNS.shares.right, y, { right: true, maxWidth: 52 });
    text(p2, formatDate(d.paymentDate), COLUMNS.date.x, y, { maxWidth: COLUMNS.date.width });
    if (d.dividendPerShare) text(p2, formatSek(d.dividendPerShare, { maxDigits: 4 }), COLUMNS.perShare.right, y, { right: true, maxWidth: 52 });
    text(p2, formatSek(d.grossDividend), COLUMNS.gross.right, y, { right: true, maxWidth: 64 });
    text(p2, formatSek(d.withheldTax), COLUMNS.tax.right, y, { right: true, maxWidth: 72 });
    text(p2, formatSek(refund), COLUMNS.refund.right, y, { right: true, maxWidth: 72 });
  });
  text(p2, formatSek(totals.gross), 391, 366.5, { right: true, size: 11, maxWidth: 64 });
  text(p2, formatSek(totals.refund), 549, 366.5, { right: true, size: 11, maxWidth: 72 });

  // Intyg om hemvist: das Land steht vor, Stempel/Unterschrift setzt das Finanzamt darunter
  text(p2, "Germany", 46, 279, { size: 14, maxWidth: 300 });

  const years = yearsOf(form.rows);
  pdfDoc.setTitle(`SKV 3740 – ${fullName} – ${years.join(", ")}`);
  return pdfDoc;
}

/** Ein Formular als PDF */
export async function fillSkv3740(templateBytes, profile, form, options) {
  return (await buildSkv3740Document(templateBytes, profile, form, options)).save();
}

/** Alle Formulare eines Falls in einem PDF (zum Ausdrucken) */
export async function fillAllSkv3740(templateBytes, profile, forms, options) {
  const merged = await PDFDocument.create();
  for (const form of forms) {
    const doc = await buildSkv3740Document(templateBytes, profile, form, options);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/** Dateiname: SKV3740_Schweden_Mustermann_2022-2023[_Teil1].pdf */
export function skv3740FileName(profile, form) {
  const years = yearsOf(form.rows);
  const yearLabel = years.length > 1 ? `${years[0]}-${years[years.length - 1]}` : `${years[0]}`;
  const part = form.of > 1 ? `_Teil${form.part}` : "";
  return `SKV3740_Schweden_${profile.residence.lastName || "DivRebound"}_${yearLabel}${part}.pdf`;
}
