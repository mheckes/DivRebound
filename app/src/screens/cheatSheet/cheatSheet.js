// Schritt 2 · Cheat Sheet - seitengetreue Übertragungshilfe für die 6 echten
// SKAT-Formularseiten (siehe Mock Up Status 08-2026/divrebound_cheatsheet_v3_mockup.html).
// Der Nutzer hat das echte SKAT-Formular in einem zweiten Browser-Tab offen
// und überträgt Feld für Feld von hier - deshalb ist die Feldreihenfolge
// bewusst 1:1 aus dem Mockup übernommen (skatFieldMap.js), nicht neu sortiert.
//
// Architektur dieses Screens: EIN großes render(), das den kompletten
// Content-Bereich neu aufbaut (Tab-/Chunk-Wechsel, Mount, "eingereicht"-
// Toggle). Einzelne Checkbox-/Kopier-Interaktionen manipulieren danach das
// DOM gezielt (statt komplett neu zu rendern), weil der Mockup dafür ein
// sichtbares Kurz-Feedback vorsieht (Kopier-Häkchen-Flash, Zeilen-Highlight) -
// das würde ein voller Re-Render mitten in der Animation zerstören.

import { getState, setState } from "../../store/store.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { buildSubmissionChunks } from "../../util/chunking.js";
import { openExportOptionsModal } from "../../components/modal.js";
import { exportEncrypted, exportPlain, triggerJsonDownload } from "../../crypto/exportImport.js";
import { skatTabs, buildSharePages, shareHelpNote } from "./skatFieldMap.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function chevronSvg() {
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
}

