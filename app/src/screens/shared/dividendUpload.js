// Gemeinsame Seite "Dividendenabrechnungen" für Dänemark und Italien: Upload,
// Hinweise zu den Dateien, Tabelle mit Auswahl und Status, Zwischensummen,
// Erstattungsbanner, "x von y bestätigt". Je Ausschüttung wird der tatsächlich
// einbehaltene Steuersatz eingestuft (lib/withholding.js); erstattet wird
// immer gezahlte Steuer − DBA-Satz × Brutto.
// Länderunterschiede kommen über die Optionen (Gruppierung, Währung, Spalten).

import { getState, setState } from "../../store/store.js";
import * as caseRepo from "../../db/caseRepo.js";
import * as profileRepo from "../../db/profileRepo.js";
import { parseDividendCertificate } from "../../lib/parseDividendCertificate.js";
import { classifyWithholding, refundFor, isEligible, totalRefund } from "../../lib/withholding.js";
import { isDuplicateDistribution } from "../../util/validate.js";
import { applyProfileHints } from "../../util/profileHints.js";
import { formatNumberDe, parseNumberDe, formatDateDe } from "../../util/format.js";

const REFUNDABLE = ["ok", "partial", "high"];

/**
 * @typedef {object} UploadOptions
 * @property {object} corridor - config/corridors.js
 * @property {string} headerHtml
 * @property {string} lead
 * @property {string} countryName - "Dänemark"
 * @property {string} shareAdjective - "dänische"
 * @property {"year"|"issuer"} groupBy
 * @property {(group: {key: string, label: string, distributions: object[]}, eligible: object[]) => string} [groupBadge]
 * @property {(total: number) => string} [bannerExtra] - z.B. "≈ 18,82 EUR"
 * @property {(reclaimCase: ReclaimCase) => Promise<void>} save
 * @property {() => void} onNext
 */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const pct = (rate) => {
  const v = Math.round(rate * 1000) / 10; // eine Nachkommastelle, ohne Rundungsrest (0,15 * 100 = 15,000…02)
  return `${formatNumberDe(v, v % 1 ? 1 : 0)} %`;
};

function reasons(corridor) {
  const std = pct(corridor.standardWithholdingRate);
  const treaty = pct(corridor.treatyRateByResidence.DE);
  const months = corridor.limitationPeriodYears * 12;
  return {
    none: `Höchstens ${treaty} Quellensteuer einbehalten. Es gibt keine Erstattung.`,
    expired: `Zahltag liegt mehr als ${months} Monate zurück. Die Frist für die Erstattung ist abgelaufen.`,
    partial: `Weniger als ${std} einbehalten (z. B. Ausschüttung teilweise aus Kapitalrücklagen). Erstattet wird nur der tatsächliche Abzug über ${treaty}. Bitte prüfen und bestätigen.`,
    partialConfirmed: `Erstattet wird nur der tatsächliche Abzug über ${treaty}.`,
    high: `Mehr als ${std} einbehalten – das ist ungewöhnlich. Bitte die Beträge mit der Abrechnung vergleichen. Erstattet werden höchstens ${pct(corridor.standardWithholdingRate - corridor.treatyRateByResidence.DE)} vom Brutto.`,
    invalid: `Bruttobetrag oder Quellensteuer in ${corridor.nativeCurrency} nicht erkannt. Bitte aus der Abrechnung eintragen.`,
  };
}

function groupsOf(distributions, groupBy) {
  const sorted = [...distributions].sort((a, b) => (a.paymentDate ?? "").localeCompare(b.paymentDate ?? ""));
  const map = new Map();
  for (const d of sorted) {
    const key = groupBy === "year" ? String(d.taxYear ?? d.paymentDate?.slice(0, 4) ?? "–") : d.isin;
    if (!map.has(key)) map.set(key, { key, label: groupBy === "year" ? `Steuerjahr ${key}` : d.issuerName || d.isin, isin: d.isin, distributions: [] });
    map.get(key).distributions.push(d);
  }
  return [...map.values()].sort((a, b) => (groupBy === "year" ? a.key.localeCompare(b.key) : 0));
}

