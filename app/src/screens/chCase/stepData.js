// Schweiz, Schritt "Deine Angaben" (#/ch/:caseId/8): persönliche Angaben, die
// das ePortal und das Anschreiben brauchen. Gleicher Baustein wie in den
// anderen Ländern (components/checklist.js) - oben, was fehlt, darunter, was
// schon im Profil steht.

import { getState } from "../../store/store.js";
import { PROFILE_FIELDS } from "../../util/profileFields.js";
import { hasInvalidInput } from "../../util/autosave.js";
import { PROFILE_ITEM, isItemFilled, profileCardsHtml, bindChecklistAutosave } from "../../components/checklist.js";
import { stepHeader, stepNavHtml, bindStepNav } from "./chShared.js";

const REQUIRED = ["name", "address", "birthDate", "tin", "taxNumber", "taxOffice", "contact", "bank"];

function updateNext(container) {
  const profile = getState().currentProfile;
  const complete = REQUIRED.every((k) => isItemFilled(profile, PROFILE_ITEM[k]));
  const valid = ["tin", "taxNumber", "iban"].every((k) => PROFILE_FIELDS[k].validate(PROFILE_FIELDS[k].read(profile), profile) === true);
  container.querySelector("[data-step-next]").disabled = !(complete && valid) || hasInvalidInput();
}

export async function mount(container, reclaimCase) {
  const profile = getState().currentProfile;
  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 8)}
    <p class="ch-lead">Diese Angaben trägst du gleich ins ePortal ein.</p>
    ${profileCardsHtml(profile, REQUIRED)}
    ${stepNavHtml(8)}
    </div>`;
  bindStepNav(container, reclaimCase, 8);
  updateNext(container);
  return bindChecklistAutosave(container, () => updateNext(container));
}
