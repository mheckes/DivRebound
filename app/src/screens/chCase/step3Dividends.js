// Schritt 3 "Dividenden & Tax Voucher" (docs/konzept-schweiz.md §1, §4).
// Pro Dividende braucht das ePortal einen Tax Voucher. DivRebound ordnet
// Voucher und Dividendenabrechnungen über ISIN (+ Vorgangs-Nr. bzw. Zahltag)
// einer Ausschüttung zu und prüft: Summe der Voucher-Stückzahlen = Bestand
// am Stichtag (FIFO, lib/holdings.js).
//
// Der Dividendentermin steht auf dem Voucher nur als Grafik (Seite 2) - er
// kommt aus der Dividendenabrechnung oder wird vom Nutzer eingetragen. Fehlt
// der Ex-Tag, wird er als "2 Bankarbeitstage vor Zahltag" vorgeschlagen
// (Schweizer Standard: Ex-Tag, Record Date, Zahltag) und als berechnet markiert.

import { getState } from "../../store/store.js";
import { parseBrokerStatement } from "../../lib/parseBrokerStatement.js";
import { parseDividendCertificate } from "../../lib/parseDividendCertificate.js";
import { computeHoldings, computeLots } from "../../lib/holdings.js";
import { formatDateDe } from "../../util/format.js";
import { openConfirmModal } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import {
  esc, corridor, saveCase, loadTransactions, entitlementsFor, isTimeBarred, formatChf,
  stepHeader, stepNavHtml, bindStepNav,
} from "./chShared.js";

let transactions = [];
let lastUpload = [];

export async function mount(container, reclaimCase) {
  transactions = await loadTransactions(getState().currentProfile);
  lastUpload = [];
  render(container, reclaimCase);
}

/** ISO-Datum minus n Bankarbeitstage (nur Wochenenden berücksichtigt) */
export function subtractBusinessDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

