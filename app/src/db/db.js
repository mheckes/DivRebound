import { openDB } from "idb";

const DB_NAME = "divrebound";
// v2: Store "transactions" für Käufe/Verkäufe (Wertpapierbestand Schweiz,
// docs/konzept-schweiz.md §3.1) - pro Profil, unabhängig von einzelnen Fällen.
const DB_VERSION = 2;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore("investorProfiles", { keyPath: "profileId" });

      const cases = db.createObjectStore("reclaimCases", { keyPath: "caseId" });
      cases.createIndex("byProfileId", "profileId");
      cases.createIndex("byTargetCountry", "targetCountry");
    }
    if (oldVersion < 2) {
      const transactions = db.createObjectStore("transactions", { keyPath: "transactionId" });
      transactions.createIndex("byProfileId", "profileId");
    }
  },
});