/** Die Seite; gibt nichts zurück, alles Weitere über die Optionen */
export function mountDividendUpload(container, reclaimCase, options) {
  let issues = []; // [{ kind: 'rejected'|'dupe', fileName, reason, isin }]
  const { corridor } = options;
  const residence = () => getState().currentProfile?.residence?.country;
  const kindOf = (d) => classifyWithholding(d, corridor, { residenceCountry: residence() });
  const R = reasons(corridor);
  const showIssuer = options.groupBy === "year";

  async function handleFiles(fileList) {
    if (!fileList?.length) return;
    const profile = getState().currentProfile;
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
          reason: isin
            ? `ISIN „${isin}“ ist keine ${options.shareAdjective} Aktie (beginnt nicht mit „${corridor.isinPrefix}“) und wird nicht übernommen.`
            : isinWarning ?? "Keine Dividendenabrechnung erkannt.",
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
      // applicantSnapshot (bei Case-Anlage aus dem damals leeren Profil kopiert) nachziehen
      const snapshot = reclaimCase.applicantSnapshot;
      for (const field of ["firstName", "lastName", "address", "postalCode", "city"]) {
        if (snapshot && !snapshot[field] && profile.residence[field]) snapshot[field] = profile.residence[field];
      }
      await profileRepo.put(profile);
      setState({ currentProfile: profile });
    }
    await options.save(reclaimCase);
    render();
  }

  function issuesHtml() {
    if (!issues.length) return "";
    const rejected = issues.filter((i) => i.kind === "rejected").length;
    return `
      <details class="issues-summary" open>
        <summary>
          <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span class="issues-icon">⚠</span>
          <span>${issues.length} Hinweis(e) zu deinen Dateien</span>
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
    const c = kindOf(d);
    const refundable = REFUNDABLE.includes(c.kind);
    const confirmed = d.extractionConfidence !== "extracted";
    const ratePill = { ok: "pill-ok", partial: "pill-warn", high: "pill-bad" }[c.kind] ?? "pill-grey";
    let badge;
    if (!refundable) badge = `<span class="badge badge-extracted">${c.kind === "expired" ? "verjährt" : c.kind === "invalid" ? "Werte fehlen" : "nichts zu erstatten"}</span>`;
    else if (d.isDuplicateOfOtherCase) badge = `<span class="badge badge-dupe">⚠ bereits beantragt?</span>`;
    else if (confirmed) badge = `<span class="badge badge-confirmed">bestätigt</span>`;
    else if (c.kind !== "ok") badge = `<span class="badge du-badge-warn">⚠ Satz prüfen</span>`;
    else badge = `<span class="badge badge-extracted">automatisch erkannt</span>`;

    const notes = [c.kind === "partial" && confirmed ? R.partialConfirmed : R[c.kind]];
    if (c.rateMismatch) notes.push(`Ausgewiesen sind ${formatNumberDe(d.withholdingRatePercent, 0)} %, der Betrag entspricht aber ${pct(c.effectiveRate)} – maßgeblich ist der Betrag.`);
    const note = notes.filter(Boolean).map((n) => `<div class="du-row-note">${esc(n)}</div>`).join("");
    const cls = [!refundable && c.kind !== "invalid" ? "du-row-excluded" : "", refundable && !confirmed && c.kind !== "ok" ? "du-row-warn" : "", d.isDuplicateOfOtherCase ? "dupe-row" : ""].join(" ");

    return `
      <tr class="dist-row ${cls}" data-id="${d.distributionId}">
        <td><input type="checkbox" class="confirm-check row-check" ${confirmed && refundable ? "checked" : ""} ${refundable ? "" : "disabled"}></td>
        ${showIssuer ? `<td><div style="font-weight:600;">${esc(d.issuerName || "—")}</div><div class="mono" style="font-size:10.5px;color:var(--muted);">${esc(d.isin)}</div></td>` : ""}
        <td class="du-date-cell"><input class="editable mono date-input" data-field="paymentDate" value="${esc(formatDateDe(d.paymentDate))}">${note}</td>
        <td class="num"><input class="editable mono" data-field="shares" value="${esc(d.shares ?? "")}"></td>
        <td class="num"><input class="editable mono" data-field="grossDividend" value="${esc(formatNumberDe(d.grossDividend))}"></td>
        <td class="num"><input class="editable mono" data-field="withheldTax" value="${esc(formatNumberDe(d.withheldTax))}"></td>
        <td><span class="du-rate ${ratePill}">${c.effectiveRate === null ? "–" : pct(c.effectiveRate)}</span></td>
        <td class="num refund-cell">${refundable ? formatNumberDe(refundFor(d, corridor, residence()).refund) : "–"}</td>
        <td>${badge}</td>
        <td><button class="icon-btn" data-action="remove-row" title="Entfernen" type="button">✕</button></td>
      </tr>`;
  }

  function sumRow(label, rows, cls) {
    const sum = (f) => formatNumberDe(rows.reduce((s, d) => s + (f(d) ?? 0), 0));
    const refundable = rows.filter((d) => REFUNDABLE.includes(kindOf(d).kind));
    return `
      <tr class="${cls}">
        <td colspan="${showIssuer ? 4 : 3}">${esc(label)}</td>
        <td class="mono">${sum((d) => d.grossDividend)}</td>
        <td class="mono">${sum((d) => d.withheldTax)}</td>
        <td></td>
        <td class="mono">${formatNumberDe(totalRefund(refundable, corridor, residence()))}</td>
        <td colspan="2"></td>
      </tr>`;
  }

  function render() {
    const distributions = reclaimCase.distributions;
    const groups = groupsOf(distributions, options.groupBy);
    const refundable = distributions.filter((d) => REFUNDABLE.includes(kindOf(d).kind));
    const eligible = distributions.filter((d) => isEligible(d, corridor, { residenceCountry: residence() }));
    const total = totalRefund(eligible, corridor, residence());
    const cur = corridor.nativeCurrency;
    const cols = showIssuer ? 10 : 9;

    container.innerHTML = `
      ${options.headerHtml}
      <p class="ch-lead">${options.lead}</p>

      <div class="dropzone" id="dropzone">
        <input type="file" id="file-input" multiple accept="application/pdf" hidden />
        <div class="dz-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 17v-6"/><path d="m9 14 3-3 3 3"/>
          </svg>
        </div>
        <div class="dz-main">Dividendenabrechnung(en) hochladen oder hierher ziehen</div>
        <div class="dz-sub">PDF · Mehrfachauswahl möglich</div>
      </div>

      ${issuesHtml()}

      <div class="card">
        <div class="card-head head-navy">
          <span class="card-title">Erfasste Ausschüttungen — ${esc(options.countryName)}</span>
          <span class="count-pill pill-ok">${distributions.length} übernommen · ${groups.length} ${options.groupBy === "year" ? "Steuerjahr(e)" : "Unternehmen"}</span>
        </div>
        <div style="overflow-x:auto;">
        <table class="du-table" style="min-width:${showIssuer ? 900 : 820}px;">
          <thead>
            <tr>
              <th style="width:28px;"><input type="checkbox" class="confirm-check" id="select-all" title="Alle auswählen/abwählen" ${refundable.length && eligible.length === refundable.length ? "checked" : ""}></th>
              ${showIssuer ? "<th>ISIN / Emittent</th>" : ""}
              <th>Zahltag</th>
              <th class="num">Stück</th>
              <th class="num"><span class="th-tip">Brutto (${cur})<span class="th-tip-bubble">Die ausgeschüttete Dividende vor Abzug jeglicher Steuern.</span></span></th>
              <th class="num"><span class="th-tip">Quellensteuer (${cur})<span class="th-tip-bubble">Einbehaltene Steuer laut Abrechnung, im Regelfall ${pct(corridor.standardWithholdingRate)}.</span></span></th>
              <th><span class="th-tip">Satz<span class="th-tip-bubble">Tatsächlich einbehaltener Satz (Quellensteuer ÷ Brutto). Nach dem Doppelbesteuerungsabkommen dürfen es nur ${pct(corridor.treatyRateByResidence.DE)} sein.</span></span></th>
              <th class="num"><span class="th-tip">Erstattbar (${cur})<span class="th-tip-bubble">Gezahlte Quellensteuer minus ${pct(corridor.treatyRateByResidence.DE)} vom Brutto.</span></span></th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${
              distributions.length === 0
                ? `<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:24px;">Noch keine Abrechnungen hochgeladen.</td></tr>`
                : groups
                    .map((g) => {
                      const badge = options.groupBadge?.(g, g.distributions.filter((d) => isEligible(d, corridor, { residenceCountry: residence() }))) ?? "";
                      const isin = options.groupBy === "issuer" ? ` <span class="mono du-isin">${esc(g.isin)}</span>` : "";
                      return `
              <tr class="year-row du-group-row"><td colspan="${cols}">${esc(g.label)}${isin} ${badge}</td></tr>
              ${g.distributions.map(rowHtml).join("")}
              ${sumRow(`Zwischensumme ${g.label.replace(/^Steuerjahr /, "").replace(/\s*S\.p\.A\.?$/i, "")}`, g.distributions, "subtotal-row")}`;
                    })
                    .join("") + sumRow("Gesamt", distributions, "total-row")
            }
          </tbody>
        </table>
        </div>

        <div class="refund-banner ${eligible.length ? "" : "zero"}">
          <div>
            <div class="label">Voraussichtliche Erstattung (Schätzung)</div>
            <div class="amount-dkk">${formatNumberDe(total)} ${cur}</div>
            ${options.bannerExtra ? `<div class="amount-eur">${options.bannerExtra(total)}</div>` : ""}
          </div>
          <div class="formula">Quellensteuer − Brutto × ${pct(corridor.treatyRateByResidence.DE).replace(" ", "")} DBA</div>
        </div>
      </div>

      <details class="help-disclosure du-help">
        <summary>Wie DivRebound den Steuersatz prüft</summary>
        <div class="du-help-body">
          ${esc(options.countryName)} behält auf Dividenden an Nicht-Ansässige im Regelfall <b>${pct(corridor.standardWithholdingRate)}</b> ein, nach dem Doppelbesteuerungsabkommen dürfen es nur <b>${pct(corridor.treatyRateByResidence.DE)}</b> sein. DivRebound liest Steuer und Satz von der Abrechnung und rechnet zur Kontrolle Steuer ÷ Brutto nach.<br><br>
          <b>${pct(corridor.standardWithholdingRate)}:</b> Regelfall, wird übernommen.<br>
          <b>Zwischen ${pct(corridor.treatyRateByResidence.DE)} und ${pct(corridor.standardWithholdingRate)}:</b> z. B. Ausschüttung teilweise aus Kapitalrücklagen – du bestätigst die Zeile.<br>
          <b>${pct(corridor.treatyRateByResidence.DE)} oder weniger:</b> nichts zu erstatten – kommt nicht ins Formular.<br><br>
          Erstattet wird immer <b>tatsächlich gezahlte Steuer − ${pct(corridor.treatyRateByResidence.DE)} vom Brutto</b>. Frist: ${corridor.limitationPeriodYears * 12} Monate ab dem Steuerabzug.
        </div>
      </details>

      <div class="bottom-bar">
        <div class="progress-text"><b>${eligible.length}</b> von <b>${refundable.length}</b> Ausschüttungen bestätigt <span style="opacity:.75;">— nicht ausgewählte Ausschüttungen werden vorerst nicht eingereicht.</span></div>
        <button class="next-btn" id="next-btn" type="button" ${eligible.length ? "" : "disabled"}>Weiter →</button>
      </div>`;

    attachListeners();
  }

  function attachListeners() {
    const fileInput = container.querySelector("#file-input");
    fileInput.addEventListener("change", () => handleFiles(fileInput.files));
    const dropzone = container.querySelector("#dropzone");
    dropzone.addEventListener("click", () => fileInput.click());
    ["dragenter", "dragover"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
    dropzone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

    const byRow = (row) => reclaimCase.distributions.find((x) => x.distributionId === row.dataset.id);

    container.querySelectorAll(".row-check").forEach((cb) =>
      cb.addEventListener("change", async () => {
        byRow(cb.closest("tr")).extractionConfidence = cb.checked ? "user_confirmed" : "extracted";
        await options.save(reclaimCase);
        render();
      })
    );
    container.querySelector("#select-all").addEventListener("change", async (e) => {
      reclaimCase.distributions
        .filter((d) => REFUNDABLE.includes(kindOf(d).kind))
        .forEach((d) => { d.extractionConfidence = e.target.checked ? "user_confirmed" : "extracted"; });
      await options.save(reclaimCase);
      render();
    });

    container.querySelectorAll(".dist-row").forEach((row) => {
      const d = byRow(row);
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
          // Korrigierte Werte gelten als bestätigt
          d.extractionConfidence = "user_corrected";
          await options.save(reclaimCase);
          render();
        })
      );
      row.querySelector('[data-action="remove-row"]').addEventListener("click", async () => {
        reclaimCase.distributions = reclaimCase.distributions.filter((x) => x.distributionId !== d.distributionId);
        await options.save(reclaimCase);
        render();
      });
    });

    container.querySelector("#next-btn").addEventListener("click", () => options.onNext());
  }

  render();
}
