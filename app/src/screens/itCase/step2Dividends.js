// Italien, Schritt 2 "Dividendenabrechnungen" - gleiche Darstellung wie
// Dänemark (screens/shell/shell.js): Upload, Hinweise zu den Dateien, Tabelle
// mit Auswahl und Status, Zwischensummen, Erstattungsbanner, "x von y bestätigt".
// Unterschiede (docs/konzept-italien.md §1, §5): gruppiert nach Unternehmen
// (ein Form A je Unternehmen), Spalte "Satz" mit der Einstufung des
// tatsächlich einbehaltenen Steuersatzes, Beträge in EUR.

import { getState, setState } from "../../store/store.js";
import * as caseRepo from "../../db/caseRepo.js";
import * as profileRepo from "../../db/profileRepo.js";
import { parseDividendCertificate } from "../../lib/parseDividendCertificate.js";
import { corridors } from "../../config/corridors.js";
import { isDuplicateDistribution } from "../../util/validate.js";
import { applyProfileHints } from "../../util/profileHints.js";
import { formatNumberDe, parseNumberDe, formatDateDe } from "../../util/format.js";
import { classifyWithholding, refundFor, isEligible, groupByIssuer, formsFor, totalRefund } from "../../lib/italy.js";
import { esc, saveCase, stepHeader, markStepDone, goToStep } from "./itShared.js";

const corridor = corridors.IT;
let issues = []; // [{ kind: 'rejected'|'dupe', fileName, reason, isin }]

const REASONS = {
  none: "Höchstens 15 % Quellensteuer einbehalten – nichts zu erstatten. Kommt nicht ins Formular.",
  expired: "Zahltag liegt mehr als 48 Monate zurück – die Frist für die Erstattung ist abgelaufen.",
  partial: "Weniger als 26 % einbehalten (z. B. Ausschüttung teilweise aus Kapitalrücklagen). Erstattet wird nur der tatsächliche Abzug über 15 %. Bitte prüfen und bestätigen.",
  high: "Mehr als 26 % einbehalten – das ist ungewöhnlich. Bitte die Beträge mit der Abrechnung vergleichen.",
  invalid: "Bruttobetrag oder Quellensteuer in EUR nicht erkannt – bitte aus der Abrechnung eintragen.",
};

function percent(rate) {
  return rate === null ? "–" : `${formatNumberDe(rate * 100, rate * 100 % 1 ? 1 : 0)} %`;
}

async function handleFiles(container, fileList) {
  if (!fileList?.length) return;
  const { currentCase: reclaimCase, currentProfile: profile } = getState();
  const others = (await caseRepo.getByProfileId(profile.profileId)).filter((c) => c.caseId !== reclaimCase.caseId);
  const otherDistributions = others.flatMap((c) => c.distributions);
  let profileChanged = false;

  for (const file of Array.from(fileList)) {
    const result = await parseDividendCertificate(await file.arrayBuffer(), corridor);
    if (!result.isinValid || !result.distribution) {
      const isinWarning = result.warnings.find((w) => /ISIN/i.test(w));
      const isin = isinWarning?.match(/"([A-Z0-9]+)"/)?.[1] ?? "";
      issues.push({
        kind: "rejected",
        fileName: file.name,
        reason: isin ? `ISIN „${isin}“ ist keine italienische Aktie (beginnt nicht mit „IT“) – Italien ist dafür nicht zuständig.` : isinWarning ?? "Keine Dividendenabrechnung erkannt.",
        isin,
      });
      continue;
    }
    if (applyProfileHints(profile, result.profileHints)) profileChanged = true;

    const candidate = { ...result.distribution, sourceFile: file.name, distributionId: crypto.randomUUID() };
    if (isDuplicateDistribution(candidate, reclaimCase.distributions)) {
      issues.push({ kind: "rejected", fileName: file.name, reason: "Bereits in diesem Fall erfasst (gleiche ISIN, Zahltag und Betrag).", isin: candidate.isin });
      continue;
    }
    if (isDuplicateDistribution(candidate, otherDistributions)) {
      issues.push({ kind: "dupe", fileName: file.name, reason: "Gleiche ISIN, Zahltag und Betrag bereits in einem anderen Fall erfasst. Bitte prüfen, ob diese Abrechnung schon eingereicht wurde.", isin: candidate.isin });
      candidate.isDuplicateOfOtherCase = true;
    }
    reclaimCase.distributions.push(candidate);
  }

  if (profileChanged) {
    await profileRepo.put(profile);
    setState({ currentProfile: profile });
  }
  await saveCase(reclaimCase);
  render(container, reclaimCase);
}