function exDateFromText(text) {
  const m = String(text ?? "").match(/Ex-?(?:Tag|Datum)\D{0,25}(\d{2})\.(\d{2})\.(\d{4})/i);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function newDistribution(fields) {
  return {
    distributionId: crypto.randomUUID(),
    isin: "",
    issuerName: "",
    vorgangsNr: null,
    exDate: null,
    exDateDerived: false,
    paymentDate: null,
    grossPerShare: null,
    vouchers: [],
    dividendStatement: null,
    ...fields,
  };
}

function setPaymentDate(dist, paymentDate) {
  dist.paymentDate = paymentDate || null;
  if (dist.paymentDate && (!dist.exDate || dist.exDateDerived)) {
    dist.exDate = subtractBusinessDays(dist.paymentDate, 2);
    dist.exDateDerived = true;
  }
}

const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

function attachVoucher(reclaimCase, parsed, fileName) {
  const dists = reclaimCase.ch.distributions;
  if (!parsed.isin?.startsWith(corridor.isinPrefix)) return "notSwiss";
  if (parsed.documentRef && dists.some((d) => d.vouchers.some((v) => v.documentRef === parsed.documentRef))) return "duplicate";
  let dist =
    dists.find((d) => d.isin === parsed.isin && parsed.vorgangsNr && d.vorgangsNr === parsed.vorgangsNr) ??
    dists.find(
      (d) =>
        d.isin === parsed.isin &&
        !d.vorgangsNr &&
        d.vouchers.length === 0 &&
        d.paymentDate &&
        parsed.letterDate &&
        daysBetween(d.paymentDate, parsed.letterDate) >= 0 &&
        daysBetween(d.paymentDate, parsed.letterDate) <= 150
    );
  if (!dist) {
    dist = newDistribution({ isin: parsed.isin, issuerName: parsed.issuerName });
    dists.push(dist);
  }
  dist.vorgangsNr = dist.vorgangsNr ?? parsed.vorgangsNr;
  if (!dist.issuerName) dist.issuerName = parsed.issuerName;
  dist.vouchers.push({ fileName, quantity: parsed.quantity, documentRef: parsed.documentRef });
  return "voucher";
}

function attachStatement(reclaimCase, distribution, rawText, fileName) {
  const dists = reclaimCase.ch.distributions;
  let dist =
    dists.find((d) => d.isin === distribution.isin && d.paymentDate === distribution.paymentDate) ??
    dists.find((d) => d.isin === distribution.isin && !d.paymentDate);
  if (dist?.dividendStatement === fileName) return "duplicate";
  if (!dist) {
    dist = newDistribution({ isin: distribution.isin });
    dists.push(dist);
  }
  if (!dist.issuerName) dist.issuerName = distribution.issuerName;
  const exDate = exDateFromText(rawText);
  if (exDate) {
    dist.exDate = exDate;
    dist.exDateDerived = false;
  }
  setPaymentDate(dist, distribution.paymentDate);
  if (distribution.grossDividend && distribution.shares) {
    dist.grossPerShare = Math.round((distribution.grossDividend / distribution.shares) * 10000) / 10000;
  }
  dist.dividendStatement = fileName;
  return "statement";
}

async function handleFiles(container, reclaimCase, fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const bytes = await file.arrayBuffer();
      // pdf.js übernimmt den Puffer - für jeden Versuch eine eigene Kopie.
      const parsed = await parseBrokerStatement(bytes.slice(0));
      if (parsed.kind === "taxVoucher") {
        results.push({ fileName: file.name, status: attachVoucher(reclaimCase, parsed, file.name), detail: `${parsed.issuerName} · ${parsed.quantity ?? "?"} Stk.` });
        continue;
      }
      if (parsed.kind === "trade") {
        results.push({ fileName: file.name, status: "trade" });
        continue;
      }
      const certificate = await parseDividendCertificate(bytes.slice(0), corridor);
      if (certificate.distribution) {
        const d = certificate.distribution;
        results.push({ fileName: file.name, status: attachStatement(reclaimCase, d, certificate.rawText, file.name), detail: `${d.issuerName} · Zahltag ${formatDateDe(d.paymentDate) || "?"}` });
      } else {
        results.push({ fileName: file.name, status: "unknown" });
      }
    } catch (err) {
      console.error("[ch step3] Datei konnte nicht gelesen werden:", err);
      results.push({ fileName: file.name, status: "error" });
    }
  }
  await saveCase(reclaimCase);
  lastUpload = results;
  render(container, reclaimCase);
}

const UPLOAD_STATUS = {
  voucher: '<span class="badge badge-confirmed">Tax Voucher zugeordnet</span>',
  statement: '<span class="badge badge-confirmed">Dividendenabrechnung übernommen</span>',
  duplicate: '<span class="badge badge-extracted">bereits erfasst – übersprungen</span>',
  trade: '<span class="badge badge-dupe">Wertpapierabrechnung – bitte in Schritt 2 erfassen</span>',
  notSwiss: '<span class="badge badge-danger">keine Schweizer Aktie</span>',
  unknown: '<span class="badge badge-danger">nicht erkannt</span>',
  error: '<span class="badge badge-danger">Fehler beim Lesen</span>',
};

/** Jahre, in denen eine gehaltene Aktie keine erfasste Dividende hat (Hinweis "möglicherweise offen") */
function openYearHints(reclaimCase) {
  const thisYear = new Date().getFullYear();
  const firstYear = thisYear - corridor.limitationPeriodYears;
  const dismissed = new Set(reclaimCase.ch.dismissedHints);
  const withDates = transactions.filter((t) => t.tradeDate);
  const hints = [];
  for (const h of computeHoldings(withDates)) {
    if (hints.some((x) => x.isin === h.isin)) continue;
    const years = [];
    for (let y = firstYear; y <= thisYear; y++) {
      const heldAtYearEnd = computeLots(withDates, { isin: h.isin, cutoffExclusive: `${y + 1}-01-01` }).lots.some((l) => l.remaining > 0);
      const tradedInYear = withDates.some((t) => t.isin === h.isin && t.tradeDate.startsWith(String(y)));
      const hasDist = reclaimCase.ch.distributions.some((d) => d.isin === h.isin && d.paymentDate?.startsWith(String(y)));
      if ((heldAtYearEnd || tradedInYear) && !hasDist && !dismissed.has(`${h.isin}|${y}`)) years.push(y);
    }
    if (years.length) hints.push({ isin: h.isin, issuerName: h.issuerName, years });
  }
  return hints;
}

