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

const STATUS_LABELS = {
  draft: "In Bearbeitung — Ausschüttungen erfassen",
  residency_form_generated: "Formular erzeugt — wartet auf Finanzamt",
  awaiting_tax_office: "Wartet auf Bestätigung durch Finanzamt",
  ready_for_skat_submission: "Bereit für das SKAT-Portal",
  skat_form_verified: "SKAT-Formular verifiziert — Cheat Sheet offen",
  submitted: "Eingereicht",
};

function continueRoute(reclaimCase) {
  switch (reclaimCase.status) {
    case "residency_form_generated":
    case "awaiting_tax_office":
      return `#/dk/${reclaimCase.caseId}/step1/summary`;
    case "ready_for_skat_submission":
      return `#/dk/${reclaimCase.caseId}/step2/verify`;
    case "skat_form_verified":
    case "submitted":
      return `#/dk/${reclaimCase.caseId}/step2/cheatsheet`;
    default:
      return `#/dk/${reclaimCase.caseId}/step1`;
  }
}

function refundAmount(distribution, corridor, residenceCountry) {
  const treatyRate = corridor.treatyRateByResidence[residenceCountry] ?? 0.15;
  return distribution.grossDividend * (corridor.standardWithholdingRate - treatyRate);
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
  const cases = state.cases.filter((c) => c.targetCountry === "DK");
  const corridor = corridors.DK;

  const totalRefund = profile
    ? cases.reduce(
        (sum, c) =>
          sum +
          c.distributions
            .filter((d) => d.extractionConfidence !== "extracted")
            .reduce((s, d) => s + refundAmount(d, corridor, profile.residence.country), 0),
        0
      )
    : 0;
  const mostRecent = [...cases].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0] ?? null;
  const greetingName = profile?.residence?.firstName ? `, ${escapeHtml(profile.residence.firstName)}` : "";

  container.innerHTML = `
    <div class="content-header">
      <h1 class="content-title">Willkommen${profile ? " zurück" + greetingName : " bei DivRebound"}</h1>
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

      <div class="home-tile ${mostRecent ? "" : "home-tile-disabled"}" ${mostRecent ? `data-nav="${continueRoute(mostRecent)}"` : ""}>
        <div class="home-tile-icon">↻</div>
        <div class="home-tile-title">Letzte Bearbeitung fortsetzen</div>
        <div class="home-tile-desc">
          ${
            mostRecent
              ? `${escapeHtml(caseLabel(mostRecent))} — ${escapeHtml(STATUS_LABELS[mostRecent.status] ?? mostRecent.status)}`
              : "Noch kein Fall angelegt."
          }
        </div>
      </div>

      <div class="home-tile home-tile-static">
        <div class="home-tile-icon">📊</div>
        <div class="home-tile-title">Statistik</div>
        <div class="home-tile-desc">
          ${cases.length} DivRebound${cases.length === 1 ? "" : "s"} angelegt<br>
          ${formatNumberDe(totalRefund)} DKK bestätigte Erstattung (über alle Fälle)
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