function issuesHtml() {
  if (!issues.length) return "";
  const rejected = issues.filter((i) => i.kind === "rejected").length;
  return `
    <details class="issues-summary" open>
      <summary>
        <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        <span class="issues-icon">⚠</span>
        <span>${issues.length} Hinweis(e) zu Ihren Dateien</span>
        <span class="issues-sub">${rejected} nicht übernommen · ${issues.length - rejected} ggf. bereits beantragt</span>
      </summary>
      <div class="issues-body">
        ${issues.map((i) => `
          <div class="flag-item ${i.kind}">
            <span class="flag-icon">${i.kind === "dupe" ? "↺" : "✕"}</span>
            <div><div class="flag-file">${esc(i.fileName)}</div><div class="flag-reason">${esc(i.reason)}</div></div>
            <span class="flag-meta">${esc(i.isin)}</span>
          </div>`).join("")}
      </div>
    </details>`;
}

function rowHtml(d) {
  const c = classifyWithholding(d);
  const refundable = ["ok", "partial", "high"].includes(c.kind);
  const confirmed = d.extractionConfidence !== "extracted";
  const ratePill = { ok: "pill-ok", partial: "pill-warn", high: "pill-bad" }[c.kind] ?? "pill-grey";
  let badge;
  if (!refundable) badge = `<span class="badge badge-extracted">${c.kind === "expired" ? "verjährt" : c.kind === "invalid" ? "Werte fehlen" : "nichts zu erstatten"}</span>`;
  else if (d.isDuplicateOfOtherCase) badge = `<span class="badge badge-dupe">⚠ bereits beantragt?</span>`;
  else if (confirmed) badge = `<span class="badge badge-confirmed">bestätigt</span>`;
  else if (c.kind !== "ok") badge = `<span class="badge it-badge-warn">⚠ Satz prüfen</span>`;
  else badge = `<span class="badge badge-extracted">automatisch erkannt</span>`;

  const notes = [c.kind === "partial" && confirmed ? "Erstattet wird nur der tatsächliche Abzug über 15 %." : REASONS[c.kind]];
  if (c.rateMismatch) notes.push(`Ausgewiesen sind ${formatNumberDe(d.withholdingRatePercent, 0)} %, der Betrag entspricht aber ${percent(c.effectiveRate)} – maßgeblich ist der Betrag.`);
  const note = notes.filter(Boolean).map((n) => `<div class="it-row-note">${esc(n)}</div>`).join("");
  const cls = [!refundable && c.kind !== "invalid" ? "it-row-excluded" : "", refundable && !confirmed && c.kind !== "ok" ? "it-row-warn" : "", d.isDuplicateOfOtherCase ? "dupe-row" : ""].join(" ");

  return `
    <tr class="dist-row ${cls}" data-id="${d.distributionId}">
      <td><input type="checkbox" class="confirm-check row-check" ${confirmed && refundable ? "checked" : ""} ${refundable ? "" : "disabled"}></td>
      <td class="it-date-cell"><input class="editable mono date-input" data-field="paymentDate" value="${esc(formatDateDe(d.paymentDate))}">${note}</td>
      <td><input class="editable mono" data-field="shares" value="${esc(d.shares ?? "")}"></td>
      <td><input class="editable mono" data-field="grossDividend" value="${esc(formatNumberDe(d.grossDividend))}"></td>
      <td><input class="editable mono" data-field="withheldTax" value="${esc(formatNumberDe(d.withheldTax))}"></td>
      <td><span class="it-rate ${ratePill}">${percent(c.effectiveRate)}</span></td>
      <td class="refund-cell">${refundable ? formatNumberDe(refundFor(d).refund) : "–"}</td>
      <td>${badge}</td>
      <td><button class="icon-btn" data-action="remove-row" title="Entfernen" type="button">✕</button></td>
    </tr>`;
}