function holdingsIsins() {
  const names = {};
  for (const t of transactions) if (!names[t.isin] || t.issuerName) names[t.isin] = t.issuerName || t.isin;
  return names;
}

function render(container, reclaimCase) {
  const focusKey = document.activeElement?.dataset?.focusKey;
  const results = entitlementsFor(reclaimCase, transactions, getState().currentProfile);
  const byId = Object.fromEntries(results.map((r) => [r.distribution.distributionId, r]));
  const dists = [...reclaimCase.ch.distributions].sort((a, b) => (a.paymentDate ?? "9999").localeCompare(b.paymentDate ?? "9999"));
  const isinNames = holdingsIsins();
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  const hints = openYearHints(reclaimCase);

  container.innerHTML = `
    <div class="ch-page ch-page-wide">
    ${stepHeader(reclaimCase, 3)}
    <p class="ch-lead">Für jede Dividende braucht das ePortal einen Tax Voucher Ihrer Bank. Laden Sie die Voucher und – falls vorhanden – die Dividendenabrechnungen hoch. DivRebound ordnet sie zu und prüft, ob die Stückzahlen zu Ihrem Bestand am Stichtag passen.</p>

    <div class="dropzone" id="dropzone">
      <input type="file" id="file-input" multiple accept="application/pdf" hidden />
      <div class="dz-main">Tax Voucher und Dividendenabrechnungen hochladen oder hierher ziehen</div>
      <div class="dz-sub">PDF · Mehrfachauswahl möglich</div>
    </div>

    ${
      lastUpload.length
        ? `<div class="card"><div class="card-head"><span class="card-title">Zuletzt hochgeladen</span></div><div class="ch-table-wrap"><table>
            <thead><tr><th>Datei</th><th>Erkannt</th><th>Status</th></tr></thead>
            <tbody>${lastUpload.map((r) => `<tr><td class="mono ch-file" title="${esc(r.fileName)}">${esc(r.fileName)}</td><td>${esc(r.detail ?? "")}</td><td>${UPLOAD_STATUS[r.status]}</td></tr>`).join("")}</tbody>
          </table></div></div>`
        : ""
    }

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Erstattungsfähige Dividenden</span><span class="ch-head-sub">Verjährung: ${corridor.limitationPeriodYears} Jahre ab Ende des Zahlungsjahres</span></div>
      ${
        dists.length
          ? `<div class="ch-table-wrap"><table class="ch-dist-table">
              <thead><tr><th>Aktie</th><th>Fälligkeit</th><th>Ex-Tag</th><th class="num">Brutto/Aktie</th><th class="num">Bestand am Stichtag</th><th>Tax Voucher</th><th>Abgleich</th><th class="num">Erstattung</th><th></th></tr></thead>
              <tbody>${dists.map((d) => distributionRow(d, byId[d.distributionId], isinNames)).join("")}</tbody>
              <tfoot><tr><td colspan="7"><b>Voraussichtliche Erstattung (20 % der Bruttodividende)</b></td><td class="num"><b>${formatChf(total)}</b></td><td></td></tr></tfoot>
            </table></div>`
          : `<div class="card-body"><p class="ch-empty">Noch keine Dividenden erfasst. Laden Sie oben Ihre Tax Voucher hoch.</p></div>`
      }
      <div class="ch-card-foot"><button class="btn-secondary btn-small" data-add-dist type="button">＋ Dividende manuell hinzufügen</button></div>
    </div>

    ${hints
      .map(
        (h) => `
      <div class="ch-hint">
        <span class="ch-hint-icon">💡</span>
        <div>
          <b>Möglicherweise noch offen: ${esc(h.issuerName || h.isin)} ${h.years.join(", ")}.</b><br>
          Laut Ihrem Bestand hielten Sie die Aktie in ${h.years.length === 1 ? "diesem Jahr" : "diesen Jahren"}, es ist aber keine Dividende erfasst. Falls eine gezahlt wurde, ist sie noch nicht verjährt.
          <div class="ch-hint-actions">
            <button class="btn-secondary btn-small" data-upload-hint type="button">Unterlagen hochladen</button>
            <button class="btn-secondary btn-small" data-dismiss-hint="${esc(h.isin)}|${h.years.join(",")}" type="button">Bereits erstattet / keine Dividende</button>
          </div>
        </div>
      </div>`
      )
      .join("")}

    <details class="help-disclosure">
      <summary>Warum mehrere Tax Voucher für eine Dividende? Was ist der Stichtag?</summary>
      <div class="help-disclosure-body">
        <p>Manche Banken stellen für eine Dividende mehrere Voucher aus (z.B. 20 und 5 Stück). Entscheidend ist, dass die <b>Summe</b> dem Bestand am Stichtag entspricht. Weicht sie ab, fehlt entweder ein Voucher oder eine Kauf-/Verkaufsabrechnung in Schritt 2.</p>
        <p><b>Stichtag:</b> Anspruch hat, wer die Aktie am Ende des Handelstags vor dem Ex-Tag hält. Der Dividendentermin steht auf dem Voucher nur als Bild – DivRebound übernimmt ihn aus der Dividendenabrechnung, oder Sie tragen ihn ein. Ein vorgeschlagener Ex-Tag (2 Bankarbeitstage vor dem Zahltag) ist als „berechnet“ markiert; bitte mit der Dividendenabrechnung abgleichen.</p>
      </div>
    </details>

    ${stepNavHtml(3)}
    </div>`;

  attachListeners(container, reclaimCase);
  if (focusKey) container.querySelector(`[data-focus-key="${focusKey}"]`)?.focus();
}

