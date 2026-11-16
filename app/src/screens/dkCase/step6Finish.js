// Dänemark, zweite Seite von "Dänische Steuerbehörde": Antrag absenden.
// Kein Abhaken mehr - Hinweise, was im SKAT-Formular noch zu tun ist, und ein
// Knopf "Antrag ist eingereicht". Erst damit gilt der Antrag als eingereicht
// (zählt für die Statistik, Frage nach der Erstattung auf der Übersicht).

import { formatDateDe } from "../../util/format.js";
import { bindPausePanel, submitEndHtml, submitNavHtml } from "../../components/pausePanel.js";
import { stepHeader, bindStepNav, saveCase } from "./dkShared.js";

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}

function render(container, reclaimCase) {
  const done = reclaimCase.status === "submitted";
  const doneAt = reclaimCase.submittedAt ? ` am ${formatDateDe(reclaimCase.submittedAt.slice(0, 10))}` : "";

  // Stand 2.1: Kurzsatz, nummerierte Schritte mit der SKAT-Schaltfläche als
  // Marke, "Ist eingereicht" in der Pause-Komponente (wie die anderen Länder).
  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    <p class="ch-lead">Mit dem Absenden im SKAT-Formular ist dein Antrag eingereicht.</p>

    <div class="card">
      <div class="card-head"><span class="card-title">Im SKAT-Formular</span></div>
      <div class="card-body">
        <ol class="flow-steps">
          <li><div>Prüfen, ob die gestempelte Wohnsitzbescheinigung hochgeladen ist.</div></li>
          <li><div>Auf der letzten Seite <span class="ui-path"><b>Send</b></span> klicken.</div></li>
          <li><div>Die Bestätigungsseite als PDF speichern. Sie ist dein Nachweis.</div></li>
        </ol>
      </div>
    </div>

    ${submitEndHtml(reclaimCase, {
      submittedAt: done ? reclaimCase.submittedAt ?? new Date().toISOString() : null,
      doneSub: `Bei SKAT eingereicht${doneAt} · die Auszahlung dauert meist einige Monate`,
      question: "Abgesendet? Dann ist dein Antrag eingereicht.",
      actionLabel: "✓ Ist eingereicht",
    })}

    ${submitNavHtml(done)}
    </div>`;

  bindStepNav(container, reclaimCase, 6);
  bindPausePanel(container, reclaimCase);

  container.querySelector('[data-action="mark-mailed"]')?.addEventListener("click", async () => {
    if (reclaimCase.status === "submitted") return;
    reclaimCase.status = "submitted";
    reclaimCase.submittedAt = new Date().toISOString();
    reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), 1, 2, 3, 4, 5, 6])].sort();
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });
}