function infoSvg() {
  return `<svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
}

// Rein dekorative, abstrahierte Skizze eines Browserfensters für den frei
// bleibenden Bereich rechts neben der (bewusst auf 600px begrenzten, siehe
// cheatSheet.css) Tabelle - visualisiert nur die Idee "hier daneben öffnest
// du das echte SKAT-Formular", ohne das tatsächliche SKAT-Layout/-Branding
// nachzubilden (fremde Behördenseite, kein Grund, deren Design zu kopieren).
// Wird auf schmalen Bildschirmen per CSS ausgeblendet (siehe .cheat-illustration).
function browserMockHtml() {
  return `
    <div class="cheat-illustration" aria-hidden="true">
      <div class="browser-mock">
        <div class="browser-mock-bar">
          <span class="browser-mock-dot"></span>
          <span class="browser-mock-dot"></span>
          <span class="browser-mock-dot"></span>
          <div class="browser-mock-url"></div>
        </div>
        <div class="browser-mock-body">
          <div class="browser-mock-line browser-mock-title"></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-field-row"><div class="browser-mock-line browser-mock-label"></div><div class="browser-mock-box"></div></div>
          <div class="browser-mock-btn"></div>
        </div>
      </div>
      <div class="cheat-illustration-caption">Das echte SKAT-Formular öffnen Sie am besten hier daneben in einem zweiten Fenster.</div>
    </div>`;
}

function formatCaseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function mount(container, params) {
  const state = getState();
  const profile = state.currentProfile;
  const reclaimCase = state.currentCase;

  if (!profile || !reclaimCase || reclaimCase.caseId !== params.caseId) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Cheat Sheet</h1></div>
      <p class="field-hint">Kein Fall geladen.</p>
    `;
    return;
  }

  // Seite 3 wiederholt sich pro Distribution - ohne mindestens eine erfasste
  // Ausschüttung gäbe es 0 SubmissionChunks und damit keinen aktiven Chunk.
  // Regulär nicht erreichbar (Schritt 1 muss vorher mind. eine Distribution
  // liefern), aber defensiv abfangen statt hart abzustürzen.
  if (!reclaimCase.distributions || reclaimCase.distributions.length === 0) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Cheat Sheet</h1></div>
      <p class="field-hint">Für diesen Fall sind noch keine Ausschüttungen erfasst - bitte zuerst Schritt 1 abschließen.</p>
    `;
    return;
  }

  const corridor = corridors[reclaimCase.targetCountry] ?? corridors.DK;

  let activeChunkIndex = 0;
  let activeTabId = "p1";

  function activeChunk() {
    return reclaimCase.submissionChunks[activeChunkIndex];
  }

  function chunkDistributions() {
    const chunk = activeChunk();
    return chunk.distributionIds
      .map((id) => reclaimCase.distributions.find((d) => d.distributionId === id))
      .filter(Boolean);
  }

  /** skatTabs mit dynamisch befüllter Seite 3 (eine Zeilengruppe pro Distribution im aktiven Chunk). */
  function resolvedTabs() {
    const sharePages = buildSharePages(chunkDistributions(), corridor, profile.residence.country);
    return skatTabs.map((tab) => {
      if (!tab.dynamic) return tab;
      return { ...tab, sharePages, rows: sharePages.flatMap((sp) => sp.rows) };
    });
  }

  function setTicked(chunk, rowId, checked) {
    const list = chunk.tickedRowIds ?? (chunk.tickedRowIds = []);
    if (checked) {
      if (!list.includes(rowId)) list.push(rowId);
    } else {
      chunk.tickedRowIds = list.filter((id) => id !== rowId);
    }
  }

  function persist() {
    caseRepo.put(reclaimCase).catch(() => {});
  }

  // copyValue wird bewusst NICHT hier verwendet, sondern erst beim Klick auf
  // den Kopier-Button per row.resolve(...) neu aufgelöst (siehe onCopyClick) -
  // so bleibt renderRowHtml eine reine Anzeigefunktion.
  function renderRowHtml(row, tickedIds) {
    const { display, assumption } = row.resolve(profile, reclaimCase, corridor);
    const checked = tickedIds.includes(row.id);
    const valueClass = assumption ? "row-value assumption" : "row-value";
    const actionBtn = row.isDownload
      ? `<button class="copy-btn" data-action="download" data-row-id="${row.id}" title="Download">⬇</button>`
      : `<button class="copy-btn" data-action="copy" data-row-id="${row.id}">⧉</button>`;
    return `
      <div class="row" data-row-id="${row.id}">
        <input type="checkbox" data-row-id="${row.id}" ${checked ? "checked" : ""} />
        <div class="row-label">${escapeHtml(row.labelEn)}<span class="en">${escapeHtml(row.hint)}</span></div>
        <div class="${valueClass}">${escapeHtml(display)}</div>
        ${actionBtn}
      </div>`;
  }

  function renderRowsHtml(rows, tickedIds) {
    return rows
      .map((row) => {
        const rowHtml = renderRowHtml(row, tickedIds);
        if (!row.group) return rowHtml;
        const visible = tickedIds.includes(row.group);
        return `<div class="cond-group" data-group="${row.group}" style="display:${visible ? "block" : "none"}">${rowHtml}</div>`;
      })
      .join("");
  }

  function renderHelpNote(note) {
    if (!note) return "";
    return `
      <div style="padding:14px 18px;">
        <details class="help-disclosure" style="margin-bottom:0;">
          <summary>${chevronSvg()} ${infoSvg()} ${escapeHtml(note.title)}</summary>
          <div class="help-disclosure-body">
            <ul class="help-list">
              ${note.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        </details>
      </div>`;
  }

  function renderPage3Body(tabDef) {
    const sharePages = tabDef.sharePages ?? [];
    const blocks = sharePages
      .map((sp) => {
        const rowsHtml = sp.rows.map((row) => renderRowHtml(row, activeChunk().tickedRowIds ?? [])).join("");
        return `
          <div class="share-block-head">${escapeHtml(sp.headLabel)}</div>
          ${rowsHtml}
          <div class="plausibility-check">
            <div class="pc-label">🔍 Plausibilitäts-Check "Amount of refund" <span class="en">wird von SKAT automatisch berechnet, nicht von uns eingetragen</span></div>
            <div class="pc-row">
              <span>Unsere Schätzung: <b>${sp.plausibilityEstimate.toFixed(2)} DKK</b></span>
              <span>SKAT zeigt: <input type="text" class="pc-input" data-pc="${sp.distributionId}" placeholder="DKK"></span>
              <span class="pc-result" data-pc-result="${sp.distributionId}"></span>
            </div>
          </div>`;
      })
      .join("");
    return blocks + renderHelpNote(shareHelpNote);
  }

  function renderSummaryBody() {
    const isDone = reclaimCase.status === "submitted";
    return `
      <div class="summary-check-list">
        <div class="summary-check-item"><span>✓</span> Name, Adresse, TIN korrekt?</div>
        <div class="summary-check-item"><span>✓</span> Jede Ausschüttung: ISIN, Datum, Betrag, Beleg vollständig?</div>
        <div class="summary-check-item"><span>✓</span> Wohnsitzbescheinigung angehängt?</div>
        <div class="summary-check-item"><span>✓</span> IBAN/BIC korrekt?</div>
      </div>
      <div class="done-banner">
        <div class="done-icon">✓</div>
        <div>
          <div class="done-title">Geschafft!</div>
          <div class="done-sub">Ihr Antrag ist vollständig ausgefüllt. Jetzt bei SKAT ausdrucken oder als PDF speichern, dann auf "Send" klicken.</div>
        </div>
      </div>
      <div class="done-actions">
        <button class="done-btn ${isDone ? "is-done" : ""}" data-action="mark-done" ${isDone ? "disabled" : ""}>${
      isDone ? "✓ Eingereicht" : "Als eingereicht markieren"
    }</button>
        <button class="save-history-btn" data-action="save-history" ${isDone ? "" : "disabled"} title="${
      isDone ? "" : "Erst verfügbar, sobald der Fall als eingereicht markiert ist"
    }">💾 Bearbeitungsstand speichern</button>
      </div>`;
  }

  function renderPaneBody(tabDef, tickedIds) {
    if (tabDef.summary) return renderSummaryBody();
    if (tabDef.dynamic) return renderPage3Body(tabDef);
    const rowsHtml = renderRowsHtml(tabDef.rows, tickedIds);
    const noteHtml = tabDef.helpNote ? renderHelpNote(tabDef.helpNote) : "";
    return rowsHtml + noteHtml;
  }

  function renderChunkSelector(chunks) {
    return `<div class="chunk-tabs">${chunks
      .map((c, i) => {
        const activeClass = i === activeChunkIndex ? " active" : "";
        const statusLabel = c.status === "submitted" ? "eingereicht" : "offen";
        const pillClass = c.status === "submitted" ? "pill-ok" : "pill-dupe";
        return `<div class="chunk-tab${activeClass}" data-chunk-idx="${i}">
          <span>Antrag ${c.chunkIndex} von ${chunks.length}</span>
          <span class="count-pill ${pillClass}">${c.distributionIds.length} · ${statusLabel}</span>
        </div>`;
      })
      .join("")}</div>`;
  }

  function updateProgressUI(tabs, chunk) {
    const allRowIds = new Set();
    tabs.forEach((t) => t.rows.forEach((r) => allRowIds.add(r.id)));
    const total = allRowIds.size;
    const tickedIds = chunk.tickedRowIds ?? [];
    const done = tickedIds.filter((id) => allRowIds.has(id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const label = container.querySelector(".progress-wrap span");
    if (label) label.textContent = `${done} von ${total} übertragen`;
    const fill = container.querySelector(".progress-fill");
    if (fill) fill.style.width = pct + "%";

    container.querySelectorAll(".page-tab").forEach((tabEl) => {
      const tabDef = tabs.find((t) => t.id === tabEl.dataset.tab);
      if (!tabDef) return;
      const tabDone = tabDef.rows.length > 0 && tabDef.rows.every((r) => tickedIds.includes(r.id));
      const mark = tabEl.querySelector(".done-mark");
      if (tabDone && !mark) {
        tabEl.insertAdjacentHTML("beforeend", ' <span class="done-mark">✓</span>');
      } else if (!tabDone && mark) {
        mark.remove();
      }
    });
  }

  function flashCopied(btn) {
    const original = btn.textContent;
    btn.textContent = "✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 900);
  }

  function onCheckboxChange(checkbox, row, tabs, chunk) {
    const checked = checkbox.checked;
    setTicked(chunk, row.id, checked);
    persist();
    if (row.reveals) {
      container.querySelectorAll(`[data-group="${row.id}"]`).forEach((el) => {
        el.style.display = checked ? "block" : "none";
      });
    }
    updateProgressUI(tabs, chunk);
  }

  function onCopyClick(btn, row, tabs, chunk) {
    const { copyValue } = row.resolve(profile, reclaimCase, corridor);
    if (navigator.clipboard) navigator.clipboard.writeText(copyValue ?? "").catch(() => {});
    flashCopied(btn);

    const rowEl = btn.closest(".row");
    container.querySelectorAll(".row.active-match").forEach((r) => r.classList.remove("active-match"));
    rowEl.classList.add("active-match");
    setTimeout(() => rowEl.classList.remove("active-match"), 1200);

    const checkbox = rowEl.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
      onCheckboxChange(checkbox, row, tabs, chunk);
    }
  }

  function onDownloadClick(btn, row, tabs, chunk) {
    flashCopied(btn);
    const rowEl = btn.closest(".row");
    const checkbox = rowEl.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
      onCheckboxChange(checkbox, row, tabs, chunk);
    }
  }

  async function onMarkDone() {
    if (reclaimCase.status === "submitted") return;
    reclaimCase.status = "submitted";
    await caseRepo.put(reclaimCase);
    const s = getState();
    setState({
      currentCase: reclaimCase,
      cases: s.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
    });
    render();
  }

  async function onSaveHistory() {
    if (reclaimCase.status !== "submitted") return;
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const payload = { investorProfiles: [profile], reclaimCases: [reclaimCase] };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    const lastName = profile.residence.lastName || "divrebound";
    triggerJsonDownload(fileJson, `DivRebound_${reclaimCase.targetCountry}_${lastName}_eingereicht.divrebound.json`);
  }

  function render() {
    const tabs = resolvedTabs();
    const chunk = activeChunk();
    const chunks = reclaimCase.submissionChunks;
    const tickedIds = chunk.tickedRowIds ?? [];

    const rowsById = new Map();
    tabs.forEach((t) => t.rows.forEach((r) => rowsById.set(r.id, r)));

    const allRowIds = new Set(rowsById.keys());
    const total = allRowIds.size;
    const done = tickedIds.filter((id) => allRowIds.has(id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const caseLabel = formatCaseLabel(reclaimCase);
    const chunkSelectorHtml = chunks.length > 1 ? renderChunkSelector(chunks) : "";

    const tabsHtml = tabs
      .map((t) => {
        const tabDone = t.rows.length > 0 && t.rows.every((r) => tickedIds.includes(r.id));
        const activeClass = t.id === activeTabId ? " active" : "";
        return `<div class="page-tab${activeClass}" data-tab="${t.id}">${escapeHtml(t.label)}${
          tabDone ? ' <span class="done-mark">✓</span>' : ""
        }</div>`;
      })
      .join("");

    const activeTabDef = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
    const paneBodyHtml = renderPaneBody(activeTabDef, tickedIds);
    const activeTabIndex = tabs.findIndex((t) => t.id === activeTabDef.id);
    const isFirstTab = activeTabIndex <= 0;
    const isLastTab = activeTabIndex >= tabs.length - 1;

    container.innerHTML = `
      <div class="content-header">
        <div>
          <h1 class="content-title">Cheat Sheet</h1>
          <div class="content-breadcrumb">Dänemark <b>›</b> ${escapeHtml(caseLabel)} <b>›</b> Schritt 2</div>
        </div>
        <div class="progress-wrap">
          <span>${done} von ${total} übertragen</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      </div>

      <div class="cheat-layout-row">
        <div class="cheat-main">
          <details class="help-disclosure cheat-help-disclosure">
            <summary>${chevronSvg()} ${infoSvg()} Wie diese Seite funktioniert</summary>
            <div class="help-disclosure-body">
              <p>Das Cheat Sheet ist eine Hilfestellung zum Ausfüllen des offiziellen SKAT-Formulars. Übertragen Sie die Einträge in den Tab mit dem geöffneten SKAT-Formular. Die Reihenfolge der Felder entspricht 1:1 dem SKAT-Formular. <a href="${
                corridor.onlinePortalUrl
              }" target="_blank" rel="noopener">Formular nicht mehr offen? Erneut öffnen ↗</a></p>
              <p><b>Bitte beachten:</b> Das Formular hat mehrere Seiten — bitte dort auf "Next" klicken und hier ebenfalls zur nächsten Seite weiterklicken.</p>
            </div>
          </details>

          ${chunkSelectorHtml}

          <div class="page-tabs">${tabsHtml}</div>

          <div class="layout">
            <div class="pane pane-left">
              <div class="pane-head">
                <span class="pane-title">${escapeHtml(activeTabDef.title)}</span>
                <span style="font-size:10px;color:rgba(255,255,255,.6);">von DivRebound erzeugt</span>
              </div>
              <div class="page-section active">${paneBodyHtml}</div>
            </div>
          </div>

          <div class="cheat-bottom-bar">
            <button class="btn-secondary" id="prev-tab-btn" type="button" ${isFirstTab ? "disabled" : ""}>← Zurück</button>
            <button class="btn-primary" id="next-tab-btn" type="button" ${isLastTab ? "disabled" : ""}>Weiter →</button>
          </div>
        </div>

        ${browserMockHtml()}
      </div>
    `;

    container.querySelectorAll('input[type="checkbox"][data-row-id]').forEach((cb) => {
      cb.addEventListener("change", () => {
        const row = rowsById.get(cb.dataset.rowId);
        if (row) onCheckboxChange(cb, row, tabs, chunk);
      });
    });
    container.querySelectorAll('.copy-btn[data-action="copy"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = rowsById.get(btn.dataset.rowId);
        if (row) onCopyClick(btn, row, tabs, chunk);
      });
    });
    container.querySelectorAll('.copy-btn[data-action="download"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = rowsById.get(btn.dataset.rowId);
        if (row) onDownloadClick(btn, row, tabs, chunk);
      });
    });
    container.querySelectorAll(".page-tab").forEach((el) => {
      el.addEventListener("click", () => {
        activeTabId = el.dataset.tab;
        render();
      });
    });
    container.querySelectorAll(".chunk-tab").forEach((el) => {
      el.addEventListener("click", () => {
        activeChunkIndex = Number(el.dataset.chunkIdx);
        activeTabId = "p1";
        render();
      });
    });

    container.querySelector("#prev-tab-btn").addEventListener("click", () => {
      if (activeTabIndex > 0) {
        activeTabId = tabs[activeTabIndex - 1].id;
        render();
      }
    });
    container.querySelector("#next-tab-btn").addEventListener("click", () => {
      if (activeTabIndex < tabs.length - 1) {
        activeTabId = tabs[activeTabIndex + 1].id;
        render();
      }
    });

    if (activeTabDef.dynamic) {
      const sharePagesById = new Map((activeTabDef.sharePages ?? []).map((sp) => [sp.distributionId, sp]));
      container.querySelectorAll(".pc-input").forEach((input) => {
        input.addEventListener("input", () => {
          const sp = sharePagesById.get(input.dataset.pc);
          const result = container.querySelector(`.pc-result[data-pc-result="${input.dataset.pc}"]`);
          if (!sp || !result) return;
          const skatValue = parseFloat(input.value.replace(",", "."));
          if (Number.isNaN(skatValue) || input.value === "") {
            result.textContent = "";
            result.className = "pc-result";
            return;
          }
          const diff = Math.abs(skatValue - sp.plausibilityEstimate);
          if (diff <= 1) {
            result.textContent = "✓ stimmt überein";
            result.className = "pc-result pc-ok";
          } else {
            result.textContent = `⚠ weicht um ${diff.toFixed(2)} DKK ab`;
            result.className = "pc-result pc-warn";
          }
        });
      });
    }

    const markBtn = container.querySelector('[data-action="mark-done"]');
    if (markBtn) markBtn.addEventListener("click", onMarkDone);
    const saveBtn = container.querySelector('[data-action="save-history"]');
    if (saveBtn) saveBtn.addEventListener("click", onSaveHistory);
  }

  async function init() {
    const chunkedCount = (reclaimCase.submissionChunks ?? []).reduce((sum, c) => sum + c.distributionIds.length, 0);
    const needsRebuild =
      !reclaimCase.submissionChunks ||
      reclaimCase.submissionChunks.length === 0 ||
      chunkedCount !== reclaimCase.distributions.length;

    if (needsRebuild) {
      reclaimCase.submissionChunks = buildSubmissionChunks(reclaimCase.distributions, corridor.maxDistributionsPerClaim);
      await caseRepo.put(reclaimCase);
      const s = getState();
      setState({
        currentCase: reclaimCase,
        cases: s.cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)),
      });
    }

    render();
  }

  init();
}