function distributionRow(d, result, isinNames) {
  const barred = d.paymentDate && isTimeBarred(d.paymentDate);
  const incomplete = !d.isin || !d.paymentDate || !d.exDate;
  const sum = d.vouchers.reduce((s, v) => s + (v.quantity ?? 0), 0);
  let check = '<span class="badge badge-extracted">Angaben fehlen</span>';
  if (barred) check = '<span class="badge badge-danger">verjährt</span>';
  else if (!incomplete && result) {
    if (result.oversold) check = '<span class="badge badge-danger">Käufe fehlen (Schritt 2)</span>';
    else if (!d.vouchers.length) check = '<span class="badge badge-warn">Tax Voucher fehlt</span>';
    else if (result.voucherMatches) check = `<span class="badge badge-confirmed">${d.vouchers.length > 1 ? `${d.vouchers.map((v) => v.quantity).join(" + ")} = ` : ""}${sum} ✓</span>`;
    else check = `<span class="badge badge-danger">Voucher ${sum} ≠ Bestand ${result.heldQuantity}</span>`;
  }
  const id = d.distributionId;
  const isinCell = d.isin
    ? `<b>${esc(d.issuerName || isinNames[d.isin] || "")}</b><div class="mono ch-sub">${esc(d.isin)}</div>`
    : `<select class="field-input ch-cell-input" data-dist="${id}" data-prop="isin" data-focus-key="${id}-isin">
        <option value="">Aktie wählen …</option>
        ${Object.entries(isinNames).map(([isin, name]) => `<option value="${esc(isin)}">${esc(name)} (${esc(isin)})</option>`).join("")}
      </select>`;
  return `
    <tr class="${barred ? "ch-row-barred" : ""}">
      <td>${isinCell}</td>
      <td><input class="field-input ch-cell-input" type="date" data-dist="${id}" data-prop="paymentDate" data-focus-key="${id}-pay" value="${esc(d.paymentDate ?? "")}"></td>
      <td><input class="field-input ch-cell-input" type="date" data-dist="${id}" data-prop="exDate" data-focus-key="${id}-ex" value="${esc(d.exDate ?? "")}">
        ${d.exDateDerived ? '<div class="ch-sub" title="2 Bankarbeitstage vor dem Zahltag – bitte prüfen">berechnet</div>' : ""}</td>
      <td class="num"><input class="field-input ch-cell-input ch-cell-num" inputmode="decimal" data-dist="${id}" data-prop="grossPerShare" data-focus-key="${id}-gross" placeholder="CHF" value="${d.grossPerShare === null ? "" : esc(d.grossPerShare.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }))}"></td>
      <td class="num">${result && !incomplete ? result.heldQuantity : "–"}</td>
      <td>${d.vouchers.map((v) => `<span class="ch-chip" title="${esc(v.fileName)}">${v.quantity ?? "?"} Stk.</span>`).join("") || '<span class="ch-sub">–</span>'}</td>
      <td>${check}</td>
      <td class="num mono">${result && !incomplete ? formatChf(result.refund) : "–"}</td>
      <td><button class="holdings-delete" data-remove-dist="${id}" title="Entfernen" type="button">✕</button></td>
    </tr>`;
}

