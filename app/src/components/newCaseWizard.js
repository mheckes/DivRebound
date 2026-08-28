// Popup-Dialog beim Anlegen eines neuen DivRebound (ersetzt den früheren reinen
// Text-Bestätigungsdialog). Zeigt immer alle drei Fragen (Privatanleger,
// Wohnsitzland, Zielland des DivRebound):
//  - Ist noch kein Profil vorhanden, sind Privatanleger + Wohnsitzland echte
//    Eingabefelder (ersetzt die frühere separate Onboarding-Seite).
//  - Ist bereits ein Profil vorhanden, werden Privatanleger + Wohnsitzland nur
//    noch als bereits beantwortet angezeigt (nicht mehr änderbar - dafür gibt
//    es die Profilseite) - auswählbar bleibt ausschließlich das Zielland.
// Aktuell ist ohnehin je Frage nur eine Option freigeschaltet (Deutschland /
// Dänemark), weitere sind wie im Rest der App als "bald" markiert.

import { getState, setState } from "../store/store.js";
import { navigate } from "../router/router.js";
import * as profileRepo from "../db/profileRepo.js";
import * as caseRepo from "../db/caseRepo.js";

const RESIDENCE_OPTIONS = [
  { code: "DE", label: "Deutschland", available: true },
  { code: "AT", label: "Österreich", available: false },
  { code: "CH", label: "Schweiz", available: false },
];
const TARGET_OPTIONS = [
  { code: "DK", label: "Dänemark", available: true },
  { code: "CH", label: "Schweiz", available: false },
  { code: "IT", label: "Italien", available: false },
];

function mountOverlay(innerHtml) {
  const overlay = document.createElement("div");
  overlay.className = "dr-modal-overlay";
  overlay.innerHTML = `<div class="dr-modal wizard-modal">${innerHtml}</div>`;
  document.getElementById("divrebound-app").appendChild(overlay);
  return overlay;
}

function optionListHtml(options, selected, locked, groupName) {
  return options
    .map((o) => {
      const isSelected = o.code === selected;
      const disabled = locked || !o.available;
      return `
        <label class="wizard-option ${isSelected ? "selected" : ""} ${disabled ? "disabled" : ""}">
          <input type="radio" name="${groupName}" value="${o.code}" ${isSelected ? "checked" : ""} ${disabled ? "disabled" : ""}>
          <span>${o.label}</span>
          ${!o.available ? '<span class="tree-stub-tag wizard-soon-tag">bald</span>' : ""}
        </label>`;
    })
    .join("");
}

/**
 * @returns {Promise<{ profile: InvestorProfile, reclaimCase: ReclaimCase } | null>} null bei Abbruch
 */
export function openNewCaseWizard() {
  return new Promise((resolve) => {
    const existingProfile = getState().currentProfile;
    const locked = Boolean(existingProfile);

    let heldInPrivateAssets = existingProfile ? existingProfile.heldInPrivateAssets : null;
    let residenceCountry = existingProfile ? existingProfile.residence.country : "DE";
    let targetCountry = "DK";

    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">Neuen DivRebound anlegen</h2>

      <div class="wizard-row">
        <div class="wizard-question">Hältst du deine Aktien im Privatvermögen?</div>
        ${
          locked
            ? `<div class="wizard-locked-answer">✓ ${heldInPrivateAssets ? "Ja" : "Nein"} <span class="wizard-locked-hint">aus Profil übernommen</span></div>`
            : `<div class="wizard-options" id="wizard-assets">
                <label class="wizard-option"><input type="radio" name="assets" value="yes"><span>Ja</span></label>
                <label class="wizard-option"><input type="radio" name="assets" value="no"><span>Nein</span></label>
              </div>
              <div class="field-error" id="wizard-assets-error"></div>`
        }
      </div>

      <div class="wizard-row">
        <div class="wizard-question">Wohnsitzland</div>
        <div class="wizard-options" id="wizard-residence">
          ${optionListHtml(RESIDENCE_OPTIONS, residenceCountry, locked, "residence")}
        </div>
      </div>

      <div class="wizard-row">
        <div class="wizard-question">DivRebound für welches Land?</div>
        <div class="wizard-options" id="wizard-target">
          ${optionListHtml(TARGET_OPTIONS, targetCountry, false, "target")}
        </div>
      </div>

      <div class="dr-modal-actions">
        <button class="btn-secondary wizard-cancel">Abbrechen</button>
        <button class="btn-primary wizard-confirm">Anlegen</button>
      </div>
    `);

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.querySelector(".wizard-cancel").addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(null);
    });

    if (!locked) {
      overlay.querySelectorAll('input[name="assets"]').forEach((el) => {
        el.addEventListener("change", () => {
          heldInPrivateAssets = el.value === "yes";
          overlay.querySelectorAll('input[name="assets"]').forEach((r) => r.closest(".wizard-option").classList.toggle("selected", r.checked));
          overlay.querySelector("#wizard-assets-error").textContent = "";
        });
      });
    }

    overlay.querySelectorAll('input[name="residence"]').forEach((el) => {
      el.addEventListener("change", () => {
        residenceCountry = el.value;
        overlay.querySelectorAll('input[name="residence"]').forEach((r) => r.closest(".wizard-option").classList.toggle("selected", r.checked));
      });
    });
    overlay.querySelectorAll('input[name="target"]').forEach((el) => {
      el.addEventListener("change", () => {
        targetCountry = el.value;
        overlay.querySelectorAll('input[name="target"]').forEach((r) => r.closest(".wizard-option").classList.toggle("selected", r.checked));
      });
    });

    overlay.querySelector(".wizard-confirm").addEventListener("click", async () => {
      if (!locked && heldInPrivateAssets === null) {
        overlay.querySelector("#wizard-assets-error").textContent = "Bitte auswählen.";
        return;
      }
      if (!locked && heldInPrivateAssets === false) {
        overlay.querySelector("#wizard-assets-error").textContent =
          "DivRebound deckt im MVP ausschließlich Aktien im Privatvermögen ab.";
        return;
      }

      let profile = existingProfile;
      if (!profile) {
        profile = await profileRepo.createProfile(residenceCountry);
        setState({ currentProfile: profile });
      }
      const reclaimCase = await caseRepo.createCase(profile, targetCountry);
      setState({ cases: [...getState().cases, reclaimCase], currentCase: reclaimCase });

      close({ profile, reclaimCase });
      navigate(`#/dk/${reclaimCase.caseId}/step1`);
    });
  });
}
