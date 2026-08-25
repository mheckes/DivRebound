import { openDB } from "idb";

const DB_NAME = "divrebound";
const DB_VERSION = 1;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    db.createObjectStore("investorProfiles", { keyPath: "profileId" });

    const cases = db.createObjectStore("reclaimCases", { keyPath: "caseId" });
    cases.createIndex("byProfileId", "profileId");
    cases.createIndex("byTargetCountry", "targetCountry");
  },
});
