// Screen "Fehlende Angaben ergänzen" (#/dk/:caseId/step1/missing-data).
// Mockup: Mock Up Status 08-2026/divrebound_step_missing_data_mockup.html
// (--teal-*/--gold* dort 1:1 auf --navy*/--cyan* aus tokens.css übersetzt).
//
// Arbeitet auf lokalen Kopien von profile/reclaimCase (siehe divrebound_data_schema.md):
// erst beim Klick auf "Weiter" wird tatsächlich persistiert (profileRepo.put /
// caseRepo.put) und der Store aktualisiert - bis dahin rein clientseitiger
// Formularzustand, kein Store-Reactivity/subscribe nötig.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as profileRepo from "../../db/profileRepo.js";
import * as caseRepo from "../../db/caseRepo.js";
import { isValidTin, tinHint } from "../../util/validate.js";

const COUNTRY_NAMES = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const TIN_PLACEHOLDER = { DE: "12345678901", AT: "FA-123456-7", CH: "756.1234.5678.90" };

/** @type {InvestorProfile} */
let profile;
/** @type {ReclaimCase} */
let reclaimCase;
/** @type {Set<string>} welche der 3 Pflichtfelder wurden bereits verlassen (blur) - steuert, ob field-error angezeigt wird */
let touched;
/** @type {boolean} ob "Von" noch dem automatisch abgeleiteten Wert entspricht (Badge nur dann sichtbar) */
let fromIsDerived;

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function caseLabel(rc) {
  const d = new Date(rc.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function earliestPaymentDate(distributions) {
  if (!distributions || distributions.length === 0) return null;
  return distributions.reduce((min, d) => (d.paymentDate < min ? d.paymentDate : min), distributions[0].paymentDate);
}

function splitFullName(full) {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop();
  return { firstName: parts.join(" "), lastName };
}

// "Aus den Abrechnungen übernommen" - Kartenfelder. applicantSnapshot wurde bei
// Case-Anlage einmalig aus dem Profil kopiert (siehe caseRepo.createCase) und
// kann laut Schema §2 direkt im Case korrigiert werden, falls der übernommene
// Wert für diesen Case nicht mehr passt - ohne Rückwirkung auf ältere Cases.
function knownFieldsConfig() {
  return [
    {
      key: "name",
      label: "Name",
      getSnapshot: () =>
        `${reclaimCase.applicantSnapshot.firstName ?? ""} ${reclaimCase.applicantSnapshot.lastName ?? ""}`.trim(),
      getProfile: () => `${profile.residence.firstName ?? ""} ${profile.residence.lastName ?? ""}`.trim(),
      setSnapshot: (v) => Object.assign(reclaimCase.applicantSnapshot, splitFullName(v)),
      setProfile: (v) => Object.assign(profile.residence, splitFullName(v)),
    },
    {
      key: "address",
      label: "Adresse",
      getSnapshot: () => reclaimCase.applicantSnapshot.address ?? "",
      getProfile: () => profile.residence.address ?? "",
      setSnapshot: (v) => (reclaimCase.applicantSnapshot.address = v),
      setProfile: (v) => (profile.residence.address = v),
    },
    {
      key: "postalCode",
      label: "PLZ",
      getSnapshot: () => reclaimCase.applicantSnapshot.postalCode ?? "",
      getProfile: () => profile.residence.postalCode ?? "",
      setSnapshot: (v) => (reclaimCase.applicantSnapshot.postalCode = v),
      setProfile: (v) => (profile.residence.postalCode = v),
    },
    {
      key: "city",
      label: "Ort",
      getSnapshot: () => reclaimCase.applicantSnapshot.city ?? "",
      getProfile: () => profile.residence.city ?? "",
      setSnapshot: (v) => (reclaimCase.applicantSnapshot.city = v),
      setProfile: (v) => (profile.residence.city = v),
    },
  ];
}

export function mount(container, params) {
  const state = getState();
  let currentProfile = state.currentProfile;
  let currentCase = state.currentCase;

  if (!currentCase && params?.caseId) {
    // Sollte laut main.js-Routing (ensureCaseSelected) eigentlich nicht vorkommen -
    // defensiv trotzdem abfangen, statt eine kaputte Seite zu zeigen.
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Fall nicht gefunden</h1></div>
      <div class="info-banner"><span class="icon">⚠</span><div>Für diesen Fall liegen keine lokalen Daten vor. Bitte über die Seitenleiste einen Fall auswählen.</div></div>
    `;
    return;
  }
  if (!currentProfile || !currentCase) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Kein Profil geladen</h1></div>
      <div class="info-banner"><span class="icon">⚠</span><div>Es ist kein Nutzerprofil geladen. Bitte zunächst das Onboarding durchlaufen.</div></div>
    `;
    return;
  }

  // Lokale, unabhängige Kopien - Store bleibt bis "Weiter" unverändert.
  profile = structuredClone(currentProfile);
  reclaimCase = structuredClone(currentCase);
  touched = new Set();

  const derivedFrom = earliestPaymentDate(reclaimCase.distributions);
  if (derivedFrom) {
    reclaimCase.residencePeriod.from = derivedFrom;
    fromIsDerived = true;
  } else {
    fromIsDerived = false;
  }

  render(container);
}

function render(container) {
  const knownFields = knownFieldsConfig();
  const knownFilled = knownFields.filter((f) => f.getSnapshot().trim() !== "").length;
  const taxOffice = profile.residence.taxOffice ?? { name: "", address: "", lastConfirmed: "" };
  profile.residence.taxOffice = taxOffice;
  const ongoing = !reclaimCase.residencePeriod.until;
  const countryLabel = COUNTRY_NAMES[profile.residence.country] ?? profile.residence.country;

  container.innerHTML = `
    <div class="content-header">
      <div class="content-breadcrumb">Dänemark <b>›</b> ${escapeHtml(caseLabel(reclaimCase))} <b>›</b> Schritt 1</div>
      <h1 class="content-title">Fehlende Angaben ergänzen</h1>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Aus den Abrechnungen übernommen</span>
        <span class="count-pill">${knownFilled} von ${knownFields.length} Feldern</span>
      </div>
      <div class="card-body" id="known-card-body">
        ${knownFields
          .map(
            (f) => `
          <div class="md-known-row">
            <div style="flex:1;">
              <div class="md-known-label">${f.label}</div>
              <input class="md-known-input mono" data-field="${f.key}" value="${escapeHtml(f.getSnapshot())}">
            </div>
            <span class="badge badge-confirmed">✓ aus Profil übernommen</span>
          </div>
          <div class="md-profile-diff" data-diff="${f.key}" style="display:none;"></div>
        `
          )
          .join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Zeitraum der Ansässigkeit</span>
      </div>
      <div class="card-body">
        <div class="field-hint" style="margin-bottom:14px;">"Von" wurde aus dem frühesten Zahltag Ihrer Ausschüttungen abgeleitet – bitte prüfen.</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
          <div class="field-row" style="flex:1;min-width:140px;">
            <label class="field-label" for="res-from">Von</label>
            <input type="date" id="res-from" class="field-input mono" value="${escapeHtml(reclaimCase.residencePeriod.from ?? "")}">
            <span class="badge badge-dupe" id="res-from-derived-badge" style="display:${fromIsDerived ? "inline-block" : "none"};width:fit-content;">↺ aus Abrechnungen abgeleitet</span>
          </div>
          <div class="field-row" style="flex:1;min-width:140px;">
            <label class="field-label" for="res-until">Bis</label>
            <input type="date" id="res-until" class="field-input mono" value="${escapeHtml(reclaimCase.residencePeriod.until ?? "")}" ${ongoing ? "disabled" : ""}>
            <label style="font-weight:400;font-size:11.5px;display:flex;align-items:center;gap:6px;margin-top:2px;cursor:pointer;">
              <input type="checkbox" id="res-ongoing" ${ongoing ? "checked" : ""} style="width:14px;height:14px;accent-color:var(--navy);">
              Wohnsitz besteht weiterhin
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Finanzamt</span>
      </div>
      <div class="card-body" id="taxoffice-card-body"></div>
    </div>

    <div class="card">
      <div class="card-head head-cyan">
        <span class="card-title">Bitte noch ergänzen</span>
        <span class="count-pill" id="missing-pill">3 Felder offen</span>
      </div>
      <div class="card-body">
        <div class="field-row">
          <label class="field-label" for="birthdate">Geburtsdatum</label>
          <input type="date" id="birthdate" class="field-input" value="${escapeHtml(profile.residence.birthDate ?? "")}">
          <div class="field-error" id="birthdate-error"></div>
        </div>

        <div class="field-row">
          <label class="field-label" for="birthplace">Geburtsort</label>
          <input type="text" id="birthplace" class="field-input" placeholder="z.B. München" value="${escapeHtml(profile.residence.birthPlace ?? "")}">
          <div class="field-hint">Wie im gültigen Reisepass/Personalausweis angegeben.</div>
          <div class="field-error" id="birthplace-error"></div>
        </div>

        <div class="field-row">
          <label class="field-label" for="tin">Steuer-ID (${escapeHtml(countryLabel)})</label>
          <input type="text" id="tin" class="field-input mono" placeholder="z.B. ${TIN_PLACEHOLDER[profile.residence.country] ?? ""}" value="${escapeHtml(profile.residence.tin ?? "")}">
          <div class="field-hint">${escapeHtml(tinHint(profile.residence.country))}</div>
          <div class="field-error" id="tin-error"></div>
        </div>
      </div>
    </div>

    <div class="md-bottom-bar">
      <a class="md-back-link" id="back-link">← Zurück</a>
      <button class="btn-primary" id="next-btn" disabled>Weiter →</button>
    </div>
  `;

  attachKnownCardListeners(container, knownFields);
  attachResidencePeriodListeners(container);
  renderTaxOffice(container.querySelector("#taxoffice-card-body"));
  attachRequiredFieldListeners(container);
  updateValidation(container);

  container.querySelector("#back-link").addEventListener("click", () => {
    navigate(`#/dk/${reclaimCase.caseId}/step1`);
  });

  container.querySelector("#next-btn").addEventListener("click", async () => {
    const state = getState();
    // TIN ist kein Teil der "Aus den Abrechnungen übernommen"-Karte (dort nur
    // Name/Adresse/PLZ/Ort) und wird deshalb hier separat in den Snapshot
    // übernommen, falls dort noch leer - sonst bliebe applicantSnapshot.tin
    // dauerhaft leer, obwohl das Profil die TIN längst kennt (siehe Cheat
    // Sheet / Zusammenfassung, die je nach Feld Snapshot oder Profil lesen).
    if (!reclaimCase.applicantSnapshot.tin && profile.residence.tin) {
      reclaimCase.applicantSnapshot.tin = profile.residence.tin;
    }
    await profileRepo.put(profile);
    await caseRepo.put(reclaimCase);
    setState({
      currentProfile: profile,
      currentCase: reclaimCase,
      cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
    });
    navigate(`#/dk/${reclaimCase.caseId}/step1/summary`);
  });
}

function attachKnownCardListeners(container, knownFields) {
  const body = container.querySelector("#known-card-body");

  function updateDiff(f) {
    const el = body.querySelector(`[data-diff="${f.key}"]`);
    const snapshotValue = f.getSnapshot();
    const profileValue = f.getProfile();
    if (snapshotValue !== profileValue) {
      el.innerHTML = `Profil zeigt noch "${escapeHtml(profileValue)}" · <a href="#" data-update-profile="${f.key}">auch dort übernehmen</a>`;
      el.style.display = "";
    } else {
      el.innerHTML = "";
      el.style.display = "none";
    }
  }

  knownFields.forEach((f) => {
    updateDiff(f);
    const input = body.querySelector(`[data-field="${f.key}"]`);
    input.addEventListener("input", () => {
      f.setSnapshot(input.value);
      // fillResidencyCertificate.js liest Name/Adresse ausschließlich aus dem
      // live Profil, nie aus applicantSnapshot. Ist das Profil für dieses Feld
      // noch leer (Normalfall bei der allerersten Eingabe, da beim Case-Anlegen
      // noch kein Name bekannt war), zusätzlich ins Profil übernehmen - sonst
      // landet der hier eingetippte Wert nie im tatsächlich erzeugten PDF.
      // Hat das Profil bereits einen Wert, bleibt es bei reiner Case-Override-
      // Semantik (nur Snapshot ändert sich), wie im Schema für Folgefälle vorgesehen.
      if (!f.getProfile().trim()) f.setProfile(input.value);
      updateDiff(f);
    });
  });

  body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-update-profile]");
    if (!link) return;
    e.preventDefault();
    const f = knownFields.find((x) => x.key === link.dataset.updateProfile);
    f.setProfile(f.getSnapshot());
    updateDiff(f);
  });
}

