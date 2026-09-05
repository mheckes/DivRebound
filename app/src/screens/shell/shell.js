import { getState, setState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import * as profileRepo from "../../db/profileRepo.js";
import { parseDividendCertificate } from "../../lib/parseDividendCertificate.js";
import { corridors } from "../../config/corridors.js";
import { isinMatchesCorridor, isDuplicateDistribution } from "../../util/validate.js";
import { formatNumberDe, parseNumberDe, formatDateDe } from "../../util/format.js";

const APPROX_EUR_DKK_RATE = 7.46; // grobe Näherung, wie im Mockup - keine externe FX-Anbindung im MVP

let issues = []; // [{ kind: 'rejected'|'dupe', fileName, reason, isin }]

function refundAmount(distribution, corridor) {
  const gap = corridor.standardWithholdingRate - corridor.treatyRateByResidence.DE; // 27%-15%, länderunabhängig gleich im MVP
  return distribution.grossDividend * gap;
}
function withheldAmount(distribution, corridor) {
  return distribution.grossDividend * corridor.standardWithholdingRate;
}

function isConfirmed(d) {
  return d.extractionConfidence !== "extracted";
}

async function persistCase(reclaimCase) {
  await caseRepo.put(reclaimCase);
  const state = getState();
  setState({
    currentCase: reclaimCase,
    cases: state.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
  });
}

// Trägt Name/Adresse aus dem Adressblock der Abrechnung (profileHints) ins
// Profil ein - nur für Felder, die dort noch leer sind (nie ein vom Nutzer
// bereits gesetztes Feld überschreiben). Ohne das bliebe applicantSnapshot
// (bei Case-Anlage aus dem damals noch leeren Profil kopiert) dauerhaft leer,
// da es sonst nirgends im Wizard eine Gelegenheit gibt, Name/Adresse einzutragen.
function applyProfileHints(profile, hints) {
  if (!hints) return false;
  const map = {
    firstName: hints.firstName,
    lastName: hints.lastName,
    address: hints.address,
    postalCode: hints.postalCode,
    city: hints.city,
  };
  let changed = false;
  for (const [field, value] of Object.entries(map)) {
    if (value && !profile.residence[field]) {
      profile.residence[field] = value;
      changed = true;
    }
  }
  return changed;
}

async function handleFiles(container, fileList) {
  if (!fileList || fileList.length === 0) return;
  const state = getState();
  const reclaimCase = state.currentCase;
  const profile = state.currentProfile;
  const corridor = corridors.DK;
  let profileChanged = false;
  const otherCases = (await caseRepo.getByProfileId(state.currentProfile.profileId)).filter(
    (c) => c.caseId !== reclaimCase.caseId
  );
  const otherDistributions = otherCases.flatMap((c) => c.distributions);

  for (const file of Array.from(fileList)) {
    const bytes = await file.arrayBuffer();
    const result = await parseDividendCertificate(bytes, corridor);

    if (!result.isinValid || !result.distribution) {
      const isinWarning = result.warnings.find((w) => /ISIN/i.test(w));
      const isinMatch = isinWarning?.match(/"([A-Z0-9]+)"/);
      issues.push({
        kind: "rejected",
        fileName: file.name,
        reason: isinWarning ?? `ISIN entspricht nicht dem Korridor-Präfix "${corridor.isinPrefix}".`,
        isin: isinMatch?.[1] ?? "",
      });
      continue;
    }

    if (applyProfileHints(profile, result.profileHints)) profileChanged = true;

    const candidate = { ...result.distribution, sourceFile: file.name, distributionId: crypto.randomUUID() };

    if (isDuplicateDistribution(candidate, reclaimCase.distributions)) {
      issues.push({
        kind: "rejected",
        fileName: file.name,
        reason: "Bereits in diesem Fall erfasst (gleiche ISIN, Zahltag und Betrag).",
        isin: candidate.isin,
      });
      continue;
    }

    if (isDuplicateDistribution(candidate, otherDistributions)) {
      issues.push({
        kind: "dupe",
        fileName: file.name,
        reason:
          "Gleiche ISIN, Zahltag und Betrag bereits in einem anderen Fall erfasst. Bitte prüfen, ob diese Abrechnung schon eingereicht wurde.",
        isin: candidate.isin,
      });
      candidate.isDuplicateOfOtherCase = true;
    }

    reclaimCase.distributions.push(candidate);
  }

  if (profileChanged) {
    // applicantSnapshot wurde bei Case-Anlage aus dem damals leeren Profil
    // kopiert (siehe caseRepo.createCase) - für noch leere Snapshot-Felder
    // jetzt mit den frisch erkannten Werten nachziehen, sonst bliebe z.B.
    // das Cheat Sheet (Schritt 2) dauerhaft ohne Namen/Adresse.
    const snapshot = reclaimCase.applicantSnapshot;
    for (const field of ["firstName", "lastName", "address", "postalCode", "city"]) {
      if (!snapshot[field] && profile.residence[field]) snapshot[field] = profile.residence[field];
    }
    await profileRepo.put(profile);
    setState({ currentProfile: profile });
  }

  await persistCase(reclaimCase);
  render(container);
}

function recomputeRow(container, row, distribution, corridor) {
  const withheld = withheldAmount(distribution, corridor);
  const refund = refundAmount(distribution, corridor);
  row.querySelector(".withheld-cell").textContent = formatNumberDe(withheld);
  row.querySelector(".refund-cell-val").textContent = formatNumberDe(refund);
}

function groupByYear(distributions) {
  const years = [...new Set(distributions.map((d) => d.taxYear))].sort();
  return years.map((year) => ({ year, rows: distributions.filter((d) => d.taxYear === year) }));
}

function render(container) {
  const state = getState();
  const reclaimCase = state.currentCase;
  const corridor = corridors.DK;
  const distributions = reclaimCase.distributions;
  const groups = groupByYear(distributions);

  const rejectedIssues = issues.filter((i) => i.kind === "rejected");
  const dupeIssues = issues.filter((i) => i.kind === "dupe");

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Positions-/Jahresübersicht</h1>
      <div class="content-breadcrumb">Dänemark <b>›</b> ${new Date(reclaimCase.createdAt).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })} <b>›</b> Schritt 1</div>
    </div>

    <div class="dropzone" id="dropzone">
      <input type="file" id="file-input" multiple accept="application/pdf" hidden />
      <div class="dz-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <path d="M14 2v6h6"/>
          <path d="M12 17v-6"/>
          <path d="m9 14 3-3 3 3"/>
        </svg>
      </div>
      <div class="dz-main">Dividendenabrechnung(en) hochladen oder hierher ziehen</div>
      <div class="dz-sub">PDF · Mehrfachauswahl möglich · z.B. mehrere Jahre oder mehrere Aktien auf einmal</div>
    </div>

    ${
      issues.length > 0
        ? `
    <details class="issues-summary" open>
      <summary>
        <svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        <span class="issues-icon">⚠</span>
        <span>${issues.length} Hinweis(e) zu Ihren Dateien</span>
        <span class="issues-sub">${rejectedIssues.length} nicht übernommen · ${dupeIssues.length} ggf. bereits beantragt</span>
      </summary>
      <div class="issues-body">
        ${issues
          .map(
            (i) => `
          <div class="flag-item ${i.kind}">
            <span class="flag-icon">${i.kind === "dupe" ? "↺" : "✕"}</span>
            <div>
              <div class="flag-file">${i.fileName}</div>
              <div class="flag-reason">${i.reason}</div>
            </div>
            <span class="flag-meta">${i.isin}</span>
          </div>`
          )
          .join("")}
      </div>
    </details>`
        : ""
    }

    <div class="card">
      <div class="card-head head-navy">
        <span class="card-title">Erfasste Ausschüttungen — Dänemark</span>
        <span class="count-pill pill-ok">${distributions.length} übernommen · ${groups.length} Steuerjahr(e)</span>
      </div>
      <div style="overflow-x:auto;">
      <table id="dist-table" style="min-width:920px;">
        <thead>
          <tr>
            <th style="width:28px;"><input type="checkbox" class="confirm-check" id="select-all" title="Alle auswählen/abwählen"></th>
            <th>ISIN / Emittent</th>
            <th>Zahltag</th>
            <th>Stück</th>
            <th><span class="th-tip">Dividende brutto (DKK)<span class="th-tip-bubble">Die ausgeschüttete Dividende in dänischen Kronen, vor Abzug jeglicher Steuern.</span></span></th>
            <th><span class="th-tip">Quellensteuer (DKK)<span class="th-tip-bubble">27&nbsp;% dänische Quellensteuer, berechnet aus dem Bruttobetrag.</span></span></th>
            <th><span class="th-tip">Erstattbar (DKK)<span class="th-tip-bubble">Differenz zwischen einbehaltener Quellensteuer (27&nbsp;%) und dem zulässigen Steuersatz (15&nbsp;%) laut DBA.</span></span></th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            distributions.length === 0
              ? `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:24px;">Noch keine Abrechnungen hochgeladen.</td></tr>`
              : groups
                  .map(
                    (g) => `
            <tr class="year-row"><td colspan="9">Steuerjahr ${g.year}</td></tr>
            ${g.rows
              .map((d) => {
                const withheld = withheldAmount(d, corridor);
                const refund = refundAmount(d, corridor);
                const confirmed = isConfirmed(d);
                const dupe = d.isDuplicateOfOtherCase;
                return `
              <tr class="dist-row ${dupe ? "dupe-row" : ""}" data-id="${d.distributionId}">
                <td><input type="checkbox" class="confirm-check row-check" ${confirmed ? "checked" : ""}></td>
                <td><div style="font-weight:600;">${d.issuerName || "—"}</div><div class="mono" style="font-size:10.5px;color:var(--muted);">${d.isin}</div></td>
                <td><input class="editable mono date-input" data-field="paymentDate" value="${formatDateDe(d.paymentDate)}"></td>
                <td><input class="editable mono" data-field="shares" value="${d.shares ?? ""}"></td>
                <td><input class="editable mono gross-input" data-field="grossDividend" value="${formatNumberDe(d.grossDividend)}"></td>
                <td class="computed-cell withheld-cell">${formatNumberDe(withheld)}</td>
                <td class="refund-cell refund-cell-val">${formatNumberDe(refund)}</td>
                <td>
                  <span class="badge ${dupe ? "badge-dupe" : confirmed ? "badge-confirmed" : "badge-extracted"}">
                    ${dupe ? "⚠ bereits beantragt?" : confirmed ? "bestätigt" : "automatisch erkannt"}
                  </span>
                </td>
                <td><button class="icon-btn" data-action="remove-row" title="Entfernen">✕</button></td>
              </tr>`;
              })
              .join("")}
            <tr class="subtotal-row">
              <td colspan="4">Zwischensumme ${g.year}</td>
              <td class="mono">${formatNumberDe(g.rows.reduce((s, d) => s + d.grossDividend, 0))}</td>
              <td class="mono">${formatNumberDe(g.rows.reduce((s, d) => s + withheldAmount(d, corridor), 0))}</td>
              <td class="mono">${formatNumberDe(g.rows.reduce((s, d) => s + refundAmount(d, corridor), 0))}</td>
              <td colspan="2"></td>
            </tr>`
                  )
                  .join("")
          }
          ${
            distributions.length > 0
              ? `
          <tr class="total-row">
            <td colspan="4">Gesamt</td>
            <td class="mono">${formatNumberDe(distributions.reduce((s, d) => s + d.grossDividend, 0))}</td>
            <td class="mono">${formatNumberDe(distributions.reduce((s, d) => s + withheldAmount(d, corridor), 0))}</td>
            <td class="mono">${formatNumberDe(distributions.reduce((s, d) => s + refundAmount(d, corridor), 0))}</td>
            <td colspan="2"></td>
          </tr>`
              : ""
          }
        </tbody>
      </table>
      </div>

      <div class="refund-banner ${distributions.some(isConfirmed) ? "" : "zero"}" id="refund-banner">
        <div>
          <div class="label">Voraussichtliche Erstattung (Schätzung)</div>
          <div class="amount-dkk"><span id="refund-dkk">${formatNumberDe(
            distributions.filter(isConfirmed).reduce((s, d) => s + refundAmount(d, corridor), 0)
          )}</span> DKK</div>
          <div class="amount-eur">≈ <span id="refund-eur">${formatNumberDe(
            distributions.filter(isConfirmed).reduce((s, d) => s + refundAmount(d, corridor), 0) / APPROX_EUR_DKK_RATE
          )}</span> EUR</div>
        </div>
        <div class="formula">Brutto × (27% − 15% DBA)</div>
      </div>
    </div>

    <div class="bottom-bar">
      <div class="progress-text"><b>${distributions.filter(isConfirmed).length}</b> von <b>${distributions.length}</b> Ausschüttungen bestätigt <span style="opacity:.75;">— nicht ausgewählte Ausschüttungen werden vorerst nicht eingereicht.</span></div>
      <button class="next-btn" id="next-btn" ${distributions.filter(isConfirmed).length < 1 ? "disabled" : ""}>Weiter →</button>
    </div>
  `;

  attachListeners(container, reclaimCase, corridor);
}

function attachListeners(container, reclaimCase, corridor) {
  const fileInput = container.querySelector("#file-input");
  fileInput.addEventListener("change", () => handleFiles(container, fileInput.files));

  const dropzone = container.querySelector("#dropzone");
  dropzone.addEventListener("click", () => fileInput.click());
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => handleFiles(container, e.dataTransfer.files));

  container.querySelectorAll(".row-check").forEach((cb) => {
    cb.addEventListener("change", async () => {
      const row = cb.closest("tr");
      const d = reclaimCase.distributions.find((x) => x.distributionId === row.dataset.id);
      d.extractionConfidence = cb.checked ? "user_confirmed" : "extracted";
      await persistCase(reclaimCase);
      render(container);
    });
  });

  const selectAll = container.querySelector("#select-all");
  if (selectAll) {
    selectAll.addEventListener("change", async () => {
      reclaimCase.distributions.forEach((d) => {
        d.extractionConfidence = selectAll.checked ? "user_confirmed" : "extracted";
      });
      await persistCase(reclaimCase);
      render(container);
    });
  }

  container.querySelectorAll(".dist-row").forEach((row) => {
    const d = reclaimCase.distributions.find((x) => x.distributionId === row.dataset.id);
    row.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", async () => {
        const field = input.dataset.field;
        if (field === "grossDividend") d.grossDividend = parseNumberDe(input.value) ?? d.grossDividend;
        if (field === "shares") d.shares = parseNumberDe(input.value) ?? d.shares;
        if (field === "paymentDate") {
          const m = input.value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
          if (m) {
            d.paymentDate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
            d.taxYear = Number(m[3]);
          }
        }
        d.extractionConfidence = "user_corrected";
        await persistCase(reclaimCase);
        render(container);
      });
    });

    row.querySelector('[data-action="remove-row"]').addEventListener("click", async () => {
      reclaimCase.distributions = reclaimCase.distributions.filter((x) => x.distributionId !== d.distributionId);
      await persistCase(reclaimCase);
      render(container);
    });
  });

  const nextBtn = container.querySelector("#next-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      navigate(`#/dk/${reclaimCase.caseId}/step1/missing-data`);
    });
  }
}

export function mount(container) {
  issues = [];
  render(container);
}
