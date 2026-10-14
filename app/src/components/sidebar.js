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
import { openPassphraseModal, openExportOptionsModal, openInfoModal, openConfirmModal } from "./modal.js";
import { openNewCaseWizard } from "./newCaseWizard.js";
import { legalLinks } from "../config/siteLinks.js";
import { CH_STEPS, chStepRoute, DK_STEPS, dkStepRoute, dkStepFromHash } from "../config/caseSteps.js";

const STATUS_ORDER = [
  "draft",
  "residency_form_generated",
  "awaiting_tax_office",
  "ready_for_skat_submission",
  "skat_form_verified",
  "submitted",
];

function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function chevron() {
  return `<svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
}

// Dänemark: nummerierte Schritte wie bei der Schweiz (docs/konzept-schweiz.md §1a).
// Erledigt: mit "Weiter" verlassen (reclaimCase.dkStepsDone), aus dem Status
// abgeleitet (Formular erzeugt = Schritte 1-4, eingereicht = alle) oder vor dem
// gerade geöffneten Schritt.
function renderCase(reclaimCase, activeCaseId) {
  const isActive = reclaimCase.caseId === activeCaseId;
  const currentStep = isActive ? dkStepFromHash(window.location.hash) : 0;
  const statusIdx = STATUS_ORDER.indexOf(reclaimCase.status);
  const done = new Set(reclaimCase.dkStepsDone ?? []);
  const isDone = (n) => done.has(n) || (statusIdx >= 2 && n <= 4) || statusIdx >= 5 || (currentStep > 0 && n < currentStep);
  return `
    <details class="nav-case ${isActive ? "active" : ""}" ${isActive ? "open" : ""} data-case-id="${reclaimCase.caseId}">
      <summary>
        ${chevron()}
        <span style="flex:1;">${caseLabel(reclaimCase)}</span>
        <button class="nav-case-delete" data-action="delete-case" data-case-id="${reclaimCase.caseId}" title="Fall löschen">✕</button>
      </summary>
      <div class="nav-steps">
        ${DK_STEPS.map((s) => {
          const cls = s.n === currentStep ? "current" : isDone(s.n) ? "done" : "";
          return `<div class="nav-step nav-step-numbered ${cls}" data-nav="${dkStepRoute(reclaimCase.caseId, s.n)}"><span class="nav-step-num">${cls === "done" ? "✓" : s.n}</span>${s.title}</div>`;
        }).join("")}
      </div>
    </details>`;
}

// Schweiz: nummerierte Schritte (Ziffer im Kreis, erledigt = ✓), siehe
// docs/konzept-schweiz.md §1a. Erledigt ist ein Schritt, wenn er mit "Weiter"
// verlassen wurde (reclaimCase.ch.stepsDone) bzw. der Fall abgeschlossen ist.
function renderSwissCase(reclaimCase, activeCaseId) {
  const isActive = reclaimCase.caseId === activeCaseId;
  const currentStep = isActive ? Number(window.location.hash.match(/^#\/ch\/[^/]+\/(\d)$/)?.[1] ?? 0) : 0;
  const done = new Set(reclaimCase.ch?.stepsDone ?? []);
  const completed = Boolean(reclaimCase.ch?.completedAt);
  return `
    <details class="nav-case ${isActive ? "active" : ""}" ${isActive ? "open" : ""} data-case-id="${reclaimCase.caseId}">
      <summary>
        ${chevron()}
        <span style="flex:1;">${caseLabel(reclaimCase)}</span>
        <button class="nav-case-delete" data-action="delete-case" data-case-id="${reclaimCase.caseId}" title="Fall löschen">✕</button>
      </summary>
      <div class="nav-steps">
        ${CH_STEPS.map((s) => {
          const isDone = completed || done.has(s.n);
          const cls = s.n === currentStep ? "current" : isDone ? "done" : "";
          return `<div class="nav-step nav-step-numbered ${cls}" data-nav="${chStepRoute(reclaimCase.caseId, s.n)}"><span class="nav-step-num">${isDone && s.n !== currentStep ? "✓" : s.n}</span>${s.title}</div>`;
        }).join("")}
      </div>
    </details>`;
}

export function renderSidebar(container) {
  const state = getState();
  const activeCaseId = state.currentCase?.caseId ?? null;
  const dkCases = state.cases.filter((c) => c.targetCountry === "DK");
  const chCases = state.cases.filter((c) => c.targetCountry === "CH");

  container.innerHTML = `
    <div class="sidebar-brand">
      <div style="width:32px;height:32px;border-radius:7px;background:rgba(255,255,255,0.13);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 12L9 17" stroke="white" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M9 17L20 5M20 5L14.9 7.1M20 5L18.4 10.3" stroke="#00B4D8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="sidebar-wordmark">DivRebound</div>
    </div>

    <div class="sidebar-actions">
      <button class="sidebar-btn" data-action="load">📂 Bearbeitung laden</button>
      <button class="sidebar-btn" data-action="save">💾 Bearbeitung speichern</button>
      <input type="file" accept="application/json,.json" class="sidebar-load-input" hidden />
    </div>

    <div class="sidebar-divider"></div>

    <a class="sidebar-link" data-nav="#/home">Home</a>

    <div class="sidebar-section">
      <div class="sidebar-section-title">Nutzer</div>
      <a class="sidebar-link" data-nav="#/profile">Persönliche Daten</a>
      <a class="sidebar-link" data-nav="#/anschreiben">Anschreiben Finanzamt</a>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">Quellensteuer</div>
      <div class="sidebar-new" data-action="new-case">＋ Neuer DivRebound</div>

      <details class="nav-country" open>
        <summary>${chevron()} Dänemark</summary>
        <div class="nav-case-group">
          ${dkCases.map((c) => renderCase(c, activeCaseId)).join("")}
        </div>
      </details>

      <details class="nav-country" open>
        <summary>${chevron()} Schweiz</summary>
        <div class="nav-case-group">
          <div class="nav-holdings" data-nav="#/ch/bestand">Wertpapierbestand</div>
          ${chCases.map((c) => renderSwissCase(c, activeCaseId)).join("")}
        </div>
      </details>
      <details class="nav-country disabled">
        <summary>${chevron()} Italien <span class="tree-stub-tag">bald</span></summary>
      </details>
    </div>

    <nav class="sidebar-foot" aria-label="Rechtliches">
      ${legalLinks.map((l) => `<a href="${l.href}">${l.title}</a>`).join("")}
    </nav>
  `;

  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  container.querySelector('[data-action="new-case"]').addEventListener("click", () => {
    openNewCaseWizard();
  });

  container.querySelectorAll('[data-action="delete-case"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault(); // verhindert, dass <summary> das <details> auf-/zuklappt
      e.stopPropagation();
      const caseId = btn.dataset.caseId;
      const reclaimCase = getState().cases.find((c) => c.caseId === caseId);
      const confirmed = await openConfirmModal(
        "Fall wirklich löschen?",
        `„${caseLabel(reclaimCase)}" wird unwiderruflich gelöscht, inklusive aller erfassten Ausschüttungen. Bereits heruntergeladene Dokumente sind davon nicht betroffen.`,
        { confirmLabel: "Löschen", danger: true }
      );
      if (!confirmed) return;
      await caseRepo.remove(caseId);
      const remainingCases = getState().cases.filter((c) => c.caseId !== caseId);
      const wasActive = getState().currentCase?.caseId === caseId;
      setState({
        cases: remainingCases,
        currentCase: wasActive ? null : getState().currentCase,
      });
      if (wasActive) {
        // Nicht mehr auf den ersten verbliebenen Fall springen: der kann aus
        // einem anderen Land sein (eigene Routen je Land).
        navigate("#/home");
      }
    });
  });

  container.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const profile = getState().currentProfile;
    if (!profile) return;
    const choice = await openExportOptionsModal();
    if (!choice) return;
    const cases = await caseRepo.getByProfileId(profile.profileId);
    const transactions = await transactionRepo.getByProfileId(profile.profileId);
    const payload = { investorProfiles: [profile], reclaimCases: cases, transactions };
    const fileJson = choice.encrypt ? await exportEncrypted(payload, choice.passphrase) : exportPlain(payload);
    triggerJsonDownload(fileJson, `${profile.residence.lastName || "divrebound"}.divrebound.json`);
  });

  const loadInput = container.querySelector(".sidebar-load-input");
  container.querySelector('[data-action="load"]').addEventListener("click", () => loadInput.click());
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files[0];
    if (!file) return;
    const fileJson = JSON.parse(await file.text());
    try {
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
      for (const profile of payload.investorProfiles) await profileRepo.put(profile);
      for (const reclaimCase of payload.reclaimCases) await caseRepo.put(reclaimCase);
      // Ältere Dateien (vor dem Wertpapierbestand Schweiz) haben keine Transaktionen.
      for (const transaction of payload.transactions ?? []) await transactionRepo.put(transaction);
      const profile = payload.investorProfiles[0];
      setState({ currentProfile: profile, cases: payload.reclaimCases, currentCase: null });
      navigate("#/profile");
    } catch (err) {
      await openInfoModal("Import fehlgeschlagen", "Die Passphrase ist falsch, oder die Datei ist beschädigt.");
    }
    loadInput.value = "";
  });
}

export function mountSidebar(container) {
  renderSidebar(container);
  return subscribe(() => renderSidebar(container));
}
