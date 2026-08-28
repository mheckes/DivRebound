// Screen "Persönliche Daten" (#/profile). Bearbeitet das persistente
// InvestorProfile des angemeldeten Nutzers. Layout/Copy/Sections 1:1 aus
// divrebound_profile_mockup.html übernommen (--teal-*/--gold-* dort entspricht
// --navy/--cyan hier) - die dortige Beispielperson ("Matthias Heckes" etc.) und
// die alert()-Platzhalter sind hier durch echte Store-/Repo-Anbindung ersetzt.
//
// Wichtig (siehe divrebound_data_schema.md §2, "applicantSnapshot"): dieser Screen
// schreibt ausschließlich auf getState().currentProfile + profileRepo.put(). Er
// rührt NIE an ReclaimCase.applicantSnapshot - dieser wird bei Case-Anlage einmalig
// kopiert und danach bewusst eingefroren. Profiländerungen hier wirken sich nur auf
// künftig neu angelegte Cases aus, nie rückwirkend auf bestehende.

import { getState, setState } from "../../store/store.js";
import * as profileRepo from "../../db/profileRepo.js";
import { isValidTin, tinHint } from "../../util/validate.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { confirmedFieldClasses } from "../../util/fieldDisplay.js";

let savedTimeoutId = null;

export function mount(container) {
  render(container);
}

function render(container) {
  const profile = getState().currentProfile;
  if (!profile) {
    renderEmpty(container);
    return;
  }
  renderForm(container, profile);
}

