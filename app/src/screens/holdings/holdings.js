// Screen "Wertpapierbestand Schweiz" (#/ch/bestand), docs/konzept-schweiz.md §3.1, §6.
// Käufe und Verkäufe gehören zum Profil, nicht zu einem einzelnen Fall: Ein
// Folge-DivRebound liest denselben Bestand und ergänzt nur neue Transaktionen.
// Erfassung per PDF-Upload (lib/parseBrokerStatement.js) oder manuell;
// Bestand und Tranchen kommen aus lib/holdings.js (FIFO pro Depot und ISIN).
// Mockup: Mock Up Schweiz 10-2026/divrebound_ch_mockup.html, Schritt 2.
//
// Zwei Einstiege: eigenständig über die Sidebar ("Schweiz › Wertpapierbestand")
// und eingebettet als Schritt 2 eines DivRebound (params.reclaimCase). Im Fall
// fragt die Seite bei vorhandenem Bestand zuerst "Hat sich seit … etwas
// geändert?" und zeigt die Erfassung erst bei "Ja" (Konzept §6).

import { getState } from "../../store/store.js";
import * as transactionRepo from "../../db/transactionRepo.js";
import { parseBrokerStatement } from "../../lib/parseBrokerStatement.js";
import { computeHoldings } from "../../lib/holdings.js";
import { corridors } from "../../config/corridors.js";
import { formatDateDe } from "../../util/format.js";
import { openConfirmModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { navigate } from "../../router/router.js";
import { chStepRoute } from "../../config/caseSteps.js";
import { stepHeader, stepNavHtml, bindStepNav, markStepDone } from "../chCase/chShared.js";

const corridor = corridors.CH;
const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/** @type {import("../../db/transactionRepo.js").StoredTransaction[]} */
let transactions = [];
/** Ergebnis des letzten Uploads, nur für diese Sitzung */
let lastImport = [];
let manualFormOpen = false;
const collapsed = new Set();
/** gesetzt, wenn die Seite als Schritt 2 eines DivRebound läuft */
let embeddedCase = null;
let captureOpen = false;

/** @param {HTMLElement} container @param {{ reclaimCase?: ReclaimCase }} [params] */
export async function mount(container, params = {}) {
  const profile = getState().currentProfile;
  lastImport = [];
  manualFormOpen = false;
  embeddedCase = params.reclaimCase ?? null;
  captureOpen = false;
  transactions = profile ? await transactionRepo.getByProfileId(profile.profileId) : [];
  render(container);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const knownDepots = () => [...new Set(transactions.map((t) => t.depotId))].sort();
const issuerByIsin = () => Object.fromEntries(transactions.filter((t) => t.issuerName).map((t) => [t.isin, t.issuerName]));
const depotLabel = (depotId) => (depotId ? `Depot ${depotId}` : "Depot ohne Nummer");

function render(container) {
  const profile = getState().currentProfile;
  if (!profile) {
    container.innerHTML = `
      <div class="content-header"><h1 class="content-title">Wertpapierbestand Schweiz</h1></div>
      <div class="info-banner"><span class="icon">ℹ</span><div>Bitte legen Sie zuerst Ihre <a href="#/profile">persönlichen Daten</a> an.</div></div>`;
    return;
  }

  const lastTx = [...transactions].sort((a, b) => (b.tradeDate ?? "").localeCompare(a.tradeDate ?? ""))[0];

  // Im Fall bei vorhandenem Bestand zuerst fragen, ob sich etwas geändert hat.
  const askForChanges = Boolean(embeddedCase && lastTx && !captureOpen);
  const header = embeddedCase
    ? stepHeader(embeddedCase, 2)
    : `<div class="content-header">
      <h1 class="content-title">Wertpapierbestand Schweiz</h1>
      <div class="content-breadcrumb">Schweiz <b>›</b> Wertpapierbestand</div>
    </div>`;

  container.innerHTML = `
    <div class="holdings-page">
    ${header}

    ${
      askForChanges
        ? `<div class="holdings-question">
            <h3>Hat sich seit dem ${esc(formatDateDe(lastTx.tradeDate))} etwas geändert?</h3>
            <p>Ihr Wertpapierbestand ist bereits erfasst. Die zuletzt erfasste Transaktion ist ein ${lastTx.type === "buy" ? "Kauf" : "Verkauf"} vom <b>${esc(formatDateDe(lastTx.tradeDate))}</b>. Gab es seitdem Käufe oder Verkäufe Schweizer Aktien – oder fehlen noch ältere?</p>
            <div class="holdings-actions">
              <button class="btn-accent" data-action="no-changes" type="button">Nein, Bestand ist aktuell</button>
              <button class="btn-secondary holdings-question-secondary" data-action="open-capture" type="button">Ja, Änderungen erfassen</button>
            </div>
          </div>`
        : lastTx
        ? `<div class="info-banner"><span class="icon">ℹ</span><div>Zuletzt erfasst: ${lastTx.type === "buy" ? "Kauf" : "Verkauf"} vom <b>${esc(formatDateDe(lastTx.tradeDate))}</b>. Ergänzen Sie hier Käufe und Verkäufe, die seitdem dazugekommen sind oder noch fehlen.</div></div>`
        : `<p class="holdings-lead">Erfassen Sie <b>alle Käufe und Verkäufe</b> Ihrer Schweizer Aktien, lückenlos ab dem ersten Kauf. Am einfachsten per Upload der Abrechnungen: DivRebound liest Handelstag, Stückzahl und ISIN aus. Beim nächsten DivRebound ergänzen Sie nur noch, was neu dazugekommen ist.</p>`
    }

    ${askForChanges ? "" : renderCaptureCard()}

    ${renderLastImport()}
    ${renderHoldings()}
    ${renderTransactions()}

    <details class="help-disclosure">
      <summary>Wie DivRebound den Bestand berechnet (FIFO)</summary>
      <div class="help-disclosure-body">
        <p>Bei Teilverkäufen gilt: <b>zuerst gekaufte Aktien werden zuerst verkauft</b>. Ist eine Tranche ganz verkauft, entfällt sie. Ist sie teilweise verkauft, bleibt ihr ursprüngliches Erwerbsdatum, nur die Stückzahl sinkt. Gerechnet wird getrennt pro Depot.</p>
        <p><b>Abgleich:</b> Legen Sie die Tabelle neben Ihren aktuellen Depotauszug. Weicht eine Stückzahl ab, fehlt eine Abrechnung. Zusätzlich prüft DivRebound später, ob die Stückzahlen auf den Tax Vouchern zum berechneten Bestand passen.</p>
        <p><b>Erwerbsdatum</b> ist immer der Handelstag (steht auf der Abrechnung unter „Details zur Ausführung“), nicht das Auftragsdatum und nicht die Valuta.</p>
      </div>
    </details>
    ${embeddedCase ? stepNavHtml(2) : ""}
    </div>
  `;

  attachListeners(container);
  if (embeddedCase) bindStepNav(container, embeddedCase, 2);
}

function renderCaptureCard() {
  return `
    <div class="card">
      <div class="card-head"><span class="card-title">Käufe und Verkäufe erfassen</span><span class="holdings-sub">Dateien verlassen Ihren Rechner nicht</span></div>
      <div class="card-body">
        <div class="dropzone" id="dropzone">
          <input type="file" id="file-input" multiple accept="application/pdf" hidden />
          <div class="dz-main">Wertpapierabrechnungen hochladen oder hierher ziehen</div>
          <div class="dz-sub">PDF · Mehrfachauswahl möglich · bereits erfasste Abrechnungen werden erkannt und übersprungen</div>
        </div>
        <div class="holdings-or">oder</div>
        <div style="text-align:center;">
          <button class="btn-secondary" data-action="toggle-manual" type="button">＋ Transaktion manuell erfassen</button>
          <div class="field-hint" style="margin-top:6px;">z.B. wenn alte Abrechnungen beim Broker nicht mehr abrufbar sind</div>
        </div>
      </div>
      ${renderManualForm()}
    </div>`;
}

function renderManualForm() {
  if (!manualFormOpen) return "";
  const depots = knownDepots();
  const depotOptions = (depots.length ? depots : [""]).map((d) => `<option value="${esc(d)}">${esc(depotLabel(d))}</option>`).join("");
  return `
    <div class="holdings-manual" id="manual-form">
      <div class="field-grid">
        <div class="field-row"><label class="field-label">Art</label>
          <select class="field-input" data-mf="type"><option value="buy">Kauf</option><option value="sell">Verkauf</option></select></div>
        <div class="field-row"><label class="field-label">ISIN</label>
          <input class="field-input mono" data-mf="isin" placeholder="z.B. CH0017875789" list="holdings-isins"></div>
        <div class="field-row field-row-wide"><label class="field-label">Aktie</label>
          <input class="field-input" data-mf="issuerName" placeholder="wird bei bekannter ISIN ergänzt"></div>
      </div>
      <div class="field-grid">
        <div class="field-row"><label class="field-label">Handelstag</label>
          <input class="field-input" type="date" data-mf="tradeDate"></div>
        <div class="field-row"><label class="field-label">Stück</label>
          <input class="field-input mono" type="number" min="0" step="any" data-mf="quantity"></div>
        <div class="field-row"><label class="field-label">Depot</label>
          <select class="field-input" data-mf="depotId">${depotOptions}</select></div>
      </div>
      <datalist id="holdings-isins">${Object.entries(issuerByIsin()).map(([i, n]) => `<option value="${esc(i)}">${esc(n)}</option>`).join("")}</datalist>
      <div class="field-hint">Handelstag = Tag der Ausführung (auf der Abrechnung unter „Details zur Ausführung“), nicht Auftragsdatum oder Valuta.</div>
      <div class="field-error" data-mf-error hidden></div>
      <div class="holdings-actions">
        <button class="btn-primary" data-action="save-manual" type="button">Übernehmen</button>
        <button class="btn-secondary" data-action="toggle-manual" type="button">Abbrechen</button>
      </div>
    </div>`;
}

const IMPORT_STATUS = {
  added: '<span class="badge badge-confirmed">übernommen</span>',
  check: '<span class="badge badge-warn">bitte prüfen</span>',
  duplicate: '<span class="badge badge-extracted">bereits erfasst – übersprungen</span>',
  voucher: '<span class="badge badge-dupe">Tax Voucher – wird im DivRebound zugeordnet</span>',
  notSwiss: '<span class="badge badge-danger">keine Schweizer Aktie</span>',
  unknown: '<span class="badge badge-danger">nicht erkannt</span>',
  error: '<span class="badge badge-danger">Fehler beim Lesen</span>',
};

function renderLastImport() {
  if (lastImport.length === 0) return "";
  return `
    <div class="card">
      <div class="card-head"><span class="card-title">Zuletzt hochgeladen</span></div>
      <div class="holdings-table-wrap"><table>
        <thead><tr><th>Datei</th><th>Art</th><th>Aktie</th><th class="num">Stück</th><th>Handelstag</th><th>Status</th></tr></thead>
        <tbody>${lastImport
          .map(
            (r) => `
          <tr>
            <td class="mono holdings-file" title="${esc(r.fileName)}">${esc(r.fileName)}</td>
            <td>${r.type ? (r.type === "buy" ? "Kauf" : "Verkauf") : "–"}</td>
            <td>${esc(r.issuerName ?? "")}</td>
            <td class="num">${r.quantity ?? ""}</td>
            <td class="mono">${esc(r.tradeDates?.map(formatDateDe).join(", ") ?? "")}</td>
            <td>${IMPORT_STATUS[r.status]}${r.warnings?.length ? `<div class="holdings-warning">${r.warnings.map(esc).join("<br>")}</div>` : ""}</td>
          </tr>`
          )
          .join("")}</tbody>
      </table></div>
    </div>`;
}

function renderHoldings() {
  const holdings = computeHoldings(transactions.filter((t) => t.tradeDate));
  const multipleDepots = new Set(holdings.map((h) => h.depotId)).size > 1;
  let rows = "";
  let currentDepot = null;
  for (const h of holdings) {
    if (multipleDepots && h.depotId !== currentDepot) {
      currentDepot = h.depotId;
      rows += `<tr class="holdings-depot-row"><td colspan="4">${esc(depotLabel(h.depotId))}</td></tr>`;
    }
    const key = `${h.depotId}|${h.isin}`;
    const open = !collapsed.has(key);
    rows += `
      <tr class="holdings-isin-row" data-toggle="${esc(key)}">
        <td><span class="holdings-caret ${open ? "open" : ""}">›</span> <b>${esc(h.issuerName || h.isin)}</b></td>
        <td class="mono">${esc(h.isin)}</td>
        <td></td>
        <td class="num"><b>${h.total}</b>${h.oversold ? ` <span class="badge badge-danger" title="Es wurde mehr verkauft als gekauft">${h.oversold} Stk. zu viel verkauft – Käufe fehlen</span>` : ""}</td>
      </tr>`;
    if (!open) continue;
    for (const lot of h.lots) {
      const gone = lot.remaining === 0;
      const sales = lot.sales.map((s) => `${s.quantity} verkauft am ${formatDateDe(s.tradeDate)}`).join(", ");
      rows += `
        <tr class="holdings-lot-row ${gone ? "gone" : ""}">
          <td>Tranche${gone ? " · vollständig verkauft" : lot.remaining < lot.original ? ` · ursprünglich ${lot.original}` : ""}${sales ? `<div class="holdings-lot-note">${esc(sales)}</div>` : ""}</td>
          <td></td>
          <td class="mono">${esc(formatDateDe(lot.tradeDate))}</td>
          <td class="num">${lot.remaining}</td>
        </tr>`;
    }
  }
  return `
    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Aktueller Bestand</span><span class="count-pill">${holdings.length} ${holdings.length === 1 ? "Aktie" : "Aktien"}</span></div>
      ${
        holdings.length
          ? `<div class="holdings-table-wrap"><table>
              <thead><tr><th>Aktie / Tranche</th><th>ISIN</th><th>Erwerbsdatum</th><th class="num">Stück</th></tr></thead>
              <tbody>${rows}</tbody></table></div>`
          : `<div class="card-body"><p class="holdings-empty">Noch keine Käufe oder Verkäufe erfasst.</p></div>`
      }
    </div>`;
}

function renderTransactions() {
  if (transactions.length === 0) return "";
  const sorted = [...transactions].sort((a, b) => (a.tradeDate ?? "").localeCompare(b.tradeDate ?? ""));
  return `
    <details class="card holdings-tx-card">
      <summary class="card-head"><span class="card-title">Alle erfassten Transaktionen</span><span class="count-pill">${transactions.length}</span></summary>
      <div class="holdings-table-wrap"><table>
        <thead><tr><th>Handelstag</th><th>Art</th><th>Aktie</th><th class="num">Stück</th><th>Quelle</th><th></th></tr></thead>
        <tbody>${sorted
          .map(
            (t) => `
          <tr>
            <td class="mono">${
              t.tradeDate
                ? esc(formatDateDe(t.tradeDate))
                : `<input class="field-input" type="date" data-set-date="${esc(t.transactionId)}" title="Handelstag aus der Abrechnung eintragen">`
            }</td>
            <td>${t.type === "buy" ? "Kauf" : "Verkauf"}</td>
            <td>${esc(t.issuerName || t.isin)}<div class="mono holdings-lot-note">${esc(t.isin)}${knownDepots().length > 1 ? ` · ${esc(depotLabel(t.depotId))}` : ""}</div></td>
            <td class="num">${t.type === "sell" ? "−" : ""}${t.quantity}</td>
            <td class="holdings-source">${t.source?.kind === "manual" ? "manuell erfasst" : esc(t.source?.fileName ?? "Abrechnung")}
              ${t.extractionConfidence === "extracted" ? `<div><span class="badge badge-warn">bitte prüfen</span> <button class="holdings-link" data-confirm="${esc(t.transactionId)}" type="button">stimmt</button></div>` : ""}</td>
            <td><button class="holdings-delete" data-delete="${esc(t.transactionId)}" title="Löschen" type="button">✕</button></td>
          </tr>`
          )
          .join("")}</tbody>
      </table></div>
    </details>`;
}

function attachListeners(container) {
  container.querySelector('[data-action="open-capture"]')?.addEventListener("click", () => {
    captureOpen = true;
    render(container);
  });
  container.querySelector('[data-action="no-changes"]')?.addEventListener("click", async () => {
    await markStepDone(embeddedCase, 2);
    navigate(chStepRoute(embeddedCase.caseId, 3));
  });

  const dropzone = container.querySelector("#dropzone");
  const fileInput = container.querySelector("#file-input");
  if (dropzone) attachUploadListeners(container, dropzone, fileInput);
  attachTableListeners(container);
}

function attachUploadListeners(container, dropzone, fileInput) {
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(container, fileInput.files));
  for (const evt of ["dragenter", "dragover"]) {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
  }
  for (const evt of ["dragleave", "drop"]) {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    });
  }
  dropzone.addEventListener("drop", (e) => handleFiles(container, e.dataTransfer.files));
}

