// Kopfzeile und "Zurück / Weiter" eines Schritts, gleich für alle Länder.
// Die Reihenfolge kommt aus config/caseSteps.js (nicht aus der Routen-Nummer).
// Seit Stand 2.1: Brotkrume "Schweden 2024 › (2) Bestätigen lassen" (Ziffern
// nur für Phasen) und rechts der Antragsteller-Chip (wer stellt den Antrag,
// privat, Wohnsitz) statt eines Häkchens im Überblick.

import { stepOf } from "../../config/caseSteps.js";
import { neighborStep } from "../../config/caseSteps.js";
import { caseName } from "../../util/caseName.js";
import { getState } from "../../store/store.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const COUNTRY_SHORT = { DE: "DE", AT: "AT", CH: "CH" };

/** Wer stellt den Antrag: "Matthias Hecke · Privat · Wohnsitz DE" mit Link zum Profil */
export function applicantChipHtml(profile) {
  if (!profile) return "";
  const r = profile.residence ?? {};
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Du";
  const country = COUNTRY_SHORT[r.country] ?? r.country ?? "DE";
  return `
    <span class="applicant-chip" title="Für diese Person wird der Antrag gestellt">
      <span class="applicant-avatar">${esc(name.slice(0, 1).toUpperCase())}</span>
      <b>${esc(name)}</b><span class="applicant-meta">· ${profile.heldInPrivateAssets === false ? "Firma" : "Privat"} · Wohnsitz ${esc(country)}</span>
      <a href="#/profile">ändern</a>
    </span>`;
}

export function stepHeaderHtml(steps, reclaimCase, n) {
  const step = stepOf(steps, n);
  // Stand 2.1: unter dem Titel nur noch der Antrag - die Phase steht in der Seitenleiste
  return `
    <div class="content-header step-head">
      <div>
        <h1 class="content-title">${esc(step.heading ?? step.title)}</h1>
        <div class="content-breadcrumb">${esc(caseName(reclaimCase))}</div>
      </div>
      ${applicantChipHtml(getState().currentProfile)}
    </div>`;
}

/**
 * @param {{ nextDisabled?: boolean, nextLabel?: string }} [options]
 *   nextLabel ersetzt "Weiter: <nächster Schritt>"
 */
export function stepNavHtml(steps, n, { nextDisabled = false, nextLabel } = {}) {
  const back = neighborStep(steps, n, -1);
  const next = neighborStep(steps, n, 1);
  return `
    <div class="ch-step-nav">
      ${back ? `<button class="btn-secondary" data-step-back type="button">← Zurück</button>` : "<span></span>"}
      ${next ? `<button class="btn-primary" data-step-next type="button" ${nextDisabled ? "disabled" : ""}>${esc(nextLabel ?? `Weiter: ${next.title}`)} →</button>` : ""}
    </div>`;
}

/**
 * @param {{ go: (n: number) => void, markDone: (n: number) => Promise<void> }} hooks
 */
export function bindStepNav(container, steps, n, { go, markDone }) {
  const back = neighborStep(steps, n, -1);
  const next = neighborStep(steps, n, 1);
  container.querySelector("[data-step-back]")?.addEventListener("click", () => back && go(back.n));
  container.querySelector("[data-step-next]")?.addEventListener("click", async () => {
    await markDone(n);
    if (next) go(next.n);
  });
}
