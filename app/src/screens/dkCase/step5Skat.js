// Dänemark, Schritt 5 "SKAT-Portal ausfüllen" - nur der Spickzettel mit Reitern
// je Formularseite, rechts daneben das SKAT-Formular angedeutet (gleiches
// Layout wie das ePortal der Schweiz). Zeitleiste und "DivRebound
// abschließen" folgen in Schritt 6 (step6Finish.js). Der Spickzettel ist eine
// seitengetreue Übertragungshilfe für die 6 echten SKAT-Formularseiten
// (siehe Mock Up Status 08-2026/divrebound_cheatsheet_v3_mockup.html).
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

import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { buildSubmissionChunks } from "../../util/chunking.js";
import { portalBoxHtml, portalSideHtml } from "../../components/portalSide.js";
import { skatTabs, buildSharePages, shareHelpNote } from "./skatFieldMap.js";
import { stepHeader, stepNavHtml, bindStepNav, saveCase, dkRefund } from "./dkShared.js";

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

export function mount(container, reclaimCase, profile) {
  const corridor = corridors.DK;
  const portalBox = {
    title: "SKAT-Formular",
    sub: "kein Login und keine MitID nötig",
    docTitle: "„Refusion af udbytteskat / Claim for refund of Danish dividend tax“",
    text: "Öffne das Formular in einem zweiten Fenster und ordne es neben dieser Seite an. Halte die vom Finanzamt bestätigte Wohnsitzbescheinigung bereit, du lädst sie auf Seite 4 hoch.",
    url: corridor.onlinePortalUrl,
    buttonLabel: "SKAT-Formular öffnen ↗",
  };
  const portalSide = { host: "udbytterefusion.skat.dk", caption: "Hier daneben: das SKAT-Formular im zweiten Fenster." };
  // Nur bestätigte, erstattungsfähige Ausschüttungen kommen ins SKAT-Formular
  const eligible = dkRefund(reclaimCase, profile).eligible;

  // Seite 3 wiederholt sich pro Distribution - ohne mindestens eine
  // erstattungsfähige Ausschüttung gäbe es keinen aktiven Chunk.
  if (eligible.length === 0) {
    container.innerHTML = `
      <div class="ch-page">
      ${stepHeader(reclaimCase, 5)}
      <div class="info-banner"><span class="icon">ℹ</span><div>Für diesen Fall ist noch keine Ausschüttung bestätigt – bitte zuerst Schritt 2 abschließen.</div></div>
      ${stepNavHtml(5)}
      </div>`;
    bindStepNav(container, reclaimCase, 5);
    return;
  }

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

  /** Zeilen mit Checkbox - bewusst leer gelassene Felder zählen nicht zum Fortschritt */
  function tickableRows(tab) {
    return tab.rows.filter((r) => !r.assumption);
  }

  function isTabDone(tab, tickedIds) {
    const rows = tickableRows(tab);
    return rows.length > 0 && rows.every((r) => tickedIds.includes(r.id));
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
    // Bewusst leer gelassene Felder: nichts zu übertragen, also nichts abzuhaken
    const checkbox = row.assumption
      ? `<span></span>`
      : `<input type="checkbox" data-row-id="${row.id}" ${checked ? "checked" : ""} />`;
    const actionBtn = row.assumption
      ? `<span></span>`
      : row.isDownload
      ? `<button class="copy-btn" data-action="download" data-row-id="${row.id}" title="Download">⬇</button>`
      : row.noCopy
      ? `<span></span>`
      : `<button class="copy-btn" data-action="copy" data-row-id="${row.id}">⧉</button>`;
    return `
      <div class="row" data-row-id="${row.id}">
        ${checkbox}
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
        const ticked = activeChunk().tickedRowIds ?? [];
        // Plausibilitäts-Check steht an der Stelle von "Amount of refund" im SKAT-Formular
        const splitAt = sp.rows.findIndex((r) => r.id === sp.plausibilityAfterRowId) + 1 || sp.rows.length;
        const rowsBefore = sp.rows.slice(0, splitAt).map((row) => renderRowHtml(row, ticked)).join("");
        const rowsAfter = sp.rows.slice(splitAt).map((row) => renderRowHtml(row, ticked)).join("");
        return `
          <div class="share-block-head">${escapeHtml(sp.headLabel)}</div>
          ${rowsBefore}
          <div class="plausibility-check">
            <div class="pc-label">🔍 Amount of refund (DKK) – Plausibilitäts-Check <span class="en">wird von SKAT automatisch berechnet, nicht von uns eingetragen</span></div>
            <div class="pc-row">
              <span>Unsere Schätzung: <b>${sp.plausibilityEstimate.toFixed(2)} DKK</b></span>
              <span>SKAT zeigt: <input type="text" class="pc-input" data-pc="${sp.distributionId}" placeholder="DKK"></span>
              <span class="pc-result" data-pc-result="${sp.distributionId}"></span>
            </div>
          </div>
          ${rowsAfter}`;
      })
      .join("");
    return blocks + renderHelpNote(shareHelpNote);
  }

  function renderSummaryBody() {
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
          <div class="done-sub">Dein Antrag ist vollständig ausgefüllt. Jetzt bei SKAT ausdrucken oder als PDF speichern, auf „Send“ klicken und den DivRebound in Schritt 6 abschließen.</div>
        </div>
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
    tabs.forEach((t) => tickableRows(t).forEach((r) => allRowIds.add(r.id)));
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
      const tabDone = isTabDone(tabDef, tickedIds);
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

  function render() {
    const tabs = resolvedTabs();
    const chunk = activeChunk();
    const chunks = reclaimCase.submissionChunks;
    const tickedIds = chunk.tickedRowIds ?? [];

    const rowsById = new Map();
    tabs.forEach((t) => t.rows.forEach((r) => rowsById.set(r.id, r)));

    const allRowIds = new Set(tabs.flatMap((t) => tickableRows(t).map((r) => r.id)));
    const total = allRowIds.size;
    const done = tickedIds.filter((id) => allRowIds.has(id)).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const chunkSelectorHtml = chunks.length > 1 ? renderChunkSelector(chunks) : "";

    const tabsHtml = tabs
      .map((t) => {
        const tabDone = isTabDone(t, tickedIds);
        const activeClass = t.id === activeTabId ? " active" : "";
        return `<div class="page-tab${activeClass}" data-tab="${t.id}">${escapeHtml(t.label)}${
          tabDone ? ' <span class="done-mark">✓</span>' : ""
        }</div>`;
      })
      .join("");

    const activeTabDef = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
    const paneBodyHtml = renderPaneBody(activeTabDef, tickedIds);
    const activeTabIndex = tabs.findIndex((t) => t.id === activeTabDef.id);

    container.innerHTML = `
      <div class="ch-page">
      ${stepHeader(reclaimCase, 5)}
      ${portalBoxHtml(portalBox)}

      <section class="cheat-section">
      <div class="cheat-section-head">
        <div>
          <div class="cheat-section-title">Spickzettel</div>
          <div class="cheat-section-sub">Werte Reiter für Reiter ins SKAT-Formular übertragen. Die Reiter folgen den Seiten des Formulars.</div>
        </div>
        <div class="progress-wrap">
          <span>${done} von ${total} übertragen</span>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      </div>

      <div class="cheat-layout-row">
        <div class="cheat-main">

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

          <nav class="page-tabs-bottom" aria-label="Formularseite wechseln">
            <div class="page-tabs-bottom-label">Formularseite wechseln</div>
            <div class="page-tabs">${tabsHtml}</div>
          </nav>

        </div>

        ${portalSideHtml(portalSide)}
      </div>
      </section>

      ${stepNavHtml(5)}
      </div>
    `;

    bindStepNav(container, reclaimCase, 5);

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
        const fromBottom = Boolean(el.closest(".page-tabs-bottom"));
        activeTabId = el.dataset.tab;
        render();
        // Unten gewechselt: an den Anfang der neuen Formularseite springen
        if (fromBottom) container.querySelector(".page-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    container.querySelectorAll(".chunk-tab").forEach((el) => {
      el.addEventListener("click", () => {
        activeChunkIndex = Number(el.dataset.chunkIdx);
        activeTabId = "p1";
        render();
      });
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

  }

  async function init() {
    // Anträge (max. 20 Ausschüttungen je Antrag) aus den bestätigten,
    // erstattungsfähigen Ausschüttungen - neu bilden, wenn sich die Auswahl geändert hat.
    const chunkedIds = (reclaimCase.submissionChunks ?? []).flatMap((c) => c.distributionIds).sort().join();
    const eligibleIds = eligible.map((d) => d.distributionId).sort().join();
    if (chunkedIds !== eligibleIds) {
      reclaimCase.submissionChunks = buildSubmissionChunks(eligible, corridor.maxDistributionsPerClaim);
      await saveCase(reclaimCase);
    }

    render();
  }

  init();
}
