import { dbPromise } from "./db.js";

const SCHEMA_VERSION = "1.0";

/** @returns {Promise<InvestorProfile | undefined>} */
export async function get(profileId) {
  const db = await dbPromise;
  return db.get("investorProfiles", profileId);
}

/** @returns {Promise<InvestorProfile[]>} */
export async function getAll() {
  const db = await dbPromise;
  return db.getAll("investorProfiles");
}

/** @param {InvestorProfile} profile */
export async function put(profile) {
  const db = await dbPromise;
  profile.updatedAt = new Date().toISOString();
  await db.put("investorProfiles", profile);
  return profile;
}

export async function remove(profileId) {
  const db = await dbPromise;
  return db.delete("investorProfiles", profileId);
}

/**
 * Legt ein neues, weitgehend leeres Profil an – die Wizard-Screens befüllen
 * die einzelnen Felder anschließend über put().
 * @param {"DE"|"AT"|"CH"} residenceCountry
 * @returns {Promise<InvestorProfile>}
 */
export async function createProfile(residenceCountry) {
  const now = new Date().toISOString();
  /** @type {InvestorProfile} */
  const profile = {
    schemaVersion: SCHEMA_VERSION,
    profileId: crypto.randomUUID(),
    investorType: "private",
    heldInPrivateAssets: true,
    residence: {
      country: residenceCountry,
      firstName: "",
      lastName: "",
      birthDate: "",
      birthPlace: "",
      tin: "",
      email: "",
      phone: "",
      address: "",
      postalCode: "",
      city: "",
      taxOffice: { name: "", address: "", lastConfirmed: "" },
    },
    bank: {
      bankName: "",
      accountHolderName: "",
      accountHolderAddress: "",
      iban: "",
      bic: "",
    },
    createdAt: now,
    updatedAt: now,
  };
  await put(profile);
  return profile;
}