function attachResidencePeriodListeners(container) {
  const fromInput = container.querySelector("#res-from");
  const derivedBadge = container.querySelector("#res-from-derived-badge");
  fromInput.addEventListener("input", () => {
    reclaimCase.residencePeriod.from = fromInput.value;
    derivedBadge.style.display = "none";
  });

  const ongoingCheckbox = container.querySelector("#res-ongoing");
  const untilInput = container.querySelector("#res-until");
  ongoingCheckbox.addEventListener("change", () => {
    const ongoing = ongoingCheckbox.checked;
    untilInput.disabled = ongoing;
    if (ongoing) {
      untilInput.value = "";
      reclaimCase.residencePeriod.until = null;
    } else {
      reclaimCase.residencePeriod.until = untilInput.value || null;
    }
  });
  untilInput.addEventListener("input", () => {
    reclaimCase.residencePeriod.until = untilInput.value || null;
  });
}

function renderTaxOffice(body) {
  const taxOffice = profile.residence.taxOffice;
  const hasExisting = Boolean(taxOffice.name?.trim());

  if (hasExisting) {
    body.innerHTML = `
      <div style="font-size:14px;margin-bottom:4px;"><b>${escapeHtml(taxOffice.name)}</b> – noch aktuell?</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">${escapeHtml(taxOffice.address)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-accent" data-action="confirm">✓ Ja, weiterhin aktuell</button>
        <button class="btn-secondary" data-action="edit">Nicht mehr aktuell</button>
      </div>
    `;
    body.querySelector('[data-action="confirm"]').addEventListener("click", () => {
      taxOffice.lastConfirmed = todayIso();
      renderTaxOffice(body);
    });
    body.querySelector('[data-action="edit"]').addEventListener("click", () => {
      renderTaxOfficeEdit(body, true);
    });
  } else {
    renderTaxOfficeEdit(body, false);
  }
}

