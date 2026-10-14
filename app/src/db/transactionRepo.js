// Käufe und Verkäufe (Wertpapierbestand Schweiz, docs/konzept-schweiz.md §3.1).
// Gehören zum Profil, nicht zu einem einzelnen Fall: ein Folge-DivRebound
// liest denselben Bestand und ergänzt nur neue Transaktionen.

import { dbPromise } from "./db.js";

/**
 * @typedef {object} StoredTransaction
 * @property {string} transactionId
 * @property {string} profileId
 * @property {string} depotId          Depot-Nr. aus der Abrechnung, "" wenn unbekannt
 * @property {string} isin
 * @property {string} issuerName
 * @property {"buy" | "sell"} type
 * @property {string} tradeDate        Handelstag, ISO
 * @property {number} quantity
 * @property {{ kind: "pdf" | "manual", broker?: string, documentRef?: string, fileName?: string, importedAt: string }} source
 * @property {"extracted" | "confirmed"} extractionConfidence
 */

/** @returns {Promise<StoredTransaction[]>} */
export async function getByProfileId(profileId) {
  const db = await dbPromise;
  return db.getAllFromIndex("transactions", "byProfileId", profileId);
}

/** @param {StoredTransaction} transaction */
export async function put(transaction) {
  const db = await dbPromise;
  await db.put("transactions", transaction);
  return transaction;
}

export async function remove(transactionId) {
  const db = await dbPromise;
  return db.delete("transactions", transactionId);
}

/**
 * Eine Abrechnung gilt als bereits erfasst, wenn Broker und Belegnummer
 * (bei Baader: Vorgangs-Nr. + Referenz-Nr.) schon vorkommen - derselbe
 * Upload zweimal ändert dann nichts.
 * @param {StoredTransaction[]} existing
 * @param {{ broker?: string, documentRef?: string }} source
 */
export function isDuplicateDocument(existing, source) {
  if (!source?.documentRef) return false;
  return existing.some((t) => t.source?.broker === source.broker && t.source?.documentRef === source.documentRef);
}
