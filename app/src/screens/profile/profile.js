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

const COUNTRY_LABELS = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };

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
  const t = r.taxOffice ?? { name: "", address: "", lastConfirmed: "" };
  const countryLabel = COUNTRY_LABELS[r.country] ?? r.country;

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Persönliche Daten</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Persönliche Angaben</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Vorname</label>
            <input class="field-input" data-field="firstName" value="${esc(r.firstName)}">
          </div>
          <div class="field-row">
            <label class="field-label">Nachname</label>
            <input class="field-input" data-field="lastName" value="${esc(r.lastName)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Geburtsdatum</label>
            <input class="field-input" type="date" data-field="birthDate" value="${esc(r.birthDate)}">
          </div>
          <div class="field-row">
            <label class="field-label">Geburtsort <span class="field-optional">· wie im Reisepass</span></label>
            <input class="field-input" data-field="birthPlace" value="${esc(r.birthPlace)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Wohnsitzland</label>
            <input class="field-input" value="${esc(countryLabel)}" disabled>
            <span class="field-hint">Hier nicht änderbar - dafür ein neues Profil anlegen.</span>
          </div>
          <div class="field-row">
            <label class="field-label">Steuer-ID (TIN)</label>
            <input class="field-input mono" data-field="tin" value="${esc(r.tin)}">
            <span class="field-hint" data-tin-hint>${esc(tinHint(r.country))}</span>
            <span class="field-error" data-tin-error hidden></span>
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="field-label">Adresse</label>
            <input class="field-input" data-field="address" value="${esc(r.address)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Postleitzahl</label>
            <input class="field-input" data-field="postalCode" value="${esc(r.postalCode)}">
          </div>
          <div class="field-row">
            <label class="field-label">Ort</label>
            <input class="field-input" data-field="city" value="${esc(r.city)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Email <span class="field-optional">· optional</span></label>
            <input class="field-input" data-field="email" value="${esc(r.email ?? "")}">
          </div>
          <div class="field-row">
            <label class="field-label">Telefon <span class="field-optional">· optional</span></label>
            <input class="field-input" data-field="phone" placeholder="inkl. Ländervorwahl" value="${esc(r.phone ?? "")}">
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bankverbindung</span></div>
      <div class="card-body">
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">Name der Bank</label>
            <input class="field-input" data-field="bankName" value="${esc(b.bankName)}">
          </div>
          <div class="field-row">
            <label class="field-label">Kontoinhaber</label>
            <input class="field-input" data-field="accountHolderName" value="${esc(b.accountHolderName)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row">
            <label class="field-label">BIC / SWIFT</label>
            <input class="field-input mono" data-field="bic" value="${esc(b.bic)}">
          </div>
          <div class="field-row">
            <label class="field-label">IBAN</label>
            <input class="field-input mono" data-field="iban" value="${esc(b.iban)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="field-label">Adresse des Kontoinhabers <span class="field-optional">· optional</span></label>
            <input class="field-input" data-field="accountHolderAddress" value="${esc(b.accountHolderAddress ?? "")}">
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
            <label class="field-label">Name</label>
            <input class="field-input" data-field="taxOfficeName" placeholder="z.B. Finanzamt München I" value="${esc(t.name)}">
          </div>
        </div>
        <div class="field-grid">
          <div class="field-row field-row-wide">
            <label class="field-label">Adresse</label>
            <input class="field-input" data-field="taxOfficeAddress" placeholder="z.B. Deroystraße 4, 80335 München" value="${esc(t.address)}">
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
  const country = profile.residence.country;
  const tinInput = container.querySelector('[data-field="tin"]');
  const tinError = container.querySelector("[data-tin-error]");

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
          ...(profile.residence.taxOffice ?? {}),
          name: value("taxOfficeName"),
          address: value("taxOfficeAddress"),
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