function sumRow(label, rows, cls) {
  const sum = (f) => formatNumberDe(rows.reduce((s, d) => s + (f(d) ?? 0), 0));
  const refundable = rows.filter((d) => ["ok", "partial", "high"].includes(classifyWithholding(d).kind));
  return `
    <tr class="${cls}">
      <td colspan="3">${esc(label)}</td>
      <td class="mono">${sum((d) => d.grossDividend)}</td>
      <td class="mono">${sum((d) => d.withheldTax)}</td>
      <td></td>
      <td class="mono">${formatNumberDe(totalRefund(refundable))}</td>
      <td colspan="2"></td>
    </tr>`;
}

function render(container, reclaimCase) {
  const distributions = reclaimCase.distributions;
  const groups = groupByIssuer(distributions);
  const refundable = distributions.filter((d) => ["ok", "partial", "high"].includes(classifyWithholding(d).kind));
  const eligible = distributions.filter((d) => isEligible(d));
  const formsByIsin = new Map(groups.map((g) => [g.isin, formsFor(g.distributions.filter((d) => isEligible(d))).length]));

  container.innerHTML = `
    ${stepHeader(reclaimCase, 2)}
    <p class="ch-lead">Laden Sie Ihre Dividendenabrechnungen italienischer Aktien hoch. DivRebound liest die relevanten Informationen aus und bereitet die Erstellung von Formularen vor.</p>

    <div class="dropzone" id="dropzone">
      <input type="file" id="file-input" multiple accept="application/pdf" hidden />
      <div class="dz-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 17v-6"/><path d="m9 14 3-3 3 3"/>
        </svg>
      </div>
      <div class="dz-main">Dividendenabrechnung(en) hochladen oder hierher ziehen</div>
      <div class="dz-sub">PDF · Mehrfachauswahl möglich · z.B. mehrere Jahre oder mehrere Aktien auf einmal</div>
    </div>

    ${issuesHtml()}

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Erfasste Ausschüttungen — Italien</span>
        <span class="count-pill pill-ok">${distributions.length} übernommen · ${groups.length} Unternehmen</span>
      </div>
      <div style="overflow-x:auto;">
      <table id="it-dist-table" style="min-width:820px;">
        <thead>
          <tr>
            <th style="width:28px;"><input type="checkbox" class="confirm-check" id="select-all" title="Alle auswählen/abwählen" ${refundable.length && eligible.length === refundable.length ? "checked" : ""}></th>
            <th>Zahltag</th>
            <th>Stück</th>
            <th><span class="th-tip">Brutto (EUR)<span class="th-tip-bubble">Die ausgeschüttete Dividende vor Abzug jeglicher Steuern.</span></span></th>
            <th><span class="th-tip">Quellensteuer (EUR)<span class="th-tip-bubble">Von Italien einbehaltene Steuer laut Abrechnung, im Regelfall 26 %.</span></span></th>
            <th><span class="th-tip">Satz<span class="th-tip-bubble">Tatsächlich einbehaltener Satz (Quellensteuer ÷ Brutto). Nach dem Doppelbesteuerungsabkommen dürfen es nur 15 % sein.</span></span></th>
            <th><span class="th-tip">Erstattbar (EUR)<span class="th-tip-bubble">Gezahlte Quellensteuer minus 15 % vom Brutto.</span></span></th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            distributions.length === 0
              ? `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">Noch keine Abrechnungen hochgeladen.</td></tr>`
              : groups
                  .map((g) => {
                    const n = formsByIsin.get(g.isin);
                    const formPill = n ? `<span class="it-form-pill">${n === 1 ? "1 Formular" : `${n} Formulare`}</span>` : "";
                    return `
            <tr class="year-row it-company-row"><td colspan="9">${esc(g.issuerName || g.isin)} <span class="mono it-isin">${esc(g.isin)}</span> ${formPill}</td></tr>
            ${g.distributions.map(rowHtml).join("")}
            ${sumRow(`Zwischensumme ${(g.issuerName || g.isin).replace(/\s*S\.p\.A\.?$/i, "")}`, g.distributions, "subtotal-row")}`;
                  })
                  .join("") + sumRow("Gesamt", distributions, "total-row")
          }
        </tbody>
      </table>
      </div>

      <div class="refund-banner ${eligible.length ? "" : "zero"}">
        <div>
          <div class="label">Voraussichtliche Erstattung (Schätzung)</div>
          <div class="amount-dkk">${formatNumberDe(totalRefund(eligible))} EUR</div>
        </div>
        <div class="formula">Quellensteuer − Brutto × 15% DBA</div>
      </div>
    </div>

    <details class="help-disclosure it-help">
      <summary>Wie DivRebound den Steuersatz prüft</summary>
      <div class="it-help-body">
        Italien behält auf Dividenden an Nicht-Ansässige im Regelfall <b>26 %</b> ein, nach dem Doppelbesteuerungsabkommen dürfen es nur <b>15 %</b> sein. DivRebound liest den Satz von der Abrechnung und rechnet zur Kontrolle Steuer ÷ Brutto nach.<br><br>
        <b>26 %:</b> Regelfall, wird übernommen.<br>
        <b>zwischen 15 % und 26 %:</b> z. B. Ausschüttung teilweise aus Kapitalrücklagen – Sie bestätigen die Zeile.<br>
        <b>15 % oder weniger:</b> nichts zu erstatten – kommt nicht ins Formular.<br><br>
        Erstattet wird immer <b>tatsächlich gezahlte Steuer − 15 % vom Brutto</b>. Frist: 48 Monate ab dem Steuerabzug.
      </div>
    </details>

    <div class="bottom-bar">
      <div class="progress-text"><b>${eligible.length}</b> von <b>${refundable.length}</b> Ausschüttungen bestätigt <span style="opacity:.75;">— nicht ausgewählte Ausschüttungen werden vorerst nicht eingereicht.</span></div>
      <button class="next-btn" id="next-btn" type="button" ${eligible.length ? "" : "disabled"}>Weiter →</button>
    </div>`;

  attachListeners(container, reclaimCase);
}

function attachListeners(container, reclaimCase) {
  const fileInput = container.querySelector("#file-input");
  fileInput.addEventListener("change", () => handleFiles(container, fileInput.files));
  const dropzone = container.querySelector("#dropzone");
  dropzone.addEventListener("click", () => fileInput.click());
  ["dragenter", "dragover"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
  dropzone.addEventListener("drop", (e) => handleFiles(container, e.dataTransfer.files));

  const byId = (row) => reclaimCase.distributions.find((x) => x.distributionId === row.dataset.id);

  container.querySelectorAll(".row-check").forEach((cb) =>
    cb.addEventListener("change", async () => {
      byId(cb.closest("tr")).extractionConfidence = cb.checked ? "user_confirmed" : "extracted";
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

  container.querySelector("#select-all").addEventListener("change", async (e) => {
    reclaimCase.distributions
      .filter((d) => ["ok", "partial", "high"].includes(classifyWithholding(d).kind))
      .forEach((d) => { d.extractionConfidence = e.target.checked ? "user_confirmed" : "extracted"; });
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });

  container.querySelectorAll(".dist-row").forEach((row) => {
    const d = byId(row);
    row.querySelectorAll("[data-field]").forEach((input) =>
      input.addEventListener("change", async () => {
        const field = input.dataset.field;
        if (field === "paymentDate") {
          const m = input.value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
          if (m) {
            d.paymentDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
            d.taxYear = Number(m[3]);
          }
        } else {
          const value = parseNumberDe(input.value);
          if (value !== null) d[field] = value;
          if (field !== "withheldTax" && d.grossDividend && d.shares) d.dividendPerShare = Math.round((d.grossDividend / d.shares) * 10000) / 10000;
        }
        // Korrigierte Werte gelten als bestätigt (wie Dänemark)
        d.extractionConfidence = "user_corrected";
        await saveCase(reclaimCase);
        render(container, reclaimCase);
      })
    );
    row.querySelector('[data-action="remove-row"]').addEventListener("click", async () => {
      reclaimCase.distributions = reclaimCase.distributions.filter((x) => x.distributionId !== d.distributionId);
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    });
  });

  container.querySelector("#next-btn").addEventListener("click", async () => {
    await markStepDone(reclaimCase, 2);
    goToStep(reclaimCase, 3);
  });
}

export function mount(container, reclaimCase) {
  issues = [];
  render(container, reclaimCase);
}
