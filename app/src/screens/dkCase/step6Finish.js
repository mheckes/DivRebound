// Dänemark, Schritt 6 "Einreichen & abschließen" - gleicher Ablauf wie
// Schweiz (Schritt 6) und Italien (Schritt 5): Status-Zeitleiste, Abhaken der
// Einreichung bei SKAT, "DivRebound abschließen". Erst damit gilt der Fall als
// erledigt (zählt für die Statistik).

import { formatDateDe } from "../../util/format.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { dkTimelineHtml, bindDkTimeline } from "./dkTimeline.js";
import { stepHeader, stepNavHtml, bindStepNav, saveCase } from "./dkShared.js";

const SUBMIT_CHECKS = [
  ["attached", "Die vom Finanzamt bestätigte Wohnsitzbescheinigung ist im SKAT-Formular hochgeladen."],
  ["sent", "Der Antrag ist bei SKAT mit <b>„Send“</b> abgeschickt."],
  ["receipt", "Die Bestätigungsseite nach dem Absenden ist gespeichert oder ausgedruckt."],
];

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}

function render(container, reclaimCase) {
  const checks = new Set(reclaimCase.dkSubmitChecks ?? []);
  const allChecked = SUBMIT_CHECKS.every(([id]) => checks.has(id));
  const done = reclaimCase.status === "submitted";
  const doneAt = reclaimCase.submittedAt ? ` am ${formatDateDe(reclaimCase.submittedAt.slice(0, 10))}` : "";

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    <p class="ch-lead">Der Antrag ist eingereicht, sobald du ihn im SKAT-Formular mit „Send“ abschickst. Danach prüft die dänische Steuerverwaltung deinen Antrag und überweist die Erstattung.</p>

    ${dkTimelineHtml(reclaimCase)}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">DivRebound abschließen</span></div>
      <div class="card-body">
        ${SUBMIT_CHECKS.map(([id, text]) => `<label class="ch-step-row"><input type="checkbox" data-submit-check="${id}" ${checks.has(id) || done ? "checked" : ""} ${done ? "disabled" : ""}><span>${text}</span></label>`).join("")}
        ${
          done
            ? `<div class="done-banner ch-done-banner">
                <div class="done-icon">✓</div>
                <div>
                  <div class="done-title">DivRebound abgeschlossen</div>
                  <div class="done-sub">Bei SKAT eingereicht${doneAt}. Wenn die Erstattung da ist, kannst du sie in Schritt 7 festhalten (optional).</div>
                </div>
              </div>`
            : `<button class="btn-primary" data-action="finish" ${allChecked ? "" : "disabled"} type="button">✓ Eingereicht – DivRebound abschließen</button>
              ${allChecked ? "" : `<div class="field-hint" style="margin-top:6px;">Bitte zuerst die drei Punkte oben abhaken.</div>`}`
        }
      </div>
    </div>

    ${done ? pausePanelHtml(reclaimCase, "payout") : ""}

    ${stepNavHtml(6)}
    </div>`;

  bindStepNav(container, reclaimCase, 6);
  bindPausePanel(container, reclaimCase);
  bindDkTimeline(container, reclaimCase, () => render(container, reclaimCase));

  container.querySelectorAll("[data-submit-check]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.dkSubmitChecks ?? []);
      box.checked ? set.add(box.dataset.submitCheck) : set.delete(box.dataset.submitCheck);
      reclaimCase.dkSubmitChecks = [...set];
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

  container.querySelector('[data-action="finish"]')?.addEventListener("click", async () => {
    if (reclaimCase.status === "submitted") return;
    reclaimCase.status = "submitted";
    reclaimCase.submittedAt = new Date().toISOString();
    reclaimCase.timelineStep = Math.max(reclaimCase.timelineStep ?? 0, 4);
    reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), 1, 2, 3, 4, 5, 6])].sort();
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });
}
