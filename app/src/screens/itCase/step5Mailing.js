// Italien, Schritt 5 "Versand nach Italien" (docs/konzept-italien.md §1, §6):
// Begleitschreiben (Englisch), Checkliste für den Umschlag, Adresse in
// Pescara. "Als versendet markieren" schließt den DivRebound ab (zählt für die
// Statistik); die erhaltene Erstattung folgt optional in Schritt 6.

import { signNowHtml } from "../../components/flow.js";
import { getState } from "../../store/store.js";
import { corridors } from "../../config/corridors.js";
import { buildItalyCoverLetter, italyCoverLetterFileName } from "../../lib/buildItalyCoverLetter.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { formatDateDe } from "../../util/format.js";
import { showToast } from "../../components/toast.js";
import { bindPausePanel, submitEndHtml, submitNavHtml } from "../../components/pausePanel.js";
import { groupByIssuer } from "../../lib/italy.js";
import {
  esc, saveCase, caseSummary, formatEurPlain, stepHeader, stepNavHtml, bindStepNav, timelineHtml, bindTimeline, downloadBlob,
} from "./itShared.js";

const ADDRESS = corridors.IT.mailingAddress;

function envelopeChecks(formsCount, statements) {
  return [
    ["forms", `<b>${formsCount} × Formular „Form A“</b> im Original, vom Finanzamt auf Seite 5 bestätigt`],
    ["signatures", "mit deinen <b>Unterschriften auf Seite 3 und 5</b>"],
    ["statements", `<b>Kopien der ${statements} Dividendenabrechnung${statements === 1 ? "" : "en"}</b>`],
    ["letter", "<b>Begleitschreiben</b>, unterschrieben"],
  ];
}

function letterDetails(reclaimCase) {
  const { eligible, forms, years } = caseSummary(reclaimCase);
  const companies = groupByIssuer(eligible).map((g) => ({ name: g.issuerName || g.isin, isin: g.isin }));
  return { companies, years, formsCount: forms.length };
}

function render(container, reclaimCase) {
  const profile = getState().currentProfile;
  const { eligible, forms, years, total } = caseSummary(reclaimCase);
  const items = envelopeChecks(forms.length, eligible.length);
  const mailed = Boolean(reclaimCase.it.mailedAt);

  // Stand 2.1: Kurzsatz, Dokument mit Primärbutton, nummerierte Schritte,
  // "Ist abgeschickt" in der Pause-Komponente (wie Schweden).
  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    ${signNowHtml(reclaimCase, "jedes Formular auf Seite 3 und Seite 5")}
    <p class="ch-lead">Schick die bestätigten Formulare mit Kopien deiner Abrechnungen und dem Begleitschreiben per Post nach Italien.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Begleitschreiben herunterladen</span><span class="ch-head-sub">Englisch · an die Agenzia delle Entrate</span></div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Begleitschreiben an die Agenzia delle Entrate</div>
          <div class="doc-file">${esc(italyCoverLetterFileName(profile, years))}</div>
        </div>
        <div class="doc-actions">
          <button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${forms.length ? "" : "disabled"}>👁 Vorschau</button>
          <button class="btn-primary" data-action="letter" type="button" ${forms.length ? "" : "disabled"}>⬇ Herunterladen</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">So kommt es nach Italien</span><span class="ch-head-sub">${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · ${eligible.length} Abrechnung${eligible.length === 1 ? "" : "en"}</span></div>
      <div class="card-body">
        <ol class="flow-steps">
          <li><div>In den Umschlag:<ul class="ch-list se-envelope">${items.map(([, text]) => `<li>${text}</li>`).join("")}</ul></div></li>
          <li><div>An diese Adresse schicken, am besten als Einschreiben mit Rückschein. <button class="btn-secondary btn-small" data-action="copy-address" type="button">⧉ Adresse kopieren</button>
            <div class="se-address mono">${ADDRESS.map(esc).join("<br>")}</div></div></li>
        </ol>
        <p class="flow-after">Mit dem Versand ist die Frist von 48 Monaten gewahrt.</p>
      </div>
    </div>

    ${submitEndHtml(reclaimCase, {
      submittedAt: reclaimCase.it.mailedAt,
      doneSub: `Am ${esc(formatDateDe((reclaimCase.it.mailedAt ?? "").slice(0, 10)))} nach Italien versendet · erwartete Erstattung ${formatEurPlain(total)} €`,
    })}

    ${submitNavHtml(mailed)}
    </div>`;

  bindStepNav(container, reclaimCase, 5);
  bindPausePanel(container, reclaimCase);
  bindTimeline(container, reclaimCase, () => render(container, reclaimCase));

  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    const current = getState().currentProfile;
    downloadBlob(await buildItalyCoverLetter(current, letterDetails(reclaimCase)), italyCoverLetterFileName(current, years));
  });
  container.querySelector('[data-action="letter-preview"]').addEventListener("click", () =>
    openPdfPreview(() => buildItalyCoverLetter(getState().currentProfile, letterDetails(reclaimCase)))
  );
  container.querySelector('[data-action="copy-address"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(ADDRESS.join("\n")).catch(() => {});
    showToast("✓ Adresse kopiert");
  });

  container.querySelectorAll("[data-envelope]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.it.envelopeChecks ?? []);
      box.checked ? set.add(box.dataset.envelope) : set.delete(box.dataset.envelope);
      reclaimCase.it.envelopeChecks = [...set];
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

  container.querySelector('[data-action="mark-mailed"]')?.addEventListener("click", async () => {
    reclaimCase.it.mailedAt = new Date().toISOString();
    reclaimCase.submittedAt = reclaimCase.it.mailedAt;
    reclaimCase.it.timelineStep = Math.max(reclaimCase.it.timelineStep ?? 0, 4);
    reclaimCase.it.stepsDone = [1, 2, 3, 4, 5];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
