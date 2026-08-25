// Onboarding: Privatvermögen-Gate -> Wohnsitzland -> Profil+Case anlegen.
// Kein Mockup vorhanden (siehe Plan §7) - neu im bestehenden CI gebaut.
// Zielland-Auswahl entfällt im MVP, da nur Dänemark verfügbar ist.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as profileRepo from "../../db/profileRepo.js";
import * as caseRepo from "../../db/caseRepo.js";

let step = "gate";

function render(container) {
  if (step === "gate") return renderGate(container);
  if (step === "blocked") return renderBlocked(container);
  return renderResidence(container);
}

export function mount(container) {
  step = "gate";
  render(container);
}

function renderGate(container) {
  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Willkommen bei DivRebound</h1>
      <p class="content-breadcrumb">Bevor es losgeht: ein paar kurze Fragen.</p>
    </div>
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Frage 1 von 2</span></div>
      <div style="padding:20px;">
        <p style="font-size:14px; color:var(--charcoal); margin-bottom:18px;">
          Hältst du deine Aktien im <b>Privatvermögen</b> (nicht als Betriebsvermögen /
          im Rahmen einer gewerblichen Tätigkeit)?
        </p>
        <div style="display:flex; gap:12px;">
          <button class="btn-primary" data-answer="yes">Ja, Privatvermögen</button>
          <button class="btn-secondary" data-answer="no">Nein / bin unsicher</button>
        </div>
      </div>
    </div>
  `;
  container.querySelector('[data-answer="yes"]').addEventListener("click", () => {
    step = "residence";
    render(container);
  });
  container.querySelector('[data-answer="no"]').addEventListener("click", () => {
    step = "blocked";
    render(container);
  });
}

function renderBlocked(container) {
  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">DivRebound passt hier (noch) nicht</h1>
    </div>
    <div class="info-banner">
      <span class="icon">ℹ</span>
      <div>DivRebound deckt im MVP ausschließlich Aktien im Privatvermögen von natürlichen Personen ab.
      Betriebsvermögen/institutionelle Anleger sind aktuell nicht unterstützt.</div>
    </div>
    <button class="btn-secondary" data-answer="back">← Zurück</button>
  `;
  container.querySelector('[data-answer="back"]').addEventListener("click", () => {
    step = "gate";
    render(container);
  });
}

function renderResidence(container) {
  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Dein Wohnsitzland</h1>
      <p class="content-breadcrumb">Frage 2 von 2</p>
    </div>
    <div class="card">
      <div style="padding:20px;">
        <div class="field-row">
          <label class="field-label" for="residence-country">In welchem Land bist du steuerlich ansässig?</label>
          <select id="residence-country" class="field-select">
            <option value="DE">Deutschland</option>
            <option value="AT">Österreich</option>
            <option value="CH">Schweiz</option>
          </select>
        </div>
        <button class="btn-primary" data-answer="continue">Weiter →</button>
      </div>
    </div>
  `;
  container.querySelector('[data-answer="continue"]').addEventListener("click", async () => {
    const country = container.querySelector("#residence-country").value;
    const profile = await profileRepo.createProfile(country);
    const reclaimCase = await caseRepo.createCase(profile, "DK");
    setState({
      currentProfile: profile,
      cases: [reclaimCase],
      currentCase: reclaimCase,
    });
    step = "gate"; // für ein eventuelles zweites Onboarding zurücksetzen
    navigate(`#/dk/${reclaimCase.caseId}/step1`);
  });
}
