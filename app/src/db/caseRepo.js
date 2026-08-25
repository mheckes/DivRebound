import { dbPromise } from "./db.js";

const SCHEMA_VERSION = "1.0";

/** @returns {Promise<ReclaimCase | undefined>} */
export async function get(caseId) {
  const db = await dbPromise;
  return db.get("reclaimCases", caseId);
}

/** @returns {Promise<ReclaimCase[]>} */
export async function getByProfileId(profileId) {
  const db = await dbPromise;
  return db.getAllFromIndex("reclaimCases", "byProfileId", profileId);
}

/** @returns {Promise<ReclaimCase[]>} */
export async function getByCountry(targetCountry) {
  const db = await dbPromise;
  return db.getAllFromIndex("reclaimCases", "byTargetCountry", targetCountry);
}

/** @param {ReclaimCase} reclaimCase */
export async function put(reclaimCase) {
  const db = await dbPromise;
  reclaimCase.updatedAt = new Date().toISOString();
  await db.put("reclaimCases", reclaimCase);
  return reclaimCase;
}

export async function remove(caseId) {
  const db = await dbPromise;
  return db.delete("reclaimCases", caseId);
}

/**
 * Legt einen neuen Case an und kopiert die relevanten Profilangaben EINMALIG
 * in `applicantSnapshot`. Spätere Profiländerungen wirken sich bewusst NICHT
 * rückwirkend auf diesen Snapshot aus (siehe divrebound_data_schema.md §2) –
 * das ist die einzige Stelle im Code, die applicantSnapshot befüllen darf.
 * @param {InvestorProfile} profile
 * @param {string} targetCountry
 * @returns {Promise<ReclaimCase>}
 */
export async function createCase(profile, targetCountry) {
  const now = new Date().toISOString();
  const { residence, bank } = profile;

  /** @type {ReclaimCase} */
  const reclaimCase = {
    schemaVersion: SCHEMA_VERSION,
    caseId: crypto.randomUUID(),
    profileId: profile.profileId,
    targetCountry,
    status: "draft",
    applicantSnapshot: {
      firstName: residence.firstName,
      lastName: residence.lastName,
      address: residence.address,
      postalCode: residence.postalCode,
      city: residence.city,
      tin: residence.tin,
      bank: {
        name: bank.bankName,
        holder: bank.accountHolderName,
        bic: bank.bic,
        iban: bank.iban,
      },
      taxOffice: { name: residence.taxOffice.name, address: residence.taxOffice.address },
      snapshotTaken: now,
    },
    residencePeriod: { from: now.slice(0, 10), until: null },
    distributions: [],
    submissionChunks: [],
    generatedDocuments: [],
    createdAt: now,
    updatedAt: now,
  };
  await put(reclaimCase);
  return reclaimCase;
}
