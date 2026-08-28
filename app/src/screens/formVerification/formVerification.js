// Schritt 2, Teil 1: "Formular-Verifizierung". Einstieg in Prozess B
// (SKAT-Portal-Einreichung), erreicht nachdem Prozess A (Wohnsitzbescheinigung)
// abgeschlossen ist und ggf. Wochen später, nachdem das Finanzamt bestätigt hat
// (Case-Status zu diesem Zeitpunkt: "awaiting_tax_office" oder später - siehe
// divrebound_data_schema.md CaseStatus). Nutzer öffnet das echte SKAT-Portal in
// einem neuen Tab, gleicht das Ergebnis gegen eine kurze Checkliste ab und
// bestätigt das im Wizard. Erst mit dieser Bestätigung wechselt der Case auf
// "skat_form_verified" (Weiter zu Schritt 2, Teil 2: das Cheat Sheet).
//
// Layout/Copy/Interaktionsmodell 1:1 aus divrebound_step_form_verification_mockup.html
// übernommen (--teal-*/--gold-* dort entspricht --navy/--cyan hier).

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";

/** @type {true | false | null} Antwort auf "Sehen Sie das Formular wie oben beschrieben?" */
let answer = null;

export function mount(container, params) {
  answer = null;
  render(container, params);
}

function caseLabel(reclaimCase) {
  if (!reclaimCase) return "";
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function render(container, params) {
  const reclaimCase = getState().currentCase;

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">SKAT-Formular öffnen</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${caseLabel(reclaimCase)} <b>›</b> Schritt 2</div>
    </div>

    <a class="back-link" id="back-link">← Zurück</a>

    <div class="info-banner">
      <span class="icon">⚠</span>
      <div><b>Voraussetzung für Schritt 2:</b> Die vom Finanzamt unterschriebene/bestätigte Wohnsitzbescheinigung aus Schritt 1 muss vorliegen, bevor Sie hier fortfahren.</div>
    </div>

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Formular-Verifizierung</span>
      </div>
      <div class="card-body">
        <div class="intro-text">
          Öffnen Sie das dänische Online-Formular in einem neuen Tab und ordnen Sie beide Fenster
          nebeneinander an, so dass die Einträge einfach übertragen werden können.
        </div>

        <button class="open-btn" id="open-btn" type="button">
          ↗ SKAT-Formular in neuem Tab öffnen
        </button>

        <div class="checklist">
          <div class="checklist-item">
            <span class="mark">✓</span>
            Seitentitel <b>„Refusion af udbytteskat / Claim for refund of Danish dividend tax"</b>
          </div>
          <div class="checklist-item">
            <span class="mark">✓</span>
            Sie füllen das Formular ohne MitID aus. (Ein dänischer Login mit MitID ist nicht erforderlich.)
          </div>
        </div>

        <div class="confirm-question">Sehen Sie das Formular wie oben beschrieben?</div>
        <div class="confirm-buttons">
          <button class="confirm-btn" id="btn-yes" type="button">✓ Ja</button>
          <button class="confirm-btn" id="btn-no" type="button">✕ Nein</button>
        </div>

        <div class="trouble-panel" id="trouble-panel">
          <b>Troubleshooting:</b>
          <ul>
            <li>Sprache oben rechts auf Englisch umstellen, falls Dänisch unübersichtlich ist</li>
            <li>Weiterhin Probleme? <a href="https://skat.dk/kontakt" target="_blank" rel="noopener">Kontakt zu SKAT aufnehmen</a></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bottom-bar">
      <span></span>
      <button class="btn-primary" id="next-btn" disabled type="button">Weiter zum Cheat Sheet →</button>
    </div>
  `;

  applyAnswerState(container);
  attachListeners(container, params, reclaimCase);
}

function applyAnswerState(container) {
  const yesBtn = container.querySelector("#btn-yes");
  const noBtn = container.querySelector("#btn-no");
  const trouble = container.querySelector("#trouble-panel");
  const nextBtn = container.querySelector("#next-btn");

  yesBtn.classList.remove("selected-yes");
  noBtn.classList.remove("selected-no");
  trouble.classList.remove("visible");
  nextBtn.disabled = true;

  if (answer === true) {
    yesBtn.classList.add("selected-yes");
    nextBtn.disabled = false;
  } else if (answer === false) {
    noBtn.classList.add("selected-no");
    trouble.classList.add("visible");
  }
}

function attachListeners(container, params, reclaimCase) {
  container.querySelector("#back-link").addEventListener("click", () => {
    navigate(`#/dk/${params.caseId}/step1`);
  });

  container.querySelector("#open-btn").addEventListener("click", () => {
    window.open(corridors.DK.onlinePortalUrl, "_blank", "noopener");
  });

  container.querySelector("#btn-yes").addEventListener("click", () => {
    answer = true;
    applyAnswerState(container);
  });

  container.querySelector("#btn-no").addEventListener("click", () => {
    answer = false;
    applyAnswerState(container);
  });

  container.querySelector("#next-btn").addEventListener("click", async () => {
    if (answer !== true || !reclaimCase) return;

    reclaimCase.status = "skat_form_verified";
    await caseRepo.put(reclaimCase);

    const state = getState();
    setState({
      currentCase: reclaimCase,
      cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
    });

    navigate(`#/dk/${reclaimCase.caseId}/step2/cheatsheet`);
  });
}
