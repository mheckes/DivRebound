// Dänemark, zweite Seite von "Dänische Steuerbehörde": Antrag absenden.
// Kein Abhaken mehr - Hinweise, was im SKAT-Formular noch zu tun ist, und ein
// Knopf "Antrag ist eingereicht". Erst damit gilt der Antrag als eingereicht
// (zählt für die Statistik, Frage nach der Erstattung auf der Übersicht).

import { formatDateDe } from "../../util/format.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { stepHeader, bindStepNav, saveCase } from "./dkShared.js";

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}

function render(container, reclaimCase) {
  const done = reclaimCase.status === "submitted";
  const doneAt = reclaimCase.submittedAt ? ` am ${formatDateDe(reclaimCase.submittedAt.slice(0, 10))}` : "";

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    <p class="ch-lead">Der Antrag ist eingereicht, sobald du ihn im Online-Formular der dänischen Steuerbehörde (SKAT) abschickst. Danach prüft SKAT deinen Antrag und überweist die Erstattung.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Im SKAT-Formular</span></div>
      <div class="card-body">
        <div class="ch-next"><span class="ch-next-num">1</span><span>Prüfen, ob die vom Finanzamt gestempelte Wohnsitzbescheinigung hochgeladen ist.</span></div>
        <div class="ch-next"><span class="ch-next-num">2</span><span>Auf der letzten Seite auf <b>„Send“</b> klicken.</span></div>
        <div class="ch-next"><span class="ch-next-num">3</span><span>Die Bestätigungsseite als PDF speichern oder ausdrucken. Sie ist dein Nachweis, falls SKAT nachfragt.</span></div>
        ${
          done
            ? `<div class="done-banner ch-done-banner">
                <div class="done-icon">✓</div>
                <div>
                  <div class="done-title">Antrag eingereicht</div>
                  <div class="done-sub">Bei SKAT eingereicht${doneAt}. Die Auszahlung dauert meist einige Monate. Auf der Übersicht fragen wir dich, ob das Geld da ist.</div>
                </div>
              </div>`
            : `<button class="btn-primary" data-action="finish" type="button" style="margin-top:12px;">✓ Antrag ist eingereicht</button>`
        }
      </div>
    </div>

    ${done ? pausePanelHtml(reclaimCase, "payout") : ""}

    <div class="ch-step-nav">
      <button class="btn-secondary" data-step-back type="button">← Zurück</button>
      <a class="btn-secondary" href="#/home">Zur Übersicht</a>
    </div>
    </div>`;

  bindStepNav(container, reclaimCase, 6);
  bindPausePanel(container, reclaimCase);

  container.querySelector('[data-action="finish"]')?.addEventListener("click", async () => {
    if (reclaimCase.status === "submitted") return;
    reclaimCase.status = "submitted";
    reclaimCase.submittedAt = new Date().toISOString();
    reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), 1, 2, 3, 4, 5, 6])].sort();
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });
}