function attachTableListeners(container) {

  container.querySelectorAll('[data-action="toggle-manual"]').forEach((btn) =>
    btn.addEventListener("click", () => {
      manualFormOpen = !manualFormOpen;
      render(container);
      if (manualFormOpen) container.querySelector('[data-mf="isin"]')?.focus();
    })
  );

  const isinInput = container.querySelector('[data-mf="isin"]');
  isinInput?.addEventListener("input", () => {
    const name = issuerByIsin()[isinInput.value.trim().toUpperCase()];
    const nameInput = container.querySelector('[data-mf="issuerName"]');
    if (name && !nameInput.value) nameInput.value = name;
  });
  container.querySelector('[data-action="save-manual"]')?.addEventListener("click", () => saveManual(container));

  container.querySelectorAll("[data-toggle]").forEach((row) =>
    row.addEventListener("click", () => {
      const key = row.dataset.toggle;
      collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
      render(container);
    })
  );

  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const t = transactions.find((x) => x.transactionId === btn.dataset.delete);
      const ok = await openConfirmModal(
        "Transaktion löschen?",
        `${t.type === "buy" ? "Kauf" : "Verkauf"} ${t.quantity} Stk. ${esc(t.issuerName || t.isin)}${t.tradeDate ? ` vom ${formatDateDe(t.tradeDate)}` : ""} wird aus dem Bestand entfernt.`,
        { confirmLabel: "Löschen", danger: true }
      );
      if (!ok) return;
      await transactionRepo.remove(t.transactionId);
      transactions = transactions.filter((x) => x.transactionId !== t.transactionId);
      render(container);
      showToast("✓ Transaktion gelöscht");
    })
  );

  container.querySelectorAll("[data-confirm]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const t = transactions.find((x) => x.transactionId === btn.dataset.confirm);
      await updateTransaction(container, { ...t, extractionConfidence: "confirmed" });
    })
  );

  container.querySelectorAll("[data-set-date]").forEach((input) =>
    input.addEventListener("change", async () => {
      if (!input.value) return;
      const t = transactions.find((x) => x.transactionId === input.dataset.setDate);
      await updateTransaction(container, { ...t, tradeDate: input.value, extractionConfidence: "confirmed" });
      showToast("✓ Handelstag gespeichert");
    })
  );
}

