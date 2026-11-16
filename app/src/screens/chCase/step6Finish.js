// Schritt 6 "Hochladen & abschließen" (docs/konzept-schweiz.md §1, §2c):
// Der vom Finanzamt bestätigte Antrag wird im ePortal hochgeladen. Erst mit
// "DivRebound abschließen" gilt der Fall als erledigt (zählt für die Statistik).

import { signNowHtml } from "../../components/flow.js";
import { getState } from "../../store/store.js";
import { statusTimelineHtml, bindStatusTimeline } from "../../components/statusTimeline.js";
import { bindPausePanel, submitEndHtml, submitNavHtml } from "../../components/pausePanel.js";
import { formatDateDe } from "../../util/format.js";
import { CH_TIMELINE, timelineTitle, chTimelineDone } from "./step5TaxOffice.js";
import { esc, corridor, saveCase, loadTransactions, entitlementsFor, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";


export async function mount(container, reclaimCase) {
  const transactions = await loadTransactions(getState().currentProfile);
  render(container, reclaimCase, transactions);
}

function render(container, reclaimCase, transactions) {
  const results = entitlementsFor(reclaimCase, transactions, getState().currentProfile);
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  const completed = Boolean(reclaimCase.ch.completedAt);

  // Stand 2.1: Kurzsatz, ein Klickpfad im ePortal als nummerierte Schritte,
  // "Ist eingereicht" in der Pause-Komponente (wie in den anderen Ländern).
  const path = (...parts) => `<span class="ui-path">${parts.map((p) => `<b>${esc(p)}</b>`).join("<span>›</span>")}</span>`;
  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    ${signNowHtml(reclaimCase, "den bestätigten Antrag auf Seite 1 unter „Rechtsgültige Unterschrift“ (Ort, Datum, Unterschrift)")}
    <p class="ch-lead">Lade den vom Finanzamt bestätigten Antrag im ePortal hoch. Erst dann prüft die Steuerverwaltung und zahlt aus.</p>

    <div class="card">
      <div class="card-head"><span class="card-title">Im ePortal hochladen</span><a class="btn-secondary btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a></div>
      <div class="card-body">
        <ol class="flow-steps">
          <li><div>Antrag prüfen: Stempel und beide Unterschriften auf Seite 1, keine handschriftlichen Korrekturen.</div></li>
          <li><div>Alle Seiten als <b>eine</b> PDF einscannen, höchstens 10 MB.</div></li>
          <li><div>${path("Verrechnungssteuer", "Anträge", "Unterzeichneten Antrag hochladen")} und das PDF wählen.</div></li>
          <li><div>Antrags-ID von Seite 1 oben rechts eingeben, z.B. <span class="mono" style="white-space:nowrap">DE-1234-5678-00</span>.</div></li>
          <li><div>Die drei Bestätigungen anhaken und ${path("Antrag einreichen")}.</div></li>
        </ol>
      </div>
    </div>

    ${submitEndHtml(reclaimCase, {
      submittedAt: reclaimCase.ch.completedAt,
      doneSub: `Hochgeladen am ${esc(formatDateDe((reclaimCase.ch.completedAt ?? "").slice(0, 10)))} · die Auszahlung dauert meist einige Wochen`,
      question: "Hochgeladen? Dann ist dein Antrag eingereicht.",
      actionLabel: "✓ Ist eingereicht",
    })}

    ${submitNavHtml(completed)}
    </div>`;

  bindStepNav(container, reclaimCase, 6);
  bindPausePanel(container, reclaimCase);
  bindStatusTimeline(container, () => chTimelineDone(reclaimCase), async (n) => {
    reclaimCase.ch.timelineStep = n;
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });

  container.querySelectorAll("[data-upload-check]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.ch.uploadChecks);
      box.checked ? set.add(box.dataset.uploadCheck) : set.delete(box.dataset.uploadCheck);
      reclaimCase.ch.uploadChecks = [...set];
      await saveCase(reclaimCase);
      render(container, reclaimCase, transactions);
    })
  );

  container.querySelector('[data-action="mark-mailed"]')?.addEventListener("click", async () => {
    reclaimCase.ch.completedAt = new Date().toISOString();
    reclaimCase.submittedAt = reclaimCase.ch.completedAt;
    reclaimCase.ch.timelineStep = Math.max(reclaimCase.ch.timelineStep, 4);
    reclaimCase.ch.stepsDone = [1, 2, 3, 4, 5, 6];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });
}
