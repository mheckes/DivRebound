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
import { CH_STEPS, chStepRoute } from "../../config/caseSteps.js";

const STATUS_LABELS = {
  draft: "In Bearbeitung — Ausschüttungen erfassen",
  residency_form_generated: "Formular erzeugt — wartet auf Finanzamt",
  awaiting_tax_office: "Wartet auf Bestätigung durch Finanzamt",
  ready_for_skat_submission: "Bereit für das SKAT-Portal",
  skat_form_verified: "SKAT-Formular verifiziert — Cheat Sheet offen",
  submitted: "Eingereicht",
};

// Schweiz: erster noch nicht erledigter Schritt (bzw. der letzte, wenn abgeschlossen).
function nextSwissStep(reclaimCase) {
  if (reclaimCase.ch?.completedAt) return CH_STEPS[CH_STEPS.length - 1];
  const done = new Set(reclaimCase.ch?.stepsDone ?? []);
  return CH_STEPS.find((s) => !done.has(s.n)) ?? CH_STEPS[CH_STEPS.length - 1];
}

function statusLabel(reclaimCase) {
  if (reclaimCase.targetCountry === "CH") {
    return reclaimCase.ch?.completedAt ? "Abgeschlossen" : `Schritt ${nextSwissStep(reclaimCase).n}: ${nextSwissStep(reclaimCase).title}`;
  }
  return STATUS_LABELS[reclaimCase.status] ?? reclaimCase.status;
}

const COUNTRY_LABELS = { DK: "Dänemark", CH: "Schweiz" };

function continueRoute(reclaimCase) {
  if (reclaimCase.targetCountry === "CH") return chStepRoute(reclaimCase.caseId, nextSwissStep(reclaimCase).n);
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
      // Noch nichts erfasst und Schritt 1 nicht abgeschlossen: bei "Unterlagen prüfen" beginnen.
      return !reclaimCase.dkStepsDone?.includes(1) && reclaimCase.distributions.length === 0
        ? `#/dk/${reclaimCase.caseId}/checklist`
        : `#/dk/${reclaimCase.caseId}/step1`;
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
  const allCases = state.cases;
  const cases = allCases.filter((c) => c.targetCountry === "DK");
  const swissCases = allCases.filter((c) => c.targetCountry === "CH");
  const completedCount = cases.filter((c) => c.status === "submitted").length + swissCases.filter((c) => c.ch?.completedAt).length;
  // Tatsächlich erhaltene Erstattungen (optional im letzten Schritt eingetragen)
  const receivedEur = swissCases.reduce((sum, c) => sum + (Number(String(c.ch?.receivedRefund?.amountEur ?? "").replace(",", ".")) || 0), 0);
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
  const mostRecent = [...allCases].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0] ?? null;
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
          ${cases.length ? `${formatNumberDe(totalRefund)} DKK bestätigte Erstattung Dänemark<br>` : ""}
          ${receivedEur ? `${formatNumberDe(receivedEur)} EUR erhalten (Schweiz)` : ""}
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
