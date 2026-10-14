// Dänemark, Schritt 3 "Fehlende Angaben" (#/dk/:caseId/step1/missing-data),
// docs/konzept-schweiz.md §2, §2a, §2c.
//
// Zeigt nur noch, was nach dem Einlesen der Dividendenabrechnungen wirklich
// offen ist:
// - Zeitraum der Ansässigkeit: aus dem frühesten Zahltag abgeleitet, nur
//   bestätigen bzw. korrigieren (wird direkt im Fall gespeichert)
// - Pflichtangaben für die Wohnsitzbescheinigung, die im Profil noch fehlen -
//   direkt bearbeitbar und automatisch gespeichert (components/checklist.js)
// Was vollständig ist, steht nur noch als Hinweis "alles vollständig" da.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { hasInvalidInput } from "../../util/autosave.js";
import {
  PROFILE_ITEM, profileRow, isItemFilled, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { showToast } from "../../components/toast.js";
import { DK_STEPS, dkStepRoute } from "../../config/caseSteps.js";

// Pflichtangaben der Wohnsitzbescheinigung 02.050 (fillResidencyCertificate.js)
const REQUIRED = ["name", "address", "birthDate", "birthPlace", "tin"];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function caseLabel(rc) {
  const d = new Date(rc.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function earliestPaymentDate(distributions) {
  const dates = (distributions ?? []).map((d) => d.paymentDate).filter(Boolean).sort();
  return dates[0] ?? null;
}

async function saveCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({ currentCase: reclaimCase, cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)) });
}

