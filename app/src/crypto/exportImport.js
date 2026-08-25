// Verschlüsseltes Export/Import der Bearbeitungsstände (.divrebound.json).
// Web Crypto API: PBKDF2 (SHA-256) zur Schlüsselableitung aus der
// Nutzer-Passphrase, AES-GCM zur eigentlichen Verschlüsselung. Der GCM-
// Auth-Tag sorgt automatisch dafür, dass eine falsche Passphrase beim Import
// mit einem klaren Fehler abbricht statt stillschweigend kaputtes JSON zu
// liefern - kein separates Prüfverfahren nötig.

const PBKDF2_ITERATIONS = 210_000; // OWASP-2023-Richtwert für PBKDF2-SHA256
const SCHEMA_VERSION = "1.0";

function toBase64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * @param {{ investorProfiles: InvestorProfile[], reclaimCases: ReclaimCase[] }} payload
 * @param {string} passphrase
 * @returns {Promise<object>} Inhalt für .divrebound.json
 */
export async function exportEncrypted(payload, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV, AES-GCM-Standard
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    encryption: { algorithm: "AES-GCM", salt: toBase64(salt), iv: toBase64(iv) },
    encryptedPayload: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * @param {object} fileJson Inhalt aus einer .divrebound.json-Datei
 * @param {string} passphrase
 * @returns {Promise<{ investorProfiles: InvestorProfile[], reclaimCases: ReclaimCase[] }>}
 * @throws wenn die Passphrase falsch ist (AES-GCM-Auth-Tag schlägt fehl)
 */
export async function importEncrypted(fileJson, passphrase) {
  const salt = fromBase64(fileJson.encryption.salt);
  const iv = fromBase64(fileJson.encryption.iv);
  const key = await deriveKey(passphrase, salt);
  const ciphertext = fromBase64(fileJson.encryptedPayload);
  const plaintextBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintextBuf));
}

export function triggerJsonDownload(json, fileName) {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export const MIN_PASSPHRASE_LENGTH = 8;