function renderTaxOfficeEdit(body, canCancel) {
  const taxOffice = profile.residence.taxOffice;
  body.innerHTML = `
    <div class="field-row">
      <label class="field-label" for="taxoffice-name">Name des Finanzamts</label>
      <input type="text" id="taxoffice-name" class="field-input" placeholder="z.B. Finanzamt München I" value="${escapeHtml(taxOffice.name)}">
    </div>
    <div class="field-row">
      <label class="field-label" for="taxoffice-address">Adresse</label>
      <input type="text" id="taxoffice-address" class="field-input" placeholder="Straße, PLZ, Ort" value="${escapeHtml(taxOffice.address)}">
    </div>
    <div class="field-hint" style="margin-bottom:14px;">Zu finden auf Ihrem letzten Einkommensteuerbescheid, oder über die BZSt-Finanzamtsuche.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <button class="btn-primary" data-action="save">Speichern</button>
      ${canCancel ? '<a class="md-back-link" data-action="cancel">Abbrechen</a>' : ""}
    </div>
  `;
  body.querySelector('[data-action="save"]').addEventListener("click", () => {
    taxOffice.name = body.querySelector("#taxoffice-name").value.trim();
    taxOffice.address = body.querySelector("#taxoffice-address").value.trim();
    taxOffice.lastConfirmed = todayIso();
    renderTaxOffice(body);
  });
  if (canCancel) {
    body.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      renderTaxOffice(body);
    });
  }
}

