// Schritt 4 "ePortal ausfüllen" (docs/konzept-schweiz.md §1, §5): Spickzettel
// in der Reihenfolge des ESTV-Portals, mit Kopier-Buttons und Haken (wie das
// SKAT-Cheat-Sheet für Dänemark). EIN Antrag für alle offenen Jahre - im
// Portal unter "Allgemeine Angaben" per Mehrfachauswahl.

import { getState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { chStepRoute } from "../../config/caseSteps.js";
import { computeLots } from "../../lib/holdings.js";
import { shareNames } from "../../util/shareNames.js";
import {
  esc, corridor, saveCase, loadTransactions, entitlementsFor, completeDistributions, isTimeBarred,
  formatChf, formatDatePortal, stepHeader, stepNavHtml, bindStepNav, copyToClipboard,
} from "./chShared.js";

const PAGES = [
  ["general", "Allgemeine Angaben"],
  ["assets", "Vermögenswerte"],
  ["questions", "Fragen"],
  ["additional", "Zusätzliche Angaben"],
  ["review", "Angaben prüfen"],
];

let currentPage = "general";
let transactions = [];

export async function mount(container, reclaimCase) {
  transactions = await loadTransactions(getState().currentProfile);
  render(container, reclaimCase);
}

/** "+49 171 …" -> "0049171…", wie im Portal erwartet */
function phoneForPortal(raw) {
  return String(raw ?? "").trim().replace(/^\+/, "00").replace(/[^\d]/g, "");
}

function questions(profile) {
  const city = profile.residence.city || "Deutschland";
  return [
    [`Waren Sie zum Zeitpunkt der erfassten Fälligkeiten im Sinne des Doppelbesteuerungsabkommens in ${city} ansässig?`, "Ja"],
    ["Waren Sie zum Zeitpunkt der Fälligkeiten an den erfassten Vermögenserträgen nutzungsberechtigt?", "Ja"],
    ["Haben Sie die erfassten Vermögenserträge für eigene Rechnung einkassiert?", "Ja"],
    ["Handelt es sich bei den erfassten Vermögenswerten um Eigenbestände (Nostro / eigenes Wertschriftendepot) und nicht um Bestände von Drittbegünstigten?", "Ja"],
    ["Waren die erfassten Vermögenswerte zum Zeitpunkt der Ertragsfälligkeit Gegenstand von „Securities Lending and Borrowing“-Geschäften?", "Nein"],
    ["Sind Sie für die erfassten Vermögenserträge in Deutschland unbeschränkt steuerpflichtig?", "Ja"],
    ["Stammen die erfassten Vermögenserträge aus einer Erbschaft?", "Nein"],
  ];
}

function row(reclaimCase, id, label, value, { hint, assumption } = {}) {
  const checked = reclaimCase.ch.checkedRows.includes(id);
  if (!value) {
    return `
      <div class="row">
        <input type="checkbox" disabled>
        <div class="row-label">${esc(label)}<span class="en">fehlt – <a href="#" data-go-step="1">in Schritt 1 ergänzen</a></span></div>
        <span class="badge badge-danger">fehlt</span>
        <span></span>
      </div>`;
  }
  return `
    <div class="row ${checked ? "row-done" : ""}">
      <input type="checkbox" data-check="${esc(id)}" ${checked ? "checked" : ""}>
      <div class="row-label">${esc(label)}${hint ? `<span class="en">${esc(hint)}</span>` : ""}</div>
      <div class="row-value ${assumption ? "assumption" : ""}" title="${esc(value)}">${esc(value)}</div>
      <button class="copy-btn" data-copy="${esc(value)}" type="button">⧉</button>
    </div>`;
}

function renderGeneral(reclaimCase, profile, years) {
  const p = (key) => PROFILE_FIELDS[key].read(profile);
  const thisYear = new Date().getFullYear();
  const selectable = [];
  for (let y = thisYear - corridor.limitationPeriodYears; y <= thisYear; y++) selectable.push(y);
  const yearsChecked = reclaimCase.ch.checkedRows.includes("years");
  return `
    <div class="row ch-years-row ${yearsChecked ? "row-done" : ""}">
      <input type="checkbox" data-check="years" ${yearsChecked ? "checked" : ""}>
      <div class="row-label"><b>Für welche Jahre gilt der Antrag?</b>
        <span class="en">Im Portal alle markierten Jahre anhaken – Mehrfachauswahl ist möglich. Markiert sind die Jahre mit erstattungsfähigen Dividenden.</span>
        <div class="ch-year-picks">${selectable
          .map((y) => (years.includes(y) ? `<span class="ch-year-pick on">☑ ${y}</span>` : `<span class="ch-year-pick">☐ ${y}</span>`))
          .join("")}</div>
      </div>
    </div>
    ${row(reclaimCase, "firstName", "Vorname", p("firstName"))}
    ${row(reclaimCase, "lastName", "Nachname", p("lastName"))}
    ${row(reclaimCase, "street", "Strasse", p("address"))}
    ${row(reclaimCase, "postalCode", "PLZ", p("postalCode"))}
    ${row(reclaimCase, "city", "Ort", p("city"))}
    ${row(reclaimCase, "birthDate", "Geburtsdatum", formatDatePortal(p("birthDate")), { hint: "Format TT.MM.JJJJ" })}
    ${row(reclaimCase, "tin", "Steuerliche Identifikationsnummer (IdNr)", p("tin"))}
    ${row(reclaimCase, "taxNumber", "Steuernummer", p("taxNumber"))}`;
}

function entryRow(reclaimCase, id, n, entry) {
  const checked = reclaimCase.ch.checkedRows.includes(id);
  const cell = (value) => `<span class="ch-entry-cell"><span class="row-value">${esc(value)}</span><button class="copy-btn" data-copy="${esc(value)}" type="button">⧉</button></span>`;
  return `
    <div class="ch-entry ${checked ? "row-done" : ""}">
      <input type="checkbox" data-check="${esc(id)}" ${checked ? "checked" : ""}>
      <span class="ch-entry-n">${n}</span>
      ${cell(entry.isin)}
      ${cell(formatDatePortal(entry.acquisitionDate))}
      ${cell(String(entry.quantity))}
      <span class="ch-entry-refund mono">${entry.refund === null ? "–" : formatChf(entry.refund)}</span>
    </div>`;
}

function derivationHtml(dist) {
  const { lots } = computeLots(transactions.filter((t) => t.tradeDate), { isin: dist.isin, cutoffExclusive: dist.exDate });
  const lines = lots.map((l) => {
    const sold = l.sales.map((s) => formatDatePortal(s.tradeDate)).join(", ");
    if (l.remaining === 0) return `Kauf ${formatDatePortal(l.tradeDate)} · ${l.original} Stk. → <span class="ch-fa">vollständig verkauft</span> (${sold}) – entfällt`;
    if (l.remaining < l.original) return `Kauf ${formatDatePortal(l.tradeDate)} · ${l.original} Stk. → <span class="ch-fb">${l.original - l.remaining} verkauft</span> am ${sold} – <b>${l.remaining} Stk.</b> mit Original-Erwerbsdatum`;
    return `Kauf ${formatDatePortal(l.tradeDate)} · ${l.original} Stk. → unverändert`;
  });
  return `
    <details class="ch-derivation">
      <summary>Herleitung anzeigen${lots.some((l) => l.sales.length) ? " (mit Teilverkauf)" : ""}</summary>
      <div>Bestand am Ende des Handelstags vor dem Ex-Tag (${esc(formatDatePortal(dist.exDate))}):<br>${lines.map((l) => `• ${l}`).join("<br>")}</div>
    </details>`;
}

function renderAssets(reclaimCase, results, years) {
  const incomplete = reclaimCase.ch.distributions.filter((d) => !d.isin || !d.paymentDate || !d.exDate);
  const warnings = [];
  if (incomplete.length) warnings.push(`Für ${incomplete.length} ${incomplete.length === 1 ? "Dividende fehlen" : "Dividenden fehlen"} noch Angaben (Aktie, Fälligkeit oder Ex-Tag).`);
  const mismatch = results.filter((r) => r.voucherMatches === false || r.oversold);
  if (mismatch.length) warnings.push("Bei mindestens einer Dividende passen Tax Voucher und Bestand nicht zusammen.");
  let html = warnings.length
    ? `<div class="ch-pane-warning">⚠ ${warnings.join(" ")} <a href="#" data-go-step="3">Schritt 3 prüfen</a></div>`
    : "";
  if (results.length === 0) return html + `<div class="ch-pane-empty">Noch keine vollständigen Dividenden erfasst – bitte zuerst Schritt 3 abschließen.</div>`;

  let total = 0;
  for (const year of years) {
    const ofYear = results.filter((r) => Number(r.distribution.paymentDate.slice(0, 4)) === year);
    const yearRefund = ofYear.reduce((s, r) => s + (r.refund ?? 0), 0);
    html += `<div class="ch-year-head"><span>Jahr ${year}</span><span>${formatChf(yearRefund)}</span></div>`;
    for (const r of ofYear) {
      const d = r.distribution;
      total += r.refund ?? 0;
      html += `
        <div class="share-block-head ch-dist-head">
          <span><b>${esc(shareNames(transactions).nameFor(d.isin) || d.issuerName || d.isin)}</b> · ${esc(d.isin)}</span>
          <span>Fälligkeit <b>${esc(formatDatePortal(d.paymentDate))}</b>${d.grossPerShare ? ` · Brutto ${formatChf(d.grossPerShare)}/Stk.` : ""} · ${r.entries.length} ${r.entries.length === 1 ? "Eintrag" : "Einträge"}</span>
        </div>
        <div class="ch-entry ch-entry-head"><span></span><span>#</span><span>ISIN</span><span>Erwerbsdatum</span><span>Anzahl</span><span>Erstattung</span></div>
        ${r.entries.map((e, i) => entryRow(reclaimCase, `e:${d.distributionId}:${e.depotId}:${e.acquisitionDate}`, i + 1, e)).join("")}
        ${derivationHtml(d)}`;
    }
  }
  html += `<div class="ch-total-row"><span>Erwartete Rückerstattung gesamt (20 % der Bruttodividende)</span><span>${formatChf(total)}</span></div>`;
  return html;
}

function renderReview(results, years) {
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  return `
    <div class="ch-table-wrap"><table>
      <thead><tr><th>Jahr</th><th class="num">Einträge</th><th class="num">Erwartete Erstattung</th></tr></thead>
      <tbody>
        ${years
          .map((y) => {
            const ofYear = results.filter((r) => Number(r.distribution.paymentDate.slice(0, 4)) === y);
            return `<tr><td>${y}</td><td class="num">${ofYear.reduce((s, r) => s + r.entries.length, 0)}</td><td class="num mono">${formatChf(ofYear.reduce((s, r) => s + (r.refund ?? 0), 0))}</td></tr>`;
          })
          .join("")}
        <tr><td><b>Gesamt</b></td><td></td><td class="num mono"><b>${formatChf(total)}</b></td></tr>
      </tbody>
    </table></div>
    <div class="plausibility-check">
      <div class="pc-label">🔍 Vergleich mit „Total beantragte Rückerstattung“ im Portal</div>
      <div class="pc-row">
        <span>Unsere Schätzung: <b>${formatChf(total)}</b></span>
        <span>Portal zeigt: <input type="text" class="pc-input" data-plausi placeholder="CHF"></span>
        <span class="pc-result" data-plausi-result></span>
      </div>
    </div>
    <div class="ch-pane-note">Stimmt alles? Dann im Portal auf <b>„Erstellen“</b> klicken und den Antrag als PDF speichern – weiter mit <a href="#" data-go-step="5">Schritt 5: Formular &amp; Finanzamt</a>.</div>`;
}

function render(container, reclaimCase) {
  const profile = getState().currentProfile;
  const results = entitlementsFor(reclaimCase, transactions, profile);
  const years = [...new Set(completeDistributions(reclaimCase).filter((d) => !isTimeBarred(d.paymentDate)).map((d) => Number(d.paymentDate.slice(0, 4))))].sort();
  const pageIdx = PAGES.findIndex(([id]) => id === currentPage);

  let body = "";
  if (currentPage === "general") body = renderGeneral(reclaimCase, profile, years);
  if (currentPage === "assets") body = renderAssets(reclaimCase, results, years);
  if (currentPage === "questions") {
    body =
      questions(profile).map(([q, a], i) => row(reclaimCase, `q${i}`, q, a, { assumption: true })).join("") +
      `<div class="ch-pane-warning ch-pane-warning-soft">Trifft eine Antwort bei Ihnen nicht zu (z.B. Aktien geerbt oder verliehen), ist das ein Sonderfall, den DivRebound nicht abdeckt. Bitte lassen Sie sich dann beraten.</div>`;
  }
  if (currentPage === "additional") {
    const p = (key) => PROFILE_FIELDS[key].read(profile);
    body = `
      ${row(reclaimCase, "email", "E-Mail", p("email"), { hint: "Kontaktperson" })}
      ${row(reclaimCase, "phone", "Telefonnummer", phoneForPortal(p("phone")), { hint: "mit 0049 statt +49" })}
      ${row(reclaimCase, "iban", "IBAN", p("iban"))}
      ${row(reclaimCase, "holder", "Name des Kontoinhabers", p("accountHolderName"))}`;
  }
  if (currentPage === "review") body = renderReview(results, years);

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 4)}
    <div class="info-banner"><span class="icon">🔗</span><div>
      Öffnen Sie das ePortal, melden Sie sich an und wählen Sie die Kachel <b>„Verrechnungssteuer“</b> → <b>Neuen Antrag anlegen</b>. Ein Antrag kann <b>mehrere Jahre</b> umfassen. Die Reiter unten folgen der Reihenfolge im Portal.
      <div style="margin-top:8px;"><a class="btn-accent btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a></div>
    </div></div>

    <div class="page-tabs">
      ${PAGES.map(([id, label], i) => `<div class="page-tab ${id === currentPage ? "active" : ""}" data-page="${id}">${i < pageIdx ? '<span class="done-mark">✓</span>' : `${i + 1}.`} ${label}</div>`).join("")}
    </div>

    <div class="pane">
      <div class="pane-head"><span class="pane-title">${PAGES[pageIdx][1]}</span></div>
      ${body}
    </div>

    <div class="ch-pane-nav">
      ${pageIdx > 0 ? `<button class="btn-secondary" data-page="${PAGES[pageIdx - 1][0]}" type="button">← ${PAGES[pageIdx - 1][1]}</button>` : "<span></span>"}
      ${pageIdx < PAGES.length - 1 ? `<button class="btn-secondary" data-page="${PAGES[pageIdx + 1][0]}" type="button">${PAGES[pageIdx + 1][1]} →</button>` : ""}
    </div>

    ${stepNavHtml(4)}
    </div>`;

  bindStepNav(container, reclaimCase, 4);
  container.querySelectorAll("[data-page]").forEach((el) =>
    el.addEventListener("click", () => {
      currentPage = el.dataset.page;
      render(container, reclaimCase);
    })
  );
  container.querySelectorAll("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      copyToClipboard(btn, btn.dataset.copy);
      const box = btn.closest(".row, .ch-entry")?.querySelector("[data-check]");
      if (box && !box.checked) {
        box.checked = true;
        box.dispatchEvent(new Event("change"));
      }
    })
  );
  container.querySelectorAll("[data-check]").forEach((box) =>
    box.addEventListener("change", async () => {
      const id = box.dataset.check;
      const set = new Set(reclaimCase.ch.checkedRows);
      box.checked ? set.add(id) : set.delete(id);
      reclaimCase.ch.checkedRows = [...set];
      box.closest(".row, .ch-entry")?.classList.toggle("row-done", box.checked);
      await saveCase(reclaimCase);
    })
  );
  container.querySelectorAll("[data-go-step]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(chStepRoute(reclaimCase.caseId, Number(a.dataset.goStep)));
    })
  );
  const plausi = container.querySelector("[data-plausi]");
  plausi?.addEventListener("input", () => {
    const out = container.querySelector("[data-plausi-result]");
    const v = Number(plausi.value.replace(/[^\d,.-]/g, "").replace(",", "."));
    const expected = results.reduce((s, r) => s + (r.refund ?? 0), 0);
    if (!plausi.value.trim() || !Number.isFinite(v)) {
      out.textContent = "";
      out.className = "pc-result";
      return;
    }
    const ok = Math.abs(v - expected) < 0.01;
    out.textContent = ok ? "✓ stimmt überein" : `Abweichung ${formatChf(v - expected)} – Einträge prüfen`;
    out.className = `pc-result ${ok ? "pc-ok" : "pc-warn"}`;
  });
}
