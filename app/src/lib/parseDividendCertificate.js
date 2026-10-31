// PDF -> Textzeilen -> Auswertung (lib/dividendCertificateParser.js).

import { extractTextLines } from "./pdfText.js";
import { parseDividendLines } from "./dividendCertificateParser.js";

/**
 * @param {ArrayBuffer | Uint8Array} pdfBytes
 * @param {CorridorConfig} corridorConfig
 */
export async function parseDividendCertificate(pdfBytes, corridorConfig) {
  const lines = await extractTextLines(pdfBytes);
  return parseDividendLines(lines, corridorConfig);
}
