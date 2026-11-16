// Seitenleiste: Logo mit Beta-Tag (Klick = Übersicht), Übersicht, Profil und - sobald ein Antrag
// geöffnet ist - dessen Schritte, gruppiert nach den drei Phasen
// (config/caseSteps.js). Alle Anträge stehen auf der Startseite, nicht hier.
// Unten das Konto-Feld: heute "Daten nur in diesem Browser" mit Sicherung als
// Datei, später der Platz für Anmelden/Abmelden.

import { getState, setState, subscribe } from "../store/store.js";
import { navigate } from "../router/router.js";
import * as caseRepo from "../db/caseRepo.js";
import * as profileRepo from "../db/profileRepo.js";
import * as transactionRepo from "../db/transactionRepo.js";
import {
  exportEncrypted,
  exportPlain,
  importEncrypted,
  importPlain,
  isEncryptedFile,
  triggerJsonDownload,
} from "../crypto/exportImport.js";
import { openPassphraseModal, openExportOptionsModal, openInfoModal } from "./modal.js";
import { legalLinks } from "../config/siteLinks.js";
import { stepFromHash, stepOf, phaseNumber, PHASES, PHASE_ORDER } from "../config/caseSteps.js";
import { stepsFor, stepRoute, isStepDone } from "../util/caseNav.js";
import { isSubmitted, refundReceived } from "../util/caseProgress.js";
import { websiteHome } from "../config/siteLinks.js";
import { caseName } from "../util/caseName.js";
import { flagHtml } from "./flow.js";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Antragsblock (Stand 2.1): Ziffern nur für die Phasen 1-3 und "€ Geld
// erhalten", wie in der Phasenleiste; Unterschritte mit Punkt. "So läuft es
// ab" ist das (i) neben dem Namen. "Geld erhalten" ist erst nach dem
// Einreichen anklickbar und hat keinen Unterschritt.
function renderCase(reclaimCase) {
  const steps = stepsFor(reclaimCase);
  const hashStep = stepOf(steps, stepFromHash(window.location.hash, reclaimCase.targetCountry.toLowerCase()));
  // Folgeseiten (parent) markieren die Zeile ihres Schritts
  const currentN = hashStep?.parent ?? hashStep?.n ?? 0;
  const visible = steps.filter((s) => !s.hidden && !s.parent);
  const stepDone = (s) => isStepDone(reclaimCase, s) && steps.filter((c) => c.parent === s.n).every((c) => isStepDone(reclaimCase, c));
  const row = (s) => {
    const cls = s.n === currentN ? "on" : stepDone(s) ? "done" : "";
    return `<div class="side-sub ${cls}" data-nav="${stepRoute(reclaimCase, s.n)}">${esc(s.title)}</div>`;
  };
  const intro = visible.find((s) => s.intro);
  const refund = steps.find((s) => s.optional);
  const submitted = isSubmitted(reclaimCase);
  const received = refundReceived(reclaimCase).received;

  const phases = PHASE_ORDER.map((phase) => {
    const ofPhase = visible.filter((s) => s.phase === phase);
    if (!ofPhase.length) return "";
    const done = ofPhase.every(stepDone);
    const now = ofPhase.some((s) => s.n === currentN);
    return `
      <div class="side-phase-block ${done ? "done" : now ? "now" : ""}">
        <div class="side-phase-head"><span class="side-phase-n">${done ? "✓" : phaseNumber(phase)}</span>${esc(PHASES[phase].title)}</div>
        ${ofPhase.map(row).join("")}
      </div>`;
  }).join("");

  const moneyCls = received ? "done" : refund && refund.n === currentN ? "now" : submitted ? "" : "locked";
  const money = refund
    ? `<div class="side-phase-block side-money ${moneyCls}" ${submitted ? `data-nav="${stepRoute(reclaimCase, refund.n)}"` : 'title="Erst nach dem Einreichen"'}>
         <div class="side-phase-head"><span class="side-phase-n">${received ? "✓" : "€"}</span>Geld erhalten</div>
       </div>`
    : "";

  return `
    <div class="sidebar-section side-case">
      <div class="side-case-head">
        <span class="side-case-name">${flagHtml(reclaimCase.targetCountry)}${esc(caseName(reclaimCase))}</span>
        ${intro ? `<button class="side-info ${intro.n === currentN ? "on" : ""}" data-nav="${stepRoute(reclaimCase, intro.n)}" title="So läuft es ab" type="button">i</button>` : ""}
      </div>
      ${phases}
      ${money}
    </div>`;
}

