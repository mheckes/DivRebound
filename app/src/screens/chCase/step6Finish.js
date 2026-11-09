// Schritt 6 "Hochladen & abschließen" (docs/konzept-schweiz.md §1, §2c):
// Der vom Finanzamt bestätigte Antrag wird im ePortal hochgeladen. Erst mit
// "DivRebound abschließen" gilt der Fall als erledigt (zählt für die Statistik).

import { getState } from "../../store/store.js";
import { statusTimelineHtml, bindStatusTimeline } from "../../components/statusTimeline.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { formatDateDe } from "../../util/format.js";
import { CH_TIMELINE, timelineTitle, chTimelineDone } from "./step5TaxOffice.js";
import { esc, corridor, saveCase, loadTransactions, entitlementsFor, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

// Reihenfolge wie im ePortal (Seite "Unterzeichneten Antrag hochladen"):
// Datei wählen -> Antrags-ID eingeben -> drei Bestätigungen -> einreichen.
const UPLOAD_CHECKS = [
  ["stamp", "<b>Prüfen:</b> Stempel, Unterschrift und Datum des Finanzamts sind auf Seite 1 vorhanden. Keine handschriftlichen Korrekturen oder Anmerkungen – die führen zur Ablehnung."],
  ["scan", "<b>Einscannen:</b> alle Seiten als <b>eine</b> PDF-Datei, gut lesbar, höchstens 10 MB."],
  ["upload", "<b>Hochladen:</b> im ePortal unter „Verrechnungssteuer“ → „Anträge“ auf <b>„Unterzeichneten Antrag hochladen“</b> klicken und das PDF auswählen."],
  ["antragsId", "<b>Antrags-ID eingeben:</b> so wie sie auf Seite 1 deines Antrags oben rechts steht, z.B. <span class=\"mono\" style=\"white-space:nowrap\">DE-1234-5678-00</span>. Sie steht auch in der Antragsübersicht. Das Portal meldet dann „Die Antrags-ID ist gültig“."],
  ["confirm", "<b>Bestätigen und einreichen:</b> die drei Bestätigungen anhaken (beglaubigt, rechtsgültig unterzeichnet, vollständig und richtig) und auf <b>„Antrag einreichen“</b> klicken."],
];

export async function mount(container, reclaimCase) {
  const transactions = await loadTransactions(getState().currentProfile);
  render(container, reclaimCase, transactions);
}

function render(container, reclaimCase, transactions) {
  const results = entitlementsFor(reclaimCase, transactions, getState().currentProfile);
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  const checks = new Set(reclaimCase.ch.uploadChecks);
  const allChecked = UPLOAD_CHECKS.every(([id]) => checks.has(id));
  const completed = Boolean(reclaimCase.ch.completedAt);

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    <p class="ch-lead">Der vom deutschen Finanzamt bestätigte Antrag wird im ePortal hochgeladen. Erst danach prüft die Eidgenössische Steuerverwaltung deinen Antrag und überweist die Erstattung.</p>

    ${statusTimelineHtml({ title: timelineTitle(reclaimCase, total), steps: CH_TIMELINE, doneCount: chTimelineDone(reclaimCase) })}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bestätigten Antrag hochladen</span></div>
      <div class="card-body">
        ${UPLOAD_CHECKS.map(([id, text]) => `<label class="ch-step-row"><input type="checkbox" data-upload-check="${id}" ${checks.has(id) ? "checked" : ""} ${completed ? "disabled" : ""}><span>${text}</span></label>`).join("")}
        <div class="ch-inline-actions">
          <a class="btn-accent btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">DivRebound abschließen</span></div>
      <div class="card-body">
        ${
          completed
            ? `<div class="done-banner ch-done-banner">
                <div class="done-icon">✓</div>
                <div>
                  <div class="done-title">DivRebound abgeschlossen</div>
                  <div class="done-sub">Hochgeladen am ${esc(formatDateDe(reclaimCase.ch.completedAt.slice(0, 10)))}. Die Eidgenössische Steuerverwaltung prüft jetzt deinen Antrag. Die Auszahlung dauert erfahrungsgemäß einige Wochen.</div>
                </div>
              </div>
              <p class="ch-text">Wenn die Erstattung da ist, kannst du sie in Schritt 7 festhalten (optional).</p>`
            : `<button class="btn-primary" data-action="finish" ${allChecked ? "" : "disabled"} type="button">✓ Eingereicht – DivRebound abschließen</button>
              ${allChecked ? "" : `<div class="field-hint" style="margin-top:6px;">Bitte zuerst alle Punkte oben abhaken.</div>`}`
        }
      </div>
    </div>

    ${completed ? pausePanelHtml(reclaimCase, "payout") : ""}

    ${stepNavHtml(6)}
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

  container.querySelector('[data-action="finish"]')?.addEventListener("click", async () => {
    reclaimCase.ch.completedAt = new Date().toISOString();
    reclaimCase.submittedAt = reclaimCase.ch.completedAt;
    reclaimCase.ch.timelineStep = Math.max(reclaimCase.ch.timelineStep, 4);
    reclaimCase.ch.stepsDone = [1, 2, 3, 4, 5, 6];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });
}
