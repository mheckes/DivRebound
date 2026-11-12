// Schweden, Schritt 5 "Versand nach Schweden": Checkliste für den Umschlag,
// Adresse von Skatteverket (Post) und E-Mail-Adresse aus dem Formularkopf.
// "Als versendet markieren" schließt den DivRebound ab (zählt für die
// Statistik); die erhaltene Erstattung folgt optional in Schritt 6.
// Dazu ein englisches Begleitschreiben (lib/buildSwedenCoverLetter.js).

import { corridor, esc, saveCase, caseSummary, formatSekDe, approxEur, stepHeader, stepNavHtml, bindStepNav, timelineHtml, bindTimeline, downloadBlob } from "./seShared.js";
import { getState } from "../../store/store.js";
import { buildSwedenCoverLetter, swedenCoverLetterFileName } from "../../lib/buildSwedenCoverLetter.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { formatDateDe } from "../../util/format.js";
import { showToast } from "../../components/toast.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { deadlineOf, groupByIssuer } from "../../lib/sweden.js";

const ADDRESS = corridor.mailingAddress;
const EMAIL = corridor.mailingEmail;

function envelopeChecks(formsCount, statements) {
  return [
    ["forms", `<b>${formsCount === 1 ? "Das Formular „SKV 3740“" : `${formsCount} × Formular „SKV 3740“`}</b> im Original (Seite 1 und 2)`],
    ["signature", "Deine <b>Unterschrift unten auf Seite 1</b>"],
    ["certificate", "Die <b>Bestätigung des Finanzamts unten auf Seite 2</b> (Stempel, Unterschrift und Anschrift)"],
    ["statements", `<b>Kopien der ${statements} Dividendenabrechnung${statements === 1 ? "" : "en"}</b> – sie zeigen die einbehaltene schwedische Steuer und auf wessen Namen ausgezahlt wurde`],
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
  const checks = new Set(reclaimCase.se.envelopeChecks ?? []);
  const items = envelopeChecks(forms.length, eligible.length);
  const allChecked = items.every(([id]) => checks.has(id));
  const mailed = Boolean(reclaimCase.se.mailedAt);
  const deadline = eligible.length ? eligible.map(deadlineOf).sort()[0] : null;

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    <p class="ch-lead">Sobald das Finanzamt das Formular bestätigt zurückgeschickt hat, gehen sie zusammen mit Kopien deiner Abrechnungen und dem Begleitschreiben an die schwedische Steuerbehörde Skatteverket.</p>

    ${timelineHtml(reclaimCase)}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Begleitschreiben (Englisch)</span><span class="ch-head-sub">an Skatteverket</span></div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Begleitschreiben an Skatteverket</div>
          <div class="doc-sub">Antrag auf Erstattung, Liste der Unternehmen, Anlagen und Bankverbindung – auf Englisch, bitte unterschreiben.</div>
          <div class="doc-file">${esc(swedenCoverLetterFileName(profile, years))}</div>
        </div>
        <div class="doc-actions">
          <button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${forms.length ? "" : "disabled"}>👁 Vorschau</button>
          <button class="btn-accent btn-small" data-action="letter" type="button" ${forms.length ? "" : "disabled"}>⬇ PDF</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Das kommt in den Umschlag</span><span class="ch-head-sub">${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · ${eligible.length} Abrechnung${eligible.length === 1 ? "" : "en"}</span></div>
      <div class="card-body">
        ${items.map(([id, text]) => `<label class="ch-step-row"><input type="checkbox" data-envelope="${id}" ${checks.has(id) ? "checked" : ""} ${mailed ? "disabled" : ""}><span>${text}</span></label>`).join("")}
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Adresse</span><span class="ch-head-sub">per Post, Einschreiben empfohlen</span></div>
      <div class="card-body">
        <div class="se-address mono">${ADDRESS.map(esc).join("<br>")}</div>
        <div class="ch-inline-actions"><button class="btn-secondary btn-small" data-action="copy-address" type="button">⧉ Adresse kopieren</button></div>
        <p class="ch-text" style="margin-top:12px;"><b>Per E-Mail:</b> Im Kopf des Formulars nennt Skatteverket auch die Adresse <span class="mono">${esc(EMAIL)}</span>. Dazu das vollständig unterschriebene und gestempelte Formular und die Abrechnungen einscannen. Ob ein Scan als Nachweis genügt, entscheidet Skatteverket – im Zweifel per Post.</p>
        <div class="ch-inline-actions"><button class="btn-secondary btn-small" data-action="copy-email" type="button">⧉ E-Mail-Adresse kopieren</button></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">DivRebound abschließen</span></div>
      <div class="card-body">
        ${
          mailed
            ? `<div class="done-banner ch-done-banner">
                <div class="done-icon">✓</div>
                <div>
                  <div class="done-title">DivRebound abgeschlossen</div>
                  <div class="done-sub">Am ${esc(formatDateDe(reclaimCase.se.mailedAt.slice(0, 10)))} nach Schweden versendet · erwartete Erstattung ${formatSekDe(total)} (${approxEur(total)})</div>
                </div>
              </div>
              <p class="ch-text">Wenn die Erstattung da ist, kannst du sie in Schritt 6 festhalten (optional).</p>`
            : `<p class="ch-text">Wenn der Umschlag unterwegs ist, ist dein DivRebound abgeschlossen. Die Erstattung kannst du später in Schritt 6 eintragen.</p>
              <button class="btn-primary" data-action="mark-mailed" ${allChecked ? "" : "disabled"} type="button">✓ Als versendet markieren</button>
              ${allChecked ? "" : `<div class="field-hint" style="margin-top:6px;">Bitte zuerst die Punkte oben abhaken.</div>`}`
        }
      </div>
    </div>

    <div class="info-banner"><span class="icon">⏳</span><div><b>Frist und Geduld:</b> Der Antrag muss spätestens fünf Jahre nach Ende des Kalenderjahres der Auszahlung bei Skatteverket sein${deadline ? ` – für deine älteste Dividende bis zum ${esc(formatDateDe(deadline))}` : ""}. Die Bearbeitung dauert erfahrungsgemäß mehrere Monate.</div></div>

    ${mailed ? pausePanelHtml(reclaimCase, "payout") : ""}

    ${stepNavHtml(5)}
    </div>`;

  bindStepNav(container, reclaimCase, 5);
  bindPausePanel(container, reclaimCase);
  bindTimeline(container, reclaimCase, () => render(container, reclaimCase));

  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    const current = getState().currentProfile;
    downloadBlob(await buildSwedenCoverLetter(current, letterDetails(reclaimCase)), swedenCoverLetterFileName(current, years));
  });
  container.querySelector('[data-action="letter-preview"]').addEventListener("click", () =>
    openPdfPreview(() => buildSwedenCoverLetter(getState().currentProfile, letterDetails(reclaimCase)))
  );
  container.querySelector('[data-action="copy-address"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(ADDRESS.join("\n")).catch(() => {});
    showToast("✓ Adresse kopiert");
  });
  container.querySelector('[data-action="copy-email"]').addEventListener("click", () => {
    navigator.clipboard?.writeText(EMAIL).catch(() => {});
    showToast("✓ E-Mail-Adresse kopiert");
  });

  container.querySelectorAll("[data-envelope]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.se.envelopeChecks ?? []);
      box.checked ? set.add(box.dataset.envelope) : set.delete(box.dataset.envelope);
      reclaimCase.se.envelopeChecks = [...set];
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

  container.querySelector('[data-action="mark-mailed"]')?.addEventListener("click", async () => {
    reclaimCase.se.mailedAt = new Date().toISOString();
    reclaimCase.submittedAt = reclaimCase.se.mailedAt;
    reclaimCase.se.timelineStep = Math.max(reclaimCase.se.timelineStep ?? 0, 4);
    reclaimCase.se.stepsDone = [1, 2, 3, 4, 5];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