function renderEmpty(container) {
  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Persönliche Daten</h1>
    </div>
    <div class="info-banner">
      <span class="icon">ℹ</span>
      <div>Es ist kein Profil vorhanden. Lege zunächst über den Einstiegs-Dialog ein Profil an.</div>
    </div>
  `;
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

function renderForm(container, profile) {
  const r = profile.residence;
  const b = profile.bank;
  const t = normalizeTaxOffice(r.taxOffice);

  // Alle Felder dieser Seite einheitlich: bei bereits vorhandenem Wert wirkt
  // das Feld wie reiner Text (siehe util/fieldDisplay.js), bei leerem Wert wie
  // ein normales, zum Ausfüllen einladendes Eingabefeld - nicht nur bei
  // Finanzamt, sondern konsistent für die ganze "Persönliche Daten"-Seite.
  const cls = {
    firstName: confirmedFieldClasses(r.firstName),
    lastName: confirmedFieldClasses(r.lastName),
    birthDate: confirmedFieldClasses(r.birthDate),
    birthPlace: confirmedFieldClasses(r.birthPlace),
    country: confirmedFieldClasses(r.country),
    tin: confirmedFieldClasses(r.tin),
    address: confirmedFieldClasses(r.address),
    postalCode: confirmedFieldClasses(r.postalCode),
    city: confirmedFieldClasses(r.city),
    email: confirmedFieldClasses(r.email),
    phone: confirmedFieldClasses(r.phone),
    bankName: confirmedFieldClasses(b.bankName),
    accountHolderName: confirmedFieldClasses(b.accountHolderName),
    bic: confirmedFieldClasses(b.bic),
    iban: confirmedFieldClasses(b.iban),
    accountHolderAddress: confirmedFieldClasses(b.accountHolderAddress),
    taxOfficeName: confirmedFieldClasses(t.name),
    taxOfficeStreet: confirmedFieldClasses(t.street),
    taxOfficePostalCode: confirmedFieldClasses(t.postalCode),
    taxOfficeCity: confirmedFieldClasses(t.city),
  };

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Persönliche Daten</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Persönliche Angaben</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.firstName.labelClass}">Vorname</label>
            <input class="${cls.firstName.inputClass}" data-field="firstName" value="${esc(r.firstName)}">
          </div>
          <div class="field-row">
            <label class="${cls.lastName.labelClass}">Nachname</label>
            <input class="${cls.lastName.inputClass}" data-field="lastName" value="${esc(r.lastName)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.birthDate.labelClass}">Geburtsdatum</label>
            <input class="${cls.birthDate.inputClass}" type="date" data-field="birthDate" value="${esc(r.birthDate)}">
          </div>
          <div class="field-row">
            <label class="${cls.birthPlace.labelClass}">Geburtsort <span class="field-optional">· wie im Reisepass</span></label>
            <input class="${cls.birthPlace.inputClass}" data-field="birthPlace" value="${esc(r.birthPlace)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.country.labelClass}">Wohnsitzland</label>
            <select class="${cls.country.inputClass}" data-field="country">
              <option value="DE" ${r.country === "DE" ? "selected" : ""}>Deutschland</option>
              <option value="AT" ${r.country === "AT" ? "selected" : ""} ${r.country !== "AT" ? "disabled" : ""}>Österreich${r.country !== "AT" ? " (bald)" : ""}</option>
              <option value="CH" ${r.country === "CH" ? "selected" : ""} ${r.country !== "CH" ? "disabled" : ""}>Schweiz${r.country !== "CH" ? " (bald)" : ""}</option>
            </select>
            <span class="field-hint">Aktuell ist nur Deutschland neu auswählbar - weitere Länder folgen.</span>
          </div>
          <div class="field-row">
            <label class="${cls.tin.labelClass}">Steuer-ID (TIN)</label>
            <input class="${cls.tin.inputClass} mono" data-field="tin" value="${esc(r.tin)}">
            <span class="field-hint" data-tin-hint>${esc(tinHint(r.country))}</span>
            <span class="field-error" data-tin-error hidden></span>
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${cls.address.labelClass}">Adresse</label>
            <input class="${cls.address.inputClass}" data-field="address" value="${esc(r.address)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.postalCode.labelClass}">Postleitzahl</label>
            <input class="${cls.postalCode.inputClass}" data-field="postalCode" value="${esc(r.postalCode)}">
          </div>
          <div class="field-row">
            <label class="${cls.city.labelClass}">Ort</label>
            <input class="${cls.city.inputClass}" data-field="city" value="${esc(r.city)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.email.labelClass}">Email <span class="field-optional">· optional</span></label>
            <input class="${cls.email.inputClass}" data-field="email" value="${esc(r.email ?? "")}">
          </div>
          <div class="field-row">
            <label class="${cls.phone.labelClass}">Telefon <span class="field-optional">· optional</span></label>
            <input class="${cls.phone.inputClass}" data-field="phone" placeholder="inkl. Ländervorwahl" value="${esc(r.phone ?? "")}">
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bankverbindung</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.bankName.labelClass}">Name der Bank</label>
            <input class="${cls.bankName.inputClass}" data-field="bankName" value="${esc(b.bankName)}">
          </div>
          <div class="field-row">
            <label class="${cls.accountHolderName.labelClass}">Kontoinhaber</label>
            <input class="${cls.accountHolderName.inputClass}" data-field="accountHolderName" value="${esc(b.accountHolderName)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.bic.labelClass}">BIC / SWIFT</label>
            <input class="${cls.bic.inputClass} mono" data-field="bic" value="${esc(b.bic)}">
          </div>
          <div class="field-row">
            <label class="${cls.iban.labelClass}">IBAN</label>
            <input class="${cls.iban.inputClass} mono" data-field="iban" value="${esc(b.iban)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${cls.accountHolderAddress.labelClass}">Adresse des Kontoinhabers <span class="field-optional">· optional</span></label>
            <input class="${cls.accountHolderAddress.inputClass}" data-field="accountHolderAddress" value="${esc(b.accountHolderAddress ?? "")}">
          </div>
        </div>
        <div class="field-hint">Geben Sie hier ein Konto an, das SEPA-Überweisungen empfangen kann und auf dem Sie Ihre Quellensteuer-Erstattung erhalten wollen.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Finanzamt</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${cls.taxOfficeName.labelClass}">Name</label>
            <input class="${cls.taxOfficeName.inputClass}" data-field="taxOfficeName" placeholder="z.B. Finanzamt München I" value="${esc(t.name)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="${cls.taxOfficeStreet.labelClass}">Straße</label>
            <input class="${cls.taxOfficeStreet.inputClass}" data-field="taxOfficeStreet" placeholder="z.B. Deroystraße 4" value="${esc(t.street)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="${cls.taxOfficePostalCode.labelClass}">Postleitzahl</label>
            <input class="${cls.taxOfficePostalCode.inputClass}" data-field="taxOfficePostalCode" placeholder="z.B. 80335" value="${esc(t.postalCode)}">
          </div>
          <div class="field-row">
            <label class="${cls.taxOfficeCity.labelClass}">Ort</label>
            <input class="${cls.taxOfficeCity.inputClass}" data-field="taxOfficeCity" placeholder="z.B. München" value="${esc(t.city)}">
          </div>
        </div>
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

    <div class="save-row">
      <span class="save-status" data-save-status hidden>✓ Gespeichert</span>
      <span class="save-hint">Aktualisierung gilt für neu angelegte Fälle. Laufende Fälle bei Bedarf direkt dort anpassen.</span>
      <button class="btn-primary" data-action="save" type="button">Speichern</button>
    </div>
  `;

  attachListeners(container, profile);
}

