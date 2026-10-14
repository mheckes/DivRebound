// PDF -> Textzeilen -> Auswertung (lib/brokerStatementParser.js).

import { extractTextLines } from "./pdfText.js";
import { parseStatementLines } from "./brokerStatementParser.js";

/** @param {ArrayBuffer | Uint8Array} pdfBytes */
export async function parseBrokerStatement(pdfBytes) {
  const lines = await extractTextLines(pdfBytes);
  return parseStatementLines(lines);
}
