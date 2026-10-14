// Screen "Persönliche Daten" (#/profile). Bearbeitet das persistente
// InvestorProfile des angemeldeten Nutzers. Layout/Copy ursprünglich aus
// divrebound_profile_mockup.html, erweitert nach docs/konzept-schweiz.md §2b:
// eigene Karte "Steuerliche Angaben" mit Steuer-ID, Steuernummer (für die
// Schweiz) und der Anschrift des zuständigen Finanzamts.
//
// Gespeichert wird automatisch beim Verlassen eines Felds (util/autosave.js,
// Konzept §2c) - es gibt keinen Speichern-Button mehr. Dieselben Felder (über
// util/profileFields.js) stehen auch in "Anschreiben Finanzamt" und werden dort
// ebenso direkt ins Profil gespeichert.
//
// Wichtig (siehe divrebound_data_schema.md §2, "applicantSnapshot"): dieser Screen
// schreibt ausschließlich auf getState().currentProfile + profileRepo.put(). Er
// rührt NIE an ReclaimCase.applicantSnapshot.
//
// Ist noch kein Profil vorhanden (Nutzer kommt direkt hierher statt zuerst
// über "Neuer DivRebound"), wird ein leeres Profil nur im Speicher gehalten
// und mit der ersten Eingabe tatsächlich persistiert (profileRepo.put legt es
// per Upsert neu an). Die Privatanleger-Bestätigung ist bewusst NICHT Teil
// dieses Screens - die bleibt ausschließlich im Popup-Dialog
// (components/newCaseWizard.js).

import { getState } from "../../store/store.js";
import { tinHint } from "../../util/validate.js";
import { confirmedFieldClasses } from "../../util/fieldDisplay.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { bindProfileAutosave } from "../../util/autosave.js";

export function mount(container) {
  const blank = buildBlankProfile();
  const getProfile = () => getState().currentProfile ?? blank;
  render(container, getProfile());
  return bindProfileAutosave(container, {
    getProfile,
    onSaved: (profile, key) => {
      // Format und Hinweis der Steuer-ID hängen vom Wohnsitzland ab.
      if (key === "country") {
        const hintEl = container.querySelector("[data-tin-hint]");
        if (hintEl) hintEl.textContent = `· ${tinHint(profile.residence.country)}`;
      }
    },
  });
}

function buildBlankProfile() {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    profileId: crypto.randomUUID(),
    investorType: "private",
    heldInPrivateAssets: true,
    residence: {
      country: "DE",
      firstName: "",
      lastName: "",
      birthDate: "",
      birthPlace: "",
      tin: "",
      taxNumber: "",
      email: "",
      phone: "",
      address: "",
      postalCode: "",
      city: "",
      taxOffice: { name: "", street: "", postalCode: "", city: "" },
    },
    bank: { bankName: "", accountHolderName: "", iban: "", bic: "" },
    createdAt: now,
    updatedAt: now,
  };
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chevronIcon() {
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
}

