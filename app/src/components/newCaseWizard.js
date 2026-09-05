// Popup-Dialog beim Anlegen eines neuen DivRebound (ersetzt den früheren reinen
// Text-Bestätigungsdialog). Zeigt immer alle drei Fragen (Privatanleger,
// Wohnsitzland, Zielland des DivRebound):
//  - Privatanleger-Bestätigung und Wohnsitzland haben aktuell beide nur eine
//    einzige mögliche Antwort ("Ja" / "Deutschland") - analog dargestellt als
//    bereits vorausgewählte Einzeloption, keine echte Ja/Nein-Entscheidung.
//    Sobald ein Profil existiert, werden beide zusätzlich gesperrt angezeigt
//    (nicht mehr änderbar - dafür gibt es die Profilseite).
// Auswählbar bleibt in jedem Fall das Zielland des DivRebound.

import { getState, setState } from "../store/store.js";
import { navigate } from "../router/router.js";
import * as profileRepo from "../db/profileRepo.js";
import * as caseRepo from "../db/caseRepo.js";

const ASSETS_OPTIONS = [{ code: "yes", label: "Ja", available: true }];
const RESIDENCE_OPTIONS = [{ code: "DE", label: "Deutschland", available: true }];
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
    // Beide Fragen spiegeln echte, dauerhaft gespeicherte Profildaten (siehe
    // screens/profile/profile.js) - gesperrt, sobald ein Profil existiert.
    const profileFieldsLocked = Boolean(existingProfile);

    let residenceCountry = existingProfile ? existingProfile.residence.country : "DE";
    let targetCountry = "DK";

    const overlay = mountOverlay(`
      <h2 class="dr-modal-title">Neuen DivRebound anlegen</h2>

      <div class="wizard-row">
        <div class="wizard-question">Hältst du deine Aktien im Privatvermögen?</div>
        <div class="wizard-options" id="wizard-assets">
          ${optionListHtml(ASSETS_OPTIONS, "yes", profileFieldsLocked, "assets")}
        </div>
      </div>

      <div class="wizard-row">
        <div class="wizard-question">Wohnsitzland</div>
        <div class="wizard-options" id="wizard-residence">
          ${optionListHtml(RESIDENCE_OPTIONS, residenceCountry, profileFieldsLocked, "residence")}
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
      let profile = existingProfile;
      if (!profile) {
        // profileRepo.createProfile() setzt heldInPrivateAssets bereits fest
        // auf true - keine weitere Bestätigung hier nötig, siehe Kommentar oben.
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