function attachListeners(container, reclaimCase) {
  bindStepNav(container, reclaimCase, 3);
  const dropzone = container.querySelector("#dropzone");
  const fileInput = container.querySelector("#file-input");
  dropzone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(container, reclaimCase, fileInput.files));
  for (const evt of ["dragenter", "dragover"]) dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  for (const evt of ["dragleave", "drop"]) dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); });
  dropzone.addEventListener("drop", (e) => handleFiles(container, reclaimCase, e.dataTransfer.files));

  container.querySelectorAll("[data-prop]").forEach((input) =>
    input.addEventListener("change", async () => {
      const dist = reclaimCase.ch.distributions.find((d) => d.distributionId === input.dataset.dist);
      const value = input.value.trim();
      const prop = input.dataset.prop;
      if (prop === "paymentDate") setPaymentDate(dist, value);
      else if (prop === "exDate") {
        dist.exDate = value || null;
        dist.exDateDerived = false;
      } else if (prop === "grossPerShare") {
        const n = Number(value.replace(",", "."));
        dist.grossPerShare = value && Number.isFinite(n) ? n : null;
      } else if (prop === "isin") {
        dist.isin = value;
        dist.issuerName = holdingsIsins()[value] ?? "";
      }
      await saveCase(reclaimCase);
      render(container, reclaimCase);
      showToast("✓ Gespeichert");
    })
  );

  container.querySelector("[data-add-dist]").addEventListener("click", async () => {
    reclaimCase.ch.distributions.push(newDistribution({}));
    await saveCase(reclaimCase);
    render(container, reclaimCase);
  });

  container.querySelectorAll("[data-remove-dist]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await openConfirmModal("Dividende entfernen?", "Die Dividende und die zugeordneten Tax Voucher werden aus diesem DivRebound entfernt.", { confirmLabel: "Entfernen", danger: true });
      if (!ok) return;
      reclaimCase.ch.distributions = reclaimCase.ch.distributions.filter((d) => d.distributionId !== btn.dataset.removeDist);
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );

  container.querySelectorAll("[data-upload-hint]").forEach((btn) => btn.addEventListener("click", () => fileInput.click()));
  container.querySelectorAll("[data-dismiss-hint]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const [isin, years] = btn.dataset.dismissHint.split("|");
      for (const y of years.split(",")) reclaimCase.ch.dismissedHints.push(`${isin}|${y}`);
      await saveCase(reclaimCase);
      render(container, reclaimCase);
    })
  );
}
