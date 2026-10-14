// Schritt 1 "Unterlagen prüfen" (docs/konzept-schweiz.md §2, §2a).
// Keine eigene Datenhaltung: Persönliche Daten kommen aus dem Profil und
// werden hier - wie in "Persönliche Daten" - direkt bearbeitet und
// automatisch gespeichert (util/autosave.js). Käufe/Verkäufe aus dem
// Wertpapierbestand, alles andere aus dem Fall.

import { getState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { confirmedFieldClasses } from "../../util/fieldDisplay.js";
import { bindProfileAutosave } from "../../util/autosave.js";
import { formatDateDe } from "../../util/format.js";
import { openGuideModal } from "../../components/guideModal.js";
import { chStepRoute } from "../../config/caseSteps.js";
import { esc, corridor, saveCase, loadTransactions, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

const PROFILE_ITEMS = [
  { label: "Name", fields: [["firstName", "Vorname"], ["lastName", "Nachname"]] },
  { label: "Adresse", fields: [["address", "Straße und Hausnummer", "wide"], ["postalCode", "PLZ"], ["city", "Ort"]] },
  { label: "Geburtsdatum", fields: [["birthDate", "", "date"]] },
  { label: "Steuer-ID", fields: [["tin", "z.B. 86095742719", "mono"]] },
  { label: "Steuernummer", fields: [["taxNumber", "z.B. 143/123/45678", "mono"]] },
  { label: "Finanzamt", fields: [["taxOfficeName", "Name des Finanzamts", "wide"], ["taxOfficeStreet", "Straße", "wide"], ["taxOfficePostalCode", "PLZ"], ["taxOfficeCity", "Ort"]] },
  { label: "Kontakt", fields: [["email", "E-Mail"], ["phone", "Telefon inkl. Ländervorwahl"]] },
  { label: "Bankverbindung", fields: [["iban", "IBAN", "mono wide"], ["accountHolderName", "Kontoinhaber"]] },
];

const SYMBOL = { ok: "✓", missing: "!", check: "?", later: "…" };

const isFilled = (profile, item) => item.fields.every(([key]) => PROFILE_FIELDS[key].read(profile).trim() !== "");

export async function mount(container, reclaimCase) {
  const profile = getState().currentProfile;
  const transactions = await loadTransactions(profile);
  render(container, reclaimCase, profile, transactions);
  return bindProfileAutosave(container, {
    getProfile: () => getState().currentProfile,
    onSaved: (updated) => updateStates(container, updated),
  });
}

function itemRow(state, label, valueHtml, actionsHtml = "", attrs = "") {
  return `
    <div class="ch-check-item ${state}" ${attrs}>
      <span class="ch-state ${state}">${SYMBOL[state]}</span>
      <span class="ch-check-label">${esc(label)}</span>
      <div class="ch-check-value">${valueHtml}</div>
      <div class="ch-check-actions">${actionsHtml}</div>
    </div>`;
}

function profileRow(profile, item, index) {
  const inputs = item.fields
    .map(([key, placeholder, extra = ""]) => {
      const value = PROFILE_FIELDS[key].read(profile);
      const type = extra.includes("date") ? "date" : "text";
      return `<input class="${confirmedFieldClasses(value).inputClass} ch-inline ${extra.replace("date", "")}" type="${type}" data-field="${key}" placeholder="${esc(placeholder)}" value="${esc(value)}">`;
    })
    .join("");
  const errors = item.fields.map(([key]) => `<span class="field-error" data-error-for="${key}" hidden></span>`).join("");
  return itemRow(isFilled(profile, item) ? "ok" : "missing", item.label, `<div class="ch-inline-fields">${inputs}</div>${errors}`, "", `data-profile-item="${index}"`);
}

function render(container, reclaimCase, profile, transactions) {
  const lastTx = [...transactions].filter((t) => t.tradeDate).sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0];
  const accessState = reclaimCase.ch.portalAccess ? "ok" : "check";

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 1)}
    <p class="ch-lead">Die Rückerstattung der Schweizer Verrechnungssteuer läuft vollständig über das ePortal der Eidgenössischen Steuerverwaltung. DivRebound bereitet alle Angaben so vor, dass Sie sie dort nur noch übertragen müssen. Was schon in Ihren persönlichen Daten steht, ist bereits abgehakt.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Checkliste</span><span class="count-pill" data-summary></span></div>

      <div class="ch-check-group">Zugang</div>
      ${itemRow(
        accessState,
        "ePortal-Zugang",
        `<span class="ch-check-text">Eigenes Konto bei eportal.admin.ch. Noch keins? Mit der Anleitung in wenigen Minuten angelegt.</span>`,
        `<a class="btn-secondary btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>
         <button class="btn-secondary btn-small" data-guide="account" type="button">Anleitung</button>
         <label class="ch-check-toggle"><input type="checkbox" data-portal-access ${reclaimCase.ch.portalAccess ? "checked" : ""}> vorhanden</label>`,
        'data-access-item'
      )}

      <div class="ch-check-group">Persönliche Daten</div>
      ${PROFILE_ITEMS.map((item, i) => profileRow(profile, item, i)).join("")}
      <div class="ch-autosave-row autosave-note">✓ Zum Ändern ins Feld klicken – Änderungen werden automatisch in Ihren persönlichen Daten gespeichert.</div>

      <div class="ch-check-group">Depot</div>
      ${
        transactions.length
          ? itemRow("check", "Käufe und Verkäufe", `<span class="ch-check-text">${transactions.length} Transaktionen erfasst${lastTx ? ` · letzte am ${esc(formatDateDe(lastTx.tradeDate))}` : ""} · seitdem etwas gekauft oder verkauft?</span>`, `<button class="btn-secondary btn-small" data-go-step="2" type="button">Bestand prüfen</button>`)
          : itemRow("missing", "Käufe und Verkäufe", `<span class="ch-check-text">Noch keine erfasst. Alle Käufe und Verkäufe Ihrer Schweizer Aktien ab dem ersten Kauf – per Abrechnung oder manuell.</span>`, `<button class="btn-primary btn-small" data-go-step="2" type="button">Erfassen</button>`)
      }

      <div class="ch-check-group">Dividenden</div>
      ${itemRow("later", "Tax Voucher", `<span class="ch-check-text">Pro Dividende einer, von Ihrer Bank. Kommen teils erst Wochen nach der Zahlung.</span>`, `<span class="badge badge-extracted">Schritt 3</span>`)}
      ${itemRow("later", "Dividendenabrechnungen", `<span class="ch-check-text">Optional. Liefern Dividendentermin und Bruttobetrag.</span>`, `<span class="badge badge-extracted">Schritt 3</span>`)}
    </div>

    <div class="ch-two-col">
      <div class="card"><div class="card-head"><span class="card-title">Das übernimmt DivRebound</span></div><div class="card-body"><ul class="ch-list">
        <li>Bestand aus Ihren Abrechnungen berechnen (FIFO)</li>
        <li>Liste der Vermögenswerte fürs ePortal</li>
        <li>Abgleich mit den Tax Vouchern</li>
        <li>Antworten auf die Fragen im Portal</li>
        <li>Anschreiben ans Finanzamt</li>
      </ul></div></div>
      <div class="card"><div class="card-head"><span class="card-title">Das machen Sie selbst</span></div><div class="card-body"><ul class="ch-list">
        <li>Im ePortal anmelden (eigener Zugang)</li>
        <li>Angaben ins Portal übertragen</li>
        <li>Antrag ausdrucken und unterschreiben</li>
        <li>Beim Finanzamt bestätigen lassen</li>
        <li>Bestätigten Antrag im ePortal hochladen</li>
      </ul></div></div>
    </div>

    ${stepNavHtml(1)}
    </div>`;

  updateSummary(container);
  bindStepNav(container, reclaimCase, 1);
  container.querySelector('[data-guide="account"]').addEventListener("click", () => openGuideModal("account"));
  container.querySelectorAll("[data-go-step]").forEach((btn) => btn.addEventListener("click", () => navigate(chStepRoute(reclaimCase.caseId, Number(btn.dataset.goStep)))));
  container.querySelector("[data-portal-access]").addEventListener("change", async (e) => {
    reclaimCase.ch.portalAccess = e.target.checked;
    await saveCase(reclaimCase);
    setItemState(container.querySelector("[data-access-item]"), e.target.checked ? "ok" : "check");
    updateSummary(container);
  });
}

function setItemState(item, state) {
  item.classList.remove("ok", "missing", "check", "later");
  item.classList.add(state);
  const badge = item.querySelector(".ch-state");
  badge.className = `ch-state ${state}`;
  badge.textContent = SYMBOL[state];
}

/** Nach automatischem Speichern: nur Zustände aktualisieren, nicht neu rendern (Fokus bleibt). */
function updateStates(container, profile) {
  container.querySelectorAll("[data-profile-item]").forEach((item) => {
    setItemState(item, isFilled(profile, PROFILE_ITEMS[Number(item.dataset.profileItem)]) ? "ok" : "missing");
  });
  updateSummary(container);
}

function updateSummary(container) {
  const items = [...container.querySelectorAll(".ch-check-item")];
  const ok = items.filter((i) => i.classList.contains("ok")).length;
  container.querySelector("[data-summary]").textContent = `${ok} von ${items.length} vorhanden`;
}
