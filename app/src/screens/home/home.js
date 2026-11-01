// Startseite (#/home): Kachel-Übersicht als zentraler, immer erreichbarer
// Einstiegspunkt - auch bevor überhaupt ein Profil existiert (siehe main.js
// Bootstrap). Zwei gleichwertige Wege, ein Profil anzulegen: über die
// "Neuer DivRebound"-Kachel (Popup-Dialog in components/newCaseWizard.js,
// legt Profil+ersten Fall zusammen an) ODER direkt über "Nutzerprofil
// bearbeiten" (screens/profile/profile.js legt bei Bedarf ein leeres Profil
// an, ganz ohne Fall) - je nachdem, was der Nutzer zuerst tun möchte.

import { getState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import { corridors } from "../../config/corridors.js";
import { formatNumberDe } from "../../util/format.js";
import { openNewCaseWizard } from "../../components/newCaseWizard.js";
import { nextStep, stepRoute } from "../../util/caseNav.js";
import { isSubmitted, submittedAt, refundReceived, parseAmount, monthsBetween } from "../../util/caseProgress.js";
import { isEligible, totalRefund } from "../../lib/withholding.js";

const COUNTRY_LABELS = { DK: "Dänemark", CH: "Schweiz", IT: "Italien" };

function statusLabel(reclaimCase) {
  if (isSubmitted(reclaimCase)) return refundReceived(reclaimCase).received ? "Abgeschlossen, Erstattung erhalten" : "Abgeschlossen";
  const step = nextStep(reclaimCase);
  return `Schritt ${step.n}: ${step.title}`;
}

/** Erwartete Erstattung aus den bestätigten Ausschüttungen (DK in DKK, IT in EUR) */
function expectedRefund(reclaimCase, residenceCountry) {
  const corridor = corridors[reclaimCase.targetCountry];
  const eligible = reclaimCase.distributions.filter((d) => isEligible(d, corridor, { residenceCountry }));
  return totalRefund(eligible, corridor, residenceCountry);
}

/**
 * Statistik über alle Fälle: erhaltene Erstattungen (optionaler letzter
 * Schritt), durchschnittliche Wartezeit ab Einreichung und Mehrbetrag
 * gegenüber der Erwartung (nur wo in EUR erstattet wird, z.B. durch Zinsen).
 */
function statistics(cases, residenceCountry) {
  let receivedEur = 0;
  let receivedCount = 0;
  let extraEur = 0;
  const waits = [];
  for (const c of cases) {
    const r = refundReceived(c);
    if (!r.received) continue;
    const amount = parseAmount(r.amountEur);
    if (amount !== null) {
      receivedEur += amount;
      receivedCount += 1;
      if (corridors[c.targetCountry].nativeCurrency === "EUR") extraEur += Math.max(0, amount - expectedRefund(c, residenceCountry));
    }
    const months = monthsBetween(submittedAt(c)?.slice(0, 10), r.date);
    if (months !== null) waits.push(months);
  }
  const avgWait = waits.length ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length) : null;
  return { receivedEur, receivedCount, extraEur: Math.round(extraEur * 100) / 100, avgWait };
}

function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(container) {
  const state = getState();
  const profile = state.currentProfile;
  const allCases = state.cases;
  const residence = profile?.residence?.country;
  const completedCount = allCases.filter(isSubmitted).length;
  const stats = statistics(allCases, residence);
  const openDkk = allCases.filter((c) => c.targetCountry === "DK" && !refundReceived(c).received).reduce((sum, c) => sum + expectedRefund(c, residence), 0);
  const openEur = allCases.filter((c) => c.targetCountry === "IT" && !refundReceived(c).received).reduce((sum, c) => sum + expectedRefund(c, residence), 0);
  const mostRecent = [...allCases].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0] ?? null;
  const greetingName = profile?.residence?.firstName ? `, ${escapeHtml(profile.residence.firstName)}` : "";

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title" data-feedback-skip>Willkommen${profile ? " zurück" + greetingName : " bei DivRebound"}</h1>
      <div class="content-breadcrumb">Startseite</div>
    </div>

    <div class="home-tiles">
      <div class="home-tile" data-action="new-case">
        <div class="home-tile-icon">＋</div>
        <div class="home-tile-title">Neuer DivRebound</div>
        <div class="home-tile-desc">Eine neue Quellensteuer-Rückforderung starten.</div>
      </div>

      <div class="home-tile" data-nav="#/profile">
        <div class="home-tile-icon">👤</div>
        <div class="home-tile-title">Nutzerprofil bearbeiten</div>
        <div class="home-tile-desc">Persönliche Daten, Bankverbindung und Finanzamt verwalten.</div>
      </div>

      <div class="home-tile ${mostRecent ? "" : "home-tile-disabled"}" ${mostRecent ? `data-nav="${stepRoute(mostRecent, nextStep(mostRecent).n)}"` : ""}>
        <div class="home-tile-icon">↻</div>
        <div class="home-tile-title">Letzte Bearbeitung fortsetzen</div>
        <div class="home-tile-desc">
          ${
            mostRecent
              ? `${escapeHtml(COUNTRY_LABELS[mostRecent.targetCountry] ?? "")} · ${escapeHtml(caseLabel(mostRecent))} — ${escapeHtml(statusLabel(mostRecent))}`
              : "Noch kein Fall angelegt."
          }
        </div>
      </div>

      <div class="home-tile home-tile-static">
        <div class="home-tile-icon">📊</div>
        <div class="home-tile-title">Statistik</div>
        <div class="home-tile-desc">
          ${allCases.length} DivRebound${allCases.length === 1 ? "" : "s"} angelegt, davon ${completedCount} abgeschlossen<br>
          ${openDkk ? `${formatNumberDe(openDkk)} DKK Erstattung ausstehend (Dänemark)<br>` : ""}
          ${openEur ? `${formatNumberDe(openEur)} EUR Erstattung ausstehend (Italien)<br>` : ""}
          ${stats.receivedCount ? `${formatNumberDe(stats.receivedEur)} EUR erhalten (${stats.receivedCount} ${stats.receivedCount === 1 ? "Erstattung" : "Erstattungen"})<br>` : ""}
          ${stats.extraEur ? `davon ${formatNumberDe(stats.extraEur)} EUR mehr als erwartet (z. B. Zinsen)<br>` : ""}
          ${stats.avgWait !== null ? `Ø Wartezeit bis zur Auszahlung: ${stats.avgWait} ${stats.avgWait === 1 ? "Monat" : "Monate"}` : ""}
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });
  container.querySelector('[data-action="new-case"]').addEventListener("click", () => openNewCaseWizard());
}

export function mount(container) {
  render(container);
}
