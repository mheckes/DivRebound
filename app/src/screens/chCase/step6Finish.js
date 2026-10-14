// Schritt 6 "Hochladen & abschließen" (docs/konzept-schweiz.md §1, §2c):
// Der vom Finanzamt bestätigte Antrag wird im ePortal hochgeladen. Erst mit
// "DivRebound abschließen" gilt der Fall als erledigt (zählt für die Statistik).

import { getState } from "../../store/store.js";
import { statusTimelineHtml, bindStatusTimeline } from "../../components/statusTimeline.js";
import { openGuideModal } from "../../components/guideModal.js";
import { formatDateDe } from "../../util/format.js";
import { CH_TIMELINE, timelineTitle } from "./step5TaxOffice.js";
import { esc, corridor, saveCase, loadTransactions, entitlementsFor, stepHeader, stepNavHtml, bindStepNav, toastSaved } from "./chShared.js";

const UPLOAD_CHECKS = [
  ["stamp", "<b>Prüfen:</b> Stempel, Unterschrift und Datum des Finanzamts sind auf Seite 1 vorhanden."],
  ["scan", "<b>Einscannen:</b> alle Seiten als <b>ein</b> PDF, gut lesbar (eine Scan-App auf dem Handy genügt)."],
  ["upload", "<b>Hochladen:</b> im ePortal unter „Verrechnungssteuer“ → Antragsübersicht → Antrag öffnen und das PDF hochladen."],
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
  const received = reclaimCase.ch.receivedRefund ?? { date: "", amountEur: "" };

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 6)}
    <p class="ch-lead">Der vom Finanzamt bestätigte Antrag wird im ePortal hochgeladen. Erst danach prüft die Eidgenössische Steuerverwaltung Ihren Antrag und überweist die Erstattung.</p>

    ${statusTimelineHtml({ title: timelineTitle(reclaimCase, total), steps: CH_TIMELINE, doneCount: reclaimCase.ch.timelineStep })}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Bestätigten Antrag hochladen</span>${reclaimCase.ch.claimId ? `<span class="ch-head-sub">Antrag ${esc(reclaimCase.ch.claimId)}</span>` : ""}</div>
      <div class="card-body">
        ${UPLOAD_CHECKS.map(([id, text]) => `<label class="ch-step-row"><input type="checkbox" data-upload-check="${id}" ${checks.has(id) ? "checked" : ""} ${completed ? "disabled" : ""}><span>${text}</span></label>`).join("")}
        <div class="ch-inline-actions">
          <a class="btn-accent btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>
          <button class="btn-secondary btn-small" data-guide="upload" type="button">Anleitung: Hochladen im ePortal</button>
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
                  <div class="done-sub">Hochgeladen am ${esc(formatDateDe(reclaimCase.ch.completedAt.slice(0, 10)))}. Die Eidgenössische Steuerverwaltung prüft jetzt Ihren Antrag – die Auszahlung dauert erfahrungsgemäß einige Monate.</div>
                </div>
              </div>
              <p class="ch-text"><b>Optional:</b> Wenn das Geld da ist, hier eintragen – so sehen Sie später, was DivRebound Ihnen insgesamt gebracht hat.</p>
              <div class="ch-received">
                <div class="field-row"><label class="field-label">Erhalten am</label><input class="field-input" type="date" data-received="date" value="${esc(received.date)}"></div>
                <div class="field-row"><label class="field-label">Betrag (EUR)</label><input class="field-input mono" inputmode="decimal" data-received="amountEur" placeholder="z.B. 42,80" value="${esc(received.amountEur)}"></div>
              </div>`
            : `<p class="ch-text">Sobald der bestätigte Antrag hochgeladen ist, schließen Sie den DivRebound ab. Erst dann zählt er als erledigt.</p>
              <button class="btn-primary" data-action="finish" ${allChecked ? "" : "disabled"} type="button">✓ Hochgeladen – DivRebound abschließen</button>
              ${allChecked ? "" : `<div class="field-hint" style="margin-top:6px;">Bitte zuerst die drei Punkte oben abhaken.</div>`}`
        }
      </div>
    </div>

    ${stepNavHtml(6)}
    </div>`;

  bindStepNav(container, reclaimCase, 6);
  bindStatusTimeline(container, () => reclaimCase.ch.timelineStep, async (n) => {
    reclaimCase.ch.timelineStep = n;
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });
  container.querySelector('[data-guide="upload"]').addEventListener("click", () => openGuideModal("upload"));

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
    reclaimCase.ch.timelineStep = Math.max(reclaimCase.ch.timelineStep, 4);
    reclaimCase.ch.stepsDone = [1, 2, 3, 4, 5, 6];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });

  container.querySelectorAll("[data-received]").forEach((input) =>
    input.addEventListener("change", async () => {
      reclaimCase.ch.receivedRefund = { ...received, ...reclaimCase.ch.receivedRefund, [input.dataset.received]: input.value.trim() };
      const paidNow = reclaimCase.ch.receivedRefund.date && reclaimCase.ch.timelineStep < 5;
      if (paidNow) reclaimCase.ch.timelineStep = 5;
      await saveCase(reclaimCase);
      toastSaved(input.dataset.received === "date" ? "Datum" : "Betrag");
      if (paidNow) render(container, reclaimCase, transactions);
    })
  );
}