export async function mount(container) {
  const { currentProfile: profile, currentCase: reclaimCase } = getState();
  if (!profile || !reclaimCase) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Fehlende Angaben</h1></div>
      <div class="info-banner"><span class="icon">⚠</span><div>Kein Fall ausgewählt. Bitte über die Seitenleiste einen Fall auswählen.</div></div>`;
    return;
  }

  // "Von" folgt dem frühesten Zahltag, bis der Nutzer selbst etwas einträgt.
  const derivedFrom = earliestPaymentDate(reclaimCase.distributions);
  if (derivedFrom && !reclaimCase.residencePeriod.fromEdited && reclaimCase.residencePeriod.from !== derivedFrom) {
    reclaimCase.residencePeriod.from = derivedFrom;
    await saveCase(reclaimCase);
  }

  render(container, reclaimCase, profile);
  return bindChecklistAutosave(container, () => updateNext(container, reclaimCase));
}

function render(container, reclaimCase, profile) {
  const missing = REQUIRED.filter((k) => !isItemFilled(profile, PROFILE_ITEM[k]));
  const period = reclaimCase.residencePeriod;
  const ongoing = !period.until;
  const derived = !period.fromEdited && Boolean(earliestPaymentDate(reclaimCase.distributions));

  container.innerHTML = `
    <div class="ch-page">
    <div class="content-header">
      <h1 class="content-title">Fehlende Angaben</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${escapeHtml(caseLabel(reclaimCase))} <b>›</b> 3 von ${DK_STEPS.length}</div>
    </div>
    <p class="ch-lead">Hier steht nur noch, was nach dem Einlesen Ihrer Dividendenabrechnungen offen ist. Alles andere stammt aus Ihren persönlichen Daten.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Aus den Abrechnungen abgeleitet – bitte bestätigen</span></div>
      <div class="card-body">
        <div class="md-period-title">Zeitraum der Ansässigkeit</div>
        <div class="field-hint" style="margin-bottom:12px;">„Von“ ist der früheste Zahltag Ihrer Ausschüttungen – Ihre Abrechnungen lauten ab dann auf Ihre deutsche Adresse. Die Wohnsitzbescheinigung muss alle Zahltage abdecken.</div>
        <div class="md-period">
          <div class="field-row">
            <label class="field-label" for="res-from">Von</label>
            <input type="date" id="res-from" class="field-input mono" value="${escapeHtml(period.from ?? "")}">
            ${derived ? '<span class="badge badge-dupe" style="width:fit-content;">↺ aus Abrechnungen abgeleitet</span>' : ""}
          </div>
          <div class="field-row">
            <label class="field-label" for="res-until">Bis</label>
            <input type="date" id="res-until" class="field-input mono" value="${escapeHtml(period.until ?? "")}" ${ongoing ? "disabled" : ""}>
            <label class="md-ongoing"><input type="checkbox" id="res-ongoing" ${ongoing ? "checked" : ""}> Wohnsitz besteht weiterhin</label>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bitte noch ergänzen</span><span class="count-pill">${missing.length ? `${missing.length} offen` : "nichts offen"}</span></div>
      ${
        missing.length
          ? missing.map((k) => profileRow(profile, PROFILE_ITEM[k])).join("") + AUTOSAVE_ROW
          : `<div class="card-body"><div class="md-all-done">✓ Alle übrigen Angaben sind vollständig. Sie stammen aus Ihren persönlichen Daten – <a href="#" data-go-checklist>ansehen oder ändern</a>.</div></div>`
      }
    </div>

    <div class="ch-step-nav">
      <button class="btn-secondary" data-step-back type="button">← Zurück</button>
      <button class="btn-primary" data-step-next type="button">Weiter: ${DK_STEPS[3].title} →</button>
    </div>
    </div>`;

  attachListeners(container, reclaimCase);
  updateNext(container, reclaimCase);
}

/** "Weiter" erst, wenn alle Pflichtangaben vorhanden und gültig sind. */
function updateNext(container, reclaimCase) {
  const profile = getState().currentProfile;
  const complete = REQUIRED.every((k) => isItemFilled(profile, PROFILE_ITEM[k])) && Boolean(reclaimCase.residencePeriod.from);
  const tinValid = PROFILE_FIELDS.tin.validate(profile.residence.tin, profile) === true;
  container.querySelector("[data-step-next]").disabled = !(complete && tinValid) || hasInvalidInput();
}

function attachListeners(container, reclaimCase) {
  const fromInput = container.querySelector("#res-from");
  const untilInput = container.querySelector("#res-until");
  const ongoingCheckbox = container.querySelector("#res-ongoing");

  fromInput.addEventListener("change", async () => {
    reclaimCase.residencePeriod.from = fromInput.value || null;
    reclaimCase.residencePeriod.fromEdited = true;
    await saveCase(reclaimCase);
    showToast("✓ Zeitraum gespeichert");
    updateNext(container, reclaimCase);
  });
  ongoingCheckbox.addEventListener("change", async () => {
    untilInput.disabled = ongoingCheckbox.checked;
    if (ongoingCheckbox.checked) untilInput.value = "";
    reclaimCase.residencePeriod.until = ongoingCheckbox.checked ? null : untilInput.value || null;
    await saveCase(reclaimCase);
    showToast("✓ Zeitraum gespeichert");
  });
  untilInput.addEventListener("change", async () => {
    reclaimCase.residencePeriod.until = untilInput.value || null;
    await saveCase(reclaimCase);
    showToast("✓ Zeitraum gespeichert");
  });

  container.querySelector("[data-go-checklist]")?.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(dkStepRoute(reclaimCase.caseId, 1));
  });
  container.querySelector("[data-step-back]").addEventListener("click", () => navigate(dkStepRoute(reclaimCase.caseId, 2)));
  container.querySelector("[data-step-next]").addEventListener("click", async () => {
    const { residence } = getState().currentProfile;
    // Snapshot für das Cheat Sheet aktuell halten (liest teils aus dem Snapshot).
    Object.assign(reclaimCase.applicantSnapshot, {
      firstName: residence.firstName,
      lastName: residence.lastName,
      address: residence.address,
      postalCode: residence.postalCode,
      city: residence.city,
      tin: residence.tin,
    });
    reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), 3])];
    await saveCase(reclaimCase);
    navigate(dkStepRoute(reclaimCase.caseId, 4));
  });
}
