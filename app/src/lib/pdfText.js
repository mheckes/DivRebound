// Gemeinsame Textrekonstruktion für alle PDF-Parser (Dividendenabrechnungen,
// Wertpapierabrechnungen, Tax Voucher). PDF.js liefert Text-Items mit
// x/y-Koordinaten, keine fertigen Zeilen - Gruppierung nach ähnlicher y-Position,
// innerhalb einer Zeile von links nach rechts.

import * as pdfjsLib from "pdfjs-dist";

/**
 * @param {ArrayBuffer | Uint8Array} pdfBytes
 * @returns {Promise<string[]>}
 */
export async function extractTextLines(pdfBytes) {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  const lines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const rows = new Map();
    const Y_TOLERANCE = 2;

    for (const item of content.items) {
      const y = item.transform[5];
      const rowKey = [...rows.keys()].find((k) => Math.abs(k - y) <= Y_TOLERANCE);
      const key = rowKey ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(item);
    }

    const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of sortedRows) {
      const lineText = items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (lineText) lines.push(lineText);
    }
  }

  return lines;
}