function attachListeners(container, profile) {
  let country = profile.residence.country;
  const tinInput = container.querySelector('[data-field="tin"]');
  const tinError = container.querySelector("[data-tin-error]");
  const tinHintEl = container.querySelector("[data-tin-hint]");
  const countrySelect = container.querySelector('[data-field="country"]');
  // .value explizit setzen statt sich allein auf das HTML-"selected"-Attribut
  // zu verlassen - bei einem per innerHTML frisch eingefügten <select> wird
  // die tatsächliche Selektion sonst nicht zuverlässig übernommen.
  countrySelect.value = country;

  function validateTin() {
    const value = tinInput.value.trim();
    if (value && !isValidTin(country, value)) {
      tinError.textContent = `Ungültiges Format. Erwartet: ${tinHint(country)}`;
      tinError.hidden = false;
      return false;
    }
    tinError.hidden = true;
    return true;
  }
  tinInput.addEventListener("input", validateTin);
  tinInput.addEventListener("blur", validateTin);

  // Wohnsitzland ist jetzt änderbar (nur Deutschland neu wählbar, siehe
  // <select> oben) - TIN-Format/-Hinweis hängt vom Land ab, muss also live
  // mitziehen, wenn hier umgestellt wird.
  countrySelect.addEventListener("change", () => {
    country = countrySelect.value;
    tinHintEl.textContent = tinHint(country);
    validateTin();
  });

  container.querySelector('[data-action="save"]').addEventListener("click", async () => {
    if (!validateTin()) {
      tinInput.focus();
      return;
    }

    const value = (field) => container.querySelector(`[data-field="${field}"]`).value.trim();

    /** @type {InvestorProfile} */
    const updated = {
      ...profile,
      residence: {
        ...profile.residence,
        country: value("country"),
        firstName: value("firstName"),
        lastName: value("lastName"),
        birthDate: value("birthDate"),
        birthPlace: value("birthPlace"),
        tin: value("tin"),
        email: value("email"),
        phone: value("phone"),
        address: value("address"),
        postalCode: value("postalCode"),
        city: value("city"),
        taxOffice: {
          name: value("taxOfficeName"),
          street: value("taxOfficeStreet"),
          postalCode: value("taxOfficePostalCode"),
          city: value("taxOfficeCity"),
        },
      },
      bank: {
        ...profile.bank,
        bankName: value("bankName"),
        accountHolderName: value("accountHolderName"),
        accountHolderAddress: value("accountHolderAddress"),
        iban: value("iban"),
        bic: value("bic"),
      },
    };

    await profileRepo.put(updated);
    setState({ currentProfile: updated });

    // Neu rendern, damit gerade erst befüllte Felder sofort in die
    // "bestätigt"-Optik wechseln (siehe util/fieldDisplay.js) statt bis zum
    // nächsten Seitenaufruf wie ein noch leeres Feld auszusehen.
    render(container);
    showSaved(container);
  });
}

function showSaved(container) {
  const status = container.querySelector("[data-save-status]");
  if (!status) return;
  status.hidden = false;
  status.classList.add("visible");
  clearTimeout(savedTimeoutId);
  savedTimeoutId = setTimeout(() => {
    status.hidden = true;
    status.classList.remove("visible");
  }, 2500);
}
