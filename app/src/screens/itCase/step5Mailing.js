// Italien, Schritt 5 "Versand nach Italien" (docs/konzept-italien.md §1, §6):
// Begleitschreiben (Englisch), Checkliste für den Umschlag, Adresse in
// Pescara. "Als versendet markieren" schließt den DivRebound ab (zählt für die
// Statistik); danach optional die erhaltene Erstattung.

import { getState } from "../../store/store.js";
import { corridors } from "../../config/corridors.js";
import { buildItalyCoverLetter, italyCoverLetterFileName } from "../../lib/buildItalyCoverLetter.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { formatDateDe } from "../../util/format.js";
import { showToast } from "../../components/toast.js";
import { groupByIssuer } from "../../lib/italy.js";
import {
  esc, saveCase, caseSummary, formatEurPlain, stepHeader, stepNavHtml, bindStepNav, timelineHtml, bindTimeline, downloadBlob,
} from "./itShared.js";

const ADDRESS = corridors.IT.mailingAddress;

function envelopeChecks(formsCount, statements) {
  return [
    ["forms", `<b>${formsCount} × Form A</b> im Original, je 5 Seiten, vom Finanzamt auf Seite 5 gestempelt und unterschrieben`],
    ["signatures", "Ihre Unterschriften auf <b>Seite 3 und Seite 5</b> jedes Formulars"],
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
  const checks = new Set(reclaimCase.it.envelopeChecks ?? []);
  const items = envelopeChecks(forms.length, eligible.length);
  const allChecked = items.every(([id]) => checks.has(id));
  const mailed = Boolean(reclaimCase.it.mailedAt);
  const received = reclaimCase.it.receivedRefund ?? { date: "", amountEur: "" };

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    <p class="ch-lead">Sobald das Finanzamt die Formulare bestätigt zurückgeschickt hat, gehen sie zusammen mit Kopien Ihrer Abrechnungen und dem Begleitschreiben per Post an die italienische Steuerbehörde.</p>

    ${timelineHtml(reclaimCase)}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Begleitschreiben (Englisch)</span><span class="ch-head-sub">an die Agenzia delle Entrate</span></div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Begleitschreiben an die Agenzia delle Entrate</div>
          <div class="doc-sub">Antrag auf Erstattung, Liste der Unternehmen, Anlagen und Bankverbindung – auf Englisch, bitte unterschreiben.</div>
          <div class="doc-file">${esc(italyCoverLetterFileName(profile, years))}</div>
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
      <div class="card-head head-navy"><span class="card-title">Adresse</span><span class="ch-head-sub">Einschreiben mit Rückschein empfohlen</span></div>
      <div class="card-body">
        <div class="it-address mono">${ADDRESS.map(esc).join("<br>")}</div>
        <div class="ch-inline-actions"><button class="btn-secondary btn-small" data-action="copy-address" type="button">⧉ Adresse kopieren</button></div>
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
                  <div class="done-sub">Am ${esc(formatDateDe(reclaimCase.it.mailedAt.slice(0, 10)))} nach Italien versendet · erwartete Erstattung ${formatEurPlain(total)} €</div>
                </div>
              </div>
              <p class="ch-text"><b>Optional:</b> Wenn das Geld da ist, hier eintragen – so sehen Sie später, was DivRebound Ihnen insgesamt gebracht hat.</p>
              <div class="ch-received">
                <div class="field-row"><label class="field-label">Erhalten am</label><input class="field-input" type="date" data-received="date" value="${esc(received.date)}"></div>
                <div class="field-row"><label class="field-label">Betrag (EUR)</label><input class="field-input mono" inputmode="decimal" data-received="amountEur" placeholder="z.B. ${formatEurPlain(total)}" value="${esc(received.amountEur)}"></div>
              </div>`
            : `<p class="ch-text">Wenn der Umschlag unterwegs ist, ist Ihr DivRebound abgeschlossen. Die Erstattung können Sie später hier eintragen.</p>
              <button class="btn-primary" data-action="mark-mailed" ${allChecked ? "" : "disabled"} type="button">✓ Als versendet markieren</button>
              ${allChecked ? "" : `<div class="field-hint" style="margin-top:6px;">Bitte zuerst die Punkte oben abhaken.</div>`}`
        }
      </div>
    </div>

    <div class="info-banner"><span class="icon">⏳</span><div><b>Geduld nötig:</b> Die Bearbeitung in Pescara dauert erfahrungsgemäß viele Monate. Die Frist von 48 Monaten ist mit dem Versand gewahrt.</div></div>

    ${stepNavHtml(5)}
    </div>`;

  bindStepNav(container, reclaimCase, 5);
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
    reclaimCase.it.timelineStep = Math.max(reclaimCase.it.timelineStep ?? 0, 4);
    reclaimCase.it.stepsDone = [1, 2, 3, 4, 5];
    reclaimCase.status = "submitted";
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });

  container.querySelectorAll("[data-received]").forEach((input) =>
    input.addEventListener("change", async () => {
      reclaimCase.it.receivedRefund = { ...received, ...reclaimCase.it.receivedRefund, [input.dataset.received]: input.value.trim() };
      await saveCase(reclaimCase);
      showToast(`✓ ${input.dataset.received === "date" ? "Datum" : "Betrag"} gespeichert`);
      if (input.dataset.received === "date") render(container, reclaimCase);
    })
  );
}

export function mount(container, reclaimCase) {
  render(container, reclaimCase);
}