function attachRequiredFieldListeners(container) {
  const fieldIds = ["birthdate", "birthplace", "tin"];
  fieldIds.forEach((id) => {
    const input = container.querySelector(`#${id}`);
    input.addEventListener("input", () => {
      if (id === "birthdate") profile.residence.birthDate = input.value;
      else if (id === "birthplace") profile.residence.birthPlace = input.value;
      else profile.residence.tin = input.value;
      updateValidation(container);
    });
    input.addEventListener("blur", () => {
      touched.add(id);
      updateValidation(container);
    });
  });
}

function updateValidation(container) {
  const fields = [
    { id: "birthdate", valid: (profile.residence.birthDate ?? "").trim() !== "", errorText: "Bitte ausfüllen." },
    { id: "birthplace", valid: (profile.residence.birthPlace ?? "").trim() !== "", errorText: "Bitte ausfüllen." },
    {
      id: "tin",
      valid: isValidTin(profile.residence.country, profile.residence.tin),
      errorText: `Ungültiges Format. ${tinHint(profile.residence.country)}`,
    },
  ];

  let filledCount = 0;
  let allValid = true;

  for (const f of fields) {
    const input = container.querySelector(`#${f.id}`);
    const errorEl = container.querySelector(`#${f.id}-error`);
    if (f.valid) {
      filledCount++;
      input.classList.add("valid");
      input.classList.remove("invalid");
      errorEl.textContent = "";
    } else {
      allValid = false;
      input.classList.remove("valid");
      if (touched.has(f.id)) {
        input.classList.add("invalid");
        errorEl.textContent = f.errorText;
      } else {
        input.classList.remove("invalid");
        errorEl.textContent = "";
      }
    }
  }

  const openCount = fields.length - filledCount;
  container.querySelector("#missing-pill").textContent = `${openCount} Feld${openCount === 1 ? "" : "er"} offen`;
  container.querySelector("#next-btn").disabled = !allValid;
}
