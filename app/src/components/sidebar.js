import { getState, setState, subscribe } from "../store/store.js";
import { navigate } from "../router/router.js";
import * as caseRepo from "../db/caseRepo.js";
import * as profileRepo from "../db/profileRepo.js";
import { exportEncrypted, importEncrypted, triggerJsonDownload } from "../crypto/exportImport.js";
import { openPassphraseModal, openInfoModal } from "./modal.js";

const STATUS_ORDER = [
  "draft",
  "residency_form_generated",
  "awaiting_tax_office",
  "ready_for_skat_submission",
  "skat_form_verified",
  "submitted",
];

function stepStatus(status, step) {
  const idx = STATUS_ORDER.indexOf(status);
  if (step === 1) return idx >= 1 ? "done" : "current";
  if (idx >= 5) return "done";
  return idx >= 2 ? "current" : "todo";
}

function stepIcon(status) {
  if (status === "done") {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  }
  if (status === "current") {
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/></svg>`;
  }
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
}

function caseRoute(reclaimCase, step) {
  if (step === 1) return `#/dk/${reclaimCase.caseId}/step1`;
  return `#/dk/${reclaimCase.caseId}/step2/verify`;
}

function caseLabel(reclaimCase) {
  const d = new Date(reclaimCase.createdAt);
  return `DivRebound ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function chevron() {
  return `<svg class="icon chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
}

function renderCase(reclaimCase, activeCaseId) {
  const isActive = reclaimCase.caseId === activeCaseId;
  const s1 = stepStatus(reclaimCase.status, 1);
  const s2 = stepStatus(reclaimCase.status, 2);
  return `
    <details class="nav-case ${isActive ? "active" : ""}" ${isActive ? "open" : ""} data-case-id="${reclaimCase.caseId}">
      <summary>${chevron()} ${caseLabel(reclaimCase)}</summary>
      <div class="nav-steps">
        <div class="nav-step ${s1}" data-nav="${caseRoute(reclaimCase, 1)}">${stepIcon(s1)} Schritt 1: Wohnsitzbescheinigung</div>
        <div class="nav-step ${s2}" data-nav="${caseRoute(reclaimCase, 2)}">${stepIcon(s2)} Schritt 2: SKAT-Portal</div>
      </div>
    </details>`;
}

export function renderSidebar(container) {
  const state = getState();
  const activeCaseId = state.currentCase?.caseId ?? null;
  const dkCases = state.cases.filter((c) => c.targetCountry === "DK");

  container.innerHTML = `
    <div class="sidebar-brand">
      <div style="width:32px;height:32px;border-radius:7px;background:rgba(255,255,255,0.13);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 8L9.5 15" stroke="white" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M9.5 15L19 5" stroke="#00B4D8" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M13.5 5H19V10.5" stroke="#00B4D8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="sidebar-wordmark">Div<span>Rebound</span></div>
    </div>

    <div class="sidebar-actions">
      <button class="sidebar-btn" data-action="load">📂 Bearbeitung laden</button>
      <button class="sidebar-btn" data-action="save">💾 Bearbeitung speichern</button>
      <input type="file" accept="application/json,.json" class="sidebar-load-input" hidden />
    </div>

    <div class="sidebar-divider"></div>

    <div class="sidebar-section">
      <div class="sidebar-section-title">Nutzer</div>
      <a class="sidebar-link" data-nav="#/profile">Persönliche Daten</a>
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

      <details class="nav-country disabled">
        <summary>${chevron()} Schweiz <span class="tree-stub-tag">bald</span></summary>
      </details>
      <details class="nav-country disabled">
        <summary>${chevron()} Italien <span class="tree-stub-tag">bald</span></summary>
      </details>
    </div>
  `;

  container.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigate(el.dataset.nav));
  });

  container.querySelector('[data-action="new-case"]').addEventListener("click", async () => {
    const profile = getState().currentProfile;
    if (!profile) {
      navigate("#/onboarding");
      return;
    }
    const reclaimCase = await caseRepo.createCase(profile, "DK");
    setState({ cases: [...getState().cases, reclaimCase], currentCase: reclaimCase });
    navigate(`#/dk/${reclaimCase.caseId}/step1`);
  });

  container.querySelector('[data-action="save"]').addEventListener("click", async () => {
    const profile = getState().currentProfile;
    if (!profile) return;
    const passphrase = await openPassphraseModal("export");
    if (!passphrase) return;
    const cases = await caseRepo.getByProfileId(profile.profileId);
    const fileJson = await exportEncrypted({ investorProfiles: [profile], reclaimCases: cases }, passphrase);
    triggerJsonDownload(fileJson, `${profile.residence.lastName || "divrebound"}.divrebound.json`);
  });

  const loadInput = container.querySelector(".sidebar-load-input");
  container.querySelector('[data-action="load"]').addEventListener("click", () => loadInput.click());
  loadInput.addEventListener("change", async () => {
    const file = loadInput.files[0];
    if (!file) return;
    const fileJson = JSON.parse(await file.text());
    const passphrase = await openPassphraseModal("import");
    if (!passphrase) return;
    try {
      const payload = await importEncrypted(fileJson, passphrase);
      for (const profile of payload.investorProfiles) await profileRepo.put(profile);
      for (const reclaimCase of payload.reclaimCases) await caseRepo.put(reclaimCase);
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
