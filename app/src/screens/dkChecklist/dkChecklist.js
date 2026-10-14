// Dänemark, Schritt 1 "Unterlagen prüfen" (#/dk/:caseId/checklist), gleicher
// Baustein wie bei der Schweiz (components/checklist.js, docs/konzept-schweiz.md
// §2). Der Zeitraum der Ansässigkeit wird nicht abgefragt: er wird aus den
// Zahltagen der Dividendenabrechnungen abgeleitet und in Schritt 3 bestätigt.

import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import {
  PROFILE_ITEM, profileRow, textRow, updateChecklistSummary, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { DK_STEPS, dkStepRoute } from "../../config/caseSteps.js";

const PROFILE_ITEMS = ["name", "address", "birthDate", "birthPlace", "tin", "taxOffice", "bank", "bic"].map((k) => PROFILE_ITEM[k]);

function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function mount(container) {
  const { currentCase: reclaimCase, currentProfile: profile } = getState();
  if (!reclaimCase || !profile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Unterlagen prüfen</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Kein Fall ausgewählt.</div></div>`;
    return;
  }

  const confirmed = reclaimCase.distributions.filter((d) => d.extractionConfidence !== "extracted").length;

  container.innerHTML = `
    <div class="ch-page">
    <div class="content-header">
      <h1 class="content-title">Unterlagen prüfen</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${caseLabel(reclaimCase)} <b>›</b> 1 von ${DK_STEPS.length}</div>
    </div>
    <p class="ch-lead">Für die Erstattung der dänischen Quellensteuer erzeugt DivRebound eine Wohnsitzbescheinigung, die Ihr Finanzamt bestätigt. Anschließend tragen Sie Ihren Antrag im Online-Formular von SKAT ein. Was schon in Ihren persönlichen Daten steht, ist bereits abgehakt.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Checkliste</span><span class="count-pill" data-summary></span></div>

      <div class="ch-check-group">Zugang</div>
      ${textRow("ok", "SKAT-Online-Formular", "Kein Login nötig – DivRebound verlinkt direkt auf das Formular für ausländische Aktionäre.")}

      <div class="ch-check-group">Persönliche Daten</div>
      ${PROFILE_ITEMS.map((item) => profileRow(profile, item)).join("")}
      ${AUTOSAVE_ROW}

      <div class="ch-check-group">Aus Ihren Dividendenabrechnungen</div>
      ${
        confirmed
          ? textRow("ok", "Dividendenabrechnungen", `${confirmed} Ausschüttung${confirmed === 1 ? "" : "en"} erfasst.`, `<span class="badge badge-extracted">Schritt 2</span>`)
          : textRow("later", "Dividendenabrechnungen", "Je eine pro Ausschüttung einer dänischen Aktie (ISIN beginnt mit DK), höchstens 3 Jahre zurück.", `<span class="badge badge-extracted">Schritt 2</span>`)
      }
      ${textRow("later", "Zeitraum der Ansässigkeit", "Wird aus den Zahltagen Ihrer Abrechnungen abgeleitet – Sie bestätigen ihn nur noch.", `<span class="badge badge-extracted">Schritt 3</span>`)}
    </div>

    <div class="ch-step-nav">
      <span></span>
      <button class="btn-primary" data-step-next type="button">Weiter: ${DK_STEPS[1].title} →</button>
    </div>
    </div>`;

  updateChecklistSummary(container);
  container.querySelector("[data-step-next]").addEventListener("click", async () => {
    const done = new Set(reclaimCase.dkStepsDone ?? []);
    done.add(1);
    reclaimCase.dkStepsDone = [...done];
    await caseRepo.put(reclaimCase);
    const state = getState();
    setState({ currentCase: reclaimCase, cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)) });
    navigate(dkStepRoute(reclaimCase.caseId, 2));
  });
  return bindChecklistAutosave(container);
}