async function updateTransaction(container, updated) {
  await transactionRepo.put(updated);
  transactions = transactions.map((x) => (x.transactionId === updated.transactionId ? updated : x));
  render(container);
  container.querySelector(".holdings-tx-card")?.setAttribute("open", "");
}

async function handleFiles(container, fileList) {
  const profile = getState().currentProfile;
  if (!profile || !fileList?.length) return;

  const results = [];
  for (const file of fileList) {
    const base = { fileName: file.name };
    try {
      const parsed = await parseBrokerStatement(await file.arrayBuffer());
      if (parsed.kind === "taxVoucher") {
        results.push({ ...base, status: "voucher", issuerName: parsed.issuerName, quantity: parsed.quantity });
        continue;
      }
      if (parsed.kind !== "trade") {
        results.push({ ...base, status: "unknown" });
        continue;
      }
      const summary = {
        ...base,
        type: parsed.type,
        issuerName: parsed.issuerName,
        quantity: parsed.executions.reduce((s, e) => s + (e.quantity ?? 0), 0),
        tradeDates: parsed.executions.map((e) => e.tradeDate).filter(Boolean),
        warnings: parsed.warnings,
      };
      if (!parsed.isin?.startsWith(corridor.isinPrefix)) {
        results.push({ ...summary, status: "notSwiss" });
        continue;
      }
      const source = { kind: "pdf", broker: parsed.broker ?? undefined, documentRef: parsed.documentRef ?? undefined, fileName: file.name, importedAt: new Date().toISOString() };
      if (transactionRepo.isDuplicateDocument(transactions, source)) {
        results.push({ ...summary, status: "duplicate" });
        continue;
      }
      const needsCheck = parsed.warnings.length > 0 || parsed.executions.some((e) => !e.tradeDate || !e.quantity);
      for (const execution of parsed.executions) {
        const transaction = {
          transactionId: crypto.randomUUID(),
          profileId: profile.profileId,
          depotId: parsed.depotId ?? "",
          isin: parsed.isin,
          issuerName: parsed.issuerName,
          type: parsed.type,
          tradeDate: execution.tradeDate,
          quantity: execution.quantity ?? 0,
          source,
          extractionConfidence: needsCheck ? "extracted" : "confirmed",
        };
        await transactionRepo.put(transaction);
        transactions.push(transaction);
      }
      results.push({ ...summary, status: needsCheck ? "check" : "added" });
    } catch (err) {
      console.error("[holdings] Abrechnung konnte nicht gelesen werden:", err);
      results.push({ ...base, status: "error" });
    }
  }
  lastImport = results;
  render(container);
  if (results.some((r) => r.status === "check")) container.querySelector(".holdings-tx-card")?.setAttribute("open", "");
}

