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
  const ongoing = !reclaimCase.residencePeriod.until;
  const countryLabel = COUNTRY_NAMES[profile.residence.country] ?? profile.residence.country;

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Fehlende Angaben ergänzen</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${escapeHtml(caseLabel(reclaimCase))} <b>›</b> Schritt 1</div>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Aus den Abrechnungen übernommen</span>
        <span class="count-pill" id="known-count-pill">${knownFilled} von ${knownFields.length} Feldern</span>
      </div>
      <div class="card-body" id="known-card-body">
        ${knownFields
          .map((f) => {
            const value = f.getSnapshot();
            const hasValue = value.trim() !== "";
            return `
          <div class="md-known-row">
            <div style="flex:1;">
              <div class="md-known-label">${f.label}</div>
              <input class="md-known-input mono" data-field="${f.key}" placeholder="Bitte eintragen" value="${escapeHtml(value)}">
            </div>
            <span class="badge ${hasValue ? "badge-confirmed" : "badge-extracted"}" data-known-badge="${f.key}">
              ${hasValue ? "✓ übernommen" : "nicht erkannt"}
            </span>
          </div>
          <div class="md-profile-diff" data-diff="${f.key}" style="display:none;"></div>
        `;
          })
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
      <div class="card-head head-cyan">
        <span class="card-title">Bitte noch ergänzen</span>
        <span class="count-pill" id="missing-pill">3 Felder offen</span>
      </div>
      <div class="card-body">
        <div class="md-required-field">
          <div class="md-req-row">
            <div style="flex:1;">
              <div class="md-known-label">Geburtsdatum</div>
              <input type="date" id="birthdate" class="md-known-input mono" value="${escapeHtml(profile.residence.birthDate ?? "")}">
            </div>
            <span class="badge" data-field-badge="birthdate"></span>
          </div>
          <div class="field-error" id="birthdate-error"></div>
        </div>

        <div class="md-required-field">
          <div class="md-req-row">
            <div style="flex:1;">
              <div class="md-known-label">Geburtsort</div>
              <input type="text" id="birthplace" class="md-known-input" placeholder="z.B. München" value="${escapeHtml(profile.residence.birthPlace ?? "")}">
            </div>
            <span class="badge" data-field-badge="birthplace"></span>
          </div>
          <div class="field-hint">Wie im gültigen Reisepass/Personalausweis angegeben.</div>
          <div class="field-error" id="birthplace-error"></div>
        </div>

        <div class="md-required-field">
          <div class="md-req-row">
            <div style="flex:1;">
              <div class="md-known-label">Steuer-ID (${escapeHtml(countryLabel)})</div>
              <input type="text" id="tin" class="md-known-input mono" placeholder="z.B. ${TIN_PLACEHOLDER[profile.residence.country] ?? ""}" value="${escapeHtml(profile.residence.tin ?? "")}">
            </div>
            <span class="badge" data-field-badge="tin"></span>
          </div>
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

  function updateKnownBadge(f) {
    const badge = body.querySelector(`[data-known-badge="${f.key}"]`);
    const hasValue = f.getSnapshot().trim() !== "";
    badge.className = `badge ${hasValue ? "badge-confirmed" : "badge-extracted"}`;
    badge.textContent = hasValue ? "✓ übernommen" : "nicht erkannt";
    const filledCount = knownFields.filter((x) => x.getSnapshot().trim() !== "").length;
    container.querySelector("#known-count-pill").textContent = `${filledCount} von ${knownFields.length} Feldern`;
  }

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
      updateKnownBadge(f);
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
    {
      id: "birthdate",
      isEmpty: (profile.residence.birthDate ?? "").trim() === "",
      valid: (profile.residence.birthDate ?? "").trim() !== "",
      errorText: "Bitte ausfüllen.",
    },
    {
      id: "birthplace",
      isEmpty: (profile.residence.birthPlace ?? "").trim() === "",
      valid: (profile.residence.birthPlace ?? "").trim() !== "",
      errorText: "Bitte ausfüllen.",
    },
    {
      id: "tin",
      isEmpty: (profile.residence.tin ?? "").trim() === "",
      valid: isValidTin(profile.residence.country, profile.residence.tin),
      errorText: `Ungültiges Format. ${tinHint(profile.residence.country)}`,
    },
  ];

  let filledCount = 0;
  let allValid = true;

  for (const f of fields) {
    const input = container.querySelector(`#${f.id}`);
    const errorEl = container.querySelector(`#${f.id}-error`);
    const badge = container.querySelector(`[data-field-badge="${f.id}"]`);

    if (f.valid) {
      filledCount++;
      badge.className = "badge badge-confirmed";
      badge.textContent = "✓ übernommen aus Profil";
      errorEl.textContent = "";
    } else {
      allValid = false;
      if (f.isEmpty) {
        badge.className = "badge badge-extracted";
        badge.textContent = "noch offen";
        errorEl.textContent = touched.has(f.id) ? f.errorText : "";
      } else {
        // Ausgefüllt, aber ungültiges Format (z.B. TIN) - eigener Zustand,
        // damit "übernommen aus Profil" nicht fälschlich bei kaputten Werten
        // angezeigt wird.
        badge.className = "badge badge-invalid";
        badge.textContent = "ungültiges Format";
        errorEl.textContent = f.errorText;
      }
    }
  }

  const openCount = fields.length - filledCount;
  container.querySelector("#missing-pill").textContent = `${openCount} Feld${openCount === 1 ? "" : "er"} offen`;
  container.querySelector("#next-btn").disabled = !allValid;
}
