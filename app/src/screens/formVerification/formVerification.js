// Schritt 2, Teil 1: "Formular-Verifizierung". Einstieg in Prozess B
// (SKAT-Portal-Einreichung), erreicht nachdem Prozess A (Wohnsitzbescheinigung)
// abgeschlossen ist und ggf. Wochen später, nachdem das Finanzamt bestätigt hat
// (Case-Status zu diesem Zeitpunkt: "awaiting_tax_office" oder später - siehe
// divrebound_data_schema.md CaseStatus). Nutzer öffnet das echte SKAT-Portal in
// einem neuen Tab und gleicht das Ergebnis gegen eine kurze Checkliste ab -
// eine explizite Ja/Nein-Bestätigung ist bewusst NICHT mehr nötig, um
// weiterzukommen (nur eine reine Selbstprüfung anhand der Checkliste).
//
// Layout/Copy 1:1 aus divrebound_step_form_verification_mockup.html
// übernommen (--teal-*/--gold-* dort entspricht --navy/--cyan hier), die
// frühere Ja/Nein-Bestätigung samt Troubleshooting-Panel wurde entfernt.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";

export function mount(container, params) {
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

        <button class="download-btn" id="open-btn" type="button">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          SKAT-Formular in neuem Tab öffnen
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
      </div>
    </div>

    <div class="bottom-bar">
      <span></span>
      <button class="btn-primary" id="next-btn" type="button">Weiter zum Cheat Sheet →</button>
    </div>
  `;

  attachListeners(container, params, reclaimCase);
}

function attachListeners(container, params, reclaimCase) {
  container.querySelector("#back-link").addEventListener("click", () => {
    navigate(`#/dk/${params.caseId}/step1`);
  });

  container.querySelector("#open-btn").addEventListener("click", () => {
    window.open(corridors.DK.onlinePortalUrl, "_blank", "noopener");
  });

  container.querySelector("#next-btn").addEventListener("click", async () => {
    if (!reclaimCase) return;

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