async function saveManual(container) {
  const profile = getState().currentProfile;
  const value = (k) => container.querySelector(`[data-mf="${k}"]`).value.trim();
  const errorEl = container.querySelector("[data-mf-error]");
  const isin = value("isin").toUpperCase();
  const quantity = Number(value("quantity"));
  const tradeDate = value("tradeDate");

  let error = "";
  if (!ISIN_PATTERN.test(isin)) error = "ISIN hat 12 Zeichen, z.B. CH0017875789.";
  else if (!isin.startsWith(corridor.isinPrefix)) error = "Hier werden nur Schweizer Aktien erfasst (ISIN beginnt mit CH).";
  else if (!tradeDate) error = "Bitte den Handelstag angeben.";
  else if (!(quantity > 0)) error = "Bitte die Stückzahl angeben.";
  if (error) {
    errorEl.textContent = error;
    errorEl.hidden = false;
    return;
  }

  const transaction = {
    transactionId: crypto.randomUUID(),
    profileId: profile.profileId,
    depotId: value("depotId"),
    isin,
    issuerName: value("issuerName") || issuerByIsin()[isin] || "",
    type: value("type") === "sell" ? "sell" : "buy",
    tradeDate,
    quantity,
    source: { kind: "manual", importedAt: new Date().toISOString() },
    extractionConfidence: "confirmed",
  };
  await transactionRepo.put(transaction);
  transactions.push(transaction);
  manualFormOpen = false;
  render(container);
  showToast(`✓ ${transaction.type === "buy" ? "Kauf" : "Verkauf"} übernommen`);
}
