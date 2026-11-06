// Optionaler letzter Schritt "Erstattung erhalten" - gleich für Dänemark,
// Schweiz und Italien. Der Nutzer hält fest, ob, wann und in welcher Höhe die
// Erstattung angekommen ist. Der Betrag kann höher sein als erwartet, z.B.
// weil die Wartezeit verzinst wird. Fließt in die Statistik auf der
// Startseite ein (Summe, Wartezeit, Mehrbetrag).

import { formatDateDe } from "../../util/format.js";
import { submittedAt, refundReceived, parseAmount, monthsBetween } from "../../util/caseProgress.js";
import { showToast } from "../../components/toast.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const eur = (v) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function factsHtml(reclaimCase, expected) {
  const r = refundReceived(reclaimCase);
  const submitted = submittedAt(reclaimCase);
  const amount = parseAmount(r.amountEur);
  const rows = [];
  rows.push(["Eingereicht am", submitted ? formatDateDe(submitted.slice(0, 10)) : "noch nicht"]);
  if (expected?.label) rows.push(["Erwartete Erstattung", expected.label]);
  if (r.received && r.date && submitted) {
    const months = monthsBetween(submitted.slice(0, 10), r.date);
    if (months !== null) rows.push(["Wartezeit", `${months} ${months === 1 ? "Monat" : "Monate"}`]);
  }
  if (r.received && amount !== null && expected?.eur) {
    const diff = Math.round((amount - expected.eur) * 100) / 100;
    if (Math.abs(diff) >= 0.01) rows.push([diff > 0 ? "Mehr als erwartet" : "Weniger als erwartet", `${diff > 0 ? "+" : "−"}${eur(Math.abs(diff))}${diff > 0 ? " (z. B. Zinsen)" : ""}`]);
  }
  return rows.map(([label, value]) => `<div class="refund-fact"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
}

/**
 * @param {ReclaimCase} reclaimCase
 * @param {{ headerHtml: string, navHtml: string, expected?: { label: string, eur?: number } }} options
 */
export function refundReceivedHtml(reclaimCase, { headerHtml, navHtml, expected }) {
  const r = refundReceived(reclaimCase);
  const submitted = Boolean(submittedAt(reclaimCase));
  return `
    <div class="ch-page">
    ${headerHtml}
    <p class="ch-lead"><b>Optional:</b> Halte fest, ob und wann die Erstattung angekommen ist und wie hoch sie war. Die Angaben fließen in deine Statistik ein.</p>
    ${submitted ? "" : `<div class="info-banner"><span class="icon">ℹ</span><div>Dieser DivRebound ist noch nicht als eingereicht markiert. Du kannst die Angaben trotzdem schon eintragen.</div></div>`}

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Erstattung</span><span class="ch-head-sub">optional</span></div>
      <div class="card-body">
        <div class="refund-choice" role="radiogroup" aria-label="Erstattung erhalten?">
          <label class="refund-option ${r.received ? "" : "selected"}"><input type="radio" name="refund-received" value="no" ${r.received ? "" : "checked"}> Noch nicht erhalten</label>
          <label class="refund-option ${r.received ? "selected" : ""}"><input type="radio" name="refund-received" value="yes" ${r.received ? "checked" : ""}> Erhalten</label>
        </div>
        ${
          r.received
            ? `<div class="ch-received">
                <div class="field-row"><label class="field-label" for="refund-date">Erhalten am</label><input id="refund-date" class="field-input" type="date" data-refund="date" value="${esc(r.date)}"></div>
                <div class="field-row"><label class="field-label" for="refund-amount">Betrag (EUR)</label><input id="refund-amount" class="field-input mono" inputmode="decimal" data-refund="amountEur" placeholder="${esc(expected?.eur ? eur(expected.eur).replace(" €", "") : "z.B. 42,80")}" value="${esc(r.amountEur)}"></div>
              </div>
              <div class="field-hint">Betrag so, wie er auf deinem Konto eingegangen ist, inklusive etwaiger Verzugszinsen.</div>`
            : ""
        }
        <div class="refund-facts">${factsHtml(reclaimCase, expected)}</div>
      </div>
    </div>

    ${pausePanelHtml(reclaimCase, r.received ? "done" : "payout")}

    ${navHtml}
    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {ReclaimCase} reclaimCase
 * @param {{ save: (reclaimCase: ReclaimCase) => Promise<void>, rerender: () => void }} hooks
 */
export function bindRefundReceived(container, reclaimCase, { save, rerender }) {
  bindPausePanel(container, reclaimCase);
  container.querySelectorAll('input[name="refund-received"]').forEach((radio) =>
    radio.addEventListener("change", async () => {
      reclaimCase.refundReceived = { ...refundReceived(reclaimCase), received: radio.value === "yes" };
      await save(reclaimCase);
      rerender();
    })
  );
  container.querySelectorAll("[data-refund]").forEach((input) =>
    input.addEventListener("change", async () => {
      const key = input.dataset.refund;
      if (key === "amountEur" && input.value.trim() && parseAmount(input.value) === null) {
        showToast("Bitte einen Betrag wie 42,80 eingeben");
        return;
      }
      reclaimCase.refundReceived = { ...refundReceived(reclaimCase), received: true, [key]: input.value.trim() };
      await save(reclaimCase);
      showToast(`✓ ${key === "date" ? "Datum" : "Betrag"} gespeichert`);
      rerender();
    })
  );
}