function infoIcon() {
  return `<svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
}

/**
 * Ein Profilfeld: bei vorhandenem Wert wie reiner Text (util/fieldDisplay.js),
 * bei leerem Wert als Eingabefeld. Gespeichert über data-field (autosave).
 */
function field(profile, key, label, { hint, hintAttr = "", wide, mono, type, placeholder } = {}) {
  const value = PROFILE_FIELDS[key].read(profile);
  const c = confirmedFieldClasses(value);
  return `
    <div class="field-row ${wide ? "field-row-wide" : ""}">
      <label class="${c.labelClass}">${label}${hint ? ` <span class="field-optional" ${hintAttr}>· ${hint}</span>` : ""}</label>
      <input class="${c.inputClass}${mono ? " mono" : ""}" data-field="${key}" ${type ? `type="${type}"` : ""} placeholder="${esc(placeholder ?? "")}" value="${esc(value)}">
      <span class="field-error" data-error-for="${key}" hidden></span>
    </div>`;
}

function render(container, profile) {
  const r = profile.residence;
  const privateAssets = confirmedFieldClasses(profile.heldInPrivateAssets);
  const country = confirmedFieldClasses(r.country);

  container.innerHTML = `
    <div class="profile-page">
    <div class="content-header">
      <h1 class="content-title">Persönliche Daten</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Persönliche Angaben</span></div>
      <div class="card-body">
        <div class="field-grid">
          ${field(profile, "firstName", "Vorname")}
          ${field(profile, "lastName", "Nachname")}
        </div>
        <div class="field-grid">
          ${field(profile, "birthDate", "Geburtsdatum", { type: "date" })}
          ${field(profile, "birthPlace", "Geburtsort", { hint: "wie im Reisepass" })}
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${privateAssets.labelClass}">Hältst du deine Aktien im Privatvermögen?</label>
            <select class="${privateAssets.inputClass}">
              <option value="yes" selected>Ja</option>
            </select>
          </div>
          <div class="field-row">
            <label class="${country.labelClass}">Wohnsitzland</label>
            <select class="${country.inputClass}" data-field="country">
              <option value="DE" selected>Deutschland</option>
            </select>
          </div>
        </div>
        <div class="field-grid">
          ${field(profile, "address", "Straße und Hausnummer", { wide: true })}
        </div>
        <div class="field-grid">
          ${field(profile, "postalCode", "Postleitzahl")}
          ${field(profile, "city", "Ort")}
        </div>
        <div class="field-grid">
          ${field(profile, "email", "Email")}
          ${field(profile, "phone", "Telefon", { placeholder: "inkl. Ländervorwahl" })}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Steuerliche Angaben</span></div>
      <div class="card-body">
        <div class="field-grid">
          ${field(profile, "tin", "Steuer-ID (TIN)", { hint: `${tinHint(r.country)}`, hintAttr: "data-tin-hint", mono: true, placeholder: "z.B. 86095742719" })}
          ${field(profile, "taxNumber", "Steuernummer", { mono: true, placeholder: "z.B. 143/123/45678" })}
        </div>

        <div class="profile-subtitle">Zuständiges Finanzamt</div>
        <div class="field-grid">
          ${field(profile, "taxOfficeName", "Name", { wide: true, placeholder: "z.B. Finanzamt München I" })}
        </div>
        <div class="field-grid">
          ${field(profile, "taxOfficeStreet", "Straße und Hausnummer", { wide: true, placeholder: "z.B. Deroystraße 4" })}
        </div>
        <div class="field-grid">
          ${field(profile, "taxOfficePostalCode", "Postleitzahl", { placeholder: "z.B. 80335" })}
          ${field(profile, "taxOfficeCity", "Ort", { placeholder: "z.B. München" })}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bankverbindung</span></div>
      <div class="card-body">
        <div class="field-grid">
          ${field(profile, "bankName", "Name der Bank")}
          ${field(profile, "accountHolderName", "Kontoinhaber")}
        </div>
        <div class="field-grid">
          ${field(profile, "bic", "BIC / SWIFT", { mono: true })}
          ${field(profile, "iban", "IBAN", { mono: true })}
        </div>
        <div class="field-hint">Geben Sie hier ein Konto an, das SEPA-Überweisungen empfangen kann und auf dem Sie Ihre Quellensteuer-Erstattung erhalten wollen.</div>
      </div>
    </div>

    <details class="help-disclosure">
      <summary>
        ${chevronIcon()}
        ${infoIcon()}
        🔒 Wo werden meine Daten gespeichert?
      </summary>
      <div class="help-disclosure-body">
        <ul class="help-list">
          <li>Alles hier bleibt lokal auf diesem Gerät — nichts wird an einen Server übertragen.</li>
          <li>Für die Bearbeitung an einem anderen Gerät: verschlüsselte <span class="mono">.divrebound.json</span>-Datei exportieren und dort wieder importieren.</li>
          <li>Andere Nutzer dieser App sehen ausschließlich ihre eigenen Daten — nie Ihre.</li>
          <li>Löschen des Browser-/App-Speichers löscht auch diese Daten unwiderruflich, sofern kein Export vorher gespeichert wurde.</li>
        </ul>
      </div>
    </details>

    <div class="autosave-note profile-autosave-note">✓ Änderungen werden beim Verlassen eines Felds automatisch gespeichert.</div>
    </div>
  `;

  // .value explizit setzen statt sich allein auf das HTML-"selected"-Attribut
  // zu verlassen - bei einem per innerHTML frisch eingefügten <select> wird
  // die tatsächliche Selektion sonst nicht zuverlässig übernommen.
  container.querySelector('[data-field="country"]').value = r.country;
}
