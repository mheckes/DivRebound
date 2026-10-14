// Schritt 1 "Unterlagen prüfen" (docs/konzept-schweiz.md §2, §2a).
// Keine eigene Datenhaltung: Persönliche Daten kommen aus dem Profil und
// werden hier - wie in "Persönliche Daten" - direkt bearbeitet und
// automatisch gespeichert (components/checklist.js). Käufe/Verkäufe aus dem
// Wertpapierbestand, alles andere aus dem Fall.

import { getState, setState } from "../../store/store.js";
import * as profileRepo from "../../db/profileRepo.js";
import { navigate } from "../../router/router.js";
import { formatDateDe } from "../../util/format.js";
import { openGuideModal } from "../../components/guideModal.js";
import {
  PROFILE_ITEM, profileRow, textRow, setRowState, updateChecklistSummary, bindChecklistAutosave, AUTOSAVE_ROW,
} from "../../components/checklist.js";
import { chStepRoute } from "../../config/caseSteps.js";
import { corridor, loadTransactions, stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

const PROFILE_ITEMS = ["name", "address", "birthDate", "tin", "taxNumber", "taxOffice", "contact", "bank"].map((k) => PROFILE_ITEM[k]);

export async function mount(container, reclaimCase) {
  const profile = getState().currentProfile;
  const transactions = await loadTransactions(profile);
  render(container, reclaimCase, profile, transactions);
  return bindChecklistAutosave(container);
}

/**
 * "ePortal-Zugang vorhanden" gehört zum Nutzer, nicht zum einzelnen Fall:
 * einmal abgehakt, gilt es für alle weiteren DivRebounds (profile.chPortalAccess).
 * Ältere Fälle hatten den Haken im Fall gespeichert - der zählt weiterhin.
 */
const hasPortalAccess = (profile, reclaimCase) => Boolean(profile.chPortalAccess ?? reclaimCase.ch.portalAccess);

function render(container, reclaimCase, profile, transactions) {
  const portalAccess = hasPortalAccess(profile, reclaimCase);
  const lastTx = [...transactions].filter((t) => t.tradeDate).sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0];

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 1)}
    <p class="ch-lead">Die Rückerstattung der Schweizer Verrechnungssteuer läuft vollständig über das ePortal der Eidgenössischen Steuerverwaltung. DivRebound bereitet alle Angaben so vor, dass Sie sie dort nur noch übertragen müssen. Was schon in Ihren persönlichen Daten steht, ist bereits abgehakt.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Checkliste</span><span class="count-pill" data-summary></span></div>

      <div class="ch-check-group">Zugang</div>
      ${textRow(
        portalAccess ? "ok" : "check",
        "ePortal-Zugang",
        "Eigenes Konto bei eportal.admin.ch.",
        `<a class="btn-secondary btn-small" href="${corridor.onlinePortalUrl}" target="_blank" rel="noopener">ePortal öffnen ↗</a>
         <button class="btn-secondary btn-small" data-guide="account" type="button">Anleitung</button>
         <label class="ch-check-toggle"><input type="checkbox" data-portal-access ${portalAccess ? "checked" : ""}> vorhanden</label>`,
        "data-access-item"
      )}

      <div class="ch-check-group">Persönliche Daten</div>
      ${PROFILE_ITEMS.map((item) => profileRow(profile, item)).join("")}
      ${AUTOSAVE_ROW}

      <div class="ch-check-group">Depot</div>
      ${
        transactions.length
          ? textRow("check", "Käufe und Verkäufe", `${transactions.length} Transaktionen erfasst${lastTx ? ` · letzte am ${formatDateDe(lastTx.tradeDate)}` : ""} · seitdem etwas gekauft oder verkauft?`, `<button class="btn-secondary btn-small" data-go-step="2" type="button">Bestand prüfen</button>`)
          : textRow("missing", "Käufe und Verkäufe", "Noch keine erfasst. Alle Käufe und Verkäufe Ihrer Schweizer Aktien ab dem ersten Kauf – per Abrechnung oder manuell.", `<button class="btn-primary btn-small" data-go-step="2" type="button">Erfassen</button>`)
      }

      <div class="ch-check-group">Dividenden</div>
      ${textRow("later", "Tax Voucher", "Pro Dividende einer, von Ihrer Bank. Kommen teils erst Wochen nach der Zahlung.", `<span class="badge badge-extracted">Schritt 3</span>`)}
      ${textRow("later", "Dividendenabrechnungen", "Optional. Liefern Dividendentermin und Bruttobetrag.", `<span class="badge badge-extracted">Schritt 3</span>`)}
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

  updateChecklistSummary(container);
  bindStepNav(container, reclaimCase, 1);
  container.querySelector('[data-guide="account"]').addEventListener("click", () => openGuideModal("account"));
  container.querySelectorAll("[data-go-step]").forEach((btn) => btn.addEventListener("click", () => navigate(chStepRoute(reclaimCase.caseId, Number(btn.dataset.goStep)))));
  container.querySelector("[data-portal-access]").addEventListener("change", async (e) => {
    const updated = { ...getState().currentProfile, chPortalAccess: e.target.checked };
    await profileRepo.put(updated);
    setState({ currentProfile: updated });
    setRowState(container.querySelector("[data-access-item]"), e.target.checked ? "ok" : "check");
    updateChecklistSummary(container);
  });
}