export function renderSidebar(container) {
  const state = getState();
  const hash = window.location.hash;
  const profile = state.currentProfile;
  const onCase = /^#\/(dk|ch|it|se)\/[^/]+\/\d$/.test(hash);
  const hasSwiss = state.cases.some((c) => c.targetCountry === "CH");
  const name = [profile?.residence?.firstName, profile?.residence?.lastName].filter(Boolean).join(" ");
  const link = (route, label) => `<a class="sidebar-link ${hash === route ? "active" : ""}" data-nav="${route}">${label}</a>`;

  container.innerHTML = `
    <div class="sidebar-brand" data-nav="#/home" title="Zur Übersicht" role="link" tabindex="0">
      <div style="width:32px;height:32px;border-radius:7px;background:rgba(255,255,255,0.13);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 12L9 17" stroke="white" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M9 17L20 5M20 5L14.9 7.1M20 5L18.4 10.3" stroke="#00B4D8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="sidebar-wordmark-wrap">
        <div class="sidebar-wordmark">DivRebound</div>
        <span class="sidebar-beta">Beta</span>
      </div>
    </div>

    <div class="sidebar-section">
      ${link("#/home", "Übersicht")}
      ${link("#/profile", "Mein Profil")}
      ${hasSwiss ? link("#/ch/bestand", "Wertpapierbestand Schweiz") : ""}
      ${link("#/anschreiben", "Anschreiben Finanzamt")}
    </div>

    ${onCase && state.currentCase ? renderCase(state.currentCase) : ""}

    <div class="sidebar-bottom">
      <div class="side-account">
        <span class="side-avatar">${esc((name || "?").slice(0, 1).toUpperCase())}</span>
        <div><b>${esc(name || "Ohne Konto")}</b><small>Daten nur in diesem Browser</small></div>
      </div>
      <div class="sidebar-actions">
        <button class="sidebar-btn" data-action="save">💾 Sicherung speichern</button>
        <button class="sidebar-btn" data-action="load">📂 Sicherung laden</button>
        <input type="file" accept="application/json,.json" class="sidebar-load-input" hidden />
      </div>
      <button class="sidebar-btn sidebar-feedback" type="button" data-feedback="sidebar">💬 Feedback geben</button>
      <nav class="sidebar-foot" aria-label="Rechtliches">
        ${legalLinks.map((l) => `<a href="${l.href}">${l.title}</a>`).join("")}
        <a class="sidebar-website" href="${websiteHome}">divrebound.com ↗</a>
      </nav>
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") navigate(el.dataset.nav);
    });
  });

  container.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const current = getState().currentProfile;
    if (!current) {
      await openInfoModal("Noch nichts zu sichern", "Lege zuerst einen Antrag an oder trage dein Profil ein.");
      return;
    }
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const cases = await caseRepo.getByProfileId(current.profileId);
    const transactions = await transactionRepo.getByProfileId(current.profileId);
    const payload = { investorProfiles: [current], reclaimCases: cases, transactions };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    triggerJsonDownload(fileJson, `${current.residence.lastName || "divrebound"}.divrebound.json`);
  });

  const loadInput = container.querySelector(".sidebar-load-input");
  container.querySelector('[data-action="load"]').addEventListener("click", () => loadInput.click());
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files[0];
    if (!file) return;
    try {
      const fileJson = JSON.parse(await file.text());
      let payload;
      if (isEncryptedFile(fileJson)) {
        const passphrase = await openPassphraseModal("import");
        if (!passphrase) {
          loadInput.value = "";
          return;
        }
        payload = await importEncrypted(fileJson, passphrase);
      } else {
        payload = importPlain(fileJson);
      }
      for (const p of payload.investorProfiles) await profileRepo.put(p);
      for (const reclaimCase of payload.reclaimCases) await caseRepo.put(reclaimCase);
      // Ältere Dateien (vor dem Wertpapierbestand Schweiz) haben keine Transaktionen.
      for (const transaction of payload.transactions ?? []) await transactionRepo.put(transaction);
      setState({ currentProfile: payload.investorProfiles[0], cases: payload.reclaimCases, currentCase: null });
      navigate("#/home");
    } catch (err) {
      await openInfoModal("Laden fehlgeschlagen", "Die Passphrase ist falsch, oder die Datei ist beschädigt.");
    }
    loadInput.value = "";
  });
}

export function mountSidebar(container) {
  renderSidebar(container);
  // Auch beim Seitenwechsel neu zeichnen: aktiver Link und aktueller Schritt hängen am Hash
  window.addEventListener("hashchange", () => renderSidebar(container));
  return subscribe(() => renderSidebar(container));
}
