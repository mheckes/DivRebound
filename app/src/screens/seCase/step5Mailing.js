// Schweden, Schritt 5 "Versand nach Schweden": Checkliste für den Umschlag,
// Adresse von Skatteverket (Post) und E-Mail-Adresse aus dem Formularkopf.
// "Als versendet markieren" schließt den DivRebound ab (zählt für die
// Statistik); die erhaltene Erstattung folgt optional in Schritt 6.
// Dazu ein englisches Begleitschreiben (lib/buildSwedenCoverLetter.js).

import { signNowHtml } from "../../components/flow.js";
import { corridor, esc, saveCase, caseSummary, formatSekDe, approxEur, stepHeader, stepNavHtml, bindStepNav, timelineHtml, bindTimeline, downloadBlob } from "./seShared.js";
import { getState } from "../../store/store.js";
import { buildSwedenCoverLetter, swedenCoverLetterFileName } from "../../lib/buildSwedenCoverLetter.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { formatDateDe } from "../../util/format.js";
import { showToast } from "../../components/toast.js";
import { bindPausePanel, submitEndHtml, submitNavHtml } from "../../components/pausePanel.js";
import { deadlineOf, groupByIssuer } from "../../lib/sweden.js";

const ADDRESS = corridor.mailingAddress;
const EMAIL = corridor.mailingEmail;

function envelopeChecks(formsCount, statements) {
  return [
    ["forms", `<b>${formsCount === 1 ? "Formular „SKV 3740“" : `${formsCount} × Formular „SKV 3740“`}</b> im Original, unten auf Seite 1 unterschrieben`],
    ["certificate", "mit der <b>Bestätigung des Finanzamts</b> unten auf Seite 2"],
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
  const mailed = Boolean(reclaimCase.se.mailedAt);
  const deadline = eligible.length ? eligible.map(deadlineOf).sort()[0] : null;

  // Stand 2.1: gleicher Aufbau wie "Ans Finanzamt schicken" - Kurzsatz,
  // Dokument mit Primärbutton, Weg als Kacheln (Post empfohlen / E-Mail),
  // nummerierte Schritte, "Ist abgeschickt" in der Pause-Komponente.
  const way = reclaimCase.se.submitWay ?? "post";
  const tile = (key, label, tag = "") =>
    `<button type="button" class="way-tile ${way === key ? "on" : ""}" data-submit-way="${key}" aria-pressed="${way === key}">${label}${tag ? `<span class="way-tag">${tag}</span>` : ""}</button>`;

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    ${signNowHtml(reclaimCase, "das Formular unten auf Seite 1 (Feld „Sökandens signatur“)")}
    <p class="ch-lead">Schick das bestätigte Formular mit Kopien deiner Abrechnungen und dem Begleitschreiben an Skatteverket${deadline ? `, spätestens bis ${esc(formatDateDe(deadline))}` : ""}.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Begleitschreiben herunterladen</span><span class="ch-head-sub">Englisch · an Skatteverket</span></div>
      <div class="doc-item">
        <div>
          <div class="doc-title">Begleitschreiben an Skatteverket</div>
          <div class="doc-file">${esc(swedenCoverLetterFileName(profile, years))}</div>
        </div>
        <div class="doc-actions">
          <button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${forms.length ? "" : "disabled"}>👁 Vorschau</button>
          <button class="btn-primary" data-action="letter" type="button" ${forms.length ? "" : "disabled"}>⬇ Herunterladen</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><span class="card-title">So kommt es zu Skatteverket</span><span class="ch-head-sub">${forms.length} ${forms.length === 1 ? "Formular" : "Formulare"} · ${eligible.length} Abrechnung${eligible.length === 1 ? "" : "en"}</span></div>
      <div class="card-body">
        <div class="way-tiles">${tile("post", "Per Post", "Empfohlen")}${tile("email", "Per E-Mail")}</div>

        <div class="way ${way === "post" ? "on" : ""}" data-submit-pane="post">
          <ol class="flow-steps">
            <li><div>In den Umschlag:<ul class="ch-list se-envelope">${items.map(([, text]) => `<li>${text}</li>`).join("")}</ul></div></li>
            <li><div>An diese Adresse schicken, am besten als Einschreiben. <button class="btn-secondary btn-small" data-action="copy-address" type="button">⧉ Adresse kopieren</button>
              <div class="se-address mono">${ADDRESS.map(esc).join("<br>")}</div></div></li>
          </ol>
        </div>

        <div class="way ${way === "email" ? "on" : ""}" data-submit-pane="email">
          <ol class="flow-steps">
            <li><div>Formular (unterschrieben und gestempelt), Abrechnungen und Begleitschreiben einscannen.</div></li>
            <li><div>An <span class="mono">${esc(EMAIL)}</span> schicken. <button class="btn-secondary btn-small" data-action="copy-email" type="button">⧉ Adresse kopieren</button></div></li>
          </ol>
          <p class="flow-after">Ob ein Scan genügt, entscheidet Skatteverket. Im Zweifel per Post.</p>
        </div>
      </div>
    </div>

    ${submitEndHtml(reclaimCase, {
      submittedAt: reclaimCase.se.mailedAt,
      doneSub: `Am ${esc(formatDateDe((reclaimCase.se.mailedAt ?? "").slice(0, 10)))} an Skatteverket · erwartete Erstattung ${formatSekDe(total)} (${approxEur(total)})`,
    })}

    ${submitNavHtml(mailed)}
    </div>`;

  container.querySelectorAll("[data-submit-way]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      reclaimCase.se.submitWay = btn.dataset.submitWay;
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

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
